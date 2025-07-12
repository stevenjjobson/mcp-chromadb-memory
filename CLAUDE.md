# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cognitive State Management Platform** built as an MCP (Model Context Protocol) server. It provides intelligent memory management using ChromaDB for semantic search and storage, with sophisticated features for preserving development context across sessions, projects, and teams.

The platform is designed to:
- Maintain persistent context across development sessions
- Learn from development patterns and decisions
- Provide multi-project support with instant context switching
- Enable team knowledge sharing and collaboration

See [Platform Approach](./vault/Architecture/Platform%20Approach%20-%20Cognitive%20State%20Management.md) for the complete vision.

## Startup Procedure

When you connect to this MCP server, the following happens automatically:

### 1. System Health Check
The platform performs a comprehensive health check on startup:
- PostgreSQL connection status and schema verification
- ChromaDB connection status (for hybrid operations)
- Memory collections availability in both databases
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
The system automatically generates/updates `vault/VAULT_INDEX.md` which contains:
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
2. **View the Vault Index** at `vault/VAULT_INDEX.md` for detailed information
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
**Status**: Phase 3 COMPLETE - PostgreSQL Integration & Code Intelligence Operational

See [Implementation Roadmap](./vault/Planning/roadmaps/Implementation%20Roadmap.md) for the 20-day transformation plan.
See [Code Intelligence Guide](./docs/guides/code-intelligence.md) for code-aware features.

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
5. **Code Intelligence** (Implemented): PostgreSQL-powered for blazing fast performance
   - Automatic codebase indexing (644 symbols/second, 60x faster)
   - Stream-based symbol search with no throttling
   - Code pattern detection and analysis
   - Natural language to code queries
   - Bulk operations complete in <1s (vs 60s+ with ChromaDB alone)
6. **Pattern Recognition** (In Progress): Learning from development patterns
7. **Background Services** (Upcoming): Automatic optimization and maintenance
8. **Multi-Vault Support** (In Development): Dual vault architecture for core knowledge + project contexts

## Multi-Vault Architecture (New Feature)

The platform now supports a powerful dual-vault architecture that enables:

### Core Knowledge Vault
Your personal "second brain" that persists across all projects:
- **What it stores**: Programming patterns, best practices, personal preferences, cross-project learnings
- **Always accessible**: Available in every project you work on
- **Grows over time**: Accumulates wisdom from every project
- **Example**: "I always use environment variables for configuration"

### Project Vaults
Project-specific context that switches with your active work:
- **What it stores**: Project decisions, code context, local configurations, session logs
- **Isolated**: Each project has its own vault
- **Switchable**: Change projects and context switches automatically
- **Example**: "This project uses PostgreSQL with pgvector for search"

### How They Work Together
When you're working on a project, you have access to BOTH vaults:
```
Query: "How should I implement authentication?"
- Core Vault: Provides your preferred auth patterns from past projects
- Project Vault: Shows this project's specific auth implementation
- Combined: Intelligent response using both contexts
```

### Benefits
1. **No repeated learning**: Solve a problem once, have the solution forever
2. **Project isolation**: Client A's code never leaks to Client B
3. **Compound knowledge**: Each project makes you better at the next
4. **Instant context**: Switch projects and immediately have full context

### Configuration
See `docs/architecture/MULTI_VAULT_DESIGN.md` for implementation details.

## Architecture

### Current Components

1. **MCP Server** (`src/index.ts`): Handles stdio communication and tool endpoints
2. **Hybrid Memory Manager** (`src/hybrid-memory-manager.ts`): PostgreSQL + ChromaDB operations
3. **PostgreSQL Client** (`src/db/postgres-client.ts`): Connection pooling and query management
4. **Memory Repository** (`src/db/memory-repository.ts`): Data access layer for memories
5. **Symbol Repository** (`src/db/symbol-repository.ts`): Bulk code symbol operations
6. **Enhanced Memory Manager** (`src/memory-manager-enhanced.ts`): Tier support and streaming
7. **Configuration** (`src/config.ts`): Environment-based configuration with Docker support
8. **Obsidian Manager** (`src/obsidian-manager.ts`): Vault integration and note operations
9. **Session Logger** (`src/session-logger.ts`): Development session capture
10. **Vault Index Service** (`src/services/vault-index-service.ts`): Real-time vault statistics and health monitoring
11. **Memory Health Monitor** (`src/services/memory-health-monitor.ts`): Memory system diagnostics and optimization

### Code Intelligence Components (Operational)

1. **Code Indexer** (`src/services/code-indexer.ts`): Symbol extraction and bulk indexing (644 symbols/second)
2. **Code Pattern Detector** (`src/services/code-pattern-detector.ts`): Pattern recognition in code
3. **Streaming Manager** (`src/services/streaming-manager.ts`): Fast incremental responses
4. **Symbol Relationship Mapper** (`src/services/symbol-mapper.ts`): Track code relationships
5. **Hybrid Search Service** (`src/services/hybrid-search-service.ts`): Unified search across PostgreSQL and ChromaDB

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

# For development with CoachNTT features
docker-compose -f docker-compose.yml -f docker-compose.coachntt.yml up -d  # Start dev environment
docker-compose -f docker-compose.yml -f docker-compose.coachntt.yml down   # Stop dev environment
docker-compose ps                                                          # Check status
```

### Starting Required Services

From the project directory:
```bash
# For production (Claude Desktop) - Both services required
docker-compose up -d coachntt-chromadb coachntt-postgres

# For development testing with CoachNTT features
docker-compose -f docker-compose.yml -f docker-compose.coachntt.yml up -d
```

**Important**: PostgreSQL is now required alongside ChromaDB for the hybrid storage architecture. The system will not function without both databases running.

## Testing

When testing the memory server:

1. Ensure both ChromaDB and PostgreSQL are running:
   - ChromaDB: http://localhost:8000
   - PostgreSQL: localhost:5432
2. Set the OPENAI_API_KEY environment variable
3. Use the MCP Inspector to test tools:
   - `health_check`: Verify server status
   - `store_memory`: Store memories with context
   - `recall_memories`: Retrieve relevant memories

## Important Notes

- The server uses Windows-compatible paths and handles CRLF line endings
- Docker mode is automatically detected via DOCKER_CONTAINER environment variable
- Memory importance assessment uses heuristics but can be enhanced with LLM integration
- The system retries database connections 5 times with 2-second delays for Docker startup
- MCP servers exit when no client is connected (this is normal behavior)
- The server requires OpenAI API key for generating embeddings
- **PostgreSQL is now required**: The hybrid storage architecture requires both PostgreSQL and ChromaDB
- **Performance**: Bulk operations are 60x faster with PostgreSQL handling structured data

## Claude Desktop Setup

The MCP server is configured in `%APPDATA%\Claude\claude_desktop_config.json` on Windows.
See [Claude Desktop Config Guide](./docs/guides/claude-desktop-config.md) for detailed configuration instructions.

## Claude Code CLI Setup

Claude Code CLI uses a different configuration method than Claude Desktop:

1. **Quick Setup**: Run the setup script
   ```bash
   ./scripts/setup-claude-code-mcp.sh
   ```

2. **Manual Setup**: Use the included `.mcp.json` file
   - The project includes `.mcp.json` with both Docker and local configurations
   - Claude Code will automatically detect it when you run `claude` from the project directory
   - You'll be prompted to approve it on first use

3. **Custom Setup**: Configure manually
   ```bash
   # Docker setup
   claude mcp add memory docker run -i --rm \
     --network mcp-chromadb-memory_memory-network \
     -e OPENAI_API_KEY=$OPENAI_API_KEY \
     mcp-chromadb-memory-mcp-memory

   # Local setup
   claude mcp add memory-local node dist/index.js \
     -e OPENAI_API_KEY=$OPENAI_API_KEY
   ```

See [Claude Code vs Desktop Config](./docs/guides/claude-code-vs-desktop-config.md) for complete details on the differences between Claude Desktop and Claude Code configurations.

## Code Intelligence Configuration

Code intelligence features are now operational with PostgreSQL backend:

```env
# Code Intelligence (PRODUCTION ready)
CODE_INDEXING_ENABLED=true
CODE_INDEXING_PATTERNS="**/*.{js,ts,py,java,go,rs,cpp}"
CODE_INDEXING_EXCLUDE="**/node_modules/**,**/dist/**,**/.git/**"
CODE_PATTERN_DETECTION=true
CODE_STREAMING_ENABLED=true
CODE_CACHE_SIZE=1000
CODE_SYMBOL_CONTEXT_LINES=15

# Hybrid Storage (Required)
USE_HYBRID_STORAGE=true
ENABLE_DUAL_WRITE=true
POSTGRES_READ_RATIO=0.5  # 50/50 split for gradual migration
```

**Performance**: Code indexing now runs at 1700+ symbols/second with no throttling, thanks to PostgreSQL bulk operations.

## CoachNTT Implementation

**CoachNTT** is a specialized implementation of this platform focused on conversational AI with voice capabilities:

- **Location**: `CoachNTT/` directory with separated MCP server and VSCode extension
- **Features**: 
  - Audio synthesis via ElevenLabs API (server-side)
  - Rich VSCode extension with audio playback controls
  - Conversation-aware memory scoring
  - Comprehensive UI based on ASCII wireframe contracts
- **Architecture**:
  - `CoachNTT/mcp-server/` - Backend MCP service with audio synthesis
  - `CoachNTT/vscode-extension/` - Frontend UI with audio playback
  - `CoachNTT/shared/` - Shared TypeScript types
- **Audio Tools**:
  - `synthesize_audio` - Convert text to speech with configurable voices
  - `get_available_voices` - List ElevenLabs voices
  - `check_audio_quota` - Monitor API usage

See [CoachNTT Documentation](./CoachNTT/README.md) for complete details.

## Document Storage Guidelines

When creating or saving documents in this project, follow these guidelines:

### Quick Storage Rules
- **Development work** → `vault/Development/`
- **Technical designs** → `vault/Architecture/`
- **How-to guides** → `vault/Knowledge/`
- **Future plans** → `vault/Planning/`
- **External docs** → `vault/References/`
- **Old documents** → `vault/Archive/`

### For Claude: Where to Save Documents
When creating new documents, determine the type and save accordingly:
1. Implementation summaries, refactoring notes → `Development/`
2. System design, technical specs → `Architecture/`
3. Guides, best practices, learned knowledge → `Knowledge/`
4. Roadmaps, feature plans → `Planning/roadmaps/`
5. API docs, external references → `References/`

**See the complete guide**: `vault/Knowledge/DOCUMENT_STORAGE_GUIDE.md`

## Hook Scripts for Optimized Tool Usage

This project includes intelligent hook scripts that optimize your tool usage:
- **Code searches**: Automatically suggests `find_symbol` instead of `Grep` for 98% faster searches
- **File searches**: Suggests `index_codebase` for code files, reducing tokens by 94%

The hooks are configured in your Claude Code environment and work automatically. See [Hook Scripts Guide](./docs/guides/hook-scripts.md) for details.

## Additional Documentation

For setup guides and detailed documentation, see:
- **Hook Scripts Guide**: `docs/guides/hook-scripts.md` - Smart tool optimization with 94% token reduction
- **Code Intelligence Guide**: `docs/guides/code-intelligence.md` - Using code-aware features
- **Memory Usage Guide**: `docs/guides/memory-usage.md` - How to effectively use the memory system
- **Dual Instance Setup**: `vault/Development/DUAL_INSTANCE_SETUP.md` - Development environment isolation
- **Development Status**: `docs/roadmap/current-status.md` - Current progress and next steps
- **Setup Guides**: `vault/Knowledge/Setup/`
- **Architecture Decisions**: `vault/Architecture/decisions/`
- **Historical Documents**: `vault/Archive/`
- **Session Logs**: `vault/Sessions/`

## Memory: README and Documentation Maintenance

### General README Maintenance Rules
When editing, adding, or removing files in any folder that contains a README.md file, always:

1. **Read First**: Read the README.md to understand the folder's purpose and documented rules
2. **Update After Changes**: After modifying files in that folder, check if the README needs updating:
   - Update file lists if files were added/removed
   - Update descriptions if functionality changed
   - Update examples if they reference modified files
   - Update configuration instructions if settings changed
   - Maintain the existing format and style
3. **Preserve Important Content**: Keep all security notices, warnings, or important notes
4. **Update References**: If files were renamed/removed, update all references to them

### Project-Specific Rules for MCP ChromaDB Memory / CoachNTT Platform
- **Branding Consistency**: Always use CoachNTT branding in examples:
  - Services: `coachntt-postgres`, `coachntt-chromadb`
  - Database: `coachntt_cognitive_db`
  - Network: `mcp-chromadb-memory_coachntt-platform-network`
- **Environment**: Remove any references to DEVELOPMENT environment (only PRODUCTION exists now)
- **Paths**: Use placeholders like `YOUR_PATH_HERE` or `/path/to/your/vault` instead of hardcoded paths
- **API Keys**: Always use placeholders like `YOUR_OPENAI_API_KEY_HERE`
- **CoachNTT Updates**: When updating the CoachNTT implementation specifically, always update `CoachNTT/README.md`

This ensures documentation stays synchronized with actual folder contents and maintains consistency across the project.

## Documentation File Placement Rules
When creating documentation files or scripts, ALWAYS follow these placement rules:

1. **Never place documentation in the root folder** - The root should only contain essential project files (README.md, CONTRIBUTING.md, CLAUDE.md, etc.)
2. **Use existing folder structures**:
   - `/docs/` - Technical documentation, API docs, guides, architecture docs
   - `/vault/` - Project knowledge, development logs, planning docs, references
   - `/scripts/` - Utility scripts, setup scripts, operational tools
3. **If unsure, ask the user** where to place the file rather than defaulting to root
4. **Check for existing similar files** to determine the appropriate location
5. **Test files** should go in `/tests/` or appropriate subdirectories

Examples:
- Architecture documentation → `/docs/architecture/` or `/vault/Architecture/`
- Development logs → `/vault/Development/`
- Test reports → `/docs/testing/` or `/vault/Development/`
- Utility scripts → `/scripts/utilities/`
- Setup guides → `/docs/guides/` or `/vault/Knowledge/Setup/`