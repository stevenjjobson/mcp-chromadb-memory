# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cognitive State Management Platform** built as an MCP (Model Context Protocol) server. It provides intelligent memory management using ChromaDB for semantic search and storage, with sophisticated features for preserving development context across sessions, projects, and teams.

The platform is designed to:
- Maintain persistent context across development sessions
- Learn from development patterns and decisions
- Provide multi-project support with instant context switching
- Enable team knowledge sharing and collaboration

See [Platform Approach](./Project_Context/Platform%20Approach%20-%20Cognitive%20State%20Management.md) for the complete vision.

## Startup Procedure

When you connect to this MCP server, the following happens automatically:

### 1. System Health Check
The platform performs a comprehensive health check on startup:
- ChromaDB connection status
- Memory collections availability
- Obsidian vault accessibility
- Session logger initialization
- Template and vault structure managers

### 2. Startup Summary Display
You'll see a startup summary in the console showing:
- 📊 **System Health**: Overall status and component health
- 🧠 **Memory Status**: Total memories, recent activity, working memory load
- 📁 **Vault Index**: Link to the comprehensive vault index
- ✅ **Active Tasks**: Current work items in progress
- 💡 **Recommendations**: System optimization suggestions

### 3. Vault Index Generation
The system automatically generates/updates `Project_Context/vault/VAULT_INDEX.md` which contains:
- Real-time system health dashboard
- Memory system statistics
- Active context and recent sessions
- Vault organization metrics
- Quick navigation links

### 4. Context Loading
- Previous session context is available through memory recall
- Active tasks are tracked in the vault
- Session logging starts automatically (if enabled)

### Quick Start
1. **Check the startup summary** in your console for system status
2. **View the Vault Index** at `Project_Context/vault/VAULT_INDEX.md` for detailed information
3. **Review active tasks** to understand current work
4. **Use memory recall** to retrieve previous context

## Session Logging Instructions

**IMPORTANT**: This project has session logging capabilities that allow tracking development conversations in Obsidian.

### Automatic Session Logging
**NOTE: This project has AUTO_START_SESSION_LOGGING=true enabled in the .env file**, so session logging starts automatically when you connect to this MCP server.

If automatic logging is not enabled, you should:

1. **Start logging at the beginning of conversations** by using the `start_session_logging` tool
2. **Use the project name**: "MCP ChromaDB Memory" (or check `SESSION_LOGGING_PROJECT_NAME` env var)
3. **Save the session** before the conversation ends using the `save_session_log` tool

### What Gets Logged
- All user messages and assistant responses
- Tools used (Read, Write, Edit, Bash, etc.)
- Files created or modified
- Code changes and snippets
- Key decisions and achievements

### Best Practices
- Log significant development sessions to build a knowledge base
- Add manual summaries for complex sessions
- Use descriptive project names for better organization

## Platform Transformation Status

**Current Version**: 1.0 (Basic memory server)
**Target Version**: 2.0 (Cognitive State Management Platform)

See [Implementation Roadmap](./Project_Context/Implementation%20Roadmap.md) for the 20-day transformation plan.

### Key Upcoming Features
1. **Hierarchical Memory System**: Three-tier architecture for optimal performance
2. **Vault Management**: Multi-project support with hot-swapping
3. **State Capture**: Complete context preservation and restoration
4. **Pattern Recognition**: Learning from development patterns
5. **Background Services**: Automatic optimization and maintenance

## Architecture

### Current Components

1. **MCP Server** (`src/index.ts`): Handles stdio communication and tool endpoints
2. **Memory Manager** (`src/memory-manager.ts`): Manages ChromaDB operations and memory logic
3. **Configuration** (`src/config.ts`): Environment-based configuration with Docker support
4. **Obsidian Manager** (`src/obsidian-manager.ts`): Vault integration and note operations
5. **Session Logger** (`src/session-logger.ts`): Development session capture
6. **Vault Index Service** (`src/services/vault-index-service.ts`): Real-time vault statistics and health monitoring
7. **Memory Health Monitor** (`src/services/memory-health-monitor.ts`): Memory system diagnostics and optimization

### Planned Platform Components

1. **Vault Manager** (`src/vault-manager.ts`): Multi-project vault management
2. **State Manager** (`src/state-manager.ts`): Context capture and restoration
3. **Hierarchical Memory Manager** (`src/memory-manager-v2.ts`): Three-tier memory system
4. **Pattern Service** (`src/services/pattern-service.ts`): Pattern recognition and learning
5. **Migration Service** (`src/services/migration-service.ts`): Automatic tier management

### Memory System Features

- **Autonomous Storage**: Memories are stored only if they exceed an importance threshold
- **Multi-factor Retrieval**: Combines semantic similarity (40%), recency (30%), importance (20%), and frequency (10%)
- **Context-aware Filtering**: Supports different contexts (general, user_preference, task_critical, obsidian_note)
- **Vector Search**: Uses ChromaDB with OpenAI embeddings for semantic search
- **Access Tracking**: Monitors memory access patterns for optimization
- **Batch Operations**: Supports bulk memory operations for efficiency

### Future Memory Enhancements (Hybrid Variable Tracking)

The platform roadmap includes advanced memory features:
- **Exact Search**: Precise string matching for variables and functions
- **Token Optimization**: Context compression for efficient AI consumption
- **Tiered Storage**: Hot/warm/cold memory tiers based on access patterns
- **Incremental Updates**: Track only changed content for performance

## Development Commands

### Build and Run

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Test with MCP Inspector
npm run inspect
```

### Docker Operations

```bash
# Build Docker image
npm run docker:build

# Run in Docker
npm run docker:run
```

### Starting ChromaDB

From the project directory:
```bash
docker-compose up -d chromadb
```

## Testing

When testing the memory server:

1. Ensure ChromaDB is running and accessible at http://localhost:8000
2. Set the OPENAI_API_KEY environment variable
3. Use the MCP Inspector to test tools:
   - `health_check`: Verify server status
   - `store_memory`: Store memories with context
   - `recall_memories`: Retrieve relevant memories

## Important Notes

- The server uses Windows-compatible paths and handles CRLF line endings
- Docker mode is automatically detected via DOCKER_CONTAINER environment variable
- Memory importance assessment uses heuristics but can be enhanced with LLM integration
- The system retries ChromaDB connection 5 times with 2-second delays for Docker startup
- MCP servers exit when no client is connected (this is normal behavior)
- The server requires OpenAI API key for generating embeddings

## Claude Desktop Setup

The MCP server is configured in `%APPDATA%\Claude\claude_desktop_config.json` on Windows.
See CLAUDE_DESKTOP_SETUP.md for detailed configuration instructions.

## Additional Documentation

For setup guides and detailed documentation, see:
- **Setup Guides**: `Project_Context/vault/Knowledge/Setup/`
- **Architecture Decisions**: `Project_Context/vault/Architecture/`
- **Historical Documents**: `Project_Context/vault/Archive/`
- **Session Logs**: `Project_Context/vault/Sessions/`