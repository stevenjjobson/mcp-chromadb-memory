/**
 * PostgreSQL Client with pgvector support
 * Handles connection pooling, queries, and transactions
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config.js';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class PostgresClient {
  private pool: Pool;
  private isConnected: boolean = false;
  
  constructor(customConfig?: PostgresConfig) {
    const pgConfig = customConfig || {
      host: config.postgresHost,
      port: config.postgresPort,
      database: config.postgresDatabase,
      user: config.postgresUser,
      password: config.postgresPassword,
      max: config.postgresPoolMax,
      min: config.postgresPoolMin,
      idleTimeoutMillis: config.postgresIdleTimeout,
      connectionTimeoutMillis: config.postgresConnectionTimeout,
    };
    
    this.pool = new Pool({
      ...pgConfig,
      // Additional performance settings
      statement_timeout: 30000,
      query_timeout: 30000,
    });
    
    // Error handling
    this.pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
    
    this.pool.on('connect', () => {
      console.error('New PostgreSQL client connected');
    });
  }
  
  /**
   * Initialize connection and verify database is accessible
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      const result = await this.query('SELECT 1 as test');
      if (result.rows[0].test === 1) {
        this.isConnected = true;
        console.error('PostgreSQL connection established');
        
        // Verify pgvector extension
        const extensions = await this.query(`
          SELECT extname, extversion 
          FROM pg_extension 
          WHERE extname = 'vector'
        `);
        
        if (extensions.rows.length === 0) {
          throw new Error('pgvector extension not installed');
        }
        
        console.error(`pgvector ${extensions.rows[0].extversion} is available`);
      }
    } catch (error) {
      console.error('Failed to initialize PostgreSQL:', error);
      throw error;
    }
  }
  
  /**
   * Execute a query with automatic connection handling
   */
  async query(text: string, params?: any[]): Promise<QueryResult<any>> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.error('Slow query detected', {
          query: text.substring(0, 100),
          duration,
          rows: result.rowCount
        });
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', {
        query: text.substring(0, 100),
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
  
  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Execute a single query within a transaction context
   */
  async queryInTransaction(
    client: PoolClient, 
    text: string, 
    params?: any[]
  ): Promise<QueryResult<any>> {
    return client.query(text, params);
  }
  
  /**
   * Bulk insert using multi-row INSERT for performance
   * (COPY requires special stream handling not easily available in node-postgres)
   */
  async bulkInsert(
    tableName: string,
    columns: string[],
    rows: any[][]
  ): Promise<number> {
    if (rows.length === 0) return 0;
    
    const client = await this.pool.connect();
    
    try {
      // Process in batches to avoid query size limits
      const batchSize = 1000;
      let totalInserted = 0;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        // Build multi-row INSERT
        const placeholders: string[] = [];
        const values: any[] = [];
        
        batch.forEach((row, rowIndex) => {
          const rowPlaceholders: string[] = [];
          row.forEach((value, colIndex) => {
            const placeholder = `$${rowIndex * columns.length + colIndex + 1}`;
            rowPlaceholders.push(placeholder);
            values.push(value);
          });
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });
        
        const query = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
        `;
        
        await client.query(query, values);
        totalInserted += batch.length;
      }
      
      return totalInserted;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
  
  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
    poolStats?: any;
  }> {
    const start = Date.now();
    
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      
      return {
        healthy: true,
        latency,
        poolStats: this.getPoolStats(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        poolStats: this.getPoolStats(),
      };
    }
  }
  
  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    console.error('PostgreSQL connection pool closed');
  }
  
  /**
   * Format vector for pgvector
   */
  static formatVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
  
  /**
   * Parse vector from pgvector
   */
  static parseVector(vectorString: string): number[] {
    // Remove brackets and split
    const cleaned = vectorString.replace(/[\[\]]/g, '');
    return cleaned.split(',').map(v => parseFloat(v));
  }
}

// Singleton instance
let postgresClient: PostgresClient | null = null;

export async function getPostgresClient(): Promise<PostgresClient> {
  if (!postgresClient) {
    postgresClient = new PostgresClient();
    await postgresClient.initialize();
  }
  return postgresClient;
}