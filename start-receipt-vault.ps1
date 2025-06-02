#!/usr/bin/env pwsh

Write-Host "Starting Receipt Vault Pro..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Blue

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "Docker is running!" -ForegroundColor Green
} catch {
    Write-Host "Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Create logs directory
New-Item -ItemType Directory -Force -Path "backend/logs" | Out-Null

# Set environment variables
$env:NODE_ENV = "development"
$env:COMPOSE_PROJECT_NAME = "receipt_vault"

Write-Host "Building and starting containers..." -ForegroundColor Yellow

# Start the infrastructure first (database, redis, etc.)
Write-Host "Starting infrastructure services..." -ForegroundColor Cyan
docker-compose up -d postgres redis elasticsearch qdrant minio

# Wait for database to be ready
Write-Host "Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep 10

# Check if database is ready
do {
    $dbReady = docker-compose exec postgres pg_isready -U postgres 2>$null
    if (-not $dbReady) {
        Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
        Start-Sleep 2
    }
} while (-not $dbReady)

Write-Host "Database is ready!" -ForegroundColor Green

# Start backend
Write-Host "Starting backend API..." -ForegroundColor Cyan
docker-compose up -d backend

# Wait for backend to be ready
Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
Start-Sleep 15

# Check backend health
do {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        $backendReady = $response.StatusCode -eq 200
    } catch {
        $backendReady = $false
    }
    
    if (-not $backendReady) {
        Write-Host "Waiting for backend API..." -ForegroundColor Yellow
        Start-Sleep 3
    }
} while (-not $backendReady)

Write-Host "Backend API is ready!" -ForegroundColor Green

# Start frontend
Write-Host "Starting frontend web app..." -ForegroundColor Cyan
docker-compose up -d frontend

Write-Host ""
Write-Host "Receipt Vault Pro is starting up!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Blue
Write-Host "Frontend (Web):     http://localhost:8080" -ForegroundColor White
Write-Host "Backend API:       http://localhost:3000" -ForegroundColor White
Write-Host "Database (Postgres): localhost:5432" -ForegroundColor White
Write-Host "Redis Cache:       localhost:6379" -ForegroundColor White
Write-Host "Elasticsearch:     http://localhost:9200" -ForegroundColor White
Write-Host "Qdrant Vector DB:  http://localhost:6333" -ForegroundColor White
Write-Host "MinIO Storage:     http://localhost:9001" -ForegroundColor White
Write-Host "===============================================" -ForegroundColor Blue
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "   docker-compose logs -f [service]" -ForegroundColor White
Write-Host ""
Write-Host "To stop everything:" -ForegroundColor Yellow
Write-Host "   docker-compose down" -ForegroundColor White
Write-Host ""
Write-Host "Quick health checks:" -ForegroundColor Yellow
Write-Host "   Backend:     curl http://localhost:3000/health" -ForegroundColor White
Write-Host "   Frontend:    curl http://localhost:8080" -ForegroundColor White
Write-Host ""

# Show status
docker-compose ps 