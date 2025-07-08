// Simple test to ensure the server can start
const { spawn } = require('child_process');
const path = require('path');

console.log('Testing MCP Memory Server...');

// Set test environment variables
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.CHROMA_HOST = 'localhost';
process.env.CHROMA_PORT = '8000';

const serverPath = path.join(__dirname, 'dist', 'index.js');
const server = spawn('node', [serverPath], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Capture stderr (where our logs go)
server.stderr.on('data', (data) => {
  console.log('[Server]', data.toString().trim());
});

// Handle errors
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Give it 3 seconds to start, then send a test request
setTimeout(() => {
  console.log('Sending health check request...');
  
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'health_check',
      arguments: {}
    },
    id: 1
  };
  
  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Give it time to respond
  setTimeout(() => {
    console.log('Test complete. Shutting down...');
    server.kill();
    process.exit(0);
  }, 2000);
}, 3000);