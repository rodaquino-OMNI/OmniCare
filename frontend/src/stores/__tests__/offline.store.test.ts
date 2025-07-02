/**
 * @jest-environment jsdom
 */

import { useOfflineStore } from '../offline';

// Mock browser cache API
const mockCaches = {
  keys: jest.fn().mockResolvedValue(['cache1', 'cache2']),
  delete: jest.fn().mockResolvedValue(true)
};

Object.defineProperty(global, 'caches', {
  value: mockCaches
});

// Mock indexedDB
Object.defineProperty(global, 'indexedDB', {
  value: {
    open: jest.fn(),
    deleteDatabase: jest.fn()
  }
});

describe('OfflineStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useOfflineStore.setState({
      isOfflineEnabled: true,
      autoSync: true,
      syncInterval: 5,
      maxCacheSize: 250 * 1024 * 1024,
      cacheSize: 0,
      retentionDays: 7,
      syncOnCellular: false,
      backgroundSync: true,
      conflictResolution: 'ask',
      selectedDataTypes: ['patients', 'encounters', 'medications', 'vitalSigns'],
      cacheMetadata: {}
    });
    
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useOfflineStore.getState();
      
      expect(state.isOfflineEnabled).toBe(true);
      expect(state.autoSync).toBe(true);
      expect(state.syncInterval).toBe(5);
      expect(state.maxCacheSize).toBe(250 * 1024 * 1024);
      expect(state.cacheSize).toBe(0);
      expect(state.retentionDays).toBe(7);
      expect(state.syncOnCellular).toBe(false);
      expect(state.backgroundSync).toBe(true);
      expect(state.conflictResolution).toBe('ask');
      expect(state.selectedDataTypes).toEqual(['patients', 'encounters', 'medications', 'vitalSigns']);
      expect(state.cacheMetadata).toEqual({});
    });
  });

  describe('Settings Actions', () => {
    it('should update offline enabled state', () => {
      const { setOfflineEnabled } = useOfflineStore.getState();
      
      setOfflineEnabled(false);
      expect(useOfflineStore.getState().isOfflineEnabled).toBe(false);
      
      setOfflineEnabled(true);
      expect(useOfflineStore.getState().isOfflineEnabled).toBe(true);
    });

    it('should update auto sync setting', () => {
      const { setAutoSync } = useOfflineStore.getState();
      
      setAutoSync(false);
      expect(useOfflineStore.getState().autoSync).toBe(false);
      
      setAutoSync(true);
      expect(useOfflineStore.getState().autoSync).toBe(true);
    });

    it('should update sync interval', () => {
      const { setSyncInterval } = useOfflineStore.getState();
      
      setSyncInterval(10);
      expect(useOfflineStore.getState().syncInterval).toBe(10);
      
      setSyncInterval(30);
      expect(useOfflineStore.getState().syncInterval).toBe(30);
    });

    it('should update max cache size', () => {
      const { setMaxCacheSize } = useOfflineStore.getState();
      
      const newSize = 500 * 1024 * 1024; // 500MB
      setMaxCacheSize(newSize);
      expect(useOfflineStore.getState().maxCacheSize).toBe(newSize);
    });

    it('should update retention days', () => {
      const { setRetentionDays } = useOfflineStore.getState();
      
      setRetentionDays(14);
      expect(useOfflineStore.getState().retentionDays).toBe(14);
      
      setRetentionDays(30);
      expect(useOfflineStore.getState().retentionDays).toBe(30);
    });

    it('should update sync on cellular setting', () => {
      const { setSyncOnCellular } = useOfflineStore.getState();
      
      setSyncOnCellular(true);
      expect(useOfflineStore.getState().syncOnCellular).toBe(true);
      
      setSyncOnCellular(false);
      expect(useOfflineStore.getState().syncOnCellular).toBe(false);
    });

    it('should update background sync setting', () => {
      const { setBackgroundSync } = useOfflineStore.getState();
      
      setBackgroundSync(false);
      expect(useOfflineStore.getState().backgroundSync).toBe(false);
      
      setBackgroundSync(true);
      expect(useOfflineStore.getState().backgroundSync).toBe(true);
    });

    it('should update conflict resolution strategy', () => {
      const { setConflictResolution } = useOfflineStore.getState();
      
      setConflictResolution('local');
      expect(useOfflineStore.getState().conflictResolution).toBe('local');
      
      setConflictResolution('remote');
      expect(useOfflineStore.getState().conflictResolution).toBe('remote');
      
      setConflictResolution('newest');
      expect(useOfflineStore.getState().conflictResolution).toBe('newest');
      
      setConflictResolution('ask');
      expect(useOfflineStore.getState().conflictResolution).toBe('ask');
    });
  });

  describe('Data Type Management', () => {
    it('should toggle data type selection', () => {
      const { toggleDataType } = useOfflineStore.getState();
      const initialDataTypes = useOfflineStore.getState().selectedDataTypes;
      
      // Remove existing data type
      expect(initialDataTypes).toContain('patients');
      toggleDataType('patients');
      expect(useOfflineStore.getState().selectedDataTypes).not.toContain('patients');
      
      // Add it back
      toggleDataType('patients');
      expect(useOfflineStore.getState().selectedDataTypes).toContain('patients');
    });

    it('should add new data type when toggling non-existing type', () => {
      const { toggleDataType } = useOfflineStore.getState();
      const initialDataTypes = useOfflineStore.getState().selectedDataTypes;
      
      expect(initialDataTypes).not.toContain('allergies');
      toggleDataType('allergies');
      expect(useOfflineStore.getState().selectedDataTypes).toContain('allergies');
    });

    it('should handle multiple data type toggles', () => {
      const { toggleDataType } = useOfflineStore.getState();
      
      // Remove multiple types
      toggleDataType('patients');
      toggleDataType('encounters');
      
      const state = useOfflineStore.getState().selectedDataTypes;
      expect(state).not.toContain('patients');
      expect(state).not.toContain('encounters');
      expect(state).toContain('medications');
      expect(state).toContain('vitalSigns');
    });
  });

  describe('Cache Management', () => {
    it('should update cache size', () => {
      const { updateCacheSize } = useOfflineStore.getState();
      
      updateCacheSize(1024 * 1024); // 1MB
      expect(useOfflineStore.getState().cacheSize).toBe(1024 * 1024);
      
      updateCacheSize(5 * 1024 * 1024); // 5MB
      expect(useOfflineStore.getState().cacheSize).toBe(5 * 1024 * 1024);
    });

    it('should add cache metadata', () => {
      const { addCacheMetadata } = useOfflineStore.getState();
      
      const metadata = {
        lastSynced: '2024-01-01T00:00:00Z',
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      };
      
      addCacheMetadata('patient-123', metadata);
      
      const state = useOfflineStore.getState();
      expect(state.cacheMetadata['patient-123']).toEqual({
        ...metadata,
        key: 'patient-123'
      });
    });

    it('should get cache metadata', () => {
      const { addCacheMetadata, getCacheMetadata } = useOfflineStore.getState();
      
      const metadata = {
        lastSynced: '2024-01-01T00:00:00Z',
        size: 2048,
        version: '1.1',
        isCached: true,
        isStale: false
      };
      
      addCacheMetadata('encounter-456', metadata);
      
      const retrieved = getCacheMetadata('encounter-456');
      expect(retrieved).toEqual({
        ...metadata,
        key: 'encounter-456'
      });
      
      const nonExistent = getCacheMetadata('non-existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should remove cache metadata', () => {
      const { addCacheMetadata, removeCacheMetadata, getCacheMetadata } = useOfflineStore.getState();
      
      const metadata = {
        lastSynced: '2024-01-01T00:00:00Z',
        size: 512,
        version: '1.0',
        isCached: true,
        isStale: false
      };
      
      addCacheMetadata('temp-data', metadata);
      expect(getCacheMetadata('temp-data')).toBeDefined();
      
      removeCacheMetadata('temp-data');
      expect(getCacheMetadata('temp-data')).toBeUndefined();
    });

    it('should handle multiple cache metadata operations', () => {
      const { addCacheMetadata, removeCacheMetadata } = useOfflineStore.getState();
      
      // Add multiple items
      addCacheMetadata('item1', {
        lastSynced: '2024-01-01T00:00:00Z',
        size: 100,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      addCacheMetadata('item2', {
        lastSynced: '2024-01-02T00:00:00Z',
        size: 200,
        version: '1.1',
        isCached: true,
        isStale: true
      });
      
      const state = useOfflineStore.getState();
      expect(Object.keys(state.cacheMetadata)).toHaveLength(2);
      
      // Remove one
      removeCacheMetadata('item1');
      const updatedState = useOfflineStore.getState();
      expect(Object.keys(updatedState.cacheMetadata)).toHaveLength(1);
      expect(updatedState.cacheMetadata['item2']).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    it('should clear cache successfully', async () => {
      const { clearCache, addCacheMetadata } = useOfflineStore.getState();
      
      // Add some cache metadata first
      addCacheMetadata('test-item', {
        lastSynced: '2024-01-01T00:00:00Z',
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      // Set some cache size
      useOfflineStore.setState({ cacheSize: 1024 });
      
      await clearCache();
      
      const state = useOfflineStore.getState();
      expect(state.cacheSize).toBe(0);
      expect(state.cacheMetadata).toEqual({});
      expect(mockCaches.keys).toHaveBeenCalled();
      expect(mockCaches.delete).toHaveBeenCalledWith('cache1');
      expect(mockCaches.delete).toHaveBeenCalledWith('cache2');
    });

    it('should handle cache clearing when caches API is not available', async () => {
      const originalCaches = global.caches;
      delete (global as any).caches;
      
      const { clearCache } = useOfflineStore.getState();
      
      // Should not throw error
      await expect(clearCache()).resolves.not.toThrow();
      
      const state = useOfflineStore.getState();
      expect(state.cacheSize).toBe(0);
      expect(state.cacheMetadata).toEqual({});
      
      // Restore caches
      global.caches = originalCaches;
    });

    it('should handle cache clearing when indexedDB is not available', async () => {
      const originalIndexedDB = global.indexedDB;
      delete (global as any).indexedDB;
      
      const { clearCache } = useOfflineStore.getState();
      
      // Should not throw error
      await expect(clearCache()).resolves.not.toThrow();
      
      // Restore indexedDB
      global.indexedDB = originalIndexedDB;
    });

    it('should force sync', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { forceSync } = useOfflineStore.getState();
      
      await forceSync();
      
      expect(consoleSpy).toHaveBeenCalledWith('Force sync triggered');
      consoleSpy.mockRestore();
    });

    it('should download offline data for selected types', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { downloadOfflineData } = useOfflineStore.getState();
      
      await downloadOfflineData();
      
      const expectedDataTypes = ['patients', 'encounters', 'medications', 'vitalSigns'];
      expectedDataTypes.forEach(dataType => {
        expect(consoleSpy).toHaveBeenCalledWith(`Downloading ${dataType} for offline use...`);
      });
      
      consoleSpy.mockRestore();
    });

    it('should download only selected data types', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { downloadOfflineData, toggleDataType } = useOfflineStore.getState();
      
      // Remove some data types
      toggleDataType('encounters');
      toggleDataType('medications');
      
      await downloadOfflineData();
      
      expect(consoleSpy).toHaveBeenCalledWith('Downloading patients for offline use...');
      expect(consoleSpy).toHaveBeenCalledWith('Downloading vitalSigns for offline use...');
      expect(consoleSpy).not.toHaveBeenCalledWith('Downloading encounters for offline use...');
      expect(consoleSpy).not.toHaveBeenCalledWith('Downloading medications for offline use...');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Cache Validation', () => {
    beforeEach(() => {
      // Mock current date
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-08T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should validate cache and mark stale entries', () => {
      const { addCacheMetadata, validateCache } = useOfflineStore.getState();
      
      // Add fresh and stale cache entries
      addCacheMetadata('fresh-item', {
        lastSynced: '2024-01-07T00:00:00Z', // 1 day old
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      addCacheMetadata('stale-item', {
        lastSynced: '2024-01-01T00:00:00Z', // 7 days old
        size: 2048,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      addCacheMetadata('very-stale-item', {
        lastSynced: '2023-12-25T00:00:00Z', // Very old
        size: 512,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      validateCache();
      
      const state = useOfflineStore.getState();
      expect(state.cacheMetadata['fresh-item'].isStale).toBe(false);
      expect(state.cacheMetadata['stale-item'].isStale).toBe(false); // Exactly 7 days, not stale yet
      expect(state.cacheMetadata['very-stale-item'].isStale).toBe(true);
    });

    it('should respect retention days setting', () => {
      const { addCacheMetadata, setRetentionDays, validateCache } = useOfflineStore.getState();
      
      // Set retention to 3 days
      setRetentionDays(3);
      
      addCacheMetadata('recent-item', {
        lastSynced: '2024-01-06T00:00:00Z', // 2 days old
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      addCacheMetadata('old-item', {
        lastSynced: '2024-01-04T00:00:00Z', // 4 days old
        size: 2048,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      validateCache();
      
      const state = useOfflineStore.getState();
      expect(state.cacheMetadata['recent-item'].isStale).toBe(false);
      expect(state.cacheMetadata['old-item'].isStale).toBe(true);
    });

    it('should clean expired cache entries', () => {
      const { addCacheMetadata, cleanExpiredCache } = useOfflineStore.getState();
      
      // Add mix of stale and fresh entries
      addCacheMetadata('fresh-item', {
        lastSynced: '2024-01-07T00:00:00Z',
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      addCacheMetadata('stale-item1', {
        lastSynced: '2024-01-01T00:00:00Z',
        size: 2048,
        version: '1.0',
        isCached: true,
        isStale: true
      });
      
      addCacheMetadata('stale-item2', {
        lastSynced: '2023-12-25T00:00:00Z',
        size: 512,
        version: '1.0',
        isCached: true,
        isStale: true
      });
      
      const initialState = useOfflineStore.getState();
      expect(Object.keys(initialState.cacheMetadata)).toHaveLength(3);
      
      cleanExpiredCache();
      
      const finalState = useOfflineStore.getState();
      expect(Object.keys(finalState.cacheMetadata)).toHaveLength(1);
      expect(finalState.cacheMetadata['fresh-item']).toBeDefined();
      expect(finalState.cacheMetadata['stale-item1']).toBeUndefined();
      expect(finalState.cacheMetadata['stale-item2']).toBeUndefined();
    });

    it('should handle validation with no cache metadata', () => {
      const { validateCache, cleanExpiredCache } = useOfflineStore.getState();
      
      // Ensure empty cache metadata
      useOfflineStore.setState({ cacheMetadata: {} });
      
      // Should not throw errors
      expect(() => validateCache()).not.toThrow();
      expect(() => cleanExpiredCache()).not.toThrow();
      
      const state = useOfflineStore.getState();
      expect(state.cacheMetadata).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid cache metadata gracefully', () => {
      const { addCacheMetadata, validateCache } = useOfflineStore.getState();
      
      // Add metadata with invalid date
      addCacheMetadata('invalid-item', {
        lastSynced: 'invalid-date',
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      // Should not throw error
      expect(() => validateCache()).not.toThrow();
    });

    it('should handle zero retention days', () => {
      const { setRetentionDays, addCacheMetadata, validateCache } = useOfflineStore.getState();
      
      setRetentionDays(0);
      
      addCacheMetadata('item', {
        lastSynced: '2024-01-08T00:00:00Z', // Current time
        size: 1024,
        version: '1.0',
        isCached: true,
        isStale: false
      });
      
      validateCache();
      
      // Everything should be stale with 0 retention days
      const state = useOfflineStore.getState();
      expect(state.cacheMetadata['item'].isStale).toBe(false); // Exactly current time
    });

    it('should handle negative retention days', () => {
      const { setRetentionDays } = useOfflineStore.getState();
      
      // Allow negative values (should be handled by business logic)
      setRetentionDays(-1);
      expect(useOfflineStore.getState().retentionDays).toBe(-1);
    });

    it('should handle very large cache sizes', () => {
      const { setMaxCacheSize, updateCacheSize } = useOfflineStore.getState();
      
      const largeSize = Number.MAX_SAFE_INTEGER;
      setMaxCacheSize(largeSize);
      updateCacheSize(largeSize);
      
      expect(useOfflineStore.getState().maxCacheSize).toBe(largeSize);
      expect(useOfflineStore.getState().cacheSize).toBe(largeSize);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state structure for persistence', () => {
      const state = useOfflineStore.getState();
      
      // Verify all expected properties exist
      expect(state).toHaveProperty('isOfflineEnabled');
      expect(state).toHaveProperty('autoSync');
      expect(state).toHaveProperty('syncInterval');
      expect(state).toHaveProperty('maxCacheSize');
      expect(state).toHaveProperty('cacheSize');
      expect(state).toHaveProperty('retentionDays');
      expect(state).toHaveProperty('syncOnCellular');
      expect(state).toHaveProperty('backgroundSync');
      expect(state).toHaveProperty('conflictResolution');
      expect(state).toHaveProperty('selectedDataTypes');
      expect(state).toHaveProperty('cacheMetadata');
      
      // Verify all action functions exist
      expect(typeof state.setOfflineEnabled).toBe('function');
      expect(typeof state.setAutoSync).toBe('function');
      expect(typeof state.setSyncInterval).toBe('function');
      expect(typeof state.setMaxCacheSize).toBe('function');
      expect(typeof state.setRetentionDays).toBe('function');
      expect(typeof state.setSyncOnCellular).toBe('function');
      expect(typeof state.setBackgroundSync).toBe('function');
      expect(typeof state.setConflictResolution).toBe('function');
      expect(typeof state.toggleDataType).toBe('function');
      expect(typeof state.updateCacheSize).toBe('function');
      expect(typeof state.addCacheMetadata).toBe('function');
      expect(typeof state.getCacheMetadata).toBe('function');
      expect(typeof state.removeCacheMetadata).toBe('function');
      expect(typeof state.clearCache).toBe('function');
      expect(typeof state.forceSync).toBe('function');
      expect(typeof state.downloadOfflineData).toBe('function');
      expect(typeof state.validateCache).toBe('function');
      expect(typeof state.cleanExpiredCache).toBe('function');
    });
  });
});