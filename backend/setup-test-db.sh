#!/bin/bash

# Test Database Setup Script for Receipt Vault Pro
# This script sets up the test database for running the comprehensive test suite

set -e

echo "🗄️  Setting up Receipt Vault Pro test database..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load test environment variables
if [ -f .env.test ]; then
    echo "📁 Loading test environment variables..."
    export $(grep -v '^#' .env.test | xargs)
else
    echo -e "${RED}❌ .env.test file not found${NC}"
    exit 1
fi

# Set default values if not provided
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-receiptvault_test}

echo "🔧 Database configuration:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not running. Attempting to start with Docker...${NC}"
    
    # Try to start PostgreSQL with Docker
    if command -v docker > /dev/null 2>&1; then
        echo "🐳 Starting PostgreSQL container..."
        docker run -d \
            --name receiptvault-test-db \
            -e POSTGRES_DB=$DB_NAME \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -p $DB_PORT:5432 \
            postgres:15 > /dev/null 2>&1 || true
        
        # Wait for PostgreSQL to be ready
        echo "⏳ Waiting for PostgreSQL to be ready..."
        for i in {1..30}; do
            if pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
    else
        echo -e "${RED}❌ PostgreSQL is not running and Docker is not available${NC}"
        echo "   Please start PostgreSQL manually or install Docker"
        exit 1
    fi
fi

# Check PostgreSQL connection
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Create test database if it doesn't exist
echo "🔨 Creating test database if it doesn't exist..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME

echo -e "${GREEN}✅ Test database ready${NC}"

# Run database schema if it exists
if [ -f "../database/schema.sql" ]; then
    echo "📋 Applying database schema..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ../database/schema.sql > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Schema applied${NC}"
fi

# Check if Redis is needed and running
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

if command -v redis-cli > /dev/null 2>&1; then
    if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis is not running. Starting with Docker...${NC}"
        if command -v docker > /dev/null 2>&1; then
            docker run -d \
                --name receiptvault-test-redis \
                -p $REDIS_PORT:6379 \
                redis:7-alpine > /dev/null 2>&1 || true
            
            # Wait for Redis to be ready
            for i in {1..10}; do
                if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Redis is running${NC}"
                    break
                fi
                sleep 1
            done
        fi
    fi
fi

echo ""
echo -e "${GREEN}🎉 Test database setup complete!${NC}"
echo ""
echo "📊 You can now run tests with:"
echo "   npm test                    # Run all tests"
echo "   npm run test:unit          # Run unit tests only"
echo "   npm run test:integration   # Run integration tests only"
echo "   npm run test:coverage      # Run tests with coverage"
echo ""
echo "🧹 To clean up test containers:"
echo "   docker stop receiptvault-test-db receiptvault-test-redis"
echo "   docker rm receiptvault-test-db receiptvault-test-redis"
echo ""

exit 0