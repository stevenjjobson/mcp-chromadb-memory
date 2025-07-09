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
import * as path from 'path';
import { config } from './config.js';
import { EnhancedMemoryManager } from './memory-manager-enhanced.js';
import { HybridMemoryManager } from './memory-manager-hybrid.js';
import { MemoryPatternService } from './services/memory-pattern-service.js';
import { 
  enhancedMemoryTools,
  handleSearchExact,
  handleSearchHybrid,
  handleGetCompressedContext,
  handleGetOptimizedMemory,
  searchExactSchema,
  searchHybridSchema,
  getCompressedContextSchema,
  getOptimizedMemorySchema
} from './tools/memory-tools-enhanced.js';
import { ObsidianManager } from './obsidian-manager.js';
import { SessionLogger } from './session-logger.js';
import { TemplateManager } from './template-manager.js';
import { VaultManager } from './vault-manager.js';
import { StateManager } from './state-manager.js';
import { VaultStructureManager } from './vault-structure-manager.js';
import { VaultIndexService } from './services/vault-index-service.js';
import { MemoryHealthMonitor } from './services/memory-health-monitor.js';
import { VaultFileWatcher } from './services/vault-file-watcher.js';
import { MigrationService } from './services/migration-service.js';
import { 
  StartupSummary, 
  SystemHealthSummary, 
  StartupContext,
  TaskSummary,
  HealthStatus 
} from './types/vault-index.types.js';
import { CodeIntelligenceTools } from './tools/code-intelligence-tools.js';
import { sanitizeMetadata } from './utils/metadata-validator.js';

// Handle Windows-specific process signals
if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stderr  // Changed to stderr to avoid interfering with MCP protocol
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
let memoryManager: EnhancedMemoryManager | HybridMemoryManager;
let memoryPatternService: MemoryPatternService | null = null;
let obsidianManager: ObsidianManager | null = null;
let sessionLogger: SessionLogger | null = null;
let vaultManager: VaultManager | null = null;
let stateManager: StateManager | null = null;
let templateManager: TemplateManager | null = null;
let structureManager: VaultStructureManager | null = null;
let vaultIndexService: VaultIndexService | null = null;
let memoryHealthMonitor: MemoryHealthMonitor | null = null;
let vaultFileWatcher: VaultFileWatcher | null = null;
let migrationService: MigrationService | null = null;
let codeIntelligenceTools: CodeIntelligenceTools | null = null;

// FIXED: Create a function to build tools dynamically
function buildToolsList() {
  const baseTools = [
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
            description: 'Context category (e.g., general, user_preference, task_critical, obsidian_note, code_symbol, code_pattern, code_decision, code_snippet, code_error)',
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
    },
    // Enhanced memory tools
    {
      name: 'search_exact',
      description: 'Search for memories using exact string matching',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Exact search query'
          },
          field: {
            type: 'string',
            description: 'Optional metadata field to search in'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10
          }
        },
        required: ['query']
      },
    },
    {
      name: 'search_hybrid',
      description: 'Search using both exact and semantic matching with configurable weights',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          context: {
            type: 'string',
            description: 'Optional context filter'
          },
          exactWeight: {
            type: 'number',
            description: 'Weight for exact match (0-1)',
            default: 0.4
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10
          }
        },
        required: ['query']
      },
    },
    {
      name: 'get_compressed_context',
      description: 'Get token-optimized context from relevant memories',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Query to find relevant memories'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens for compressed context',
            default: 500
          },
          preserveStructure: {
            type: 'boolean',
            description: 'Preserve document structure',
            default: true
          },
          smartFiltering: {
            type: 'boolean',
            description: 'Use smart filtering',
            default: true
          }
        },
        required: ['query']
      },
    },
    // Add other base tools here...
  ];

  // Vault management tools (if available)
  if (vaultManager) {
    baseTools.push(
      {
        name: 'register_vault',
        description: 'Register a new vault for multi-project support',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Vault name'
            },
            path: {
              type: 'string',
              description: 'Vault path'
            },
            type: {
              type: 'string',
              enum: ['project', 'personal', 'team'],
              description: 'Vault type',
              default: 'personal'
            }
          },
          required: ['name', 'path']
        },
      },
      {
        name: 'switch_vault',
        description: 'Switch to a different vault',
        inputSchema: {
          type: 'object',
          properties: {
            vaultId: {
              type: 'string',
              description: 'ID of the vault to switch to'
            }
          },
          required: ['vaultId']
        },
      },
      // Add other vault tools...
    );
  }

  // State management tools (if available)
  if (stateManager) {
    baseTools.push(
      {
        name: 'capture_state',
        description: 'Capture current working context and memory state',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'State name'
            },
            description: {
              type: 'string',
              description: 'Optional description'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags'
            },
            importance: {
              type: 'number',
              description: 'Importance score (0-1)',
              default: 0.7
            },
            expiresInDays: {
              type: 'number',
              description: 'Days until expiration'
            }
          },
          required: ['name']
        },
      },
      // Add other state tools...
    );
  }

  // Code Intelligence Tools (if available)
  if (codeIntelligenceTools) {
    const ciTools = codeIntelligenceTools.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.inputSchema.shape).map(([key, schema]: [string, any]) => [
            key,
            {
              type: schema._def.typeName === 'ZodString' ? 'string' : 
                    schema._def.typeName === 'ZodNumber' ? 'number' : 
                    schema._def.typeName === 'ZodBoolean' ? 'boolean' : 
                    schema._def.typeName === 'ZodArray' ? 'array' : 'object',
              description: schema.description,
              ...(schema._def.defaultValue !== undefined ? { default: schema._def.defaultValue() } : {})
            }
          ])
        ),
        required: Object.entries(tool.inputSchema.shape)
          .filter(([_, schema]: [string, any]) => !schema.isOptional())
          .map(([key]) => key)
      }
    }));
    baseTools.push(...ciTools);
  }

  return baseTools;
}

// FIXED: Update the handler to build tools dynamically
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: buildToolsList()
  };
});

// Call tool handler remains the same...
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
      
      // Enhanced memory tools handlers
      case 'search_exact': {
        const result = await handleSearchExact(
          memoryManager as EnhancedMemoryManager,
          searchExactSchema.parse(args)
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'search_hybrid': {
        const result = await handleSearchHybrid(
          memoryManager as EnhancedMemoryManager,
          searchHybridSchema.parse(args)
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // Code intelligence tool handlers
      default: {
        // Check if it's a code intelligence tool
        if (codeIntelligenceTools) {
          const tool = codeIntelligenceTools.getTools().find(t => t.name === name);
          if (tool) {
            const result = await codeIntelligenceTools.handleToolCall(name, args);
            return {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            };
          }
        }

        throw new Error(`Unknown tool: ${name}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            tool: name
          }, null, 2)
        }
      ]
    };
  }
});

// Main initialization function
async function main() {
  try {
    console.error('Initializing AI Memory MCP Server...');
    console.error(`Platform: ${process.platform}`);
    console.error(`Docker mode: ${config.isDocker}`);
    
    // Initialize memory manager - use hybrid if enabled
    if (config.useHybridStorage) {
      console.error('Using Hybrid Memory Manager (PostgreSQL + ChromaDB)');
      memoryManager = new HybridMemoryManager(config);
    } else {
      console.error('Using Enhanced Memory Manager (ChromaDB only)');
      memoryManager = new EnhancedMemoryManager(config);
    }
    await memoryManager.initialize();
    
    console.error('Enhanced memory manager initialized successfully');
    
    // Initialize memory pattern service
    memoryPatternService = new MemoryPatternService(memoryManager);
    console.error('Memory pattern service initialized');
    
    // Initialize code intelligence tools
    codeIntelligenceTools = new CodeIntelligenceTools(memoryManager);
    console.error('Code intelligence tools initialized');
    
    // Initialize other services...
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running on stdio transport');
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Handle errors and cleanup
process.on('SIGINT', async () => {
  console.error('Received SIGINT, shutting down gracefully...');
  
  // Save session if configured
  if (sessionLogger && process.env.SESSION_LOGGING_SAVE_ON_EXIT === 'true') {
    try {
      await sessionLogger.saveSession();
      console.error('Session saved successfully');
    } catch (error) {
      console.error('Failed to save session on exit:', error);
    }
  }
  
  // Cleanup
  if (migrationService) {
    await migrationService.stop();
  }
  
  if (vaultFileWatcher) {
    vaultFileWatcher.stop();
  }
  
  await server.close();
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});