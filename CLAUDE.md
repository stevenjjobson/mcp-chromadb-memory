# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-driven MCP (Model Context Protocol) server that provides smart memory management using ChromaDB for semantic search and storage. The server enables AI assistants to autonomously store and retrieve memories based on importance assessment and multi-factor relevance scoring.

## Session Logging Instructions

**IMPORTANT**: This project has session logging capabilities that allow tracking development conversations in Obsidian.

### Automatic Session Logging
If the environment variable `AUTO_START_SESSION_LOGGING=true` is set, session logging will start automatically when the MCP server initializes. Otherwise, you should:

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

## Architecture

### Core Components

1. **MCP Server** (`src/index.ts`): Handles stdio communication and tool endpoints
2. **Memory Manager** (`src/memory-manager.ts`): Manages ChromaDB operations and memory logic
3. **Configuration** (`src/config.ts`): Environment-based configuration with Docker support

### Memory System Features

- **Autonomous Storage**: Memories are stored only if they exceed an importance threshold
- **Multi-factor Retrieval**: Combines semantic similarity (40%), recency (30%), importance (20%), and frequency (10%)
- **Context-aware Filtering**: Supports different contexts (general, user_preference, task_critical, obsidian_note)

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

# Run in Docker (requires aoe-mcp-personal network)
npm run docker:run
```

### Starting ChromaDB

From the `aoe-mcp-personal` directory:
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