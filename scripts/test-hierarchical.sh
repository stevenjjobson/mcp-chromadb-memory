#!/bin/bash
# Test Hierarchical Memory in DEVELOPMENT Environment

set -e

# Colors for clarity
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Hierarchical Memory in DEVELOPMENT Environment${NC}"
echo -e "${YELLOW}⚠️  This will NOT affect PRODUCTION memories${NC}"
echo ""

# Ensure development environment is running
echo -e "${BLUE}Checking DEVELOPMENT environment...${NC}"
if ! docker ps --format "{{.Names}}" | grep -q "chromadb-DEVELOPMENT"; then
    echo -e "${YELLOW}DEVELOPMENT environment not running. Starting it now...${NC}"
    ./scripts/env-manager.sh start-dev
    sleep 5
fi

# Show current environment status
./scripts/env-manager.sh status

echo ""
echo -e "${GREEN}✅ Ready to test with DEVELOPMENT environment${NC}"
echo -e "${BLUE}Running MCP server in DEVELOPMENT mode...${NC}"
echo ""

# Run with development configuration
export ENVIRONMENT_NAME=DEVELOPMENT
npm run dev