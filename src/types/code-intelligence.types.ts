/**
 * Code Intelligence Types
 * Defines interfaces for code symbol indexing and analysis
 */

/**
 * Supported programming languages for code intelligence
 */
export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'csharp';

/**
 * Types of code symbols we can index
 */
export type CodeSymbolType = 'function' | 'class' | 'interface' | 'variable' | 'import' | 'export' | 'method' | 'property';

/**
 * Code-specific memory contexts
 */
export type CodeContext = 'code_symbol' | 'code_pattern' | 'code_decision' | 'code_snippet' | 'code_error';

/**
 * Code symbol representation
 */
export interface CodeSymbol {
  id: string;
  name: string;
  type: CodeSymbolType;
  language: SupportedLanguage;
  file: string;
  line: number;
  column?: number;
  definition: string;
  signature?: string; // Function/method signature
  documentation?: string; // JSDoc or similar
  imports?: string[]; // What this symbol imports
  exports?: boolean; // Is this symbol exported
  calls?: string[]; // Functions this symbol calls
  calledBy?: string[]; // Functions that call this symbol
  extends?: string; // For classes/interfaces
  implements?: string[]; // For classes
  visibility?: 'public' | 'private' | 'protected';
  isAsync?: boolean;
  parameters?: ParameterInfo[];
  returnType?: string;
  metadata?: Record<string, any>;
}

/**
 * Function/method parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

/**
 * Code pattern detection result
 */
export interface CodePattern {
  id: string;
  type: 'design_pattern' | 'anti_pattern' | 'convention' | 'refactoring_opportunity';
  name: string; // e.g., "Singleton", "Factory", "God Class"
  confidence: number; // 0-1
  locations: Array<{
    file: string;
    line: number;
    symbolId?: string;
  }>;
  description: string;
  suggestion?: string;
  severity?: 'info' | 'warning' | 'error';
  examples?: string[];
}

/**
 * Code indexing options
 */
export interface IndexOptions {
  path: string;
  pattern?: string; // Glob pattern, e.g., "**/*.{js,ts}"
  recursive?: boolean;
  excludePatterns?: string[];
  includeTests?: boolean;
  followSymlinks?: boolean;
  maxFileSize?: number; // Skip files larger than this (bytes)
  shallow?: boolean; // Only index function/class names, not full analysis
}

/**
 * Streaming result for code search
 */
export interface StreamingCodeResult {
  symbol: CodeSymbol;
  score: number;
  matches?: Array<{
    field: string; // Which field matched (name, definition, etc.)
    highlight: string; // The matching text with context
  }>;
}

/**
 * Code query options
 */
export interface CodeQueryOptions {
  query: string;
  type?: CodeSymbolType[]; // Filter by symbol types
  language?: SupportedLanguage[]; // Filter by languages
  file?: string; // Filter by file pattern
  limit?: number;
  includePrivate?: boolean;
  includeTests?: boolean;
}

/**
 * Natural language code query
 */
export interface NaturalLanguageQuery {
  query: string;
  intent?: 'find_implementation' | 'find_usage' | 'find_definition' | 'find_pattern' | 'explain_code';
  context?: {
    currentFile?: string;
    recentSymbols?: string[];
  };
}

/**
 * Code relationship graph
 */
export interface CodeRelationship {
  fromSymbolId: string;
  toSymbolId: string;
  type: 'calls' | 'extends' | 'implements' | 'imports' | 'exports' | 'references';
  location?: {
    file: string;
    line: number;
  };
}

/**
 * Code indexing statistics
 */
export interface IndexingStats {
  filesProcessed: number;
  symbolsIndexed: number;
  patternsDetected: number;
  duration: number; // milliseconds
  errors: Array<{
    file: string;
    error: string;
  }>;
  breakdown: {
    [key in CodeSymbolType]?: number;
  };
}