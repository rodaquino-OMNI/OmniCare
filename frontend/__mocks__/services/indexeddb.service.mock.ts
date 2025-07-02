import { Resource, Bundle, BundleEntry, OperationOutcome } from '@medplum/fhirtypes';

// Re-define types to avoid circular dependencies
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

export interface QueryResult<T extends Resource> {
  total: number;
  data: T[];
  hasMore: boolean;
  nextOffset?: number;
}

// In-memory storage for mock
const mockStorage = new Map<string, Map<string, any>>();
const mockSyncQueue: any[] = [];

// Mock IndexedDB Error
export class IndexedDBError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'IndexedDBError';
  }
}

// Mock IndexedDB Service
export class MockIndexedDBService {
  private static instance: MockIndexedDBService;
  private initialized = false;
  private encryptionEnabled = false;
  
  // Store names mapping
  private storeNames = new Map([
    ['Patient', 'patients'],
    ['Encounter', 'encounters'],
    ['Observation', 'observations'],
    ['MedicationRequest', 'medicationRequests'],
    ['Condition', 'conditions'],
    ['AllergyIntolerance', 'allergyIntolerances'],
    ['DocumentReference', 'documentReferences'],
    ['DiagnosticReport', 'diagnosticReports'],
    ['CarePlan', 'carePlans'],
    ['Immunization', 'immunizations'],
    ['ServiceRequest', 'serviceRequests'],
    ['Practitioner', 'practitioners'],
    ['Organization', 'organizations']
  ]);

  private constructor() {
    // Initialize mock stores
    this.storeNames.forEach((storeName) => {
      mockStorage.set(storeName, new Map());
    });
    mockStorage.set('syncQueue', new Map());
    mockStorage.set('metadata', new Map());
  }

  static getInstance(): MockIndexedDBService {
    if (!MockIndexedDBService.instance) {
      MockIndexedDBService.instance = new MockIndexedDBService();
    }
    return MockIndexedDBService.instance;
  }

  async initialize(enableEncryption = true): Promise<void> {
    this.encryptionEnabled = enableEncryption;
    this.initialized = true;
    return Promise.resolve();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  close(): void {
    this.initialized = false;
  }

  async clearAllData(): Promise<void> {
    mockStorage.forEach(store => store.clear());
    mockSyncQueue.length = 0;
    return Promise.resolve();
  }

  // CRUD Operations
  async createResource<T extends Resource>(resource: T): Promise<T> {
    if (!this.initialized) {
      throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');
    }

    const storeName = this.getStoreName(resource.resourceType);
    const store = mockStorage.get(storeName);
    
    if (!store) {
      throw new IndexedDBError(`Store not found: ${storeName}`, 'STORE_NOT_FOUND');
    }

    if (store.has(resource.id!)) {
      throw new IndexedDBError('Resource already exists', 'DUPLICATE_RESOURCE');
    }

    // Store the resource
    const storedResource = {
      id: resource.id!,
      resourceType: resource.resourceType,
      resource,
      encrypted: false,
      searchHashes: {},
      syncMetadata: {
        localVersion: 1,
        syncStatus: 'pending'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    store.set(resource.id!, storedResource);
    
    // Add to sync queue
    mockSyncQueue.push({
      resourceId: resource.id!,
      resourceType: resource.resourceType,
      operation: 'create',
      data: resource,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now()
    });

    return resource;
  }

  async readResource<T extends Resource>(resourceType: string, id: string): Promise<T | null> {
    if (!this.initialized) {
      throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');
    }

    const storeName = this.getStoreName(resourceType);
    const store = mockStorage.get(storeName);
    
    if (!store) {
      throw new IndexedDBError(`Store not found: ${storeName}`, 'STORE_NOT_FOUND');
    }

    const storedResource = store.get(id);
    
    if (!storedResource || storedResource.deletedAt) {
      return null;
    }

    return storedResource.resource as T;
  }

  async updateResource<T extends Resource>(resource: T): Promise<T> {
    if (!this.initialized) {
      throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');
    }

    if (!resource.id) {
      throw new IndexedDBError('Resource must have an ID', 'INVALID_RESOURCE');
    }

    const storeName = this.getStoreName(resource.resourceType);
    const store = mockStorage.get(storeName);
    
    if (!store) {
      throw new IndexedDBError(`Store not found: ${storeName}`, 'STORE_NOT_FOUND');
    }

    const existing = store.get(resource.id);
    
    if (!existing || existing.deletedAt) {
      throw new IndexedDBError('Resource not found', 'NOT_FOUND');
    }

    // Update the resource
    const updatedResource = {
      ...existing,
      resource,
      syncMetadata: {
        ...existing.syncMetadata,
        localVersion: (existing.syncMetadata.localVersion || 0) + 1,
        syncStatus: 'pending'
      },
      updatedAt: Date.now()
    };

    store.set(resource.id, updatedResource);
    
    // Add to sync queue
    mockSyncQueue.push({
      resourceId: resource.id,
      resourceType: resource.resourceType,
      operation: 'update',
      data: resource,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now()
    });

    return resource;
  }

  async deleteResource(resourceType: string, id: string): Promise<void> {
    if (!this.initialized) {
      throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');
    }

    const storeName = this.getStoreName(resourceType);
    const store = mockStorage.get(storeName);
    
    if (!store) {
      throw new IndexedDBError(`Store not found: ${storeName}`, 'STORE_NOT_FOUND');
    }

    const existing = store.get(id);
    
    if (!existing || existing.deletedAt) {
      return; // Already deleted
    }

    // Soft delete
    existing.deletedAt = Date.now();
    existing.syncMetadata.syncStatus = 'pending';
    
    // Add to sync queue
    mockSyncQueue.push({
      resourceId: id,
      resourceType,
      operation: 'delete',
      status: 'pending',
      attempts: 0,
      createdAt: Date.now()
    });
  }

  // Search Operations
  async searchResources<T extends Resource>(
    resourceType: string,
    params: IndexedDBSearchParams = {}
  ): Promise<Bundle<T>> {
    if (!this.initialized) {
      throw new IndexedDBError('Database not initialized', 'NOT_INITIALIZED');
    }

    const storeName = this.getStoreName(resourceType);
    const store = mockStorage.get(storeName);
    
    if (!store) {
      throw new IndexedDBError(`Store not found: ${storeName}`, 'STORE_NOT_FOUND');
    }

    const offset = params._offset || 0;
    const count = params._count || 20;
    
    // Get all resources
    const allResources = Array.from(store.values())
      .filter(r => !r.deletedAt)
      .map(r => r.resource as T)
      .filter(resource => this.matchesSearchParams(resource, params));

    // Apply pagination
    const paginatedResources = allResources.slice(offset, offset + count);

    // Create bundle
    const bundle: Bundle<T> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: allResources.length,
      entry: paginatedResources.map(resource => ({
        resource,
        fullUrl: `${resourceType}/${resource.id}`
      } as BundleEntry<T>))
    };

    // Add pagination links
    if (offset + count < allResources.length) {
      bundle.link = [{
        relation: 'next',
        url: `?_offset=${offset + count}&_count=${count}`
      }];
    }

    return bundle;
  }

  async searchAcrossTypes(
    resourceTypes: string[],
    params: IndexedDBSearchParams = {}
  ): Promise<Bundle> {
    const bundles = await Promise.all(
      resourceTypes.map(type => this.searchResources(type, params))
    );

    const combinedBundle: Bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: bundles.reduce((sum, bundle) => sum + (bundle.total || 0), 0),
      entry: bundles.flatMap(bundle => bundle.entry || [])
    };

    return combinedBundle;
  }

  // Sync Operations
  async getPendingSyncItems(): Promise<any[]> {
    return mockSyncQueue.filter(item => item.status === 'pending');
  }

  async markSyncCompleted(syncId: number): Promise<void> {
    const item = mockSyncQueue[syncId];
    if (item) {
      item.status = 'completed';
      item.completedAt = Date.now();
    }
  }

  async handleSyncConflict<T extends Resource>(
    localResource: T,
    serverResource: T,
    resolution: 'local' | 'server' | 'merge'
  ): Promise<T> {
    switch (resolution) {
      case 'local':
        return localResource;
      case 'server':
        return serverResource;
      case 'merge':
        // Simple merge - prefer server but keep local modifications
        return {
          ...serverResource,
          meta: {
            ...serverResource.meta,
            tag: [
              ...(serverResource.meta?.tag || []),
              { system: 'http://omnicare.com/conflict', code: 'merged' }
            ]
          }
        };
    }
  }

  // Storage Statistics
  async getStorageStats(): Promise<{
    totalRecords: number;
    recordsByType: Record<string, number>;
    pendingSyncCount: number;
    storageUsed?: number;
  }> {
    const stats = {
      totalRecords: 0,
      recordsByType: {} as Record<string, number>,
      pendingSyncCount: mockSyncQueue.filter(item => item.status === 'pending').length,
      storageUsed: 0
    };

    this.storeNames.forEach((storeName, resourceType) => {
      const store = mockStorage.get(storeName);
      if (store) {
        const count = Array.from(store.values()).filter(r => !r.deletedAt).length;
        stats.recordsByType[resourceType] = count;
        stats.totalRecords += count;
      }
    });

    return stats;
  }

  // Helper methods
  private getStoreName(resourceType: string): string {
    const storeName = this.storeNames.get(resourceType);
    if (!storeName) {
      throw new IndexedDBError(`Unsupported resource type: ${resourceType}`, 'UNSUPPORTED_TYPE');
    }
    return storeName;
  }

  private matchesSearchParams(resource: Resource, params: IndexedDBSearchParams): boolean {
    for (const [param, value] of Object.entries(params)) {
      if (param.startsWith('_') || value === undefined) continue;

      // Simple parameter matching
      if (param === 'patient' || param === 'subject') {
        const subject = (resource as any).subject?.reference;
        if (subject !== `Patient/${value}` && subject !== value) {
          return false;
        }
      } else if (param === 'status' && (resource as any).status !== value) {
        return false;
      } else if (param === 'category') {
        const categories = (resource as any).category || [];
        const hasCategory = categories.some((cat: any) => 
          cat.coding?.some((coding: any) => coding.code === value)
        );
        if (!hasCategory) return false;
      }
    }
    return true;
  }

  // Data expiration cleanup (no-op in mock)
  async cleanupExpiredData(): Promise<void> {
    return Promise.resolve();
  }
}

// Export factory function
export function createMockIndexedDBService() {
  return MockIndexedDBService.getInstance();
}

// Export singleton instance
export const indexedDBService = MockIndexedDBService.getInstance();