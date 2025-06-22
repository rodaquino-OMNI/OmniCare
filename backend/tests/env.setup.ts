/**
 * Environment Setup for Backend Tests
 * Configures test environment variables and global settings
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '..', '.env.test') });

// Set required test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.TZ = 'UTC';

// Database configuration for tests
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'omnicare_test';
process.env.DB_USER = process.env.TEST_DB_USER || 'test_user';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'test_password';

// Redis configuration for tests
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.REDIS_TTL = '300';

// JWT configuration for tests
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test_jwt_secret_key_for_testing_only_do_not_use_in_production';
process.env.JWT_EXPIRATION = '24h';
process.env.JWT_REFRESH_EXPIRATION = '7d';

// FHIR/Medplum configuration for tests
process.env.MEDPLUM_BASE_URL = process.env.TEST_MEDPLUM_BASE_URL || 'https://api.medplum.com/';
process.env.MEDPLUM_CLIENT_ID = process.env.TEST_MEDPLUM_CLIENT_ID || 'test_client_id';
process.env.MEDPLUM_CLIENT_SECRET = process.env.TEST_MEDPLUM_CLIENT_SECRET || 'test_client_secret';
process.env.MEDPLUM_PROJECT_ID = process.env.TEST_MEDPLUM_PROJECT_ID || 'test_project_id';

// External service configuration for tests
process.env.EPIC_FHIR_BASE_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/';
process.env.CERNER_FHIR_BASE_URL = 'https://fhir-open.cerner.com/r4/';

// Security configuration for tests
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters_';
process.env.SESSION_SECRET = 'test_session_secret_for_testing_only';
process.env.BCRYPT_ROUNDS = '1'; // Use minimal rounds for faster tests

// Feature flags for tests
process.env.ENABLE_AUDIT_LOGGING = 'true';
process.env.ENABLE_RATE_LIMITING = 'false';
process.env.ENABLE_CACHING = 'true';
process.env.ENABLE_OFFLINE_MODE = 'true';

// Test-specific settings
process.env.TEST_TIMEOUT = '15000';
process.env.TEST_PARALLEL_WORKERS = '2';

// Suppress specific warnings in test environment
process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';

// Mock external service endpoints
process.env.MOCK_EXTERNAL_SERVICES = 'true';

// Performance settings for tests
process.env.MAX_POOL_SIZE = '5';
process.env.CONNECTION_TIMEOUT = '5000';
process.env.IDLE_TIMEOUT = '10000';

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
    externalServices: true,
    database: false, // Use real test database
    cache: false, // Use real test cache
  },
};

export {};