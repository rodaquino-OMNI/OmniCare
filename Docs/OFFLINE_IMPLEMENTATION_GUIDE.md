# OmniCare Offline-First Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the offline-first architecture in OmniCare. The implementation is designed to be rolled out in phases to minimize disruption to existing services.

## Prerequisites

- Node.js 18+ and npm 9+
- React Native 0.72+ (Mobile)
- Next.js 14+ (Web)
- SQLite (Mobile) / IndexedDB (Web)
- Service Worker support (Web)

## Phase 1: Foundation (Weeks 1-4)

### 1.1 Set Up Offline Storage Infrastructure

#### Mobile (React Native)

1. Install required dependencies:
```bash
npm install @react-native-async-storage/async-storage
npm install react-native-sqlite-storage
npm install react-native-get-random-values
npm install react-native-crypto
```

2. Configure SQLite encryption:
```typescript
// src/services/offline/mobile-store.implementation.ts
import SQLite from 'react-native-sqlite-storage';

export class MobileOfflineStore extends OfflineDataStore {
  private db: SQLite.Database;
  
  async initialize() {
    this.db = await SQLite.openDatabase({
      name: 'omnicare_offline.db',
      location: 'default',
      createFromLocation: '~omnicare_schema.sqlite'
    });
    
    await this.createTables();
    await this.enableEncryption();
  }
}
```

#### Web (IndexedDB)

1. Install dependencies:
```bash
npm install idb
npm install workbox-precaching
npm install workbox-routing
npm install workbox-strategies
```

2. Set up Service Worker:
```typescript
// public/service-worker.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { OfflineSync } from './offline-sync';

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);

// Cache FHIR resources
registerRoute(
  /\/fhir\/R4\/(Patient|Encounter|Observation)/,
  new NetworkFirst({
    cacheName: 'fhir-resources',
    plugins: [new OfflineSync()]
  })
);
```

### 1.2 Implement Encryption Layer

1. Initialize encryption service:
```typescript
// App initialization
import { OfflineEncryptionService } from '@/services/offline/encryption.service';

const encryption = new OfflineEncryptionService();
await encryption.initialize(userMasterPassword);

// Store encrypted resource
const encrypted = await encryption.encryptResource(patient);
await offlineStore.storeEncrypted(encrypted);
```

2. Set up key rotation schedule:
```typescript
// Key rotation job
setInterval(async () => {
  if (encryption.isKeyRotationNeeded()) {
    await encryption.rotateKeys();
  }
}, 24 * 60 * 60 * 1000); // Daily check
```

### 1.3 Implement Basic Sync Engine

1. Configure sync strategies:
```typescript
const syncConfig: OfflineSyncConfig = {
  autoSync: true,
  syncInterval: 5, // minutes
  syncOnWifiOnly: false,
  backgroundSync: true,
  maxRetries: 3,
  resourceStrategies: new Map([
    ['Patient', {
      direction: 'bidirectional',
      conflictResolution: 'merge',
      priority: 1,
      batchSize: 50,
      retryPolicy: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 300
      },
      cacheStrategy: {
        priority: 'high',
        retention: {
          active: 'permanent',
          recent: '90_days'
        }
      }
    }]
  ])
};
```

2. Initialize sync engine:
```typescript
const syncEngine = new SyncEngine(offlineStore, medplumClient, syncConfig);

// Start auto-sync
setInterval(() => {
  if (navigator.onLine) {
    syncEngine.syncWithServer();
  }
}, syncConfig.syncInterval * 60 * 1000);
```

## Phase 2: Core Features (Weeks 5-8)

### 2.1 Implement Conflict Resolution

1. Set up conflict resolver:
```typescript
// Configure business rules
const conflictResolver = new ConflictResolver(offlineStore);

// Handle conflicts during sync
syncEngine.on('conflict', async (conflict) => {
  const resolution = await conflictResolver.resolve(
    conflict,
    conflict.local,
    conflict.remote,
    'merge'
  );
  
  if (!resolution) {
    // Queue for manual resolution
    await notifyUser(conflict);
  }
});
```

2. Create conflict resolution UI:
```tsx
// components/ConflictResolutionModal.tsx
export const ConflictResolutionModal: React.FC<{conflict: Conflict}> = ({conflict}) => {
  return (
    <Modal>
      <h2>Resolve Conflict</h2>
      <ConflictDiff 
        local={conflict.local}
        remote={conflict.remote}
      />
      <ConflictActions onResolve={handleResolve} />
    </Modal>
  );
};
```

### 2.2 Implement Caching Strategies

1. Configure resource-specific caching:
```typescript
// Cache manager implementation
class CacheManager {
  async cachePatient(patient: Patient) {
    // Cache with related resources
    const encounters = await this.fetchRelatedEncounters(patient.id);
    const observations = await this.fetchRecentObservations(patient.id);
    
    await this.offlineStore.storeWithRelated(patient, {
      encounters,
      observations
    });
  }
  
  async evictStaleData() {
    const strategies = this.getCacheStrategies();
    
    for (const [resourceType, strategy] of strategies) {
      await this.evictByStrategy(resourceType, strategy);
    }
  }
}
```

2. Implement intelligent prefetching:
```typescript
// Prefetch based on user patterns
class PrefetchService {
  async prefetchForUser(userId: string) {
    const patterns = await this.analyzeAccessPatterns(userId);
    
    // Prefetch high-probability resources
    for (const pattern of patterns) {
      if (pattern.probability > 0.7) {
        await this.prefetchResource(pattern.resourceType, pattern.criteria);
      }
    }
  }
}
```

### 2.3 Add Offline Audit Logging

1. Implement audit service:
```typescript
class OfflineAuditService {
  async logEvent(event: OfflineAuditEvent) {
    // Encrypt sensitive audit data
    const encrypted = await this.encryption.encryptAuditLog(event);
    
    // Store locally
    await this.auditStore.store(encrypted);
    
    // Queue for sync
    if (!navigator.onLine) {
      await this.queueForSync(encrypted);
    }
  }
  
  async validateIntegrity(): Promise<boolean> {
    const logs = await this.auditStore.getAll();
    return this.verifyChain(logs);
  }
}
```

## Phase 3: Advanced Features (Weeks 9-12)

### 3.1 Machine Learning Prefetching

1. Implement access pattern analysis:
```typescript
class MLPrefetchEngine {
  private model: TensorFlowLiteModel;
  
  async predictNextAccess(currentResource: Resource) {
    const features = this.extractFeatures(currentResource);
    const predictions = await this.model.predict(features);
    
    return predictions
      .filter(p => p.confidence > 0.7)
      .map(p => ({
        resourceType: p.resourceType,
        resourceId: p.resourceId,
        probability: p.confidence
      }));
  }
  
  private extractFeatures(resource: Resource) {
    return {
      resourceType: resource.resourceType,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      userRole: this.currentUser.role,
      department: this.currentUser.department
    };
  }
}
```

### 3.2 Advanced Conflict Resolution UI

1. Create visual diff component:
```tsx
// components/VisualDiff.tsx
export const VisualDiff: React.FC<{local: Resource, remote: Resource}> = ({local, remote}) => {
  const diff = useMemo(() => computeDiff(local, remote), [local, remote]);
  
  return (
    <div className="diff-container">
      <div className="diff-side local">
        <h3>Local Version</h3>
        <ResourceView resource={local} highlights={diff.localChanges} />
      </div>
      <div className="diff-side remote">
        <h3>Server Version</h3>
        <ResourceView resource={remote} highlights={diff.remoteChanges} />
      </div>
      <div className="diff-merge">
        <h3>Merged Result</h3>
        <MergeEditor 
          local={local}
          remote={remote}
          onChange={handleMergeChange}
        />
      </div>
    </div>
  );
};
```

### 3.3 Performance Optimization

1. Implement compression:
```typescript
class CompressionService {
  async compressResource(resource: Resource): Promise<CompressedResource> {
    const json = JSON.stringify(resource);
    const compressed = await this.compress(json, 'gzip');
    
    return {
      id: resource.id,
      resourceType: resource.resourceType,
      compressedData: compressed,
      compressionMetadata: {
        algorithm: 'gzip',
        originalSize: json.length,
        compressedSize: compressed.byteLength,
        compressionRatio: compressed.byteLength / json.length
      }
    };
  }
}
```

2. Optimize queries:
```typescript
// Create indexes for common queries
await db.createIndex('observations_by_patient', 'patient_id, date DESC');
await db.createIndex('encounters_active', 'status, patient_id WHERE status = "in-progress"');
```

## Phase 4: Rollout (Weeks 13-16)

### 4.1 Pilot Deployment

1. Select pilot departments:
   - Emergency Department (high offline needs)
   - Home Care (frequent offline scenarios)
   - ICU (critical data availability)

2. Deploy with feature flags:
```typescript
if (featureFlags.offlineEnabled && user.department in PILOT_DEPARTMENTS) {
  await initializeOfflineServices();
}
```

### 4.2 Training Materials

Create training modules:
1. Offline data management
2. Conflict resolution procedures
3. Security best practices
4. Troubleshooting guide

### 4.3 Monitoring Setup

1. Configure metrics collection:
```typescript
class OfflineMetricsCollector {
  async collectMetrics(): Promise<OfflineMetrics> {
    return {
      availability: await this.calculateAvailability(),
      syncQueueSize: await this.getSyncQueueSize(),
      conflictRate: await this.calculateConflictRate(),
      storageUsage: await this.getStorageMetrics(),
      performanceMetrics: await this.getPerformanceMetrics(),
      securityEvents: await this.getSecurityMetrics()
    };
  }
}
```

2. Set up monitoring dashboard:
```typescript
// Real-time monitoring
const metricsSocket = new WebSocket('wss://metrics.omnicare.com');

metricsSocket.on('metrics', (data) => {
  updateDashboard(data);
  checkAlertThresholds(data);
});
```

## Testing Strategy

### Unit Tests

```typescript
describe('OfflineEncryptionService', () => {
  it('should encrypt and decrypt resources correctly', async () => {
    const service = new OfflineEncryptionService();
    await service.initialize();
    
    const patient = createMockPatient();
    const encrypted = await service.encryptResource(patient);
    const decrypted = await service.decryptResource(encrypted);
    
    expect(decrypted).toEqual(patient);
  });
});
```

### Integration Tests

```typescript
describe('Offline Sync Integration', () => {
  it('should handle network disconnection gracefully', async () => {
    const syncEngine = new SyncEngine(store, client, config);
    
    // Simulate offline
    await NetworkSimulator.goOffline();
    
    // Make changes
    await store.updateResource(patient);
    
    // Verify queued
    expect(syncEngine.getSyncStatus().queueSize).toBe(1);
    
    // Go online and sync
    await NetworkSimulator.goOnline();
    await syncEngine.syncWithServer();
    
    // Verify synced
    expect(syncEngine.getSyncStatus().queueSize).toBe(0);
  });
});
```

### End-to-End Tests

```typescript
describe('Offline Clinical Workflow', () => {
  it('should complete patient assessment offline', async () => {
    // Start offline
    await device.disableNetwork();
    
    // Complete workflow
    await element(by.id('patient-list')).tap();
    await element(by.text('John Doe')).tap();
    await element(by.id('add-vitals')).tap();
    
    // Enter vital signs
    await element(by.id('temperature')).typeText('98.6');
    await element(by.id('save')).tap();
    
    // Verify saved locally
    await expect(element(by.text('Saved offline'))).toBeVisible();
    
    // Re-enable network
    await device.enableNetwork();
    
    // Verify synced
    await waitFor(element(by.text('Synced'))).toBeVisible();
  });
});
```

## Troubleshooting

### Common Issues

1. **Sync Conflicts**
   - Check conflict resolution strategy
   - Review audit logs
   - Manually resolve if needed

2. **Storage Full**
   - Run cache cleanup
   - Adjust retention policies
   - Archive old data

3. **Encryption Errors**
   - Verify key integrity
   - Check key rotation status
   - Restore from backup if needed

### Debug Tools

```typescript
// Offline debugger
class OfflineDebugger {
  async inspectStore() {
    const stats = await this.offlineStore.getStatistics();
    console.table(stats);
  }
  
  async forceSyncResource(resourceType: string, id: string) {
    await this.syncEngine.syncResource(resourceType, id);
  }
  
  async exportDebugLog() {
    const log = await this.gatherDebugInfo();
    await this.saveToFile('offline-debug.json', log);
  }
}
```

## Security Considerations

1. **Data Encryption**: All offline data must be encrypted at rest
2. **Access Control**: Enforce role-based access even offline
3. **Audit Trail**: Maintain tamper-proof audit logs
4. **Device Security**: Implement device-level security measures
5. **Key Management**: Secure key storage and rotation

## Performance Benchmarks

Target metrics:
- Encryption/Decryption: <50ms per resource
- Query response: <100ms for indexed queries
- Sync time: <5s for 100 resources
- Storage efficiency: <500MB per provider
- Conflict resolution: <2s automatic, <30s manual

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review sync metrics
   - Check conflict queue
   - Monitor storage usage

2. **Monthly**
   - Rotate encryption keys
   - Archive old audit logs
   - Optimize database

3. **Quarterly**
   - Review and update caching strategies
   - Analyze access patterns
   - Update prefetch models

## Support

For implementation support:
- Technical issues: offline-support@omnicare.com
- Security concerns: security@omnicare.com
- Training requests: training@omnicare.com

## Appendix

### A. Database Schema

```sql
-- Encrypted Resources Table
CREATE TABLE encrypted_resources (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  metadata JSONB NOT NULL,
  search_index JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resource_type (resource_type),
  INDEX idx_sync_status ((metadata->>'syncStatus')),
  INDEX idx_search (search_index)
);

-- Sync Queue Table
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_priority_created (priority, created_at)
);

-- Conflicts Table
CREATE TABLE conflicts (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  local_version JSONB NOT NULL,
  remote_version JSONB NOT NULL,
  status TEXT NOT NULL,
  resolution JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_resource (resource_type, resource_id)
);
```

### B. Configuration Examples

```json
{
  "offline": {
    "enabled": true,
    "storage": {
      "maxSize": "1GB",
      "encryptionAlgorithm": "AES-256-GCM",
      "keyRotationDays": 90
    },
    "sync": {
      "autoSync": true,
      "interval": 300,
      "batchSize": 50,
      "maxRetries": 3,
      "conflictResolution": "merge"
    },
    "cache": {
      "strategies": {
        "Patient": {
          "retention": "90d",
          "priority": "high"
        },
        "Observation": {
          "retention": "30d",
          "priority": "medium"
        }
      }
    }
  }
}
```