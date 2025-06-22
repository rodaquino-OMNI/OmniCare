/**
 * Synchronization Service for IndexedDB and FHIR Server
 * Handles offline/online sync, conflict resolution, and data consistency
 */

import { Resource, Bundle, OperationOutcome } from '@medplum/fhirtypes';
import { indexedDBService } from './indexeddb.service';
import { fhirService } from './fhir.service';
import { SyncQueueEntry, StoredResource, SyncMetadata } from './indexeddb.schemas';
import { getErrorMessage } from '@/utils/error.utils';

// Sync events
export enum SyncEvent {
  SYNC_STARTED = 'sync:started',
  SYNC_PROGRESS = 'sync:progress',
  SYNC_COMPLETED = 'sync:completed',
  SYNC_FAILED = 'sync:failed',
  CONFLICT_DETECTED = 'sync:conflict',
  RESOURCE_SYNCED = 'sync:resource',
  OFFLINE = 'sync:offline',
  ONLINE = 'sync:online'
}

// Sync status
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime?: number;
  pendingChanges: number;
  syncErrors: SyncError[];
}

// Sync error
export interface SyncError {
  resourceId: string;
  resourceType: string;
  error: string;
  timestamp: number;
  retryCount: number;
}

// Sync progress
export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  conflicts: number;
  currentResource?: string;
}

// Conflict resolution strategy
export type ConflictResolution = 'local-wins' | 'server-wins' | 'manual' | 'merge';

// Sync options
export interface SyncOptions {
  conflictResolution?: ConflictResolution;
  maxRetries?: number;
  batchSize?: number;
  resourceTypes?: string[];
  since?: Date;
}

/**
 * FHIR Synchronization Service
 */
export class FHIRSyncService {
  private static instance: FHIRSyncService;
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private syncErrors: Map<string, SyncError> = new Map();
  private eventListeners: Map<SyncEvent, Set<Function>> = new Map();
  private syncInterval?: number;
  private lastSyncTime?: number;

  private constructor() {
    this.setupNetworkListeners();
  }

  static getInstance(): FHIRSyncService {
    if (!FHIRSyncService.instance) {
      FHIRSyncService.instance = new FHIRSyncService();
    }
    return FHIRSyncService.instance;
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit(SyncEvent.ONLINE);
      // Auto-sync when coming online
      this.syncAll().catch(console.error);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit(SyncEvent.OFFLINE);
    });
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingChanges: 0, // Will be calculated
      syncErrors: Array.from(this.syncErrors.values())
    };
  }

  /**
   * Start automatic sync
   */
  startAutoSync(intervalMinutes = 5): void {
    this.stopAutoSync();
    
    // Initial sync
    this.syncAll().catch(console.error);
    
    // Set interval
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll().catch(console.error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Sync all pending changes
   */
  async syncAll(options: SyncOptions = {}): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.emit(SyncEvent.SYNC_STARTED);

    try {
      // Get pending sync items
      const pendingItems = await indexedDBService.getPendingSyncItems();
      
      const progress: SyncProgress = {
        total: pendingItems.length,
        completed: 0,
        failed: 0,
        conflicts: 0
      };

      // Process in batches
      const batchSize = options.batchSize || 10;
      for (let i = 0; i < pendingItems.length; i += batchSize) {
        const batch = pendingItems.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (item) => {
          try {
            progress.currentResource = `${item.resourceType}/${item.resourceId}`;
            await this.syncResource(item, options);
            progress.completed++;
          } catch (error) {
            progress.failed++;
            this.recordSyncError(item, error);
          }
          
          this.emit(SyncEvent.SYNC_PROGRESS, progress);
        }));
      }

      // Pull changes from server
      await this.pullServerChanges(options);

      this.lastSyncTime = Date.now();
      this.emit(SyncEvent.SYNC_COMPLETED, progress);
    } catch (error) {
      this.emit(SyncEvent.SYNC_FAILED, error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a specific resource
   */
  async syncResource(syncItem: SyncQueueEntry, options: SyncOptions = {}): Promise<void> {
    const maxRetries = options.maxRetries || 3;

    if (syncItem.attempts >= maxRetries) {
      throw new Error(`Max retries exceeded for ${syncItem.resourceType}/${syncItem.resourceId}`);
    }

    try {
      switch (syncItem.operation) {
        case 'create':
          await this.syncCreate(syncItem);
          break;
        
        case 'update':
          await this.syncUpdate(syncItem, options);
          break;
        
        case 'delete':
          await this.syncDelete(syncItem);
          break;
      }

      // Mark as completed
      await indexedDBService.markSyncCompleted(syncItem.id!);
      this.emit(SyncEvent.RESOURCE_SYNCED, syncItem);

      // Remove from error list if present
      this.syncErrors.delete(`${syncItem.resourceType}/${syncItem.resourceId}`);
    } catch (error) {
      // Update attempt count
      syncItem.attempts++;
      syncItem.lastAttempt = Date.now();
      throw error;
    }
  }

  /**
   * Sync create operation
   */
  private async syncCreate(syncItem: SyncQueueEntry): Promise<void> {
    const resource = syncItem.data;
    
    // Create on server
    const created = await fhirService.createResource(resource);
    
    // Update local copy with server-assigned ID and metadata
    const localResource = await indexedDBService.readResource(
      resource.resourceType,
      resource.id
    );
    
    if (localResource) {
      localResource.id = created.id;
      localResource.meta = created.meta;
      await indexedDBService.updateResource(localResource);
    }
  }

  /**
   * Sync update operation
   */
  private async syncUpdate(syncItem: SyncQueueEntry, options: SyncOptions): Promise<void> {
    const localResource = await indexedDBService.readResource(
      syncItem.resourceType,
      syncItem.resourceId
    );
    
    if (!localResource) {
      throw new Error('Local resource not found');
    }

    try {
      // Get server version
      const serverResource = await fhirService.readResource(
        syncItem.resourceType,
        syncItem.resourceId
      );

      // Check for conflicts
      if (this.hasConflict(localResource, serverResource)) {
        await this.handleConflict(localResource, serverResource, options);
      } else {
        // No conflict, update server
        const updated = await fhirService.updateResource(localResource);
        
        // Update local metadata
        localResource.meta = updated.meta;
        await indexedDBService.updateResource(localResource);
      }
    } catch (error: any) {
      if (error.status === 404) {
        // Resource doesn't exist on server, create it
        await this.syncCreate({
          ...syncItem,
          operation: 'create',
          data: localResource
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Sync delete operation
   */
  private async syncDelete(syncItem: SyncQueueEntry): Promise<void> {
    try {
      await fhirService.deleteResource(syncItem.resourceType, syncItem.resourceId);
    } catch (error: any) {
      if (error.status === 404) {
        // Already deleted on server
        return;
      }
      throw error;
    }
  }

  /**
   * Pull changes from server
   */
  private async pullServerChanges(options: SyncOptions): Promise<void> {
    const resourceTypes = options.resourceTypes || [
      'Patient', 'Encounter', 'Observation', 'MedicationRequest',
      'Condition', 'AllergyIntolerance', 'DocumentReference'
    ];

    for (const resourceType of resourceTypes) {
      await this.pullResourceTypeChanges(resourceType, options);
    }
  }

  /**
   * Pull changes for a specific resource type
   */
  private async pullResourceTypeChanges(
    resourceType: string,
    options: SyncOptions
  ): Promise<void> {
    try {
      // Search for recently updated resources
      const searchParams: any = {
        _sort: '-_lastUpdated',
        _count: 100
      };

      if (options.since || this.lastSyncTime) {
        const sinceDate = options.since || new Date(this.lastSyncTime!);
        searchParams._lastUpdated = `gt${sinceDate.toISOString()}`;
      }

      const bundle = await fhirService.searchResources(resourceType, searchParams);

      if (bundle.entry) {
        for (const entry of bundle.entry) {
          const serverResource = entry.resource!;
          
          // Check if we have this resource locally
          const localResource = await indexedDBService.readResource(
            resourceType,
            serverResource.id!
          );

          if (!localResource) {
            // New resource from server
            await indexedDBService.createResource(serverResource);
          } else if (this.isServerNewer(localResource, serverResource)) {
            // Server has newer version
            await indexedDBService.updateResource(serverResource);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to pull ${resourceType} changes:`, error);
    }
  }

  /**
   * Check if resources have a conflict
   */
  private hasConflict(local: Resource, server: Resource): boolean {
    // Compare version IDs if available
    if (local.meta?.versionId && server.meta?.versionId) {
      return local.meta.versionId !== server.meta.versionId;
    }

    // Compare last updated times
    if (local.meta?.lastUpdated && server.meta?.lastUpdated) {
      return local.meta.lastUpdated !== server.meta.lastUpdated;
    }

    return false;
  }

  /**
   * Check if server resource is newer
   */
  private isServerNewer(local: Resource, server: Resource): boolean {
    if (!local.meta?.lastUpdated || !server.meta?.lastUpdated) {
      return true; // Assume server is newer if we can't compare
    }

    return new Date(server.meta.lastUpdated) > new Date(local.meta.lastUpdated);
  }

  /**
   * Handle sync conflict
   */
  private async handleConflict(
    local: Resource,
    server: Resource,
    options: SyncOptions
  ): Promise<void> {
    const resolution = options.conflictResolution || 'manual';

    this.emit(SyncEvent.CONFLICT_DETECTED, {
      resourceType: local.resourceType,
      resourceId: local.id,
      local,
      server,
      resolution
    });

    switch (resolution) {
      case 'local-wins':
        // Force update with local version
        server.meta = local.meta; // Preserve local metadata
        await fhirService.updateResource(local);
        break;

      case 'server-wins':
        // Use server version
        await indexedDBService.updateResource(server);
        break;

      case 'merge':
        // Attempt automatic merge
        const merged = await this.mergeResources(local, server);
        await fhirService.updateResource(merged);
        await indexedDBService.updateResource(merged);
        break;

      case 'manual':
        // Store conflict for manual resolution
        await this.storeConflict(local, server);
        throw new Error(`Conflict detected for ${local.resourceType}/${local.id}`);
    }
  }

  /**
   * Merge resources (simple strategy)
   */
  private async mergeResources(local: Resource, server: Resource): Promise<Resource> {
    // Simple merge strategy: take server as base, apply local changes
    const merged = { ...server };

    // Preserve local modifications timestamp
    if (!merged.meta) merged.meta = {};
    merged.meta.tag = [
      ...(merged.meta.tag || []),
      {
        system: 'http://omnicare.com/sync',
        code: 'merged',
        display: 'Automatically merged'
      }
    ];

    return merged;
  }

  /**
   * Store conflict for manual resolution
   */
  private async storeConflict(local: Resource, server: Resource): Promise<void> {
    // Store in metadata store
    const conflictKey = `conflict:${local.resourceType}:${local.id}`;
    const conflictData = {
      local,
      server,
      timestamp: Date.now()
    };

    // Would implement actual storage here
    console.log('Conflict stored:', conflictKey, conflictData);
  }

  /**
   * Record sync error
   */
  private recordSyncError(syncItem: SyncQueueEntry, error: unknown): void {
    const key = `${syncItem.resourceType}/${syncItem.resourceId}`;
    
    const syncError: SyncError = {
      resourceId: syncItem.resourceId,
      resourceType: syncItem.resourceType,
      error: getErrorMessage(error),
      timestamp: Date.now(),
      retryCount: syncItem.attempts
    };

    this.syncErrors.set(key, syncError);
  }

  /**
   * Clear sync errors
   */
  clearSyncErrors(): void {
    this.syncErrors.clear();
  }

  /**
   * Subscribe to sync events
   */
  on(event: SyncEvent, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit sync event
   */
  private emit(event: SyncEvent, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in sync event listener:`, error);
        }
      });
    }
  }

  /**
   * Force sync a specific resource
   */
  async forceSyncResource(resourceType: string, resourceId: string): Promise<void> {
    const localResource = await indexedDBService.readResource(resourceType, resourceId);
    if (!localResource) {
      throw new Error('Resource not found locally');
    }

    try {
      const serverResource = await fhirService.readResource(resourceType, resourceId);
      
      // Always use local version in force sync
      await fhirService.updateResource(localResource);
    } catch (error: any) {
      if (error.status === 404) {
        // Create on server
        await fhirService.createResource(localResource);
      } else {
        throw error;
      }
    }
  }

  /**
   * Reset sync state
   */
  async resetSyncState(): Promise<void> {
    // Clear sync queue
    const pendingItems = await indexedDBService.getPendingSyncItems();
    for (const item of pendingItems) {
      await indexedDBService.markSyncCompleted(item.id!);
    }

    // Clear errors
    this.clearSyncErrors();
    
    // Reset last sync time
    this.lastSyncTime = undefined;
  }
}

// Export singleton instance
export const fhirSyncService = FHIRSyncService.getInstance();

// Export types
export type { SyncStatus, SyncError, SyncProgress, SyncOptions };