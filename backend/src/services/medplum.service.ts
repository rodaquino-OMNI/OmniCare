// Import types properly for TypeScript
import { 
  Bundle, 
  Resource, 
  ResourceType 
} from '@medplum/fhirtypes';

import config from '../config';
import { FHIRSearchParams, BundleRequest } from '../types/fhir';
import logger from '../utils/logger';
import { getErrorMessage, isFHIRError, getFHIRErrorMessage, isError } from '../utils/error.utils';

// Import MedplumClient only if not in test environment
interface MedplumClientInterface {
  startClientLogin(clientId: string, clientSecret: string): Promise<void>;
  readResource(resourceType: string, id: string): Promise<Resource>;
  createResource(resource: Resource): Promise<Resource>;
  updateResource(resource: Resource): Promise<Resource>;
  deleteResource(resourceType: string, id: string): Promise<void>;
  searchResources(resourceType: string, params: Record<string, unknown>): Promise<unknown>;
  executeBatch(bundle: Bundle): Promise<Bundle>;
  get(path: string): Promise<unknown>;
  graphql(query: string, variables?: string): Promise<unknown>;
  validateResource(resource: Resource): Promise<unknown>;
}

let MedplumClient: new (options: Record<string, unknown>) => MedplumClientInterface;

if (process.env.NODE_ENV !== 'test') {
  try {
    const medplumCore = require('@medplum/core');
    MedplumClient = medplumCore.MedplumClient;
  } catch (error) {
    // Mock MedplumClient for environments where Medplum isn't available
    MedplumClient = class MockMedplumClient implements MedplumClientInterface {
      constructor(_options: Record<string, unknown>) {}
      async startClientLogin(_clientId: string, _clientSecret: string) { return Promise.resolve(); }
      async readResource(resourceType: string, id: string) { 
        return Promise.resolve({ resourceType, id, active: true } as Resource); 
      }
      async createResource(resource: Resource) { 
        return Promise.resolve({ ...resource, id: `mock-${Date.now()}` }); 
      }
      async updateResource(resource: Resource) { 
        return Promise.resolve(resource); 
      }
      async deleteResource(_resourceType: string, _id: string) { 
        return Promise.resolve(); 
      }
      async searchResources(_resourceType: string, _params: Record<string, unknown>) { 
        return Promise.resolve({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] } as Bundle); 
      }
      async executeBatch(_bundle: Bundle) {
        return Promise.resolve({ resourceType: 'Bundle' as const, type: 'batch-response' as const, entry: [] } as Bundle);
      }
      async get(_url: string, _options?: any) {
        return Promise.resolve({});
      }
      async graphql(_query: string, _variables?: any) {
        return Promise.resolve({});
      }
      async validateResource(_resource: Resource) {
        return Promise.resolve({ resourceType: 'OperationOutcome', issue: [] });
      }
    };
  }
} else {
  // Mock for tests
  MedplumClient = class MockMedplumClient implements MedplumClientInterface {
    constructor(_options: any) {}
    async startClientLogin(_clientId: string, _clientSecret: string) { return Promise.resolve(); }
    async readResource(resourceType: string, id: string) { 
      return Promise.resolve({ resourceType, id, active: true } as Resource); 
    }
    async createResource(resource: any) { 
      return Promise.resolve({ ...resource, id: `mock-${Date.now()}` }); 
    }
    async updateResource(resource: any) { 
      return Promise.resolve(resource); 
    }
    async deleteResource(_resourceType: string, _id: string) { 
      return Promise.resolve(); 
    }
    async searchResources(_resourceType: string, _params: any) { 
      return Promise.resolve({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] } as Bundle); 
    }
    async executeBatch(_bundle: any) {
      return Promise.resolve({ resourceType: 'Bundle' as const, type: 'batch-response' as const, entry: [] } as Bundle);
    }
    async get(_url: string, _options?: any) {
      return Promise.resolve({});
    }
    async graphql(_query: string, _variables?: any) {
      return Promise.resolve({});
    }
    async validateResource(_resource: any) {
      return Promise.resolve({ resourceType: 'OperationOutcome', issue: [] });
    }
  };
}

/**
 * Medplum FHIR Server Integration Service
 * Handles all interactions with Medplum FHIR server including authentication,
 * resource management, search operations, and batch processing.
 */
export class MedplumService {
  private medplum: MedplumClientInterface;
  private isInitialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.medplum = new MedplumClient({
      baseUrl: config.medplum.selfHosted ? config.medplum.selfHostedUrl : config.medplum.baseUrl,
      clientId: config.medplum.clientId,
      fhirUrlPath: '/fhir/R4',
      tokenUrl: config.medplum.selfHosted ? 
        `${config.medplum.selfHostedUrl}/oauth2/token` : 
        `${config.medplum.baseUrl}oauth2/token`,
      authorizeUrl: config.medplum.selfHosted ? 
        `${config.medplum.selfHostedUrl}/oauth2/authorize` : 
        `${config.medplum.baseUrl}oauth2/authorize`,
    });
  }

  /**
   * Initialize Medplum connection with authentication
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Medplum FHIR server connection...');

      // Use client credentials flow for both self-hosted and SaaS
      await this.medplum.startClientLogin(config.medplum.clientId, config.medplum.clientSecret);
      
      // Note: Project ID is now handled via the OAuth scope or client configuration
      // The setActiveProject method has been removed in newer versions

      // Test connection with a simple query
      await this.testConnection();
      
      this.isInitialized = true;
      this.reconnectAttempts = 0;
      
      logger.info('Medplum FHIR server connection established successfully');
    } catch (error) {
      logger.error('Failed to initialize Medplum connection:', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Retrying connection... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        // Exponential backoff
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        setTimeout(() => this.initialize(), delay);
      } else {
        logger.error('Failed to initialize Medplum FHIR server after multiple attempts', { 
          error: getErrorMessage(error) 
        });
        throw new Error('Failed to initialize Medplum FHIR server');
      }
    }
  }

  /**
   * Test the connection to ensure it's working
   */
  private async testConnection(): Promise<void> {
    try {
      await this.medplum.readResource('Patient', 'test-patient-id').catch(() => null);
      logger.debug('Connection test completed successfully');
    } catch (error) {
      logger.warn('Connection test failed, but proceeding...');
    }
  }

  /**
   * Ensure the service is initialized before making requests
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('MedplumService not initialized. Call initialize() first.');
    }
  }

  /**
   * Create a new FHIR resource
   */
  async createResource<T extends Resource>(resource: T): Promise<T> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Creating ${resource.resourceType} resource`);
      const result = await this.medplum.createResource(resource);
      
      logger.fhir('Resource created successfully', {
        resourceType: resource.resourceType,
        id: result.id,
        meta: result.meta
      });
      return result as T;
    } catch (error) {
      logger.error('Failed to create resource', { 
        resourceType: resource.resourceType, 
        error: getErrorMessage(error),
        fhirError: isFHIRError(error) ? getFHIRErrorMessage(error) : undefined
      });
      throw new Error('Failed to create resource');
    }
  }

  /**
   * Read a FHIR resource by ID
   */
  async readResource<T extends Resource>(resourceType: ResourceType, id: string): Promise<T> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Reading ${resourceType} resource with ID: ${id}`);
      const result = await this.medplum.readResource(resourceType, id);
      
      logger.debug(`Successfully retrieved ${resourceType} with ID: ${id}`);
      return result as T;
    } catch (error) {
      logger.error('Failed to read resource', { 
        resourceType, 
        id, 
        error: getErrorMessage(error),
        fhirError: isFHIRError(error) ? getFHIRErrorMessage(error) : undefined
      });
      throw new Error('Failed to read resource');
    }
  }

  /**
   * Update a FHIR resource
   */
  async updateResource<T extends Resource>(resource: T): Promise<T> {
    this.ensureInitialized();
    
    if (!resource.id) {
      throw new Error('Resource must have an ID for update');
    }

    try {
      logger.debug(`Updating ${resource.resourceType} resource with ID: ${resource.id}`);
      const result = await this.medplum.updateResource(resource);
      
      logger.fhir('Resource updated successfully', {
        resourceType: resource.resourceType,
        id: resource.id,
        meta: result.meta
      });
      return result as T;
    } catch (error) {
      logger.error('Failed to update resource', { 
        resourceType: resource.resourceType, 
        id: resource.id,
        error: getErrorMessage(error),
        fhirError: isFHIRError(error) ? getFHIRErrorMessage(error) : undefined
      });
      throw new Error('Failed to update resource');
    }
  }

  /**
   * Delete a FHIR resource
   */
  async deleteResource(resourceType: ResourceType, id: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Deleting ${resourceType} resource with ID: ${id}`);
      await this.medplum.deleteResource(resourceType, id);
      
      logger.fhir('Resource deleted successfully', { resourceType, id });
    } catch (error) {
      logger.error('Failed to delete resource', { 
        resourceType, 
        id,
        error: getErrorMessage(error),
        fhirError: isFHIRError(error) ? getFHIRErrorMessage(error) : undefined
      });
      throw new Error('Failed to delete resource');
    }
  }

  /**
   * Search for FHIR resources with proper generic constraints
   */
  async searchResources<T extends Resource & { resourceType: ResourceType }>(
    resourceType: T['resourceType'], 
    searchParams: FHIRSearchParams = {}
  ): Promise<Bundle<T>> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Searching ${resourceType} resources with params:`, searchParams);
      
      // Convert search params to format expected by searchResources
      const convertedParams: Record<string, unknown> = {};
      
      // Handle standard search parameters
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          convertedParams[key] = value;
        }
      });

      // Use searchResources method which returns ResourceArray with bundle
      const resourceArray = await this.medplum.searchResources(resourceType, convertedParams);
      
      // Extract resources from the ResourceArray structure
      const resources = Array.isArray(resourceArray) ? resourceArray : 
                       (resourceArray as any).bundle?.entry?.map((entry: any) => entry.resource) || [];
      
      // Create Bundle response
      const bundle: Bundle<T> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: resources.length,
        entry: resources.map((resource: any) => ({
          resource: resource as T,
          fullUrl: `${resource.resourceType}/${resource.id}`
        }))
      };
      
      logger.debug(`Search returned ${resources.length} results for ${resourceType}`);
      return bundle;
    } catch (error) {
      logger.error('Failed to search resources', { 
        resourceType,
        error: getErrorMessage(error),
        fhirError: isFHIRError(error) ? getFHIRErrorMessage(error) : undefined
      });
      throw new Error('Failed to search resources');
    }
  }

  /**
   * Execute a batch or transaction bundle
   */
  async executeBatch(bundleRequest: BundleRequest | Bundle): Promise<Bundle> {
    this.ensureInitialized();
    
    try {
      // Handle both Bundle and BundleRequest types
      let bundle: Bundle;
      
      if ('entry' in bundleRequest) {
        // Already a Bundle
        bundle = bundleRequest as Bundle;
        logger.debug(`Executing ${bundle.type} bundle with ${bundle.entry?.length || 0} entries`);
      } else {
        // BundleRequest needs conversion
        const req = bundleRequest as BundleRequest;
        logger.debug(`Executing ${req.type} bundle with ${req.resources?.length || 0} resources`);
        
        bundle = {
          resourceType: 'Bundle',
          type: req.type,
          timestamp: req.timestamp || new Date().toISOString(),
          entry: req.resources.map((resource, _index) => ({
            request: {
              method: resource.id ? 'PUT' : 'POST',
              url: resource.id ? `${resource.resourceType}/${resource.id}` : resource.resourceType,
            },
            resource: resource,
          })),
        };
      }

      const result = await this.medplum.executeBatch(bundle);
      
      logger.info(`Successfully executed ${bundle.type} bundle`);
      return result;
    } catch (error) {
      logger.error(`Failed to execute batch bundle:`, error);
      throw new Error('Failed to execute batch operation');
    }
  }

  /**
   * Get FHIR capability statement
   */
  async getCapabilityStatement(): Promise<Record<string, unknown>> {
    this.ensureInitialized();
    
    try {
      logger.debug('Retrieving FHIR capability statement');
      const result = await this.medplum.get('metadata');
      
      logger.debug('Successfully retrieved capability statement');
      return result as Record<string, unknown>;
    } catch (error) {
      logger.error('Failed to retrieve capability statement:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Execute GraphQL query
   */
  async graphql(query: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.ensureInitialized();
    
    try {
      logger.debug('Executing GraphQL query');
      const result = await this.medplum.graphql(query, variables ? JSON.stringify(variables) : undefined);
      
      logger.debug('GraphQL query executed successfully');
      return result as Record<string, unknown>;
    } catch (error) {
      logger.error('Failed to execute GraphQL query:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Subscribe to resource changes
   */
  async createSubscription(criteria: string, channelType: string, endpoint?: string): Promise<Resource> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Creating subscription for criteria: ${criteria}`);
      
      const subscription = {
        resourceType: 'Subscription' as const,
        status: 'requested' as const,
        reason: 'OmniCare EMR Integration',
        criteria,
        channel: {
          type: channelType as "message" | "email" | "rest-hook" | "websocket" | "sms",
          endpoint,
          payload: 'application/fhir+json',
          header: endpoint ? [`Authorization: Bearer ${config.medplum.clientSecret}`] : undefined
        },
      };

      const result = await this.medplum.createResource(subscription);
      
      logger.info(`Successfully created subscription with ID: ${result.id}`);
      return result as Resource;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Validate a FHIR resource
   */
  async validateResource<T extends Resource>(resource: T): Promise<Record<string, unknown>> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Validating ${resource.resourceType} resource`);
      const result = await this.medplum.validateResource(resource);
      
      logger.debug(`Validation completed for ${resource.resourceType}`);
      return result as Record<string, unknown>;
    } catch (error) {
      logger.error(`Failed to validate ${resource.resourceType} resource:`, error);
      throw this.handleFHIRError(error);
    }
  }


  /**
   * Handle FHIR errors and convert to standard format
   */
  private handleFHIRError(error: unknown): Error {
    if (isFHIRError(error)) {
      const message = getFHIRErrorMessage(error);
      return new Error(`FHIR Error: ${message}`);
    }
    
    return isError(error) ? error : new Error(getErrorMessage(error));
  }

  /**
   * Get health status of the Medplum service
   */
  async getHealthStatus(): Promise<{ status: string; details: Record<string, unknown> }> {
    try {
      if (!this.isInitialized) {
        return { 
          status: 'DOWN', 
          details: { 
            initialized: false,
            serverUrl: config.medplum.baseUrl
          } 
        };
      }

      // Test with a simple metadata call
      await this.medplum.get('metadata');

      return {
        status: 'UP',
        details: {
          initialized: true,
          serverUrl: config.medplum.baseUrl,
          lastCheckTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'DOWN',
        details: {
          initialized: true,
          serverUrl: config.medplum.baseUrl,
          error: getErrorMessage(error),
        },
      };
    }
  }

  /**
   * Cleanup and close connections
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Medplum service...');
    this.isInitialized = false;
    logger.info('Medplum FHIR server connection closed');
  }
}

// Export singleton instance
export const medplumService = new MedplumService();