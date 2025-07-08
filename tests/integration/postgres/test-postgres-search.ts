import { getPostgresClient } from './dist/db/postgres-client.js';

async function testSearch() {
  const client = await getPostgresClient();
  
  try {
    // Search for HybridMemoryManager
    const result = await client.query(
      `SELECT name, type, file_path, line_number 
       FROM code_symbols 
       WHERE name ILIKE $1 
       LIMIT 10`,
      ['%HybridMemoryManager%']
    );
    
    console.log('Search results for HybridMemoryManager:');
    console.log(result.rows);
    
    // Get total count
    const countResult = await client.query('SELECT COUNT(*) FROM code_symbols');
    console.log('\nTotal symbols in database:', countResult.rows[0].count);
    
  } finally {
    await client.close();
  }
}

testSearch().catch(console.error);