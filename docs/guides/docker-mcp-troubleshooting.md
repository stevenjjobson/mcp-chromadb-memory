# Docker MCP Server Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: Claude Desktop Can't Load MCP Server

**Symptoms:**
- No "memory" server in Claude Desktop
- Error messages about Docker
- MCP server fails to start

**Root Causes:**

1. **Wrong Container Names** ❌
   ```json
   "-e", "CHROMA_HOST=chromadb",      // WRONG
   "-e", "POSTGRES_HOST=postgres",     // WRONG
   ```
   
   **Fix:** ✅
   ```json
   "-e", "CHROMA_HOST=chromadb-memory",     // CORRECT
   "-e", "POSTGRES_HOST=postgres-memory",   // CORRECT
   ```

2. **Invalid Vault Path Inside Container** ❌
   ```json
   "-e", "OBSIDIAN_VAULT_PATH=C:/Users/Steve/Obsidian/StevesVault",  // WRONG
   ```
   
   **Fix:** ✅
   ```json
   "-e", "OBSIDIAN_VAULT_PATH=/vault",     // CORRECT (maps to volume mount)
   ```

3. **Services Not Running**
   - ChromaDB showing as unhealthy
   - PostgreSQL not started
   - Docker network missing

### Quick Fix Steps

#### Windows PowerShell:
```powershell
# 1. Navigate to project
cd C:\Users\Steve\Dockers\mcp-chromadb-memory

# 2. Run the fix script
.\scripts\fix-docker-mcp.ps1

# 3. Follow the prompts to apply fixes
```

#### WSL/Linux:
```bash
# 1. Navigate to project
cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory

# 2. Run the fix script
./scripts/fix-docker-mcp.sh
```

### Manual Fix Process

1. **Start Required Services:**
   ```bash
   docker-compose up -d chromadb postgres
   ```

2. **Check Service Health:**
   ```bash
   # Check if services are running
   docker ps
   
   # Check ChromaDB health
   curl http://localhost:8000/api/v1
   
   # Check PostgreSQL
   docker exec postgres-memory pg_isready -U postgres
   ```

3. **Update Configuration:**
   - Use `claude_desktop_config_fixed.json` as template
   - Copy to `%APPDATA%\Claude\claude_desktop_config.json`
   - Add your OpenAI API key

4. **Restart Claude Desktop**

### Configuration Checklist

✅ **Correct Service Names:**
- `chromadb-memory` (not `chromadb`)
- `postgres-memory` (not `postgres`)

✅ **Correct Network:**
- `mcp-chromadb-memory_memory-network`

✅ **Valid Paths:**
- Volume mount: `-v "C:/path:/container-path"`
- Environment var: `OBSIDIAN_VAULT_PATH=/container-path`

✅ **Required Environment Variables:**
- `DOCKER_CONTAINER=true`
- `OPENAI_API_KEY=your-actual-key`
- Database connection settings

### Debugging Commands

```bash
# View container logs
docker logs chromadb-memory
docker logs postgres-memory

# Test MCP server directly
docker run --rm -it \
  --network mcp-chromadb-memory_memory-network \
  -e DOCKER_CONTAINER=true \
  -e CHROMA_HOST=chromadb-memory \
  -e POSTGRES_HOST=postgres-memory \
  mcp-chromadb-memory-mcp-memory \
  node dist/index.js --help

# Check network connectivity
docker run --rm -it \
  --network mcp-chromadb-memory_memory-network \
  alpine ping chromadb-memory
```

### Common Error Messages

**"Cannot connect to ChromaDB"**
- Service name mismatch
- ChromaDB not running
- Network issues

**"PostgreSQL connection failed"**
- Wrong host/port
- PostgreSQL not initialized
- Password mismatch

**"Cannot find vault"**
- Path mapping incorrect
- Volume not mounted
- Permissions issue

### Still Having Issues?

1. **Rebuild the Docker image:**
   ```bash
   npm run docker:build
   ```

2. **Reset everything:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **Check Windows-specific issues:**
   - Docker Desktop running in WSL2 mode
   - Drive sharing enabled in Docker Desktop
   - Firewall not blocking ports

### Working Example Config

Here's a minimal working configuration:

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--network", "mcp-chromadb-memory_memory-network",
        "-e", "OPENAI_API_KEY=sk-...",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=chromadb-memory",
        "-e", "POSTGRES_HOST=postgres-memory",
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

Start with this and add features incrementally!