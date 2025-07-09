# 🎯 CoachNTT - Conversational AI Platform with Voice

<div align="center">

[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io)
[![VSCode](https://img.shields.io/badge/VSCode-Extension-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice%20AI-FF6B6B)](https://elevenlabs.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A comprehensive conversational AI platform that combines intelligent memory management with premium voice synthesis capabilities, delivered through a rich VSCode extension interface.

[Features](#features) • [Architecture](#architecture) • [Installation](#installation) • [Usage](#usage) • [API](#api) • [UI Design](#ui-design)

</div>

---

## 🌟 Overview

CoachNTT is a specialized implementation of the MCP ChromaDB Memory platform, designed specifically for conversational AI interactions about codebases. It features a clean separation between the backend MCP server (handling AI operations and voice synthesis) and a feature-rich VSCode extension (providing intuitive UI and audio playback).

## 🎨 Architecture

```
CoachNTT/
├── mcp-server/              # Backend MCP Service
│   ├── src/
│   │   ├── services/        # Core services
│   │   │   ├── audio-synthesis-service.ts  # ElevenLabs integration
│   │   │   └── conversational-memory-manager.ts
│   │   ├── tools/           # MCP tool definitions
│   │   └── index.ts         # Main entry point
│   └── package.json
│
├── vscode-extension/        # Frontend VSCode Extension
│   ├── src/
│   │   ├── services/        # Client services
│   │   │   ├── mcp-client.ts      # MCP communication
│   │   │   └── audio-playback.ts  # Audio controls
│   │   ├── providers/       # VSCode providers
│   │   └── extension.ts     # Extension entry
│   └── package.json
│
└── shared/                  # Shared type definitions
    └── types/
        ├── audio.ts         # Audio interfaces
        └── memory.ts        # Memory interfaces
```

## 🚀 Features

### Backend (MCP Server)
- **🧠 Conversational Memory**: Enhanced memory scoring with 15% conversation relevance weight
- **🎙️ Voice Synthesis**: ElevenLabs API integration for premium text-to-speech
- **⚡ High Performance**: 644 symbols/second code indexing, 60x faster than ChromaDB alone
- **🔧 Dynamic Tools**: Audio synthesis tools alongside memory and code intelligence

### Frontend (VSCode Extension)
- **🎵 Audio Controls**: Full playback controls with queue management
- **📊 Memory Explorer**: Hierarchical view of Working/Session/Long-term tiers
- **🎨 Rich UI**: Based on comprehensive ASCII wireframe UI contract
- **⚙️ Comprehensive Settings**: Fine-grained control over all features

## 📋 Requirements

- Node.js 20+
- Docker & Docker Compose
- VSCode 1.85+
- OpenAI API key (for embeddings)
- ElevenLabs API key (optional, for premium voices)
- PostgreSQL & ChromaDB (via Docker)

## 🛠️ Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/stevenjjobson/mcp-chromadb-memory.git
cd mcp-chromadb-memory/CoachNTT

# Install dependencies for both components
cd mcp-server && npm install
cd ../vscode-extension && npm install
```

### 2. Configure Environment

```bash
# In mcp-server directory
cp ../../.env.example .env
```

Edit `.env` and add:
```env
OPENAI_API_KEY=your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key  # Optional
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mcp_memory
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password
```

### 3. Start Backend Services

```bash
# From main project root
docker-compose up -d chromadb postgres

# Start MCP server
cd CoachNTT/mcp-server
npm run dev
```

### 4. Install VSCode Extension

```bash
cd ../vscode-extension
npm run package
code --install-extension coachntt-vscode-*.vsix
```

### 5. Configure Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["C:\\path\\to\\CoachNTT\\mcp-server\\dist\\index.js"],
      "env": {
        "OPENAI_API_KEY": "your-key",
        "ELEVENLABS_API_KEY": "your-key"
      }
    }
  }
}
```

## 🎯 Usage

### VSCode Extension UI

The extension provides a comprehensive sidebar interface:

```
┌─ COACHNTT ─────────────────────────────┐
│ 🔌 Connected to localhost:3000          │
├─────────────────────────────────────────┤
│ 💭 Memory Explorer                      │
│ ├─ 📁 Working Tier (23 items)          │
│ ├─ 📁 Session Tier (67 items)          │
│ └─ 📁 Long-term Tier (66 items)        │
├─────────────────────────────────────────┤
│ 🎵 Audio Controls                       │
│ ▶️ ━━━━━●━━━━━━━━━ 1:23/3:45          │
│ [⏮️] [⏯️] [⏭️]  🔊 80%  Speed: 1.0x    │
├─────────────────────────────────────────┤
│ 🎯 Active Session                       │
│ Duration: 45 min | Memories: 12         │
└─────────────────────────────────────────┘
```

### Available MCP Tools

**Memory Tools:**
- `store_memory` - Store with conversation awareness
- `recall_memories` - Enhanced retrieval with conversation scoring
- `search_exact` - Fast exact string matching
- `search_hybrid` - Combined search strategies

**Audio Tools:**
- `synthesize_audio` - Convert text to speech
  ```json
  {
    "text": "Hello, let me explain this code",
    "voice": "voice-id",
    "speed": 1.0,
    "stability": 0.5
  }
  ```
- `get_available_voices` - List all ElevenLabs voices
- `check_audio_quota` - Monitor API usage

**Code Intelligence:**
- `index_codebase` - Fast symbol extraction
- `find_symbol` - Stream-based search
- `analyze_code_patterns` - Pattern detection

### VSCode Commands

Access via Command Palette (Ctrl+Shift+P):

- `CoachNTT: Connect to Server`
- `CoachNTT: Store Selection as Memory`
- `CoachNTT: Search Memories`
- `CoachNTT: Speak Selection`
- `CoachNTT: Show Audio Controls`
- `CoachNTT: Configure Voice Settings`

## 🎨 UI Design

The VSCode extension follows a comprehensive UI contract based on ASCII wireframes:

### Main Panel
- **Connection Status**: Real-time server connection monitoring
- **Memory Explorer**: Three-tier hierarchical view with search
- **Audio Controls**: Full playback interface with queue
- **Session Tracking**: Active conversation context

### Status Bar
- Quick audio controls
- Connection status
- Memory statistics

### Context Menus
- Right-click to store selection as memory
- Speak selected text
- Memory operations on tree items

## ⚙️ Configuration

### VSCode Settings

```json
{
  "coachntt.server.host": "localhost",
  "coachntt.server.port": 3000,
  "coachntt.audio.enabled": true,
  "coachntt.audio.defaultVolume": 0.8,
  "coachntt.audio.autoPlay": false,
  "coachntt.memory.autoStore": false,
  "coachntt.memory.searchType": "hybrid"
}
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Audio Features
ELEVENLABS_API_KEY=...
ELEVENLABS_DEFAULT_VOICE=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_monolingual_v1

# Performance
USE_HYBRID_STORAGE=true
CODE_INDEXING_ENABLED=true
```

## 🚀 Performance

- **Memory Operations**: <10ms exact search, <100ms semantic search
- **Audio Synthesis**: 2-5s for typical responses
- **Code Indexing**: 644 symbols/second
- **No Throttling**: Bulk operations complete in <1s

## 🛡️ Security

- API keys stored server-side only
- Audio data transmitted as base64
- Optional authentication for MCP connection
- Configurable audio caching

## 📚 API Reference

### Audio Synthesis Request
```typescript
interface AudioSynthesisRequest {
  text: string;
  options?: {
    voice?: string;
    speed?: number;
    style?: number;
    stability?: number;
    similarityBoost?: number;
  };
}
```

### Audio Synthesis Response
```typescript
interface AudioSynthesisResponse {
  audioData: string;  // Base64 encoded
  mimeType: string;
  duration: number;
  metadata: {
    voice: string;
    model: string;
    characterCount: number;
  };
}
```

## 🔧 Development

### Building from Source

```bash
# Build MCP server
cd mcp-server
npm run build

# Build VSCode extension
cd ../vscode-extension
npm run compile
```

### Testing

```bash
# Test MCP server
cd mcp-server
npm test

# Test extension
cd ../vscode-extension
npm run test
```

## 📄 License

This project is licensed under the MIT License - see the parent project's LICENSE file for details.

## 🙏 Acknowledgments

- Built on [MCP ChromaDB Memory](https://github.com/stevenjjobson/mcp-chromadb-memory)
- Voice synthesis powered by [ElevenLabs](https://elevenlabs.io/)
- UI design based on ASCII Wireframe UI Contract methodology

---

<div align="center">
Built with ❤️ for conversational AI experiences
</div>