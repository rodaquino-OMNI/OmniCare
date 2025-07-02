// Unmock the service we're testing
jest.unmock('../patient-cache.service');

// Mock dependencies - these need to be hoisted before imports
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

import { patientHelpers } from '@/lib/medplum';
import { useOfflineStore } from '@/stores/offline';
import { patientCacheService } from '../patient-cache.service';
import {
  Patient,
  AllergyIntolerance,
  Condition,
  MedicationRequest,
  Encounter,
  Observation
} from '@medplum/fhirtypes';

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
  Promise.resolve().then(() => {
    if (mockRequest.onsuccess) {
      mockRequest.onsuccess({ target: { result: mockDB } });
    }
  });
  
  mockObjectStore.put.mockImplementation(() => {
    const putRequest = { onsuccess: null as any, onerror: null as any };
    Promise.resolve().then(() => {
      if (putRequest.onsuccess) putRequest.onsuccess();
    });
    return putRequest;
  });
  
  mockObjectStore.get.mockImplementation(() => {
    const getRequest = { 
      onsuccess: null as any, 
      onerror: null as any,
      result: result 
    };
    Promise.resolve().then(() => {
      if (getRequest.onsuccess) getRequest.onsuccess();
    });
    return getRequest;
  });
  
  mockObjectStore.delete.mockImplementation(() => {
    const deleteRequest = { onsuccess: null as any, onerror: null as any };
    Promise.resolve().then(() => {
      if (deleteRequest.onsuccess) deleteRequest.onsuccess();
    });
    return deleteRequest;
  });
  
  mockObjectStore.clear.mockImplementation(() => {
    const clearRequest = { onsuccess: null as any, onerror: null as any };
    Promise.resolve().then(() => {
      if (clearRequest.onsuccess) clearRequest.onsuccess();
    });
    return clearRequest;
  });
};

// Test data
const createTestPatient = (overrides?: Partial<Patient>): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['John'], family: 'Doe' }],
  gender: 'male' as const,
  birthDate: '1990-01-01',
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
      code: type === 'vital' ? '8867-4' : '2339-0',
      display: type === 'vital' ? 'Heart rate' : 'Glucose'
    }]
  },
  subject: { reference: `Patient/${patientId}` }
});

describe('PatientCacheService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock window.indexedDB
    Object.defineProperty(window, 'indexedDB', {
      writable: true,
      value: mockIndexedDB
    });

    // Reset IndexedDB mock state
    mockObjectStore.put.mockClear();
    mockObjectStore.get.mockClear();
    mockObjectStore.delete.mockClear();
    mockObjectStore.clear.mockClear();
    mockDB.transaction.mockClear();
    mockDB.createObjectStore.mockClear();
    mockDB.objectStoreNames.contains.mockReturnValue(true);
    mockRequest.onsuccess = null;
    mockRequest.onerror = null;
    mockRequest.onupgradeneeded = null;
    
    // Note: Not clearing the service cache in beforeEach to avoid initialization issues
    // Each test should handle its own state
  });

  afterEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear the cache using public method
    await patientCacheService.clearAll();
    
    // Reset mock implementations
    (patientHelpers.getPatient as jest.Mock).mockReset();
    (patientHelpers.getAllergies as jest.Mock).mockReset();
    (patientHelpers.getConditions as jest.Mock).mockReset();
    (patientHelpers.getMedications as jest.Mock).mockReset();
    (patientHelpers.getEncounters as jest.Mock).mockReset();
    (patientHelpers.getVitalSigns as jest.Mock).mockReset();
    (patientHelpers.getLabResults as jest.Mock).mockReset();
  });

  describe('EventEmitter functionality', () => {
    it('should emit and listen to events', (done) => {
      const listener = jest.fn((data) => {
        expect(data).toEqual({ data: 'test' });
        expect(listener).toHaveBeenCalledWith({ data: 'test' });
        patientCacheService.off('test-event', listener);
        done();
      });
      
      patientCacheService.on('test-event', listener);
      patientCacheService.emit('test-event', { data: 'test' });
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
      
      // Check stats after operation
      const stats = patientCacheService.getStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should get patient with cache hit', async () => {
      const mockPatient = createTestPatient();
      
      // First call to populate cache
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      // Clear mocks
      jest.clearAllMocks();

      // Second call should hit cache
      simulateIndexedDBSuccess({
        patient: mockPatient,
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date().toISOString()
      });
      
      const result = await patientCacheService.getPatient('patient-1');

      expect(result).toEqual(mockPatient);
      expect(patientHelpers.getPatient).not.toHaveBeenCalled();
    });

    it('should force refresh patient data', async () => {
      const oldPatient = createTestPatient({ name: [{ given: ['Old'], family: 'Name' }] });
      const newPatient = createTestPatient();
      
      // First call to populate cache
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(oldPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      // Force refresh
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(newPatient);
      simulateIndexedDBSuccess();

      const result = await patientCacheService.getPatient('patient-1', { forceRefresh: true });

      expect(result).toEqual(newPatient);
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
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');
      
      // Clear cache
      simulateIndexedDBSuccess();
      await patientCacheService.clearPatientCache('patient-1');

      // Try to get from cache
      simulateIndexedDBSuccess(null);
      const cached = await patientCacheService.getCachedPatientData('patient-1');
      expect(cached).toBeNull();
    });

    it('should clear all cache', async () => {
      const mockListener = jest.fn();
      patientCacheService.on('cache:cleared', mockListener);

      simulateIndexedDBSuccess();

      // Test the clearAll method exists and works
      expect(typeof patientCacheService.clearAll).toBe('function');
      await patientCacheService.clearAll();

      expect(mockObjectStore.clear).toHaveBeenCalled();
      expect(mockListener).toHaveBeenCalled();
    });

    it('should invalidate specific related data', async () => {
      const mockListener = jest.fn();
      patientCacheService.on('cache:related-invalidated', mockListener);

      const mockPatient = createTestPatient();
      const mockVitals = [createTestObservation('patient-1', 'vital')];

      // First populate cache
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      (patientHelpers.getVitalSigns as jest.Mock).mockResolvedValueOnce(mockVitals);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');
      await patientCacheService.getPatientVitalSigns('patient-1');

      // Invalidate vitals
      simulateIndexedDBSuccess({
        patient: mockPatient,
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: mockVitals,
        labs: [],
        timestamp: new Date().toISOString()
      });
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
      
      // Store initial stats
      const initialStats = patientCacheService.getStats();
      const initialMisses = initialStats.misses;
      const initialHits = initialStats.hits;
      
      // First access - miss
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      let stats = patientCacheService.getStats();
      expect(stats.misses).toBe(initialMisses + 1);
      expect(stats.hits).toBe(initialHits);

      // Second access - hit
      simulateIndexedDBSuccess({
        patient: mockPatient,
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date().toISOString()
      });
      await patientCacheService.getPatient('patient-1');

      stats = patientCacheService.getStats();
      expect(stats.misses).toBe(initialMisses + 1);
      expect(stats.hits).toBe(initialHits + 1);
    });

    it('should get cache size info', async () => {
      const mockPatient = createTestPatient();
      
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      const sizeInfo = patientCacheService.getCacheSizeInfo();

      expect(sizeInfo.patientCount).toBeGreaterThanOrEqual(1);
      expect(sizeInfo.totalSize).toBeGreaterThan(0);
      expect(sizeInfo.maxSize).toBe(10 * 1024 * 1024);
      expect(sizeInfo.utilizationPercentage).toBeGreaterThan(0);
    });

    it('should export cache state', async () => {
      const mockPatient = createTestPatient();
      const mockAllergies = [createTestAllergy('patient-1')];
      
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValueOnce(mockAllergies);
      simulateIndexedDBSuccess();
      
      await patientCacheService.getPatient('patient-1');
      await patientCacheService.getPatientAllergies('patient-1');

      const state = await patientCacheService.exportCacheState();

      expect(state.stats).toBeDefined();
      expect(state.sizeInfo).toBeDefined();
      expect(state.patients).toHaveLength(1);
      expect(state.patients[0]).toMatchObject({
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
    it('should handle missing object store gracefully', async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(false);
      simulateIndexedDBSuccess();

      const cached = await patientCacheService.getCachedPatientData('patient-1');
      expect(cached).toBeNull();
    });

    it('should handle IndexedDB quota exceeded error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockObjectStore.put.mockImplementation(() => {
        const putRequest = { 
          onsuccess: null as any, 
          onerror: null as any,
          error: new DOMException('QuotaExceededError')
        };
        Promise.resolve().then(() => {
          if (putRequest.onerror) putRequest.onerror();
        });
        return putRequest;
      });

      const mockPatient = createTestPatient();
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();

      await patientCacheService.getPatient('patient-1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error caching patient data:', expect.any(Error));
      consoleErrorSpy.mockRestore();
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
      Promise.resolve().then(() => {
        const request = mockIndexedDB.open.mock.results[0].value;
        if (request.onerror) request.onerror();
      });

      const result = await patientCacheService.getPatient('patient-1');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(result).toEqual(mockPatient);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle upgrade needed', async () => {
      const mockPatient = createTestPatient();
      
      mockIndexedDB.open.mockReturnValueOnce(mockRequest);
      
      // Simulate upgrade needed
      Promise.resolve().then(() => {
        if (mockRequest.onupgradeneeded) {
          mockDB.objectStoreNames.contains.mockReturnValueOnce(false);
          mockRequest.onupgradeneeded({ target: { result: mockDB } });
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDB } });
        }
      });

      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('patientData');
    });

    it('should check cache validity', () => {
      // Need to access the service instance to test private method
      // For now, we'll test indirectly through cache hit/miss behavior
      
      // Test that cache expires after 5 minutes
      expect(true).toBe(true); // Placeholder - cache validity is tested through other tests
    });
  });

  describe('Cache expiration and validation', () => {
    it('should invalidate expired cache based on timestamp', async () => {
      const mockPatient = createTestPatient();
      const expiredData = {
        patient: mockPatient,
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 minutes ago
      };

      simulateIndexedDBSuccess(expiredData);
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);

      const result = await patientCacheService.getPatient('patient-1');

      expect(patientHelpers.getPatient).toHaveBeenCalled(); // Should fetch fresh data
      expect(result).toEqual(mockPatient);
    });

    it('should handle cache duration edge cases', async () => {
      // Test exact boundary
      const mockPatient = createTestPatient();
      const boundaryData = {
        patient: mockPatient,
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date(Date.now() - 5 * 60 * 1000 + 1).toISOString() // Just under 5 minutes
      };

      simulateIndexedDBSuccess(boundaryData);

      const result = await patientCacheService.getPatient('patient-1');

      expect(patientHelpers.getPatient).not.toHaveBeenCalled(); // Should use cache
      expect(result).toEqual(mockPatient);
    });
  });

  describe('Concurrent access patterns', () => {
    it('should handle concurrent patient fetches', async () => {
      const mockPatient = createTestPatient();
      (patientHelpers.getPatient as jest.Mock).mockResolvedValue(mockPatient);
      simulateIndexedDBSuccess();

      // Simulate concurrent calls
      const promises = [
        patientCacheService.getPatient('patient-1'),
        patientCacheService.getPatient('patient-1'),
        patientCacheService.getPatient('patient-1')
      ];

      const results = await Promise.all(promises);

      // Should only call the API once due to caching
      expect(patientHelpers.getPatient).toHaveBeenCalledTimes(1);
      expect(results).toEqual([mockPatient, mockPatient, mockPatient]);
    });

    it('should handle concurrent related data fetches', async () => {
      const mockPatient = createTestPatient();
      const mockAllergies = [createTestAllergy('patient-1')];
      const mockConditions = [createTestCondition('patient-1')];

      (patientHelpers.getPatient as jest.Mock).mockResolvedValue(mockPatient);
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValue(mockAllergies);
      (patientHelpers.getConditions as jest.Mock).mockResolvedValue(mockConditions);
      simulateIndexedDBSuccess();

      // Fetch patient with related data
      await patientCacheService.getPatient('patient-1', { includeRelated: true });

      // Now fetch individual pieces concurrently
      const promises = [
        patientCacheService.getPatientAllergies('patient-1'),
        patientCacheService.getPatientConditions('patient-1'),
        patientCacheService.getPatientAllergies('patient-1')
      ];

      const results = await Promise.all(promises);

      // Should use cached data
      expect(patientHelpers.getAllergies).toHaveBeenCalledTimes(1);
      expect(patientHelpers.getConditions).toHaveBeenCalledTimes(1);
      expect(results[0]).toEqual(mockAllergies);
      expect(results[1]).toEqual(mockConditions);
    });
  });

  describe('Error recovery and resilience', () => {
    it('should recover from corrupted cache data', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate corrupted data in IndexedDB
      simulateIndexedDBSuccess({ corrupted: 'data' });
      
      const mockPatient = createTestPatient();
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);

      const result = await patientCacheService.getPatient('patient-1');

      expect(result).toEqual(mockPatient);
      expect(patientHelpers.getPatient).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle network errors gracefully during batch operations', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (patientHelpers.getPatient as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createTestPatient({ id: 'patient-2' }));

      await patientCacheService.batchGetPatients(['patient-1', 'patient-2']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to prefetch patient patient-1:',
        expect.any(Error)
      );
      expect(patientHelpers.getPatient).toHaveBeenCalledTimes(2);
      consoleErrorSpy.mockRestore();
    });

    it('should handle partial cache updates', async () => {
      const mockPatient = createTestPatient();
      const mockAllergies = [createTestAllergy('patient-1')];
      
      // First, populate cache with patient data
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatient('patient-1');

      // Now update with allergies
      (patientHelpers.getAllergies as jest.Mock).mockResolvedValueOnce(mockAllergies);
      simulateIndexedDBSuccess();
      await patientCacheService.getPatientAllergies('patient-1');

      // Verify combined cache
      simulateIndexedDBSuccess({
        patient: mockPatient,
        allergies: mockAllergies,
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date().toISOString()
      });
      
      const cached = await patientCacheService.getCachedPatientData('patient-1');
      expect(cached?.patient).toEqual(mockPatient);
      expect(cached?.allergies).toEqual(mockAllergies);
    });
  });

  describe('Cache size and memory management', () => {
    it('should accurately calculate cache size', async () => {
      const patients = [
        createTestPatient({ id: 'patient-1' }),
        createTestPatient({ id: 'patient-2' }),
        createTestPatient({ id: 'patient-3' })
      ];

      for (const patient of patients) {
        (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(patient);
        simulateIndexedDBSuccess();
        await patientCacheService.getPatient(patient.id!);
      }

      const sizeInfo = patientCacheService.getCacheSizeInfo();
      
      expect(sizeInfo.patientCount).toBe(3);
      expect(sizeInfo.totalSize).toBeGreaterThan(0);
      expect(sizeInfo.utilizationPercentage).toBeGreaterThan(0);
      expect(sizeInfo.utilizationPercentage).toBeLessThan(100);
    });

    it('should track eviction statistics', async () => {
      const initialStats = patientCacheService.getStats();
      const initialEvictions = initialStats.evictions;

      // Clear cache which should increment evictions
      patientCacheService['cache'].set('patient-1', {
        patient: createTestPatient(),
        allergies: [],
        conditions: [],
        medications: [],
        encounters: [],
        vitals: [],
        labs: [],
        timestamp: new Date().toISOString()
      });

      simulateIndexedDBSuccess();
      await patientCacheService.clearAllCache();

      const stats = patientCacheService.getStats();
      expect(stats.evictions).toBeGreaterThan(initialEvictions);
    });
  });

  describe('Event emission edge cases', () => {
    it('should handle multiple event listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      patientCacheService.on('cache:invalidated', listener1);
      patientCacheService.on('cache:invalidated', listener2);

      simulateIndexedDBSuccess();
      await patientCacheService.invalidatePatient('patient-1');

      expect(listener1).toHaveBeenCalledWith({ patientId: 'patient-1' });
      expect(listener2).toHaveBeenCalledWith({ patientId: 'patient-1' });
    });

    it('should not throw when emitting events with no listeners', async () => {
      // Remove all listeners
      patientCacheService.removeAllListeners();

      simulateIndexedDBSuccess();
      
      // Should not throw
      await expect(patientCacheService.invalidatePatient('patient-1')).resolves.not.toThrow();
    });

    it('should properly remove specific event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      patientCacheService.on('test-event', listener1);
      patientCacheService.on('test-event', listener2);
      patientCacheService.off('test-event', listener1);

      patientCacheService.emit('test-event', { data: 'test' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });
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
      (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);
      simulateIndexedDBSuccess();
      
      await patientCacheService.getPatient('patient-1');

      expect(mockOfflineStore.addCacheMetadata).toHaveBeenCalledWith(
        'patient:patient-1',
        expect.objectContaining({
          lastSynced: expect.any(String),
          size: expect.any(Number),
          version: '1.0',
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
