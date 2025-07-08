import { ChromaClient } from 'chromadb';

async function checkDatabaseStatus() {
  const client = new ChromaClient({
    host: 'localhost',
    port: 8001
  });
  
  try {
    // Check connection
    await client.heartbeat();
    console.log('✅ Connected to ChromaDB on port 8001');
    
    // List collections
    const collections = await client.listCollections();
    console.log('\n📚 Collections:', collections.map(c => c.name));
    
    // Check each collection
    for (const collInfo of collections) {
      try {
        const collection = await client.getCollection({ name: collInfo.name });
        const count = await collection.count();
        console.log(`\n📊 Collection: ${collInfo.name}`);
        console.log(`   Records: ${count}`);
        
        // Get a sample of recent records
        if (count > 0) {
          const results = await collection.get({ limit: 5 });
          console.log(`   Sample IDs: ${results.ids.slice(0, 5).join(', ')}`);
        }
      } catch (error) {
        console.log(`   Error reading collection: ${error}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to connect to ChromaDB:', error);
  }
}

checkDatabaseStatus();