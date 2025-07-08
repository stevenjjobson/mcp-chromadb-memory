#!/usr/bin/env node

import { ChromaClient } from 'chromadb';
import fs from 'fs/promises';
import path from 'path';

async function backupProduction() {
  console.log('📦 Backing up PRODUCTION memories...\n');
  
  const client = new ChromaClient({
    host: 'localhost',
    port: 8000
  });
  
  try {
    // Get the production collection with a dummy embedding function
    const collection = await client.getCollection({
      name: 'ai_memories',
      embeddingFunction: {
        generate: async (texts) => {
          // Dummy function - we're not generating new embeddings
          return texts.map(() => new Array(1536).fill(0));
        }
      }
    });
    
    // Get all memories
    const allMemories = await collection.get();
    
    if (!allMemories.ids || allMemories.ids.length === 0) {
      console.log('No memories found in production.');
      return;
    }
    
    console.log(`Found ${allMemories.ids.length} memories in production\n`);
    
    // Prepare backup data
    const backup = {
      timestamp: new Date().toISOString(),
      collection: 'ai_memories',
      count: allMemories.ids.length,
      memories: []
    };
    
    // Collect all memory data
    for (let i = 0; i < allMemories.ids.length; i++) {
      backup.memories.push({
        id: allMemories.ids[i],
        document: allMemories.documents[i],
        metadata: allMemories.metadatas[i],
        embedding: allMemories.embeddings ? allMemories.embeddings[i] : null
      });
    }
    
    // Save backup
    const backupDir = `./backups/production_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await fs.mkdir(backupDir, { recursive: true });
    
    const backupPath = path.join(backupDir, 'memories.json');
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup saved to: ${backupPath}`);
    
    // Generate statistics
    const stats = {
      totalMemories: allMemories.ids.length,
      contexts: {},
      importanceDistribution: {},
      ageDistribution: {
        last24h: 0,
        last7d: 0,
        last30d: 0,
        older: 0
      }
    };
    
    const now = Date.now();
    
    for (const metadata of allMemories.metadatas) {
      // Context stats
      const context = metadata.context || 'unknown';
      stats.contexts[context] = (stats.contexts[context] || 0) + 1;
      
      // Importance stats
      const importance = Math.round((metadata.importance || 0.5) * 10) / 10;
      stats.importanceDistribution[importance] = (stats.importanceDistribution[importance] || 0) + 1;
      
      // Age stats
      if (metadata.timestamp) {
        const age = now - new Date(metadata.timestamp).getTime();
        const ageInDays = age / (1000 * 60 * 60 * 24);
        
        if (ageInDays < 1) stats.ageDistribution.last24h++;
        else if (ageInDays < 7) stats.ageDistribution.last7d++;
        else if (ageInDays < 30) stats.ageDistribution.last30d++;
        else stats.ageDistribution.older++;
      }
    }
    
    // Save statistics
    const statsPath = path.join(backupDir, 'statistics.json');
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
    
    console.log(`\n📊 Production Statistics:`);
    console.log(`Total Memories: ${stats.totalMemories}`);
    console.log(`\nContexts:`);
    for (const [context, count] of Object.entries(stats.contexts)) {
      console.log(`  - ${context}: ${count}`);
    }
    console.log(`\nAge Distribution:`);
    console.log(`  - Last 24h: ${stats.ageDistribution.last24h}`);
    console.log(`  - Last 7d: ${stats.ageDistribution.last7d}`);
    console.log(`  - Last 30d: ${stats.ageDistribution.last30d}`);
    console.log(`  - Older: ${stats.ageDistribution.older}`);
    
    console.log(`\n✅ Backup complete!`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run the backup
backupProduction().catch(console.error);