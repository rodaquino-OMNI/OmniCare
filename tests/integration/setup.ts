import { Pool } from 'pg';
import * as Redis from 'redis';
import { MedplumClient } from '@medplum/core';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Global test utilities
declare global {
  var testDb: Pool;
  var testRedis: any;
  var testMedplum: MedplumClient;
  var createMockPatient: () => any;
  var createMockPractitioner: () => any;
  var createMockEncounter: () => any;
  var createMockObservation: () => any;
  var cleanupTestData: () => Promise<void>;
}

// Initialize test database connection
global.testDb = new Pool({
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'omnicare_test',
  user: process.env.TEST_DB_USER || 'omnicare',
  password: process.env.TEST_DB_PASSWORD || 'omnicare123',
  max: 10,
});

// Initialize test Redis connection
global.testRedis = Redis.createClient({
  url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1', // Use database 1 for tests
});

// Initialize Medplum client for tests
global.testMedplum = new MedplumClient({
  baseUrl: process.env.TEST_MEDPLUM_URL || 'http://localhost:8103',
  clientId: process.env.TEST_MEDPLUM_CLIENT_ID || 'test-client',
  clientSecret: process.env.TEST_MEDPLUM_CLIENT_SECRET || 'test-secret',
});

// Mock data factories
global.createMockPatient = () => ({
  resourceType: 'Patient',
  id: `test-patient-${Date.now()}`,
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
  },
  identifier: [{
    system: 'http://omnicare.com/test-patients',
    value: `TEST-${Date.now()}`,
  }],
  active: true,
  name: [{
    use: 'official' as const,
    family: 'TestPatient',
    given: ['Integration', 'Test'],
  }],
  gender: 'male',
  birthDate: '1990-01-01',
  address: [{
    use: 'home' as const,
    line: ['123 Test Street'],
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
  }],
  telecom: [
    {
      system: 'phone',
      value: '555-0100',
      use: 'mobile' as const,
    },
    {
      system: 'email',
      value: 'test@example.com',
      use: 'home' as const,
    },
  ],
});

global.createMockPractitioner = () => ({
  resourceType: 'Practitioner',
  id: `test-practitioner-${Date.now()}`,
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
  },
  identifier: [{
    system: 'http://hl7.org/fhir/sid/us-npi',
    value: `9999${Date.now()}`.slice(-10),
  }],
  active: true,
  name: [{
    use: 'official' as const,
    family: 'TestDoctor',
    given: ['Integration', 'Test'],
    prefix: ['Dr.'],
  }],
  telecom: [{
    system: 'phone',
    value: '555-0200',
    use: 'work' as const,
  }],
  qualification: [{
    identifier: [{
      system: 'http://example.org/fhir/medical-license',
      value: 'TEST-LICENSE-123',
    }],
    code: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
        code: 'MD',
        display: 'Doctor of Medicine',
      }],
    },
  }],
});

global.createMockEncounter = () => ({
  resourceType: 'Encounter',
  id: `test-encounter-${Date.now()}`,
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
  },
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  },
  type: [{
    coding: [{
      system: 'http://snomed.info/sct',
      code: '308335008',
      display: 'Patient encounter procedure',
    }],
  }],
  priority: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
      code: 'R',
      display: 'routine',
    }],
  },
  subject: {
    reference: 'Patient/test-patient',
    display: 'Test Patient',
  },
  participant: [{
    type: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
        code: 'PPRF',
        display: 'primary performer',
      }],
    }],
    individual: {
      reference: 'Practitioner/test-practitioner',
      display: 'Dr. Test Doctor',
    },
  }],
  period: {
    start: new Date().toISOString(),
  },
});

global.createMockObservation = () => ({
  resourceType: 'Observation',
  id: `test-observation-${Date.now()}`,
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
  },
  status: 'final',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'vital-signs',
      display: 'Vital Signs',
    }],
  }],
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '8867-4',
      display: 'Heart rate',
    }],
  },
  subject: {
    reference: 'Patient/test-patient',
  },
  encounter: {
    reference: 'Encounter/test-encounter',
  },
  effectiveDateTime: new Date().toISOString(),
  performer: [{
    reference: 'Practitioner/test-practitioner',
  }],
  valueQuantity: {
    value: 72,
    unit: 'beats/minute',
    system: 'http://unitsofmeasure.org',
    code: '/min',
  },
});

// Test data cleanup function
global.cleanupTestData = async () => {
  try {
    // Clean up test data from database
    await global.testDb.query(`
      DELETE FROM fhir.patient WHERE resource->>'identifier' @> '[{"system":"http://omnicare.com/test-patients"}]';
      DELETE FROM fhir.practitioner WHERE resource->>'identifier' @> '[{"system":"http://hl7.org/fhir/sid/us-npi"}]' 
        AND resource->>'identifier' LIKE '%9999%';
      DELETE FROM fhir.encounter WHERE id LIKE 'test-encounter-%';
      DELETE FROM fhir.observation WHERE id LIKE 'test-observation-%';
    `);

    // Clean up test data from Redis
    const keys = await global.testRedis.keys('test:*');
    if (keys.length > 0) {
      await global.testRedis.del(keys);
    }
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
};

// Setup before all tests
beforeAll(async () => {
  // Connect to Redis
  await global.testRedis.connect();

  // Ensure test database is ready
  try {
    await global.testDb.query('SELECT 1');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }

  // Authenticate Medplum client
  try {
    await global.testMedplum.startLogin(
      process.env.TEST_MEDPLUM_CLIENT_ID || 'test-client',
      process.env.TEST_MEDPLUM_CLIENT_SECRET || 'test-secret'
    );
  } catch (error) {
    console.warn('Medplum authentication failed, some tests may be skipped:', error);
  }

  // Clean up any leftover test data
  await global.cleanupTestData();
});

// Cleanup after all tests
afterAll(async () => {
  // Final cleanup
  await global.cleanupTestData();

  // Close connections
  await global.testDb.end();
  await global.testRedis.quit();
});

// Setup before each test
beforeEach(() => {
  // Reset any mocks
  jest.clearAllMocks();
});

// Cleanup after each test
afterEach(async () => {
  // Clean up test-specific data if needed
});

// Custom matchers
expect.extend({
  toBeValidFHIRResource(received) {
    const pass = 
      received &&
      typeof received === 'object' &&
      received.resourceType &&
      received.id;

    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid FHIR resource`
          : `expected ${JSON.stringify(received)} to be a valid FHIR resource with resourceType and id`,
    };
  },

  toBeValidBundle(received) {
    const pass =
      received &&
      received.resourceType === 'Bundle' &&
      received.type &&
      Array.isArray(received.entry);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid FHIR Bundle`
          : `expected ${JSON.stringify(received)} to be a valid FHIR Bundle`,
    };
  },

  toBeValidOperationOutcome(received) {
    const pass =
      received &&
      received.resourceType === 'OperationOutcome' &&
      Array.isArray(received.issue);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid OperationOutcome`
          : `expected ${JSON.stringify(received)} to be a valid OperationOutcome`,
    };
  },
});

// TypeScript declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFHIRResource(): R;
      toBeValidBundle(): R;
      toBeValidOperationOutcome(): R;
    }
  }
}

// Error handler for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
  throw error;
});

// Increase test timeout for integration tests
jest.setTimeout(30000);