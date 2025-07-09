/**
 * Simple Code Parser
 * Regex-based symbol extraction for JavaScript/TypeScript
 */

import { CodeSymbol, CodeSymbolType, SupportedLanguage } from '../types/code-intelligence.types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SimpleCodeParser {
  /**
   * Extract symbols from a JavaScript/TypeScript file
   */
  async parseFile(filePath: string): Promise<CodeSymbol[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);
    const symbols: CodeSymbol[] = [];
    
    // Split into lines for line number tracking
    const lines = content.split('\n');
    
    // Extract functions
    symbols.push(...this.extractFunctions(lines, filePath, language));
    
    // Extract classes
    symbols.push(...this.extractClasses(lines, filePath, language));
    
    // Extract interfaces (TypeScript only)
    if (language === 'typescript') {
      symbols.push(...this.extractInterfaces(lines, filePath));
    }
    
    // Extract imports
    symbols.push(...this.extractImports(lines, filePath, language));
    
    // Extract exports
    symbols.push(...this.extractExports(lines, filePath, language));
    
    return symbols;
  }
  
  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): SupportedLanguage {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.mjs':
        return 'javascript';
      default:
        return 'javascript'; // Default for now
    }
  }
  
  /**
   * Extract function declarations
   */
  private extractFunctions(lines: string[], filePath: string, language: SupportedLanguage): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    
    // Regex patterns for different function styles
    const patterns = [
      // Regular function declaration: function name(...) { }
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
      // Arrow function: const name = (...) => { }
      /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
      // Method in class/object: name(...) { } or async name(...) { }
      /^\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*{/,
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const name = match[1];
          const params = match[2];
          const isAsync = line.includes('async');
          const isExported = line.includes('export');
          
          // Skip constructor and common method names that might be noise
          if (name === 'constructor' || name === 'if' || name === 'for' || name === 'while') {
            continue;
          }
          
          // Build the definition (include a few lines for context)
          const definitionLines = [];
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            definitionLines.push(lines[j]);
            if (lines[j].includes('{')) break;
          }
          
          symbols.push({
            id: `${filePath}:${name}:${i + 1}`,
            name,
            type: 'function',
            language,
            file: filePath,
            line: i + 1,
            definition: definitionLines.join('\n'),
            signature: `${name}(${params})`,
            isAsync,
            exports: isExported,
            parameters: this.parseParameters(params),
          });
          
          break; // Only match once per line
        }
      }
    }
    
    return symbols;
  }
  
  /**
   * Extract class declarations
   */
  private extractClasses(lines: string[], filePath: string, language: SupportedLanguage): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const pattern = /^\s*(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(pattern);
      
      if (match) {
        const name = match[1];
        const extendsClass = match[2];
        const implementsInterfaces = match[3]?.split(',').map(s => s.trim()).filter(Boolean);
        const isExported = line.includes('export');
        
        // Build the definition
        const definitionLines = [line];
        
        symbols.push({
          id: `${filePath}:${name}:${i + 1}`,
          name,
          type: 'class',
          language,
          file: filePath,
          line: i + 1,
          definition: definitionLines.join('\n'),
          exports: isExported,
          extends: extendsClass,
          implements: implementsInterfaces,
        });
      }
    }
    
    return symbols;
  }
  
  /**
   * Extract interface declarations (TypeScript only)
   */
  private extractInterfaces(lines: string[], filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const pattern = /^\s*(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(pattern);
      
      if (match) {
        const name = match[1];
        const extendsInterfaces = match[2]?.split(',').map(s => s.trim()).filter(Boolean);
        const isExported = line.includes('export');
        
        symbols.push({
          id: `${filePath}:${name}:${i + 1}`,
          name,
          type: 'interface',
          language: 'typescript',
          file: filePath,
          line: i + 1,
          definition: line,
          exports: isExported,
          extends: extendsInterfaces?.[0], // Simplified for now
        });
      }
    }
    
    return symbols;
  }
  
  /**
   * Extract import statements
   */
  private extractImports(lines: string[], filePath: string, language: SupportedLanguage): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const patterns = [
      // ES6 imports: import { X } from 'Y' or import X from 'Y'
      /^\s*import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/,
      // CommonJS: const X = require('Y')
      /^\s*const\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const imports = match[1] || match[2] || match[3];
          const source = match[4] || match[3];
          
          if (imports && source) {
            symbols.push({
              id: `${filePath}:import:${i + 1}`,
              name: imports,
              type: 'import',
              language,
              file: filePath,
              line: i + 1,
              definition: line.trim(),
              imports: [source],
            });
          }
          break;
        }
      }
    }
    
    return symbols;
  }
  
  /**
   * Extract export statements
   */
  private extractExports(lines: string[], filePath: string, language: SupportedLanguage): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const pattern = /^\s*export\s+(?:{([^}]+)}|default\s+(\w+)|(\w+))/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip if this is already part of a function/class declaration
      if (line.match(/export\s+(class|function|interface|const|let|var)/)) {
        continue;
      }
      
      const match = line.match(pattern);
      if (match) {
        const exports = match[1] || match[2] || match[3];
        
        if (exports) {
          symbols.push({
            id: `${filePath}:export:${i + 1}`,
            name: exports,
            type: 'export',
            language,
            file: filePath,
            line: i + 1,
            definition: line.trim(),
            exports: true,
          });
        }
      }
    }
    
    return symbols;
  }
  
  /**
   * Parse function parameters
   */
  private parseParameters(paramsString: string): Array<{ name: string; type?: string; optional?: boolean }> {
    if (!paramsString.trim()) return [];
    
    // Simple parameter parsing - can be enhanced later
    const params = paramsString.split(',').map(p => p.trim());
    
    return params.map(param => {
      // Check for TypeScript type annotations
      const typeMatch = param.match(/(\w+)(?:\?)?(?:\s*:\s*(.+))?/);
      if (typeMatch) {
        return {
          name: typeMatch[1],
          type: typeMatch[2],
          optional: param.includes('?'),
        };
      }
      
      // Check for default values
      const defaultMatch = param.match(/(\w+)\s*=\s*.+/);
      if (defaultMatch) {
        return {
          name: defaultMatch[1],
          optional: true,
        };
      }
      
      return { name: param };
    }).filter(p => p.name && p.name !== '');
  }
}