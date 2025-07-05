
## Environment & Use Case Confirmation

### Environment Configuration

- **Operating System**: Windows with WSL2
- **Development Tools**:
    - VS Code with WSL Remote extension
    - Docker Desktop for Windows
    - Claude Code for AI-assisted development
- **Project Location**: `C:\Users\Steve\Dockers\mcp-chromadb-memory`
- **Existing Setup**: Part of `aoe-mcp-personal` Docker environment
- **Integration**: Will work alongside existing MCP servers (filesystem for Obsidian, fetch)

### Intended Use Case

This MCP server will provide AI-driven memory management for conversational context, allowing Claude to:

- **Autonomously store** important information from conversations based on AI-assessed importance
- **Intelligently retrieve** relevant memories using semantic search with multi-factor scoring
- **Manage context** across sessions with your Obsidian vault integration
- **Prevent redundancy** through automatic memory consolidation

### Architecture Sanity Check

```
C:\Users\Steve\Dockers\
├── aoe-mcp-personal\           (Existing setup)
│   ├── docker-compose.yml      (Will be updated)
│   ├── servers\
│   │   ├── filesystem\         (Existing - Obsidian access)
│   │   └── fetch\             (Existing - Web fetching)
│   └── databases\
└── mcp-chromadb-memory\        (New - This guide)
    ├── src\
    ├── dist\
    └── Dockerfile
```

---

## Overview & Time Allocation (2 hours total)

- **Setup & Environment**: 20 minutes
- **Core MCP Server**: 30 minutes
- **ChromaDB Integration**: 30 minutes
- **AI Decision Logic**: 30 minutes
- **Testing & Integration**: 10 minutes

---

## Phase 1: Project Setup & Environment (20 minutes)

### Step 1.1: Create Project Structure in Windows (5 minutes)

Open PowerShell as Administrator:

```powershell
# Navigate to your Dockers directory
cd C:\Users\Steve\Dockers

# Create the new project directory
New-Item -ItemType Directory -Force -Path "mcp-chromadb-memory"
cd mcp-chromadb-memory

# Create directory structure
New-Item -ItemType Directory -Force -Path "src", "tests", "data"

# Create files
New-Item -ItemType File -Path "src\index.ts", "src\memory-manager.ts", "src\config.ts"
New-Item -ItemType File -Path "tests\memory.test.ts"
New-Item -ItemType File -Path ".env", ".gitignore", "README.md", "Dockerfile"

# Initialize npm project
npm init -y
```

### Step 1.2: Install Dependencies (5 minutes)

Continue in PowerShell:

```powershell
# Core dependencies
npm install @modelcontextprotocol/sdk chromadb openai zod dotenv

# Development dependencies
npm install -D typescript @types/node tsx nodemon

# Testing dependencies
npm install -D jest @types/jest ts-jest

# Windows-specific: Ensure line endings are correct
git config core.autocrlf true
```

### Step 1.3: Configure TypeScript for Windows (5 minutes)

Create `tsconfig.json` using VS Code:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "newLine": "lf"  // Force LF line endings for Docker compatibility
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Update `package.json` scripts for Windows compatibility:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "inspect": "npx @modelcontextprotocol/inspector tsx src/index.ts",
    "docker:build": "docker build -t mcp-chromadb-memory .",
    "docker:run": "docker run -it --rm --network aoe-mcp-personal_default mcp-chromadb-memory"
  }
}
```

### Step 1.4: Environment Setup for Windows (5 minutes)

Create `.env` file:

```bash
# ChromaDB Configuration
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=your-api-key-here

# Memory Configuration
MEMORY_IMPORTANCE_THRESHOLD=0.7
MEMORY_COLLECTION_NAME=ai_memories
MAX_MEMORY_RESULTS=10

# Server Configuration
MCP_SERVER_NAME=ai-memory-server
MCP_SERVER_VERSION=1.0.0
```

Update `aoe-mcp-personal\docker-compose.yml` to add ChromaDB:

```yaml
services:
  # ... existing services ...
  
  chromadb:
    image: chromadb/chroma:latest
    container_name: chromadb
    ports:
      - "8000:8000"
    volumes:
      - ./data/chroma:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - PERSIST_DIRECTORY=/chroma/chroma
      - ANONYMIZED_TELEMETRY=FALSE
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - default
```

Start ChromaDB from `aoe-mcp-personal` directory:

```powershell
cd C:\Users\Steve\Dockers\aoe-mcp-personal
docker-compose up -d chromadb

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

### 🧪 **Test Point 1**: Environment Verification

```powershell
# Test ChromaDB is accessible
Invoke-WebRequest -Uri "http://localhost:8000/api/v1/heartbeat" -UseBasicParsing
# Expected: {"nanosecond heartbeat": <timestamp>}

# Test Node/TypeScript setup
npx tsx --version
# Expected: v10.x.x or higher

# Verify Docker network
docker network ls | Select-String "aoe-mcp-personal"
# Expected: aoe-mcp-personal_default network exists
```

---

## Phase 2: Core MCP Server Implementation (30 minutes)

### Step 2.1: Configuration Module (5 minutes)

Open VS Code in the project directory:

```powershell
code C:\Users\Steve\Dockers\mcp-chromadb-memory
```

Create `src/config.ts`:

```typescript
import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env file - handle Windows paths
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ConfigSchema = z.object({
  chromaHost: z.string().default('localhost'),
  chromaPort: z.string().default('8000'),
  openaiApiKey: z.string(),
  memoryImportanceThreshold: z.number().default(0.7),
  memoryCollectionName: z.string().default('ai_memories'),
  maxMemoryResults: z.number().default(10),
  serverName: z.string().default('ai-memory-server'),
  serverVersion: z.string().default('1.0.0'),
  isDocker: z.boolean().default(false)
});

// Detect if running in Docker
const isDocker = process.env.DOCKER_CONTAINER === 'true';

export const config = ConfigSchema.parse({
  chromaHost: isDocker ? 'chromadb' : (process.env.CHROMA_HOST || 'localhost'),
  chromaPort: process.env.CHROMA_PORT,
  openaiApiKey: process.env.OPENAI_API_KEY,
  memoryImportanceThreshold: parseFloat(process.env.MEMORY_IMPORTANCE_THRESHOLD || '0.7'),
  memoryCollectionName: process.env.MEMORY_COLLECTION_NAME,
  maxMemoryResults: parseInt(process.env.MAX_MEMORY_RESULTS || '10'),
  serverName: process.env.MCP_SERVER_NAME,
  serverVersion: process.env.MCP_SERVER_VERSION,
  isDocker
});

export type Config = z.infer<typeof ConfigSchema>;

// Log configuration (useful for debugging Windows/Docker issues)
console.error(`ChromaDB URL: http://${config.chromaHost}:${config.chromaPort}`);
console.error(`Running in Docker: ${config.isDocker}`);
```

### Step 2.2: Basic MCP Server Setup (10 minutes)

Create `src/index.ts` with Windows-compatible shebang:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from './config.js';
import { MemoryManager } from './memory-manager.js';

// Handle Windows-specific process signals
if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

// Initialize server
const server = new Server(
  {
    name: config.serverName,
    version: config.serverVersion,
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// Initialize memory manager (to be implemented)
let memoryManager: MemoryManager;

// Health check tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'health_check',
        description: 'Check if the memory server is running correctly',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle health check
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'health_check') {
    try {
      const isConnected = memoryManager ? await memoryManager.isConnected() : false;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              chromadb_connected: isConnected,
              server_version: config.serverVersion,
              platform: process.platform,
              docker: config.isDocker
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Health check failed: ${error}`
          }
        ]
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.error('Shutting down gracefully...');
  if (memoryManager) {
    await memoryManager.close();
  }
  process.exit(0);
});

// Start server
async function main() {
  try {
    console.error('Initializing AI Memory MCP Server...');
    console.error(`Platform: ${process.platform}`);
    console.error(`Docker mode: ${config.isDocker}`);
    
    // Initialize memory manager
    memoryManager = new MemoryManager(config);
    await memoryManager.initialize();
    
    console.error('Memory manager initialized successfully');
    
    // Start stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('MCP Server running on stdio transport');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### Step 2.3: Memory Manager Stub (5 minutes)

Create basic `src/memory-manager.ts`:

```typescript
import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddingFunction } from 'chromadb';
import { Config } from './config.js';

export class MemoryManager {
  private client: ChromaClient;
  private collection: any;
  private embedder: OpenAIEmbeddingFunction;
  
  constructor(private config: Config) {
    // Use full URL for Windows/Docker compatibility
    const chromaUrl = `http://${config.chromaHost}:${config.chromaPort}`;
    console.error(`Connecting to ChromaDB at: ${chromaUrl}`);
    
    this.client = new ChromaClient({
      path: chromaUrl
    });
    
    this.embedder = new OpenAIEmbeddingFunction({
      openai_api_key: config.openaiApiKey,
      model_name: "text-embedding-3-small"
    });
  }
  
  async initialize(): Promise<void> {
    try {
      // Test connection with retry for Docker startup
      let retries = 5;
      while (retries > 0) {
        try {
          await this.client.heartbeat();
          break;
        } catch (error) {
          if (retries === 1) throw error;
          console.error(`ChromaDB not ready, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
        }
      }
      
      // Create or get collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.memoryCollectionName,
        embeddingFunction: this.embedder,
        metadata: {
          "hnsw:space": "cosine",
          "hnsw:construction_ef": 200,
          "hnsw:M": 32
        }
      });
      
      console.error(`Connected to ChromaDB collection: ${this.config.memoryCollectionName}`);
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }
  
  async isConnected(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }
  
  async close(): Promise<void> {
    // Cleanup if needed
    console.error('Memory manager closed');
  }
}
```

### Step 2.4: Create Dockerfile for Windows (5 minutes)

Create `Dockerfile` with Windows line ending handling:

```dockerfile
FROM node:20-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create non-root user
RUN useradd -m -u 1001 mcpuser

# Set environment to indicate Docker
ENV DOCKER_CONTAINER=true

USER mcpuser

CMD ["node", "dist/index.js"]
```

### 🧪 **Test Point 2**: Basic Server Functionality

```powershell
# Test 1: Build the project
npm run build
# Expected: Successful compilation with no errors

# Test 2: Test locally with MCP Inspector
$env:OPENAI_API_KEY = "your-key-here"
npm run inspect
# In inspector, call the 'health_check' tool
# Expected: { status: 'ok', chromadb_connected: true, platform: 'win32', docker: false }

# Test 3: Build Docker image
docker build -t mcp-chromadb-memory .
# Expected: Successful build

# Test 4: Test Docker container
docker run -it --rm `
  --network aoe-mcp-personal_default `
  -e OPENAI_API_KEY=$env:OPENAI_API_KEY `
  mcp-chromadb-memory
# Expected: Server starts without errors
```

---

## Phase 3: ChromaDB Integration & Memory Tools (30 minutes)

### Step 3.1: Memory Data Structures (5 minutes)

Update `src/memory-manager.ts` with interfaces:

```typescript
// Add at the top of memory-manager.ts after imports
interface Memory {
  id: string;
  content: string;
  context: string;
  importance: number;
  timestamp: string;
  metadata: Record<string, any>;
  accessCount: number;
  lastAccessed: string;
}

interface MemoryScore {
  memory: Memory;
  semanticScore: number;
  recencyScore: number;
  importanceScore: number;
  frequencyScore: number;
  totalScore: number;
}

export class MemoryManager {
  // ... existing code ...
  
  // Add importance assessment method
  private async assessImportance(content: string, context?: string): Promise<number> {
    // Simple heuristic-based importance scoring
    // In production, this would use an LLM
    let score = 0.5; // Base score
    
    // Increase importance for certain keywords
    const importantKeywords = ['important', 'remember', 'critical', 'key', 'essential', 'favorite', 'prefer'];
    const lowerContent = content.toLowerCase();
    
    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
      }
    }
    
    // Context-based adjustments
    if (context) {
      if (context === 'user_preference') score += 0.2;
      if (context === 'task_critical') score += 0.3;
      if (context === 'obsidian_note') score += 0.15; // Integration with your Obsidian vault
    }
    
    // Length heuristic (longer = potentially more important)
    if (content.length > 200) score += 0.1;
    
    // Ensure score is between 0 and 1
    return Math.min(Math.max(score, 0), 1.0);
  }
}
```

### Step 3.2: Implement Memory Storage (10 minutes)

Add storage method to `src/memory-manager.ts`:

```typescript
async storeMemory(
  content: string,
  context: string = 'general',
  metadata: Record<string, any> = {}
): Promise<{ stored: boolean; id?: string; importance?: number; reason?: string }> {
  try {
    // Assess importance
    const importance = await this.assessImportance(content, context);
    
    // Check against threshold
    if (importance < this.config.memoryImportanceThreshold) {
      return {
        stored: false,
        importance,
        reason: `Importance ${importance.toFixed(2)} below threshold ${this.config.memoryImportanceThreshold}`
      };
    }
    
    // Generate unique ID with timestamp
    const timestamp = new Date().toISOString();
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare metadata with Windows-friendly timestamps
    const fullMetadata = {
      ...metadata,
      context,
      importance,
      timestamp,
      accessCount: 0,
      lastAccessed: timestamp,
      platform: process.platform,
      source: this.config.isDocker ? 'docker' : 'local'
    };
    
    // Store in ChromaDB
    await this.collection.add({
      ids: [id],
      documents: [content],
      metadatas: [fullMetadata]
    });
    
    console.error(`Stored memory ${id} with importance ${importance.toFixed(2)}`);
    
    return {
      stored: true,
      id,
      importance
    };
  } catch (error) {
    console.error('Error storing memory:', error);
    // Return error details for debugging
    return {
      stored: false,
      reason: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
```

### Step 3.3: Implement Memory Retrieval (10 minutes)

Add retrieval with multi-factor scoring:

```typescript
async recallMemories(
  query: string,
  context?: string,
  limit: number = 5
): Promise<MemoryScore[]> {
  try {
    // Build where clause
    const whereClause: any = {};
    if (context) {
      whereClause.context = context;
    } else {
      // If no context specified, prefer higher importance memories
      whereClause.importance = { $gte: 0.7 };
    }
    
    // Query ChromaDB with extra results for reranking
    const results = await this.collection.query({
      queryTexts: [query],
      nResults: Math.min(limit * 2, 20), // Cap at 20 for performance
      where: whereClause
    });
    
    if (!results.documents[0] || results.documents[0].length === 0) {
      console.error('No memories found for query:', query);
      return [];
    }
    
    // Calculate multi-factor scores
    const currentTime = Date.now();
    const scoredMemories: MemoryScore[] = [];
    
    for (let i = 0; i < results.documents[0].length; i++) {
      const metadata = results.metadatas[0][i];
      const memory: Memory = {
        id: results.ids[0][i],
        content: results.documents[0][i],
        context: metadata.context || 'unknown',
        importance: metadata.importance || 0.5,
        timestamp: metadata.timestamp || new Date().toISOString(),
        metadata: metadata,
        accessCount: metadata.accessCount || 0,
        lastAccessed: metadata.lastAccessed || metadata.timestamp
      };
      
      // Calculate component scores
      const semanticScore = 1 - (results.distances[0][i] || 0);
      const recencyScore = this.calculateRecencyScore(memory.timestamp, currentTime);
      const importanceScore = memory.importance;
      const frequencyScore = this.calculateFrequencyScore(memory.accessCount);
      
      // Combined score with weights
      const totalScore = 
        semanticScore * 0.4 +
        recencyScore * 0.3 +
        importanceScore * 0.2 +
        frequencyScore * 0.1;
      
      scoredMemories.push({
        memory,
        semanticScore,
        recencyScore,
        importanceScore,
        frequencyScore,
        totalScore
      });
    }
    
    // Sort by total score and return top results
    scoredMemories.sort((a, b) => b.totalScore - a.totalScore);
    const topMemories = scoredMemories.slice(0, limit);
    
    // Update access counts asynchronously (don't wait)
    Promise.all(topMemories.map(sm => this.updateAccessCount(sm.memory.id)))
      .catch(err => console.error('Error updating access counts:', err));
    
    return topMemories;
  } catch (error) {
    console.error('Error recalling memories:', error);
    return [];
  }
}

private calculateRecencyScore(timestamp: string, currentTime: number): number {
  const memoryTime = new Date(timestamp).getTime();
  const ageInHours = (currentTime - memoryTime) / (1000 * 60 * 60);
  const decayRate = 0.1; // Decay factor
  return Math.exp(-decayRate * ageInHours);
}

private calculateFrequencyScore(accessCount: number): number {
  return Math.log(1 + accessCount) / Math.log(10); // Logarithmic scaling
}

private async updateAccessCount(memoryId: string): Promise<void> {
  try {
    const result = await this.collection.get({
      ids: [memoryId]
    });
    
    if (result.metadatas && result.metadatas[0].length > 0) {
      const metadata = result.metadatas[0][0];
      metadata.accessCount = (metadata.accessCount || 0) + 1;
      metadata.lastAccessed = new Date().toISOString();
      
      await this.collection.update({
        ids: [memoryId],
        metadatas: [metadata]
      });
    }
  } catch (error) {
    console.error(`Error updating access count for ${memoryId}:`, error);
  }
}
```

### Step 3.4: Add Memory Tools to MCP Server (5 minutes)

Update `src/index.ts` to add memory tools:

```typescript
// Update the tools list in ListToolsRequestSchema handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'health_check',
        description: 'Check if the memory server is running correctly',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'store_memory',
        description: 'Store information based on AI-assessed importance',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The information to store'
            },
            context: {
              type: 'string',
              description: 'Context category (e.g., general, user_preference, task_critical, obsidian_note)',
              default: 'general'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata to store with the memory',
              default: {}
            }
          },
          required: ['content']
        },
      },
      {
        name: 'recall_memories',
        description: 'Retrieve relevant memories with context-aware filtering',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant memories'
            },
            context: {
              type: 'string',
              description: 'Optional context filter'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of memories to return',
              default: 5
            }
          },
          required: ['query']
        },
      }
    ],
  };
});

// Update CallToolRequestSchema handler to handle new tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'health_check': {
        const isConnected = memoryManager ? await memoryManager.isConnected() : false;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ok',
                chromadb_connected: isConnected,
                server_version: config.serverVersion,
                platform: process.platform,
                docker: config.isDocker
              }, null, 2)
            }
          ]
        };
      }
        
      case 'store_memory': {
        const storeResult = await memoryManager.storeMemory(
          args.content as string,
          args.context as string,
          args.metadata as Record<string, any>
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(storeResult, null, 2)
            }
          ]
        };
      }
        
      case 'recall_memories': {
        const memories = await memoryManager.recallMemories(
          args.query as string,
          args.context as string,
          args.limit as number
        );
        
        const formattedMemories = memories.map(m => ({
          content: m.memory.content,
          context: m.memory.context,
          importance: m.memory.importance.toFixed(2),
          timestamp: m.memory.timestamp,
          scores: {
            total: m.totalScore.toFixed(3),
            semantic: m.semanticScore.toFixed(3),
            recency: m.recencyScore.toFixed(3),
            importance: m.importanceScore.toFixed(3),
            frequency: m.frequencyScore.toFixed(3)
          }
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedMemories, null, 2)
            }
          ]
        };
      }
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
            tool: name
          }, null, 2)
        }
      ]
    };
  }
});
```

### 🧪 **Test Point 3**: Memory Operations

```powershell
# Make sure ChromaDB is running
cd C:\Users\Steve\Dockers\aoe-mcp-personal
docker-compose ps
# chromadb should be "Up" and "healthy"

# Test 1: Store a memory using MCP Inspector
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
npm run inspect

# In the inspector, call store_memory:
{
  "content": "The user prefers dark mode interfaces and uses VS Code with the Dracula theme",
  "context": "user_preference",
  "metadata": { "source": "direct_observation" }
}
# Expected: { "stored": true, "id": "mem_...", "importance": 0.8 }

# Test 2: Store an Obsidian-related memory
{
  "content": "User's Obsidian vault is located at C:/Users/Steve/Obsidian/AIContextVault",
  "context": "obsidian_note",
  "metadata": { "vault": "AIContextVault" }
}
# Expected: { "stored": true, "id": "mem_...", "importance": 0.65+ }

# Test 3: Recall memories
{
  "query": "user interface preferences",
  "limit": 3
}
# Expected: Array with the dark mode preference, including multi-factor scores

# Test 4: Test with Docker
docker run -it --rm `
  --network aoe-mcp-personal_default `
  -e OPENAI_API_KEY=$env:OPENAI_API_KEY `
  mcp-chromadb-memory
# Should connect to ChromaDB in the Docker network
```

---

## Phase 4: AI Decision Logic & Advanced Features (30 minutes)

### Step 4.1: Memory Consolidation (10 minutes)

Add to the end of `src/memory-manager.ts`:

```typescript
async consolidateMemories(similarityThreshold: number = 0.85): Promise<number> {
  try {
    // Get all memories
    const allMemories = await this.collection.get();
    
    if (!allMemories.ids || allMemories.ids.length < 2) {
      console.error('Not enough memories to consolidate');
      return 0;
    }
    
    console.error(`Checking ${allMemories.ids.length} memories for consolidation...`);
    
    let consolidatedCount = 0;
    const processedIds = new Set<string>();
    
    for (let i = 0; i < allMemories.ids.length; i++) {
      const id = allMemories.ids[i];
      
      if (processedIds.has(id)) continue;
      
      // Find similar memories
      const embedding = allMemories.embeddings ? allMemories.embeddings[i] : null;
      if (!embedding) continue;
      
      const results = await this.collection.query({
        queryEmbeddings: [embedding],
        nResults: 5,
        where: {
          context: allMemories.metadatas[i].context
        }
      });
      
      // Check for highly similar memories (skip first result as it's the same memory)
      const similarMemories = [];
      for (let j = 1; j < results.ids[0].length; j++) {
        const distance = results.distances[0][j];
        if (distance < (1 - similarityThreshold)) {
          similarMemories.push({
            id: results.ids[0][j],
            content: results.documents[0][j],
            metadata: results.metadatas[0][j],
            distance: distance
          });
        }
      }
      
      if (similarMemories.length > 0) {
        console.error(`Found ${similarMemories.length} similar memories to consolidate with ${id}`);
        
        // Consolidate memories
        const consolidatedContent = this.mergeMemoryContents(
          allMemories.documents[i],
          similarMemories.map(m => m.content)
        );
        
        // Keep the highest importance score
        const maxImportance = Math.max(
          allMemories.metadatas[i].importance || 0.5,
          ...similarMemories.map(m => m.metadata.importance || 0.5)
        );
        
        const consolidatedMetadata = {
          ...allMemories.metadatas[i],
          consolidated: true,
          consolidatedFrom: [id, ...similarMemories.map(m => m.id)],
          consolidationTimestamp: new Date().toISOString(),
          importance: maxImportance,
          originalCount: 1 + similarMemories.length
        };
        
        // Update the primary memory
        await this.collection.update({
          ids: [id],
          documents: [consolidatedContent],
          metadatas: [consolidatedMetadata]
        });
        
        // Delete the similar memories
        const idsToDelete = similarMemories.map(m => m.id);
        await this.collection.delete({
          ids: idsToDelete
        });
        
        similarMemories.forEach(m => processedIds.add(m.id));
        consolidatedCount += similarMemories.length;
      }
      
      processedIds.add(id);
    }
    
    console.error(`Consolidation complete: merged ${consolidatedCount} memories`);
    return consolidatedCount;
  } catch (error) {
    console.error('Error consolidating memories:', error);
    throw error;
  }
}

private mergeMemoryContents(primary: string, similar: string[]): string {
  // Simple concatenation with deduplication
  // In production, use LLM for intelligent merging
  const allContents = [primary, ...similar];
  const sentences = new Set<string>();
  
  for (const content of allContents) {
    // Split into sentences and normalize
    const contentSentences = content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short fragments
    
    contentSentences.forEach(s => sentences.add(s));
  }
  
  // Join unique sentences
  const merged = Array.from(sentences).join('. ');
  return merged.endsWith('.') ? merged : merged + '.';
}

// Add statistics methods
async getStatistics(): Promise<any> {
  try {
    const allMemories = await this.collection.get();
    const count = allMemories.ids?.length || 0;
    
    // Calculate context distribution
    const contextCounts: Record<string, number> = {};
    let totalImportance = 0;
    let consolidatedCount = 0;
    
    if (allMemories.metadatas) {
      for (const metadata of allMemories.metadatas) {
        const context = metadata.context || 'unknown';
        contextCounts[context] = (contextCounts[context] || 0) + 1;
        totalImportance += (metadata.importance || 0);
        if (metadata.consolidated) consolidatedCount++;
      }
    }
    
    return {
      totalMemories: count,
      contextDistribution: contextCounts,
      averageImportance: count > 0 ? (totalImportance / count).toFixed(2) : 0,
      consolidatedMemories: consolidatedCount,
      collectionName: this.config.memoryCollectionName,
      importanceThreshold: this.config.memoryImportanceThreshold,
      platform: process.platform,
      environment: this.config.isDocker ? 'docker' : 'local'
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return { error: 'Failed to retrieve statistics' };
  }
}

async getRecentMemories(limit: number = 10): Promise<any[]> {
  try {
    const allMemories = await this.collection.get();
    
    if (!allMemories.ids || allMemories.ids.length === 0) {
      return [];
    }
    
    // Create memory objects with timestamps
    const memories = allMemories.ids.map((id, index) => ({
      id,
      content: allMemories.documents ? allMemories.documents[index] : '',
      metadata: allMemories.metadatas ? allMemories.metadatas[index] : {},
      timestamp: allMemories.metadatas ? 
        new Date(allMemories.metadatas[index].timestamp || 0).getTime() : 0
    }));
    
    // Sort by timestamp descending and take limit
    memories.sort((a, b) => b.timestamp - a.timestamp);
    
    return memories.slice(0, limit).map(m => ({
      id: m.id,
      content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
      context: m.metadata.context || 'unknown',
      importance: m.metadata.importance || 0,
      timestamp: new Date(m.timestamp).toISOString(),
      consolidated: m.metadata.consolidated || false
    }));
  } catch (error) {
    console.error('Error getting recent memories:', error);
    return [];
  }
}
```

### Step 4.2: Add Resources and Consolidation Tool (10 minutes)

Update `src/index.ts` to add resources and the consolidation tool:

```typescript
// Update tools list to include consolidation
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ... existing tools ...
      {
        name: 'consolidate_memories',
        description: 'Consolidate similar memories to reduce redundancy',
        inputSchema: {
          type: 'object',
          properties: {
            similarityThreshold: {
              type: 'number',
              description: 'Similarity threshold for consolidation (0.0-1.0)',
              default: 0.85,
              minimum: 0.5,
              maximum: 0.95
            }
          }
        }
      }
    ],
  };
});

// Add resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'memory://stats',
        mimeType: 'application/json',
        name: 'Memory Statistics',
        description: 'Current memory system statistics and health metrics'
      },
      {
        uri: 'memory://recent',
        mimeType: 'application/json',
        name: 'Recent Memories',
        description: 'Most recently stored memories (last 10)'
      }
    ]
  };
});

// Add ReadResourceRequestSchema handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  try {
    if (uri === 'memory://stats') {
      const stats = await memoryManager.getStatistics();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2)
          }
        ]
      };
    }
    
    if (uri === 'memory://recent') {
      const recent = await memoryManager.getRecentMemories(10);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(recent, null, 2)
          }
        ]
      };
    }
    
    throw new Error(`Unknown resource: ${uri}`);
  } catch (error) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2)
        }
      ]
    };
  }
});

// Update CallToolRequestSchema to handle consolidation
// Add this case to the switch statement:
case 'consolidate_memories': {
  const threshold = (args.similarityThreshold as number) || 0.85;
  const consolidatedCount = await memoryManager.consolidateMemories(threshold);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          consolidatedCount,
          similarityThreshold: threshold,
          message: `Consolidated ${consolidatedCount} similar memories`
        }, null, 2)
      }
    ]
  };
}
```

### Step 4.3: Integration with aoe-mcp-personal (5 minutes)

Update the main `aoe-mcp-personal\docker-compose.yml`:

```yaml
services:
  # ... existing services ...
  
  mcp-memory:
    build: ../mcp-chromadb-memory
    container_name: mcp-memory
    restart: unless-stopped
    depends_on:
      chromadb:
        condition: service_healthy
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DOCKER_CONTAINER=true
      - CHROMA_HOST=chromadb
      - CHROMA_PORT=8000
    volumes:
      - ./data/memories:/app/data
    networks:
      - default
    command: ["node", "dist/index.js"]
```

### Step 4.4: Create Test Suite (5 minutes)

Configure Jest for Windows in `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
};
```

Create `tests/memory.test.ts`:

```typescript
import { MemoryManager } from '../src/memory-manager';
import { config } from '../src/config';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  
  beforeAll(async () => {
    // Use test collection to avoid polluting main data
    const testConfig = {
      ...config,
      memoryCollectionName: 'test_memories'
    };
    memoryManager = new MemoryManager(testConfig);
    await memoryManager.initialize();
  });
  
  afterAll(async () => {
    await memoryManager.close();
  });
  
  test('should assess importance correctly', async () => {
    const importantContent = "This is critical information to remember for the user";
    const result = await memoryManager.storeMemory(
      importantContent,
      'task_critical'
    );
    
    expect(result.stored).toBe(true);
    expect(result.importance).toBeGreaterThan(0.7);
  });
  
  test('should integrate with Obsidian context', async () => {
    const obsidianContent = "Note from Obsidian: User's project deadline is next Friday";
    const result = await memoryManager.storeMemory(
      obsidianContent,
      'obsidian_note',
      { vault: 'AIContextVault' }
    );
    
    expect(result.stored).toBe(true);
    expect(result.importance).toBeGreaterThan(0.6);
  });
  
  test('should handle Windows file paths correctly', async () => {
    const pathContent = "User's important file is at C:\\Users\\Steve\\Documents\\project.md";
    const result = await memoryManager.storeMemory(
      pathContent,
      'user_preference'
    );
    
    expect(result.stored).toBe(true);
    
    // Retrieve and verify
    const memories = await memoryManager.recallMemories("important file location");
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].memory.content).toContain('C:\\Users\\Steve');
  });
});
```

### 🧪 **Test Point 4**: Advanced Features & Integration

```powershell
# Test 1: Store multiple similar memories for consolidation
# In MCP Inspector, store these:
{
  "content": "User prefers TypeScript for type safety",
  "context": "user_preference"
}
{
  "content": "The user likes TypeScript because of its type safety features",
  "context": "user_preference"
}
{
  "content": "TypeScript is preferred by the user due to strong typing",
  "context": "user_preference"
}

# Test 2: Run consolidation
{
  "tool": "consolidate_memories",
  "similarityThreshold": 0.85
}
# Expected: { "success": true, "consolidatedCount": 2 }

# Test 3: Check statistics
# Access resource: memory://stats
# Expected: Shows Windows platform, Docker status, and memory distribution

# Test 4: Test with full Docker stack
cd C:\Users\Steve\Dockers\aoe-mcp-personal
docker-compose up -d
docker-compose ps
# All services should be healthy

# Test 5: Run test suite
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
npm test
# Expected: All tests pass
```

---

## Phase 5: Testing & Integration with Claude Desktop (10 minutes)

### Step 5.1: Build and Deploy (3 minutes)

```powershell
# Build the Docker image
cd C:\Users\Steve\Dockers\mcp-chromadb-memory
docker build -t mcp-chromadb-memory .

# Run the full stack
cd C:\Users\Steve\Dockers\aoe-mcp-personal
docker-compose up -d

# Verify all services
docker-compose ps
# Expected: mcp-filesystem, mcp-fetch, chromadb, and mcp-memory all "Up"
```

### Step 5.2: Configure Claude Desktop (4 minutes)

Update Claude Desktop configuration (location varies by Windows version):

- Windows 11: `%APPDATA%\Claude\claude_desktop_config.json`
- Or: `C:\Users\Steve\AppData\Roaming\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--network", "aoe-mcp-personal_default",
        "-v", "C:/Users/Steve/Obsidian/AIContextVault:/data/aicontextvault:rw",
        "mcp-filesystem"
      ]
    },
    "fetch": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--network", "aoe-mcp-personal_default",
        "mcp-fetch"
      ]
    },
    "memory": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--network", "aoe-mcp-personal_default",
        "-e", "OPENAI_API_KEY=your-api-key-here",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=chromadb",
        "-e", "CHROMA_PORT=8000",
        "mcp-chromadb-memory"
      ]
    }
  }
}
```

For development/testing without Docker:

```json
{
  "mcpServers": {
    "memory-dev": {
      "command": "node",
      "args": ["C:/Users/Steve/Dockers/mcp-chromadb-memory/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "CHROMA_HOST": "localhost",
        "CHROMA_PORT": "8000"
      }
    }
  }
}
```

### Step 5.3: Final Integration Test (3 minutes)

1. **Restart Claude Desktop** after updating configuration
    
2. **Test memory integration** in Claude:
    
    - "Please remember that I use VS Code with the Dracula theme and prefer TypeScript"
    - "Store in your memory that my Obsidian vault is at C:\Users\Steve\Obsidian\AIContextVault"
    - Close Claude Desktop
    - Reopen and ask: "What are my development preferences?"
    - Expected: Claude retrieves the stored preferences
3. **Test cross-service integration**:
    
    - "Check my Obsidian vault and remember any important notes"
    - "What important information have you stored about my setup?"

### 🧪 **Test Point 5**: Full System Integration

```powershell
# Test 1: Verify all services are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
# Expected: All services showing "Up" status

# Test 2: Check ChromaDB persistence
docker-compose down
docker-compose up -d
# Memories should persist after restart

# Test 3: Monitor logs for errors
docker-compose logs -f mcp-memory
# Expected: No errors, successful connections

# Test 4: Performance benchmark
# In Claude, store 20 different memories, then test retrieval speed
# Expected: Retrieval under 200ms even with Docker overhead
```

---

## Troubleshooting Guide for Windows

### Common Windows-Specific Issues

1. **Line Ending Issues (CRLF vs LF)**
    
    ```powershell
    # In Git Bash or WSL
    dos2unix src/*.ts
    # Or in VS Code: Change line endings to LF in bottom bar
    ```
    
2. **Docker Desktop Not Starting**
    
    - Ensure WSL2 is properly installed
    - Check Hyper-V is enabled
    - Restart Docker Desktop service
3. **Permission Issues with Docker Volumes**
    
    ```powershell
    # Reset Docker Desktop to factory defaults if needed
    # Settings -> Reset -> Reset to factory defaults
    ```
    
4. **ChromaDB Connection Issues in Docker**
    
    ```powershell
    # Test from within Docker network
    docker run --rm --network aoe-mcp-personal_default curlimages/curl `
      curl -f http://chromadb:8000/api/v1/heartbeat
    ```
    
5. **OpenAI API Key in Windows**
    
    ```powershell
    # Set permanently in Windows
    [System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'your-key', 'User')
    ```
    

## Next Steps

1. **Enhance Obsidian Integration**: Create tools to automatically sync important notes
2. **Add Claude Code Integration**: Use for automated memory analysis
3. **Implement Memory Export**: Regular backups to your Obsidian vault
4. **Create Memory Dashboard**: Web UI for memory management
5. **Add Multi-User Support**: Separate memory spaces for different contexts