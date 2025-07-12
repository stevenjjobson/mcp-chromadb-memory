# Claude Desktop Configuration Examples

This directory contains example configuration files for Claude Desktop MCP server integration.

## ⚠️ Security Notice

**NEVER commit configuration files with real API keys to version control!**

Always use placeholders like `YOUR_OPENAI_API_KEY_HERE` in example files.

## 📄 Configuration Files

### 1. `claude_desktop_config_basic.json` - 🟢 Start Here!
- **Purpose**: Minimal configuration to get started
- **Features**: Basic memory storage with ChromaDB and PostgreSQL
- **Best for**: New users who want to try the platform

### 2. `claude_desktop_config_dual_vault.json` - 🔀 Multi-Project Support
- **Purpose**: Dual vault setup for managing multiple projects
- **Features**: 
  - Core vault for personal knowledge
  - Project vault for project-specific context
  - Cross-vault search capabilities
- **Best for**: Developers working on multiple projects

### 3. `claude_desktop_config_full_features.json` - 🚀 Everything Enabled
- **Purpose**: Complete example showing all possible features
- **Features**:
  - Multiple deployment options (Docker, local, voice)
  - Code intelligence and pattern detection
  - Session logging and tier management
  - CoachNTT voice synthesis integration
- **Best for**: Reference documentation and advanced users

## 🔧 Quick Start

1. Copy the basic configuration to your Claude Desktop config location:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Replace placeholder values:
   - `YOUR_OPENAI_API_KEY_HERE` - Your OpenAI API key
   - `C:/path/to/your/vault` - Path to your Obsidian vault or notes directory

3. Start Docker containers:
   ```bash
   docker-compose up -d
   ```
   This will start both `coachntt-chromadb` and `coachntt-postgres` containers.

4. Restart Claude Desktop to load the new configuration

## 🔑 Common Environment Variables

### Required
- `OPENAI_API_KEY` - For generating embeddings
- `DOCKER_CONTAINER=true` - Indicates running in Docker
- `CHROMA_HOST=coachntt-chromadb` - ChromaDB service name
- `POSTGRES_HOST=coachntt-postgres` - PostgreSQL service name

### Optional Features
- `VAULT_MODE=dual` - Enable dual vault architecture
- `CODE_INDEXING_ENABLED=true` - Enable code intelligence features
- `AUTO_START_SESSION_LOGGING=true` - Automatically log sessions
- `TIER_ENABLED=true` - Enable hierarchical memory tiers

## 🐳 Docker Network Configuration

All configurations use the CoachNTT platform network:
- Network: `mcp-chromadb-memory_coachntt-platform-network`
- ChromaDB: `coachntt-chromadb:8000`
- PostgreSQL: `coachntt-postgres:5432`
- Database: `coachntt_cognitive_db`

## 🏷️ MCP Server Names

The configurations use branded server names that appear in Claude Desktop:
- **CoachNTT.ai** - Main memory server
- **CoachNTT.ai-Local** - Local development variant (in full features config)
- **CoachNTT.ai-Voice** - Voice synthesis enabled variant (in full features config)

## 📚 Additional Documentation

- [Claude Desktop Config Guide](../../guides/claude-desktop-config.md)
- [MCP Configuration Guide](../../guides/mcp-configuration-guide.md)
- [Dual Vault Quick Start](../../guides/dual-vault-quickstart.md)
- [Docker MCP Troubleshooting](../../guides/docker-mcp-troubleshooting.md)