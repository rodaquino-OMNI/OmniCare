// Shared sync types between frontend and backend

export interface SyncMetadata {
  lastSyncTimestamp: Date;
  syncToken?: string;
  resourceVersions: Map<string, string>;
  pendingOperations: SyncQueueItem[];
  conflicts: ConflictItem[];
}

export interface SyncQueueItem {
  id: string;
  resourceType: string;
  resourceId: string;
  operation: 'create' | 'update' | 'delete' | 'patch';
  timestamp: string;
  localVersion: number;
  attempts: number;
  maxAttempts: number;
  priority: number;
  createdAt: Date;
}

export interface ConflictItem {
  id: string;
  resourceType: string;
  resourceId: string;
  localVersion: any;
  remoteVersion: any;
  timestamp: Date;
}

export type ConflictResolutionStrategy = 'merge' | 'manual' | 'local' | 'remote';
EOF < /dev/null