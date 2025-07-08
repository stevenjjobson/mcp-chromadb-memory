-- MCP ChromaDB Memory Server - PostgreSQL Schema
-- Hybrid architecture with pgvector for embeddings

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Core memory table
CREATE TABLE IF NOT EXISTS memories (
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
CREATE INDEX IF NOT EXISTS idx_memories_context ON memories(context);
CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_vault ON memories(vault_id);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_metadata ON memories USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash);

-- Vector similarity search index (cosine distance)
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Full-text search
ALTER TABLE memories ADD COLUMN IF NOT EXISTS search_vector tsvector 
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(content, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(metadata->>'description', '')), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS idx_memories_search ON memories USING GIN (search_vector);

-- Trigram index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_memories_content_trgm ON memories USING GIN (content gin_trgm_ops);

-- Code symbols table
CREATE TABLE IF NOT EXISTS code_symbols (
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
CREATE INDEX IF NOT EXISTS idx_symbols_name ON code_symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_type ON code_symbols(type);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON code_symbols(file_path);
CREATE INDEX IF NOT EXISTS idx_symbols_project ON code_symbols(project_id);
CREATE INDEX IF NOT EXISTS idx_symbols_language ON code_symbols(language);
CREATE INDEX IF NOT EXISTS idx_symbols_name_type ON code_symbols(name, type);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_symbols_lookup ON code_symbols(project_id, type, name);

-- Full-text search on symbols
CREATE INDEX IF NOT EXISTS idx_symbols_search ON code_symbols USING GIN (
    to_tsvector('english', name || ' ' || coalesce(documentation, ''))
);

-- Symbol relationships table
CREATE TABLE IF NOT EXISTS symbol_relationships (
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
CREATE INDEX IF NOT EXISTS idx_rel_source ON symbol_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON symbol_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON symbol_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_rel_source_type ON symbol_relationships(source_id, relationship_type);

-- Project files table for file and folder indexing
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    directory_path TEXT NOT NULL,
    extension VARCHAR(20),
    file_type VARCHAR(50) CHECK (file_type IN ('code', 'config', 'documentation', 'asset', 'test', 'other')),
    size_bytes BIGINT,
    
    -- Hierarchical data
    parent_directory TEXT,
    depth INTEGER, -- How deep in folder structure
    is_directory BOOLEAN DEFAULT false,
    
    -- Git info if available
    is_git_ignored BOOLEAN DEFAULT false,
    
    -- Project association
    project_id UUID,
    vault_id UUID,
    
    -- Timestamps
    file_modified TIMESTAMP WITH TIME ZONE,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relationships
    contains_symbols INTEGER DEFAULT 0, -- Count of symbols in file
    imports_count INTEGER DEFAULT 0,
    imported_by_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Unique constraint on file path within a project
    CONSTRAINT unique_file_per_project UNIQUE(project_id, file_path)
);

-- Indexes for fast file lookups
CREATE INDEX IF NOT EXISTS idx_files_name ON project_files(file_name);
CREATE INDEX IF NOT EXISTS idx_files_directory ON project_files(directory_path);
CREATE INDEX IF NOT EXISTS idx_files_extension ON project_files(extension);
CREATE INDEX IF NOT EXISTS idx_files_type ON project_files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_path ON project_files(file_path);
CREATE INDEX IF NOT EXISTS idx_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_parent ON project_files(parent_directory);
CREATE INDEX IF NOT EXISTS idx_files_modified ON project_files(file_modified DESC);

-- Full-text search on file paths
CREATE INDEX IF NOT EXISTS idx_files_search ON project_files USING GIN (
    to_tsvector('simple', file_name || ' ' || directory_path)
);

-- File relationships table (imports, includes, etc.)
CREATE TABLE IF NOT EXISTS file_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    target_file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
        'imports', 'includes', 'requires', 'extends',
        'test_of', 'config_for', 'doc_for', 'same_module'
    )),
    
    -- Import details
    import_path TEXT, -- The actual import string used
    is_relative BOOLEAN DEFAULT false,
    is_dynamic BOOLEAN DEFAULT false,
    
    -- Metadata
    line_number INTEGER,
    confidence FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate relationships
    CONSTRAINT unique_file_relationship UNIQUE(source_file_id, target_file_id, relationship_type)
);

-- Indexes for file relationships
CREATE INDEX IF NOT EXISTS idx_file_rel_source ON file_relationships(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_rel_target ON file_relationships(target_file_id);
CREATE INDEX IF NOT EXISTS idx_file_rel_type ON file_relationships(relationship_type);

-- Vault registry
CREATE TABLE IF NOT EXISTS vaults (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_vaults_active ON vaults(is_active) WHERE is_active = true;

-- State captures
CREATE TABLE IF NOT EXISTS state_captures (
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
CREATE INDEX IF NOT EXISTS idx_states_vault ON state_captures(vault_id);
CREATE INDEX IF NOT EXISTS idx_states_created ON state_captures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_states_tags ON state_captures USING GIN (tags);

-- Access patterns tracking
CREATE TABLE IF NOT EXISTS access_patterns (
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
CREATE INDEX IF NOT EXISTS idx_access_memory ON access_patterns(memory_id);
CREATE INDEX IF NOT EXISTS idx_access_time ON access_patterns(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_operation ON access_patterns(operation);
CREATE INDEX IF NOT EXISTS idx_access_memory_time ON access_patterns(memory_id, accessed_at DESC);

-- Migration tracking
CREATE TABLE IF NOT EXISTS migration_status (
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

-- Helper functions

-- Hybrid search function
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
        WHERE m.embedding IS NOT NULL
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

-- Migration candidates view
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

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mcp_user;