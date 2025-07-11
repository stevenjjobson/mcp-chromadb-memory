---
date: 2025-01-05
decision: 001
title: Adopt Hierarchical Memory System with Time-Delta Management
status: accepted
tags: [architecture, decision, memory, performance]
---

# ADR-001: Adopt Hierarchical Memory System with Time-Delta Management

## Status
Accepted

## Context
The current MCP ChromaDB Memory Server uses a single collection for all memories, which leads to:
- Slower query performance as the collection grows
- No distinction between recent and historical memories
- Inefficient resource usage for different memory types
- Difficulty in implementing retention policies

### Problem Statement
How can we organize memories to optimize query performance while maintaining the ability to access all historical data when needed?

### Constraints
- Must maintain backward compatibility
- Cannot lose existing memories during migration
- Must work within ChromaDB's capabilities
- Should minimize resource overhead

## Decision
Implement a three-tier hierarchical memory system with time-delta based automatic migration:

1. **Working Memory** (0-48 hours)
   - Contains recent conversations and active context
   - Optimized for frequent access
   - Lower importance threshold (0.5)

2. **Session Memory** (24 hours - 14 days)
   - Contains recent session contexts
   - Balanced optimization
   - Medium importance threshold (0.7)

3. **Long-Term Memory** (7+ days)
   - Contains persistent knowledge
   - Optimized for accuracy over speed
   - High importance threshold (0.85)

Memories automatically migrate between tiers based on age and access patterns, with 24-hour overlap windows to prevent data loss.

## Consequences

### Positive
- **50-70% faster queries** for recent memories
- **Better scalability** to 1M+ memories
- **Automatic lifecycle management** reduces manual maintenance
- **Resource optimization** through tier-specific settings
- **Natural alignment** with human memory patterns

### Negative
- **Increased complexity** in memory management logic
- **3x memory overhead** for tier separation
- **Migration processing** requires background CPU
- **Potential for temporary duplication** during overlap windows

### Neutral
- Query logic must be updated to search multiple tiers
- Monitoring becomes more important to track tier distribution
- Configuration options increase

## Alternatives Considered

### Option 1: Time-based Partitioning Only
Partition by time without semantic tiers.
- **Pros**: Simpler implementation, predictable behavior
- **Cons**: No importance-based filtering, rigid boundaries

### Option 2: Importance-based Collections
Separate collections based solely on importance scores.
- **Pros**: Clear importance hierarchy
- **Cons**: Recent unimportant items mixed with old important ones

### Option 3: Single Collection with Advanced Indexing
Keep single collection but add complex indexing.
- **Pros**: No migration needed, simpler architecture
- **Cons**: ChromaDB doesn't support custom indexing strategies

## Implementation Notes

1. **Migration Service**: Run hourly to move memories between tiers
2. **Query Strategy**: Check working memory first, then expand to other tiers
3. **Overlap Windows**: 24-hour overlap prevents memories from being inaccessible
4. **Monitoring**: Track memory distribution and migration patterns
5. **Rollback Plan**: Can merge tiers back to single collection if needed

## References
- [ChromaDB Collections Documentation](https://docs.trychroma.com/usage-guide#using-collections)
- [Memory System Design Patterns](../patterns/memory-hierarchies.md)
- Original analysis: [[Building AI-Driven MCP Servers with ChromaDB for Smart Memory Management]]

---
*Decision made by: Development Team*
*Date: 2025-01-05*