# Health Monitoring System

The MCP ChromaDB Memory Platform includes a comprehensive health monitoring system that provides real-time visibility into the platform's state and performance.

## Overview

The health monitoring system consists of:
- **Startup Health Check**: Automatic system check when connecting
- **Vault Index**: Real-time dashboard in `Project_Context/vault/VAULT_INDEX.md`
- **Memory Health Monitor**: Diagnostics for memory system optimization
- **File Watcher**: Real-time updates when vault content changes
- **MCP Tools**: Programmatic access to health information

## Features

### 1. Startup Health Check

When Claude Code connects to the MCP server, you'll see:

```
🚀 **MCP ChromaDB Memory Platform Started**

📊 **System Health**: ✅ healthy
- ChromaDB: Connected (8ms latency)
- Obsidian Vault: Connected
- Session Logger: Active (MCP ChromaDB Memory)

🧠 **Memory Status**
- Total Memories: 1247
- Recent (24h): 47
- Working Memory Load: 32%

📁 **Vault Index**: Check Project_Context/vault/VAULT_INDEX.md for details

✅ **Active Tasks**
🔄 Implement vault index system
🔄 Create startup visibility

Ready to continue your work!
```

### 2. Vault Index (VAULT_INDEX.md)

The vault index provides a comprehensive dashboard that includes:

- **System Health**: Status of all components
- **Active Context**: Current session information
- **Memory Statistics**: Breakdown by type and recency
- **Vault Statistics**: File organization and coverage
- **Quick Navigation**: Links to important areas

The index is automatically updated:
- Every 5 minutes
- When significant file changes occur
- On manual regeneration

### 3. Memory Health Analysis

The memory health monitor checks for:

- **Fragmentation**: Gaps in memory storage
- **Duplicates**: Similar memories that could be consolidated
- **Orphaned Memories**: Unused memories that could be cleaned up
- **Performance**: Query times and indexing speed

### 4. Available MCP Tools

#### get_startup_summary
Returns the current system state including health status, memory statistics, and active tasks.

```javascript
// Example usage
{
  "name": "get_startup_summary",
  "arguments": {}
}
```

#### get_vault_index
Retrieves comprehensive vault statistics in JSON or markdown format.

```javascript
// Example usage
{
  "name": "get_vault_index",
  "arguments": {
    "format": "json"  // or "markdown"
  }
}
```

#### check_memory_health
Runs memory system diagnostics and provides optimization recommendations.

```javascript
// Example usage
{
  "name": "check_memory_health",
  "arguments": {
    "includeRecommendations": true
  }
}
```

#### regenerate_index
Forces immediate regeneration of the vault index.

```javascript
// Example usage
{
  "name": "regenerate_index",
  "arguments": {}
}
```

## Testing the Health System

### Demo Mode
Run the demo script to see how the health system works:

```bash
node demo-health-check.js
```

For interactive mode:
```bash
node demo-health-check.js --interactive
```

### Test with Real Server
To test with the actual MCP server:

```bash
# 1. Start ChromaDB
docker-compose up -d chromadb

# 2. Build the project
npm run build

# 3. Run the test
node test-health-tools.js --server
```

## Understanding Health Indicators

### System Health Status
- ✅ **Healthy**: All components operational
- ⚠️ **Warning**: Some components need attention
- ❌ **Error**: Critical components failed

### Memory Health Metrics
- **Fragmentation < 15%**: Healthy
- **Fragmentation 15-30%**: Warning
- **Fragmentation > 30%**: Needs consolidation

### Performance Benchmarks
- **Query time < 50ms**: Excellent
- **Query time 50-100ms**: Good
- **Query time > 100ms**: Needs optimization

## Maintenance Recommendations

### Regular Checks
1. Review vault index daily
2. Check memory health weekly
3. Clean up orphaned memories monthly

### Optimization Actions
1. **High fragmentation**: Run memory consolidation
2. **Many duplicates**: Use deduplication tools
3. **Slow queries**: Optimize indexes
4. **Template cache full**: Clean old templates

## Architecture

### Components

1. **VaultIndexService** (`src/services/vault-index-service.ts`)
   - Generates comprehensive statistics
   - Monitors system health
   - Creates markdown dashboard

2. **MemoryHealthMonitor** (`src/services/memory-health-monitor.ts`)
   - Analyzes memory fragmentation
   - Detects duplicates
   - Measures performance

3. **VaultFileWatcher** (`src/services/vault-file-watcher.ts`)
   - Monitors file changes
   - Triggers index updates
   - Batches changes for efficiency

### Data Flow

```
Claude Code Connection
    ↓
Startup Health Check
    ↓
Initialize Services
    ├── VaultIndexService (generates index)
    ├── MemoryHealthMonitor (tracks health)
    └── VaultFileWatcher (monitors changes)
    ↓
Display Startup Summary
    ↓
Continuous Monitoring
    ├── Periodic index updates (5 min)
    ├── Real-time file watching
    └── On-demand health checks
```

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Failed**
   - Ensure ChromaDB is running: `docker-compose up -d chromadb`
   - Check port 8000 is accessible

2. **Vault Not Found**
   - Verify OBSIDIAN_VAULT_PATH in .env
   - Ensure path exists and is accessible

3. **High Memory Fragmentation**
   - Run consolidation service
   - Clean up old memories
   - Optimize query patterns

4. **Slow Performance**
   - Check memory count (may need cleanup)
   - Verify ChromaDB performance
   - Review query patterns

## Future Enhancements

- Real-time health alerts
- Predictive maintenance
- Performance trend analysis
- Automated optimization
- Health history tracking