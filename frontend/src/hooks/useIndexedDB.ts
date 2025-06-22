/**
 * React Hook for IndexedDB FHIR Resource Management
 * Provides easy access to offline storage capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Resource, Bundle } from '@medplum/fhirtypes';
import { indexedDBService, IndexedDBSearchParams, QueryResult } from '@/services/indexeddb.service';
import { encryptionService } from '@/services/encryption.service';
import { fhirSyncService, SyncEvent, SyncStatus, SyncProgress } from '@/services/indexeddb.sync';
import { FHIRQueryBuilder, query } from '@/services/indexeddb.query';
import { useAuthStore } from '@/stores/auth';

// Hook state interface
interface UseIndexedDBState {
  isInitialized: boolean;
  isEncrypted: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus?: SyncStatus;
  error?: Error;
}

// Hook return interface
interface UseIndexedDBReturn extends UseIndexedDBState {
  // CRUD operations
  create: <T extends Resource>(resource: T) => Promise<T>;
  read: <T extends Resource>(resourceType: string, id: string) => Promise<T | null>;
  update: <T extends Resource>(resource: T) => Promise<T>;
  remove: (resourceType: string, id: string) => Promise<void>;
  
  // Search operations
  search: <T extends Resource>(
    resourceType: string,
    params?: IndexedDBSearchParams
  ) => Promise<Bundle<T>>;
  query: <T extends Resource>(resourceType: string) => FHIRQueryBuilder<T>;
  
  // Sync operations
  syncAll: () => Promise<void>;
  syncResource: (resourceType: string, id: string) => Promise<void>;
  clearSyncErrors: () => void;
  
  // Utility operations
  clearAll: () => Promise<void>;
  getStats: () => Promise<any>;
}

/**
 * Hook for IndexedDB operations
 */
export function useIndexedDB(): UseIndexedDBReturn {
  const { user } = useAuthStore();
  const [state, setState] = useState<UseIndexedDBState>({
    isInitialized: false,
    isEncrypted: false,
    isOnline: navigator.onLine,
    isSyncing: false
  });

  const unsubscribeRef = useRef<Array<() => void>>([]);

  // Initialize IndexedDB and encryption
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize IndexedDB
        await indexedDBService.initialize(true);

        // Initialize encryption if user is authenticated
        if (user) {
          await encryptionService.initialize(user.email, user.id);
          setState(prev => ({ ...prev, isEncrypted: true }));
        }

        // Start auto-sync
        fhirSyncService.startAutoSync();

        setState(prev => ({ ...prev, isInitialized: true }));
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        setState(prev => ({ ...prev, error: error as Error }));
      }
    };

    initialize();

    return () => {
      // Cleanup
      fhirSyncService.stopAutoSync();
      indexedDBService.close();
      encryptionService.clear();
    };
  }, [user]);

  // Subscribe to sync events
  useEffect(() => {
    const subscriptions = [
      fhirSyncService.on(SyncEvent.ONLINE, () => {
        setState(prev => ({ ...prev, isOnline: true }));
      }),
      
      fhirSyncService.on(SyncEvent.OFFLINE, () => {
        setState(prev => ({ ...prev, isOnline: false }));
      }),
      
      fhirSyncService.on(SyncEvent.SYNC_STARTED, () => {
        setState(prev => ({ ...prev, isSyncing: true }));
      }),
      
      fhirSyncService.on(SyncEvent.SYNC_COMPLETED, () => {
        setState(prev => ({ 
          ...prev, 
          isSyncing: false,
          syncStatus: fhirSyncService.getStatus()
        }));
      }),
      
      fhirSyncService.on(SyncEvent.SYNC_FAILED, (error: Error) => {
        setState(prev => ({ 
          ...prev, 
          isSyncing: false,
          error,
          syncStatus: fhirSyncService.getStatus()
        }));
      })
    ];

    unsubscribeRef.current = subscriptions;

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // CRUD operations
  const create = useCallback(async <T extends Resource>(resource: T): Promise<T> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.createResource(resource);
  }, [state.isInitialized]);

  const read = useCallback(async <T extends Resource>(
    resourceType: string,
    id: string
  ): Promise<T | null> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.readResource<T>(resourceType, id);
  }, [state.isInitialized]);

  const update = useCallback(async <T extends Resource>(resource: T): Promise<T> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.updateResource(resource);
  }, [state.isInitialized]);

  const remove = useCallback(async (resourceType: string, id: string): Promise<void> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.deleteResource(resourceType, id);
  }, [state.isInitialized]);

  // Search operations
  const search = useCallback(async <T extends Resource>(
    resourceType: string,
    params?: IndexedDBSearchParams
  ): Promise<Bundle<T>> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.searchResources<T>(resourceType, params);
  }, [state.isInitialized]);

  const queryBuilder = useCallback(<T extends Resource>(
    resourceType: string
  ): FHIRQueryBuilder<T> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return query<T>(resourceType);
  }, [state.isInitialized]);

  // Sync operations
  const syncAll = useCallback(async (): Promise<void> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return fhirSyncService.syncAll();
  }, [state.isInitialized]);

  const syncResource = useCallback(async (
    resourceType: string,
    id: string
  ): Promise<void> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return fhirSyncService.forceSyncResource(resourceType, id);
  }, [state.isInitialized]);

  const clearSyncErrors = useCallback(() => {
    fhirSyncService.clearSyncErrors();
    setState(prev => ({ 
      ...prev, 
      syncStatus: fhirSyncService.getStatus()
    }));
  }, []);

  // Utility operations
  const clearAll = useCallback(async (): Promise<void> => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.clearAllData();
  }, [state.isInitialized]);

  const getStats = useCallback(async () => {
    if (!state.isInitialized) {
      throw new Error('IndexedDB not initialized');
    }
    return indexedDBService.getStorageStats();
  }, [state.isInitialized]);

  return {
    ...state,
    create,
    read,
    update,
    remove,
    search,
    query: queryBuilder,
    syncAll,
    syncResource,
    clearSyncErrors,
    clearAll,
    getStats
  };
}

/**
 * Hook for specific resource type operations
 */
export function useIndexedDBResource<T extends Resource>(
  resourceType: string
): {
  loading: boolean;
  error?: Error;
  data?: T[];
  
  create: (resource: Omit<T, 'resourceType'>) => Promise<T>;
  read: (id: string) => Promise<T | null>;
  update: (resource: T) => Promise<T>;
  remove: (id: string) => Promise<void>;
  search: (params?: IndexedDBSearchParams) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const { isInitialized, create, read, update, remove, search } = useIndexedDB();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [data, setData] = useState<T[]>();

  // Resource-specific operations
  const createResource = useCallback(async (
    resourceData: Omit<T, 'resourceType'>
  ): Promise<T> => {
    const resource = {
      ...resourceData,
      resourceType
    } as T;
    
    return create(resource);
  }, [create, resourceType]);

  const readResource = useCallback((id: string) => {
    return read<T>(resourceType, id);
  }, [read, resourceType]);

  const updateResource = useCallback((resource: T) => {
    return update(resource);
  }, [update]);

  const removeResource = useCallback((id: string) => {
    return remove(resourceType, id);
  }, [remove, resourceType]);

  const searchResources = useCallback(async (
    params?: IndexedDBSearchParams
  ): Promise<void> => {
    setLoading(true);
    setError(undefined);
    
    try {
      const bundle = await search<T>(resourceType, params);
      setData(bundle.entry?.map(e => e.resource!) || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [search, resourceType]);

  const refresh = useCallback(() => {
    return searchResources();
  }, [searchResources]);

  // Initial load
  useEffect(() => {
    if (isInitialized) {
      refresh();
    }
  }, [isInitialized, refresh]);

  return {
    loading,
    error,
    data,
    create: createResource,
    read: readResource,
    update: updateResource,
    remove: removeResource,
    search: searchResources,
    refresh
  };
}

/**
 * Hook for sync status monitoring
 */
export function useIndexedDBSync(): {
  status: SyncStatus | undefined;
  progress: SyncProgress | undefined;
  sync: () => Promise<void>;
  clearErrors: () => void;
} {
  const [status, setStatus] = useState<SyncStatus>();
  const [progress, setProgress] = useState<SyncProgress>();

  useEffect(() => {
    // Get initial status
    setStatus(fhirSyncService.getStatus());

    // Subscribe to updates
    const unsubscribe = [
      fhirSyncService.on(SyncEvent.SYNC_STARTED, () => {
        setStatus(fhirSyncService.getStatus());
      }),
      
      fhirSyncService.on(SyncEvent.SYNC_PROGRESS, (p: SyncProgress) => {
        setProgress(p);
      }),
      
      fhirSyncService.on(SyncEvent.SYNC_COMPLETED, () => {
        setStatus(fhirSyncService.getStatus());
        setProgress(undefined);
      }),
      
      fhirSyncService.on(SyncEvent.SYNC_FAILED, () => {
        setStatus(fhirSyncService.getStatus());
        setProgress(undefined);
      })
    ];

    return () => {
      unsubscribe.forEach(fn => fn());
    };
  }, []);

  const sync = useCallback(async () => {
    await fhirSyncService.syncAll();
  }, []);

  const clearErrors = useCallback(() => {
    fhirSyncService.clearSyncErrors();
    setStatus(fhirSyncService.getStatus());
  }, []);

  return { status, progress, sync, clearErrors };
}