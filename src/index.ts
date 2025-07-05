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
import { ObsidianManager } from './obsidian-manager.js';

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
let memoryManager: MemoryManager;
let obsidianManager: ObsidianManager | null = null;

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
      },
      {
        name: 'read_obsidian_note',
        description: 'Read a specific note from the Obsidian vault',
        inputSchema: {
          type: 'object',
          properties: {
            notePath: {
              type: 'string',
              description: 'Path to the note relative to vault root (e.g., "Daily Notes/2024-01-01.md")'
            }
          },
          required: ['notePath']
        },
      },
      {
        name: 'list_obsidian_notes',
        description: 'List all notes in the vault or a specific folder',
        inputSchema: {
          type: 'object',
          properties: {
            folderPath: {
              type: 'string',
              description: 'Optional folder path to list notes from',
              default: ''
            }
          }
        },
      },
      {
        name: 'search_obsidian_vault',
        description: 'Search for notes in the Obsidian vault using semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
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
        name: 'write_obsidian_note',
        description: 'Create or update a note in the Obsidian vault',
        inputSchema: {
          type: 'object',
          properties: {
            notePath: {
              type: 'string',
              description: 'Path where to save the note'
            },
            content: {
              type: 'string',
              description: 'Content of the note'
            },
            frontmatter: {
              type: 'object',
              description: 'Optional frontmatter metadata',
              default: {}
            }
          },
          required: ['notePath', 'content']
        },
      },
      {
        name: 'get_obsidian_backlinks',
        description: 'Get all notes that link to a specific note',
        inputSchema: {
          type: 'object',
          properties: {
            notePath: {
              type: 'string',
              description: 'Path to the note to find backlinks for'
            }
          },
          required: ['notePath']
        },
      },
      {
        name: 'index_obsidian_vault',
        description: 'Index Obsidian vault notes into ChromaDB for fast semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            folders: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific folders to index (optional)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Only index notes with these tags (optional)'
            },
            forceReindex: {
              type: 'boolean',
              description: 'Force reindexing of all notes',
              default: false
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview what would be indexed without actually indexing',
              default: false
            }
          }
        },
      },
      {
        name: 'get_obsidian_index_status',
        description: 'Get the current status of the Obsidian vault index',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'clear_obsidian_index',
        description: 'Clear all indexed Obsidian notes from ChromaDB',
        inputSchema: {
          type: 'object',
          properties: {
            confirm: {
              type: 'boolean',
              description: 'Confirm clearing the index',
              default: false
            }
          },
          required: ['confirm']
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

      case 'read_obsidian_note': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        const note = await obsidianManager.readNote(args?.notePath as string);
        if (!note) {
          throw new Error(`Note not found: ${args?.notePath}`);
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                title: note.title,
                content: note.content,
                frontmatter: note.frontmatter,
                tags: note.tags,
                links: note.links,
                createdAt: note.createdAt,
                modifiedAt: note.modifiedAt
              }, null, 2)
            }
          ]
        };
      }

      case 'list_obsidian_notes': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        const notes = await obsidianManager.listNotes(args?.folderPath as string || '');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: notes.length,
                notes: notes
              }, null, 2)
            }
          ]
        };
      }

      case 'search_obsidian_vault': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        const results = await obsidianManager.searchNotes(
          args?.query as string,
          args?.limit as number || 10
        );
        const formattedResults = results.map(r => ({
          path: r.note.path,
          title: r.note.title,
          score: r.score.toFixed(3),
          excerpt: r.excerpt,
          tags: r.note.tags
        }));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedResults, null, 2)
            }
          ]
        };
      }

      case 'write_obsidian_note': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        const success = await obsidianManager.writeNote(
          args?.notePath as string,
          args?.content as string,
          args?.frontmatter as Record<string, any>
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success,
                notePath: args?.notePath,
                message: success ? 'Note saved successfully' : 'Failed to save note'
              }, null, 2)
            }
          ]
        };
      }

      case 'get_obsidian_backlinks': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        const backlinks = await obsidianManager.getBacklinks(args?.notePath as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                notePath: args?.notePath,
                backlinks: backlinks,
                count: backlinks.length
              }, null, 2)
            }
          ]
        };
      }

      case 'index_obsidian_vault': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        
        const options = {
          folders: args?.folders as string[] || undefined,
          tags: args?.tags as string[] || undefined,
          forceReindex: args?.forceReindex as boolean || false,
          dryRun: args?.dryRun as boolean || false
        };
        
        const progress = await obsidianManager.indexVault(options);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ...progress,
                estimatedCost: `$${progress.estimatedCost.toFixed(4)}`,
                message: options.dryRun ? 
                  'Dry run completed - no notes were actually indexed' : 
                  'Indexing completed successfully'
              }, null, 2)
            }
          ]
        };
      }

      case 'get_obsidian_index_status': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        
        const status = await obsidianManager.getIndexStatus();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ...status,
                percentIndexed: status.totalNotes > 0 ? 
                  `${((status.indexedNotes / status.totalNotes) * 100).toFixed(1)}%` : 
                  '0%'
              }, null, 2)
            }
          ]
        };
      }

      case 'clear_obsidian_index': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        
        if (!args?.confirm) {
          throw new Error('Please confirm clearing the index by setting confirm: true');
        }
        
        await obsidianManager.clearIndex();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Obsidian index cleared successfully'
              }, null, 2)
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
    
    // Initialize Obsidian manager if vault path is configured
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
    if (vaultPath) {
      console.error(`Initializing Obsidian manager with vault: ${vaultPath}`);
      obsidianManager = new ObsidianManager(vaultPath, memoryManager.getChromaClient());
      await obsidianManager.initialize();
      console.error('Obsidian manager initialized successfully');
    } else {
      console.error('Obsidian vault path not configured, skipping Obsidian integration');
    }
    
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