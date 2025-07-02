// Mock PatientCacheService
export const patientCacheService = {
  // Core methods
  cachePatient: jest.fn().mockResolvedValue(true),
  getCachedPatient: jest.fn().mockResolvedValue(null),
  updateCachedPatient: jest.fn().mockResolvedValue(true),
  clearCache: jest.fn().mockResolvedValue(true),
  getPatient: jest.fn().mockResolvedValue(null),
  deletePatient: jest.fn().mockResolvedValue(true),
  getAllPatients: jest.fn().mockResolvedValue([]),
  
  // Cache data retrieval methods
  getPatientAllergies: jest.fn().mockResolvedValue([]),
  getPatientConditions: jest.fn().mockResolvedValue([]),
  getPatientMedications: jest.fn().mockResolvedValue([]),
  getPatientEncounters: jest.fn().mockResolvedValue([]),
  getPatientVitalSigns: jest.fn().mockResolvedValue([]),
  getPatientLabResults: jest.fn().mockResolvedValue([]),
  getCachedPatientData: jest.fn().mockResolvedValue(null),
  
  // Cache management methods
  cachePatientData: jest.fn().mockResolvedValue(true),
  invalidatePatient: jest.fn().mockResolvedValue(true),
  clearPatientCache: jest.fn().mockResolvedValue(true),
  clearAll: jest.fn().mockResolvedValue(true),
  clearAllCache: jest.fn().mockResolvedValue(true),
  batchGetPatients: jest.fn().mockResolvedValue(true),
  warmupCache: jest.fn().mockResolvedValue(true),
  exportCacheState: jest.fn().mockResolvedValue({}),
  invalidateRelatedData: jest.fn().mockResolvedValue(true),
  
  // EventEmitter methods
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
  listeners: jest.fn().mockReturnValue([]),
  
  // Properties and status methods
  clear: jest.fn().mockResolvedValue(true),
  isInitialized: true,
  initialize: jest.fn().mockResolvedValue(true),
  
  // Stats and cache info
  getCacheSize: jest.fn().mockResolvedValue(0),
  getCacheStats: jest.fn().mockResolvedValue({
    totalPatients: 0,
    cacheSize: 0,
    lastUpdated: null
  }),
  getStats: jest.fn().mockReturnValue({
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    lastCleanup: new Date()
  }),
  getCacheSizeInfo: jest.fn().mockReturnValue({
    totalSize: 0,
    patientCount: 0,
    maxSize: 10 * 1024 * 1024,
    utilizationPercentage: 0
  }),
  
  // Sync methods
  syncWithRemote: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  markForSync: jest.fn().mockResolvedValue(true),
  getSyncQueue: jest.fn().mockResolvedValue([]),
  
  // Prefetch methods
  prefetchPatients: jest.fn().mockResolvedValue(true),
};

// Also export as default for tests that might use default import
export default patientCacheService;

// Export class for tests that might instantiate it
export class PatientCacheService {
  cachePatient = patientCacheService.cachePatient;
  getCachedPatient = patientCacheService.getCachedPatient;
  updateCachedPatient = patientCacheService.updateCachedPatient;
  clearCache = patientCacheService.clearCache;
  getPatient = patientCacheService.getPatient;
  deletePatient = patientCacheService.deletePatient;
  getAllPatients = patientCacheService.getAllPatients;
  getPatientAllergies = patientCacheService.getPatientAllergies;
  getPatientConditions = patientCacheService.getPatientConditions;
  getPatientMedications = patientCacheService.getPatientMedications;
  getPatientEncounters = patientCacheService.getPatientEncounters;
  getPatientVitalSigns = patientCacheService.getPatientVitalSigns;
  getPatientLabResults = patientCacheService.getPatientLabResults;
  getCachedPatientData = patientCacheService.getCachedPatientData;
  cachePatientData = patientCacheService.cachePatientData;
  invalidatePatient = patientCacheService.invalidatePatient;
  clearPatientCache = patientCacheService.clearPatientCache;
  clearAll = patientCacheService.clearAll;
  clearAllCache = patientCacheService.clearAllCache;
  batchGetPatients = patientCacheService.batchGetPatients;
  warmupCache = patientCacheService.warmupCache;
  exportCacheState = patientCacheService.exportCacheState;
  invalidateRelatedData = patientCacheService.invalidateRelatedData;
  on = patientCacheService.on;
  off = patientCacheService.off;
  emit = patientCacheService.emit;
  once = patientCacheService.once;
  removeAllListeners = patientCacheService.removeAllListeners;
  listeners = patientCacheService.listeners;
  clear = patientCacheService.clear;
  isInitialized = patientCacheService.isInitialized;
  initialize = patientCacheService.initialize;
  getCacheSize = patientCacheService.getCacheSize;
  getCacheStats = patientCacheService.getCacheStats;
  getStats = patientCacheService.getStats;
  getCacheSizeInfo = patientCacheService.getCacheSizeInfo;
  syncWithRemote = patientCacheService.syncWithRemote;
  markForSync = patientCacheService.markForSync;
  getSyncQueue = patientCacheService.getSyncQueue;
  prefetchPatients = patientCacheService.prefetchPatients;
}