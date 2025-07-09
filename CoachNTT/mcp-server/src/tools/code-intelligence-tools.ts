/**
 * Code Intelligence Tools for MCP
 * Provides code indexing, search, and analysis capabilities
 */

import { z } from 'zod';
import { SimpleCodeParser } from '../utils/code-parser.js';
import { EnhancedMemoryManager } from '../memory-manager-enhanced.js';
import { HybridMemoryManager } from '../memory-manager-hybrid.js';
import { 
  CodeSymbol, 
  CodeSymbolType,
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
  
  constructor(private memoryManager: EnhancedMemoryManager | HybridMemoryManager) {
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
      {
        name: 'find_files',
        description: 'Search for files by name, extension, or directory with fast database lookup',
        inputSchema: z.object({
          name: z.string().optional().describe('File name or partial name to search for'),
          extension: z.string().optional().describe('File extension (e.g., .ts, .js)'),
          directory: z.string().optional().describe('Directory path or partial path'),
          fileType: z.enum(['code', 'config', 'documentation', 'asset', 'test', 'other']).optional().describe('Type of file'),
          limit: z.number().optional().default(50).describe('Maximum number of results'),
        }),
        handler: this.searchFiles.bind(this),
      },
      {
        name: 'explore_folder',
        description: 'List contents of a directory with file statistics and hierarchical structure',
        inputSchema: z.object({
          path: z.string().describe('Directory path to explore'),
          recursive: z.boolean().optional().default(false).describe('Include all subdirectories recursively'),
          showStats: z.boolean().optional().default(true).describe('Include file statistics'),
        }),
        handler: this.exploreFolder.bind(this),
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
    try {
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
      
      // Check if we're using hybrid storage for direct PostgreSQL access
      const isHybrid = this.memoryManager instanceof HybridMemoryManager;
      
      if (isHybrid) {
        console.error('Using PostgreSQL for bulk symbol storage (no throttling!)');
      } else {
        console.error('Using ChromaDB for symbol storage (may experience throttling)');
      }
      
      // Get file repository if available
      const fileRepo = isHybrid ? (this.memoryManager as HybridMemoryManager).getFileRepository() : null;
      
      // Index directories first if we have file repository
      if (fileRepo) {
        console.error('Indexing directory structure...');
        const directories = new Set<string>();
        
        // Collect all directories
        for (const file of files) {
          const dir = path.dirname(file);
          let currentDir = dir;
          while (currentDir && currentDir !== args.path && currentDir !== path.dirname(currentDir)) {
            directories.add(currentDir);
            currentDir = path.dirname(currentDir);
          }
        }
        
        // Store directories
        const dirArray = Array.from(directories).sort();
        for (const dir of dirArray) {
          try {
            await fileRepo.upsert({
              file_path: dir,
              file_name: path.basename(dir),
              directory_path: path.dirname(dir),
              parent_directory: path.dirname(dir),
              is_directory: true,
              project_id: args.path // Use root path as project ID for now
            });
          } catch (error) {
            console.error(`Error indexing directory ${dir}:`, error);
          }
        }
        console.error(`Indexed ${dirArray.length} directories`);
      }
      
      // Collect all symbols and file info
      const allSymbols: CodeSymbol[] = [];
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
          
          // Index the file in PostgreSQL if available
          if (fileRepo) {
            try {
              const fileRecord = await fileRepo.upsert({
                file_path: file,
                file_name: path.basename(file),
                directory_path: path.dirname(file),
                extension: path.extname(file),
                size_bytes: fileStat.size,
                parent_directory: path.dirname(file),
                file_modified: fileStat.mtime,
                // project_id is optional, leave it undefined for now
              });
              
              // Parse the file for symbols
              const symbols = await this.parser.parseFile(file);
              stats.filesProcessed++;
              
              // Update file with symbol count
              if (symbols.length > 0) {
                await fileRepo.updateFileCounts(fileRecord.id, {
                  contains_symbols: symbols.length
                });
              }
              
              // Collect symbols for PostgreSQL
              if (isHybrid) {
                allSymbols.push(...symbols);
              }
            } catch (error) {
              console.error(`Error indexing file ${file}:`, error);
              stats.errors.push({
                file,
                error: `Failed to index file: ${error instanceof Error ? error.message : 'Unknown error'}`
              });
            }
          } else {
            // No file repo, just parse symbols
            const symbols = await this.parser.parseFile(file);
            stats.filesProcessed++;
            
            // Collect symbols for PostgreSQL
            if (isHybrid) {
              allSymbols.push(...symbols);
            }
            
            // Also prepare for ChromaDB format (fallback)
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
          }
        } catch (error) {
          stats.errors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`Error processing file ${file}:`, error);
        }
      }
      
      // Store symbols
      if (isHybrid && allSymbols.length > 0) {
        // Use PostgreSQL bulk storage for symbols
        console.error(`Storing ${allSymbols.length} symbols in PostgreSQL...`);
        
        try {
          const storedCount = await (this.memoryManager as HybridMemoryManager).storeCodeSymbols(allSymbols);
          stats.symbolsIndexed = storedCount;
          
          // Update breakdown
          for (const symbol of allSymbols) {
            stats.breakdown[symbol.type] = (stats.breakdown[symbol.type] || 0) + 1;
          }
          
          console.error(`✅ Successfully indexed ${storedCount} symbols in PostgreSQL!`);
        } catch (error) {
          console.error('PostgreSQL bulk storage failed:', error);
          stats.errors.push({
            file: 'batch',
            error: `PostgreSQL storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      } else if (symbolBatch.length > 0) {
        // Fallback to ChromaDB batch storage
        console.error(`Storing ${symbolBatch.length} symbols in ChromaDB batches...`);
        
        try {
          const results = await this.memoryManager.storeBatch(symbolBatch);
          
          // Count successful stores
          for (const result of results) {
            if (result.stored) {
              stats.symbolsIndexed++;
              // Extract symbol type from the batch for breakdown
              const batchIndex = results.indexOf(result);
              if (batchIndex >= 0 && batchIndex < symbolBatch.length) {
                const symbolType = symbolBatch[batchIndex].metadata?.symbolType as CodeSymbolType;
                if (symbolType) {
                  stats.breakdown[symbolType] = (stats.breakdown[symbolType] || 0) + 1;
                }
              }
            } else if (result.error) {
              stats.errors.push({
                file: 'batch',
                error: result.error,
              });
            }
          }
        } catch (error) {
          console.error('ChromaDB batch storage failed:', error);
          stats.errors.push({
            file: 'batch',
            error: `ChromaDB batch storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
      
      stats.duration = Date.now() - startTime;
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to index codebase: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      // Check if we're using hybrid storage
      if (this.memoryManager instanceof HybridMemoryManager) {
        // Use PostgreSQL symbol search
        const symbols = await this.memoryManager.searchCodeSymbols(args.query, {
          type: args.type?.[0], // Use first type for now
          limit: args.limit
        });
        
        // Filter by file if specified
        let filtered = symbols;
        if (args.file) {
          filtered = symbols.filter(s => s.file.includes(args.file!));
        }
        
        // Convert to streaming results
        return filtered.map(symbol => ({
          symbol,
          score: 1.0,
          matches: [{
            field: 'name',
            highlight: symbol.name,
          }],
        }));
      } else {
        // Fallback to ChromaDB search
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
      }
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
  
  /**
   * Search files by name, extension, or directory
   */
  private async searchFiles(args: {
    name?: string;
    extension?: string;
    directory?: string;
    fileType?: 'code' | 'config' | 'documentation' | 'asset' | 'test' | 'other';
    limit?: number;
  }): Promise<any> {
    try {
      // Check if we're using hybrid storage with file repository
      if (!(this.memoryManager instanceof HybridMemoryManager)) {
        throw new Error('File search requires hybrid storage mode');
      }
      
      const fileRepo = (this.memoryManager as HybridMemoryManager).getFileRepository();
      if (!fileRepo) {
        throw new Error('File repository not initialized');
      }
      
      // Search for files
      const files = await fileRepo.search({
        name: args.name,
        extension: args.extension,
        directory: args.directory,
        file_type: args.fileType,
        limit: args.limit || 50,
        includeDirectories: false
      });
      
      // Format results
      const results = files.map(file => ({
        path: file.file_path,
        name: file.file_name,
        directory: file.directory_path,
        extension: file.extension,
        type: file.file_type,
        size: file.size_bytes,
        modified: file.file_modified,
        symbolCount: file.contains_symbols,
        importsCount: file.imports_count,
        importedByCount: file.imported_by_count
      }));
      
      return {
        count: results.length,
        files: results,
        query: args
      };
    } catch (error) {
      throw new Error(`File search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Explore folder contents
   */
  private async exploreFolder(args: {
    path: string;
    recursive?: boolean;
    showStats?: boolean;
  }): Promise<any> {
    try {
      // Check if we're using hybrid storage with file repository
      if (!(this.memoryManager instanceof HybridMemoryManager)) {
        throw new Error('Folder exploration requires hybrid storage mode');
      }
      
      const fileRepo = (this.memoryManager as HybridMemoryManager).getFileRepository();
      if (!fileRepo) {
        throw new Error('File repository not initialized');
      }
      
      // Get directory contents
      const contents = await fileRepo.getDirectoryContents(
        args.path,
        undefined, // No specific project ID
        args.recursive || false
      );
      
      // Separate directories and files
      const directories = contents.filter(f => f.is_directory);
      const files = contents.filter(f => !f.is_directory);
      
      // Calculate statistics if requested
      let stats = null;
      if (args.showStats !== false) {
        const filesByType: Record<string, number> = {};
        let totalSize = 0;
        let totalSymbols = 0;
        
        for (const file of files) {
          const type = file.file_type || 'other';
          filesByType[type] = (filesByType[type] || 0) + 1;
          totalSize += file.size_bytes || 0;
          totalSymbols += file.contains_symbols || 0;
        }
        
        stats = {
          totalFiles: files.length,
          totalDirectories: directories.length,
          totalSize,
          totalSymbols,
          filesByType
        };
      }
      
      // Format results
      const formatItem = (item: any) => ({
        name: item.file_name,
        path: item.file_path,
        type: item.is_directory ? 'directory' : item.file_type,
        size: item.size_bytes,
        modified: item.file_modified,
        symbols: item.contains_symbols,
        depth: item.depth
      });
      
      return {
        path: args.path,
        directories: directories.map(formatItem),
        files: files.map(formatItem),
        stats,
        recursive: args.recursive || false
      };
    } catch (error) {
      throw new Error(`Folder exploration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}