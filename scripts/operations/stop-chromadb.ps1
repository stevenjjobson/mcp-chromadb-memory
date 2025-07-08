# Stop ChromaDB
Write-Host "Stopping ChromaDB..." -ForegroundColor Yellow

# Stop ChromaDB
docker-compose stop chromadb

if ($LASTEXITCODE -eq 0) {
    Write-Host "ChromaDB stopped successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to stop ChromaDB" -ForegroundColor Red
}