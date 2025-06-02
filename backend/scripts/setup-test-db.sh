#!/bin/bash

# Setup Test Database Script for Receipt Vault Pro
# This script creates and configures the test database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Receipt Vault Pro test database...${NC}"

# Load test environment variables
if [ -f env.test ]; then
    export $(cat env.test | grep -v ^# | xargs)
    echo -e "${GREEN}✓ Loaded test environment variables${NC}"
else
    echo -e "${RED}✗ env.test file not found${NC}"
    exit 1
fi

# Database configuration
DB_NAME=${DB_NAME:-receiptvault_test}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo -e "${YELLOW}Database configuration:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; then
    echo -e "${RED}✗ PostgreSQL is not running on $DB_HOST:$DB_PORT${NC}"
    echo "Please start PostgreSQL first"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Drop test database if it exists
echo -e "${YELLOW}Dropping existing test database (if exists)...${NC}"
dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER --if-exists $DB_NAME || true

# Create test database
echo -e "${YELLOW}Creating test database...${NC}"
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
echo -e "${GREEN}✓ Test database '$DB_NAME' created${NC}"

# Run migrations if they exist
if [ -d "database/migrations" ]; then
    echo -e "${YELLOW}Running database migrations...${NC}"
    for migration_file in database/migrations/*.sql; do
        if [ -f "$migration_file" ]; then
            echo "  Running $(basename $migration_file)..."
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"
        fi
    done
    echo -e "${GREEN}✓ Migrations completed${NC}"
else
    echo -e "${YELLOW}No migrations directory found, checking parent directory...${NC}"
    if [ -d "../database/migrations" ]; then
        echo -e "${YELLOW}Running database migrations from parent directory...${NC}"
        for migration_file in ../database/migrations/*.sql; do
            if [ -f "$migration_file" ]; then
                echo "  Running $(basename $migration_file)..."
                psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"
            fi
        done
        echo -e "${GREEN}✓ Migrations completed${NC}"
    fi
fi

# Check if seed file exists and run it
if [ -f "../database/seed.sql" ]; then
    echo -e "${YELLOW}Running test data seed...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "../database/seed.sql"
    echo -e "${GREEN}✓ Test data seeded${NC}"
elif [ -f "database/seed.sql" ]; then
    echo -e "${YELLOW}Running test data seed...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/seed.sql"
    echo -e "${GREEN}✓ Test data seeded${NC}"
else
    echo -e "${YELLOW}No seed file found, skipping test data${NC}"
fi

# Test database connection
echo -e "${YELLOW}Testing database connection...${NC}"
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Test database setup completed successfully!${NC}"
echo ""
echo "You can now run tests with:"
echo "  npm test"
echo ""
echo "To clean up the test database later:"
echo "  dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME"