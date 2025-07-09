/**
 * Dynamic Tool Registry
 * Manages tool registration and provides tools based on initialized services
 */

import { VaultManager } from '../vault-manager.js';
import { StateManager } from '../state-manager.js';
import { CodeIntelligenceTools } from './code-intelligence-tools.js';
import { SessionLogger } from '../session-logger.js';
import { TemplateManager } from '../template-manager.js';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

export class ToolRegistry {
  private baseTools: ToolDefinition[] = [];
  private services: {
    vaultManager?: VaultManager;
    stateManager?: StateManager;
    codeIntelligenceTools?: CodeIntelligenceTools;
    sessionLogger?: SessionLogger;
    templateManager?: TemplateManager;
  } = {};

  constructor() {
    this.initializeBaseTools();
  }

  /**
   * Register a service that provides tools
   */
  registerService(name: string, service: any): void {
    this.services[name as keyof typeof this.services] = service;
  }

  /**
   * Get all available tools based on registered services
   */
  getTools(): ToolDefinition[] {
    const tools = [...this.baseTools];

    // Add vault management tools if available
    if (this.services.vaultManager) {
      tools.push(...this.getVaultTools());
    }

    // Add state management tools if available
    if (this.services.stateManager) {
      tools.push(...this.getStateTools());
    }

    // Add code intelligence tools if available
    if (this.services.codeIntelligenceTools) {
      const ciTools = this.services.codeIntelligenceTools.getTools();
      tools.push(...this.convertCodeIntelligenceTools(ciTools));
    }

    // Add session logging tools if available
    if (this.services.sessionLogger) {
      tools.push(...this.getSessionTools());
    }

    // Add template tools if available
    if (this.services.templateManager) {
      tools.push(...this.getTemplateTools());
    }

    return tools;
  }

  private initializeBaseTools(): void {
    this.baseTools = [
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
      {
        name: 'delete_memory',
        description: 'Delete a specific memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            memoryId: {
              type: 'string',
              description: 'ID of the memory to delete'
            }
          },
          required: ['memoryId']
        },
      },
      {
        name: 'clear_all_memories',
        description: 'Clear all memories from the collection',
        inputSchema: {
          type: 'object',
          properties: {
            confirm: {
              type: 'boolean',
              description: 'Confirm clearing all memories',
              default: false
            }
          },
          required: ['confirm']
        },
      },
      {
        name: 'get_memory_stats',
        description: 'Get memory statistics',
        inputSchema: {
          type: 'object',
          properties: {}
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
      {
        name: 'get_optimized_memory',
        description: 'Get an optimized version of a specific memory',
        inputSchema: {
          type: 'object',
          properties: {
            memoryId: {
              type: 'string',
              description: 'Memory ID to optimize'
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens for optimized output',
              default: 300
            }
          },
          required: ['memoryId']
        },
      },
      {
        name: 'analyze_access_patterns',
        description: 'Analyze memory access patterns and get tier recommendations',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'get_tier_stats',
        description: 'Get memory statistics by tier',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'get_memories_for_migration',
        description: 'Get memories that are ready for tier migration',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
    ];
  }

  private getVaultTools(): ToolDefinition[] {
    return [
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
      {
        name: 'list_vaults',
        description: 'List all registered vaults',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'backup_vault',
        description: 'Create a backup of the current or specified vault',
        inputSchema: {
          type: 'object',
          properties: {
            vaultId: {
              type: 'string',
              description: 'Optional vault ID to backup'
            }
          }
        },
      },
      {
        name: 'restore_vault',
        description: 'Restore a vault from backup',
        inputSchema: {
          type: 'object',
          properties: {
            backupPath: {
              type: 'string',
              description: 'Path to the backup file'
            },
            targetVaultId: {
              type: 'string',
              description: 'Optional target vault ID'
            }
          },
          required: ['backupPath']
        },
      },
    ];
  }

  private getStateTools(): ToolDefinition[] {
    return [
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
      {
        name: 'restore_state',
        description: 'Restore a previously captured state',
        inputSchema: {
          type: 'object',
          properties: {
            stateId: {
              type: 'string',
              description: 'ID of the state to restore'
            }
          },
          required: ['stateId']
        },
      },
      {
        name: 'list_states',
        description: 'List available captured states',
        inputSchema: {
          type: 'object',
          properties: {
            vaultId: {
              type: 'string',
              description: 'Optional vault ID filter'
            }
          }
        },
      },
      {
        name: 'diff_states',
        description: 'Compare two captured states',
        inputSchema: {
          type: 'object',
          properties: {
            stateId1: {
              type: 'string',
              description: 'First state ID'
            },
            stateId2: {
              type: 'string',
              description: 'Second state ID'
            }
          },
          required: ['stateId1', 'stateId2']
        },
      },
    ];
  }

  private getSessionTools(): ToolDefinition[] {
    return [
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
    ];
  }

  private getTemplateTools(): ToolDefinition[] {
    return [
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
              description: 'Path where to save the document'
            }
          },
          required: ['templateId', 'variables', 'outputPath']
        },
      },
    ];
  }

  private convertCodeIntelligenceTools(tools: any[]): ToolDefinition[] {
    return tools.map(tool => ({
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
  }
}