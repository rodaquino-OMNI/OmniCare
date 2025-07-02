import { MedplumClient, MedplumClientOptions, OperationOutcome } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';
import { networkRetryService } from '@/services/network-retry.service';
import { useNetworkStatusContext } from '@/contexts/NetworkStatusContext';

/**
 * Enhanced Medplum Client with OmniCare-specific features
 * 
 * This client extends the base MedplumClient to add:
 * - Intelligent retry logic based on network conditions
 * - Request/response interceptors
 * - Enhanced error handling
 * - Integration with OmniCare's offline capabilities
 */

export interface RequestInterceptor {
  onRequest?: (config: RequestInit) => RequestInit | Promise<RequestInit>;
  onResponse?: (response: Response) => Response | Promise<Response>;
  onError?: (error: Error) => Error | Promise<Error>;
}

export interface EnhancedMedplumClientOptions extends MedplumClientOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[];
  interceptors?: RequestInterceptor[];
}

export class FHIRError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public operationOutcome?: OperationOutcome,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'FHIRError';
  }

  static fromOperationOutcome(outcome: OperationOutcome, statusCode?: number): FHIRError {
    const issue = outcome.issue[0];
    return new FHIRError(
      issue.diagnostics || issue.details?.text || 'Unknown error',
      issue.code,
      statusCode,
      outcome,
      this.isRetryable(issue.code, statusCode)
    );
  }

  private static isRetryable(code: string, statusCode?: number): boolean {
    const retryableCodes = ['timeout', 'throttled', 'exception', 'transient'];
    const retryableStatus = [408, 429, 500, 502, 503, 504];
    
    return retryableCodes.includes(code) || 
           (statusCode ? retryableStatus.includes(statusCode) : false);
  }
}

export class EnhancedMedplumClient extends MedplumClient {
  private interceptors: RequestInterceptor[] = [];
  private maxRetries: number;
  private retryDelay: number;
  private retryOn: number[];

  constructor(options: EnhancedMedplumClientOptions) {
    super(options);
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.retryOn = options.retryOn || [408, 429, 500, 502, 503, 504];
    this.interceptors = options.interceptors || [];
  }

  /**
   * Add a request/response interceptor
   */
  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Remove an interceptor
   */
  removeInterceptor(interceptor: RequestInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
    }
  }

  /**
   * Override fetch to add retry logic and interceptors
   */
  protected async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    let config = init || {};
    
    // Apply request interceptors
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        config = await interceptor.onRequest(config);
      }
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await super.fetch(input, config);
        
        // Apply response interceptors
        let processedResponse = response;
        for (const interceptor of this.interceptors) {
          if (interceptor.onResponse) {
            processedResponse = await interceptor.onResponse(processedResponse);
          }
        }

        // Check if we should retry based on status
        if (!response.ok && this.shouldRetry(response.status, attempt)) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          await this.delay(this.calculateDelay(attempt));
          continue;
        }

        return processedResponse;
      } catch (error) {
        lastError = error as Error;
        
        // Apply error interceptors
        for (const interceptor of this.interceptors) {
          if (interceptor.onError) {
            lastError = await interceptor.onError(lastError);
          }
        }

        // Check if we should retry
        if (attempt < this.maxRetries && this.isNetworkError(lastError)) {
          await this.delay(this.calculateDelay(attempt));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Enhanced resource creation with offline support
   */
  async createResource<T extends Resource>(resource: T): Promise<T> {
    try {
      return await super.createResource(resource);
    } catch (error) {
      // If offline, queue for later sync
      if (this.isOfflineError(error)) {
        return this.queueOfflineOperation('create', resource);
      }
      throw this.enhanceError(error);
    }
  }

  /**
   * Enhanced resource update with conflict detection
   */
  async updateResource<T extends Resource>(resource: T): Promise<T> {
    try {
      return await super.updateResource(resource);
    } catch (error) {
      // Handle 409 Conflict
      if (this.isConflictError(error)) {
        return this.handleConflict(resource);
      }
      
      // If offline, queue for later sync
      if (this.isOfflineError(error)) {
        return this.queueOfflineOperation('update', resource);
      }
      
      throw this.enhanceError(error);
    }
  }

  /**
   * Batch operations with intelligent chunking
   */
  async executeBatchWithChunking(bundle: Bundle, chunkSize: number = 100): Promise<Bundle> {
    if (!bundle.entry || bundle.entry.length <= chunkSize) {
      return super.executeBatch(bundle);
    }

    // Split into chunks
    const chunks: Bundle[] = [];
    for (let i = 0; i < bundle.entry.length; i += chunkSize) {
      chunks.push({
        resourceType: 'Bundle',
        type: 'batch',
        entry: bundle.entry.slice(i, i + chunkSize)
      });
    }

    // Execute chunks in parallel (max 3 at a time)
    const results: Bundle[] = [];
    for (let i = 0; i < chunks.length; i += 3) {
      const chunkBatch = chunks.slice(i, i + 3);
      const chunkResults = await Promise.all(
        chunkBatch.map(chunk => super.executeBatch(chunk))
      );
      results.push(...chunkResults);
    }

    // Combine results
    return {
      resourceType: 'Bundle',
      type: 'batch-response',
      entry: results.flatMap(r => r.entry || [])
    };
  }

  /**
   * Search with automatic pagination
   */
  async *searchIterator<T extends Resource>(
    resourceType: string,
    params?: Record<string, string | number | boolean>
  ): AsyncGenerator<T, void, unknown> {
    let url: string | undefined = this.fhir(resourceType).search(params).href;
    
    while (url) {
      const bundle = await this.get(url);
      
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource) {
            yield entry.resource as T;
          }
        }
      }
      
      // Get next page URL
      url = bundle.link?.find(l => l.relation === 'next')?.url;
    }
  }

  /**
   * Helper methods
   */
  private shouldRetry(status: number, attempt: number): boolean {
    return attempt < this.maxRetries && this.retryOn.includes(status);
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.retryDelay * Math.pow(2, attempt),
      30000 // Max 30 seconds
    );
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.round(exponentialDelay + jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isNetworkError(error: any): boolean {
    return error?.code === 'NETWORK_ERROR' || 
           error?.message?.includes('network') ||
           error?.message?.includes('fetch');
  }

  private isOfflineError(error: any): boolean {
    return !navigator.onLine || this.isNetworkError(error);
  }

  private isConflictError(error: any): boolean {
    return error?.status === 409 || error?.statusCode === 409;
  }

  private enhanceError(error: any): Error {
    if (error?.outcome) {
      return FHIRError.fromOperationOutcome(error.outcome, error.status);
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private async queueOfflineOperation<T extends Resource>(
    operation: 'create' | 'update',
    resource: T
  ): Promise<T> {
    // This would integrate with OmniCare's offline sync service
    // For now, return the resource with a temporary ID
    if (operation === 'create' && !resource.id) {
      resource.id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Queue for sync
    // await offlineSyncService.queueOperation(operation, resource);
    
    return resource;
  }

  private async handleConflict<T extends Resource>(resource: T): Promise<T> {
    // Fetch the latest version
    const latest = await this.readResource(resource.resourceType, resource.id!);
    
    // This would integrate with OmniCare's conflict resolution
    // For now, throw an error with both versions
    throw new FHIRError(
      'Resource conflict detected',
      'conflict',
      409,
      undefined,
      false
    );
  }
}

/**
 * Factory function to create an enhanced Medplum client
 */
export function createEnhancedMedplumClient(
  options?: Partial<EnhancedMedplumClientOptions>
): EnhancedMedplumClient {
  const defaultOptions: EnhancedMedplumClientOptions = {
    baseUrl: process.env.NEXT_PUBLIC_MEDPLUM_URL || 'https://api.medplum.com',
    clientId: process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID,
    maxRetries: 3,
    retryDelay: 1000,
    retryOn: [408, 429, 500, 502, 503, 504],
    ...options,
  };

  const client = new EnhancedMedplumClient(defaultOptions);

  // Add default interceptors
  client.addInterceptor({
    onRequest: (config) => {
      // Add custom headers
      const headers = new Headers(config.headers);
      headers.set('X-Client-Version', process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0');
      
      return {
        ...config,
        headers
      };
    },
    onError: (error) => {
      // Log errors for monitoring
      console.error('[MedplumClient] Request failed:', error);
      return error;
    }
  });

  return client;
}

// Export a singleton instance
export const enhancedMedplumClient = createEnhancedMedplumClient();