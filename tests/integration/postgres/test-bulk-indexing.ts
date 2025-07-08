#!/usr/bin/env node
/**
 * Test bulk symbol indexing with PostgreSQL
 */

import { config } from './dist/config.js';
import { HybridMemoryManager } from './dist/memory-manager-hybrid.js';
import { CodeIntelligenceTools } from './dist/tools/code-intelligence-tools.js';

// Enable hybrid storage for testing
config.useHybridStorage = true;
config.environment = 'DEVELOPMENT';

async function testBulkIndexing() {
  console.log('🧪 Testing bulk symbol indexing with PostgreSQL...\n');
  
  const memoryManager = new HybridMemoryManager(config);
  
  try {
    // Initialize managers
    console.log('1️⃣ Initializing hybrid memory manager...');
    await memoryManager.initialize();
    console.log('✅ Memory manager initialized\n');
    
    // Create code intelligence tools
    const codeTools = new CodeIntelligenceTools(memoryManager);
    console.log('2️⃣ Code intelligence tools created\n');
    
    // Get the index_codebase tool handler
    const tools = codeTools.getTools();
    const indexTool = tools.find(t => t.name === 'index_codebase');
    
    if (!indexTool) {
      throw new Error('index_codebase tool not found');
    }
    
    console.log('3️⃣ Starting codebase indexing...');
    const startTime = Date.now();
    
    // Index the src directory
    const result = await indexTool.handler({
      path: './src',
      patterns: ['**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      includeDefinitions: true,
      includeReferences: false
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Indexing Results:');
    console.log('─'.repeat(50));
    console.log(`✅ Success: ${result.success}`);
    console.log(`📁 Files processed: ${result.filesProcessed}`);
    console.log(`🔍 Symbols indexed: ${result.symbolsIndexed}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
    
    if (result.symbolsIndexed > 0) {
      console.log(`⚡ Speed: ${(result.symbolsIndexed / duration).toFixed(1)} symbols/second`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.forEach((err: string) => console.log(`  - ${err}`));
    }
    
    // Test symbol search
    console.log('\n4️⃣ Testing symbol search...');
    const findTool = tools.find(t => t.name === 'find_symbol');
    
    if (findTool) {
      const searchResult = await findTool.handler({
        query: 'HybridMemoryManager',
        type: ['class'],
        limit: 5
      });
      
      console.log(`\n🔎 Search results for "HybridMemoryManager":`);
      if (searchResult.results && searchResult.results.length > 0) {
        searchResult.results.forEach((r: any) => {
          console.log(`  - ${r.symbol.name} (${r.symbol.type}) at ${r.symbol.file}:${r.symbol.line}`);
        });
      } else {
        console.log('  No results found');
      }
    }
    
    // Get memory stats
    const stats = await memoryManager.getMemoryStats();
    console.log('\n📈 Memory Statistics:');
    console.log('─'.repeat(50));
    console.log(`ChromaDB memories: ${stats.totalMemories}`);
    if (stats.postgres) {
      console.log(`PostgreSQL memories: ${JSON.stringify(stats.postgres.contexts, null, 2)}`);
      if (stats.postgres.symbols) {
        console.log(`PostgreSQL symbols: ${JSON.stringify(stats.postgres.symbols, null, 2)}`);
      }
    }
    
    console.log('\n✅ Bulk indexing test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await memoryManager.close();
  }
}

// Run the test
testBulkIndexing().catch(console.error);