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
import { DualVaultManager } from './vault-manager-dual.js';
import { TemplateService } from './services/template-service.js';
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
import { ToolRegistry } from './tools/tool-registry.js';
import { 
  dualVaultTools,
  handlePromoteToCore,
  handleGetVaultStats,
  handleSwitchProject,
  handleSearchCrossVault,
  handleCategorizeMemory
} from './tools/dual-vault-tools.js';

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
let dualVaultManager: DualVaultManager | null = null;
let stateManager: StateManager | null = null;
let templateManager: TemplateManager | null = null;
let structureManager: VaultStructureManager | null = null;
let vaultIndexService: VaultIndexService | null = null;
let memoryHealthMonitor: MemoryHealthMonitor | null = null;
let vaultFileWatcher: VaultFileWatcher | null = null;
let migrationService: MigrationService | null = null;
let codeIntelligenceTools: CodeIntelligenceTools | null = null;

// Initialize tool registry
const toolRegistry = new ToolRegistry();

// Update the tools list in ListToolsRequestSchema handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Use tool registry to get all available tools
  return {
    tools: toolRegistry.getTools()
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
        // Sanitize metadata before storing
        const metadata = args?.metadata ? sanitizeMetadata(args.metadata as Record<string, any>) : undefined;
        
        // Handle vault routing if dual vault is enabled
        if (dualVaultManager && args?.vault) {
          const vaultParam = args.vault as string;
          
          // If auto mode, categorize the content
          if (vaultParam === 'auto') {
            const categorization = await dualVaultManager.categorizeContent(
              args.content as string,
              metadata
            );
            
            // Add vault info to metadata
            const enhancedMetadata = {
              ...metadata,
              vault: categorization.vault,
              categorizationConfidence: categorization.confidence
            };
            
            // Store the memory with vault info
            const storeResult = await memoryManager.storeMemory(
              args.content as string,
              args.context as string,
              enhancedMetadata
            );
            
            // Also save to appropriate vault as a note
            const notePath = `memories/${storeResult.id}.md`;
            const noteContent = `# Memory: ${storeResult.id}\n\n${args.content}\n\n---\n\nContext: ${args.context || 'general'}\nVault: ${categorization.vault}\nConfidence: ${Math.round(categorization.confidence * 100)}%\nReasoning: ${categorization.reasoning}`;
            
            await dualVaultManager.saveDocument(notePath, noteContent, {
              vault: categorization.vault
            });
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    ...storeResult,
                    vault: categorization.vault,
                    categorization: {
                      confidence: `${Math.round(categorization.confidence * 100)}%`,
                      reasoning: categorization.reasoning
                    }
                  }, null, 2)
                }
              ]
            };
          } else {
            // Direct vault specified
            const targetVault = vaultParam as 'core' | 'project';
            const enhancedMetadata = {
              ...metadata,
              vault: targetVault
            };
            
            const storeResult = await memoryManager.storeMemory(
              args.content as string,
              args.context as string,
              enhancedMetadata
            );
            
            // Save to specified vault
            const notePath = `memories/${storeResult.id}.md`;
            const noteContent = `# Memory: ${storeResult.id}\n\n${args.content}\n\n---\n\nContext: ${args.context || 'general'}\nVault: ${targetVault}`;
            
            await dualVaultManager.saveDocument(notePath, noteContent, {
              vault: targetVault
            });
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    ...storeResult,
                    vault: targetVault
                  }, null, 2)
                }
              ]
            };
          }
        } else {
          // Fallback to standard memory storage
          const storeResult = await memoryManager.storeMemory(
            args?.content as string,
            args?.context as string,
            metadata
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
      }
        
      case 'recall_memories': {
        // Handle vault-aware search if dual vault is enabled
        if (dualVaultManager && args?.vault && args.vault !== 'both') {
          // Search specific vault or cross-vault
          const vaultParam = args.vault as string;
          
          if (vaultParam === 'both') {
            // Cross-vault search
            const vaultResults = await dualVaultManager.searchDocuments(
              args.query as string,
              {
                vaults: ['core', 'project'],
                strategy: 'weighted',
                limit: args.limit as number || 5
              }
            );
            
            // Also search in memory manager
            const memories = await memoryManager.searchSemantic(
              args?.query as string,
              args?.context as string,
              args?.limit as number
            );
            
            // Track access patterns
            if (memoryPatternService) {
              for (const result of memories) {
                await memoryPatternService.trackAccess(result.memory.id);
              }
            }
            
            // Combine results
            const formattedMemories = memories.map(m => ({
              source: 'memory',
              vault: m.memory.metadata?.vault || 'unknown',
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
            
            const vaultMemories = vaultResults.map(r => ({
              source: 'vault',
              vault: r.vault,
              path: r.path,
              content: r.content.substring(0, 500) + '...',
              score: r.score.toFixed(3)
            }));
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    memories: formattedMemories,
                    vaultResults: vaultMemories,
                    totalResults: formattedMemories.length + vaultMemories.length
                  }, null, 2)
                }
              ]
            };
          } else {
            // Search specific vault only
            const targetVault = vaultParam as 'core' | 'project';
            
            // Filter memories by vault metadata
            const allMemories = await memoryManager.searchSemantic(
              args?.query as string,
              args?.context as string,
              (args?.limit as number || 5) * 2 // Get more to filter
            );
            
            const filteredMemories = allMemories.filter(m => 
              m.memory.metadata?.vault === targetVault
            ).slice(0, args?.limit as number || 5);
            
            // Track access patterns
            if (memoryPatternService) {
              for (const result of filteredMemories) {
                await memoryPatternService.trackAccess(result.memory.id);
              }
            }
            
            const formattedMemories = filteredMemories.map(m => ({
              vault: targetVault,
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
                  text: JSON.stringify({
                    vault: targetVault,
                    memories: formattedMemories
                  }, null, 2)
                }
              ]
            };
          }
        } else {
          // Standard memory search (backward compatible)
          const memories = await memoryManager.searchSemantic(
            args?.query as string,
            args?.context as string,
            args?.limit as number
          );
          
          // Track access patterns
          if (memoryPatternService) {
            for (const result of memories) {
              await memoryPatternService.trackAccess(result.memory.id);
            }
          }
          
          const formattedMemories = memories.map(m => ({
            content: m.memory.content,
            context: m.memory.context,
            importance: m.memory.importance.toFixed(2),
            timestamp: m.memory.timestamp,
            vault: m.memory.metadata?.vault || 'unknown',
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
                  indexPath: './vault/VAULT_INDEX.md',
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
                indexPath: './vault/VAULT_INDEX.md',
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

      // Enhanced memory tool handlers
      case 'search_exact': {
        const parsedArgs = searchExactSchema.parse(args);
        const result = await handleSearchExact(parsedArgs, memoryManager);
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
        const parsedArgs = searchHybridSchema.parse(args);
        const result = await handleSearchHybrid(parsedArgs, memoryManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_compressed_context': {
        const parsedArgs = getCompressedContextSchema.parse(args);
        const result = await handleGetCompressedContext(parsedArgs, memoryManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_optimized_memory': {
        const parsedArgs = getOptimizedMemorySchema.parse(args);
        const result = await handleGetOptimizedMemory(parsedArgs, memoryManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'analyze_access_patterns': {
        if (!memoryPatternService) {
          throw new Error('Memory pattern service not initialized');
        }
        const analysis = await memoryPatternService.analyzePatterns();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                analysis: {
                  hotMemories: analysis.hotMemories.length,
                  warmMemories: analysis.warmMemories.length,
                  coldMemories: analysis.coldMemories.length,
                  stats: analysis.stats,
                  recommendations: analysis.recommendations
                }
              }, null, 2)
            }
          ]
        };
      }
      
      // Tier management tools
      case 'get_tier_stats': {
        if (!config.tierEnabled) {
          throw new Error('Tier management is not enabled');
        }
        const stats = await memoryManager.getTierStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                stats: Object.entries(stats).map(([tier, data]) => ({
                  tier,
                  count: data.count,
                  oldestMemory: data.oldestMemory,
                  newestMemory: data.newestMemory
                }))
              }, null, 2)
            }
          ]
        };
      }
      
      case 'run_migration': {
        if (!migrationService) {
          throw new Error('Migration service not initialized');
        }
        const report = await migrationService.runMigration();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                report: {
                  startTime: report.startTime,
                  endTime: report.endTime,
                  totalMigrated: report.totalMigrated,
                  migrations: report.migrations,
                  errors: report.errors
                }
              }, null, 2)
            }
          ]
        };
      }
      
      case 'get_migration_status': {
        if (!migrationService) {
          throw new Error('Migration service not initialized');
        }
        const status = migrationService.getStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                status
              }, null, 2)
            }
          ]
        };
      }
      
      // Vault management tools
      case 'register_vault': {
        if (!vaultManager) {
          throw new Error('Vault manager not initialized');
        }
        if (!args || !args.name || !args.path) {
          throw new Error('Missing required arguments: name and path');
        }
        const vaultId = await vaultManager.registerVault(
          args.name as string,
          args.path as string,
          args.type as any || 'personal'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                vaultId,
                message: `Vault "${args.name}" registered successfully`
              }, null, 2)
            }
          ]
        };
      }
      
      case 'switch_vault': {
        if (!vaultManager) {
          throw new Error('Vault manager not initialized');
        }
        if (!args || !args.vaultId) {
          throw new Error('Missing required argument: vaultId');
        }
        await vaultManager.switchVault(args.vaultId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Vault switched successfully'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'list_vaults': {
        if (!vaultManager) {
          throw new Error('Vault manager not initialized');
        }
        const vaults = await vaultManager.listVaults();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                vaults: vaults.map(v => ({
                  id: v.id,
                  name: v.name,
                  path: v.path,
                  type: v.type,
                  isActive: v.isActive,
                  lastAccessed: v.lastAccessed
                }))
              }, null, 2)
            }
          ]
        };
      }
      
      case 'backup_vault': {
        if (!vaultManager) {
          throw new Error('Vault manager not initialized');
        }
        const backupPath = await vaultManager.backupVault(args?.vaultId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                backupPath,
                message: 'Vault backed up successfully'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'restore_vault': {
        if (!vaultManager) {
          throw new Error('Vault manager not initialized');
        }
        if (!args || !args.backupPath) {
          throw new Error('Missing required argument: backupPath');
        }
        await vaultManager.restoreVault(
          args.backupPath as string,
          args.targetVaultId as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Vault restored successfully'
              }, null, 2)
            }
          ]
        };
      }
      
      // State management tools
      case 'capture_state': {
        if (!stateManager) {
          throw new Error('State manager not initialized');
        }
        if (!args || !args.name) {
          throw new Error('Missing required argument: name');
        }
        const stateId = await stateManager.captureState(
          args.name as string,
          {
            description: args.description as string,
            tags: args.tags as string[],
            importance: args.importance as number,
            expiresInDays: args.expiresInDays as number
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                stateId,
                message: `State "${args.name}" captured successfully`
              }, null, 2)
            }
          ]
        };
      }
      
      case 'restore_state': {
        if (!stateManager) {
          throw new Error('State manager not initialized');
        }
        if (!args || !args.stateId) {
          throw new Error('Missing required argument: stateId');
        }
        await stateManager.restoreState(args.stateId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'State restored successfully'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'list_states': {
        if (!stateManager) {
          throw new Error('State manager not initialized');
        }
        const states = await stateManager.listStates(args?.vaultId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                states: states.map(s => ({
                  id: s.id,
                  name: s.metadata.name,
                  timestamp: s.timestamp,
                  description: s.metadata.description,
                  tags: s.metadata.tags,
                  size: s.size,
                  compressed: s.compressed
                }))
              }, null, 2)
            }
          ]
        };
      }
      
      case 'diff_states': {
        if (!stateManager) {
          throw new Error('State manager not initialized');
        }
        if (!args || !args.stateId1 || !args.stateId2) {
          throw new Error('Missing required arguments: stateId1 and stateId2');
        }
        const diff = await stateManager.diffStates(
          args.stateId1 as string,
          args.stateId2 as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                diff
              }, null, 2)
            }
          ]
        };
      }
      
      // Code Intelligence Tools
      case 'index_codebase':
      case 'find_symbol':
      case 'get_symbol_context':
      case 'analyze_code_patterns':
      case 'search_code_natural':
      case 'find_files':
      case 'explore_folder': {
        if (!codeIntelligenceTools) {
          throw new Error('Code intelligence tools not initialized');
        }
        
        const tool = codeIntelligenceTools.getTools().find(t => t.name === name);
        if (!tool) {
          throw new Error(`Code intelligence tool not found: ${name}`);
        }
        
        try {
          const result = await tool.handler(args || {});
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new Error(`Code intelligence tool error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Dual Vault Tools
      case 'promote_to_core': {
        if (!dualVaultManager) {
          throw new Error('Dual vault manager not initialized');
        }
        const result = await handlePromoteToCore(args as any, dualVaultManager, memoryManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'get_vault_stats': {
        if (!dualVaultManager) {
          throw new Error('Dual vault manager not initialized');
        }
        const result = await handleGetVaultStats(args as any, dualVaultManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'switch_project': {
        if (!dualVaultManager) {
          throw new Error('Dual vault manager not initialized');
        }
        const result = await handleSwitchProject(args as any, dualVaultManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'search_cross_vault': {
        if (!dualVaultManager) {
          throw new Error('Dual vault manager not initialized');
        }
        const result = await handleSearchCrossVault(args as any, dualVaultManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'categorize_memory': {
        if (!dualVaultManager) {
          throw new Error('Dual vault manager not initialized');
        }
        const result = await handleCategorizeMemory(args as any, dualVaultManager);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
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
  
  if (migrationService) {
    await migrationService.stop();
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
        const roadmapPath = path.join(vaultManager.getVaultPath(), 'Planning', 'roadmaps', 'Implementation Roadmap.md');
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
    message += `\n📁 **Vault Index**: Check ./vault/VAULT_INDEX.md for details\n`;
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
    toolRegistry.registerService('codeIntelligenceTools', codeIntelligenceTools);
    console.error('Code intelligence tools initialized');
    
    // Initialize migration service if tiers are enabled
    if (config.tierEnabled) {
      migrationService = new MigrationService(memoryManager, config);
      await migrationService.start();
      console.error('Migration service started');
    }
    
    // Initialize vault system based on configuration
    if (config.vaultMode === 'dual' && config.coreVaultPath && config.projectVaultPath) {
      // Dual vault mode
      console.error('Initializing dual vault system...');
      
      // Initialize core vault ObsidianManager
      const coreObsidianManager = new ObsidianManager(config.coreVaultPath, memoryManager.getChromaClient());
      await coreObsidianManager.initialize();
      console.error(`Core vault initialized: ${config.coreVaultPath}`);
      
      // Initialize project vault ObsidianManager
      const projectObsidianManager = new ObsidianManager(config.projectVaultPath, memoryManager.getChromaClient());
      await projectObsidianManager.initialize();
      console.error(`Project vault initialized: ${config.projectVaultPath}`);
      
      // Initialize DualVaultManager
      dualVaultManager = new DualVaultManager(
        projectObsidianManager,
        {
          coreVaultPath: config.coreVaultPath,
          projectVaultPath: config.projectVaultPath,
          vaultMode: 'dual',
          defaultContext: config.defaultVaultContext,
          enableCrossVaultSearch: config.enableCrossVaultSearch,
          searchStrategy: config.vaultSearchStrategy,
          weights: {
            core: config.coreVaultWeight,
            project: config.projectVaultWeight
          }
        },
        coreObsidianManager
      );
      await dualVaultManager.initialize();
      
      // Initialize template service for core vault
      const templateService = new TemplateService();
      await templateService.ensureTemplatesExist(config.coreVaultPath);
      console.error('Template service initialized');
      
      // Use dualVaultManager as the main vault manager
      vaultManager = dualVaultManager as any; // Type compatibility
      obsidianManager = projectObsidianManager; // Default to project for backward compatibility
      
      toolRegistry.registerService('vaultManager', vaultManager);
      toolRegistry.registerService('dualVaultManager', dualVaultManager);
      toolRegistry.registerService('templateService', templateService);
      console.error('Dual vault system initialized successfully');
      
    } else if (process.env.OBSIDIAN_VAULT_PATH) {
      // Single vault mode (backward compatibility)
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
      console.error(`Initializing single vault manager with vault: ${vaultPath}`);
      obsidianManager = new ObsidianManager(vaultPath, memoryManager.getChromaClient());
      await obsidianManager.initialize();
      console.error('Obsidian manager initialized successfully');
      
      // Initialize vault manager
      vaultManager = new VaultManager(obsidianManager);
      await vaultManager.initialize();
      toolRegistry.registerService('vaultManager', vaultManager);
      console.error('Vault manager initialized successfully');
    }
      
    // Initialize state manager
    if (vaultManager && memoryManager) {
      console.error('Initializing state manager...');
      stateManager = new StateManager(vaultManager, memoryManager, {
        statesPath: '.states',
        maxStatesPerVault: parseInt(process.env.MAX_STATES_PER_VAULT || '100'),
        compressionEnabled: process.env.STATE_COMPRESSION !== 'false'
      });
      await stateManager.initialize();
      toolRegistry.registerService('stateManager', stateManager);
      console.error('State manager initialized successfully');
    }
    
    // Initialize template manager
    if (vaultManager && obsidianManager) {
      console.error('Initializing template manager...');
      const currentVaultPath = config.vaultMode === 'dual' ? config.projectVaultPath : process.env.OBSIDIAN_VAULT_PATH;
      templateManager = new TemplateManager(vaultManager, {
        cacheDir: path.join(currentVaultPath || '.', '.template-cache'),
        maxTemplateSize: parseInt(process.env.TEMPLATE_MAX_SIZE || '1048576'), // 1MB default
        securityScan: process.env.TEMPLATE_SECURITY_SCAN !== 'false',
        allowedSources: process.env.TEMPLATE_ALLOWED_SOURCES?.split(',').map(s => s.trim())
      });
      await templateManager.initialize();
      toolRegistry.registerService('templateManager', templateManager);
      console.error('Template manager initialized successfully');
      
      // Initialize structure manager
      console.error('Initializing vault structure manager...');
      structureManager = new VaultStructureManager(templateManager, vaultManager);
      await structureManager.initialize();
      console.error('Vault structure manager initialized successfully');
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
      vaultIndexService = new VaultIndexService(vaultManager, memoryManager as any, sessionLogger || undefined);
      await vaultIndexService.initialize();
      console.error('Vault index service initialized successfully');
      
      console.error('Initializing memory health monitor...');
      memoryHealthMonitor = new MemoryHealthMonitor(memoryManager as any, memoryManager.getChromaClient());
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