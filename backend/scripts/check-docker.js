#!/usr/bin/env node

/**
 * Check Docker availability and test container status
 * This script helps ensure the test environment is ready
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
    log(`✅ Docker installed: ${dockerVersion}`, colors.green);
    return true;
  } catch (error) {
    log('❌ Docker is not installed or not in PATH', colors.red);
    log('   Please install Docker from https://docker.com', colors.yellow);
    return false;
  }
}

function checkDockerComposeInstalled() {
  try {
    // Try both 'docker compose' (v2) and 'docker-compose' (v1)
    let composeVersion;
    try {
      composeVersion = execSync('docker compose version', { encoding: 'utf8' }).trim();
    } catch {
      composeVersion = execSync('docker-compose version', { encoding: 'utf8' }).trim();
    }
    log(`✅ Docker Compose installed: ${composeVersion}`, colors.green);
    return true;
  } catch (error) {
    log('❌ Docker Compose is not installed', colors.red);
    log('   Docker Desktop includes Docker Compose', colors.yellow);
    return false;
  }
}

function checkDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    log('✅ Docker daemon is running', colors.green);
    return true;
  } catch (error) {
    log('❌ Docker daemon is not running', colors.red);
    log('   Please start Docker Desktop or the Docker service', colors.yellow);
    return false;
  }
}

function getRunningContainers() {
  try {
    const result = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
    return result.split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

function checkTestContainers() {
  const runningContainers = getRunningContainers();
  const requiredContainers = [
    { name: 'omnicare-test-db', port: '5433' },
    { name: 'omnicare-test-redis', port: '6380' },
  ];
  
  let allRunning = true;
  
  log('\n📦 Checking test containers:', colors.blue);
  
  for (const container of requiredContainers) {
    const isRunning = runningContainers.some(c => c.includes(container.name));
    if (isRunning) {
      log(`  ✅ ${container.name} (port ${container.port}) is running`, colors.green);
    } else {
      log(`  ❌ ${container.name} (port ${container.port}) is not running`, colors.red);
      allRunning = false;
    }
  }
  
  return allRunning;
}

function checkPortAvailability() {
  const ports = [
    { port: 5433, service: 'PostgreSQL (test)' },
    { port: 6380, service: 'Redis (test)' },
  ];
  
  log('\n🔌 Checking port availability:', colors.blue);
  
  let allAvailable = true;
  
  for (const { port, service } of ports) {
    try {
      // Check if port is in use using netstat or lsof
      const isInUse = checkPortInUse(port);
      if (isInUse) {
        log(`  ⚠️  Port ${port} (${service}) is in use`, colors.yellow);
        allAvailable = false;
      } else {
        log(`  ✅ Port ${port} (${service}) is available`, colors.green);
      }
    } catch (error) {
      log(`  ⚠️  Could not check port ${port} (${service})`, colors.yellow);
    }
  }
  
  return allAvailable;
}

function checkPortInUse(port) {
  try {
    // Try lsof first (macOS/Linux)
    execSync(`lsof -i :${port}`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      // Try netstat as fallback
      const result = execSync(`netstat -an | grep -E "[:.]${port}.*LISTEN"`, { encoding: 'utf8' });
      return result.length > 0;
    } catch {
      return false;
    }
  }
}

function updateEnvFile(dockerAvailable, containersRunning) {
  const envPath = path.join(__dirname, '..', '.env.test');
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update DOCKER_AVAILABLE
    envContent = envContent.replace(
      /^DOCKER_AVAILABLE=.*/m,
      `DOCKER_AVAILABLE=${dockerAvailable}`
    );
    
    // Update SKIP_DOCKER_TESTS
    const skipTests = !dockerAvailable || !containersRunning;
    envContent = envContent.replace(
      /^SKIP_DOCKER_TESTS=.*/m,
      `SKIP_DOCKER_TESTS=${skipTests}`
    );
    
    fs.writeFileSync(envPath, envContent);
    log(`\n✅ Updated ${envPath}`, colors.green);
  } catch (error) {
    log(`\n⚠️  Could not update ${envPath}: ${error.message}`, colors.yellow);
  }
}

function main() {
  log('🐳 Docker Environment Check\n', colors.blue);
  
  const dockerInstalled = checkDockerInstalled();
  if (!dockerInstalled) {
    updateEnvFile(false, false);
    process.exit(1);
  }
  
  const composeInstalled = checkDockerComposeInstalled();
  if (!composeInstalled) {
    updateEnvFile(false, false);
    process.exit(1);
  }
  
  const dockerRunning = checkDockerRunning();
  if (!dockerRunning) {
    updateEnvFile(true, false);
    process.exit(1);
  }
  
  const containersRunning = checkTestContainers();
  checkPortAvailability();
  
  updateEnvFile(true, containersRunning);
  
  if (!containersRunning) {
    log('\n📋 To start test containers, run:', colors.yellow);
    log('   cd backend && docker compose -f docker/docker-compose.yml up -d', colors.blue);
    log('   or', colors.yellow);
    log('   npm run docker:test:up', colors.blue);
    process.exit(1);
  }
  
  log('\n✨ Docker environment is ready for testing!', colors.green);
  process.exit(0);
}

// Run the checks
main();