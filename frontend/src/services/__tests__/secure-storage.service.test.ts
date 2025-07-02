/**
 * @jest-environment jsdom
 */

import { SecureStorageService } from '../secure-storage.service';

// Mock dependencies
jest.mock('../offline-security.service', () => ({
  offlineSecurityService: {
    encryptData: jest.fn().mockResolvedValue({ id: 'encrypted-id', data: 'encrypted-data' }),
    decryptData: jest.fn().mockResolvedValue({ key: 'test-key', value: '{"test": "data"}', compressed: false }),
    storeSecureData: jest.fn().mockResolvedValue(undefined),
    retrieveSecureData: jest.fn().mockResolvedValue({ id: 'encrypted-id', data: 'encrypted-data' }),
    clearAllOfflineData: jest.fn().mockResolvedValue(undefined),
    getStorageStats: jest.fn().mockResolvedValue({ totalSize: 1024 })
  }
}));

jest.mock('@/utils/offline-encryption.utils', () => ({
  compressData: jest.fn().mockResolvedValue(Buffer.from('compressed')),
  decompressData: jest.fn().mockResolvedValue('decompressed'),
  calculateHash: jest.fn().mockResolvedValue('hash123')
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('SecureStorageService', () => {
  let secureStorage: SecureStorageService;

  beforeEach(() => {
    secureStorage = SecureStorageService.getInstance();
    jest.clearAllMocks();
    // Clear the internal cache
    (secureStorage as any).cache.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SecureStorageService.getInstance();
      const instance2 = SecureStorageService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Basic Storage Operations', () => {
    it('should store item successfully', async () => {
      const testData = { message: 'Hello, World!' };
      
      await secureStorage.setItem('test-key', testData);
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalled();
      expect(offlineSecurityService.storeSecureData).toHaveBeenCalled();
    });

    it('should store item with custom options', async () => {
      const testData = { sensitive: 'data' };
      const options = {
        classification: 'phi' as const,
        ttl: 3600000,
        compress: true,
        metadata: { source: 'test' }
      };
      
      await secureStorage.setItem('sensitive-key', testData, options);
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'sensitive-key',
          metadata: expect.objectContaining({
            source: 'test',
            contentType: 'object'
          })
        }),
        'phi',
        undefined // userId will be undefined in test
      );
    });

    it('should compress large data automatically', async () => {
      const largeData = { data: 'x'.repeat(10000) }; // Large data > 5KB
      
      await secureStorage.setItem('large-key', largeData);
      
      const { compressData } = require('@/utils/offline-encryption.utils');
      expect(compressData).toHaveBeenCalled();
    });

    it('should retrieve stored item', async () => {
      const expectedData = { test: 'data' };
      
      const result = await secureStorage.getItem<typeof expectedData>('test-key');
      
      expect(result).toEqual(expectedData);
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.retrieveSecureData).toHaveBeenCalled();
      expect(offlineSecurityService.decryptData).toHaveBeenCalled();
    });

    it('should return null for non-existent item', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.retrieveSecureData.mockResolvedValueOnce(null);
      
      const result = await secureStorage.getItem('non-existent-key');
      
      expect(result).toBeNull();
    });

    it('should handle decompression for compressed data', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData.mockResolvedValueOnce({
        key: 'test-key',
        value: 'compressed-data',
        compressed: true
      });
      
      const { decompressData } = require('@/utils/offline-encryption.utils');
      decompressData.mockResolvedValueOnce('{"decompressed": "data"}');
      
      const result = await secureStorage.getItem('compressed-key');
      
      expect(decompressData).toHaveBeenCalled();
      expect(result).toEqual({ decompressed: 'data' });
    });

    it('should remove item successfully', async () => {
      await secureStorage.removeItem('test-key');
      
      // Should attempt to find and remove encrypted items
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.retrieveSecureData).toHaveBeenCalled();
    });

    it('should check if item exists', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.retrieveSecureData.mockResolvedValueOnce({ id: 'found' });
      
      const exists = await secureStorage.hasItem('existing-key');
      
      expect(exists).toBe(true);
    });

    it('should return false for non-existent item check', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.retrieveSecureData.mockResolvedValueOnce(null);
      
      const exists = await secureStorage.hasItem('non-existent');
      
      expect(exists).toBe(false);
    });
  });

  describe('Cache Operations', () => {
    it('should use cache for frequently accessed items', async () => {
      const testData = { cached: 'data' };
      
      // First call should fetch from storage
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData.mockResolvedValueOnce({
        key: 'cached-key',
        value: JSON.stringify(testData),
        compressed: false
      });
      
      const result1 = await secureStorage.getItem('cached-key');
      expect(result1).toEqual(testData);
      
      // Second call should use cache
      const result2 = await secureStorage.getItem('cached-key');
      expect(result2).toEqual(testData);
      
      // Should only call retrieval once (first time)
      expect(offlineSecurityService.retrieveSecureData).toHaveBeenCalledTimes(1);
    });

    it('should manage cache size with LRU eviction', async () => {
      const maxCacheSize = 10;
      
      // Fill cache beyond limit
      for (let i = 0; i < maxCacheSize + 2; i++) {
        const { offlineSecurityService } = require('../offline-security.service');
        offlineSecurityService.decryptData.mockResolvedValue({
          key: `key-${i}`,
          value: `{"data": "${i}"}`,
          compressed: false
        });
        
        await secureStorage.getItem(`key-${i}`);
      }
      
      const cache = (secureStorage as any).cache;
      expect(cache.size).toBeLessThanOrEqual(maxCacheSize);
    });

    it('should remove item from cache when deleted', async () => {
      // Add item to cache first
      await secureStorage.setItem('cache-test', { data: 'test' });
      
      // Remove item
      await secureStorage.removeItem('cache-test');
      
      const cache = (secureStorage as any).cache;
      expect(cache.has('cache-test')).toBe(false);
    });
  });

  describe('Patient Data Operations', () => {
    it('should store patient data with PHI classification', async () => {
      const patientData = {
        name: 'John Doe',
        ssn: '123-45-6789',
        dob: '1980-01-01'
      };
      
      await secureStorage.storePatientData('patient-123', 'demographics', patientData);
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'patient_patient-123_demographics'
        }),
        'phi',
        undefined
      );
    });

    it('should retrieve patient data', async () => {
      const expectedData = { name: 'John Doe' };
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData.mockResolvedValueOnce({
        key: 'patient_patient-123_vitals',
        value: JSON.stringify(expectedData),
        compressed: false
      });
      
      const result = await secureStorage.getPatientData('patient-123', 'vitals');
      
      expect(result).toEqual(expectedData);
    });
  });

  describe('Session Data Operations', () => {
    it('should store session data with sensitive classification', async () => {
      const sessionData = { token: 'abc123', expires: Date.now() + 900000 };
      
      await secureStorage.storeSessionData('session-123', sessionData);
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'session_session-123'
        }),
        'sensitive',
        undefined
      );
    });

    it('should retrieve session data', async () => {
      const expectedData = { token: 'abc123' };
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData.mockResolvedValueOnce({
        key: 'session_session-123',
        value: JSON.stringify(expectedData),
        compressed: false
      });
      
      const result = await secureStorage.getSessionData('session-123');
      
      expect(result).toEqual(expectedData);
    });
  });

  describe('Batch Operations', () => {
    it('should set multiple items in batch', async () => {
      const items = [
        { key: 'item1', value: { data: 1 } },
        { key: 'item2', value: { data: 2 }, options: { classification: 'sensitive' as const } },
        { key: 'item3', value: { data: 3 } }
      ];
      
      await secureStorage.setItems(items);
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledTimes(3);
      expect(offlineSecurityService.storeSecureData).toHaveBeenCalledTimes(3);
    });

    it('should get multiple items in batch', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const { offlineSecurityService } = require('../offline-security.service');
      
      // Mock different responses for each key
      offlineSecurityService.decryptData
        .mockResolvedValueOnce({ key: 'key1', value: '{"data": 1}', compressed: false })
        .mockResolvedValueOnce({ key: 'key2', value: '{"data": 2}', compressed: false })
        .mockResolvedValueOnce({ key: 'key3', value: '{"data": 3}', compressed: false });
      
      const results = await secureStorage.getItems(keys);
      
      expect(results.size).toBe(3);
      expect(results.get('key1')).toEqual({ data: 1 });
      expect(results.get('key2')).toEqual({ data: 2 });
      expect(results.get('key3')).toEqual({ data: 3 });
    });
  });

  describe('Storage Management', () => {
    it('should get storage size', async () => {
      const size = await secureStorage.getStorageSize();
      
      expect(size).toBe(1024);
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.getStorageStats).toHaveBeenCalled();
    });

    it('should clear all storage', async () => {
      await secureStorage.clear();
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.clearAllOfflineData).toHaveBeenCalled();
    });

    it('should get all keys', async () => {
      // Mock cache has some keys
      const cache = (secureStorage as any).cache;
      cache.set('cached-key', 'data');
      
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData.mockResolvedValue({
        key: 'stored-key',
        value: 'data',
        compressed: false
      });
      
      const keys = await secureStorage.keys();
      
      expect(keys).toContain('cached-key');
    });
  });

  describe('Data Import/Export', () => {
    it('should export data successfully', async () => {
      // Mock some data to export
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData
        .mockResolvedValueOnce({ key: 'key1', value: 'data1', compressed: false })
        .mockResolvedValueOnce({ key: 'key2', value: 'data2', compressed: false });
      
      const exported = await secureStorage.exportData();
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should import data successfully', async () => {
      const importData = JSON.stringify([
        { key: 'imported-key1', value: { data: 1 } },
        { key: 'imported-key2', value: { data: 2 } }
      ]);
      
      await secureStorage.importData(importData);
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid import data', async () => {
      const invalidData = 'invalid-json';
      
      await expect(secureStorage.importData(invalidData))
        .rejects.toThrow('Import failed');
    });

    it('should handle non-array import data', async () => {
      const invalidData = JSON.stringify({ not: 'array' });
      
      await expect(secureStorage.importData(invalidData))
        .rejects.toThrow('Invalid backup format');
    });
  });

  describe('User Context', () => {
    it('should get current user ID from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify({
        state: { user: { id: 'user-123' } }
      }));
      
      await secureStorage.setItem('test', { data: 'test' });
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledWith(
        expect.any(Object),
        'general',
        'user-123'
      );
    });

    it('should handle missing user context gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);
      
      await secureStorage.setItem('test', { data: 'test' });
      
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledWith(
        expect.any(Object),
        'general',
        undefined
      );
    });

    it('should handle corrupted localStorage data', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json{');
      
      await secureStorage.setItem('test', { data: 'test' });
      
      // Should not throw and use undefined userId
      const { offlineSecurityService } = require('../offline-security.service');
      expect(offlineSecurityService.encryptData).toHaveBeenCalledWith(
        expect.any(Object),
        'general',
        undefined
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors gracefully', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.encryptData.mockRejectedValueOnce(new Error('Encryption failed'));
      
      await expect(secureStorage.setItem('test', { data: 'test' }))
        .rejects.toThrow('Failed to store item');
    });

    it('should handle decryption errors gracefully', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.decryptData.mockRejectedValueOnce(new Error('Decryption failed'));
      
      const result = await secureStorage.getItem('test');
      
      expect(result).toBeNull();
    });

    it('should handle removal errors gracefully', async () => {
      const { offlineSecurityService } = require('../offline-security.service');
      offlineSecurityService.retrieveSecureData.mockRejectedValueOnce(new Error('Retrieval failed'));
      
      await expect(secureStorage.removeItem('test'))
        .rejects.toThrow('Failed to remove item');
    });
  });

  describe('Compression Logic', () => {
    it('should determine compression based on data size', () => {
      const shouldCompress = (secureStorage as any).shouldCompress.bind(secureStorage);
      
      const smallData = { small: 'data' };
      const largeData = { large: 'x'.repeat(10000) };
      
      expect(shouldCompress(smallData)).toBe(false);
      expect(shouldCompress(largeData)).toBe(true);
    });

    it('should respect compression option override', async () => {
      const smallData = { small: 'data' };
      
      await secureStorage.setItem('test', smallData, { compress: true });
      
      const { compressData } = require('@/utils/offline-encryption.utils');
      expect(compressData).toHaveBeenCalled();
    });
  });
});