#!/bin/bash

# Setup script for OmniCare test database
# This script helps set up the test environment for running integration tests

set -e

echo "🏥 OmniCare Test Database Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker to continue.${NC}"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed. Please install docker-compose to continue.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Test Environment Configuration:${NC}"
echo "- Database: omnicare_test"
echo "- User: omnicare"
echo "- Port: 5433 (PostgreSQL)"
echo "- Redis Port: 6380"
echo ""

# Navigate to the test docker-compose directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
DOCKER_DIR="$PROJECT_ROOT/devops/docker"

if [ ! -f "$DOCKER_DIR/docker-compose.test.yml" ]; then
    echo -e "${RED}❌ docker-compose.test.yml not found at $DOCKER_DIR${NC}"
    echo -e "${YELLOW}📁 Current directory: $(pwd)${NC}"
    echo -e "${YELLOW}📁 Script directory: $SCRIPT_DIR${NC}"
    echo -e "${YELLOW}📁 Docker directory: $DOCKER_DIR${NC}"
    exit 1
fi

cd "$DOCKER_DIR"

# Function to start test services
start_services() {
    echo -e "${YELLOW}🚀 Starting test services...${NC}"
    docker-compose -f docker-compose.test.yml up -d postgres redis
    
    echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
    
    # Wait for PostgreSQL
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U omnicare -d omnicare_test &> /dev/null; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
            break
        fi
        retries=$((retries - 1))
        echo -n "."
        sleep 1
    done
    
    if [ $retries -eq 0 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
    
    # Wait for Redis
    retries=30
    while [ $retries -gt 0 ]; do
        if docker-compose -f docker-compose.test.yml exec -T redis redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✅ Redis is ready${NC}"
            break
        fi
        retries=$((retries - 1))
        echo -n "."
        sleep 1
    done
    
    if [ $retries -eq 0 ]; then
        echo -e "${RED}❌ Redis failed to start${NC}"
        exit 1
    fi
}

# Function to run database setup SQL
setup_database() {
    echo -e "${YELLOW}🔧 Setting up database schema...${NC}"
    
    # Check if the setup SQL file exists
    if [ -f "$SCRIPT_DIR/setup-test-db.sql" ]; then
        echo "Running setup-test-db.sql..."
        docker-compose -f docker-compose.test.yml exec -T postgres psql -U omnicare -d omnicare_test < "$SCRIPT_DIR/setup-test-db.sql"
        echo -e "${GREEN}✅ Database schema created${NC}"
    else
        echo -e "${YELLOW}⚠️  No setup-test-db.sql found, skipping schema setup${NC}"
    fi
}

# Function to stop test services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping test services...${NC}"
    docker-compose -f docker-compose.test.yml down
    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Function to show status
show_status() {
    echo -e "${YELLOW}📊 Service Status:${NC}"
    docker-compose -f docker-compose.test.yml ps
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}📜 Service Logs:${NC}"
    docker-compose -f docker-compose.test.yml logs --tail=50
}

# Main menu
case "${1}" in
    start)
        start_services
        setup_database
        echo -e "${GREEN}✅ Test environment is ready!${NC}"
        echo ""
        echo "To run tests:"
        echo "  npm test                    # Run all tests with mocked database"
        echo "  npm run test:integration    # Run integration tests with real database"
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        setup_database
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start test database and Redis"
        echo "  stop     - Stop all test services"
        echo "  restart  - Restart test services"
        echo "  status   - Show service status"
        echo "  logs     - Show service logs"
        echo ""
        echo "Examples:"
        echo "  $0 start   # Start test environment"
        echo "  $0 stop    # Stop test environment"
        exit 1
        ;;
esac