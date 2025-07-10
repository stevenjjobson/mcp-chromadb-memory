# Claude Desktop Configuration Guide for MCP ChromaDB Memory

## Quick Setup

1. **Copy the configuration file** to Claude Desktop's config directory:
   ```powershell
   # Windows (PowerShell)
   copy claude_desktop_config_current.json "$env:APPDATA\Claude\claude_desktop_config.json"
   ```

2. **Add your OpenAI API key**:
   - Open the copied file in a text editor
   - Replace `YOUR_OPENAI_API_KEY_HERE` with your actual OpenAI API key

3. **Start required services**:
   ```bash
   # From the project directory
   docker-compose up -d chromadb postgres
   ```

4. **Build the Docker image** (if not already built):
   ```bash
   npm run docker:build
   ```

5. **Restart Claude Desktop**:
   - Close Claude Desktop completely (check system tray)
   - Start Claude Desktop again
   - You should see "memory" in the MCP servers list

## Configuration Files Explained

### 1. `claude_desktop_config_current.json` (Recommended)
- **Use this for**: Current development with all features enabled
- **Includes**: PostgreSQL, ChromaDB, Code Intelligence, Memory Tiers
- **Best for**: Full platform functionality

### 2. `claude_desktop_config.example.json` (Basic)
- **Use this for**: Basic setup without PostgreSQL
- **Includes**: ChromaDB only, Obsidian vault mounting
- **Best for**: Simple memory storage without advanced features

### 3. Local Development Configuration
If you prefer running without Docker:

```json
{
  "mcpServers": {
    "memory-local": {
      "command": "node",
      "args": ["C:\\Users\\Steve\\Dockers\\mcp-chromadb-memory\\dist\\index.js"],
      "env": {
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY_HERE",
        "CHROMA_HOST": "localhost",
        "CHROMA_PORT": "8000",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "memory123",
        "POSTGRES_DB": "memory_platform",
        "USE_HYBRID_STORAGE": "true",
        "OBSIDIAN_VAULT_PATH": "C:\\Users\\Steve\\Dockers\\mcp-chromadb-memory\\Project_Context\\vault",
        "AUTO_START_SESSION_LOGGING": "true",
        "SESSION_LOGGING_PROJECT_NAME": "MCP ChromaDB Memory"
      }
    }
  }
}
```

## Testing Your Configuration

Once configured, test these commands in Claude Desktop:

1. **Health Check**:
   ```
   Use the health_check tool to verify all systems are operational
   ```

2. **Store a Memory**:
   ```
   Store this memory: "I'm working on the MCP ChromaDB Memory project with PostgreSQL integration"
   ```

3. **Code Intelligence** (if enabled):
   ```
   Index the codebase and find all TypeScript interfaces
   ```

4. **Memory Tiers**:
   ```
   Show me the memory tier statistics
   ```

## Troubleshooting

### Issue: "memory" server not appearing
- Ensure Docker Desktop is running
- Check that both databases are up: `docker-compose ps`
- Verify the configuration file is valid JSON

### Issue: Connection errors
- Check Docker network: `docker network ls`
- Ensure network name matches: `mcp-chromadb-memory_memory-network`
- Verify services are on the same network

### Issue: OpenAI API errors
- Confirm your API key is correctly set
- Check API key has sufficient credits
- Ensure no extra spaces in the key

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_HYBRID_STORAGE` | Enable PostgreSQL + ChromaDB | `true` |
| `POSTGRES_READ_RATIO` | PostgreSQL read percentage (0-1) | `0.5` |
| `CODE_INDEXING_ENABLED` | Enable code intelligence | `true` |
| `MEMORY_TIER_ENABLED` | Enable memory tier system | `true` |
| `AUTO_START_SESSION_LOGGING` | Auto-start session logging | `true` |

## Multiple Projects

To work with multiple projects, you can configure multiple MCP servers:

```json
{
  "mcpServers": {
    "memory-main": {
      // Main project configuration
    },
    "memory-coachntt": {
      // CoachNTT specific configuration
    }
  }
}
```

## Security Notes

- Never commit your `claude_desktop_config.json` with API keys
- The example files use placeholder keys for safety
- Consider using environment variables for sensitive data in production