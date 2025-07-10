#!/bin/bash
# Setup script for Claude Code MCP configuration
# This script helps configure the MCP ChromaDB Memory server for Claude Code CLI

set -e

echo "🚀 Claude Code MCP Setup Script"
echo "==============================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check for Claude Code CLI
    if ! command -v claude &> /dev/null; then
        echo -e "${RED}❌ Claude Code CLI not found${NC}"
        echo "Please install Claude Code first: https://docs.anthropic.com/en/docs/claude-code"
        exit 1
    fi
    
    # Check for Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found${NC}"
        echo "Docker is required for the default setup. Install from: https://docker.com"
        exit 1
    fi
    
    # Check for docker-compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ docker-compose not found${NC}"
        echo "docker-compose is required. It usually comes with Docker Desktop."
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites satisfied!${NC}"
    echo ""
}

# Check if services are running
check_services() {
    echo "🔍 Checking required services..."
    
    # Get the directory of this script
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    
    cd "$PROJECT_ROOT"
    
    # Check if ChromaDB is running
    if docker-compose ps | grep -q "chromadb.*Up"; then
        echo -e "${GREEN}✅ ChromaDB is running${NC}"
    else
        echo -e "${YELLOW}⚠️  ChromaDB is not running${NC}"
        read -p "Would you like to start ChromaDB? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose up -d chromadb
            echo "Waiting for ChromaDB to start..."
            sleep 5
        fi
    fi
    
    # Check if PostgreSQL is running
    if docker-compose ps | grep -q "postgres.*Up"; then
        echo -e "${GREEN}✅ PostgreSQL is running${NC}"
    else
        echo -e "${YELLOW}⚠️  PostgreSQL is not running${NC}"
        read -p "Would you like to start PostgreSQL? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose up -d postgres
            echo "Waiting for PostgreSQL to start..."
            sleep 5
        fi
    fi
    
    echo ""
}

# Check for OpenAI API key
check_api_key() {
    if [ -z "$OPENAI_API_KEY" ]; then
        echo -e "${YELLOW}⚠️  OPENAI_API_KEY environment variable not set${NC}"
        echo "You'll need to set this for the MCP server to work properly."
        echo ""
        echo "To set it temporarily for this session:"
        echo "  export OPENAI_API_KEY='your-api-key-here'"
        echo ""
        echo "To set it permanently, add it to your ~/.bashrc or ~/.zshrc"
        echo ""
        read -p "Continue without API key? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ OpenAI API key found${NC}"
    fi
    echo ""
}

# Setup MCP server
setup_mcp() {
    echo "🔧 Setting up MCP server..."
    echo ""
    echo "Choose setup type:"
    echo "1) Docker setup (recommended)"
    echo "2) Local Node.js setup"
    echo "3) Use project .mcp.json file"
    echo ""
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            echo ""
            echo "Setting up Docker-based MCP server..."
            
            # Build Docker image if needed
            if ! docker images | grep -q "mcp-chromadb-memory-mcp-memory"; then
                echo "Building Docker image..."
                npm run docker:build
            fi
            
            # Add MCP server
            claude mcp add memory docker run -i --rm \
                --network mcp-chromadb-memory_memory-network \
                -v "$(pwd)/Project_Context/vault:/vault:rw" \
                -e OPENAI_API_KEY="${OPENAI_API_KEY:-YOUR_KEY_HERE}" \
                -e DOCKER_CONTAINER=true \
                -e CHROMA_HOST=chromadb \
                -e CHROMA_PORT=8000 \
                -e POSTGRES_HOST=postgres \
                -e POSTGRES_PORT=5432 \
                -e POSTGRES_USER=postgres \
                -e POSTGRES_PASSWORD=memory123 \
                -e POSTGRES_DB=memory_platform \
                -e USE_HYBRID_STORAGE=true \
                -e OBSIDIAN_VAULT_PATH=/vault \
                -e AUTO_START_SESSION_LOGGING=true \
                mcp-chromadb-memory-mcp-memory
            
            echo -e "${GREEN}✅ Docker MCP server configured!${NC}"
            ;;
            
        2)
            echo ""
            echo "Setting up local Node.js MCP server..."
            
            # Check if built
            if [ ! -d "dist" ]; then
                echo "Building project..."
                npm install
                npm run build
            fi
            
            # Add MCP server
            claude mcp add memory-local node "$(pwd)/dist/index.js" \
                -e OPENAI_API_KEY="${OPENAI_API_KEY:-YOUR_KEY_HERE}" \
                -e CHROMA_HOST=localhost \
                -e CHROMA_PORT=8000 \
                -e POSTGRES_HOST=localhost \
                -e POSTGRES_PORT=5432 \
                -e POSTGRES_USER=postgres \
                -e POSTGRES_PASSWORD=memory123 \
                -e POSTGRES_DB=memory_platform \
                -e USE_HYBRID_STORAGE=true \
                -e OBSIDIAN_VAULT_PATH="$(pwd)/Project_Context/vault"
            
            echo -e "${GREEN}✅ Local MCP server configured!${NC}"
            ;;
            
        3)
            echo ""
            echo "The project includes a .mcp.json file with both Docker and local configurations."
            echo ""
            echo "Claude Code will automatically detect and use this file when you run claude"
            echo "from the project directory. You'll be prompted to approve it on first use."
            echo ""
            echo -e "${GREEN}✅ Ready to use project .mcp.json!${NC}"
            ;;
            
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    echo ""
}

# Show next steps
show_next_steps() {
    echo "📝 Next Steps:"
    echo "=============="
    echo ""
    echo "1. If you haven't set your OpenAI API key:"
    echo "   export OPENAI_API_KEY='your-api-key-here'"
    echo ""
    echo "2. List configured MCP servers:"
    echo "   claude mcp list"
    echo ""
    echo "3. Start a conversation with MCP tools:"
    echo "   claude"
    echo ""
    echo "4. Test the memory tools:"
    echo "   - 'Check the health of the memory server'"
    echo "   - 'Store a memory about this being my first test'"
    echo "   - 'What memories do you have?'"
    echo ""
    echo "For more information, see CLAUDE_CODE_VS_DESKTOP_CONFIG.md"
}

# Main execution
main() {
    check_prerequisites
    check_services
    check_api_key
    setup_mcp
    show_next_steps
}

main "$@"