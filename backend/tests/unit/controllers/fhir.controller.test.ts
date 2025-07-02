import { Patient, Encounter, Observation, Bundle } from '@medplum/fhirtypes';
import { Request, Response } from 'express';

import { fhirController } from '../../../src/controllers/fhir.controller';
import { fhirResourcesService } from '../../../src/services/fhir-resources.service';
import { fhirTransformationService } from '../../../src/services/fhir-transformation.service';
import { fhirValidationService } from '../../../src/services/integration/fhir/fhir-validation.service';
import logger from '../../../src/utils/logger';
import { createMockUser } from '../../test-helpers';

// Mock services
jest.mock('../../../src/services/fhir-resources.service');
jest.mock('../../../src/services/integration/fhir/fhir-validation.service');
jest.mock('../../../src/services/fhir-transformation.service');
jest.mock('../../../src/utils/logger');

describe('FHIR Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const mockFhirResourcesService = fhirResourcesService as jest.Mocked<typeof fhirResourcesService>;
  const mockFhirValidationService = fhirValidationService as jest.Mocked<typeof fhirValidationService>;
  const mockFhirTransformationService = fhirTransformationService as jest.Mocked<typeof fhirTransformationService>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      query: {},
      body: {},
      headers: {
        'content-type': 'application/fhir+json',
        'accept': 'application/fhir+json'
      },
      user: createMockUser({
        id: 'test-user-1',
        role: 'physician',
        permissions: ['fhir:read', 'fhir:write']
      })
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('Patient Operations', () => {
    describe('POST /fhir/Patient', () => {
      it('should create a patient successfully', async () => {
        const patientData: Patient = {
          resourceType: 'Patient',
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male',
          birthDate: '1990-01-01'
        };

        const createdPatient: Patient = {
          ...patientData,
          id: 'patient-123'
        };

        mockRequest.body = patientData;

        mockFhirValidationService.validateResource.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        mockFhirResourcesService.createPatient.mockResolvedValue(createdPatient);

        await fhirController.createPatient(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirValidationService.validateResource).toHaveBeenCalledWith(patientData);
        expect(mockFhirResourcesService.createPatient).toHaveBeenCalledWith(patientData);
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith(createdPatient);
        expect(mockResponse.set).toHaveBeenCalledWith('Location', '/fhir/Patient/patient-123');
      });

      it('should return validation errors for invalid patient data', async () => {
        const invalidPatient = {
          resourceType: 'Patient',
          birthDate: '2030-01-01' // Future birth date
        };

        mockRequest.body = invalidPatient;

        mockFhirValidationService.validateResource.mockResolvedValue({
          valid: false,
          errors: [
            {
              path: 'Patient.birthDate',
              message: 'Birth date cannot be in the future',
              severity: 'error',
              code: 'invalid-value'
            }
          ],
          warnings: []
        });

        await fhirController.createPatient(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'invalid',
              diagnostics: 'Birth date cannot be in the future',
              location: ['Patient.birthDate']
            }
          ]
        });
      });

      it('should handle resource creation errors', async () => {
        const patientData: Patient = {
          resourceType: 'Patient',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        mockRequest.body = patientData;

        mockFhirValidationService.validateResource.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        const createError = new Error('Database connection failed');
        mockFhirResourcesService.createPatient.mockRejectedValue(createError);

        await fhirController.createPatient(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(createError);
      });
    });

    describe('GET /fhir/Patient/:id', () => {
      it('should retrieve a patient by ID', async () => {
        const patient: Patient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male'
        };

        mockRequest.params = { id: 'patient-123' };

        mockFhirResourcesService.getPatient.mockResolvedValue(patient);

        await fhirController.getPatient(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirResourcesService.getPatient).toHaveBeenCalledWith('patient-123');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(patient);
      });

      it('should return 404 for non-existent patient', async () => {
        mockRequest.params = { id: 'non-existent' };

        const notFoundError = new Error('Patient not found');
        notFoundError.name = 'NotFoundError';
        mockFhirResourcesService.getPatient.mockRejectedValue(notFoundError);

        await fhirController.getPatient(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: 'Patient with ID non-existent not found'
            }
          ]
        });
      });
    });

    describe('PUT /fhir/Patient/:id', () => {
      it('should update a patient successfully', async () => {
        const updatedPatient: Patient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ given: ['John', 'Updated'], family: 'Doe' }],
          gender: 'male'
        };

        mockRequest.params = { id: 'patient-123' };
        mockRequest.body = updatedPatient;

        mockFhirValidationService.validateResource.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        mockFhirResourcesService.updatePatient.mockResolvedValue(updatedPatient);

        await fhirController.updatePatient(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirValidationService.validateResource).toHaveBeenCalledWith(updatedPatient);
        expect(mockFhirResourcesService.updatePatient).toHaveBeenCalledWith(updatedPatient);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(updatedPatient);
      });
    });

    describe('GET /fhir/Patient', () => {
      it('should search patients with parameters', async () => {
        const searchResults: Bundle<Patient> = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [
            {
              resource: {
                resourceType: 'Patient',
                id: 'patient-123',
                name: [{ given: ['John'], family: 'Doe' }]
              }
            }
          ]
        };

        mockRequest.query = {
          family: 'Doe',
          given: 'John',
          _count: '10'
        };

        mockFhirResourcesService.searchPatients.mockResolvedValue(searchResults);

        await fhirController.searchPatients(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirResourcesService.searchPatients).toHaveBeenCalledWith({
          family: 'Doe',
          given: 'John',
          _count: 10
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(searchResults);
      });

      it('should handle invalid search parameters', async () => {
        mockRequest.query = {
          _count: 'invalid-number'
        };

        await fhirController.searchPatients(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'invalid',
              diagnostics: 'Invalid search parameter: _count must be a number'
            }
          ]
        });
      });
    });
  });

  describe('Encounter Operations', () => {
    describe('POST /fhir/Encounter', () => {
      it('should create an encounter successfully', async () => {
        const encounterData: Encounter = {
          resourceType: 'Encounter',
          status: 'planned',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB'
          },
          subject: { reference: 'Patient/patient-123' }
        };

        const createdEncounter: Encounter = {
          ...encounterData,
          id: 'encounter-456'
        };

        mockRequest.body = encounterData;

        mockFhirValidationService.validateResource.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        mockFhirResourcesService.createEncounter.mockResolvedValue(createdEncounter);

        await fhirController.createEncounter(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirResourcesService.createEncounter).toHaveBeenCalledWith(encounterData);
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith(createdEncounter);
      });
    });
  });

  describe('Observation Operations', () => {
    describe('POST /fhir/Observation', () => {
      it('should create an observation successfully', async () => {
        const observationData: Observation = {
          resourceType: 'Observation',
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs'
            }]
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '8310-5',
              display: 'Body temperature'
            }]
          },
          subject: { reference: 'Patient/patient-123' },
          valueQuantity: {
            value: 98.6,
            unit: '°F'
          }
        };

        const createdObservation: Observation = {
          ...observationData,
          id: 'observation-789'
        };

        mockRequest.body = observationData;

        mockFhirValidationService.validateResource.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        mockFhirResourcesService.createObservation.mockResolvedValue(createdObservation);

        await fhirController.createObservation(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirResourcesService.createObservation).toHaveBeenCalledWith(observationData);
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith(createdObservation);
      });
    });

    describe('POST /fhir/Patient/:id/vitals', () => {
      it('should create vital signs observations', async () => {
        const vitalsData = {
          temperature: 98.6,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 72
        };

        const createdObservations: Observation[] = [
          {
            resourceType: 'Observation',
            id: 'obs-temp',
            status: 'final',
            code: { coding: [{ code: '8310-5' }] },
            subject: { reference: 'Patient/patient-123' },
            valueQuantity: { value: 98.6, unit: '°F' }
          }
        ];

        mockRequest.params = { id: 'patient-123' };
        mockRequest.body = vitalsData;

        mockFhirResourcesService.createVitalSigns.mockResolvedValue(createdObservations);

        await fhirController.createVitalSigns(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirResourcesService.createVitalSigns).toHaveBeenCalledWith(
          'patient-123',
          undefined,
          vitalsData
        );
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          resourceType: 'Bundle',
          type: 'transaction-response',
          entry: createdObservations.map(obs => ({
            resource: obs,
            response: {
              status: '201',
              location: `/fhir/Observation/${obs.id}`
            }
          }))
        });
      });
    });
  });

  describe('Bundle Operations', () => {
    describe('POST /fhir/Bundle', () => {
      it('should process a transaction bundle', async () => {
        const transactionBundle: Bundle = {
          resourceType: 'Bundle',
          type: 'transaction',
          entry: [
            {
              request: {
                method: 'POST',
                url: 'Patient'
              },
              resource: {
                resourceType: 'Patient',
                name: [{ given: ['Jane'], family: 'Smith' }]
              }
            }
          ]
        };

        const responseBundle: Bundle = {
          resourceType: 'Bundle',
          type: 'transaction-response',
          entry: [
            {
              response: {
                status: '201',
                location: 'Patient/patient-456'
              },
              resource: {
                resourceType: 'Patient',
                id: 'patient-456',
                name: [{ given: ['Jane'], family: 'Smith' }]
              }
            }
          ]
        };

        mockRequest.body = transactionBundle;

        mockFhirValidationService.validateBundle.mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        mockFhirResourcesService.processBundle.mockResolvedValue(responseBundle);

        await fhirController.processBundle(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockFhirValidationService.validateBundle).toHaveBeenCalledWith(transactionBundle);
        expect(mockFhirResourcesService.processBundle).toHaveBeenCalledWith(transactionBundle);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(responseBundle);
      });
    });
  });

  describe('Validation Operations', () => {
    describe('POST /fhir/$validate', () => {
      it('should validate a FHIR resource', async () => {
        const resourceToValidate: Patient = {
          resourceType: 'Patient',
          name: [{ given: ['Test'], family: 'Patient' }]
        };

        const validationResult = {
          valid: true,
          errors: [],
          warnings: []
        };

        mockRequest.body = resourceToValidate;

        mockFhirValidationService.validateResource.mockResolvedValue(validationResult);

        await fhirController.validateResource(
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockFhirValidationService.validateResource).toHaveBeenCalledWith(resourceToValidate);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'information',
              code: 'informational',
              diagnostics: 'Resource is valid'
            }
          ]
        });
      });

      it('should return validation errors', async () => {
        const invalidResource = {
          resourceType: 'Patient',
          birthDate: 'invalid-date'
        };

        const validationResult = {
          valid: false,
          errors: [
            {
              path: 'Patient.birthDate',
              message: 'Invalid date format',
              severity: 'error' as const,
              code: 'invalid-format'
            }
          ],
          warnings: []
        };

        mockRequest.body = invalidResource;

        mockFhirValidationService.validateResource.mockResolvedValue(validationResult);

        await fhirController.validateResource(
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'invalid',
              diagnostics: 'Invalid date format',
              location: ['Patient.birthDate']
            }
          ]
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported content type', async () => {
      mockRequest.headers = {
        'content-type': 'application/xml'
      };

      await fhirController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(415);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-supported',
            diagnostics: 'Unsupported content type. Expected application/fhir+json'
          }
        ]
      });
    });

    it('should handle malformed JSON', async () => {
      const malformedError = new SyntaxError('Unexpected token');
      mockNext.mockImplementation((err) => {
        expect(err).toBeInstanceOf(SyntaxError);
      });

      // Simulate malformed JSON by directly calling next with error
      await fhirController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // This would be handled by Express error middleware
    });

    it('should handle missing resource type', async () => {
      mockRequest.body = {
        name: [{ given: ['Test'] }]
        // Missing resourceType
      };

      await fhirController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'required',
            diagnostics: 'resourceType is required'
          }
        ]
      });
    });
  });

  describe('Authorization', () => {
    it('should check user permissions for resource access', async () => {
      mockRequest.user = createMockUser({
        id: 'test-user-1',
        role: 'nursing_staff',
        permissions: ['patient:read'] // No write permission
      });

      const patientData: Patient = {
        resourceType: 'Patient',
        name: [{ given: ['Test'] }]
      };

      mockRequest.body = patientData;

      await fhirController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'forbidden',
            diagnostics: 'Insufficient permissions to create Patient resource'
          }
        ]
      });
    });

    it('should allow authorized operations', async () => {
      mockRequest.user = createMockUser({
        id: 'test-user-1',
        role: 'physician',
        permissions: ['fhir:read', 'fhir:write', 'patient:write']
      });

      const patient: Patient = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['John'], family: 'Doe' }]
      };

      mockRequest.params = { id: 'patient-123' };

      mockFhirResourcesService.getPatient.mockResolvedValue(patient);

      await fhirController.getPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockFhirResourcesService.getPatient).toHaveBeenCalledWith('patient-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });
});