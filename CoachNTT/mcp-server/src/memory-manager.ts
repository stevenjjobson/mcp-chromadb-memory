import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';
import { Config } from './config.js';

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

export class MemoryManager {
  private client: ChromaClient;
  private collection: any;
  private openai: OpenAI;
  
  constructor(private config: Config) {
    // Set ChromaDB URL via environment variable
    const chromaUrl = `http://${config.chromaHost}:${config.chromaPort}`;
    console.error(`Connecting to ChromaDB at: ${chromaUrl}`);
    
    // Initialize ChromaClient with host and port
    this.client = new ChromaClient({
      host: config.chromaHost,
      port: parseInt(config.chromaPort)
    });
    
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
  }
  
  async initialize(): Promise<void> {
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
  
  // Add importance assessment method
  private async assessImportance(content: string, context?: string): Promise<number> {
    // Simple heuristic-based importance scoring
    // In production, this would use an LLM
    let score = 0.5; // Base score
    
    // Increase importance for certain keywords
    const importantKeywords = ['important', 'remember', 'critical', 'key', 'essential', 'favorite', 'prefer'];
    const lowerContent = content.toLowerCase();
    
    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
      }
    }
    
    // Context-based adjustments
    if (context) {
      if (context === 'user_preference') score += 0.2;
      if (context === 'task_critical') score += 0.3;
      if (context === 'obsidian_note') score += 0.15; // Integration with your Obsidian vault
    }
    
    // Length heuristic (longer = potentially more important)
    if (content.length > 200) score += 0.1;
    
    // Ensure score is between 0 and 1
    return Math.min(Math.max(score, 0), 1.0);
  }
  
  async storeMemory(
    content: string,
    context: string = 'general',
    metadata: Record<string, any> = {}
  ): Promise<{ stored: boolean; id?: string; importance?: number; reason?: string }> {
    try {
      // Assess importance
      const importance = await this.assessImportance(content, context);
      
      // Check against threshold
      if (importance < this.config.memoryImportanceThreshold) {
        return {
          stored: false,
          importance,
          reason: `Importance ${importance.toFixed(2)} below threshold ${this.config.memoryImportanceThreshold}`
        };
      }
      
      // Generate unique ID with timestamp
      const timestamp = new Date().toISOString();
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare metadata with Windows-friendly timestamps
      const fullMetadata = {
        ...metadata,
        context,
        importance,
        timestamp,
        accessCount: 0,
        lastAccessed: timestamp,
        platform: process.platform,
        source: this.config.isDocker ? 'docker' : 'local'
      };
      
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Store in ChromaDB
      await this.collection.add({
        ids: [id],
        documents: [content],
        embeddings: [embedding],
        metadatas: [fullMetadata]
      });
      
      console.error(`Stored memory ${id} with importance ${importance.toFixed(2)}`);
      
      return {
        stored: true,
        id,
        importance
      };
    } catch (error) {
      console.error('Error storing memory:', error);
      // Return error details for debugging
      return {
        stored: false,
        reason: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  async recallMemories(
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
        
        // Combined score with weights
        const totalScore = 
          semanticScore * 0.4 +
          recencyScore * 0.3 +
          importanceScore * 0.2 +
          frequencyScore * 0.1;
        
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
      const topMemories = scoredMemories.slice(0, limit);
      
      // Update access counts asynchronously (don't wait)
      Promise.all(topMemories.map(sm => this.updateAccessCount(sm.memory.id)))
        .catch(err => console.error('Error updating access counts:', err));
      
      return topMemories;
    } catch (error) {
      console.error('Error recalling memories:', error);
      return [];
    }
  }
  
  private calculateRecencyScore(timestamp: string, currentTime: number): number {
    const memoryTime = new Date(timestamp).getTime();
    const ageInHours = (currentTime - memoryTime) / (1000 * 60 * 60);
    const decayRate = 0.1; // Decay factor
    return Math.exp(-decayRate * ageInHours);
  }
  
  private calculateFrequencyScore(accessCount: number): number {
    return Math.log(1 + accessCount) / Math.log(10); // Logarithmic scaling
  }
  
  private async updateAccessCount(memoryId: string): Promise<void> {
    try {
      const result = await this.collection.get({
        ids: [memoryId]
      });
      
      if (result.metadatas && result.metadatas[0].length > 0) {
        const metadata = result.metadatas[0][0];
        metadata.accessCount = (metadata.accessCount || 0) + 1;
        metadata.lastAccessed = new Date().toISOString();
        
        await this.collection.update({
          ids: [memoryId],
          metadatas: [metadata]
        });
      }
    } catch (error) {
      console.error(`Error updating access count for ${memoryId}:`, error);
    }
  }
  
  async close() {
    // ChromaDB client doesn't require explicit closure
    console.error('Memory manager closed');
  }
  
  getChromaClient(): ChromaClient {
    return this.client;
  }
}