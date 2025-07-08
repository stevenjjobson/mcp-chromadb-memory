# ChromaDB API Version Note

## Important: API Version Deprecation

The ChromaDB v1 API is deprecated. When checking ChromaDB health or making direct API calls, use v2 endpoints.

### API Changes:
- **Old**: `/api/v1/heartbeat`
- **New**: Use ChromaDB client library which handles v2 API internally

### Current Issue:
The ChromaDB server is responding but appears to be throttling or rejecting batch operations when too many requests are made in quick succession. This manifests as "Unable to connect to the chromadb server" errors even though the server is running.

### Recommendations:
1. Use the ChromaDB client library rather than direct API calls
2. Implement proper rate limiting between batches
3. Consider reducing batch sizes for initial indexing
4. Add exponential backoff retry logic for failed operations

### Configuration for Throttling Prevention:
```env
# Recommended settings for code indexing
BATCH_SIZE=50              # Reduced from 100
BATCH_DELAY_MS=500         # Increased from 200
MAX_CONCURRENT_BATCHES=1   # Reduced from 3
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=2000        # Increased from 1000
```

These settings help prevent overwhelming ChromaDB during bulk indexing operations.