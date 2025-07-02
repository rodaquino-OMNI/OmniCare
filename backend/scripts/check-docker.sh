#!/bin/bash

# Script to check if Docker is running and provide helpful error messages
# Used by other scripts to ensure Docker is available before proceeding

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Docker daemon status
check_docker_daemon() {
    if docker info >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to get OS-specific Docker start instructions
get_docker_start_instructions() {
    case "$(uname -s)" in
        Darwin*)
            echo "On macOS, you can start Docker Desktop by:"
            echo "  1. Opening Docker Desktop from Applications"
            echo "  2. Or running: open -a Docker"
            ;;
        Linux*)
            echo "On Linux, you can start Docker by:"
            echo "  1. Running: sudo systemctl start docker"
            echo "  2. Or: sudo service docker start"
            ;;
        MINGW*|CYGWIN*|MSYS*)
            echo "On Windows, you can start Docker Desktop by:"
            echo "  1. Opening Docker Desktop from Start Menu"
            echo "  2. Or searching for 'Docker Desktop' in Windows Search"
            ;;
        *)
            echo "Please start the Docker daemon according to your operating system."
            ;;
    esac
}

echo -e "${BLUE}🐳 Docker Status Check${NC}"
echo "======================="

# Check if Docker is installed
if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo ""
    echo "Please install Docker from https://www.docker.com/get-started"
    echo ""
    echo "Installation guides:"
    echo "  - macOS: https://docs.docker.com/desktop/install/mac-install/"
    echo "  - Linux: https://docs.docker.com/engine/install/"
    echo "  - Windows: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed${NC}"

# Check if docker-compose is installed
if ! command_exists docker-compose; then
    echo -e "${YELLOW}⚠️  docker-compose is not installed${NC}"
    echo ""
    echo "docker-compose is included with Docker Desktop on macOS and Windows."
    echo "On Linux, you may need to install it separately:"
    echo "  sudo apt-get install docker-compose  # Debian/Ubuntu"
    echo "  sudo yum install docker-compose      # RHEL/CentOS"
    echo ""
    echo "Or install via pip:"
    echo "  pip install docker-compose"
    echo ""
    echo "Note: Modern Docker versions include 'docker compose' (without hyphen) built-in."
    echo "You can use 'docker compose' instead of 'docker-compose' in most cases."
fi

# Check if Docker daemon is running
if ! check_docker_daemon; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo ""
    get_docker_start_instructions
    echo ""
    echo "After starting Docker, please wait a few seconds for it to fully initialize."
    exit 1
fi

echo -e "${GREEN}✅ Docker daemon is running${NC}"

# Check Docker version
DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
echo -e "${BLUE}📊 Docker version: ${DOCKER_VERSION}${NC}"

# Check if user has permission to run Docker
if ! docker ps >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Permission issue detected${NC}"
    echo ""
    echo "You may need to:"
    echo "  1. Add your user to the docker group:"
    echo "     sudo usermod -aG docker $USER"
    echo "  2. Log out and back in for changes to take effect"
    echo "  3. Or run commands with sudo (not recommended)"
    exit 1
fi

# Optional: Check available resources
if command_exists docker; then
    echo ""
    echo -e "${BLUE}📈 Docker Resources:${NC}"
    docker system df 2>/dev/null | head -4 || echo "Unable to get resource information"
fi

echo ""
echo -e "${GREEN}✅ All Docker checks passed!${NC}"
echo "Docker is properly installed and running."

exit 0