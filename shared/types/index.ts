// Shared types between frontend and backend
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
  lastLoginAt?: Date;
  profilePicture?: string;
  isMfaEnabled?: boolean;
  passwordChangedAt?: Date;
  failedLoginAttempts?: number;
}

// Frontend specific user type
export interface FrontendUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export type UserRole = 
  | 'physician'
  | 'nurse' 
  | 'admin'
  | 'system_admin'
  | 'pharmacist'
  | 'lab_tech'
  | 'radiology_tech'
  | 'patient'
  | 'resident'
  | 'specialist'
  | 'coordinator'
  | 'billing'
  | 'receptionist'
  | 'social_worker';

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