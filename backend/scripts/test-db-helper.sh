#!/bin/bash

# Unified test database helper script
# Provides a user-friendly interface for managing the test database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to display header
show_header() {
    clear
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  🏥  ${CYAN}OmniCare Test Database Helper${NC}  🏥  ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to check Docker status
check_docker_status() {
    if "$SCRIPT_DIR/check-docker.sh" >/dev/null 2>&1; then
        echo -e "Docker Status: ${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "Docker Status: ${RED}✗ Not Running${NC}"
        return 1
    fi
}

# Function to check database status
check_db_status() {
    if docker ps 2>/dev/null | grep -q "postgres.*5433\|omnicare.*test.*postgres"; then
        echo -e "Test Database: ${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "Test Database: ${YELLOW}○ Not Running${NC}"
        return 1
    fi
}

# Function to show current status
show_status() {
    echo -e "${MAGENTA}Current Status:${NC}"
    echo "──────────────────────────────"
    check_docker_status
    check_db_status
    echo ""
}

# Function to run environment check
run_env_check() {
    echo -e "${YELLOW}Running environment check...${NC}\n"
    "$SCRIPT_DIR/pre-test-check.sh"
    echo -e "\n${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to start database
start_database() {
    echo -e "${YELLOW}Starting test database...${NC}\n"
    "$SCRIPT_DIR/setup-test-db.sh" start
    echo -e "\n${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to stop database
stop_database() {
    echo -e "${YELLOW}Stopping test database...${NC}\n"
    "$SCRIPT_DIR/setup-test-db.sh" stop
    echo -e "\n${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to test connection
test_connection() {
    echo -e "${YELLOW}Testing database connection...${NC}\n"
    cd "$SCRIPT_DIR/.." && npm run db:test
    echo -e "\n${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to view logs
view_logs() {
    echo -e "${YELLOW}Database logs (last 50 lines):${NC}\n"
    "$SCRIPT_DIR/setup-test-db.sh" logs
    echo -e "\n${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to run quick diagnostics
run_diagnostics() {
    show_header
    echo -e "${MAGENTA}Quick Diagnostics${NC}"
    echo "════════════════════════════════════"
    
    # Docker check
    echo -e "\n${CYAN}1. Docker Status:${NC}"
    if docker --version >/dev/null 2>&1; then
        echo -e "   ${GREEN}✓${NC} Docker installed: $(docker --version)"
        if docker ps >/dev/null 2>&1; then
            echo -e "   ${GREEN}✓${NC} Docker daemon running"
            echo -e "   ${GREEN}✓${NC} User has Docker permissions"
        else
            echo -e "   ${RED}✗${NC} Docker daemon not running or permission denied"
        fi
    else
        echo -e "   ${RED}✗${NC} Docker not installed"
    fi
    
    # Database check
    echo -e "\n${CYAN}2. Test Database:${NC}"
    if docker ps 2>/dev/null | grep -q postgres; then
        echo -e "   ${GREEN}✓${NC} PostgreSQL container running"
        POSTGRES_PORT=$(docker ps | grep postgres | grep -oE '0.0.0.0:[0-9]+->5432' | cut -d: -f2 | cut -d- -f1)
        echo -e "   ${BLUE}ℹ${NC}  Port: ${POSTGRES_PORT:-unknown}"
    else
        echo -e "   ${YELLOW}○${NC} PostgreSQL container not running"
    fi
    
    if docker ps 2>/dev/null | grep -q redis; then
        echo -e "   ${GREEN}✓${NC} Redis container running"
        REDIS_PORT=$(docker ps | grep redis | grep -oE '0.0.0.0:[0-9]+->6379' | cut -d: -f2 | cut -d- -f1)
        echo -e "   ${BLUE}ℹ${NC}  Port: ${REDIS_PORT:-unknown}"
    else
        echo -e "   ${YELLOW}○${NC} Redis container not running"
    fi
    
    # Environment check
    echo -e "\n${CYAN}3. Environment:${NC}"
    if [ -f "$SCRIPT_DIR/../.env" ] || [ -f "$SCRIPT_DIR/../.env.test" ]; then
        echo -e "   ${GREEN}✓${NC} Environment configuration found"
    else
        echo -e "   ${YELLOW}⚠${NC}  No .env file found (using defaults)"
    fi
    
    # Node.js check
    echo -e "\n${CYAN}4. Node.js:${NC}"
    if node --version >/dev/null 2>&1; then
        echo -e "   ${GREEN}✓${NC} Node.js installed: $(node --version)"
    else
        echo -e "   ${RED}✗${NC} Node.js not installed"
    fi
    
    echo -e "\n${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to show help
show_help() {
    show_header
    echo -e "${MAGENTA}Available Commands:${NC}"
    echo "──────────────────────────────"
    echo -e "${CYAN}1${NC} - Check Environment    ${GRAY}(Verify all prerequisites)${NC}"
    echo -e "${CYAN}2${NC} - Start Database       ${GRAY}(Start PostgreSQL & Redis)${NC}"
    echo -e "${CYAN}3${NC} - Stop Database        ${GRAY}(Stop all test services)${NC}"
    echo -e "${CYAN}4${NC} - Test Connection      ${GRAY}(Verify database connectivity)${NC}"
    echo -e "${CYAN}5${NC} - View Logs           ${GRAY}(Show service logs)${NC}"
    echo -e "${CYAN}6${NC} - Quick Diagnostics   ${GRAY}(Run diagnostic checks)${NC}"
    echo -e "${CYAN}7${NC} - Restart Database    ${GRAY}(Stop and start services)${NC}"
    echo -e "${CYAN}0${NC} - Exit"
    echo ""
}

# Main menu loop
while true; do
    show_header
    show_status
    show_help
    
    echo -n -e "${YELLOW}Choose an option [0-7]: ${NC}"
    read choice
    
    case $choice in
        1) run_env_check ;;
        2) start_database ;;
        3) stop_database ;;
        4) test_connection ;;
        5) view_logs ;;
        6) run_diagnostics ;;
        7) 
            stop_database
            start_database 
            ;;
        0) 
            echo -e "\n${GREEN}Goodbye!${NC}\n"
            exit 0 
            ;;
        *)
            echo -e "\n${RED}Invalid option. Please try again.${NC}"
            sleep 2
            ;;
    esac
done