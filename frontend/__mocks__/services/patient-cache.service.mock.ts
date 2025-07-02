import { 
  Patient, 
  AllergyIntolerance, 
  Condition, 
  MedicationRequest, 
  Encounter, 
  Observation 
} from '@medplum/fhirtypes';
import { createMockPatient, createMockPatientData } from './mock-data-generators';

// Types from original service
interface CachedPatientData {
  patient?: Patient;
  allergies: AllergyIntolerance[];
  conditions: Condition[];
  medications: MedicationRequest[];
  encounters: Encounter[];
  vitals: Observation[];
  labs: Observation[];
  timestamp: string;
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

// Simple EventEmitter for mock
class MockEventEmitter {
  private listeners = new Map<string, Function[]>();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }
}

export class MockPatientCacheService extends MockEventEmitter {
  private cache: Map<string, CachedPatientData> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    lastCleanup: new Date()
  };

  // Mock data generator
  private mockDataCache: Map<string, any> = new Map();

  async getPatient(patientId: string, options: GetPatientOptions = {}): Promise<Patient | null> {
    const { forceRefresh = false } = options;
    
    if (!forceRefresh && this.cache.has(patientId)) {
      this.stats.hits++;
      this.updateHitRate();
      const cached = this.cache.get(patientId)!;
      return cached.patient || null;
    }

    this.stats.misses++;
    this.updateHitRate();

    // Generate mock patient data
    const patient = this.getMockPatient(patientId);
    
    // Cache the data
    await this.cachePatientData(patientId, { patient });
    
    return patient;
  }

  async getPatientAllergies(patientId: string, forceRefresh = false): Promise<AllergyIntolerance[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(patientId);
      if (cached?.allergies && cached.allergies.length > 0) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.allergies;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Generate mock data
    const allergies = this.getMockAllergies(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { allergies });
    
    return allergies;
  }

  async getPatientConditions(patientId: string, forceRefresh = false): Promise<Condition[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(patientId);
      if (cached?.conditions && cached.conditions.length > 0) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.conditions;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Generate mock data
    const conditions = this.getMockConditions(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { conditions });
    
    return conditions;
  }

  async getPatientMedications(patientId: string, forceRefresh = false): Promise<MedicationRequest[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(patientId);
      if (cached?.medications && cached.medications.length > 0) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.medications;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Generate mock data
    const medications = this.getMockMedications(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { medications });
    
    return medications;
  }

  async getPatientEncounters(patientId: string, forceRefresh = false): Promise<Encounter[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(patientId);
      if (cached?.encounters && cached.encounters.length > 0) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.encounters;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Generate mock data
    const encounters = this.getMockEncounters(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { encounters });
    
    return encounters;
  }

  async getPatientVitalSigns(patientId: string, forceRefresh = false): Promise<Observation[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(patientId);
      if (cached?.vitals && cached.vitals.length > 0) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.vitals;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Generate mock data
    const vitals = this.getMockVitalSigns(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { vitals });
    
    return vitals;
  }

  async getPatientLabResults(patientId: string, forceRefresh = false): Promise<Observation[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(patientId);
      if (cached?.labs && cached.labs.length > 0) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.labs;
      }
    }
    
    this.stats.misses++;
    this.updateHitRate();

    // Generate mock data
    const labs = this.getMockLabResults(patientId);
    
    // Update cache
    await this.cachePatientData(patientId, { labs });
    
    return labs;
  }

  async batchGetPatients(patientIds: string[]): Promise<void> {
    await Promise.all(
      patientIds.map(id => this.getPatient(id, { includeRelated: true }))
    );
  }

  async getCachedPatientData(patientId: string): Promise<CachedPatientData | null> {
    return this.cache.get(patientId) || null;
  }

  async cachePatientData(patientId: string, data: Partial<CachedPatientData>): Promise<void> {
    const existing = this.cache.get(patientId);
    
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

    this.cache.set(patientId, updated);
  }

  async invalidatePatient(patientId: string): Promise<void> {
    await this.clearPatientCache(patientId);
    this.emit('cache:invalidated', { patientId });
  }

  async clearPatientCache(patientId: string): Promise<void> {
    this.cache.delete(patientId);
    this.mockDataCache.delete(patientId);
  }

  async clearAll(): Promise<void> {
    await this.clearAllCache();
    this.emit('cache:cleared');
  }

  async clearAllCache(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.mockDataCache.clear();
    this.stats.evictions += size;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getCacheSizeInfo(): CacheSizeInfo {
    let totalSize = 0;
    
    // Estimate size (simplified)
    this.cache.forEach(data => {
      totalSize += JSON.stringify(data).length;
    });
    
    return {
      totalSize,
      patientCount: this.cache.size,
      maxSize: 10 * 1024 * 1024, // 10MB
      utilizationPercentage: (totalSize / (10 * 1024 * 1024)) * 100
    };
  }

  async warmupCache(patientIds: string[]): Promise<void> {
    await this.batchGetPatients(patientIds);
    this.emit('cache:warmed-up', { count: patientIds.length });
  }

  async exportCacheState(): Promise<any> {
    const state: any = {
      stats: this.getStats(),
      sizeInfo: this.getCacheSizeInfo(),
      patients: []
    };
    
    const entries = Array.from(this.cache.entries());
    for (const [patientId, data] of entries) {
      state.patients.push({
        patientId,
        hasPatient: !!data.patient,
        allergiesCount: data.allergies.length,
        conditionsCount: data.conditions.length,
        medicationsCount: data.medications.length,
        encountersCount: data.encounters.length,
        vitalsCount: data.vitals.length,
        labsCount: data.labs.length,
        timestamp: data.timestamp
      });
    }
    
    return state;
  }

  async invalidateRelatedData(patientId: string, dataType: string): Promise<void> {
    const cached = this.cache.get(patientId);
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

    await this.cachePatientData(patientId, cached);
    this.emit('cache:related-invalidated', { patientId, dataType });
  }

  // Helper methods for generating mock data
  private getMockPatient(patientId: string): Patient {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).patient;
  }

  private getMockAllergies(patientId: string): AllergyIntolerance[] {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).allergies;
  }

  private getMockConditions(patientId: string): Condition[] {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).conditions;
  }

  private getMockMedications(patientId: string): MedicationRequest[] {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).medications;
  }

  private getMockEncounters(patientId: string): Encounter[] {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).encounters;
  }

  private getMockVitalSigns(patientId: string): Observation[] {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).vitals;
  }

  private getMockLabResults(patientId: string): Observation[] {
    if (!this.mockDataCache.has(patientId)) {
      this.mockDataCache.set(patientId, createMockPatientData(patientId));
    }
    return this.mockDataCache.get(patientId).labs;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// Export singleton instance
export const patientCacheService = new MockPatientCacheService();