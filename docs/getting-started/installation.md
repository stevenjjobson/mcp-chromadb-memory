# Installation Guide

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- OpenAI API key
- Git

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mcp-chromadb-memory.git
cd mcp-chromadb-memory
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=your-api-key-here
```

### 4. Start ChromaDB

```bash
docker-compose up -d chromadb
```

### 5. Build the Project

```bash
npm run build
```

### 6. Configure Claude Desktop

See [Claude Desktop Setup](./claude-desktop-setup.md) for detailed configuration.

## Verification

Test the installation:
```bash
npm run inspect
```

This will open the MCP Inspector where you can test the memory tools.

## Next Steps

- Read the [Quick Start Guide](./quick-start.md)
- Explore the [Memory Usage Guide](../guides/memory-usage.md)
- Learn about [Code Intelligence](../guides/code-intelligence.md)