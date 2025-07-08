/**
 * Symbol Repository for PostgreSQL
 * Handles code symbol storage and retrieval
 */

import { PostgresClient } from './postgres-client.js';
import { PoolClient } from 'pg';
import { CodeSymbol, CodeSymbolType } from '../types/code-intelligence.types.js';

export interface SymbolInput {
  name: string;
  qualified_name?: string;
  type: CodeSymbolType;
  file_path: string;
  line_number?: number;
  column_number?: number;
  end_line?: number;
  end_column?: number;
  signature?: string;
  documentation?: string;
  language: string;
  visibility?: 'public' | 'private' | 'protected' | 'internal';
  definition?: string;
  context_before?: string;
  context_after?: string;
  is_exported?: boolean;
  is_async?: boolean;
  is_generator?: boolean;
  is_abstract?: boolean;
  is_static?: boolean;
  project_id?: string;
  vault_id?: string;
  metadata?: Record<string, any>;
}

export interface SymbolRelationship {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  confidence: number;
  context?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export class SymbolRepository {
  constructor(private db: PostgresClient) {}
  
  /**
   * Create a single symbol
   */
  async create(symbol: SymbolInput, client?: PoolClient): Promise<CodeSymbol> {
    const query = `
      INSERT INTO code_symbols (
        name, qualified_name, type, file_path, line_number, column_number,
        end_line, end_column, signature, documentation, language, visibility,
        definition, context_before, context_after, is_exported, is_async,
        is_generator, is_abstract, is_static, project_id, vault_id, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23
      )
      RETURNING *
    `;
    
    const params = [
      symbol.name,
      symbol.qualified_name || null,
      symbol.type,
      symbol.file_path,
      symbol.line_number || null,
      symbol.column_number || null,
      symbol.end_line || null,
      symbol.end_column || null,
      symbol.signature || null,
      symbol.documentation || null,
      symbol.language,
      symbol.visibility || null,
      symbol.definition || null,
      symbol.context_before || null,
      symbol.context_after || null,
      symbol.is_exported || false,
      symbol.is_async || false,
      symbol.is_generator || false,
      symbol.is_abstract || false,
      symbol.is_static || false,
      symbol.project_id || null,
      symbol.vault_id || null,
      JSON.stringify(symbol.metadata || {})
    ];
    
    const result = client
      ? await this.db.queryInTransaction(client, query, params)
      : await this.db.query(query, params);
      
    return this.mapRowToSymbol(result.rows[0]);
  }
  
  /**
   * Bulk create symbols (optimized for performance)
   */
  async bulkCreate(symbols: SymbolInput[]): Promise<void> {
    if (symbols.length === 0) return;
    
    // Prepare data for COPY command
    const rows = symbols.map(symbol => [
      symbol.name,
      symbol.qualified_name || null,
      symbol.type,
      symbol.file_path,
      symbol.line_number || null,
      symbol.column_number || null,
      symbol.end_line || null,
      symbol.end_column || null,
      symbol.signature || null,
      symbol.documentation || null,
      symbol.language,
      symbol.visibility || null,
      symbol.definition || null,
      symbol.context_before || null,
      symbol.context_after || null,
      symbol.is_exported || false,
      symbol.is_async || false,
      symbol.is_generator || false,
      symbol.is_abstract || false,
      symbol.is_static || false,
      symbol.project_id || null,
      symbol.vault_id || null,
      JSON.stringify(symbol.metadata || {})
    ]);
    
    const columns = [
      'name', 'qualified_name', 'type', 'file_path', 'line_number',
      'column_number', 'end_line', 'end_column', 'signature', 'documentation',
      'language', 'visibility', 'definition', 'context_before', 'context_after',
      'is_exported', 'is_async', 'is_generator', 'is_abstract', 'is_static',
      'project_id', 'vault_id', 'metadata'
    ];
    
    // Use bulk insert
    await this.db.bulkInsert('code_symbols', columns, rows);
  }
  
  /**
   * Find symbols by name
   */
  async findByName(
    name: string,
    options?: {
      type?: CodeSymbolType;
      language?: string;
      project_id?: string;
      limit?: number;
    }
  ): Promise<CodeSymbol[]> {
    const conditions: string[] = ['name ILIKE $1'];
    const params: any[] = [`%${name}%`];
    let paramCount = 1;
    
    if (options?.type) {
      conditions.push(`type = $${++paramCount}`);
      params.push(options.type);
    }
    
    if (options?.language) {
      conditions.push(`language = $${++paramCount}`);
      params.push(options.language);
    }
    
    if (options?.project_id) {
      conditions.push(`project_id = $${++paramCount}`);
      params.push(options.project_id);
    }
    
    const query = `
      SELECT * FROM code_symbols
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE WHEN name = $1 THEN 0 ELSE 1 END,
        name
      LIMIT $${++paramCount}
    `;
    
    params.push(options?.limit || 50);
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToSymbol(row));
  }
  
  /**
   * Find symbols by file
   */
  async findByFile(filePath: string): Promise<CodeSymbol[]> {
    const query = `
      SELECT * FROM code_symbols
      WHERE file_path = $1
      ORDER BY line_number
    `;
    
    const result = await this.db.query(query, [filePath]);
    return result.rows.map(row => this.mapRowToSymbol(row));
  }
  
  /**
   * Find symbol by ID
   */
  async findById(id: string): Promise<CodeSymbol | null> {
    const query = 'SELECT * FROM code_symbols WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) return null;
    return this.mapRowToSymbol(result.rows[0]);
  }
  
  /**
   * Create a relationship between symbols
   */
  async createRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: string,
    options?: {
      confidence?: number;
      context?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<SymbolRelationship> {
    const query = `
      INSERT INTO symbol_relationships (
        source_id, target_id, relationship_type, confidence, context, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_id, target_id, relationship_type) 
      DO UPDATE SET
        confidence = EXCLUDED.confidence,
        context = EXCLUDED.context,
        metadata = EXCLUDED.metadata
      RETURNING *
    `;
    
    const params = [
      sourceId,
      targetId,
      relationshipType,
      options?.confidence || 1.0,
      options?.context || null,
      JSON.stringify(options?.metadata || {})
    ];
    
    const result = await this.db.query(query, params);
    return this.mapRowToRelationship(result.rows[0]);
  }
  
  /**
   * Find relationships for a symbol
   */
  async findRelationships(
    symbolId: string,
    options?: {
      direction?: 'outgoing' | 'incoming' | 'both';
      type?: string;
      depth?: number;
    }
  ): Promise<SymbolRelationship[]> {
    const direction = options?.direction || 'both';
    const depth = options?.depth || 1;
    
    let query: string;
    const params: any[] = [symbolId];
    
    if (depth === 1) {
      // Simple single-level query
      const conditions: string[] = [];
      
      if (direction === 'outgoing' || direction === 'both') {
        conditions.push('source_id = $1');
      }
      
      if (direction === 'incoming' || direction === 'both') {
        conditions.push('target_id = $1');
      }
      
      if (options?.type) {
        conditions.push(`relationship_type = $2`);
        params.push(options.type);
      }
      
      query = `
        SELECT * FROM symbol_relationships
        WHERE ${conditions.join(' OR ')}
        ORDER BY confidence DESC
      `;
    } else {
      // Recursive query for multiple levels
      query = `
        WITH RECURSIVE relationships AS (
          -- Base case: direct relationships
          SELECT 
            sr.*,
            1 as depth
          FROM symbol_relationships sr
          WHERE ${direction === 'outgoing' ? 'source_id' : 'target_id'} = $1
          ${options?.type ? `AND relationship_type = $2` : ''}
          
          UNION ALL
          
          -- Recursive case: follow relationships
          SELECT 
            sr.*,
            r.depth + 1
          FROM symbol_relationships sr
          JOIN relationships r ON ${direction === 'outgoing' 
            ? 'sr.source_id = r.target_id' 
            : 'sr.target_id = r.source_id'}
          WHERE r.depth < $${params.length + 1}
        )
        SELECT DISTINCT * FROM relationships
        ORDER BY depth, confidence DESC
      `;
      
      params.push(depth);
      if (options?.type) params.splice(1, 0, options.type);
    }
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToRelationship(row));
  }
  
  /**
   * Get symbol statistics
   */
  async getStatsByProject(projectId?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    byLanguage: Record<string, number>;
    byFile: Array<{ file: string; count: number }>;
  }> {
    const whereClause = projectId ? 'WHERE project_id = $1' : '';
    const params = projectId ? [projectId] : [];
    
    // Total count
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as total FROM code_symbols ${whereClause}`,
      params
    );
    
    // By type
    const typeResult = await this.db.query(`
      SELECT type, COUNT(*) as count 
      FROM code_symbols ${whereClause}
      GROUP BY type
    `, params);
    
    // By language
    const langResult = await this.db.query(`
      SELECT language, COUNT(*) as count 
      FROM code_symbols ${whereClause}
      GROUP BY language
    `, params);
    
    // Top files
    const fileResult = await this.db.query(`
      SELECT file_path as file, COUNT(*) as count 
      FROM code_symbols ${whereClause}
      GROUP BY file_path
      ORDER BY count DESC
      LIMIT 10
    `, params);
    
    return {
      total: parseInt(totalResult.rows[0].total),
      byType: Object.fromEntries(
        typeResult.rows.map(r => [r.type, parseInt(r.count)])
      ),
      byLanguage: Object.fromEntries(
        langResult.rows.map(r => [r.language, parseInt(r.count)])
      ),
      byFile: fileResult.rows.map(r => ({
        file: r.file,
        count: parseInt(r.count)
      }))
    };
  }
  
  /**
   * Delete symbols by project
   */
  async deleteByProject(projectId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM code_symbols WHERE project_id = $1',
      [projectId]
    );
    return result.rowCount ?? 0;
  }
  
  /**
   * Update symbol usage
   */
  async updateUsage(symbolId: string): Promise<void> {
    await this.db.query(`
      UPDATE code_symbols
      SET reference_count = reference_count + 1,
          last_referenced = NOW()
      WHERE id = $1
    `, [symbolId]);
  }
  
  /**
   * Map database row to CodeSymbol
   */
  private mapRowToSymbol(row: any): CodeSymbol {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      language: row.language,
      file: row.file_path,
      line: row.line_number || 0,
      column: row.column_number,
      definition: row.definition || '',
      signature: row.signature,
      documentation: row.documentation,
      exports: row.is_exported,
      imports: [], // Would need to be populated from relationships
      calls: [], // Would need to be populated from relationships
      metadata: row.metadata || {}
    };
  }
  
  /**
   * Map database row to SymbolRelationship
   */
  private mapRowToRelationship(row: any): SymbolRelationship {
    return {
      id: row.id,
      source_id: row.source_id,
      target_id: row.target_id,
      relationship_type: row.relationship_type,
      confidence: parseFloat(row.confidence),
      context: row.context,
      metadata: row.metadata || {},
      created_at: row.created_at
    };
  }
}