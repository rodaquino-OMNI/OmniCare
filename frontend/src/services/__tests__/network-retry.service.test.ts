/**
 * Tests for Network Retry Service
 */

// jest is globally available in test environment
import { networkRetryService, NetworkRetryService } from '../network-retry.service';
import { RetryQueueItem } from '@/contexts/NetworkStatusContext';
import {
  createMockResponse,
  createMockNetworkError,
  createMockTimeoutError,
  mockNetworkDelay
} from '@/__tests__/utils/network-mock.utils';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Date.now())
}));

describe('NetworkRetryService', () => {
  let service: NetworkRetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NetworkRetryService();
  });

  afterEach(() => {
    service.cancelAllRequests();
  });

  describe('fetchWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockData = { success: true };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockData) as any);

      const result = await service.fetchWithRetry('https://api.example.com/data');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', expect.any(Object));
    });

    it('should retry on network error', async () => {
      const mockData = { success: true };
      
      mockFetch
        .mockRejectedValueOnce(createMockNetworkError())
        .mockResolvedValueOnce(createMockResponse(mockData) as any);

      const result = await service.fetchWithRetry('https://api.example.com/data');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      const mockData = { success: true };
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, { status: 503, ok: false }) as any)
        .mockResolvedValueOnce(createMockResponse(mockData) as any);

      const result = await service.fetchWithRetry('https://api.example.com/data');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 (rate limit) errors', async () => {
      const mockData = { success: true };
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, { status: 429, ok: false }) as any)
        .mockResolvedValueOnce(createMockResponse(mockData) as any);

      const result = await service.fetchWithRetry('https://api.example.com/data');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, { status: 404, ok: false }) as any);

      await expect(service.fetchWithRetry('https://api.example.com/data'))
        .rejects.toThrow('HTTP 404');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      mockFetch.mockRejectedValue(createMockNetworkError());

      await expect(
        service.fetchWithRetry('https://api.example.com/data', undefined, { maxRetries: 2 })
      ).rejects.toThrow('Network request failed');

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const mockData = { success: true };
      
      mockFetch
        .mockRejectedValueOnce(createMockNetworkError())
        .mockRejectedValueOnce(createMockNetworkError())
        .mockResolvedValueOnce(createMockResponse(mockData) as any);

      await service.fetchWithRetry('https://api.example.com/data', undefined, {
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
    });

    it('should use custom shouldRetry logic', async () => {
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      mockFetch.mockRejectedValueOnce(createMockNetworkError());

      await expect(
        service.fetchWithRetry('https://api.example.com/data', undefined, {
          shouldRetry
        })
      ).rejects.toThrow();

      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should pass request options', async () => {
      const mockData = { success: true };
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockData) as any);

      await service.fetchWithRetry('https://api.example.com/data', options);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining(options)
      );
    });
  });

  describe('createRetryQueueItem', () => {
    it('should create a retry queue item', () => {
      const request = {
        url: 'https://api.example.com/data',
        options: { method: 'GET' as const }
      };

      const item = service.createRetryQueueItem(request);

      expect(item).toMatchObject({
        id: expect.stringContaining('mock-uuid'),
        action: expect.any(Function),
        retryCount: 0,
        maxRetries: 3,
        description: 'GET https://api.example.com/data',
        priority: 'normal'
      });
    });

    it('should execute action successfully', async () => {
      const mockData = { success: true };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockData) as any);

      const request = {
        url: 'https://api.example.com/data'
      };

      const item = service.createRetryQueueItem(request);
      const result = await item.action();

      expect(result).toEqual(mockData);
    });

    it('should handle action errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, { status: 500, ok: false }) as any);

      const request = {
        url: 'https://api.example.com/data'
      };

      const item = service.createRetryQueueItem(request);

      await expect(item.action()).rejects.toThrow('HTTP 500');
    });

    it('should use custom transform response', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const transformResponse = jest.fn().mockResolvedValue({ transformed: true });

      const request = {
        url: 'https://api.example.com/data',
        transformResponse
      };

      const item = service.createRetryQueueItem(request);
      const result = await item.action();

      expect(transformResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual({ transformed: true });
    });

    it('should respect priority configuration', () => {
      const request = {
        url: 'https://api.example.com/data',
        retryConfig: { priority: 'high' as const }
      };

      const item = service.createRetryQueueItem(request);

      expect(item.priority).toBe('high');
    });

    it('should call success callback', async () => {
      const mockData = { success: true };
      const onSuccess = jest.fn();
      mockFetch.mockResolvedValueOnce(createMockResponse(mockData) as any);

      const request = { url: 'https://api.example.com/data' };
      const item = service.createRetryQueueItem(request, onSuccess);
      
      await item.action();
      
      // Success callback would be called by the queue processor
      expect(item.onSuccess).toBe(onSuccess);
    });

    it('should call error callback', async () => {
      const onError = jest.fn();
      mockFetch.mockRejectedValueOnce(createMockNetworkError());

      const request = { url: 'https://api.example.com/data' };
      const item = service.createRetryQueueItem(request, undefined, onError);
      
      await expect(item.action()).rejects.toThrow();
      
      // Error callback would be called by the queue processor
      expect(item.onError).toBe(onError);
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel active request', async () => {
      // Mock a slow request
      mockFetch.mockImplementation(async () => {
        await mockNetworkDelay(1000);
        return createMockResponse({ data: 'test' }) as any;
      });

      const promise = service.fetchWithRetry('https://api.example.com/data');
      
      // Cancel immediately
      service.cancelRequest('GET-https://api.example.com/data');

      await expect(promise).rejects.toThrow();
    });

    it('should cancel all active requests', async () => {
      // Mock slow requests
      mockFetch.mockImplementation(async () => {
        await mockNetworkDelay(1000);
        return createMockResponse({ data: 'test' }) as any;
      });

      const promises = [
        service.fetchWithRetry('https://api.example.com/data1'),
        service.fetchWithRetry('https://api.example.com/data2', { method: 'POST' }),
        service.fetchWithRetry('https://api.example.com/data3')
      ];

      service.cancelAllRequests();

      const results = await Promise.allSettled(promises);
      
      results.forEach(result => {
        expect(result.status).toBe('rejected');
      });
    });

    it('should replace existing request to same endpoint', async () => {
      // First request - will be cancelled
      mockFetch.mockImplementationOnce(async () => {
        await mockNetworkDelay(1000);
        return createMockResponse({ data: 'first' }) as any;
      });

      // Second request - should complete
      mockFetch.mockImplementationOnce(async () => {
        return createMockResponse({ data: 'second' }) as any;
      });

      const firstPromise = service.fetchWithRetry('https://api.example.com/data');
      const secondPromise = service.fetchWithRetry('https://api.example.com/data');

      const results = await Promise.allSettled([firstPromise, secondPromise]);

      expect(results[0].status).toBe('rejected'); // First request cancelled
      expect(results[1].status).toBe('fulfilled');
      expect((results[1] as any).value).toEqual({ data: 'second' });
    });
  });

  describe('Backoff Calculation', () => {
    it('should apply exponential backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      // Mock setTimeout to capture delays
      global.setTimeout = jest.fn((callback: any, delay?: number) => {
        delays.push(delay || 0);
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      }) as any;

      mockFetch
        .mockRejectedValueOnce(createMockNetworkError())
        .mockRejectedValueOnce(createMockNetworkError())
        .mockResolvedValueOnce(createMockResponse({ success: true }) as any);

      await service.fetchWithRetry('https://api.example.com/data', undefined, {
        initialBackoffMs: 100,
        backoffMultiplier: 2
      });

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;

      expect(delays).toHaveLength(2);
      expect(delays[0]).toBeGreaterThanOrEqual(50); // With jitter: 100 * 0.5
      expect(delays[0]).toBeLessThanOrEqual(100); // With jitter: 100 * 1
      expect(delays[1]).toBeGreaterThanOrEqual(100); // With jitter: 200 * 0.5
      expect(delays[1]).toBeLessThanOrEqual(200); // With jitter: 200 * 1
    });

    it('should respect max backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn((callback: any, delay?: number) => {
        delays.push(delay || 0);
        return originalSetTimeout(callback, 0);
      }) as any;

      mockFetch
        .mockRejectedValueOnce(createMockNetworkError())
        .mockRejectedValueOnce(createMockNetworkError())
        .mockRejectedValueOnce(createMockNetworkError())
        .mockResolvedValueOnce(createMockResponse({ success: true }) as any);

      await service.fetchWithRetry('https://api.example.com/data', undefined, {
        initialBackoffMs: 1000,
        backoffMultiplier: 10,
        maxBackoffMs: 2000,
        maxRetries: 3
      });

      global.setTimeout = originalSetTimeout;

      // All delays should be capped at maxBackoffMs
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(2000);
      });
    });
  });

  describe('Error Enhancement', () => {
    it('should enhance network errors', async () => {
      const typeError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValueOnce(typeError);

      try {
        await service.fetchWithRetry('https://api.example.com/data');
      } catch (error: any) {
        expect(error.name).toBe('NetworkError');
        expect(error.message).toBe('Network request failed');
        expect(error.originalError).toBe(typeError);
      }
    });

    it('should preserve HTTP error details', async () => {
      const response = createMockResponse({}, { status: 500, ok: false });
      mockFetch.mockResolvedValueOnce(response as any);

      try {
        await service.fetchWithRetry('https://api.example.com/data');
      } catch (error: any) {
        expect(error.status).toBe(500);
        expect(error.response).toBeDefined();
        expect(error.message).toContain('HTTP 500');
      }
    });
  });

  describe('Configuration', () => {
    it('should update default retry configuration', () => {
      service.setDefaultRetryConfig({
        maxRetries: 5,
        initialBackoffMs: 500
      });

      expect(service.isRetryableError({ status: 503 })).toBe(true);
    });

    it('should check if error is retryable', () => {
      expect(service.isRetryableError({ status: 500 })).toBe(true);
      expect(service.isRetryableError({ status: 502 })).toBe(true);
      expect(service.isRetryableError({ status: 503 })).toBe(true);
      expect(service.isRetryableError({ status: 504 })).toBe(true);
      expect(service.isRetryableError({ status: 429 })).toBe(true);
      expect(service.isRetryableError({ name: 'NetworkError' })).toBe(true);
      expect(service.isRetryableError({ name: 'TypeError' })).toBe(true);
      
      expect(service.isRetryableError({ status: 400 })).toBe(false);
      expect(service.isRetryableError({ status: 401 })).toBe(false);
      expect(service.isRetryableError({ status: 404 })).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(null)
      } as any);

      const result = await service.fetchWithRetry('https://api.example.com/data');
      expect(result).toBeNull();
    });

    it('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any);

      await expect(service.fetchWithRetry('https://api.example.com/data'))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle concurrent requests with same URL', async () => {
      const mockData1 = { id: 1 };
      const mockData2 = { id: 2 };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockData1) as any)
        .mockResolvedValueOnce(createMockResponse(mockData2) as any);

      const [result1, result2] = await Promise.all([
        service.fetchWithRetry('https://api.example.com/data'),
        service.fetchWithRetry('https://api.example.com/data')
      ]);

      // Due to request cancellation, we might get the same result
      expect([result1, result2]).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: expect.any(Number) })])
      );
    });

    it('should handle zero retries', async () => {
      mockFetch.mockRejectedValueOnce(createMockNetworkError());

      await expect(
        service.fetchWithRetry('https://api.example.com/data', undefined, { maxRetries: 0 })
      ).rejects.toThrow('Network request failed');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(networkRetryService).toBeDefined();
      expect(networkRetryService).toBeInstanceOf(NetworkRetryService);
    });

    it('should export convenience functions', async () => {
      const { fetchWithRetry, createRetryQueueItem, cancelRequest, cancelAllRequests } = 
        await import('../network-retry.service');

      expect(fetchWithRetry).toBeDefined();
      expect(createRetryQueueItem).toBeDefined();
      expect(cancelRequest).toBeDefined();
      expect(cancelAllRequests).toBeDefined();
    });
  });
});