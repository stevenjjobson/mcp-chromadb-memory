#!/usr/bin/env node

import { ChromaClient } from 'chromadb';

async function clearWorkingTier() {
  console.log('🗑️  Clearing PRODUCTION Working Tier Memories');
  console.log('==========================================\n');
  
  const client = new ChromaClient({
    host: 'localhost',
    port: 8000
  });
  
  try {
    // Get the working tier collection
    console.log('📦 Accessing working tier collection...');
    const collection = await client.getCollection({
      name: 'ai_memories_PRODUCTION_working',
      embeddingFunction: {
        generate: async (texts) => texts.map(() => new Array(1536).fill(0))
      }
    });
    
    // Get current memories before deletion
    const beforeDelete = await collection.get();
    const memoryCount = beforeDelete.ids ? beforeDelete.ids.length : 0;
    
    if (memoryCount === 0) {
      console.log('ℹ️  Working tier is already empty.');
      return;
    }
    
    console.log(`Found ${memoryCount} memories in working tier\n`);
    
    // Show what will be deleted
    console.log('📋 Memories to be deleted:');
    for (let i = 0; i < beforeDelete.ids.length; i++) {
      const metadata = beforeDelete.metadatas[i] || {};
      const content = beforeDelete.documents[i];
      const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
      console.log(`  ${i + 1}. ${beforeDelete.ids[i]} - ${preview}`);
    }
    
    console.log('\n🔄 Deleting all memories from working tier...');
    
    // Delete all memories
    await collection.delete({
      ids: beforeDelete.ids
    });
    
    // Verify deletion
    const afterDelete = await collection.get();
    const remainingCount = afterDelete.ids ? afterDelete.ids.length : 0;
    
    if (remainingCount === 0) {
      console.log(`\n✅ Successfully deleted ${memoryCount} memories from working tier`);
      console.log('Working tier is now empty.');
    } else {
      console.log(`\n⚠️  Warning: ${remainingCount} memories still remain in working tier`);
    }
    
  } catch (error) {
    console.error('\n❌ Error clearing working tier:', error);
    process.exit(1);
  }
}

// Run the clearing operation
clearWorkingTier().catch(console.error);