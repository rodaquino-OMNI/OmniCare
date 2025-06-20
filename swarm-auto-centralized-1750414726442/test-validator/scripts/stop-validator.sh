#!/bin/bash

# OmniCare Test Validator Stop Script
# Stops the comprehensive testing system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$VALIDATOR_DIR/validator.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 OmniCare Test Validator Stop${NC}"
echo "==============================="

# Check if PID file exists
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  No PID file found. Test Validator may not be running.${NC}"
    exit 0
fi

# Read PID
PID=$(cat "$PID_FILE")

# Check if process is running
if ! ps -p $PID > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Process with PID $PID is not running.${NC}"
    echo "Removing stale PID file..."
    rm -f "$PID_FILE"
    exit 0
fi

echo -e "${BLUE}🔍 Found Test Validator process (PID: $PID)${NC}"

# Attempt graceful shutdown first
echo -e "${BLUE}🤝 Attempting graceful shutdown...${NC}"
kill -TERM $PID

# Wait for process to terminate
TIMEOUT=30
COUNTER=0

while [ $COUNTER -lt $TIMEOUT ]; do
    if ! ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Test Validator stopped gracefully${NC}"
        rm -f "$PID_FILE"
        exit 0
    fi
    
    sleep 1
    COUNTER=$((COUNTER + 1))
    
    if [ $((COUNTER % 5)) -eq 0 ]; then
        echo -e "${YELLOW}⏳ Waiting for graceful shutdown... ($COUNTER/$TIMEOUT seconds)${NC}"
    fi
done

# Force kill if still running
echo -e "${YELLOW}⚠️  Graceful shutdown timeout. Force killing process...${NC}"
kill -KILL $PID

# Wait a moment and verify
sleep 2

if ps -p $PID > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to stop Test Validator process${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Test Validator stopped (force killed)${NC}"
    rm -f "$PID_FILE"
fi