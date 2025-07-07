import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';
import { Config } from './config.js';
import { TokenManager, CompressionOptions } from './utils/token-manager.js';
import { CodeContext } from './types/code-intelligence.types.js';
import { sanitizeMetadata } from './utils/metadata-validator.js';

// Valid memory contexts
type StandardContext = 'general' | 'user_preference' | 'task_critical' | 'obsidian_note';
type ValidContext = StandardContext | CodeContext;

interface Memory {
  id: string;
  content: string;
  context: string;
  importance: number;
  timestamp: string;
  metadata: Record<string, any>;
  accessCount: number;
  lastAccessed: string;
  tier?: 'working' | 'session' | 'longterm'; // Added tier tracking
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

type TierName = 'working' | 'session' | 'longterm';

interface TierConfig {
  name: TierName;
  retention: number; // Hours
  maxSize: number;
  importanceThreshold: number;
}

interface TierCollections {
  working?: any;
  session?: any;
  longterm?: any;
}

export class EnhancedMemoryManager {
  private client: ChromaClient;
  private collection: any; // Main collection for backward compatibility
  private tierCollections: TierCollections = {};
  private openai: OpenAI;
  private exactIndex: ExactSearchIndex;
  private tierConfigs: Map<TierName, TierConfig> = new Map();
  
  // Valid contexts
  private readonly VALID_CONTEXTS: Set<string> = new Set([
    // Standard contexts
    'general', 'user_preference', 'task_critical', 'obsidian_note',
    // Code contexts
    'code_symbol', 'code_pattern', 'code_decision', 'code_snippet', 'code_error'
  ]);
  
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
    if (this.config.isDevelopment) {
      console.warn('🧪 Running in DEVELOPMENT mode - changes are isolated from production');
    }
    
    if (this.config.environment === 'PRODUCTION' && this.config.tierEnabled) {
      console.warn('⚠️  Hierarchical tiers are now enabled in PRODUCTION');
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
      
      // Initialize tiers if enabled
      if (this.config.tierEnabled && this.config.tierConfig) {
        await this.initializeTiers();
      }
      
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
  
  // Initialize tier collections
  private async initializeTiers(): Promise<void> {
    console.error('🔄 Initializing hierarchical memory tiers...');
    
    const tierConfig = this.config.tierConfig!;
    
    // Configure tier settings
    this.tierConfigs.set('working', {
      name: 'working',
      retention: tierConfig.workingRetention,
      maxSize: tierConfig.workingMaxSize,
      importanceThreshold: 0.5
    });
    
    this.tierConfigs.set('session', {
      name: 'session',
      retention: tierConfig.sessionRetention,
      maxSize: tierConfig.sessionMaxSize,
      importanceThreshold: 0.3
    });
    
    this.tierConfigs.set('longterm', {
      name: 'longterm',
      retention: tierConfig.longTermRetention,
      maxSize: tierConfig.longTermMaxSize,
      importanceThreshold: 0.1
    });
    
    // Create tier collections
    for (const [tierName, config] of this.tierConfigs) {
      const collectionName = `${this.config.memoryCollectionName}_${tierName}`;
      
      try {
        this.tierCollections[tierName] = await this.client.getOrCreateCollection({
          name: collectionName,
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
            "hnsw:M": 32,
            "tier": tierName,
            "retention": config.retention,
            "maxSize": config.maxSize
          }
        });
        
        console.error(`✅ Created tier collection: ${collectionName}`);
      } catch (error) {
        console.error(`❌ Failed to create tier ${tierName}:`, error);
        throw error;
      }
    }
    
    console.error('✅ Hierarchical memory tiers initialized');
  }
  
  // Determine which tier a memory should belong to
  private determineTier(memory: Memory): TierName {
    if (!this.config.tierEnabled) {
      return 'working'; // Default tier when not enabled
    }
    
    const now = Date.now();
    const ageInHours = (now - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
    const tierConfig = this.config.tierConfig!;
    
    // Consider both age and access patterns
    const accessScore = this.calculateFrequencyScore(memory.accessCount);
    
    // Working tier: Recent OR frequently accessed
    if (ageInHours < tierConfig.workingRetention || accessScore > 0.7) {
      return 'working';
    }
    
    // Session tier: Moderately aged with some access
    if (ageInHours < tierConfig.sessionRetention || accessScore > 0.3) {
      return 'session';
    }
    
    // Long-term tier: Everything else
    return 'longterm';
  }
  
  // Get the appropriate collection for a tier
  private getTierCollection(tier: TierName): any {
    if (!this.config.tierEnabled) {
      return this.collection; // Use main collection when tiers disabled
    }
    
    return this.tierCollections[tier] || this.collection;
  }
  
  // Build exact search index from ChromaDB
  private async rebuildExactIndex(): Promise<void> {
    console.error('Building exact search index...');
    
    // Clear existing indexes
    this.exactIndex.contentIndex.clear();
    this.exactIndex.metadataIndex.clear();
    this.exactIndex.memoryCache.clear();
    
    let totalIndexed = 0;
    
    if (this.config.tierEnabled) {
      // Index memories from all tiers
      for (const [tierName, collection] of Object.entries(this.tierCollections)) {
        if (!collection) continue;
        
        const tierMemories = await collection.get();
        if (!tierMemories.documents || tierMemories.documents.length === 0) {
          console.error(`No memories in ${tierName} tier`);
          continue;
        }
        
        // Index each memory from this tier
        for (let i = 0; i < tierMemories.documents.length; i++) {
          const memory: Memory = {
            id: tierMemories.ids[i],
            content: tierMemories.documents[i],
            context: tierMemories.metadatas[i]?.context || 'unknown',
            importance: tierMemories.metadatas[i]?.importance || 0.5,
            timestamp: tierMemories.metadatas[i]?.timestamp || new Date().toISOString(),
            metadata: tierMemories.metadatas[i] || {},
            accessCount: tierMemories.metadatas[i]?.accessCount || 0,
            lastAccessed: tierMemories.metadatas[i]?.lastAccessed || tierMemories.metadatas[i]?.timestamp,
            tier: tierName as TierName
          };
          
          this.indexMemory(memory);
          totalIndexed++;
        }
        
        console.error(`Indexed ${tierMemories.documents.length} memories from ${tierName} tier`);
      }
    } else {
      // Index from main collection (backward compatibility)
      const allMemories = await this.collection.get();
      
      if (allMemories.documents && allMemories.documents.length > 0) {
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
          totalIndexed++;
        }
      }
    }
    
    console.error(`Total indexed ${totalIndexed} memories for exact search`);
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
      await this.updateMemoryAccess(memory.id, memory.tier);
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
      
      if (this.config.tierEnabled) {
        // Query across all tiers
        const tiersToQuery = this.selectTiersForQuery(query, context);
        const allResults: MemoryScore[] = [];
        
        for (const tier of tiersToQuery) {
          const collection = this.getTierCollection(tier);
          if (!collection) continue;
          
          // Query this tier
          const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: Math.min(limit, 10), // Limit per tier
            where: whereClause
          });
          
          if (results.documents[0] && results.documents[0].length > 0) {
            // Process results from this tier
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
                lastAccessed: metadata.lastAccessed || metadata.timestamp,
                tier: tier
              };
              
              // Calculate component scores
              const semanticScore = 1 - (results.distances[0][i] || 0);
              const recencyScore = this.calculateRecencyScore(memory.timestamp, Date.now());
              const importanceScore = memory.importance;
              const frequencyScore = this.calculateFrequencyScore(memory.accessCount);
              
              // Add tier bonus (working tier gets slight preference)
              const tierBonus = tier === 'working' ? 0.1 : (tier === 'session' ? 0.05 : 0);
              
              // Calculate weighted total score
              const totalScore = (
                semanticScore * 0.4 +
                recencyScore * 0.3 +
                importanceScore * 0.2 +
                frequencyScore * 0.1 +
                tierBonus
              );
              
              allResults.push({
                memory,
                semanticScore,
                recencyScore,
                importanceScore,
                frequencyScore,
                totalScore
              });
            }
          }
        }
        
        // Sort all results by total score and return top results
        allResults.sort((a, b) => b.totalScore - a.totalScore);
        const returnedMemories = allResults.slice(0, limit);
        
        // Update access patterns
        for (const scoredMemory of returnedMemories) {
          await this.updateMemoryAccess(scoredMemory.memory.id, scoredMemory.memory.tier);
        }
        
        return returnedMemories;
      } else {
        // Single collection query (backward compatibility)
        const results = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: Math.min(limit * 2, 20),
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
      }
    } catch (error) {
      console.error('Error in semantic search:', error);
      throw error;
    }
  }
  
  // Select which tiers to query based on context
  private selectTiersForQuery(query: string, context?: string): TierName[] {
    // Default: query all tiers, prioritizing working
    let tiers: TierName[] = ['working', 'session', 'longterm'];
    
    // Optimize based on query patterns
    const lowerQuery = query.toLowerCase();
    
    // Recent queries focus on working/session
    if (lowerQuery.includes('recent') || lowerQuery.includes('today') || 
        lowerQuery.includes('latest') || lowerQuery.includes('current')) {
      tiers = ['working', 'session'];
    }
    
    // Historical queries include all tiers
    else if (lowerQuery.includes('history') || lowerQuery.includes('past') ||
             lowerQuery.includes('old') || lowerQuery.includes('archive')) {
      tiers = ['longterm', 'session', 'working'];
    }
    
    // Task-critical context prioritizes working memory
    else if (context === 'task_critical') {
      tiers = ['working', 'session'];
    }
    
    return tiers;
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
  
  // Batch store memories for better performance
  async storeBatch(
    memories: Array<{
      content: string;
      context: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<Array<{ stored: boolean; id?: string; importance?: number; tier?: TierName; error?: string }>> {
    const results: Array<{ stored: boolean; id?: string; importance?: number; tier?: TierName; error?: string }> = [];
    
    // Process memories in batches to avoid overwhelming ChromaDB
    const batchSize = this.config.batchSize || 100;
    const batchDelay = this.config.batchDelayMs || 200;
    
    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      const batchPromises: Promise<void>[] = [];
      
      // Prepare batch data
      const ids: string[] = [];
      const documents: string[] = [];
      const metadatas: Record<string, any>[] = [];
      const batchMemories: Memory[] = [];
      
      // Process each memory in the batch
      for (const memoryData of batch) {
        try {
          // Validate context
          let context = memoryData.context;
          if (!this.VALID_CONTEXTS.has(context)) {
            console.warn(`Invalid context "${context}" provided, defaulting to "general"`);
            context = 'general';
          }
          
          // Assess importance
          const importance = await this.assessImportance(memoryData.content, context);
          
          if (importance < this.config.memoryImportanceThreshold) {
            results.push({ 
              stored: false, 
              importance,
              error: `Importance ${importance} below threshold ${this.config.memoryImportanceThreshold}`
            });
            continue;
          }
          
          // Generate ID and timestamp
          const timestamp = new Date().toISOString();
          const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Prepare and sanitize metadata
          const rawMetadata = {
            ...memoryData.metadata,
            context,
            importance,
            timestamp,
            accessCount: 0,
            lastAccessed: timestamp
          };
          
          const fullMetadata = sanitizeMetadata(rawMetadata);
          
          // Create memory object
          const memory: Memory = {
            id,
            content: memoryData.content,
            context,
            importance,
            timestamp,
            metadata: fullMetadata,
            accessCount: 0,
            lastAccessed: timestamp
          };
          
          // Determine tier
          const tier = this.determineTier(memory);
          memory.tier = tier;
          
          if (this.config.tierEnabled) {
            (fullMetadata as any).tier = tier;
          }
          
          // Add to batch arrays
          ids.push(id);
          documents.push(memoryData.content);
          metadatas.push(fullMetadata);
          batchMemories.push(memory);
          
        } catch (error) {
          results.push({
            stored: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Store the batch if there are valid memories
      if (ids.length > 0) {
        try {
          // Get appropriate collection
          const tier = batchMemories[0].tier || 'working';
          const collection = this.getTierCollection(tier);
          
          // Batch add to ChromaDB
          await collection.add({
            ids,
            documents,
            metadatas
          });
          
          // Index memories for exact search
          for (const memory of batchMemories) {
            this.indexMemory(memory);
            results.push({
              stored: true,
              id: memory.id,
              importance: memory.importance,
              tier: memory.tier
            });
          }
          
          console.error(`Stored batch of ${ids.length} memories in ${tier} tier`);
          
        } catch (error) {
          // If batch fails, add error for all memories in batch
          for (const memory of batchMemories) {
            results.push({
              stored: false,
              id: memory.id,
              error: error instanceof Error ? error.message : 'Batch storage failed'
            });
          }
          console.error('Error storing batch:', error);
        }
      }
      
      // Add delay between batches to avoid throttling
      if (i + batchSize < memories.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
    
    return results;
  }
  
  // Store memory with exact indexing
  async storeMemory(
    content: string,
    context: string = 'general',
    metadata: Record<string, any> = {}
  ): Promise<{ stored: boolean; id?: string; importance?: number; tier?: TierName }> {
    try {
      // Validate context
      if (!this.VALID_CONTEXTS.has(context)) {
        console.warn(`Invalid context "${context}" provided, defaulting to "general"`);
        context = 'general';
      }
      
      // Assess importance
      const importance = await this.assessImportance(content, context);
      
      if (importance < this.config.memoryImportanceThreshold) {
        console.error(`Memory importance ${importance} below threshold ${this.config.memoryImportanceThreshold}`);
        return { stored: false, importance };
      }
      
      // Generate ID
      const timestamp = new Date().toISOString();
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare and sanitize metadata for ChromaDB
      const rawMetadata = {
        ...metadata,
        context,
        importance,
        timestamp,
        accessCount: 0,
        lastAccessed: timestamp
      };
      
      // Sanitize metadata to ensure ChromaDB compatibility
      const fullMetadata = sanitizeMetadata(rawMetadata);
      
      // Create memory object
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
      
      // Determine tier and get appropriate collection
      const tier = this.determineTier(memory);
      const collection = this.getTierCollection(tier);
      memory.tier = tier;
      
      // Add tier to metadata if tiers are enabled
      if (this.config.tierEnabled) {
        (fullMetadata as any).tier = tier;
      }
      
      // Store in appropriate collection
      await collection.add({
        ids: [id],
        documents: [content],
        metadatas: [fullMetadata]
      });
      
      // Index for exact search
      this.indexMemory(memory);
      
      console.error(`Stored memory ${id} with importance ${importance} in ${tier} tier`);
      
      return { stored: true, id, importance, tier };
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
  
  private async updateMemoryAccess(memoryId: string, tier?: TierName): Promise<void> {
    try {
      // Determine which collection to update
      let collection = this.collection;
      
      if (this.config.tierEnabled && tier) {
        collection = this.getTierCollection(tier);
      } else if (this.config.tierEnabled) {
        // Try to find which tier contains this memory
        const memory = this.exactIndex.memoryCache.get(memoryId);
        if (memory && memory.tier) {
          collection = this.getTierCollection(memory.tier);
        }
      }
      
      // Get current metadata
      const result = await collection.get({
        ids: [memoryId]
      });
      
      if (result.metadatas[0]) {
        const metadata = result.metadatas[0];
        const newAccessCount = (metadata.accessCount || 0) + 1;
        const newLastAccessed = new Date().toISOString();
        
        // Update in ChromaDB
        await collection.update({
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
          
          // Check if memory should be migrated to a different tier
          if (this.config.tierEnabled && tier) {
            const newTier = this.determineTier(memory);
            if (newTier !== tier) {
              // Memory needs migration (will be handled by migration service)
              console.error(`Memory ${memoryId} should migrate from ${tier} to ${newTier}`);
            }
          }
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
    // Code-specific contexts
    else if (context === 'code_symbol') importance += 0.25; // Code symbols are important
    else if (context === 'code_pattern') importance += 0.3; // Patterns are very important
    else if (context === 'code_decision') importance += 0.35; // Code decisions are critical
    else if (context === 'code_snippet') importance += 0.2; // Snippets are moderately important
    else if (context === 'code_error') importance += 0.3; // Errors need attention
    
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
  
  // Tier management methods
  async getTierStats(): Promise<Record<TierName, { count: number; oldestMemory?: Date; newestMemory?: Date }>> {
    const stats: Record<TierName, { count: number; oldestMemory?: Date; newestMemory?: Date }> = {
      working: { count: 0 },
      session: { count: 0 },
      longterm: { count: 0 }
    };
    
    if (!this.config.tierEnabled) {
      // Return stats from main collection
      const allMemories = await this.collection.get();
      stats.working.count = allMemories.ids?.length || 0;
      return stats;
    }
    
    // Get stats for each tier
    for (const [tierName, collection] of Object.entries(this.tierCollections)) {
      if (!collection) continue;
      
      const tierMemories = await collection.get();
      if (tierMemories.ids && tierMemories.ids.length > 0) {
        stats[tierName as TierName].count = tierMemories.ids.length;
        
        // Find oldest and newest
        let oldest = new Date();
        let newest = new Date(0);
        
        for (const metadata of tierMemories.metadatas) {
          const timestamp = new Date(metadata.timestamp);
          if (timestamp < oldest) oldest = timestamp;
          if (timestamp > newest) newest = timestamp;
        }
        
        stats[tierName as TierName].oldestMemory = oldest;
        stats[tierName as TierName].newestMemory = newest;
      }
    }
    
    return stats;
  }
  
  // Migrate a memory between tiers
  async migrateMemory(memoryId: string, fromTier: TierName, toTier: TierName): Promise<boolean> {
    if (!this.config.tierEnabled) {
      console.error('Tier migration requires tiers to be enabled');
      return false;
    }
    
    try {
      const fromCollection = this.getTierCollection(fromTier);
      const toCollection = this.getTierCollection(toTier);
      
      // Get the memory from source tier
      const result = await fromCollection.get({
        ids: [memoryId]
      });
      
      if (!result.ids || result.ids.length === 0) {
        console.error(`Memory ${memoryId} not found in ${fromTier} tier`);
        return false;
      }
      
      // Add to destination tier
      await toCollection.add({
        ids: result.ids,
        documents: result.documents,
        metadatas: result.metadatas.map((m: any) => ({ ...m, tier: toTier }))
      });
      
      // Delete from source tier
      await fromCollection.delete({
        ids: [memoryId]
      });
      
      // Update cache
      const memory = this.exactIndex.memoryCache.get(memoryId);
      if (memory) {
        memory.tier = toTier;
      }
      
      console.error(`Migrated memory ${memoryId} from ${fromTier} to ${toTier}`);
      return true;
    } catch (error) {
      console.error(`Error migrating memory ${memoryId}:`, error);
      return false;
    }
  }
  
  // Get memories that need migration
  async getMemoriesForMigration(): Promise<Array<{ memory: Memory; currentTier: TierName; targetTier: TierName }>> {
    const migrations: Array<{ memory: Memory; currentTier: TierName; targetTier: TierName }> = [];
    
    if (!this.config.tierEnabled) {
      return migrations;
    }
    
    // Check each tier for memories that should be migrated
    for (const [tierName, collection] of Object.entries(this.tierCollections)) {
      if (!collection) continue;
      
      const currentTier = tierName as TierName;
      const tierMemories = await collection.get();
      
      if (tierMemories.ids && tierMemories.ids.length > 0) {
        for (let i = 0; i < tierMemories.ids.length; i++) {
          const memory: Memory = {
            id: tierMemories.ids[i],
            content: tierMemories.documents[i],
            context: tierMemories.metadatas[i]?.context || 'unknown',
            importance: tierMemories.metadatas[i]?.importance || 0.5,
            timestamp: tierMemories.metadatas[i]?.timestamp || new Date().toISOString(),
            metadata: tierMemories.metadatas[i] || {},
            accessCount: tierMemories.metadatas[i]?.accessCount || 0,
            lastAccessed: tierMemories.metadatas[i]?.lastAccessed || tierMemories.metadatas[i]?.timestamp,
            tier: currentTier
          };
          
          const targetTier = this.determineTier(memory);
          
          if (targetTier !== currentTier) {
            migrations.push({
              memory,
              currentTier,
              targetTier
            });
          }
        }
      }
    }
    
    return migrations;
  }
}