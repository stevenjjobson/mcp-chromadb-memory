# CoachNTT - Conversational AI Platform

## Overview

CoachNTT is a comprehensive conversational AI platform that combines intelligent memory management with voice synthesis capabilities. It consists of two main components:

1. **MCP Server** - Backend service providing:
   - **Persistent conversation memory** across sessions
   - **Code intelligence** with 644 symbols/second indexing
   - **Conversation-aware scoring** for better context relevance
   - **Hybrid storage** using PostgreSQL + ChromaDB for 60x performance
   - **Audio synthesis** via ElevenLabs API integration

2. **VSCode Extension** - Rich UI providing:
   - **Visual memory management** with hierarchical tree view
   - **Audio playback controls** with queue management
   - **Real-time status** indicators and progress tracking
   - **Comprehensive settings** for customization

## Quick Start

### 1. Prerequisites

- Docker & Docker Compose
- Node.js 20+
- OpenAI API key

### 2. Setup

```bash
# Clone the repository
git clone https://github.com/stevenjjobson/mcp-chromadb-memory.git
cd mcp-chromadb-memory

# Navigate to CoachNTT directory
cd CoachNTT

# Install MCP server dependencies
cd mcp-server
npm install

# Install VSCode extension dependencies
cd ../vscode-extension
npm install

# Set up environment
cd ../mcp-server
cp ../../.env.example .env
# Edit .env and add your OPENAI_API_KEY and optionally ELEVENLABS_API_KEY
```

### 3. Start Services

```bash
# From the main project directory
# Start databases (PostgreSQL + ChromaDB)
docker-compose up -d chromadb postgres

# Run CoachNTT MCP Server
cd CoachNTT/mcp-server
npm run dev

# Or build and run
npm run build
npm start
```

### 4. Configure Claude Desktop

Add to your Claude Desktop config (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "npx",
      "args": ["tsx", "C:\\path\\to\\mcp-chromadb-memory\\CoachNTT\\mcp-server\\src\\index.ts"],
      "env": {
        "OPENAI_API_KEY": "your-api-key",
        "ELEVENLABS_API_KEY": "your-elevenlabs-key",
        "USE_HYBRID_STORAGE": "true",
        "CODE_INDEXING_ENABLED": "true"
      }
    }
  }
}
```

### 5. Install VSCode Extension

1. Open VSCode
2. Navigate to `CoachNTT/vscode-extension`
3. Run `npm run package` to create VSIX file
4. Install the extension from VSIX: `code --install-extension coachntt-vscode-*.vsix`

## Key Features

### 1. Conversational Memory Management

- **Conversation Sessions**: Each conversation has a unique ID and context
- **Thread Support**: Link related conversations together
- **Context Preservation**: Maintains conversation flow across interactions

### 2. Enhanced Scoring Algorithm

Memory retrieval uses enhanced weights:
- Semantic similarity: 35%
- Recency: 25%
- Importance: 15%
- Frequency: 10%
- **Conversation relevance: 15%** (NEW)

### 3. Code Intelligence

- Index entire codebases at 644 symbols/second
- Find implementations, patterns, and relationships
- Natural language queries about code
- No throttling on bulk operations

### 4. Audio Synthesis Features

- **ElevenLabs Integration**: Premium text-to-speech synthesis
- **Voice Selection**: Choose from multiple AI voices
- **Audio Controls**: Speed, stability, and style adjustments
- **Queue Management**: Handle multiple audio requests
- **Caching**: Reduce API calls with smart caching

### 5. Available Tools

**Core Memory Tools:**
- `store_memory` - Store with conversation awareness
- `recall_memories` - Retrieve with conversation scoring
- `search_exact` - Fast exact string matching
- `search_hybrid` - Combined exact + semantic search

**Conversation Tools:**
- `start_conversation` - Begin new conversation session
- `get_conversation_context` - Get current conversation state

**Code Intelligence Tools:**
- `index_codebase` - Fast symbol extraction
- `find_symbol` - Stream-based symbol search
- `analyze_code_patterns` - Detect patterns and anti-patterns

**Audio Synthesis Tools:**
- `synthesize_audio` - Convert text to speech with AI voices
- `get_available_voices` - List available ElevenLabs voices
- `check_audio_quota` - Check remaining synthesis quota

## Architecture

CoachNTT uses a separated architecture for scalability and security:

```
CoachNTT/
├── mcp-server/           # Backend MCP Service
│   ├── Audio synthesis (ElevenLabs)
│   ├── Memory management (PostgreSQL + ChromaDB)
│   └── Conversation tracking
│
├── vscode-extension/     # Frontend UI
│   ├── Memory visualization
│   ├── Audio playback controls
│   └── Rich configuration UI
│
└── shared/              # Shared types for type safety
```

Key components:

1. **ConversationalMemoryManager** - Extends HybridMemoryManager with conversation tracking
2. **AudioSynthesisService** - Handles text-to-speech with ElevenLabs API
3. **Dynamic Tool Registry** - Tools available based on initialized services
4. **VSCode Extension** - Rich UI with audio controls and memory management

## Performance

- **Code indexing**: 60x faster than ChromaDB alone
- **Exact search**: <10ms response time
- **Hybrid search**: Combines PostgreSQL and ChromaDB
- **No throttling**: Bulk operations complete in <1s

## Development

### Building from Source

```bash
# Build TypeScript (optional - tsx works without building)
npm run build

# Test with MCP Inspector
npm run inspect
```

### Docker Deployment

```bash
# Build Docker image
docker-compose -f docker-compose.coachntt.yml build

# Run services
docker-compose -f docker-compose.coachntt.yml up -d
```

## Configuration

Key environment variables:

```bash
# Required
OPENAI_API_KEY=sk-...           # For embeddings
POSTGRES_HOST=localhost         # PostgreSQL connection
POSTGRES_PORT=5432
POSTGRES_DB=mcp_memory
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password

# Optional - Audio Features
ELEVENLABS_API_KEY=...          # For voice synthesis
ELEVENLABS_DEFAULT_VOICE=...    # Default voice ID
ELEVENLABS_MODEL=...            # TTS model selection

# Optional - Performance
USE_HYBRID_STORAGE=true         # Enable PostgreSQL + ChromaDB
CODE_INDEXING_ENABLED=true      # Enable code intelligence
```

## Troubleshooting

### TypeScript Errors
- Use `tsx` to run directly without compilation
- The project works despite TypeScript errors

### Database Connection
- Ensure both PostgreSQL and ChromaDB are running
- Check Docker logs: `docker-compose logs`

### Memory Not Persisting
- Verify `USE_HYBRID_STORAGE=true`
- Check PostgreSQL connection in logs

## Next Steps

1. **Index your codebase**: Use `index_codebase` tool
2. **Start conversations**: Memory improves with use
3. **Leverage code intelligence**: Ask natural language questions
4. **Build conversation threads**: Link related discussions

## Support

- Original project: https://github.com/stevenjjobson/mcp-chromadb-memory
- CoachNTT specific issues: Create an issue with [CoachNTT] tag

---

Built with ❤️ for conversational AI about code