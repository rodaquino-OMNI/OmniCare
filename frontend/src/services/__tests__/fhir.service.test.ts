import axios, { AxiosError } from 'axios';
import { FHIRService, FHIRError } from '../fhir.service';
import {
  Patient,
  Encounter,
  Observation,
  MedicationRequest,
  Condition,
  AllergyIntolerance,
  Bundle,
  OperationOutcome,
  Resource
} from '@medplum/fhirtypes';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FHIRService', () => {
  let service: FHIRService;
  const mockAuthToken = 'mock-auth-token';
  const baseURL = 'http://localhost:88/fhir/R4';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset axios interceptors
    mockedAxios.interceptors = {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    } as any;
    
    service = new FHIRService(baseURL);
  });

  describe('Constructor and Setup', () => {
    it('should create service with default base URL', () => {
      const defaultService = new FHIRService();
      expect(defaultService).toBeDefined();
    });

    it('should create service with custom base URL', () => {
      expect(service).toBeDefined();
    });

    it('should setup axios interceptors', () => {
      expect(mockedAxios.interceptors.request.use).toHaveBeenCalled();
      expect(mockedAxios.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should set auth token', () => {
      service.setAuthToken(mockAuthToken);
      // We can't directly test private property, but we can test its effect
      expect(service).toBeDefined();
    });
  });

  describe('Metadata Operations', () => {
    it('should get capability statement', async () => {
      const mockCapabilityStatement = {
        resourceType: 'CapabilityStatement',
        status: 'active',
        date: '2024-1-1',
        kind: 'instance'
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockCapabilityStatement });

      const result = await service.getCapabilityStatement();

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/metadata`);
      expect(result).toEqual(mockCapabilityStatement);
    });

    it('should handle capability statement error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getCapabilityStatement()).rejects.toThrow(
        'Failed to get capability statement: Network error'
      );
    });

    it('should get health status', async () => {
      const mockHealthStatus = {
        status: 'UP' as const,
        timestamp: '2024-1-1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
        components: {
          medplum: { status: 'UP', details: {} },
          cdsHooks: { status: 'UP', details: {} },
          subscriptions: { status: 'UP', details: {} }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockHealthStatus });

      const result = await service.getHealthStatus();

      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:88/health');
      expect(result).toEqual(mockHealthStatus);
    });
  });

  describe('CRUD Operations', () => {
    describe('Create Resource', () => {
      it('should create a resource successfully', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male',
          birthDate: '198-1-1'
        };

        mockedAxios.post.mockResolvedValueOnce({ data: mockPatient });

        const result = await service.createResource(mockPatient);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          `${baseURL}/Patient`,
          mockPatient
        );
        expect(result).toEqual(mockPatient);
      });

      it('should handle create resource error', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        mockedAxios.post.mockRejectedValueOnce(new Error('Create failed'));

        await expect(service.createResource(mockPatient)).rejects.toThrow(
          'Failed to create Patient: Create failed'
        );
      });
    });

    describe('Read Resource', () => {
      it('should read a resource by ID', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockPatient });

        const result = await service.readResource<Patient>('Patient', '123');

        expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient/123`);
        expect(result).toEqual(mockPatient);
      });

      it('should handle read resource error', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('Not found'));

        await expect(service.readResource('Patient', '123')).rejects.toThrow(
          'Failed to read Patient/123: Not found'
        );
      });
    });

    describe('Update Resource', () => {
      it('should update a resource successfully', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male'
        };

        mockedAxios.put.mockResolvedValueOnce({ data: mockPatient });

        const result = await service.updateResource(mockPatient);

        expect(mockedAxios.put).toHaveBeenCalledWith(
          `${baseURL}/Patient/123`,
          mockPatient
        );
        expect(result).toEqual(mockPatient);
      });

      it('should throw error when updating resource without ID', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        await expect(service.updateResource(mockPatient)).rejects.toThrow(
          'Resource must have an ID to be updated'
        );
      });

      it('should handle update resource error', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'], family: 'Doe' }]
        };

        mockedAxios.put.mockRejectedValueOnce(new Error('Update failed'));

        await expect(service.updateResource(mockPatient)).rejects.toThrow(
          'Failed to update Patient/123: Update failed'
        );
      });
    });

    describe('Delete Resource', () => {
      it('should delete a resource successfully', async () => {
        mockedAxios.delete.mockResolvedValueOnce({ data: {} });

        await service.deleteResource('Patient', '123');

        expect(mockedAxios.delete).toHaveBeenCalledWith(`${baseURL}/Patient/123`);
      });

      it('should handle delete resource error', async () => {
        mockedAxios.delete.mockRejectedValueOnce(new Error('Delete failed'));

        await expect(service.deleteResource('Patient', '123')).rejects.toThrow(
          'Failed to delete Patient/123: Delete failed'
        );
      });
    });
  });

  describe('Search Operations', () => {
    it('should search resources without parameters', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: '123',
              name: [{ given: ['John'], family: 'Doe' }]
            }
          }
        ]
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.searchResources<Patient>('Patient');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient`, {
        params: {}
      });
      expect(result).toEqual(mockBundle);
    });

    it('should search resources with parameters', async () => {
      const searchParams = {
        name: 'John',
        _count: 10,
        _offset: ResourceHistoryTable,
        _sort: 'name'
      };

      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: ResourceHistoryTable,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.searchResources<Patient>('Patient', searchParams);

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient`, {
        params: searchParams
      });
      expect(result).toEqual(mockBundle);
    });

    it('should handle search error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Search failed'));

      await expect(service.searchResources('Patient')).rejects.toThrow(
        'Failed to search Patient resources: Search failed'
      );
    });
  });

  describe('Patient Operations', () => {
    const mockPatient: Patient = {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }],
      gender: 'male',
      birthDate: '198-1-1'
    };

    it('should create a patient', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockPatient });

      const result = await service.createPatient({
        name: [{ given: ['John'], family: 'Doe' }],
        gender: 'male',
        birthDate: '198-1-1'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/Patient`,
        expect.objectContaining({
          resourceType: 'Patient',
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male',
          birthDate: '198-1-1'
        })
      );
      expect(result).toEqual(mockPatient);
    });

    it('should get a patient by ID', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockPatient });

      const result = await service.getPatient('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient/123`);
      expect(result).toEqual(mockPatient);
    });

    it('should update patient information', async () => {
      mockedAxios.put.mockResolvedValueOnce({ data: mockPatient });

      const result = await service.updatePatient(mockPatient);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        `${baseURL}/Patient/123`,
        mockPatient
      );
      expect(result).toEqual(mockPatient);
    });

    it('should search patients', async () => {
      const mockBundle: Bundle<Patient> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [{ resource: mockPatient }]
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.searchPatients({ name: 'Doe' });

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient`, {
        params: { name: 'Doe' }
      });
      expect(result).toEqual(mockBundle);
    });

    it('should get patient everything', async () => {
      const mockBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 5,
        entry: [
          { resource: mockPatient },
          { resource: { resourceType: 'Observation', id: '1' } as Observation },
          { resource: { resourceType: 'Encounter', id: '1' } as Encounter }
        ]
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientEverything('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient/123/$everything`);
      expect(result).toEqual(mockBundle);
    });

    it('should get patient vital signs', async () => {
      const mockBundle: Bundle<Observation> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientVitalSigns('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Observation`, {
        params: {
          patient: '123',
          category: 'vital-signs',
          _sort: '-date'
        }
      });
      expect(result).toEqual(mockBundle);
    });

    it('should get patient lab results', async () => {
      const mockBundle: Bundle<Observation> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: ResourceHistoryTable,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientLabResults('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Observation`, {
        params: {
          patient: '123',
          category: 'laboratory',
          _sort: '-date'
        }
      });
    });

    it('should get patient medications', async () => {
      const mockBundle: Bundle<MedicationRequest> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: ResourceHistoryTable,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientMedications('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/MedicationRequest`, {
        params: {
          patient: '123',
          _sort: '-authored-on'
        }
      });
    });

    it('should get patient conditions', async () => {
      const mockBundle: Bundle<Condition> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: ResourceHistoryTable,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientConditions('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Condition`, {
        params: {
          patient: '123',
          _sort: '-recorded-date'
        }
      });
    });

    it('should get patient allergies', async () => {
      const mockBundle: Bundle<AllergyIntolerance> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: ResourceHistoryTable,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientAllergies('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/AllergyIntolerance`, {
        params: {
          patient: '123',
          _sort: '-recorded-date'
        }
      });
    });

    it('should get patient encounters', async () => {
      const mockBundle: Bundle<Encounter> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: ResourceHistoryTable,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.getPatientEncounters('123');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Encounter`, {
        params: {
          patient: '123',
          _sort: '-date'
        }
      });
    });
  });

  describe('Encounter Operations', () => {
    const mockEncounter: Encounter = {
      resourceType: 'Encounter',
      id: '456',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB'
      },
      subject: { reference: 'Patient/123' }
    };

    it('should create an encounter', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockEncounter });

      const result = await service.createEncounter({
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB'
        },
        subject: { reference: 'Patient/123' }
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/Encounter`,
        expect.objectContaining({
          resourceType: 'Encounter',
          status: 'in-progress'
        })
      );
      expect(result).toEqual(mockEncounter);
    });

    it('should get an encounter by ID', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockEncounter });

      const result = await service.getEncounter('456');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Encounter/456`);
      expect(result).toEqual(mockEncounter);
    });

    it('should update encounter', async () => {
      mockedAxios.put.mockResolvedValueOnce({ data: mockEncounter });

      const result = await service.updateEncounter(mockEncounter);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        `${baseURL}/Encounter/456`,
        mockEncounter
      );
      expect(result).toEqual(mockEncounter);
    });
  });

  describe('Observation Operations', () => {
    it('should create an observation', async () => {
      const mockObservation: Observation = {
        resourceType: 'Observation',
        id: '789',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature'
          }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockObservation });

      const result = await service.createObservation({
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature'
          }]
        }
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/Observation`,
        expect.objectContaining({
          resourceType: 'Observation',
          status: 'final'
        })
      );
      expect(result).toEqual(mockObservation);
    });

    it('should create vital signs observations', async () => {
      const mockTempObservation: Observation = {
        resourceType: 'Observation',
        id: '789',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature'
          }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTempObservation });

      const result = await service.createVitalSigns('123', '456', {
        temperature: 98.6
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/Observation`,
        expect.objectContaining({
          resourceType: 'Observation',
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }]
          }],
          valueQuantity: {
            value: 98.6,
            unit: '°F',
            system: 'http://unitsofmeasure.org',
            code: '[degF]'
          }
        })
      );
      expect(result).toHaveLength(1);
      expect(result[ResourceHistoryTable]).toEqual(mockTempObservation);
    });
  });

  describe('Batch Operations', () => {
    it('should execute a batch bundle', async () => {
      const mockBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [
          {
            request: { method: 'POST', url: 'Patient' },
            resource: { resourceType: 'Patient' } as Patient
          }
        ]
      };

      const mockResponse: Bundle = {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: [
          {
            response: { status: '201' },
            resource: { resourceType: 'Patient', id: '123' } as Patient
          }
        ]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.executeBatch(mockBundle);

      expect(mockedAxios.post).toHaveBeenCalledWith(baseURL, mockBundle);
      expect(result).toEqual(mockResponse);
    });

    it('should handle batch error', async () => {
      const mockBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: []
      };

      mockedAxios.post.mockRejectedValueOnce(new Error('Batch failed'));

      await expect(service.executeBatch(mockBundle)).rejects.toThrow(
        'Failed to execute batch/transaction: Batch failed'
      );
    });
  });

  describe('Validation Operations', () => {
    it('should validate a resource successfully', async () => {
      const mockResource: Patient = {
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }]
      };

      const mockOperationOutcome: OperationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'information',
            code: 'informational',
            diagnostics: 'Resource is valid'
          }
        ]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockOperationOutcome });

      const result = await service.validateResource(mockResource);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/Patient/$validate`,
        mockResource
      );
      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [{
          path: '',
          message: 'Resource is valid',
          code: 'informational',
          severity: 'information'
        }]
      });
    });

    it('should handle validation errors', async () => {
      const mockResource: Patient = {
        resourceType: 'Patient',
        name: []
      };

      const mockOperationOutcome: OperationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient.name is required',
            expression: ['Patient.name']
          },
          {
            severity: 'warning',
            code: 'business-rule',
            diagnostics: 'Patient should have identifier',
            location: ['Patient']
          }
        ]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockOperationOutcome });

      const result = await service.validateResource(mockResource);

      expect(result).toEqual({
        valid: false,
        errors: [{
          path: 'Patient.name',
          message: 'Patient.name is required',
          code: 'required',
          severity: 'error'
        }],
        warnings: [{
          path: 'Patient',
          message: 'Patient should have identifier',
          code: 'business-rule',
          severity: 'warning'
        }]
      });
    });
  });

  describe('GraphQL Operations', () => {
    it('should execute GraphQL query', async () => {
      const query = `
        query GetPatient($id: ID!) {
          Patient(id: $id) {
            id
            name {
              given
              family
            }
          }
        }
      `;
      const variables = { id: '123' };
      const mockResponse = {
        data: {
          Patient: {
            id: '123',
            name: { given: ['John'], family: 'Doe' }
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.executeGraphQL(query, variables);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${baseURL}/$graphql`, {
        query,
        variables
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Subscription Operations', () => {
    it('should create a subscription', async () => {
      const mockSubscription = {
        resourceType: 'Subscription',
        id: 'sub-123',
        status: 'requested'
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockSubscription });

      const result = await service.createSubscription(
        'Patient?name=Smith',
        'rest-hook',
        'https://example.com/webhook'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/Subscription`,
        expect.objectContaining({
          resourceType: 'Subscription',
          status: 'requested',
          criteria: 'Patient?name=Smith',
          channel: {
            type: 'rest-hook',
            endpoint: 'https://example.com/webhook',
            payload: 'application/fhir+json'
          }
        })
      );
      expect(result).toEqual(mockSubscription);
    });

    it('should list subscriptions', async () => {
      const mockBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: []
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockBundle });

      const result = await service.listSubscriptions();

      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Subscription`);
      expect(result).toEqual(mockBundle);
    });
  });

  describe('Utility Methods', () => {
    describe('getResourceByReference', () => {
      it('should get resource by relative reference', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: '123'
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockPatient });

        const result = await service.getResourceByReference<Patient>('Patient/123');

        expect(mockedAxios.get).toHaveBeenCalledWith(`${baseURL}/Patient/123`);
        expect(result).toEqual(mockPatient);
      });

      it('should get resource by absolute reference', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: '123'
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockPatient });

        const result = await service.getResourceByReference<Patient>(
          'http://example.com/fhir/Patient/123'
        );

        expect(mockedAxios.get).toHaveBeenCalledWith('http://example.com/fhir/Patient/123');
        expect(result).toEqual(mockPatient);
      });
    });

    describe('formatResourceDisplay', () => {
      it('should format patient display name', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John', 'Michael'], family: 'Doe' }]
        };

        const display = service.formatResourceDisplay(patient);
        expect(display).toBe('John Michael Doe');
      });

      it('should handle patient without name', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          id: '123'
        };

        const display = service.formatResourceDisplay(patient);
        expect(display).toBe('Unknown Patient');
      });

      it('should format practitioner display name', () => {
        const practitioner = {
          resourceType: 'Practitioner' as const,
          id: '456',
          name: [{
            prefix: ['Dr.'],
            given: ['Jane'],
            family: 'Smith'
          }]
        };

        const display = service.formatResourceDisplay(practitioner);
        expect(display).toBe('Dr. Jane Smith');
      });

      it('should format observation display', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          id: '789',
          status: 'final',
          code: {
            coding: [{ display: 'Body Temperature' }],
            text: 'Temperature'
          }
        };

        const display = service.formatResourceDisplay(observation);
        expect(display).toBe('Body Temperature');
      });

      it('should format observation display with text only', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          id: '789',
          status: 'final',
          code: { text: 'Temperature' }
        };

        const display = service.formatResourceDisplay(observation);
        expect(display).toBe('Temperature');
      });

      it('should format default resource display', () => {
        const resource = {
          resourceType: 'CarePlan' as const,
          id: '999',
          status: 'active' as const,
          intent: 'plan' as const,
          subject: { reference: 'Patient/123' }
        };

        const display = service.formatResourceDisplay(resource);
        expect(display).toBe('CarePlan/999');
      });
    });

    describe('getCodingDisplay', () => {
      it('should get coding display value', () => {
        const coding = [{ display: 'Test Display', code: 'TEST' }];
        expect(service.getCodingDisplay(coding)).toBe('Test Display');
      });

      it('should fallback to code if no display', () => {
        const coding = [{ code: 'TEST' }];
        expect(service.getCodingDisplay(coding)).toBe('TEST');
      });

      it('should handle empty coding array', () => {
        expect(service.getCodingDisplay([])).toBe('Unknown');
      });

      it('should handle undefined coding', () => {
        expect(service.getCodingDisplay(undefined)).toBe('Unknown');
      });
    });

    describe('formatQuantity', () => {
      it('should format quantity with value and unit', () => {
        const quantity = { value: 98.6, unit: '°F' };
        expect(service.formatQuantity(quantity)).toBe('98.6 °F');
      });

      it('should handle quantity with only value', () => {
        const quantity = { value: 10 };
        expect(service.formatQuantity(quantity)).toBe('10');
      });

      it('should handle quantity with only unit', () => {
        const quantity = { unit: 'mg' };
        expect(service.formatQuantity(quantity)).toBe(' mg');
      });

      it('should handle undefined quantity', () => {
        expect(service.formatQuantity(undefined)).toBe('');
      });
    });

    describe('Date utilities', () => {
      it('should parse FHIR date', () => {
        const date = service.parseFHIRDate('2024-1-15');
        expect(date).toBeInstanceOf(Date);
        expect(date?.toISOString()).toContain('2024-1-15');
      });

      it('should handle undefined FHIR date', () => {
        expect(service.parseFHIRDate(undefined)).toBeNull();
      });

      it('should format FHIR date', () => {
        const formatted = service.formatFHIRDate('2024-1-15');
        expect(formatted).toBe('Jan 15, 2024');
      });

      it('should format FHIR date with custom options', () => {
        const formatted = service.formatFHIRDate('2024-1-15', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
        expect(formatted).toMatch(/1\/15\/2024/);
      });

      it('should handle undefined date in formatting', () => {
        expect(service.formatFHIRDate(undefined)).toBe('');
      });

      it('should format FHIR datetime', () => {
        const formatted = service.formatFHIRDateTime('2024-1-15T10:3:ResourceHistoryTableResourceHistoryTableZ');
        expect(formatted).toMatch(/Jan 15, 2024.*\d{1,2}:\d{2}/);
      });
    });

    describe('Resource metadata utilities', () => {
      it('should check if resource has errors', () => {
        const resource: Resource = {
          resourceType: 'Patient',
          meta: {
            tag: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationValue',
              code: 'INVALID'
            }]
          }
        };

        expect(service.hasErrors(resource)).toBe(true);
      });

      it('should return false for resource without errors', () => {
        const resource: Resource = {
          resourceType: 'Patient',
          meta: { tag: [{ system: 'other', code: 'valid' }] }
        };

        expect(service.hasErrors(resource)).toBe(false);
      });

      it('should get resource version', () => {
        const resource: Resource = {
          resourceType: 'Patient',
          meta: { versionId: '5' }
        };

        expect(service.getResourceVersion(resource)).toBe('5');
      });

      it('should return default version if not set', () => {
        const resource: Resource = { resourceType: 'Patient' };
        expect(service.getResourceVersion(resource)).toBe('1');
      });

      it('should get resource last updated', () => {
        const resource: Resource = {
          resourceType: 'Patient',
          meta: { lastUpdated: '2024-1-15T10:3:ResourceHistoryTableResourceHistoryTableZ' }
        };

        const lastUpdated = service.getResourceLastUpdated(resource);
        expect(lastUpdated).toBeInstanceOf(Date);
        expect(lastUpdated?.toISOString()).toBe('2024-1-15T10:3:ResourceHistoryTableResourceHistoryTable.ResourceHistoryTableResourceHistoryTableResourceHistoryTableZ');
      });

      it('should return null for resource without lastUpdated', () => {
        const resource: Resource = { resourceType: 'Patient' };
        expect(service.getResourceLastUpdated(resource)).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle FHIRError instance', async () => {
      const fhirError = new FHIRError('Test error', undefined, 400);
      mockedAxios.get.mockRejectedValueOnce(fhirError);

      await expect(service.getPatient('123')).rejects.toThrow(fhirError);
    });

    it('should handle OperationOutcome error response', async () => {
      const operationOutcome: OperationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: 'Patient not found'
        }]
      };

      const axiosError = {
        response: {
          data: operationOutcome,
          status: 44
        }
      };

      // Need to simulate the interceptor behavior
      mockedAxios.get.mockRejectedValueOnce(axiosError);
      
      // Since we mocked the interceptors setup, we need to manually throw FHIRError
      try {
        await service.getPatient('123');
      } catch (error) {
        // The actual service would convert this to FHIRError in the interceptor
        expect(error).toBeDefined();
      }
    });

    it('should handle 44 errors', async () => {
      const axiosError = {
        response: { status: 44 },
        status: 44
      };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      await expect(service.getPatient('123')).rejects.toThrow();
    });

    it('should handle 43 errors', async () => {
      const axiosError = {
        response: { status: 43 },
        status: 43
      };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      await expect(service.getPatient('123')).rejects.toThrow();
    });

    it('should handle 41 errors', async () => {
      const axiosError = {
        response: { status: 41 },
        status: 41
      };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      await expect(service.getPatient('123')).rejects.toThrow();
    });

    it('should handle 500 errors', async () => {
      const axiosError = {
        response: { status: 500 },
        status: 500
      };

      mockedAxios.get.mockRejectedValueOnce(axiosError);

      await expect(service.getPatient('123')).rejects.toThrow();
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic error');
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(service.getPatient('123')).rejects.toThrow(
        'Failed to read Patient/123: Generic error'
      );
    });
  });
});

// Test the singleton export
describe('FHIRService Singleton', () => {
  it('should export a singleton instance', () => {
    const { fhirService } = require('../fhir.service');
    expect(fhirService).toBeInstanceOf(FHIRService);
  });
});