import { FHIRService, fhirService as baseFhirService } from './fhir.service';
import { serviceWorkerManager, offlineApiCall } from '@/lib/service-worker';
import { Bundle, Patient, Resource } from '@medplum/fhirtypes';
import { showNotification } from '@mantine/notifications';

/**
 * Offline-aware FHIR Service
 * Extends the base FHIR service with offline capabilities
 */
export class OfflineFHIRService extends FHIRService {
  private offlineStorage: Map<string, any> = new Map();

  constructor(baseURL?: string) {
    super(baseURL);
    this.setupOfflineHandlers();
  }

  private setupOfflineHandlers() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  private handleOnline() {
    // Sync any pending changes when back online
    this.syncPendingChanges();
  }

  private handleOffline() {
    console.log('[OfflineFHIR] Switched to offline mode');
  }

  private async syncPendingChanges() {
    // Get pending changes from IndexedDB/localStorage
    const pendingChanges = this.getPendingChanges();
    
    for (const change of pendingChanges) {
      try {
        await this.processPendingChange(change);
      } catch (error) {
        console.error('[OfflineFHIR] Failed to sync change:', error);
      }
    }
  }

  private getPendingChanges(): any[] {
    // TODO: Implement IndexedDB storage for pending changes
    return [];
  }

  private async processPendingChange(change: any) {
    // Process individual pending change
    switch (change.type) {
      case 'create':
        await super.createResource(change.resource);
        break;
      case 'update':
        await super.updateResource(change.resource);
        break;
      case 'delete':
        await super.deleteResource(change.resourceType, change.id);
        break;
    }
  }

  // Override methods with offline support

  async getPatient(patientId: string): Promise<Patient> {
    return offlineApiCall(
      () => super.getPatient(patientId),
      async () => {
        // Try to get from offline storage
        const cached = this.offlineStorage.get(`Patient/${patientId}`);
        if (cached) {
          showNotification({
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
        // Return cached patient list
        const cachedBundle = this.offlineStorage.get('PatientBundle');
        if (cachedBundle) {
          showNotification({
            title: 'Offline Mode',
            message: 'Showing cached patient list',
            color: 'orange',
          });
          return cachedBundle;
        }
        
        // Return empty bundle if no cache
        return {
          resourceType: 'Bundle',
          type: 'searchset',
          total: ResourceHistoryTable,
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
      const tempId = `temp-${Date.now()}`;
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

      // Store locally
      this.offlineStorage.set(`${resource.resourceType}/${tempId}`, offlineResource);

      // Queue for sync
      await serviceWorkerManager.queueForSync({
        url: `/fhir/R4/${resource.resourceType}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        body: JSON.stringify(resource),
        resource: resource.resourceType,
      });

      showNotification({
        title: 'Saved Offline',
        message: `${resource.resourceType} will be synced when connection is restored`,
        color: 'blue',
      });

      return offlineResource as T;
    }

    return super.createResource(resource);
  }

  async updateResource<T extends Resource>(resource: T): Promise<T> {
    if (!navigator.onLine) {
      // Store update locally
      this.offlineStorage.set(`${resource.resourceType}/${resource.id}`, resource);

      // Queue for sync
      await serviceWorkerManager.queueForSync({
        url: `/fhir/R4/${resource.resourceType}/${resource.id}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        body: JSON.stringify(resource),
        resource: resource.resourceType,
      });

      showNotification({
        title: 'Updated Offline',
        message: `${resource.resourceType} changes will be synced when online`,
        color: 'blue',
      });

      return resource;
    }

    return super.updateResource(resource);
  }

  // Proactive caching methods

  async cachePatientData(patientId: string): Promise<void> {
    try {
      // Cache patient demographics
      const patient = await super.getPatient(patientId);
      this.offlineStorage.set(`Patient/${patientId}`, patient);

      // Cache related resources
      const [vitals, medications, conditions, allergies] = await Promise.all([
        super.getPatientVitalSigns(patientId).catch(() => null),
        super.getPatientMedications(patientId).catch(() => null),
        super.getPatientConditions(patientId).catch(() => null),
        super.getPatientAllergies(patientId).catch(() => null),
      ]);

      if (vitals) this.offlineStorage.set(`Vitals/${patientId}`, vitals);
      if (medications) this.offlineStorage.set(`Medications/${patientId}`, medications);
      if (conditions) this.offlineStorage.set(`Conditions/${patientId}`, conditions);
      if (allergies) this.offlineStorage.set(`Allergies/${patientId}`, allergies);

      // Tell service worker to cache as well
      await serviceWorkerManager.cachePatientData(patientId);

      showNotification({
        title: 'Patient Data Cached',
        message: 'Patient data is now available offline',
        color: 'green',
      });
    } catch (error) {
      console.error('[OfflineFHIR] Failed to cache patient data:', error);
      showNotification({
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

  getOfflineStorageSize(): number {
    return this.offlineStorage.size;
  }

  clearOfflineStorage(): void {
    this.offlineStorage.clear();
    serviceWorkerManager.clearCache();
  }

  async getOfflineStatus(): Promise<{
    isOffline: boolean;
    cachedItems: number;
    pendingSync: number;
    cacheStatus: any;
  }> {
    const cacheStatus = await serviceWorkerManager.getCacheStatus();
    
    return {
      isOffline: this.isOffline(),
      cachedItems: this.offlineStorage.size,
      pendingSync: this.getPendingChanges().length,
      cacheStatus,
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