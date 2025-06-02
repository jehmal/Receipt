# WorkOS Authentication Workflow Test Script
# This script starts the auth server and runs comprehensive tests

Write-Host "🚀 WorkOS Authentication Workflow Testing" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Yellow

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return $connection.TcpTestSucceeded
    } catch {
        return $false
    }
}

# Function to wait for server to be ready
function Wait-ForServer {
    param([string]$Url, [int]$MaxAttempts = 30)
    
    Write-Host "⏳ Waiting for server to be ready..." -ForegroundColor Blue
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Server is ready!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Server not ready yet
        }
        
        Write-Host "   Attempt $i/$MaxAttempts..." -ForegroundColor Gray
        Start-Sleep -Seconds 1
    }
    
    Write-Host "❌ Server failed to start within expected time" -ForegroundColor Red
    return $false
}

# Check if server is already running
if (Test-Port -Port 3000) {
    Write-Host "ℹ️  Server is already running on port 3000" -ForegroundColor Yellow
    $serverAlreadyRunning = $true
} else {
    Write-Host "📡 Starting auth server..." -ForegroundColor Blue
    $serverAlreadyRunning = $false
    
    # Start the auth server in background
    $serverProcess = Start-Process -FilePath "node" -ArgumentList "auth-server.js" -PassThru -WindowStyle Hidden
    
    # Wait for server to be ready
    if (!(Wait-ForServer -Url "http://localhost:3000/health")) {
        Write-Host "❌ Failed to start server. Exiting..." -ForegroundColor Red
        if ($serverProcess) {
            Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        }
        exit 1
    }
}

Write-Host ""
Write-Host "🧪 Running WorkOS Authentication Tests..." -ForegroundColor Cyan

# Run the test script
try {
    node test-workos-simple.js
    $testExitCode = $LASTEXITCODE
} catch {
    Write-Host "❌ Failed to run tests: $($_.Exception.Message)" -ForegroundColor Red
    $testExitCode = 1
}

Write-Host ""
Write-Host "🎯 Additional Manual Tests to Perform:" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Yellow
Write-Host "1. 🌐 Open browser and visit:" -ForegroundColor White
Write-Host "   → http://localhost:3000/auth/login" -ForegroundColor Blue
Write-Host "   → Should redirect to WorkOS login page" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 📱 Test Mobile App (if Flutter app is available):" -ForegroundColor White
Write-Host "   → Run: flutter run (in mobile directory)" -ForegroundColor Blue
Write-Host "   → Test login flow through mobile app" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🔒 Test Protected Endpoints After Login:" -ForegroundColor White
Write-Host "   → Visit: http://localhost:3000/api/receipts" -ForegroundColor Blue
Write-Host "   → Should show receipts data after authentication" -ForegroundColor Gray
Write-Host ""
Write-Host "4. 👤 Test User Info Endpoint:" -ForegroundColor White
Write-Host "   → Visit: http://localhost:3000/auth/me" -ForegroundColor Blue
Write-Host "   → Should show authenticated user information" -ForegroundColor Gray

# Cleanup
if (!$serverAlreadyRunning -and $serverProcess) {
    Write-Host ""
    Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Server stopped" -ForegroundColor Green
}

Write-Host ""
if ($testExitCode -eq 0) {
    Write-Host "🎉 All automated tests completed successfully!" -ForegroundColor Green
    Write-Host "   WorkOS authentication workflow is properly configured." -ForegroundColor Gray
} else {
    Write-Host "⚠️  Some tests failed. Please check the configuration." -ForegroundColor Red
}

Write-Host "=============================================" -ForegroundColor Yellow
exit $testExitCode 