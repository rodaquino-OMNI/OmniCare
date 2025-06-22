# IndexedDB Service for FHIR Resources

## Overview

The IndexedDB service provides secure, offline storage for FHIR resources in the OmniCare EMR system. It implements HIPAA-compliant encryption, FHIR-compatible querying, and automatic synchronization with the server.

## Features

- **Secure Storage**: AES-256 encryption using Web Crypto API
- **FHIR Compatibility**: Full support for FHIR R4 resources
- **Offline-First**: Works seamlessly offline with automatic sync
- **Query Builder**: Fluent API for complex queries
- **Conflict Resolution**: Automatic and manual conflict handling
- **Data Versioning**: Track changes and resolve conflicts
- **Expiration Policies**: Automatic cleanup based on retention rules
- **Search Optimization**: Indexed fields for fast queries

## Quick Start

### Basic Usage

```typescript
import { useIndexedDB } from '@/hooks/useIndexedDB';

function MyComponent() {
  const { create, read, update, remove, query } = useIndexedDB();

  // Create a patient
  const patient = await create({
    resourceType: 'Patient',
    id: 'patient-123',
    name: [{ given: ['John'], family: 'Doe' }]
  });

  // Read a patient
  const retrieved = await read('Patient', 'patient-123');

  // Update a patient
  const updated = await update({
    ...patient,
    active: true
  });

  // Delete a patient
  await remove('Patient', 'patient-123');
}
```

### Query Builder

```typescript
import { query, QueryOperator, SortDirection } from '@/services/indexeddb';

// Find active medications for a patient
const medications = await query('MedicationRequest')
  .forPatient('patient-123')
  .whereIn('status', ['active', 'on-hold'])
  .orderBy('authoredOn', SortDirection.DESC)
  .limit(10)
  .toArray();

// Search patients by name
const patients = await query('Patient')
  .whereContains('name', 'smith')
  .orderBy('name.family')
  .toArray();

// Complex date range query
const recentObs = await query('Observation')
  .forPatient('patient-123')
  .whereEquals('category', 'vital-signs')
  .whereBetween('effectiveDateTime', '2024-01-01', '2024-12-31')
  .toArray();
```

### Common Queries

```typescript
import { CommonQueries } from '@/services/indexeddb';

// Get recent vital signs
const vitals = await CommonQueries.recentVitals('patient-123', 7).toArray();

// Get active medications
const meds = await CommonQueries.activeMedications('patient-123').toArray();

// Search patients
const results = await CommonQueries.searchPatients('john').toArray();
```

## Encryption

### Automatic Encryption

Sensitive fields are automatically encrypted based on resource type:

- **Patient**: name, telecom, address, identifier
- **Practitioner**: name, telecom, address, identifier
- **DocumentReference**: content, description
- **Observation**: note, valueString

### Manual Encryption Control

```typescript
// Initialize with encryption disabled (not recommended for production)
await indexedDBService.initialize(false);

// Initialize with custom encryption
await encryptionService.initialize(userPassword, userId);
```

## Synchronization

### Automatic Sync

```typescript
// Start automatic sync (every 5 minutes)
fhirSyncService.startAutoSync(5);

// Stop automatic sync
fhirSyncService.stopAutoSync();
```

### Manual Sync

```typescript
// Sync all pending changes
await fhirSyncService.syncAll();

// Sync specific resource
await fhirSyncService.forceSyncResource('Patient', 'patient-123');
```

### Conflict Resolution

```typescript
// Configure conflict resolution strategy
await fhirSyncService.syncAll({
  conflictResolution: 'server-wins', // or 'local-wins', 'merge', 'manual'
  maxRetries: 3,
  batchSize: 10
});

// Handle conflicts manually
fhirSyncService.on(SyncEvent.CONFLICT_DETECTED, async (conflict) => {
  const { local, server, resourceType, resourceId } = conflict;
  
  // Custom resolution logic
  const resolved = mergeResources(local, server);
  await indexedDBService.updateResource(resolved);
});
```

## React Hooks

### useIndexedDB

Main hook for all IndexedDB operations:

```typescript
const {
  // State
  isInitialized,
  isEncrypted,
  isOnline,
  isSyncing,
  
  // CRUD operations
  create,
  read,
  update,
  remove,
  
  // Search
  search,
  query,
  
  // Sync
  syncAll,
  syncResource,
  
  // Utils
  clearAll,
  getStats
} = useIndexedDB();
```

### useIndexedDBResource

Resource-specific hook with automatic loading:

```typescript
const {
  loading,
  error,
  data,
  create,
  read,
  update,
  remove,
  search,
  refresh
} = useIndexedDBResource<Patient>('Patient');
```

### useIndexedDBSync

Sync status monitoring:

```typescript
const {
  status,
  progress,
  sync,
  clearErrors
} = useIndexedDBSync();

// Display sync progress
if (progress) {
  console.log(`Syncing: ${progress.completed}/${progress.total}`);
}
```

## Offline Components

### OfflineIndicator

Shows connection status and sync progress:

```tsx
import { OfflineIndicator } from '@/components/offline/OfflineIndicator';

<Header>
  <OfflineIndicator />
</Header>
```

### OfflinePatientList

Example of offline-capable patient list:

```tsx
import { OfflinePatientList } from '@/components/offline/OfflinePatientList';

<OfflinePatientList />
```

## Data Retention

Resources have automatic expiration based on type:

- **Encounters**: 90 days
- **Observations**: 180 days
- **Documents**: 365 days
- **Service Requests**: 30 days
- **Permanent**: Patients, Conditions, Allergies, Medications

## Performance Tips

1. **Use Indexes**: Query on indexed fields when possible
2. **Limit Results**: Use pagination for large datasets
3. **Batch Operations**: Use transactions for multiple operations
4. **Stream Large Results**: Use the stream API for processing

```typescript
// Stream results in batches
for await (const batch of query('Observation').stream(100)) {
  processBatch(batch);
}
```

## Error Handling

```typescript
try {
  await indexedDBService.createResource(patient);
} catch (error) {
  if (error.code === 'DUPLICATE_RESOURCE') {
    // Handle duplicate
  } else if (error.code === 'ENCRYPT_FAILED') {
    // Handle encryption error
  }
}
```

## Storage Management

```typescript
// Get storage statistics
const stats = await indexedDBService.getStorageStats();
console.log(`Total records: ${stats.totalRecords}`);
console.log(`Storage used: ${stats.storageUsed} bytes`);

// Clear all data (logout)
await indexedDBService.clearAllData();

// Manual cleanup of expired data
await indexedDBService.cleanupExpiredData();
```

## Security Considerations

1. **Encryption Key**: Derived from user password using PBKDF2
2. **Per-Field Encryption**: Sensitive fields encrypted individually
3. **Search Hashes**: One-way hashes for searching encrypted data
4. **Auto-Lock**: Encryption keys cleared on logout
5. **No Key Storage**: Keys never stored, always derived

## Browser Support

- Chrome 54+
- Firefox 53+
- Safari 10.1+
- Edge 79+

## Troubleshooting

### Database Not Initialized

Ensure the database is initialized before use:

```typescript
if (!indexedDBService.isInitialized()) {
  await indexedDBService.initialize();
}
```

### Encryption Errors

Check if encryption is initialized:

```typescript
if (!encryptionService.isInitialized()) {
  await encryptionService.initialize(password, userId);
}
```

### Sync Conflicts

Monitor sync events:

```typescript
fhirSyncService.on(SyncEvent.CONFLICT_DETECTED, (conflict) => {
  console.log('Conflict:', conflict);
});
```

## Testing

```bash
# Run tests
npm test indexeddb.service.test.ts

# Test with encryption
npm test -- --testNamePattern="Encryption"

# Test sync functionality
npm test -- --testNamePattern="Sync"
```