#!/usr/bin/env node

import { ChromaClient } from 'chromadb';
import { EnhancedMemoryManager } from '../dist/memory-manager-enhanced.js';
import { config } from '../dist/config.js';

// Force production environment
process.env.ENVIRONMENT_NAME = 'PRODUCTION';

async function migrateExistingMemories() {
  console.log('🔄 Migrating existing memories to tier system');
  console.log('==========================================\n');
  
  const client = new ChromaClient({
    host: 'localhost',
    port: 8000
  });
  
  const memoryManager = new EnhancedMemoryManager(config);
  
  try {
    // Initialize the tier system
    await memoryManager.initialize();
    console.log('✅ Tier system initialized\n');
    
    // Get the old collection
    console.log('📦 Reading memories from old collection...');
    const oldCollection = await client.getCollection({
      name: 'ai_memories',
      embeddingFunction: {
        generate: async (texts) => texts.map(() => new Array(1536).fill(0))
      }
    });
    
    const allMemories = await oldCollection.get();
    
    if (!allMemories.ids || allMemories.ids.length === 0) {
      console.log('No memories found in old collection.');
      return;
    }
    
    console.log(`Found ${allMemories.ids.length} memories to migrate\n`);
    
    // Store each memory in the new tier system
    let migrated = 0;
    let failed = 0;
    
    for (let i = 0; i < allMemories.ids.length; i++) {
      const content = allMemories.documents[i];
      const metadata = allMemories.metadatas[i] || {};
      const context = metadata.context || 'general';
      
      try {
        // Store in the tier system (it will determine the appropriate tier)
        const result = await memoryManager.storeMemory(
          content,
          context,
          metadata
        );
        
        if (result.stored) {
          console.log(`✅ Migrated ${result.id} to ${result.tier} tier`);
          migrated++;
        } else {
          console.log(`⚠️  Skipped memory ${allMemories.ids[i]} (importance too low)`);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${allMemories.ids[i]}:`, error.message);
        failed++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`  - Total memories: ${allMemories.ids.length}`);
    console.log(`  - Successfully migrated: ${migrated}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Skipped: ${allMemories.ids.length - migrated - failed}`);
    
    // Show tier distribution
    console.log('\n📊 Final Tier Distribution:');
    const stats = await memoryManager.getTierStats();
    
    for (const [tier, data] of Object.entries(stats)) {
      console.log(`  - ${tier.toUpperCase()}: ${data.count} memories`);
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  Note: The old collection "ai_memories" still exists but is no longer used.');
    console.log('You may want to delete it manually after verifying the migration.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await memoryManager.close();
  }
}

// Run the migration
migrateExistingMemories().catch(console.error);