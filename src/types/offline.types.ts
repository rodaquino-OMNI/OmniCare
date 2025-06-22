import { Resource, Patient, Encounter, Observation, MedicationRequest, DocumentReference } from '@medplum/fhirtypes';

// Sync Status Types
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed' | 'queued';

export type ConflictResolutionStrategy = 
  | 'client_wins' 
  | 'server_wins' 
  | 'merge' 
  | 'manual' 
  | 'timestamp' 
  | 'version';

export type SyncDirection = 'push' | 'pull' | 'bidirectional';

// Encrypted Resource Types
export interface EncryptedResource<T extends Resource = Resource> {
  id: string;
  resourceType: string;
  encryptedData: string;
  metadata: EncryptionMetadata;
  searchableFields?: EncryptedSearchIndex;
}

export interface EncryptionMetadata {
  lastModified: string;
  version: number;
  checksum: string;
  syncStatus: SyncStatus;
  iv?: string;
  algorithm: string;
  timestamp: string;
}

export interface EncryptedSearchIndex {
  patientId?: string;
  encounterId?: string;
  date?: string;
  type?: string;
  status?: string;
  [key: string]: string | undefined;
}

// Local Storage Types
export interface LocalFHIRStore<T extends Resource> {
  resources: Map<string, EncryptedResource<T>>;
  indexes: ResourceIndexes;
  relationships: ResourceRelationships;
  versions: VersionHistory;
}

export interface ResourceIndexes {
  byPatient: Map<string, Set<string>>;
  byEncounter: Map<string, Set<string>>;
  byDate: Map<string, Set<string>>;
  byType: Map<string, Set<string>>;
  byStatus: Map<string, Set<string>>;
}

export interface ResourceRelationships {
  parents: Map<string, Set<string>>;
  children: Map<string, Set<string>>;
  references: Map<string, Set<string>>;
}

export interface VersionHistory {
  versions: Map<string, ResourceVersion[]>;
  conflicts: Map<string, Conflict[]>;
}

export interface ResourceVersion {
  version: number;
  timestamp: string;
  hash: string;
  author: string;
  changes: ChangeSet;
}

export interface ChangeSet {
  added: Record<string, any>;
  modified: Record<string, any>;
  deleted: string[];
}

// Conflict Resolution Types
export interface Conflict {
  id: string;
  resourceType: string;
  resourceId: string;
  localVersion: ResourceVersion;
  remoteVersion: ResourceVersion;
  detectedAt: string;
  status: 'pending' | 'resolved' | 'escalated';
  resolution?: Resolution;
}

export interface Resolution {
  action: 'keep_local' | 'keep_remote' | 'merge' | 'keep_both' | 'manual';
  result: Resource | Resource[];
  resolvedBy: string;
  resolvedAt: string;
  notes?: string;
}

// Sync Types
export interface SyncQueue {
  pending: SyncQueueItem[];
  failed: SyncQueueItem[];
  processing: SyncQueueItem[];
}

export interface SyncQueueItem {
  id: string;
  resourceType: string;
  resourceId: string;
  operation: 'create' | 'update' | 'delete';
  priority: number;
  attempts: number;
  lastAttempt?: string;
  error?: string;
  data?: any;
}

export interface SyncStrategy {
  resourceType: string;
  direction: SyncDirection;
  conflictResolution: ConflictResolutionStrategy;
  priority: number;
  batchSize: number;
  retryPolicy: RetryPolicy;
  cacheStrategy: CacheStrategy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  maxBackoffSeconds: number;
}

export interface SyncResult {
  resourceType: string;
  status: 'success' | 'partial' | 'failed';
  synced: number;
  failed: number;
  conflicts: number;
  duration: number;
  error?: string;
  details?: SyncDetails;
}

export interface SyncDetails {
  created: string[];
  updated: string[];
  deleted: string[];
  conflicted: string[];
  errors: Array<{ resourceId: string; error: string }>;
}

// Cache Strategy Types
export interface CacheStrategy {
  priority: 'low' | 'medium' | 'high' | 'critical';
  retention: RetentionPolicy;
  prefetch?: PrefetchPolicy;
  compression?: CompressionPolicy;
}

export interface RetentionPolicy {
  active?: string; // e.g., 'permanent', '90_days'
  recent?: string;
  historical?: string;
  maxSize?: number; // in MB
  maxAge?: number; // in days
}

export interface PrefetchPolicy {
  related: string[];
  depth: number;
  includeAttachments?: boolean;
  conditions?: PrefetchCondition[];
}

export interface PrefetchCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

export interface CompressionPolicy {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'lz4';
  threshold: string; // e.g., '100KB'
  excludeTypes?: string[];
}

// Offline Data Store
export interface OfflineDataStore {
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
  
  // Security
  encryptionKeys: KeyStore;
  accessLog: AccessLog;
}

export interface ConflictLog {
  active: Conflict[];
  resolved: Conflict[];
  escalated: Conflict[];
}

export interface CacheMetadata {
  totalSize: number;
  resourceCounts: Record<string, number>;
  lastSync: string;
  lastCleanup: string;
  statistics: CacheStatistics;
}

export interface CacheStatistics {
  hitRate: number;
  missRate: number;
  evictionCount: number;
  avgAccessTime: number;
}

// Security Types
export interface KeyStore {
  masterKey?: CryptoKey;
  dataKeys: Map<string, CryptoKey>;
  keyRotationSchedule: KeyRotationSchedule;
}

export interface KeyRotationSchedule {
  lastRotation: string;
  nextRotation: string;
  rotationInterval: number; // days
}

export interface AccessLog {
  entries: AccessLogEntry[];
  maxEntries: number;
}

export interface AccessLogEntry {
  timestamp: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  action: 'read' | 'write' | 'delete';
  offline: boolean;
  deviceId: string;
}

// Audit Types
export interface OfflineAuditEvent {
  id: string;
  timestamp: string;
  eventType: 'access' | 'modification' | 'sync' | 'conflict' | 'security';
  userId: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  outcome: 'success' | 'failure';
  details?: Record<string, any>;
  deviceInfo: DeviceInfo;
}

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  appVersion: string;
  osVersion: string;
  networkStatus: 'online' | 'offline';
}

// Performance Types
export interface OfflineMetrics {
  availability: number;
  syncQueueSize: number;
  conflictRate: number;
  storageUsage: StorageMetrics;
  performanceMetrics: PerformanceMetrics;
  securityEvents: SecurityMetrics;
}

export interface StorageMetrics {
  totalSize: number;
  usedSize: number;
  resourceBreakdown: Record<string, number>;
  compressionRatio: number;
}

export interface PerformanceMetrics {
  avgSyncTime: number;
  avgConflictResolutionTime: number;
  cacheHitRate: number;
  queryResponseTime: Record<string, number>;
}

export interface SecurityMetrics {
  encryptionErrors: number;
  accessViolations: number;
  keyRotations: number;
  auditLogSize: number;
}

// Compressed Resource Types
export interface CompressedResource {
  id: string;
  resourceType: string;
  compressedData: ArrayBuffer;
  compressionMetadata: CompressionMetadata;
  originalSize: number;
}

export interface CompressionMetadata {
  algorithm: string;
  compressedSize: number;
  compressionRatio: number;
  timestamp: string;
}

// Emergency Access Types
export interface EmergencyToken {
  token: string;
  expiresAt: string;
  reason: string;
  authorizedBy: string;
  scope: string[];
  auditId: string;
}

export interface EmergencyAccessRequest {
  patientId: string;
  reason: string;
  duration: number; // minutes
  requestedResources: string[];
}

// Sync Configuration
export interface OfflineSyncConfig {
  autoSync: boolean;
  syncInterval: number; // minutes
  syncOnWifiOnly: boolean;
  backgroundSync: boolean;
  maxRetries: number;
  conflictResolution: ConflictResolutionConfig;
  resourceStrategies: Map<string, SyncStrategy>;
}

export interface ConflictResolutionConfig {
  defaultStrategy: ConflictResolutionStrategy;
  requireManualReview: string[]; // resource types requiring manual review
  autoResolveWindow: number; // minutes
  escalationThreshold: number; // number of conflicts before escalation
}