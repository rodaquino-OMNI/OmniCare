#!/bin/bash

# Pre-test check script to ensure environment is ready for testing
# This script runs before test execution to prevent confusing test failures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}🧪 OmniCare Pre-Test Environment Check${NC}"
echo "======================================"
echo ""

# Track if any checks fail
CHECKS_PASSED=true

# Function to check a requirement
check_requirement() {
    local check_name="$1"
    local check_command="$2"
    local error_message="$3"
    local fix_command="$4"
    
    echo -n "Checking $check_name... "
    
    if eval "$check_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo -e "  ${YELLOW}Issue:${NC} $error_message"
        if [ -n "$fix_command" ]; then
            echo -e "  ${BLUE}Fix:${NC} $fix_command"
        fi
        echo ""
        CHECKS_PASSED=false
        return 1
    fi
}

# 1. Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 || echo "0.0.0")
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$NODE_MAJOR" -ge 16 ]; then
    echo -e "Checking Node.js version... ${GREEN}✓${NC} (v$NODE_VERSION)"
else
    echo -e "Checking Node.js version... ${RED}✗${NC}"
    echo -e "  ${YELLOW}Issue:${NC} Node.js version $NODE_VERSION is too old (minimum: v16)"
    echo -e "  ${BLUE}Fix:${NC} Install Node.js 16 or higher from https://nodejs.org"
    echo ""
    CHECKS_PASSED=false
fi

# 2. Check if npm packages are installed
check_requirement "npm dependencies" \
    "[ -d node_modules ] && [ -f package-lock.json ]" \
    "npm dependencies are not installed" \
    "Run: npm install"

# 3. Check if backend dependencies are installed
check_requirement "backend dependencies" \
    "[ -d backend/node_modules ] && [ -f backend/package-lock.json ]" \
    "Backend dependencies are not installed" \
    "Run: cd backend && npm install"

# 4. Check if .env file exists
if [ -f "$SCRIPT_DIR/../.env" ] || [ -f "$SCRIPT_DIR/../.env.test" ]; then
    echo -e "Checking environment config... ${GREEN}✓${NC}"
else
    echo -e "Checking environment config... ${YELLOW}⚠${NC}"
    echo -e "  ${YELLOW}Warning:${NC} No .env or .env.test file found"
    echo -e "  ${BLUE}Tip:${NC} Copy .env.example to .env and configure it"
    echo -e "  ${BLUE}Command:${NC} cp backend/.env.example backend/.env"
    echo ""
fi

# 5. Check Docker using our check-docker.sh script
echo -n "Checking Docker... "
if "$SCRIPT_DIR/check-docker.sh" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "  ${YELLOW}Issue:${NC} Docker is not running or not installed"
    echo -e "  ${BLUE}Fix:${NC} Start Docker Desktop or install Docker"
    echo -e "  ${BLUE}Details:${NC} Run ./backend/scripts/check-docker.sh for more info"
    echo ""
    CHECKS_PASSED=false
fi

# 6. Check if test database is running (only if Docker is available)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo -n "Checking test database... "
    
    # Check if postgres container is running on test port (5433)
    if docker ps | grep -q "postgres.*5433" || docker ps | grep -q "omnicare.*test.*postgres"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC}"
        echo -e "  ${YELLOW}Warning:${NC} Test database is not running"
        echo -e "  ${BLUE}Fix:${NC} Run: ./backend/scripts/setup-test-db.sh start"
        echo -e "  ${MAGENTA}Note:${NC} Unit tests will use mocked database connections"
        echo ""
    fi
fi

# 7. Check TypeScript compilation
echo -n "Checking TypeScript build... "
if [ -d "$SCRIPT_DIR/../dist" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo -e "  ${YELLOW}Warning:${NC} No build output found"
    echo -e "  ${BLUE}Tip:${NC} Run: npm run build (optional for tests)"
    echo ""
fi

# 8. Check for common test issues
echo -e "\n${BLUE}📋 Test Environment Summary:${NC}"

# Display test command recommendations
if [ "$CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✅ All required checks passed!${NC}"
    echo ""
    echo "You can now run tests:"
    echo -e "  ${BLUE}npm test${NC}              # Run all tests"
    echo -e "  ${BLUE}npm run test:unit${NC}     # Run unit tests only"
    echo -e "  ${BLUE}npm run test:integration${NC} # Run integration tests (requires database)"
    echo -e "  ${BLUE}npm run test:watch${NC}    # Run tests in watch mode"
else
    echo -e "${RED}❌ Some checks failed.${NC}"
    echo ""
    echo "Please fix the issues above before running tests."
    echo ""
    echo -e "${YELLOW}💡 Quick fixes:${NC}"
    echo "1. Start Docker Desktop"
    echo "2. Run: npm install && cd backend && npm install"
    echo "3. Run: ./backend/scripts/setup-test-db.sh start"
    
    # Exit with error code if critical checks failed
    exit 1
fi

# Additional helpful information
echo ""
echo -e "${MAGENTA}🔍 Debugging tips:${NC}"
echo "- Check Docker status: docker ps"
echo "- View test DB logs: ./backend/scripts/setup-test-db.sh logs"
echo "- Test DB connection: npm run db:test"
echo "- Run specific test file: npm test -- path/to/test.spec.ts"

exit 0