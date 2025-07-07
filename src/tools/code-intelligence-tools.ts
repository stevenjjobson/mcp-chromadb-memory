/**
 * Code Intelligence Tools for MCP
 * Provides code indexing, search, and analysis capabilities
 */

import { z } from 'zod';
import { SimpleCodeParser } from '../utils/code-parser.js';
import { EnhancedMemoryManager } from '../memory-manager-enhanced.js';
import { 
  CodeSymbol, 
  IndexOptions, 
  CodeQueryOptions,
  StreamingCodeResult,
  IndexingStats,
  CodeContext 
} from '../types/code-intelligence.types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import micromatch from 'micromatch';

interface CodePattern {
  id: string;
  type: 'singleton' | 'god_class' | 'callback_hell' | 'no_error_handling' | 'console_logs';
  file: string;
  confidence: number;
  description: string;
  suggestion: string;
}

/**
 * Code Intelligence Tools
 */
export class CodeIntelligenceTools {
  private parser: SimpleCodeParser;
  
  constructor(private memoryManager: EnhancedMemoryManager) {
    this.parser = new SimpleCodeParser();
  }
  
  /**
   * Get tool definitions for MCP
   */
  getTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
  }> {
    return [
      {
        name: 'index_codebase',
        description: 'Index code files for intelligent search and analysis',
        inputSchema: z.object({
          path: z.string().describe('Path to the codebase directory'),
          pattern: z.string().optional().default('**/*.{js,ts,jsx,tsx}').describe('Glob pattern for files to index'),
          excludePatterns: z.array(z.string()).optional().default(['**/node_modules/**', '**/dist/**', '**/build/**']).describe('Patterns to exclude'),
          shallow: z.boolean().optional().default(false).describe('Only index function/class names, not full analysis'),
        }),
        handler: this.indexCodebase.bind(this),
      },
      {
        name: 'find_symbol',
        description: 'Search for code symbols (functions, classes, etc.) with streaming results',
        inputSchema: z.object({
          query: z.string().describe('Symbol name or partial name to search for'),
          type: z.array(z.enum(['function', 'class', 'interface', 'variable', 'import', 'export', 'method', 'property'])).optional().describe('Filter by symbol types'),
          file: z.string().optional().describe('Filter by file pattern'),
          limit: z.number().optional().default(20).describe('Maximum number of results'),
        }),
        handler: this.findSymbol.bind(this),
      },
      {
        name: 'get_symbol_context',
        description: 'Get detailed context for a specific code symbol including relationships',
        inputSchema: z.object({
          symbolId: z.string().describe('The symbol ID to get context for'),
          includeCallers: z.boolean().optional().default(true).describe('Include functions that call this symbol'),
          includeCalled: z.boolean().optional().default(true).describe('Include functions this symbol calls'),
        }),
        handler: this.getSymbolContext.bind(this),
      },
      {
        name: 'analyze_code_patterns',
        description: 'Analyze code for patterns, anti-patterns, and improvement opportunities',
        inputSchema: z.object({
          path: z.string().describe('Path to analyze'),
          patterns: z.array(z.string()).optional().describe('Specific patterns to look for'),
        }),
        handler: this.analyzeCodePatterns.bind(this),
      },
      {
        name: 'search_code_natural',
        description: 'Search code using natural language queries',
        inputSchema: z.object({
          query: z.string().describe('Natural language query like "find authentication functions"'),
          currentFile: z.string().optional().describe('Current file for context'),
        }),
        handler: this.searchCodeNatural.bind(this),
      },
    ];
  }
  
  /**
   * Index a codebase
   */
  private async indexCodebase(args: {
    path: string;
    pattern?: string;
    excludePatterns?: string[];
    shallow?: boolean;
  }): Promise<IndexingStats> {
    const stats: IndexingStats = {
      filesProcessed: 0,
      symbolsIndexed: 0,
      patternsDetected: 0,
      duration: 0,
      errors: [],
      breakdown: {},
    };
    
    const startTime = Date.now();
    
    try {
      // Find all matching files using recursive directory traversal
      const files = await this.findFiles(args.path, args.pattern || '**/*.{js,ts,jsx,tsx}', args.excludePatterns || []);
      
      console.error(`Found ${files.length} files to index`);
      
      // Collect all symbols for batch processing
      const symbolBatch: Array<{
        content: string;
        context: string;
        metadata?: Record<string, any>;
      }> = [];
      
      // Process each file
      for (const file of files) {
        try {
          // Skip large files
          const fileStat = await fs.stat(file);
          if (fileStat.size > 1024 * 1024) { // Skip files > 1MB
            console.error(`Skipping large file: ${file}`);
            continue;
          }
          
          // Parse the file
          const symbols = await this.parser.parseFile(file);
          stats.filesProcessed++;
          
          // Prepare symbols for batch storage
          for (const symbol of symbols) {
            try {
              // Create memory content with symbol information
              const content = this.createSymbolMemoryContent(symbol);
              
              // Add to batch
              symbolBatch.push({
                content,
                context: 'code_symbol' as CodeContext,
                metadata: {
                  symbolId: symbol.id,
                  symbolName: symbol.name,
                  symbolType: symbol.type,
                  file: symbol.file,
                  line: symbol.line,
                  language: symbol.language,
                  isExported: symbol.exports || false,
                  signature: symbol.signature,
                }
              });
              
            } catch (error) {
              console.error(`Error preparing symbol ${symbol.name}:`, error);
              stats.errors.push({
                file,
                error: `Failed to prepare symbol ${symbol.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              });
            }
          }
        } catch (error) {
          stats.errors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`Error processing file ${file}:`, error);
        }
      }
      
      // Store symbols in batches
      if (symbolBatch.length > 0) {
        console.error(`Storing ${symbolBatch.length} symbols in batches...`);
        
        try {
          const results = await this.memoryManager.storeBatch(symbolBatch);
          
          // Count successful stores
          for (const result of results) {
            if (result.stored) {
              stats.symbolsIndexed++;
              // Extract symbol type from the batch for breakdown
              const batchIndex = results.indexOf(result);
              if (batchIndex >= 0 && batchIndex < symbolBatch.length) {
                const symbolType = symbolBatch[batchIndex].metadata?.symbolType || 'unknown';
                stats.breakdown[symbolType] = (stats.breakdown[symbolType] || 0) + 1;
              }
            } else if (result.error) {
              stats.errors.push({
                file: 'batch',
                error: result.error,
              });
            }
          }
        } catch (error) {
          console.error('Batch storage failed:', error);
          stats.errors.push({
            file: 'batch',
            error: `Batch storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
      
      stats.duration = Date.now() - startTime;
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to index codebase: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Find symbols by name
   */
  private async findSymbol(args: {
    query: string;
    type?: Array<'function' | 'class' | 'interface' | 'variable' | 'import' | 'export' | 'method' | 'property'>;
    file?: string;
    limit?: number;
  }): Promise<StreamingCodeResult[]> {
    try {
      // Use exact search for symbol names
      const memories = await this.memoryManager.searchExact(args.query, 'symbolName');
      
      // Filter by type if specified
      let filtered = memories;
      if (args.type && args.type.length > 0) {
        filtered = memories.filter(m => 
          args.type!.includes(m.metadata.symbolType as any)
        );
      }
      
      // Filter by file pattern if specified
      if (args.file) {
        filtered = filtered.filter(m => 
          m.metadata.file && m.metadata.file.includes(args.file)
        );
      }
      
      // Limit results
      const limited = filtered.slice(0, args.limit);
      
      // Convert to streaming results
      return limited.map(memory => ({
        symbol: this.memoryToSymbol(memory),
        score: 1.0, // Exact match
        matches: [{
          field: 'name',
          highlight: memory.metadata.symbolName as string,
        }],
      }));
    } catch (error) {
      console.error('Error finding symbol:', error);
      return [];
    }
  }
  
  /**
   * Get detailed context for a symbol
   */
  private async getSymbolContext(args: {
    symbolId: string;
    includeCallers?: boolean;
    includeCalled?: boolean;
  }) {
    try {
      // First, find the symbol memory
      const symbolMemories = await this.memoryManager.searchExact(args.symbolId, 'symbolId');
      
      if (symbolMemories.length === 0) {
        throw new Error(`Symbol not found: ${args.symbolId}`);
      }
      
      const symbolMemory = symbolMemories[0];
      const symbol = this.memoryToSymbol(symbolMemory);
      
      // Find related symbols (this is simplified for now)
      const context = {
        symbol,
        file: symbol.file,
        callers: [] as CodeSymbol[],
        called: [] as CodeSymbol[],
        imports: symbol.imports || [],
        exports: symbol.exports || false,
      };
      
      // If it's a function, try to find who calls it
      if (args.includeCallers && symbol.type === 'function') {
        const callerQuery = `calls ${symbol.name}`;
        const callerMemories = await this.memoryManager.searchHybrid(callerQuery, undefined, 0.7);
        context.callers = callerMemories.slice(0, 5).map(m => this.memoryToSymbol(m));
      }
      
      return context;
    } catch (error) {
      throw new Error(`Failed to get symbol context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Analyze code patterns in the codebase
   */
  private async analyzeCodePatterns(args: {
    path: string;
    patterns?: string[];
  }) {
    try {
      const detectedPatterns: CodePattern[] = [];
      const suggestions: string[] = [];
      
      // Get all code files
      const files = await this.findFiles(
        args.path, 
        '**/*.{js,ts,jsx,tsx}',
        ['**/node_modules/**', '**/dist/**', '**/.git/**']
      );
      
      // Pattern definitions
      const patternChecks = [
        {
          name: 'singleton',
          check: (content: string) => /class\s+\w+\s*{[^}]*static\s+instance/i.test(content),
          suggestion: 'Consider using dependency injection instead of singleton pattern',
        },
        {
          name: 'god_class',
          check: (content: string) => {
            const classMatch = content.match(/class\s+\w+\s*{([^}]+)}/g);
            if (!classMatch) return false;
            for (const cls of classMatch) {
              const methodCount = (cls.match(/\b(async\s+)?\w+\s*\([^)]*\)\s*{/g) || []).length;
              if (methodCount > 20) return true;
            }
            return false;
          },
          suggestion: 'Large classes should be split into smaller, focused classes',
        },
        {
          name: 'callback_hell',
          check: (content: string) => {
            const callbackDepth = (content.match(/\)\s*=>\s*{/g) || []).length;
            return callbackDepth > 5;
          },
          suggestion: 'Use async/await or promises to avoid deep callback nesting',
        },
        {
          name: 'no_error_handling',
          check: (content: string) => {
            const hasAsync = /async\s+\w+\s*\(/g.test(content);
            const hasTryCatch = /try\s*{/g.test(content);
            const hasCatch = /\.catch\s*\(/g.test(content);
            return hasAsync && !hasTryCatch && !hasCatch;
          },
          suggestion: 'Add proper error handling for async operations',
        },
        {
          name: 'console_logs',
          check: (content: string) => /console\.(log|error|warn|info)/g.test(content),
          suggestion: 'Use a proper logging framework instead of console statements',
        },
      ];
      
      // Filter patterns if specific ones requested
      const activePatterns = args.patterns 
        ? patternChecks.filter(p => args.patterns!.includes(p.name))
        : patternChecks;
      
      // Check each file
      for (const file of files.slice(0, 100)) { // Limit to 100 files for performance
        try {
          const content = await fs.readFile(file, 'utf8');
          
          for (const pattern of activePatterns) {
            if (pattern.check(content)) {
              detectedPatterns.push({
                id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: pattern.name as any,
                file: path.relative(args.path, file),
                confidence: 0.8,
                description: `Detected ${pattern.name} pattern`,
                suggestion: pattern.suggestion,
              });
              
              if (!suggestions.includes(pattern.suggestion)) {
                suggestions.push(pattern.suggestion);
              }
            }
          }
        } catch (error) {
          console.error(`Error analyzing ${file}:`, error);
        }
      }
      
      // Store patterns in memory for future reference
      if (detectedPatterns.length > 0) {
        const summary = `Code pattern analysis found ${detectedPatterns.length} patterns:\n` +
          detectedPatterns.map(p => `- ${p.type} in ${p.file}`).join('\n');
        
        await this.memoryManager.storeMemory(
          summary,
          'code_pattern',
          {
            patternCount: detectedPatterns.length,
            patternsJson: JSON.stringify(detectedPatterns),
            timestamp: new Date().toISOString(),
            path: args.path,
          }
        );
      }
      
      return {
        patterns: detectedPatterns,
        suggestions,
        summary: {
          filesAnalyzed: files.length,
          patternsFound: detectedPatterns.length,
          topPatterns: detectedPatterns
            .reduce((acc, p) => {
              acc[p.type] = (acc[p.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
        },
      };
    } catch (error) {
      throw new Error(`Pattern analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Natural language code search
   */
  private async searchCodeNatural(args: {
    query: string;
    currentFile?: string;
  }) {
    try {
      // Map natural language to code queries
      const mappedQuery = this.mapNaturalLanguageQuery(args.query);
      
      // Use hybrid search for best results
      const memories = await this.memoryManager.searchHybrid(
        mappedQuery,
        'code_symbol',
        0.6 // 60% exact, 40% semantic
      );
      
      // Convert to symbols
      const symbols = memories.slice(0, 10).map(m => this.memoryToSymbol(m));
      
      return {
        query: args.query,
        mappedQuery,
        results: symbols,
        count: symbols.length,
      };
    } catch (error) {
      throw new Error(`Natural language search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create memory content from a code symbol
   */
  private createSymbolMemoryContent(symbol: CodeSymbol): string {
    const parts = [
      `${symbol.type} ${symbol.name}`,
      `in ${path.basename(symbol.file)}:${symbol.line}`,
    ];
    
    if (symbol.signature) {
      parts.push(`signature: ${symbol.signature}`);
    }
    
    if (symbol.documentation) {
      parts.push(`docs: ${symbol.documentation}`);
    }
    
    parts.push(`\n${symbol.definition}`);
    
    return parts.join('\n');
  }
  
  /**
   * Convert a memory back to a symbol
   */
  private memoryToSymbol(memory: any): CodeSymbol {
    const metadata = memory.metadata || {};
    return {
      id: metadata.symbolId || memory.id,
      name: metadata.symbolName || 'unknown',
      type: metadata.symbolType || 'function',
      language: metadata.language || 'javascript',
      file: metadata.file || '',
      line: metadata.line || 0,
      definition: memory.content || '',
      signature: metadata.signature,
      exports: metadata.isExported,
    };
  }
  
  /**
   * Find files recursively matching pattern
   */
  private async findFiles(dir: string, pattern: string, excludePatterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    async function walk(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(dir, fullPath);
          
          // Check if should be excluded
          if (excludePatterns.some(pattern => micromatch.isMatch(relativePath, pattern))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            // Check if matches pattern
            if (micromatch.isMatch(relativePath, pattern)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentDir}:`, error);
      }
    }
    
    await walk(dir);
    return files;
  }
  
  /**
   * Map natural language queries to code search terms
   */
  private mapNaturalLanguageQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Common mappings
    const mappings = [
      { patterns: ['authenticate', 'authentication', 'auth', 'login'], terms: ['auth', 'login', 'authenticate', 'signin'] },
      { patterns: ['database', 'db', 'query'], terms: ['db', 'database', 'query', 'sql', 'mongo'] },
      { patterns: ['error', 'exception', 'handle errors'], terms: ['error', 'catch', 'exception', 'throw'] },
      { patterns: ['api', 'endpoint', 'route'], terms: ['api', 'route', 'endpoint', 'get', 'post'] },
      { patterns: ['test', 'testing', 'unit test'], terms: ['test', 'spec', 'describe', 'it', 'expect'] },
      { patterns: ['config', 'configuration', 'settings'], terms: ['config', 'settings', 'env', 'options'] },
      { patterns: ['validation', 'validate', 'check'], terms: ['validate', 'check', 'verify', 'assert'] },
    ];
    
    // Find matching patterns
    for (const mapping of mappings) {
      for (const pattern of mapping.patterns) {
        if (lowerQuery.includes(pattern)) {
          // Return the most relevant terms
          return mapping.terms.slice(0, 3).join(' ');
        }
      }
    }
    
    // Extract potential function/class names (capitalized words or camelCase)
    const namePattern = /[A-Z][a-zA-Z]*|[a-z]+(?=[A-Z])/g;
    const names = query.match(namePattern);
    
    if (names && names.length > 0) {
      return names.join(' ');
    }
    
    // Default: return the original query
    return query;
  }
}