/**
 * Hybrid Memory Manager
 * Combines PostgreSQL and ChromaDB for optimal performance
 */

import { EnhancedMemoryManager } from './memory-manager-enhanced.js';
import { PostgresClient, getPostgresClient } from './db/postgres-client.js';
import { MemoryRepository } from './db/memory-repository.js';
import { SymbolRepository } from './db/symbol-repository.js';
import { FileRepository } from './db/file-repository.js';
import { HybridSearchService } from './db/hybrid-search-service.js';
import { config } from './config.js';

// Import Memory and MemoryScore types that are not exported from enhanced manager
interface Memory {
  id: string;
  content: string;
  context: string;
  importance: number;
  timestamp: string;
  metadata: Record<string, any>;
  accessCount: number;
  lastAccessed: string;
  tier?: 'working' | 'session' | 'longterm';
}

interface MemoryScore {
  memory: Memory;
  semanticScore: number;
  recencyScore: number;
  importanceScore: number;
  frequencyScore: number;
  totalScore: number;
}

// Define types locally since they're not exported from memory-manager
interface StoreResult {
  stored: boolean;
  id?: string;
  importance?: number;
  reason?: string;
}

interface RecallResult {
  id: string;
  content: string;
  context: string;
  importance: number;
  similarity: number;
  metadata: Record<string, any>;
  accessCount?: number;
  lastAccessed?: Date;
  createdAt?: Date;
}

interface QueryOptions {
  context?: string;
  limit?: number;
}
import type { CodeSymbol } from './types/code-intelligence.types.js';

interface BatchItem {
  content: string;
  context: string;
  metadata?: Record<string, any>;
}

interface BatchResult {
  stored: boolean;
  id?: string;
  error?: string;
}

export class HybridMemoryManager extends EnhancedMemoryManager {
  private pgClient: PostgresClient | null = null;
  private memoryRepo: MemoryRepository | null = null;
  private symbolRepo: SymbolRepository | null = null;
  private fileRepo: FileRepository | null = null;
  private searchService: HybridSearchService | null = null;
  private dualWriteQueue: Array<{ id: string; embedding: number[] }> = [];
  private isProcessingQueue = false;

  /**
   * Initialize both PostgreSQL and ChromaDB
   */
  async initialize(): Promise<void> {
    console.error('Initializing Hybrid Memory Manager...');
    
    // Initialize ChromaDB first (parent class)
    await super.initialize();
    
    // Initialize PostgreSQL if hybrid storage is enabled
    if (config.useHybridStorage) {
      try {
        this.pgClient = await getPostgresClient();
        this.memoryRepo = new MemoryRepository(this.pgClient);
        this.symbolRepo = new SymbolRepository(this.pgClient);
        this.fileRepo = new FileRepository(this.pgClient);
        this.searchService = new HybridSearchService(
          this.memoryRepo,
          this.getChromaClient(),
          this.collection
        );
        
        console.error('PostgreSQL initialized for hybrid storage');
        
        // Start processing dual write queue if enabled
        if (config.enableDualWrite) {
          this.startDualWriteProcessor();
        }
      } catch (error) {
        console.error('Failed to initialize PostgreSQL, falling back to ChromaDB only:', error);
        // Continue with ChromaDB only
      }
    }
  }

  /**
   * Store memory with hybrid approach
   */
  async storeMemory(
    content: string,
    context: string = 'general',
    metadata?: Record<string, any>
  ): Promise<StoreResult> {
    // If not using hybrid storage, use parent implementation
    if (!config.useHybridStorage || !this.memoryRepo) {
      return super.storeMemory(content, context, metadata);
    }

    try {
      // Validate inputs
      if (!this.validateContext(context)) {
        throw new Error(`Invalid context: ${context}`);
      }

      // Assess importance
      const importance = await this.assessImportance(content, context);
      if (importance < config.memoryImportanceThreshold) {
        return {
          stored: false,
          reason: `Importance ${importance.toFixed(2)} below threshold ${config.memoryImportanceThreshold}`
        };
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(content);

      // Store in PostgreSQL (primary)
      const memory = await this.memoryRepo.create({
        content,
        context,
        importance,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          environment: config.environment
        },
        embedding,
        tier: 'working'
      });

      // Queue for ChromaDB if dual write is enabled
      if (config.enableDualWrite) {
        this.dualWriteQueue.push({ id: memory.id, embedding });
      }

      // Update access patterns
      await this.memoryRepo.updateAccessPattern(memory.id, 'recall');

      return {
        stored: true,
        id: memory.id,
        importance
      };
    } catch (error) {
      console.error('Failed to store in PostgreSQL, falling back to ChromaDB:', error);
      // Fallback to ChromaDB
      return super.storeMemory(content, context, metadata);
    }
  }

  /**
   * Batch store for high performance (PostgreSQL optimized)
   */
  async storeBatch(items: BatchItem[]): Promise<BatchResult[]> {
    if (!config.useHybridStorage || !this.memoryRepo) {
      // Fallback to sequential storage with ChromaDB
      const results: BatchResult[] = [];
      for (const item of items) {
        try {
          const result = await this.storeMemory(item.content, item.context, item.metadata);
          results.push({ stored: result.stored, id: result.id });
        } catch (error) {
          results.push({ 
            stored: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      return results;
    }

    // Use PostgreSQL bulk insert
    try {
      // Prepare memories with embeddings
      const memoriesWithEmbeddings = await Promise.all(
        items.map(async (item) => {
          const importance = await this.assessImportance(item.content, item.context);
          const embedding = await this.generateEmbedding(item.content);
          
          return {
            content: item.content,
            context: item.context,
            importance,
            metadata: {
              ...item.metadata,
              timestamp: new Date().toISOString(),
              environment: config.environment
            },
            embedding,
            tier: 'working'
          };
        })
      );

      // Filter by importance threshold
      const validMemories = memoriesWithEmbeddings.filter(
        m => m.importance >= config.memoryImportanceThreshold
      );

      // Bulk create in PostgreSQL
      const created = await this.memoryRepo.bulkCreate(validMemories);

      // Queue for ChromaDB if dual write is enabled
      if (config.enableDualWrite) {
        created.forEach((memory, idx) => {
          this.dualWriteQueue.push({ 
            id: memory.id, 
            embedding: validMemories[idx].embedding 
          });
        });
      }

      // Build results
      const results: BatchResult[] = [];
      let validIdx = 0;
      
      for (const item of memoriesWithEmbeddings) {
        if (item.importance >= config.memoryImportanceThreshold) {
          results.push({ stored: true, id: created[validIdx++].id });
        } else {
          results.push({ stored: false, error: 'Below importance threshold' });
        }
      }

      return results;
    } catch (error) {
      console.error('Batch storage failed:', error);
      throw error;
    }
  }

  /**
   * Recall memories using hybrid search
   */
  async recallMemories(
    query: string,
    context?: string,
    limit: number = 5
  ): Promise<MemoryScore[]> {
    // If not using hybrid storage, use parent implementation
    if (!config.useHybridStorage || !this.searchService) {
      return super.recallMemories(query, context, limit);
    }

    try {
      // Use hybrid search service
      const searchResults = await this.searchService.search(query, {
        context: context,
        limit: limit || config.maxMemoryResults,
        includeExact: true,
        includeFullText: true,
        includeSemantic: true,
        exactWeight: 0.4
      });

      // Convert to MemoryScore format
      return searchResults.map(result => {
        const memory: Memory = {
          id: result.memory.id,
          content: result.memory.content,
          context: result.memory.context,
          importance: result.memory.importance,
          timestamp: result.memory.created_at.toISOString(),
          metadata: result.memory.metadata,
          accessCount: result.memory.access_count,
          lastAccessed: result.memory.accessed_at.toISOString(),
          tier: result.memory.tier as any
        };
        
        // Calculate component scores
        const semanticScore = result.matchType === 'semantic' || result.matchType === 'hybrid' ? result.score : 0.5;
        const recencyScore = this.calculateRecencyScore(memory.timestamp, Date.now());
        const importanceScore = memory.importance;
        const frequencyScore = this.calculateFrequencyScore(memory.accessCount);
        
        return {
          memory,
          semanticScore,
          recencyScore,
          importanceScore,
          frequencyScore,
          totalScore: result.score
        };
      });
    } catch (error) {
      console.error('Hybrid search failed, falling back to ChromaDB:', error);
      // Fallback to ChromaDB
      return super.recallMemories(query, context, limit);
    }
  }

  /**
   * Store code symbols in PostgreSQL (no throttling!)
   */
  async storeCodeSymbols(symbols: CodeSymbol[]): Promise<number> {
    if (!this.symbolRepo) {
      throw new Error('Symbol repository not initialized');
    }

    try {
      // Convert to symbol input format
      const symbolInputs = symbols.map(symbol => ({
        name: symbol.name,
        type: symbol.type,
        file_path: symbol.file,
        line_number: symbol.line,
        column_number: symbol.column,
        signature: symbol.signature,
        documentation: symbol.documentation,
        language: symbol.language,
        definition: symbol.definition,
        is_exported: symbol.exports,
        metadata: symbol.metadata || {}
      }));

      // Bulk insert symbols
      await this.symbolRepo.bulkCreate(symbolInputs);
      
      console.error(`Successfully stored ${symbols.length} symbols in PostgreSQL`);
      return symbols.length;
    } catch (error) {
      console.error('Failed to store code symbols:', error);
      throw error;
    }
  }

  /**
   * Search code symbols
   */
  async searchCodeSymbols(
    name: string,
    options?: { type?: string; language?: string; limit?: number }
  ): Promise<CodeSymbol[]> {
    if (!this.symbolRepo) {
      throw new Error('Symbol repository not initialized');
    }

    return this.symbolRepo.findByName(name, {
      type: options?.type as any,
      language: options?.language,
      limit: options?.limit
    });
  }

  /**
   * Get memory statistics including PostgreSQL
   */
  async getMemoryStats(): Promise<any> {
    const baseStats = await super.getMemoryStats();

    if (!this.memoryRepo) {
      return baseStats;
    }

    try {
      // Get PostgreSQL stats
      const pgStats = await this.memoryRepo.getStatsByContext();
      const symbolStats = this.symbolRepo ? 
        await this.symbolRepo.getStatsByProject() : 
        null;

      return {
        ...baseStats,
        postgres: {
          contexts: pgStats,
          symbols: symbolStats,
          queueSize: this.dualWriteQueue.length
        },
        hybrid: {
          enabled: config.useHybridStorage,
          dualWrite: config.enableDualWrite,
          readRatio: config.postgresReadRatio
        }
      };
    } catch (error) {
      console.error('Failed to get PostgreSQL stats:', error);
      return baseStats;
    }
  }

  /**
   * Delete memory from both databases
   */
  async deleteMemory(id: string): Promise<boolean> {
    if (!config.useHybridStorage || !this.memoryRepo) {
      return super.deleteMemory(id);
    }

    try {
      // Delete from PostgreSQL
      const pgDeleted = await this.memoryRepo.delete(id);

      // Delete from ChromaDB if it exists
      try {
        await this.collection.delete({ ids: [id] });
      } catch (error) {
        console.error('Failed to delete from ChromaDB:', error);
      }

      return pgDeleted;
    } catch (error) {
      console.error('Failed to delete from PostgreSQL:', error);
      // Try ChromaDB deletion anyway
      return super.deleteMemory(id);
    }
  }

  /**
   * Process dual write queue (background)
   */
  private startDualWriteProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.dualWriteQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;
      const batch = this.dualWriteQueue.splice(0, 100); // Process 100 at a time

      try {
        // Get memory contents from PostgreSQL
        const memories = await Promise.all(
          batch.map(item => this.memoryRepo!.findById(item.id))
        );

        // Filter out nulls
        const validMemories = memories.filter(m => m !== null);

        if (validMemories.length > 0) {
          // Add to ChromaDB
          await this.collection.add({
            ids: validMemories.map(m => m!.id),
            documents: validMemories.map(m => m!.content),
            embeddings: batch.map(b => b.embedding),
            metadatas: validMemories.map(m => ({
              context: m!.context,
              importance: m!.importance,
              ...m!.metadata
            }))
          });

          console.error(`Synced ${validMemories.length} memories to ChromaDB`);
        }
      } catch (error) {
        console.error('Dual write processing failed:', error);
        // Re-queue failed items
        this.dualWriteQueue.unshift(...batch);
      } finally {
        this.isProcessingQueue = false;
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Migrate memories from ChromaDB to PostgreSQL
   */
  async migrateToPostgreSQL(batchSize: number = 100): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.memoryRepo) {
      throw new Error('PostgreSQL not initialized');
    }

    const stats = {
      migrated: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Get all memories from ChromaDB
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await this.collection.get({
          limit: batchSize,
          offset: offset
        });

        if (!result.ids || result.ids.length === 0) {
          hasMore = false;
          break;
        }

        // Prepare batch for PostgreSQL
        const memories = result.ids.map((id: string, idx: number) => ({
          content: result.documents[idx],
          context: result.metadatas?.[idx]?.context || 'general',
          importance: result.metadatas?.[idx]?.importance || 0.5,
          metadata: result.metadatas?.[idx] || {},
          embedding: result.embeddings?.[idx] || undefined
        }));

        try {
          // Bulk insert into PostgreSQL
          await this.memoryRepo.bulkCreate(memories);
          stats.migrated += memories.length;
        } catch (error) {
          stats.failed += memories.length;
          stats.errors.push(`Batch at offset ${offset}: ${error}`);
        }

        offset += batchSize;
      }

      console.error(`Migration complete: ${stats.migrated} migrated, ${stats.failed} failed`);
      return stats;
    } catch (error) {
      stats.errors.push(`Migration error: ${error}`);
      return stats;
    }
  }

  /**
   * Get file repository for direct access
   */
  getFileRepository(): FileRepository | null {
    return this.fileRepo;
  }

  /**
   * Health check for hybrid system
   */
  async healthCheck(): Promise<any> {
    const chromaHealth = await super.healthCheck();

    if (!this.pgClient) {
      return chromaHealth;
    }

    const pgHealth = await this.pgClient.healthCheck();

    return {
      ...chromaHealth,
      postgres: pgHealth,
      hybrid: {
        enabled: config.useHybridStorage,
        dualWriteQueueSize: this.dualWriteQueue.length
      }
    };
  }

}