# Start CoachNTT Cognitive Platform - Windows PowerShell Script

Write-Host "🚀 Starting CoachNTT Cognitive Platform..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Error: docker-compose.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker check failed"
    }
}
catch {
    Write-Host "❌ Error: Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first." -ForegroundColor Yellow
    exit 1
}

# Start the services
Write-Host "🔄 Starting PostgreSQL and ChromaDB services..." -ForegroundColor Yellow
docker-compose up -d coachntt-chromadb coachntt-postgres

# Wait a moment for services to start
Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check service health
Write-Host ""
Write-Host "📊 Service Status:" -ForegroundColor Cyan
docker-compose ps

# Check if services are healthy
$output = docker-compose ps 2>&1
if ($output -match "healthy") {
    Write-Host ""
    Write-Host "✅ Services are healthy!" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "⚠️  Services may still be starting. Check logs if issues persist:" -ForegroundColor Yellow
    Write-Host "   docker logs coachntt-postgres" -ForegroundColor Gray
    Write-Host "   docker logs coachntt-chromadb" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. For Claude Code: Run 'claude' in this directory" -ForegroundColor White
Write-Host "2. For Claude Desktop: Restart Claude Desktop" -ForegroundColor White
Write-Host ""
Write-Host "📚 Quick Reference:" -ForegroundColor Cyan
Write-Host "   - Session logs: vault\Sessions\" -ForegroundColor Gray
Write-Host "   - Memory commands: 'Remember that...' / 'What do you remember about...'" -ForegroundColor Gray
Write-Host "   - Code search: 'Find function X' / 'Index the codebase'" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ Platform ready! Check out docs\guides\QUICK_REFERENCE_CARD.md for more." -ForegroundColor Green