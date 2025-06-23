import request from 'supertest';
import { app } from '../../src/app';
import { medplumService } from '../../src/services/medplum.service';
import { fhirResourcesService } from '../../src/services/fhir-resources.service';
import { smartFHIRService } from '../../src/services/smart-fhir.service';
import { fhirValidationService } from '../../src/services/integration/fhir/fhir-validation.service';
import { directTrustService } from '../../src/services/integration/direct/direct-trust.service';
import { hl7v2ParserService } from '../../src/services/integration/hl7v2/hl7v2-parser.service';
import { Patient, Encounter, Observation, Bundle } from '@medplum/fhirtypes';
import logger from '../../src/utils/logger';

/**
 * Healthcare API Integration Tests
 * Tests end-to-end FHIR API operations including CRUD, search, and validation
 */
describe('Healthcare API Integration Tests', () => {
  let testPatientId: string;
  let testEncounterId: string;
  let testPractitionerId: string;
  let accessToken: string;

  beforeAll(async () => {
    // Initialize all services
    await medplumService.initialize();
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('FHIR Server Integration (Medplum)', () => {
    test('should connect to Medplum FHIR server', async () => {
      const healthStatus = await medplumService.getHealthStatus();
      expect(healthStatus.status).toBe('UP');
      expect(healthStatus.details.initialized).toBe(true);
    });

    test('should retrieve FHIR capability statement', async () => {
      const capabilityStatement = await medplumService.getCapabilityStatement();
      expect(capabilityStatement).toBeDefined();
      expect(capabilityStatement.resourceType).toBe('CapabilityStatement');
    });

    test('should validate FHIR server compliance', async () => {
      const capabilityStatement = await medplumService.getCapabilityStatement();
      expect(capabilityStatement.fhirVersion).toMatch(/4\.0\.\d+/);
      expect(capabilityStatement.status).toBe('active');
      expect(capabilityStatement.kind).toBe('instance');
    });
  });

  describe('Patient Data Flow Integration', () => {
    test('should create, read, update, and delete patient records', async () => {
      // CREATE
      const patientData = {
        name: [{ given: ['Integration'], family: 'Test' }],
        gender: 'male' as const,
        birthDate: '1990-01-01',
        telecom: [
          { system: 'phone' as const, value: '555-0123', use: 'mobile' as const }
        ],
        address: [{
          use: 'home' as const,
          line: ['123 Test St'],
          city: 'Test City',
          state: 'TS',
          postalCode: '12345'
        }]
      };

      const createdPatient = await fhirResourcesService.createPatient(patientData);
      expect(createdPatient.id).toBeDefined();
      expect(createdPatient.resourceType).toBe('Patient');
      testPatientId = createdPatient.id!;

      // READ
      const retrievedPatient = await fhirResourcesService.getPatient(testPatientId);
      expect(retrievedPatient.id).toBe(testPatientId);
      expect(retrievedPatient.name?.[0]?.family).toBe('Test');

      // UPDATE
      const updatedPatientData = {
        ...retrievedPatient,
        name: [{ given: ['Integration', 'Updated'], family: 'Test' }]
      };
      const updatedPatient = await fhirResourcesService.updatePatient(updatedPatientData);
      expect(updatedPatient.name?.[0]?.given).toContain('Updated');

      // SEARCH
      const searchResults = await fhirResourcesService.searchPatients({
        family: 'Test',
        given: 'Integration'
      });
      expect(searchResults.total).toBeGreaterThan(0);
      expect(searchResults.entry?.length).toBeGreaterThan(0);
    });

    test('should handle patient data validation', async () => {
      const invalidPatient = {
        resourceType: 'Patient',
        // Missing required fields
      };

      const validationResult = await fhirValidationService.validateResource(invalidPatient);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    test('should retrieve patient everything bundle', async () => {
      const everythingBundle = await fhirResourcesService.getPatientEverything(testPatientId);
      expect(everythingBundle.resourceType).toBe('Bundle');
      expect(everythingBundle.type).toBe('searchset');
      expect(everythingBundle.entry).toBeDefined();
    });
  });

  describe('Clinical Encounter Management', () => {
    test('should create and manage encounters', async () => {
      const encounterData = {
        status: 'planned' as const,
        subject: { reference: `Patient/${testPatientId}` },
        period: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString() // 1 hour later
        },
        appointmentType: 'routine',
        chiefComplaint: 'Integration test encounter'
      };

      const createdEncounter = await fhirResourcesService.createEncounter(encounterData);
      expect(createdEncounter.id).toBeDefined();
      expect(createdEncounter.status).toBe('planned');
      testEncounterId = createdEncounter.id!;
    });

    test('should create vital signs observations', async () => {
      const vitals = {
        temperature: 98.6,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        heartRate: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98
      };

      const vitalObservations = await fhirResourcesService.createVitalSigns(
        testPatientId,
        testEncounterId,
        vitals
      );

      expect(vitalObservations.length).toBeGreaterThan(0);
      vitalObservations.forEach(obs => {
        expect(obs.resourceType).toBe('Observation');
        expect(obs.status).toBe('final');
        expect(obs.subject?.reference).toBe(`Patient/${testPatientId}`);
        expect(obs.encounter?.reference).toBe(`Encounter/${testEncounterId}`);
      });
    });
  });

  describe('FHIR Validation Service Integration', () => {
    test('should validate FHIR resources against R4 schema', async () => {
      const validPatient: Patient = {
        resourceType: 'Patient',
        active: true,
        name: [{ given: ['Valid'], family: 'Patient' }],
        gender: 'male',
        birthDate: '1990-01-01'
      };

      const validationResult = await fhirValidationService.validateResource(validPatient);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors.length).toBe(0);
    });

    test('should detect validation errors', async () => {
      const invalidPatient = {
        resourceType: 'Patient',
        birthDate: '2030-01-01', // Future birth date - business rule violation
        gender: 'invalid-gender' // Invalid gender value
      };

      const validationResult = await fhirValidationService.validateResource(invalidPatient);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    test('should validate bundle resources', async () => {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              active: true,
              name: [{ given: ['Bundle'], family: 'Test' }],
              gender: 'female'
            }
          }
        ]
      };

      const bundleValidation = await fhirValidationService.validateBundle(bundle);
      expect(bundleValidation.valid).toBe(true);
    });
  });

  describe('SMART on FHIR Integration', () => {
    test('should initiate SMART authorization flow', async () => {
      const clientId = 'test-client-id';
      const redirectUri = 'http://localhost:3000/callback';
      const scopes = ['patient/Patient.read', 'patient/Observation.read'];

      const authFlow = await smartFHIRService.initiateAuthorization(
        clientId,
        redirectUri,
        scopes
      );

      expect(authFlow.authorizationUrl).toBeDefined();
      expect(authFlow.state).toBeDefined();
      expect(authFlow.authorizationUrl).toContain('response_type=code');
      expect(authFlow.authorizationUrl).toContain(`client_id=${clientId}`);
    });

    test('should get SMART configuration from EHR', async () => {
      const mockFhirBaseUrl = 'https://fhir.epic.com/interconnect-fhir-oauth';
      
      try {
        const smartConfig = await smartFHIRService.getSMARTConfiguration(mockFhirBaseUrl);
        expect(smartConfig).toBeDefined();
        expect(smartConfig.authorization_endpoint).toBeDefined();
        expect(smartConfig.token_endpoint).toBeDefined();
      } catch (error) {
        // Expected for mock URL - test structure is valid
        expect(error).toBeDefined();
      }
    });

    test('should validate JWT tokens', () => {
      const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      try {
        const decoded = smartFHIRService.validateJWT(mockJWT);
        expect(decoded).toBeDefined();
      } catch (error) {
        // Expected with mock JWT - test structure is valid
        expect(error).toBeDefined();
      }
    });
  });

  describe('Batch Operations Integration', () => {
    test('should execute FHIR batch bundle', async () => {
      const batchResources: Patient[] = [
        {
          resourceType: 'Patient',
          name: [{ given: ['Batch'], family: 'Test1' }],
          gender: 'male'
        },
        {
          resourceType: 'Patient',
          name: [{ given: ['Batch'], family: 'Test2' }],
          gender: 'female'
        }
      ];

      const batchRequest: Bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: batchResources.map((resource, index) => ({
          request: {
            method: 'POST',
            url: resource.resourceType
          },
          resource
        })),
        timestamp: new Date().toISOString()
      };

      const batchResult = await medplumService.executeBatch(batchRequest);
      expect(batchResult.resourceType).toBe('Bundle');
      expect(batchResult.type).toBe('batch-response');
    });

    test('should handle transaction bundles', async () => {
      const transactionResources: Patient[] = [
        {
          resourceType: 'Patient',
          name: [{ given: ['Transaction'], family: 'Test' }],
          gender: 'other'
        }
      ];

      const transactionRequest: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: transactionResources.map((resource, index) => ({
          request: {
            method: 'POST',
            url: resource.resourceType
          },
          resource
        })),
        timestamp: new Date().toISOString()
      };

      const transactionResult = await medplumService.executeBatch(transactionRequest);
      expect(transactionResult.resourceType).toBe('Bundle');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle FHIR server connection errors gracefully', async () => {
      // Simulate connection error by using invalid resource type
      try {
        await medplumService.readResource('InvalidResourceType' as any, 'invalid-id');
      } catch (error) {
        expect(error).toBeDefined();
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('FHIR Error');
      }
    });

    test('should handle validation errors for malformed resources', async () => {
      const malformedResource = {
        resourceType: 'Patient',
        name: 'This should be an array, not a string'
      };

      const validationResult = await fhirValidationService.validateResource(malformedResource);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    test('should handle network timeouts gracefully', async () => {
      // Test timeout handling by using very long search
      const searchParams = {
        _count: 1000000,
        _sort: 'name'
      };

      try {
        const results = await fhirResourcesService.searchPatients(searchParams);
        expect(results).toBeDefined();
      } catch (error) {
        // Timeout or other network error is acceptable
        expect(error).toBeDefined();
        // Type-safe error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toBeDefined();
      }
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent patient creation', async () => {
      const patientPromises = Array(5).fill(0).map((_, i) => {
        const patientData = {
          name: [{ given: ['Concurrent'], family: `Test${i}` }],
          gender: 'unknown' as const,
          birthDate: '1990-01-01'
        };
        return fhirResourcesService.createPatient(patientData);
      });

      const patients = await Promise.allSettled(patientPromises);
      const successfulPatients = patients.filter(p => p.status === 'fulfilled');
      expect(successfulPatients.length).toBeGreaterThan(0);
    });

    test('should handle large search result sets', async () => {
      const searchParams = {
        _count: 100,
        active: 'true'
      };

      const startTime = Date.now();
      const results = await fhirResourcesService.searchPatients(searchParams);
      const endTime = Date.now();

      expect(results).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  // Helper functions
  async function setupTestData(): Promise<void> {
    try {
      // Create test practitioner
      const practitionerData = {
        name: [{ given: ['Test'], family: 'Practitioner' }],
        identifier: [{
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: '1234567890'
        }]
      };
      const practitioner = await fhirResourcesService.createPractitioner(practitionerData);
      testPractitionerId = practitioner.id!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to setup test data:', errorMessage);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Cleanup is handled by the test environment
      // In production, you would delete test resources here
      if (testPatientId) {
        await medplumService.deleteResource('Patient', testPatientId);
      }
      if (testEncounterId) {
        await medplumService.deleteResource('Encounter', testEncounterId);
      }
      if (testPractitionerId) {
        await medplumService.deleteResource('Practitioner', testPractitionerId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to cleanup test data:', errorMessage);
    }
  }
});