#!/bin/bash

# OmniCare Backend Test Runner
# This script helps run tests with proper configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="unit"
VERBOSE=""
COVERAGE=""
WATCH=""
TEST_PATH=""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type <type>       Test type: unit, integration, e2e, all (default: unit)"
    echo "  -p, --path <path>       Specific test file or pattern"
    echo "  -v, --verbose           Run tests in verbose mode"
    echo "  -c, --coverage          Generate coverage report"
    echo "  -w, --watch            Run tests in watch mode"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Run unit tests"
    echo "  $0 -t integration       # Run integration tests"
    echo "  $0 -p auth -v          # Run auth tests verbosely"
    echo "  $0 -c                  # Run with coverage"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -p|--path)
            TEST_PATH="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="--verbose"
            shift
            ;;
        -c|--coverage)
            COVERAGE="--coverage"
            shift
            ;;
        -w|--watch)
            WATCH="--watch"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Function to check if test database is needed
check_test_database() {
    if [[ "$TEST_TYPE" == "integration" || "$TEST_TYPE" == "e2e" ]]; then
        echo -e "${YELLOW}🔍 Checking test database...${NC}"
        
        # Check if PostgreSQL is accessible
        if ! nc -z localhost 5433 2>/dev/null; then
            echo -e "${RED}❌ Test database is not running on port 5433${NC}"
            echo -e "${YELLOW}💡 Run './scripts/setup-test-db.sh start' to start the test database${NC}"
            exit 1
        fi
        
        # Check if Redis is accessible
        if ! nc -z localhost 6380 2>/dev/null; then
            echo -e "${RED}❌ Test Redis is not running on port 6380${NC}"
            echo -e "${YELLOW}💡 Run './scripts/setup-test-db.sh start' to start test services${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Test database services are running${NC}"
    fi
}

# Function to run tests
run_tests() {
    local test_command="npm test"
    local test_args=""
    
    # Set test category for proper mocking configuration
    case $TEST_TYPE in
        unit)
            export TEST_CATEGORY="unit"
            export MOCK_DATABASE="true"
            test_args="--testPathPattern=unit"
            echo -e "${BLUE}🧪 Running unit tests (with mocked database)...${NC}"
            ;;
        integration)
            export TEST_CATEGORY="integration"
            export MOCK_DATABASE="false"
            test_args="--testPathPattern=integration --maxWorkers=1"
            echo -e "${BLUE}🔗 Running integration tests (with real database)...${NC}"
            ;;
        e2e)
            export TEST_CATEGORY="e2e"
            export MOCK_DATABASE="false"
            test_args="--testPathPattern=e2e --maxWorkers=1"
            echo -e "${BLUE}🌐 Running end-to-end tests...${NC}"
            ;;
        all)
            echo -e "${BLUE}📦 Running all tests...${NC}"
            ;;
        *)
            echo -e "${RED}Invalid test type: $TEST_TYPE${NC}"
            usage
            ;;
    esac
    
    # Add optional arguments
    if [[ -n "$TEST_PATH" ]]; then
        test_args="$test_args --testNamePattern=\"$TEST_PATH\""
    fi
    
    if [[ -n "$VERBOSE" ]]; then
        test_args="$test_args $VERBOSE"
    fi
    
    if [[ -n "$COVERAGE" ]]; then
        test_args="$test_args $COVERAGE"
    fi
    
    if [[ -n "$WATCH" ]]; then
        test_args="$test_args $WATCH"
    fi
    
    # Check database if needed
    check_test_database
    
    # Load test environment
    if [ -f .env.test ]; then
        echo -e "${GREEN}✅ Loading .env.test configuration${NC}"
        export $(cat .env.test | grep -v '^#' | xargs)
    fi
    
    # Run the tests
    echo -e "${YELLOW}🚀 Executing: $test_command -- $test_args${NC}"
    echo ""
    
    if [[ -n "$test_args" ]]; then
        eval "$test_command -- $test_args"
    else
        eval "$test_command"
    fi
}

# Main execution
echo -e "${BLUE}🏥 OmniCare Backend Test Runner${NC}"
echo "================================"
echo ""

# Run tests
run_tests

# Show coverage report location if coverage was generated
if [[ -n "$COVERAGE" ]]; then
    echo ""
    echo -e "${GREEN}📊 Coverage report generated at: coverage/lcov-report/index.html${NC}"
fi