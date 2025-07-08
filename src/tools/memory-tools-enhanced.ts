import { z } from 'zod';
import { EnhancedMemoryManager } from '../memory-manager-enhanced.js';
import { CompressionOptions } from '../utils/token-manager.js';

// Tool schemas
export const searchExactSchema = z.object({
  query: z.string().describe('Exact search query'),
  field: z.string().optional().describe('Optional metadata field to search in'),
  limit: z.number().default(10).describe('Maximum number of results')
});

export const searchHybridSchema = z.object({
  query: z.string().describe('Search query'),
  context: z.string().optional().describe('Optional context filter'),
  exactWeight: z.number().default(0.4).describe('Weight for exact match (0-1)'),
  limit: z.number().default(10).describe('Maximum number of results')
});

export const getCompressedContextSchema = z.object({
  query: z.string().describe('Query to find relevant memories'),
  maxTokens: z.number().default(500).describe('Maximum tokens for compressed context'),
  preserveStructure: z.boolean().default(true).describe('Preserve document structure'),
  smartFiltering: z.boolean().default(true).describe('Use smart filtering')
});

export const getOptimizedMemorySchema = z.object({
  memoryId: z.string().describe('Memory ID to optimize'),
  maxTokens: z.number().default(300).describe('Maximum tokens for optimized output')
});

export const analyzeAccessPatternsSchema = z.object({});

// Enhanced memory tools
export const enhancedMemoryTools = [
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
    description: 'Get compressed context from relevant memories optimized for AI token limits',
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
    description: 'Get a specific memory optimized for AI consumption with token limit',
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
  }
];

// Tool handlers
export async function handleSearchExact(
  args: z.infer<typeof searchExactSchema>,
  memoryManager: EnhancedMemoryManager | import('../memory-manager-hybrid.js').HybridMemoryManager
) {
  const { query, field, limit } = args;
  
  try {
    const memories = await memoryManager.searchExact(query, field, limit);
    
    return {
      success: true,
      resultCount: memories.length,
      memories: memories.map(memory => ({
        id: memory.id,
        content: memory.content,
        context: memory.context,
        importance: memory.importance,
        timestamp: memory.timestamp,
        accessCount: memory.accessCount,
        lastAccessed: memory.lastAccessed,
        metadata: memory.metadata
      }))
    };
  } catch (error) {
    console.error('Error in exact search:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleSearchHybrid(
  args: z.infer<typeof searchHybridSchema>,
  memoryManager: EnhancedMemoryManager | import('../memory-manager-hybrid.js').HybridMemoryManager
) {
  const { query, context, exactWeight, limit } = args;
  
  try {
    const results = await memoryManager.searchHybrid(query, context, exactWeight, limit);
    
    return {
      success: true,
      resultCount: results.length,
      results: results.map(result => ({
        memory: {
          id: result.memory.id,
          content: result.memory.content,
          context: result.memory.context,
          importance: result.memory.importance,
          timestamp: result.memory.timestamp,
          accessCount: result.memory.accessCount,
          lastAccessed: result.memory.lastAccessed,
          metadata: result.memory.metadata
        },
        scores: {
          total: result.totalScore,
          semantic: result.semanticScore,
          recency: result.recencyScore,
          importance: result.importanceScore,
          frequency: result.frequencyScore
        }
      }))
    };
  } catch (error) {
    console.error('Error in hybrid search:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleGetCompressedContext(
  args: z.infer<typeof getCompressedContextSchema>,
  memoryManager: EnhancedMemoryManager | import('../memory-manager-hybrid.js').HybridMemoryManager
) {
  const { query, maxTokens, preserveStructure, smartFiltering } = args;
  
  try {
    const result = await memoryManager.getCompressedContext(query, maxTokens, {
      preserveStructure,
      smartFiltering
    });
    
    return {
      success: true,
      ...result,
      reductionPercentage: ((1 - result.compressionRatio) * 100).toFixed(1) + '%'
    };
  } catch (error) {
    console.error('Error getting compressed context:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleGetOptimizedMemory(
  args: z.infer<typeof getOptimizedMemorySchema>,
  memoryManager: EnhancedMemoryManager | import('../memory-manager-hybrid.js').HybridMemoryManager
) {
  const { memoryId, maxTokens } = args;
  
  try {
    const result = await memoryManager.getOptimizedMemory(memoryId, maxTokens);
    
    return {
      success: true,
      ...result,
      reductionPercentage: ((1 - result.compressionRatio) * 100).toFixed(1) + '%'
    };
  } catch (error) {
    console.error('Error getting optimized memory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}