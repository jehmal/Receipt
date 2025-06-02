#!/bin/bash

# Receipt Vault Development Startup Script
# This script starts all services needed for development

echo "🚀 Starting Receipt Vault Development Environment"
echo "=================================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Start Docker services
echo "📦 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if curl -f http://localhost:5432 >/dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL may still be starting..."
fi

# Check Redis
if curl -f http://localhost:6379 >/dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis may still be starting..."
fi

# Check Elasticsearch
if curl -f http://localhost:9200 >/dev/null 2>&1; then
    echo "✅ Elasticsearch is running"
else
    echo "⚠️  Elasticsearch may still be starting..."
fi

echo ""
echo "🔧 Docker Services Status:"
docker-compose ps

echo ""
echo "🔑 Starting WorkOS Authentication Server..."
cd backend
node auth-server.js &
AUTH_PID=$!

echo ""
echo "📱 Ready to start mobile app!"
echo ""
echo "Next steps:"
echo "1. In a new terminal, run: cd mobile && flutter run"
echo "2. Open browser to: http://localhost:3000"
echo "3. Test authentication flow"
echo ""
echo "To stop services:"
echo "- Press Ctrl+C to stop auth server"
echo "- Run: docker-compose down"
echo ""
echo "🎉 Development environment is ready!"

# Keep the script running
wait $AUTH_PID