# MCP Configuration Guide: Claude Desktop vs Claude Code CLI

This guide explains the configuration differences between Claude Desktop and Claude Code CLI, helping you set up the MCP ChromaDB Memory server correctly on both platforms.

## Table of Contents
- [Configuration Overview](#configuration-overview)
- [Configuration Comparison](#configuration-comparison)
- [Platform-Specific Setup](#platform-specific-setup)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Environment Variables](#environment-variables)
- [Best Practices](#best-practices)

## Configuration Overview

The MCP ChromaDB Memory server can be used with two different Claude clients:
- **Claude Desktop**: Windows/Mac/Linux desktop application
- **Claude Code CLI**: Command-line interface for developers

Each client uses a different configuration format and has unique requirements.

## Configuration Comparison

| **Aspect** | **Claude Desktop** | **Claude Code CLI** |
|------------|-------------------|-------------------|
| **Config File** | `%APPDATA%\Claude\claude_desktop_config.json` | `.mcp.json` in project root |
| **Config Format** | Simple JSON with command/args | Structured JSON with type/env support |
| **API Key Handling** | ⚠️ Hardcoded in config | ✅ Environment variable substitution |
| **Path Format** | Absolute paths only | Supports `${PWD}` for relative paths |
| **Multiple Configs** | One per server | Multiple configs (Docker/local) |
| **Variable Substitution** | ❌ Not supported | ✅ Supports `${VAR}` syntax |
| **Security** | Less secure (plaintext secrets) | More secure (env var references) |

### Configuration Examples

#### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--name", "claude-mcp-memory",
        "--network", "mcp-chromadb-memory_memory-network",
        "-v", "C:/Users/Steve/Obsidian/StevesVault:/core-vault:rw",
        "-v", "C:/Users/Steve/Dockers/mcp-chromadb-memory/vault:/project-vault:rw",
        "-e", "OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE",
        "-e", "VAULT_MODE=dual",
        "-e", "CORE_VAULT_PATH=/core-vault",
        "-e", "PROJECT_VAULT_PATH=/project-vault",
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

#### Claude Code CLI Configuration (.mcp.json)
```json
{
  "mcpServers": {
    "memory": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--name", "claude-mcp-memory",
        "--network", "mcp-chromadb-memory_memory-network",
        "-v", "C:/Users/Steve/Obsidian/StevesVault:/core-vault:rw",
        "-v", "${PWD}/vault:/project-vault:rw",
        "-e", "OPENAI_API_KEY=${OPENAI_API_KEY}",
        "-e", "VAULT_MODE=dual",
        "mcp-chromadb-memory-mcp-memory"
      ]
    },
    "memory-local": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "VAULT_MODE": "dual",
        "CORE_VAULT_PATH": "C:/Users/Steve/Obsidian/StevesVault",
        "PROJECT_VAULT_PATH": "${PWD}/vault"
      }
    }
  }
}
```

## Platform-Specific Setup

### Claude Desktop Setup

1. **Locate Configuration File**
   ```bash
   # Windows
   %APPDATA%\Claude\claude_desktop_config.json
   
   # macOS
   ~/Library/Application Support/Claude/claude_desktop_config.json
   
   # Linux
   ~/.config/Claude/claude_desktop_config.json
   ```

2. **Key Requirements**
   - Use absolute paths for all file locations
   - Hardcode all environment variables (security risk!)
   - Ensure Docker containers are running
   - Use correct container names from docker-compose.yml

3. **Common Setup Issues**
   - JSON syntax errors (escape backslashes in Windows paths)
   - Wrong container hostnames (check docker-compose.yml)
   - Missing API keys or incorrect credentials

### Claude Code CLI Setup

1. **Configuration Discovery**
   - Automatically finds `.mcp.json` in current directory
   - No manual configuration needed

2. **Environment Setup**
   ```bash
   # Set required environment variables
   export OPENAI_API_KEY="your-api-key-here"
   
   # Or add to ~/.bashrc for persistence
   echo 'export OPENAI_API_KEY="your-api-key-here"' >> ~/.bashrc
   ```

3. **Key Advantages**
   - Variable substitution for sensitive data
   - Multiple configurations (Docker vs local)
   - Project-relative paths with `${PWD}`
   - Secure credential management

## Common Issues and Solutions

### Issue 1: MCP Server Won't Load

**Symptoms**: Server shows as failed in Claude Desktop or CLI

**Common Causes**:
1. Missing OPENAI_API_KEY environment variable
2. Wrong database credentials
3. Incorrect vault paths
4. Container networking issues

**Solutions**:
```bash
# Check if services are running
docker ps

# Verify environment variables
echo $OPENAI_API_KEY

# Test server directly
node dist/index.js 2>&1 | head -50
```

### Issue 2: Configuration File Not Found

**Claude Desktop**:
- Ensure file exists at correct location
- Check file permissions

**Claude Code CLI**:
- Must run `claude` from project directory
- Ensure `.mcp.json` exists

### Issue 3: Database Connection Errors

**Check docker-compose.yml for correct credentials**:
```yaml
postgres:
  environment:
    - POSTGRES_USER=mcp_user
    - POSTGRES_PASSWORD=mcp_memory_pass
    - POSTGRES_DB=mcp_memory
```

**Ensure configuration matches**:
- POSTGRES_USER must match in all configs
- Container names must match (postgres-memory, chromadb-memory)

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for embeddings | `sk-proj-...` |

### Dual Vault Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VAULT_MODE` | Vault operation mode | `single` |
| `CORE_VAULT_PATH` | Path to personal knowledge vault | - |
| `PROJECT_VAULT_PATH` | Path to project-specific vault | `./vault` |
| `ENABLE_CROSS_VAULT_SEARCH` | Search across both vaults | `true` |
| `CORE_VAULT_WEIGHT` | Weight for core vault results | `0.3` |
| `PROJECT_VAULT_WEIGHT` | Weight for project vault results | `0.7` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL hostname | `localhost` |
| `POSTGRES_USER` | Database user | `mcp_user` |
| `POSTGRES_PASSWORD` | Database password | `mcp_memory_pass` |
| `POSTGRES_DB` | Database name | `mcp_memory` |
| `CHROMA_HOST` | ChromaDB hostname | `localhost` |

## Best Practices

### 1. Security
- **Never** commit API keys to version control
- Use environment variables for all sensitive data
- Consider using a secrets manager for production

### 2. Configuration Management
- Keep `.env.PRODUCTION` and `.mcp.json` in sync
- Document any custom configurations
- Use the wrapper script approach for Claude Desktop

### 3. Path Handling
- Use forward slashes even on Windows
- Prefer relative paths in Claude Code CLI
- Always use absolute paths in Claude Desktop

### 4. Testing Configuration
```bash
# Test Docker connectivity
docker run --rm --network mcp-chromadb-memory_memory-network \
  alpine ping -c 1 chromadb-memory

# Test local server
OPENAI_API_KEY="your-key" node dist/index.js

# Validate JSON syntax
python -m json.tool < .mcp.json
```

### 5. Debugging Tips
- Check server logs: `docker logs claude-mcp-memory`
- Verify network: `docker network ls`
- Test environment: `env | grep -E "(OPENAI|VAULT|POSTGRES|CHROMA)"`

## Quick Reference

### File Locations
- **Claude Desktop Config**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Code Config**: `./.mcp.json`
- **Environment Config**: `./.env.PRODUCTION`
- **Docker Services**: `./docker-compose.yml`

### Service Names
- **ChromaDB**: `chromadb-memory`
- **PostgreSQL**: `postgres-memory`
- **Network**: `mcp-chromadb-memory_memory-network`

### Common Commands
```bash
# Start services
docker-compose up -d chromadb postgres

# Check logs
docker logs chromadb-memory
docker logs postgres-memory

# Restart services
docker-compose restart

# Test MCP server
node dist/index.js
```

## Troubleshooting Checklist

- [ ] Docker services running?
- [ ] OPENAI_API_KEY set?
- [ ] Database credentials correct?
- [ ] Container names match configuration?
- [ ] Vault paths exist and are accessible?
- [ ] JSON syntax valid?
- [ ] Environment variables exported?
- [ ] Using correct environment (.env.PRODUCTION)?

## Need Help?

If you're still having issues:
1. Check the server output directly
2. Review docker-compose logs
3. Verify all paths exist
4. Ensure all required services are healthy
5. Check for port conflicts (8000, 5432)