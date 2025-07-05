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
          args?.content as string,
          args?.context as string,
          args?.metadata as Record<string, any>
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
          args?.query as string,
          args?.context as string,
          args?.limit as number
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