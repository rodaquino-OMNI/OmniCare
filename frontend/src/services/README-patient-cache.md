# Patient Data Caching System

## Overview

The Patient Data Caching System provides intelligent caching strategies for patient information with smart prefetching, cache invalidation, and memory management. It significantly improves performance by reducing API calls and providing instant access to frequently used patient data.

## Features

### 1. Intelligent Caching
- **Automatic TTL Management**: Different data types have appropriate time-to-live values
- **LRU Eviction**: Least recently used patients are evicted when cache is full
- **Size Limits**: Prevents excessive memory usage with configurable limits

### 2. Smart Prefetching
- **Access Pattern Analysis**: Learns from user behavior to predict next patient access
- **Related Patient Prefetching**: Automatically loads family members and care team data
- **Background Loading**: Prefetches data without blocking the UI

### 3. Real-time Synchronization
- **WebSocket Updates**: Receives real-time notifications of data changes
- **FHIR Subscriptions**: Subscribes to relevant resource updates
- **Conflict Resolution**: Handles concurrent updates gracefully

### 4. Cache Management
- **Performance Monitoring**: Track hit rates, size, and efficiency
- **Manual Controls**: Refresh, invalidate, and clear cache as needed
- **Export/Import**: Save and restore cache state for debugging

## Usage

### Basic Usage with Hook

```typescript
import { usePatientCache } from '@/hooks/usePatientCache';

function PatientView({ patientId }) {
  const {
    patient,
    allergies,
    conditions,
    medications,
    vitals,
    labs,
    loading,
    fromCache,
    refresh,
    invalidate
  } = usePatientCache(patientId, {
    enableSync: true,
    prefetchRelated: true,
    autoRefresh: true,
    refreshInterval: 300000 // 5 minutes
  });

  if (loading) return <Skeleton />;

  return (
    <div>
      {fromCache && <Badge>Cached</Badge>}
      <PatientInfo patient={patient} />
      <Button onClick={() => refresh(true)}>Force Refresh</Button>
    </div>
  );
}
```

### Direct Service Usage

```typescript
import { patientCacheService } from '@/services/patient-cache.service';

// Get patient with caching
const patient = await patientCacheService.getPatient(patientId);

// Get specific data types
const allergies = await patientCacheService.getPatientAllergies(patientId);
const medications = await patientCacheService.getPatientMedications(patientId);

// Batch operations
const patients = await patientCacheService.batchGetPatients(['id1', 'id2', 'id3']);

// Cache management
patientCacheService.invalidatePatient(patientId);
patientCacheService.clearAll();

// Warmup cache
await patientCacheService.warmupCache(['frequent-patient-1', 'frequent-patient-2']);
```

### Sync Service Usage

```typescript
import { patientSyncService } from '@/services/patient-sync.service';

// Initialize sync
await patientSyncService.initialize();

// Manual sync
await patientSyncService.syncPatient(patientId);
await patientSyncService.syncAll();

// Monitor sync status
const status = patientSyncService.getSyncStatus();
console.log(status.status); // connected, syncing, error, etc.
```

## Configuration

### Cache Settings

```typescript
const CACHE_CONFIG = {
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_PATIENTS: 50,
  TTL: {
    PATIENT: 3600000,      // 1 hour
    VITALS: 300000,        // 5 minutes
    MEDICATIONS: 600000,   // 10 minutes
    ALLERGIES: 1800000,    // 30 minutes
    CONDITIONS: 1800000,   // 30 minutes
    LABS: 300000,          // 5 minutes
    ENCOUNTERS: 900000,    // 15 minutes
    DOCUMENTS: 1800000     // 30 minutes
  },
  PREFETCH: {
    THRESHOLD: 3,          // Prefetch after 3 accesses
    RELATED_LIMIT: 5,      // Max related patients
    BACKGROUND_DELAY: 2000 // 2 second delay
  }
};
```

### Sync Settings

```typescript
const SYNC_CONFIG = {
  WEBSOCKET_URL: 'ws://localhost:8080/ws',
  RECONNECT_DELAY: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  HEARTBEAT_INTERVAL: 30000,
  BATCH_SYNC_SIZE: 20
};
```

## Architecture

### Cache Structure

```
PatientCacheService
├── Cache Map<patientId, PatientCacheEntry>
│   ├── Patient Data
│   ├── Related Data (allergies, conditions, etc.)
│   └── Metadata (TTL, access count, version)
├── Access Patterns Map<userId, patientIds[]>
├── Prefetch Queue
└── Statistics
```

### Event System

The cache service emits events for monitoring and integration:

- `cache:patient-added` - New patient cached
- `cache:patient-removed` - Patient evicted
- `cache:related-data-added` - Related data cached
- `cache:invalidated` - Cache invalidated
- `cache:cleared` - Cache cleared
- `cache:cleanup` - Cleanup performed
- `cache:prefetch-complete` - Prefetch completed
- `cache:stale-used` - Stale data served on error

### Sync Events

- `sync:connected` - WebSocket connected
- `sync:disconnected` - WebSocket disconnected
- `sync:event` - Sync event received
- `sync:patient-updated` - Patient data updated
- `sync:completed` - Sync batch completed
- `sync:error` - Sync error occurred
- `sync:status-changed` - Sync status changed

## Performance Optimization

### 1. Prefetching Strategy

The system uses three prefetching strategies:

1. **Access-based**: After N accesses, prefetch related data
2. **Relationship-based**: Prefetch family members and care team
3. **Predictive**: Analyze access patterns to predict next patient

### 2. Memory Management

- **Size Tracking**: Each cached item's size is estimated
- **Eviction Policy**: LRU with TTL consideration
- **Cleanup**: Periodic cleanup removes stale entries

### 3. Network Optimization

- **Batch Requests**: Multiple patients fetched in single request
- **Partial Updates**: Only changed fields are synchronized
- **Compression**: Large payloads are compressed

## Monitoring

### Cache Manager Component

```typescript
import { CacheManager } from '@/components/cache/CacheManager';

// Full cache management UI
<CacheManager />

// Minimal status display
<CacheManager minimal />
```

### Performance Metrics

- **Hit Rate**: Percentage of requests served from cache
- **Cache Size**: Current memory usage
- **Patient Count**: Number of cached patients
- **Eviction Count**: Number of evicted entries
- **Refresh Count**: Number of automatic refreshes
- **Prefetch Count**: Number of prefetch operations

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce MAX_CACHE_SIZE
   - Decrease MAX_PATIENTS
   - Lower TTL values

2. **Low Hit Rate**
   - Increase TTL values
   - Enable prefetching
   - Analyze access patterns

3. **Sync Errors**
   - Check WebSocket connection
   - Verify API endpoints
   - Review error logs

### Debug Tools

```typescript
// Export cache state
const state = patientCacheService.exportCacheState();
console.log(state);

// Monitor events
patientCacheService.on('cache:*', (event) => {
  console.log('Cache event:', event);
});

// Check sync status
const syncStatus = patientSyncService.getSyncStatus();
console.log('Errors:', syncStatus.errors);
```

## Best Practices

1. **Use Hooks**: Prefer `usePatientCache` hook for React components
2. **Enable Sync**: Keep real-time sync enabled for consistency
3. **Monitor Performance**: Use CacheManager to track efficiency
4. **Warmup Cache**: Preload frequently accessed patients
5. **Handle Errors**: Always handle cache misses gracefully
6. **Configure TTLs**: Adjust TTLs based on data volatility

## Future Enhancements

1. **IndexedDB Storage**: Persist cache across sessions
2. **Service Worker**: Offline support with background sync
3. **Compression**: Reduce memory usage with data compression
4. **Analytics**: Advanced usage analytics and recommendations
5. **ML Predictions**: Machine learning for smarter prefetching