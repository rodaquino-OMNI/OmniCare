// Import all services first
import { MockIndexedDBService, IndexedDBError, createMockIndexedDBService, indexedDBService as idbService } from './indexeddb.service.mock';
import { MockPatientCacheService, patientCacheService as pcService } from './patient-cache.service.mock';
import { MockFHIRService, FHIRError, fhirService as fService } from './fhir.service.mock';
import { MockBackgroundSyncService, backgroundSyncService as bsService, addSyncTask, getSyncStats, syncNow } from './background-sync.service.mock';
import {
  createMockPatient,
  createMockPatientData,
  createMockAllergies,
  createMockConditions,
  createMockMedications,
  createMockEncounters,
  createMockVitalSigns,
  createMockLabResults
} from './mock-data-generators';

// Re-export everything
export {
  // IndexedDB Service Mock
  MockIndexedDBService,
  IndexedDBError,
  createMockIndexedDBService,
  type IndexedDBSearchParams,
  type QueryResult
} from './indexeddb.service.mock';

// Re-export with alias
export { indexedDBService } from './indexeddb.service.mock';

export {
  // Patient Cache Service Mock
  MockPatientCacheService
} from './patient-cache.service.mock';

// Re-export with alias
export { patientCacheService } from './patient-cache.service.mock';

export {
  // FHIR Service Mock
  MockFHIRService,
  FHIRError,
  type FHIRSearchParams,
  type FHIRResponse,
  type ValidationResult,
  type HealthStatus
} from './fhir.service.mock';

// Re-export with alias
export { fhirService } from './fhir.service.mock';

export {
  // Background Sync Service Mock
  MockBackgroundSyncService,
  addSyncTask,
  getSyncStats,
  syncNow,
  type SyncTask,
  type SyncResult,
  type SyncQueueOptions,
  type SyncStats
} from './background-sync.service.mock';

// Re-export with alias
export { backgroundSyncService } from './background-sync.service.mock';

export {
  // Mock Data Generators
  createMockPatient,
  createMockPatientData,
  createMockAllergies,
  createMockConditions,
  createMockMedications,
  createMockEncounters,
  createMockVitalSigns,
  createMockLabResults
} from './mock-data-generators';

// Factory function to create all mocked services
export function createMockServices() {
  return {
    indexedDBService: idbService,
    patientCacheService: pcService,
    fhirService: fService,
    backgroundSyncService: bsService
  };
}

// Reset all mock services to initial state
export async function resetAllMocks() {
  // Clear IndexedDB mock
  await idbService.clearAllData();
  
  // Clear patient cache
  await pcService.clearAll();
  
  // Clear background sync queue
  bsService.clearQueue();
  
  // Reset stats
  bsService.stopPeriodicSync();
}