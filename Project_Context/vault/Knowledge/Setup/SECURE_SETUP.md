# Secure Setup Guide for MCP ChromaDB Memory Server

This guide explains how to securely configure and run the MCP ChromaDB Memory Server without exposing API keys.

## Security Overview

The server now supports multiple methods for secure API key management:

1. **Docker Secrets** (Recommended for production)
2. **Windows Credential Manager** (Recommended for development)
3. **Environment Variables** (Acceptable for personal use)

## Method 1: Docker Secrets (Most Secure)

### Step 1: Run the Setup Script

```powershell
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
.\scripts\setup-secrets.ps1
```

This script will:
- Prompt for your OpenAI API key
- Create secure secret files in the `secrets/` directory
- Set restrictive file permissions
- Update your Claude Desktop configuration

### Step 2: Start the Services

```bash
docker-compose up -d
```

Docker will automatically mount the secrets as files inside the container.

## Method 2: Windows Credential Manager

### Step 1: Store Credentials Securely

```powershell
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
.\scripts\setup-secrets.ps1 -UseCredentialManager
```

This stores your API keys in Windows Credential Manager, encrypted with your Windows login.

### Step 2: Retrieve Credentials When Needed

```powershell
# Set as environment variable for current session
.\scripts\retrieve-secrets.ps1 -AsEnvironmentVariable

# Or retrieve the value directly (be careful!)
$apiKey = .\scripts\retrieve-secrets.ps1
```

## Method 3: Environment Variables

### Step 1: Set User Environment Variable

```powershell
# PowerShell (as Administrator)
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your-key-here", "User")
```

### Step 2: Update Claude Desktop Config

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--network", "mcp-chromadb-memory_memory-network",
        "-e", "OPENAI_API_KEY",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=chromadb",
        "-e", "CHROMA_PORT=8000",
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

Note: The `-e OPENAI_API_KEY` without a value tells Docker to inherit the environment variable from your system.

## Security Best Practices

### DO:
- ✅ Use Docker secrets for production deployments
- ✅ Store API keys in Windows Credential Manager for development
- ✅ Regularly rotate your API keys
- ✅ Use restrictive file permissions on secret files
- ✅ Keep the `secrets/` directory in .gitignore

### DON'T:
- ❌ Never commit API keys to version control
- ❌ Never hardcode keys in configuration files
- ❌ Never share your `.env` file
- ❌ Never log or print API keys
- ❌ Never use production keys in development

## Verifying Your Setup

### Check for Exposed Secrets

Run the validation script to ensure no secrets are exposed:

```powershell
.\scripts\validate-no-secrets.ps1
```

### Test the Configuration

1. Start ChromaDB:
   ```bash
   docker-compose up -d chromadb
   ```

2. Test the MCP server:
   ```bash
   npm run inspect
   ```

3. In Claude Desktop, test the memory functionality:
   - "Can you check if the memory server is running?"
   - "Please remember that I prefer dark mode"
   - "What do you remember about my preferences?"

## Troubleshooting

### "API Key Not Found" Error

1. Verify the secret file exists:
   ```powershell
   ls .\secrets\
   ```

2. Check Docker secret mounting:
   ```bash
   docker-compose exec mcp-memory ls -la /run/secrets/
   ```

3. Verify environment variable:
   ```powershell
   echo $env:OPENAI_API_KEY
   ```

### "Permission Denied" Error

Ensure the secrets directory has proper permissions:
```powershell
icacls .\secrets\ /grant "${env:USERNAME}:(OI)(CI)F" /T
```

## Migration from .env File

If you previously used a `.env` file:

1. Copy your `.env` to `.env.backup`
2. Run the setup script to securely store your keys
3. Delete the original `.env` file
4. Verify the application still works

## Additional Resources

- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [Windows Credential Manager](https://support.microsoft.com/en-us/windows/accessing-credential-manager-1b5c916a-6a16-889f-8581-fc16e8165ac0)
- [Environment Variables Best Practices](https://12factor.net/config)