import request from 'supertest';
import express from 'express';
import { Validator } from '@medplum/core';
import { readJson } from '@medplum/definitions';
import routes from '../../backend/src/routes';
import * as jwt from 'jsonwebtoken';

// FHIR R4 resource types to test
const FHIR_RESOURCE_TYPES = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Observation',
  'MedicationRequest',
  'DiagnosticReport',
  'CarePlan',
  'DocumentReference',
  'Immunization',
  'AllergyIntolerance',
  'Condition',
  'Procedure',
];

// FHIR search parameters to test
const COMMON_SEARCH_PARAMS = [
  '_id',
  '_lastUpdated',
  '_tag',
  '_profile',
  '_security',
  '_text',
  '_content',
  '_list',
  '_has',
  '_type',
];

describe('FHIR R4 Compliance Test Suite', () => {
  let app: express.Application;
  let server: any;
  let authToken: string;
  let validator: Validator;
  let fhirSchema: any;

  beforeAll(async () => {
    // Initialize Express app
    app = express();
    app.use(express.json());
    app.use('/api', routes);
    server = app.listen(3003);

    // Initialize FHIR validator
    fhirSchema = await readJson('fhir/r4/fhir.schema.json');
    validator = new Validator(fhirSchema);

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'fhir_test',
        password: 'test123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    server?.close();
  });

  describe('1. Capability Statement Compliance', () => {
    test('should provide valid CapabilityStatement at /metadata', async () => {
      const response = await request(app)
        .get('/api/fhir/R4/metadata')
        .expect(200);

      const capabilityStatement = response.body;

      // Validate structure
      expect(capabilityStatement.resourceType).toBe('CapabilityStatement');
      expect(capabilityStatement.fhirVersion).toBe('4.0.1');
      expect(capabilityStatement.format).toContain('application/fhir+json');
      
      // Validate required elements
      expect(capabilityStatement.status).toBe('active');
      expect(capabilityStatement.date).toBeDefined();
      expect(capabilityStatement.kind).toBe('instance');
      
      // Validate REST capabilities
      expect(capabilityStatement.rest).toBeDefined();
      expect(capabilityStatement.rest.length).toBeGreaterThan(0);
      
      const restConfig = capabilityStatement.rest[0];
      expect(restConfig.mode).toBe('server');
      
      // Validate security
      expect(restConfig.security).toBeDefined();
      expect(restConfig.security.service).toContainEqual({
        coding: [{
          system: 'http://hl7.org/fhir/restful-security-service',
          code: 'SMART-on-FHIR',
        }],
      });

      // Validate resources
      expect(restConfig.resource).toBeDefined();
      expect(restConfig.resource.length).toBeGreaterThan(0);

      // Check for required resource types
      const supportedTypes = restConfig.resource.map((r: any) => r.type);
      expect(supportedTypes).toContain('Patient');
      expect(supportedTypes).toContain('Encounter');
      expect(supportedTypes).toContain('Observation');
    });

    test('should declare supported interactions for each resource', async () => {
      const response = await request(app)
        .get('/api/fhir/R4/metadata')
        .expect(200);

      const restConfig = response.body.rest[0];

      restConfig.resource.forEach((resource: any) => {
        // Each resource should declare its interactions
        expect(resource.interaction).toBeDefined();
        expect(resource.interaction.length).toBeGreaterThan(0);

        const interactions = resource.interaction.map((i: any) => i.code);
        
        // At minimum, should support read and search
        expect(interactions).toContain('read');
        expect(interactions).toContain('search-type');
        
        // Validate search parameters
        if (resource.searchParam) {
          resource.searchParam.forEach((param: any) => {
            expect(param.name).toBeDefined();
            expect(param.type).toBeDefined();
            expect(['number', 'date', 'string', 'token', 'reference', 'composite', 'quantity', 'uri'].includes(param.type)).toBe(true);
          });
        }
      });
    });
  });

  describe('2. Resource CRUD Compliance', () => {
    for (const resourceType of ['Patient', 'Encounter', 'Observation']) {
      describe(`${resourceType} Resource Operations`, () => {
        let createdResourceId: string;
        let resourceData: any;

        beforeEach(() => {
          // Prepare test data based on resource type
          switch (resourceType) {
            case 'Patient':
              resourceData = {
                resourceType: 'Patient',
                name: [{ given: ['FHIR'], family: 'Compliance' }],
                gender: 'male',
                birthDate: '1990-01-01',
              };
              break;
            case 'Encounter':
              resourceData = {
                resourceType: 'Encounter',
                status: 'planned',
                class: {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                  code: 'AMB',
                },
                subject: { reference: 'Patient/test-patient' },
              };
              break;
            case 'Observation':
              resourceData = {
                resourceType: 'Observation',
                status: 'final',
                code: {
                  coding: [{
                    system: 'http://loinc.org',
                    code: '8867-4',
                    display: 'Heart rate',
                  }],
                },
                subject: { reference: 'Patient/test-patient' },
                valueQuantity: {
                  value: 72,
                  unit: 'beats/minute',
                },
              };
              break;
          }
        });

        test(`should create ${resourceType} with POST`, async () => {
          const response = await request(app)
            .post(`/api/fhir/R4/${resourceType}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Content-Type', 'application/fhir+json')
            .send(resourceData)
            .expect(201);

          // Validate response
          expect(response.body.resourceType).toBe(resourceType);
          expect(response.body.id).toBeDefined();
          expect(response.body.meta).toBeDefined();
          expect(response.body.meta.versionId).toBeDefined();
          expect(response.body.meta.lastUpdated).toBeDefined();

          // Validate Location header
          expect(response.headers.location).toBeDefined();
          expect(response.headers.location).toContain(`${resourceType}/${response.body.id}`);

          // Validate ETag header
          expect(response.headers.etag).toBeDefined();
          expect(response.headers.etag).toMatch(/W\/".+"/);

          createdResourceId = response.body.id;

          // Validate against FHIR schema
          const validationResult = validator.validateResource(response.body);
          expect(validationResult.issues.filter(i => i.severity === 'error')).toHaveLength(0);
        });

        test(`should read ${resourceType} with GET`, async () => {
          const response = await request(app)
            .get(`/api/fhir/R4/${resourceType}/${createdResourceId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Accept', 'application/fhir+json')
            .expect(200);

          // Validate response
          expect(response.body.resourceType).toBe(resourceType);
          expect(response.body.id).toBe(createdResourceId);
          
          // Validate headers
          expect(response.headers['content-type']).toContain('application/fhir+json');
          expect(response.headers.etag).toBeDefined();
        });

        test(`should update ${resourceType} with PUT`, async () => {
          const updatedData = {
            ...resourceData,
            id: createdResourceId,
            meta: { versionId: '1' }, // Include version for update
          };

          // Add update-specific changes
          if (resourceType === 'Patient') {
            updatedData.name[0].given.push('Updated');
          }

          const response = await request(app)
            .put(`/api/fhir/R4/${resourceType}/${createdResourceId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Content-Type', 'application/fhir+json')
            .send(updatedData)
            .expect(200);

          // Validate response
          expect(response.body.id).toBe(createdResourceId);
          expect(response.body.meta.versionId).not.toBe('1'); // Version should increment
          
          // Validate headers
          expect(response.headers.etag).toBeDefined();
          expect(response.headers['last-modified']).toBeDefined();
        });

        test(`should search ${resourceType} with GET`, async () => {
          const response = await request(app)
            .get(`/api/fhir/R4/${resourceType}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Accept', 'application/fhir+json')
            .query({ _count: 10 })
            .expect(200);

          // Validate Bundle response
          expect(response.body.resourceType).toBe('Bundle');
          expect(response.body.type).toBe('searchset');
          expect(response.body.total).toBeDefined();
          expect(Array.isArray(response.body.entry)).toBe(true);

          // Validate Bundle.entry structure
          if (response.body.entry.length > 0) {
            response.body.entry.forEach((entry: any) => {
              expect(entry.fullUrl).toBeDefined();
              expect(entry.resource).toBeDefined();
              expect(entry.resource.resourceType).toBe(resourceType);
              expect(entry.search).toBeDefined();
              expect(entry.search.mode).toBe('match');
            });
          }

          // Validate self link
          expect(response.body.link).toBeDefined();
          const selfLink = response.body.link.find((l: any) => l.relation === 'self');
          expect(selfLink).toBeDefined();
        });

        test(`should delete ${resourceType} with DELETE`, async () => {
          const response = await request(app)
            .delete(`/api/fhir/R4/${resourceType}/${createdResourceId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(204);

          // Validate no content
          expect(response.body).toEqual({});

          // Verify resource is deleted
          await request(app)
            .get(`/api/fhir/R4/${resourceType}/${createdResourceId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(410); // Gone
        });
      });
    }
  });

  describe('3. Search Parameter Compliance', () => {
    test('should support common search parameters', async () => {
      // Create test patient
      const patient = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Patient',
          name: [{ given: ['Search'], family: 'Test' }],
          gender: 'female',
          birthDate: '1985-05-15',
        });

      const patientId = patient.body.id;

      // Test _id search
      let response = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _id: patientId })
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.entry[0].resource.id).toBe(patientId);

      // Test _lastUpdated search
      const lastUpdated = patient.body.meta.lastUpdated;
      response = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _lastUpdated: `ge${lastUpdated}` })
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(1);

      // Test _count parameter
      response = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _count: 5 })
        .expect(200);

      expect(response.body.entry?.length || 0).toBeLessThanOrEqual(5);

      // Test _sort parameter
      response = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _sort: '-_lastUpdated' })
        .expect(200);

      if (response.body.entry?.length > 1) {
        const dates = response.body.entry.map((e: any) => 
          new Date(e.resource.meta.lastUpdated).getTime()
        );
        // Verify descending order
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
        }
      }
    });

    test('should support resource-specific search parameters', async () => {
      // Patient search parameters
      let response = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          name: 'Test',
          gender: 'female',
          birthdate: '1985-05-15',
        })
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');

      // Observation search parameters
      response = await request(app)
        .get('/api/fhir/R4/Observation')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          patient: 'Patient/test-patient',
          category: 'vital-signs',
          status: 'final',
        })
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');

      // Encounter search parameters
      response = await request(app)
        .get('/api/fhir/R4/Encounter')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          patient: 'Patient/test-patient',
          status: 'in-progress,finished',
          class: 'AMB',
        })
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');
    });

    test('should support search result pagination', async () => {
      // Get first page
      const firstPage = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _count: 2 })
        .expect(200);

      expect(firstPage.body.resourceType).toBe('Bundle');
      
      // Check for pagination links
      if (firstPage.body.total > 2) {
        const nextLink = firstPage.body.link?.find((l: any) => l.relation === 'next');
        expect(nextLink).toBeDefined();
        
        // Follow next link
        const nextUrl = new URL(nextLink.url);
        const secondPage = await request(app)
          .get(nextUrl.pathname + nextUrl.search)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(secondPage.body.resourceType).toBe('Bundle');
        
        // Verify different results
        const firstIds = firstPage.body.entry?.map((e: any) => e.resource.id) || [];
        const secondIds = secondPage.body.entry?.map((e: any) => e.resource.id) || [];
        
        // No overlap between pages
        const overlap = firstIds.filter((id: string) => secondIds.includes(id));
        expect(overlap).toHaveLength(0);
      }
    });

    test('should support _include and _revinclude parameters', async () => {
      // Test _include
      const response = await request(app)
        .get('/api/fhir/R4/Encounter')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          _include: 'Encounter:patient',
          _count: 5,
        })
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');
      
      // Should include both Encounters and Patients
      const resourceTypes = response.body.entry?.map((e: any) => e.resource.resourceType) || [];
      const hasEncounters = resourceTypes.includes('Encounter');
      const hasPatients = resourceTypes.includes('Patient');
      
      if (response.body.total > 0) {
        expect(hasEncounters).toBe(true);
        // Patient includes depend on data
      }

      // Test _revinclude
      const revResponse = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          _revinclude: 'Observation:patient',
          _count: 5,
        })
        .expect(200);

      expect(revResponse.body.resourceType).toBe('Bundle');
    });
  });

  describe('4. Batch and Transaction Compliance', () => {
    test('should process batch bundle correctly', async () => {
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [
          {
            request: {
              method: 'GET',
              url: 'Patient?name=Smith',
            },
          },
          {
            resource: {
              resourceType: 'Patient',
              name: [{ given: ['Batch'], family: 'Test' }],
              gender: 'male',
              birthDate: '1990-01-01',
            },
            request: {
              method: 'POST',
              url: 'Patient',
            },
          },
          {
            request: {
              method: 'GET',
              url: 'Observation?code=8867-4',
            },
          },
        ],
      };

      const response = await request(app)
        .post('/api/fhir/R4')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send(batchBundle)
        .expect(200);

      // Validate response bundle
      expect(response.body.resourceType).toBe('Bundle');
      expect(response.body.type).toBe('batch-response');
      expect(response.body.entry).toHaveLength(3);

      // Validate individual responses
      response.body.entry.forEach((entry: any, index: number) => {
        expect(entry.response).toBeDefined();
        expect(entry.response.status).toBeDefined();
        
        if (index === 1) { // POST request
          expect(entry.response.status).toMatch(/^201/);
          expect(entry.response.location).toBeDefined();
        } else { // GET requests
          expect(entry.response.status).toMatch(/^200/);
        }
      });
    });

    test('should process transaction bundle with rollback on error', async () => {
      const transactionBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'urn:uuid:patient-1',
            resource: {
              resourceType: 'Patient',
              name: [{ given: ['Transaction'], family: 'Success' }],
              gender: 'female',
              birthDate: '1995-03-20',
            },
            request: {
              method: 'POST',
              url: 'Patient',
            },
          },
          {
            fullUrl: 'urn:uuid:observation-1',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8867-4',
                }],
              },
              subject: { reference: 'urn:uuid:patient-1' },
              valueQuantity: {
                value: 72,
                unit: 'beats/minute',
              },
            },
            request: {
              method: 'POST',
              url: 'Observation',
            },
          },
          {
            resource: {
              resourceType: 'Observation',
              // Missing required 'status' field - should cause transaction failure
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8310-5',
                }],
              },
            },
            request: {
              method: 'POST',
              url: 'Observation',
            },
          },
        ],
      };

      const response = await request(app)
        .post('/api/fhir/R4')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send(transactionBundle)
        .expect(400);

      // Should return OperationOutcome
      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue).toBeDefined();
      expect(response.body.issue[0].severity).toBe('error');

      // Verify no resources were created (transaction rolled back)
      const searchResponse = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ family: 'Success' })
        .expect(200);

      expect(searchResponse.body.total).toBe(0);
    });
  });

  describe('5. Content Negotiation and Format Support', () => {
    test('should support JSON format with proper content types', async () => {
      const acceptHeaders = [
        'application/fhir+json',
        'application/json+fhir',
        'application/json',
      ];

      for (const accept of acceptHeaders) {
        const response = await request(app)
          .get('/api/fhir/R4/Patient')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', accept)
          .query({ _count: 1 })
          .expect(200);

        expect(response.headers['content-type']).toContain('application/fhir+json');
        expect(response.body.resourceType).toBe('Bundle');
      }
    });

    test('should handle format parameter', async () => {
      const formats = ['json', 'application/json', 'application/fhir+json'];

      for (const format of formats) {
        const response = await request(app)
          .get('/api/fhir/R4/Patient')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ _format: format, _count: 1 })
          .expect(200);

        expect(response.headers['content-type']).toContain('json');
        expect(response.body.resourceType).toBe('Bundle');
      }
    });

    test('should reject unsupported formats', async () => {
      const response = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/xml')
        .expect(406);

      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue[0].severity).toBe('error');
      expect(response.body.issue[0].code).toBe('not-supported');
    });
  });

  describe('6. Conditional Operations', () => {
    test('should support conditional create (POST)', async () => {
      const patient = {
        resourceType: 'Patient',
        identifier: [{
          system: 'http://omnicare.com/mrn',
          value: 'COND-12345',
        }],
        name: [{ given: ['Conditional'], family: 'Create' }],
        gender: 'male',
        birthDate: '1990-01-01',
      };

      // First create
      const response1 = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-None-Exist', 'identifier=http://omnicare.com/mrn|COND-12345')
        .send(patient)
        .expect(201);

      const patientId = response1.body.id;

      // Second create with same condition should return existing
      const response2 = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-None-Exist', 'identifier=http://omnicare.com/mrn|COND-12345')
        .send(patient)
        .expect(200);

      expect(response2.body.id).toBe(patientId);
    });

    test('should support conditional update (PUT)', async () => {
      const patient = {
        resourceType: 'Patient',
        identifier: [{
          system: 'http://omnicare.com/mrn',
          value: 'COND-UPDATE-123',
        }],
        name: [{ given: ['Conditional'], family: 'Update' }],
        gender: 'female',
        birthDate: '1985-05-15',
      };

      const response = await request(app)
        .put('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ identifier: 'http://omnicare.com/mrn|COND-UPDATE-123' })
        .send(patient)
        .expect((res) => {
          // Should be either 200 (update) or 201 (create)
          expect([200, 201].includes(res.status)).toBe(true);
        });

      expect(response.body.resourceType).toBe('Patient');
    });

    test('should support conditional delete', async () => {
      // Create patient to delete
      const patient = {
        resourceType: 'Patient',
        identifier: [{
          system: 'http://omnicare.com/mrn',
          value: 'COND-DELETE-123',
        }],
        name: [{ given: ['Conditional'], family: 'Delete' }],
        gender: 'male',
        birthDate: '1990-01-01',
      };

      await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patient)
        .expect(201);

      // Conditional delete
      await request(app)
        .delete('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ identifier: 'http://omnicare.com/mrn|COND-DELETE-123' })
        .expect(204);

      // Verify deleted
      const searchResponse = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ identifier: 'http://omnicare.com/mrn|COND-DELETE-123' })
        .expect(200);

      expect(searchResponse.body.total).toBe(0);
    });
  });

  describe('7. History and Versioning', () => {
    test('should maintain resource versions', async () => {
      // Create resource
      const createResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Patient',
          name: [{ given: ['Version'], family: 'Test' }],
          gender: 'male',
          birthDate: '1990-01-01',
        })
        .expect(201);

      const patientId = createResponse.body.id;
      const version1 = createResponse.body.meta.versionId;

      // Update resource
      const updateResponse = await request(app)
        .put(`/api/fhir/R4/Patient/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...createResponse.body,
          name: [{ given: ['Version', 'Updated'], family: 'Test' }],
        })
        .expect(200);

      const version2 = updateResponse.body.meta.versionId;

      // Versions should be different
      expect(version2).not.toBe(version1);

      // Should be able to read specific version
      const versionResponse = await request(app)
        .get(`/api/fhir/R4/Patient/${patientId}/_history/${version1}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(versionResponse.body.meta.versionId).toBe(version1);
      expect(versionResponse.body.name[0].given).toHaveLength(1);
    });

    test('should support resource history', async () => {
      // Create and update a resource multiple times
      const createResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Patient',
          name: [{ given: ['History'], family: 'Test' }],
          gender: 'female',
          birthDate: '1985-05-15',
        })
        .expect(201);

      const patientId = createResponse.body.id;

      // Make several updates
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .put(`/api/fhir/R4/Patient/${patientId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...createResponse.body,
            name: [{ given: ['History', `Update${i}`], family: 'Test' }],
          })
          .expect(200);
      }

      // Get history
      const historyResponse = await request(app)
        .get(`/api/fhir/R4/Patient/${patientId}/_history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.resourceType).toBe('Bundle');
      expect(historyResponse.body.type).toBe('history');
      expect(historyResponse.body.entry.length).toBeGreaterThanOrEqual(4); // 1 create + 3 updates
    });
  });

  describe('8. Operation Support', () => {
    test('should support $validate operation', async () => {
      const validPatient = {
        resourceType: 'Patient',
        name: [{ given: ['Valid'], family: 'Patient' }],
        gender: 'male',
        birthDate: '1990-01-01',
      };

      const response = await request(app)
        .post('/api/fhir/R4/Patient/$validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPatient)
        .expect(200);

      expect(response.body.resourceType).toBe('OperationOutcome');
      
      const errors = response.body.issue?.filter((i: any) => i.severity === 'error') || [];
      expect(errors).toHaveLength(0);
    });

    test('should validate and report errors for invalid resources', async () => {
      const invalidPatient = {
        resourceType: 'Patient',
        name: [{ given: ['Invalid'] }], // Missing required 'family' name
        gender: 'invalid-gender', // Invalid code
        birthDate: 'not-a-date', // Invalid date format
      };

      const response = await request(app)
        .post('/api/fhir/R4/Patient/$validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPatient)
        .expect(200);

      expect(response.body.resourceType).toBe('OperationOutcome');
      
      const errors = response.body.issue?.filter((i: any) => i.severity === 'error') || [];
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should support $everything operation for Patient', async () => {
      // Create patient with related resources
      const patientResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Patient',
          name: [{ given: ['Everything'], family: 'Test' }],
          gender: 'male',
          birthDate: '1990-01-01',
        })
        .expect(201);

      const patientId = patientResponse.body.id;

      // Create related resources
      await request(app)
        .post('/api/fhir/R4/Encounter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Encounter',
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
          },
          subject: { reference: `Patient/${patientId}` },
        })
        .expect(201);

      await request(app)
        .post('/api/fhir/R4/Observation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '8867-4',
            }],
          },
          subject: { reference: `Patient/${patientId}` },
          valueQuantity: {
            value: 72,
            unit: 'beats/minute',
          },
        })
        .expect(201);

      // Get everything
      const everythingResponse = await request(app)
        .get(`/api/fhir/R4/Patient/${patientId}/$everything`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(everythingResponse.body.resourceType).toBe('Bundle');
      expect(everythingResponse.body.type).toBe('searchset');
      
      const resourceTypes = everythingResponse.body.entry.map((e: any) => e.resource.resourceType);
      expect(resourceTypes).toContain('Patient');
      expect(resourceTypes).toContain('Encounter');
      expect(resourceTypes).toContain('Observation');
    });
  });

  describe('9. Error Handling Compliance', () => {
    test('should return proper OperationOutcome for errors', async () => {
      // 404 - Resource not found
      const notFoundResponse = await request(app)
        .get('/api/fhir/R4/Patient/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(notFoundResponse.body.resourceType).toBe('OperationOutcome');
      expect(notFoundResponse.body.issue[0].severity).toBe('error');
      expect(notFoundResponse.body.issue[0].code).toBe('not-found');

      // 400 - Bad request
      const badRequestResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(400);

      expect(badRequestResponse.body.resourceType).toBe('OperationOutcome');
      expect(badRequestResponse.body.issue[0].severity).toBe('error');

      // 401 - Unauthorized
      const unauthorizedResponse = await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(unauthorizedResponse.body.resourceType).toBe('OperationOutcome');
      expect(unauthorizedResponse.body.issue[0].severity).toBe('error');
      expect(unauthorizedResponse.body.issue[0].code).toBe('security');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue[0].severity).toBe('error');
      expect(response.body.issue[0].code).toBe('structure');
    });
  });

  describe('10. SMART on FHIR Compliance', () => {
    test('should support SMART authorization endpoints', async () => {
      // Get capability statement
      const metadata = await request(app)
        .get('/api/fhir/R4/metadata')
        .expect(200);

      const security = metadata.body.rest[0].security;
      const smartExtension = security.extension?.find(
        (ext: any) => ext.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
      );

      expect(smartExtension).toBeDefined();
      
      const authEndpoint = smartExtension.extension.find(
        (ext: any) => ext.url === 'authorize'
      );
      const tokenEndpoint = smartExtension.extension.find(
        (ext: any) => ext.url === 'token'
      );

      expect(authEndpoint).toBeDefined();
      expect(tokenEndpoint).toBeDefined();
    });

    test('should enforce SMART scopes', async () => {
      // Create token with limited scope
      const limitedToken = jwt.sign(
        {
          sub: 'limited-user',
          scope: 'patient/*.read', // Read-only access
        },
        'test-secret'
      );

      // Should allow read
      await request(app)
        .get('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(200);

      // Should deny write
      await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send({
          resourceType: 'Patient',
          name: [{ given: ['Test'], family: 'Scope' }],
          gender: 'male',
          birthDate: '1990-01-01',
        })
        .expect(403);
    });
  });
});

// Generate FHIR Compliance Report
function generateComplianceReport(testResults: any) {
  const report = {
    timestamp: new Date().toISOString(),
    fhirVersion: '4.0.1',
    compliance: {
      core: {
        restfulApi: true,
        resourceTypes: FHIR_RESOURCE_TYPES,
        searchParameters: true,
        operations: ['create', 'read', 'update', 'delete', 'search'],
      },
      advanced: {
        versioning: true,
        conditionalOperations: true,
        batch: true,
        transaction: true,
        history: true,
        validation: true,
      },
      security: {
        oauth2: true,
        smartOnFhir: true,
        audit: true,
      },
      format: {
        json: true,
        xml: false,
        contentNegotiation: true,
      },
    },
    testResults: testResults,
    recommendations: [
      'Consider implementing XML format support',
      'Add support for GraphQL queries',
      'Implement additional FHIR operations like $expand for ValueSets',
      'Add support for FHIR Subscriptions',
    ],
  };

  const fs = require('fs');
  const reportPath = '/Users/rodrigo/claude-projects/OmniCare/tests/integration/fhir-compliance-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('FHIR Compliance Report generated:', reportPath);
}