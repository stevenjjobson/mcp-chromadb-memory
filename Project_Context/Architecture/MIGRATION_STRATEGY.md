# Migration Strategy: ChromaDB to Hybrid PostgreSQL + ChromaDB Architecture

## Executive Summary

This document outlines the migration strategy from our current ChromaDB-only architecture to a hybrid PostgreSQL + ChromaDB solution. The migration addresses critical throttling issues discovered during code intelligence implementation while maintaining all existing functionality.

**Key Benefits:**
- Eliminates ChromaDB throttling for bulk operations (10,000+ symbols in <1s)
- Improves exact search performance by 20x (200ms → <10ms)
- Enables complex relational queries and ACID transactions
- Maintains semantic search capabilities through ChromaDB

## Current State Analysis

### Problems with ChromaDB-Only Approach

1. **Throttling Issues**
   - Bulk inserts fail with connection errors
   - Individual writes work but are too slow for large codebases
   - No native batch operation support

2. **Performance Limitations**
   - Exact string matching requires full collection scan
   - No indexes for metadata fields
   - Inefficient for structured queries

3. **Missing Capabilities**
   - No relational data modeling
   - Limited transaction support
   - No time-series analytics
   - Poor support for complex metadata

### Data Volume Estimates

Based on current usage patterns:
- **Memories**: 1,000-50,000 per project
- **Code Symbols**: 5,000-100,000 per codebase
- **State Captures**: 100-1,000 per vault
- **Access Patterns**: 10,000-500,000 records

## Migration Phases

### Phase 1: Dual Write (Week 1)
**Goal**: Establish PostgreSQL infrastructure without breaking existing functionality

#### Day 1-2: Infrastructure Setup
```yaml
# docker-compose.yml additions
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
```

#### Day 3-4: Database Schema Implementation
```sql
-- Core tables (see schema in roadmap)
CREATE EXTENSION vector;
CREATE EXTENSION "uuid-ossp";

-- Memories table with all metadata
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  context VARCHAR(50) NOT NULL,
  importance FLOAT NOT NULL,
  -- ... full schema
);

-- Migration tracking
CREATE TABLE migration_status (
  id SERIAL PRIMARY KEY,
  phase VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  records_migrated INTEGER DEFAULT 0,
  errors TEXT[]
);
```

#### Day 5: Dual Write Implementation
```typescript
// memory-manager-hybrid.ts
async storeMemory(content: string, context: string, metadata: any): Promise<StoreResult> {
  // 1. Generate embedding
  const embedding = await this.generateEmbedding(content);
  
  // 2. Store in PostgreSQL (primary)
  const pgResult = await this.memoryRepo.create({
    content, context, importance, metadata, embedding
  });
  
  // 3. Store in ChromaDB (secondary, non-blocking)
  this.chromaQueue.push({
    id: pgResult.id,
    document: content,
    embedding: embedding,
    metadata: { memoryId: pgResult.id }
  });
  
  return { stored: true, id: pgResult.id };
}
```

### Phase 2: Read Migration (Week 2)
**Goal**: Gradually move read operations to PostgreSQL

#### Day 1-2: Exact Search Migration
```typescript
// Before (ChromaDB scan)
async searchExact(query: string): Promise<Memory[]> {
  const results = await this.collection.query({
    queryTexts: [""], // Hack to get all
    where: { content: { $contains: query } }
  });
}

// After (PostgreSQL index)
async searchExact(query: string): Promise<Memory[]> {
  return this.db.query(`
    SELECT * FROM memories 
    WHERE content ILIKE $1
    ORDER BY importance DESC
    LIMIT 20
  `, [`%${query}%`]);
}
```

#### Day 3-4: Hybrid Search Implementation
```typescript
async searchHybrid(query: string, exactWeight: number = 0.4) {
  const [exactResults, semanticResults] = await Promise.all([
    this.searchExactPG(query),      // PostgreSQL
    this.searchSemanticChroma(query) // ChromaDB
  ]);
  
  return this.mergeResults(exactResults, semanticResults, exactWeight);
}
```

#### Day 5: A/B Testing Setup
```typescript
// Feature flag for gradual rollout
if (config.usePostgresSearch) {
  return this.searchPostgres(query);
} else {
  return this.searchChromaDB(query);
}
```

### Phase 3: Full Migration (Week 3)
**Goal**: PostgreSQL as primary, ChromaDB for embeddings only

#### Day 1-2: Code Symbol Migration
```typescript
// Migrate all code symbols to PostgreSQL
async migrateCodeSymbols() {
  const batchSize = 5000;
  let offset = 0;
  
  while (true) {
    const symbols = await this.fetchSymbolsBatch(offset, batchSize);
    if (symbols.length === 0) break;
    
    await this.symbolRepo.bulkCreate(symbols);
    offset += batchSize;
    
    console.log(`Migrated ${offset} symbols...`);
  }
}
```

#### Day 3-4: Vault & State Migration
```typescript
// Migrate vault registry
async migrateVaults() {
  const vaults = await this.loadVaultRegistry();
  
  for (const vault of vaults) {
    await this.db.query(`
      INSERT INTO vaults (id, name, path, type, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [vault.id, vault.name, vault.path, vault.type, vault.created]);
  }
}
```

#### Day 5: Cutover & Validation
- Switch primary reads to PostgreSQL
- Validate data consistency
- Monitor performance metrics
- Keep ChromaDB sync for rollback

### Phase 4: Optimization (Week 4)
**Goal**: Fine-tune performance and remove dual write

#### Day 1-2: Query Optimization
```sql
-- Analyze query patterns
CREATE INDEX CONCURRENTLY idx_memory_context_importance 
  ON memories(context, importance DESC);

CREATE INDEX CONCURRENTLY idx_memory_created_tier 
  ON memories(created_at, tier);

-- Materialized view for analytics
CREATE MATERIALIZED VIEW memory_stats AS
SELECT 
  context,
  tier,
  COUNT(*) as count,
  AVG(importance) as avg_importance,
  MAX(accessed_at) as last_access
FROM memories
GROUP BY context, tier;
```

#### Day 3-4: Remove Dual Write
```typescript
// Final implementation - PostgreSQL only
async storeMemory(content: string, context: string): Promise<StoreResult> {
  const embedding = await this.generateEmbedding(content);
  
  // Store in PostgreSQL with embedding
  const result = await this.memoryRepo.create({
    content, context, embedding, ...
  });
  
  // Optional: Async sync to ChromaDB for pure semantic search
  if (config.maintainChromaSync) {
    this.syncQueue.add({ id: result.id, embedding });
  }
  
  return result;
}
```

## Rollback Strategy

### Rollback Triggers
1. Performance regression >20%
2. Data inconsistency detected
3. Critical bugs in PostgreSQL implementation
4. Unacceptable downtime

### Rollback Steps

#### Immediate Rollback (< 1 hour)
```typescript
// config.ts
export const config = {
  usePostgresSearch: false,    // Revert to ChromaDB reads
  enableDualWrite: true,       // Keep writing to both
  primaryStorage: 'chromadb'   // ChromaDB as primary
};
```

#### Full Rollback (< 4 hours)
1. Stop PostgreSQL writes
2. Verify ChromaDB has all data
3. Update all read paths to ChromaDB
4. Export PostgreSQL-only data
5. Re-import to ChromaDB

### Data Recovery
```bash
# Backup before migration
pg_dump -h localhost -U mcp_user -d mcp_memory > backup_pre_migration.sql

# Export PostgreSQL-only data
psql -h localhost -U mcp_user -d mcp_memory -c "
  COPY (SELECT * FROM memories WHERE created_at > '2024-01-01') 
  TO '/tmp/new_memories.csv' CSV HEADER;
"

# Re-import to ChromaDB if needed
python scripts/reimport_to_chromadb.py /tmp/new_memories.csv
```

## Monitoring & Validation

### Key Metrics to Track

1. **Performance Metrics**
   ```typescript
   interface MigrationMetrics {
     exactSearchP95: number;      // Target: <10ms
     hybridSearchP95: number;     // Target: <50ms
     bulkInsertRate: number;      // Target: >10k/sec
     errorRate: number;           // Target: <0.1%
   }
   ```

2. **Data Consistency Checks**
   ```sql
   -- Daily consistency check
   WITH pg_counts AS (
     SELECT context, COUNT(*) as pg_count 
     FROM memories GROUP BY context
   ),
   chroma_counts AS (
     SELECT context, COUNT(*) as chroma_count
     FROM chromadb_export GROUP BY context
   )
   SELECT 
     p.context,
     p.pg_count,
     c.chroma_count,
     ABS(p.pg_count - c.chroma_count) as diff
   FROM pg_counts p
   JOIN chroma_counts c ON p.context = c.context
   WHERE p.pg_count != c.chroma_count;
   ```

3. **Health Monitoring**
   ```typescript
   // Real-time health checks
   async checkMigrationHealth(): Promise<HealthStatus> {
     const checks = await Promise.all([
       this.checkPostgresConnection(),
       this.checkDataConsistency(),
       this.checkQueryPerformance(),
       this.checkErrorRates()
     ]);
     
     return {
       healthy: checks.every(c => c.passed),
       checks: checks,
       timestamp: new Date()
     };
   }
   ```

## Risk Mitigation

### Technical Risks

1. **Data Loss**
   - Mitigation: Dual write until fully validated
   - Backup: Hourly PostgreSQL backups
   - Recovery: Point-in-time recovery enabled

2. **Performance Degradation**
   - Mitigation: Gradual rollout with feature flags
   - Monitoring: Real-time performance dashboards
   - Fallback: Immediate config-based rollback

3. **Integration Issues**
   - Mitigation: Comprehensive integration tests
   - Validation: A/B testing framework
   - Support: Detailed logging and tracing

### Operational Risks

1. **Downtime**
   - Mitigation: Zero-downtime migration strategy
   - Approach: Read from both, write to both
   - Validation: Health checks every 30 seconds

2. **Resource Usage**
   - Mitigation: Resource limits on containers
   - Monitoring: CPU/Memory/Disk alerts
   - Scaling: Horizontal scaling ready

## Success Criteria

### Phase 1 Success (Dual Write)
- [ ] PostgreSQL accepting 100% of writes
- [ ] No increase in error rate
- [ ] Dual write latency <10ms overhead

### Phase 2 Success (Read Migration)
- [ ] 50% of reads from PostgreSQL
- [ ] Exact search 10x faster
- [ ] No data inconsistencies detected

### Phase 3 Success (Full Migration)
- [ ] 100% reads from PostgreSQL
- [ ] Code indexing handles 10k+ symbols
- [ ] All features working correctly

### Phase 4 Success (Optimization)
- [ ] Query performance meets SLAs
- [ ] Resource usage optimized
- [ ] Monitoring and alerting complete

## Timeline Summary

**Week 1**: Infrastructure setup and dual write
**Week 2**: Gradual read migration with A/B testing
**Week 3**: Complete migration and validation
**Week 4**: Performance optimization and cleanup

**Total Duration**: 4 weeks
**Risk Level**: Medium (mitigated by gradual approach)
**Rollback Time**: <1 hour for config, <4 hours for full

## Appendix: Migration Scripts

### A. Data Export Script
```python
# scripts/export_chromadb.py
import chromadb
import psycopg2
import json

def export_memories():
    client = chromadb.Client()
    collection = client.get_collection("memories")
    
    # Get all memories
    results = collection.get(
        include=["metadatas", "documents", "embeddings"]
    )
    
    # Connect to PostgreSQL
    conn = psycopg2.connect(
        host="localhost",
        database="mcp_memory",
        user="mcp_user",
        password=os.getenv("POSTGRES_PASSWORD")
    )
    
    # Bulk insert
    with conn.cursor() as cur:
        for i in range(len(results['ids'])):
            cur.execute("""
                INSERT INTO memories (
                    id, content, context, importance, 
                    metadata, embedding
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                results['ids'][i],
                results['documents'][i],
                results['metadatas'][i].get('context', 'general'),
                results['metadatas'][i].get('importance', 0.5),
                json.dumps(results['metadatas'][i]),
                results['embeddings'][i]
            ))
    
    conn.commit()
```

### B. Validation Script
```typescript
// scripts/validate-migration.ts
async function validateMigration() {
  const report = {
    totalMemories: { pg: 0, chroma: 0 },
    contexts: new Map<string, { pg: number, chroma: number }>(),
    samples: [] as any[]
  };
  
  // Count in PostgreSQL
  const pgCount = await db.query('SELECT COUNT(*) FROM memories');
  report.totalMemories.pg = pgCount.rows[0].count;
  
  // Count in ChromaDB
  const chromaCount = await collection.count();
  report.totalMemories.chroma = chromaCount;
  
  // Sample validation
  const samples = await db.query('SELECT * FROM memories ORDER BY RANDOM() LIMIT 100');
  
  for (const sample of samples.rows) {
    const chromaResult = await collection.get({
      ids: [sample.id]
    });
    
    report.samples.push({
      id: sample.id,
      pgContent: sample.content.substring(0, 50),
      chromaContent: chromaResult.documents[0]?.substring(0, 50),
      match: sample.content === chromaResult.documents[0]
    });
  }
  
  return report;
}
```

---

*This migration strategy prioritizes data integrity and zero downtime while solving critical performance issues. The gradual approach allows for validation at each step with quick rollback capabilities.*