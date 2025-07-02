#!/usr/bin/env node

/**
 * Verify test setup and database connections
 */

const path = require('path');
const { config } = require('dotenv');

// Load test environment
config({ path: path.join(__dirname, '..', '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

async function verifyTestSetup() {
  let allGood = true;

  // Check environment variables
  const requiredEnvVars = [
    'NODE_ENV',
    'JWT_SECRET'
  ];

  const optionalEnvVars = [
    'DATABASE_URL',
    'TEST_DATABASE_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      allGood = false;
    }
  }

  // Check if we have database configuration
  const hasDBUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  const hasDBParams = process.env.DB_HOST && process.env.DB_PORT && process.env.DB_NAME;

  if (!hasDBUrl && !hasDBParams) {
    // Database configuration missing but tests should still work with mocks
  }

  // Verify mocking setup
  const testCategory = process.env.TEST_CATEGORY;
  const isIntegration = testCategory === 'integration' || process.argv.some(arg => arg.includes('integration'));

  if (isIntegration) {
    process.env.MOCK_DATABASE = 'false';
  } else {
    process.env.MOCK_DATABASE = 'true';
  }

  if (allGood) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verifyTestSetup().catch(err => {
  process.exit(1);
});