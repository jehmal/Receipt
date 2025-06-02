#!/bin/bash

echo "🚀 Starting Receipt Vault Pro - Full Stack"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file not found!"
    echo "📋 Creating from template..."
    cp backend/.env.template backend/.env
    echo "✅ Please edit backend/.env with your actual credentials before proceeding."
    echo "   - Add your WorkOS API key and Client ID"
    echo "   - Generate secure random strings for secrets"
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.frontend.yml up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose -f docker-compose.frontend.yml ps

echo ""
echo "🎉 Receipt Vault Pro is starting up!"
echo ""
echo "📱 Frontend (Flutter Web): http://localhost:8080"
echo "🔧 Backend API:           http://localhost:3000"
echo "🗄️  Database (PostgreSQL): localhost:5432"
echo "⚡ Redis Cache:           localhost:6379"
echo ""
echo "📝 To view logs:"
echo "   docker-compose -f docker-compose.frontend.yml logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose -f docker-compose.frontend.yml down"
echo ""

# Show recent logs
echo "📋 Recent logs:"
docker-compose -f docker-compose.frontend.yml logs --tail=20