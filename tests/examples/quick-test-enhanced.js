import { spawn } from 'child_process';

async function testEnhancedFeatures() {
  console.log('Testing Enhanced Memory Features...\n');
  
  // Start the MCP server
  const server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responseBuffer = '';
  
  server.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    const lines = responseBuffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line) {
        try {
          const response = JSON.parse(line);
          if (response.result) {
            console.log(`Response ${response.id}:`, JSON.stringify(response.result, null, 2));
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    }
    
    responseBuffer = lines[lines.length - 1];
  });
  
  server.stderr.on('data', (data) => {
    console.error('Server:', data.toString());
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test requests
  const requests = [
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'health_check',
        arguments: {}
      },
      id: 1
    },
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'store_memory',
        arguments: {
          content: 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
          context: 'code_snippet'
        }
      },
      id: 2
    },
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_exact',
        arguments: {
          query: 'calculateTotal'
        }
      },
      id: 3
    },
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'analyze_access_patterns',
        arguments: {}
      },
      id: 4
    }
  ];
  
  // Send requests
  for (const request of requests) {
    console.log(`\nSending request ${request.id}: ${request.params.name}`);
    server.stdin.write(JSON.stringify(request) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Clean up
  server.kill();
  console.log('\nTest complete!');
}

testEnhancedFeatures().catch(console.error);