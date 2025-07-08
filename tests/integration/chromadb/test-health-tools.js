#!/usr/bin/env node

/**
 * Test script for MCP ChromaDB Memory Platform health tools
 * 
 * This script tests the actual MCP tools through the server
 * 
 * Usage:
 *   1. Start ChromaDB: docker-compose up -d chromadb
 *   2. Build the project: npm run build
 *   3. Run this test: node test-health-tools.js
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = '') {
  console.error(`${color}${message}${colors.reset}`);
}

// Function to interact with MCP server
async function testMCPServer() {
  return new Promise((resolve, reject) => {
    log('\n🚀 Starting MCP Server...', colors.cyan);
    
    // Spawn the MCP server
    const mcpProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    
    let buffer = '';
    let initialized = false;
    
    // Handle server output
    mcpProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Look for startup complete message
      if (output.includes('MCP Server running on stdio transport')) {
        initialized = true;
        log('✅ Server started successfully!', colors.green);
        
        // Start sending test commands
        setTimeout(() => {
          runTests(mcpProcess);
        }, 1000);
      }
      
      // Display startup summary if present
      if (output.includes('MCP ChromaDB Memory Platform Started')) {
        log('\n📋 Startup Summary:', colors.yellow);
        console.error(output);
      }
    });
    
    mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // Try to parse JSON-RPC responses
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            handleResponse(response);
          } catch (e) {
            // Not JSON, ignore
          }
        }
      });
    });
    
    mcpProcess.on('error', (error) => {
      log(`❌ Failed to start server: ${error.message}`, colors.red);
      reject(error);
    });
    
    mcpProcess.on('close', (code) => {
      log(`\nServer exited with code ${code}`, code === 0 ? colors.green : colors.red);
      resolve(code);
    });
    
    // Clean shutdown on Ctrl+C
    process.on('SIGINT', () => {
      log('\n\n👋 Shutting down...', colors.yellow);
      mcpProcess.kill();
      process.exit(0);
    });
  });
}

// Handle JSON-RPC responses
function handleResponse(response) {
  if (response.result) {
    log('\n📦 Tool Response:', colors.green);
    
    // Parse the content if it's a tool response
    if (response.result.content && response.result.content[0]) {
      try {
        const content = JSON.parse(response.result.content[0].text);
        console.log(JSON.stringify(content, null, 2));
      } catch (e) {
        console.log(response.result.content[0].text);
      }
    } else {
      console.log(JSON.stringify(response.result, null, 2));
    }
  } else if (response.error) {
    log(`\n❌ Error: ${response.error.message}`, colors.red);
  }
}

// Run test commands
async function runTests(mcpProcess) {
  const tests = [
    {
      name: 'Get Startup Summary',
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_startup_summary',
          arguments: {}
        }
      }
    },
    {
      name: 'Get Vault Index',
      request: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_vault_index',
          arguments: { format: 'json' }
        }
      }
    },
    {
      name: 'Check Memory Health',
      request: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'check_memory_health',
          arguments: { includeRecommendations: true }
        }
      }
    }
  ];
  
  for (const test of tests) {
    log(`\n🔧 Testing: ${test.name}`, colors.cyan);
    mcpProcess.stdin.write(JSON.stringify(test.request) + '\n');
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Give time for last response
  setTimeout(() => {
    log('\n\n✅ All tests completed!', colors.green);
    mcpProcess.kill();
  }, 3000);
}

// Create a simple demo that doesn't require the actual server
async function runDemoMode() {
  log('\n╔══════════════════════════════════════════════════════════════╗', colors.bright);
  log('║     MCP ChromaDB Memory Platform - Health Check Demo         ║', colors.bright);
  log('╚══════════════════════════════════════════════════════════════╝', colors.bright);
  
  log('\n📊 Platform Health Overview:', colors.cyan);
  log('\nThe platform provides these health monitoring capabilities:', colors.yellow);
  
  log('\n1. Startup Health Check', colors.green);
  log('   - Automatic system check when Claude Code connects');
  log('   - Shows component status (ChromaDB, Vault, Session Logger)');
  log('   - Displays memory statistics and active tasks');
  log('   - Provides optimization recommendations');
  
  log('\n2. Vault Index (VAULT_INDEX.md)', colors.green);
  log('   - Real-time dashboard updated every 5 minutes');
  log('   - System health indicators');
  log('   - Memory system statistics');
  log('   - Documentation coverage metrics');
  log('   - Quick navigation links');
  
  log('\n3. Memory Health Monitoring', colors.green);
  log('   - Fragmentation analysis');
  log('   - Duplicate detection');
  log('   - Orphaned memory identification');
  log('   - Performance metrics (query times, indexing speed)');
  
  log('\n4. Available MCP Tools:', colors.green);
  log('   - get_startup_summary: Current system state');
  log('   - get_vault_index: Comprehensive vault statistics');
  log('   - check_memory_health: Memory system diagnostics');
  log('   - regenerate_index: Force index update');
  
  log('\n5. File Watcher', colors.green);
  log('   - Monitors vault for real-time changes');
  log('   - Automatically updates index when files change');
  log('   - Batches updates for efficiency');
  
  log('\n💡 Example Output:', colors.cyan);
  log('\nStartup Summary would show:', colors.yellow);
  console.log(`
🚀 **MCP ChromaDB Memory Platform Started**

📊 **System Health**: ✅ healthy
- ChromaDB: Connected (8ms latency)
- Obsidian Vault: Connected
- Session Logger: Active (MCP ChromaDB Memory)

🧠 **Memory Status**
- Total Memories: 1247
- Recent (24h): 47
- Working Memory Load: 32%

✅ **Active Tasks**
🔄 Implement hierarchical memory system
✅ Create vault index system
⏸️ Develop pattern recognition

Ready to continue your work!
`);
  
  log('\n🔗 To test with real server:', colors.cyan);
  log('   1. Ensure ChromaDB is running: docker-compose up -d chromadb');
  log('   2. Set OPENAI_API_KEY environment variable');
  log('   3. Build the project: npm run build');
  log('   4. Run: node test-health-tools.js --server');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--server')) {
    // Test with actual MCP server
    try {
      await testMCPServer();
    } catch (error) {
      log(`\n❌ Error: ${error.message}`, colors.red);
      log('\nMake sure:', colors.yellow);
      log('  1. ChromaDB is running (docker-compose up -d chromadb)');
      log('  2. OPENAI_API_KEY is set');
      log('  3. Project is built (npm run build)');
    }
  } else {
    // Run demo mode
    await runDemoMode();
    log('\n\n💡 Run with --server flag to test with actual MCP server', colors.yellow);
  }
}

// Run the test
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, colors.red);
  process.exit(1);
});