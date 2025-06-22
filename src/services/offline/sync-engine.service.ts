import { Resource, Bundle, OperationOutcome } from '@medplum/fhirtypes';
import { MedplumClient } from '@medplum/core';
import {
  SyncQueue,
  SyncQueueItem,
  SyncStrategy,
  SyncResult,
  SyncDetails,
  Conflict,
  Resolution,
  ConflictResolutionStrategy,
  SyncDirection,
  OfflineSyncConfig
} from '../../types/offline.types';
import { ConflictResolver } from './conflict-resolver.service';
import { OfflineDataStore } from './offline-store.service';
import logger from '../../utils/logger';

/**
 * Sync Engine for bi-directional synchronization between offline and online data
 * Handles conflict detection, resolution, and retry logic
 */
export class SyncEngine {
  private syncQueue: SyncQueue = {
    pending: [],
    failed: [],
    processing: []
  };

  private syncInProgress = false;
  private conflictResolver: ConflictResolver;
  private syncStrategies: Map<string, SyncStrategy>;

  constructor(
    private offlineStore: OfflineDataStore,
    private medplumClient: MedplumClient,
    private config: OfflineSyncConfig
  ) {
    this.conflictResolver = new ConflictResolver(this.offlineStore);
    this.syncStrategies = config.resourceStrategies;
  }

  /**
   * Main sync orchestration method
   */
  async syncWithServer(): Promise<SyncResult[]> {
    if (this.syncInProgress) {
      logger.warn('Sync already in progress, skipping...');
      return [];
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const results: SyncResult[] = [];

    try {
      logger.info('Starting synchronization with server...');

      // Sort resource types by priority
      const sortedStrategies = Array.from(this.syncStrategies.entries())
        .sort(([, a], [, b]) => a.priority - b.priority);

      // Sync each resource type
      for (const [resourceType, strategy] of sortedStrategies) {
        try {
          const result = await this.syncResourceType(resourceType, strategy);
          results.push(result);

          // Handle partial failures
          if (result.status === 'partial' || result.status === 'failed') {
            logger.warn(`Sync issues for ${resourceType}: ${result.failed} failed, ${result.conflicts} conflicts`);
          }
        } catch (error) {
          logger.error(`Failed to sync ${resourceType}:`, error);
          results.push({
            resourceType,
            status: 'failed',
            synced: 0,
            failed: 0,
            conflicts: 0,
            duration: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Process any remaining queue items
      await this.processQueue();

      const totalDuration = Date.now() - startTime;
      logger.info(`Synchronization completed in ${totalDuration}ms`, { results });

      return results;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync specific resource type
   */
  private async syncResourceType(
    resourceType: string,
    strategy: SyncStrategy
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const details: SyncDetails = {
      created: [],
      updated: [],
      deleted: [],
      conflicted: [],
      errors: []
    };

    try {
      // Handle different sync directions
      switch (strategy.direction) {
        case 'push':
          await this.pushResources(resourceType, strategy, details);
          break;
        case 'pull':
          await this.pullResources(resourceType, strategy, details);
          break;
        case 'bidirectional':
          await this.pushResources(resourceType, strategy, details);
          await this.pullResources(resourceType, strategy, details);
          break;
      }

      // Calculate metrics
      const synced = details.created.length + details.updated.length;
      const failed = details.errors.length;
      const conflicts = details.conflicted.length;

      return {
        resourceType,
        status: failed === 0 && conflicts === 0 ? 'success' : 'partial',
        synced,
        failed,
        conflicts,
        duration: Date.now() - startTime,
        details
      };
    } catch (error) {
      return {
        resourceType,
        status: 'failed',
        synced: 0,
        failed: 0,
        conflicts: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Push local changes to server
   */
  private async pushResources(
    resourceType: string,
    strategy: SyncStrategy,
    details: SyncDetails
  ): Promise<void> {
    const store = this.offlineStore.getStore(resourceType);
    const pendingResources = Array.from(store.resources.values())
      .filter(r => r.metadata.syncStatus === 'pending' || r.metadata.syncStatus === 'failed');

    // Process in batches
    for (let i = 0; i < pendingResources.length; i += strategy.batchSize) {
      const batch = pendingResources.slice(i, i + strategy.batchSize);
      
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: []
      };

      // Prepare batch bundle
      for (const encryptedResource of batch) {
        try {
          const resource = await this.offlineStore.decryptResource(encryptedResource);
          
          bundle.entry!.push({
            request: {
              method: resource.id ? 'PUT' : 'POST',
              url: resource.id ? `${resource.resourceType}/${resource.id}` : resource.resourceType
            },
            resource
          });
        } catch (error) {
          logger.error(`Failed to prepare resource for sync:`, error);
          details.errors.push({
            resourceId: encryptedResource.id,
            error: error instanceof Error ? error.message : 'Decryption failed'
          });
        }
      }

      // Execute batch
      if (bundle.entry!.length > 0) {
        try {
          const response = await this.medplumClient.executeBatch(bundle);
          await this.processPushResponse(response, batch, strategy, details);
        } catch (error) {
          logger.error('Batch push failed:', error);
          // Add all items to retry queue
          for (const resource of batch) {
            this.addToQueue({
              id: crypto.randomUUID(),
              resourceType,
              resourceId: resource.id,
              operation: 'update',
              priority: strategy.priority,
              attempts: 1,
              lastAttempt: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Batch failed'
            });
          }
        }
      }
    }
  }

  /**
   * Pull changes from server
   */
  private async pullResources(
    resourceType: string,
    strategy: SyncStrategy,
    details: SyncDetails
  ): Promise<void> {
    try {
      // Get last sync timestamp
      const lastSync = await this.offlineStore.getLastSyncTime(resourceType);
      
      // Query for updated resources
      const searchParams: any = {
        _lastUpdated: `gt${lastSync}`,
        _count: strategy.batchSize,
        _sort: '_lastUpdated'
      };

      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        searchParams._offset = offset;
        
        const bundle = await this.medplumClient.search(resourceType as any, searchParams);
        
        if (bundle.entry && bundle.entry.length > 0) {
          await this.processPullBundle(bundle, strategy, details);
          offset += bundle.entry.length;
          hasMore = bundle.entry.length === strategy.batchSize;
        } else {
          hasMore = false;
        }
      }

      // Update last sync time
      await this.offlineStore.updateLastSyncTime(resourceType, new Date().toISOString());
    } catch (error) {
      logger.error(`Failed to pull ${resourceType} resources:`, error);
      throw error;
    }
  }

  /**
   * Process push response and handle conflicts
   */
  private async processPushResponse(
    response: Bundle,
    originalResources: any[],
    strategy: SyncStrategy,
    details: SyncDetails
  ): Promise<void> {
    if (!response.entry) return;

    for (let i = 0; i < response.entry.length; i++) {
      const entry = response.entry[i];
      const originalResource = originalResources[i];

      if (entry.response?.status?.startsWith('2')) {
        // Success
        if (entry.response.status === '201') {
          details.created.push(originalResource.id);
        } else {
          details.updated.push(originalResource.id);
        }

        // Update sync status
        await this.offlineStore.updateSyncStatus(
          originalResource.resourceType,
          originalResource.id,
          'synced'
        );
      } else if (entry.response?.status === '409') {
        // Conflict detected
        details.conflicted.push(originalResource.id);
        await this.handleConflict(originalResource, entry.resource, strategy);
      } else {
        // Error
        const error = this.extractErrorMessage(entry);
        details.errors.push({
          resourceId: originalResource.id,
          error
        });

        // Add to retry queue if within retry limit
        if (originalResource.attempts < strategy.retryPolicy.maxAttempts) {
          this.addToQueue({
            id: crypto.randomUUID(),
            resourceType: originalResource.resourceType,
            resourceId: originalResource.id,
            operation: 'update',
            priority: strategy.priority,
            attempts: originalResource.attempts + 1,
            lastAttempt: new Date().toISOString(),
            error
          });
        }
      }
    }
  }

  /**
   * Process pulled resources and detect conflicts
   */
  private async processPullBundle(
    bundle: Bundle,
    strategy: SyncStrategy,
    details: SyncDetails
  ): Promise<void> {
    if (!bundle.entry) return;

    for (const entry of bundle.entry) {
      if (!entry.resource) continue;

      const resource = entry.resource;
      const existingEncrypted = await this.offlineStore.getResource(
        resource.resourceType,
        resource.id!
      );

      if (existingEncrypted) {
        // Check for conflicts
        const existing = await this.offlineStore.decryptResource(existingEncrypted);
        
        if (this.isConflict(existing, resource)) {
          details.conflicted.push(resource.id!);
          await this.handleConflict(existing, resource, strategy);
        } else {
          // Update local version
          await this.offlineStore.updateResource(resource);
          details.updated.push(resource.id!);
        }
      } else {
        // New resource
        await this.offlineStore.storeResource(resource);
        details.created.push(resource.id!);
      }
    }
  }

  /**
   * Detect if there's a conflict between local and remote versions
   */
  private isConflict(local: Resource, remote: Resource): boolean {
    // Check version mismatch
    if (local.meta?.versionId && remote.meta?.versionId) {
      return local.meta.versionId !== remote.meta.versionId;
    }

    // Check last modified timestamps
    if (local.meta?.lastUpdated && remote.meta?.lastUpdated) {
      const localTime = new Date(local.meta.lastUpdated).getTime();
      const remoteTime = new Date(remote.meta.lastUpdated).getTime();
      
      // If both were modified after last sync, it's a conflict
      return Math.abs(localTime - remoteTime) > 1000; // 1 second tolerance
    }

    return false;
  }

  /**
   * Handle conflict between local and remote resources
   */
  private async handleConflict(
    local: Resource,
    remote: Resource,
    strategy: SyncStrategy
  ): Promise<void> {
    const conflict: Conflict = {
      id: crypto.randomUUID(),
      resourceType: local.resourceType,
      resourceId: local.id!,
      localVersion: {
        version: parseInt(local.meta?.versionId || '1'),
        timestamp: local.meta?.lastUpdated || new Date().toISOString(),
        hash: await this.calculateHash(local),
        author: 'local',
        changes: {} // Would be calculated in production
      },
      remoteVersion: {
        version: parseInt(remote.meta?.versionId || '1'),
        timestamp: remote.meta?.lastUpdated || new Date().toISOString(),
        hash: await this.calculateHash(remote),
        author: 'server',
        changes: {} // Would be calculated in production
      },
      detectedAt: new Date().toISOString(),
      status: 'pending'
    };

    // Apply conflict resolution strategy
    const resolution = await this.conflictResolver.resolve(
      conflict,
      local,
      remote,
      strategy.conflictResolution
    );

    if (resolution) {
      await this.applyResolution(conflict, resolution);
    } else {
      // Add to conflict queue for manual resolution
      await this.offlineStore.addConflict(conflict);
    }
  }

  /**
   * Apply conflict resolution
   */
  private async applyResolution(conflict: Conflict, resolution: Resolution): Promise<void> {
    conflict.resolution = resolution;
    conflict.status = 'resolved';

    switch (resolution.action) {
      case 'keep_local':
        // Re-queue local version for sync
        this.addToQueue({
          id: crypto.randomUUID(),
          resourceType: conflict.resourceType,
          resourceId: conflict.resourceId,
          operation: 'update',
          priority: 1, // High priority
          attempts: 0
        });
        break;

      case 'keep_remote':
        // Update local with remote version
        const remote = resolution.result as Resource;
        await this.offlineStore.updateResource(remote);
        break;

      case 'merge':
        // Store merged version and queue for sync
        const merged = resolution.result as Resource;
        await this.offlineStore.updateResource(merged);
        this.addToQueue({
          id: crypto.randomUUID(),
          resourceType: conflict.resourceType,
          resourceId: conflict.resourceId,
          operation: 'update',
          priority: 1,
          attempts: 0
        });
        break;

      case 'keep_both':
        // Create new resource for one version
        const resources = resolution.result as Resource[];
        for (const resource of resources) {
          if (resource.id === conflict.resourceId) {
            await this.offlineStore.updateResource(resource);
          } else {
            // Create new resource
            delete resource.id; // Remove ID to create new
            await this.offlineStore.storeResource(resource);
            this.addToQueue({
              id: crypto.randomUUID(),
              resourceType: resource.resourceType,
              resourceId: resource.id!,
              operation: 'create',
              priority: 1,
              attempts: 0
            });
          }
        }
        break;
    }

    // Update conflict log
    await this.offlineStore.updateConflict(conflict);
  }

  /**
   * Process sync queue
   */
  private async processQueue(): Promise<void> {
    const itemsToProcess = [...this.syncQueue.pending];
    this.syncQueue.pending = [];
    this.syncQueue.processing = itemsToProcess;

    for (const item of itemsToProcess) {
      try {
        await this.processSyncQueueItem(item);
      } catch (error) {
        logger.error(`Failed to process queue item ${item.id}:`, error);
        
        item.attempts++;
        item.lastAttempt = new Date().toISOString();
        item.error = error instanceof Error ? error.message : 'Unknown error';

        // Check retry limit
        const strategy = this.syncStrategies.get(item.resourceType);
        if (strategy && item.attempts < strategy.retryPolicy.maxAttempts) {
          // Calculate backoff
          const backoffMs = Math.min(
            Math.pow(strategy.retryPolicy.backoffMultiplier, item.attempts) * 1000,
            strategy.retryPolicy.maxBackoffSeconds * 1000
          );

          // Re-queue with delay
          setTimeout(() => {
            this.syncQueue.pending.push(item);
          }, backoffMs);
        } else {
          // Move to failed queue
          this.syncQueue.failed.push(item);
        }
      }
    }

    this.syncQueue.processing = [];
  }

  /**
   * Process individual sync queue item
   */
  private async processSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const encryptedResource = await this.offlineStore.getResource(
      item.resourceType,
      item.resourceId
    );

    if (!encryptedResource) {
      throw new Error(`Resource not found: ${item.resourceType}/${item.resourceId}`);
    }

    const resource = await this.offlineStore.decryptResource(encryptedResource);

    switch (item.operation) {
      case 'create':
        await this.medplumClient.createResource(resource);
        break;
      case 'update':
        await this.medplumClient.updateResource(resource);
        break;
      case 'delete':
        await this.medplumClient.deleteResource(resource.resourceType as any, resource.id!);
        break;
    }

    // Update sync status
    await this.offlineStore.updateSyncStatus(item.resourceType, item.resourceId, 'synced');
  }

  /**
   * Add item to sync queue
   */
  addToQueue(item: SyncQueueItem): void {
    this.syncQueue.pending.push(item);
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    inProgress: boolean;
    queueSize: number;
    failedCount: number;
    processingCount: number;
  } {
    return {
      inProgress: this.syncInProgress,
      queueSize: this.syncQueue.pending.length,
      failedCount: this.syncQueue.failed.length,
      processingCount: this.syncQueue.processing.length
    };
  }

  /**
   * Get conflict queue
   */
  async getConflictQueue(): Promise<Conflict[]> {
    return this.offlineStore.getActiveConflicts();
  }

  /**
   * Force sync specific resource
   */
  async syncResource(resourceType: string, resourceId: string): Promise<void> {
    const strategy = this.syncStrategies.get(resourceType);
    if (!strategy) {
      throw new Error(`No sync strategy defined for ${resourceType}`);
    }

    const encryptedResource = await this.offlineStore.getResource(resourceType, resourceId);
    if (!encryptedResource) {
      throw new Error(`Resource not found: ${resourceType}/${resourceId}`);
    }

    const resource = await this.offlineStore.decryptResource(encryptedResource);
    
    try {
      if (resource.id) {
        await this.medplumClient.updateResource(resource);
      } else {
        await this.medplumClient.createResource(resource);
      }

      await this.offlineStore.updateSyncStatus(resourceType, resourceId, 'synced');
    } catch (error) {
      if (this.isConflictError(error)) {
        // Fetch remote version and handle conflict
        const remote = await this.medplumClient.readResource(resourceType as any, resourceId);
        await this.handleConflict(resource, remote, strategy);
      } else {
        throw error;
      }
    }
  }

  /**
   * Calculate hash for resource comparison
   */
  private async calculateHash(resource: Resource): Promise<string> {
    const data = JSON.stringify(resource);
    const encoded = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Extract error message from bundle entry
   */
  private extractErrorMessage(entry: any): string {
    if (entry.resource?.resourceType === 'OperationOutcome') {
      const outcome = entry.resource as OperationOutcome;
      return outcome.issue?.[0]?.diagnostics || 'Unknown error';
    }
    return entry.response?.outcome?.issue?.[0]?.diagnostics || 'Unknown error';
  }

  /**
   * Check if error is a conflict error
   */
  private isConflictError(error: any): boolean {
    return error?.response?.status === 409 || 
           error?.message?.includes('conflict') ||
           error?.message?.includes('version mismatch');
  }
}