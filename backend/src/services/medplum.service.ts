import { MedplumClient } from '@medplum/core';
import { Bundle, Patient, Practitioner, Organization, SearchRequest, Resource } from '@medplum/fhirtypes';
import config from '@/config';
import logger from '@/utils/logger';
import { FHIRSearchParams, BundleRequest } from '@/types/fhir';

/**
 * Medplum FHIR Server Integration Service
 * Handles all interactions with Medplum FHIR server including authentication,
 * resource management, search operations, and batch processing.
 */
export class MedplumService {
  private medplum: MedplumClient;
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

      if (config.medplum.selfHosted) {
        // For self-hosted Medplum, use client credentials flow
        await this.medplum.startClientLogin(config.medplum.clientId, config.medplum.clientSecret);
      } else {
        // For Medplum SaaS, use project-based authentication
        await this.medplum.startClientLogin(config.medplum.clientId, config.medplum.clientSecret);
        
        if (config.medplum.projectId) {
          await this.medplum.setActiveProject(config.medplum.projectId);
        }
      }

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
        throw new Error(`Failed to establish Medplum connection after ${this.maxReconnectAttempts} attempts`);
      }
    }
  }

  /**
   * Test the connection to ensure it's working
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await this.medplum.readResource('Patient', 'test-patient-id').catch(() => null);
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
      
      logger.info(`Successfully created ${resource.resourceType} with ID: ${result.id}`);
      return result;
    } catch (error) {
      logger.error(`Failed to create ${resource.resourceType} resource:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Read a FHIR resource by ID
   */
  async readResource<T extends Resource>(resourceType: string, id: string): Promise<T> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Reading ${resourceType} resource with ID: ${id}`);
      const result = await this.medplum.readResource(resourceType, id);
      
      logger.debug(`Successfully retrieved ${resourceType} with ID: ${id}`);
      return result as T;
    } catch (error) {
      logger.error(`Failed to read ${resourceType} resource with ID ${id}:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Update a FHIR resource
   */
  async updateResource<T extends Resource>(resource: T): Promise<T> {
    this.ensureInitialized();
    
    if (!resource.id) {
      throw new Error('Resource must have an ID to be updated');
    }

    try {
      logger.debug(`Updating ${resource.resourceType} resource with ID: ${resource.id}`);
      const result = await this.medplum.updateResource(resource);
      
      logger.info(`Successfully updated ${resource.resourceType} with ID: ${result.id}`);
      return result;
    } catch (error) {
      logger.error(`Failed to update ${resource.resourceType} resource:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Delete a FHIR resource
   */
  async deleteResource(resourceType: string, id: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Deleting ${resourceType} resource with ID: ${id}`);
      await this.medplum.deleteResource(resourceType, id);
      
      logger.info(`Successfully deleted ${resourceType} with ID: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete ${resourceType} resource with ID ${id}:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Search for FHIR resources
   */
  async searchResources<T extends Resource>(
    resourceType: string, 
    searchParams: FHIRSearchParams = {}
  ): Promise<Bundle<T>> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Searching ${resourceType} resources with params:`, searchParams);
      
      const searchRequest: SearchRequest = {
        resourceType,
        filters: this.convertSearchParams(searchParams),
        count: searchParams._count,
        offset: searchParams._offset,
        sortRules: searchParams._sort ? this.parseSortRules(searchParams._sort) : undefined,
        total: searchParams._total as any,
        summary: searchParams._summary as any,
        elements: searchParams._elements?.split(','),
        include: searchParams._include?.split(','),
        revInclude: searchParams._revinclude?.split(','),
      };

      const result = await this.medplum.search(searchRequest);
      
      logger.debug(`Search returned ${result.entry?.length || 0} results for ${resourceType}`);
      return result as Bundle<T>;
    } catch (error) {
      logger.error(`Failed to search ${resourceType} resources:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Execute a batch or transaction bundle
   */
  async executeBatch(bundleRequest: BundleRequest): Promise<Bundle> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Executing ${bundleRequest.type} bundle with ${bundleRequest.resources.length} resources`);
      
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: bundleRequest.type,
        timestamp: bundleRequest.timestamp || new Date().toISOString(),
        entry: bundleRequest.resources.map((resource, index) => ({
          request: {
            method: resource.id ? 'PUT' : 'POST',
            url: resource.id ? `${resource.resourceType}/${resource.id}` : resource.resourceType,
          },
          resource: resource,
        })),
      };

      const result = await this.medplum.executeBatch(bundle);
      
      logger.info(`Successfully executed ${bundleRequest.type} bundle`);
      return result;
    } catch (error) {
      logger.error(`Failed to execute batch bundle:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Get FHIR capability statement
   */
  async getCapabilityStatement(): Promise<any> {
    this.ensureInitialized();
    
    try {
      logger.debug('Retrieving FHIR capability statement');
      const result = await this.medplum.get('metadata');
      
      logger.debug('Successfully retrieved capability statement');
      return result;
    } catch (error) {
      logger.error('Failed to retrieve capability statement:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Execute GraphQL query
   */
  async graphql(query: string, variables?: Record<string, any>): Promise<any> {
    this.ensureInitialized();
    
    try {
      logger.debug('Executing GraphQL query');
      const result = await this.medplum.graphql(query, variables);
      
      logger.debug('GraphQL query executed successfully');
      return result;
    } catch (error) {
      logger.error('Failed to execute GraphQL query:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Subscribe to resource changes
   */
  async createSubscription(criteria: string, channelType: string, endpoint?: string): Promise<any> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Creating subscription for criteria: ${criteria}`);
      
      const subscription = {
        resourceType: 'Subscription',
        status: 'requested',
        reason: 'OmniCare EMR Integration',
        criteria,
        channel: {
          type: channelType,
          endpoint,
          payload: 'application/fhir+json',
        },
      };

      const result = await this.medplum.createResource(subscription);
      
      logger.info(`Successfully created subscription with ID: ${result.id}`);
      return result;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Validate a FHIR resource
   */
  async validateResource<T extends Resource>(resource: T): Promise<any> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Validating ${resource.resourceType} resource`);
      const result = await this.medplum.validateResource(resource);
      
      logger.debug(`Validation completed for ${resource.resourceType}`);
      return result;
    } catch (error) {
      logger.error(`Failed to validate ${resource.resourceType} resource:`, error);
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Convert search parameters to Medplum filter format
   */
  private convertSearchParams(params: FHIRSearchParams): any[] {
    const filters: any[] = [];
    
    Object.entries(params).forEach(([key, value]) => {
      if (key.startsWith('_') || !value) return;
      
      filters.push({
        code: key,
        operator: 'equals',
        value: String(value),
      });
    });
    
    return filters;
  }

  /**
   * Parse sort rules from string format
   */
  private parseSortRules(sortString: string): any[] {
    return sortString.split(',').map(rule => {
      const [code, order] = rule.trim().split(':');
      return {
        code: code.trim(),
        descending: order?.trim() === 'desc',
      };
    });
  }

  /**
   * Handle FHIR errors and convert to standard format
   */
  private handleFHIRError(error: any): Error {
    if (error.outcome) {
      // FHIR OperationOutcome error
      const issue = error.outcome.issue?.[0];
      const message = issue?.diagnostics || issue?.details?.text || 'FHIR operation failed';
      return new Error(`FHIR Error: ${message}`);
    }
    
    if (error.response?.data?.resourceType === 'OperationOutcome') {
      const issue = error.response.data.issue?.[0];
      const message = issue?.diagnostics || issue?.details?.text || 'FHIR operation failed';
      return new Error(`FHIR Error: ${message}`);
    }
    
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Get health status of the Medplum service
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      if (!this.isInitialized) {
        return { status: 'DOWN', details: { reason: 'Not initialized' } };
      }

      // Test with a simple metadata call
      const start = Date.now();
      await this.medplum.get('metadata');
      const responseTime = Date.now() - start;

      return {
        status: 'UP',
        details: {
          responseTime: `${responseTime}ms`,
          baseUrl: config.medplum.baseUrl,
          selfHosted: config.medplum.selfHosted,
          initialized: this.isInitialized,
        },
      };
    } catch (error) {
      return {
        status: 'DOWN',
        details: {
          error: error instanceof Error ? error.message : String(error),
          reconnectAttempts: this.reconnectAttempts,
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
    // Additional cleanup if needed
  }
}

// Export singleton instance
export const medplumService = new MedplumService();