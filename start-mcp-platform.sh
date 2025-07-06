#!/bin/bash

# MCP ChromaDB Memory Platform Startup Script
# This script verifies all services are running before starting Claude Code
# Usage: ./start-mcp-platform.sh

set -e

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration defaults
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
CONFIG_FILE="$HOME/.mcp-startup.conf"
LOG_FILE="/tmp/mcp-startup-$(date +%Y%m%d-%H%M%S).log"

# Load configuration if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Default values if not in config
CHROMADB_URL="${CHROMADB_URL:-http://localhost:8000}"
CHROMADB_CONTAINER="${CHROMADB_CONTAINER:-chromadb-memory}"
DOCKER_COMPOSE_DIR="${DOCKER_COMPOSE_DIR:-.}"
MAX_RETRIES="${MAX_RETRIES:-5}"
RETRY_DELAY="${RETRY_DELAY:-2}"
AUTO_LAUNCH_CLAUDE="${AUTO_LAUNCH_CLAUDE:-false}"
CLAUDE_DESKTOP_PATH="${CLAUDE_DESKTOP_PATH:-/mnt/c/Users/$USER/AppData/Local/AnthropicClaude/Claude.exe}"

# Initialize variables
ERRORS=0
WARNINGS=0
START_TIME=$(date +%s)

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
    ((ERRORS++))
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
    ((WARNINGS++))
}

log_info() {
    echo -e "${CYAN}ℹ $1${NC}" | tee -a "$LOG_FILE"
}

# Display header
display_header() {
    clear
    echo -e "${BOLD}${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║           MCP ChromaDB Memory Platform Startup               ║"
    echo "║                    Health Check Dashboard                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
}

# Check if running in WSL
check_wsl() {
    if ! grep -qi microsoft /proc/version; then
        log_warning "Not running in WSL. Some features may not work correctly."
        return 1
    fi
    log_success "WSL environment detected"
    return 0
}

# Check Docker daemon
check_docker() {
    echo -e "${BOLD}🐳 Docker Status${NC}"
    echo "─────────────────"
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker command not found"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        echo "  Try: sudo service docker start"
        return 1
    fi
    
    log_success "Docker daemon is running"
    
    # Check Docker version
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | sed 's/,$//')
    log_info "Docker version: $DOCKER_VERSION"
    
    return 0
}

# Check ChromaDB
check_chromadb() {
    echo
    echo -e "${BOLD}🧠 ChromaDB Status${NC}"
    echo "──────────────────"
    
    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${CHROMADB_CONTAINER}$"; then
        log_error "ChromaDB container not found: $CHROMADB_CONTAINER"
        echo "  Try: cd $DOCKER_COMPOSE_DIR && docker-compose up -d chromadb"
        return 1
    fi
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CHROMADB_CONTAINER}$"; then
        log_warning "ChromaDB container exists but is not running"
        echo -n "  Starting ChromaDB container..."
        
        if docker start "$CHROMADB_CONTAINER" &> /dev/null; then
            echo -e " ${GREEN}started${NC}"
            sleep 3  # Give it time to initialize
        else
            echo -e " ${RED}failed${NC}"
            return 1
        fi
    fi
    
    log_success "ChromaDB container is running"
    
    # Check ChromaDB API health
    echo -n "  Checking ChromaDB API health"
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -s "${CHROMADB_URL}/docs" &>/dev/null; then
            echo -e " ${GREEN}✓${NC}"
            log_success "ChromaDB API is responding"
            
            # Get collection info
            # Skip collection count for now due to API changes
            COLLECTIONS="N/A"
            log_info "ChromaDB collections: $COLLECTIONS"
            return 0
        fi
        echo -n "."
        sleep $RETRY_DELAY
    done
    
    echo -e " ${RED}✗${NC}"
    log_error "ChromaDB API is not responding at $CHROMADB_URL"
    return 1
}

# Check MCP Server
check_mcp_server() {
    echo
    echo -e "${BOLD}🚀 MCP Server Status${NC}"
    echo "────────────────────"
    
    cd "$SCRIPT_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in $SCRIPT_DIR"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found. Running npm install..."
        if npm install &> /dev/null; then
            log_success "Dependencies installed"
        else
            log_error "Failed to install dependencies"
            return 1
        fi
    else
        log_success "Dependencies are installed"
    fi
    
    # Check if TypeScript is built
    if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
        log_warning "TypeScript not built. Running npm run build..."
        if npm run build &> /dev/null; then
            log_success "TypeScript compiled successfully"
        else
            log_error "Failed to build TypeScript"
            return 1
        fi
    else
        log_success "TypeScript build found"
        
        # Check if build is up to date
        NEWEST_SRC=$(find src -name "*.ts" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f1)
        NEWEST_DIST=$(find dist -name "*.js" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f1)
        
        if [ ! -z "$NEWEST_SRC" ] && [ ! -z "$NEWEST_DIST" ]; then
            if (( $(echo "$NEWEST_SRC > $NEWEST_DIST" | bc -l) )); then
                log_warning "Source files newer than build. Rebuilding..."
                if npm run build &> /dev/null; then
                    log_success "TypeScript recompiled"
                else
                    log_error "Failed to rebuild TypeScript"
                fi
            fi
        fi
    fi
    
    # Run comprehensive health check
    if [ -f "$SCRIPT_DIR/scripts/startup-health-check.js" ]; then
        echo
        log_info "Running comprehensive health check..."
        if node "$SCRIPT_DIR/scripts/startup-health-check.js" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "MCP server health check passed"
        else
            log_error "MCP server health check failed"
            return 1
        fi
    fi
    
    return 0
}

# Check environment variables
check_environment() {
    echo
    echo -e "${BOLD}🔧 Environment Configuration${NC}"
    echo "────────────────────────────"
    
    # Check .env file
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        log_error ".env file not found"
        echo "  Copy .env.example to .env and configure"
        return 1
    fi
    
    # Source .env file
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    
    # Check required variables
    local missing=0
    
    if [ -z "$OPENAI_API_KEY" ]; then
        log_error "OPENAI_API_KEY not set"
        ((missing++))
    else
        log_success "OpenAI API key configured"
    fi
    
    if [ -z "$OBSIDIAN_VAULT_PATH" ]; then
        log_warning "OBSIDIAN_VAULT_PATH not set (using default)"
    else
        if [ -d "$OBSIDIAN_VAULT_PATH" ]; then
            log_success "Obsidian vault found: $OBSIDIAN_VAULT_PATH"
        else
            log_error "Obsidian vault not found at: $OBSIDIAN_VAULT_PATH"
            ((missing++))
        fi
    fi
    
    if [ -z "$CHROMADB_URL" ]; then
        log_warning "CHROMADB_URL not set (using default: http://localhost:8000)"
    fi
    
    if [ $missing -gt 0 ]; then
        return 1
    fi
    
    return 0
}

# Run pre-initialization
run_pre_init() {
    echo
    echo -e "${BOLD}🔄 Pre-initialization${NC}"
    echo "────────────────────"
    
    if [ "$SKIP_WARMUP" = "true" ]; then
        log_info "Skipping warm-up (configured)"
        return 0
    fi
    
    log_info "Running ChromaDB warm-up..."
    
    # Check if warm-up script exists
    if [ -f "$SCRIPT_DIR/scripts/warm-chromadb.js" ]; then
        if node "$SCRIPT_DIR/scripts/warm-chromadb.js" &> /dev/null; then
            log_success "ChromaDB warm-up complete"
        else
            log_warning "ChromaDB warm-up failed (non-critical)"
        fi
    else
        log_info "Warm-up script not found, skipping"
    fi
    
    return 0
}

# Display summary
display_summary() {
    echo
    echo -e "${BOLD}📊 Startup Summary${NC}"
    echo "─────────────────"
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo -e "  Duration: ${WHITE}${DURATION}s${NC}"
    echo -e "  Errors: ${ERRORS}"
    echo -e "  Warnings: ${WARNINGS}"
    echo
    
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✅ All systems operational!${NC}"
        echo
        echo "The MCP ChromaDB Memory Platform is ready to use."
        echo
        
        if [ "$AUTO_LAUNCH_CLAUDE" = "true" ] && [ -f "$CLAUDE_DESKTOP_PATH" ]; then
            echo "Launching Claude Desktop..."
            "$CLAUDE_DESKTOP_PATH" &
        else
            echo "You can now start Claude Desktop to connect to the MCP server."
        fi
        
        echo
        echo -e "${CYAN}Logs saved to: $LOG_FILE${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}❌ Startup failed with $ERRORS errors${NC}"
        echo
        echo "Please fix the errors above and try again."
        echo
        echo -e "${CYAN}Logs saved to: $LOG_FILE${NC}"
        return 1
    fi
}

# Interactive fix prompt
prompt_fix() {
    echo
    read -p "Would you like to try to fix these issues automatically? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    fi
    return 1
}

# Main execution
main() {
    display_header
    
    log "Starting MCP Platform health check..."
    echo
    
    # Run all checks
    check_wsl
    check_docker || {
        if prompt_fix; then
            sudo service docker start
            check_docker
        fi
    }
    
    check_chromadb || {
        if prompt_fix; then
            cd "$DOCKER_COMPOSE_DIR" && docker-compose up -d chromadb
            cd "$SCRIPT_DIR"
            sleep 5
            check_chromadb
        fi
    }
    
    check_environment
    check_mcp_server
    run_pre_init
    
    display_summary
}

# Create default config if it doesn't exist
create_default_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        cat > "$CONFIG_FILE" << EOF
# MCP Startup Configuration
# Edit these values to customize startup behavior

# ChromaDB settings
CHROMADB_URL="http://localhost:8000"
CHROMADB_CONTAINER="chromadb-memory"
DOCKER_COMPOSE_DIR="."

# Retry settings
MAX_RETRIES=5
RETRY_DELAY=2

# Claude Desktop settings
AUTO_LAUNCH_CLAUDE=false
CLAUDE_DESKTOP_PATH="/mnt/c/Users/\$USER/AppData/Local/AnthropicClaude/Claude.exe"

# Logging
LOG_LEVEL="info"
EOF
        log_info "Created default configuration at $CONFIG_FILE"
    fi
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    create_default_config
    main
    exit $?
fi