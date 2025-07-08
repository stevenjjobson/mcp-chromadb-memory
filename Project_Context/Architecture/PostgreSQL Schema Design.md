# PostgreSQL Schema Design for Hybrid Architecture

## Overview

This document details the PostgreSQL schema design for the MCP ChromaDB Memory Server's hybrid architecture. The schema is optimized for structured data storage, fast queries, and seamless integration with ChromaDB for vector operations.

## Database Configuration

### PostgreSQL with pgvector

```yaml
# docker-compose.yml
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
    - "5432:5432"  # Production
    - "5433:5433"  # Development
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U mcp_user -d mcp_memory"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Core Schema

### Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;          -- For embedding storage
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- For UUID generation
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS btree_gin;      -- For composite indexes
```

### Memory Storage

```sql
-- Core memory table replacing ChromaDB's main functionality
CREATE TABLE memories (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core content
    content TEXT NOT NULL,
    content_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(content::bytea), 'hex')) STORED,
    
    -- Context and importance
    context VARCHAR(50) NOT NULL CHECK (context IN (
        -- Standard contexts
        'general', 'user_preference', 'task_critical', 'obsidian_note',
        -- Code contexts
        'code_symbol', 'code_pattern', 'code_decision', 'code_snippet', 'code_error',
        -- System contexts
        'system_event', 'session_summary', 'state_capture'
    )),
    importance FLOAT NOT NULL CHECK (importance >= 0 AND importance <= 1),
    
    -- Temporal tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Access patterns
    access_count INTEGER DEFAULT 0,
    last_recall_score FLOAT,
    
    -- Tier management
    tier VARCHAR(20) DEFAULT 'working' CHECK (tier IN ('working', 'session', 'longterm')),
    tier_migrated_at TIMESTAMP WITH TIME ZONE,
    
    -- Vault association
    vault_id UUID,
    
    -- Flexible metadata
    metadata JSONB DEFAULT '{}',
    
    -- Vector embedding (1536 dimensions for OpenAI)
    embedding vector(1536),
    
    -- Compression support
    compressed_content BYTEA,
    compression_ratio FLOAT,
    
    -- Relationships
    parent_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
    consolidated_from UUID[]
);

-- Indexes for performance
CREATE INDEX idx_memories_context ON memories(context);
CREATE INDEX idx_memories_tier ON memories(tier);
CREATE INDEX idx_memories_created ON memories(created_at DESC);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memories_vault ON memories(vault_id);
CREATE INDEX idx_memories_accessed ON memories(accessed_at DESC);
CREATE INDEX idx_memories_metadata ON memories USING GIN (metadata);
CREATE INDEX idx_memories_content_hash ON memories(content_hash);

-- Vector similarity search index
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Full-text search
ALTER TABLE memories ADD COLUMN search_vector tsvector 
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(content, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(metadata->>'description', '')), 'B')
    ) STORED;
CREATE INDEX idx_memories_search ON memories USING GIN (search_vector);

-- Trigram index for fuzzy search
CREATE INDEX idx_memories_content_trgm ON memories USING GIN (content gin_trgm_ops);
```

### Code Intelligence Tables

```sql
-- Code symbols (completely in PostgreSQL, no ChromaDB dependency)
CREATE TABLE code_symbols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Symbol identification
    name VARCHAR(255) NOT NULL,
    qualified_name TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'function', 'class', 'interface', 'method', 'property',
        'variable', 'constant', 'enum', 'type', 'namespace',
        'import', 'export', 'module', 'package'
    )),
    
    -- Location
    file_path TEXT NOT NULL,
    line_number INTEGER,
    column_number INTEGER,
    end_line INTEGER,
    end_column INTEGER,
    
    -- Code details
    signature TEXT,
    documentation TEXT,
    language VARCHAR(50) NOT NULL,
    visibility VARCHAR(20) CHECK (visibility IN ('public', 'private', 'protected', 'internal')),
    
    -- Content
    definition TEXT,
    context_before TEXT,
    context_after TEXT,
    
    -- Metadata
    is_exported BOOLEAN DEFAULT false,
    is_async BOOLEAN DEFAULT false,
    is_generator BOOLEAN DEFAULT false,
    is_abstract BOOLEAN DEFAULT false,
    is_static BOOLEAN DEFAULT false,
    
    -- Project association
    project_id UUID,
    vault_id UUID,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Usage tracking
    reference_count INTEGER DEFAULT 0,
    last_referenced TIMESTAMP WITH TIME ZONE
);

-- Indexes for fast symbol lookup
CREATE INDEX idx_symbols_name ON code_symbols(name);
CREATE INDEX idx_symbols_type ON code_symbols(type);
CREATE INDEX idx_symbols_file ON code_symbols(file_path);
CREATE INDEX idx_symbols_project ON code_symbols(project_id);
CREATE INDEX idx_symbols_language ON code_symbols(language);
CREATE INDEX idx_symbols_name_type ON code_symbols(name, type);

-- Composite index for common queries
CREATE INDEX idx_symbols_lookup ON code_symbols(project_id, type, name);

-- Full-text search on symbols
CREATE INDEX idx_symbols_search ON code_symbols USING GIN (
    to_tsvector('english', name || ' ' || coalesce(documentation, ''))
);
```

### Symbol Relationships

```sql
-- Track relationships between code symbols
CREATE TABLE symbol_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES code_symbols(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES code_symbols(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
        'calls', 'called_by', 'imports', 'imported_by',
        'extends', 'extended_by', 'implements', 'implemented_by',
        'uses', 'used_by', 'references', 'referenced_by',
        'overrides', 'overridden_by', 'decorates', 'decorated_by'
    )),
    
    -- Relationship metadata
    confidence FLOAT DEFAULT 1.0,
    context TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicates
    UNIQUE(source_id, target_id, relationship_type)
);

-- Indexes for relationship queries
CREATE INDEX idx_rel_source ON symbol_relationships(source_id);
CREATE INDEX idx_rel_target ON symbol_relationships(target_id);
CREATE INDEX idx_rel_type ON symbol_relationships(relationship_type);
CREATE INDEX idx_rel_source_type ON symbol_relationships(source_id, relationship_type);
```

### Vault Management

```sql
-- Vault registry for multi-project support
CREATE TABLE vaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    path TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'project' CHECK (type IN ('project', 'personal', 'team')),
    
    -- Status tracking
    is_active BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Configuration
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Statistics
    memory_count INTEGER DEFAULT 0,
    symbol_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0
);

-- Only one vault can be active
CREATE UNIQUE INDEX idx_vaults_active ON vaults(is_active) WHERE is_active = true;
```

### State Management

```sql
-- State captures for context preservation
CREATE TABLE state_captures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
    
    -- Identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Context data
    working_context JSONB NOT NULL,
    memory_state JSONB,
    
    -- Compression
    compressed_data BYTEA,
    compression_type VARCHAR(20) DEFAULT 'gzip',
    uncompressed_size INTEGER,
    compressed_size INTEGER,
    
    -- Metadata
    tags TEXT[],
    auto_captured BOOLEAN DEFAULT false,
    importance FLOAT DEFAULT 0.5,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage
    restore_count INTEGER DEFAULT 0,
    last_restored TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_states_vault ON state_captures(vault_id);
CREATE INDEX idx_states_created ON state_captures(created_at DESC);
CREATE INDEX idx_states_tags ON state_captures USING GIN (tags);
```

### Access Tracking

```sql
-- Detailed access pattern tracking for optimization
CREATE TABLE access_patterns (
    id SERIAL PRIMARY KEY,
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    
    -- Access details
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    operation VARCHAR(50) NOT NULL CHECK (operation IN (
        'recall', 'update', 'migrate', 'consolidate', 'compress'
    )),
    
    -- Context
    query_text TEXT,
    query_embedding vector(1536),
    similarity_score FLOAT,
    result_rank INTEGER,
    
    -- Performance
    duration_ms INTEGER,
    
    -- Session tracking
    session_id UUID,
    user_context JSONB
);

-- Indexes for analysis
CREATE INDEX idx_access_memory ON access_patterns(memory_id);
CREATE INDEX idx_access_time ON access_patterns(accessed_at DESC);
CREATE INDEX idx_access_operation ON access_patterns(operation);

-- Partition by month for scalability
CREATE INDEX idx_access_memory_time ON access_patterns(memory_id, accessed_at DESC);
```

### Migration Tracking

```sql
-- Track data migration progress
CREATE TABLE migration_status (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    phase VARCHAR(50) NOT NULL,
    
    -- Progress tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    total_records INTEGER,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    
    -- Error tracking
    errors JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'rolled_back'
    )),
    
    UNIQUE(migration_name)
);
```

## Optimized Queries

### Common Query Patterns

```sql
-- Hybrid search combining exact and semantic
CREATE OR REPLACE FUNCTION search_memories_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    exact_weight FLOAT DEFAULT 0.4,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    context VARCHAR(50),
    importance FLOAT,
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH exact_matches AS (
        SELECT 
            m.id,
            m.content,
            m.context,
            m.importance,
            1.0 as exact_score,
            0.0 as semantic_score
        FROM memories m
        WHERE m.content ILIKE '%' || query_text || '%'
        ORDER BY m.importance DESC
        LIMIT limit_count
    ),
    semantic_matches AS (
        SELECT 
            m.id,
            m.content,
            m.context,
            m.importance,
            0.0 as exact_score,
            1 - (m.embedding <=> query_embedding) as semantic_score
        FROM memories m
        ORDER BY m.embedding <=> query_embedding
        LIMIT limit_count
    ),
    combined AS (
        SELECT 
            COALESCE(e.id, s.id) as id,
            COALESCE(e.content, s.content) as content,
            COALESCE(e.context, s.context) as context,
            COALESCE(e.importance, s.importance) as importance,
            COALESCE(e.exact_score, 0) * exact_weight + 
            COALESCE(s.semantic_score, 0) * (1 - exact_weight) as score
        FROM exact_matches e
        FULL OUTER JOIN semantic_matches s ON e.id = s.id
    )
    SELECT * FROM combined
    ORDER BY score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Tier migration candidates
CREATE OR REPLACE VIEW migration_candidates AS
SELECT 
    m.*,
    CASE 
        WHEN m.tier = 'working' AND m.created_at < NOW() - INTERVAL '48 hours' THEN 'session'
        WHEN m.tier = 'session' AND m.created_at < NOW() - INTERVAL '14 days' THEN 'longterm'
        ELSE m.tier
    END as target_tier
FROM memories m
WHERE (
    (m.tier = 'working' AND m.created_at < NOW() - INTERVAL '48 hours') OR
    (m.tier = 'session' AND m.created_at < NOW() - INTERVAL '14 days')
);
```

## Performance Optimizations

### Connection Pooling

```typescript
// PostgreSQL connection pool configuration
const poolConfig = {
    host: config.postgresHost,
    port: config.postgresPort,
    database: config.postgresDatabase,
    user: config.postgresUser,
    password: config.postgresPassword,
    
    // Pool settings
    max: 20,                    // Maximum connections
    min: 5,                     // Minimum connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Timeout acquiring connection
    
    // Performance
    statement_timeout: 30000,   // 30 second statement timeout
    query_timeout: 30000,       // 30 second query timeout
    
    // Prepared statements
    parseInputDatesAsUTC: true
};
```

### Table Partitioning (Future)

```sql
-- Partition access_patterns by month for scalability
CREATE TABLE access_patterns_2025_01 PARTITION OF access_patterns
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Automatic partition creation can be added with pg_partman
```

### Maintenance

```sql
-- Regular maintenance tasks
CREATE OR REPLACE FUNCTION perform_maintenance() RETURNS void AS $$
BEGIN
    -- Update table statistics
    ANALYZE memories;
    ANALYZE code_symbols;
    
    -- Refresh materialized views if any
    -- REFRESH MATERIALIZED VIEW CONCURRENTLY memory_stats;
    
    -- Clean up old access patterns (> 90 days)
    DELETE FROM access_patterns 
    WHERE accessed_at < NOW() - INTERVAL '90 days';
    
    -- Update vault statistics
    UPDATE vaults v SET
        memory_count = (SELECT COUNT(*) FROM memories WHERE vault_id = v.id),
        symbol_count = (SELECT COUNT(*) FROM code_symbols WHERE vault_id = v.id),
        last_modified = NOW()
    WHERE v.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron or external scheduler
-- SELECT cron.schedule('maintenance', '0 2 * * *', 'SELECT perform_maintenance()');
```

## Migration Notes

### Data Types Mapping

| ChromaDB | PostgreSQL | Notes |
|----------|------------|-------|
| Document | TEXT | Full content storage |
| Metadata | JSONB | Flexible, indexed |
| Embedding | vector(1536) | OpenAI embeddings |
| ID | UUID | Standardized |

### Index Strategy

1. **Primary Access Patterns**
   - Exact text search: GIN trigram index
   - Semantic search: IVFFlat vector index
   - Metadata queries: GIN JSONB index

2. **Performance Targets**
   - Exact search: <10ms
   - Vector search: <50ms
   - Metadata filter: <5ms
   - Bulk insert: >10k rows/sec

3. **Maintenance**
   - Auto-vacuum enabled
   - Statistics updated nightly
   - Indexes rebuilt monthly

---

*This schema provides the foundation for high-performance hybrid storage while maintaining flexibility for future enhancements.*