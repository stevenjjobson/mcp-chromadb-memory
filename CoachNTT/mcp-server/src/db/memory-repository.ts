/**
 * Memory Repository for PostgreSQL
 * Handles all memory-related database operations
 */

import { PostgresClient } from './postgres-client.js';
import { PoolClient } from 'pg';

export interface MemoryInput {
  content: string;
  context: string;
  importance: number;
  vaultId?: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  tier?: string;
}

export interface Memory {
  id: string;
  content: string;
  context: string;
  importance: number;
  created_at: Date;
  accessed_at: Date;
  modified_at: Date;
  access_count: number;
  tier: string;
  vault_id?: string;
  metadata: Record<string, any>;
  embedding?: number[];
  compressed_content?: Buffer;
  compression_ratio?: number;
}

export interface SearchOptions {
  context?: string;
  vaultId?: string;
  tier?: string;
  limit?: number;
  offset?: number;
}

export class MemoryRepository {
  constructor(private db: PostgresClient) {}
  
  /**
   * Create a new memory
   */
  async create(memory: MemoryInput, client?: PoolClient): Promise<Memory> {
    const query = `
      INSERT INTO memories (
        content, context, importance, vault_id, metadata, embedding, tier
      ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
      RETURNING *
    `;
    
    const params = [
      memory.content,
      memory.context,
      memory.importance,
      memory.vaultId || null,
      JSON.stringify(memory.metadata || {}),
      memory.embedding ? PostgresClient.formatVector(memory.embedding) : null,
      memory.tier || 'working'
    ];
    
    const result = client 
      ? await this.db.queryInTransaction(client, query, params)
      : await this.db.query(query, params);
      
    return this.mapRowToMemory(result.rows[0]);
  }
  
  /**
   * Bulk create memories (optimized for performance)
   */
  async bulkCreate(memories: MemoryInput[]): Promise<Memory[]> {
    if (memories.length === 0) return [];
    
    return this.db.transaction(async (client) => {
      const created: Memory[] = [];
      
      // Process in batches to avoid query size limits
      const batchSize = 100;
      for (let i = 0; i < memories.length; i += batchSize) {
        const batch = memories.slice(i, i + batchSize);
        
        // Build multi-row insert
        const values: any[] = [];
        const valuePlaceholders: string[] = [];
        
        batch.forEach((memory, idx) => {
          const base = idx * 7;
          valuePlaceholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::vector, $${base + 7})`
          );
          
          values.push(
            memory.content,
            memory.context,
            memory.importance,
            memory.vaultId || null,
            JSON.stringify(memory.metadata || {}),
            memory.embedding ? PostgresClient.formatVector(memory.embedding) : null,
            memory.tier || 'working'
          );
        });
        
        const query = `
          INSERT INTO memories (
            content, context, importance, vault_id, metadata, embedding, tier
          ) VALUES ${valuePlaceholders.join(', ')}
          RETURNING *
        `;
        
        const result = await this.db.queryInTransaction(client, query, values);
        created.push(...result.rows.map(row => this.mapRowToMemory(row)));
      }
      
      return created;
    });
  }
  
  /**
   * Find memory by ID
   */
  async findById(id: string): Promise<Memory | null> {
    const query = 'SELECT * FROM memories WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) return null;
    return this.mapRowToMemory(result.rows[0]);
  }
  
  /**
   * Find memories by exact content match
   */
  async findByExactMatch(
    searchQuery: string, 
    options: SearchOptions = {}
  ): Promise<Memory[]> {
    const conditions: string[] = ['content ILIKE $1'];
    const params: any[] = [`%${searchQuery}%`];
    let paramCount = 1;
    
    if (options.context) {
      conditions.push(`context = $${++paramCount}`);
      params.push(options.context);
    }
    
    if (options.vaultId) {
      conditions.push(`vault_id = $${++paramCount}`);
      params.push(options.vaultId);
    }
    
    if (options.tier) {
      conditions.push(`tier = $${++paramCount}`);
      params.push(options.tier);
    }
    
    const query = `
      SELECT * FROM memories 
      WHERE ${conditions.join(' AND ')}
      ORDER BY importance DESC, created_at DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;
    
    params.push(options.limit || 20, options.offset || 0);
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToMemory(row));
  }
  
  /**
   * Find memories by semantic similarity
   */
  async findBySemantic(
    embedding: number[], 
    options: SearchOptions = {}
  ): Promise<Array<Memory & { similarity: number }>> {
    const conditions: string[] = ['embedding IS NOT NULL'];
    const params: any[] = [PostgresClient.formatVector(embedding)];
    let paramCount = 1;
    
    if (options.context) {
      conditions.push(`context = $${++paramCount}`);
      params.push(options.context);
    }
    
    if (options.vaultId) {
      conditions.push(`vault_id = $${++paramCount}`);
      params.push(options.vaultId);
    }
    
    if (options.tier) {
      conditions.push(`tier = $${++paramCount}`);
      params.push(options.tier);
    }
    
    const query = `
      SELECT *, 1 - (embedding <=> $1::vector) as similarity
      FROM memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY embedding <=> $1::vector
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;
    
    params.push(options.limit || 10, options.offset || 0);
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      ...this.mapRowToMemory(row),
      similarity: row.similarity
    }));
  }
  
  /**
   * Full-text search using PostgreSQL's text search
   */
  async searchFullText(
    searchQuery: string,
    options: SearchOptions = {}
  ): Promise<Array<Memory & { rank: number }>> {
    const conditions: string[] = [
      'search_vector @@ plainto_tsquery(\'english\', $1)'
    ];
    const params: any[] = [searchQuery];
    let paramCount = 1;
    
    if (options.context) {
      conditions.push(`context = $${++paramCount}`);
      params.push(options.context);
    }
    
    if (options.vaultId) {
      conditions.push(`vault_id = $${++paramCount}`);
      params.push(options.vaultId);
    }
    
    const query = `
      SELECT *, 
             ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
      FROM memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC
      LIMIT $${++paramCount}
    `;
    
    params.push(options.limit || 20);
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      ...this.mapRowToMemory(row),
      rank: row.rank
    }));
  }
  
  /**
   * Update memory access pattern
   */
  async updateAccessPattern(
    id: string, 
    operation: string = 'recall',
    queryDetails?: {
      queryText?: string;
      queryEmbedding?: number[];
      similarityScore?: number;
      resultRank?: number;
    }
  ): Promise<void> {
    await this.db.transaction(async (client) => {
      // Update memory access stats
      await this.db.queryInTransaction(client, `
        UPDATE memories 
        SET access_count = access_count + 1,
            accessed_at = NOW()
        WHERE id = $1
      `, [id]);
      
      // Log access pattern
      const accessQuery = `
        INSERT INTO access_patterns (
          memory_id, operation, query_text, query_embedding, 
          similarity_score, result_rank
        ) VALUES ($1, $2, $3, $4::vector, $5, $6)
      `;
      
      await this.db.queryInTransaction(client, accessQuery, [
        id,
        operation,
        queryDetails?.queryText || null,
        queryDetails?.queryEmbedding 
          ? PostgresClient.formatVector(queryDetails.queryEmbedding) 
          : null,
        queryDetails?.similarityScore || null,
        queryDetails?.resultRank || null
      ]);
    });
  }
  
  /**
   * Update memory tier
   */
  async updateTier(id: string, newTier: string): Promise<void> {
    await this.db.query(`
      UPDATE memories 
      SET tier = $1, tier_migrated_at = NOW()
      WHERE id = $2
    `, [newTier, id]);
  }
  
  /**
   * Get memories for tier migration
   */
  async getMemoriesForMigration(): Promise<Array<Memory & { target_tier: string }>> {
    const query = `
      SELECT m.*, target_tier
      FROM migration_candidates m
      LIMIT 100
    `;
    
    const result = await this.db.query(query);
    return result.rows.map(row => ({
      ...this.mapRowToMemory(row),
      target_tier: row.target_tier
    }));
  }
  
  /**
   * Get memory statistics by context
   */
  async getStatsByContext(vaultId?: string): Promise<Array<{
    context: string;
    count: number;
    avg_importance: number;
    total_access: number;
  }>> {
    const conditions = vaultId ? 'WHERE vault_id = $1' : '';
    const params = vaultId ? [vaultId] : [];
    
    const query = `
      SELECT 
        context,
        COUNT(*) as count,
        AVG(importance) as avg_importance,
        SUM(access_count) as total_access
      FROM memories
      ${conditions}
      GROUP BY context
      ORDER BY count DESC
    `;
    
    const result = await this.db.query(query, params);
    return result.rows;
  }
  
  /**
   * Delete memory by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM memories WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
  
  /**
   * Delete all memories (with optional filter)
   */
  async deleteAll(filter?: { context?: string; vaultId?: string }): Promise<number> {
    if (!filter) {
      const result = await this.db.query('DELETE FROM memories');
      return result.rowCount ?? 0;
    }
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (filter.context) {
      conditions.push(`context = $${params.length + 1}`);
      params.push(filter.context);
    }
    
    if (filter.vaultId) {
      conditions.push(`vault_id = $${params.length + 1}`);
      params.push(filter.vaultId);
    }
    
    const query = `DELETE FROM memories WHERE ${conditions.join(' AND ')}`;
    const result = await this.db.query(query, params);
    return result.rowCount ?? 0;
  }
  
  /**
   * Map database row to Memory object
   */
  private mapRowToMemory(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      context: row.context,
      importance: parseFloat(row.importance),
      created_at: row.created_at,
      accessed_at: row.accessed_at,
      modified_at: row.modified_at,
      access_count: row.access_count,
      tier: row.tier,
      vault_id: row.vault_id,
      metadata: row.metadata || {},
      embedding: row.embedding 
        ? PostgresClient.parseVector(row.embedding) 
        : undefined,
      compressed_content: row.compressed_content,
      compression_ratio: row.compression_ratio 
        ? parseFloat(row.compression_ratio) 
        : undefined
    };
  }
}