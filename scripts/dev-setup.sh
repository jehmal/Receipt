#!/bin/bash

# Forever Receipt Vault Development Setup Script

set -e

echo "🚀 Setting up Forever Receipt Vault Development Environment"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Create .env file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}📝 Creating backend .env file...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ Created backend/.env from .env.example${NC}"
    echo -e "${YELLOW}💡 Please edit backend/.env with your configuration${NC}"
fi

# Start infrastructure services
echo -e "${BLUE}🐳 Starting infrastructure services...${NC}"
docker-compose up -d postgres redis elasticsearch qdrant minio

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Initialize database
echo -e "${BLUE}🗄️  Initializing database...${NC}"
cd database && ./init.sh && cd ..

# Install backend dependencies
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd backend && npm install && cd ..

# Install Flutter dependencies (if Flutter is available)
if command -v flutter &> /dev/null; then
    echo -e "${BLUE}📱 Installing Flutter dependencies...${NC}"
    cd mobile && flutter pub get && cd ..
    echo -e "${GREEN}✅ Flutter dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Flutter not found. Please install Flutter SDK to develop the mobile app.${NC}"
fi

# Create uploads directory
mkdir -p backend/uploads/receipts
mkdir -p backend/logs

echo ""
echo -e "${GREEN}🎉 Development environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Edit backend/.env with your API keys and configuration"
echo "2. Start the backend: cd backend && npm run dev"
echo "3. (Optional) Start the mobile app: cd mobile && flutter run"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo "• View logs: docker-compose logs -f"
echo "• Stop services: docker-compose down"
echo "• Reset database: ./scripts/reset-db.sh"
echo "• Run tests: cd backend && npm test"
echo ""
echo -e "${BLUE}🌐 Service URLs:${NC}"
echo "• Backend API: http://localhost:3000"
echo "• PostgreSQL: localhost:5432"
echo "• Redis: localhost:6379"
echo "• Elasticsearch: http://localhost:9200"
echo "• Qdrant: http://localhost:6333"
echo "• MinIO: http://localhost:9001 (admin/admin123)"