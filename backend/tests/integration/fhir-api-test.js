/**
 * Simplified FHIR Integration Test
 * Tests FHIR services without complex database setup
 */

// Set environment first
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MEDPLUM_BASE_URL = 'https://api.medplum.com/';
process.env.MEDPLUM_CLIENT_ID = 'test_client_id';
process.env.MEDPLUM_CLIENT_SECRET = 'test_client_secret';
process.env.SMART_AUTHORIZATION_URL = 'https://test-fhir.omnicare.com/oauth2/authorize';
process.env.SMART_TOKEN_URL = 'https://test-fhir.omnicare.com/oauth2/token';

const path = require('path');
require('ts-node').register({
  project: path.resolve(__dirname, '../../tsconfig.json'),
  transpileOnly: true
});

// Import after ts-node setup
const { medplumService } = require('../../src/services/medplum.service');
const { smartFHIRService } = require('../../src/services/smart-fhir.service');
const { cdsHooksService } = require('../../src/services/cds-hooks.service');
const { subscriptionsService } = require('../../src/services/subscriptions.service');

// Mock the logger to avoid import issues
const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: () => {},
  security: console.log,
  integration: console.log,
  fhir: console.log
};

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock database service
const mockDatabaseService = {
  initialize: () => Promise.resolve(),
  query: () => Promise.resolve({ rows: [] }),
  ensureAuditSchema: () => Promise.resolve(),
  shutdown: () => Promise.resolve()
};

async function testFHIRIntegrations() {
  console.log('Starting FHIR Integration Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function addTest(name, passed, details) {
    results.tests.push({ name, passed, details });
    if (passed) {
      results.passed++;
      console.log(`✅ ${name}: PASSED`);
    } else {
      results.failed++;
      console.log(`❌ ${name}: FAILED - ${details}`);
    }
  }

  // Test 1: Medplum Service Health Check
  try {
    const health = await medplumService.getHealthStatus();
    addTest('Medplum Service Health Check', 
      health.status === 'DOWN' && health.details.initialized === false,
      `Status: ${health.status}, Initialized: ${health.details.initialized}`
    );
  } catch (error) {
    addTest('Medplum Service Health Check', false, error.message);
  }

  // Test 2: SMART on FHIR Service Health Check
  try {
    const health = await smartFHIRService.getHealthStatus();
    addTest('SMART on FHIR Service Health Check',
      health.status === 'UP',
      `Status: ${health.status}`
    );
  } catch (error) {
    addTest('SMART on FHIR Service Health Check', false, error.message);
  }

  // Test 3: CDS Hooks Discovery
  try {
    const discovery = cdsHooksService.getDiscoveryDocument();
    addTest('CDS Hooks Discovery Document',
      discovery.services && discovery.services.length > 0,
      `Found ${discovery.services.length} CDS services`
    );
  } catch (error) {
    addTest('CDS Hooks Discovery Document', false, error.message);
  }

  // Test 4: CDS Hooks Service Health
  try {
    const health = await cdsHooksService.getHealthStatus();
    addTest('CDS Hooks Service Health Check',
      health.status === 'UP',
      `Status: ${health.status}, Services: ${health.details.servicesAvailable}`
    );
  } catch (error) {
    addTest('CDS Hooks Service Health Check', false, error.message);
  }

  // Test 5: Subscriptions Service Health
  try {
    const health = await subscriptionsService.getHealthStatus();
    addTest('Subscriptions Service Health Check',
      health.status === 'UP',
      `Status: ${health.status}, Connected clients: ${health.details.websocketServer.connectedClients}`
    );
  } catch (error) {
    addTest('Subscriptions Service Health Check', false, error.message);
  }

  // Test 6: SMART Authentication Flow Initiation
  try {
    const authFlow = await smartFHIRService.initiateAuthorization(
      'test-client',
      'https://example.com/callback',
      ['patient/*.read', 'user/*.read']
    );
    addTest('SMART Authentication Flow Initiation',
      authFlow.authorizationUrl && authFlow.state,
      `Generated authorization URL and state`
    );
  } catch (error) {
    addTest('SMART Authentication Flow Initiation', false, error.message);
  }

  // Test 7: Patient-View CDS Hook Execution
  try {
    const cdsRequest = {
      hookInstance: 'test-hook-instance',
      fhirServer: 'https://test-fhir.omnicare.com',
      hook: 'patient-view',
      context: {
        patientId: 'test-patient-123',
        userId: 'test-user-456'
      },
      prefetch: {}
    };

    const response = await cdsHooksService.executePatientView(cdsRequest);
    addTest('Patient-View CDS Hook Execution',
      response && Array.isArray(response.cards),
      `Returned ${response?.cards?.length || 0} cards`
    );
  } catch (error) {
    addTest('Patient-View CDS Hook Execution', false, error.message);
  }

  // Test 8: FHIR Resource Validation (Mock)
  try {
    const testPatient = {
      resourceType: 'Patient',
      name: [{ family: 'Test', given: ['Integration'] }],
      gender: 'male',
      birthDate: '1990-01-01'
    };

    // This will use the mock client
    const validation = await medplumService.validateResource(testPatient);
    addTest('FHIR Resource Validation',
      validation && validation.resourceType === 'OperationOutcome',
      'Validation completed with OperationOutcome'
    );
  } catch (error) {
    addTest('FHIR Resource Validation', false, error.message);
  }

  // Test 9: FHIR Search Parameters
  try {
    // This will use the mock client
    const searchResult = await medplumService.searchResources('Patient', {
      name: 'Test',
      gender: 'male'
    });
    addTest('FHIR Search Parameters',
      searchResult && searchResult.resourceType === 'Bundle',
      `Search returned Bundle with type: ${searchResult.type}`
    );
  } catch (error) {
    addTest('FHIR Search Parameters', false, error.message);
  }

  // Test 10: FHIR Bundle Operations
  try {
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            name: [{ family: 'BundleTest' }]
          },
          request: {
            method: 'POST',
            url: 'Patient'
          }
        }
      ]
    };

    const result = await medplumService.executeBatch(bundle);
    addTest('FHIR Bundle Operations',
      result && result.resourceType === 'Bundle',
      `Bundle operation completed with type: ${result.type}`
    );
  } catch (error) {
    addTest('FHIR Bundle Operations', false, error.message);
  }

  // Test 11: Subscription Creation
  try {
    const subscriptionConfig = {
      criteria: 'Patient?status=active',
      channel: {
        type: 'websocket',
        payload: 'application/fhir+json'
      },
      reason: 'Test subscription',
      status: 'active'
    };

    const subscriptionId = await subscriptionsService.createSubscription(subscriptionConfig);
    addTest('Subscription Creation',
      typeof subscriptionId === 'string' && subscriptionId.length > 0,
      `Created subscription with ID: ${subscriptionId}`
    );
  } catch (error) {
    addTest('Subscription Creation', false, error.message);
  }

  // Test 12: Medication-Prescribe CDS Hook
  try {
    const medicationRequest = {
      hookInstance: 'test-med-hook',
      fhirServer: 'https://test-fhir.omnicare.com',
      hook: 'medication-prescribe',
      context: {
        patientId: 'test-patient-123',
        userId: 'test-user-456',
        draftOrders: [
          {
            resourceType: 'MedicationRequest',
            status: 'draft',
            medicationCodeableConcept: {
              coding: [{ display: 'Aspirin 81 mg' }]
            }
          }
        ]
      },
      prefetch: {}
    };

    const response = await cdsHooksService.executeMedicationPrescribe(medicationRequest);
    addTest('Medication-Prescribe CDS Hook',
      response && Array.isArray(response.cards),
      `Returned ${response?.cards?.length || 0} cards`
    );
  } catch (error) {
    addTest('Medication-Prescribe CDS Hook', false, error.message);
  }

  console.log('\n=== Test Results ===');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);

  if (results.failed > 0) {
    console.log('\n=== Failed Tests ===');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`- ${test.name}: ${test.details}`);
    });
  }

  // Store results in memory for swarm coordination
  const memoryStore = {
    testResults: results,
    timestamp: new Date().toISOString(),
    testType: 'FHIR Integration',
    summary: {
      totalTests: results.tests.length,
      passed: results.passed,
      failed: results.failed,
      successRate: ((results.passed / results.tests.length) * 100).toFixed(1) + '%'
    },
    apiCompatibility: {
      medplumService: results.tests.find(t => t.name.includes('Medplum'))?.passed || false,
      smartFHIR: results.tests.find(t => t.name.includes('SMART'))?.passed || false,
      cdsHooks: results.tests.find(t => t.name.includes('CDS'))?.passed || false,
      subscriptions: results.tests.find(t => t.name.includes('Subscription'))?.passed || false,
      fhirResources: results.tests.find(t => t.name.includes('FHIR Resource'))?.passed || false
    }
  };

  console.log('\n=== Memory Store Updated ===');
  console.log(JSON.stringify(memoryStore, null, 2));

  // Shutdown services
  try {
    await subscriptionsService.shutdown();
    console.log('\nServices shut down successfully');
  } catch (error) {
    console.error('Error shutting down services:', error.message);
  }

  return memoryStore;
}

// Run the tests
if (require.main === module) {
  testFHIRIntegrations()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testFHIRIntegrations };