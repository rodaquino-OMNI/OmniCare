/**
 * Global Setup for Backend Tests
 * Initializes test environment before all tests run
 */

// Register tsconfig paths before any other imports
import { readFileSync } from 'fs';
import { join } from 'path';

import { register } from 'tsconfig-paths';


// Load tsconfig.test.json and register paths
const tsconfigPath = join(__dirname, '..', 'tsconfig.test.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
register({
  baseUrl: join(__dirname, '..'),
  paths: tsconfig.compilerOptions.paths,
});

import { config } from 'dotenv';

import { execSync } from 'child_process';

// Load test environment variables first
config({ path: join(__dirname, '..', '..', '.env.test') }); // Root .env.test
config({ path: join(__dirname, '..', '.env.test') }); // Backend .env.test

// Import database service after env vars are loaded
import { databaseService } from '@/services/database.service';

// Function to check if Docker is available
function isDockerAvailable(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    execSync('docker compose version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to check if Docker containers are running
function areDockerContainersRunning(): boolean {
  try {
    const result = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
    const runningContainers = result.split('\n').filter(Boolean);
    const requiredContainers = ['omnicare-test-db', 'omnicare-test-redis'];
    return requiredContainers.every(container => 
      runningContainers.some(running => running.includes(container))
    );
  } catch (error) {
    return false;
  }
}

export default async function globalSetup() {
  
  // Set up test environment variables first
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Check Docker availability
  const dockerAvailable = isDockerAvailable();
  const containersRunning = dockerAvailable && areDockerContainersRunning();
  
  // Set Docker availability in environment
  process.env.DOCKER_AVAILABLE = dockerAvailable ? 'true' : 'false';
  process.env.DOCKER_CONTAINERS_RUNNING = containersRunning ? 'true' : 'false';
  
  // Check if we're running integration tests
  const isIntegrationTest = process.env.TEST_CATEGORY === 'integration' || 
    process.argv.some(arg => arg.includes('integration'));
  
  if (!isIntegrationTest) {
    // Always use mocked database services for unit tests to avoid external dependencies
    console.log('🧪 Setting up mocked database services for unit tests...');
    
    // Mock the database service for tests that don't need a real database
    const mockDB = {
      query: () => Promise.resolve({ rows: [], rowCount: 0 }),
      initialize: () => Promise.resolve(undefined),
      shutdown: () => Promise.resolve(undefined),
      ensureAuditSchema: () => Promise.resolve(undefined),
      checkHealth: () => Promise.resolve({ 
        status: 'healthy' as const, 
        latency: 0, 
        activeConnections: 0, 
        idleConnections: 0, 
        totalConnections: 0, 
        message: 'Mocked for tests' 
      }),
      getPoolStats: () => ({ total: 0, idle: 0, waiting: 0 }),
      
      // Additional methods that might be called
      executeTransaction: () => Promise.resolve(undefined),
      getPool: () => ({
        query: () => Promise.resolve({ rows: [], rowCount: 0 }),
        connect: () => Promise.resolve({
          query: () => Promise.resolve({ rows: [], rowCount: 0 }),
          release: () => {},
        }),
        end: () => Promise.resolve(undefined),
        on: () => {},
        removeAllListeners: () => {},
      }),
      transaction: (callback: any) => callback({
        query: () => Promise.resolve({ rows: [], rowCount: 0 }),
        release: () => {},
      }),
      transactionWithCheckpoints: () => Promise.resolve(undefined),
      getClient: () => Promise.resolve({
        query: () => Promise.resolve({ rows: [], rowCount: 0 }),
        release: () => {},
      }),
    };
    
    // Replace the actual service with mocked version
    Object.assign(databaseService, mockDB);
    
    // Set up process environment for consistent testing
    process.env.MOCK_DATABASE = 'true';
    
    console.log('✅ Mocked database services setup complete');
  } else {
    // For integration tests, check Docker availability
    console.log('🔍 Checking Docker availability for integration tests...');
    
    if (!dockerAvailable) {
      console.warn('⚠️ Docker is not available. Integration tests requiring Docker will be skipped.');
      console.warn('   To run integration tests, please install Docker and Docker Compose.');
      process.env.SKIP_DOCKER_TESTS = 'true';
      process.env.MOCK_DATABASE = 'true';
      process.env.MOCK_EXTERNAL_SERVICES = 'true';
      
      // Set up mocked services for integration tests without Docker
      console.log('📦 Using mocked services for integration tests (Docker not available)');
      
      // Set up basic mock methods for database service
      if (databaseService && typeof databaseService === 'object') {
        Object.assign(databaseService, {
          connect: async () => {},
          disconnect: async () => {},
          cleanup: async () => {},
          query: async () => ({ rows: [] })
        });
      }
    } else if (!containersRunning) {
      console.warn('⚠️ Docker containers are not running. Integration tests may fail.');
      console.warn('   Run "docker compose -f docker-compose.test.yml up -d" to start test containers.');
      process.env.SKIP_DOCKER_TESTS = 'true';
      process.env.MOCK_DATABASE = 'true';
      process.env.MOCK_EXTERNAL_SERVICES = 'true';
      
      // Set up mocked services when containers aren't running
      console.log('📦 Using mocked services for integration tests (containers not running)');
      
      // Set up basic mock methods for database service
      if (databaseService && typeof databaseService === 'object') {
        Object.assign(databaseService, {
          connect: async () => {},
          disconnect: async () => {},
          cleanup: async () => {},
          query: async () => ({ rows: [] })
        });
      }
    } else {
      console.log('✅ Docker is available and containers are running');
      process.env.SKIP_DOCKER_TESTS = 'false';
      process.env.MOCK_DATABASE = 'false';
      process.env.MOCK_EXTERNAL_SERVICES = 'false';
      
      // Ensure database URL is set for integration tests
      if (!process.env.DATABASE_URL && process.env.TEST_DATABASE_URL) {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      }
      
      console.log('🔗 Using real database connection for integration tests');
    }
  }
}