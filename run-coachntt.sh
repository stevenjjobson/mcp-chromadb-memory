#!/bin/bash

# Run CoachNTT with tsx (bypasses TypeScript errors)
echo "🚀 Starting CoachNTT MCP Server..."

# Ensure databases are running
echo "Checking database services..."
docker-compose up -d chromadb postgres

# Wait for services
sleep 5

# Run with tsx
echo "Starting CoachNTT..."
npx tsx src/index-coachntt.ts