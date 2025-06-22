import { Resource } from '@medplum/fhirtypes';
import {
  EncryptedResource,
  LocalFHIRStore,
  Conflict,
  ResourceVersion,
  ConflictLog,
  CacheMetadata,
  AccessLogEntry
} from '../../types/offline.types';

/**
 * Offline Data Store Service Interface
 * Defines the contract for offline storage implementations
 */
export abstract class OfflineDataStore {
  /**
   * Get store for specific resource type
   */
  abstract getStore(resourceType: string): LocalFHIRStore<any>;

  /**
   * Store a resource (encrypted)
   */
  abstract storeResource(resource: Resource): Promise<void>;

  /**
   * Get a resource by type and ID
   */
  abstract getResource(resourceType: string, id: string): Promise<EncryptedResource | null>;

  /**
   * Update a resource
   */
  abstract updateResource(resource: Resource): Promise<void>;

  /**
   * Delete a resource
   */
  abstract deleteResource(resourceType: string, id: string): Promise<void>;

  /**
   * Decrypt a resource
   */
  abstract decryptResource<T extends Resource>(encrypted: EncryptedResource<T>): Promise<T>;

  /**
   * Update sync status
   */
  abstract updateSyncStatus(
    resourceType: string,
    resourceId: string,
    status: 'pending' | 'synced' | 'conflict' | 'failed'
  ): Promise<void>;

  /**
   * Get last sync time for resource type
   */
  abstract getLastSyncTime(resourceType: string): Promise<string>;

  /**
   * Update last sync time
   */
  abstract updateLastSyncTime(resourceType: string, timestamp: string): Promise<void>;

  /**
   * Get resource versions
   */
  abstract getResourceVersions(resourceType: string, id: string): Promise<ResourceVersion[]>;

  /**
   * Add conflict
   */
  abstract addConflict(conflict: Conflict): Promise<void>;

  /**
   * Get active conflicts
   */
  abstract getActiveConflicts(): Promise<Conflict[]>;

  /**
   * Get specific conflict
   */
  abstract getConflict(conflictId: string): Promise<Conflict | null>;

  /**
   * Update conflict
   */
  abstract updateConflict(conflict: Conflict): Promise<void>;

  /**
   * Get remote resource (for conflict resolution)
   */
  abstract getRemoteResource(resourceType: string, id: string): Promise<Resource | null>;

  /**
   * Get cache metadata
   */
  abstract getCacheMetadata(): Promise<CacheMetadata>;

  /**
   * Clear cache for resource type
   */
  abstract clearCache(resourceType?: string): Promise<void>;

  /**
   * Log access
   */
  abstract logAccess(entry: AccessLogEntry): Promise<void>;

  /**
   * Search resources
   */
  abstract searchResources(
    resourceType: string,
    searchParams: Record<string, any>
  ): Promise<EncryptedResource[]>;

  /**
   * Get storage size
   */
  abstract getStorageSize(): Promise<number>;

  /**
   * Optimize storage
   */
  abstract optimizeStorage(): Promise<void>;
}