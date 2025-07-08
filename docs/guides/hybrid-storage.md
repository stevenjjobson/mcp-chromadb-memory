# Hybrid Storage Guide

## Overview

The Hybrid Storage architecture combines PostgreSQL and ChromaDB to provide optimal performance for different types of data:

- **PostgreSQL**: Structured data, code symbols, high-performance bulk operations
- **ChromaDB**: Vector embeddings, semantic search, AI-optimized retrieval

## Features

### 1. **Zero-Throttling Bulk Operations**
- PostgreSQL handles bulk symbol indexing at 1700+ symbols/second
- No rate limiting or connection throttling
- Efficient batch inserts with pgvector support

### 2. **Dual-Write Migration**
- Gradual migration from ChromaDB to PostgreSQL
- Background queue processes writes to both databases
- Configurable read ratio for testing and rollout

### 3. **Optimized Search**
- Exact string matching in PostgreSQL (O(1) lookups)
- Semantic search in ChromaDB with embeddings
- Hybrid search combines both for best results

## Configuration

### Environment Variables

```env
# Enable hybrid storage
USE_HYBRID_STORAGE=true

# Enable dual-write for migration
ENABLE_DUAL_WRITE=true

# Read ratio (0.0 = all ChromaDB, 1.0 = all PostgreSQL)
POSTGRES_READ_RATIO=0.5

# PostgreSQL connection
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mcp_memory
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_memory_pass
```

### Docker Setup

The `docker-compose.yml` includes PostgreSQL with pgvector:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  container_name: postgres-memory
  ports:
    - "5432:5432"
  environment:
    - POSTGRES_DB=mcp_memory
    - POSTGRES_USER=mcp_user
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-mcp_memory_pass}
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

## Hooks Integration

Claude Code hooks are configured to automatically leverage hybrid storage:

### 1. **Auto-Indexing Hook**
Automatically indexes modified code files:
- Triggers on Write|Edit|MultiEdit operations
- Marks files for incremental indexing
- Logs activity for monitoring

### 2. **Code Search Optimization**
Intercepts grep commands and suggests better alternatives:
- Detects code-related search patterns
- Recommends `find_symbol` tool for better performance
- Provides type-aware filtering options

### 3. **Session Statistics**
Shows memory system stats at session end:
- PostgreSQL symbol count
- Memory distribution
- Indexing activity summary

## Usage Examples

### Index a Codebase
```javascript
// Using the MCP tool
await index_codebase({
  path: "./src",
  patterns: "**/*.{js,ts}",
  includeDefinitions: true
});
```

### Search for Symbols
```javascript
// Fast PostgreSQL-powered search
await find_symbol({
  query: "HybridMemoryManager",
  type: "class",
  limit: 10
});
```

### Hybrid Memory Search
```javascript
// Combines exact and semantic search
await search_hybrid({
  query: "authentication logic",
  exactWeight: 0.4,  // 40% exact, 60% semantic
  limit: 20
});
```

## Performance Metrics

### Bulk Indexing
- **ChromaDB**: Throttled, connection errors on bulk operations
- **PostgreSQL**: 1700+ symbols/second, no throttling

### Search Performance
- **Exact matches**: <10ms (PostgreSQL indexes)
- **Semantic search**: 50-200ms (ChromaDB vectors)
- **Hybrid search**: Best of both worlds

### Storage Efficiency
- **Code symbols**: Structured data in PostgreSQL
- **Memory embeddings**: Vectors in ChromaDB/PostgreSQL
- **Metadata**: JSON fields with GIN indexes

## Migration Strategy

### Phase 1: Dual-Write (Current)
- All new data written to both databases
- Reads split based on `POSTGRES_READ_RATIO`
- Monitor performance and accuracy

### Phase 2: PostgreSQL Primary
- Increase `POSTGRES_READ_RATIO` to 0.8-1.0
- PostgreSQL becomes primary storage
- ChromaDB for backward compatibility

### Phase 3: Full Migration
- Optional: Migrate all ChromaDB data
- PostgreSQL as single source of truth
- ChromaDB deprecated or special use only

## Monitoring

### Log Files
- `~/mcp-code-intelligence.log`: Tool usage and performance
- `~/mcp-code-indexing.log`: File indexing activity
- `~/mcp-pending-index.txt`: Files awaiting indexing

### Database Stats
```sql
-- Symbol statistics
SELECT type, COUNT(*) FROM code_symbols GROUP BY type;

-- Memory distribution
SELECT context, COUNT(*) FROM memories GROUP BY context;

-- Recent activity
SELECT DATE(created_at), COUNT(*) 
FROM code_symbols 
GROUP BY DATE(created_at) 
ORDER BY DATE(created_at) DESC;
```

## Troubleshooting

### Connection Issues
1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Verify credentials in `.env` file
3. Test connection: `psql -h localhost -U mcp_user -d mcp_memory`

### Performance Issues
1. Check `POSTGRES_READ_RATIO` setting
2. Monitor dual-write queue size in stats
3. Verify indexes are created: `\d code_symbols`

### Search Quality
1. Adjust `exactWeight` in hybrid searches
2. Ensure embeddings are generated for semantic search
3. Check symbol indexing completed successfully

## Best Practices

1. **Start Conservative**: Begin with `POSTGRES_READ_RATIO=0.3`
2. **Monitor Metrics**: Watch performance and accuracy
3. **Incremental Migration**: Gradually increase PostgreSQL usage
4. **Regular Backups**: Backup both databases during migration
5. **Test Thoroughly**: Verify search quality before full migration