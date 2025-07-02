import {
  Resource,
  Bundle,
  Patient,
  Encounter,
  Observation,
  MedicationRequest,
  ServiceRequest,
  DiagnosticReport,
  CarePlan,
  OperationOutcome,
  Meta,
  Extension
} from '@medplum/fhirtypes';
import { fhirService } from './fhir.service';
import { getErrorMessage } from '@/utils/error.utils';

// ===============================
// TYPES AND INTERFACES
// ===============================

export interface SyncQueueItem {
  id: string;
  resourceType: string;
  resourceId: string;
  operation: 'create' | 'update' | 'delete';
  resource?: Resource;
  localVersion: number;
  remoteVersion?: number;
  attempts: number;
  maxAttempts: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  error?: string;
  conflictResolution?: ConflictResolutionStrategy;
  metadata?: Record<string, any>;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  pendingChanges: number;
  failedChanges: number;
  conflictedChanges: number;
  syncProgress?: SyncProgress;
  errors: SyncError[];
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percentage: number;
  currentResource?: string;
  estimatedTimeRemaining?: number;
}

export interface SyncError {
  id: string;
  resourceType: string;
  resourceId: string;
  operation: string;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

export interface SyncConflict {
  id: string;
  resourceType: string;
  resourceId: string;
  localResource: Resource;
  remoteResource: Resource;
  localVersion: number;
  remoteVersion: number;
  detectedAt: Date;
  resolution?: ConflictResolution;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  winningResource: Resource;
  mergedResource?: Resource;
  reason?: string;
}

export type ConflictResolutionStrategy = 
  | 'local-wins'
  | 'remote-wins'
  | 'last-write-wins'
  | 'merge'
  | 'manual'
  | 'custom';

export interface SyncOptions {
  batchSize?: number;
  retryDelay?: number;
  maxRetries?: number;
  conflictResolution?: ConflictResolutionStrategy;
  resourceTypes?: string[];
  direction?: 'push' | 'pull' | 'bidirectional';
  since?: Date;
  progressCallback?: (progress: SyncProgress) => void;
  errorCallback?: (error: SyncError) => void;
}

export interface ResourceVersion {
  resourceType: string;
  resourceId: string;
  version: number;
  lastModified: Date;
  checksum: string;
  changeVector?: string[];
}

export interface SyncMetadata {
  lastSyncTimestamp?: Date;
  syncToken?: string;
  resourceVersions: Map<string, ResourceVersion>;
  pendingOperations: SyncQueueItem[];
  conflicts: SyncConflict[];
}

// ===============================
// CONSTANTS
// ===============================

const SYNC_DB_NAME = 'omnicare-sync-db';
const SYNC_DB_VERSION = 1;
const SYNC_QUEUE_STORE = 'sync-queue';
const RESOURCE_STORE = 'resources';
const VERSION_STORE = 'versions';
const CONFLICT_STORE = 'conflicts';
const METADATA_STORE = 'metadata';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_RETRY_DELAY = 5000; // 5 seconds
const DEFAULT_MAX_RETRIES = 3;
const SYNC_INTERVAL = 30000; // 30 seconds
const CONFLICT_CHECK_INTERVAL = 60000; // 1 minute

// Priority weights for sync queue
const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 1000,
  high: 100,
  medium: 10,
  low: 1
};

// Resource type priorities
const RESOURCE_TYPE_PRIORITIES: Record<string, number> = {
  Patient: 100,
  Practitioner: 90,
  Organization: 85,
  Encounter: 80,
  Observation: 70,
  MedicationRequest: 75,
  ServiceRequest: 65,
  DiagnosticReport: 60,
  CarePlan: 55
};

/**
 * Offline Data Synchronization Service
 * Provides robust offline-first data synchronization with conflict resolution
 * for FHIR resources in the OmniCare EMR system
 */
export class OfflineSyncService {
  private db?: IDBDatabase;
  private syncTimer?: NodeJS.Timeout;
  private conflictCheckTimer?: NodeJS.Timeout;
  private status: SyncStatus;
  private activeSync?: Promise<void>;
  private onlineStatusHandler?: (event: Event) => void;
  private syncEventHandlers: Map<string, (event: any) => void> = new Map();
  private static instance: OfflineSyncService | null = null;
  private isInitialized = false;

  constructor() {
    this.status = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
      pendingChanges: 0,
      failedChanges: 0,
      conflictedChanges: 0,
      errors: []
    };

    // Don't initialize in constructor - wait for explicit initialization
    // This prevents module-level initialization in test environments
  }

  // ===============================
  // SINGLETON MANAGEMENT
  // ===============================

  /**
   * Get singleton instance of OfflineSyncService
   * Creates instance only on client-side
   */
  static getInstance(): OfflineSyncService {
    // Always check if we're on the server or in test environment first
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      // Return a no-op stub for SSR/tests that doesn't call constructor
      const stub = {
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
        ensureInitialized: () => Promise.resolve(),
        initialize: () => Promise.resolve()
      };
      // Return stub without going through constructor
      return stub as any;
    }

    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  // ===============================
  // INITIALIZATION
  // ===============================

  /**
   * Ensure the service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && typeof window !== 'undefined') {
      await this.initialize();
    }
  }

  /**
   * Initialize the offline sync service
   * Must be called explicitly to avoid module-level initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Extra check for server/test environments
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      return;
    }

    try {
      // Initialize IndexedDB
      await this.initializeDatabase();

      // Set up online/offline event listeners
      this.setupNetworkListeners();

      // Start background sync if online
      if (this.status.isOnline) {
        this.startBackgroundSync();
      }

      // Start conflict checking
      this.startConflictChecking();

      // Load initial status
      await this.updateSyncStatus();

      this.isInitialized = true;
      console.log('Offline sync service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline sync service:', error);
      throw error;
    }
  }

  /**
   * Initialize IndexedDB for offline storage
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sync queue store
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const syncQueueStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
          syncQueueStore.createIndex('resourceType', 'resourceType', { unique: false });
          syncQueueStore.createIndex('priority', 'priority', { unique: false });
          syncQueueStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create resource store
        if (!db.objectStoreNames.contains(RESOURCE_STORE)) {
          const resourceStore = db.createObjectStore(RESOURCE_STORE, { keyPath: 'id' });
          resourceStore.createIndex('resourceType', 'resourceType', { unique: false });
          resourceStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // Create version store
        if (!db.objectStoreNames.contains(VERSION_STORE)) {
          const versionStore = db.createObjectStore(VERSION_STORE, { 
            keyPath: ['resourceType', 'resourceId'] 
          });
          versionStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // Create conflict store
        if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
          const conflictStore = db.createObjectStore(CONFLICT_STORE, { keyPath: 'id' });
          conflictStore.createIndex('resourceType', 'resourceType', { unique: false });
          conflictStore.createIndex('detectedAt', 'detectedAt', { unique: false });
          conflictStore.createIndex('resolved', 'resolvedAt', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    // Extra defensive check for SSR
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Wrap everything in a try-catch for extra safety
    try {
      this.onlineStatusHandler = (event: Event) => {
        const wasOnline = this.status.isOnline;
        this.status.isOnline = navigator.onLine;

        if (!wasOnline && this.status.isOnline) {
          console.log('Network connection restored, starting sync...');
          this.startBackgroundSync();
          this.sync(); // Immediate sync on reconnection
        } else if (wasOnline && !this.status.isOnline) {
          console.log('Network connection lost, stopping sync...');
          this.stopBackgroundSync();
        }

        this.emitSyncEvent('network-status-changed', { isOnline: this.status.isOnline });
      };

      window.addEventListener('online', this.onlineStatusHandler);
      window.addEventListener('offline', this.onlineStatusHandler);
    } catch (error) {
      // Silently fail during SSR
      console.warn('Failed to setup network listeners:', error);
    }
  }

  // ===============================
  // SYNC OPERATIONS
  // ===============================

  /**
   * Perform a full synchronization
   */
  async sync(options: SyncOptions = {}): Promise<void> {
    await this.ensureInitialized();

    if (this.activeSync) {
      console.log('Sync already in progress, waiting...');
      return this.activeSync;
    }

    if (!this.status.isOnline && options.direction !== 'push') {
      throw new Error('Cannot sync while offline');
    }

    this.activeSync = this.performSync(options);
    
    try {
      await this.activeSync;
    } finally {
      this.activeSync = undefined;
    }
  }

  /**
   * Perform the actual synchronization
   */
  private async performSync(options: SyncOptions): Promise<void> {
    console.log('Starting synchronization...');
    this.status.isSyncing = true;
    this.emitSyncEvent('sync-started', { options });

    const startTime = Date.now();
    const progress: SyncProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      percentage: 0
    };

    try {
      // Get pending operations from queue
      const pendingOperations = await this.getPendingOperations(options);
      progress.total = pendingOperations.length;

      // Process operations in batches
      const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
      for (let i = 0; i < pendingOperations.length; i += batchSize) {
        const batch = pendingOperations.slice(i, i + batchSize);
        
        await this.processSyncBatch(batch, progress, options);
        
        // Update progress
        progress.percentage = Math.round((progress.completed + progress.failed) / progress.total * 100);
        progress.estimatedTimeRemaining = this.estimateTimeRemaining(
          startTime,
          progress.completed + progress.failed,
          progress.total
        );

        if (options.progressCallback) {
          options.progressCallback(progress);
        }

        this.emitSyncEvent('sync-progress', { progress });
      }

      // Handle bidirectional sync
      if (options.direction === 'bidirectional' || options.direction === 'pull') {
        await this.pullRemoteChanges(options);
      }

      // Check for conflicts
      await this.checkForConflicts();

      // Update sync metadata
      await this.updateSyncMetadata();

      this.status.lastSyncAt = new Date();
      console.log('Synchronization completed successfully');
      this.emitSyncEvent('sync-completed', { duration: Date.now() - startTime });

    } catch (error) {
      console.error('Synchronization failed:', error);
      this.emitSyncEvent('sync-failed', { error: getErrorMessage(error) });
      throw error;
    } finally {
      this.status.isSyncing = false;
      await this.updateSyncStatus();
    }
  }

  /**
   * Process a batch of sync operations
   */
  private async processSyncBatch(
    batch: SyncQueueItem[],
    progress: SyncProgress,
    options: SyncOptions
  ): Promise<void> {
    const promises = batch.map(async (item) => {
      try {
        progress.inProgress++;
        progress.currentResource = `${item.resourceType}/${item.resourceId}`;

        await this.processSyncItem(item, options);
        
        // Remove from queue on success
        await this.removeFromQueue(item.id);
        
        progress.completed++;
      } catch (error) {
        progress.failed++;
        
        // Handle retry logic
        if (item.attempts < item.maxAttempts) {
          item.attempts++;
          item.lastAttemptAt = new Date();
          item.nextRetryAt = new Date(Date.now() + (options.retryDelay || DEFAULT_RETRY_DELAY));
          item.error = getErrorMessage(error);
          
          await this.updateQueueItem(item);
        } else {
          // Max retries reached, move to failed state
          await this.handleSyncFailure(item, error);
        }

        if (options.errorCallback) {
          options.errorCallback({
            id: item.id,
            resourceType: item.resourceType,
            resourceId: item.resourceId,
            operation: item.operation,
            error: getErrorMessage(error),
            timestamp: new Date(),
            retryable: item.attempts < item.maxAttempts
          });
        }
      } finally {
        progress.inProgress--;
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Process a single sync item
   */
  private async processSyncItem(item: SyncQueueItem, options: SyncOptions): Promise<void> {
    switch (item.operation) {
      case 'create':
        if (!item.resource) throw new Error('Resource data missing for create operation');
        await fhirService.createResource(item.resource);
        break;

      case 'update':
        if (!item.resource) throw new Error('Resource data missing for update operation');
        
        // Check for conflicts before updating
        const remoteResource = await this.fetchRemoteResource(item.resourceType, item.resourceId);
        if (remoteResource && this.hasConflict(item, remoteResource)) {
          await this.handleConflict(item, remoteResource, options);
        } else {
          await fhirService.updateResource(item.resource);
        }
        break;

      case 'delete':
        await fhirService.deleteResource(item.resourceType, item.resourceId);
        break;

      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }

    // Update local version tracking
    await this.updateResourceVersion(item.resourceType, item.resourceId, item.localVersion);
  }

  /**
   * Pull remote changes
   */
  private async pullRemoteChanges(options: SyncOptions): Promise<void> {
    const lastSync = await this.getLastSyncTimestamp();
    const resourceTypes = options.resourceTypes || Object.keys(RESOURCE_TYPE_PRIORITIES);

    for (const resourceType of resourceTypes) {
      try {
        // Get remote changes since last sync
        const bundle = await fhirService.searchResources(resourceType, {
          _lastUpdated: lastSync ? `gt${lastSync.toISOString()}` : undefined,
          _sort: '_lastUpdated'
        });

        if (bundle.entry && bundle.entry.length > 0) {
          await this.processRemoteChanges(bundle.entry.map(e => e.resource!), options);
        }
      } catch (error) {
        console.error(`Failed to pull ${resourceType} changes:`, error);
      }
    }
  }

  /**
   * Process remote changes
   */
  private async processRemoteChanges(resources: Resource[], options: SyncOptions): Promise<void> {
    for (const resource of resources) {
      try {
        const localResource = await this.getLocalResource(resource.resourceType, resource.id!);
        
        if (!localResource) {
          // New resource from remote
          await this.saveLocalResource(resource);
        } else {
          // Check for conflicts
          const localVersion = await this.getResourceVersion(resource.resourceType, resource.id!);
          const remoteVersion = this.extractVersion(resource);

          if (localVersion && localVersion.version !== remoteVersion) {
            // Conflict detected
            await this.createConflict(localResource, resource);
          } else {
            // No conflict, update local
            await this.saveLocalResource(resource);
          }
        }
      } catch (error) {
        console.error(`Failed to process remote resource ${resource.resourceType}/${resource.id}:`, error);
      }
    }
  }

  // ===============================
  // CONFLICT RESOLUTION
  // ===============================

  /**
   * Check if there's a conflict between local and remote resources
   */
  private hasConflict(item: SyncQueueItem, remoteResource: Resource): boolean {
    const remoteVersion = this.extractVersion(remoteResource);
    return item.remoteVersion !== undefined && item.remoteVersion !== remoteVersion;
  }

  /**
   * Handle a sync conflict
   */
  private async handleConflict(
    item: SyncQueueItem,
    remoteResource: Resource,
    options: SyncOptions
  ): Promise<void> {
    const strategy = item.conflictResolution || options.conflictResolution || 'last-write-wins';
    const localResource = item.resource!;

    let resolution: ConflictResolution;

    switch (strategy) {
      case 'local-wins':
        resolution = {
          strategy,
          winningResource: localResource,
          reason: 'Local changes take precedence'
        };
        break;

      case 'remote-wins':
        resolution = {
          strategy,
          winningResource: remoteResource,
          reason: 'Remote changes take precedence'
        };
        break;

      case 'last-write-wins':
        const localLastModified = this.extractLastModified(localResource);
        const remoteLastModified = this.extractLastModified(remoteResource);
        
        if (localLastModified > remoteLastModified) {
          resolution = {
            strategy,
            winningResource: localResource,
            reason: 'Local resource is newer'
          };
        } else {
          resolution = {
            strategy,
            winningResource: remoteResource,
            reason: 'Remote resource is newer'
          };
        }
        break;

      case 'merge':
        const mergedResource = await this.mergeResources(localResource, remoteResource);
        resolution = {
          strategy,
          winningResource: mergedResource,
          mergedResource,
          reason: 'Resources merged'
        };
        break;

      case 'manual':
        // Create conflict for manual resolution
        await this.createConflict(localResource, remoteResource);
        throw new Error('Manual conflict resolution required');

      case 'custom':
        // Allow for custom conflict resolution logic
        resolution = await this.customConflictResolution(localResource, remoteResource);
        break;

      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }

    // Apply resolution
    if (resolution.winningResource === localResource) {
      // Force update with local version
      await fhirService.updateResource(localResource);
    } else {
      // Accept remote version
      await this.saveLocalResource(resolution.winningResource);
      // Remove from sync queue as remote wins
      await this.removeFromQueue(item.id);
    }

    // Record conflict resolution
    await this.recordConflictResolution({
      id: `conflict-${Date.now()}`,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      localResource,
      remoteResource,
      localVersion: item.localVersion,
      remoteVersion: this.extractVersion(remoteResource),
      detectedAt: new Date(),
      resolution,
      resolvedAt: new Date()
    });
  }

  /**
   * Merge two resources
   */
  private async mergeResources(local: Resource, remote: Resource): Promise<Resource> {
    // Deep clone the remote resource as base
    const merged = JSON.parse(JSON.stringify(remote)) as Resource;

    // Resource-specific merge strategies
    switch (local.resourceType) {
      case 'Patient':
        return this.mergePatientResources(local as Patient, remote as Patient);
      
      case 'Observation':
        return this.mergeObservationResources(local as Observation, remote as Observation);
      
      case 'MedicationRequest':
        return this.mergeMedicationRequestResources(local as MedicationRequest, remote as MedicationRequest);
      
      default:
        // Generic merge: prefer local for user-editable fields
        // This is a simplified merge - in production, you'd want more sophisticated logic
        if (local.meta?.lastUpdated && remote.meta?.lastUpdated) {
          const localDate = new Date(local.meta.lastUpdated);
          const remoteDate = new Date(remote.meta.lastUpdated);
          
          // If local is newer, keep local changes
          if (localDate > remoteDate) {
            Object.assign(merged, local);
            merged.meta = remote.meta; // Keep remote meta for version tracking
          }
        }
        
        return merged;
    }
  }

  /**
   * Merge Patient resources
   */
  private mergePatientResources(local: Patient, remote: Patient): Patient {
    const merged = { ...remote };

    // Merge name - prefer most complete
    if (local.name && remote.name) {
      merged.name = [...local.name, ...remote.name].filter((name, index, self) =>
        index === self.findIndex(n => 
          n.given?.join(' ') === name.given?.join(' ') && 
          n.family === name.family
        )
      );
    }

    // Merge telecom - combine and deduplicate
    if (local.telecom && remote.telecom) {
      merged.telecom = [...local.telecom, ...remote.telecom].filter((telecom, index, self) =>
        index === self.findIndex(t => 
          t.system === telecom.system && 
          t.value === telecom.value
        )
      );
    }

    // Merge addresses - combine unique addresses
    if (local.address && remote.address) {
      merged.address = [...local.address, ...remote.address].filter((address, index, self) =>
        index === self.findIndex(a => 
          a.line?.join(' ') === address.line?.join(' ') &&
          a.city === address.city &&
          a.state === address.state &&
          a.postalCode === address.postalCode
        )
      );
    }

    // Add merge metadata
    merged.meta = merged.meta || {};
    merged.meta.extension = merged.meta.extension || [];
    merged.meta.extension.push({
      url: 'http://omnicare.com/fhir/StructureDefinition/merge-info',
      valueString: `Merged from conflict at ${new Date().toISOString()}`
    });

    return merged;
  }

  /**
   * Merge Observation resources
   */
  private mergeObservationResources(local: Observation, remote: Observation): Observation {
    const merged = { ...remote };

    // For observations, prefer the most recent value
    const localDate = new Date(local.effectiveDateTime || local.meta?.lastUpdated || 0);
    const remoteDate = new Date(remote.effectiveDateTime || remote.meta?.lastUpdated || 0);

    if (localDate > remoteDate) {
      // Keep local value but remote metadata
      merged.valueQuantity = local.valueQuantity;
      merged.valueCodeableConcept = local.valueCodeableConcept;
      merged.valueString = local.valueString;
      merged.valueBoolean = local.valueBoolean;
      merged.effectiveDateTime = local.effectiveDateTime;
    }

    return merged;
  }

  /**
   * Merge MedicationRequest resources
   */
  private mergeMedicationRequestResources(local: MedicationRequest, remote: MedicationRequest): MedicationRequest {
    const merged = { ...remote };

    // For medication requests, check status and prefer active/completed over cancelled
    const statusPriority: Record<string, number> = {
      'active': 4,
      'completed': 3,
      'on-hold': 2,
      'cancelled': 1,
      'draft': 0
    };

    const localPriority = statusPriority[local.status] || 0;
    const remotePriority = statusPriority[remote.status] || 0;

    if (localPriority > remotePriority) {
      merged.status = local.status;
      merged.statusReason = local.statusReason;
    }

    // Merge dosage instructions - combine if different
    if (local.dosageInstruction && remote.dosageInstruction) {
      const combinedDosage = [...local.dosageInstruction, ...remote.dosageInstruction];
      merged.dosageInstruction = combinedDosage.filter((dosage, index, self) =>
        index === self.findIndex(d => 
          JSON.stringify(d) === JSON.stringify(dosage)
        )
      );
    }

    return merged;
  }

  /**
   * Custom conflict resolution (can be overridden)
   */
  protected async customConflictResolution(local: Resource, remote: Resource): Promise<ConflictResolution> {
    // Default implementation - can be overridden by extending class
    return {
      strategy: 'custom',
      winningResource: local,
      reason: 'Custom resolution defaulted to local'
    };
  }

  /**
   * Check for conflicts periodically
   */
  private async checkForConflicts(): Promise<void> {
    const pendingOperations = await this.getPendingOperations();
    const updateOperations = pendingOperations.filter(op => op.operation === 'update');
    
    for (const operation of updateOperations) {
      try {
        const remoteResource = await this.fetchRemoteResource(
          operation.resourceType,
          operation.resourceId
        );

        if (remoteResource && this.hasConflict(operation, remoteResource)) {
          await this.createConflict(operation.resource!, remoteResource);
        }
      } catch (error) {
        console.error(`Failed to check conflict for ${operation.resourceType}/${operation.resourceId}:`, error);
      }
    }
  }

  /**
   * Create a conflict record
   */
  private async createConflict(localResource: Resource, remoteResource: Resource): Promise<void> {
    const conflict: SyncConflict = {
      id: `conflict-${localResource.resourceType}-${localResource.id}-${Date.now()}`,
      resourceType: localResource.resourceType,
      resourceId: localResource.id!,
      localResource,
      remoteResource,
      localVersion: this.extractVersion(localResource),
      remoteVersion: this.extractVersion(remoteResource),
      detectedAt: new Date()
    };

    await this.saveConflict(conflict);
    this.status.conflictedChanges++;
    
    this.emitSyncEvent('conflict-detected', { conflict });
  }

  // ===============================
  // QUEUE MANAGEMENT
  // ===============================

  /**
   * Add a resource operation to the sync queue
   */
  async queueOperation(
    operation: 'create' | 'update' | 'delete',
    resource: Resource,
    options: Partial<SyncQueueItem> = {}
  ): Promise<void> {
    await this.ensureInitialized();

    const queueItem: SyncQueueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resourceType: resource.resourceType,
      resourceId: resource.id || `temp-${Date.now()}`,
      operation,
      resource: operation !== 'delete' ? resource : undefined,
      localVersion: await this.getNextVersion(resource.resourceType, resource.id!),
      attempts: 0,
      maxAttempts: options.maxAttempts || DEFAULT_MAX_RETRIES,
      priority: options.priority || this.calculatePriority(resource),
      createdAt: new Date(),
      ...options
    };

    await this.addToQueue(queueItem);
    
    // Save resource locally
    if (operation !== 'delete') {
      await this.saveLocalResource(resource);
    }

    // Update status
    await this.updateSyncStatus();

    // Trigger immediate sync if online
    if (this.status.isOnline && !this.status.isSyncing) {
      this.sync().catch(console.error);
    }
  }

  /**
   * Calculate priority for a resource
   */
  private calculatePriority(resource: Resource): 'low' | 'medium' | 'high' | 'critical' {
    const typePriority = RESOURCE_TYPE_PRIORITIES[resource.resourceType] || 50;

    if (typePriority >= 90) return 'critical';
    if (typePriority >= 70) return 'high';
    if (typePriority >= 50) return 'medium';
    return 'low';
  }

  /**
   * Get pending operations from queue
   */
  private async getPendingOperations(options: Partial<SyncOptions> = {}): Promise<SyncQueueItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([SYNC_QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const items: SyncQueueItem[] = [];

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value;
          
          // Filter by options
          let include = true;
          
          if (options.resourceTypes && !options.resourceTypes.includes(item.resourceType)) {
            include = false;
          }
          
          if (options.since && new Date(item.createdAt) < options.since) {
            include = false;
          }
          
          if (item.nextRetryAt && new Date() < new Date(item.nextRetryAt)) {
            include = false;
          }
          
          if (include) {
            items.push(item);
          }
          
          cursor.continue();
        } else {
          // Sort by priority and creation date
          items.sort((a, b) => {
            const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          
          resolve(items);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to get pending operations'));
      };
    });
  }

  // ===============================
  // DATABASE OPERATIONS
  // ===============================

  /**
   * Add item to sync queue
   */
  private async addToQueue(item: SyncQueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([SYNC_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add to sync queue'));
    });
  }

  /**
   * Update queue item
   */
  private async updateQueueItem(item: SyncQueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([SYNC_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update queue item'));
    });
  }

  /**
   * Remove item from sync queue
   */
  private async removeFromQueue(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([SYNC_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove from sync queue'));
    });
  }

  /**
   * Save resource locally
   */
  private async saveLocalResource(resource: Resource): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([RESOURCE_STORE], 'readwrite');
      const store = transaction.objectStore(RESOURCE_STORE);
      
      const resourceWithId = {
        ...resource,
        id: `${resource.resourceType}/${resource.id}`,
        lastModified: new Date().toISOString()
      };
      
      const request = store.put(resourceWithId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save resource locally'));
    });
  }

  /**
   * Get local resource
   */
  private async getLocalResource(resourceType: string, resourceId: string): Promise<Resource | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([RESOURCE_STORE], 'readonly');
      const store = transaction.objectStore(RESOURCE_STORE);
      const request = store.get(`${resourceType}/${resourceId}`);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { id, lastModified, ...resource } = result;
          resolve(resource as Resource);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(new Error('Failed to get local resource'));
    });
  }

  /**
   * Save conflict
   */
  private async saveConflict(conflict: SyncConflict): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([CONFLICT_STORE], 'readwrite');
      const store = transaction.objectStore(CONFLICT_STORE);
      const request = store.add(conflict);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save conflict'));
    });
  }

  /**
   * Record conflict resolution
   */
  private async recordConflictResolution(conflict: SyncConflict): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([CONFLICT_STORE], 'readwrite');
      const store = transaction.objectStore(CONFLICT_STORE);
      const request = store.put(conflict);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to record conflict resolution'));
    });
  }

  // ===============================
  // VERSION MANAGEMENT
  // ===============================

  /**
   * Get resource version
   */
  private async getResourceVersion(resourceType: string, resourceId: string): Promise<ResourceVersion | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VERSION_STORE], 'readonly');
      const store = transaction.objectStore(VERSION_STORE);
      const request = store.get([resourceType, resourceId]);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get resource version'));
    });
  }

  /**
   * Update resource version
   */
  private async updateResourceVersion(
    resourceType: string,
    resourceId: string,
    version: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const versionInfo: ResourceVersion = {
        resourceType,
        resourceId,
        version,
        lastModified: new Date(),
        checksum: this.calculateChecksum({ resourceType, id: resourceId })
      };

      const transaction = this.db.transaction([VERSION_STORE], 'readwrite');
      const store = transaction.objectStore(VERSION_STORE);
      const request = store.put(versionInfo);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update resource version'));
    });
  }

  /**
   * Get next version number
   */
  private async getNextVersion(resourceType: string, resourceId: string): Promise<number> {
    const currentVersion = await this.getResourceVersion(resourceType, resourceId);
    return currentVersion ? currentVersion.version + 1 : 1;
  }

  /**
   * Extract version from resource
   */
  private extractVersion(resource: Resource): number {
    return parseInt(resource.meta?.versionId || '1', 10);
  }

  /**
   * Extract last modified date from resource
   */
  private extractLastModified(resource: Resource): Date {
    return new Date(resource.meta?.lastUpdated || 0);
  }

  /**
   * Calculate checksum for a resource
   */
  private calculateChecksum(resource: any): string {
    const str = JSON.stringify(resource);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  // ===============================
  // METADATA MANAGEMENT
  // ===============================

  /**
   * Get last sync timestamp
   */
  private async getLastSyncTimestamp(): Promise<Date | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get('lastSync');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? new Date(result.value) : null);
      };

      request.onerror = () => reject(new Error('Failed to get last sync timestamp'));
    });
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const metadata = {
        key: 'lastSync',
        value: new Date().toISOString()
      };

      const transaction = this.db.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update sync metadata'));
    });
  }

  // ===============================
  // STATUS AND MONITORING
  // ===============================

  /**
   * Update sync status
   */
  private async updateSyncStatus(): Promise<void> {
    const pendingOps = await this.getPendingOperations();
    const failedOps = pendingOps.filter(op => op.attempts >= op.maxAttempts);
    const conflicts = await this.getUnresolvedConflicts();

    this.status.pendingChanges = pendingOps.length - failedOps.length;
    this.status.failedChanges = failedOps.length;
    this.status.conflictedChanges = conflicts.length;

    this.emitSyncEvent('status-updated', { status: this.status });
  }

  /**
   * Get unresolved conflicts
   */
  private async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([CONFLICT_STORE], 'readonly');
      const store = transaction.objectStore(CONFLICT_STORE);
      const conflicts: SyncConflict[] = [];

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const conflict = cursor.value;
          if (!conflict.resolvedAt) {
            conflicts.push(conflict);
          }
          cursor.continue();
        } else {
          resolve(conflicts);
        }
      };

      request.onerror = () => reject(new Error('Failed to get unresolved conflicts'));
    });
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Get conflicts
   */
  async getConflicts(resolved: boolean = false): Promise<SyncConflict[]> {
    await this.ensureInitialized();
    const allConflicts = await this.getUnresolvedConflicts();
    
    if (resolved) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const transaction = this.db.transaction([CONFLICT_STORE], 'readonly');
        const store = transaction.objectStore(CONFLICT_STORE);
        const conflicts: SyncConflict[] = [];

        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const conflict = cursor.value;
            if (conflict.resolvedAt) {
              conflicts.push(conflict);
            }
            cursor.continue();
          } else {
            resolve(conflicts);
          }
        };

        request.onerror = () => reject(new Error('Failed to get resolved conflicts'));
      });
    }

    return allConflicts;
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    resolvedBy?: string
  ): Promise<void> {
    await this.ensureInitialized();
    const conflicts = await this.getUnresolvedConflicts();
    const conflict = conflicts.find(c => c.id === conflictId);

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    conflict.resolution = resolution;
    conflict.resolvedAt = new Date();
    conflict.resolvedBy = resolvedBy;

    await this.recordConflictResolution(conflict);

    // Apply resolution
    if (resolution.strategy !== 'manual') {
      await this.saveLocalResource(resolution.winningResource);
      
      // Queue sync if the local version won
      if (resolution.winningResource.id === conflict.localResource.id) {
        await this.queueOperation('update', resolution.winningResource);
      }
    }

    await this.updateSyncStatus();
    this.emitSyncEvent('conflict-resolved', { conflict });
  }

  // ===============================
  // BACKGROUND SYNC
  // ===============================

  /**
   * Start background sync
   */
  private startBackgroundSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (this.status.isOnline && !this.status.isSyncing) {
        this.sync().catch(console.error);
      }
    }, SYNC_INTERVAL);

    console.log('Background sync started');
  }

  /**
   * Stop background sync
   */
  private stopBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      console.log('Background sync stopped');
    }
  }

  /**
   * Start conflict checking
   */
  private startConflictChecking(): void {
    if (this.conflictCheckTimer) return;

    this.conflictCheckTimer = setInterval(() => {
      if (this.status.isOnline) {
        this.checkForConflicts().catch(console.error);
      }
    }, CONFLICT_CHECK_INTERVAL);
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Fetch remote resource
   */
  private async fetchRemoteResource(resourceType: string, resourceId: string): Promise<Resource | null> {
    try {
      return await fhirService.readResource(resourceType, resourceId);
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Handle sync failure
   */
  private async handleSyncFailure(item: SyncQueueItem, error: unknown): Promise<void> {
    const syncError: SyncError = {
      id: `error-${Date.now()}`,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      operation: item.operation,
      error: getErrorMessage(error),
      timestamp: new Date(),
      retryable: false
    };

    this.status.errors.push(syncError);

    // Keep only last 100 errors
    if (this.status.errors.length > 100) {
      this.status.errors = this.status.errors.slice(-100);
    }

    this.emitSyncEvent('sync-error', { error: syncError });
  }

  /**
   * Estimate time remaining
   */
  private estimateTimeRemaining(
    startTime: number,
    completed: number,
    total: number
  ): number {
    if (completed === 0) return 0;

    const elapsed = Date.now() - startTime;
    const rate = completed / elapsed;
    const remaining = total - completed;

    return remaining / rate;
  }

  /**
   * Emit sync event
   */
  private emitSyncEvent(eventType: string, data: any): void {
    const handlers = this.syncEventHandlers.get(eventType);
    if (handlers) {
      handlers(data);
    }

    // Also emit as custom event (only in browser)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`omnicare-sync-${eventType}`, { detail: data }));
    }
  }

  // ===============================
  // PUBLIC API
  // ===============================

  /**
   * Register event handler
   */
  on(eventType: string, handler: (data: any) => void): void {
    this.syncEventHandlers.set(eventType, handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType: string): void {
    this.syncEventHandlers.delete(eventType);
  }

  /**
   * Force sync now
   */
  async syncNow(options: SyncOptions = {}): Promise<void> {
    return this.sync(options);
  }

  /**
   * Clear all local data
   */
  async clearLocalData(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stores = [SYNC_QUEUE_STORE, RESOURCE_STORE, VERSION_STORE, CONFLICT_STORE, METADATA_STORE];
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
      });
    }

    await this.updateSyncStatus();
    console.log('Local data cleared');
  }

  /**
   * Export sync data
   */
  async exportSyncData(): Promise<SyncMetadata> {
    await this.ensureInitialized();
    const pendingOperations = await this.getPendingOperations();
    const conflicts = await this.getUnresolvedConflicts();
    const lastSync = await this.getLastSyncTimestamp();

    // Get all resource versions
    const resourceVersions = new Map<string, ResourceVersion>();
    
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VERSION_STORE], 'readonly');
      const store = transaction.objectStore(VERSION_STORE);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const version = cursor.value;
          resourceVersions.set(`${version.resourceType}/${version.resourceId}`, version);
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(new Error('Failed to export resource versions'));
    });

    return {
      lastSyncTimestamp: lastSync || undefined,
      resourceVersions,
      pendingOperations,
      conflicts
    };
  }

  /**
   * Import sync data
   */
  async importSyncData(data: SyncMetadata): Promise<void> {
    await this.ensureInitialized();
    // Clear existing data first
    await this.clearLocalData();

    // Import pending operations
    for (const operation of data.pendingOperations) {
      await this.addToQueue(operation);
    }

    // Import resource versions
    for (const [key, version] of data.resourceVersions) {
      await this.updateResourceVersion(
        version.resourceType,
        version.resourceId,
        version.version
      );
    }

    // Import conflicts
    for (const conflict of data.conflicts) {
      await this.saveConflict(conflict);
    }

    // Update metadata
    if (data.lastSyncTimestamp) {
      await new Promise<void>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const metadata = {
          key: 'lastSync',
          value: data.lastSyncTimestamp?.toISOString() || new Date().toISOString()
        };

        const transaction = this.db.transaction([METADATA_STORE], 'readwrite');
        const store = transaction.objectStore(METADATA_STORE);
        const request = store.put(metadata);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to import sync metadata'));
      });
    }

    await this.updateSyncStatus();
    console.log('Sync data imported successfully');
  }

  /**
   * Cleanup old data
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Clean up old sync errors
    this.status.errors = this.status.errors.filter(
      error => error.timestamp > cutoffDate
    );

    // Clean up resolved conflicts
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([CONFLICT_STORE], 'readwrite');
      const store = transaction.objectStore(CONFLICT_STORE);
      const index = store.index('resolved');
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const conflict = cursor.value;
          if (conflict.resolvedAt && new Date(conflict.resolvedAt) < cutoffDate) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(new Error('Failed to cleanup conflicts'));
    });

    console.log(`Cleaned up data older than ${daysToKeep} days`);
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy(): void {
    // Stop timers
    this.stopBackgroundSync();
    if (this.conflictCheckTimer) {
      clearInterval(this.conflictCheckTimer);
    }

    // Remove event listeners
    if (this.onlineStatusHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineStatusHandler);
      window.removeEventListener('offline', this.onlineStatusHandler);
    }

    // Close database
    if (this.db) {
      this.db.close();
    }

    console.log('Offline sync service destroyed');
  }
}

// Export getter function to defer instance creation
export const getOfflineSyncService = () => OfflineSyncService.getInstance();

// Don't export a singleton instance directly - use the wrapper instead
// Export for use in service worker
export default OfflineSyncService;