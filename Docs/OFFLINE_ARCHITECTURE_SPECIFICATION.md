# OmniCare Offline-First Architecture Specification

## Executive Summary

This document outlines a comprehensive offline-first architecture for the OmniCare healthcare system, enabling healthcare providers to deliver uninterrupted care regardless of network connectivity. The architecture prioritizes data availability, security, and HIPAA compliance while ensuring seamless synchronization when connectivity is restored.

## 1. Architecture Overview

### 1.1 Core Principles
- **Offline-First**: Full functionality without network connectivity
- **Data Security**: End-to-end encryption for all offline data
- **Conflict Resolution**: Intelligent merging of concurrent edits
- **HIPAA Compliance**: Secure storage and access controls
- **Progressive Enhancement**: Enhanced features when online
- **Resource Efficiency**: Optimized storage and sync strategies

### 1.2 Technology Stack
- **Frontend**: React Native (Mobile), Next.js (Web)
- **Local Storage**: 
  - Mobile: AsyncStorage + SQLite for structured data
  - Web: IndexedDB + Service Workers
- **Sync Engine**: Custom bi-directional sync with Medplum FHIR
- **Encryption**: AES-256-GCM for data at rest
- **Conflict Resolution**: Vector Clocks + CRDT for complex merges

## 2. Data Architecture

### 2.1 Local Storage Architecture

```typescript
interface OfflineDataStore {
  // Core FHIR Resources
  patients: LocalFHIRStore<Patient>;
  encounters: LocalFHIRStore<Encounter>;
  observations: LocalFHIRStore<Observation>;
  medications: LocalFHIRStore<MedicationRequest>;
  documents: LocalFHIRStore<DocumentReference>;
  
  // Sync Metadata
  syncQueue: SyncQueue;
  conflictLog: ConflictLog;
  cacheMetadata: CacheMetadata;
}

interface LocalFHIRStore<T extends Resource> {
  resources: Map<string, EncryptedResource<T>>;
  indexes: ResourceIndexes;
  relationships: ResourceRelationships;
  versions: VersionHistory;
}
```

### 2.2 Encryption Strategy

```typescript
interface EncryptedResource<T extends Resource> {
  id: string;
  resourceType: string;
  encryptedData: string; // AES-256-GCM encrypted
  metadata: {
    lastModified: string;
    version: number;
    checksum: string;
    syncStatus: SyncStatus;
  };
  searchableFields: EncryptedSearchIndex; // Encrypted search indexes
}
```

### 2.3 Caching Strategy

#### Patient Resources
```typescript
interface PatientCacheStrategy {
  priority: 'high';
  retention: {
    active: 'permanent'; // Currently admitted/active patients
    recent: '90_days';   // Recently discharged
    historical: '30_days'; // Accessed in last 30 days
  };
  prefetch: {
    related: ['Encounter', 'Observation', 'MedicationRequest'];
    depth: 2; // Fetch 2 levels of relationships
  };
}
```

#### Encounter Resources
```typescript
interface EncounterCacheStrategy {
  priority: 'high';
  retention: {
    inProgress: 'permanent';
    recent: '60_days';
    completed: '30_days';
  };
  prefetch: {
    related: ['Observation', 'Procedure', 'DiagnosticReport'];
    includeAttachments: true;
  };
}
```

#### DocumentReference Resources
```typescript
interface DocumentCacheStrategy {
  priority: 'medium';
  retention: {
    clinical: '90_days';
    administrative: '30_days';
    images: '7_days'; // Large files
  };
  compression: {
    enabled: true;
    algorithm: 'gzip';
    threshold: '100KB';
  };
}
```

## 3. Synchronization Architecture

### 3.1 Sync Engine Design

```typescript
interface SyncEngine {
  // Bi-directional sync with conflict detection
  syncWithServer(): Promise<SyncResult>;
  
  // Resource-specific sync strategies
  syncPatients(strategy: SyncStrategy): Promise<void>;
  syncEncounters(strategy: SyncStrategy): Promise<void>;
  syncObservations(strategy: SyncStrategy): Promise<void>;
  
  // Conflict resolution
  resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]>;
  
  // Sync monitoring
  getSyncStatus(): SyncStatus;
  getConflictQueue(): Conflict[];
}

interface SyncStrategy {
  direction: 'push' | 'pull' | 'bidirectional';
  conflictResolution: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  batchSize: number;
  retryPolicy: RetryPolicy;
}
```

### 3.2 Conflict Resolution

```typescript
interface ConflictResolver {
  // Automatic resolution strategies
  resolveByTimestamp(local: Resource, remote: Resource): Resource;
  resolveByVersion(local: Resource, remote: Resource): Resource;
  resolveByMerge(local: Resource, remote: Resource): Resource;
  
  // Manual resolution UI
  presentConflictUI(conflict: Conflict): Promise<Resolution>;
  
  // Domain-specific rules
  applyBusinessRules(conflict: Conflict): Resolution | null;
}

// Example: Vital Signs Conflict Resolution
class VitalSignsConflictResolver {
  resolve(local: Observation, remote: Observation): Resolution {
    // If both are from authorized devices, keep both
    if (this.isFromAuthorizedDevice(local) && 
        this.isFromAuthorizedDevice(remote)) {
      return {
        action: 'keep_both',
        result: [local, remote]
      };
    }
    
    // If timestamps are close, prefer device measurement
    if (this.isWithinMinutes(local, remote, 5)) {
      return {
        action: 'prefer_device',
        result: this.isFromDevice(local) ? local : remote
      };
    }
    
    // Otherwise, keep most recent
    return {
      action: 'keep_recent',
      result: this.getMostRecent(local, remote)
    };
  }
}
```

## 4. Security Architecture

### 4.1 Data Encryption

```typescript
interface SecurityLayer {
  // Encryption at rest
  encryptResource(resource: Resource, key: CryptoKey): Promise<EncryptedResource>;
  decryptResource(encrypted: EncryptedResource, key: CryptoKey): Promise<Resource>;
  
  // Key management
  deriveKey(masterKey: string, salt: string): Promise<CryptoKey>;
  rotateKeys(): Promise<void>;
  
  // Access control
  validateAccess(user: User, resource: Resource): boolean;
  auditAccess(user: User, resource: Resource, action: string): void;
}

// HIPAA-compliant encryption implementation
class HIPAAEncryption implements SecurityLayer {
  private algorithm = 'AES-GCM';
  private keyLength = 256;
  
  async encryptResource(resource: Resource, key: CryptoKey): Promise<EncryptedResource> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv: iv
      },
      key,
      new TextEncoder().encode(JSON.stringify(resource))
    );
    
    return {
      id: resource.id,
      resourceType: resource.resourceType,
      encryptedData: this.arrayBufferToBase64(encrypted),
      metadata: {
        iv: this.arrayBufferToBase64(iv),
        algorithm: this.algorithm,
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### 4.2 Access Control

```typescript
interface OfflineAccessControl {
  // Role-based access
  checkResourceAccess(user: User, resource: Resource): AccessDecision;
  
  // Time-based access
  validateOfflineWindow(lastSync: Date): boolean;
  
  // Device trust
  validateDeviceTrust(device: Device): boolean;
  
  // Emergency access
  grantEmergencyAccess(reason: string): EmergencyToken;
}
```

### 4.3 Audit Trail

```typescript
interface OfflineAuditLog {
  // Log all offline actions
  logAccess(event: AuditEvent): void;
  logModification(event: AuditEvent): void;
  
  // Sync audit logs
  syncAuditLogs(): Promise<void>;
  
  // Tamper detection
  validateIntegrity(): boolean;
}
```

## 5. Implementation Architecture

### 5.1 Mobile Implementation (React Native)

```typescript
// Enhanced Offline Provider
export class EnhancedOfflineProvider {
  private db: SQLiteDatabase;
  private encryption: HIPAAEncryption;
  private syncEngine: SyncEngine;
  
  async initialize() {
    // Initialize SQLite with encryption
    this.db = await SQLite.openDatabase({
      name: 'omnicare_offline.db',
      location: 'default',
      encryptionKey: await this.deriveEncryptionKey()
    });
    
    // Create tables for FHIR resources
    await this.createTables();
    
    // Initialize sync engine
    this.syncEngine = new SyncEngine(this.db, medplumClient);
  }
  
  async storeResource<T extends Resource>(resource: T): Promise<void> {
    const encrypted = await this.encryption.encryptResource(
      resource,
      await this.getEncryptionKey()
    );
    
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${resource.resourceType} 
       (id, encrypted_data, metadata, search_index) 
       VALUES (?, ?, ?, ?)`,
      [
        resource.id,
        encrypted.encryptedData,
        JSON.stringify(encrypted.metadata),
        await this.buildSearchIndex(resource)
      ]
    );
    
    // Update sync queue
    await this.syncEngine.queueForSync(resource);
  }
}
```

### 5.2 Web Implementation (IndexedDB + Service Workers)

```typescript
// Service Worker for offline web
self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      // Check if request is for FHIR resource
      if (isFHIRRequest(event.request)) {
        // Try cache first
        const cached = await getFHIRFromCache(event.request);
        if (cached) {
          // Queue background sync if online
          if (navigator.onLine) {
            queueBackgroundSync(event.request);
          }
          return cached;
        }
        
        // Try network
        try {
          const response = await fetch(event.request);
          await updateFHIRCache(event.request, response.clone());
          return response;
        } catch (error) {
          // Return offline response
          return createOfflineResponse(event.request);
        }
      }
      
      // Default network request
      return fetch(event.request);
    })()
  );
});
```

### 5.3 Sync Orchestration

```typescript
class SyncOrchestrator {
  private syncStrategies: Map<string, SyncStrategy> = new Map([
    ['Patient', {
      direction: 'bidirectional',
      conflictResolution: 'merge',
      priority: 1,
      batchSize: 50
    }],
    ['Observation', {
      direction: 'push',
      conflictResolution: 'client_wins',
      priority: 2,
      batchSize: 100
    }],
    ['DocumentReference', {
      direction: 'bidirectional',
      conflictResolution: 'manual',
      priority: 3,
      batchSize: 10
    }]
  ]);
  
  async performSync(): Promise<SyncResult> {
    const results: SyncResult[] = [];
    
    // Sort by priority
    const sortedStrategies = Array.from(this.syncStrategies.entries())
      .sort(([, a], [, b]) => a.priority - b.priority);
    
    for (const [resourceType, strategy] of sortedStrategies) {
      try {
        const result = await this.syncResource(resourceType, strategy);
        results.push(result);
      } catch (error) {
        console.error(`Sync failed for ${resourceType}:`, error);
        results.push({
          resourceType,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return this.aggregateResults(results);
  }
}
```

## 6. Performance Optimization

### 6.1 Data Compression

```typescript
interface CompressionStrategy {
  // Compress large resources
  compressResource(resource: Resource): Promise<CompressedResource>;
  
  // Selective field compression
  compressFields(resource: Resource, fields: string[]): Resource;
  
  // Binary attachment handling
  optimizeBinaryData(attachment: Attachment): Promise<Attachment>;
}
```

### 6.2 Intelligent Prefetching

```typescript
class PrefetchEngine {
  async prefetchRelatedResources(resource: Resource): Promise<void> {
    const strategy = this.getPrefetchStrategy(resource.resourceType);
    
    // Prefetch based on access patterns
    const predictions = await this.mlPredictor.predictNextAccess(resource);
    
    for (const prediction of predictions) {
      if (prediction.probability > 0.7) {
        await this.prefetchResource(prediction.resourceType, prediction.id);
      }
    }
  }
}
```

## 7. Rollout Strategy

### Phase 1: Foundation (Weeks 1-4)
1. Implement enhanced offline storage layer
2. Deploy encryption infrastructure
3. Update mobile offline providers
4. Basic sync engine implementation

### Phase 2: Core Features (Weeks 5-8)
1. Implement conflict resolution algorithms
2. Deploy caching strategies
3. Add offline audit logging
4. Integration testing

### Phase 3: Advanced Features (Weeks 9-12)
1. Machine learning prefetching
2. Advanced conflict resolution UI
3. Performance optimization
4. Security hardening

### Phase 4: Rollout (Weeks 13-16)
1. Pilot with select departments
2. Training and documentation
3. Gradual rollout by facility
4. Performance monitoring

## 8. Monitoring and Metrics

### Key Performance Indicators
- Offline availability: >99.9%
- Sync success rate: >95%
- Conflict resolution accuracy: >98%
- Data integrity: 100%
- Sync latency: <5 seconds for critical data
- Storage efficiency: <500MB per provider

### Monitoring Dashboard
```typescript
interface OfflineMetrics {
  availability: number;
  syncQueueSize: number;
  conflictRate: number;
  storageUsage: StorageMetrics;
  performanceMetrics: PerformanceMetrics;
  securityEvents: SecurityMetrics;
}
```

## 9. Compliance Considerations

### HIPAA Requirements
- Encryption at rest: AES-256
- Access controls: Role-based with audit trail
- Data retention: Configurable by resource type
- Breach notification: Automated alerts
- Emergency access: Override with audit

### Data Privacy
- Local data isolation by user
- Automatic data purging policies
- Consent management for offline access
- Cross-device sync authorization

## 10. Integration Points

### FHIR Server Integration
- Bi-directional sync with Medplum
- Support for FHIR R4 resources
- Custom extensions for offline metadata
- Bulk data operations

### Clinical Decision Support
- Offline CDS rules engine
- Local drug interaction checking
- Cached clinical guidelines
- Emergency protocols

### External Systems
- HL7 message queuing
- Lab system integration
- Pharmacy system sync
- Billing system updates

## Conclusion

This offline-first architecture ensures OmniCare can deliver uninterrupted healthcare services regardless of connectivity. The design prioritizes security, performance, and user experience while maintaining full HIPAA compliance and data integrity.