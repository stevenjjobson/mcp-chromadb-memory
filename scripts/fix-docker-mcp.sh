#!/bin/bash
# Script to fix Docker MCP server issues for Claude Desktop

echo "🔧 Docker MCP Server Fix Script"
echo "==============================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker is running
check_docker() {
    echo "1️⃣ Checking Docker..."
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running!${NC}"
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Stop any existing claude-mcp-memory container
cleanup_old_container() {
    echo ""
    echo "2️⃣ Cleaning up old containers..."
    if docker ps -a | grep -q "claude-mcp-memory"; then
        echo "Found existing container, removing..."
        docker stop claude-mcp-memory 2>/dev/null || true
        docker rm claude-mcp-memory 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Check and fix ChromaDB health
fix_chromadb() {
    echo ""
    echo "3️⃣ Checking ChromaDB health..."
    
    # Check if ChromaDB is running
    if ! docker ps | grep -q "chromadb-memory"; then
        echo -e "${YELLOW}⚠️  ChromaDB not running, starting it...${NC}"
        docker-compose up -d chromadb
        sleep 5
    fi
    
    # Check ChromaDB health
    if curl -s http://localhost:8000/api/v1 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ChromaDB is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  ChromaDB is unhealthy, restarting...${NC}"
        docker-compose restart chromadb
        echo "Waiting for ChromaDB to be ready..."
        sleep 10
        
        # Check again
        if curl -s http://localhost:8000/api/v1 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ChromaDB is now healthy${NC}"
        else
            echo -e "${RED}❌ ChromaDB still unhealthy. Check logs with: docker logs chromadb-memory${NC}"
        fi
    fi
}

# Check PostgreSQL
check_postgres() {
    echo ""
    echo "4️⃣ Checking PostgreSQL..."
    
    if ! docker ps | grep -q "postgres-memory"; then
        echo -e "${YELLOW}⚠️  PostgreSQL not running, starting it...${NC}"
        docker-compose up -d postgres
        sleep 5
    fi
    
    # Test PostgreSQL connection
    if docker exec postgres-memory pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is healthy${NC}"
    else
        echo -e "${RED}❌ PostgreSQL is not ready${NC}"
    fi
}

# Check Docker network
check_network() {
    echo ""
    echo "5️⃣ Checking Docker network..."
    
    if docker network ls | grep -q "mcp-chromadb-memory_memory-network"; then
        echo -e "${GREEN}✅ Docker network exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Creating Docker network...${NC}"
        docker network create mcp-chromadb-memory_memory-network
    fi
}

# Test MCP server
test_mcp_server() {
    echo ""
    echo "6️⃣ Testing MCP server..."
    
    # Try to run the MCP server
    echo "Running test container..."
    
    docker run --rm \
        --network mcp-chromadb-memory_memory-network \
        -e DOCKER_CONTAINER=true \
        -e CHROMA_HOST=chromadb-memory \
        -e CHROMA_PORT=8000 \
        -e POSTGRES_HOST=postgres-memory \
        -e POSTGRES_PORT=5432 \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=memory123 \
        -e POSTGRES_DB=memory_platform \
        -e OPENAI_API_KEY=${OPENAI_API_KEY:-"test-key"} \
        mcp-chromadb-memory \
        node dist/index.js --version > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ MCP server image is working${NC}"
    else
        echo -e "${RED}❌ MCP server test failed${NC}"
        echo "You may need to rebuild the image:"
        echo "  npm run docker:build"
    fi
}

# Fix configuration issues
fix_config() {
    echo ""
    echo "7️⃣ Configuration recommendations..."
    
    echo "Key issues to check in your claude_desktop_config.json:"
    echo ""
    echo "1. Container names must match docker-compose services:"
    echo "   - Use 'chromadb-memory' not 'chromadb'"
    echo "   - Use 'postgres-memory' not 'postgres'"
    echo ""
    echo "2. Vault path inside container should be /vault:"
    echo "   - OBSIDIAN_VAULT_PATH=/vault"
    echo ""
    echo "3. Make sure your OpenAI API key is valid"
    echo ""
    echo "4. Network name must be exact: mcp-chromadb-memory_memory-network"
}

# Main execution
main() {
    check_docker
    cleanup_old_container
    check_network
    fix_chromadb
    check_postgres
    test_mcp_server
    fix_config
    
    echo ""
    echo "🎯 Summary"
    echo "=========="
    echo ""
    echo "To use the fixed configuration:"
    echo "1. Copy the fixed config:"
    echo "   cp claude_desktop_config_fixed.json %APPDATA%\\Claude\\claude_desktop_config.json"
    echo ""
    echo "2. Update your OpenAI API key in the config"
    echo ""
    echo "3. Restart Claude Desktop"
    echo ""
    echo "If issues persist, check logs with:"
    echo "  docker logs chromadb-memory"
    echo "  docker logs postgres-memory"
}

# Change to project directory
cd "$(dirname "$0")/.." || exit 1

main