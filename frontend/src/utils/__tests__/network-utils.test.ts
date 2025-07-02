/**
 * @jest-environment jsdom
 */

import {
  getNetworkMetrics,
  isNetworkAPISupported,
  estimateBandwidth,
  calculateNetworkQualityScore,
  getNetworkOptimizationSettings,
  formatBytes,
  shouldUseReducedData,
  getRetryStrategy
} from '../network-utils';

// Mock fetch for bandwidth estimation
global.fetch = jest.fn();

// Mock performance.now for bandwidth calculation
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn()
  }
});

describe('Network Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock navigator for each test
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'navigator', {
        value: {},
        writable: true,
        configurable: true
      });
    }
  });
  
  afterEach(() => {
    // Clean up navigator mock
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'navigator', {
        value: window.navigator,
        writable: true,
        configurable: true
      });
    }
  });

  describe('getNetworkMetrics', () => {
    it('should return null in server environment', () => {
      delete (global as any).window;
      
      const metrics = getNetworkMetrics();
      
      expect(metrics).toBeNull();
    });

    it('should return null when no connection API is available', () => {
      // Navigator already mocked as empty object in beforeEach
      
      const metrics = getNetworkMetrics();
      
      expect(metrics).toBeNull();
    });

    it('should return metrics when connection API is available', () => {
      (window as any).navigator.connection = {
        rtt: 50,
        downlink: 10,
        effectiveType: '4g',
        saveData: false
      };
      
      const metrics = getNetworkMetrics();
      
      expect(metrics).toEqual({
        rtt: 50,
        downlink: 10,
        effectiveType: '4g',
        saveData: false
      });
    });

    it('should handle mozConnection API', () => {
      (window as any).navigator.mozConnection = {
        rtt: 100,
        downlink: 5,
        effectiveType: '3g',
        saveData: true
      };
      
      const metrics = getNetworkMetrics();
      
      expect(metrics).toEqual({
        rtt: 100,
        downlink: 5,
        effectiveType: '3g',
        saveData: true
      });
    });

    it('should handle webkitConnection API', () => {
      (window as any).navigator.webkitConnection = {
        rtt: 200,
        downlink: 2,
        effectiveType: '2g',
        saveData: false
      };
      
      const metrics = getNetworkMetrics();
      
      expect(metrics).toEqual({
        rtt: 200,
        downlink: 2,
        effectiveType: '2g',
        saveData: false
      });
    });

    it('should use default values when properties are missing', () => {
      (window as any).navigator.connection = {};
      
      const metrics = getNetworkMetrics();
      
      expect(metrics).toEqual({
        rtt: 0,
        downlink: 0,
        effectiveType: 'unknown',
        saveData: false
      });
    });
  });

  describe('isNetworkAPISupported', () => {
    it('should return false in server environment', () => {
      delete (global as any).window;
      
      const supported = isNetworkAPISupported();
      
      expect(supported).toBe(false);
    });

    it('should return false when no connection API is available', () => {
      // Navigator already mocked as empty object in beforeEach
      
      const supported = isNetworkAPISupported();
      
      expect(supported).toBe(false);
    });

    it('should return true when connection API is available', () => {
      (window as any).navigator.connection = {};
      
      const supported = isNetworkAPISupported();
      
      expect(supported).toBe(true);
    });

    it('should return true when mozConnection API is available', () => {
      (window as any).navigator.mozConnection = {};
      
      const supported = isNetworkAPISupported();
      
      expect(supported).toBe(true);
    });

    it('should return true when webkitConnection API is available', () => {
      (window as any).navigator.webkitConnection = {};
      
      const supported = isNetworkAPISupported();
      
      expect(supported).toBe(true);
    });
  });

  describe('estimateBandwidth', () => {
    beforeEach(() => {
      (global.performance.now as jest.Mock)
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(2000); // End time (1 second duration)
    });

    it('should estimate bandwidth correctly', async () => {
      const mockBlob = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        blob: mockBlob.mockResolvedValueOnce(new Blob())
      });
      
      const bandwidth = await estimateBandwidth('http://test.com/file', 1024 * 1024); // 1MB
      
      // 1MB in 1 second = 8 Mbps
      expect(bandwidth).toBe(8);
      expect(global.fetch).toHaveBeenCalledWith('http://test.com/file', { cache: 'no-cache' });
    });

    it('should handle partial file sizes', async () => {
      const mockBlob = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        blob: mockBlob.mockResolvedValueOnce(new Blob())
      });
      
      (global.performance.now as jest.Mock)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500); // 0.5 second duration
      
      const bandwidth = await estimateBandwidth('http://test.com/file', 512 * 1024); // 512KB
      
      // 512KB in 0.5 seconds = 8.19 Mbps (rounded to 8.19)
      expect(bandwidth).toBe(8.19);
    });

    it('should throw error when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(estimateBandwidth('http://test.com/file', 1024))
        .rejects.toThrow('Failed to estimate bandwidth');
    });

    it('should throw error when blob() fails', async () => {
      const mockBlob = jest.fn().mockRejectedValueOnce(new Error('Blob error'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        blob: mockBlob
      });
      
      await expect(estimateBandwidth('http://test.com/file', 1024))
        .rejects.toThrow('Failed to estimate bandwidth');
    });
  });

  describe('calculateNetworkQualityScore', () => {
    it('should calculate score for excellent network', () => {
      const metrics = {
        latency: 10,     // Very low latency
        bandwidth: 100,  // High bandwidth
        jitter: 5,       // Low jitter
        packetLoss: 0    // No packet loss
      };
      
      const score = calculateNetworkQualityScore(metrics);
      
      expect(score).toBe(100); // Perfect score
    });

    it('should calculate score for poor network', () => {
      const metrics = {
        latency: 300,    // High latency (300ms = 0 score)
        bandwidth: 1,    // Low bandwidth
        jitter: 50,      // High jitter (50ms = 0 score)
        packetLoss: 10   // 10% packet loss
      };
      
      const score = calculateNetworkQualityScore(metrics);
      
      expect(score).toBe(2); // Very low score
    });

    it('should calculate score for moderate network', () => {
      const metrics = {
        latency: 100,    // Moderate latency
        bandwidth: 25,   // Moderate bandwidth (25Mbps = 5 score)
        jitter: 25,      // Moderate jitter
        packetLoss: 1    // 1% packet loss
      };
      
      const score = calculateNetworkQualityScore(metrics);
      
      expect(score).toBe(65);
    });

    it('should handle zero values', () => {
      const metrics = {
        latency: 0,
        bandwidth: 0,
        jitter: 0,
        packetLoss: 0
      };
      
      const score = calculateNetworkQualityScore(metrics);
      
      expect(score).toBe(100); // Perfect for latency, jitter, packet loss; 0 for bandwidth
    });

    it('should cap bandwidth score at 100', () => {
      const metrics = {
        latency: 0,
        bandwidth: 1000, // Very high bandwidth should cap at 100 score
        jitter: 0,
        packetLoss: 0
      };
      
      const score = calculateNetworkQualityScore(metrics);
      
      expect(score).toBe(100);
    });
  });

  describe('getNetworkOptimizationSettings', () => {
    it('should return poor network settings', () => {
      const settings = getNetworkOptimizationSettings('poor');
      
      expect(settings).toEqual({
        imageQuality: 'low',
        videoQuality: 'low',
        prefetchData: false,
        enableAnimations: false,
        cacheStrategy: 'aggressive',
        batchRequests: true,
        compressionLevel: 'high'
      });
    });

    it('should return fair network settings', () => {
      const settings = getNetworkOptimizationSettings('fair');
      
      expect(settings).toEqual({
        imageQuality: 'medium',
        videoQuality: 'medium',
        prefetchData: false,
        enableAnimations: true,
        cacheStrategy: 'moderate',
        batchRequests: true,
        compressionLevel: 'medium'
      });
    });

    it('should return good network settings', () => {
      const settings = getNetworkOptimizationSettings('good');
      
      expect(settings).toEqual({
        imageQuality: 'high',
        videoQuality: 'high',
        prefetchData: true,
        enableAnimations: true,
        cacheStrategy: 'balanced',
        batchRequests: false,
        compressionLevel: 'low'
      });
    });

    it('should return excellent network settings', () => {
      const settings = getNetworkOptimizationSettings('excellent');
      
      expect(settings).toEqual({
        imageQuality: 'original',
        videoQuality: 'hd',
        prefetchData: true,
        enableAnimations: true,
        cacheStrategy: 'minimal',
        batchRequests: false,
        compressionLevel: 'none'
      });
    });
  });

  describe('formatBytes', () => {
    it('should format zero bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatBytes(512)).toBe('512 Bytes');
      expect(formatBytes(1000)).toBe('1000 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });

    it('should handle custom decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 3)).toBe('1.500 KB');
    });

    it('should handle negative decimal places', () => {
      expect(formatBytes(1536, -1)).toBe('2 KB');
    });

    it('should handle very large numbers', () => {
      const largeNumber = 1024 ** 5; // 1 PB (beyond TB)
      const result = formatBytes(largeNumber);
      expect(result).toContain('1024 TB'); // Should show as TB since that's the largest unit
    });
  });

  describe('shouldUseReducedData', () => {
    it('should use reduced data when user preference is save-data', () => {
      expect(shouldUseReducedData('excellent', false, 'save-data')).toBe(true);
      expect(shouldUseReducedData('poor', false, 'save-data')).toBe(true);
    });

    it('should not use reduced data when user preference is quality', () => {
      expect(shouldUseReducedData('poor', true, 'quality')).toBe(false);
      expect(shouldUseReducedData('excellent', true, 'quality')).toBe(false);
    });

    it('should use reduced data when save data is enabled', () => {
      expect(shouldUseReducedData('excellent', true, 'normal')).toBe(true);
      expect(shouldUseReducedData('poor', true, 'normal')).toBe(true);
    });

    it('should use reduced data for poor/fair networks when auto mode', () => {
      expect(shouldUseReducedData('poor', false, 'auto')).toBe(true);
      expect(shouldUseReducedData('fair', false, 'auto')).toBe(true);
      expect(shouldUseReducedData('good', false, 'auto')).toBe(false);
      expect(shouldUseReducedData('excellent', false, 'auto')).toBe(false);
    });

    it('should not use reduced data for normal preference with good network', () => {
      expect(shouldUseReducedData('good', false, 'normal')).toBe(false);
      expect(shouldUseReducedData('excellent', false, 'normal')).toBe(false);
    });
  });

  describe('getRetryStrategy', () => {
    it('should return poor network retry strategy', () => {
      const strategy = getRetryStrategy('poor');
      
      expect(strategy).toEqual({
        maxRetries: 5,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 3
      });
    });

    it('should return fair network retry strategy', () => {
      const strategy = getRetryStrategy('fair');
      
      expect(strategy).toEqual({
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2
      });
    });

    it('should return good network retry strategy', () => {
      const strategy = getRetryStrategy('good');
      
      expect(strategy).toEqual({
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 10000,
        backoffMultiplier: 2
      });
    });

    it('should return excellent network retry strategy', () => {
      const strategy = getRetryStrategy('excellent');
      
      expect(strategy).toEqual({
        maxRetries: 1,
        initialDelay: 250,
        maxDelay: 5000,
        backoffMultiplier: 1.5
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing window object gracefully', () => {
      delete (global as any).window;
      
      expect(getNetworkMetrics()).toBeNull();
      expect(isNetworkAPISupported()).toBe(false);
    });

    it('should handle missing navigator object gracefully', () => {
      delete (window as any).navigator;
      
      expect(getNetworkMetrics()).toBeNull();
      expect(isNetworkAPISupported()).toBe(false);
    });

    it('should handle zero bandwidth estimation time', () => {
      (global.performance.now as jest.Mock)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1000); // Same time = 0 duration
      
      const mockBlob = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        blob: mockBlob.mockResolvedValueOnce(new Blob())
      });
      
      expect(estimateBandwidth('http://test.com/file', 1024)).rejects.toThrow();
    });

    it('should handle extremely high values in network quality calculation', () => {
      const metrics = {
        latency: Number.MAX_SAFE_INTEGER,
        bandwidth: Number.MAX_SAFE_INTEGER,
        jitter: Number.MAX_SAFE_INTEGER,
        packetLoss: 100
      };
      
      const score = calculateNetworkQualityScore(metrics);
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});