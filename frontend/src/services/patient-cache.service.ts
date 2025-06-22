import { Patient, AllergyIntolerance, Condition } from '@medplum/fhirtypes';
import { patientHelpers } from '@/lib/medplum';
import { useOfflineStore } from '@/stores/offline';

interface CachedPatientData {
  allergies: AllergyIntolerance[];
  conditions: Condition[];
  timestamp: string;
}

class PatientCacheService {
  private cache: Map<string, CachedPatientData> = new Map();
  private readonly CACHE_KEY_PREFIX = 'patient_data:';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get patient allergies with cache support
   */
  async getPatientAllergies(patientId: string): Promise<AllergyIntolerance[]> {
    const cached = await this.getCachedPatientData(patientId);
    if (cached?.allergies) {
      return cached.allergies;
    }

    // Fetch from server
    const allergies = await patientHelpers.getAllergies(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { allergies });
    
    return allergies;
  }

  /**
   * Get patient conditions with cache support
   */
  async getPatientConditions(patientId: string): Promise<Condition[]> {
    const cached = await this.getCachedPatientData(patientId);
    if (cached?.conditions) {
      return cached.conditions;
    }

    // Fetch from server
    const conditions = await patientHelpers.getConditions(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { conditions });
    
    return conditions;
  }

  /**
   * Get cached patient data
   */
  async getCachedPatientData(patientId: string): Promise<CachedPatientData | null> {
    // Check memory cache first
    const memoryCache = this.cache.get(patientId);
    if (memoryCache && this.isCacheValid(memoryCache.timestamp)) {
      return memoryCache;
    }

    // Check IndexedDB
    try {
      const key = `${this.CACHE_KEY_PREFIX}${patientId}`;
      const stored = await this.getFromIndexedDB(key);
      
      if (stored && this.isCacheValid(stored.timestamp)) {
        // Update memory cache
        this.cache.set(patientId, stored);
        return stored;
      }
    } catch (error) {
      console.error('Error retrieving from cache:', error);
    }

    return null;
  }

  /**
   * Cache patient data
   */
  async cachePatientData(patientId: string, data: Partial<CachedPatientData>): Promise<void> {
    const existing = await this.getCachedPatientData(patientId);
    
    const updated: CachedPatientData = {
      allergies: data.allergies || existing?.allergies || [],
      conditions: data.conditions || existing?.conditions || [],
      timestamp: new Date().toISOString()
    };

    // Update memory cache
    this.cache.set(patientId, updated);

    // Update IndexedDB
    try {
      const key = `${this.CACHE_KEY_PREFIX}${patientId}`;
      await this.saveToIndexedDB(key, updated);
      
      // Update offline store metadata
      const offlineStore = useOfflineStore.getState();
      offlineStore.addCacheMetadata(`patient:${patientId}`, {
        lastSynced: updated.timestamp,
        size: JSON.stringify(updated).length,
        version: '1.0',
        isCached: true,
        isStale: false
      });
    } catch (error) {
      console.error('Error caching patient data:', error);
    }
  }

  /**
   * Clear cache for a specific patient
   */
  async clearPatientCache(patientId: string): Promise<void> {
    this.cache.delete(patientId);
    
    try {
      const key = `${this.CACHE_KEY_PREFIX}${patientId}`;
      await this.deleteFromIndexedDB(key);
      
      // Remove from offline store metadata
      const offlineStore = useOfflineStore.getState();
      offlineStore.removeCacheMetadata(`patient:${patientId}`);
    } catch (error) {
      console.error('Error clearing patient cache:', error);
    }
  }

  /**
   * Clear all patient cache
   */
  async clearAllCache(): Promise<void> {
    this.cache.clear();
    
    // Clear IndexedDB entries
    // This would be implemented based on your IndexedDB structure
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(timestamp: string): boolean {
    const cacheTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    return (now - cacheTime) < this.CACHE_DURATION;
  }

  /**
   * Save data to IndexedDB
   */
  private async saveToIndexedDB(key: string, data: any): Promise<void> {
    if (!('indexedDB' in window)) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareCache', 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('patientData')) {
          db.createObjectStore('patientData');
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['patientData'], 'readwrite');
        const store = transaction.objectStore('patientData');
        
        const putRequest = store.put(data, key);
        
        putRequest.onsuccess = () => {
          db.close();
          resolve();
        };
        
        putRequest.onerror = () => {
          db.close();
          reject(putRequest.error);
        };
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get data from IndexedDB
   */
  private async getFromIndexedDB(key: string): Promise<any> {
    if (!('indexedDB' in window)) return null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareCache', 1);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('patientData')) {
          db.close();
          resolve(null);
          return;
        }

        const transaction = db.transaction(['patientData'], 'readonly');
        const store = transaction.objectStore('patientData');
        
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result);
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete data from IndexedDB
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!('indexedDB' in window)) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OmniCareCache', 1);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('patientData')) {
          db.close();
          resolve();
          return;
        }

        const transaction = db.transaction(['patientData'], 'readwrite');
        const store = transaction.objectStore('patientData');
        
        const deleteRequest = store.delete(key);
        
        deleteRequest.onsuccess = () => {
          db.close();
          resolve();
        };
        
        deleteRequest.onerror = () => {
          db.close();
          reject(deleteRequest.error);
        };
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const patientCacheService = new PatientCacheService();