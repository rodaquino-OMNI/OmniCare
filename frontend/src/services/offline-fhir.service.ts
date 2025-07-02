import { FHIRService, fhirService as baseFhirService } from './fhir.service';
import { serviceWorkerManager, offlineApiCall } from '@/lib/service-worker';
import { Bundle, Patient, Resource, Observation, MedicationRequest, Condition, AllergyIntolerance } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import { indexedDBService } from './indexeddb.service';
import { encryptionService } from './encryption.service';
import { getOfflineSyncService } from './offline-sync.service';
import { shouldEncryptResource, getResourceOfflineConfig, isResourceCritical } from '@/config/offline-manifest';

/**
 * Offline-aware FHIR Service with IndexedDB and encryption integration
 * Extends the base FHIR service with secure offline capabilities
 */
export class OfflineFHIRService extends FHIRService {
  private offlineStorage: Map<string, any> = new Map();
  private offlineSyncService = typeof window !== 'undefined' ? getOfflineSyncService() : null;
  private isInitialized = false;

  constructor(baseURL?: string) {
    super(baseURL);
    this.setupOfflineHandlers();
  }

  /**
   * Initialize offline services with encryption
   */
  async initialize(userId: string, password: string): Promise<void> {
    try {
      // Initialize encryption service
      await encryptionService.initialize(password, userId);
      
      // Initialize IndexedDB with encryption enabled
      await indexedDBService.initialize(true);
      
      // Initialize offline sync service
      if (this.offlineSyncService) {
        await this.offlineSyncService.initialize();
      }
      
      this.isInitialized = true;
      console.log('[OfflineFHIR] Initialized with encryption');
    } catch (error) {
      console.error('[OfflineFHIR] Initialization failed:', error);
      throw error;
    }
  }

  private setupOfflineHandlers() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      
      // Listen for sync events from service worker
      serviceWorkerManager.onServiceWorkerMessage('sync-success', (data) => {
        this.handleSyncSuccess(data);
      });
      
      serviceWorkerManager.onServiceWorkerMessage('sync-failed', (data) => {
        this.handleSyncFailure(data);
      });
    }
  }

  private handleOnline() {
    // Sync any pending changes when back online
    this.syncPendingChanges();
  }

  private handleOffline() {
    console.log('[OfflineFHIR] Switched to offline mode');
    notifications.show({
      title: 'Offline Mode',
      message: 'You can continue working. Changes will sync when back online.',
      color: 'orange',
    });
  }

  private handleSyncSuccess(data: any) {
    notifications.show({
      title: 'Sync Complete',
      message: `Successfully synced ${data.request?.resource || 'data'}`,
      color: 'green',
    });
  }

  private handleSyncFailure(data: any) {
    notifications.show({
      title: 'Sync Failed',
      message: `Failed to sync ${data.request?.resource || 'data'}. Will retry later.`,
      color: 'red',
    });
  }

  private async syncPendingChanges() {
    if (!this.offlineSyncService) return;
    
    try {
      await this.offlineSyncService.syncNow();
      
      notifications.show({
        title: 'Syncing Data',
        message: 'Synchronizing offline changes...',
        color: 'blue',
      });
    } catch (error) {
      console.error('[OfflineFHIR] Failed to sync changes:', error);
    }
  }

  // Override methods with offline support

  async getPatient(patientId: string): Promise<Patient> {
    return offlineApiCall(
      () => super.getPatient(patientId),
      async () => {
        // Try to get from IndexedDB
        const cached = await indexedDBService.readResource<Patient>('Patient', patientId);
        if (cached) {
          notifications.show({
            title: 'Offline Mode',
            message: 'Showing cached patient data',
            color: 'orange',
          });
          return cached;
        }
        throw new Error('Patient data not available offline');
      },
      {
        cacheKey: `Patient/${patientId}`,
        syncOnReconnect: false,
        resource: 'Patient',
      }
    );
  }

  async searchPatients(searchParams: any = {}): Promise<Bundle<Patient>> {
    return offlineApiCall(
      () => super.searchPatients(searchParams),
      async () => {
        // Search from IndexedDB
        const bundle = await indexedDBService.searchResources<Patient>('Patient', searchParams);
        
        if (bundle.entry && bundle.entry.length > 0) {
          notifications.show({
            title: 'Offline Mode',
            message: `Showing ${bundle.total} cached patients`,
            color: 'orange',
          });
          return bundle;
        }
        
        // Return empty bundle if no cache
        return {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: [],
        };
      },
      {
        cacheKey: 'PatientBundle',
        syncOnReconnect: false,
        resource: 'Bundle',
      }
    );
  }

  async createResource<T extends Resource>(resource: T): Promise<T> {
    if (!navigator.onLine) {
      // Queue for sync when offline
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const offlineResource = {
        ...resource,
        id: tempId,
        meta: {
          ...resource.meta,
          tag: [
            ...(resource.meta?.tag || []),
            {
              system: 'http://omnicare.com/fhir/tags',
              code: 'offline-pending',
              display: 'Created offline, pending sync',
            },
          ],
        },
      };

      try {
        // Store in IndexedDB with encryption if required
        await indexedDBService.createResource(offlineResource);

        // Queue for sync using offline sync service
        if (this.offlineSyncService) {
          const priority = isResourceCritical(resource.resourceType) ? 'critical' : 'high';
          await this.offlineSyncService.queueOperation('create', offlineResource, { priority });
        }

        notifications.show({
          title: 'Saved Offline',
          message: `${resource.resourceType} will be synced when connection is restored`,
          color: 'blue',
        });

        return offlineResource as T;
      } catch (error) {
        console.error('[OfflineFHIR] Failed to save offline:', error);
        throw error;
      }
    }

    // Online mode - save normally and cache for offline
    const savedResource = await super.createResource(resource);
    
    // Cache for offline use
    try {
      await indexedDBService.createResource(savedResource);
    } catch (error) {
      console.error('[OfflineFHIR] Failed to cache resource:', error);
    }
    
    return savedResource;
  }

  async updateResource<T extends Resource>(resource: T): Promise<T> {
    if (!navigator.onLine) {
      try {
        // Update in IndexedDB
        await indexedDBService.updateResource(resource);

        // Queue for sync using offline sync service
        if (this.offlineSyncService) {
          const priority = isResourceCritical(resource.resourceType) ? 'critical' : 'high';
          await this.offlineSyncService.queueOperation('update', resource, { priority });
        }

        notifications.show({
          title: 'Updated Offline',
          message: `${resource.resourceType} changes will be synced when online`,
          color: 'blue',
        });

        return resource;
      } catch (error) {
        console.error('[OfflineFHIR] Failed to update offline:', error);
        throw error;
      }
    }

    // Online mode - update normally and cache
    const updatedResource = await super.updateResource(resource);
    
    // Update cache
    try {
      await indexedDBService.updateResource(updatedResource);
    } catch (error) {
      console.error('[OfflineFHIR] Failed to update cache:', error);
    }
    
    return updatedResource;
  }

  // Proactive caching methods

  async cachePatientData(patientId: string): Promise<void> {
    try {
      // Cache patient demographics
      const patient = await super.getPatient(patientId);
      await indexedDBService.createResource(patient);

      // Cache related resources in parallel
      const promises: Promise<void>[] = [];
      
      // Vital signs
      const vitals = await super.getPatientVitalSigns(patientId).catch(() => null);
      if (vitals?.entry) {
        for (const entry of vitals.entry) {
          if (entry.resource) {
            promises.push(indexedDBService.createResource(entry.resource).then(() => {}));
          }
        }
      }

      // Medications
      const medications = await super.getPatientMedications(patientId).catch(() => null);
      if (medications?.entry) {
        for (const entry of medications.entry) {
          if (entry.resource) {
            promises.push(indexedDBService.createResource(entry.resource).then(() => {}));
          }
        }
      }

      // Conditions
      const conditions = await super.getPatientConditions(patientId).catch(() => null);
      if (conditions?.entry) {
        for (const entry of conditions.entry) {
          if (entry.resource) {
            promises.push(indexedDBService.createResource(entry.resource).then(() => {}));
          }
        }
      }

      // Allergies
      const allergies = await super.getPatientAllergies(patientId).catch(() => null);
      if (allergies?.entry) {
        for (const entry of allergies.entry) {
          if (entry.resource) {
            promises.push(indexedDBService.createResource(entry.resource).then(() => {}));
          }
        }
      }

      // Wait for all resources to be cached
      await Promise.all(promises);

      // Tell service worker to cache as well
      await serviceWorkerManager.cachePatientData(patientId);

      const totalCached = promises.length + 1; // +1 for patient
      notifications.show({
        title: 'Patient Data Cached',
        message: `${totalCached} resources are now available offline`,
        color: 'green',
      });
    } catch (error) {
      console.error('[OfflineFHIR] Failed to cache patient data:', error);
      notifications.show({
        title: 'Cache Failed',
        message: 'Unable to cache patient data for offline use',
        color: 'red',
      });
    }
  }

  async preloadCriticalData(): Promise<void> {
    try {
      // Preload reference data
      const referenceEndpoints = [
        '/api/medications/catalog',
        '/api/lab/tests',
        '/api/reference/icd10',
        '/api/reference/procedures',
      ];

      for (const endpoint of referenceEndpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            this.offlineStorage.set(endpoint, data);
          }
        } catch (error) {
          console.error(`[OfflineFHIR] Failed to preload ${endpoint}:`, error);
        }
      }

      console.log('[OfflineFHIR] Critical data preloaded');
    } catch (error) {
      console.error('[OfflineFHIR] Failed to preload critical data:', error);
    }
  }

  // Offline status methods

  isOffline(): boolean {
    return !navigator.onLine;
  }

  async getOfflineStorageSize(): Promise<number> {
    const stats = await indexedDBService.getStorageStats();
    return stats.totalRecords;
  }

  async clearOfflineStorage(): Promise<void> {
    try {
      // Clear IndexedDB
      await indexedDBService.clearAllData();
      
      // Clear service worker caches
      await serviceWorkerManager.clearCache();
      
      // Clear encryption keys
      encryptionService.clear();
      
      notifications.show({
        title: 'Cache Cleared',
        message: 'All offline data has been removed',
        color: 'yellow',
      });
    } catch (error) {
      console.error('[OfflineFHIR] Failed to clear offline storage:', error);
      throw error;
    }
  }

  async getOfflineStatus(): Promise<{
    isOffline: boolean;
    cachedItems: number;
    pendingSync: number;
    cacheStatus: any;
    storageStats: any;
    syncStatus: any;
  }> {
    const [cacheStatus, storageStats, syncStatus] = await Promise.all([
      serviceWorkerManager.getCacheStatus(),
      indexedDBService.getStorageStats(),
      this.offlineSyncService?.getSyncStatus()
    ]);
    
    return {
      isOffline: this.isOffline(),
      cachedItems: storageStats.totalRecords,
      pendingSync: syncStatus?.pendingChanges || 0,
      cacheStatus,
      storageStats,
      syncStatus
    };
  }
}

// Export singleton instance
export const offlineFhirService = new OfflineFHIRService();

// Export hook for React components
export function useOfflineFHIR() {
  return {
    service: offlineFhirService,
    isOffline: offlineFhirService.isOffline(),
    cachePatient: offlineFhirService.cachePatientData.bind(offlineFhirService),
    preloadData: offlineFhirService.preloadCriticalData.bind(offlineFhirService),
    getStatus: offlineFhirService.getOfflineStatus.bind(offlineFhirService),
    clearCache: offlineFhirService.clearOfflineStorage.bind(offlineFhirService),
  };
}