/**
 * Global Test Setup for Backend
 * Runs once before all tests start
 */

import logger from '../src/utils/logger';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting backend test environment setup...');

  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB_SETUP = 'true';
    process.env.SKIP_CACHE_SETUP = 'true';

    // Setup test data
    await setupTestData();

    // Initialize external service mocks
    await setupExternalServiceMocks();

    console.log('✅ Backend test environment setup completed successfully');
  } catch (error) {
    console.error('❌ Failed to setup backend test environment:', error);
    // Don't exit process - let tests handle missing dependencies gracefully
  }
}

async function setupTestData(): Promise<void> {
  try {
    console.log('📝 Setting up test data...');

    // Create test users, roles, and permissions
    const testData = {
      users: [
        {
          id: 'test-user-doctor',
          email: 'doctor@test.com',
          role: 'physician',
          active: true,
        },
        {
          id: 'test-user-nurse',
          email: 'nurse@test.com',
          role: 'nurse',
          active: true,
        },
        {
          id: 'test-user-admin',
          email: 'admin@test.com',
          role: 'admin',
          active: true,
        },
      ],
      patients: [
        {
          id: 'test-patient-1',
          name: 'John Doe',
          mrn: 'MRN001',
          active: true,
        },
        {
          id: 'test-patient-2',
          name: 'Jane Smith',
          mrn: 'MRN002',
          active: true,
        },
      ],
    };

    // Store test data globally for tests to use
    (global as any).testData = testData;

    console.log('✅ Test data setup completed');
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
  }
}

async function setupExternalServiceMocks(): Promise<void> {
  try {
    console.log('🎭 Setting up external service mocks...');

    // Set mock external services flag
    process.env.MOCK_EXTERNAL_SERVICES = 'true';

    // Setup mock endpoints
    const externalMocks = {
      medplum: {
        baseUrl: 'http://localhost:8080',
        endpoints: ['/auth/login', '/fhir/R4/Patient', '/fhir/R4/Encounter', '/fhir/R4/Observation'],
      },
      smartFhir: {
        authorizationServer: 'http://localhost:8081',
        tokenEndpoint: '/oauth2/token',
        userInfoEndpoint: '/oauth2/userinfo',
      },
      directTrust: {
        endpoint: 'http://localhost:8082/direct',
        certificate: 'test-certificate',
      },
    };

    (global as any).externalMocks = externalMocks;

    console.log('✅ External service mocks setup completed');
  } catch (error) {
    console.error('❌ Failed to setup external service mocks:', error);
  }
}