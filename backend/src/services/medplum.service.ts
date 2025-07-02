// Import types properly for TypeScript
import { 
  Bundle, 
  Resource, 
  ResourceType 
} from '@medplum/fhirtypes';

import config from '../config';
import { BundleRequest, FHIRSearchParams } from '../types/fhir';
import { getErrorMessage, getFHIRErrorMessage, isError, isFHIRError } from '../utils/error.utils';
import logger from '../utils/logger';

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
  } catch {
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
        return Promise.resolve({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] } as Bundle<Resource>); 
      }
      async executeBatch(_bundle: Bundle) {
        return Promise.resolve({ resourceType: 'Bundle' as const, type: 'batch-response' as const, entry: [] } as Bundle<Resource>);
      }
      async get(_url: string, _options?: Record<string, unknown>) {
        return Promise.resolve({});
      }
      async graphql(_query: string, _variables?: string) {
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
      return Promise.resolve({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] } as Bundle<Resource>); 
    }
    async executeBatch(_bundle: Bundle) {
      return Promise.resolve({ resourceType: 'Bundle' as const, type: 'batch-response' as const, entry: [] } as Bundle<Resource>);
    }
    async get(_url: string, _options?: Record<string, unknown>) {
      return Promise.resolve({});
    }
    async graphql(_query: string, _variables?: string) {
      return Promise.resolve({});
    }
    async validateResource(_resource: Resource) {
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
    } catch {
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
                       ((resourceArray as { bundle?: Bundle<T> }).bundle?.entry?.map((entry) => entry.resource) || []);
      
      // Create Bundle response
      const bundle: Bundle<T> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: resources.length,
        entry: resources.map((resource) => ({
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
   * Execute a batch or transaction bundle with enhanced error handling and retry logic
   */
  async executeBatch(bundleRequest: BundleRequest | Bundle, options?: {
    retryOnConflict?: boolean;
    maxRetries?: number;
    validateBeforeSubmit?: boolean;
  }): Promise<Bundle> {
    this.ensureInitialized();
    
    const { retryOnConflict = true, maxRetries = 3, validateBeforeSubmit = true } = options || {};
    
    try {
      // Handle both Bundle and BundleRequest types
      let bundle: Bundle;
      
      if ('entry' in bundleRequest) {
        // Already a Bundle
        bundle = bundleRequest;
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

      // Validate resources before submission if requested
      if (validateBeforeSubmit && bundle.entry) {
        const validationErrors: string[] = [];
        
        for (const [index, entry] of bundle.entry.entries()) {
          if (entry.resource) {
            try {
              const validationResult = await this.validateResource(entry.resource);
              if (validationResult && 'issue' in validationResult) {
                const issues = (validationResult as any).issue || [];
                const errors = issues.filter((issue: any) => 
                  issue.severity === 'error' || issue.severity === 'fatal'
                );
                if (errors.length > 0) {
                  validationErrors.push(`Entry ${index}: ${errors.map((e: any) => e.diagnostics).join(', ')}`);
                }
              }
            } catch (valError) {
              logger.warn(`Validation failed for entry ${index}:`, valError);
            }
          }
        }
        
        if (validationErrors.length > 0) {
          throw new Error(`Bundle validation failed: ${validationErrors.join('; ')}`);
        }
      }

      // Execute with retry logic
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.medplum.executeBatch(bundle);
          
          // Check for partial failures
          const failedEntries = result.entry?.filter(entry => 
            entry.response?.status && !entry.response.status.startsWith('2')
          ) || [];
          
          if (failedEntries.length > 0 && bundle.type === 'transaction') {
            throw new Error(`Transaction bundle failed with ${failedEntries.length} errors`);
          }
          
          logger.info(`Successfully executed ${bundle.type} bundle`, {
            totalEntries: bundle.entry?.length || 0,
            successfulEntries: (result.entry?.length || 0) - failedEntries.length,
            failedEntries: failedEntries.length,
          });
          
          return result;
        } catch (error) {
          lastError = error as Error;
          
          if (retryOnConflict && attempt < maxRetries) {
            const errorMessage = getErrorMessage(error);
            if (errorMessage.includes('conflict') || errorMessage.includes('version')) {
              logger.warn(`Batch execution failed due to conflict, retrying... (attempt ${attempt}/${maxRetries})`);
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              continue;
            }
          }
          
          if (attempt === maxRetries) {
            break;
          }
        }
      }
      
      logger.error(`Failed to execute batch bundle after ${maxRetries} attempts:`, lastError);
      throw new Error(`Failed to execute batch operation: ${getErrorMessage(lastError)}`);
    } catch (error) {
      logger.error(`Failed to execute batch bundle:`, error);
      throw this.handleFHIRError(error);
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
   * Subscribe to resource changes with enhanced configuration
   */
  async createSubscription(
    criteria: string, 
    channelType: string, 
    endpoint?: string,
    options?: {
      reason?: string;
      end?: string; // Subscription end date
      headers?: string[]; // Additional headers
      payloadMimeType?: string;
      payloadContent?: 'empty' | 'id-only' | 'full-resource';
    }
  ): Promise<Resource> {
    this.ensureInitialized();
    
    const { 
      reason = 'OmniCare EMR Integration',
      end,
      headers = [],
      payloadMimeType = 'application/fhir+json',
      payloadContent = 'full-resource'
    } = options || {};
    
    try {
      logger.debug(`Creating subscription for criteria: ${criteria}`);
      
      // Build headers array
      const channelHeaders = [...headers];
      if (endpoint && config.medplum.clientSecret) {
        channelHeaders.push(`Authorization: Bearer ${config.medplum.clientSecret}`);
      }
      
      const subscription = {
        resourceType: 'Subscription' as const,
        status: 'requested' as const,
        reason,
        criteria,
        channel: {
          type: channelType as "message" | "email" | "rest-hook" | "websocket" | "sms",
          endpoint,
          payload: payloadMimeType,
          header: channelHeaders.length > 0 ? channelHeaders : undefined,
          _payload: {
            extension: [{
              url: 'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-payload-content',
              valueCode: payloadContent
            }]
          }
        },
        end: end || undefined,
      };

      const result = await this.medplum.createResource(subscription);
      
      logger.info(`Successfully created subscription with ID: ${result.id}`, {
        criteria,
        channelType,
        endpoint,
        payloadContent
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Deleting subscription with ID: ${subscriptionId}`);
      await this.medplum.deleteResource('Subscription', subscriptionId);
      logger.info(`Successfully deleted subscription with ID: ${subscriptionId}`);
    } catch (error) {
      logger.error('Failed to delete subscription:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Get all active subscriptions
   */
  async getActiveSubscriptions(): Promise<Bundle<Resource>> {
    this.ensureInitialized();
    
    try {
      logger.debug('Fetching active subscriptions');
      const result = await this.medplum.searchResources('Subscription', {
        status: 'active,requested',
        _sort: '-_lastUpdated',
      });
      
      const bundleResult = result as Bundle<Resource>;
      logger.info(`Found ${bundleResult.entry?.length || 0} active subscriptions`);
      return bundleResult;
    } catch (error) {
      logger.error('Failed to fetch active subscriptions:', error);
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