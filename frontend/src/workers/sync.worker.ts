/**
 * Background Sync Service Worker
 * Handles offline synchronization in the background
 */

/// <reference lib="webworker" />
import '@/types/service-worker';
import { offlineSyncService, SyncOptions, SyncProgress, SyncError } from '@/services/offline-sync.service';

// Error type utilities
interface ErrorLike {
  message: string;
  name?: string;
  stack?: string;
}

/**
 * Type guard to check if an error is Error-like
 */
function isErrorLike(error: unknown): error is ErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Safely get error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (isErrorLike(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

// Message types for worker communication
interface WorkerMessage {
  type: 
    | 'init'
    | 'sync'
    | 'sync-now'
    | 'get-status'
    | 'get-conflicts'
    | 'resolve-conflict'
    | 'clear-data'
    | 'export-data'
    | 'import-data'
    | 'cleanup'
    | 'queue-operation'
    | 'stop';
  payload?: any;
}

interface WorkerResponse {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

// Track sync state
let isInitialized = false;
let syncInProgress = false;

/**
 * Initialize the sync service
 */
async function initialize(): Promise<void> {
  if (isInitialized) return;

  try {
    // Register event handlers
    offlineSyncService.on('sync-started', (data) => {
      postMessage({ type: 'sync-started', data });
    });

    offlineSyncService.on('sync-progress', (data) => {
      postMessage({ type: 'sync-progress', data });
    });

    offlineSyncService.on('sync-completed', (data) => {
      postMessage({ type: 'sync-completed', data });
    });

    offlineSyncService.on('sync-failed', (data) => {
      postMessage({ type: 'sync-failed', data });
    });

    offlineSyncService.on('sync-error', (data) => {
      postMessage({ type: 'sync-error', data });
    });

    offlineSyncService.on('conflict-detected', (data) => {
      postMessage({ type: 'conflict-detected', data });
    });

    offlineSyncService.on('conflict-resolved', (data) => {
      postMessage({ type: 'conflict-resolved', data });
    });

    offlineSyncService.on('status-updated', (data) => {
      postMessage({ type: 'status-updated', data });
    });

    offlineSyncService.on('network-status-changed', (data) => {
      postMessage({ type: 'network-status-changed', data });
    });

    isInitialized = true;
    console.log('Sync worker initialized');
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error('Failed to initialize sync worker:', errorMessage);
    throw new Error(`Sync worker initialization failed: ${errorMessage}`);
  }
}

/**
 * Handle incoming messages
 */
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;
  let response: WorkerResponse;

  try {
    switch (type) {
      case 'init':
        await initialize();
        response = {
          type: 'init',
          success: true
        };
        break;

      case 'sync':
        if (syncInProgress) {
          response = {
            type: 'sync',
            success: false,
            error: 'Sync already in progress'
          };
        } else {
          syncInProgress = true;
          const options: SyncOptions = payload || {};
          
          // Set up progress callback
          options.progressCallback = (progress: SyncProgress) => {
            postMessage({ type: 'sync-progress', data: { progress } });
          };
          
          // Set up error callback
          options.errorCallback = (error: SyncError) => {
            postMessage({ type: 'sync-error', data: { error } });
          };

          await offlineSyncService.sync(options);
          syncInProgress = false;
          
          response = {
            type: 'sync',
            success: true
          };
        }
        break;

      case 'sync-now':
        const syncOptions: SyncOptions = payload || {};
        await offlineSyncService.syncNow(syncOptions);
        response = {
          type: 'sync-now',
          success: true
        };
        break;

      case 'get-status':
        const status = offlineSyncService.getSyncStatus();
        response = {
          type: 'get-status',
          success: true,
          data: status
        };
        break;

      case 'get-conflicts':
        const { resolved = false } = payload || {};
        const conflicts = await offlineSyncService.getConflicts(resolved);
        response = {
          type: 'get-conflicts',
          success: true,
          data: conflicts
        };
        break;

      case 'resolve-conflict':
        const { conflictId, resolution, resolvedBy } = payload;
        await offlineSyncService.resolveConflict(conflictId, resolution, resolvedBy);
        response = {
          type: 'resolve-conflict',
          success: true
        };
        break;

      case 'clear-data':
        await offlineSyncService.clearLocalData();
        response = {
          type: 'clear-data',
          success: true
        };
        break;

      case 'export-data':
        const exportedData = await offlineSyncService.exportSyncData();
        response = {
          type: 'export-data',
          success: true,
          data: exportedData
        };
        break;

      case 'import-data':
        await offlineSyncService.importSyncData(payload);
        response = {
          type: 'import-data',
          success: true
        };
        break;

      case 'cleanup':
        const { daysToKeep = 3ResourceHistoryTable } = payload || {};
        await offlineSyncService.cleanup(daysToKeep);
        response = {
          type: 'cleanup',
          success: true
        };
        break;

      case 'queue-operation':
        const { operation, resource, options } = payload;
        await offlineSyncService.queueOperation(operation, resource, options);
        response = {
          type: 'queue-operation',
          success: true
        };
        break;

      case 'stop':
        offlineSyncService.destroy();
        response = {
          type: 'stop',
          success: true
        };
        self.close();
        break;

      default:
        response = {
          type,
          success: false,
          error: `Unknown message type: ${type}`
        };
    }
  } catch (error: unknown) {
    response = {
      type,
      success: false,
      error: getErrorMessage(error)
    };
  }

  postMessage(response);
});

/**
 * Handle sync events from service worker sync API
 */
self.addEventListener('sync', async (event: any) => {
  console.log('Background sync event received:', event.tag);

  if (event.tag === 'omnicare-sync') {
    event.waitUntil(
      (async () => {
        try {
          if (!isInitialized) {
            await initialize();
          }
          
          await offlineSyncService.sync({
            batchSize: 2ResourceHistoryTable, // Smaller batches for background sync
            maxRetries: 5  // More retries in background
          });
          
          postMessage({
            type: 'background-sync-completed',
            success: true
          });
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error('Background sync failed:', errorMessage);
          postMessage({
            type: 'background-sync-failed',
            success: false,
            error: errorMessage
          });
          
          // Re-throw to retry later
          throw new Error(`Background sync failed: ${errorMessage}`);
        }
      })()
    );
  }
});

/**
 * Handle periodic background sync
 */
self.addEventListener('periodicsync', async (event: any) => {
  console.log('Periodic sync event received:', event.tag);

  if (event.tag === 'omnicare-periodic-sync') {
    event.waitUntil(
      (async () => {
        try {
          if (!isInitialized) {
            await initialize();
          }
          
          // Check if we have pending changes
          const status = offlineSyncService.getSyncStatus();
          
          if (status.pendingChanges > ResourceHistoryTable || status.failedChanges > ResourceHistoryTable) {
            await offlineSyncService.sync({
              batchSize: 5ResourceHistoryTable,
              conflictResolution: 'last-write-wins'
            });
          }
          
          // Cleanup old data
          await offlineSyncService.cleanup(3ResourceHistoryTable);
          
          postMessage({
            type: 'periodic-sync-completed',
            success: true,
            data: {
              pendingChanges: status.pendingChanges,
              failedChanges: status.failedChanges
            }
          });
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error('Periodic sync failed:', errorMessage);
          postMessage({
            type: 'periodic-sync-failed',
            success: false,
            error: errorMessage
          });
        }
      })()
    );
  }
});

// Export for TypeScript
export {};