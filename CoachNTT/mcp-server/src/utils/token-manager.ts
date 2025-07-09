import { encode } from 'gpt-3-encoder';

export interface CompressionOptions {
  maxTokens: number;
  preserveStructure: boolean;
  contextWindow: number;
  smartFiltering: boolean;
}

export interface CompressionResult {
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  truncated: boolean;
}

export class TokenManager {
  // Count tokens in a string
  static countTokens(text: string): number {
    try {
      return encode(text).length;
    } catch (error) {
      // Fallback to character-based estimation (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }
  
  // Compress text to fit within token limit
  static compress(
    text: string,
    options: Partial<CompressionOptions> = {}
  ): CompressionResult {
    const opts: CompressionOptions = {
      maxTokens: 500,
      preserveStructure: true,
      contextWindow: 3,
      smartFiltering: true,
      ...options
    };
    
    const originalTokens = this.countTokens(text);
    
    // If already within limit, return as-is
    if (originalTokens <= opts.maxTokens) {
      return {
        compressed: text,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1.0,
        truncated: false
      };
    }
    
    let compressed = text;
    
    // Apply compression strategies
    if (opts.smartFiltering) {
      compressed = this.smartFilter(compressed, opts);
    }
    
    // If still too long, apply truncation
    if (this.countTokens(compressed) > opts.maxTokens) {
      compressed = this.truncateToTokenLimit(compressed, opts.maxTokens);
    }
    
    const compressedTokens = this.countTokens(compressed);
    
    return {
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      truncated: compressedTokens < originalTokens
    };
  }
  
  // Smart filtering to reduce content while preserving important information
  private static smartFilter(text: string, options: CompressionOptions): string {
    const lines = text.split('\n');
    const filteredLines: string[] = [];
    
    // Keywords that indicate important content
    const importantKeywords = [
      'function', 'class', 'def', 'const', 'let', 'var',
      'import', 'export', 'return', 'throw', 'error',
      'TODO', 'FIXME', 'WARNING', 'IMPORTANT', 'NOTE',
      'password', 'key', 'secret', 'token', 'api'
    ];
    
    // Comment patterns to preserve
    const commentPatterns = [
      /^\s*\/\//,  // JS/TS single-line comments
      /^\s*#/,     // Python/Shell comments
      /^\s*\/\*/,  // Multi-line comment start
      /^\s*\*/,    // Multi-line comment content
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Always keep empty lines for structure
      if (trimmedLine === '') {
        filteredLines.push(line);
        continue;
      }
      
      // Check if line contains important keywords
      const hasImportantKeyword = importantKeywords.some(keyword => 
        line.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // Check if line is a comment
      const isComment = commentPatterns.some(pattern => pattern.test(line));
      
      // Keep line if it's important or a comment
      if (hasImportantKeyword || isComment) {
        filteredLines.push(line);
        
        // Add context window around important lines
        if (options.contextWindow > 0 && hasImportantKeyword) {
          // Add previous lines
          for (let j = Math.max(0, i - options.contextWindow); j < i; j++) {
            if (!filteredLines.includes(lines[j])) {
              filteredLines.splice(filteredLines.length - 1, 0, lines[j]);
            }
          }
          
          // Add following lines
          for (let j = i + 1; j <= Math.min(lines.length - 1, i + options.contextWindow); j++) {
            if (!filteredLines.includes(lines[j])) {
              filteredLines.push(lines[j]);
            }
          }
        }
      }
    }
    
    return filteredLines.join('\n');
  }
  
  // Truncate text to fit within token limit
  private static truncateToTokenLimit(text: string, maxTokens: number): string {
    let truncated = text;
    let tokens = this.countTokens(truncated);
    
    // Binary search for the right truncation point
    if (tokens > maxTokens) {
      let low = 0;
      let high = text.length;
      
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        truncated = text.substring(0, mid);
        tokens = this.countTokens(truncated);
        
        if (tokens <= maxTokens) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      
      truncated = text.substring(0, low);
      
      // Add truncation indicator
      truncated += '\n\n[... truncated to fit token limit ...]';
    }
    
    return truncated;
  }
  
  // Extract summary from text
  static extractSummary(text: string, maxTokens: number = 100): string {
    const lines = text.split('\n');
    const summary: string[] = [];
    let currentTokens = 0;
    
    // Priority patterns for summary extraction
    const priorityPatterns = [
      { pattern: /^#\s+(.+)/, weight: 3 },        // Markdown headers
      { pattern: /^##\s+(.+)/, weight: 2.5 },     // Subheaders
      { pattern: /function\s+(\w+)/, weight: 2 }, // Function names
      { pattern: /class\s+(\w+)/, weight: 2 },    // Class names
      { pattern: /TODO:\s*(.+)/, weight: 2 },     // TODOs
      { pattern: /IMPORTANT:\s*(.+)/, weight: 3 }, // Important notes
    ];
    
    // Extract high-priority content
    for (const line of lines) {
      for (const { pattern, weight } of priorityPatterns) {
        const match = line.match(pattern);
        if (match) {
          const summaryLine = match[0];
          const lineTokens = this.countTokens(summaryLine);
          
          if (currentTokens + lineTokens <= maxTokens) {
            summary.push(summaryLine);
            currentTokens += lineTokens;
          }
          break;
        }
      }
      
      if (currentTokens >= maxTokens) break;
    }
    
    // If no priority content found, take first few lines
    if (summary.length === 0) {
      for (const line of lines) {
        const lineTokens = this.countTokens(line);
        if (currentTokens + lineTokens <= maxTokens) {
          summary.push(line);
          currentTokens += lineTokens;
        } else {
          break;
        }
      }
    }
    
    return summary.join('\n');
  }
  
  // Optimize content for AI consumption
  static optimizeForAI(
    content: string,
    context: string,
    maxTokens: number = 500
  ): string {
    // Add context header
    let optimized = `[Context: ${context}]\n\n`;
    
    // Extract summary if content is long
    const contentTokens = this.countTokens(content);
    if (contentTokens > maxTokens * 0.8) {
      const summary = this.extractSummary(content, Math.floor(maxTokens * 0.2));
      optimized += `Summary:\n${summary}\n\n---\n\n`;
    }
    
    // Compress remaining content
    const remainingTokens = maxTokens - this.countTokens(optimized);
    const compressed = this.compress(content, {
      maxTokens: remainingTokens,
      preserveStructure: true,
      contextWindow: 2,
      smartFiltering: true
    });
    
    optimized += compressed.compressed;
    
    return optimized;
  }
}