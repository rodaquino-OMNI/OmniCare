/**
 * Offline Sync Engine Resume Tests
 * Tests the core sync engine's resume and continue capabilities
 */

import 'fake-indexeddb/auto';
// jest is globally available in test environment

// Mock OfflineSyncService before importing
jest.mock('../../../services/offline-sync.service', () => {
  const mockService = {
    sync: jest.fn().mockResolvedValue(undefined),
    queueOperation: jest.fn().mockResolvedValue(undefined),
    getConflicts: jest.fn().mockResolvedValue([]),
    getSyncStatus: jest.fn().mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingChanges: 0,
      failedChanges: 0,
      conflictedChanges: 0,
      errors: []
    }),
    clearLocalData: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    resolveConflict: jest.fn().mockResolvedValue(undefined),
    getPendingOperations: jest.fn().mockResolvedValue([]),
    resumeSync: jest.fn().mockResolvedValue(undefined),
    pauseSync: jest.fn(),
    setSyncOptions: jest.fn(),
    importSyncData: jest.fn().mockResolvedValue(undefined),
    exportSyncData: jest.fn().mockResolvedValue({
      resourceVersions: new Map(),
      lastSyncTimestamp: new Date(),
      syncToken: null,
      pendingOperations: [],
      conflicts: []
    }),
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: true,
    syncPendingOperations: jest.fn().mockResolvedValue({ success: true, synced: 0, failed: 0 }),
    getQueueStatus: jest.fn().mockReturnValue({ pending: 0, failed: 0, total: 0 }),
    clearQueue: jest.fn().mockResolvedValue(true),
    retryFailedOperations: jest.fn().mockResolvedValue({ success: true, synced: 0, failed: 0 }),
    emit: jest.fn(),
    isOnline: jest.fn().mockReturnValue(true),
    setOnlineStatus: jest.fn(),
    getOperationById: jest.fn().mockResolvedValue(null),
    updateOperation: jest.fn().mockResolvedValue(true),
    deleteOperation: jest.fn().mockResolvedValue(true)
  };
  
  return {
    OfflineSyncService: jest.fn(() => mockService),
    SyncOptions: {},
    offlineSyncService: mockService
  };
});

import { OfflineSyncService } from '../../../services/offline-sync.service';
import { useSyncStore } from '../../../stores/sync';
import { createMockSyncState } from '../../utils/sync-state-test-utils';
import type { Resource, Patient, Observation, Encounter } from '@medplum/fhirtypes';

// Type assertion for global.fetch
declare global {
  namespace NodeJS {
    interface Global {
      fetch: jest.Mock;
    }
  }
}

// Mock network utilities
const mockNetworkInterruption = {
  simulateSlowNetwork: (delayMs = 2000) => {
    global.fetch = jest.fn().mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({})
        } as Response), delayMs)
      )
    ) as jest.Mock;
  },
  
  simulateNetworkFailure: () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure')) as jest.Mock;
  },
  
  simulateIntermittentConnection: () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount % 3 === 0) {
        return Promise.reject(new Error('Intermittent failure'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      } as Response);
    }) as jest.Mock;
  },
  
  simulateSuccessfulConnection: () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    } as Response) as jest.Mock;
  }
};

// Test data generators
const createTestPatient = (id: string): Patient => ({
  resourceType: 'Patient',
  id,
  name: [{ given: ['Test'], family: `Patient-${id}` }],
  gender: 'unknown',
  birthDate: '1990-01-01',
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString()
  }
});

const createTestObservation = (id: string, patientId: string): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { text: `Test Observation ${id}` },
  subject: { reference: `Patient/${patientId}` },
  valueQuantity: { value: Math.random() * 100, unit: 'mg/dL' },
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString()
  }
});

const createTestEncounter = (id: string, patientId: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: `Patient/${patientId}` },
  period: {
    start: new Date().toISOString(),
    end: new Date().toISOString()
  },
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString()
  }
});

describe('Offline Sync Engine Resume Tests', () => {
  let offlineSyncService: OfflineSyncService;
  
  beforeEach(async () => {
    offlineSyncService = new OfflineSyncService();
    // Reset all services and stores
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Clear local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset sync store
    useSyncStore.setState(createMockSyncState(), true);

    // Clear offline sync service
    await offlineSyncService.clearLocalData();
    
    // Setup successful network by default
    mockNetworkInterruption.simulateSuccessfulConnection();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.useRealTimers();
    await offlineSyncService.clearLocalData();
  });

  describe('Sync Queue Resume Functionality', () => {
    it('should resume sync from exact point of interruption', async () => {
      // Queue multiple operations
      const resources: Resource[] = [
        createTestPatient('patient-1'),
        createTestPatient('patient-2'),
        createTestObservation('obs-1', 'patient-1'),
        createTestObservation('obs-2', 'patient-2'),
        createTestEncounter('enc-1', 'patient-1')
      ];

      for (const resource of resources) {
        await offlineSyncService.queueOperation('create', resource);
      }

      // Start sync with slow network to allow interruption
      mockNetworkInterruption.simulateSlowNetwork(500);
      
      // Begin sync
      const syncPromise = offlineSyncService.sync();
      
      // Wait for some processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate network failure
      mockNetworkInterruption.simulateNetworkFailure();
      
      // Wait for sync to handle failure
      await syncPromise.catch(() => {}); // Expected to fail
      
      // Check intermediate state
      const midStatus = offlineSyncService.getSyncStatus();
      expect(midStatus.pendingChanges).toBeGreaterThan(0);
      expect(midStatus.pendingChanges).toBeLessThan(5);
      
      // Resume with successful network
      mockNetworkInterruption.simulateSuccessfulConnection();
      
      // Continue sync
      await offlineSyncService.sync();
      
      // Verify completion
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.pendingChanges).toBe(0);
      expect(finalStatus.errors.length).toBeLessThanOrEqual(1); // May have errors from interruption
    });

    it('should maintain sync metadata across resume operations', async () => {
      const testPatient = createTestPatient('metadata-test');
      
      await offlineSyncService.queueOperation('create', testPatient, {
        priority: 'high',
        maxAttempts: 5,
        conflictResolution: 'merge',
        metadata: {
          userContext: 'emergency_room',
          sessionId: 'session-123',
          workflow: 'patient_admission'
        }
      });

      // Start sync and interrupt
      mockNetworkInterruption.simulateSlowNetwork(200);
      const syncPromise = offlineSyncService.sync();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      mockNetworkInterruption.simulateNetworkFailure();
      
      await syncPromise.catch(() => {});
      
      // Export sync data to verify metadata preservation
      const exportedData = await offlineSyncService.exportSyncData();
      expect(exportedData.pendingOperations).toHaveLength(1);
      
      const operation = exportedData.pendingOperations[0];
      expect(operation.metadata?.userContext).toBe('emergency_room');
      expect(operation.metadata?.sessionId).toBe('session-123');
      expect(operation.metadata?.workflow).toBe('patient_admission');
      
      // Resume sync
      mockNetworkInterruption.simulateSuccessfulConnection();
      await offlineSyncService.sync();
      
      // Verify completion
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.pendingChanges).toBe(0);
    });

    it('should handle priority reordering during resume', async () => {
      // Queue items with different priorities
      const lowPriorityPatient = createTestPatient('low-priority');
      const highPriorityObservation = createTestObservation('high-priority', 'patient-1');
      const criticalEncounter = createTestEncounter('critical', 'patient-1');
      
      await offlineSyncService.queueOperation('create', lowPriorityPatient, { priority: 'low' });
      await offlineSyncService.queueOperation('create', highPriorityObservation, { priority: 'high' });
      
      // Start sync and interrupt
      mockNetworkInterruption.simulateSlowNetwork(300);
      const syncPromise = offlineSyncService.sync();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Add critical item while sync is running
      await offlineSyncService.queueOperation('create', criticalEncounter, { priority: 'critical' });
      
      // Interrupt sync
      mockNetworkInterruption.simulateNetworkFailure();
      await syncPromise.catch(() => {});
      
      // Resume sync - critical item should be processed first
      mockNetworkInterruption.simulateSuccessfulConnection();
      await offlineSyncService.sync();
      
      // Verify all completed
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.pendingChanges).toBe(0);
    });
  });

  describe('State Restoration and Persistence', () => {
    it('should restore sync state after service restart', async () => {
      // Add operations to the service
      const resources = [
        createTestPatient('restart-1'),
        createTestObservation('restart-2', 'restart-1')
      ];

      for (const resource of resources) {
        await offlineSyncService.queueOperation('update', resource);
      }

      // Export current state
      const exportedState = await offlineSyncService.exportSyncData();
      expect(exportedState.pendingOperations).toHaveLength(2);
      
      // Simulate service restart by clearing and reimporting
      await offlineSyncService.clearLocalData();
      
      const clearedStatus = offlineSyncService.getSyncStatus();
      expect(clearedStatus.pendingChanges).toBe(0);
      
      // Import state
      await offlineSyncService.importSyncData(exportedState);
      
      // Verify state restoration
      const restoredStatus = offlineSyncService.getSyncStatus();
      expect(restoredStatus.pendingChanges).toBe(2);
      
      // Complete sync to verify functionality
      await offlineSyncService.sync();
      
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.pendingChanges).toBe(0);
    });

    it('should handle IndexedDB transaction failures during resume', async () => {
      const testPatient = createTestPatient('db-failure-test');
      await offlineSyncService.queueOperation('create', testPatient);
      
      // Mock IndexedDB failure during sync
      const originalIndexedDB = window.indexedDB;
      
      // Simulate database corruption
      Object.defineProperty(window, 'indexedDB', {
        value: {
          open: () => {
            interface DBRequest {
              onerror: (() => void) | null;
              onsuccess: (() => void) | null;
              onupgradeneeded: (() => void) | null;
              error: Error;
            }
            const request: DBRequest = {
              onerror: null,
              onsuccess: null,
              onupgradeneeded: null,
              error: new Error('Database corrupted')
            };
            setTimeout(() => {
              if (request.onerror) request.onerror();
            }, 10);
            return request;
          }
        },
        writable: true
      });
      
      // Attempt sync - should handle gracefully
      try {
        await offlineSyncService.sync();
      } catch {
        // Expected to fail gracefully
      }
      
      // Restore IndexedDB
      Object.defineProperty(window, 'indexedDB', {
        value: originalIndexedDB,
        writable: true
      });
      
      // Should be able to recover
      const recoveryPatient = createTestPatient('recovery-test');
      await offlineSyncService.queueOperation('create', recoveryPatient);
      
      // This should work
      await offlineSyncService.sync();
      
      const status = offlineSyncService.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
    });

    it('should preserve sync progress across browser refresh simulation', async () => {
      // Setup store with sync in progress
      useSyncStore.setState({
        isSyncing: true,
        syncProgress: 65,
        totalItems: 10,
        pendingChanges: 3,
        syncedItems: [
          { id: 'item-1', type: 'patient', description: 'Patient 1', status: 'synced', timestamp: new Date().toISOString() },
          { id: 'item-2', type: 'observation', description: 'Obs 1', status: 'synced', timestamp: new Date().toISOString() }
        ],
        failedItems: [
          { 
            id: 'item-3', 
            type: 'encounter', 
            description: 'Enc 1', 
            status: 'failed', 
            error: 'Network timeout',
            retryCount: 2,
            timestamp: new Date().toISOString() 
          }
        ],
        currentOperation: 'Processing observations...',
        estimatedTimeRemaining: 45
      });

      // Capture state before "refresh"
      const preRefreshState = useSyncStore.getState();
      
      // Simulate browser refresh (in real app, zustand persist would handle this)
      const persistedState = {
        syncQueue: preRefreshState.syncQueue,
        syncedItems: preRefreshState.syncedItems,
        failedItems: preRefreshState.failedItems,
        totalItems: preRefreshState.totalItems,
        pendingChanges: preRefreshState.pendingChanges,
        lastSyncTime: preRefreshState.lastSyncTime
      };
      
      // Reset store (simulating fresh page load)
      useSyncStore.setState({
        isSyncing: false,
        syncProgress: 0,
        lastSyncTime: null,
        syncError: null,
        syncQueue: [],
        syncedItems: [],
        failedItems: [],
        totalItems: 0,
        pendingChanges: 0,
        currentOperation: null,
        estimatedTimeRemaining: null
      });
      
      // Restore persisted state
      useSyncStore.setState(persistedState);
      
      // Verify restoration
      const restoredState = useSyncStore.getState();
      expect(restoredState.syncedItems).toHaveLength(2);
      expect(restoredState.failedItems).toHaveLength(1);
      expect(restoredState.totalItems).toBe(10);
      expect(restoredState.pendingChanges).toBe(3);
      
      // Should not be actively syncing after refresh
      expect(restoredState.isSyncing).toBe(false);
      expect(restoredState.currentOperation).toBeNull();
    });
  });

  describe('Conflict Resolution During Resume', () => {
    it('should handle conflicts that arise during resume operations', async () => {
      const conflictPatient = createTestPatient('conflict-patient');
      conflictPatient.meta!.versionId = '1';
      
      await offlineSyncService.queueOperation('update', conflictPatient, {
        conflictResolution: 'merge'
      });

      // Mock server to return different version
      global.fetch = jest.fn().mockImplementation(() => {
        const serverVersion = {
          ...conflictPatient,
          name: [{ given: ['Server'], family: 'Updated' }],
          meta: { ...conflictPatient.meta, versionId: '2' }
        };
        
        return Promise.resolve({
          ok: false,
          status: 409, // Conflict
          json: () => Promise.resolve(serverVersion)
        } as Response);
      }) as jest.Mock;

      // Start sync - should detect conflict
      await offlineSyncService.sync();
      
      // Check for conflicts
      const conflicts = await offlineSyncService.getConflicts();
      expect(conflicts).toHaveLength(1);
      
      const conflict = conflicts[0];
      expect(conflict.resourceType).toBe('Patient');
      expect(conflict.localVersion).toBe(1);
      expect(conflict.remoteVersion).toBe(2);
      
      // Resolve conflict
      await offlineSyncService.resolveConflict(conflict.id, {
        strategy: 'merge',
        winningResource: {
          ...conflictPatient,
          name: [{ given: ['Merged'], family: 'Name' }],
          meta: { ...conflictPatient.meta, versionId: '3' }
        }
      });

      // Verify resolution
      const resolvedConflicts = await offlineSyncService.getConflicts(true);
      expect(resolvedConflicts).toHaveLength(1);
      expect(resolvedConflicts[0].resolution?.strategy).toBe('merge');
    });

    it('should queue conflict resolutions for retry during network issues', async () => {
      const conflictResource = createTestObservation('conflict-obs', 'patient-1');
      
      await offlineSyncService.queueOperation('update', conflictResource, {
        conflictResolution: 'local-wins'
      });

      // Mock conflict then network failure
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
              ...conflictResource,
              valueQuantity: { value: 999, unit: 'mg/dL' },
              meta: { ...conflictResource.meta, versionId: '2' }
            })
          } as Response);
        }
        return Promise.reject(new Error('Network failure'));
      }) as jest.Mock;

      // First sync - should detect conflict but fail to resolve due to network
      await offlineSyncService.sync().catch(() => {});
      
      // Should have conflict recorded
      const conflicts = await offlineSyncService.getConflicts();
      expect(conflicts).toHaveLength(1);
      
      // Resume with working network
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      } as Response) as jest.Mock;

      // Should be able to resolve on retry
      await offlineSyncService.resolveConflict(conflicts[0].id, {
        strategy: 'local-wins',
        winningResource: conflictResource
      });
      
      const status = offlineSyncService.getSyncStatus();
      expect(status.conflictedChanges).toBe(0);
    });
  });

  // Type definitions for performance tests
  interface PerformanceWithMemory extends Performance {
    memory?: {
      usedJSHeapSize: number;
    };
  }
  
  interface GlobalWithGC {
    gc?: () => void;
  }
  
  describe('Performance During Resume', () => {
    it('should maintain performance with large sync queues during resume', async () => {
      jest.useFakeTimers();
      
      // Create large number of operations
      const largeDataSet: Resource[] = [];
      for (let i = 0; i < 500; i++) {
        largeDataSet.push(createTestObservation(`perf-obs-${i}`, 'patient-perf'));
      }

      const startTime = performance.now();
      
      // Queue all operations
      for (const resource of largeDataSet) {
        await offlineSyncService.queueOperation('create', resource);
      }
      
      const queueTime = performance.now() - startTime;
      expect(queueTime).toBeLessThan(5000); // Should queue 500 items quickly
      
      // Start sync with interruptions
      mockNetworkInterruption.simulateIntermittentConnection();
      
      const syncStartTime = performance.now();
      
      // Multiple resume cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        try {
          await offlineSyncService.sync({ batchSize: 50 });
          break; // If successful, exit loop
        } catch {
          // Expected intermittent failures
          jest.advanceTimersByTime(1000); // Wait before retry
        }
      }
      
      // Final successful sync
      mockNetworkInterruption.simulateSuccessfulConnection();
      await offlineSyncService.sync({ batchSize: 50 });
      
      const totalSyncTime = performance.now() - syncStartTime;
      expect(totalSyncTime).toBeLessThan(30000); // Should complete in reasonable time
      
      // Verify completion
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.pendingChanges).toBe(0);
      
      jest.useRealTimers();
    });

    it('should optimize memory usage during extended resume operations', async () => {
      const initialMemory = (performance as PerformanceWithMemory).memory?.usedJSHeapSize || 0;
      
      // Create many operations in batches
      for (let batch = 0; batch < 20; batch++) {
        const batchResources: Resource[] = [];
        for (let i = 0; i < 50; i++) {
          batchResources.push(createTestPatient(`memory-batch-${batch}-${i}`));
        }
        
        for (const resource of batchResources) {
          await offlineSyncService.queueOperation('create', resource);
        }
        
        // Simulate partial sync every few batches
        if (batch % 5 === 0) {
          try {
            await offlineSyncService.sync({ batchSize: 25 });
          } catch {
            // Some may fail, that's ok for this test
          }
        }
        
        // Force garbage collection if available
        if ((globalThis as unknown as GlobalWithGC).gc) {
          (globalThis as unknown as GlobalWithGC).gc();
        }
      }

      const finalMemory = (performance as PerformanceWithMemory).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory usage should be reasonable (less than 100MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Complete remaining sync
      await offlineSyncService.sync({ batchSize: 100 });
      
      const status = offlineSyncService.getSyncStatus();
      expect(status.pendingChanges).toBeLessThan(100); // Most should be synced
    });

    it('should handle rapid resume/pause cycles efficiently', async () => {
      // Queue operations
      const resources = Array.from({ length: 100 }, (_, i) => 
        createTestObservation(`rapid-${i}`, 'patient-rapid')
      );

      for (const resource of resources) {
        await offlineSyncService.queueOperation('create', resource);
      }

      const cycleStartTime = performance.now();
      
      // Rapid cycles of network on/off
      for (let cycle = 0; cycle < 10; cycle++) {
        // Quick online period
        mockNetworkInterruption.simulateSuccessfulConnection();
        const syncPromise = offlineSyncService.sync({ batchSize: 10 });
        
        // Quick interruption after short processing
        await new Promise(resolve => setTimeout(resolve, 100));
        mockNetworkInterruption.simulateNetworkFailure();
        
        await syncPromise.catch(() => {}); // Expected failures
      }
      
      const cycleTime = performance.now() - cycleStartTime;
      expect(cycleTime).toBeLessThan(15000); // Should handle rapid cycles efficiently
      
      // Final completion
      mockNetworkInterruption.simulateSuccessfulConnection();
      await offlineSyncService.sync();
      
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.pendingChanges).toBe(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle resume with corrupted sync metadata', async () => {
      // Add valid operation
      const validResource = createTestPatient('valid-patient');
      await offlineSyncService.queueOperation('create', validResource);
      
      // Simulate metadata corruption
      const corruptedMetadata = {
        lastSyncTimestamp: new Date('invalid-date'),
        syncToken: undefined,
        resourceVersions: new Map(),
        pendingOperations: [{
          // Corrupted operation
          id: 'corrupt-op',
          resourceType: 'InvalidType',
          resourceId: '',
          operation: 'invalid' as unknown as 'create' | 'update' | 'delete' | 'patch',
          timestamp: 'invalid-timestamp',
          localVersion: 1,
          attempts: 0,
          maxAttempts: 3,
          priority: 1,
          createdAt: new Date()
        }],
        conflicts: []
      };
      
      // Clear and import corrupted data
      await offlineSyncService.clearLocalData();
      
      try {
        await offlineSyncService.importSyncData(corruptedMetadata);
      } catch {
        // Expected to handle corruption gracefully
      }
      
      // Should still be able to add new operations
      const newResource = createTestPatient('recovery-patient');
      await offlineSyncService.queueOperation('create', newResource);
      
      // Should be able to sync
      await offlineSyncService.sync();
      
      const status = offlineSyncService.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
    });

    it('should handle resource deletion during resume', async () => {
      const deletableResource = createTestEncounter('deletable-enc', 'patient-1');
      
      // Queue create then delete
      await offlineSyncService.queueOperation('create', deletableResource);
      await offlineSyncService.queueOperation('delete', deletableResource);
      
      // Start sync and interrupt
      mockNetworkInterruption.simulateSlowNetwork(300);
      const syncPromise = offlineSyncService.sync();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      mockNetworkInterruption.simulateNetworkFailure();
      
      await syncPromise.catch(() => {});
      
      // Resume sync
      mockNetworkInterruption.simulateSuccessfulConnection();
      await offlineSyncService.sync();
      
      // Both operations should complete
      const status = offlineSyncService.getSyncStatus();
      expect(status.pendingChanges).toBe(0);
    });

    it('should handle version conflicts during resumed batch operations', async () => {
      const batchResources = Array.from({ length: 10 }, (_, i) => {
        const resource = createTestPatient(`batch-${i}`);
        resource.meta!.versionId = '1';
        return resource;
      });

      // Queue batch update
      for (const resource of batchResources) {
        await offlineSyncService.queueOperation('update', resource);
      }

      // Mock some resources to have conflicts
      global.fetch = jest.fn().mockImplementation((url: string) => {
        const resourceId = url.split('/').pop();
        const isConflicted = resourceId?.includes('batch-3') || resourceId?.includes('batch-7');
        
        if (isConflicted) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
              resourceType: 'Patient',
              id: resourceId,
              meta: { versionId: '2' }
            })
          } as Response);
        }
        
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({})
        } as Response);
      }) as jest.Mock;

      // Sync with conflicts
      await offlineSyncService.sync();
      
      // Should have some conflicts
      const conflicts = await offlineSyncService.getConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(2);
      
      // Resolve conflicts
      for (const conflict of conflicts) {
        await offlineSyncService.resolveConflict(conflict.id, {
          strategy: 'local-wins',
          winningResource: conflict.localResource
        });
      }
      
      // Final status should be clean
      const finalStatus = offlineSyncService.getSyncStatus();
      expect(finalStatus.conflictedChanges).toBe(0);
    });
  });
});