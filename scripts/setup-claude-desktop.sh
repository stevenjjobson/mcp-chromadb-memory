#!/bin/bash
# Setup script for Claude Desktop MCP configuration
# This script helps configure and validate Claude Desktop for the MCP ChromaDB Memory server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration paths
CLAUDE_CONFIG_DIR=""
CLAUDE_CONFIG_FILE=""

# Detect OS and set config path
detect_os() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        # Windows
        CLAUDE_CONFIG_DIR="$APPDATA/Claude"
        CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
        echo -e "${GREEN}Detected Windows environment${NC}"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
        CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
        echo -e "${GREEN}Detected macOS environment${NC}"
    else
        # Linux
        CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
        CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
        echo -e "${GREEN}Detected Linux environment${NC}"
    fi
}

# Check if required files exist
check_requirements() {
    echo -e "\n${YELLOW}Checking requirements...${NC}"
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker is not installed${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Docker is installed${NC}"
    fi
    
    # Check if docker-compose exists
    if [[ ! -f "docker-compose.yml" ]]; then
        echo -e "${RED}✗ docker-compose.yml not found${NC}"
        echo "Please run this script from the project root directory"
        exit 1
    else
        echo -e "${GREEN}✓ docker-compose.yml found${NC}"
    fi
    
    # Check if secrets exist
    if [[ ! -f "secrets/openai_api_key.txt" ]]; then
        echo -e "${YELLOW}⚠ OpenAI API key not found in secrets/openai_api_key.txt${NC}"
        echo "You'll need to add it manually to the configuration"
    else
        echo -e "${GREEN}✓ OpenAI API key found${NC}"
    fi
}

# Check Docker services
check_docker_services() {
    echo -e "\n${YELLOW}Checking Docker services...${NC}"
    
    # Check if chromadb is running
    if docker ps | grep -q "chromadb-memory"; then
        echo -e "${GREEN}✓ ChromaDB is running${NC}"
    else
        echo -e "${RED}✗ ChromaDB is not running${NC}"
        echo "Run: docker-compose up -d chromadb"
    fi
    
    # Check if postgres is running
    if docker ps | grep -q "postgres-memory"; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo -e "${RED}✗ PostgreSQL is not running${NC}"
        echo "Run: docker-compose up -d postgres"
    fi
    
    # Check network
    if docker network ls | grep -q "mcp-chromadb-memory_memory-network"; then
        echo -e "${GREEN}✓ Docker network exists${NC}"
    else
        echo -e "${RED}✗ Docker network not found${NC}"
        echo "The network will be created when you start the services"
    fi
}

# Validate existing configuration
validate_config() {
    echo -e "\n${YELLOW}Validating configuration...${NC}"
    
    if [[ ! -f "$CLAUDE_CONFIG_FILE" ]]; then
        echo -e "${YELLOW}⚠ Configuration file not found at: $CLAUDE_CONFIG_FILE${NC}"
        echo "Creating directory and sample configuration..."
        mkdir -p "$CLAUDE_CONFIG_DIR"
        create_sample_config
        return
    fi
    
    # Check if JSON is valid
    if python -m json.tool < "$CLAUDE_CONFIG_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ JSON syntax is valid${NC}"
    else
        echo -e "${RED}✗ JSON syntax error in configuration${NC}"
        echo "Please fix the syntax errors before proceeding"
        exit 1
    fi
    
    # Check for common issues
    if grep -q "YOUR_OPENAI_API_KEY_HERE" "$CLAUDE_CONFIG_FILE"; then
        echo -e "${YELLOW}⚠ API key placeholder found - remember to add your actual API key${NC}"
    fi
    
    if grep -q "chromadb\"" "$CLAUDE_CONFIG_FILE"; then
        echo -e "${YELLOW}⚠ Found 'chromadb' - should be 'chromadb-memory'${NC}"
    fi
    
    if grep -q "postgres\"" "$CLAUDE_CONFIG_FILE"; then
        echo -e "${YELLOW}⚠ Found 'postgres' - should be 'postgres-memory'${NC}"
    fi
}

# Create sample configuration
create_sample_config() {
    # Get current directory for vault path
    CURRENT_DIR=$(pwd)
    
    # Try to read API key from secrets
    API_KEY="YOUR_OPENAI_API_KEY_HERE"
    if [[ -f "secrets/openai_api_key.txt" ]]; then
        API_KEY=$(cat secrets/openai_api_key.txt)
        echo -e "${GREEN}✓ Using API key from secrets${NC}"
    fi
    
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--name", "claude-mcp-memory",
        "--network", "mcp-chromadb-memory_memory-network",
        "-v", "${CURRENT_DIR}/vault:/project-vault:rw",
        "-e", "OPENAI_API_KEY=${API_KEY}",
        "-e", "DOCKER_CONTAINER=true",
        "-e", "CHROMA_HOST=chromadb-memory",
        "-e", "CHROMA_PORT=8000",
        "-e", "POSTGRES_HOST=postgres-memory",
        "-e", "POSTGRES_PORT=5432",
        "-e", "POSTGRES_USER=mcp_user",
        "-e", "POSTGRES_PASSWORD=mcp_memory_pass",
        "-e", "POSTGRES_DB=mcp_memory",
        "-e", "USE_HYBRID_STORAGE=true",
        "-e", "ENABLE_DUAL_WRITE=true",
        "-e", "POSTGRES_READ_RATIO=0.5",
        "-e", "VAULT_MODE=single",
        "-e", "PROJECT_VAULT_PATH=/project-vault",
        "-e", "OBSIDIAN_VAULT_PATH=/project-vault",
        "-e", "AUTO_START_SESSION_LOGGING=true",
        "-e", "SESSION_LOGGING_PROJECT_NAME=MCP ChromaDB Memory",
        "-e", "SESSION_LOGGING_SAVE_ON_EXIT=true",
        "-e", "CODE_INDEXING_ENABLED=true",
        "-e", "CODE_PATTERN_DETECTION=true",
        "-e", "CODE_STREAMING_ENABLED=true",
        "-e", "MEMORY_TIER_ENABLED=true",
        "-e", "ENABLE_MIGRATION_SERVICE=true",
        "-e", "ENABLE_PATTERN_SERVICE=true",
        "mcp-chromadb-memory"
      ]
    }
  }
}
EOF
    
    echo -e "${GREEN}✓ Created configuration at: $CLAUDE_CONFIG_FILE${NC}"
}

# Display final instructions
show_instructions() {
    echo -e "\n${GREEN}Setup Complete!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Start Docker services if not running:"
    echo "   docker-compose up -d chromadb postgres"
    echo ""
    echo "2. Build the Docker image if needed:"
    echo "   docker build -t mcp-chromadb-memory ."
    echo ""
    echo "3. Restart Claude Desktop to apply configuration"
    echo ""
    echo "4. The MCP server should appear in Claude Desktop"
    echo ""
    echo -e "${YELLOW}Configuration location:${NC}"
    echo "$CLAUDE_CONFIG_FILE"
    echo ""
    echo -e "${YELLOW}To enable dual vault mode:${NC}"
    echo "1. Edit the configuration file"
    echo "2. Change VAULT_MODE from 'single' to 'dual'"
    echo "3. Add CORE_VAULT_PATH with your personal vault path"
    echo "4. Add a volume mount for the core vault"
}

# Main execution
main() {
    echo -e "${GREEN}Claude Desktop MCP Setup Script${NC}"
    echo "================================="
    
    detect_os
    check_requirements
    check_docker_services
    validate_config
    show_instructions
}

# Run main function
main