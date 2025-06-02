@echo off
echo.
echo 🚀 Starting Receipt Vault Demo...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running! Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start Docker services
echo 📦 Starting Docker services...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Start backend API
echo 🖥️ Starting Backend API...
start "Receipt Vault API" cmd /k "cd backend && node demo-server.js"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Open web demo
echo 🌐 Opening Web Demo...
start "" "backend/demo-web.html"

echo.
echo ✅ Demo Setup Complete!
echo.
echo 📱 For mobile app:
echo    1. Open another terminal
echo    2. cd mobile
echo    3. flutter run
echo.
echo 🌐 Web demo should open automatically
echo 📡 Backend API: http://localhost:3000
echo.
echo Press any key to stop all services...
pause >nul

REM Cleanup
echo 🧹 Stopping services...
docker-compose down
taskkill /f /im node.exe >nul 2>&1
echo ✅ Cleanup complete! 