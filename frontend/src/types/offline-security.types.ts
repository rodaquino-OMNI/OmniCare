/**
 * OmniCare EMR - Offline Security Types
 * Type definitions for offline data security and encryption
 */

export type DataClassification = 'phi' | 'sensitive' | 'general';

export interface OfflineSecurityConfig {
  encryption: {
    algorithm: string;
    keySize: number;
    saltSize: number;
    iterations: number;
    tagLength: number;
  };
  storage: {
    maxCacheSize: number;
    maxItemSize: number;
    ttl: number;
    allowedDomains: string[];
  };
  session: {
    timeout: number;
    maxOfflineSessions: number;
    requireReauth: boolean;
  };
  audit: {
    enabled: boolean;
    maxEntries: number;
    retentionDays: number;
  };
  purge: {
    enabled: boolean;
    interval: number;
    policies: Record<DataClassification, PurgePolicy>;
  };
}

export interface EncryptedData {
  id: string;
  data: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  classification: DataClassification;
  userId?: string;
  created: string;
  expires: string;
  algorithm: string;
  keyId: string;
  checksum?: string;
  metadata?: Record<string, any>;
}

export interface SecureStorageKey {
  keyId: string;
  key: JsonWebKey;
  created: string;
  expires?: string;
  algorithm: string;
  purpose: 'master' | 'session' | 'data';
  userId?: string;
}

export interface OfflineSession {
  sessionId: string;
  userId: string;
  role: string;
  permissions: string[];
  created: Date;
  lastActivity: Date;
  expires: Date;
  isOffline: boolean;
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface OfflineAuditEntry {
  id: number;
  timestamp: string;
  action: string;
  description: string;
  userId?: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  deviceId: string;
  metadata?: Record<string, any>;
}

export interface AccessControlEntry {
  dataId: string;
  userId?: string;
  classification: DataClassification;
  accessCount: number;
  lastAccessed: Date | null;
  created: Date;
  permissions?: string[];
  restrictions?: string[];
}

export interface PurgePolicy {
  maxAge: number; // milliseconds
  maxSize?: number;
  priority?: number;
  onPurge?: (data: EncryptedData) => void;
}

export interface OfflineSecurityStats {
  totalItems: number;
  totalSize: number;
  byClassification: Record<DataClassification, number>;
  oldestItem: Date | null;
  newestItem: Date | null;
  activeSessions: number;
  auditEntries: number;
}

export interface SecureStorageOptions {
  classification?: DataClassification;
  ttl?: number;
  compress?: boolean;
  metadata?: Record<string, any>;
}

export interface DataIntegrityCheck {
  dataId: string;
  isValid: boolean;
  checksum: string;
  lastVerified: Date;
  errors?: string[];
}

export interface OfflineSecurityEvent {
  type: 'SESSION_CREATED' | 'SESSION_EXPIRED' | 'DATA_ENCRYPTED' | 'DATA_DECRYPTED' | 
        'DATA_PURGED' | 'ACCESS_DENIED' | 'SECURITY_VIOLATION' | 'KEY_ROTATED';
  timestamp: Date;
  details: string;
  userId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface KeyRotationPolicy {
  enabled: boolean;
  interval: number; // milliseconds
  algorithm: string;
  keySize: number;
  backupKeys: number;
}

export interface OfflineDataSync {
  syncId: string;
  lastSync: Date;
  pendingItems: string[];
  conflicts: Array<{
    dataId: string;
    localVersion: string;
    remoteVersion: string;
    conflictType: 'UPDATE' | 'DELETE';
  }>;
  status: 'IDLE' | 'SYNCING' | 'CONFLICT' | 'ERROR';
}

export interface SecureChannelConfig {
  channelId: string;
  publicKey: string;
  privateKey?: string;
  algorithm: string;
  established: Date;
  expires: Date;
  peerPublicKey?: string;
}

export interface OfflineComplianceReport {
  reportId: string;
  generated: Date;
  period: {
    start: Date;
    end: Date;
  };
  dataAccess: {
    totalAccess: number;
    byUser: Record<string, number>;
    byClassification: Record<DataClassification, number>;
  };
  security: {
    encryptionEvents: number;
    decryptionEvents: number;
    accessDenied: number;
    securityViolations: number;
  };
  storage: {
    itemsStored: number;
    itemsPurged: number;
    averageLifetime: number;
  };
  compliance: {
    phiAccess: Array<{
      timestamp: Date;
      userId: string;
      dataId: string;
      action: string;
    }>;
    violations: Array<{
      timestamp: Date;
      type: string;
      severity: string;
      details: string;
    }>;
  };
}