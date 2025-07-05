Write-Host "Checking prerequisites..." -ForegroundColor Green

# Node.js
try { 
    $nodeVersion = node --version
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found" -ForegroundColor Red
}

# npm
try {
    $npmVersion = npm --version
    Write-Host "✓ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found" -ForegroundColor Red
}

# Docker
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker: $dockerVersion" -ForegroundColor Green
    
    # Check if Docker is running
    docker ps > $null 2>&1
    if ($?) {
        Write-Host "✓ Docker is running" -ForegroundColor Green
    } else {
        Write-Host "! Docker is installed but not running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Docker not found" -ForegroundColor Red
}

# Git
try {
    $gitVersion = git --version
    Write-Host "✓ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git not found" -ForegroundColor Red
}

# Check if ChromaDB is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/heartbeat" -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "✓ ChromaDB is accessible" -ForegroundColor Green
} catch {
    Write-Host "! ChromaDB not running (run 'docker-compose up -d chromadb' in aoe-mcp-personal)" -ForegroundColor Yellow
}