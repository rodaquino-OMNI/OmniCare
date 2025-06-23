// Mock dependencies before imports
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config', () => ({
  medplum: {
    baseUrl: 'https://api.medplum.com/',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    projectId: 'test-project-id',
    selfHosted: false,
    selfHostedUrl: 'http://localhost:8103',
  },
}));

import { MedplumService } from '../../../src/services/medplum.service';
import logger from '../../../src/utils/logger';
import config from '../../../src/config';
import { Bundle, Resource, Patient } from '@medplum/fhirtypes';

describe('MedplumService', () => {
  let service: MedplumService;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh service instance for each test
    service = new MedplumService();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration for SaaS', async () => {
      const mockProfile = { resourceType: 'ProfileResource', id: 'profile-123' };
      
      // Spy on the medplum client methods
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue(mockProfile as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));

      await service.initialize();

      expect(service['isInitialized']).toBe(true);
      expect(service['medplum'].startClientLogin).toHaveBeenCalledWith(
        config.medplum.clientId,
        config.medplum.clientSecret
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Medplum FHIR server connection established successfully');
    });

    it('should initialize with correct configuration for self-hosted', async () => {
      // Mock self-hosted configuration
      const originalConfig = { ...config.medplum };
      config.medplum.selfHosted = true;

      // Create new service instance with self-hosted config
      service = new MedplumService();
      
      const mockProfile = { resourceType: 'ProfileResource', id: 'profile-123' };
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue(mockProfile as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));

      await service.initialize();

      expect(service['isInitialized']).toBe(true);

      // Restore original config
      config.medplum = originalConfig;
    });

    it('should handle initialization failure with retry', async () => {
      const error = new Error('Connection failed');
      jest.spyOn(service['medplum'], 'startClientLogin').mockRejectedValue(error);

      // Use fake timers to control setTimeout
      jest.useFakeTimers();
      
      const initPromise = service.initialize();
      
      // Advance timers to trigger retry
      jest.advanceTimersByTime(2000);
      
      // Second attempt should also fail
      
      jest.useRealTimers();

      await expect(initPromise).rejects.toThrow('Failed to initialize Medplum FHIR server');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize Medplum FHIR server after multiple attempts',
        { error: expect.any(String) }
      );
    });

    it('should throw error after max reconnection attempts', async () => {
      const error = new Error('Connection failed');
      jest.spyOn(service['medplum'], 'startClientLogin').mockRejectedValue(error);
      
      // Set reconnect attempts to max
      service['reconnectAttempts'] = 5;

      await expect(service.initialize()).rejects.toThrow('Failed to initialize Medplum FHIR server');
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      // Initialize service for each test
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    describe('createResource', () => {
      it('should create a resource successfully', async () => {
        const resource: Patient = {
          resourceType: 'Patient',
          name: [{ given: ['John'], family: 'Doe' }],
        };
        const createdResource = { ...resource, id: '123' };

        jest.spyOn(service['medplum'], 'createResource').mockResolvedValue(createdResource);

        const result = await service.createResource(resource);

        expect(result).toEqual(createdResource);
        expect(service['medplum'].createResource).toHaveBeenCalledWith(resource);
        expect(mockLogger.fhir).toHaveBeenCalledWith(
          'Resource created successfully',
          expect.objectContaining({ resourceType: 'Patient' })
        );
      });

      it('should handle creation errors', async () => {
        const resource: Patient = { resourceType: 'Patient' };
        const error = new Error('Creation failed');

        jest.spyOn(service['medplum'], 'createResource').mockRejectedValue(error);

        await expect(service.createResource(resource)).rejects.toThrow('Failed to create resource');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to create resource',
          expect.objectContaining({ resourceType: 'Patient' })
        );
      });

      it('should handle FHIR operation outcome errors', async () => {
        const resource: Patient = { resourceType: 'Patient' };
        const operationOutcome = {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Invalid resource' }]
        };

        jest.spyOn(service['medplum'], 'createResource').mockRejectedValue({ 
          response: { data: operationOutcome } 
        });

        await expect(service.createResource(resource)).rejects.toThrow('Failed to create resource');
      });
    });

    describe('readResource', () => {
      it('should read a resource successfully', async () => {
        const resource: Patient = { resourceType: 'Patient', id: '123', name: [{ family: 'Doe' }] };

        jest.spyOn(service['medplum'], 'readResource').mockResolvedValue(resource);

        const result = await service.readResource('Patient', '123');

        expect(result).toEqual(resource);
        expect(service['medplum'].readResource).toHaveBeenCalledWith('Patient', '123');
      });

      it('should handle read errors', async () => {
        const error = new Error('Resource not found');

        jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(error);

        await expect(service.readResource('Patient', '123')).rejects.toThrow('Failed to read resource');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to read resource',
          expect.objectContaining({ resourceType: 'Patient', id: '123' })
        );
      });
    });

    describe('updateResource', () => {
      it('should update a resource successfully', async () => {
        const resource: Patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['Jane'], family: 'Doe' }],
        };

        jest.spyOn(service['medplum'], 'updateResource').mockResolvedValue(resource);

        const result = await service.updateResource(resource);

        expect(result).toEqual(resource);
        expect(service['medplum'].updateResource).toHaveBeenCalledWith(resource);
        expect(mockLogger.fhir).toHaveBeenCalledWith(
          'Resource updated successfully',
          expect.objectContaining({ resourceType: 'Patient', id: '123' })
        );
      });

      it('should throw error for resource without ID', async () => {
        const resource: Patient = { resourceType: 'Patient' };

        await expect(service.updateResource(resource)).rejects.toThrow('Resource must have an ID for update');
      });

      it('should handle update errors', async () => {
        const resource: Patient = { resourceType: 'Patient', id: '123' };
        const error = new Error('Update failed');

        jest.spyOn(service['medplum'], 'updateResource').mockRejectedValue(error);

        await expect(service.updateResource(resource)).rejects.toThrow('Failed to update resource');
      });
    });

    describe('deleteResource', () => {
      it('should delete a resource successfully', async () => {
        jest.spyOn(service['medplum'], 'deleteResource').mockResolvedValue(undefined);

        await service.deleteResource('Patient', '123');

        expect(service['medplum'].deleteResource).toHaveBeenCalledWith('Patient', '123');
        expect(mockLogger.fhir).toHaveBeenCalledWith(
          'Resource deleted successfully',
          { resourceType: 'Patient', id: '123' }
        );
      });

      it('should handle delete errors', async () => {
        const error = new Error('Delete failed');

        jest.spyOn(service['medplum'], 'deleteResource').mockRejectedValue(error);

        await expect(service.deleteResource('Patient', '123')).rejects.toThrow('Failed to delete resource');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to delete resource',
          expect.objectContaining({ resourceType: 'Patient', id: '123' })
        );
      });
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should search resources successfully', async () => {
      const resources = [
        { resourceType: 'Patient', id: '1' },
        { resourceType: 'Patient', id: '2' },
      ];

      jest.spyOn(service['medplum'], 'searchResources').mockResolvedValue(resources);

      const result = await service.searchResources('Patient', { name: 'Doe' });

      expect(result).toEqual({
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          { resource: { resourceType: 'Patient', id: '1' }, fullUrl: 'Patient/1' },
          { resource: { resourceType: 'Patient', id: '2' }, fullUrl: 'Patient/2' },
        ],
      });
      expect(service['medplum'].searchResources).toHaveBeenCalledWith('Patient', { name: 'Doe' });
    });

    it('should handle search with special parameters', async () => {
      const resources: any[] = [];
      const searchParams = {
        _include: 'Patient:organization',
        _revinclude: 'Observation:patient',
        _sort: 'name',
        _count: 10,
      };

      jest.spyOn(service['medplum'], 'searchResources').mockResolvedValue(resources);

      const result = await service.searchResources('Patient', searchParams);

      expect(result).toEqual({
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      });
      expect(service['medplum'].searchResources).toHaveBeenCalledWith('Patient', searchParams);
    });

    it('should handle search errors', async () => {
      const error = new Error('Search failed');

      jest.spyOn(service['medplum'], 'searchResources').mockRejectedValue(error);

      await expect(service.searchResources('Patient', {})).rejects.toThrow('Failed to search resources');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to search resources',
        expect.objectContaining({ resourceType: 'Patient' })
      );
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should execute batch bundle successfully', async () => {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [
          {
            request: { method: 'POST', url: 'Patient' },
            resource: { resourceType: 'Patient' } as Patient,
          },
        ],
      };
      const responseBundle: Bundle<Resource> = {
        resourceType: 'Bundle' as const,
        type: 'batch-response' as const,
        entry: [{ response: { status: '201' } }],
      };

      jest.spyOn(service['medplum'], 'executeBatch').mockResolvedValue(responseBundle);

      const result = await service.executeBatch(bundle);

      expect(result).toEqual(responseBundle);
      expect(service['medplum'].executeBatch).toHaveBeenCalledWith(bundle);
    });

    it('should handle batch execution errors', async () => {
      const bundle: Bundle = { 
        resourceType: 'Bundle' as const, 
        type: 'batch' as const, 
        entry: [] 
      };
      const error = new Error('Batch failed');

      jest.spyOn(service['medplum'], 'executeBatch').mockRejectedValue(error);

      await expect(service.executeBatch(bundle)).rejects.toThrow('Failed to execute batch operation');
    });
  });

  describe('Utility Operations', () => {
    beforeEach(async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should get capability statement', async () => {
      const capabilityStatement = {
        resourceType: 'CapabilityStatement',
        status: 'active',
      };

      jest.spyOn(service['medplum'], 'get').mockResolvedValue(capabilityStatement);

      const result = await service.getCapabilityStatement();

      expect(result).toEqual(capabilityStatement);
      expect(service['medplum'].get).toHaveBeenCalledWith('metadata');
    });

    it('should execute GraphQL query', async () => {
      const query = '{ Patient(id: "123") { name { given family } } }';
      const result = { data: { Patient: { name: [{ given: ['John'], family: 'Doe' }] } } };

      jest.spyOn(service['medplum'], 'graphql').mockResolvedValue(result);

      const response = await service.graphql(query);

      expect(response).toEqual(result);
      expect(service['medplum'].graphql).toHaveBeenCalledWith(query);
    });

    it('should validate resource', async () => {
      const resource: Patient = { resourceType: 'Patient' };
      const operationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [],
      };

      jest.spyOn(service['medplum'], 'validateResource').mockResolvedValue(operationOutcome);

      const result = await service.validateResource(resource);

      expect(result).toEqual(operationOutcome);
      expect(service['medplum'].validateResource).toHaveBeenCalledWith(resource);
    });

    it('should create subscription', async () => {
      const criteria = 'Patient?name=Doe';
      const endpoint = 'https://example.com/webhook';
      const subscription = {
        resourceType: 'Subscription',
        status: 'requested' as const,
        reason: 'OmniCare EMR Integration',
        criteria,
        channel: {
          type: 'rest-hook' as const,
          endpoint,
        },
      };

      jest.spyOn(service['medplum'], 'createResource').mockResolvedValue(subscription);

      const result = await service.createSubscription(criteria, endpoint);

      expect(result).toEqual(subscription);
      expect(service['medplum'].createResource).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Subscription',
          criteria,
        })
      );
    });
  });

  describe('Health Status', () => {
    it('should return DOWN status when not initialized', async () => {
      const status = await service.getHealthStatus();

      expect(status).toEqual({
        status: 'DOWN',
        details: {
          initialized: false,
          serverUrl: config.medplum.baseUrl,
        },
      });
    });

    it('should return UP status when healthy', async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockResolvedValue({ resourceType: 'Patient', id: '123' });
      
      await service.initialize();
      
      jest.spyOn(service['medplum'], 'get').mockResolvedValue({ resourceType: 'CapabilityStatement' });

      const status = await service.getHealthStatus();

      expect(status).toEqual({
        status: 'UP',
        details: {
          initialized: true,
          serverUrl: config.medplum.baseUrl,
          lastCheckTime: expect.any(String),
        },
      });
    });

    it('should return DOWN status when unhealthy', async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      
      await service.initialize();
      
      jest.spyOn(service['medplum'], 'get').mockRejectedValue(new Error('Server error'));

      const status = await service.getHealthStatus();

      expect(status).toEqual({
        status: 'DOWN',
        details: {
          initialized: true,
          serverUrl: config.medplum.baseUrl,
          error: 'Server error',
        },
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new MedplumService();
      
      await expect(uninitializedService.readResource('Patient', '123'))
        .rejects.toThrow('Medplum service not initialized');
    });

    it('should handle FHIR operation outcome in response data', async () => {
      const operationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Invalid request' }],
      };
      const error = { response: { data: operationOutcome } };

      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(error);

      await expect(service.readResource('Patient', '123')).rejects.toThrow('Failed to read resource');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read resource',
        expect.objectContaining({
          fhirError: 'Invalid request',
        })
      );
    });

    it('should handle non-Error objects', async () => {
      const errorObj = { message: 'Something went wrong' };

      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(errorObj);

      await expect(service.readResource('Patient', '123')).rejects.toThrow('Failed to read resource');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read resource',
        expect.objectContaining({
          error: 'Unknown error occurred',
        })
      );
    });
  });

  describe('Shutdown', () => {
    it('should shutdown service properly', async () => {
      jest.spyOn(service['medplum'], 'startClientLogin').mockResolvedValue({} as any);
      jest.spyOn(service['medplum'], 'readResource').mockRejectedValue(new Error('Not found'));
      
      await service.initialize();
      await service.shutdown();

      expect(service['isInitialized']).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Medplum FHIR server connection closed');
    });
  });
});