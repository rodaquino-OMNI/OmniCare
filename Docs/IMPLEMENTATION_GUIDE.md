# OmniCare Data Layer Enhancement - Implementation Guide

## Quick Start

This guide provides step-by-step instructions for implementing the recommended data layer enhancements based on Medplum's patterns.

## 1. Enhanced MedplumClient Setup

### Step 1: Replace the basic client

Replace `/frontend/src/lib/medplum.ts` with the enhanced client:

```typescript
import { enhancedMedplumClient } from './enhanced-medplum-client';
export const medplumClient = enhancedMedplumClient;
```

### Step 2: Add interceptors for monitoring

```typescript
// In your app initialization
enhancedMedplumClient.addInterceptor({
  onRequest: (config) => {
    // Add auth token
    const token = getAuthToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  onResponse: async (response) => {
    // Log successful requests
    console.log(`[API] ${response.url} - ${response.status}`);
    return response;
  },
  onError: (error) => {
    // Send to error tracking
    trackError(error);
    return error;
  },
});
```

## 2. Implement Enhanced Hooks

### Step 1: Update component to use new hooks

```typescript
// Before
import { useEffect, useState } from 'react';
import { medplumClient } from '@/lib/medplum';

function PatientDetails({ patientId }) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    medplumClient.readResource('Patient', patientId)
      .then(setPatient)
      .finally(() => setLoading(false));
  }, [patientId]);
  
  // ...
}

// After
import { useResource } from '@/hooks/useMedplumResource';

function PatientDetails({ patientId }) {
  const { data: patient, isLoading, error, refetch } = useResource('Patient', patientId, {
    refetchOnWindowFocus: true,
    offlineFirst: true,
  });
  
  if (isLoading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} onRetry={refetch} />;
  
  // ...
}
```

### Step 2: Use search hook for lists

```typescript
import { useResourceSearch } from '@/hooks/useMedplumResource';

function PatientList() {
  const { 
    data: patients, 
    isLoading, 
    hasNextPage,
    fetchNextPage 
  } = useResourceSearch('Patient', {
    _count: 20,
    _sort: '-_lastUpdated',
  });
  
  return (
    <InfiniteScroll
      dataLength={patients.length}
      next={fetchNextPage}
      hasMore={hasNextPage}
      loader={<Spinner />}
    >
      {patients.map(patient => (
        <PatientCard key={patient.id} patient={patient} />
      ))}
    </InfiniteScroll>
  );
}
```

## 3. Migrate to Hybrid Cache

### Step 1: Update patient cache service

```typescript
// In patient-cache.service.ts
import { getHybridCache, cacheKeys } from '@/services/hybrid-cache.service';

class PatientCacheService {
  private cache = getHybridCache();
  
  async getPatient(patientId: string): Promise<Patient | null> {
    const key = cacheKeys.patient(patientId);
    return this.cache.get<Patient>(key);
  }
  
  async cachePatient(patient: Patient): Promise<void> {
    const key = cacheKeys.patient(patient.id!);
    await this.cache.set(key, patient, 30 * 60 * 1000); // 30 min TTL
  }
  
  async invalidatePatient(patientId: string): Promise<void> {
    const pattern = cacheKeys.allPatientData(patientId);
    await this.cache.invalidate(pattern);
  }
}
```

### Step 2: Update stores to use cache

```typescript
// In patient store
import { getHybridCache } from '@/services/hybrid-cache.service';

const cache = getHybridCache();

loadPatients: async () => {
  // Check cache first
  const cached = await cache.get<Patient[]>('patients:list');
  if (cached) {
    set({ patients: cached, isLoading: false });
  }
  
  // Fetch fresh data
  set({ isLoading: true });
  try {
    const patients = await fetchPatients();
    await cache.set('patients:list', patients, 5 * 60 * 1000);
    set({ patients, isLoading: false });
  } catch (error) {
    // Handle error
  }
}
```

## 4. Add Real-time Subscriptions

### Step 1: Initialize subscription service

```typescript
// In app initialization
import { SubscriptionService } from '@/services/subscription.service';

const subscriptionService = new SubscriptionService(enhancedMedplumClient);

// Make available via context
export const SubscriptionContext = React.createContext(subscriptionService);
```

### Step 2: Use subscriptions in components

```typescript
import { useSubscription } from '@/hooks/useSubscription';

function PatientMonitor({ patientId }) {
  const { resources: vitals } = useSubscription(
    'Observation',
    {
      patient: patientId,
      category: 'vital-signs',
      _sort: '-date',
    },
    (newVital) => {
      // Handle real-time vital sign update
      showNotification(`New vital sign recorded: ${newVital.code.text}`);
    }
  );
  
  return <VitalsDisplay vitals={vitals} />;
}
```

## 5. Implement Batch Operations

### Step 1: Use batch manager for bulk operations

```typescript
import { BatchManager } from '@/services/batch-manager';

const batchManager = new BatchManager(enhancedMedplumClient);

// Batch multiple operations
async function updateMultiplePatients(updates: PatientUpdate[]) {
  const results = await Promise.all(
    updates.map(update => 
      batchManager.execute({
        type: 'update',
        resourceType: 'Patient',
        id: update.id,
        resource: update.data,
      })
    )
  );
  
  // All operations are automatically batched
  return results;
}
```

### Step 2: Use data loader for efficient fetching

```typescript
import { FHIRDataLoader } from '@/services/data-loader';

const dataLoader = new FHIRDataLoader(enhancedMedplumClient);

// In a component that needs multiple resources
async function loadDashboardData(patientIds: string[]) {
  // These will be batched into a single request
  const patients = await dataLoader.loadMany<Patient>('Patient', patientIds);
  
  // Handle results
  patients.forEach((result, index) => {
    if (result instanceof Error) {
      console.error(`Failed to load patient ${patientIds[index]}`);
    } else {
      // Process patient
    }
  });
}
```

## 6. Migration Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Implement enhanced MedplumClient
- [ ] Add request/response interceptors
- [ ] Create hybrid cache service
- [ ] Implement useResource hook
- [ ] Implement useResourceSearch hook

### Phase 2: Core Features (Week 3-4)
- [ ] Migrate patient store to use new hooks
- [ ] Update patient cache service
- [ ] Implement subscription service
- [ ] Add useSubscription hook
- [ ] Create batch manager

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement data loader pattern
- [ ] Add smart retry strategies
- [ ] Enhance error handling
- [ ] Add performance monitoring
- [ ] Implement cache warming

### Phase 4: Integration (Week 7-8)
- [ ] Update all components to use new hooks
- [ ] Migrate offline sync to use hybrid cache
- [ ] Add real-time updates where needed
- [ ] Performance testing
- [ ] Documentation

## 7. Testing Strategy

### Unit Tests
```typescript
// Test enhanced hooks
describe('useResource', () => {
  it('should return cached data when offline', async () => {
    const { result } = renderHook(() => 
      useResource('Patient', 'test-id', { offlineFirst: true })
    );
    
    // Simulate offline
    mockNavigator.onLine = false;
    
    await waitFor(() => {
      expect(result.current.isFromCache).toBe(true);
      expect(result.current.data).toBeDefined();
    });
  });
});
```

### Integration Tests
```typescript
// Test cache invalidation
it('should invalidate related cache entries', async () => {
  const cache = getHybridCache();
  
  // Set multiple related entries
  await cache.set('patient:123', mockPatient);
  await cache.set('patient:123:vitals', mockVitals);
  await cache.set('patient:123:meds', mockMeds);
  
  // Invalidate all patient data
  const invalidated = await cache.invalidate('patient:123:*');
  
  expect(invalidated).toBe(2); // vitals and meds
  expect(await cache.has('patient:123')).toBe(true);
  expect(await cache.has('patient:123:vitals')).toBe(false);
});
```

## 8. Monitoring and Analytics

### Add performance tracking
```typescript
enhancedMedplumClient.addInterceptor({
  onRequest: (config) => {
    config.metadata = {
      ...config.metadata,
      startTime: performance.now(),
    };
    return config;
  },
  onResponse: (response) => {
    const duration = performance.now() - response.config.metadata.startTime;
    
    analytics.track('api_request', {
      url: response.url,
      status: response.status,
      duration,
      cached: response.headers.get('X-Cache') === 'HIT',
    });
    
    return response;
  },
});
```

### Monitor cache performance
```typescript
// Periodically log cache stats
setInterval(() => {
  const stats = cache.getStats();
  
  analytics.track('cache_performance', {
    hitRate: stats.hitRate,
    memorySize: stats.memorySize,
    evictions: stats.evictions,
  });
}, 60000); // Every minute
```

## 9. Rollback Plan

If issues arise during migration:

1. **Feature flags**: Use feature flags to toggle between old and new implementations
2. **Gradual rollout**: Migrate one component/feature at a time
3. **Parallel running**: Run both systems in parallel during transition
4. **Quick revert**: Keep old implementation files with `.backup` extension

```typescript
// Feature flag example
const useEnhancedDataLayer = getFeatureFlag('enhanced-data-layer');

export const medplumClient = useEnhancedDataLayer 
  ? enhancedMedplumClient 
  : legacyMedplumClient;
```

## 10. Success Metrics

Track these metrics to measure improvement:

1. **Performance**
   - API response time (target: <200ms for cached, <500ms for fresh)
   - Cache hit rate (target: >80%)
   - Time to interactive (target: <2s)

2. **Reliability**
   - Error rate (target: <0.1%)
   - Successful retry rate (target: >95%)
   - Offline functionality (target: 100% read, 100% write queue)

3. **Developer Experience**
   - Lines of code reduced (target: -30%)
   - Type safety coverage (target: 100%)
   - Development velocity (target: +25%)

## Next Steps

1. Review the [full comparison report](./MEDPLUM_COMPARISON_REPORT.md)
2. Set up the enhanced client in a test environment
3. Start with Phase 1 implementation
4. Schedule weekly progress reviews
5. Document learnings and adjustments

For questions or support, refer to:
- [Medplum Documentation](https://www.medplum.com/docs)
- [FHIR Specification](https://www.hl7.org/fhir/)
- Internal OmniCare architecture docs