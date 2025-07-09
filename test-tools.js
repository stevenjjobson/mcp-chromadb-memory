#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// Start the MCP server
const server = spawn('npx', ['tsx', 'src/index.ts'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for server stdout
const rl = readline.createInterface({
  input: server.stdout,
  output: process.stdout
});

// Create readline interface for server stderr
const rlErr = readline.createInterface({
  input: server.stderr,
  output: process.stderr
});

// Track initialization status
let initialized = false;
let toolsListed = false;

// Listen for server output
rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    
    // Check if it's the tools list response
    if (data.jsonrpc && data.result && data.result.tools) {
      console.log('\n✅ Tools list received!');
      console.log(`Total tools: ${data.result.tools.length}`);
      
      // Check for enhanced tools
      const enhancedTools = [
        'search_exact',
        'search_hybrid',
        'get_compressed_context',
        'register_vault',
        'switch_vault',
        'capture_state',
        'restore_state',
        'index_codebase',
        'find_symbol',
        'find_files',
        'explore_folder'
      ];
      
      const foundTools = data.result.tools.map(t => t.name);
      console.log('\nEnhanced tools check:');
      enhancedTools.forEach(toolName => {
        const found = foundTools.includes(toolName);
        console.log(`  ${found ? '✅' : '❌'} ${toolName}`);
      });
      
      console.log('\nAll tools:');
      foundTools.forEach(name => console.log(`  - ${name}`));
      
      toolsListed = true;
      cleanup();
    }
  } catch (e) {
    // Not JSON, ignore
  }
});

// Listen for stderr
rlErr.on('line', (line) => {
  if (line.includes('MCP Server running')) {
    initialized = true;
    console.log('✅ Server initialized, sending tools request...');
    
    // Send tools list request
    const request = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    };
    
    server.stdin.write(JSON.stringify(request) + '\n');
  }
});

// Cleanup function
function cleanup() {
  setTimeout(() => {
    server.kill();
    process.exit(toolsListed ? 0 : 1);
  }, 1000);
}

// Timeout after 30 seconds
setTimeout(() => {
  console.error('❌ Timeout waiting for response');
  cleanup();
}, 30000);

// Handle errors
server.on('error', (err) => {
  console.error('Server error:', err);
  cleanup();
});