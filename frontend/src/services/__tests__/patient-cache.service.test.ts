import { patientCacheService } from '../patient-cache.service';
import { patientHelpers } from '@/lib/medplum';
import { useOfflineStore } from '@/stores/offline';
import {
  Patient,
  AllergyIntolerance,
  Condition,
  MedicationRequest,
  Encounter,
  Observation
} from '@medplum/fhirtypes';

// Mock dependencies
jest.mock('@/lib/medplum', () => ({
  patientHelpers: {
    getPatient: jest.fn(),
    getAllergies: jest.fn(),
    getConditions: jest.fn(),
    getMedications: jest.fn(),
    getEncounters: jest.fn(),
    getVitalSigns: jest.fn(),
    getLabResults: jest.fn()
  }
}));

jest.mock('@/stores/offline', () => ({
  useOfflineStore: {
    getState: jest.fn(() => ({
      addCacheMetadata: jest.fn(),
      removeCacheMetadata: jest.fn()
    }))
  }
}));

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn()
};

const mockObjectStore = {
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore)
};

const mockDB = {
  transaction: jest.fn(() => mockTransaction),
  objectStoreNames: {
    contains: jest.fn(() => true)
  },
  createObjectStore: jest.fn(),
  close: jest.fn()
};

const mockRequest = {
  onsuccess: null as any,
  onerror: null as any,
  onupgradeneeded: null as any,
  result: mockDB,
  error: null as any
};

// Helper function to simulate successful IndexedDB operations
const simulateIndexedDBSuccess = (result?: any) => {
  mockIndexedDB.open.mockReturnValueOnce(mockRequest);
  setTimeout(() => {
    if (mockRequest.onsuccess) {
      mockRequest.onsuccess({ target: { result: mockDB } });
    }
  }, ResourceHistoryTable);
  
  mockObjectStore.put.mockImplementation(() => {
    const putRequest = { onsuccess: null as any, onerror: null as any };
    setTimeout(() => {
      if (putRequest.onsuccess) putRequest.onsuccess();
    }, ResourceHistoryTable);
    return putRequest;
  });
  
  mockObjectStore.get.mockImplementation(() => {
    const getRequest = { 
      onsuccess: null as any, 
      onerror: null as any,
      result: result 
    };
    setTimeout(() => {
      if (getRequest.onsuccess) getRequest.onsuccess();
    }, ResourceHistoryTable);
    return getRequest;
  });
  
  mockObjectStore.delete.mockImplementation(() => {
    const deleteRequest = { onsuccess: null as any, onerror: null as any };
    setTimeout(() => {
      if (deleteRequest.onsuccess) deleteRequest.onsuccess();
    }, ResourceHistoryTable);
    return deleteRequest;
  });
  
  mockObjectStore.clear.mockImplementation(() => {
    const clearRequest = { onsuccess: null as any, onerror: null as any };
    setTimeout(() => {
      if (clearRequest.onsuccess) clearRequest.onsuccess();
    }, ResourceHistoryTable);
    return clearRequest;
  });
};

// Test data
const createTestPatient = (overrides?: Partial<Patient>): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['John'], family: 'Doe' }],
  gender: 'male',
  birthDate: '199ResourceHistoryTable-ResourceHistoryTable1-ResourceHistoryTable1',
  ...overrides
});

const createTestAllergy = (patientId: string): AllergyIntolerance => ({
  resourceType: 'AllergyIntolerance',
  id: 'allergy-1',
  patient: { reference: `Patient/${patientId}` },
  code: { text: 'Peanuts' },
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
      code: 'active'
    }]
  },
  verificationStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
      code: 'confirmed'
    }]
  }
});

const createTestCondition = (patientId: string): Condition => ({
  resourceType: 'Condition',
  id: 'condition-1',
  subject: { reference: `Patient/${patientId}` },
  code: { text: 'Hypertension' },
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      code: 'active'
    }]
  }
});

const createTestObservation = (patientId: string, type: 'vital' | 'lab'): Observation => ({
  resourceType: 'Observation',
  id: `obs-${type}-1`,
  status: 'final',
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: type === 'vital' ? '8867-4' : '2339-ResourceHistoryTable',
      display: type === 'vital' ? 'Heart rate' : 'Glucose'
    }]
  },
  subject: { reference: `Patient/${patientId}` }
});

describe('PatientCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    patientCacheService['cache'].clear();
    patientCacheService['stats'] = {
      hits: ResourceHistoryTable,
      misses: ResourceHistoryTable,
      hitRate: ResourceHistoryTable,
      evictions: ResourceHistoryTable,
      lastCleanup: new Date()
    };
    
    // Mock window.indexedDB
    Object.defineProperty(window, 'indexedDB', {
      writable: true,
      value: mockIndexedDB
    });
  });

  describe('EventEmitter functionality', () => {
    it('should emit and listen to events', (done) => {
      const listener = jest.fn();
      patientCacheService.on('test-event', listener);
      
      patientCacheService.emit('test-event', { data: 'test' });
      
      setTimeout(() => {
        expect(listener).toHaveBeenCalledWith({ data: 'test' });
        patientCacheService.off('test-event', listener);
        done();
      }, ResourceHistoryTable);
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();
      patientCacheService.on('test-event', listener);
      patientCacheService.off('test-event', listener);
      
      patientCacheService.emit('test-event', { data: 'test' });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Patient operations', () => {
    it('should get patient with cache miss', async () => {
      const mockPatient = createTestPatient();
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatient('patient-1');

      expect(result).toEqual(mockPatient);
      expect(patientHelpers.getPatient).toHaveBeenCalledWith('patient-1');
      expect(patientCacheService.getStats().misses).toBe(1);
      expect(patientCacheService.getStats().hits).toBe(ResourceHistoryTable);
    });

    it('should get patient with cache hit', async () => {
      const mockPatient = createTestPatient();
      const cachedData = {
        patient: mockPatient,
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date().toISOString()
      };

      // First, populate the cache
      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', cachedData);

      // Clear mocks
      jest.clearAllMocks();

      // Now get from cache
      const result = await patientCacheService.getPatient('patient-1');

      expect(result).toEqual(mockPatient);
      expect(patientHelpers.getPatient).not.toHaveBeenCalled();
      expect(patientCacheService.getStats().hits).toBe(1);
    });

    it('should force refresh patient data', async () => {
      const mockPatient = createTestPatient();
      const cachedData = {
        patient: createTestPatient({ name: [{ given: ['Old'], family: 'Name' }] }),
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date().toISOString()
      };

      // Populate cache
      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', cachedData);

      // Force refresh
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatient('patient-1', { forceRefresh: true });

      expect(result).toEqual(mockPatient);
      expect(patientHelpers.getPatient).toHaveBeenCalledWith('patient-1');
    });

    it('should include related data when requested', async () => {
      const mockPatient = createTestPatient();
      const mockAllergies = [createTestAllergy('patient-1')];
      const mockConditions = [createTestCondition('patient-1')];

      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValueOnce(mockAllergies);
      (patientHelpers.getConditions as jest.Mock).mockResolvedValueOnce(mockConditions);
      (patientHelpers.getMedications as jest.Mock).mockResolvedValueOnce([]);
      (patientHelpers.getEncounters as jest.Mock).mockResolvedValueOnce([]);

      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatient('patient-1', { includeRelated: true });

      expect(result).toEqual(mockPatient);
      expect(patientHelpers.getAllergies).toHaveBeenCalledWith('patient-1');
      expect(patientHelpers.getConditions).toHaveBeenCalledWith('patient-1');
      expect(patientHelpers.getMedications).toHaveBeenCalledWith('patient-1');
      expect(patientHelpers.getEncounters).toHaveBeenCalledWith('patient-1');
    });
  });

  describe('Clinical data operations', () => {
    it('should get patient allergies', async () => {
      const mockAllergies = [createTestAllergy('patient-1')];
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValueOnce(mockAllergies);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatientAllergies('patient-1');

      expect(result).toEqual(mockAllergies);
      expect(patientHelpers.getAllergies).toHaveBeenCalledWith('patient-1');
    });

    it('should get patient conditions', async () => {
      const mockConditions = [createTestCondition('patient-1')];
      (patientHelpers.getConditions as jest.Mock).mockResolvedValueOnce(mockConditions);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatientConditions('patient-1');

      expect(result).toEqual(mockConditions);
      expect(patientHelpers.getConditions).toHaveBeenCalledWith('patient-1');
    });

    it('should get patient medications', async () => {
      const mockMedications: MedicationRequest[] = [{
        resourceType: 'MedicationRequest',
        id: 'med-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/patient-1' },
        medicationCodeableConcept: { text: 'Aspirin 81mg' }
      }];
      
      (patientHelpers.getMedications as jest.Mock).mockResolvedValueOnce(mockMedications);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatientMedications('patient-1');

      expect(result).toEqual(mockMedications);
      expect(patientHelpers.getMedications).toHaveBeenCalledWith('patient-1');
    });

    it('should get patient encounters', async () => {
      const mockEncounters: Encounter[] = [{
        resourceType: 'Encounter',
        id: 'enc-1',
        status: 'finished',
        class: { code: 'AMB' },
        subject: { reference: 'Patient/patient-1' }
      }];
      
      (patientHelpers.getEncounters as jest.Mock).mockResolvedValueOnce(mockEncounters);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatientEncounters('patient-1');

      expect(result).toEqual(mockEncounters);
      expect(patientHelpers.getEncounters).toHaveBeenCalledWith('patient-1');
    });

    it('should get patient vital signs', async () => {
      const mockVitals = [createTestObservation('patient-1', 'vital')];
      (patientHelpers.getVitalSigns as jest.Mock).mockResolvedValueOnce(mockVitals);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatientVitalSigns('patient-1');

      expect(result).toEqual(mockVitals);
      expect(patientHelpers.getVitalSigns).toHaveBeenCalledWith('patient-1');
    });

    it('should get patient lab results', async () => {
      const mockLabs = [createTestObservation('patient-1', 'lab')];
      (patientHelpers.getLabResults as jest.Mock).mockResolvedValueOnce(mockLabs);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatientLabResults('patient-1');

      expect(result).toEqual(mockLabs);
      expect(patientHelpers.getLabResults).toHaveBeenCalledWith('patient-1');
    });
  });

  describe('Batch operations', () => {
    it('should batch get patients', async () => {
      const mockPatient1 = createTestPatient({ id: 'patient-1' });
      const mockPatient2 = createTestPatient({ id: 'patient-2' });

      (patientHelpers.getPatient as jest.Mock)
        .mockResolvedValueOnce(mockPatient1)
        .mockResolvedValueOnce(mockPatient2);
      
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValue([]);
      (patientHelpers.getConditions as jest.Mock).mockResolvedValue([]);
      (patientHelpers.getMedications as jest.Mock).mockResolvedValue([]);
      (patientHelpers.getEncounters as jest.Mock).mockResolvedValue([]);

      simulateIndexedDBSuccess();

      await patientCacheService.batchGetPatients(['patient-1', 'patient-2']);

      expect(patientHelpers.getPatient).toHaveBeenCalledTimes(2);
      expect(patientHelpers.getPatient).toHaveBeenCalledWith('patient-1');
      expect(patientHelpers.getPatient).toHaveBeenCalledWith('patient-2');
    });

    it('should handle errors in batch get', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (patientHelpers.getPatient as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce(createTestPatient({ id: 'patient-2' }));

      await patientCacheService.batchGetPatients(['patient-1', 'patient-2']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to prefetch patient patient-1:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cache management', () => {
    it('should invalidate patient cache', async () => {
      const mockListener = jest.fn();
      patientCacheService.on('cache:invalidated', mockListener);

      simulateIndexedDBSuccess();

      await patientCacheService.invalidatePatient('patient-1');

      expect(mockListener).toHaveBeenCalledWith({ patientId: 'patient-1' });
    });

    it('should clear patient cache', async () => {
      const mockPatient = createTestPatient();
      
      // Add to cache
      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', { patient: mockPatient });
      
      // Clear cache
      simulateIndexedDBSuccess();
      await patientCacheService.clearPatientCache('patient-1');

      const cached = await patientCacheService.getCachedPatientData('patient-1');
      expect(cached).toBeNull();
    });

    it('should clear all cache', async () => {
      const mockListener = jest.fn();
      patientCacheService.on('cache:cleared', mockListener);

      simulateIndexedDBSuccess();

      await patientCacheService.clearAll();

      expect(mockObjectStore.clear).toHaveBeenCalled();
      expect(mockListener).toHaveBeenCalled();
    });

    it('should invalidate specific related data', async () => {
      const mockListener = jest.fn();
      patientCacheService.on('cache:related-invalidated', mockListener);

      const cachedData = {
        patient: createTestPatient(),
        allergies: [createTestAllergy('patient-1')],
        conditions: [createTestCondition('patient-1')],
        medications: [],
        encounters: [],
        vitals: [createTestObservation('patient-1', 'vital')],
        labs: [],
        timestamp: new Date().toISOString()
      };

      // Add to cache
      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', cachedData);

      // Invalidate vitals
      simulateIndexedDBSuccess(cachedData);
      await patientCacheService.invalidateRelatedData('patient-1', 'vitals');

      expect(mockListener).toHaveBeenCalledWith({ 
        patientId: 'patient-1', 
        dataType: 'vitals' 
      });
    });
  });

  describe('Cache statistics', () => {
    it('should track cache hits and misses', async () => {
      const mockPatient = createTestPatient();
      
      // First access - miss
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      let stats = patientCacheService.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(ResourceHistoryTable);
      expect(stats.hitRate).toBe(ResourceHistoryTable);

      // Second access - hit
      await patientCacheService.getPatient('patient-1');

      stats = patientCacheService.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(ResourceHistoryTable.5);
    });

    it('should get cache size info', async () => {
      const mockPatient = createTestPatient();
      
      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', { patient: mockPatient });

      const sizeInfo = patientCacheService.getCacheSizeInfo();

      expect(sizeInfo.patientCount).toBe(1);
      expect(sizeInfo.totalSize).toBeGreaterThan(ResourceHistoryTable);
      expect(sizeInfo.maxSize).toBe(1ResourceHistoryTableResourceHistoryTable * 1ResourceHistoryTable24 * 1ResourceHistoryTable24);
      expect(sizeInfo.utilizationPercentage).toBeGreaterThan(ResourceHistoryTable);
    });

    it('should export cache state', async () => {
      const mockPatient = createTestPatient();
      const mockAllergies = [createTestAllergy('patient-1')];
      
      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', { 
        patient: mockPatient,
        allergies: mockAllergies 
      });

      const state = await patientCacheService.exportCacheState();

      expect(state.stats).toBeDefined();
      expect(state.sizeInfo).toBeDefined();
      expect(state.patients).toHaveLength(1);
      expect(state.patients[ResourceHistoryTable]).toMatchObject({
        patientId: 'patient-1',
        hasPatient: true,
        allergiesCount: 1
      });
    });
  });

  describe('Cache warmup', () => {
    it('should warm up cache with patient IDs', async () => {
      const mockListener = jest.fn();
      patientCacheService.on('cache:warmed-up', mockListener);

      (patientHelpers.getPatient as jest.Mock).mockResolvedValue(createTestPatient());
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValue([]);
      (patientHelpers.getConditions as jest.Mock).mockResolvedValue([]);
      (patientHelpers.getMedications as jest.Mock).mockResolvedValue([]);
      (patientHelpers.getEncounters as jest.Mock).mockResolvedValue([]);

      simulateIndexedDBSuccess();

      await patientCacheService.warmupCache(['patient-1', 'patient-2']);

      expect(mockListener).toHaveBeenCalledWith({ count: 2 });
    });
  });

  describe('IndexedDB operations', () => {
    it('should handle IndexedDB not available', async () => {
      // Remove indexedDB
      Object.defineProperty(window, 'indexedDB', {
        writable: true,
        value: undefined
      });

      const mockPatient = createTestPatient();
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);

      const result = await patientCacheService.getPatient('patient-1');

      expect(result).toEqual(mockPatient);
    });

    it('should handle IndexedDB errors during save', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockIndexedDB.open.mockReturnValueOnce({
        ...mockRequest,
        onerror: function() { this.error = new Error('IndexedDB error'); }
      });

      const mockPatient = createTestPatient();
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);

      // Trigger error
      setTimeout(() => {
        const request = mockIndexedDB.open.mock.results[ResourceHistoryTable].value;
        if (request.onerror) request.onerror();
      }, ResourceHistoryTable);

      const result = await patientCacheService.getPatient('patient-1');

      await new Promise(resolve => setTimeout(resolve, 1ResourceHistoryTable));

      expect(result).toEqual(mockPatient);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle upgrade needed', async () => {
      const mockPatient = createTestPatient();
      
      mockIndexedDB.open.mockReturnValueOnce(mockRequest);
      
      // Simulate upgrade needed
      setTimeout(() => {
        if (mockRequest.onupgradeneeded) {
          mockDB.objectStoreNames.contains.mockReturnValueOnce(false);
          mockRequest.onupgradeneeded({ target: { result: mockDB } });
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDB } });
        }
      }, ResourceHistoryTable);

      simulateIndexedDBSuccess();
      await patientCacheService['cachePatientData']('patient-1', { patient: mockPatient });

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('patientData');
    });

    it('should check cache validity', () => {
      // Test valid cache
      const recentTimestamp = new Date().toISOString();
      expect(patientCacheService['isCacheValid'](recentTimestamp)).toBe(true);

      // Test expired cache (6 minutes old)
      const oldTimestamp = new Date(Date.now() - 6 * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable).toISOString();
      expect(patientCacheService['isCacheValid'](oldTimestamp)).toBe(false);
    });
  });

  describe('Offline store integration', () => {
    it('should update offline store metadata on cache', async () => {
      const mockOfflineStore = {
        addCacheMetadata: jest.fn(),
        removeCacheMetadata: jest.fn()
      };
      
      (useOfflineStore.getState as jest.Mock).mockReturnValue(mockOfflineStore);
      
      const mockPatient = createTestPatient();
      simulateIndexedDBSuccess();
      
      await patientCacheService['cachePatientData']('patient-1', { patient: mockPatient });

      expect(mockOfflineStore.addCacheMetadata).toHaveBeenCalledWith(
        'patient:patient-1',
        expect.objectContaining({
          lastSynced: expect.any(String),
          size: expect.any(Number),
          version: '1.ResourceHistoryTable',
          isCached: true,
          isStale: false
        })
      );
    });

    it('should remove offline store metadata on clear', async () => {
      const mockOfflineStore = {
        addCacheMetadata: jest.fn(),
        removeCacheMetadata: jest.fn()
      };
      
      (useOfflineStore.getState as jest.Mock).mockReturnValue(mockOfflineStore);
      
      simulateIndexedDBSuccess();
      await patientCacheService.clearPatientCache('patient-1');

      expect(mockOfflineStore.removeCacheMetadata).toHaveBeenCalledWith('patient:patient-1');
    });
  });
});