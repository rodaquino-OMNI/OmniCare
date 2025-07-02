#!/bin/bash

# Run tests with Docker availability check
# This script ensures tests run appropriately based on Docker availability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 OmniCare Backend Test Runner${NC}"
echo

# Check Docker availability
echo -e "${BLUE}Checking Docker environment...${NC}"
node scripts/check-docker.js
DOCKER_CHECK_EXIT_CODE=$?

# Determine test command based on test type
TEST_TYPE=${1:-all}
TEST_CATEGORY=""

case $TEST_TYPE in
  unit)
    echo -e "${GREEN}Running unit tests...${NC}"
    TEST_COMMAND="jest --testPathPattern='unit' --testPathIgnorePatterns='integration|e2e' --coverage"
    TEST_CATEGORY="unit"
    ;;
  integration)
    echo -e "${GREEN}Running integration tests...${NC}"
    TEST_COMMAND="jest --testPathPattern='integration' --testPathIgnorePatterns='unit|e2e' --runInBand"
    TEST_CATEGORY="integration"
    ;;
  e2e)
    echo -e "${GREEN}Running e2e tests...${NC}"
    TEST_COMMAND="jest --testPathPattern='e2e' --testPathIgnorePatterns='unit|integration' --runInBand"
    TEST_CATEGORY="e2e"
    ;;
  all)
    echo -e "${GREEN}Running all tests...${NC}"
    TEST_COMMAND="jest --coverage"
    TEST_CATEGORY="all"
    ;;
  *)
    echo -e "${RED}Invalid test type: $TEST_TYPE${NC}"
    echo "Usage: $0 [unit|integration|e2e|all]"
    exit 1
    ;;
esac

# Export test category for env.setup.ts
export TEST_CATEGORY=$TEST_CATEGORY

# Load environment variables
if [ -f .env.test ]; then
  export $(grep -v '^#' .env.test | xargs)
fi

# Check if we should skip Docker-dependent tests
if [ "$SKIP_DOCKER_TESTS" = "true" ] && [ "$TEST_CATEGORY" = "integration" ]; then
  echo -e "${YELLOW}⚠️  Docker is not available or containers are not running${NC}"
  echo -e "${YELLOW}   Integration tests will run with mocked services${NC}"
  echo
fi

# Run the tests
echo -e "${BLUE}Executing: $TEST_COMMAND${NC}"
echo

# Set NODE_ENV and run tests
NODE_ENV=test $TEST_COMMAND

TEST_EXIT_CODE=$?

# Show summary
echo
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Tests completed successfully!${NC}"
else
  echo -e "${RED}❌ Tests failed with exit code: $TEST_EXIT_CODE${NC}"
fi

# Show Docker hint if needed
if [ "$DOCKER_CHECK_EXIT_CODE" -ne 0 ] && [ "$TEST_CATEGORY" = "integration" ]; then
  echo
  echo -e "${YELLOW}💡 Tip: To run integration tests with real services:${NC}"
  echo -e "${BLUE}   1. Install Docker Desktop${NC}"
  echo -e "${BLUE}   2. Run: npm run docker:test:up${NC}"
  echo -e "${BLUE}   3. Run tests again${NC}"
fi

exit $TEST_EXIT_CODE