import { z } from 'zod';
import { DualVaultManager } from '../vault-manager-dual.js';
import { EnhancedMemoryManager } from '../memory-manager-enhanced.js';
import { HybridMemoryManager } from '../memory-manager-hybrid.js';

// Tool schemas
export const promoteToCoreTool = {
  name: 'promote_to_core',
  description: 'Promote a memory from project vault to core knowledge vault',
  inputSchema: z.object({
    memoryId: z.string().describe('ID of the memory to promote'),
    reason: z.string().optional().describe('Reason for promotion'),
  })
};

export const getVaultStatsTool = {
  name: 'get_vault_stats',
  description: 'Get statistics about memories in each vault',
  inputSchema: z.object({})
};

export const switchProjectTool = {
  name: 'switch_project',
  description: 'Switch to a different project vault',
  inputSchema: z.object({
    projectPath: z.string().describe('Path to the new project vault'),
    projectName: z.string().optional().describe('Name for the project')
  })
};

export const searchCrossVaultTool = {
  name: 'search_cross_vault',
  description: 'Search across both core and project vaults with weighted results',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    vaults: z.array(z.enum(['core', 'project'])).optional().describe('Vaults to search (default: both)'),
    strategy: z.enum(['weighted', 'sequential', 'isolated']).optional().describe('Search strategy'),
    limit: z.number().optional().describe('Maximum results per vault').default(10)
  })
};

export const categorizeMemoryTool = {
  name: 'categorize_memory',
  description: 'Preview where a memory would be stored based on its content',
  inputSchema: z.object({
    content: z.string().describe('Memory content to categorize'),
    metadata: z.record(z.any()).optional().describe('Additional metadata')
  })
};

// Tool handlers
export async function handlePromoteToCore(
  args: z.infer<typeof promoteToCoreTool.inputSchema>,
  dualVaultManager: DualVaultManager,
  memoryManager: EnhancedMemoryManager | HybridMemoryManager
): Promise<any> {
  try {
    // Get memory from memory manager
    const memories = await memoryManager.searchExact(args.memoryId, 'id', 1);
    if (memories.length === 0) {
      throw new Error(`Memory not found: ${args.memoryId}`);
    }
    
    const memory = memories[0];
    
    // Create a document from the memory
    const documentPath = `memories/${memory.id}.md`;
    const content = `# ${memory.metadata?.title || 'Memory'}\n\n${memory.content}\n\n---\n\nOriginal context: ${memory.context}\nImportance: ${memory.importance}\nCreated: ${memory.timestamp}`;
    
    // Promote to core vault
    const result = await dualVaultManager.promoteToCore(documentPath, {
      reason: args.reason,
      includeMetadata: true
    });
    
    return {
      success: true,
      memoryId: memory.id,
      promotedPath: result.newPath,
      reason: args.reason || 'Manual promotion'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleGetVaultStats(
  args: z.infer<typeof getVaultStatsTool.inputSchema>,
  dualVaultManager: DualVaultManager
): Promise<any> {
  try {
    const stats = await dualVaultManager.getVaultStats();
    const context = dualVaultManager.getVaultContext();
    
    return {
      success: true,
      mode: context.activeContext,
      stats: {
        core: stats.core || { totalNotes: 0, size: 0 },
        project: stats.project,
        searchStrategy: context.searchStrategy
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleSwitchProject(
  args: z.infer<typeof switchProjectTool.inputSchema>,
  dualVaultManager: DualVaultManager
): Promise<any> {
  try {
    await dualVaultManager.switchProjectVault(
      args.projectPath,
      args.projectName
    );
    
    return {
      success: true,
      message: `Switched to project vault: ${args.projectPath}`,
      projectName: args.projectName || args.projectPath
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleSearchCrossVault(
  args: z.infer<typeof searchCrossVaultTool.inputSchema>,
  dualVaultManager: DualVaultManager
): Promise<any> {
  try {
    const results = await dualVaultManager.searchDocuments(
      args.query,
      {
        vaults: args.vaults,
        strategy: args.strategy,
        limit: args.limit
      }
    );
    
    return {
      success: true,
      totalResults: results.length,
      results: results.map(r => ({
        vault: r.vault,
        path: r.path,
        score: r.score.toFixed(3),
        excerpt: r.content.substring(0, 200) + '...'
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleCategorizeMemory(
  args: z.infer<typeof categorizeMemoryTool.inputSchema>,
  dualVaultManager: DualVaultManager
): Promise<any> {
  try {
    const result = await dualVaultManager.categorizeContent(
      args.content,
      args.metadata
    );
    
    return {
      success: true,
      categorization: {
        targetVault: result.vault,
        confidence: `${Math.round(result.confidence * 100)}%`,
        reasoning: result.reasoning,
        alternative: result.alternativeSuggestion ? {
          vault: result.alternativeSuggestion.vault,
          confidence: `${Math.round(result.alternativeSuggestion.confidence * 100)}%`,
          reasoning: result.alternativeSuggestion.reasoning
        } : null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export all tools
export const dualVaultTools = [
  promoteToCoreTool,
  getVaultStatsTool,
  switchProjectTool,
  searchCrossVaultTool,
  categorizeMemoryTool
];