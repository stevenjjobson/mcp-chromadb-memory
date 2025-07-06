import { EnhancedMemoryManager } from './src/memory-manager-enhanced.js';
import { TokenManager } from './src/utils/token-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load secrets
const openaiApiKey = fs.readFileSync(path.join(__dirname, 'secrets/openai_api_key.txt'), 'utf-8').trim();

// Config interface
interface Config {
  openaiApiKey: string;
  chromaHost: string;
  chromaPort: string;
  memoryImportanceThreshold: number;
  memoryCollectionName: string;
  maxMemoryResults: number;
  obsidianVaultPath: string;
  mcpServerName: string;
  mcpServerVersion: string;
}

// Create config with secrets
const config: Config = {
  openaiApiKey,
  chromaHost: process.env.CHROMA_HOST || 'localhost',
  chromaPort: process.env.CHROMA_PORT || '8000',
  memoryImportanceThreshold: parseFloat(process.env.MEMORY_IMPORTANCE_THRESHOLD || '0.7'),
  memoryCollectionName: process.env.MEMORY_COLLECTION_NAME || 'ai_memories',
  maxMemoryResults: parseInt(process.env.MAX_MEMORY_RESULTS || '10'),
  obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH || '',
  mcpServerName: process.env.MCP_SERVER_NAME || 'ai-memory-server',
  mcpServerVersion: process.env.MCP_SERVER_VERSION || '1.0.0'
};

async function testEnhancedMemory() {
  console.log('Testing Enhanced Memory Features...\n');
  
  // Initialize manager
  const manager = new EnhancedMemoryManager(config);
  
  try {
    await manager.initialize();
    console.log('✅ Enhanced Memory Manager initialized\n');
    
    // Test 1: Store some test memories
    console.log('Test 1: Storing test memories...');
    const memories = [
      {
        content: 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
        context: 'code_snippet'
      },
      {
        content: 'The user prefers dark mode and vim key bindings',
        context: 'user_preference'
      },
      {
        content: 'TODO: Implement caching for the calculateTotal function to improve performance',
        context: 'task_critical'
      },
      {
        content: 'Password for the database is stored in environment variable DB_PASSWORD',
        context: 'security'
      }
    ];
    
    for (const memory of memories) {
      const result = await manager.storeMemory(memory.content, memory.context);
      console.log(`  Stored: ${result.stored}, ID: ${result.id}, Importance: ${result.importance}`);
    }
    console.log('');
    
    // Test 2: Exact search
    console.log('Test 2: Testing exact search...');
    const exactResults = await manager.searchExact('calculateTotal');
    console.log(`  Found ${exactResults.length} exact matches for "calculateTotal"`);
    exactResults.forEach(m => console.log(`  - ${m.id}: ${m.content.substring(0, 50)}...`));
    console.log('');
    
    // Test 3: Hybrid search
    console.log('Test 3: Testing hybrid search...');
    const hybridResults = await manager.searchHybrid('performance optimization', undefined, 0.4);
    console.log(`  Found ${hybridResults.length} hybrid matches`);
    hybridResults.forEach(r => console.log(`  - Score: ${r.totalScore.toFixed(3)}, Content: ${r.memory.content.substring(0, 50)}...`));
    console.log('');
    
    // Test 4: Token compression
    console.log('Test 4: Testing token compression...');
    const longText = `
    This is a very long piece of text that contains important information about functions and classes.
    function processData(input) {
      // TODO: Add validation
      const result = transform(input);
      return result;
    }
    
    Some less important text here that might get filtered out during compression.
    More filler text to make this longer and test the compression algorithm.
    
    class DataProcessor {
      constructor() {
        this.cache = new Map();
      }
      
      process(data) {
        // IMPORTANT: Check cache first
        if (this.cache.has(data.id)) {
          return this.cache.get(data.id);
        }
        // Process and cache result
        const result = this.transform(data);
        this.cache.set(data.id, result);
        return result;
      }
    }
    
    Even more text to pad this out and see how well the compression works.
    `;
    
    const compressed = TokenManager.compress(longText, { maxTokens: 100 });
    console.log(`  Original tokens: ${compressed.originalTokens}`);
    console.log(`  Compressed tokens: ${compressed.compressedTokens}`);
    console.log(`  Compression ratio: ${(compressed.compressionRatio * 100).toFixed(1)}%`);
    console.log(`  Compressed content preview:`);
    console.log(compressed.compressed.substring(0, 200) + '...\n');
    
    // Test 5: Compressed context
    console.log('Test 5: Testing compressed context retrieval...');
    const context = await manager.getCompressedContext('function performance', 200);
    console.log(`  Retrieved ${context.memoryCount} memories`);
    console.log(`  Token count: ${context.tokenCount}`);
    console.log(`  Compression ratio: ${(context.compressionRatio * 100).toFixed(1)}%`);
    console.log(`  Context preview:`);
    console.log(context.context.substring(0, 200) + '...\n');
    
    // Test 6: Memory stats
    console.log('Test 6: Getting memory statistics...');
    const stats = await manager.getMemoryStats();
    console.log(`  Total memories: ${stats.totalMemories}`);
    console.log(`  Average importance: ${stats.averageImportance.toFixed(2)}`);
    console.log(`  Recent memories (24h): ${stats.recentMemories}`);
    console.log(`  Context distribution:`, stats.contextCounts);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run tests
testEnhancedMemory().catch(console.error);