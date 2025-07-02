/**
 * Tests for Background Sync Service
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  backgroundSyncService, 
  getBackgroundSyncService,
  addSyncTask,
  getSyncStats,
  syncNow,
  SyncTask,
  SyncResult,
  SyncStats 
} from '../background-sync.service';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock fetch
global.fetch = jest.fn();

describe('BackgroundSyncService', () => {
  let service: any;
  let networkStatusCheck: jest.Mock<boolean>;
  let onlineHandler: ((event: Event) => void) | undefined;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset localStorage
    localStorageMock.getItem.mockReturnValue(null);
    
    // Mock network status check
    networkStatusCheck = jest.fn().mockReturnValue(true);
    
    // Capture event listeners
    window.addEventListener = jest.fn((event: string, handler: any) => {
      if (event === 'online') onlineHandler = handler;
    });
    
    window.removeEventListener = jest.fn();
    
    // Get fresh instance
    service = getBackgroundSyncService();
    
    // Initialize service
    service.initialize(networkStatusCheck);
  });

  afterEach(() => {
    service.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeDefined();
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    });

    it('should load persisted queue on initialization', () => {
      const persistedTasks = [
        {
          id: 'task-1',
          type: 'update',
          resource: 'Patient',
          data: { id: '123' },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal'
        }
      ];
      
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(persistedTasks));
      
      const newService = getBackgroundSyncService();
      newService.destroy(); // Clear any existing state
      newService.initialize(networkStatusCheck);
      
      const tasks = newService.getPendingTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].resource).toBe('Patient');
    });

    it('should handle corrupted storage gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid-json');
      
      const newService = getBackgroundSyncService();
      expect(() => {
        newService.initialize(networkStatusCheck);
      }).not.toThrow();
    });

    it('should restore interrupted session', () => {
      const sessionData = {
        lastActivity: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        wasProcessing: true,
        processingTasks: ['task-1'],
        pendingTasks: 1,
        isUnloading: false
      };
      
      localStorageMock.getItem
        .mockReturnValueOnce(null) // For queue
        .mockReturnValueOnce(JSON.stringify(sessionData)); // For session
      
      const newService = getBackgroundSyncService();
      newService.initialize(networkStatusCheck);
      
      // Should trigger auto-resume
      jest.advanceTimersByTime(2000);
    });
  });

  describe('Task Management', () => {
    it('should add task to queue', () => {
      const taskId = service.addTask({
        type: 'create',
        resource: 'Patient',
        data: { resourceType: 'Patient', name: [{ given: ['John'], family: 'Doe' }] },
        maxRetries: 3,
        priority: 'high'
      });
      
      expect(taskId).toBe('test-uuid-123');
      
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].resource).toBe('Patient');
      expect(tasks[0].priority).toBe('high');
    });

    it('should remove task from queue', () => {
      const taskId = service.addTask({
        type: 'create',
        resource: 'Patient',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      const removed = service.removeTask(taskId);
      expect(removed).toBe(true);
      
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(0);
    });

    it('should handle removing non-existent task', () => {
      const removed = service.removeTask('non-existent');
      expect(removed).toBe(false);
    });

    it('should sort tasks by priority', () => {
      service.addTask({
        type: 'create',
        resource: 'Patient',
        data: { id: '1' },
        priority: 'low'
      });
      
      service.addTask({
        type: 'create',
        resource: 'Patient',
        data: { id: '2' },
        priority: 'critical'
      });
      
      service.addTask({
        type: 'create',
        resource: 'Patient',
        data: { id: '3' },
        priority: 'high'
      });
      
      const tasks = service.getPendingTasks();
      expect(tasks[0].priority).toBe('critical');
      expect(tasks[1].priority).toBe('high');
      expect(tasks[2].priority).toBe('low');
    });

    it('should prune old tasks when queue is full', () => {
      // Set max queue size to a small number for testing
      service.options.maxQueueSize = 5;
      
      // Add tasks
      for (let i = 0; i < 5; i++) {
        service.addTask({
          type: 'create',
          resource: 'Patient',
          data: { id: i.toString() },
          priority: i < 3 ? 'low' : 'normal'
        });
      }
      
      // Add one more task (should trigger pruning)
      service.addTask({
        type: 'create',
        resource: 'Patient',
        data: { id: '6' },
        priority: 'high'
      });
      
      const tasks = service.getPendingTasks();
      expect(tasks.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Sync Handlers', () => {
    it('should register sync handler', () => {
      const handler = jest.fn();
      service.registerSyncHandler('CustomResource', handler);
      
      // Handler should be registered (we'll test execution in syncNow tests)
      expect(() => service.registerSyncHandler('CustomResource', handler)).not.toThrow();
    });

    it('should register conflict resolver', () => {
      const resolver = jest.fn();
      service.registerConflictResolver('Patient', resolver);
      
      expect(() => service.registerConflictResolver('Patient', resolver)).not.toThrow();
    });

    it('should use registerHandler alias', () => {
      const handler = jest.fn();
      service.registerHandler('CustomResource', handler);
      
      expect(() => service.registerHandler('CustomResource', handler)).not.toThrow();
    });
  });

  describe('Sync Operations', () => {
    beforeEach(() => {
      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '123', resourceType: 'Patient' })
      });
    });

    it('should sync tasks when triggered manually', async () => {
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient', name: [{ given: ['John'] }] },
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/fhir/Patient',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/fhir+json' },
          body: JSON.stringify({ resourceType: 'Patient', name: [{ given: ['John'] }] })
        })
      );
    });

    it('should handle sync failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    it('should retry failed tasks', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '123' })
        });
      
      const taskId = service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        maxRetries: 3,
        priority: 'normal'
      });
      
      // First sync - should fail
      await service.syncNow();
      
      let tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].retryCount).toBe(1);
      
      // Second sync - should succeed
      await service.syncNow();
      
      tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(0);
    });

    it('should remove task after max retries', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Permanent failure'));
      
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        maxRetries: 2,
        priority: 'normal'
      });
      
      // Try syncing multiple times
      await service.syncNow();
      await service.syncNow();
      
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(0);
      
      const stats = service.getStats();
      expect(stats.failedTasks).toBe(1);
    });

    it('should handle 409 conflict errors', async () => {
      const serverData = { id: '123', version: 2 };
      const conflictError = new Error('HTTP 409');
      (conflictError as any).status = 409;
      (conflictError as any).serverData = serverData;
      
      (global.fetch as jest.Mock).mockRejectedValueOnce({
        status: 409,
        json: async () => serverData
      });
      
      const resolver = jest.fn().mockResolvedValue({ id: '123', version: 3 });
      service.registerConflictResolver('fhir', resolver);
      
      service.addTask({
        type: 'update',
        resource: 'fhir',
        data: { resourceType: 'Patient', id: '123' },
        conflictResolution: 'merge',
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      // Conflict resolver should not be called for first attempt
      expect(results[0].success).toBe(false);
    });

    it('should handle custom sync handler', async () => {
      const customHandler = jest.fn().mockResolvedValue({ success: true });
      service.registerSyncHandler('custom', customHandler);
      
      service.addTask({
        type: 'custom',
        resource: 'custom',
        data: { test: 'data' },
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          resource: 'custom',
          data: { test: 'data' }
        })
      );
      expect(results[0].success).toBe(true);
    });

    it('should handle missing sync handler', async () => {
      service.addTask({
        type: 'create',
        resource: 'unknown',
        data: { test: 'data' },
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results[0].success).toBe(false);
      expect(results[0].error?.message).toContain('No sync handler registered');
    });

    it('should not sync when already in progress', async () => {
      // Add multiple tasks
      for (let i = 0; i < 5; i++) {
        service.addTask({
          type: 'create',
          resource: 'fhir',
          data: { resourceType: 'Patient', id: i.toString() },
          priority: 'normal'
        });
      }
      
      // Start first sync
      const sync1Promise = service.syncNow();
      
      // Try to start second sync immediately
      const sync2Promise = service.syncNow();
      
      const [results1, results2] = await Promise.all([sync1Promise, sync2Promise]);
      
      // Second sync should return empty results
      expect(results2).toHaveLength(0);
    });
  });

  describe('Periodic Sync', () => {
    it('should start periodic sync when online', () => {
      // Service is already initialized with periodic sync
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(0);
      
      // Add a task
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      // Fast-forward time
      jest.advanceTimersByTime(30000); // 30 seconds
      
      // Should have attempted sync
      expect(networkStatusCheck).toHaveBeenCalled();
    });

    it('should not sync when offline', () => {
      networkStatusCheck.mockReturnValue(false);
      
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      jest.advanceTimersByTime(30000);
      
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(1); // Task should still be pending
    });

    it('should sync immediately when coming online', async () => {
      networkStatusCheck.mockReturnValue(false);
      
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      // Simulate coming online
      networkStatusCheck.mockReturnValue(true);
      if (onlineHandler) {
        onlineHandler(new Event('online'));
      }
      
      // Should trigger immediate sync
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Pause and Resume', () => {
    it('should pause sync', () => {
      service.pauseSync();
      
      // Add task and advance time
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      jest.advanceTimersByTime(60000); // 1 minute
      
      // Should not have synced
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should resume sync', () => {
      service.pauseSync();
      service.resumeSync();
      
      // Stats should show next sync time
      const stats = service.getStats();
      expect(stats.nextSyncTime).toBeGreaterThan(Date.now());
    });

    it('should throw error if resuming before initialization', () => {
      const newService = getBackgroundSyncService();
      newService.destroy();
      
      expect(() => newService.resumeSync()).toThrow('not initialized');
    });
  });

  describe('Statistics', () => {
    it('should track sync statistics', async () => {
      // Add and sync a successful task
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      await service.syncNow();
      
      const stats = service.getStats();
      expect(stats.pendingTasks).toBe(0);
      expect(stats.completedTasks).toBe(1);
      expect(stats.failedTasks).toBe(0);
      expect(stats.lastSyncTime).toBeGreaterThan(0);
      expect(stats.averageSyncDuration).toBeGreaterThan(0);
    });

    it('should update average sync duration', async () => {
      // Add multiple tasks
      for (let i = 0; i < 3; i++) {
        service.addTask({
          type: 'create',
          resource: 'fhir',
          data: { resourceType: 'Patient', id: i.toString() },
          priority: 'normal'
        });
      }
      
      await service.syncNow();
      
      const stats = service.getStats();
      expect(stats.averageSyncDuration).toBeGreaterThan(0);
    });
  });

  describe('Queue Persistence', () => {
    it('should save queue to storage', () => {
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'omnicare-sync-queue',
        expect.stringContaining('Patient')
      );
    });

    it('should save session state', () => {
      // Session state is saved periodically
      jest.advanceTimersByTime(10000); // 10 seconds
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'omnicare-sync-queue_session',
        expect.any(String)
      );
    });

    it('should handle storage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      
      // Should not throw when adding task
      expect(() => {
        service.addTask({
          type: 'create',
          resource: 'fhir',
          data: { resourceType: 'Patient' },
          priority: 'normal'
        });
      }).not.toThrow();
    });
  });

  describe('Clear Queue', () => {
    it('should clear all pending tasks', () => {
      // Add multiple tasks
      for (let i = 0; i < 3; i++) {
        service.addTask({
          type: 'create',
          resource: 'fhir',
          data: { resourceType: 'Patient', id: i.toString() },
          priority: 'normal'
        });
      }
      
      service.clearQueue();
      
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(0);
      
      const stats = service.getStats();
      expect(stats.pendingTasks).toBe(0);
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', () => {
      // Add a task
      service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      service.destroy();
      
      // Should clear timers and data
      const stats = service.getStats();
      expect(stats.pendingTasks).toBe(0);
      expect(stats.nextSyncTime).toBeNull();
      
      // Should remove session data
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('omnicare-sync-queue_session');
    });

    it('should handle multiple destroy calls', () => {
      service.destroy();
      
      // Second destroy should not throw
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach(() => {
      // Mock conflict response
      const conflictError = {
        ok: false,
        status: 409,
        json: async () => ({ id: '123', version: 2 })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(conflictError);
    });

    it('should apply client-wins strategy', async () => {
      const resolver = jest.fn((task, serverData) => {
        if (task.conflictResolution === 'client-wins') {
          return task.data;
        }
        return serverData;
      });
      
      service.registerConflictResolver('fhir', resolver);
      
      service.addTask({
        type: 'update',
        resource: 'fhir',
        data: { resourceType: 'Patient', id: '123', version: 1 },
        conflictResolution: 'client-wins',
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results[0].success).toBe(false);
      expect(results[0].conflictDetected).toBe(true);
    });

    it('should apply server-wins strategy', async () => {
      const serverData = { id: '123', version: 2 };
      const resolver = jest.fn().mockResolvedValue(serverData);
      
      service.registerConflictResolver('fhir', resolver);
      
      service.addTask({
        type: 'update',
        resource: 'fhir',
        data: { resourceType: 'Patient', id: '123', version: 1 },
        conflictResolution: 'server-wins',
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results[0].conflictDetected).toBe(true);
    });

    it('should apply merge strategy', async () => {
      const mergedData = { id: '123', version: 3, merged: true };
      const resolver = jest.fn().mockResolvedValue(mergedData);
      
      service.registerConflictResolver('fhir', resolver);
      
      service.addTask({
        type: 'update',
        resource: 'fhir',
        data: { resourceType: 'Patient', id: '123', version: 1 },
        conflictResolution: 'merge',
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results[0].conflictDetected).toBe(true);
    });

    it('should skip resolution for manual strategy', async () => {
      service.addTask({
        type: 'update',
        resource: 'fhir',
        data: { resourceType: 'Patient', id: '123' },
        conflictResolution: 'manual',
        priority: 'normal'
      });
      
      const results = await service.syncNow();
      
      expect(results[0].success).toBe(false);
      expect(results[0].conflictDetected).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process tasks in batches', async () => {
      // Set batch size
      service.options.batchSize = 3;
      
      // Add more tasks than batch size
      for (let i = 0; i < 5; i++) {
        service.addTask({
          type: 'create',
          resource: 'fhir',
          data: { resourceType: 'Patient', id: i.toString() },
          priority: 'normal'
        });
      }
      
      const results = await service.syncNow();
      
      // Should only process batch size
      expect(results).toHaveLength(3);
      
      // Remaining tasks should still be pending
      const tasks = service.getPendingTasks();
      expect(tasks).toHaveLength(2);
    });
  });

  describe('Event Handling', () => {
    it('should handle page unload', () => {
      const unloadHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'beforeunload'
      )?.[1];
      
      if (unloadHandler) {
        unloadHandler(new Event('beforeunload'));
      }
      
      // Should save session state with unloading flag
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'omnicare-sync-queue_session',
        expect.stringContaining('"isUnloading":true')
      );
    });

    it('should handle visibility change', () => {
      const visibilityHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'visibilitychange'
      )?.[1];
      
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true
      });
      
      if (visibilityHandler) {
        visibilityHandler(new Event('visibilitychange'));
      }
      
      // Should save session state
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'omnicare-sync-queue_session',
        expect.any(String)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with undefined metadata', () => {
      const taskId = service.addTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal',
        metadata: undefined
      });
      
      expect(taskId).toBeDefined();
    });

    it('should handle empty queue on sync', async () => {
      const results = await service.syncNow();
      expect(results).toHaveLength(0);
    });

    it('should handle sync with no network check function after destroy and reinit', () => {
      service.destroy();
      
      const newService = getBackgroundSyncService();
      
      // Try to add task without initialization
      expect(() => {
        newService.addTask({
          type: 'create',
          resource: 'fhir',
          data: { resourceType: 'Patient' },
          priority: 'normal'
        });
      }).not.toThrow();
    });
  });

  describe('Convenience Functions', () => {
    it('should add task using convenience function', () => {
      const taskId = addSyncTask({
        type: 'create',
        resource: 'fhir',
        data: { resourceType: 'Patient' },
        priority: 'normal'
      });
      
      expect(taskId).toBeDefined();
    });

    it('should get stats using convenience function', () => {
      const stats = getSyncStats();
      expect(stats).toHaveProperty('pendingTasks');
      expect(stats).toHaveProperty('completedTasks');
    });

    it('should sync using convenience function', async () => {
      await expect(syncNow()).resolves.not.toThrow();
    });
  });

  describe('SSR/Test Environment Stub', () => {
    it('should return stub in test environment', () => {
      // The module already returns a stub in test environment
      expect(backgroundSyncService).toBeDefined();
      expect(typeof backgroundSyncService.initialize).toBe('function');
      expect(typeof backgroundSyncService.addTask).toBe('function');
      expect(typeof backgroundSyncService.getStats).toBe('function');
    });
  });
});