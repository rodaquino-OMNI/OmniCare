import { Patient, AllergyIntolerance, Condition, MedicationRequest, Encounter, Observation } from '@medplum/fhirtypes';
import { patientHelpers } from '@/lib/medplum';
import { useOfflineStore } from '@/stores/offline';

// Simple EventEmitter implementation for browser
class EventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }
}

interface CachedPatientData {
  patient?: Patient;
  allergies: AllergyIntolerance[];
  conditions: Condition[];
  medications: MedicationRequest[];
  encounters: Encounter[];
  vitals: Observation[];
  labs: Observation[];
  timestamp: string;
  resumeMetadata?: {
    operationId: string;
    isPartial: boolean;
    lastUpdatedField: string;
    resumeToken?: string;
  };
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  lastCleanup: Date;
}

interface CacheSizeInfo {
  totalSize: number;
  patientCount: number;
  maxSize: number;
  utilizationPercentage: number;
}

interface GetPatientOptions {
  includeRelated?: boolean;
  forceRefresh?: boolean;
}

class PatientCacheService extends EventEmitter {
  private cache: Map<string, CachedPatientData> = new Map();
  private readonly CACHE_KEY_PREFIX = 'patient_data:';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased for better resume)
  private readonly MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB
  private sessionRestored = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    lastCleanup: new Date()
  };

  /**
   * Get patient with cache support
   */
  async getPatient(patientId: string, options: GetPatientOptions = {}): Promise<Patient | null> {
    const { includeRelated = false, forceRefresh = false } = options;
    
    // Ensure session is restored
    await this.ensureSessionRestored();
    
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.patient) {
        this.stats.hits++;
        this.updateHitRate();
        
        // Update access time for resume capabilities
        await this.updateAccessTime(patientId);
        
        return cached.patient;
      }
    }

    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const patient = await patientHelpers.getPatient(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { patient: patient ?? undefined });
    
    if (includeRelated) {
      // Pre-fetch related data
      await Promise.all([
        this.getPatientAllergies(patientId, forceRefresh),
        this.getPatientConditions(patientId, forceRefresh),
        this.getPatientMedications(patientId, forceRefresh),
        this.getPatientEncounters(patientId, forceRefresh)
      ]);
    }
    
    return patient;
  }

  /**
   * Get patient allergies with cache support
   */
  async getPatientAllergies(patientId: string, forceRefresh = false): Promise<AllergyIntolerance[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.allergies) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.allergies;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const allergies = await patientHelpers.getAllergies(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { allergies });
    
    return allergies;
  }

  /**
   * Get patient conditions with cache support
   */
  async getPatientConditions(patientId: string, forceRefresh = false): Promise<Condition[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.conditions) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.conditions;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const conditions = await patientHelpers.getConditions(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { conditions });
    
    return conditions;
  }

  /**
   * Get patient medications with cache support
   */
  async getPatientMedications(patientId: string, forceRefresh = false): Promise<MedicationRequest[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.medications) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.medications;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const medications = await patientHelpers.getMedications(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { medications });
    
    return medications;
  }

  /**
   * Get patient encounters with cache support
   */
  async getPatientEncounters(patientId: string, forceRefresh = false): Promise<Encounter[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.encounters) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.encounters;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const encounters = await patientHelpers.getEncounters(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { encounters });
    
    return encounters;
  }

  /**
   * Get patient vital signs with cache support
   */
  async getPatientVitalSigns(patientId: string, forceRefresh = false): Promise<Observation[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.vitals) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.vitals;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const vitals = await patientHelpers.getVitalSigns(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { vitals });
    
    return vitals;
  }

  /**
   * Get patient lab results with cache support
   */
  async getPatientLabResults(patientId: string, forceRefresh = false): Promise<Observation[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedPatientData(patientId);
      if (cached?.labs) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.labs;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Fetch from server
    const labs = await patientHelpers.getLabResults(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { labs });
    
    return labs;
  }

  /**
   * Batch get patients
   */
  async batchGetPatients(patientIds: string[]): Promise<void> {
    const promises = patientIds.map(id => 
      this.getPatient(id, { includeRelated: true }).catch(err => {
        console.error(`Failed to prefetch patient ${id}:`, err);
        return null;
      })
    );
    
    await Promise.all(promises);
  }

  /**
   * Batch get patients with resume capability
   */
  async batchGetPatientsWithResume(
    patientIds: string[],
    batchId: string,
    batchSize: number = 5,
    resumeFromIndex?: number
  ): Promise<{
    completed: string[];
    failed: string[];
    resumeIndex?: number;
    isComplete: boolean;
    progress: number;
  }> {
    const startIndex = resumeFromIndex || 0;
    const completed: string[] = [];
    const failed: string[] = [];
    
    console.log(`Starting batch patient cache with resume: ${batchId}, from index: ${startIndex}`);
    
    for (let i = startIndex; i < patientIds.length; i += batchSize) {
      try {
        const batch = patientIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (patientId) => {
          try {
            await this.getPatient(patientId, { includeRelated: true });
            completed.push(patientId);
            return patientId;
          } catch (error) {
            console.error(`Failed to cache patient ${patientId}:`, error);
            failed.push(patientId);
            throw error;
          }
        });
        
        await Promise.allSettled(batchPromises);
        
        // Save progress checkpoint
        this.saveCacheProgress(batchId, i + batchSize, patientIds.length);
        
        console.log(`Batch cache progress: ${i + batchSize}/${patientIds.length} for ${batchId}`);
      } catch (error) {
        console.error(`Batch cache failed at index ${i} for ${batchId}:`, error);
        
        const progress = (i / patientIds.length) * 100;
        return {
          completed,
          failed,
          resumeIndex: i,
          isComplete: false,
          progress
        };
      }
    }
    
    // Clear progress checkpoint on completion
    this.clearCacheProgress(batchId);
    
    const progress = 100;
    console.log(`Batch cache completed: ${batchId}, cached: ${completed.length}, failed: ${failed.length}`);
    
    return {
      completed,
      failed,
      isComplete: true,
      progress
    };
  }

  /**
   * Resume interrupted cache operation
   */
  async resumeCacheOperation(batchId: string): Promise<{
    canResume: boolean;
    resumeIndex?: number;
    patientIds?: string[];
    progress?: number;
  }> {
    const progressData = this.getCacheProgress(batchId);
    
    if (!progressData) {
      return { canResume: false };
    }
    
    const { resumeIndex, totalCount, patientIds } = progressData;
    const progress = (resumeIndex / totalCount) * 100;
    
    return {
      canResume: true,
      resumeIndex,
      patientIds,
      progress
    };
  }

  /**
   * Save cache operation progress
   */
  private saveCacheProgress(
    batchId: string,
    resumeIndex: number,
    totalCount: number,
    patientIds?: string[]
  ): void {
    if (typeof window === 'undefined') return;

    try {
      const progressData = {
        batchId,
        resumeIndex,
        totalCount,
        patientIds,
        timestamp: Date.now()
      };
      
      localStorage.setItem(
        `cache-progress-${batchId}`,
        JSON.stringify(progressData)
      );
      
      console.log(`Cache progress saved for ${batchId}: ${resumeIndex}/${totalCount}`);
    } catch (error) {
      console.error('Failed to save cache progress:', error);
    }
  }

  /**
   * Get cache operation progress
   */
  private getCacheProgress(batchId: string): any {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(`cache-progress-${batchId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load cache progress:', error);
      return null;
    }
  }

  /**
   * Clear cache operation progress
   */
  private clearCacheProgress(batchId: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(`cache-progress-${batchId}`);
      console.log(`Cache progress cleared for ${batchId}`);
    } catch (error) {
      console.error('Failed to clear cache progress:', error);
    }
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
      patient: data.patient || existing?.patient,
      allergies: data.allergies || existing?.allergies || [],
      conditions: data.conditions || existing?.conditions || [],
      medications: data.medications || existing?.medications || [],
      encounters: data.encounters || existing?.encounters || [],
      vitals: data.vitals || existing?.vitals || [],
      labs: data.labs || existing?.labs || [],
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
   * Invalidate cache for a specific patient
   */
  async invalidatePatient(patientId: string): Promise<void> {
    await this.clearPatientCache(patientId);
    this.emit('cache:invalidated', { patientId });
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
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    await this.clearAllCache();
    this.emit('cache:cleared');
  }

  /**
   * Clear all patient cache
   */
  async clearAllCache(): Promise<void> {
    this.cache.clear();
    this.stats.evictions += this.cache.size;
    
    // Clear IndexedDB entries
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
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          db.close();
          resolve();
        };
        
        clearRequest.onerror = () => {
          db.close();
          reject(clearRequest.error);
        };
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size information
   */
  getCacheSizeInfo(): CacheSizeInfo {
    let totalSize = 0;
    
    // Calculate approximate size
    this.cache.forEach(data => {
      totalSize += JSON.stringify(data).length;
    });
    
    return {
      totalSize,
      patientCount: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      utilizationPercentage: (totalSize / this.MAX_CACHE_SIZE) * 100
    };
  }

  /**
   * Warm up cache
   */
  async warmupCache(patientIds: string[]): Promise<void> {
    await this.batchGetPatients(patientIds);
    this.emit('cache:warmed-up', { count: patientIds.length });
  }

  /**
   * Warm up cache with resume capability
   */
  async warmupCacheWithResume(
    patientIds: string[],
    batchId?: string,
    resumeFromIndex?: number
  ): Promise<{
    completed: string[];
    failed: string[];
    isComplete: boolean;
    progress: number;
  }> {
    const actualBatchId = batchId || `warmup-${Date.now()}`;
    
    const result = await this.batchGetPatientsWithResume(
      patientIds,
      actualBatchId,
      5, // Batch size of 5 for cache warmup
      resumeFromIndex
    );
    
    if (result.isComplete) {
      this.emit('cache:warmed-up', { 
        count: result.completed.length,
        failed: result.failed.length,
        batchId: actualBatchId
      });
    } else {
      this.emit('cache:warmup-paused', {
        completed: result.completed.length,
        failed: result.failed.length,
        resumeIndex: result.resumeIndex,
        progress: result.progress,
        batchId: actualBatchId
      });
    }
    
    return result;
  }

  /**
   * Export cache state
   */
  async exportCacheState(): Promise<any> {
    await this.ensureSessionRestored();
    
    const state: any = {
      stats: this.getStats(),
      sizeInfo: this.getCacheSizeInfo(),
      patients: [],
      sessionInfo: {
        restored: this.sessionRestored,
        lastActivity: Date.now()
      }
    };
    
    for (const [patientId, data] of this.cache.entries()) {
      state.patients.push({
        id: patientId,
        patientId,
        hasPatient: !!data.patient,
        allergiesCount: data.allergies.length,
        conditionsCount: data.conditions.length,
        medicationsCount: data.medications.length,
        encountersCount: data.encounters.length,
        vitalsCount: data.vitals.length,
        labsCount: data.labs.length,
        timestamp: data.timestamp,
        size: JSON.stringify(data).length,
        accessCount: await this.getAccessCount(patientId),
        lastAccessed: await this.getLastAccessTime(patientId)
      });
    }
    
    return state;
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Invalidate related data for a patient
   */
  async invalidateRelatedData(patientId: string, dataType: string): Promise<void> {
    const cached = await this.getCachedPatientData(patientId);
    if (!cached) return;

    // Clear specific data type
    switch (dataType) {
      case 'vitals':
        cached.vitals = [];
        break;
      case 'labs':
        cached.labs = [];
        break;
      case 'medications':
        cached.medications = [];
        break;
      case 'allergies':
        cached.allergies = [];
        break;
      case 'conditions':
        cached.conditions = [];
        break;
      case 'encounters':
        cached.encounters = [];
        break;
    }

    // Update cache with cleared data
    await this.cachePatientData(patientId, cached);
    this.emit('cache:related-invalidated', { patientId, dataType });
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
   * Ensure session is restored from previous browser session
   */
  private async ensureSessionRestored(): Promise<void> {
    if (this.sessionRestored) return;
    
    try {
      await this.restoreSession();
      this.sessionRestored = true;
    } catch (error) {
      console.error('Failed to restore cache session:', error);
      this.sessionRestored = true; // Prevent retry loops
    }
  }
  
  /**
   * Restore cache session from IndexedDB
   */
  private async restoreSession(): Promise<void> {
    if (!('indexedDB' in window)) return;
    
    try {
      // Restore recently accessed patients
      const recentPatients = await this.getRecentlyAccessedPatients();
      
      for (const patientId of recentPatients) {
        const cached = await this.getCachedPatientData(patientId);
        if (cached && this.isCacheValid(cached.timestamp)) {
          // Pre-load into memory cache for fast access
          this.cache.set(patientId, cached);
        }
      }
      
      console.log(`Restored ${this.cache.size} patients to memory cache`);
    } catch (error) {
      console.error('Failed to restore session from IndexedDB:', error);
    }
  }
  
  /**
   * Get recently accessed patients for session restoration
   */
  private async getRecentlyAccessedPatients(): Promise<string[]> {
    try {
      const accessData = localStorage.getItem('patient_access_log');
      if (accessData) {
        const log = JSON.parse(accessData);
        const recentThreshold = Date.now() - (2 * 60 * 60 * 1000); // 2 hours
        
        return Object.entries(log)
          .filter(([_, time]) => (time as number) > recentThreshold)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 10) // Top 10 recent patients
          .map(([patientId]) => patientId);
      }
    } catch (error) {
      console.error('Failed to get recently accessed patients:', error);
    }
    
    return [];
  }
  
  /**
   * Update access time for patient
   */
  private async updateAccessTime(patientId: string): Promise<void> {
    try {
      const accessData = localStorage.getItem('patient_access_log') || '{}';
      const log = JSON.parse(accessData);
      log[patientId] = Date.now();
      localStorage.setItem('patient_access_log', JSON.stringify(log));
    } catch (error) {
      console.error('Failed to update access time:', error);
    }
  }
  
  /**
   * Get access count for patient
   */
  private async getAccessCount(patientId: string): Promise<number> {
    try {
      const countData = localStorage.getItem('patient_access_count') || '{}';
      const counts = JSON.parse(countData);
      return counts[patientId] || 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Get last access time for patient
   */
  private async getLastAccessTime(patientId: string): Promise<string> {
    try {
      const accessData = localStorage.getItem('patient_access_log') || '{}';
      const log = JSON.parse(accessData);
      const time = log[patientId];
      return time ? new Date(time).toISOString() : 'Never';
    } catch (error) {
      return 'Unknown';
    }
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