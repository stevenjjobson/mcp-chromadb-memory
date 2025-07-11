# Implementation Roadmap - Hybrid PostgreSQL + ChromaDB Architecture

## Overview

This updated roadmap details the transformation to a hybrid database architecture that solves the ChromaDB throttling issues while maintaining all semantic search capabilities. PostgreSQL handles structured data and metadata, while ChromaDB focuses on vector embeddings for semantic search.

## Phase 0: Database Architecture Foundation (Days 1-5) **[NEW PRIORITY]**

### Day 1: PostgreSQL Setup and Schema Design
**Morning (4 hours)**
- [ ] Add PostgreSQL 16 with pgvector extension to docker-compose.yml:
  ```yaml
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: mcp_memory
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
  ```

**Afternoon (4 hours)**
- [ ] Create database schema (`init.sql`):
  ```sql
  -- Enable pgvector extension
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Core memory metadata (moved from ChromaDB)
  CREATE TABLE memories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      content TEXT NOT NULL,
      context VARCHAR(50) NOT NULL CHECK (context IN (
          'general', 'user_preference', 'task_critical', 'obsidian_note',
          'code_symbol', 'code_pattern', 'code_decision', 'code_snippet', 'code_error'
      )),
      importance FLOAT NOT NULL CHECK (importance >= 0 AND importance <= 1),
      created_at TIMESTAMP DEFAULT NOW(),
      accessed_at TIMESTAMP DEFAULT NOW(),
      access_count INTEGER DEFAULT 0,
      tier VARCHAR(20) DEFAULT 'working' CHECK (tier IN ('working', 'session', 'longterm')),
      vault_id UUID,
      metadata JSONB DEFAULT '{}',
      embedding vector(1536), -- OpenAI embeddings
      
      -- Indexes for performance
      INDEX idx_context (context),
      INDEX idx_tier (tier),
      INDEX idx_created (created_at),
      INDEX idx_importance (importance DESC),
      INDEX idx_vault (vault_id)
  );

  -- Full-text search
  ALTER TABLE memories ADD COLUMN search_vector tsvector 
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
  CREATE INDEX idx_search ON memories USING GIN (search_vector);

  -- Code symbols (completely in PostgreSQL)
  CREATE TABLE code_symbols (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER,
      column_number INTEGER,
      signature TEXT,
      documentation TEXT,
      language VARCHAR(50),
      project_id UUID,
      content TEXT,
      is_exported BOOLEAN DEFAULT false,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      
      -- Indexes for fast lookups
      INDEX idx_symbol_name (name),
      INDEX idx_symbol_type (type),
      INDEX idx_file_path (file_path),
      INDEX idx_project (project_id)
  );

  -- Symbol relationships
  CREATE TABLE symbol_relationships (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      source_id UUID REFERENCES code_symbols(id) ON DELETE CASCADE,
      target_id UUID REFERENCES code_symbols(id) ON DELETE CASCADE,
      relationship_type VARCHAR(50) NOT NULL,
      metadata JSONB DEFAULT '{}',
      
      UNIQUE(source_id, target_id, relationship_type)
  );

  -- Vault registry
  CREATE TABLE vaults (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL UNIQUE,
      path TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'project',
      created_at TIMESTAMP DEFAULT NOW(),
      last_accessed TIMESTAMP DEFAULT NOW(),
      is_active BOOLEAN DEFAULT false,
      metadata JSONB DEFAULT '{}'
  );

  -- State captures
  CREATE TABLE state_captures (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      context JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      compressed_data BYTEA,
      size_bytes INTEGER,
      
      INDEX idx_state_vault (vault_id),
      INDEX idx_state_created (created_at)
  );

  -- Access patterns for optimization
  CREATE TABLE access_patterns (
      memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
      accessed_at TIMESTAMP DEFAULT NOW(),
      operation VARCHAR(50),
      
      INDEX idx_access_memory (memory_id),
      INDEX idx_access_time (accessed_at)
  );
  ```

### Day 2: Database Access Layer
**Morning (4 hours)**
- [ ] Install PostgreSQL dependencies:
  ```json
  "dependencies": {
    "pg": "^8.11.0",
    "pgvector": "^0.1.0",
    "@types/pg": "^8.10.0"
  }
  ```

- [ ] Create `src/db/postgres-client.ts`:
  ```typescript
  import { Pool } from 'pg';
  import { config } from '../config.js';

  export class PostgresClient {
    private pool: Pool;
    
    constructor() {
      this.pool = new Pool({
        host: config.postgresHost,
        port: config.postgresPort,
        database: config.postgresDatabase,
        user: config.postgresUser,
        password: config.postgresPassword,
        max: 20,
        idleTimeoutMillis: 30000,
      });
    }
    
    async query(text: string, params?: any[]): Promise<any> {
      const start = Date.now();
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.error('Query executed', { text, duration, rows: res.rowCount });
      return res;
    }
    
    async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  }
  ```

**Afternoon (4 hours)**
- [ ] Create `src/db/memory-repository.ts`:
  ```typescript
  export class MemoryRepository {
    constructor(private db: PostgresClient) {}
    
    async create(memory: MemoryInput): Promise<Memory> {
      const query = `
        INSERT INTO memories (content, context, importance, vault_id, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await this.db.query(query, [
        memory.content,
        memory.context,
        memory.importance,
        memory.vaultId,
        JSON.stringify(memory.metadata),
        memory.embedding
      ]);
      return result.rows[0];
    }
    
    async findByExactMatch(query: string, context?: string): Promise<Memory[]> {
      let sql = `
        SELECT * FROM memories 
        WHERE content ILIKE $1
      `;
      const params = [`%${query}%`];
      
      if (context) {
        sql += ` AND context = $2`;
        params.push(context);
      }
      
      sql += ` ORDER BY importance DESC, created_at DESC LIMIT 20`;
      
      const result = await this.db.query(sql, params);
      return result.rows;
    }
    
    async findBySemantic(embedding: number[], limit: number = 10): Promise<Memory[]> {
      const query = `
        SELECT *, 1 - (embedding <=> $1::vector) as similarity
        FROM memories
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;
      const result = await this.db.query(query, [embedding, limit]);
      return result.rows;
    }
    
    async updateAccessPattern(id: string): Promise<void> {
      await this.db.transaction(async (client) => {
        // Update memory access stats
        await client.query(`
          UPDATE memories 
          SET access_count = access_count + 1,
              accessed_at = NOW()
          WHERE id = $1
        `, [id]);
        
        // Log access pattern
        await client.query(`
          INSERT INTO access_patterns (memory_id, operation)
          VALUES ($1, 'recall')
        `, [id]);
      });
    }
  }
  ```

### Day 3: Code Symbol Repository
**Morning (4 hours)**
- [ ] Create `src/db/symbol-repository.ts`:
  ```typescript
  export class SymbolRepository {
    constructor(private db: PostgresClient) {}
    
    async bulkCreate(symbols: CodeSymbol[]): Promise<void> {
      // Use COPY for ultra-fast bulk inserts
      const values = symbols.map(s => [
        s.name,
        s.type,
        s.filePath,
        s.lineNumber,
        s.signature,
        s.language,
        s.content,
        JSON.stringify(s.metadata)
      ]);
      
      await this.db.transaction(async (client) => {
        // Create temp table
        await client.query(`
          CREATE TEMP TABLE temp_symbols (LIKE code_symbols INCLUDING ALL)
        `);
        
        // Bulk insert
        const copyQuery = `
          COPY temp_symbols (name, type, file_path, line_number, signature, language, content, metadata)
          FROM STDIN WITH (FORMAT csv)
        `;
        
        const stream = client.query(copyQuery);
        for (const row of values) {
          stream.write(row.join(',') + '\n');
        }
        stream.end();
        
        // Merge into main table
        await client.query(`
          INSERT INTO code_symbols 
          SELECT * FROM temp_symbols
          ON CONFLICT (name, file_path) DO UPDATE
          SET line_number = EXCLUDED.line_number,
              signature = EXCLUDED.signature,
              content = EXCLUDED.content
        `);
      });
    }
    
    async findByName(name: string): Promise<CodeSymbol[]> {
      const query = `
        SELECT * FROM code_symbols
        WHERE name ILIKE $1
        ORDER BY 
          CASE WHEN name = $2 THEN 0 ELSE 1 END,
          name
        LIMIT 50
      `;
      const result = await this.db.query(query, [`%${name}%`, name]);
      return result.rows;
    }
    
    async findRelationships(symbolId: string): Promise<SymbolRelationship[]> {
      const query = `
        WITH RECURSIVE relationships AS (
          -- Direct relationships
          SELECT sr.*, cs.name as target_name, cs.type as target_type, 1 as depth
          FROM symbol_relationships sr
          JOIN code_symbols cs ON sr.target_id = cs.id
          WHERE sr.source_id = $1
          
          UNION ALL
          
          -- Recursive relationships (up to depth 3)
          SELECT sr.*, cs.name as target_name, cs.type as target_type, r.depth + 1
          FROM symbol_relationships sr
          JOIN relationships r ON sr.source_id = r.target_id
          JOIN code_symbols cs ON sr.target_id = cs.id
          WHERE r.depth < 3
        )
        SELECT DISTINCT * FROM relationships
        ORDER BY depth, relationship_type
      `;
      const result = await this.db.query(query, [symbolId]);
      return result.rows;
    }
  }
  ```

**Afternoon (4 hours)**
- [ ] Create `src/db/search-service.ts`:
  ```typescript
  export class HybridSearchService {
    constructor(
      private memoryRepo: MemoryRepository,
      private chromaClient: ChromaClient,
      private openai: OpenAI
    ) {}
    
    async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
      const tasks: Promise<any>[] = [];
      
      // Exact match in PostgreSQL (FAST)
      if (options.includeExact) {
        tasks.push(this.memoryRepo.findByExactMatch(query, options.context));
      }
      
      // Full-text search in PostgreSQL (FAST)
      if (options.includeFullText) {
        tasks.push(this.searchFullText(query, options));
      }
      
      // Semantic search (still uses ChromaDB for now)
      if (options.includeSemantic) {
        tasks.push(this.searchSemantic(query, options));
      }
      
      const results = await Promise.all(tasks);
      return this.mergeAndRank(results, options);
    }
    
    private async searchFullText(query: string, options: SearchOptions): Promise<Memory[]> {
      const sql = `
        SELECT *, 
               ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
        FROM memories
        WHERE search_vector @@ plainto_tsquery('english', $1)
        ${options.context ? 'AND context = $2' : ''}
        ORDER BY rank DESC
        LIMIT 20
      `;
      const params = options.context ? [query, options.context] : [query];
      const result = await this.db.query(sql, params);
      return result.rows;
    }
  }
  ```

### Day 4: Hybrid Memory Manager
**Morning (4 hours)**
- [ ] Create `src/memory-manager-hybrid.ts`:
  ```typescript
  export class HybridMemoryManager extends MemoryManager {
    private memoryRepo: MemoryRepository;
    private symbolRepo: SymbolRepository;
    private searchService: HybridSearchService;
    private pgClient: PostgresClient;
    
    async initialize(): Promise<void> {
      // Initialize PostgreSQL
      this.pgClient = new PostgresClient();
      this.memoryRepo = new MemoryRepository(this.pgClient);
      this.symbolRepo = new SymbolRepository(this.pgClient);
      
      // Keep ChromaDB for embeddings
      await super.initialize();
      
      // Initialize hybrid search
      this.searchService = new HybridSearchService(
        this.memoryRepo,
        this.chromaClient,
        this.openai
      );
    }
    
    async storeMemory(content: string, context: string, metadata: any): Promise<StoreResult> {
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Store in PostgreSQL (metadata + embedding)
      const memory = await this.memoryRepo.create({
        content,
        context,
        importance: await this.assessImportance(content, context),
        metadata,
        embedding,
        vaultId: this.currentVaultId
      });
      
      // Also store in ChromaDB for pure semantic search
      await this.collection.add({
        ids: [memory.id],
        documents: [content],
        embeddings: [embedding],
        metadatas: [{ memoryId: memory.id }]
      });
      
      return { stored: true, id: memory.id, importance: memory.importance };
    }
    
    async storeBatchOptimized(items: BatchItem[]): Promise<BatchResult[]> {
      // No more ChromaDB throttling!
      return this.pgClient.transaction(async (client) => {
        const results = [];
        
        // Bulk generate embeddings
        const embeddings = await Promise.all(
          items.map(item => this.generateEmbedding(item.content))
        );
        
        // Bulk insert into PostgreSQL
        for (let i = 0; i < items.length; i++) {
          const memory = await this.memoryRepo.create({
            ...items[i],
            embedding: embeddings[i]
          });
          results.push({ stored: true, id: memory.id });
        }
        
        // Background sync to ChromaDB (non-blocking)
        setImmediate(() => this.syncToChromaDB(results));
        
        return results;
      });
    }
  }
  ```

**Afternoon (4 hours)**
- [ ] Update configuration for PostgreSQL:
  ```typescript
  // Add to config.ts
  postgresHost: z.string().default('localhost'),
  postgresPort: z.number().default(5432),
  postgresDatabase: z.string().default('mcp_memory'),
  postgresUser: z.string().default('mcp_user'),
  postgresPassword: z.string(),
  
  // Feature flags for migration
  useHybridStorage: z.boolean().default(false),
  postgresOnly: z.boolean().default(false),
  ```

- [ ] Create migration utilities:
  ```typescript
  export class DataMigration {
    async migrateFromChromaDB(): Promise<void> {
      // Fetch all from ChromaDB
      const memories = await this.fetchAllMemories();
      
      // Batch insert into PostgreSQL
      for (const batch of this.chunk(memories, 1000)) {
        await this.memoryRepo.bulkCreate(batch);
      }
      
      // Verify migration
      const pgCount = await this.memoryRepo.count();
      const chromaCount = await this.collection.count();
      
      if (pgCount !== chromaCount) {
        throw new Error('Migration count mismatch');
      }
    }
  }
  ```

### Day 5: Testing and Performance Validation
**Morning (4 hours)**
- [ ] Create comprehensive test suite:
  ```typescript
  describe('Hybrid Storage Performance', () => {
    it('should handle 10,000 code symbols without throttling', async () => {
      const symbols = generateTestSymbols(10000);
      const start = Date.now();
      
      await symbolRepo.bulkCreate(symbols);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Less than 1 second!
    });
    
    it('should perform exact search in <10ms', async () => {
      const start = Date.now();
      const results = await memoryRepo.findByExactMatch('test query');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10);
    });
  });
  ```

**Afternoon (4 hours)**
- [ ] Performance benchmarks:
  - Code symbol bulk insert: 10,000 items
  - Exact search performance
  - Hybrid search performance
  - Memory usage comparison
  
- [ ] Create rollback plan:
  - Feature flags for gradual rollout
  - Data sync verification
  - Backup procedures

## Updated Phase 1-4: Platform Features (Days 6-25)

### Key Updates for Hybrid Architecture:

**Phase 1 - Foundation:**
- Vault registry in PostgreSQL (transactional safety)
- State captures with PostgreSQL metadata
- Structured queries for vault operations

**Phase 2 - Hierarchical Memory:**
- Tier management via PostgreSQL (faster)
- SQL-based migration queries
- Atomic tier transitions

**Phase 3 - Code Intelligence:**
- Symbols entirely in PostgreSQL
- Rich SQL queries for relationships
- No more bulk insert throttling
- Pattern detection with SQL analytics

**Phase 4 - Advanced Features:**
- PostgreSQL materialized views for analytics
- Time-series queries for access patterns
- Advanced FTS with language-specific analyzers

## Migration Path

### Stage 1: Dual Write (Week 1)
- Write to both PostgreSQL and ChromaDB
- Read from ChromaDB (existing behavior)
- Verify data consistency

### Stage 2: Read Migration (Week 2)
- Move exact/hybrid search to PostgreSQL
- Keep semantic search in ChromaDB
- A/B test performance

### Stage 3: Full Migration (Week 3)
- PostgreSQL as primary storage
- ChromaDB for embeddings only
- Remove dual write

### Stage 4: Optimization (Week 4)
- Query optimization
- Index tuning
- Connection pooling

## Benefits Summary

### Performance Improvements:
- **Code indexing**: 60s → <1s (60x faster)
- **Exact search**: 200ms → <10ms (20x faster)
- **Bulk operations**: No throttling
- **Metadata queries**: 100ms → <5ms (20x faster)

### New Capabilities:
- Complex SQL queries
- Transactional operations
- Full-text search
- Relationship graphs
- Time-series analytics

### Reliability:
- No connection exhaustion
- ACID transactions
- Proven scalability
- Better monitoring

## Success Metrics

### Performance Targets:
- [ ] Bulk insert 10,000 symbols < 1s
- [ ] Exact search < 10ms
- [ ] Hybrid search < 50ms
- [ ] Zero throttling errors

### Functionality:
- [ ] All existing features work
- [ ] No breaking API changes
- [ ] Smooth migration path
- [ ] Rollback capability

### Quality:
- [ ] 95%+ test coverage
- [ ] Load testing passed
- [ ] Migration documented
- [ ] Monitoring in place

---
*This hybrid approach solves immediate issues while providing a superior foundation for future growth*