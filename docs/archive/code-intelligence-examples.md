# Code Intelligence Examples

## Using with MCP Inspector

To test the code intelligence features with MCP Inspector, first ensure:

1. ChromaDB is running (development instance on port 8001)
2. The environment is configured correctly
3. CODE_INDEXING_ENABLED=true in .env

### Start the MCP server in development mode:

```bash
# Set environment to development
export ENVIRONMENT_NAME=DEVELOPMENT

# Run the inspector
npm run inspect
```

## Example Tool Calls

### 1. Index the Codebase

```json
{
  "tool": "index_codebase",
  "arguments": {
    "path": "./src",
    "pattern": "**/*.{js,ts}",
    "excludePatterns": ["**/node_modules/**", "**/dist/**"],
    "shallow": false
  }
}
```

### 2. Find a Symbol

```json
{
  "tool": "find_symbol",
  "arguments": {
    "query": "storeMemory",
    "type": "function",
    "limit": 10
  }
}
```

### 3. Get Symbol Context

First find a symbol, then use its ID:

```json
{
  "tool": "get_symbol_context",
  "arguments": {
    "symbolId": "func_storeMemory_12345",
    "includeCallers": true,
    "includeRelated": true
  }
}
```

### 4. Natural Language Search

```json
{
  "tool": "search_code_natural",
  "arguments": {
    "query": "How does the memory storage work?"
  }
}
```

### 5. Analyze Code Patterns

```json
{
  "tool": "analyze_code_patterns",
  "arguments": {
    "path": "./src",
    "patterns": ["singleton", "god_class", "callback_hell", "no_error_handling", "console_logs"]
  }
}
```

## Using Programmatically

If you want to test directly from code:

```typescript
// Run the test script
npx tsx test-code-intelligence.ts
```

## Expected Results

### After Indexing
- You should see stats showing files processed and symbols indexed
- Symbols are stored as memories with `code_symbol` context
- Each symbol includes metadata like file path, line number, type

### Symbol Search
- Returns matching functions, classes, interfaces, etc.
- Results include file location and basic signature
- Sorted by relevance

### Pattern Analysis
- Detects common patterns and anti-patterns
- Provides suggestions for improvements
- Stores findings as memories for future reference

## Troubleshooting

### If indexing fails:
1. Check that ChromaDB is running on port 8001
2. Verify OPENAI_API_KEY is set (needed for embeddings)
3. Ensure the path exists and contains TypeScript/JavaScript files

### If no symbols are found:
1. Check that indexing completed successfully
2. Verify the file patterns match your code files
3. Look at the console output for any parsing errors

### If pattern analysis is empty:
1. The patterns might not exist in your code (that's good!)
2. Try analyzing a larger codebase
3. Check specific files known to have the patterns