# 🧠 MCP ChromaDB Memory Server

<div align="center">

[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Database-orange)](https://www.trychroma.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An AI-driven MCP (Model Context Protocol) server that provides intelligent memory management using ChromaDB for semantic search and autonomous storage decisions.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [API](#api) • [Configuration](#configuration) • [Contributing](#contributing)

</div>

---

## 🌟 Overview

The MCP ChromaDB Memory Server enables AI assistants like Claude to maintain persistent, intelligent memory across conversations. It autonomously decides what information is worth remembering based on importance assessment and provides context-aware retrieval with multi-factor relevance scoring.

### Key Capabilities

- 🤖 **Autonomous Storage** - AI-assessed importance determines what gets stored
- 🔍 **Intelligent Retrieval** - Multi-factor scoring combines semantic similarity, recency, importance, and access frequency
- 🎯 **Context-Aware** - Supports different memory contexts (general, user preferences, critical tasks, notes)
- 📊 **Smart Scoring** - Retrieval uses weighted scoring: Semantic (40%), Recency (30%), Importance (20%), Frequency (10%)
- 🔄 **Memory Consolidation** - Prevents redundancy by merging similar memories (coming soon)

## 📋 Requirements

- Node.js 20+
- Docker & Docker Compose
- OpenAI API key (for embeddings)
- 2GB RAM minimum
- Windows/macOS/Linux

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/stevenjjobson/mcp-chromadb-memory.git
   cd mcp-chromadb-memory
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Verify installation**
   ```bash
   docker-compose logs -f chromadb-memory
   ```

> **Note**: The MCP server container will exit immediately when run standalone. This is normal behavior - MCP servers communicate via stdio and need a client to connect. Use the Claude Desktop configuration below to properly connect to the server.

### Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start ChromaDB**
   ```bash
   docker-compose up -d chromadb
   ```

3. **Build and run**
   ```bash
   npm run build
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# ChromaDB Configuration
CHROMA_HOST=chromadb          # Use 'localhost' for local development
CHROMA_PORT=8000

# OpenAI Configuration (required for embeddings)
OPENAI_API_KEY=your-api-key-here

# Memory Configuration
MEMORY_IMPORTANCE_THRESHOLD=0.7    # Minimum importance score to store (0-1)
MEMORY_COLLECTION_NAME=ai_memories
MAX_MEMORY_RESULTS=10

# Server Configuration
MCP_SERVER_NAME=ai-memory-server
MCP_SERVER_VERSION=1.0.0
```

### Claude Desktop Integration

1. **Locate the configuration file**:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the MCP server configuration**:

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--network", "mcp-chromadb-memory_memory-network",
        "-e", "OPENAI_API_KEY=your-api-key-here",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=chromadb",
        "-e", "CHROMA_PORT=8000",
        "mcp-chromadb-memory-mcp-memory"
      ]
    }
  }
}
```

3. **Restart Claude Desktop** to load the new configuration

For local development without Docker:
```json
{
  "mcpServers": {
    "memory-local": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp-chromadb-memory\\dist\\index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "CHROMA_HOST": "localhost",
        "CHROMA_PORT": "8000"
      }
    }
  }
}
```

## 📚 API Reference

### Tools

#### `store_memory`
Stores information based on AI-assessed importance.

```typescript
{
  content: string;      // The information to store
  context?: string;     // Context category (general, user_preference, task_critical, obsidian_note)
  metadata?: object;    // Additional metadata
}
```

**Response:**
```json
{
  "stored": true,
  "id": "mem_1234567890_abc",
  "importance": 0.85
}
```

#### `recall_memories`
Retrieves relevant memories with context-aware filtering.

```typescript
{
  query: string;        // Search query
  context?: string;     // Optional context filter
  limit?: number;       // Max results (default: 5)
}
```

**Response:**
```json
[
  {
    "content": "User prefers dark mode interfaces",
    "context": "user_preference",
    "importance": "0.80",
    "timestamp": "2024-01-15T10:30:00Z",
    "scores": {
      "total": "0.825",
      "semantic": "0.920",
      "recency": "0.750",
      "importance": "0.800",
      "frequency": "0.600"
    }
  }
]
```

#### `health_check`
Verifies server status and ChromaDB connection.

**Response:**
```json
{
  "status": "ok",
  "chromadb_connected": true,
  "server_version": "1.0.0",
  "platform": "linux",
  "docker": true
}
```

## 🏗️ Architecture

```
mcp-chromadb-memory/
├── src/
│   ├── index.ts         # MCP server entry point
│   ├── config.ts        # Configuration management
│   └── memory-manager.ts # ChromaDB operations & memory logic
├── dist/                # Compiled JavaScript
├── docker-compose.yml   # Container orchestration
├── Dockerfile          # Container definition
└── tests/              # Test suites
```

### Memory Scoring Algorithm

The retrieval system uses a sophisticated multi-factor scoring approach:

- **Semantic Similarity (40%)**: Cosine similarity between query and memory embeddings
- **Recency Score (30%)**: Exponential decay based on time since last access
- **Importance Score (20%)**: AI-assessed importance during storage
- **Frequency Score (10%)**: Logarithmic scaling of access count

## 🛠️ Development

### Available Scripts

```bash
npm run build         # Compile TypeScript
npm run dev          # Run with hot reload
npm run test         # Run test suite
npm run inspect      # Test with MCP Inspector
npm run docker:build # Build Docker image
npm run docker:run   # Run in Docker
```

### Testing with MCP Inspector

```bash
npm run inspect
```

Then in the inspector:
1. Call `health_check` to verify connection
2. Use `store_memory` to save test memories
3. Use `recall_memories` to test retrieval

## 🔧 Troubleshooting

### MCP Server Not Appearing in Claude Desktop

1. **Verify configuration file location**:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Ensure JSON syntax is valid (no trailing commas)

2. **Check Docker setup**:
   ```bash
   docker images | grep mcp-chromadb-memory
   docker network ls | grep memory-network
   ```

3. **Ensure ChromaDB is running**:
   ```bash
   docker-compose ps
   ```

4. **Test manually**:
   ```bash
   docker run -it --rm \
     --network mcp-chromadb-memory_memory-network \
     -e OPENAI_API_KEY=your-key \
     mcp-chromadb-memory-mcp-memory
   ```

### Common Issues

- **"Container exits immediately"**: This is normal for MCP servers - they run on-demand
- **"Cannot connect to ChromaDB"**: Ensure ChromaDB container is healthy
- **"Missing OpenAI API key"**: Check your .env file or Docker environment variables

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- Powered by [ChromaDB](https://www.trychroma.com/) for vector storage
- Uses [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings) for semantic search

## 📞 Support

- 🐛 [Report bugs](https://github.com/stevenjjobson/mcp-chromadb-memory/issues)
- 💡 [Request features](https://github.com/stevenjjobson/mcp-chromadb-memory/issues)
- 📖 [Documentation](https://github.com/stevenjjobson/mcp-chromadb-memory/wiki)

---

<div align="center">
Made with ❤️ for the MCP ecosystem
</div>