# Network Monitoring System Documentation

## Overview

The OmniCare Network Monitoring System provides comprehensive network status detection and management capabilities, ensuring reliable healthcare data access even in challenging network conditions.

## Features

### 1. Network Status Detection
- Real-time online/offline status monitoring
- Connection quality assessment (poor, fair, good, excellent)
- Network type detection (4G, 3G, WiFi, etc.)
- Bandwidth and latency measurements
- Packet loss and jitter detection

### 2. Automatic Retry Mechanisms
- Intelligent retry queue with exponential backoff
- Priority-based retry processing
- Configurable retry strategies per resource type
- Automatic retry on network recovery

### 3. Network-Aware Data Loading
- Adaptive image quality based on connection speed
- Bandwidth-aware resource fetching
- Save-data mode support
- Progressive enhancement strategies

### 4. Background Synchronization
- Offline queue management
- Automatic sync when network returns
- Conflict resolution strategies
- Batch synchronization support

## Usage

### Basic Network Status Hook

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

function MyComponent() {
  const networkStatus = useNetworkStatus();
  
  if (!networkStatus.isOnline) {
    return <OfflineMessage />;
  }
  
  return (
    <div>
      Connection Quality: {networkStatus.quality.quality}
      Latency: {networkStatus.quality.latency}ms
    </div>
  );
}
```

### Network-Aware Data Fetching

```typescript
import { useNetworkAware } from '@/hooks/useNetworkAware';

function PatientData() {
  const { data, loading, error, isFromCache } = useNetworkAware(
    async () => fetchPatientData(),
    [patientId],
    {
      cacheStrategy: 'cache-first',
      enableAutoRetry: true,
      qualityThreshold: 'fair'
    }
  );
  
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      {isFromCache && <Badge>Cached Data</Badge>}
      <PatientInfo data={data} />
    </div>
  );
}
```

### Network-Aware FHIR Operations

```typescript
import { useNetworkAwareFHIRResource } from '@/hooks/useNetworkAwareFHIR';

function PatientChart({ patientId }) {
  const { data: patient, refetch } = useNetworkAwareFHIRResource(
    'Patient',
    patientId,
    {
      enableOfflineQueue: true,
      syncStrategy: 'background',
      conflictResolution: 'merge'
    }
  );
  
  return <Chart patient={patient} onRefresh={refetch} />;
}
```

### Network-Aware Images

```typescript
import { NetworkAwareImage } from '@/components/network/NetworkAwareImage';

function MedicalImage() {
  return (
    <NetworkAwareImage
      sources={[
        { src: '/images/xray-low.jpg', quality: 'low', width: 400 },
        { src: '/images/xray-med.jpg', quality: 'medium', width: 800 },
        { src: '/images/xray-high.jpg', quality: 'high', width: 1600 },
        { src: '/images/xray-full.jpg', quality: 'original', width: 3200 }
      ]}
      alt="X-Ray Image"
      showQualityIndicator
      aspectRatio={16/9}
    />
  );
}
```

## Configuration

### Network Status Provider

Add the NetworkStatusProvider to your app:

```typescript
import { NetworkStatusProvider } from '@/contexts/NetworkStatusContext';

export function App() {
  return (
    <NetworkStatusProvider 
      defaultMode="auto"
      retryOptions={{
        maxRetries: 3,
        initialBackoffMs: 1000,
        maxBackoffMs: 30000,
        backoffMultiplier: 2
      }}
    >
      <YourApp />
    </NetworkStatusProvider>
  );
}
```

### Background Sync Configuration

```typescript
import { backgroundSyncService } from '@/services/background-sync.service';

// Configure sync service
backgroundSyncService.setOptions({
  maxQueueSize: 1000,
  syncInterval: 30000, // 30 seconds
  batchSize: 10,
  persistQueue: true,
  storageKey: 'omnicare-sync-queue'
});

// Register custom sync handlers
backgroundSyncService.registerSyncHandler('custom-resource', async (task) => {
  // Custom sync logic
  return await syncCustomResource(task.data);
});
```

## API Endpoints

### Network Health Check
- `HEAD /api/health` - Lightweight latency check
- `GET /api/health` - Detailed health status

### Bandwidth Testing
- `GET /api/bandwidth-test?size=102400` - Test bandwidth with specified payload size

### Network Quality
- `GET /api/network-quality` - Get comprehensive network metrics

### Connection Testing
- `GET /api/connection-test?delay=1000&fail=false` - Test connection with configurable behavior

## Network Quality Thresholds

| Quality | Latency | Bandwidth | Jitter | Packet Loss |
|---------|---------|-----------|--------|-------------|
| Poor | >300ms | <1 Mbps | >50ms | >10% |
| Fair | 150-300ms | 1-5 Mbps | 20-50ms | 5-10% |
| Good | 50-150ms | 5-10 Mbps | 10-20ms | 1-5% |
| Excellent | <50ms | >10 Mbps | <10ms | <1% |

## Optimization Strategies

### Save-Data Mode
When save-data is enabled or network quality is poor:
- Load low-resolution images
- Disable auto-play videos
- Reduce prefetching
- Enable aggressive caching
- Batch API requests

### Cache Strategies
- **cache-first**: Check cache first, update in background
- **network-first**: Try network first, fall back to cache
- **cache-only**: Only use cached data
- **network-only**: Always fetch from network

### Conflict Resolution
- **client-wins**: Local changes take precedence
- **server-wins**: Server data takes precedence
- **merge**: Attempt to merge non-conflicting changes
- **manual**: Require user intervention

## Best Practices

1. **Always provide offline fallbacks** for critical features
2. **Use appropriate cache strategies** based on data freshness requirements
3. **Implement progressive enhancement** for better user experience
4. **Monitor retry queue size** to prevent memory issues
5. **Test with simulated network conditions** during development
6. **Provide clear feedback** about network status to users
7. **Optimize payload sizes** for poor network conditions

## Testing

Use Chrome DevTools Network throttling to test different conditions:
- Offline mode
- Slow 3G
- Fast 3G
- Custom profiles

Or use the network simulation endpoint:
```bash
curl -X POST /api/simulate-condition \
  -H "Content-Type: application/json" \
  -d '{"condition": "slow", "duration": 5000}'
```

## Monitoring

Track these metrics in production:
- Network quality distribution
- Retry success/failure rates
- Cache hit ratios
- Sync queue lengths
- Average sync durations
- Offline usage patterns