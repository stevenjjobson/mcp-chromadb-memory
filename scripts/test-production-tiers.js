#!/usr/bin/env node

import { EnhancedMemoryManager } from '../dist/memory-manager-enhanced.js';
import { MigrationService } from '../dist/services/migration-service.js';
import { config as loadConfig } from '../dist/config.js';

// Force production environment
process.env.ENVIRONMENT_NAME = 'PRODUCTION';

async function testProductionTiers() {
  console.log('🏭 Testing PRODUCTION Tier Setup');
  console.log('================================\n');
  
  // Reload config for production
  const { config } = await import('../dist/config.js');
  
  console.log(`Environment: ${config.environment}`);
  console.log(`Tiers Enabled: ${config.tierEnabled}`);
  console.log(`ChromaDB: http://${config.chromaHost}:${config.chromaPort}\n`);
  
  if (!config.tierEnabled) {
    console.error('❌ Tiers are not enabled in production!');
    return;
  }
  
  // Initialize memory manager
  const memoryManager = new EnhancedMemoryManager(config);
  
  try {
    console.log('🔄 Initializing memory manager with tiers...');
    await memoryManager.initialize();
    console.log('✅ Memory manager initialized\n');
    
    // Get tier statistics
    console.log('📊 Initial Tier Statistics:');
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
    
    // Check for existing memories in main collection
    console.log('\n🔍 Checking for memories to migrate...');
    const candidates = await memoryManager.getMemoriesForMigration();
    console.log(`Found ${candidates.length} memories that need migration`);
    
    if (candidates.length > 0) {
      console.log('\n📦 Migration candidates:');
      for (const candidate of candidates.slice(0, 5)) { // Show first 5
        console.log(`  - ${candidate.memory.id}: ${candidate.currentTier} → ${candidate.targetTier}`);
      }
      if (candidates.length > 5) {
        console.log(`  ... and ${candidates.length - 5} more`);
      }
    }
    
    // Test storing a new memory
    console.log('\n📝 Testing new memory storage...');
    const testResult = await memoryManager.storeMemory(
      'PRODUCTION TEST: Hierarchical tiers are now active in production environment',
      'task_critical',
      { production_test: true, tier_activation: new Date().toISOString() }
    );
    
    if (testResult.stored) {
      console.log(`✅ Test memory stored: ${testResult.id} in ${testResult.tier} tier`);
    }
    
    // Test search across tiers
    console.log('\n🔍 Testing multi-tier search...');
    const searchResults = await memoryManager.searchSemantic('production test hierarchical', undefined, 5);
    console.log(`Found ${searchResults.length} results across tiers`);
    
    // Initialize migration service
    console.log('\n🔄 Initializing migration service...');
    const migrationService = new MigrationService(memoryManager, config);
    
    // Get migration status
    const status = migrationService.getStatus();
    console.log(`Migration Service Status:`);
    console.log(`  - Running: ${status.isRunning}`);
    console.log(`  - Last Migration: ${status.lastMigration || 'Never'}`);
    console.log(`  - Next Migration: ${status.nextMigration || 'Not scheduled'}`);
    
    console.log('\n✅ Production tier system is ready!');
    console.log('\n⚠️  Note: The migration service will automatically migrate memories between tiers');
    console.log('based on age and access patterns every hour (configurable).\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\nMake sure ChromaDB is running on port 8000');
  } finally {
    await memoryManager.close();
  }
}

// Run the test
testProductionTiers().catch(console.error);