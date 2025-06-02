#!/bin/bash

echo "🚀 Starting Receipt Vault Pro..."
echo "==============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Create logs directory
mkdir -p backend/logs

# Set environment variables
export NODE_ENV=development
export COMPOSE_PROJECT_NAME=receipt_vault

echo "📦 Building and starting containers..."

# Start the infrastructure first (database, redis, etc.)
echo "🔧 Starting infrastructure services..."
docker-compose up -d postgres redis elasticsearch qdrant minio

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is ready
until docker-compose exec postgres pg_isready -U postgres; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ Database is ready!"

# Start backend
echo "🖥️  Starting backend API..."
docker-compose up -d backend

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 15

# Check backend health
until curl -f http://localhost:3000/health > /dev/null 2>&1; do
  echo "⏳ Waiting for backend API..."
  sleep 3
done

echo "✅ Backend API is ready!"

# Start frontend
echo "🎨 Starting frontend web app..."
docker-compose up -d frontend

echo ""
echo "🎉 Receipt Vault Pro is starting up!"
echo "==============================================="
echo "📱 Frontend (Web):     http://localhost:8080"
echo "🖥️  Backend API:       http://localhost:3000"
echo "🗄️  Database (Postgres): localhost:5432"
echo "🔄 Redis Cache:       localhost:6379"
echo "🔍 Elasticsearch:     http://localhost:9200"
echo "🧠 Qdrant Vector DB:  http://localhost:6333"
echo "📁 MinIO Storage:     http://localhost:9001"
echo "==============================================="
echo ""
echo "📊 To view logs:"
echo "   docker-compose logs -f [service]"
echo ""
echo "🛑 To stop everything:"
echo "   docker-compose down"
echo ""
echo "⚡ Quick health checks:"
echo "   Backend:     curl http://localhost:3000/health"
echo "   Frontend:    curl http://localhost:8080"
echo ""

# Show status
docker-compose ps 