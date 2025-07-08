/**
 * File Repository for PostgreSQL
 * Handles project file and folder storage and retrieval
 */

import { PostgresClient } from './postgres-client.js';
import { PoolClient } from 'pg';
import * as path from 'path';

export interface FileInput {
  file_path: string;
  file_name: string;
  directory_path: string;
  extension?: string;
  file_type?: 'code' | 'config' | 'documentation' | 'asset' | 'test' | 'other';
  size_bytes?: number;
  parent_directory?: string;
  depth?: number;
  is_directory?: boolean;
  is_git_ignored?: boolean;
  project_id?: string;
  vault_id?: string;
  file_modified?: Date;
  contains_symbols?: number;
  imports_count?: number;
  imported_by_count?: number;
  metadata?: Record<string, any>;
}

export interface FileSearchOptions {
  name?: string;
  extension?: string;
  directory?: string;
  file_type?: string;
  project_id?: string;
  limit?: number;
  includeDirectories?: boolean;
}

export interface ProjectFile {
  id: string;
  file_path: string;
  file_name: string;
  directory_path: string;
  extension?: string;
  file_type?: string;
  size_bytes?: number;
  parent_directory?: string;
  depth: number;
  is_directory: boolean;
  is_git_ignored: boolean;
  project_id?: string;
  vault_id?: string;
  file_modified?: Date;
  indexed_at: Date;
  contains_symbols: number;
  imports_count: number;
  imported_by_count: number;
  metadata: Record<string, any>;
}

export interface FileRelationship {
  id: string;
  source_file_id: string;
  target_file_id: string;
  relationship_type: string;
  import_path?: string;
  is_relative?: boolean;
  is_dynamic?: boolean;
  line_number?: number;
  confidence: number;
  metadata: Record<string, any>;
  created_at: Date;
}

export class FileRepository {
  constructor(private db: PostgresClient) {}
  
  /**
   * Create or update a file record
   */
  async upsert(file: FileInput, client?: PoolClient): Promise<ProjectFile> {
    const query = `
      INSERT INTO project_files (
        file_path, file_name, directory_path, extension, file_type,
        size_bytes, parent_directory, depth, is_directory,
        is_git_ignored, project_id, vault_id, file_modified,
        contains_symbols, imports_count, imported_by_count, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (project_id, file_path) 
      DO UPDATE SET
        file_name = EXCLUDED.file_name,
        directory_path = EXCLUDED.directory_path,
        extension = EXCLUDED.extension,
        file_type = EXCLUDED.file_type,
        size_bytes = EXCLUDED.size_bytes,
        parent_directory = EXCLUDED.parent_directory,
        depth = EXCLUDED.depth,
        is_directory = EXCLUDED.is_directory,
        is_git_ignored = EXCLUDED.is_git_ignored,
        file_modified = EXCLUDED.file_modified,
        contains_symbols = EXCLUDED.contains_symbols,
        imports_count = EXCLUDED.imports_count,
        imported_by_count = EXCLUDED.imported_by_count,
        metadata = EXCLUDED.metadata,
        indexed_at = NOW()
      RETURNING *
    `;
    
    const params = [
      file.file_path,
      file.file_name,
      file.directory_path,
      file.extension || null,
      file.file_type || this.determineFileType(file.extension),
      file.size_bytes || null,
      file.parent_directory || null,
      file.depth || this.calculateDepth(file.file_path),
      file.is_directory || false,
      file.is_git_ignored || false,
      file.project_id || null,
      file.vault_id || null,
      file.file_modified || null,
      file.contains_symbols || 0,
      file.imports_count || 0,
      file.imported_by_count || 0,
      JSON.stringify(file.metadata || {})
    ];
    
    const result = client
      ? await this.db.queryInTransaction(client, query, params)
      : await this.db.query(query, params);
      
    return this.mapRowToFile(result.rows[0]);
  }
  
  /**
   * Bulk upsert files
   */
  async bulkUpsert(files: FileInput[]): Promise<void> {
    if (files.length === 0) return;
    
    await this.db.transaction(async (client) => {
      for (const file of files) {
        await this.upsert(file, client);
      }
    });
  }
  
  /**
   * Find file by path
   */
  async findByPath(filePath: string, projectId?: string): Promise<ProjectFile | null> {
    let query = 'SELECT * FROM project_files WHERE file_path = $1';
    const params: any[] = [filePath];
    
    if (projectId) {
      query += ' AND project_id = $2';
      params.push(projectId);
    }
    
    const result = await this.db.query(query, params);
    return result.rows.length > 0 ? this.mapRowToFile(result.rows[0]) : null;
  }
  
  /**
   * Search files
   */
  async search(options: FileSearchOptions): Promise<ProjectFile[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    if (options.name) {
      conditions.push(`file_name ILIKE $${++paramCount}`);
      params.push(`%${options.name}%`);
    }
    
    if (options.extension) {
      conditions.push(`extension = $${++paramCount}`);
      params.push(options.extension);
    }
    
    if (options.directory) {
      conditions.push(`directory_path ILIKE $${++paramCount}`);
      params.push(`%${options.directory}%`);
    }
    
    if (options.file_type) {
      conditions.push(`file_type = $${++paramCount}`);
      params.push(options.file_type);
    }
    
    if (options.project_id) {
      conditions.push(`project_id = $${++paramCount}`);
      params.push(options.project_id);
    }
    
    if (!options.includeDirectories) {
      conditions.push('is_directory = false');
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT * FROM project_files
      ${whereClause}
      ORDER BY file_path
      LIMIT $${++paramCount}
    `;
    
    params.push(options.limit || 100);
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToFile(row));
  }
  
  /**
   * Get directory contents
   */
  async getDirectoryContents(
    directoryPath: string,
    projectId?: string,
    recursive: boolean = false
  ): Promise<ProjectFile[]> {
    let query: string;
    const params: any[] = [directoryPath];
    let paramCount = 1;
    
    if (recursive) {
      query = `
        SELECT * FROM project_files
        WHERE directory_path LIKE $1 || '%'
      `;
    } else {
      query = `
        SELECT * FROM project_files
        WHERE parent_directory = $1
      `;
    }
    
    if (projectId) {
      query += ` AND project_id = $${++paramCount}`;
      params.push(projectId);
    }
    
    query += ' ORDER BY is_directory DESC, file_name';
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToFile(row));
  }
  
  /**
   * Create file relationship
   */
  async createRelationship(
    sourceFileId: string,
    targetFileId: string,
    relationshipType: string,
    metadata?: {
      import_path?: string;
      is_relative?: boolean;
      is_dynamic?: boolean;
      line_number?: number;
      confidence?: number;
      [key: string]: any;
    }
  ): Promise<FileRelationship> {
    const query = `
      INSERT INTO file_relationships (
        source_file_id, target_file_id, relationship_type,
        import_path, is_relative, is_dynamic, line_number,
        confidence, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (source_file_id, target_file_id, relationship_type)
      DO UPDATE SET
        import_path = EXCLUDED.import_path,
        is_relative = EXCLUDED.is_relative,
        is_dynamic = EXCLUDED.is_dynamic,
        line_number = EXCLUDED.line_number,
        confidence = EXCLUDED.confidence,
        metadata = EXCLUDED.metadata
      RETURNING *
    `;
    
    const params = [
      sourceFileId,
      targetFileId,
      relationshipType,
      metadata?.import_path || null,
      metadata?.is_relative || false,
      metadata?.is_dynamic || false,
      metadata?.line_number || null,
      metadata?.confidence || 1.0,
      JSON.stringify(metadata || {})
    ];
    
    const result = await this.db.query(query, params);
    return this.mapRowToRelationship(result.rows[0]);
  }
  
  /**
   * Get file relationships
   */
  async getRelationships(
    fileId: string,
    direction: 'source' | 'target' | 'both' = 'both',
    relationshipType?: string
  ): Promise<FileRelationship[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    if (direction === 'source' || direction === 'both') {
      conditions.push(`source_file_id = $${++paramCount}`);
      params.push(fileId);
    }
    
    if (direction === 'target' || direction === 'both') {
      if (direction === 'both') {
        conditions[0] = `(${conditions[0]} OR target_file_id = $${paramCount})`;
      } else {
        conditions.push(`target_file_id = $${++paramCount}`);
        params.push(fileId);
      }
    }
    
    if (relationshipType) {
      conditions.push(`relationship_type = $${++paramCount}`);
      params.push(relationshipType);
    }
    
    const query = `
      SELECT * FROM file_relationships
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToRelationship(row));
  }
  
  /**
   * Get statistics by file type
   */
  async getStatsByType(projectId?: string): Promise<Record<string, number>> {
    let query = `
      SELECT file_type, COUNT(*) as count
      FROM project_files
      WHERE is_directory = false
    `;
    
    const params: any[] = [];
    if (projectId) {
      query += ' AND project_id = $1';
      params.push(projectId);
    }
    
    query += ' GROUP BY file_type';
    
    const result = await this.db.query(query, params);
    
    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.file_type || 'other'] = parseInt(row.count);
    }
    
    return stats;
  }
  
  /**
   * Update file counts
   */
  async updateFileCounts(
    fileId: string,
    updates: {
      contains_symbols?: number;
      imports_count?: number;
      imported_by_count?: number;
    }
  ): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    if (updates.contains_symbols !== undefined) {
      sets.push(`contains_symbols = $${++paramCount}`);
      params.push(updates.contains_symbols);
    }
    
    if (updates.imports_count !== undefined) {
      sets.push(`imports_count = $${++paramCount}`);
      params.push(updates.imports_count);
    }
    
    if (updates.imported_by_count !== undefined) {
      sets.push(`imported_by_count = $${++paramCount}`);
      params.push(updates.imported_by_count);
    }
    
    if (sets.length === 0) return;
    
    params.push(fileId);
    const query = `
      UPDATE project_files
      SET ${sets.join(', ')}
      WHERE id = $${++paramCount}
    `;
    
    await this.db.query(query, params);
  }
  
  /**
   * Helper: Determine file type from extension
   */
  private determineFileType(extension?: string): string {
    if (!extension) return 'other';
    
    const ext = extension.toLowerCase().replace('.', '');
    
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'cs', 'rb', 'php', 'swift'];
    const configExtensions = ['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'config'];
    const docExtensions = ['md', 'mdx', 'rst', 'txt', 'adoc'];
    const assetExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'mp3', 'mp4'];
    const testPatterns = ['test', 'spec', 'e2e'];
    
    if (codeExtensions.includes(ext)) {
      return 'code';
    } else if (configExtensions.includes(ext)) {
      return 'config';
    } else if (docExtensions.includes(ext)) {
      return 'documentation';
    } else if (assetExtensions.includes(ext)) {
      return 'asset';
    }
    
    return 'other';
  }
  
  /**
   * Helper: Calculate path depth
   */
  private calculateDepth(filePath: string): number {
    return filePath.split(path.sep).filter(p => p).length - 1;
  }
  
  /**
   * Helper: Map database row to file object
   */
  private mapRowToFile(row: any): ProjectFile {
    return {
      id: row.id,
      file_path: row.file_path,
      file_name: row.file_name,
      directory_path: row.directory_path,
      extension: row.extension,
      file_type: row.file_type,
      size_bytes: row.size_bytes ? parseInt(row.size_bytes) : undefined,
      parent_directory: row.parent_directory,
      depth: row.depth,
      is_directory: row.is_directory,
      is_git_ignored: row.is_git_ignored,
      project_id: row.project_id,
      vault_id: row.vault_id,
      file_modified: row.file_modified,
      indexed_at: row.indexed_at,
      contains_symbols: row.contains_symbols,
      imports_count: row.imports_count,
      imported_by_count: row.imported_by_count,
      metadata: row.metadata || {}
    };
  }
  
  /**
   * Helper: Map database row to relationship object
   */
  private mapRowToRelationship(row: any): FileRelationship {
    return {
      id: row.id,
      source_file_id: row.source_file_id,
      target_file_id: row.target_file_id,
      relationship_type: row.relationship_type,
      import_path: row.import_path,
      is_relative: row.is_relative,
      is_dynamic: row.is_dynamic,
      line_number: row.line_number,
      confidence: row.confidence,
      metadata: row.metadata || {},
      created_at: row.created_at
    };
  }
}