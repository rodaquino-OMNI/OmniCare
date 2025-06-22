export interface DataConflict {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  field: string;
  localValue: any;
  remoteValue: any;
  localTimestamp: string;
  remoteTimestamp: string;
  localUser?: string;
  remoteUser?: string;
}

export interface ConflictResolution {
  conflictId: string;
  strategy: 'local' | 'remote' | 'merge' | 'custom';
  resolvedValue: any;
  resolvedBy: string;
  resolvedAt: string;
  mergeStrategy?: string;
}

export interface SyncOptions {
  forceSync?: boolean;
  syncOnlyIfStale?: boolean;
  conflictResolution?: 'ask' | 'local' | 'remote' | 'newest';
  dataTypes?: string[];
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: DataConflict[];
  duration: number;
  error?: string;
}

export interface OfflineChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data: any;
  timestamp: string;
  userId: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  error?: string;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: string;
  expiresAt?: string;
  version: string;
  size: number;
  metadata?: Record<string, any>;
}