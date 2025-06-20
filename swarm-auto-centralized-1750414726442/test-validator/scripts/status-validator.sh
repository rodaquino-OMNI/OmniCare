#!/bin/bash

# OmniCare Test Validator Status Script
# Shows current status and recent activity

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$VALIDATOR_DIR/validator.pid"
LOG_FILE="$VALIDATOR_DIR/logs/validator.log"
RESULTS_DIR="$VALIDATOR_DIR/results"
LATEST_RESULTS="$RESULTS_DIR/latest-results.json"
CURRENT_ALERT="$RESULTS_DIR/current-alert.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 OmniCare Test Validator Status${NC}"
echo "=================================="

# Check if validator is running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Status: RUNNING${NC}"
        echo -e "${GREEN}📋 Process ID: $PID${NC}"
        
        # Get process info
        PROCESS_INFO=$(ps -p $PID -o pid,ppid,cmd,etime,pcpu,pmem --no-headers)
        echo -e "${BLUE}🔍 Process Info:${NC}"
        echo "  $PROCESS_INFO"
    else
        echo -e "${RED}❌ Status: STOPPED (stale PID file)${NC}"
        echo -e "${YELLOW}⚠️  Stale PID file found: $PID_FILE${NC}"
    fi
else
    echo -e "${RED}❌ Status: STOPPED${NC}"
    echo -e "${YELLOW}⚠️  No PID file found${NC}"
fi

echo ""

# Check log file
if [ -f "$LOG_FILE" ]; then
    echo -e "${BLUE}📄 Log File: $LOG_FILE${NC}"
    LOG_SIZE=$(du -h "$LOG_FILE" | cut -f1)
    echo -e "${CYAN}📏 Size: $LOG_SIZE${NC}"
    
    echo -e "${BLUE}📰 Recent Log Entries (last 10 lines):${NC}"
    echo "----------------------------------------"
    tail -10 "$LOG_FILE" 2>/dev/null || echo "No log entries found"
    echo ""
else
    echo -e "${YELLOW}⚠️  No log file found: $LOG_FILE${NC}"
    echo ""
fi

# Check latest results
if [ -f "$LATEST_RESULTS" ]; then
    echo -e "${BLUE}📋 Latest Test Results:${NC}"
    echo "======================="
    
    if command -v jq &> /dev/null; then
        # Use jq for nice formatting if available
        LAST_RUN=$(jq -r '.lastRun // "N/A"' "$LATEST_RESULTS")
        TIMESTAMP=$(jq -r '.timestamp // "N/A"' "$LATEST_RESULTS")
        STATUS=$(jq -r '.status // "N/A"' "$LATEST_RESULTS")
        DURATION=$(jq -r '.duration // 0' "$LATEST_RESULTS")
        PASSED=$(jq -r '.summary.passed // 0' "$LATEST_RESULTS")
        FAILED=$(jq -r '.summary.failed // 0' "$LATEST_RESULTS")
        ERRORS=$(jq -r '.summary.errors // 0' "$LATEST_RESULTS")
        COMMITS=$(jq -r '.commits // 0' "$LATEST_RESULTS")
        AGENTS=$(jq -r '.agents | join(", ") // "N/A"' "$LATEST_RESULTS")
        
        echo -e "${CYAN}🆔 Run ID: $LAST_RUN${NC}"
        echo -e "${CYAN}⏰ Timestamp: $TIMESTAMP${NC}"
        
        if [ "$STATUS" = "passed" ]; then
            echo -e "${GREEN}✅ Status: $STATUS${NC}"
        else
            echo -e "${RED}❌ Status: $STATUS${NC}"
        fi
        
        echo -e "${CYAN}⏱️  Duration: ${DURATION}ms${NC}"
        echo -e "${CYAN}📝 Commits tested: $COMMITS${NC}"
        echo -e "${CYAN}🤖 Agents: $AGENTS${NC}"
        echo -e "${CYAN}📊 Test Results:${NC}"
        echo -e "  ${GREEN}✅ Passed: $PASSED${NC}"
        echo -e "  ${RED}❌ Failed: $FAILED${NC}"
        echo -e "  ${YELLOW}💥 Errors: $ERRORS${NC}"
    else
        # Fallback without jq
        echo "$(cat "$LATEST_RESULTS")"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  No test results found yet${NC}"
    echo ""
fi

# Check for current alerts
if [ -f "$CURRENT_ALERT" ]; then
    echo -e "${RED}🚨 CURRENT ALERT:${NC}"
    echo "=================="
    
    if command -v jq &> /dev/null; then
        MESSAGE=$(jq -r '.message // "Alert message not available"' "$CURRENT_ALERT")
        AGENTS=$(jq -r '.affectedAgents | join(", ") // "N/A"' "$CURRENT_ALERT")
        TIMESTAMP=$(jq -r '.timestamp // "N/A"' "$CURRENT_ALERT")
        
        echo -e "${RED}⚠️  $MESSAGE${NC}"
        echo -e "${RED}🤖 Affected Agents: $AGENTS${NC}"
        echo -e "${RED}⏰ Alert Time: $TIMESTAMP${NC}"
    else
        echo "$(cat "$CURRENT_ALERT")"
    fi
    echo ""
fi

# Directory information
echo -e "${BLUE}📁 Directory Information:${NC}"
echo "========================="
echo -e "${CYAN}📂 Validator Directory: $VALIDATOR_DIR${NC}"
echo -e "${CYAN}📊 Results Directory: $RESULTS_DIR${NC}"
echo -e "${CYAN}📄 Logs Directory: $VALIDATOR_DIR/logs${NC}"

if [ -d "$RESULTS_DIR" ]; then
    RESULT_COUNT=$(find "$RESULTS_DIR" -name "test-run-*.json" | wc -l)
    echo -e "${CYAN}📈 Total Test Runs: $RESULT_COUNT${NC}"
fi

echo ""

# Configuration info
echo -e "${BLUE}⚙️  Configuration:${NC}"
echo "================"
echo -e "${CYAN}🔄 Poll Interval: 10 seconds${NC}"
echo -e "${CYAN}🧪 Test Commands: npm run test, npm run lint, npm run typecheck${NC}"
echo -e "${CYAN}👀 Monitoring: memory/ directory for agent commits${NC}"

echo ""

# Management commands
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "======================"
echo -e "${CYAN}▶️  Start: ./start-validator.sh${NC}"
echo -e "${CYAN}⏹️  Stop: ./stop-validator.sh${NC}"
echo -e "${CYAN}📊 Status: ./status-validator.sh${NC}"
echo -e "${CYAN}📄 View logs: tail -f $LOG_FILE${NC}"