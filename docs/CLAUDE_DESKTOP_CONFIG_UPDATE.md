# Claude Desktop Configuration Update Guide

## Network Name Change Required

Due to the CoachNTT branding updates, you need to update your Claude Desktop configuration.

### What Changed

The Docker network name has changed from:
- `mcp-chromadb-memory_memory-network`

To:
- `mcp-chromadb-memory_coachntt-platform-network`

### Update Your Configuration

In your Claude Desktop config file (usually at `%APPDATA%\Claude\claude_desktop_config.json` on Windows), update the network parameter:

```json
"--network", "mcp-chromadb-memory_coachntt-platform-network",
```

### Full Example

Here's an example of the updated configuration:

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--name", "coachntt-cognitive-server",
        "--network", "mcp-chromadb-memory_coachntt-platform-network",
        "-v", "C:/Users/Steve/Obsidian/StevesVault:/core-vault:rw",
        "-v", "C:/Users/Steve/Dockers/mcp-chromadb-memory/vault:/project-vault:rw",
        "-e", "OPENAI_API_KEY=${OPENAI_API_KEY}",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=coachntt-chromadb",
        "-e", "CHROMA_PORT=8000",
        "-e", "POSTGRES_HOST=coachntt-postgres",
        "-e", "POSTGRES_PORT=5432",
        "-e", "POSTGRES_USER=coachntt_user",
        "-e", "POSTGRES_PASSWORD=coachntt_pass",
        "-e", "POSTGRES_DB=coachntt_cognitive_db",
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

### Steps to Apply

1. Stop Claude Desktop
2. Update your `claude_desktop_config.json` file
3. Restart your Docker containers:
   ```bash
   docker-compose down
   docker-compose up -d
   ```
4. Start Claude Desktop

The new network will be created automatically when you start the containers.