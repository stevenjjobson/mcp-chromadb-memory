# CoachNTT MCP Server

Backend service for the CoachNTT conversational AI platform, providing memory management, code intelligence, and audio synthesis capabilities through the Model Context Protocol.

## Overview

The MCP server is the brain of CoachNTT, handling:
- 🧠 Conversational memory management with PostgreSQL + ChromaDB
- 🎙️ Text-to-speech synthesis via ElevenLabs API
- 📊 Code intelligence and pattern recognition
- 🔧 Dynamic tool registration based on available services

## Architecture

```
mcp-server/
├── src/
│   ├── services/
│   │   ├── audio-synthesis-service.ts    # ElevenLabs TTS
│   │   ├── conversational-memory-manager.ts
│   │   └── logger.ts
│   ├── tools/
│   │   └── tool-registry.ts              # Dynamic tool management
│   ├── utils/
│   │   └── metadata-validator.ts
│   ├── config.js                         # Environment configuration
│   └── index.ts                          # Main entry point
├── docker-compose.yml
└── package.json
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp ../../.env.example .env

# Edit .env with your API keys
```

## Configuration

### Required Environment Variables

```env
# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mcp_memory
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password

# ChromaDB
CHROMA_URL=http://localhost:8000
```

### Optional Audio Configuration

```env
# ElevenLabs (for voice synthesis)
ELEVENLABS_API_KEY=...
ELEVENLABS_DEFAULT_VOICE=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_monolingual_v1
ELEVENLABS_STABILITY=0.5
ELEVENLABS_SIMILARITY=0.5
ELEVENLABS_STYLE=0
ELEVENLABS_SPEAKER_BOOST=true
```

### Performance Settings

```env
# Hybrid Storage
USE_HYBRID_STORAGE=true
ENABLE_DUAL_WRITE=true
POSTGRES_READ_RATIO=0.5

# Code Intelligence
CODE_INDEXING_ENABLED=true
CODE_INDEXING_PATTERNS="**/*.{js,ts,py,java,go,rs,cpp}"
```

## Running the Server

### Development Mode

```bash
# Using tsx (recommended for development)
npm run dev

# Watch mode
npm run dev -- --watch
```

### Production Mode

```bash
# Build TypeScript
npm run build

# Run compiled JavaScript
npm start
```

### Docker Deployment

```bash
# Using the project's docker-compose
docker-compose -f docker-compose.yml up -d

# Or standalone
docker build -t coachntt-mcp-server .
docker run -p 3000:3000 coachntt-mcp-server
```

## Available Tools

### Memory Management
- `store_memory` - Store information with conversation awareness
- `recall_memories` - Retrieve with enhanced scoring (15% conversation relevance)
- `search_exact` - Fast exact string matching
- `search_hybrid` - Combined exact and semantic search
- `get_memory_stats` - Memory system statistics
- `get_tier_stats` - Tier-based memory distribution

### Audio Synthesis
- `synthesize_audio` - Convert text to speech
  - Parameters: text, voice, speed, style, stability, similarityBoost
  - Returns: Base64 encoded audio data
- `get_available_voices` - List all ElevenLabs voices
- `check_audio_quota` - Monitor API usage limits

### Code Intelligence
- `index_codebase` - Fast symbol extraction (644 symbols/second)
- `find_symbol` - Stream-based symbol search
- `analyze_code_patterns` - Detect patterns and anti-patterns
- `search_code_natural` - Natural language code queries

### Conversation Tools
- `start_conversation` - Initialize new conversation session
- `get_conversation_context` - Retrieve current context

## API Integration

### Connecting from Claude Desktop

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["path/to/CoachNTT/mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-key",
        "ELEVENLABS_API_KEY": "your-key"
      }
    }
  }
}
```

### Connecting from VSCode Extension

```typescript
const client = new MCPClient();
await client.connect('localhost', 3000);

// Synthesize audio
const result = await client.callTool('synthesize_audio', {
  text: 'Hello, world!',
  voice: 'Rachel',
  speed: 1.0
});
```

## Audio Synthesis Details

### ElevenLabs Integration

The server integrates with ElevenLabs API v1 for high-quality voice synthesis:

1. **Voice Selection**: Default voice or specify by ID
2. **Voice Parameters**:
   - Stability (0-1): Voice consistency
   - Similarity Boost (0-1): Voice matching
   - Style (0-1): Speaking style intensity
   - Speaker Boost: Enhanced clarity

3. **Response Format**:
   ```json
   {
     "audioData": "base64-encoded-mp3",
     "mimeType": "audio/mpeg",
     "duration": 5.2,
     "metadata": {
       "voice": "Rachel",
       "model": "eleven_monolingual_v1",
       "characterCount": 42
     }
   }
   ```

### Fallback TTS

If ElevenLabs is not configured, the server logs a warning but continues operating without audio synthesis capabilities.

## Performance Optimization

### Memory System
- **Hybrid Storage**: PostgreSQL for structured data, ChromaDB for vectors
- **Bulk Operations**: 60x faster than ChromaDB alone
- **No Throttling**: Complete operations in <1s

### Code Intelligence
- **Streaming**: Incremental results for large codebases
- **Caching**: Symbol relationships cached in memory
- **Batch Processing**: Bulk symbol indexing

## Error Handling

The server implements comprehensive error handling:

1. **Service Initialization**: Graceful fallback if services unavailable
2. **API Failures**: Detailed error messages with recovery suggestions
3. **Database Connection**: Retry logic with exponential backoff
4. **Tool Execution**: Safe error propagation to clients

## Logging

Uses a simple console-based logger with levels:
- `INFO`: General operational messages
- `WARN`: Non-critical issues (e.g., missing API key)
- `ERROR`: Critical errors requiring attention
- `DEBUG`: Detailed debugging (when DEBUG=true)

## Development

### Testing

```bash
# Run tests
npm test

# Test with MCP Inspector
npm run inspect
```

### Adding New Tools

1. Create service in `src/services/`
2. Register in `tool-registry.ts`
3. Add tool handlers in `index.ts`
4. Update type definitions in `shared/types/`

### Debugging

```bash
# Enable debug logging
DEBUG=true npm run dev

# Inspect MCP communication
npm run inspect
```

## Troubleshooting

### Common Issues

1. **"Audio synthesis service not available"**
   - Check ELEVENLABS_API_KEY is set
   - Verify API key is valid

2. **"Failed to connect to PostgreSQL"**
   - Ensure PostgreSQL container is running
   - Check connection parameters
   - Verify pgvector extension is installed

3. **"ChromaDB connection failed"**
   - Check ChromaDB is running on port 8000
   - Verify no firewall blocking

### Health Check

Use the `health_check` tool to verify system status:
```json
{
  "status": "ok",
  "service": "CoachNTT",
  "chromadb_connected": true,
  "version": "1.0.0",
  "mode": "conversational"
}
```

## Security Considerations

- API keys stored as environment variables
- No credentials logged or exposed in responses
- Audio data transmitted as base64 (consider size limits)
- PostgreSQL connections use connection pooling

## License

Part of the CoachNTT project under MIT License.