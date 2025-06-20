import { MedplumService } from '../../../src/services/medplum.service';
import { MedplumClient } from '@medplum/core';
import logger from '../../../src/utils/logger';
import config from '../../../src/config';

// Mock dependencies
jest.mock('@medplum/core');
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

describe('MedplumService', () => {
  let service: MedplumService;
  let mockMedplumClient: jest.Mocked<MedplumClient>;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    // Create mock MedplumClient instance
    mockMedplumClient = {
      startClientLogin: jest.fn(),
      setActiveProject: jest.fn(),
      createResource: jest.fn(),
      readResource: jest.fn(),
      updateResource: jest.fn(),
      deleteResource: jest.fn(),
      search: jest.fn(),
      executeBatch: jest.fn(),
      get: jest.fn(),
      graphql: jest.fn(),
      validateResource: jest.fn(),
    } as any;

    // Mock MedplumClient constructor
    (MedplumClient as jest.MockedClass<typeof MedplumClient>).mockImplementation(() => mockMedplumClient);

    service = new MedplumService();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration for SaaS', async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found')); // For test connection

      await service.initialize();

      expect(MedplumClient).toHaveBeenCalledWith({
        baseUrl: config.medplum.baseUrl,
        clientId: config.medplum.clientId,
        fhirUrlPath: '/fhir/R4',
        tokenUrl: `${config.medplum.baseUrl}oauth2/token`,
        authorizeUrl: `${config.medplum.baseUrl}oauth2/authorize`,
      });

      expect(mockMedplumClient.startClientLogin).toHaveBeenCalledWith(
        config.medplum.clientId,
        config.medplum.clientSecret
      );
      expect(mockMedplumClient.setActiveProject).toHaveBeenCalledWith(config.medplum.projectId);
      expect(mockLogger.info).toHaveBeenCalledWith('Medplum FHIR server connection established successfully');
    });

    it('should initialize with correct configuration for self-hosted', async () => {
      // Mock self-hosted configuration
      const originalConfig = { ...config.medplum };
      config.medplum.selfHosted = true;

      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));

      await service.initialize();

      expect(MedplumClient).toHaveBeenCalledWith({
        baseUrl: config.medplum.selfHostedUrl,
        clientId: config.medplum.clientId,
        fhirUrlPath: '/fhir/R4',
        tokenUrl: `${config.medplum.selfHostedUrl}/oauth2/token`,
        authorizeUrl: `${config.medplum.selfHostedUrl}/oauth2/authorize`,
      });

      // Restore original config
      config.medplum = originalConfig;
    });

    it('should handle initialization failure with retry', async () => {
      const error = new Error('Connection failed');
      mockMedplumClient.startClientLogin.mockRejectedValue(error);

      // Use fake timers to control setTimeout
      jest.useFakeTimers();
      
      const initPromise = service.initialize();
      
      // Advance timers to trigger retry
      jest.advanceTimersByTime(2000);
      
      // Second attempt should also fail
      mockMedplumClient.startClientLogin.mockRejectedValue(error);
      
      jest.useRealTimers();

      await expect(initPromise).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Medplum connection:', error);
    });

    it('should throw error after max reconnection attempts', async () => {
      const error = new Error('Persistent connection failure');
      mockMedplumClient.startClientLogin.mockRejectedValue(error);

      // Mock multiple failed attempts
      for (let i = 0; i < 6; i++) {
        mockMedplumClient.startClientLogin.mockRejectedValueOnce(error);
      }

      await expect(service.initialize()).rejects.toThrow(
        'Failed to establish Medplum connection after 5 attempts'
      );
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      // Initialize service for resource management tests
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    describe('createResource', () => {
      it('should create a resource successfully', async () => {
        const resource = global.createMockPatient();
        const createdResource = { ...resource, id: 'created-patient-1' };

        mockMedplumClient.createResource.mockResolvedValue(createdResource);

        const result = await service.createResource(resource);

        expect(mockMedplumClient.createResource).toHaveBeenCalledWith(resource);
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Successfully created ${resource.resourceType} with ID: ${createdResource.id}`
        );
        expect(result).toEqual(createdResource);
      });

      it('should handle creation errors', async () => {
        const resource = global.createMockPatient();
        const error = new Error('Creation failed');

        mockMedplumClient.createResource.mockRejectedValue(error);

        await expect(service.createResource(resource)).rejects.toThrow('Creation failed');
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to create ${resource.resourceType} resource:`,
          error
        );
      });

      it('should handle FHIR operation outcome errors', async () => {
        const resource = global.createMockPatient();
        const fhirError = {
          outcome: {
            issue: [
              {
                severity: 'error',
                code: 'required',
                diagnostics: 'Missing required field: name',
              },
            ],
          },
        };

        mockMedplumClient.createResource.mockRejectedValue(fhirError);

        await expect(service.createResource(resource)).rejects.toThrow(
          'FHIR Error: Missing required field: name'
        );
      });
    });

    describe('readResource', () => {
      it('should read a resource successfully', async () => {
        const resourceType = 'Patient';
        const resourceId = 'test-patient-1';
        const resource = global.createMockPatient();

        mockMedplumClient.readResource.mockResolvedValue(resource);

        const result = await service.readResource(resourceType, resourceId);

        expect(mockMedplumClient.readResource).toHaveBeenCalledWith(resourceType, resourceId);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Successfully retrieved ${resourceType} with ID: ${resourceId}`
        );
        expect(result).toEqual(resource);
      });

      it('should handle read errors', async () => {
        const resourceType = 'Patient';
        const resourceId = 'non-existent-patient';
        const error = new Error('Resource not found');

        mockMedplumClient.readResource.mockRejectedValue(error);

        await expect(service.readResource(resourceType, resourceId)).rejects.toThrow(
          'Resource not found'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to read ${resourceType} resource with ID ${resourceId}:`,
          error
        );
      });
    });

    describe('updateResource', () => {
      it('should update a resource successfully', async () => {
        const resource = { ...global.createMockPatient(), id: 'test-patient-1' };
        const updatedResource = { ...resource, name: [{ given: ['Updated'], family: 'Name' }] };

        mockMedplumClient.updateResource.mockResolvedValue(updatedResource);

        const result = await service.updateResource(resource);

        expect(mockMedplumClient.updateResource).toHaveBeenCalledWith(resource);
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Successfully updated ${resource.resourceType} with ID: ${resource.id}`
        );
        expect(result).toEqual(updatedResource);
      });

      it('should throw error for resource without ID', async () => {
        const resource = global.createMockPatient();
        delete resource.id;

        await expect(service.updateResource(resource)).rejects.toThrow(
          'Resource must have an ID to be updated'
        );
        expect(mockMedplumClient.updateResource).not.toHaveBeenCalled();
      });

      it('should handle update errors', async () => {
        const resource = { ...global.createMockPatient(), id: 'test-patient-1' };
        const error = new Error('Update failed');

        mockMedplumClient.updateResource.mockRejectedValue(error);

        await expect(service.updateResource(resource)).rejects.toThrow('Update failed');
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to update ${resource.resourceType} resource:`,
          error
        );
      });
    });

    describe('deleteResource', () => {
      it('should delete a resource successfully', async () => {
        const resourceType = 'Patient';
        const resourceId = 'test-patient-1';

        mockMedplumClient.deleteResource.mockResolvedValue(undefined);

        await service.deleteResource(resourceType, resourceId);

        expect(mockMedplumClient.deleteResource).toHaveBeenCalledWith(resourceType, resourceId);
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Successfully deleted ${resourceType} with ID: ${resourceId}`
        );
      });

      it('should handle delete errors', async () => {
        const resourceType = 'Patient';
        const resourceId = 'test-patient-1';
        const error = new Error('Delete failed');

        mockMedplumClient.deleteResource.mockRejectedValue(error);

        await expect(service.deleteResource(resourceType, resourceId)).rejects.toThrow(
          'Delete failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to delete ${resourceType} resource with ID ${resourceId}:`,
          error
        );
      });
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should search resources successfully', async () => {
      const resourceType = 'Patient';
      const searchParams = { family: 'Doe', given: 'John' };
      const searchResults = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [{ resource: global.createMockPatient() }],
      };

      mockMedplumClient.search.mockResolvedValue(searchResults);

      const result = await service.searchResources(resourceType, searchParams);

      expect(mockMedplumClient.search).toHaveBeenCalledWith({
        resourceType,
        filters: [
          { code: 'family', operator: 'equals', value: 'Doe' },
          { code: 'given', operator: 'equals', value: 'John' },
        ],
        count: undefined,
        offset: undefined,
        sortRules: undefined,
        total: undefined,
        summary: undefined,
        elements: undefined,
        include: undefined,
        revInclude: undefined,
      });
      expect(result).toEqual(searchResults);
    });

    it('should handle search with special parameters', async () => {
      const resourceType = 'Patient';
      const searchParams = {
        family: 'Doe',
        _count: 10,
        _offset: 0,
        _sort: 'family:asc,given:desc',
        _include: 'Patient:general-practitioner',
        _revinclude: 'Encounter:patient',
        _elements: 'id,name,birthDate',
      };

      const searchResults = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 5,
        entry: [],
      };

      mockMedplumClient.search.mockResolvedValue(searchResults);

      await service.searchResources(resourceType, searchParams);

      expect(mockMedplumClient.search).toHaveBeenCalledWith({
        resourceType,
        filters: [{ code: 'family', operator: 'equals', value: 'Doe' }],
        count: 10,
        offset: 0,
        sortRules: [
          { code: 'family', descending: false },
          { code: 'given', descending: true },
        ],
        total: undefined,
        summary: undefined,
        elements: ['id', 'name', 'birthDate'],
        include: ['Patient:general-practitioner'],
        revInclude: ['Encounter:patient'],
      });
    });

    it('should handle search errors', async () => {
      const resourceType = 'Patient';
      const searchParams = { family: 'Doe' };
      const error = new Error('Search failed');

      mockMedplumClient.search.mockRejectedValue(error);

      await expect(service.searchResources(resourceType, searchParams)).rejects.toThrow(
        'Search failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to search ${resourceType} resources:`,
        error
      );
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should execute batch bundle successfully', async () => {
      const bundleRequest = {
        type: 'batch' as const,
        resources: [
          global.createMockPatient(),
          { ...global.createMockPatient(), id: 'existing-patient-1' },
        ],
        timestamp: '2024-01-01T12:00:00Z',
      };

      const batchResponse = {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: [
          { response: { status: '201', location: 'Patient/new-patient-1' } },
          { response: { status: '200', location: 'Patient/existing-patient-1' } },
        ],
      };

      mockMedplumClient.executeBatch.mockResolvedValue(batchResponse);

      const result = await service.executeBatch(bundleRequest);

      expect(mockMedplumClient.executeBatch).toHaveBeenCalledWith({
        resourceType: 'Bundle',
        type: 'batch',
        timestamp: '2024-01-01T12:00:00Z',
        entry: [
          {
            request: { method: 'POST', url: 'Patient' },
            resource: bundleRequest.resources[0],
          },
          {
            request: { method: 'PUT', url: 'Patient/existing-patient-1' },
            resource: bundleRequest.resources[1],
          },
        ],
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully executed batch bundle');
      expect(result).toEqual(batchResponse);
    });

    it('should handle batch execution errors', async () => {
      const bundleRequest = {
        type: 'batch' as const,
        resources: [global.createMockPatient()],
      };

      const error = new Error('Batch execution failed');
      mockMedplumClient.executeBatch.mockRejectedValue(error);

      await expect(service.executeBatch(bundleRequest)).rejects.toThrow(
        'Batch execution failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute batch bundle:', error);
    });
  });

  describe('Utility Operations', () => {
    beforeEach(async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();
    });

    it('should get capability statement', async () => {
      const capabilityStatement = {
        resourceType: 'CapabilityStatement',
        status: 'active',
        kind: 'instance',
      };

      mockMedplumClient.get.mockResolvedValue(capabilityStatement);

      const result = await service.getCapabilityStatement();

      expect(mockMedplumClient.get).toHaveBeenCalledWith('metadata');
      expect(result).toEqual(capabilityStatement);
    });

    it('should execute GraphQL query', async () => {
      const query = 'query { Patient { id name } }';
      const variables = { limit: 10 };
      const graphqlResponse = { data: { Patient: [] } };

      mockMedplumClient.graphql.mockResolvedValue(graphqlResponse);

      const result = await service.graphql(query, variables);

      expect(mockMedplumClient.graphql).toHaveBeenCalledWith(query, variables);
      expect(result).toEqual(graphqlResponse);
    });

    it('should validate resource', async () => {
      const resource = global.createMockPatient();
      const validationResult = {
        resourceType: 'OperationOutcome',
        issue: [],
      };

      mockMedplumClient.validateResource.mockResolvedValue(validationResult);

      const result = await service.validateResource(resource);

      expect(mockMedplumClient.validateResource).toHaveBeenCalledWith(resource);
      expect(result).toEqual(validationResult);
    });

    it('should create subscription', async () => {
      const criteria = 'Patient?active=true';
      const channelType = 'webhook';
      const endpoint = 'https://example.com/webhook';

      const subscription = {
        resourceType: 'Subscription',
        id: 'sub-123',
        status: 'active',
        criteria,
        channel: { type: channelType, endpoint },
      };

      mockMedplumClient.createResource.mockResolvedValue(subscription);

      const result = await service.createSubscription(criteria, channelType, endpoint);

      expect(mockMedplumClient.createResource).toHaveBeenCalledWith({
        resourceType: 'Subscription',
        status: 'requested',
        reason: 'OmniCare EMR Integration',
        criteria,
        channel: {
          type: channelType,
          endpoint,
          payload: 'application/fhir+json',
        },
      });
      expect(result).toEqual(subscription);
    });
  });

  describe('Health Status', () => {
    it('should return DOWN status when not initialized', async () => {
      const result = await service.getHealthStatus();

      expect(result).toEqual({
        status: 'DOWN',
        details: { reason: 'Not initialized' },
      });
    });

    it('should return UP status when healthy', async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      mockMedplumClient.get.mockResolvedValue({ resourceType: 'CapabilityStatement' });

      await service.initialize();
      const result = await service.getHealthStatus();

      expect(result.status).toBe('UP');
      expect(result.details).toMatchObject({
        baseUrl: config.medplum.baseUrl,
        selfHosted: config.medplum.selfHosted,
        initialized: true,
      });
      expect(result.details.responseTime).toMatch(/\d+ms/);
    });

    it('should return DOWN status when unhealthy', async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();

      const error = new Error('Service unavailable');
      mockMedplumClient.get.mockRejectedValue(error);

      const result = await service.getHealthStatus();

      expect(result).toEqual({
        status: 'DOWN',
        details: {
          error: 'Service unavailable',
          reconnectAttempts: 0,
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(service.createResource(global.createMockPatient())).rejects.toThrow(
        'MedplumService not initialized. Call initialize() first.'
      );
    });

    it('should handle FHIR operation outcome in response data', async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();

      const fhirError = {
        response: {
          data: {
            resourceType: 'OperationOutcome',
            issue: [
              {
                severity: 'error',
                code: 'invalid',
                details: { text: 'Invalid resource format' },
              },
            ],
          },
        },
      };

      mockMedplumClient.createResource.mockRejectedValue(fhirError);

      await expect(service.createResource(global.createMockPatient())).rejects.toThrow(
        'FHIR Error: Invalid resource format'
      );
    });

    it('should handle non-Error objects', async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();

      mockMedplumClient.createResource.mockRejectedValue('String error');

      await expect(service.createResource(global.createMockPatient())).rejects.toThrow(
        'String error'
      );
    });
  });

  describe('Shutdown', () => {
    it('should shutdown service properly', async () => {
      mockMedplumClient.startClientLogin.mockResolvedValue(undefined);
      mockMedplumClient.setActiveProject.mockResolvedValue(undefined);
      mockMedplumClient.readResource.mockRejectedValue(new Error('Not found'));
      await service.initialize();

      await service.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down Medplum service...');
      
      // Service should not be initialized after shutdown
      await expect(service.createResource(global.createMockPatient())).rejects.toThrow(
        'MedplumService not initialized. Call initialize() first.'
      );
    });
  });
});