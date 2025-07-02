/**
 * Consumer Contract Tests for Patient API
 * Defines expected API behavior from the frontend perspective
 */

import path from 'path';

import { Pact, Matchers } from '@pact-foundation/pact';
import axios from 'axios';

import { pactConfig } from '../pact.config';

const { like, term, eachLike, iso8601DateTimeWithMillis } = Matchers;

describe('Patient API Consumer Contract Tests', () => {
  const provider = new Pact({
    consumer: pactConfig.consumer.name,
    provider: pactConfig.provider.name,
    port: 8080,
    log: path.resolve(__dirname, '../../../logs', 'pact.log'),
    dir: pactConfig.pactFileDirectory,
    logLevel: pactConfig.logLevel,
    spec: pactConfig.spec,
  });

  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  describe('GET /api/patients/:id', () => {
    it('should return a patient by ID', async () => {
      const expectedPatient = {
        resourceType: 'Patient',
        id: like('patient-123'),
        meta: {
          versionId: like('1'),
          lastUpdated: iso8601DateTimeWithMillis(),
        },
        identifier: eachLike({
          system: 'http://hospital.smarthealthit.org',
          value: term({
            generate: 'MRN123456',
            matcher: '^MRN\\d{6}$',
          }),
        }),
        name: eachLike({
          use: 'official',
          family: like('Doe'),
          given: eachLike('John'),
        }),
        gender: term({
          generate: 'male',
          matcher: 'male|female|other|unknown',
        }),
        birthDate: term({
          generate: '1990-01-01',
          matcher: '^\\d{4}-\\d{2}-\\d{2}$',
        }),
        address: eachLike({
          use: 'home',
          line: eachLike('123 Main St'),
          city: like('Anytown'),
          state: like('NY'),
          postalCode: term({
            generate: '12345',
            matcher: '^\\d{5}(-\\d{4})?$',
          }),
          country: like('US'),
        }),
        telecom: eachLike({
          system: term({
            generate: 'phone',
            matcher: 'phone|fax|email|pager|url|sms|other',
          }),
          value: like('555-0123'),
          use: term({
            generate: 'home',
            matcher: 'home|work|temp|old|mobile',
          }),
        }),
      };

      await provider.addInteraction({
        state: 'A patient exists',
        uponReceiving: 'a request for a patient by ID',
        withRequest: {
          method: 'GET',
          path: '/api/patients/patient-123',
          headers: {
            Authorization: like('Bearer token'),
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedPatient,
        },
      });

      const response = await axios.get(
        `${provider.mockService.baseUrl}/api/patients/patient-123`,
        {
          headers: {
            Authorization: 'Bearer test-token',
            Accept: 'application/json',
          },
        }
      );

      expect(response.data.resourceType).toBe('Patient');
      expect(response.data.id).toBeDefined();
      expect(response.data.name[0].family).toBeDefined();
    });

    it('should return 404 when patient not found', async () => {
      await provider.addInteraction({
        state: 'No patients exist',
        uponReceiving: 'a request for a non-existent patient',
        withRequest: {
          method: 'GET',
          path: '/api/patients/non-existent',
          headers: {
            Authorization: like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Patient not found'),
            code: like('PATIENT_NOT_FOUND'),
          },
        },
      });

      try {
        await axios.get(
          `${provider.mockService.baseUrl}/api/patients/non-existent`,
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toBeDefined();
      }
    });

    it('should return 401 when unauthorized', async () => {
      await provider.addInteraction({
        uponReceiving: 'a request without authorization',
        withRequest: {
          method: 'GET',
          path: '/api/patients/patient-123',
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Unauthorized'),
            code: like('UNAUTHORIZED'),
          },
        },
      });

      try {
        await axios.get(`${provider.mockService.baseUrl}/api/patients/patient-123`);
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('GET /api/patients', () => {
    it('should return a paginated list of patients', async () => {
      const expectedResponse = {
        data: eachLike({
          resourceType: 'Patient',
          id: like('patient-123'),
          name: eachLike({
            family: like('Doe'),
            given: eachLike('John'),
          }),
        }),
        pagination: {
          total: like(100),
          limit: like(20),
          offset: like(0),
          hasNextPage: like(true),
          hasPreviousPage: like(false),
        },
      };

      await provider.addInteraction({
        state: 'Multiple patients exist',
        uponReceiving: 'a request for patient list',
        withRequest: {
          method: 'GET',
          path: '/api/patients',
          query: {
            limit: '20',
            offset: '0',
          },
          headers: {
            Authorization: like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse,
        },
      });

      const response = await axios.get(
        `${provider.mockService.baseUrl}/api/patients?limit=20&offset=0`,
        {
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );

      expect(response.data.data).toBeInstanceOf(Array);
      expect(response.data.pagination).toBeDefined();
      expect(response.data.pagination.total).toBeGreaterThanOrEqual(0);
    });

    it('should support search parameters', async () => {
      await provider.addInteraction({
        state: 'Patients with name John exist',
        uponReceiving: 'a search request for patients named John',
        withRequest: {
          method: 'GET',
          path: '/api/patients',
          query: {
            name: 'John',
            gender: 'male',
          },
          headers: {
            Authorization: like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            data: eachLike({
              resourceType: 'Patient',
              id: like('patient-123'),
              name: eachLike({
                given: eachLike('John'),
              }),
              gender: 'male',
            }),
            pagination: like({
              total: 5,
              limit: 20,
              offset: 0,
            }),
          },
        },
      });

      const response = await axios.get(
        `${provider.mockService.baseUrl}/api/patients?name=John&gender=male`,
        {
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );

      expect(response.data.data).toBeInstanceOf(Array);
      response.data.data.forEach((patient: any) => {
        expect(patient.gender).toBe('male');
      });
    });
  });

  describe('POST /api/patients', () => {
    it('should create a new patient', async () => {
      const newPatient = {
        resourceType: 'Patient',
        identifier: [{
          system: 'http://hospital.smarthealthit.org',
          value: 'MRN789012',
        }],
        name: [{
          use: 'official',
          family: 'Smith',
          given: ['Jane'],
        }],
        gender: 'female',
        birthDate: '1985-05-15',
      };

      const expectedResponse = {
        ...newPatient,
        id: like('patient-456'),
        meta: {
          versionId: like('1'),
          lastUpdated: iso8601DateTimeWithMillis(),
        },
      };

      await provider.addInteraction({
        state: 'Provider is ready to create patients',
        uponReceiving: 'a request to create a patient',
        withRequest: {
          method: 'POST',
          path: '/api/patients',
          headers: {
            Authorization: like('Bearer token'),
            'Content-Type': 'application/json',
          },
          body: newPatient,
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            Location: term({
              generate: '/api/patients/patient-456',
              matcher: '^/api/patients/[a-zA-Z0-9-]+$',
            }),
          },
          body: expectedResponse,
        },
      });

      const response = await axios.post(
        `${provider.mockService.baseUrl}/api/patients`,
        newPatient,
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.id).toBeDefined();
      expect(response.headers.location).toMatch(/^\/api\/patients\/[a-zA-Z0-9-]+$/);
    });

    it('should return validation errors for invalid patient data', async () => {
      const invalidPatient = {
        resourceType: 'Patient',
        // Missing required fields
        gender: 'invalid-gender',
      };

      await provider.addInteraction({
        uponReceiving: 'a request with invalid patient data',
        withRequest: {
          method: 'POST',
          path: '/api/patients',
          headers: {
            Authorization: like('Bearer token'),
            'Content-Type': 'application/json',
          },
          body: invalidPatient,
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Validation failed'),
            code: like('VALIDATION_ERROR'),
            details: eachLike({
              field: like('name'),
              message: like('Name is required'),
            }),
          },
        },
      });

      try {
        await axios.post(
          `${provider.mockService.baseUrl}/api/patients`,
          invalidPatient,
          {
            headers: {
              Authorization: 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.code).toBe('VALIDATION_ERROR');
        expect(error.response.data.details).toBeInstanceOf(Array);
      }
    });
  });
});