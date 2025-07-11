#!/bin/bash
# Configuration validation script for MCP ChromaDB Memory server
# Checks all configuration files for consistency and common issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track errors and warnings
ERRORS=0
WARNINGS=0

# Helper functions
error() {
    echo -e "${RED}✗ ERROR: $1${NC}"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠ WARNING: $1${NC}"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check environment files
check_env_files() {
    echo -e "\n${BLUE}Checking environment files...${NC}"
    
    # Check .env.PRODUCTION
    if [[ -f ".env.PRODUCTION" ]]; then
        success ".env.PRODUCTION exists"
        
        # Check for required variables
        if grep -q "^OBSIDIAN_VAULT_PATH=" .env.PRODUCTION; then
            VAULT_PATH=$(grep "^OBSIDIAN_VAULT_PATH=" .env.PRODUCTION | cut -d'=' -f2)
            info "Vault path: $VAULT_PATH"
            
            # Check if vault exists
            if [[ -d "${VAULT_PATH#./}" ]]; then
                success "Vault directory exists"
            else
                error "Vault directory not found: ${VAULT_PATH#./}"
            fi
        else
            error "OBSIDIAN_VAULT_PATH not found in .env.PRODUCTION"
        fi
        
        # Check vault mode
        if grep -q "^VAULT_MODE=" .env.PRODUCTION; then
            VAULT_MODE=$(grep "^VAULT_MODE=" .env.PRODUCTION | cut -d'=' -f2)
            info "Vault mode: $VAULT_MODE"
            
            if [[ "$VAULT_MODE" == "dual" ]]; then
                # Check dual vault configuration
                if ! grep -q "^CORE_VAULT_PATH=" .env.PRODUCTION; then
                    error "CORE_VAULT_PATH missing for dual vault mode"
                fi
                if ! grep -q "^PROJECT_VAULT_PATH=" .env.PRODUCTION; then
                    error "PROJECT_VAULT_PATH missing for dual vault mode"
                fi
            fi
        fi
    else
        error ".env.PRODUCTION not found"
    fi
    
    # Check .env
    if [[ -f ".env" ]]; then
        success ".env exists"
    else
        warning ".env not found (using .env.PRODUCTION)"
    fi
}

# Check Docker configuration
check_docker_config() {
    echo -e "\n${BLUE}Checking Docker configuration...${NC}"
    
    if [[ -f "docker-compose.yml" ]]; then
        success "docker-compose.yml exists"
        
        # Extract service names
        if grep -q "postgres:" docker-compose.yml; then
            POSTGRES_CONTAINER=$(grep -A2 "container_name:" docker-compose.yml | grep -A1 "postgres:" | grep "container_name:" | awk '{print $2}')
            info "PostgreSQL container: $POSTGRES_CONTAINER"
        else
            error "PostgreSQL service not found in docker-compose.yml"
        fi
        
        if grep -q "chromadb:" docker-compose.yml; then
            CHROMA_CONTAINER=$(grep -A2 "container_name:" docker-compose.yml | grep -A1 "chromadb:" | grep "container_name:" | awk '{print $2}')
            info "ChromaDB container: $CHROMA_CONTAINER"
        else
            error "ChromaDB service not found in docker-compose.yml"
        fi
        
        # Check network
        if grep -q "memory-network:" docker-compose.yml; then
            success "Docker network defined"
        else
            error "memory-network not found in docker-compose.yml"
        fi
    else
        error "docker-compose.yml not found"
    fi
}

# Check MCP configurations
check_mcp_configs() {
    echo -e "\n${BLUE}Checking MCP configurations...${NC}"
    
    # Check .mcp.json
    if [[ -f ".mcp.json" ]]; then
        success ".mcp.json exists"
        
        # Validate JSON
        if python -m json.tool < .mcp.json > /dev/null 2>&1; then
            success ".mcp.json has valid JSON syntax"
            
            # Check for environment variable references
            if grep -q '\${OPENAI_API_KEY}' .mcp.json; then
                info "Uses environment variable for API key (good)"
            else
                warning "API key might be hardcoded"
            fi
            
            # Check container references
            if [[ -n "$POSTGRES_CONTAINER" ]] && ! grep -q "$POSTGRES_CONTAINER" .mcp.json; then
                warning "PostgreSQL container name mismatch in .mcp.json"
            fi
            if [[ -n "$CHROMA_CONTAINER" ]] && ! grep -q "$CHROMA_CONTAINER" .mcp.json; then
                warning "ChromaDB container name mismatch in .mcp.json"
            fi
        else
            error ".mcp.json has invalid JSON syntax"
        fi
    else
        error ".mcp.json not found"
    fi
    
    # Check claude_desktop_config_current.json
    if [[ -f "claude_desktop_config_current.json" ]]; then
        success "claude_desktop_config_current.json exists"
        
        # Validate JSON
        if python -m json.tool < claude_desktop_config_current.json > /dev/null 2>&1; then
            success "claude_desktop_config_current.json has valid JSON syntax"
            
            # Check for placeholder API key
            if grep -q "YOUR_OPENAI_API_KEY_HERE" claude_desktop_config_current.json; then
                warning "API key placeholder found - needs actual key"
            fi
        else
            error "claude_desktop_config_current.json has invalid JSON syntax"
        fi
    else
        info "claude_desktop_config_current.json not found (optional)"
    fi
}

# Check database credentials consistency
check_credentials() {
    echo -e "\n${BLUE}Checking credential consistency...${NC}"
    
    # Extract PostgreSQL credentials from docker-compose.yml
    if [[ -f "docker-compose.yml" ]]; then
        COMPOSE_USER=$(grep "POSTGRES_USER" docker-compose.yml | head -1 | cut -d'=' -f2 | tr -d ' ')
        COMPOSE_DB=$(grep "POSTGRES_DB" docker-compose.yml | head -1 | cut -d'=' -f2 | tr -d ' ')
        
        info "Docker Compose PostgreSQL user: $COMPOSE_USER"
        info "Docker Compose PostgreSQL database: $COMPOSE_DB"
        
        # Check against .env.PRODUCTION
        if [[ -f ".env.PRODUCTION" ]]; then
            ENV_USER=$(grep "^POSTGRES_USER=" .env.PRODUCTION | cut -d'=' -f2)
            ENV_DB=$(grep "^POSTGRES_DATABASE=" .env.PRODUCTION | cut -d'=' -f2)
            
            if [[ "$COMPOSE_USER" != "$ENV_USER" ]]; then
                error "PostgreSQL user mismatch: docker-compose has '$COMPOSE_USER', .env.PRODUCTION has '$ENV_USER'"
            else
                success "PostgreSQL user matches"
            fi
            
            if [[ "$COMPOSE_DB" != "$ENV_DB" ]]; then
                error "PostgreSQL database mismatch: docker-compose has '$COMPOSE_DB', .env.PRODUCTION has '$ENV_DB'"
            else
                success "PostgreSQL database matches"
            fi
        fi
    fi
}

# Check running services
check_services() {
    echo -e "\n${BLUE}Checking running services...${NC}"
    
    if command -v docker &> /dev/null; then
        # Check ChromaDB
        if docker ps | grep -q "chromadb-memory"; then
            success "ChromaDB is running"
            
            # Check health
            if docker ps | grep "chromadb-memory" | grep -q "healthy"; then
                success "ChromaDB is healthy"
            elif docker ps | grep "chromadb-memory" | grep -q "unhealthy"; then
                warning "ChromaDB is unhealthy"
            fi
        else
            warning "ChromaDB is not running"
        fi
        
        # Check PostgreSQL
        if docker ps | grep -q "postgres-memory"; then
            success "PostgreSQL is running"
            
            # Check health
            if docker ps | grep "postgres-memory" | grep -q "healthy"; then
                success "PostgreSQL is healthy"
            elif docker ps | grep "postgres-memory" | grep -q "unhealthy"; then
                warning "PostgreSQL is unhealthy"
            fi
        else
            warning "PostgreSQL is not running"
        fi
        
        # Check network
        if docker network ls | grep -q "mcp-chromadb-memory_memory-network"; then
            success "Docker network exists"
        else
            warning "Docker network not found"
        fi
    else
        warning "Docker not available - skipping service checks"
    fi
}

# Check build artifacts
check_build() {
    echo -e "\n${BLUE}Checking build artifacts...${NC}"
    
    if [[ -d "dist" ]]; then
        success "dist directory exists"
        
        if [[ -f "dist/index.js" ]]; then
            success "dist/index.js exists"
        else
            error "dist/index.js not found - run 'npm run build'"
        fi
    else
        error "dist directory not found - run 'npm run build'"
    fi
    
    if [[ -f "package.json" ]]; then
        success "package.json exists"
    else
        error "package.json not found"
    fi
}

# Generate summary
generate_summary() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}Configuration Validation Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    
    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}✓ No errors found!${NC}"
    else
        echo -e "${RED}✗ Found $ERRORS errors${NC}"
    fi
    
    if [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✓ No warnings${NC}"
    else
        echo -e "${YELLOW}⚠ Found $WARNINGS warnings${NC}"
    fi
    
    echo ""
    
    if [[ $ERRORS -gt 0 ]]; then
        echo -e "${RED}Please fix the errors before running the MCP server.${NC}"
        exit 1
    elif [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}The configuration has warnings but should work.${NC}"
        echo -e "${YELLOW}Consider addressing the warnings for optimal operation.${NC}"
    else
        echo -e "${GREEN}Configuration is valid and ready to use!${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}MCP ChromaDB Memory Configuration Validator${NC}"
    echo -e "${BLUE}===========================================${NC}"
    
    # Run all checks
    check_env_files
    check_docker_config
    check_mcp_configs
    check_credentials
    check_services
    check_build
    
    # Generate summary
    generate_summary
}

# Run main function
main