# Claude Desktop Configuration Guide

This guide will help you set up the MCP ChromaDB Memory Server with Claude Desktop.

## Step 1: Ensure Prerequisites

1. **ChromaDB is running**:
   ```bash
   cd C:\Users\Steve\Dockers\mcp-chromadb-memory
   docker-compose up -d chromadb
   ```

2. **Verify ChromaDB is healthy**:
   ```bash
   docker-compose ps
   ```
   You should see chromadb-memory with status "Up"

## Step 2: Create Claude Desktop Configuration

1. **Open File Explorer** and navigate to:
   ```
   C:\Users\Steve\AppData\Roaming\Claude
   ```

2. **Create or edit** the file `claude_desktop_config.json`

3. **Add this configuration**:

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--network", "mcp-chromadb-memory_memory-network",
        "-e", "OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=chromadb",
        "-e", "CHROMA_PORT=8000",
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

**IMPORTANT**: Replace `YOUR_OPENAI_API_KEY_HERE` with your actual OpenAI API key.

## Step 3: Alternative Configuration (Local Development)

If you prefer to run the server locally without Docker:

```json
{
  "mcpServers": {
    "memory-local": {
      "command": "node",
      "args": ["C:\\Users\\Steve\\Dockers\\mcp-chromadb-memory\\dist\\index.js"],
      "env": {
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY_HERE",
        "CHROMA_HOST": "localhost",
        "CHROMA_PORT": "8000"
      }
    }
  }
}
```

## Step 4: Restart Claude Desktop

1. **Close Claude Desktop** completely (check system tray)
2. **Start Claude Desktop** again
3. You should now see "memory" in the MCP servers list

## Step 5: Test the Integration

In Claude Desktop, try these commands:

1. **Check health**:
   "Can you check if the memory server is running correctly?"

2. **Store a memory**:
   "Please remember that I prefer dark mode interfaces and use VS Code"

3. **Recall memories**:
   "What do you remember about my preferences?"

## Troubleshooting

### If the server doesn't appear:

1. **Check the config file path**:
   - Make sure it's in `C:\Users\Steve\AppData\Roaming\Claude\`
   - File must be named exactly `claude_desktop_config.json`

2. **Verify JSON syntax**:
   - No trailing commas
   - Proper quotes around strings
   - Valid JSON structure

3. **Check Docker**:
   ```bash
   docker images | grep mcp-chromadb-memory
   ```
   You should see `mcp-chromadb-memory-mcp-memory` image

4. **View Claude Desktop logs**:
   - Check developer console (if available)
   - Look for MCP connection errors

### If connection fails:

1. **Ensure ChromaDB is running**:
   ```bash
   docker-compose ps
   ```

2. **Test the Docker image manually**:
   ```bash
   docker run -it --rm \
     --network mcp-chromadb-memory_memory-network \
     -e OPENAI_API_KEY=your-key \
     -e DOCKER_CONTAINER=true \
     -e CHROMA_HOST=chromadb \
     -e CHROMA_PORT=8000 \
     mcp-chromadb-memory-mcp-memory
   ```

3. **Check network connectivity**:
   ```bash
   docker network ls | grep memory-network
   ```

## Notes

- The MCP server container will start automatically when Claude Desktop connects
- It will stop when you close Claude Desktop (this is normal)
- ChromaDB should remain running in the background
- All memories are persisted in the ChromaDB volume