#!/bin/bash
# Environment Manager for MCP ChromaDB Memory Server
# Provides clear separation between PRODUCTION and DEVELOPMENT environments

set -e

# Colors for clarity
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if container is running
is_running() {
    local container_name=$1
    docker ps --format "{{.Names}}" | grep -q "^${container_name}$"
}

case "$1" in
    "start-dev")
        print_status $BLUE "🧪 Starting DEVELOPMENT environment..."
        
        # Check if production is running
        if is_running "chromadb-memory"; then
            print_status $YELLOW "⚠️  PRODUCTION ChromaDB is running on port 8000"
        fi
        
        # Start development environment
        docker-compose -f docker-compose.DEVELOPMENT.yml up -d
        
        # Wait for health check
        print_status $BLUE "⏳ Waiting for ChromaDB DEVELOPMENT to be healthy..."
        sleep 5
        
        # Verify it's running
        if is_running "chromadb-DEVELOPMENT"; then
            print_status $GREEN "✅ DEVELOPMENT ChromaDB running on port 8001"
            print_status $GREEN "📝 Collection: ai_memories_DEVELOPMENT"
            print_status $GREEN "📁 Data: ./data/chroma-DEVELOPMENT/"
        else
            print_status $RED "❌ Failed to start DEVELOPMENT environment"
            exit 1
        fi
        ;;
        
    "stop-dev")
        print_status $YELLOW "🛑 Stopping DEVELOPMENT environment..."
        docker-compose -f docker-compose.DEVELOPMENT.yml down
        print_status $GREEN "✅ DEVELOPMENT environment stopped"
        ;;
        
    "status")
        print_status $BLUE "📊 Environment Status:"
        echo ""
        
        # Production status
        print_status $BLUE "🏭 PRODUCTION (port 8000):"
        if is_running "chromadb-memory"; then
            print_status $GREEN "  ✅ Running"
            echo "  📝 Collection: ai_memories"
            echo "  📁 Data: ./data/chroma/"
        else
            print_status $RED "  ❌ Not running"
        fi
        
        echo ""
        
        # Development status
        print_status $BLUE "🧪 DEVELOPMENT (port 8001):"
        if is_running "chromadb-DEVELOPMENT"; then
            print_status $GREEN "  ✅ Running"
            echo "  📝 Collection: ai_memories_DEVELOPMENT"
            echo "  📁 Data: ./data/chroma-DEVELOPMENT/"
        else
            print_status $RED "  ❌ Not running"
        fi
        
        echo ""
        
        # MCP Server status
        if is_running "claude-mcp-memory"; then
            print_status $YELLOW "🤖 Claude MCP Memory container is active"
        fi
        ;;
        
    "test-dev")
        print_status $BLUE "🧪 Testing DEVELOPMENT connection..."
        
        # Check if dev environment is running
        if ! is_running "chromadb-DEVELOPMENT"; then
            print_status $RED "❌ DEVELOPMENT environment not running!"
            print_status $YELLOW "💡 Run: ./scripts/env-manager.sh start-dev"
            exit 1
        fi
        
        # Set environment and run
        print_status $GREEN "✅ Launching MCP server in DEVELOPMENT mode..."
        export ENVIRONMENT_NAME=DEVELOPMENT
        export $(cat .env.DEVELOPMENT | grep -v '^#' | xargs)
        npm run dev
        ;;
        
    "logs-dev")
        print_status $BLUE "📜 DEVELOPMENT environment logs:"
        docker-compose -f docker-compose.DEVELOPMENT.yml logs -f
        ;;
        
    "clean-dev")
        print_status $YELLOW "🗑️  Cleaning DEVELOPMENT data..."
        read -p "Are you sure you want to delete all DEVELOPMENT data? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Stop container first
            docker-compose -f docker-compose.DEVELOPMENT.yml down
            
            # Remove data
            rm -rf ./data/chroma-DEVELOPMENT/
            print_status $GREEN "✅ DEVELOPMENT data cleaned"
        else
            print_status $YELLOW "❌ Cleanup cancelled"
        fi
        ;;
        
    *)
        echo "Environment Manager for MCP ChromaDB Memory Server"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  start-dev    - Start DEVELOPMENT environment"
        echo "  stop-dev     - Stop DEVELOPMENT environment"
        echo "  status       - Show status of all environments"
        echo "  test-dev     - Run MCP server in DEVELOPMENT mode"
        echo "  logs-dev     - Show DEVELOPMENT environment logs"
        echo "  clean-dev    - Clean DEVELOPMENT data (careful!)"
        echo ""
        echo "Examples:"
        echo "  $0 start-dev   # Start development ChromaDB"
        echo "  $0 status      # Check what's running"
        echo "  $0 test-dev    # Test with development environment"
        ;;
esac