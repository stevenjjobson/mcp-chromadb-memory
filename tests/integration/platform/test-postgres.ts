#!/usr/bin/env tsx

/**
 * Test PostgreSQL connection and verify pgvector is installed
 */

import { PostgresClient } from '../src/db/postgres-client.js';

async function testPostgresConnection() {
  console.log('Testing PostgreSQL connection...\n');
  
  const client = new PostgresClient({
    host: 'localhost',
    port: 5432,
    database: 'mcp_memory',
    user: 'mcp_user',
    password: 'mcp_memory_pass'
  });
  
  try {
    // Initialize connection
    await client.initialize();
    console.log('✅ PostgreSQL connection successful');
    
    // Check health
    const health = await client.healthCheck();
    console.log('✅ Health check:', health);
    
    // Test vector operations
    const vectorTest = await client.query(`
      SELECT '[1,2,3]'::vector + '[4,5,6]'::vector as vector_sum
    `);
    console.log('✅ Vector operations working:', vectorTest.rows[0]);
    
    // Check tables
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.log('\nTables created:');
    tables.rows.forEach(row => console.log(`  - ${row.tablename}`));
    
    // Check pool stats
    console.log('\nConnection pool stats:', client.getPoolStats());
    
    // Close connection
    await client.close();
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPostgresConnection();