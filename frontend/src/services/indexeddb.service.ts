/**
 * IndexedDB Service for Offline FHIR Resource Storage
 * Provides secure, encrypted storage with FHIR-compatible querying
 */

import { Resource, Bundle, BundleEntry, OperationOutcome } from '@medplum/fhirtypes';
import { encryptionService, EncryptedData } from './encryption.service';
import {
  DB_NAME,
  DB_VERSION,
  OBJECT_STORES,
  StoredResource,
  SyncMetadata,
  SyncQueueEntry,
  ENCRYPTED_FIELDS,
  RETENTION_POLICIES,
  ObjectStoreConfig,
  EncryptionMetadata
} from './indexeddb.schemas';
import { getErrorMessage } from '@/utils/error.utils';

// Search parameters interface
export interface IndexedDBSearchParams {
  [key: string]: string | number | boolean | string[] | undefined;
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
  _summary?: boolean;
  _elements?: string[];
}

// Query result interface
export interface QueryResult<T extends Resource> {
  total: number;
  data: T[];
  hasMore: boolean;
  nextOffset?: number;
}

// Database error class
export class IndexedDBError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'IndexedDBError';
  }
}

/**
 * Main IndexedDB Service class
 */
export class IndexedDBService {
  private static instance: IndexedDBService;
  private db?: IDBDatabase;
  private syncInProgress = false;
  private encryptionEnabled = false;

  private constructor() {}

  static getInstance(): IndexedDBService {
    if (!IndexedDBService.instance) {
      IndexedDBService.instance = new IndexedDBService();
    }
    return IndexedDBService.instance;
  }

  /**
   * Initialize the database
   */
  async initialize(enableEncryption = true): Promise<void> {
    try {
      this.encryptionEnabled = enableEncryption;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          reject(new IndexedDBError('Failed to open database', 'DB_OPEN_FAILED', request.error));
        };

        request.onsuccess = () => {
          this.db = request.result;
          
          // Set up error handler
          this.db.onerror = (event) => {
            console.error('Database error:', event);
          };

          // Start cleanup process
          this.startCleanupScheduler();
          
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object stores
          OBJECT_STORES.forEach(config => {
            if (!db.objectStoreNames.contains(config.name)) {
              this.createObjectStore(db, config);
            }
          });
        };
      });
    } catch (error) {
      throw new IndexedDBError(
        `Failed to initialize database: ${getErrorMessage(error)}`,
        'INIT_FAILED'
      );
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return !!this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  /**
   * Clear all data (for testing or logout)
   */
  async clearAllData(): Promise<void> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    const transaction = this.db.transaction(Array.from(this.db.objectStoreNames), 'readwrite');
    
    const promises = Array.from(this.db.objectStoreNames).map(storeName => {
      return new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
  }

  // ===============================
  // CRUD Operations
  // ===============================

  /**
   * Create a new resource
   */
  async createResource<T extends Resource>(resource: T): Promise<T> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    const storeName = this.getStoreName(resource.resourceType);
    const storedResource = await this.prepareResourceForStorage(resource);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName, 'syncQueue'], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Check if resource already exists
      const getRequest = store.get(resource.id!);
      
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          reject(new IndexedDBError('Resource already exists', 'DUPLICATE_RESOURCE'));
          return;
        }

        // Add resource
        const addRequest = store.add(storedResource);
        
        addRequest.onsuccess = async () => {
          // Add to sync queue
          await this.addToSyncQueue(transaction, resource.id!, resource.resourceType, 'create', resource);
          resolve(resource);
        };

        addRequest.onerror = () => {
          reject(new IndexedDBError('Failed to create resource', 'CREATE_FAILED', addRequest.error));
        };
      };
    });
  }

  /**
   * Read a resource by ID
   */
  async readResource<T extends Resource>(resourceType: string, id: string): Promise<T | null> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    const storeName = this.getStoreName(resourceType);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = async () => {
        const storedResource = request.result as StoredResource<T>;
        
        if (!storedResource || storedResource.deletedAt) {
          resolve(null);
          return;
        }

        try {
          const resource = await this.extractResourceFromStorage(storedResource);
          resolve(resource);
        } catch (error) {
          reject(new IndexedDBError('Failed to decrypt resource', 'DECRYPT_FAILED', error));
        }
      };

      request.onerror = () => {
        reject(new IndexedDBError('Failed to read resource', 'READ_FAILED', request.error));
      };
    });
  }

  /**
   * Update an existing resource
   */
  async updateResource<T extends Resource>(resource: T): Promise<T> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');
    if (!resource.id) throw new IndexedDBError('Resource must have an ID', 'INVALID_RESOURCE');

    const storeName = this.getStoreName(resource.resourceType);

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction([storeName, 'syncQueue'], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Get existing resource for version check
      const getRequest = store.get(resource.id);

      getRequest.onsuccess = async () => {
        const existing = getRequest.result as StoredResource<T>;
        
        if (!existing || existing.deletedAt) {
          reject(new IndexedDBError('Resource not found', 'NOT_FOUND'));
          return;
        }

        // Prepare updated resource
        const storedResource = await this.prepareResourceForStorage(resource, existing);

        // Update resource
        const putRequest = store.put(storedResource);

        putRequest.onsuccess = async () => {
          // Add to sync queue
          await this.addToSyncQueue(transaction, resource.id!, resource.resourceType, 'update', resource);
          resolve(resource);
        };

        putRequest.onerror = () => {
          reject(new IndexedDBError('Failed to update resource', 'UPDATE_FAILED', putRequest.error));
        };
      };

      getRequest.onerror = () => {
        reject(new IndexedDBError('Failed to get resource', 'READ_FAILED', getRequest.error));
      };
    });
  }

  /**
   * Delete a resource (soft delete)
   */
  async deleteResource(resourceType: string, id: string): Promise<void> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    const storeName = this.getStoreName(resourceType);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName, 'syncQueue'], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Get existing resource
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as StoredResource;
        
        if (!existing || existing.deletedAt) {
          resolve(); // Already deleted
          return;
        }

        // Soft delete
        existing.deletedAt = Date.now();
        existing.syncMetadata.syncStatus = 'pending';

        const putRequest = store.put(existing);

        putRequest.onsuccess = async () => {
          // Add to sync queue
          await this.addToSyncQueue(transaction, id, resourceType, 'delete');
          resolve();
        };

        putRequest.onerror = () => {
          reject(new IndexedDBError('Failed to delete resource', 'DELETE_FAILED', putRequest.error));
        };
      };

      getRequest.onerror = () => {
        reject(new IndexedDBError('Failed to get resource', 'READ_FAILED', getRequest.error));
      };
    });
  }

  // ===============================
  // Search Operations
  // ===============================

  /**
   * Search resources with FHIR-like parameters
   */
  async searchResources<T extends Resource>(
    resourceType: string,
    params: IndexedDBSearchParams = {}
  ): Promise<Bundle<T>> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    const storeName = this.getStoreName(resourceType);
    const offset = params._offset || ResourceHistoryTable;
    const count = params._count || 2ResourceHistoryTable;
    const sort = params._sort;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      // Build query
      let request: IDBRequest;
      const results: T[] = [];
      let total = ResourceHistoryTable;

      // Determine which index to use based on search params
      const indexedParam = this.getIndexedSearchParam(resourceType, params);
      
      if (indexedParam) {
        const index = store.index(indexedParam.index);
        const range = this.createKeyRange(indexedParam.value);
        request = index.openCursor(range);
      } else {
        request = store.openCursor();
      }

      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const storedResource = cursor.value as StoredResource<T>;

          // Skip soft-deleted resources
          if (storedResource.deletedAt) {
            cursor.continue();
            return;
          }

          // Apply filters
          if (await this.matchesSearchParams(storedResource, params)) {
            total++;

            // Apply pagination
            if (total > offset && results.length < count) {
              try {
                const resource = await this.extractResourceFromStorage(storedResource);
                results.push(resource);
              } catch (error) {
                console.error('Failed to decrypt resource:', error);
              }
            }
          }

          cursor.continue();
        } else {
          // All records processed, create Bundle
          const bundle: Bundle<T> = {
            resourceType: 'Bundle',
            type: 'searchset',
            total,
            entry: results.map(resource => ({
              resource,
              fullUrl: `${resourceType}/${resource.id}`
            } as BundleEntry<T>))
          };

          // Add pagination links
          if (offset + count < total) {
            bundle.link = [
              {
                relation: 'next',
                url: `?_offset=${offset + count}&_count=${count}`
              }
            ];
          }

          resolve(bundle);
        }
      };

      request.onerror = () => {
        reject(new IndexedDBError('Search failed', 'SEARCH_FAILED', request.error));
      };
    });
  }

  /**
   * Search across multiple resource types
   */
  async searchAcrossTypes(
    resourceTypes: string[],
    params: IndexedDBSearchParams = {}
  ): Promise<Bundle> {
    const promises = resourceTypes.map(type => this.searchResources(type, params));
    const bundles = await Promise.all(promises);

    // Combine results
    const combinedBundle: Bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: bundles.reduce((sum, bundle) => sum + (bundle.total || ResourceHistoryTable), ResourceHistoryTable),
      entry: bundles.flatMap(bundle => bundle.entry || [])
    };

    return combinedBundle;
  }

  // ===============================
  // Sync Operations
  // ===============================

  /**
   * Get pending sync items
   */
  async getPendingSyncItems(): Promise<SyncQueueEntry[]> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new IndexedDBError('Failed to get sync queue', 'SYNC_QUEUE_ERROR', request.error));
      };
    });
  }

  /**
   * Mark sync item as completed
   */
  async markSyncCompleted(syncId: number): Promise<void> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.get(syncId);

      request.onsuccess = () => {
        const entry = request.result as SyncQueueEntry;
        if (entry) {
          entry.status = 'completed';
          entry.completedAt = Date.now();
          
          const updateRequest = store.put(entry);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(new IndexedDBError('Failed to update sync queue', 'SYNC_UPDATE_ERROR', request.error));
      };
    });
  }

  /**
   * Handle sync conflict
   */
  async handleSyncConflict<T extends Resource>(
    localResource: T,
    serverResource: T,
    resolution: 'local' | 'server' | 'merge'
  ): Promise<T> {
    const storeName = this.getStoreName(localResource.resourceType);
    
    let resolvedResource: T;

    switch (resolution) {
      case 'local':
        resolvedResource = localResource;
        break;
      
      case 'server':
        resolvedResource = serverResource;
        break;
      
      case 'merge':
        // Simple merge strategy - prefer server for most fields, keep local modifications
        resolvedResource = {
          ...serverResource,
          meta: {
            ...serverResource.meta,
            tag: [
              ...(serverResource.meta?.tag || []),
              { system: 'http://omnicare.com/conflict', code: 'merged' }
            ]
          }
        };
        break;
    }

    // Update local storage
    await this.updateResource(resolvedResource);
    
    return resolvedResource;
  }

  // ===============================
  // Data Expiration & Cleanup
  // ===============================

  /**
   * Start automatic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupExpiredData().catch(console.error);
    }, 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable);

    // Run initial cleanup
    this.cleanupExpiredData().catch(console.error);
  }

  /**
   * Clean up expired data based on retention policies
   */
  async cleanupExpiredData(): Promise<void> {
    if (!this.db) return;

    for (const [resourceType, retentionDays] of Object.entries(RETENTION_POLICIES)) {
      if (retentionDays === ResourceHistoryTable) continue; // Skip permanent storage

      const storeName = this.getStoreNameForResourceType(resourceType);
      if (!storeName) continue;

      const expirationTime = Date.now() - (retentionDays * 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable);

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('updatedAt');
      const range = IDBKeyRange.upperBound(expirationTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalRecords: number;
    recordsByType: Record<string, number>;
    pendingSyncCount: number;
    storageUsed?: number;
  }> {
    if (!this.db) throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');

    const stats = {
      totalRecords: ResourceHistoryTable,
      recordsByType: {} as Record<string, number>,
      pendingSyncCount: ResourceHistoryTable,
      storageUsed: ResourceHistoryTable
    };

    // Count records in each store
    for (const storeName of Array.from(this.db.objectStoreNames)) {
      if (storeName === 'syncQueue' || storeName === 'metadata') continue;

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const countRequest = store.count();

      await new Promise((resolve, reject) => {
        countRequest.onsuccess = () => {
          const count = countRequest.result;
          stats.recordsByType[storeName] = count;
          stats.totalRecords += count;
          resolve(count);
        };
        countRequest.onerror = () => reject(countRequest.error);
      });
    }

    // Count pending sync items
    const pendingSync = await this.getPendingSyncItems();
    stats.pendingSyncCount = pendingSync.length;

    // Try to get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        stats.storageUsed = estimate.usage;
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
      }
    }

    return stats;
  }

  // ===============================
  // Private Helper Methods
  // ===============================

  /**
   * Create object store with indexes
   */
  private createObjectStore(db: IDBDatabase, config: ObjectStoreConfig): void {
    const store = db.createObjectStore(config.name, {
      keyPath: config.keyPath,
      autoIncrement: config.autoIncrement
    });

    // Create indexes
    config.indexes.forEach(index => {
      store.createIndex(index.name, index.keyPath, {
        unique: index.unique,
        multiEntry: index.multiEntry
      });
    });
  }

  /**
   * Get store name for resource type
   */
  private getStoreName(resourceType: string): string {
    const storeMap: Record<string, string> = {
      Patient: 'patients',
      Encounter: 'encounters',
      Observation: 'observations',
      MedicationRequest: 'medicationRequests',
      Condition: 'conditions',
      AllergyIntolerance: 'allergyIntolerances',
      DocumentReference: 'documentReferences',
      DiagnosticReport: 'diagnosticReports',
      CarePlan: 'carePlans',
      Immunization: 'immunizations',
      ServiceRequest: 'serviceRequests',
      Practitioner: 'practitioners',
      Organization: 'organizations'
    };

    const storeName = storeMap[resourceType];
    if (!storeName) {
      throw new IndexedDBError(`Unsupported resource type: ${resourceType}`, 'UNSUPPORTED_TYPE');
    }

    return storeName;
  }

  /**
   * Get store name for resource type (safe version)
   */
  private getStoreNameForResourceType(resourceType: string): string | null {
    try {
      return this.getStoreName(resourceType);
    } catch {
      return null;
    }
  }

  /**
   * Prepare resource for storage with encryption
   */
  private async prepareResourceForStorage<T extends Resource>(
    resource: T,
    existing?: StoredResource<T>
  ): Promise<StoredResource<T>> {
    const now = Date.now();
    let encryptedResource: any = resource;
    let encryptionMetadata: EncryptionMetadata | undefined;
    const searchHashes: Record<string, string> = {};

    // Handle encryption if enabled
    if (this.encryptionEnabled && encryptionService.isInitialized()) {
      const fieldsToEncrypt = ENCRYPTED_FIELDS[resource.resourceType] || [];
      
      if (fieldsToEncrypt.length > ResourceHistoryTable) {
        // Deep clone resource to avoid modifying original
        encryptedResource = JSON.parse(JSON.stringify(resource));
        const encryptedFields: string[] = [];

        // Encrypt specified fields
        for (const fieldPath of fieldsToEncrypt) {
          const fieldValue = this.getNestedValue(resource, fieldPath);
          if (fieldValue !== undefined) {
            // Create search hash for encrypted field
            if (typeof fieldValue === 'string') {
              searchHashes[fieldPath] = await encryptionService.hashForSearch(fieldValue);
            }

            // Encrypt the field
            const encrypted = await encryptionService.encrypt(fieldValue);
            this.setNestedValue(encryptedResource, fieldPath, encrypted);
            encryptedFields.push(fieldPath);
          }
        }

        encryptionMetadata = {
          encryptedFields,
          encryptionVersion: 1,
          lastModified: now
        };
      }
    }

    // Create stored resource
    const storedResource: StoredResource<T> = {
      id: resource.id!,
      resourceType: resource.resourceType,
      resource: encryptedResource,
      encrypted: !!encryptionMetadata,
      encryptionMetadata,
      searchHashes,
      syncMetadata: existing?.syncMetadata || {
        localVersion: 1,
        syncStatus: 'pending'
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    // Increment version if updating
    if (existing) {
      storedResource.syncMetadata.localVersion = (existing.syncMetadata.localVersion || ResourceHistoryTable) + 1;
    }

    // Set expiration if applicable
    const retentionDays = RETENTION_POLICIES[resource.resourceType];
    if (retentionDays && retentionDays > ResourceHistoryTable) {
      storedResource.expiresAt = now + (retentionDays * 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
    }

    return storedResource;
  }

  /**
   * Extract resource from storage with decryption
   */
  private async extractResourceFromStorage<T extends Resource>(
    storedResource: StoredResource<T>
  ): Promise<T> {
    let resource = storedResource.resource;

    // Handle decryption if needed
    if (storedResource.encrypted && storedResource.encryptionMetadata && encryptionService.isInitialized()) {
      // Deep clone to avoid modifying stored data
      resource = JSON.parse(JSON.stringify(resource));

      // Decrypt each field
      for (const fieldPath of storedResource.encryptionMetadata.encryptedFields) {
        const encryptedValue = this.getNestedValue(resource, fieldPath);
        if (encryptedValue && typeof encryptedValue === 'object' && 'ciphertext' in encryptedValue) {
          try {
            const decryptedValue = await encryptionService.decrypt(encryptedValue as EncryptedData);
            this.setNestedValue(resource, fieldPath, decryptedValue);
          } catch (error) {
            console.error(`Failed to decrypt field ${fieldPath}:`, error);
            // Continue with other fields
          }
        }
      }
    }

    return resource;
  }

  /**
   * Add operation to sync queue
   */
  private async addToSyncQueue(
    transaction: IDBTransaction,
    resourceId: string,
    resourceType: string,
    operation: 'create' | 'update' | 'delete',
    data?: any
  ): Promise<void> {
    const syncStore = transaction.objectStore('syncQueue');
    
    const entry: SyncQueueEntry = {
      resourceId,
      resourceType,
      operation,
      data,
      status: 'pending',
      attempts: ResourceHistoryTable,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = syncStore.add(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get indexed search parameter
   */
  private getIndexedSearchParam(
    resourceType: string,
    params: IndexedDBSearchParams
  ): { index: string; value: any } | null {
    const storeName = this.getStoreName(resourceType);
    const storeConfig = OBJECT_STORES.find(config => config.name === storeName);
    
    if (!storeConfig) return null;

    // Check each search param to see if it matches an index
    for (const [param, value] of Object.entries(params)) {
      if (param.startsWith('_') || value === undefined) continue;

      const index = storeConfig.indexes.find(idx => {
        // Direct match
        if (idx.name === param) return true;
        
        // Handle FHIR search parameter mappings
        const mappings: Record<string, string> = {
          'patient': 'patient',
          'subject': 'patient',
          'encounter': 'encounter',
          'status': 'status',
          'category': 'category',
          'code': 'code'
        };

        return mappings[param] === idx.name;
      });

      if (index) {
        return { index: index.name, value };
      }
    }

    return null;
  }

  /**
   * Create IDBKeyRange from value
   */
  private createKeyRange(value: any): IDBKeyRange | undefined {
    if (value === undefined || value === null) return undefined;

    // Handle different value types
    if (Array.isArray(value)) {
      // For arrays, match any value
      return undefined; // Will need to filter manually
    }

    if (typeof value === 'string') {
      // For prefix matching
      if (value.endsWith('*')) {
        const prefix = value.slice(ResourceHistoryTable, -1);
        return IDBKeyRange.bound(prefix, prefix + '\uffff');
      }
    }

    // Exact match
    return IDBKeyRange.only(value);
  }

  /**
   * Check if resource matches search parameters
   */
  private async matchesSearchParams(
    storedResource: StoredResource,
    params: IndexedDBSearchParams
  ): Promise<boolean> {
    for (const [param, value] of Object.entries(params)) {
      if (param.startsWith('_') || value === undefined) continue;

      // Get value from resource
      let resourceValue: any;

      // Handle encrypted fields via search hashes
      if (storedResource.searchHashes && storedResource.searchHashes[param]) {
        const searchHash = await encryptionService.hashForSearch(value.toString());
        resourceValue = storedResource.searchHashes[param];
        if (resourceValue !== searchHash) return false;
      } else {
        // Get value from resource
        resourceValue = this.getSearchParamValue(storedResource.resource, param);

        // Compare values
        if (!this.compareValues(resourceValue, value)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get value for search parameter from resource
   */
  private getSearchParamValue(resource: any, param: string): any {
    // Map common FHIR search parameters to resource paths
    const paramMappings: Record<string, string> = {
      'patient': 'subject.reference',
      'subject': 'subject.reference',
      'encounter': 'encounter.reference',
      'status': 'status',
      'category': 'category[ResourceHistoryTable].coding[ResourceHistoryTable].code',
      'code': 'code.coding[ResourceHistoryTable].code',
      'identifier': 'identifier[ResourceHistoryTable].value',
      'name': 'name[ResourceHistoryTable].family',
      'given': 'name[ResourceHistoryTable].given[ResourceHistoryTable]',
      'birthdate': 'birthDate',
      'gender': 'gender',
      'type': 'type'
    };

    const path = paramMappings[param] || param;
    return this.getNestedValue(resource, path);
  }

  /**
   * Compare values for search
   */
  private compareValues(resourceValue: any, searchValue: any): boolean {
    if (resourceValue === undefined || resourceValue === null) return false;

    // Handle array search values (OR condition)
    if (Array.isArray(searchValue)) {
      return searchValue.some(v => this.compareValues(resourceValue, v));
    }

    // Handle string comparisons
    if (typeof searchValue === 'string' && typeof resourceValue === 'string') {
      // Case-insensitive comparison
      const resourceLower = resourceValue.toLowerCase();
      const searchLower = searchValue.toLowerCase();

      // Handle prefix matching
      if (searchValue.endsWith('*')) {
        return resourceLower.startsWith(searchLower.slice(ResourceHistoryTable, -1));
      }

      // Handle contains matching
      if (searchValue.startsWith('*') && searchValue.endsWith('*')) {
        return resourceLower.includes(searchLower.slice(1, -1));
      }

      // Exact match
      return resourceLower === searchLower;
    }

    // Default comparison
    return resourceValue === searchValue;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split(/[\.\[\]]/).filter(Boolean);
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      
      // Handle array index
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split(/[\.\[\]]/).filter(Boolean);
    let current = obj;

    for (let i = ResourceHistoryTable; i < parts.length - 1; i++) {
      const part = parts[i];
      
      // Handle array index
      if (/^\d+$/.test(part)) {
        const index = parseInt(part);
        if (!Array.isArray(current)) current = [];
        if (!current[index]) current[index] = {};
        current = current[index];
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      current[parseInt(lastPart)] = value;
    } else {
      current[lastPart] = value;
    }
  }
}

// Export singleton instance
export const indexedDBService = IndexedDBService.getInstance();