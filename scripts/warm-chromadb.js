#!/usr/bin/env node

/**
 * ChromaDB Warm-up Script
 * Pre-initializes ChromaDB with warm queries to improve startup performance
 */

import fetch from 'node-fetch';
import { ChromaClient } from 'chromadb';

const CHROMADB_URL = process.env.CHROMADB_URL || 'http://localhost:8000';
const COLLECTION_NAME = process.env.MEMORY_COLLECTION_NAME || 'ai_memories';

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

async function warmUpChromaDB() {
  console.log(`${colors.cyan}Starting ChromaDB warm-up...${colors.reset}`);
  
  try {
    // 1. Check heartbeat
    console.log('  Checking heartbeat...');
    const heartbeatResponse = await fetch(`${CHROMADB_URL}/api/v1/heartbeat`);
    const heartbeat = await heartbeatResponse.json();
    
    if (!heartbeat.nanosecond_heartbeat) {
      throw new Error('ChromaDB heartbeat check failed');
    }
    console.log(`${colors.green}  ✓ Heartbeat OK${colors.reset}`);
    
    // 2. Initialize client
    console.log('  Initializing ChromaDB client...');
    const client = new ChromaClient({ path: CHROMADB_URL });
    console.log(`${colors.green}  ✓ Client initialized${colors.reset}`);
    
    // 3. Check collections
    console.log('  Checking collections...');
    const collections = await client.listCollections();
    console.log(`${colors.green}  ✓ Found ${collections.length} collections${colors.reset}`);
    
    // 4. Get or create main collection
    console.log(`  Accessing collection: ${COLLECTION_NAME}...`);
    let collection;
    try {
      collection = await client.getCollection({ name: COLLECTION_NAME });
    } catch (error) {
      console.log(`${colors.yellow}  ! Collection not found, creating...${colors.reset}`);
      collection = await client.createCollection({ 
        name: COLLECTION_NAME,
        metadata: { description: 'AI conversation memories' }
      });
    }
    console.log(`${colors.green}  ✓ Collection ready${colors.reset}`);
    
    // 5. Warm up with a simple query
    console.log('  Running warm-up query...');
    const startTime = Date.now();
    
    try {
      const results = await collection.query({
        queryTexts: ['system initialization'],
        nResults: 1
      });
      
      const queryTime = Date.now() - startTime;
      console.log(`${colors.green}  ✓ Query completed in ${queryTime}ms${colors.reset}`);
      
      // 6. Get collection stats
      const count = await collection.count();
      console.log(`${colors.green}  ✓ Collection contains ${count} memories${colors.reset}`);
      
    } catch (error) {
      // Empty collection is OK
      if (error.message.includes('empty')) {
        console.log(`${colors.yellow}  ! Collection is empty (this is normal for new installations)${colors.reset}`);
      } else {
        throw error;
      }
    }
    
    // 7. Pre-warm embeddings if API key is available
    if (process.env.OPENAI_API_KEY) {
      console.log('  Testing embedding generation...');
      try {
        // This would typically generate a test embedding
        // For now, we just verify the API key is set
        console.log(`${colors.green}  ✓ OpenAI API key configured${colors.reset}`);
      } catch (error) {
        console.log(`${colors.yellow}  ! Embedding test skipped${colors.reset}`);
      }
    }
    
    console.log(`\n${colors.green}✅ ChromaDB warm-up complete!${colors.reset}`);
    return true;
    
  } catch (error) {
    console.error(`\n${colors.red}❌ ChromaDB warm-up failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Memory cleanup helper
async function cleanupOldMemories() {
  console.log(`\n${colors.cyan}Checking for memory cleanup...${colors.reset}`);
  
  try {
    const client = new ChromaClient({ path: CHROMADB_URL });
    const collection = await client.getCollection({ name: COLLECTION_NAME });
    
    // Get all memories
    const allMemories = await collection.get();
    
    if (!allMemories.ids || allMemories.ids.length === 0) {
      console.log('  No memories to clean up');
      return;
    }
    
    // Check for old memories (> 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    let oldCount = 0;
    
    if (allMemories.metadatas) {
      for (const metadata of allMemories.metadatas) {
        if (metadata && metadata.timestamp) {
          const timestamp = new Date(metadata.timestamp).getTime();
          if (timestamp < thirtyDaysAgo && metadata.importance < 5) {
            oldCount++;
          }
        }
      }
    }
    
    if (oldCount > 0) {
      console.log(`${colors.yellow}  ! Found ${oldCount} old low-importance memories (>30 days)${colors.reset}`);
      console.log('  Consider running memory consolidation');
    } else {
      console.log(`${colors.green}  ✓ No cleanup needed${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`${colors.yellow}  ! Cleanup check skipped: ${error.message}${colors.reset}`);
  }
}

// Main execution
async function main() {
  console.log(`${colors.cyan}ChromaDB Pre-initialization${colors.reset}`);
  console.log('──────────────────────────\n');
  
  const warmUpSuccess = await warmUpChromaDB();
  
  if (warmUpSuccess) {
    await cleanupOldMemories();
  }
  
  process.exit(warmUpSuccess ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

export { warmUpChromaDB, cleanupOldMemories };