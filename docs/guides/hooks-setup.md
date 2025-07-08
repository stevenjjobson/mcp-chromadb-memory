# Hooks Setup for Hybrid Storage

## Overview

Claude Code hooks have been configured to automatically enable and monitor the hybrid PostgreSQL + ChromaDB storage functionality. The hooks will activate on your next Claude Code session.

## Configured Hooks

### 1. **Auto-Index Code Files** (PostToolUse)
- **Trigger**: Write|Edit|MultiEdit operations
- **Script**: `/home/steve/scripts/auto-index-code.sh`
- **Function**: Marks modified code files for incremental indexing
- **Log**: `~/mcp-code-indexing.log`

### 2. **Optimize Code Search** (PreToolUse)
- **Trigger**: Grep operations
- **Script**: `/home/steve/scripts/optimize-code-search.py`
- **Function**: Suggests using `find_symbol` for code searches
- **Behavior**: Blocks grep and provides better alternatives

### 3. **Optimize File Search** (PreToolUse)
- **Trigger**: Glob operations
- **Script**: `/home/steve/scripts/optimize-file-search.py`
- **Function**: Suggests using `index_codebase` for code file searches
- **Behavior**: Blocks pure code file globs, allows mixed searches

### 4. **Log Code Intelligence** (PostToolUse)
- **Trigger**: MCP code intelligence tools
- **Script**: `/home/steve/scripts/log-code-intelligence.sh`
- **Function**: Tracks usage and performance metrics
- **Log**: `~/mcp-code-intelligence.log`

### 5. **Show Memory Stats** (Stop)
- **Trigger**: End of Claude Code session
- **Script**: `/home/steve/scripts/show-memory-stats.sh`
- **Function**: Displays session statistics
- **Timeout**: 5 seconds

## Activation

The hooks are configured in `~/.claude/settings.json` and will activate:
1. When you start a new Claude Code session
2. Or use the `/hooks` command to reload settings

## Monitoring

### Check Hook Activity
```bash
# View code indexing activity
tail -f ~/mcp-code-indexing.log

# View code intelligence operations
tail -f ~/mcp-code-intelligence.log

# Check pending index queue
cat ~/mcp-pending-index.txt
```

### PostgreSQL Statistics
```bash
# Connect to PostgreSQL
PGPASSWORD=mcp_memory_pass psql -h localhost -U mcp_user -d mcp_memory

# View symbol statistics
SELECT type, COUNT(*) FROM code_symbols GROUP BY type;

# View memory distribution
SELECT context, COUNT(*) FROM memories GROUP BY context;
```

## Testing Hooks

1. **Test Auto-Indexing**: Create or edit a `.ts` or `.js` file
2. **Test Grep Optimization**: Try `grep "class MyClass" src/`
3. **Test Glob Optimization**: Try searching for `**/*.ts` or `**/*.js`
4. **Test Session Stats**: End your Claude Code session

## Troubleshooting

### Hooks Not Running
1. Restart Claude Code to reload settings
2. Check settings: `cat ~/.claude/settings.json`
3. Verify scripts are executable: `ls -la ~/scripts/`

### Permission Issues
```bash
# Make all scripts executable
chmod +x ~/scripts/*.sh ~/scripts/*.py
```

### Debug Mode
Run Claude Code with debug flag to see hook execution:
```bash
claude --debug
```

## Next Steps

1. The hybrid storage is now enabled in production
2. New code files will be automatically indexed
3. Code searches will be optimized for performance
4. Session statistics will track your usage

The system will gradually migrate from ChromaDB to PostgreSQL based on the configured read ratio (currently 50/50).