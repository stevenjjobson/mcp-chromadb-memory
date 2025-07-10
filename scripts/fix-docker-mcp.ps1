# PowerShell script to fix Docker MCP server issues for Claude Desktop

Write-Host "🔧 Docker MCP Server Fix Script" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "⚠️  This script should be run as Administrator for best results" -ForegroundColor Yellow
}

# Check Docker is running
Write-Host "1️⃣ Checking Docker..." -ForegroundColor White
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Stop any existing claude-mcp-memory container
Write-Host ""
Write-Host "2️⃣ Cleaning up old containers..." -ForegroundColor White
$existingContainer = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq "claude-mcp-memory" }
if ($existingContainer) {
    Write-Host "Found existing container, removing..." -ForegroundColor Yellow
    docker stop claude-mcp-memory 2>$null
    docker rm claude-mcp-memory 2>$null
}
Write-Host "✅ Cleanup complete" -ForegroundColor Green

# Check ChromaDB
Write-Host ""
Write-Host "3️⃣ Checking ChromaDB..." -ForegroundColor White

$chromaRunning = docker ps --format "{{.Names}}" | Where-Object { $_ -eq "chromadb-memory" }
if (-not $chromaRunning) {
    Write-Host "⚠️  ChromaDB not running, starting it..." -ForegroundColor Yellow
    docker-compose up -d chromadb
    Start-Sleep -Seconds 5
}

# Test ChromaDB health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1" -Method Get -ErrorAction Stop
    Write-Host "✅ ChromaDB is healthy" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ChromaDB is unhealthy, restarting..." -ForegroundColor Yellow
    docker-compose restart chromadb
    Write-Host "Waiting for ChromaDB to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1" -Method Get -ErrorAction Stop
        Write-Host "✅ ChromaDB is now healthy" -ForegroundColor Green
    } catch {
        Write-Host "❌ ChromaDB still unhealthy. Check logs with: docker logs chromadb-memory" -ForegroundColor Red
    }
}

# Check PostgreSQL
Write-Host ""
Write-Host "4️⃣ Checking PostgreSQL..." -ForegroundColor White

$postgresRunning = docker ps --format "{{.Names}}" | Where-Object { $_ -eq "postgres-memory" }
if (-not $postgresRunning) {
    Write-Host "⚠️  PostgreSQL not running, starting it..." -ForegroundColor Yellow
    docker-compose up -d postgres
    Start-Sleep -Seconds 5
}

# Test PostgreSQL
$pgReady = docker exec postgres-memory pg_isready -U postgres 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL is healthy" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL is not ready" -ForegroundColor Red
}

# Check Docker network
Write-Host ""
Write-Host "5️⃣ Checking Docker network..." -ForegroundColor White

$networkExists = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq "mcp-chromadb-memory_memory-network" }
if ($networkExists) {
    Write-Host "✅ Docker network exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  Creating Docker network..." -ForegroundColor Yellow
    docker network create mcp-chromadb-memory_memory-network
}

# Display the key fixes
Write-Host ""
Write-Host "📋 Key Configuration Fixes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "The main issues in Claude Desktop configs are:" -ForegroundColor White
Write-Host ""
Write-Host "1. Container names must match docker-compose:" -ForegroundColor Yellow
Write-Host "   ❌ CHROMA_HOST=chromadb" -ForegroundColor Red
Write-Host "   ✅ CHROMA_HOST=chromadb-memory" -ForegroundColor Green
Write-Host ""
Write-Host "   ❌ POSTGRES_HOST=postgres" -ForegroundColor Red
Write-Host "   ✅ POSTGRES_HOST=postgres-memory" -ForegroundColor Green
Write-Host ""
Write-Host "2. Vault path inside container:" -ForegroundColor Yellow
Write-Host "   ❌ OBSIDIAN_VAULT_PATH=C:/Users/Steve/..." -ForegroundColor Red
Write-Host "   ✅ OBSIDIAN_VAULT_PATH=/vault" -ForegroundColor Green
Write-Host ""
Write-Host "3. Network name must be exact:" -ForegroundColor Yellow
Write-Host "   ✅ --network mcp-chromadb-memory_memory-network" -ForegroundColor Green

# Apply the fix
Write-Host ""
Write-Host "🔧 Applying the fix..." -ForegroundColor Cyan
Write-Host ""

$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$fixedConfigPath = "claude_desktop_config_fixed.json"

if (Test-Path $fixedConfigPath) {
    Write-Host "Do you want to apply the fixed configuration? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq 'Y' -or $response -eq 'y') {
        # Backup current config
        $backupPath = "$configPath.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $configPath $backupPath -Force
        Write-Host "✅ Backed up current config to: $backupPath" -ForegroundColor Green
        
        # Read fixed config
        $fixedConfig = Get-Content $fixedConfigPath -Raw | ConvertFrom-Json
        
        # Ask for API key
        Write-Host ""
        Write-Host "Enter your OpenAI API key (or press Enter to skip):" -ForegroundColor Yellow
        $apiKey = Read-Host -AsSecureString
        
        if ($apiKey.Length -gt 0) {
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey)
            $plainApiKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
            
            # Update API key in config
            for ($i = 0; $i -lt $fixedConfig.mcpServers.memory.args.Count; $i++) {
                if ($fixedConfig.mcpServers.memory.args[$i] -eq "OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE") {
                    $fixedConfig.mcpServers.memory.args[$i] = "OPENAI_API_KEY=$plainApiKey"
                    break
                }
            }
        }
        
        # Save fixed config
        $fixedConfig | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
        Write-Host "✅ Applied fixed configuration" -ForegroundColor Green
        Write-Host ""
        Write-Host "Please restart Claude Desktop for changes to take effect!" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart Claude Desktop" -ForegroundColor White
Write-Host "2. Check if 'memory' appears in MCP servers" -ForegroundColor White
Write-Host "3. Test with: 'Check the health of the memory server'" -ForegroundColor White
Write-Host ""
Write-Host "If issues persist, check Docker logs:" -ForegroundColor Yellow
Write-Host "  docker logs chromadb-memory" -ForegroundColor White
Write-Host "  docker logs postgres-memory" -ForegroundColor White