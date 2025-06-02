# Build Docker Images for Receipt Vault
# Run this from PowerShell as Administrator

param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$All
)

# Set working directory to project root
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "Building Receipt Vault Docker Images..." -ForegroundColor Green
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Yellow

# Function to build backend
function Build-Backend {
    Write-Host "`nBuilding Backend Docker Image..." -ForegroundColor Cyan
    
    # Check if backend files exist
    if (-not (Test-Path "./backend/Dockerfile")) {
        Write-Error "Backend Dockerfile not found at ./backend/Dockerfile"
        return $false
    }
    
    if (-not (Test-Path "./backend/package.json")) {
        Write-Error "Backend package.json not found at ./backend/package.json"
        return $false
    }
    
    # Build backend image
    docker build -t receipt-vault-backend ./backend
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backend image built successfully!" -ForegroundColor Green
        return $true
    } else {
        Write-Error "❌ Backend build failed!"
        return $false
    }
}

# Function to build frontend
function Build-Frontend {
    Write-Host "`nBuilding Frontend Docker Image..." -ForegroundColor Cyan
    
    # Check if frontend files exist
    if (-not (Test-Path "./mobile/Dockerfile")) {
        Write-Error "Frontend Dockerfile not found at ./mobile/Dockerfile"
        return $false
    }
    
    if (-not (Test-Path "./mobile/pubspec.yaml")) {
        Write-Error "Frontend pubspec.yaml not found at ./mobile/pubspec.yaml"
        return $false
    }
    
    # Build frontend image
    docker build -t receipt-vault-frontend ./mobile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Frontend image built successfully!" -ForegroundColor Green
        return $true
    } else {
        Write-Error "❌ Frontend build failed!"
        return $false
    }
}

# Function to check Docker
function Test-Docker {
    Write-Host "Checking Docker availability..." -ForegroundColor Yellow
    
    try {
        $dockerVersion = docker --version
        Write-Host "Docker found: $dockerVersion" -ForegroundColor Green
        return $true
    } catch {
        Write-Error "Docker is not available. Please ensure Docker Desktop is running."
        Write-Host "If you're using WSL, make sure WSL integration is enabled in Docker Desktop settings." -ForegroundColor Yellow
        return $false
    }
}

# Main execution
try {
    # Check Docker first
    if (-not (Test-Docker)) {
        exit 1
    }
    
    # Determine what to build
    if ($All -or (-not $Backend -and -not $Frontend)) {
        Write-Host "Building both Backend and Frontend..." -ForegroundColor Magenta
        $backendSuccess = Build-Backend
        $frontendSuccess = Build-Frontend
        
        if ($backendSuccess -and $frontendSuccess) {
            Write-Host "`n🎉 All images built successfully!" -ForegroundColor Green
            Write-Host "`nTo run the application:" -ForegroundColor Yellow
            Write-Host "  docker-compose up -d" -ForegroundColor White
        } else {
            Write-Error "`n❌ Some builds failed. Check the output above."
            exit 1
        }
    }
    elseif ($Backend) {
        $success = Build-Backend
        if (-not $success) { exit 1 }
    }
    elseif ($Frontend) {
        $success = Build-Frontend
        if (-not $success) { exit 1 }
    }
    
    Write-Host "`nDocker Images:" -ForegroundColor Yellow
    docker images | Select-String "receipt-vault"
    
} catch {
    Write-Error "An error occurred: $_"
    exit 1
}