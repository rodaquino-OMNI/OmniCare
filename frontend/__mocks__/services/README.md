# OmniCare Service Mocks

This directory contains lightweight service mocks for OmniCare frontend tests that don't require real database connections or network calls.

## Available Mocks

### 1. IndexedDB Service Mock (`indexeddb.service.mock.ts`)
A complete in-memory mock of the IndexedDB service with full CRUD operations.

**Features:**
- In-memory storage (no real IndexedDB required)
- Full CRUD operations for FHIR resources
- Search and filtering capabilities
- Sync queue management
- Storage statistics

**Usage:**
```typescript
import { indexedDBService } from '@/__mocks__/services';

// Initialize the service
await indexedDBService.initialize();

// Create a resource
const patient = await indexedDBService.createResource({
  resourceType: 'Patient',
  id: 'test-123',
  name: [{ given: ['John'], family: 'Doe' }]
});

// Search resources
const bundle = await indexedDBService.searchResources('Patient', {
  _count: 10,
  status: 'active'
});
```

### 2. Patient Cache Service Mock (`patient-cache.service.mock.ts`)
A lightweight mock for caching patient data with automatic mock data generation.

**Features:**
- In-memory caching
- Automatic mock data generation
- Cache statistics and management
- Event emitter for cache events

**Usage:**
```typescript
import { patientCacheService } from '@/__mocks__/services';

// Get patient with auto-generated mock data
const patient = await patientCacheService.getPatient('patient-123');

// Get patient with related data
const patientWithRelated = await patientCacheService.getPatient('patient-123', {
  includeRelated: true
});

// Get specific patient data
const allergies = await patientCacheService.getPatientAllergies('patient-123');
const conditions = await patientCacheService.getPatientConditions('patient-123');

// Cache management
await patientCacheService.clearPatientCache('patient-123');
const stats = patientCacheService.getStats();
```

### 3. FHIR Service Mock (`fhir.service.mock.ts`)
A complete mock of the FHIR service with all CRUD operations and patient-specific methods.

**Features:**
- Full FHIR resource CRUD operations
- Patient-specific operations ($everything, vitals, labs, etc.)
- Bundle and batch operations
- Validation support
- Configurable network delay simulation

**Usage:**
```typescript
import { fhirService } from '@/__mocks__/services';

// Set auth token
fhirService.setAuthToken('mock-token');

// Create a patient
const patient = await fhirService.createPatient({
  name: [{ given: ['Jane'], family: 'Smith' }],
  gender: 'female',
  birthDate: '1990-01-01'
});

// Get patient everything
const everything = await fhirService.getPatientEverything('patient-123');

// Search resources
const medications = await fhirService.getPatientMedications('patient-123');

// Validate resource
const validation = await fhirService.validateResource(patient);
```

### 4. Background Sync Service Mock (`background-sync.service.mock.ts`)
Mock for background synchronization with configurable network simulation.

**Features:**
- Task queue management
- Network status simulation
- Conflict simulation
- Failure simulation
- Sync statistics

**Usage:**
```typescript
import { backgroundSyncService } from '@/__mocks__/services';

// Configure simulation
backgroundSyncService.setNetworkStatus(true);
backgroundSyncService.setSimulateConflicts(false);
backgroundSyncService.setSimulateFailures(false);

// Add sync task
const taskId = backgroundSyncService.addTask({
  type: 'update',
  resource: 'fhir',
  data: { resourceType: 'Patient', id: '123' },
  priority: 'normal',
  maxRetries: 3
});

// Manual sync
const results = await backgroundSyncService.syncNow();

// Get statistics
const stats = backgroundSyncService.getStats();
```

## Mock Data Generators

The `mock-data-generators.ts` file provides functions to generate realistic FHIR-compliant mock data.

**Available generators:**
- `createMockPatient(patientId)` - Generate a complete Patient resource
- `createMockAllergies(patientId)` - Generate 0-3 AllergyIntolerance resources
- `createMockConditions(patientId)` - Generate 1-4 Condition resources
- `createMockMedications(patientId)` - Generate 1-4 MedicationRequest resources
- `createMockEncounters(patientId)` - Generate 2-5 Encounter resources
- `createMockVitalSigns(patientId)` - Generate vital sign Observations
- `createMockLabResults(patientId)` - Generate lab result Observations
- `createMockPatientData(patientId)` - Generate complete patient data set

## Test Setup

### Jest Configuration

Add to your Jest setup file:

```typescript
// jest.setup.js or setupTests.ts
import { resetAllMocks } from '@/__mocks__/services';

// Reset all mocks before each test
beforeEach(() => {
  resetAllMocks();
});
```

### Test Example

```typescript
import { createMockServices } from '@/__mocks__/services';

describe('Patient Component', () => {
  let services: ReturnType<typeof createMockServices>;

  beforeEach(async () => {
    services = createMockServices();
    await services.indexedDBService.initialize();
  });

  it('should display patient information', async () => {
    // Test will use mock data automatically
    const patient = await services.patientCacheService.getPatient('test-123');
    
    expect(patient).toBeDefined();
    expect(patient.resourceType).toBe('Patient');
  });

  it('should handle offline sync', async () => {
    // Simulate offline
    services.backgroundSyncService.setNetworkStatus(false);
    
    // Add task
    const taskId = services.backgroundSyncService.addTask({
      type: 'create',
      resource: 'fhir',
      data: { resourceType: 'Observation' },
      priority: 'high'
    });
    
    // Verify task is queued
    const pending = services.backgroundSyncService.getPendingTasks();
    expect(pending).toHaveLength(1);
    
    // Simulate online and sync
    services.backgroundSyncService.setNetworkStatus(true);
    const results = await services.backgroundSyncService.syncNow();
    
    expect(results[0].success).toBe(true);
  });
});
```

## Key Benefits

1. **No External Dependencies**: All mocks work entirely in-memory without requiring:
   - Real IndexedDB
   - Network connections
   - Database servers
   - External APIs

2. **Consistent Test Data**: Mock data generators ensure consistent, realistic test data across all tests.

3. **Test Isolation**: Each test can have its own isolated data without affecting other tests.

4. **Performance**: In-memory operations are fast, making tests run quickly.

5. **Simulation Capabilities**: Can simulate various scenarios:
   - Network failures
   - Sync conflicts
   - Offline mode
   - Data validation errors

## Best Practices

1. **Reset Between Tests**: Always reset mocks between tests to ensure isolation:
   ```typescript
   beforeEach(() => {
     resetAllMocks();
   });
   ```

2. **Use Type Imports**: Import types from the actual services to ensure type safety:
   ```typescript
   import type { FHIRSearchParams } from '@/services/fhir.service';
   ```

3. **Configure Simulations**: Set up specific test scenarios:
   ```typescript
   // Test conflict resolution
   backgroundSyncService.setSimulateConflicts(true);
   
   // Test offline behavior
   backgroundSyncService.setNetworkStatus(false);
   ```

4. **Mock Specific Behaviors**: Register custom handlers for specific test cases:
   ```typescript
   backgroundSyncService.registerSyncHandler('custom-resource', async (task) => {
     // Custom sync logic for test
     return { success: true, data: task.data };
   });
   ```