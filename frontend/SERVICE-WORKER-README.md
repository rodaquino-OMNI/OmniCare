# OmniCare Service Worker Implementation

## Overview

This document describes the comprehensive Service Worker implementation for OmniCare EMR, providing robust offline capabilities for healthcare professionals.

## Features

### 1. Offline Support
- **Offline Page**: Custom offline page when the app is not accessible
- **Cache Strategies**: Intelligent caching for different resource types
- **Background Sync**: Automatic synchronization when connection is restored
- **Offline Indicators**: Visual feedback for offline/online status

### 2. Caching Strategies

#### Network-First (Real-time Data)
- Patient vital signs
- Emergency data
- Alerts and notifications
- Current observations
- Active medication requests

#### Cache-First (Reference Data)
- Medication catalogs
- Lab test references
- ICD-10 codes
- Clinical guidelines
- Value sets

#### Stale-While-Revalidate (Frequently Accessed)
- Patient lists
- Appointments
- Provider information
- Organization data

### 3. Progressive Web App (PWA)
- App manifest for installability
- Service Worker registration
- Offline-first architecture
- Background sync capabilities

## Implementation Details

### Service Worker (`public/sw.js`)
```javascript
// Cache names
const STATIC_CACHE = 'omnicare-static-v1';
const DYNAMIC_CACHE = 'omnicare-dynamic-v1';
const API_CACHE = 'omnicare-api-v1';
const FHIR_CACHE = 'omnicare-fhir-v1';

// Caching strategies implemented:
- networkFirst()
- cacheFirst()
- staleWhileRevalidate()
```

### Service Worker Manager (`src/lib/service-worker.ts`)
- TypeScript service worker management
- Event handling for online/offline states
- Background sync coordination
- Cache management utilities

### Offline FHIR Service (`src/services/offline-fhir.service.ts`)
- Extends base FHIR service with offline capabilities
- Queues changes for sync when offline
- Provides cached data access
- Manages pending synchronization

## Usage

### 1. Basic Setup
The Service Worker is automatically registered through the `ServiceWorkerProvider` component:

```tsx
import { ServiceWorkerProvider } from '@/components/providers/ServiceWorkerProvider';

<ServiceWorkerProvider>
  <App />
</ServiceWorkerProvider>
```

### 2. Offline Indicators
Add offline status indicators to your UI:

```tsx
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';

<Header>
  <OfflineIndicator />
</Header>
```

### 3. Offline-Aware Components
Use the offline hooks in your components:

```tsx
import { useOfflineSync, useOfflineData } from '@/hooks';

function PatientList() {
  const { isOffline, pendingChanges } = useOfflineSync();
  
  const { data: patients, isStale } = useOfflineData(
    'patient-list',
    () => fhirService.searchPatients()
  );
  
  return (
    <div>
      {isOffline && <Alert>Working offline</Alert>}
      {pendingChanges > 0 && <Badge>{pendingChanges} pending</Badge>}
      {/* Patient list */}
    </div>
  );
}
```

### 4. Proactive Caching
Cache critical patient data for offline access:

```tsx
import { useOfflineFHIR } from '@/services/offline-fhir.service';

function PatientChart({ patientId }) {
  const { cachePatient } = useOfflineFHIR();
  
  const handleCacheForOffline = async () => {
    await cachePatient(patientId);
  };
  
  return (
    <Button onClick={handleCacheForOffline}>
      Download for Offline
    </Button>
  );
}
```

## Configuration

### Cache Expiration Times
```javascript
const CACHE_EXPIRATION = {
  static: 7 * 24 * 60 * 60 * 1000,  // 7 days
  dynamic: 24 * 60 * 60 * 1000,     // 1 day
  api: 5 * 60 * 1000,                // 5 minutes
  fhir: 10 * 60 * 1000,              // 10 minutes
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
};
```

### API Endpoint Strategies
Configure caching strategies for specific endpoints in `sw.js`:

```javascript
const API_STRATEGIES = {
  networkFirst: [
    '/api/auth',
    '/api/patients/*/vitals',
    '/fhir/R4/Observation',
  ],
  cacheFirst: [
    '/api/medications/catalog',
    '/api/reference',
  ],
  staleWhileRevalidate: [
    '/api/patients/list',
    '/fhir/R4/Patient',
  ],
};
```

## Best Practices

### 1. Critical Data Caching
- Always cache reference data (medications, lab tests, procedures)
- Cache patient demographics for recently viewed patients
- Avoid caching sensitive real-time data (vital signs, active orders)

### 2. Offline Forms
- Queue form submissions when offline
- Show clear feedback about offline state
- Validate data locally before queuing

### 3. Sync Management
- Implement conflict resolution for concurrent edits
- Show sync progress to users
- Handle sync failures gracefully

### 4. Storage Management
- Monitor cache size
- Implement cache cleanup strategies
- Respect browser storage quotas

## Testing Offline Functionality

### 1. Chrome DevTools
- Open DevTools → Application → Service Workers
- Check "Offline" to simulate offline mode
- Monitor cache storage in Application → Cache Storage

### 2. Manual Testing
```bash
# 1. Load the application
# 2. Navigate to patient charts
# 3. Click "Download for Offline" on patient records
# 4. Disconnect network/enable airplane mode
# 5. Verify cached data is accessible
# 6. Make changes while offline
# 7. Reconnect and verify sync
```

### 3. Automated Tests
```typescript
describe('Offline functionality', () => {
  it('should queue changes when offline', async () => {
    // Simulate offline
    await page.setOfflineMode(true);
    
    // Make changes
    await page.click('[data-testid="edit-patient"]');
    await page.fill('[name="phone"]', '555-0123');
    await page.click('[data-testid="save"]');
    
    // Verify queued
    const badge = await page.textContent('[data-testid="pending-sync"]');
    expect(badge).toBe('1 pending');
    
    // Go online and verify sync
    await page.setOfflineMode(false);
    await page.waitForSelector('[data-testid="sync-complete"]');
  });
});
```

## Troubleshooting

### Common Issues

1. **Service Worker not registering**
   - Check HTTPS (required for Service Workers)
   - Verify sw.js is in public directory
   - Check browser console for errors

2. **Cache not updating**
   - Clear browser cache
   - Unregister old service workers
   - Check cache versioning

3. **Sync failures**
   - Verify network connectivity
   - Check authentication tokens
   - Monitor background sync events

### Debug Commands
```javascript
// In browser console

// Check service worker status
navigator.serviceWorker.controller

// Get cache names
caches.keys().then(console.log)

// Clear all caches
caches.keys().then(names => {
  names.forEach(name => caches.delete(name))
})

// Trigger manual sync
navigator.serviceWorker.controller.postMessage({ 
  type: 'sync-now' 
})
```

## Security Considerations

1. **Data Encryption**: Sensitive data should be encrypted before caching
2. **Cache Expiration**: Implement appropriate TTLs for cached data
3. **Authentication**: Verify auth tokens before serving cached data
4. **Scope Limitation**: Limit Service Worker scope to application paths
5. **Content Security**: Validate cached responses before serving

## Future Enhancements

1. **Selective Sync**: Allow users to choose what to sync
2. **Compression**: Compress cached data to save storage
3. **Predictive Caching**: Pre-cache based on user patterns
4. **Conflict Resolution**: Advanced merge strategies for concurrent edits
5. **Analytics**: Track offline usage patterns

## Resources

- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox Library](https://developers.google.com/web/tools/workbox)
- [PWA Best Practices](https://web.dev/pwa-checklist/)
- [Next.js PWA Plugin](https://github.com/shadowwalker/next-pwa)