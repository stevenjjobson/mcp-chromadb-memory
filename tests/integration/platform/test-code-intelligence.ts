/**
 * Test script for Code Intelligence features
 * Run this to test the code indexing capabilities
 */

import { CodeIntelligenceTools } from './src/tools/code-intelligence-tools.js';
import { EnhancedMemoryManager } from './src/memory-manager-enhanced.js';
import { config } from './src/config.js';

async function testCodeIntelligence() {
  console.log('🧪 Testing Code Intelligence Features\n');
  
  try {
    // Initialize memory manager
    const memoryManager = new EnhancedMemoryManager(config);
    await memoryManager.initialize();
    console.log('✅ Memory manager initialized\n');
    
    // Initialize code intelligence tools
    const codeTools = new CodeIntelligenceTools(memoryManager);
    console.log('✅ Code intelligence tools initialized\n');
    
    // Get the tool handlers
    const tools = codeTools.getTools();
    const indexTool = tools.find(t => t.name === 'index_codebase')!;
    const findTool = tools.find(t => t.name === 'find_symbol')!;
    const nlSearchTool = tools.find(t => t.name === 'search_code_natural')!;
    const patternTool = tools.find(t => t.name === 'analyze_code_patterns')!;
    
    // Test 1: Index the codebase
    console.log('📚 Test 1: Indexing codebase...');
    const indexResult = await indexTool.handler({
      path: './src',
      pattern: '**/*.{js,ts}',
      excludePatterns: ['**/node_modules/**', '**/dist/**']
    });
    console.log('Index result:', JSON.stringify(indexResult, null, 2));
    console.log('✅ Indexing complete\n');
    
    // Test 2: Find symbols
    console.log('🔍 Test 2: Finding symbols...');
    const findResult = await findTool.handler({
      query: 'store',
      type: ['function'],
      limit: 5
    });
    console.log('Found symbols:', JSON.stringify(findResult, null, 2));
    console.log('✅ Symbol search complete\n');
    
    // Test 3: Natural language search
    console.log('💬 Test 3: Natural language search...');
    const nlResult = await nlSearchTool.handler({
      query: 'Where is memory stored?'
    });
    console.log('Natural language result:', JSON.stringify(nlResult, null, 2));
    console.log('✅ Natural language search complete\n');
    
    // Test 4: Analyze code patterns
    console.log('🧠 Test 4: Analyzing code patterns...');
    const patternResult = await patternTool.handler({
      path: './src',
      patterns: ['console_logs', 'no_error_handling']
    });
    console.log('Pattern analysis:', JSON.stringify(patternResult, null, 2));
    console.log('✅ Pattern analysis complete\n');
    
    // Test 5: Get memory stats
    console.log('📊 Test 5: Checking memory stats...');
    const stats = await memoryManager.getTierStats();
    console.log('Memory stats:', JSON.stringify(stats, null, 2));
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCodeIntelligence().then(() => {
  console.log('\n✨ Code Intelligence is working properly!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});