/**
 * Environment Setup for Backend Tests
 * Configures test environment variables and global settings
 */

import { join } from 'path';

import { config } from 'dotenv';

// Declare global types
declare global {
  var testConfig: {
    timeouts: {
      unit: number;
      integration: number;
      e2e: number;
    };
    retries: {
      unit: number;
      integration: number;
      e2e: number;
    };
    cleanup: {
      database: boolean;
      cache: boolean;
      temp?: boolean;
      files?: boolean;
    };
    mocking?: {
      externalServices: boolean;
      database: boolean;
      cache: boolean;
    };
  };
}

// Load test environment variables from both root and backend .env.test files
config({ path: join(__dirname, '..', '..', '.env.test') }); // Root .env.test
config({ path: join(__dirname, '..', '.env.test') }); // Backend .env.test (overrides)

// Set required test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.TZ = 'UTC';

// Determine test type and set mocking accordingly
const isIntegrationTest = process.env.TEST_CATEGORY === 'integration' || 
  process.argv.some(arg => arg.includes('integration'));

// Set database mocking based on test type
if (!isIntegrationTest) {
  process.env.MOCK_DATABASE = 'true';
  process.env.MOCK_EXTERNAL_SERVICES = 'true';
} else {
  // For integration tests, check if Docker is available
  process.env.MOCK_DATABASE = process.env.SKIP_DOCKER_TESTS === 'true' ? 'true' : 'false';
}

// Database configuration - no need to reconstruct, use from .env.test
if (!process.env.DATABASE_URL && process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Ensure all required environment variables are set from .env.test
const requiredEnvVars = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'REDIS_URL', 'JWT_SECRET', 'JWT_EXPIRATION', 'JWT_REFRESH_EXPIRATION',
  'MEDPLUM_BASE_URL', 'MEDPLUM_CLIENT_ID', 'MEDPLUM_CLIENT_SECRET',
  'ENCRYPTION_KEY', 'SESSION_SECRET', 'BCRYPT_ROUNDS'
];

// Log missing env vars in debug mode
if (process.env.DEBUG_ENV === 'true') {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.warn('Missing environment variables:', missingVars);
  }
}

// Suppress specific warnings in test environment
process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';

// Set locale for consistent test results
process.env.LANG = 'en_US.UTF-8';
process.env.LC_ALL = 'en_US.UTF-8';

// Disable telemetry in tests
process.env.DISABLE_TELEMETRY = 'true';
process.env.CI = process.env.CI || 'false';

// Console configuration for tests
if (process.env.SILENT_TESTS !== 'false') {
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    log: () => {},
    info: () => {},
    warn: () => {},
    error: originalConsole.error, // Keep errors visible
    debug: () => {},
  };
}

// Global test configuration
global.testConfig = {
  timeouts: {
    unit: 5000,
    integration: 15000,
    e2e: 30000,
  },
  retries: {
    unit: 0,
    integration: 1,
    e2e: 2,
  },
  cleanup: {
    database: true,
    cache: true,
    files: true,
  },
  mocking: {
    externalServices: process.env.MOCK_EXTERNAL_SERVICES === 'true',
    database: process.env.MOCK_DATABASE === 'true',
    cache: process.env.MOCK_CACHE !== 'false',
  },
};

export {};