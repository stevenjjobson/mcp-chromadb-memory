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
import { MemoryManager } from './memory-manager.js';
import { ObsidianManager } from './obsidian-manager.js';
import { SessionLogger } from './session-logger.js';
import { TemplateManager } from './template-manager.js';
import { VaultManager } from './vault-manager.js';
import { VaultStructureManager } from './vault-structure-manager.js';
import { VaultIndexService } from './services/vault-index-service.js';
import { MemoryHealthMonitor } from './services/memory-health-monitor.js';
import { VaultFileWatcher } from './services/vault-file-watcher.js';
import { 
  StartupSummary, 
  SystemHealthSummary, 
  StartupContext,
  TaskSummary,
  HealthStatus 
} from './types/vault-index.types.js';

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
let sessionLogger: SessionLogger | null = null;
let vaultManager: VaultManager | null = null;
let templateManager: TemplateManager | null = null;
let structureManager: VaultStructureManager | null = null;
let vaultIndexService: VaultIndexService | null = null;
let memoryHealthMonitor: MemoryHealthMonitor | null = null;
let vaultFileWatcher: VaultFileWatcher | null = null;

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
      },
      {
        name: 'start_session_logging',
        description: 'Start logging this Claude Code session to Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name for this session',
              default: 'General'
            }
          }
        },
      },
      {
        name: 'save_session_log',
        description: 'Save the current session log to Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Optional manual summary of the session'
            }
          }
        },
      },
      {
        name: 'log_session_event',
        description: 'Log a specific event or decision to the session',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Type of event (user, assistant, tool, decision, achievement)',
              enum: ['user', 'assistant', 'tool', 'decision', 'achievement']
            },
            content: {
              type: 'string',
              description: 'Content to log'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
              default: {}
            }
          },
          required: ['type', 'content']
        },
      },
      {
        name: 'import_template',
        description: 'Import a documentation template from external source',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'URL of the template to import'
            },
            category: {
              type: 'string',
              description: 'Template category',
              enum: ['session', 'decision', 'pattern', 'solution', 'snippet', 'custom']
            },
            variables: {
              type: 'object',
              description: 'Variables to apply to the template (optional)'
            },
            saveAs: {
              type: 'string',
              description: 'Filename to save the generated document (optional)'
            }
          },
          required: ['source']
        },
      },
      {
        name: 'list_templates',
        description: 'List all available templates',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category (optional)'
            },
            source: {
              type: 'string',
              description: 'Filter by source (optional)'
            }
          }
        },
      },
      {
        name: 'apply_template',
        description: 'Apply a template with given variables',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'string',
              description: 'ID of the template to apply'
            },
            variables: {
              type: 'object',
              description: 'Variables to apply to the template'
            },
            outputPath: {
              type: 'string',
              description: 'Path where to save the generated document'
            }
          },
          required: ['templateId', 'variables', 'outputPath']
        },
      },
      {
        name: 'configure_template_webhook',
        description: 'Configure a webhook source for templates',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for this webhook source'
            },
            url: {
              type: 'string',
              description: 'Webhook URL'
            },
            authType: {
              type: 'string',
              description: 'Authentication type',
              enum: ['none', 'bearer', 'api-key', 'oauth']
            },
            authCredentials: {
              type: 'string',
              description: 'Authentication credentials (optional)'
            },
            syncInterval: {
              type: 'number',
              description: 'Sync interval in minutes (optional)'
            }
          },
          required: ['name', 'url']
        },
      },
      {
        name: 'sync_templates',
        description: 'Synchronize templates from all configured sources',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'import_vault_structure',
        description: 'Import a complete vault structure with templates and hooks',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'URL or path to structure definition'
            },
            applyImmediately: {
              type: 'boolean',
              description: 'Apply structure immediately after import',
              default: false
            },
            targetPath: {
              type: 'string',
              description: 'Target path for structure (defaults to active vault)'
            }
          },
          required: ['source']
        },
      },
      {
        name: 'generate_vault_structure',
        description: 'Generate folder hierarchy from a structure template',
        inputSchema: {
          type: 'object',
          properties: {
            structureId: {
              type: 'string',
              description: 'ID or name of the structure to generate'
            },
            targetPath: {
              type: 'string',
              description: 'Target path for generation'
            },
            options: {
              type: 'object',
              properties: {
                skipExisting: {
                  type: 'boolean',
                  description: 'Skip folders that already exist',
                  default: true
                },
                dryRun: {
                  type: 'boolean',
                  description: 'Preview without making changes',
                  default: false
                },
                applyTemplates: {
                  type: 'boolean',
                  description: 'Apply templates to folders',
                  default: true
                }
              }
            }
          },
          required: ['targetPath']
        },
      },
      {
        name: 'apply_folder_hooks',
        description: 'Apply hooks to existing folder structure',
        inputSchema: {
          type: 'object',
          properties: {
            folderPath: {
              type: 'string',
              description: 'Folder path to apply hooks to'
            },
            hookIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific hook IDs to apply (optional)'
            }
          },
          required: ['folderPath']
        },
      },
      {
        name: 'get_vault_index',
        description: 'Retrieve the current vault index with system health and statistics',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'Output format (json or markdown)',
              enum: ['json', 'markdown'],
              default: 'json'
            }
          }
        },
      },
      {
        name: 'check_memory_health',
        description: 'Run memory system health diagnostics',
        inputSchema: {
          type: 'object',
          properties: {
            includeRecommendations: {
              type: 'boolean',
              description: 'Include optimization recommendations',
              default: true
            }
          }
        },
      },
      {
        name: 'regenerate_index',
        description: 'Force regeneration of the vault index',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'get_startup_summary',
        description: 'Get the startup summary information',
        inputSchema: {
          type: 'object',
          properties: {}
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

      case 'start_session_logging': {
        if (!obsidianManager) {
          throw new Error('Obsidian vault not configured');
        }
        
        const project = args?.project as string || 'General';
        sessionLogger = new SessionLogger(obsidianManager, project);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Started logging session for project: ${project}`,
                sessionId: sessionLogger.getSessionSummary().startTime.toISOString()
              }, null, 2)
            }
          ]
        };
      }

      case 'save_session_log': {
        if (!sessionLogger) {
          throw new Error('No active session to save. Use start_session_logging first.');
        }
        
        const summary = args?.summary as string || undefined;
        const notePath = await sessionLogger.saveSession(summary);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Session saved to Obsidian',
                notePath,
                summary: sessionLogger.getSessionSummary()
              }, null, 2)
            }
          ]
        };
      }

      case 'log_session_event': {
        if (!sessionLogger) {
          throw new Error('No active session. Use start_session_logging first.');
        }
        
        const eventType = args?.type as string;
        const content = args?.content as string;
        
        switch (eventType) {
          case 'user':
            sessionLogger.logUserMessage(content);
            break;
          case 'assistant':
            sessionLogger.logAssistantMessage(content);
            break;
          case 'tool':
            sessionLogger.logToolUse((args?.metadata as any)?.toolName || 'unknown', content);
            break;
          case 'decision':
            sessionLogger.getSessionSummary().decisions.push(content);
            break;
          case 'achievement':
            sessionLogger.getSessionSummary().achievements.push(content);
            break;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Logged ${eventType} event`,
                currentSummary: {
                  topics: sessionLogger.getSessionSummary().mainTopics.length,
                  tools: sessionLogger.getSessionSummary().toolsUsed.size,
                  decisions: sessionLogger.getSessionSummary().decisions.length,
                  achievements: sessionLogger.getSessionSummary().achievements.length
                }
              }, null, 2)
            }
          ]
        };
      }

      case 'import_template': {
        if (!templateManager) {
          throw new Error('Template manager not initialized');
        }
        
        const template = await templateManager.importTemplate({
          type: 'webhook',
          url: args?.source as string
        });
        
        // If variables provided, apply template immediately
        if (args?.variables) {
          const content = await templateManager.applyTemplate(
            template.id, 
            args.variables as Record<string, any>
          );
          
          if (args?.saveAs && vaultManager) {
            const filename = args.saveAs as string;
            await vaultManager.saveDocument(filename, content);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    template: {
                      id: template.id,
                      name: template.name,
                      category: template.category
                    },
                    documentPath: filename,
                    message: 'Template imported and applied successfully'
                  }, null, 2)
                }
              ]
            };
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                template: {
                  id: template.id,
                  name: template.name,
                  description: template.description,
                  version: template.version,
                  category: template.category,
                  variables: template.variables,
                  tags: template.metadata.tags
                },
                message: 'Template imported successfully'
              }, null, 2)
            }
          ]
        };
      }

      case 'list_templates': {
        if (!templateManager) {
          throw new Error('Template manager not initialized');
        }
        
        const templates = await templateManager.listTemplates({
          category: args?.category as string,
          source: args?.source as string
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: templates.length,
                templates: templates.map(t => ({
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  version: t.version,
                  category: t.category,
                  source: t.source.url,
                  variables: t.variables.length,
                  tags: t.metadata.tags
                }))
              }, null, 2)
            }
          ]
        };
      }

      case 'apply_template': {
        if (!templateManager || !vaultManager) {
          throw new Error('Template manager or vault manager not initialized');
        }
        
        const content = await templateManager.applyTemplate(
          args?.templateId as string,
          args?.variables as Record<string, any>
        );
        
        const outputPath = args?.outputPath as string;
        await vaultManager.saveDocument(outputPath, content);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                path: outputPath,
                preview: content.substring(0, 200) + '...',
                message: 'Template applied and saved successfully'
              }, null, 2)
            }
          ]
        };
      }

      case 'configure_template_webhook': {
        if (!templateManager) {
          throw new Error('Template manager not initialized');
        }
        
        const webhookId = await templateManager.registerWebhook({
          name: args?.name as string,
          url: args?.url as string,
          authType: (args?.authType as any) || 'none',
          authCredentials: args?.authCredentials as string,
          syncInterval: args?.syncInterval as number
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                webhookId,
                message: 'Webhook configured successfully'
              }, null, 2)
            }
          ]
        };
      }

      case 'sync_templates': {
        if (!templateManager) {
          throw new Error('Template manager not initialized');
        }
        
        const report = await templateManager.syncTemplates();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                synced: report.synced,
                updated: report.updated,
                failed: report.failed,
                sources: report.sources,
                errors: report.errors,
                message: `Synchronized ${report.synced + report.updated} templates`
              }, null, 2)
            }
          ]
        };
      }

      case 'import_vault_structure': {
        if (!structureManager) {
          throw new Error('Vault structure manager not initialized');
        }
        
        const structure = await structureManager.importStructure(args?.source as string);
        
        if (args?.applyImmediately) {
          const targetPath = args?.targetPath as string || vaultManager?.getActiveVault().path || '.';
          const report = await structureManager.generateStructure(targetPath, {
            applyTemplates: true,
            registerHooks: true
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  structure: {
                    name: structure.name,
                    version: structure.version,
                    folders: structure.folders.length
                  },
                  report: {
                    foldersCreated: report.foldersCreated,
                    templatesApplied: report.templatesApplied,
                    hooksRegistered: report.hooksRegistered,
                    errors: report.errors
                  }
                }, null, 2)
              }
            ]
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                structure: {
                  name: structure.name,
                  version: structure.version,
                  description: structure.description,
                  folders: structure.folders.length,
                  templates: structure.templates.length,
                  hooks: structure.hooks.length
                },
                message: 'Structure imported successfully'
              }, null, 2)
            }
          ]
        };
      }

      case 'generate_vault_structure': {
        if (!structureManager) {
          throw new Error('Vault structure manager not initialized');
        }
        
        const currentStructure = structureManager.getStructure();
        if (!currentStructure || (args?.structureId && currentStructure.name !== args.structureId)) {
          throw new Error('No matching structure loaded. Use import_vault_structure first.');
        }
        
        const report = await structureManager.generateStructure(
          args?.targetPath as string,
          args?.options as any || {}
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                report: {
                  foldersCreated: report.foldersCreated,
                  filesCreated: report.filesCreated,
                  templatesApplied: report.templatesApplied,
                  skipped: report.skipped.length,
                  errors: report.errors
                },
                message: `Generated ${report.foldersCreated} folders with ${report.templatesApplied} templates`
              }, null, 2)
            }
          ]
        };
      }

      case 'apply_folder_hooks': {
        if (!structureManager) {
          throw new Error('Vault structure manager not initialized');
        }
        
        const structure = structureManager.getStructure();
        if (!structure) {
          throw new Error('No structure loaded');
        }
        
        const folderPath = args?.folderPath as string;
        const hookIds = args?.hookIds as string[] || structure.hooks.map(h => h.id);
        
        const results = [];
        for (const hookId of hookIds) {
          const result = await structureManager.executeHook(hookId, {
            targetPath: folderPath,
            event: 'manual',
            variables: {},
            structure
          });
          results.push({ hookId, ...result });
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                hooksApplied: results.length,
                results: results.map(r => ({
                  hookId: r.hookId,
                  success: r.success,
                  message: r.message
                }))
              }, null, 2)
            }
          ]
        };
      }
      
      case 'get_vault_index': {
        if (!vaultIndexService) {
          throw new Error('Vault index service not initialized');
        }
        
        const index = await vaultIndexService.generateIndex();
        const format = args?.format as string || 'json';
        
        if (format === 'markdown') {
          // Return the path to the markdown file
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  indexPath: 'Project_Context/vault/VAULT_INDEX.md',
                  message: 'Vault index available at the specified path',
                  summary: {
                    health: index.health.overall,
                    totalMemories: index.activeContext.recentMemories.total,
                    activeTasks: index.activeContext.activeTasks.length
                  }
                }, null, 2)
              }
            ]
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(index, null, 2)
            }
          ]
        };
      }
      
      case 'check_memory_health': {
        if (!memoryHealthMonitor) {
          throw new Error('Memory health monitor not initialized');
        }
        
        const health = await memoryHealthMonitor.checkMemoryHealth();
        const includeRecommendations = args?.includeRecommendations !== false;
        
        const response: any = {
          success: true,
          health: {
            fragmentation: {
              status: health.fragmentation.status,
              percentage: health.fragmentation.percentage,
              details: health.fragmentation.details
            },
            duplicates: {
              count: health.duplicates.count,
              groups: health.duplicates.groups.length
            },
            orphaned: {
              count: health.orphaned.count,
              examples: health.orphaned.memories.slice(0, 3)
            },
            performance: health.performance
          }
        };
        
        if (includeRecommendations) {
          response.recommendations = health.recommendations;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }
      
      case 'regenerate_index': {
        if (!vaultIndexService) {
          throw new Error('Vault index service not initialized');
        }
        
        await vaultIndexService.generateAndSaveIndex();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Vault index regenerated successfully',
                indexPath: 'Project_Context/vault/VAULT_INDEX.md',
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }
      
      case 'get_startup_summary': {
        const summary = await performStartupHealthCheck();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                summary: {
                  version: summary.version,
                  timestamp: summary.timestamp,
                  health: summary.health,
                  context: summary.context,
                  recommendations: summary.recommendations
                }
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
  
  // Auto-save session if configured
  if (sessionLogger && config.sessionLoggingSaveOnExit) {
    try {
      console.error('Auto-saving session log...');
      const notePath = await sessionLogger.saveSession('Session ended (auto-saved on exit)');
      console.error(`Session saved to: ${notePath}`);
    } catch (error) {
      console.error('Failed to auto-save session:', error);
    }
  }
  
  if (vaultFileWatcher) {
    await vaultFileWatcher.stop();
  }
  
  if (vaultIndexService) {
    await vaultIndexService.stop();
  }
  
  if (memoryManager) {
    await memoryManager.close();
  }
  process.exit(0);
});

// Startup health check functions
async function performStartupHealthCheck(): Promise<StartupSummary> {
  const summary: StartupSummary = {
    timestamp: new Date(),
    version: config.serverVersion,
    health: {
      overall: 'healthy' as HealthStatus,
      components: {},
      warnings: [],
      errors: []
    },
    context: {
      totalMemories: 0,
      recentMemories: 0,
      workingMemoryLoad: 0,
      activeTasks: [],
      projectSummary: 'MCP ChromaDB Memory Platform - Cognitive State Management'
    },
    recommendations: []
  };
  
  try {
    // Check ChromaDB connection
    const chromaHealth = await memoryManager.isConnected();
    summary.health.components['ChromaDB'] = chromaHealth ? 'Connected' : 'Failed';
    if (!chromaHealth) {
      summary.health.errors.push('ChromaDB connection failed');
      summary.health.overall = 'error' as HealthStatus;
    }
    
    // Check Obsidian vault
    if (obsidianManager) {
      summary.health.components['Obsidian Vault'] = 'Connected';
    } else {
      summary.health.components['Obsidian Vault'] = 'Not configured';
      summary.health.warnings.push('Obsidian vault not configured');
    }
    
    // Check session logger
    if (sessionLogger) {
      const sessionSummary = sessionLogger.getSessionSummary();
      summary.health.components['Session Logger'] = `Active (${sessionSummary.project})`;
    } else {
      summary.health.components['Session Logger'] = 'Not started';
    }
    
    // Get memory statistics
    if (chromaHealth && memoryManager) {
      try {
        const chromaClient = memoryManager.getChromaClient();
        const collection = await chromaClient.getCollection({
          name: process.env.MEMORY_COLLECTION_NAME || 'ai_memories'
        });
        
        const result = await collection.get();
        const totalMemories = result.ids?.length || 0;
        
        // Count recent memories (last 24 hours)
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        let recentMemories = 0;
        
        result.metadatas?.forEach(metadata => {
          if (metadata && metadata.timestamp) {
            const timestamp = metadata.timestamp;
            if (typeof timestamp === 'string' || typeof timestamp === 'number') {
              const age = now - new Date(timestamp).getTime();
              if (age < dayInMs) {
                recentMemories++;
              }
            }
          }
        });
        
        summary.context.totalMemories = totalMemories;
        summary.context.recentMemories = recentMemories;
        // Calculate working memory load as percentage of recent vs total
        summary.context.workingMemoryLoad = totalMemories > 0 
          ? Math.round((recentMemories / totalMemories) * 100)
          : 0;
      } catch (error) {
        console.error('Error getting memory statistics:', error);
        // Keep defaults if error
      }
    }
    
    // Get active tasks
    if (vaultManager) {
      try {
        // Try to read from Implementation Roadmap
        const roadmapPath = path.join(vaultManager.getVaultPath(), 'Project_Context', 'Implementation Roadmap.md');
        const { readFile } = await import('fs/promises');
        
        try {
          const content = await readFile(roadmapPath, 'utf-8');
          const tasks: TaskSummary[] = [];
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            const incompleteMatch = line.match(/^[\s-]*\[ \]\s+(.+)/);
            if (incompleteMatch && tasks.length < 3) {
              tasks.push({
                id: (tasks.length + 1).toString(),
                title: incompleteMatch[1].trim().substring(0, 80),
                status: 'pending',
                priority: 'medium'
              });
            }
          });
          
          if (tasks.length > 0) {
            summary.context.activeTasks = tasks;
          }
        } catch (error) {
          // Roadmap not found, keep defaults
        }
      } catch (error) {
        console.error('Error reading tasks:', error);
      }
    }
    
    // Generate recommendations
    if (summary.context.workingMemoryLoad > 80) {
      summary.recommendations.push('Consider consolidating working memory');
    }
    
    if (summary.health.warnings.length === 0 && summary.health.errors.length === 0) {
      summary.health.overall = 'healthy' as HealthStatus;
    } else if (summary.health.errors.length > 0) {
      summary.health.overall = 'error' as HealthStatus;
    } else {
      summary.health.overall = 'warning' as HealthStatus;
    }
    
  } catch (error) {
    summary.health.overall = 'error' as HealthStatus;
    summary.health.errors.push(`Health check error: ${error}`);
  }
  
  return summary;
}

async function displayStartupSummary(): Promise<void> {
  const summary = await performStartupHealthCheck();
  
  const healthIcon = summary.health.overall === 'healthy' ? '✅' : 
                     summary.health.overall === 'warning' ? '⚠️' : '❌';
  
  // Format the startup message
  let message = `\n🚀 **MCP ChromaDB Memory Platform Started**\n\n`;
  message += `📊 **System Health**: ${healthIcon} ${summary.health.overall}\n`;
  
  // Component status
  Object.entries(summary.health.components).forEach(([component, status]) => {
    message += `- ${component}: ${status}\n`;
  });
  
  message += `\n🧠 **Memory Status**\n`;
  message += `- Total Memories: ${summary.context.totalMemories}\n`;
  message += `- Recent (24h): ${summary.context.recentMemories}\n`;
  message += `- Working Memory Load: ${summary.context.workingMemoryLoad}%\n`;
  
  if (vaultManager) {
    message += `\n📁 **Vault Index**: Check Project_Context/vault/VAULT_INDEX.md for details\n`;
  }
  
  if (summary.context.activeTasks.length > 0) {
    message += `\n✅ **Active Tasks**\n`;
    summary.context.activeTasks.forEach(task => {
      const icon = task.status === 'completed' ? '✅' : 
                   task.status === 'in_progress' ? '🔄' : '⏸️';
      message += `${icon} ${task.title}\n`;
    });
  }
  
  if (summary.recommendations.length > 0) {
    message += `\n💡 **Recommendations**\n`;
    summary.recommendations.forEach(rec => {
      message += `- ${rec}\n`;
    });
  }
  
  message += `\nReady to continue your work!\n`;
  
  // Log the startup summary
  console.error(message);
  
  // If session logger is active, log the startup event
  if (sessionLogger) {
    sessionLogger.logAssistantMessage(`System started successfully. ${summary.health.components['ChromaDB']} | Memory: ${summary.context.totalMemories} total`);
  }
}

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
      
      // Initialize vault manager
      vaultManager = new VaultManager(obsidianManager);
      await vaultManager.initialize();
      console.error('Vault manager initialized successfully');
      
      // Initialize template manager
      if (vaultManager) {
        console.error('Initializing template manager...');
        templateManager = new TemplateManager(vaultManager, {
          cacheDir: path.join(vaultPath, '.template-cache'),
          maxTemplateSize: parseInt(process.env.TEMPLATE_MAX_SIZE || '1048576'), // 1MB default
          securityScan: process.env.TEMPLATE_SECURITY_SCAN !== 'false',
          allowedSources: process.env.TEMPLATE_ALLOWED_SOURCES?.split(',').map(s => s.trim())
        });
        await templateManager.initialize();
        console.error('Template manager initialized successfully');
        
        // Initialize structure manager
        console.error('Initializing vault structure manager...');
        structureManager = new VaultStructureManager(templateManager, vaultManager);
        await structureManager.initialize();
        console.error('Vault structure manager initialized successfully');
      }
    } else {
      console.error('Obsidian vault path not configured, skipping Obsidian integration');
    }
    
    // Auto-start session logging if configured
    if (config.autoStartSessionLogging && obsidianManager) {
      const projectName = config.sessionLoggingProjectName || 'MCP ChromaDB Memory';
      console.error(`Auto-starting session logging for project: ${projectName}`);
      sessionLogger = new SessionLogger(obsidianManager, projectName);
      console.error('Session logging started automatically');
    }
    
    // Initialize vault index service and memory health monitor
    if (vaultManager && memoryManager) {
      console.error('Initializing vault index service...');
      vaultIndexService = new VaultIndexService(vaultManager, memoryManager, sessionLogger || undefined);
      await vaultIndexService.initialize();
      console.error('Vault index service initialized successfully');
      
      console.error('Initializing memory health monitor...');
      memoryHealthMonitor = new MemoryHealthMonitor(memoryManager, memoryManager.getChromaClient());
      console.error('Memory health monitor initialized successfully');
      
      // Initialize file watcher for real-time updates
      const watcherVaultPath = obsidianManager?.getVaultPath();
      if (watcherVaultPath && vaultIndexService) {
        console.error('Initializing vault file watcher...');
        vaultFileWatcher = new VaultFileWatcher(watcherVaultPath, vaultIndexService);
        await vaultFileWatcher.start();
        console.error('Vault file watcher started successfully');
      }
    }
    
    // Display startup summary
    await displayStartupSummary();
    
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