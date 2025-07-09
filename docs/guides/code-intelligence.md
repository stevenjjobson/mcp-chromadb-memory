# Code Intelligence Guide

**Status**: ✅ OPERATIONAL with PostgreSQL Backend

## Overview

The Code Intelligence feature transforms the MCP ChromaDB Memory Server into a powerful code-aware assistant optimized for Claude Code and development workflows. With the new PostgreSQL backend, it provides blazing-fast automatic codebase indexing (644 symbols/second), streaming search results, pattern detection, and natural language queries for code.

## Key Features

### 1. Automatic Symbol Indexing
The platform automatically extracts and indexes code symbols from your projects:

- **Functions & Methods**: Full signature, parameters, return types
- **Classes & Interfaces**: Properties, methods, inheritance
- **Variables & Constants**: Type information, scope
- **Imports & Dependencies**: Module relationships, usage tracking

### 2. Streaming Search Architecture
Optimized for Claude Code's command-line interface with fast, incremental results:

- First results appear in <50ms
- Prioritized streaming (exact matches → fuzzy → semantic)
- Background indexing doesn't block searches
- Handles large codebases efficiently

### 3. Code Pattern Recognition
Detects and learns from coding patterns in your projects:

- Common implementation patterns
- Anti-patterns and code smells
- Refactoring opportunities
- Team coding conventions

### 4. Natural Language Queries
Ask about code in plain English:

- "Find all API endpoints"
- "Show authentication logic"
- "Where is user data validated?"
- "Find error handling patterns"

## Getting Started

### Enable Code Intelligence

In your environment file (`.env.DEVELOPMENT` for testing):

```env
# Enable code intelligence features
CODE_INDEXING_ENABLED=true
CODE_PATTERN_DETECTION=true
CODE_STREAMING_ENABLED=true

# Configure indexing patterns
CODE_INDEXING_PATTERNS="**/*.{js,ts,py,java,go,rs,cpp}"
CODE_INDEXING_EXCLUDE="**/node_modules/**,**/dist/**,**/.git/**"

# Performance tuning
CODE_CACHE_SIZE=1000
CODE_SYMBOL_CONTEXT_LINES=15
```

### Index Your Codebase

Use the `index_codebase` tool to scan your project:

```json
{
  "tool": "index_codebase",
  "path": "./src",
  "patterns": "**/*.{js,ts}",
  "options": {
    "followImports": true,
    "extractDocs": true
  }
}
```

## Code Intelligence Tools

### `index_codebase`
Indexes a directory or specific files for symbol extraction.

**Parameters:**
- `path` (string): Directory or file to index
- `patterns` (string): Glob patterns for files to include
- `options` (object):
  - `followImports`: Track import relationships
  - `extractDocs`: Include JSDoc/docstrings
  - `incremental`: Only index changed files

**Example:**
```typescript
await index_codebase({
  path: "./src",
  patterns: "**/*.ts",
  options: {
    followImports: true,
    extractDocs: true,
    incremental: true
  }
});
```

### `find_symbol`
Stream-based search for code symbols with instant results.

**Parameters:**
- `query` (string): Symbol name or pattern
- `type` (string): Optional filter (function, class, variable)
- `limit` (number): Maximum results (default: 20)
- `stream` (boolean): Enable streaming (default: true)

**Example:**
```typescript
// Find all authentication functions
await find_symbol({
  query: "auth",
  type: "function",
  stream: true
});
```

### `get_symbol_context`
Retrieve rich context for a specific symbol.

**Parameters:**
- `symbolId` (string): Symbol identifier
- `depth` (number): Relationship depth (default: 2)
- `includeUsage` (boolean): Include usage examples

**Response includes:**
- Full implementation
- Import statements
- Call sites
- Related tests
- Documentation

### `analyze_code_patterns`
Detect patterns and suggest improvements.

**Parameters:**
- `scope` (string): File path or directory
- `patterns` (array): Specific patterns to check
- `includeRefactoring` (boolean): Suggest refactoring

**Example response:**
```json
{
  "patterns": [
    {
      "type": "api_endpoint",
      "count": 15,
      "files": ["api/routes.js", "api/users.js"],
      "suggestion": "Consider using a route factory pattern"
    }
  ],
  "antiPatterns": [
    {
      "type": "callback_hell",
      "location": "utils/async.js:45",
      "suggestion": "Refactor to async/await"
    }
  ]
}
```

### `search_code_natural`
Natural language search for code implementations.

**Parameters:**
- `query` (string): Natural language question
- `context` (string): Optional scope (file, module, project)

**Examples:**
```typescript
// Find authentication logic
await search_code_natural({
  query: "How does user authentication work?",
  context: "project"
});

// Find error handling
await search_code_natural({
  query: "Show me all error handling in the API layer",
  context: "api/"
});
```

## Usage Patterns

### 1. Initial Project Setup
When starting work on a new project:

```typescript
// Index the entire codebase
await index_codebase({ path: ".", patterns: "**/*.{js,ts}" });

// Get project overview
await analyze_code_patterns({ scope: ".", includeRefactoring: false });

// Store important patterns as memories
await store_memory({
  content: "Main API router is in src/api/index.ts using Express",
  context: "code_structure"
});
```

### 2. Finding Implementations
When you need to understand how something works:

```typescript
// Natural language query
const auth = await search_code_natural({
  query: "Where is user login implemented?"
});

// Direct symbol search
const loginFunc = await find_symbol({
  query: "login",
  type: "function"
});

// Get full context
const context = await get_symbol_context({
  symbolId: loginFunc.results[0].id,
  includeUsage: true
});
```

### 3. Code Review & Refactoring
When reviewing code or planning refactoring:

```typescript
// Analyze patterns in a module
const patterns = await analyze_code_patterns({
  scope: "./src/services",
  includeRefactoring: true
});

// Find similar implementations
const similar = await find_symbol({
  query: "validate*",
  type: "function"
});

// Store refactoring decision
await store_memory({
  content: "Refactor validation functions to use common validator pattern",
  context: "code_decision",
  metadata: { 
    files: similar.results.map(r => r.filePath),
    pattern: "validation"
  }
});
```

### 4. Learning from Patterns
The system learns from your coding patterns:

```typescript
// After implementing a new pattern
await store_memory({
  content: "Implemented factory pattern for API routes",
  context: "code_pattern",
  metadata: {
    pattern: "factory",
    files: ["api/routeFactory.ts"],
    benefits: "Reduced boilerplate by 60%"
  }
});

// System will suggest this pattern in similar contexts
const suggestions = await analyze_code_patterns({
  scope: "./src/api/v2",
  patterns: ["factory"]
});
```

## Integration with Memory System

Code intelligence integrates seamlessly with the memory system:

### Code-Specific Memory Contexts
- `code_symbol`: Individual function/class definitions
- `code_pattern`: Reusable patterns and conventions
- `code_decision`: Architecture and refactoring decisions
- `code_snippet`: Useful code examples

### Automatic Context Preservation
When working with Claude Code, the system automatically:
- Tracks which files you're working on
- Remembers symbol relationships
- Preserves refactoring decisions
- Maintains code quality metrics

### Cross-Session Intelligence
```typescript
// In one session
await store_memory({
  content: "UserService.authenticate() has a race condition with token refresh",
  context: "code_issue",
  metadata: { 
    file: "services/UserService.ts",
    line: 145,
    severity: "high"
  }
});

// In a later session
const issues = await recall_memories({
  query: "UserService problems",
  context: "code_issue"
});
// Returns the race condition warning
```

## Performance Optimization

### Streaming Results
Configure streaming for optimal Claude Code experience:

```env
# Streaming configuration
CODE_STREAMING_ENABLED=true
CODE_STREAMING_CHUNK_SIZE=10
CODE_STREAMING_DELAY_MS=50
```

### Caching Strategy
Frequently accessed symbols are cached:

```env
# Cache configuration
CODE_CACHE_SIZE=1000
CODE_CACHE_TTL=3600  # 1 hour
CODE_CACHE_STRATEGY=lru  # Least recently used
```

### Indexing Performance

**PostgreSQL-Powered Performance (Verified)**:
- **Speed**: 644 symbols/second (60x faster than ChromaDB)
- **Bulk Operations**: 310 symbols in 481ms
- **No Throttling**: Handles 10k+ symbols without errors
- **Connection**: <1ms latency to PostgreSQL

For large codebases:

```typescript
// Index incrementally with PostgreSQL backend
await index_codebase({
  path: "./src",
  options: {
    incremental: true,
    parallel: true,
    batchSize: 1000  // Increased from 100 - PostgreSQL handles it easily
  }
});

// Monitor indexing progress
const stats = await get_indexing_stats();
console.log(`Indexed ${stats.symbolCount} symbols in ${stats.duration}ms`);
// Example output: "Indexed 310 symbols in 481ms"
```

## Best Practices

### 1. Regular Indexing
Set up automatic indexing for changed files:

```typescript
// Watch for file changes
watch("./src/**/*.ts", async (file) => {
  await index_codebase({
    path: file,
    options: { incremental: true }
  });
});
```

### 2. Context-Aware Searches
Provide context for better results:

```typescript
// Instead of generic search
await find_symbol({ query: "save" });

// Use specific context
await find_symbol({ 
  query: "save",
  type: "function",
  context: "models/User"
});
```

### 3. Pattern Documentation
Document patterns as you discover them:

```typescript
// When you find a good pattern
await store_memory({
  content: "Repository pattern with TypeScript generics provides type-safe data access",
  context: "code_pattern",
  metadata: {
    example: "repositories/BaseRepository.ts",
    benefits: ["Type safety", "Reusability", "Testability"]
  }
});
```

### 4. Team Knowledge Sharing
Share code insights with your team:

```typescript
// Document gotchas
await store_memory({
  content: "AsyncStorage on React Native has 6MB limit - use MMKV for large data",
  context: "code_gotcha",
  metadata: {
    platform: "react-native",
    alternative: "react-native-mmkv"
  }
});
```

## Troubleshooting

### Indexing Issues
If symbols aren't being found:

1. Check indexing patterns match your files
2. Verify exclude patterns aren't too broad
3. Run manual indexing with verbose logging
4. Check PostgreSQL connection status
5. Verify hybrid storage is enabled (`USE_HYBRID_STORAGE=true`)

### Performance Issues
With PostgreSQL backend, performance issues are rare, but if they occur:

1. Check PostgreSQL connection pool settings
2. Verify indexes are created (`\d code_symbols` in psql)
3. Monitor PostgreSQL query performance
4. Ensure `POSTGRES_READ_RATIO` is set appropriately (0.5 or higher)

### Memory Usage
For large codebases:

1. PostgreSQL handles millions of symbols efficiently
2. Use incremental indexing for updates
3. Archive unused project indexes
4. Monitor PostgreSQL disk usage

## Future Enhancements

### Coming Soon
- Language Server Protocol integration
- Real-time collaborative coding insights
- AI-powered code review suggestions
- Cross-project pattern learning
- Git blame integration for context

### Experimental Features
Enable experimental features in DEVELOPMENT:

```env
# Experimental features
CODE_AI_SUGGESTIONS=true
CODE_COLLABORATIVE_PATTERNS=true
CODE_SEMANTIC_DIFF=true
```

## Examples

### Complete Workflow Example

```typescript
// 1. Starting a new feature
const relatedCode = await search_code_natural({
  query: "How is user authentication currently implemented?"
});

// 2. Understanding the codebase
const authSymbols = await find_symbol({
  query: "auth*",
  type: "function"
});

// 3. Analyzing patterns
const patterns = await analyze_code_patterns({
  scope: "./src/auth",
  includeRefactoring: true
});

// 4. Making changes
// ... implement new feature ...

// 5. Documenting decisions
await store_memory({
  content: "Implemented OAuth2 flow using Passport.js strategy pattern",
  context: "code_decision",
  metadata: {
    feature: "oauth2",
    files: ["auth/strategies/oauth2.ts"],
    reasoning: "Passport provides battle-tested OAuth implementation"
  }
});

// 6. Updating patterns
await store_memory({
  content: "Passport strategy pattern for authentication providers",
  context: "code_pattern",
  metadata: {
    pattern: "strategy",
    module: "authentication",
    example: "auth/strategies/oauth2.ts"
  }
});
```

## Conclusion

Code Intelligence transforms the MCP ChromaDB Memory Server into a comprehensive development companion that understands your code, learns from your patterns, and provides instant, contextual assistance. By combining semantic search, pattern recognition, and streaming architecture, it delivers the fast, intelligent responses that Claude Code users need.

For more information, see:
- [Platform Architecture](./Project_Context/Platform%20Approach%20-%20Cognitive%20State%20Management.md)
- [Implementation Roadmap](./Project_Context/Implementation%20Roadmap.md)
- [Memory Usage Guide](./MEMORY_USAGE_GUIDE.md)