# Start only ChromaDB for use with Claude Desktop
# This is all you need for normal operation

Write-Host "Starting ChromaDB for MCP Memory Server..." -ForegroundColor Green

# Start ChromaDB in detached mode
docker-compose up -d chromadb

# Check if it started successfully
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nChromaDB started successfully!" -ForegroundColor Green
    Write-Host "Claude Desktop will create its own MCP container when needed." -ForegroundColor Cyan
    
    # Show status
    docker-compose ps
} else {
    Write-Host "Failed to start ChromaDB" -ForegroundColor Red
}