/**
 * Wrapper for OfflineSyncService to ensure SSR compatibility
 */
import type { OfflineSyncService as OfflineSyncServiceType } from './offline-sync.service';

// Create a lazy-loaded wrapper that only imports the service on client side
class OfflineSyncServiceWrapper {
  private _service: OfflineSyncServiceType | null = null;

  private async getService(): Promise<OfflineSyncServiceType> {
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      // Return a mock for SSR and tests
      return {
        getSyncStatus: () => ({
          isOnline: true,
          isSyncing: false,
          pendingChanges: 0,
          failedChanges: 0,
          conflictedChanges: 0,
          errors: []
        }),
        on: () => {},
        off: () => {},
        sync: () => Promise.resolve(),
        queueOperation: () => Promise.resolve(),
        getConflicts: () => Promise.resolve([]),
        resolveConflict: () => Promise.resolve(),
        clearLocalData: () => Promise.resolve(),
        exportSyncData: () => Promise.resolve({
          resourceVersions: new Map(),
          pendingOperations: [],
          conflicts: []
        }),
        importSyncData: () => Promise.resolve(),
        syncNow: () => Promise.resolve(),
        cleanup: () => Promise.resolve(),
        destroy: () => {},
        initialize: () => Promise.resolve()
      } as any;
    }

    if (!this._service) {
      // Dynamically import only on client side
      const module = await import('./offline-sync.service');
      this._service = module.getOfflineSyncService();
      // Initialize the service after getting the instance
      await this._service.initialize();
    }

    return this._service;
  }

  // Proxy all method calls to the actual service
  async getSyncStatus() {
    const service = await this.getService();
    return service.getSyncStatus();
  }

  async sync(options?: any) {
    const service = await this.getService();
    return service.sync(options);
  }

  async queueOperation(operation: any, resource: any, options?: any) {
    const service = await this.getService();
    return service.queueOperation(operation, resource, options);
  }

  async getConflicts(resolved?: boolean) {
    const service = await this.getService();
    return service.getConflicts(resolved);
  }

  async resolveConflict(conflictId: string, resolution: any, resolvedBy?: string) {
    const service = await this.getService();
    return service.resolveConflict(conflictId, resolution, resolvedBy);
  }

  async clearLocalData() {
    const service = await this.getService();
    return service.clearLocalData();
  }

  async exportSyncData() {
    const service = await this.getService();
    return service.exportSyncData();
  }

  async importSyncData(data: any) {
    const service = await this.getService();
    return service.importSyncData(data);
  }

  async syncNow(options?: any) {
    const service = await this.getService();
    return service.syncNow(options);
  }

  async cleanup(daysToKeep?: number) {
    const service = await this.getService();
    return service.cleanup(daysToKeep);
  }

  on(eventType: string, handler: (data: any) => void) {
    if (typeof window !== 'undefined') {
      this.getService().then(service => service.on(eventType, handler));
    }
  }

  off(eventType: string) {
    if (typeof window !== 'undefined') {
      this.getService().then(service => service.off(eventType));
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && this._service) {
      this._service.destroy();
    }
  }
}

// Export a singleton instance of the wrapper
export const offlineSyncService = new OfflineSyncServiceWrapper();

// Re-export types
export type {
  SyncQueueItem,
  SyncStatus,
  SyncProgress,
  SyncError,
  SyncConflict,
  ConflictResolution,
  ConflictResolutionStrategy,
  SyncOptions,
  ResourceVersion,
  SyncMetadata
} from './offline-sync.service';