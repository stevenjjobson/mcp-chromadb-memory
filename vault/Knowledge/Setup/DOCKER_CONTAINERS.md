# Docker Container Architecture

This document explains the Docker container setup for the MCP ChromaDB Memory Server.

## Container Overview

### Production Setup (Claude Desktop)

When using with Claude Desktop, you only need **one container running**:

1. **`chromadb-memory`** - The ChromaDB database server
   - Persistent storage for embeddings and memories
   - Runs continuously in the background
   - Shared by all MCP server instances

Claude Desktop automatically creates:

2. **`claude-mcp-memory`** - The MCP server instance
   - Created when Claude Desktop starts
   - Destroyed when Claude Desktop stops
   - Connects to the shared ChromaDB

## Starting Services

### For Claude Desktop (Normal Use)

```powershell
# Start only ChromaDB
.\start-chromadb.ps1

# Or manually
docker-compose up -d chromadb
```

This gives you a clean Docker setup with just the essential database running.

### For Development/Testing

If you need to test the MCP server independently:

```bash
# Use the development compose file
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This will create:
- `chromadb-memory` - ChromaDB database
- `mcp-memory-server-dev` - Test MCP server instance

## Container Communication

```
┌─────────────────────┐
│   Claude Desktop    │
│  (Windows/macOS)    │
└──────────┬──────────┘
           │ Creates & manages
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ claude-mcp-memory   │────▶│   chromadb-memory   │
│  (MCP Server)       │     │    (Database)       │
│  - Ephemeral        │     │  - Persistent       │
│  - Auto-created     │     │  - Always running   │
└─────────────────────┘     └─────────────────────┘
           │                           ▲
           │                           │
           └───── Network: ────────────┘
           mcp-chromadb-memory_memory-network
```

## Why This Setup?

1. **Simplicity**: Only one persistent container to manage
2. **Isolation**: Each Claude session gets its own MCP server
3. **Persistence**: ChromaDB data survives restarts
4. **Resource Efficiency**: MCP server only runs when needed

## Troubleshooting

### "Container not found" errors
- Ensure ChromaDB is running: `docker ps | grep chromadb`
- Check the network exists: `docker network ls | grep memory-network`

### Multiple MCP containers
- This is normal during development
- Use `docker ps -a` to see all containers
- Clean up with: `docker container prune`

### ChromaDB not accessible
- Check logs: `docker logs chromadb-memory`
- Verify port 8000 is not in use: `netstat -an | findstr 8000`
- Restart: `docker-compose restart chromadb`

## Best Practices

1. **Always start ChromaDB first** before using Claude Desktop
2. **Don't modify claude-mcp-memory** - it's managed by Claude
3. **Use docker-compose for ChromaDB** to ensure correct network setup
4. **Monitor disk space** - ChromaDB stores embeddings locally