# Receipt Vault Development Startup Script (PowerShell)
# This script starts all services needed for development

Write-Host "🚀 Starting Receipt Vault Development Environment" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Start Docker services
Write-Host "📦 Starting Docker services..." -ForegroundColor Blue
docker-compose up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host "🔍 Checking service health..." -ForegroundColor Blue

# Check if ports are open
$services = @(
    @{Name="PostgreSQL"; Port=5432},
    @{Name="Redis"; Port=6379},
    @{Name="Elasticsearch"; Port=9200},
    @{Name="Qdrant"; Port=6333},
    @{Name="MinIO"; Port=9000}
)

foreach ($service in $services) {
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $service.Port)
        $connection.Close()
        Write-Host "✅ $($service.Name) is running on port $($service.Port)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  $($service.Name) may still be starting on port $($service.Port)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔧 Docker Services Status:" -ForegroundColor Blue
docker-compose ps

Write-Host ""
Write-Host "🔑 Starting WorkOS Authentication Server..." -ForegroundColor Green
cd backend

# Start the auth server in background
$authJob = Start-Job -ScriptBlock {
    Set-Location $args[0]
    node auth-server.js
} -ArgumentList (Get-Location)

Write-Host ""
Write-Host "📱 Development Environment Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open new PowerShell terminal and run: cd mobile; flutter run" -ForegroundColor White
Write-Host "2. Open browser to: http://localhost:3000" -ForegroundColor White
Write-Host "3. Test authentication flow" -ForegroundColor White
Write-Host ""
Write-Host "Current services:" -ForegroundColor Cyan
Write-Host "- Auth Server: http://localhost:3000" -ForegroundColor White
Write-Host "- API Docs: http://localhost:3000/api/demo" -ForegroundColor White
Write-Host "- PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "- Redis: localhost:6379" -ForegroundColor White
Write-Host "- Elasticsearch: http://localhost:9200" -ForegroundColor White
Write-Host "- MinIO Console: http://localhost:9001" -ForegroundColor White
Write-Host ""
Write-Host "To stop services:" -ForegroundColor Red
Write-Host "- Press Ctrl+C to stop this script" -ForegroundColor White
Write-Host "- Run: docker-compose down" -ForegroundColor White
Write-Host ""

# Monitor the auth server job
try {
    # Wait for the job to complete or for user to press Ctrl+C
    while ($authJob.State -eq "Running") {
        Start-Sleep -Seconds 2
        
        # Check if user pressed Ctrl+C
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq "C" -and $key.Modifiers -eq "Control") {
                break
            }
        }
    }
} finally {
    # Clean up
    Write-Host ""
    Write-Host "🛑 Stopping auth server..." -ForegroundColor Yellow
    Stop-Job $authJob -Force
    Remove-Job $authJob -Force
    
    Write-Host "✅ Auth server stopped. Docker services are still running." -ForegroundColor Green
    Write-Host "Run 'docker-compose down' to stop all services." -ForegroundColor Cyan
}