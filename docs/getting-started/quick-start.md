# Quick Start Guide

Get up and running with the MCP ChromaDB Memory Server in 5 minutes.

## 1. Quick Setup

```bash
# Clone and setup
git clone https://github.com/yourusername/mcp-chromadb-memory.git
cd mcp-chromadb-memory
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start services
docker-compose up -d chromadb
npm run build
```

## 2. Test with MCP Inspector

```bash
npm run inspect
```

Try these commands in the inspector:

### Store a Memory
```json
{
  "tool": "store_memory",
  "arguments": {
    "content": "The project uses TypeScript and ChromaDB for semantic memory storage",
    "context": "general"
  }
}
```

### Recall Memories
```json
{
  "tool": "recall_memories",
  "arguments": {
    "query": "What database does the project use?",
    "limit": 5
  }
}
```

### Check Health
```json
{
  "tool": "health_check",
  "arguments": {}
}
```

## 3. Configure Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/mcp-chromadb-memory/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-key-here"
      }
    }
  }
}
```

## 4. Index Your Codebase

Enable code intelligence by indexing your project:

```json
{
  "tool": "index_codebase",
  "arguments": {
    "path": ".",
    "pattern": "**/*.{js,ts,py}"
  }
}
```

## 5. Start Using Memory

The server automatically:
- Stores important information
- Learns from your development patterns
- Maintains context across sessions
- Provides intelligent code search

## What's Next?

- Explore [Memory Features](../guides/memory-usage.md)
- Set up [Multi-Project Support](../guides/memory-usage.md#multi-project-support)
- Configure [Code Intelligence](../guides/code-intelligence.md)
- Learn about [Hybrid Storage](../guides/hybrid-storage.md)