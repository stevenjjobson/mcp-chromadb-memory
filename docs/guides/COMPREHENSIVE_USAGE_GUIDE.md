# 🚀 Comprehensive Usage Guide - MCP ChromaDB Memory Platform

This guide provides clear, practical instructions for using the CoachNTT Cognitive Platform with both Claude Code and Claude Desktop. All paths and commands are clearly marked as **[WSL]** or **[Windows]**.

---

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [Claude Code Setup & Usage](#claude-code-setup--usage)
3. [Claude Desktop Setup & Usage](#claude-desktop-setup--usage)
4. [Key Features & How to Use Them](#key-features--how-to-use-them)
5. [Advanced Usage Patterns](#advanced-usage-patterns)
6. [Troubleshooting](#troubleshooting)
7. [Performance Tips](#performance-tips)

---

## 🎯 Quick Reference

### Essential Commands

**Start Services** (Run in either WSL or Windows):
```bash
# [WSL] From project directory
cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory
docker-compose up -d coachntt-chromadb coachntt-postgres

# [Windows PowerShell] From project directory
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
docker-compose up -d coachntt-chromadb coachntt-postgres
```

**Check Service Health**:
```bash
# [Both WSL/Windows]
docker-compose ps
docker logs coachntt-postgres
docker logs coachntt-chromadb
```

### Key Paths

| Component | Windows Path | WSL Path |
|-----------|-------------|----------|
| Project Root | `C:\Users\Steve\Dockers\mcp-chromadb-memory` | `/mnt/c/Users/Steve/Dockers/mcp-chromadb-memory` |
| Vault | `C:\Users\Steve\Dockers\mcp-chromadb-memory\vault` | `/mnt/c/Users/Steve/Dockers/mcp-chromadb-memory/vault` |
| Config | `%APPDATA%\Claude\claude_desktop_config.json` | N/A (Windows only) |
| MCP Config | `.mcp.json` in project root | `.mcp.json` in project root |

---

## 🖥️ Claude Code Setup & Usage

### Initial Setup

1. **Navigate to Project** [WSL Recommended]:
   ```bash
   # [WSL]
   cd /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory
   ```

2. **Start Required Services**:
   ```bash
   # [WSL or Windows]
   docker-compose up -d coachntt-chromadb coachntt-postgres
   ```

3. **Launch Claude Code**:
   ```bash
   # [WSL] - This automatically uses .mcp.json
   claude
   
   # [Windows CMD/PowerShell] - From project directory
   claude
   ```

4. **First Time Setup**:
   - Claude Code will detect `.mcp.json` and prompt: "This folder has MCP servers configured. Would you like to use them?"
   - Select **Yes** to enable the memory server

### Using Memory Features in Claude Code

#### Store Important Information
```
"Remember that the PostgreSQL connection uses coachntt_user with password coachntt_pass"
"Store this code pattern: always use hybrid storage for performance"
```

#### Recall Information
```
"What do you remember about PostgreSQL configuration?"
"Show me stored code patterns"
"What decisions have we made about the architecture?"
```

#### Session Logging (Automatic)
- Sessions automatically log to: `vault/Sessions/YYYY-MM-DD.md`
- No action needed - it's automatic with `AUTO_START_SESSION_LOGGING=true`

#### Code Intelligence
```
"Index the current codebase"
"Find all functions that handle memory storage"
"Show me the symbol relationships for HybridMemoryManager"
"What code patterns exist in the memory system?"
```

### Advanced Claude Code Commands

#### Vault Management
```
"List all available vaults"
"Backup the current vault"
"Switch to project vault"
```

#### State Management
```
"Capture the current development state"
"List saved states"
"Restore state from yesterday"
```

#### Memory Analysis
```
"Analyze memory access patterns"
"Show memory tier statistics"
"What memories should be migrated?"
```

---

## 🖼️ Claude Desktop Setup & Usage

### Configuration File Location

**[Windows Only]**: `%APPDATA%\Claude\claude_desktop_config.json`

Full path: `C:\Users\Steve\AppData\Roaming\Claude\claude_desktop_config.json`

### Basic Configuration

1. **Edit Configuration File** [Windows]:
   ```powershell
   # [Windows PowerShell]
   notepad $env:APPDATA\Claude\claude_desktop_config.json
   ```

2. **Add MCP Server Configuration**:
   ```json
   {
     "mcpServers": {
       "CoachNTT.ai": {
         "command": "docker",
         "args": [
           "run",
           "-i",
           "--rm",
           "--network", "mcp-chromadb-memory_coachntt-platform-network",
           "-v", "C:/Users/Steve/Dockers/mcp-chromadb-memory/vault:/vault:rw",
           "-e", "OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE",
           "-e", "DOCKER_CONTAINER=true",
           "-e", "CHROMA_HOST=coachntt-chromadb",
           "-e", "CHROMA_PORT=8000",
           "-e", "POSTGRES_HOST=coachntt-postgres",
           "-e", "POSTGRES_PORT=5432",
           "-e", "POSTGRES_DATABASE=coachntt_cognitive_db",
           "-e", "POSTGRES_USER=coachntt_user",
           "-e", "POSTGRES_PASSWORD=coachntt_pass",
           "-e", "USE_HYBRID_STORAGE=true",
           "-e", "TIER_ENABLED=true",
           "-e", "AUTO_START_SESSION_LOGGING=true",
           "-e", "SESSION_LOGGING_PROJECT_NAME=CoachNTT Cognitive Platform",
           "-e", "OBSIDIAN_VAULT_PATH=/vault",
           "-e", "CODE_INDEXING_ENABLED=true",
           "mcp-chromadb-memory-mcp-memory"
         ]
       }
     }
   }
   ```

3. **Start Services** [Windows PowerShell]:
   ```powershell
   cd C:\Users\Steve\Dockers\mcp-chromadb-memory
   docker-compose up -d coachntt-chromadb coachntt-postgres
   ```

4. **Restart Claude Desktop**:
   - Close Claude Desktop completely
   - Reopen Claude Desktop
   - Look for "CoachNTT.ai" in the MCP server list (bottom of sidebar)

### Verifying Connection

In Claude Desktop, type:
```
Can you check your MCP connection status?
```

You should see "CoachNTT.ai" listed as connected.

---

## 🔧 Key Features & How to Use Them

### 1. Hierarchical Memory System

**Working Memory** (0-48 hours)
- Stores immediate context
- Fastest retrieval
- Example: "Remember this bug fix approach for later today"

**Session Memory** (2-14 days)
- Recent development sessions
- Example: "What did we discuss about authentication last week?"

**Long-term Memory** (14+ days)
- Permanent knowledge
- Example: "Store this as a best practice for our project"

### 2. Code Intelligence Features

**Index Your Codebase**:
```
"Index all TypeScript files in the src directory"
"Update the code symbol index"
```

**Search for Symbols**:
```
"Find the definition of HybridMemoryManager"
"Show all functions that call storeMemory"
"What files import the config module?"
```

**Analyze Patterns**:
```
"What code patterns exist in our error handling?"
"Find similar implementations to this function"
```

### 3. Session Logging

**Automatic Logging**:
- Every conversation is logged to `vault/Sessions/YYYY-MM-DD.md`
- Includes timestamps, messages, and tool usage

**Review Sessions**:
```
"Show me yesterday's session log"
"What did we work on this week?"
```

### 4. Vault Management

**Project Vault** [Default]:
- Location: `./vault` (relative to project)
- Contains project-specific knowledge

**Switch Vaults**:
```
"List available vaults"
"Switch to the documentation vault"
"Create a backup of the current vault"
```

### 5. State Capture & Restore

**Save Development State**:
```
"Capture the current state as 'refactoring-auth-v2'"
"Save our current context before switching tasks"
```

**Restore Previous State**:
```
"List available saved states"
"Restore the state from 'refactoring-auth-v2'"
"Show me what changed since the last state capture"
```

---

## 🚀 Advanced Usage Patterns

### 1. Development Workflow Pattern

```
Morning:
1. "Show me a summary of yesterday's work"
2. "What tasks are still pending?"
3. "Restore yesterday's final state"

During Development:
- "Remember this approach for handling errors"
- "Store this SQL query pattern"
- "Index the changes I just made"

End of Day:
- "Capture state as 'eod-2025-01-11'"
- "Summarize today's progress"
- Session auto-saves on exit
```

### 2. Code Review Pattern

```
"Index the pull request files"
"Find all similar patterns in our codebase"
"Remember this review feedback for future PRs"
"What are our code review best practices?"
```

### 3. Debugging Pattern

```
"Store this error message and stack trace"
"What similar errors have we encountered?"
"Remember the solution: [explanation]"
"Find all code that could cause this error"
```

### 4. Knowledge Building Pattern

```
"Store this as a best practice for API design"
"What design patterns have we established?"
"Create a memory about PostgreSQL optimization"
"Show me all stored architectural decisions"
```

---

## 🔍 Troubleshooting

### Claude Code Issues

**MCP Server Not Detected**:
```bash
# [WSL] Ensure you're in the project directory
pwd  # Should show: /mnt/c/Users/Steve/Dockers/mcp-chromadb-memory

# Check .mcp.json exists
ls -la .mcp.json
```

**Connection Errors**:
```bash
# [WSL or Windows] Check services
docker-compose ps
docker logs coachntt-postgres
docker logs coachntt-chromadb
```

### Claude Desktop Issues

**Server Shows as Disconnected**:
1. Check Docker services are running
2. Verify network name matches: `mcp-chromadb-memory_coachntt-platform-network`
3. Ensure OpenAI API key is set correctly
4. Check Docker logs: `docker logs $(docker ps -q --filter "ancestor=mcp-chromadb-memory-mcp-memory")`

**Path Issues**:
- Windows paths in config must use forward slashes: `C:/Users/Steve/...`
- Volume mounts are case-sensitive

---

## ⚡ Performance Tips

### 1. Optimize Memory Queries
```
# Be specific with context
"Recall memories about authentication in the user service"  # ✅ Good
"What do you remember?"  # ❌ Too broad
```

### 2. Use Exact Search for Known Content
```
"Search for exact match: 'PostgreSQL connection pool'"
"Find memories containing 'HybridMemoryManager' exactly"
```

### 3. Batch Operations
```
"Index all files that changed in the last commit"
"Store these 5 related concepts together: [list]"
```

### 4. Regular Maintenance
```
Weekly:
- "Analyze memory access patterns"
- "Show memories that should be migrated"
- "Backup the vault"

Monthly:
- "Show memory statistics and fragmentation"
- "Find duplicate or similar memories"
```

---

## 🎯 Realizing Full Potential

### 1. Build Your Second Brain
- Store every significant learning
- Capture all architectural decisions
- Remember debugging solutions
- Build a searchable knowledge base

### 2. Leverage Code Intelligence
- Index your codebase regularly
- Use natural language to find code
- Discover patterns you didn't know existed
- 60x faster than traditional search

### 3. Maintain Continuity
- Never lose context between sessions
- Pick up exactly where you left off
- Share knowledge across projects
- Build on past experiences

### 4. Enhance Productivity
- Instant recall of past solutions
- No more searching through chat history
- Automated session documentation
- Smart context switching

### 5. Team Knowledge (Future)
- Share memories across team
- Collective intelligence
- Onboard new developers faster
- Preserve institutional knowledge

---

## 📝 Quick Command Reference

| Action | Command |
|--------|---------|
| Store Memory | "Remember that..." / "Store this..." |
| Recall Memory | "What do you remember about..." |
| Index Code | "Index the codebase" |
| Find Symbol | "Find function/class X" |
| Capture State | "Capture current state as X" |
| Restore State | "Restore state X" |
| View Stats | "Show memory statistics" |
| Analyze Patterns | "Analyze access patterns" |
| Backup Vault | "Backup the current vault" |
| Session Log | "Show today's session" |

---

## 🔗 Additional Resources

- [Architecture Documentation](../architecture/README.md)
- [API Reference](../api/README.md)
- [Development Roadmap](../../vault/Planning/roadmaps/Implementation%20Roadmap.md)
- [Troubleshooting Guide](./mcp-configuration-guide.md)

---

*Remember: The platform is always learning from your interactions. The more you use it, the more valuable it becomes as your personal cognitive assistant.*