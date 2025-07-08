/**
 * Test individual writes to ChromaDB to verify basic functionality
 */

import { EnhancedMemoryManager } from './src/memory-manager-enhanced.js';
import { config } from './src/config.js';

async function testIndividualWrites() {
  console.log('🧪 Testing Individual Writes to ChromaDB\n');
  
  try {
    // Initialize memory manager
    const memoryManager = new EnhancedMemoryManager(config);
    await memoryManager.initialize();
    console.log('✅ Memory manager initialized\n');
    
    // Test data
    const testSymbols = [
      { name: 'testFunction1', type: 'function', content: 'function testFunction1() { return "test1"; }' },
      { name: 'testFunction2', type: 'function', content: 'function testFunction2() { return "test2"; }' },
      { name: 'TestClass', type: 'class', content: 'class TestClass { constructor() {} }' },
      { name: 'testVariable', type: 'variable', content: 'const testVariable = "test";' },
      { name: 'testInterface', type: 'interface', content: 'interface TestInterface { id: string; }' }
    ];
    
    console.log('📝 Testing individual writes with delays...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const symbol of testSymbols) {
      try {
        console.log(`Writing ${symbol.type} ${symbol.name}...`);
        
        const result = await memoryManager.storeMemory(
          `${symbol.type} ${symbol.name}\n${symbol.content}`,
          'code_symbol',
          {
            symbolName: symbol.name,
            symbolType: symbol.type,
            file: 'test-file.ts',
            line: 1,
            language: 'typescript'
          }
        );
        
        if (result.stored) {
          successCount++;
          console.log(`✅ Successfully stored ${symbol.name} (importance: ${result.importance})`);
        } else {
          failCount++;
          console.log(`❌ Failed to store ${symbol.name} (importance too low: ${result.importance})`);
        }
        
        // Add delay between writes
        console.log('⏳ Waiting 2 seconds before next write...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        failCount++;
        console.error(`❌ Error storing ${symbol.name}:`, error);
      }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Successful writes: ${successCount}`);
    console.log(`❌ Failed writes: ${failCount}`);
    
    // Check final memory count
    const stats = await memoryManager.getTierStats();
    console.log('\n📈 Memory Stats:', JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testIndividualWrites().then(() => {
  console.log('\n✨ Individual write test completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});