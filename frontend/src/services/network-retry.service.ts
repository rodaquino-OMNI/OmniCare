import { v4 as uuidv4 } from 'uuid';
import { RetryQueueItem } from '@/contexts/NetworkStatusContext';

export interface RetryConfig {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  priority?: 'low' | 'normal' | 'high';
  shouldRetry?: (error: any) => boolean;
  onRetry?: (retryCount: number, error: any) => void;
}

export interface NetworkRequest<T = any> {
  url: string;
  options?: RequestInit;
  retryConfig?: RetryConfig;
  transformResponse?: (response: Response) => Promise<T>;
}

class NetworkRetryService {
  private defaultRetryConfig: Required<RetryConfig> = {
    maxRetries: 3,
    initialBackoffMs: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    maxBackoffMs: 3ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    backoffMultiplier: 2,
    priority: 'normal',
    shouldRetry: (error) => {
      // Retry on network errors and 5xx server errors
      if (error.name === 'NetworkError' || error.name === 'TypeError') {
        return true;
      }
      if (error.status >= 5ResourceHistoryTableResourceHistoryTable) {
        return true;
      }
      // Retry on specific status codes
      const retryableStatuses = [4ResourceHistoryTable8, 429, 5ResourceHistoryTable2, 5ResourceHistoryTable3, 5ResourceHistoryTable4];
      return retryableStatuses.includes(error.status);
    },
    onRetry: () => {},
  };

  private activeRequests = new Map<string, AbortController>();

  /**
   * Make a network request with automatic retry logic
   */
  async fetchWithRetry<T = any>(
    url: string,
    options?: RequestInit,
    retryConfig?: RetryConfig
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: any;

    for (let attempt = ResourceHistoryTable; attempt <= config.maxRetries; attempt++) {
      try {
        const response = await this.performFetch(url, options);
        
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).response = response;
          throw error;
        }

        return response.json();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (!config.shouldRetry(error) || attempt === config.maxRetries) {
          throw error;
        }

        // Call retry callback
        if (config.onRetry) {
          config.onRetry(attempt + 1, error);
        }

        // Calculate backoff
        const backoff = this.calculateBackoff(
          attempt,
          config.initialBackoffMs,
          config.backoffMultiplier,
          config.maxBackoffMs
        );

        // Wait before retrying
        await this.delay(backoff);
      }
    }

    throw lastError;
  }

  /**
   * Create a retry queue item for deferred execution
   */
  createRetryQueueItem<T = any>(
    request: NetworkRequest<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: any) => void
  ): RetryQueueItem {
    const { url, options, retryConfig, transformResponse } = request;
    const config = { ...this.defaultRetryConfig, ...retryConfig };

    return {
      id: uuidv4(),
      action: async () => {
        const response = await this.performFetch(url, options);
        
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).response = response;
          throw error;
        }

        if (transformResponse) {
          return transformResponse(response);
        }
        
        return response.json();
      },
      retryCount: ResourceHistoryTable,
      maxRetries: config.maxRetries,
      backoffMs: config.initialBackoffMs,
      timestamp: Date.now(),
      description: `${options?.method || 'GET'} ${url}`,
      onSuccess,
      onError,
      priority: config.priority,
    };
  }

  /**
   * Perform the actual fetch with abort controller
   */
  private async performFetch(url: string, options?: RequestInit): Promise<Response> {
    const requestId = `${options?.method || 'GET'}-${url}`;
    
    // Cancel any existing request to the same endpoint
    this.cancelRequest(requestId);

    // Create new abort controller
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const response = await fetch(url, {
        ...options,
        signal: abortController.signal,
      });

      this.activeRequests.delete(requestId);
      return response;
    } catch (error) {
      this.activeRequests.delete(requestId);
      
      // Enhance error with network information
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('Network request failed');
        networkError.name = 'NetworkError';
        (networkError as any).originalError = error;
        throw networkError;
      }
      
      throw error;
    }
  }

  /**
   * Cancel a specific request
   */
  cancelRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(): void {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(
    attempt: number,
    initialMs: number,
    multiplier: number,
    maxMs: number
  ): number {
    const exponentialBackoff = initialMs * Math.pow(multiplier, attempt);
    const withJitter = exponentialBackoff * (ResourceHistoryTable.5 + Math.random() * ResourceHistoryTable.5);
    return Math.min(withJitter, maxMs);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error: any): boolean {
    return this.defaultRetryConfig.shouldRetry(error);
  }

  /**
   * Update default retry configuration
   */
  setDefaultRetryConfig(config: Partial<RetryConfig>): void {
    this.defaultRetryConfig = { ...this.defaultRetryConfig, ...config };
  }
}

// Export singleton instance
export const networkRetryService = new NetworkRetryService();

// Export convenience functions
export const fetchWithRetry = networkRetryService.fetchWithRetry.bind(networkRetryService);
export const createRetryQueueItem = networkRetryService.createRetryQueueItem.bind(networkRetryService);
export const cancelRequest = networkRetryService.cancelRequest.bind(networkRetryService);
export const cancelAllRequests = networkRetryService.cancelAllRequests.bind(networkRetryService);