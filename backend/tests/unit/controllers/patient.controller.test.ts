import { Bundle, Patient, OperationOutcome } from '@medplum/fhirtypes';
import { Request, Response } from 'express';

import { PatientController } from '../../../src/controllers/patient.controller';
import { auditService } from '../../../src/services/audit.service';
import { fhirResourcesService } from '../../../src/services/fhir-resources.service';
import { medplumService } from '../../../src/services/medplum.service';
import { createMockUser } from '../../test-helpers';

// Mock dependencies
jest.mock('../../../src/services/medplum.service');
jest.mock('../../../src/services/fhir-resources.service');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fhir: jest.fn()
  }
}));

describe('PatientController', () => {
  let patientController: PatientController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    patientController = new PatientController();
    
    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: createMockUser({
        id: 'user-123',
        role: 'physician',
        permissions: ['patient:read', 'patient:write']
      }),
      headers: {},
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      location: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('searchPatients', () => {
    it('should search patients with name filter', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              name: [{ given: ['John'], family: 'Doe' }],
              birthDate: '1980-01-01'
            }
          },
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-2',
              name: [{ given: ['Jane'], family: 'Doe' }],
              birthDate: '1985-05-15'
            }
          }
        ]
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { name: 'Doe' };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        name: 'Doe',
        _count: 10,
        _sort: '-_lastUpdated'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockBundle);
    });

    it('should search patients with DOB filter', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              name: [{ given: ['John'], family: 'Doe' }],
              birthDate: '1980-01-01'
            }
          }
        ]
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { birthdate: '1980-01-01' };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        birthdate: '1980-01-01',
        _count: 10,
        _sort: '-_lastUpdated'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockBundle);
    });

    it('should search patients with MRN (identifier) filter', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              identifier: [{
                system: 'http://hospital.org/mrn',
                value: 'MRN12345'
              }],
              name: [{ given: ['John'], family: 'Doe' }]
            }
          }
        ]
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { identifier: 'MRN12345' };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        identifier: 'MRN12345',
        _count: 10,
        _sort: '-_lastUpdated'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockBundle);
    });

    it('should search patients with phone filter', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              telecom: [{ system: 'phone', value: '555-0123' }],
              name: [{ given: ['John'], family: 'Doe' }]
            }
          }
        ]
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { phone: '555-0123' };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        phone: '555-0123',
        _count: 10,
        _sort: '-_lastUpdated'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockBundle);
    });

    it('should handle pagination parameters', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 50,
        entry: []
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { 
        _count: '20',
        _offset: '40',
        _sort: 'name'
      };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        _count: 20,
        _offset: 40,
        _sort: 'name'
      });
    });

    it('should handle multiple filters simultaneously', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { 
        name: 'Doe',
        birthdate: '1980',
        gender: 'male',
        _count: '5'
      };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        name: 'Doe',
        birthdate: '1980',
        gender: 'male',
        _count: 5,
        _sort: '-_lastUpdated'
      });
    });

    it('should handle errors gracefully', async () => {
      (medplumService.searchResources as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to search patients'
        }]
      });
    });
  });

  describe('getPatientProfile', () => {
    it('should retrieve comprehensive patient profile', async () => {
      const mockPatient: Patient = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['John'], family: 'Doe' }],
        birthDate: '1980-01-01',
        gender: 'male'
      };

      const mockProfileBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          { resource: mockPatient },
          { 
            resource: {
              resourceType: 'Condition',
              id: 'condition-1',
              subject: { reference: 'Patient/patient-123' },
              code: { text: 'Hypertension' }
            }
          },
          {
            resource: {
              resourceType: 'MedicationRequest',
              id: 'med-1',
              subject: { reference: 'Patient/patient-123' },
              medicationCodeableConcept: { text: 'Lisinopril' },
              status: 'active',
              intent: 'order'
            }
          },
          {
            resource: {
              resourceType: 'AllergyIntolerance',
              id: 'allergy-1',
              patient: { reference: 'Patient/patient-123' },
              code: { text: 'Penicillin' }
            }
          }
        ]
      };

      (fhirResourcesService.getPatientEverything as jest.Mock).mockResolvedValue(mockProfileBundle);

      mockRequest.params = { id: 'patient-123' };

      await patientController.getPatientProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(fhirResourcesService.getPatientEverything).toHaveBeenCalledWith('patient-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        patient: mockPatient,
        conditions: [expect.objectContaining({ resourceType: 'Condition' })],
        medications: [expect.objectContaining({ resourceType: 'MedicationRequest' })],
        allergies: [expect.objectContaining({ resourceType: 'AllergyIntolerance' })],
        recentEncounters: [],
        vitals: [],
        immunizations: []
      });
    });

    it('should handle patient not found', async () => {
      (fhirResourcesService.getPatientEverything as jest.Mock).mockRejectedValue(
        new Error('Patient not found')
      );

      mockRequest.params = { id: 'nonexistent-patient' };

      await patientController.getPatientProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: 'Patient not found'
        }]
      });
    });
  });

  describe('createPatient', () => {
    it('should create a new patient', async () => {
      const newPatient: Patient = {
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }],
        birthDate: '1980-01-01',
        gender: 'male',
        telecom: [
          { system: 'phone', value: '555-0123' },
          { system: 'email', value: 'john.doe@example.com' }
        ]
      };

      const createdPatient: Patient = {
        ...newPatient,
        id: 'patient-123',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T00:00:00Z'
        }
      };

      (medplumService.createResource as jest.Mock).mockResolvedValue(createdPatient);

      mockRequest.body = newPatient;

      await patientController.createPatient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.createResource).toHaveBeenCalledWith(newPatient);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.location).toHaveBeenCalledWith('/fhir/R4/Patient/patient-123');
      expect(mockResponse.json).toHaveBeenCalledWith(createdPatient);
      expect(auditService.logAccess).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'CREATE',
        resourceType: 'Patient',
        resourceId: 'patient-123',
        outcome: 'SUCCESS',
        ipAddress: '127.0.0.1'
      });
    });

    it('should validate required fields', async () => {
      const invalidPatient = {
        resourceType: 'Patient'
        // Missing required fields like name
      };

      mockRequest.body = invalidPatient;

      await patientController.createPatient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'required',
          diagnostics: 'Patient name is required'
        }]
      });
    });
  });

  describe('updatePatient', () => {
    it('should update an existing patient', async () => {
      const updatedPatient: Patient = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['John', 'Updated'], family: 'Doe' }],
        birthDate: '1980-01-01',
        gender: 'male'
      };

      (medplumService.updateResource as jest.Mock).mockResolvedValue(updatedPatient);

      mockRequest.params = { id: 'patient-123' };
      mockRequest.body = updatedPatient;

      await patientController.updatePatient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.updateResource).toHaveBeenCalledWith(updatedPatient);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedPatient);
      expect(auditService.logAccess).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'UPDATE',
        resourceType: 'Patient',
        resourceId: 'patient-123',
        outcome: 'SUCCESS',
        ipAddress: '127.0.0.1'
      });
    });

    it('should handle update for non-existent patient', async () => {
      (medplumService.updateResource as jest.Mock).mockRejectedValue(
        new Error('Patient not found')
      );

      mockRequest.params = { id: 'nonexistent-patient' };
      mockRequest.body = {
        resourceType: 'Patient',
        id: 'nonexistent-patient',
        name: [{ given: ['Test'], family: 'Patient' }]
      };

      await patientController.updatePatient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: 'Patient not found'
        }]
      });
    });
  });

  describe('Mobile Optimization Features', () => {
    it('should support partial resource loading with _elements', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 10,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              name: [{ given: ['John'], family: 'Doe' }]
              // Other fields omitted due to _elements
            }
          }
        ]
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { 
        _elements: 'id,name',
        _count: '5'
      };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        _elements: 'id,name',
        _count: 5,
        _sort: '-_lastUpdated'
      });
    });

    it('should support summary mode for mobile', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 20,
        entry: []
      };

      (medplumService.searchResources as jest.Mock).mockResolvedValue(mockBundle);

      mockRequest.query = { 
        _summary: 'true',
        _count: '10'
      };

      await patientController.searchPatients(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(medplumService.searchResources).toHaveBeenCalledWith('Patient', {
        _summary: 'true',
        _count: 10,
        _sort: '-_lastUpdated'
      });
    });
  });
});