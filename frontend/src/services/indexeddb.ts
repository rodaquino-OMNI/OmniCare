/**
 * IndexedDB Service Exports
 * Central export point for all offline storage functionality
 */

// Main services
export { indexedDBService } from './indexeddb.service';
export { encryptionService } from './encryption.service';
export { fhirSyncService } from './indexeddb.sync';

// Query builder
export { 
  FHIRQueryBuilder, 
  query, 
  QueryOperator, 
  SortDirection,
  CommonQueries 
} from './indexeddb.query';

// Types and schemas
export type {
  StoredResource,
  SyncMetadata,
  EncryptionMetadata,
  SyncQueueEntry,
  ObjectStoreConfig,
  IndexConfig
} from './indexeddb.schemas';

export {
  DB_NAME,
  DB_VERSION,
  OBJECT_STORES,
  ENCRYPTED_FIELDS,
  RETENTION_POLICIES
} from './indexeddb.schemas';

// Service types
export type {
  IndexedDBSearchParams,
  QueryResult,
  IndexedDBError
} from './indexeddb.service';

export type {
  EncryptedData,
  EncryptionError
} from './encryption.service';

export type {
  SyncStatus,
  SyncError,
  SyncProgress,
  SyncOptions,
  ConflictResolution
} from './indexeddb.sync';

export {
  SyncEvent
} from './indexeddb.sync';

// React hooks are exported from their own file
// import { useIndexedDB, useIndexedDBResource, useIndexedDBSync } from '@/hooks/useIndexedDB';