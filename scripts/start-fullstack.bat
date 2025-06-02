@echo off
echo 🚀 Starting Receipt Vault Pro - Full Stack
echo ==========================================

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "backend\.env" (
    echo ⚠️  Backend .env file not found!
    echo 📋 Creating from template...
    copy "backend\.env.template" "backend\.env"
    echo ✅ Please edit backend\.env with your actual credentials before proceeding.
    echo    - Add your WorkOS API key and Client ID
    echo    - Generate secure random strings for secrets
    pause
    exit /b 1
)

REM Build and start services
echo 🔨 Building and starting services...
docker-compose -f docker-compose.frontend.yml up --build -d

REM Wait for services to start
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check service status
echo 📊 Service Status:
docker-compose -f docker-compose.frontend.yml ps

echo.
echo 🎉 Receipt Vault Pro is starting up!
echo.
echo 📱 Frontend (Flutter Web): http://localhost:8080
echo 🔧 Backend API:           http://localhost:3000
echo 🗄️  Database (PostgreSQL): localhost:5432
echo ⚡ Redis Cache:           localhost:6379
echo.
echo 📝 To view logs:
echo    docker-compose -f docker-compose.frontend.yml logs -f
echo.
echo 🛑 To stop:
echo    docker-compose -f docker-compose.frontend.yml down
echo.

REM Show recent logs
echo 📋 Recent logs:
docker-compose -f docker-compose.frontend.yml logs --tail=20

pause