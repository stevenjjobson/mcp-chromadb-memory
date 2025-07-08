# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cognitive State Management Platform** built as an MCP (Model Context Protocol) server. It provides intelligent memory management using ChromaDB for semantic search and storage, with sophisticated features for preserving development context across sessions, projects, and teams.

The platform is designed to:
- Maintain persistent context across development sessions
- Learn from development patterns and decisions
- Provide multi-project support with instant context switching
- Enable team knowledge sharing and collaboration

See [Platform Approach](./Project_Context/Architecture/Platform%20Approach%20-%20Cognitive%20State%20Management.md) for the complete vision.

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
The system automatically generates/updates `Project_Context/VAULT_INDEX.md` which contains:
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

**Current Version**: 2.1 (Cognitive State Management Platform with Code Intelligence)
**Status**: Phase 3 In Progress - Code Intelligence Integration Active

See [Implementation Roadmap](./Project_Context/Implementation%20Roadmap.md) for the 20-day transformation plan.
See [Development Status](./DEVELOPMENT_STATUS.md) for detailed progress.
See [Code Intelligence Guide](./CODE_INTELLIGENCE_GUIDE.md) for code-aware features.

### Key Platform Features
1. **Vault Management** (Implemented): Multi-project support with hot-swapping
   - Register multiple vaults for different projects
   - Switch between vaults instantly
   - Backup and restore vault contents
   - Full registry persistence
2. **State Capture** (Implemented): Complete context preservation and restoration
   - Capture working context and memory state
   - Restore previous states on demand
   - Compare states with diff functionality
   - Automatic cleanup and expiration
3. **Enhanced Memory System** (Implemented): Advanced search and optimization
   - Exact string matching with O(1) lookup
   - Hybrid search combining exact and semantic
   - Token compression (50-90% reduction)
   - Access pattern tracking
4. **Hierarchical Memory System** (Implemented): Three-tier architecture for optimal performance
   - Working tier (48h) for immediate context
   - Session tier (14d) for recent development
   - Long-term tier (permanent) for critical knowledge
   - Automatic migration between tiers
5. **Code Intelligence** (In Progress): Claude Code optimized features
   - Automatic codebase indexing with symbol tracking
   - Stream-based symbol search for instant results
   - Code pattern detection and analysis
   - Natural language to code queries
6. **Pattern Recognition** (In Progress): Learning from development patterns
7. **Background Services** (Upcoming): Automatic optimization and maintenance

## Architecture

### Current Components

1. **MCP Server** (`src/index.ts`): Handles stdio communication and tool endpoints
2. **Memory Manager** (`src/memory-manager.ts`): Manages ChromaDB operations and memory logic
3. **Enhanced Memory Manager** (`src/memory-manager-enhanced.ts`): Tier support and streaming
4. **Configuration** (`src/config.ts`): Environment-based configuration with Docker support
5. **Obsidian Manager** (`src/obsidian-manager.ts`): Vault integration and note operations
6. **Session Logger** (`src/session-logger.ts`): Development session capture
7. **Vault Index Service** (`src/services/vault-index-service.ts`): Real-time vault statistics and health monitoring
8. **Memory Health Monitor** (`src/services/memory-health-monitor.ts`): Memory system diagnostics and optimization

### Code Intelligence Components (In Development)

1. **Code Indexer** (`src/services/code-indexer.ts`): Symbol extraction and indexing
2. **Code Pattern Detector** (`src/services/code-pattern-detector.ts`): Pattern recognition in code
3. **Streaming Manager** (`src/services/streaming-manager.ts`): Fast incremental responses
4. **Symbol Relationship Mapper** (`src/services/symbol-mapper.ts`): Track code relationships

### Implemented Platform Components

1. **Vault Manager** (`src/vault-manager.ts`): Multi-project vault management
2. **State Manager** (`src/state-manager.ts`): Context capture and restoration
3. **Migration Service** (`src/services/migration-service.ts`): Automatic tier management
4. **Pattern Service** (`src/services/memory-pattern-service.ts`): Basic pattern recognition

### Memory System Features

**Core Capabilities:**
- **Autonomous Storage**: Memories are stored only if they exceed an importance threshold
- **Multi-factor Retrieval**: Combines semantic similarity (40%), recency (30%), importance (20%), and frequency (10%)
- **Context-aware Filtering**: Supports different contexts (general, user_preference, task_critical, obsidian_note)
- **Vector Search**: Uses ChromaDB with OpenAI embeddings for semantic search

**Enhanced Features (Implemented):**
- **Exact Search**: Fast string matching with keyword indexing for precise lookups
- **Hybrid Search**: Combines exact and semantic search with configurable weights (default 40% exact, 60% semantic)
- **Token Optimization**: Smart compression achieving 50-90% reduction while preserving important content
- **Access Pattern Tracking**: Advanced analytics with hot/warm/cold tier recommendations
- **Compressed Context**: Token-aware memory retrieval optimized for AI consumption

### Memory Tools Available

**Standard Tools:**
- `store_memory` - Store information with AI-assessed importance
- `recall_memories` - Semantic search for relevant memories
- `delete_memory` - Remove specific memory
- `clear_all_memories` - Clear entire memory collection
- `get_memory_stats` - Get memory statistics

**Enhanced Tools:**
- `search_exact` - Exact string matching in memory content or metadata fields
- `search_hybrid` - Combined exact and semantic search with weight control
- `get_compressed_context` - Get token-optimized context from relevant memories
- `get_optimized_memory` - Optimize a single memory for AI consumption
- `analyze_access_patterns` - Get memory tier analysis and recommendations

**Vault Management Tools:**
- `register_vault` - Register a new vault for multi-project support
- `switch_vault` - Switch to a different vault instantly
- `list_vaults` - List all registered vaults
- `backup_vault` - Create a backup of current or specified vault
- `restore_vault` - Restore a vault from backup

**State Management Tools:**
- `capture_state` - Capture current working context and memory state
- `restore_state` - Restore a previously captured state
- `list_states` - List available captured states
- `diff_states` - Compare two captured states

**Tier Management Tools:**
- `get_tier_stats` - View memory distribution and statistics across all tiers
- `analyze_access_patterns` - Get tier recommendations based on memory usage
- `get_memories_for_migration` - Preview memories pending tier migration

**Code Intelligence Tools (In Development):**
- `index_codebase` - Fast symbol extraction and storage with streaming support
- `find_symbol` - Stream-based symbol search across your codebase
- `get_symbol_context` - Rich context retrieval including imports, usage, and relationships
- `analyze_code_patterns` - Detect patterns, anti-patterns, and improvement opportunities
- `search_code_natural` - Natural language queries to find code implementations

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

# For dual-instance development
./scripts/environment/env-manager.sh start-dev  # Start development environment
./scripts/environment/env-manager.sh stop-dev   # Stop development environment
./scripts/environment/env-manager.sh status     # Check status of both environments
```

### Starting ChromaDB

From the project directory:
```bash
# For production (Claude Desktop)
docker-compose up -d chromadb

# For development testing
./scripts/environment/env-manager.sh start-dev
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

## Code Intelligence Configuration

When code intelligence features are enabled, add these to your environment:

```env
# Code Intelligence (DEVELOPMENT testing)
CODE_INDEXING_ENABLED=true
CODE_INDEXING_PATTERNS="**/*.{js,ts,py,java,go,rs,cpp}"
CODE_INDEXING_EXCLUDE="**/node_modules/**,**/dist/**,**/.git/**"
CODE_PATTERN_DETECTION=true
CODE_STREAMING_ENABLED=true
CODE_CACHE_SIZE=1000
CODE_SYMBOL_CONTEXT_LINES=15
```

**Note**: Code intelligence features are currently in development and should be tested in the DEVELOPMENT environment first.

## Document Storage Guidelines

When creating or saving documents in this project, follow these guidelines:

### Quick Storage Rules
- **Development work** → `Project_Context/Development/`
- **Technical designs** → `Project_Context/Architecture/`
- **How-to guides** → `Project_Context/Knowledge/`
- **Future plans** → `Project_Context/Planning/`
- **External docs** → `Project_Context/References/`
- **Old documents** → `Project_Context/Archive/`

### For Claude: Where to Save Documents
When creating new documents, determine the type and save accordingly:
1. Implementation summaries, refactoring notes → `Development/`
2. System design, technical specs → `Architecture/`
3. Guides, best practices, learned knowledge → `Knowledge/`
4. Roadmaps, feature plans → `Planning/roadmaps/`
5. API docs, external references → `References/`

**See the complete guide**: `Project_Context/Knowledge/DOCUMENT_STORAGE_GUIDE.md`

## Additional Documentation

For setup guides and detailed documentation, see:
- **Code Intelligence Guide**: `docs/guides/code-intelligence.md` - Using code-aware features
- **Memory Usage Guide**: `docs/guides/memory-usage.md` - How to effectively use the memory system
- **Dual Instance Setup**: `Project_Context/Development/DUAL_INSTANCE_SETUP.md` - Development environment isolation
- **Development Status**: `docs/roadmap/current-status.md` - Current progress and next steps
- **Setup Guides**: `Project_Context/Knowledge/Setup/`
- **Architecture Decisions**: `Project_Context/Architecture/decisions/`
- **Historical Documents**: `Project_Context/Archive/`
- **Session Logs**: `Project_Context/Sessions/`