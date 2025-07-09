# PostgreSQL Setup Guide

## Overview

This guide covers the setup and configuration of PostgreSQL with pgvector for the MCP ChromaDB Memory Server's hybrid storage architecture. PostgreSQL provides the high-performance backbone for code intelligence, exact search, and structured data storage.

## Quick Start

### 1. Start PostgreSQL with Docker Compose

```bash
# Start PostgreSQL and ChromaDB (both required)
docker-compose up -d postgres chromadb

# Check status
docker-compose ps
```

You should see:
```
NAME                      STATUS    PORTS
postgres-memory           healthy   0.0.0.0:5432->5432/tcp
chromadb-memory          healthy   0.0.0.0:8000->8000/tcp
```

### 2. Verify Database Connection

```bash
# Test connection
docker-compose exec postgres psql -U mcp_user -d mcp_memory -c "SELECT version();"

# Should output:
# PostgreSQL 16.x on x86_64-pc-linux-gnu, compiled by gcc...
```

### 3. Check pgvector Extension

```bash
# Verify pgvector is installed
docker-compose exec postgres psql -U mcp_user -d mcp_memory -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

## Configuration

### Environment Variables

Update your `.env` file with PostgreSQL settings:

```env
# PostgreSQL Configuration (Required)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mcp_memory
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_memory_pass

# Connection Pool Settings
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000

# Hybrid Storage (Enable These)
USE_HYBRID_STORAGE=true
ENABLE_DUAL_WRITE=true
POSTGRES_READ_RATIO=0.5  # Start with 50/50 split
```

### Docker Compose Configuration

The `docker-compose.yml` includes:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  container_name: postgres-memory
  environment:
    POSTGRES_DB: mcp_memory
    POSTGRES_USER: mcp_user
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-mcp_memory_pass}
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./init.sql:/docker-entrypoint-initdb.d/init.sql
  ports:
    - "5432:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U mcp_user -d mcp_memory"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Schema Overview

The database schema is automatically created on first startup via `init.sql`. Key tables include:

### Core Tables

1. **memories** - Main memory storage with vector embeddings
   - Hybrid storage for both structured and vector data
   - Full-text search indexes
   - Tier management support

2. **code_symbols** - Code intelligence storage
   - Functions, classes, variables, etc.
   - No ChromaDB dependency for bulk operations
   - Optimized indexes for fast lookups

3. **symbol_relationships** - Code relationship tracking
   - Import/export relationships
   - Call graphs
   - Inheritance chains

4. **vaults** - Multi-project support
   - Project isolation
   - Configuration per vault
   - Statistics tracking

## Performance Optimization

### 1. Connection Pooling

The server uses optimized connection pooling:

```typescript
// Configured in postgres-client.ts
{
  max: 20,              // Maximum connections
  min: 5,               // Minimum idle connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
}
```

### 2. Index Management

Check index usage:

```sql
-- View all indexes
\di+ *symbols*

-- Check index usage stats
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 3. Query Performance

Monitor slow queries:

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries > 100ms
SELECT pg_reload_conf();

-- View active queries
SELECT 
    pid,
    age(clock_timestamp(), query_start) AS duration,
    query,
    state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

## Maintenance

### Regular Tasks

1. **Update Statistics**
```sql
-- Run weekly
ANALYZE memories;
ANALYZE code_symbols;
```

2. **Monitor Table Sizes**
```sql
SELECT 
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

3. **Vacuum Dead Tuples**
```sql
-- Check dead tuples
SELECT 
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    round(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_percent
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY dead_percent DESC;
```

### Backup and Recovery

1. **Backup Database**
```bash
# Full backup
docker-compose exec postgres pg_dump -U mcp_user -d mcp_memory > backup_$(date +%Y%m%d).sql

# Compressed backup
docker-compose exec postgres pg_dump -U mcp_user -d mcp_memory | gzip > backup_$(date +%Y%m%d).sql.gz
```

2. **Restore from Backup**
```bash
# Restore
docker-compose exec -T postgres psql -U mcp_user -d mcp_memory < backup_20250109.sql
```

## Migration Path

### Phase 1: Dual-Write Mode (Current)
- All new data written to both PostgreSQL and ChromaDB
- Reads split 50/50 by default
- Monitor performance and accuracy

### Phase 2: PostgreSQL Primary
```env
# Increase PostgreSQL usage
POSTGRES_READ_RATIO=0.8  # 80% PostgreSQL, 20% ChromaDB
```

### Phase 3: Full PostgreSQL
```env
# Use PostgreSQL for everything except embeddings
POSTGRES_READ_RATIO=1.0
ENABLE_DUAL_WRITE=false  # Stop writing to ChromaDB
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart if needed
docker-compose restart postgres
```

2. **Slow Queries**
```sql
-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename = 'code_symbols'
AND n_distinct > 100;
```

3. **Disk Space**
```sql
-- Check database size
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;
```

### Performance Tuning

For production workloads, adjust PostgreSQL settings:

```sql
-- Increase shared buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '2GB';

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;

-- Increase work memory
ALTER SYSTEM SET work_mem = '128MB';

-- Apply changes
SELECT pg_reload_conf();
```

## Monitoring

### Health Checks

The platform includes automatic health monitoring:

```typescript
// Check PostgreSQL health
const health = await health_check();
console.log(health.postgresql); // { connected: true, latency: 0.8 }
```

### Metrics to Track

1. **Connection Pool**
   - Active connections
   - Idle connections
   - Wait time

2. **Query Performance**
   - Average query time
   - Slow query count
   - Index hit rate

3. **Storage**
   - Table sizes
   - Index sizes
   - Dead tuple percentage

## Security

### Best Practices

1. **Use Strong Passwords**
```env
POSTGRES_PASSWORD=use-a-strong-password-here
```

2. **Limit Connections**
```yaml
# In docker-compose.yml
ports:
  - "127.0.0.1:5432:5432"  # Only localhost
```

3. **Regular Updates**
```bash
# Update PostgreSQL image
docker-compose pull postgres
docker-compose up -d postgres
```

## Verified Performance

Based on production testing:

- **Code Symbol Indexing**: 644 symbols/second
- **Bulk Insert**: 310 symbols in 481ms
- **Connection Latency**: <1ms
- **No Throttling**: Handles 10k+ operations without errors
- **60x Improvement**: Over ChromaDB-only approach

## Next Steps

1. **Monitor Performance**
   - Watch query logs
   - Track index usage
   - Monitor connection pool

2. **Gradual Migration**
   - Increase `POSTGRES_READ_RATIO` incrementally
   - Monitor search quality
   - Validate results

3. **Optimize Queries**
   - Add indexes for common queries
   - Use EXPLAIN ANALYZE
   - Tune configuration

For more information:
- [Hybrid Storage Guide](./hybrid-storage.md)
- [Code Intelligence Guide](./code-intelligence.md)
- [Platform Architecture](../Architecture/PostgreSQL%20Schema%20Design.md)