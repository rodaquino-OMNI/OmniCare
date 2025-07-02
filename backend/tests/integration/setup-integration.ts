/**
 * Integration Test Setup
 * Sets up real services for integration testing
 */

import { join } from 'path';

import { config } from 'dotenv';

import { databaseService } from '../../src/services/database.service';

// Load test environment variables
config({ path: join(__dirname, '..', '..', '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Database configuration for integration tests
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// JWT configuration for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_key_for_testing_only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_key_for_testing_only';
process.env.JWT_EXPIRATION = '1h';
process.env.JWT_REFRESH_EXPIRATION = '7d';

// FHIR configuration for tests
process.env.FHIR_BASE_URL = 'https://test-fhir.omnicare.com';

/**
 * Initialize test database
 */
export async function setupTestDatabase() {
  // Only initialize real database for integration tests
  if (process.env.MOCK_DATABASE !== 'true') {
    // Initialize database connection
    await databaseService.initialize();
    
    // Ensure schemas exist
    await databaseService.ensureAuditSchema();
    
    // Create test tables if needed
    await createTestTables();
    
    // Clear test data
    await clearTestData();
  }
  
  return true;
}

/**
 * Create test tables
 */
async function createTestTables() {
  // Create users table for internal auth testing
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      role VARCHAR(50) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sessions table
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create audit logs table
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS audit.security_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      event_type VARCHAR(100) NOT NULL,
      user_id UUID,
      ip_address VARCHAR(45),
      user_agent TEXT,
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create client applications table for OAuth testing
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id VARCHAR(255) PRIMARY KEY,
      client_secret VARCHAR(255),
      redirect_uris TEXT[],
      allowed_scopes TEXT[],
      client_name VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Clear test data
 */
async function clearTestData() {
  await databaseService.query('TRUNCATE TABLE users CASCADE');
  await databaseService.query('TRUNCATE TABLE sessions CASCADE');
  await databaseService.query('TRUNCATE TABLE audit.security_logs CASCADE');
  await databaseService.query('TRUNCATE TABLE oauth_clients CASCADE');
}

/**
 * Insert test data
 */
export async function insertTestData() {
  // Insert test users
  await databaseService.query(`
    INSERT INTO users (username, email, password_hash, first_name, last_name, role)
    VALUES 
      ('admin@omnicare.com', 'admin@omnicare.com', '$2b$10$YourHashedPasswordHere', 'Admin', 'User', 'SYSTEM_ADMINISTRATOR'),
      ('doctor@omnicare.com', 'doctor@omnicare.com', '$2b$10$YourHashedPasswordHere', 'Jane', 'Smith', 'PHYSICIAN')
    ON CONFLICT (username) DO NOTHING
  `);

  // Insert test OAuth clients
  await databaseService.query(`
    INSERT INTO oauth_clients (client_id, client_secret, redirect_uris, allowed_scopes, client_name)
    VALUES 
      ('test-client', 'test-secret', ARRAY['https://app.example.com/callback'], ARRAY['patient/*.read', 'user/*.read'], 'Test Client'),
      ('omnicare-client', 'omnicare-secret', ARRAY['https://omnicare.com/callback'], ARRAY['system/*.read'], 'OmniCare System Client')
    ON CONFLICT (client_id) DO NOTHING
  `);
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase() {
  try {
    if (process.env.MOCK_DATABASE !== 'true') {
      await clearTestData();
      await databaseService.shutdown();
    }
  } catch {
    // Silently ignore teardown errors to prevent test failures
  }
}

// Export test utilities
export const testUtils = {
  setupTestDatabase,
  teardownTestDatabase,
  insertTestData,
  clearTestData,
};