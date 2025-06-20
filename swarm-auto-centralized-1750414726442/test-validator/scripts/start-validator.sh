#!/bin/bash

# OmniCare Test Validator Startup Script
# Starts the comprehensive testing system for monitoring agent commits

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VALIDATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$VALIDATOR_DIR/validator.pid"
LOG_FILE="$VALIDATOR_DIR/logs/validator.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 OmniCare Test Validator Startup${NC}"
echo "=================================="

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Test Validator is already running (PID: $PID)${NC}"
        echo "Use './stop-validator.sh' to stop it first."
        exit 1
    else
        echo -e "${YELLOW}⚠️  Stale PID file found, removing...${NC}"
        rm -f "$PID_FILE"
    fi
fi

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Change to project root
cd "$PROJECT_ROOT"

echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo -e "${BLUE}📁 Validator directory: $VALIDATOR_DIR${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed or not in PATH${NC}"
    exit 1
fi

# Verify test commands exist
echo -e "${BLUE}🔍 Verifying test commands...${NC}"

if ! npm run test --dry-run > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  'npm run test' command may not be properly configured${NC}"
fi

if ! npm run lint --dry-run > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  'npm run lint' command may not be properly configured${NC}"
fi

if ! npm run typecheck --dry-run > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  'npm run typecheck' command may not be properly configured${NC}"
fi

echo -e "${GREEN}✅ Environment checks completed${NC}"

# Start the validator
echo -e "${BLUE}🚀 Starting Test Validator...${NC}"

# Run in background and capture PID
nohup node "$SCRIPT_DIR/test-validator.js" > "$LOG_FILE" 2>&1 &
VALIDATOR_PID=$!

# Save PID to file
echo $VALIDATOR_PID > "$PID_FILE"

# Wait a moment to see if it started successfully
sleep 2

if ps -p $VALIDATOR_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test Validator started successfully${NC}"
    echo -e "${GREEN}📋 Process ID: $VALIDATOR_PID${NC}"
    echo -e "${GREEN}📄 Log file: $LOG_FILE${NC}"
    echo -e "${GREEN}📁 Results directory: $VALIDATOR_DIR/results${NC}"
    echo ""
    echo -e "${BLUE}📊 Monitoring Configuration:${NC}"
    echo "  • Memory path: memory/"
    echo "  • Poll interval: 10 seconds"
    echo "  • Test commands: npm run test, npm run lint, npm run typecheck"
    echo "  • Results storage: swarm-auto-centralized-1750414726442/test-validator/results"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "  • View logs: tail -f $LOG_FILE"
    echo "  • Check status: ./status-validator.sh"
    echo "  • Stop validator: ./stop-validator.sh"
    echo ""
    echo -e "${GREEN}🎯 Test Validator is now monitoring for agent commits!${NC}"
else
    echo -e "${RED}❌ Failed to start Test Validator${NC}"
    echo "Check the log file for details: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi