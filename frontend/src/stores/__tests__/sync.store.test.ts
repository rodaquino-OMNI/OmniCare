/**
 * @jest-environment jsdom
 */

import { useSyncStore } from '../sync';

describe('SyncStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
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
    
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useSyncStore.getState();
      
      expect(state.isSyncing).toBe(false);
      expect(state.syncProgress).toBe(0);
      expect(state.lastSyncTime).toBeNull();
      expect(state.syncError).toBeNull();
      expect(state.syncQueue).toEqual([]);
      expect(state.syncedItems).toEqual([]);
      expect(state.failedItems).toEqual([]);
      expect(state.totalItems).toBe(0);
      expect(state.pendingChanges).toBe(0);
      expect(state.currentOperation).toBeNull();
      expect(state.estimatedTimeRemaining).toBeNull();
    });
  });

  describe('Sync Queue Management', () => {
    it('should add item to sync queue', () => {
      const { addToSyncQueue } = useSyncStore.getState();
      
      const newItem = {
        type: 'patient',
        description: 'Update patient demographics'
      };
      
      addToSyncQueue(newItem);
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(1);
      expect(state.pendingChanges).toBe(1);
      expect(state.totalItems).toBe(1);
      
      const addedItem = state.syncQueue[0];
      expect(addedItem.type).toBe('patient');
      expect(addedItem.description).toBe('Update patient demographics');
      expect(addedItem.status).toBe('pending');
      expect(addedItem.id).toBeDefined();
      expect(addedItem.timestamp).toBeDefined();
    });

    it('should generate unique IDs for sync items', () => {
      const { addToSyncQueue } = useSyncStore.getState();
      
      addToSyncQueue({ type: 'patient1', description: 'First item' });
      addToSyncQueue({ type: 'patient2', description: 'Second item' });
      
      const state = useSyncStore.getState();
      const ids = state.syncQueue.map(item => item.id);
      
      expect(ids).toHaveLength(2);
      expect(ids[0]).not.toBe(ids[1]);
      expect(new Set(ids).size).toBe(2); // All unique
    });

    it('should handle multiple items in queue', () => {
      const { addToSyncQueue } = useSyncStore.getState();
      
      const items = [
        { type: 'patient', description: 'Update patient A' },
        { type: 'encounter', description: 'Create encounter B' },
        { type: 'medication', description: 'Update medication C' }
      ];
      
      items.forEach(item => addToSyncQueue(item));
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(3);
      expect(state.pendingChanges).toBe(3);
      expect(state.totalItems).toBe(3);
    });

    it('should clear sync queue', () => {
      const { addToSyncQueue, clearSyncQueue } = useSyncStore.getState();
      
      // Add some items first
      addToSyncQueue({ type: 'patient', description: 'Test item 1' });
      addToSyncQueue({ type: 'encounter', description: 'Test item 2' });
      
      expect(useSyncStore.getState().syncQueue).toHaveLength(2);
      
      clearSyncQueue();
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toEqual([]);
      expect(state.syncedItems).toEqual([]);
      expect(state.failedItems).toEqual([]);
      expect(state.pendingChanges).toBe(0);
      expect(state.totalItems).toBe(0);
      expect(state.syncProgress).toBe(0);
    });
  });

  describe('Sync Process Management', () => {
    it('should start sync process', () => {
      const { startSync } = useSyncStore.getState();
      
      startSync();
      
      const state = useSyncStore.getState();
      expect(state.isSyncing).toBe(true);
      expect(state.syncProgress).toBe(0);
      expect(state.syncError).toBeNull();
      expect(state.currentOperation).toBe('Initializing sync...');
    });

    it('should update sync progress', () => {
      const { updateSyncProgress } = useSyncStore.getState();
      
      updateSyncProgress(25);
      expect(useSyncStore.getState().syncProgress).toBe(25);
      
      updateSyncProgress(75);
      expect(useSyncStore.getState().syncProgress).toBe(75);
      
      updateSyncProgress(100);
      expect(useSyncStore.getState().syncProgress).toBe(100);
    });

    it('should clamp sync progress to valid range', () => {
      const { updateSyncProgress } = useSyncStore.getState();
      
      updateSyncProgress(-10);
      expect(useSyncStore.getState().syncProgress).toBe(0);
      
      updateSyncProgress(150);
      expect(useSyncStore.getState().syncProgress).toBe(100);
    });

    it('should complete sync process', () => {
      const { startSync, completeSync } = useSyncStore.getState();
      
      // Start sync first
      startSync();
      expect(useSyncStore.getState().isSyncing).toBe(true);
      
      completeSync();
      
      const state = useSyncStore.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTime).toBeTruthy();
      expect(state.currentOperation).toBeNull();
      expect(state.estimatedTimeRemaining).toBeNull();
      expect(state.syncProgress).toBe(100);
    });

    it('should cancel sync process', () => {
      const { startSync, cancelSync } = useSyncStore.getState();
      
      // Start sync first
      startSync();
      useSyncStore.setState({ estimatedTimeRemaining: 120 });
      
      cancelSync();
      
      const state = useSyncStore.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.currentOperation).toBeNull();
      expect(state.estimatedTimeRemaining).toBeNull();
    });

    it('should trigger sync when there are queued items', () => {
      const { addToSyncQueue, triggerSync } = useSyncStore.getState();
      
      // Add item to queue
      addToSyncQueue({ type: 'patient', description: 'Test item' });
      
      triggerSync();
      
      const state = useSyncStore.getState();
      expect(state.isSyncing).toBe(true);
    });

    it('should not trigger sync when already syncing', () => {
      const { addToSyncQueue, startSync, triggerSync } = useSyncStore.getState();
      
      addToSyncQueue({ type: 'patient', description: 'Test item' });
      
      // Already syncing
      startSync();
      const initialState = useSyncStore.getState();
      
      triggerSync();
      
      // State should remain the same
      const finalState = useSyncStore.getState();
      expect(finalState.isSyncing).toBe(initialState.isSyncing);
      expect(finalState.currentOperation).toBe(initialState.currentOperation);
    });

    it('should not trigger sync when queue is empty', () => {
      const { triggerSync } = useSyncStore.getState();
      
      // Empty queue
      expect(useSyncStore.getState().syncQueue).toHaveLength(0);
      
      triggerSync();
      
      expect(useSyncStore.getState().isSyncing).toBe(false);
    });
  });

  describe('Item Status Management', () => {
    beforeEach(() => {
      // Add test items to queue
      const { addToSyncQueue } = useSyncStore.getState();
      addToSyncQueue({ type: 'patient', description: 'Test item 1' });
      addToSyncQueue({ type: 'encounter', description: 'Test item 2' });
      useSyncStore.setState({ totalItems: 2 });
    });

    it('should mark item as synced', () => {
      const { markItemSynced } = useSyncStore.getState();
      const itemId = useSyncStore.getState().syncQueue[0].id;
      
      markItemSynced(itemId);
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(1); // One removed
      expect(state.syncedItems).toHaveLength(1); // One added
      expect(state.pendingChanges).toBe(0); // Decreased by 1
      expect(state.syncProgress).toBe(50); // 1/2 * 100
      
      const syncedItem = state.syncedItems[0];
      expect(syncedItem.id).toBe(itemId);
      expect(syncedItem.status).toBe('synced');
    });

    it('should mark item as failed', () => {
      const { markItemFailed } = useSyncStore.getState();
      const itemId = useSyncStore.getState().syncQueue[0].id;
      const errorMessage = 'Network connection failed';
      
      markItemFailed(itemId, errorMessage);
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(1); // One removed
      expect(state.failedItems).toHaveLength(1); // One added
      expect(state.syncError).toBe(errorMessage);
      
      const failedItem = state.failedItems[0];
      expect(failedItem.id).toBe(itemId);
      expect(failedItem.status).toBe('failed');
      expect(failedItem.error).toBe(errorMessage);
      expect(failedItem.retryCount).toBe(1);
    });

    it('should increment retry count on failure', () => {
      const { markItemFailed } = useSyncStore.getState();
      
      // Set initial retry count
      const itemId = useSyncStore.getState().syncQueue[0].id;
      useSyncStore.setState({
        syncQueue: useSyncStore.getState().syncQueue.map(item =>
          item.id === itemId ? { ...item, retryCount: 2 } : item
        )
      });
      
      markItemFailed(itemId, 'Second failure');
      
      const failedItem = useSyncStore.getState().failedItems[0];
      expect(failedItem.retryCount).toBe(3);
    });

    it('should handle marking non-existent item as synced', () => {
      const { markItemSynced } = useSyncStore.getState();
      const initialState = useSyncStore.getState();
      
      markItemSynced('non-existent-id');
      
      // State should remain unchanged
      const finalState = useSyncStore.getState();
      expect(finalState.syncQueue).toEqual(initialState.syncQueue);
      expect(finalState.syncedItems).toEqual(initialState.syncedItems);
    });

    it('should handle marking non-existent item as failed', () => {
      const { markItemFailed } = useSyncStore.getState();
      const initialState = useSyncStore.getState();
      
      markItemFailed('non-existent-id', 'Error message');
      
      // State should remain unchanged except for syncError
      const finalState = useSyncStore.getState();
      expect(finalState.syncQueue).toEqual(initialState.syncQueue);
      expect(finalState.failedItems).toEqual(initialState.failedItems);
      expect(finalState.syncError).toBe('Error message');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed sync items', async () => {
      const { addToSyncQueue, markItemFailed, retrySync, startSync } = useSyncStore.getState();
      
      // Add item and mark as failed
      addToSyncQueue({ type: 'patient', description: 'Test item' });
      const itemId = useSyncStore.getState().syncQueue[0].id;
      markItemFailed(itemId, 'Initial failure');
      
      expect(useSyncStore.getState().failedItems).toHaveLength(1);
      expect(useSyncStore.getState().syncQueue).toHaveLength(0);
      
      await retrySync();
      
      const state = useSyncStore.getState();
      expect(state.failedItems).toHaveLength(0);
      expect(state.syncQueue).toHaveLength(1);
      expect(state.syncError).toBeNull();
      expect(state.isSyncing).toBe(true);
      
      // Item should be reset to pending status
      const retriedItem = state.syncQueue[0];
      expect(retriedItem.status).toBe('pending');
      expect(retriedItem.error).toBeUndefined();
    });

    it('should move multiple failed items back to queue', async () => {
      const { addToSyncQueue, markItemFailed, retrySync } = useSyncStore.getState();
      
      // Add multiple items and mark them as failed
      addToSyncQueue({ type: 'patient', description: 'Item 1' });
      addToSyncQueue({ type: 'encounter', description: 'Item 2' });
      
      const items = useSyncStore.getState().syncQueue;
      markItemFailed(items[0].id, 'Error 1');
      markItemFailed(items[1].id, 'Error 2');
      
      expect(useSyncStore.getState().failedItems).toHaveLength(2);
      
      await retrySync();
      
      const state = useSyncStore.getState();
      expect(state.failedItems).toHaveLength(0);
      expect(state.syncQueue).toHaveLength(2);
    });

    it('should handle retry with no failed items', async () => {
      const { retrySync } = useSyncStore.getState();
      
      // No failed items
      expect(useSyncStore.getState().failedItems).toHaveLength(0);
      
      await retrySync();
      
      const state = useSyncStore.getState();
      expect(state.failedItems).toHaveLength(0);
      expect(state.syncQueue).toHaveLength(0);
      expect(state.isSyncing).toBe(true); // Still starts sync process
    });
  });

  describe('Status Management', () => {
    it('should set sync error', () => {
      const { setSyncError } = useSyncStore.getState();
      
      const errorMessage = 'Critical sync failure';
      setSyncError(errorMessage);
      
      expect(useSyncStore.getState().syncError).toBe(errorMessage);
      
      // Clear error
      setSyncError(null);
      expect(useSyncStore.getState().syncError).toBeNull();
    });

    it('should set current operation', () => {
      const { setCurrentOperation } = useSyncStore.getState();
      
      const operation = 'Syncing patient data...';
      setCurrentOperation(operation);
      
      expect(useSyncStore.getState().currentOperation).toBe(operation);
      
      // Clear operation
      setCurrentOperation(null);
      expect(useSyncStore.getState().currentOperation).toBeNull();
    });

    it('should set estimated time remaining', () => {
      const { setEstimatedTime } = useSyncStore.getState();
      
      setEstimatedTime(120); // 2 minutes
      expect(useSyncStore.getState().estimatedTimeRemaining).toBe(120);
      
      setEstimatedTime(60); // 1 minute
      expect(useSyncStore.getState().estimatedTimeRemaining).toBe(60);
      
      // Clear time
      setEstimatedTime(null);
      expect(useSyncStore.getState().estimatedTimeRemaining).toBeNull();
    });
  });

  describe('Sync Progress Calculation', () => {
    it('should calculate progress correctly with synced items', () => {
      const { addToSyncQueue, markItemSynced } = useSyncStore.getState();
      
      // Add 4 items
      for (let i = 0; i < 4; i++) {
        addToSyncQueue({ type: 'test', description: `Item ${i + 1}` });
      }
      
      const items = useSyncStore.getState().syncQueue;
      
      // Mark first item as synced
      markItemSynced(items[0].id);
      expect(useSyncStore.getState().syncProgress).toBe(25); // 1/4 * 100
      
      // Mark second item as synced
      markItemSynced(useSyncStore.getState().syncQueue[0].id);
      expect(useSyncStore.getState().syncProgress).toBe(50); // 2/4 * 100
    });

    it('should handle division by zero in progress calculation', () => {
      const { markItemSynced } = useSyncStore.getState();
      
      // No total items
      useSyncStore.setState({ totalItems: 0 });
      
      // This should not crash
      markItemSynced('non-existent-id');
      
      // Progress should remain 0 or handle gracefully
      const progress = useSyncStore.getState().syncProgress;
      expect(typeof progress).toBe('number');
      expect(progress).not.toBeNaN();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle full sync lifecycle', () => {
      const {
        addToSyncQueue,
        startSync,
        markItemSynced,
        markItemFailed,
        completeSync
      } = useSyncStore.getState();
      
      // 1. Add items to queue
      addToSyncQueue({ type: 'patient', description: 'Patient A' });
      addToSyncQueue({ type: 'encounter', description: 'Encounter B' });
      addToSyncQueue({ type: 'medication', description: 'Medication C' });
      
      let state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(3);
      expect(state.pendingChanges).toBe(3);
      
      // 2. Start sync
      startSync();
      state = useSyncStore.getState();
      expect(state.isSyncing).toBe(true);
      
      // 3. Process items
      const items = state.syncQueue;
      markItemSynced(items[0].id); // Success
      markItemFailed(items[1].id, 'Network error'); // Failure
      markItemSynced(items[2].id); // Success
      
      state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(0);
      expect(state.syncedItems).toHaveLength(2);
      expect(state.failedItems).toHaveLength(1);
      expect(state.pendingChanges).toBe(1); // Only successful syncs reduce pending
      
      // 4. Complete sync
      completeSync();
      state = useSyncStore.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTime).toBeTruthy();
    });

    it('should handle concurrent operations safely', () => {
      const { addToSyncQueue, markItemSynced, markItemFailed } = useSyncStore.getState();
      
      // Add items
      addToSyncQueue({ type: 'item1', description: 'Item 1' });
      addToSyncQueue({ type: 'item2', description: 'Item 2' });
      
      const items = useSyncStore.getState().syncQueue;
      
      // Simulate concurrent operations
      markItemSynced(items[0].id);
      markItemFailed(items[1].id, 'Error');
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(0);
      expect(state.syncedItems).toHaveLength(1);
      expect(state.failedItems).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large item counts', () => {
      const { addToSyncQueue } = useSyncStore.getState();
      
      // Add many items
      for (let i = 0; i < 1000; i++) {
        addToSyncQueue({ type: 'bulk', description: `Bulk item ${i}` });
      }
      
      const state = useSyncStore.getState();
      expect(state.syncQueue).toHaveLength(1000);
      expect(state.totalItems).toBe(1000);
      expect(state.pendingChanges).toBe(1000);
    });

    it('should handle items with special characters', () => {
      const { addToSyncQueue } = useSyncStore.getState();
      
      const specialItem = {
        type: 'special-chars',
        description: 'Item with émojis 🚀 and spécial chars & symbols!'
      };
      
      addToSyncQueue(specialItem);
      
      const state = useSyncStore.getState();
      expect(state.syncQueue[0].description).toBe(specialItem.description);
    });

    it('should maintain timestamp consistency', () => {
      const { addToSyncQueue } = useSyncStore.getState();
      
      const beforeTime = Date.now();
      addToSyncQueue({ type: 'timestamp', description: 'Timestamp test' });
      const afterTime = Date.now();
      
      const item = useSyncStore.getState().syncQueue[0];
      const itemTime = new Date(item.timestamp).getTime();
      expect(itemTime).toBeGreaterThanOrEqual(beforeTime);
      expect(itemTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state structure for persistence', () => {
      const state = useSyncStore.getState();
      
      // Verify all expected properties exist
      expect(state).toHaveProperty('isSyncing');
      expect(state).toHaveProperty('syncProgress');
      expect(state).toHaveProperty('lastSyncTime');
      expect(state).toHaveProperty('syncError');
      expect(state).toHaveProperty('syncQueue');
      expect(state).toHaveProperty('syncedItems');
      expect(state).toHaveProperty('failedItems');
      expect(state).toHaveProperty('totalItems');
      expect(state).toHaveProperty('pendingChanges');
      expect(state).toHaveProperty('currentOperation');
      expect(state).toHaveProperty('estimatedTimeRemaining');
      
      // Verify all action functions exist
      expect(typeof state.addToSyncQueue).toBe('function');
      expect(typeof state.startSync).toBe('function');
      expect(typeof state.updateSyncProgress).toBe('function');
      expect(typeof state.markItemSynced).toBe('function');
      expect(typeof state.markItemFailed).toBe('function');
      expect(typeof state.retrySync).toBe('function');
      expect(typeof state.cancelSync).toBe('function');
      expect(typeof state.clearSyncQueue).toBe('function');
      expect(typeof state.triggerSync).toBe('function');
      expect(typeof state.setSyncError).toBe('function');
      expect(typeof state.setCurrentOperation).toBe('function');
      expect(typeof state.setEstimatedTime).toBe('function');
      expect(typeof state.completeSync).toBe('function');
    });
  });
});