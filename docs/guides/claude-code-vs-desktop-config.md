# Claude Code vs Claude Desktop: MCP Configuration Guide

## Overview

There are two different Claude applications that can use MCP (Model Context Protocol) servers, and they have completely different configuration methods:

1. **Claude Desktop** - The GUI application for Windows/Mac
2. **Claude Code CLI** - The command-line tool for terminal/IDE integration

## Claude Desktop

**Claude Desktop** is the graphical user interface application that you download and install on Windows or macOS. It provides a chat-like interface where you can have conversations with Claude, and it supports persistent MCP server connections that remain active across all your conversations. The configuration is stored in a JSON file in your user's AppData (Windows) or Application Support (Mac) directory, and once configured, the MCP servers are always available whenever you use Claude Desktop.

### Configuration Location
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Example Configuration
```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--network", "mcp-chromadb-memory_memory-network", ...]
    }
  }
}
```

### When to Use
- For persistent, always-available MCP connections
- When you want the same tools available in every conversation
- For personal productivity workflows
- When using the Claude Desktop app interface

## Claude Code CLI

**Claude Code CLI** is a command-line tool that integrates with your terminal and development environment. It's designed for developers who want to use Claude directly from their command line or integrate it into their development workflows. MCP servers in Claude Code are configured per-project or per-user using the `claude mcp` commands, allowing different projects to have different sets of tools. The configuration can be stored in a project-specific `.mcp.json` file that can be committed to version control, making it easy to share MCP configurations with your team.

### Configuration Methods

1. **Command-line**: `claude mcp add <name> <command> [args...]`
2. **JSON file**: `.mcp.json` in project root (project-scoped)
3. **User config**: `~/.config/claude/config.json` (user-scoped)

### Example Commands
```bash
# Add a local MCP server
claude mcp add memory node dist/index.js -e OPENAI_API_KEY=$OPENAI_API_KEY

# Add a Docker-based MCP server
claude mcp add memory docker run -i --rm mcp-chromadb-memory-mcp-memory

# List configured servers
claude mcp list

# Remove a server
claude mcp remove memory
```

### When to Use
- For project-specific MCP configurations
- When working from the command line
- For team collaboration (using `.mcp.json`)
- When you need different tools for different projects

## Key Differences

| Feature | Claude Desktop | Claude Code CLI |
|---------|----------------|-----------------|
| **Interface** | GUI application | Command-line tool |
| **Configuration** | JSON file in AppData | CLI commands or `.mcp.json` |
| **Scope** | Global (all conversations) | Per-project or per-user |
| **Persistence** | Always active | Active during CLI session |
| **Team Sharing** | Manual config sharing | `.mcp.json` in version control |
| **Use Case** | Personal assistant | Development workflows |

## Configuration Examples for This Project

### Claude Desktop Configuration
Already created as `claude_desktop_config_current.json`:
- Copy to `%APPDATA%\Claude\claude_desktop_config.json`
- Add your OpenAI API key
- Restart Claude Desktop

### Claude Code Configuration
Can be set up using:
1. **Project-scoped** (recommended for teams):
   ```bash
   # This creates .mcp.json in the project root
   claude mcp add memory docker run -i --rm --network mcp-chromadb-memory_memory-network mcp-chromadb-memory-mcp-memory --project
   ```

2. **User-scoped** (for personal use):
   ```bash
   # This adds to your user config
   claude mcp add memory node /path/to/mcp-chromadb-memory/dist/index.js -e OPENAI_API_KEY=$OPENAI_API_KEY --user
   ```

## Which Should You Use?

### Use Claude Desktop when:
- You want a graphical chat interface
- You need persistent MCP connections across all conversations
- You're using Claude for general assistance beyond coding
- You prefer a traditional app experience

### Use Claude Code when:
- You're working in the terminal or IDE
- You need project-specific MCP configurations
- You want to share MCP configs with your team
- You're integrating Claude into development workflows
- You need to switch between different tool sets for different projects

## Quick Setup Commands

### For Claude Code (Current Session)
```bash
# Docker setup (requires Docker and docker-compose up)
claude mcp add memory docker run -i --rm \
  --network mcp-chromadb-memory_memory-network \
  -v "$(pwd)/vault:/vault:rw" \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e DOCKER_CONTAINER=true \
  -e CHROMA_HOST=chromadb \
  -e CHROMA_PORT=8000 \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e USE_HYBRID_STORAGE=true \
  -e OBSIDIAN_VAULT_PATH=/vault \
  mcp-chromadb-memory-mcp-memory

# Local setup (requires npm install && npm run build)
claude mcp add memory-local node dist/index.js \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e CHROMA_HOST=localhost \
  -e CHROMA_PORT=8000 \
  -e POSTGRES_HOST=localhost \
  -e POSTGRES_PORT=5432 \
  -e USE_HYBRID_STORAGE=true
```

### For Claude Desktop
1. Copy `claude_desktop_config_current.json` to config location
2. Add your OpenAI API key
3. Restart Claude Desktop

Both configurations can coexist - you can have Claude Desktop configured for general use while using Claude Code with project-specific configurations for development work.