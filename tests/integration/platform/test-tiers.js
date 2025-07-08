#!/usr/bin/env node

import { EnhancedMemoryManager } from '../dist/memory-manager-enhanced.js';
import { config } from '../dist/config.js';

async function testTiers() {
  console.log('🧪 Testing Hierarchical Memory System');
  console.log('=====================================\n');
  
  // Initialize memory manager
  const memoryManager = new EnhancedMemoryManager(config);
  
  try {
    await memoryManager.initialize();
    console.log('✅ Memory manager initialized\n');
    
    // Store some test memories
    console.log('📝 Storing test memories...');
    
    // Store a working memory (recent)
    const result1 = await memoryManager.storeMemory(
      'This is a fresh working memory for testing hierarchical tiers',
      'task_critical',
      { test: true, tier_test: 'working' }
    );
    console.log(`Stored memory 1: ${result1.id} in ${result1.tier} tier`);
    
    // Store a session memory (simulate older) - use task_critical for higher importance
    const result2 = await memoryManager.storeMemory(
      'This is a CRITICAL session memory for the hierarchical tier system testing process',
      'task_critical',
      { 
        test: true, 
        tier_test: 'session',
        // Note: We can't override the timestamp during storage, it will be in working tier initially
      }
    );
    console.log(`Stored memory 2: ${result2.id} in ${result2.tier} tier`);
    
    // Store a long-term memory (simulate very old) - use important content
    const result3 = await memoryManager.storeMemory(
      'IMPORTANT: This is a critical decision about the hierarchical memory architecture design',
      'task_critical',
      {
        test: true,
        tier_test: 'longterm',
        // Note: We can't override the timestamp during storage, it will be in working tier initially
      }
    );
    console.log(`Stored memory 3: ${result3.id} in ${result3.tier} tier\n`);
    
    // Get tier statistics
    console.log('📊 Tier Statistics:');
    const stats = await memoryManager.getTierStats();
    
    for (const [tier, data] of Object.entries(stats)) {
      console.log(`\n${tier.toUpperCase()} Tier:`);
      console.log(`  - Count: ${data.count}`);
      if (data.oldestMemory) {
        console.log(`  - Oldest: ${data.oldestMemory}`);
      }
      if (data.newestMemory) {
        console.log(`  - Newest: ${data.newestMemory}`);
      }
    }
    
    // Test multi-tier search
    console.log('\n🔍 Testing Multi-Tier Search:');
    const searchResults = await memoryManager.searchSemantic('hierarchical memory testing', undefined, 10);
    
    console.log(`Found ${searchResults.length} memories across tiers:`);
    for (const result of searchResults) {
      console.log(`  - ${result.memory.id} (${result.memory.tier || 'unknown'} tier) - Score: ${result.totalScore.toFixed(3)}`);
    }
    
    // Test migration candidates
    console.log('\n🔄 Checking for Migration Candidates:');
    const candidates = await memoryManager.getMemoriesForMigration();
    console.log(`Found ${candidates.length} memories that need migration`);
    
    for (const candidate of candidates) {
      console.log(`  - ${candidate.memory.id}: ${candidate.currentTier} → ${candidate.targetTier}`);
    }
    
    console.log('\n✅ Hierarchical memory system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await memoryManager.close();
  }
}

// Run the test
testTiers().catch(console.error);