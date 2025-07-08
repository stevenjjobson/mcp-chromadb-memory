#!/bin/bash

# Simple test script to verify enhanced memory features via MCP

echo "Testing Enhanced Memory Features via MCP..."
echo ""

# Start the MCP server in background
echo "Starting MCP server..."
npm run build
node dist/index.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "Testing health check..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"health_check","arguments":{}},"id":1}' | node dist/index.js

echo ""
echo "Testing store_memory..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"store_memory","arguments":{"content":"function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }","context":"code_snippet"}},"id":2}' | node dist/index.js

echo ""
echo "Testing search_exact..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_exact","arguments":{"query":"calculateTotal"}},"id":3}' | node dist/index.js

echo ""
echo "Testing search_hybrid..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_hybrid","arguments":{"query":"function"}},"id":4}' | node dist/index.js

echo ""
echo "Testing get_compressed_context..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_compressed_context","arguments":{"query":"calculateTotal","maxTokens":100}},"id":5}' | node dist/index.js

# Kill the server
kill $SERVER_PID

echo ""
echo "Test complete!"