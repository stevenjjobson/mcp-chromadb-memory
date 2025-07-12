#!/bin/bash
# Start CoachNTT Cognitive Platform - Works from both WSL and Git Bash

echo "🚀 Starting CoachNTT Cognitive Platform..."
echo ""

# Check if we're in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "Please start Docker Desktop first."
    exit 1
fi

# Start the services
echo "🔄 Starting PostgreSQL and ChromaDB services..."
docker-compose up -d coachntt-chromadb coachntt-postgres

# Wait a moment for services to start
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check service health
echo ""
echo "📊 Service Status:"
docker-compose ps

# Check if services are healthy
if docker-compose ps | grep -q "healthy"; then
    echo ""
    echo "✅ Services are healthy!"
else
    echo ""
    echo "⚠️  Services may still be starting. Check logs if issues persist:"
    echo "   docker logs coachntt-postgres"
    echo "   docker logs coachntt-chromadb"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. For Claude Code: Run 'claude' in this directory"
echo "2. For Claude Desktop: Restart Claude Desktop"
echo ""
echo "📚 Quick Reference:"
echo "   - Session logs: vault/Sessions/"
echo "   - Memory commands: 'Remember that...' / 'What do you remember about...'"
echo "   - Code search: 'Find function X' / 'Index the codebase'"
echo ""
echo "✨ Platform ready! Check out docs/guides/QUICK_REFERENCE_CARD.md for more."