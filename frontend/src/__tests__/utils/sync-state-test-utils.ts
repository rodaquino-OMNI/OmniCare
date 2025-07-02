// Sync state test utilities
import { SyncItem, SyncState } from '@/stores/sync';

// Create a complete SyncState object for testing
export const createMockSyncState = (overrides: Partial<SyncState> = {}): SyncState => {
  const defaultState: SyncState = {
    // Sync status
    isSyncing: false,
    syncProgress: 0,
    lastSyncTime: null,
    syncError: null,
    
    // Sync queue
    syncQueue: [],
    syncedItems: [],
    failedItems: [],
    totalItems: 0,
    pendingChanges: 0,
    
    // Current operation
    currentOperation: null,
    estimatedTimeRemaining: null,
    
    // Session resume
    sessionId: null,
    isResuming: false,
    resumePoint: 0,
    interruptedAt: null,
  };

  return {
    ...defaultState,
    ...overrides,
  };
};

// Common test state presets
export const syncStatePresets = {
  idle: () => createMockSyncState(),
  syncing: () => createMockSyncState({
    isSyncing: true,
    syncProgress: 50,
    currentOperation: 'Syncing data...',
  }),
  failed: () => createMockSyncState({
    syncError: 'Sync failed',
    failedItems: [
      {
        id: 'failed-item-1',
        type: 'Patient',
        description: 'Failed to sync patient',
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: 'Network error',
      }
    ],
  }),
  completed: () => createMockSyncState({
    lastSyncTime: new Date().toISOString(),
    syncedItems: [
      {
        id: 'synced-item-1',
        type: 'Patient',
        description: 'Patient synced successfully',
        timestamp: new Date().toISOString(),
        status: 'synced',
      }
    ],
  }),
  resuming: () => createMockSyncState({
    sessionId: 'test-session-id',
    isResuming: true,
    resumePoint: 25,
    interruptedAt: new Date().toISOString(),
  }),
};