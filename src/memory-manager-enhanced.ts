import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';
import { Config } from './config.js';
import { TokenManager, CompressionOptions } from './utils/token-manager.js';

interface Memory {
  id: string;
  content: string;
  context: string;
  importance: number;
  timestamp: string;
  metadata: Record<string, any>;
  accessCount: number;
  lastAccessed: string;
}

interface MemoryScore {
  memory: Memory;
  semanticScore: number;
  recencyScore: number;
  importanceScore: number;
  frequencyScore: number;
  totalScore: number;
}

interface ExactSearchIndex {
  contentIndex: Map<string, Set<string>>; // keyword -> memory ids
  metadataIndex: Map<string, Map<string, Set<string>>>; // field -> value -> memory ids
  memoryCache: Map<string, Memory>; // id -> memory
}

export class EnhancedMemoryManager {
  private client: ChromaClient;
  private collection: any;
  private openai: OpenAI;
  private exactIndex: ExactSearchIndex;
  
  constructor(private config: Config) {
    const chromaUrl = `http://${config.chromaHost}:${config.chromaPort}`;
    console.error(`Connecting to ChromaDB at: ${chromaUrl}`);
    
    this.client = new ChromaClient({
      host: config.chromaHost,
      port: parseInt(config.chromaPort)
    });
    
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    
    // Initialize exact search index
    this.exactIndex = {
      contentIndex: new Map(),
      metadataIndex: new Map(),
      memoryCache: new Map()
    };
  }
  
  async initialize(): Promise<void> {
    // Safety check for production
    if (this.config.environment === 'PRODUCTION' && this.config.tierEnabled) {
      throw new Error('🚨 TIERS CANNOT BE ENABLED IN PRODUCTION YET! Please test in DEVELOPMENT first.');
    }
    
    if (this.config.isDevelopment) {
      console.warn('🧪 Running in DEVELOPMENT mode - changes are isolated from production');
    }
    
    try {
      // Test connection with retry for Docker startup
      let retries = 5;
      while (retries > 0) {
        try {
          await this.client.heartbeat();
          break;
        } catch (error) {
          if (retries === 1) throw error;
          console.error(`ChromaDB not ready, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
        }
      }
      
      // Create or get collection with custom embedding function
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.memoryCollectionName,
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embeddings = await Promise.all(
              texts.map(text => this.generateEmbedding(text))
            );
            return embeddings;
          }
        },
        metadata: {
          "hnsw:space": "cosine",
          "hnsw:construction_ef": 200,
          "hnsw:M": 32
        }
      });
      
      console.error(`Connected to ChromaDB collection: ${this.config.memoryCollectionName}`);
      
      // Build exact search index from existing memories
      await this.rebuildExactIndex();
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }
  
  async isConnected(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  // Build exact search index from ChromaDB
  private async rebuildExactIndex(): Promise<void> {
    console.error('Building exact search index...');
    
    // Get all memories from ChromaDB
    const allMemories = await this.collection.get();
    
    if (!allMemories.documents || allMemories.documents.length === 0) {
      console.error('No memories to index');
      return;
    }
    
    // Clear existing indexes
    this.exactIndex.contentIndex.clear();
    this.exactIndex.metadataIndex.clear();
    this.exactIndex.memoryCache.clear();
    
    // Index each memory
    for (let i = 0; i < allMemories.documents.length; i++) {
      const memory: Memory = {
        id: allMemories.ids[i],
        content: allMemories.documents[i],
        context: allMemories.metadatas[i]?.context || 'unknown',
        importance: allMemories.metadatas[i]?.importance || 0.5,
        timestamp: allMemories.metadatas[i]?.timestamp || new Date().toISOString(),
        metadata: allMemories.metadatas[i] || {},
        accessCount: allMemories.metadatas[i]?.accessCount || 0,
        lastAccessed: allMemories.metadatas[i]?.lastAccessed || allMemories.metadatas[i]?.timestamp
      };
      
      this.indexMemory(memory);
    }
    
    console.error(`Indexed ${allMemories.documents.length} memories for exact search`);
  }
  
  // Index a single memory for exact search
  private indexMemory(memory: Memory): void {
    // Cache the memory
    this.exactIndex.memoryCache.set(memory.id, memory);
    
    // Index content keywords
    const keywords = this.extractKeywords(memory.content);
    for (const keyword of keywords) {
      if (!this.exactIndex.contentIndex.has(keyword)) {
        this.exactIndex.contentIndex.set(keyword, new Set());
      }
      this.exactIndex.contentIndex.get(keyword)!.add(memory.id);
    }
    
    // Index metadata fields
    for (const [field, value] of Object.entries(memory.metadata)) {
      if (typeof value === 'string') {
        if (!this.exactIndex.metadataIndex.has(field)) {
          this.exactIndex.metadataIndex.set(field, new Map());
        }
        if (!this.exactIndex.metadataIndex.get(field)!.has(value)) {
          this.exactIndex.metadataIndex.get(field)!.set(value, new Set());
        }
        this.exactIndex.metadataIndex.get(field)!.get(value)!.add(memory.id);
      }
    }
  }
  
  // Extract keywords from text (simple tokenization)
  private extractKeywords(text: string): Set<string> {
    // Simple keyword extraction - can be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/) // Split on whitespace
      .filter(word => word.length > 2); // Filter short words
    
    return new Set(words);
  }
  
  // Exact search for memories
  async searchExact(
    query: string,
    field?: string,
    limit: number = 10
  ): Promise<Memory[]> {
    const results: Memory[] = [];
    const foundIds = new Set<string>();
    
    if (field) {
      // Search in specific metadata field
      const fieldIndex = this.exactIndex.metadataIndex.get(field);
      if (fieldIndex && fieldIndex.has(query)) {
        const memoryIds = fieldIndex.get(query)!;
        for (const id of memoryIds) {
          if (foundIds.size >= limit) break;
          foundIds.add(id);
          const memory = this.exactIndex.memoryCache.get(id);
          if (memory) results.push(memory);
        }
      }
    } else {
      // Search in content
      const keywords = this.extractKeywords(query);
      
      // Find memories containing all keywords
      let commonIds: Set<string> | null = null;
      
      for (const keyword of keywords) {
        const memoryIds = this.exactIndex.contentIndex.get(keyword);
        if (!memoryIds || memoryIds.size === 0) {
          commonIds = new Set(); // No results if any keyword is missing
          break;
        }
        
        if (commonIds === null) {
          commonIds = new Set(memoryIds);
        } else {
          // Intersection of memory ids
          commonIds = new Set(Array.from(commonIds).filter(id => memoryIds.has(id as string)));
        }
      }
      
      // Get memories for found ids
      if (commonIds) {
        for (const id of commonIds) {
          if (results.length >= limit) break;
          const memory = this.exactIndex.memoryCache.get(id);
          if (memory) results.push(memory);
        }
      }
    }
    
    // Update access patterns
    for (const memory of results) {
      memory.accessCount++;
      memory.lastAccessed = new Date().toISOString();
      
      // Update in ChromaDB
      await this.collection.update({
        ids: [memory.id],
        metadatas: [{
          ...memory.metadata,
          accessCount: memory.accessCount,
          lastAccessed: memory.lastAccessed
        }]
      });
    }
    
    return results;
  }
  
  // Semantic search (existing functionality)
  async searchSemantic(
    query: string,
    context?: string,
    limit: number = 5
  ): Promise<MemoryScore[]> {
    try {
      // Build where clause
      const whereClause: any = {};
      if (context) {
        whereClause.context = context;
      } else {
        // If no context specified, prefer higher importance memories
        whereClause.importance = { $gte: 0.7 };
      }
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Query ChromaDB with extra results for reranking
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: Math.min(limit * 2, 20), // Cap at 20 for performance
        where: whereClause
      });
      
      if (!results.documents[0] || results.documents[0].length === 0) {
        console.error('No memories found for query:', query);
        return [];
      }
      
      // Calculate multi-factor scores
      const currentTime = Date.now();
      const scoredMemories: MemoryScore[] = [];
      
      for (let i = 0; i < results.documents[0].length; i++) {
        const metadata = results.metadatas[0][i];
        const memory: Memory = {
          id: results.ids[0][i],
          content: results.documents[0][i],
          context: metadata.context || 'unknown',
          importance: metadata.importance || 0.5,
          timestamp: metadata.timestamp || new Date().toISOString(),
          metadata: metadata,
          accessCount: metadata.accessCount || 0,
          lastAccessed: metadata.lastAccessed || metadata.timestamp
        };
        
        // Calculate component scores
        const semanticScore = 1 - (results.distances[0][i] || 0);
        const recencyScore = this.calculateRecencyScore(memory.timestamp, currentTime);
        const importanceScore = memory.importance;
        const frequencyScore = this.calculateFrequencyScore(memory.accessCount);
        
        // Calculate weighted total score
        const totalScore = (
          semanticScore * 0.4 +
          recencyScore * 0.3 +
          importanceScore * 0.2 +
          frequencyScore * 0.1
        );
        
        scoredMemories.push({
          memory,
          semanticScore,
          recencyScore,
          importanceScore,
          frequencyScore,
          totalScore
        });
      }
      
      // Sort by total score and return top results
      scoredMemories.sort((a, b) => b.totalScore - a.totalScore);
      
      // Update access patterns for returned memories
      const returnedMemories = scoredMemories.slice(0, limit);
      for (const scoredMemory of returnedMemories) {
        await this.updateMemoryAccess(scoredMemory.memory.id);
      }
      
      return returnedMemories;
    } catch (error) {
      console.error('Error in semantic search:', error);
      throw error;
    }
  }
  
  // Hybrid search combining exact and semantic
  async searchHybrid(
    query: string,
    context?: string,
    exactWeight: number = 0.4,
    limit: number = 10
  ): Promise<MemoryScore[]> {
    // Run both searches in parallel
    const [exactResults, semanticResults] = await Promise.all([
      this.searchExact(query, undefined, limit * 2),
      this.searchSemantic(query, context, limit * 2)
    ]);
    
    // Create a map to merge results
    const mergedResults = new Map<string, MemoryScore>();
    
    // Add exact search results with high exact scores
    for (const memory of exactResults) {
      const score: MemoryScore = {
        memory,
        semanticScore: 0, // Will be updated if also in semantic results
        recencyScore: this.calculateRecencyScore(memory.timestamp, Date.now()),
        importanceScore: memory.importance,
        frequencyScore: this.calculateFrequencyScore(memory.accessCount),
        totalScore: 0 // Will be calculated
      };
      mergedResults.set(memory.id, score);
    }
    
    // Merge semantic search results
    for (const semanticResult of semanticResults) {
      const existing = mergedResults.get(semanticResult.memory.id);
      if (existing) {
        // Update semantic score for existing result
        existing.semanticScore = semanticResult.semanticScore;
      } else {
        // Add new result from semantic search
        mergedResults.set(semanticResult.memory.id, semanticResult);
      }
    }
    
    // Calculate hybrid scores
    const semanticWeight = 1 - exactWeight;
    for (const result of mergedResults.values()) {
      // Exact match bonus (1.0 if in exact results, 0 otherwise)
      const exactBonus = exactResults.some(m => m.id === result.memory.id) ? 1.0 : 0;
      
      // Calculate hybrid total score
      result.totalScore = (
        (exactBonus * exactWeight) +
        (result.semanticScore * semanticWeight * 0.4) +
        (result.recencyScore * 0.3) +
        (result.importanceScore * 0.2) +
        (result.frequencyScore * 0.1)
      );
    }
    
    // Sort by total score and return top results
    const allResults = Array.from(mergedResults.values());
    allResults.sort((a, b) => b.totalScore - a.totalScore);
    
    return allResults.slice(0, limit);
  }
  
  // Store memory with exact indexing
  async storeMemory(
    content: string,
    context: string = 'general',
    metadata: Record<string, any> = {}
  ): Promise<{ stored: boolean; id?: string; importance?: number }> {
    try {
      // Assess importance
      const importance = await this.assessImportance(content, context);
      
      if (importance < this.config.memoryImportanceThreshold) {
        console.error(`Memory importance ${importance} below threshold ${this.config.memoryImportanceThreshold}`);
        return { stored: false, importance };
      }
      
      // Generate ID
      const timestamp = new Date().toISOString();
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare metadata
      const fullMetadata = {
        ...metadata,
        context,
        importance,
        timestamp,
        accessCount: 0,
        lastAccessed: timestamp
      };
      
      // Store in ChromaDB
      await this.collection.add({
        ids: [id],
        documents: [content],
        metadatas: [fullMetadata]
      });
      
      // Index for exact search
      const memory: Memory = {
        id,
        content,
        context,
        importance,
        timestamp,
        metadata: fullMetadata,
        accessCount: 0,
        lastAccessed: timestamp
      };
      this.indexMemory(memory);
      
      console.error(`Stored memory ${id} with importance ${importance}`);
      
      return { stored: true, id, importance };
    } catch (error) {
      console.error('Error storing memory:', error);
      throw error;
    }
  }
  
  // Helper methods (existing)
  private calculateRecencyScore(timestamp: string, currentTime: number): number {
    const memoryTime = new Date(timestamp).getTime();
    const ageInHours = (currentTime - memoryTime) / (1000 * 60 * 60);
    
    // Decay function: score decreases as memory gets older
    // Score is 1.0 for memories less than 1 hour old
    // Score is 0.5 for memories 24 hours old
    // Score approaches 0 for very old memories
    return Math.exp(-ageInHours / 24);
  }
  
  private calculateFrequencyScore(accessCount: number): number {
    // Logarithmic scaling to prevent extremely high access counts from dominating
    // Score is 0 for never accessed, approaches 1 for frequently accessed
    return Math.min(1, Math.log10(accessCount + 1) / 2);
  }
  
  private async updateMemoryAccess(memoryId: string): Promise<void> {
    try {
      // Get current metadata
      const result = await this.collection.get({
        ids: [memoryId]
      });
      
      if (result.metadatas[0]) {
        const metadata = result.metadatas[0];
        const newAccessCount = (metadata.accessCount || 0) + 1;
        const newLastAccessed = new Date().toISOString();
        
        // Update in ChromaDB
        await this.collection.update({
          ids: [memoryId],
          metadatas: [{
            ...metadata,
            accessCount: newAccessCount,
            lastAccessed: newLastAccessed
          }]
        });
        
        // Update in exact index cache
        const memory = this.exactIndex.memoryCache.get(memoryId);
        if (memory) {
          memory.accessCount = newAccessCount;
          memory.lastAccessed = newLastAccessed;
        }
      }
    } catch (error) {
      console.error(`Error updating access for memory ${memoryId}:`, error);
    }
  }
  
  private async assessImportance(content: string, context: string): Promise<number> {
    // Simple heuristic-based importance assessment
    let importance = 0.5; // Base importance
    
    // Context-based adjustments
    if (context === 'task_critical') importance += 0.3;
    else if (context === 'user_preference') importance += 0.2;
    else if (context === 'obsidian_note') importance += 0.25;
    
    // Content-based adjustments
    const contentLength = content.length;
    if (contentLength > 500) importance += 0.1; // Longer content is often more important
    if (content.includes('password') || content.includes('key') || content.includes('secret')) {
      importance += 0.3; // Security-related content
    }
    if (content.includes('remember') || content.includes('important') || content.includes('critical')) {
      importance += 0.2; // Explicitly marked as important
    }
    
    // Pattern matching for code snippets
    if (content.includes('function') || content.includes('class') || content.includes('def ')) {
      importance += 0.15; // Code is usually important
    }
    
    // Ensure importance stays within [0, 1]
    return Math.min(1, Math.max(0, importance));
  }
  
  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await this.collection.delete({
        ids: [memoryId]
      });
      
      // Remove from exact index
      const memory = this.exactIndex.memoryCache.get(memoryId);
      if (memory) {
        // Remove from content index
        const keywords = this.extractKeywords(memory.content);
        for (const keyword of keywords) {
          const ids = this.exactIndex.contentIndex.get(keyword);
          if (ids) {
            ids.delete(memoryId);
            if (ids.size === 0) {
              this.exactIndex.contentIndex.delete(keyword);
            }
          }
        }
        
        // Remove from metadata index
        for (const [field, value] of Object.entries(memory.metadata)) {
          if (typeof value === 'string') {
            const fieldIndex = this.exactIndex.metadataIndex.get(field);
            if (fieldIndex) {
              const ids = fieldIndex.get(value);
              if (ids) {
                ids.delete(memoryId);
                if (ids.size === 0) {
                  fieldIndex.delete(value);
                  if (fieldIndex.size === 0) {
                    this.exactIndex.metadataIndex.delete(field);
                  }
                }
              }
            }
          }
        }
        
        // Remove from cache
        this.exactIndex.memoryCache.delete(memoryId);
      }
      
      console.error(`Deleted memory ${memoryId}`);
      return true;
    } catch (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
  }
  
  async clearAllMemories(): Promise<void> {
    try {
      // Get all memory IDs
      const allMemories = await this.collection.get();
      
      if (allMemories.ids && allMemories.ids.length > 0) {
        // Delete from ChromaDB
        await this.collection.delete({
          ids: allMemories.ids
        });
        
        console.error(`Cleared ${allMemories.ids.length} memories`);
      }
      
      // Clear exact indexes
      this.exactIndex.contentIndex.clear();
      this.exactIndex.metadataIndex.clear();
      this.exactIndex.memoryCache.clear();
      
    } catch (error) {
      console.error('Error clearing memories:', error);
      throw error;
    }
  }
  
  // Get compressed context for AI consumption
  async getCompressedContext(
    query: string,
    maxTokens: number = 500,
    options: Partial<CompressionOptions> = {}
  ): Promise<{
    context: string;
    tokenCount: number;
    memoryCount: number;
    compressionRatio: number;
  }> {
    try {
      // Search for relevant memories
      const memories = await this.searchHybrid(query, undefined, 0.5, 20);
      
      if (memories.length === 0) {
        return {
          context: 'No relevant memories found.',
          tokenCount: 5,
          memoryCount: 0,
          compressionRatio: 1.0
        };
      }
      
      // Build context from memories
      let fullContext = `[Query: ${query}]\n\n`;
      let totalOriginalTokens = TokenManager.countTokens(fullContext);
      
      // Add memories in order of relevance
      for (const result of memories) {
        const memoryBlock = `[Memory ${result.memory.id}]\n` +
          `Context: ${result.memory.context}\n` +
          `Importance: ${result.memory.importance.toFixed(2)}\n` +
          `Content: ${result.memory.content}\n\n`;
        
        fullContext += memoryBlock;
        totalOriginalTokens += TokenManager.countTokens(memoryBlock);
      }
      
      // Compress to fit token limit
      const compressed = TokenManager.compress(fullContext, {
        maxTokens,
        preserveStructure: true,
        contextWindow: 2,
        smartFiltering: true,
        ...options
      });
      
      return {
        context: compressed.compressed,
        tokenCount: compressed.compressedTokens,
        memoryCount: memories.length,
        compressionRatio: compressed.compressionRatio
      };
    } catch (error) {
      console.error('Error getting compressed context:', error);
      throw error;
    }
  }
  
  // Get optimized memory for AI with token budget
  async getOptimizedMemory(
    memoryId: string,
    maxTokens: number = 300
  ): Promise<{
    optimized: string;
    tokenCount: number;
    compressionRatio: number;
  }> {
    try {
      const memory = this.exactIndex.memoryCache.get(memoryId);
      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`);
      }
      
      // Optimize for AI consumption
      const optimized = TokenManager.optimizeForAI(
        memory.content,
        memory.context,
        maxTokens
      );
      
      const originalTokens = TokenManager.countTokens(memory.content);
      const optimizedTokens = TokenManager.countTokens(optimized);
      
      return {
        optimized,
        tokenCount: optimizedTokens,
        compressionRatio: optimizedTokens / originalTokens
      };
    } catch (error) {
      console.error('Error optimizing memory:', error);
      throw error;
    }
  }
  
  async getMemoryStats(): Promise<{
    totalMemories: number;
    contextCounts: Record<string, number>;
    averageImportance: number;
    recentMemories: number;
  }> {
    try {
      const allMemories = await this.collection.get();
      
      if (!allMemories.metadatas || allMemories.metadatas.length === 0) {
        return {
          totalMemories: 0,
          contextCounts: {},
          averageImportance: 0,
          recentMemories: 0
        };
      }
      
      const contextCounts: Record<string, number> = {};
      let totalImportance = 0;
      let recentMemories = 0;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const metadata of allMemories.metadatas) {
        // Count by context
        const context = metadata.context || 'unknown';
        contextCounts[context] = (contextCounts[context] || 0) + 1;
        
        // Sum importance
        totalImportance += metadata.importance || 0.5;
        
        // Count recent memories
        if (metadata.timestamp && new Date(metadata.timestamp).getTime() > oneDayAgo) {
          recentMemories++;
        }
      }
      
      return {
        totalMemories: allMemories.metadatas.length,
        contextCounts,
        averageImportance: totalImportance / allMemories.metadatas.length,
        recentMemories
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      throw error;
    }
  }
  
  // Backward compatibility - alias for searchSemantic
  async recallMemories(
    query: string,
    context?: string,
    limit: number = 5
  ): Promise<MemoryScore[]> {
    return this.searchSemantic(query, context, limit);
  }
  
  // Get ChromaDB client (for health monitoring)
  getChromaClient(): ChromaClient {
    return this.client;
  }
  
  // Close connections
  async close(): Promise<void> {
    // ChromaDB client doesn't have a close method, but we can clear indexes
    this.exactIndex.contentIndex.clear();
    this.exactIndex.metadataIndex.clear();
    this.exactIndex.memoryCache.clear();
    console.error('Enhanced memory manager closed');
  }
  
  // Backward compatibility - stub for private method
  async updateAccessCount(memoryId: string): Promise<void> {
    // This is handled internally by updateMemoryAccess
    await this.updateMemoryAccess(memoryId);
  }
}