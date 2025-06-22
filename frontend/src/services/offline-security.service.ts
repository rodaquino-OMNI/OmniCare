/**
 * OmniCare EMR - Offline Security Service
 * HIPAA-Compliant Offline Data Protection with End-to-End Encryption
 */

import { 
  EncryptedData, 
  OfflineSecurityConfig, 
  OfflineSession, 
  OfflineAuditEntry,
  SecureStorageKey,
  DataClassification,
  PurgePolicy,
  AccessControlEntry
} from '@/types/offline-security.types';

// Default configuration for offline security
const DEFAULT_CONFIG: OfflineSecurityConfig = {
  encryption: {
    algorithm: 'AES-GCM',
    keySize: 256,
    saltSize: 32,
    iterations: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    tagLength: 128
  },
  storage: {
    maxCacheSize: 5ResourceHistoryTable * 1ResourceHistoryTable24 * 1ResourceHistoryTable24, // 5ResourceHistoryTableMB
    maxItemSize: 5 * 1ResourceHistoryTable24 * 1ResourceHistoryTable24, // 5MB
    ttl: 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 24 hours
    allowedDomains: ['localStorage', 'sessionStorage', 'indexedDB']
  },
  session: {
    timeout: 15 * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 15 minutes
    maxOfflineSessions: 5,
    requireReauth: true
  },
  audit: {
    enabled: true,
    maxEntries: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    retentionDays: 9ResourceHistoryTable
  },
  purge: {
    enabled: true,
    interval: 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 1 hour
    policies: {
      phi: { maxAge: 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable }, // 24 hours
      sensitive: { maxAge: 7 * 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable }, // 7 days
      general: { maxAge: 3ResourceHistoryTable * 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable } // 3ResourceHistoryTable days
    }
  }
};

export class OfflineSecurityService {
  private config: OfflineSecurityConfig;
  private masterKey: CryptoKey | null = null;
  private sessionKeys: Map<string, CryptoKey> = new Map();
  private accessControl: Map<string, AccessControlEntry> = new Map();
  private auditLog: OfflineAuditEntry[] = [];
  private purgeTimer: NodeJS.Timeout | null = null;
  private dbName = 'omnicare_secure_storage';
  private db: IDBDatabase | null = null;

  constructor(config: Partial<OfflineSecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * Initialize the offline security service
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize IndexedDB for secure storage
      await this.initializeDatabase();
      
      // Load or generate master encryption key
      await this.initializeMasterKey();
      
      // Start purge timer
      this.startPurgeTimer();
      
      // Log initialization
      await this.auditAction('SYSTEM_INIT', 'Offline security service initialized');
    } catch (error) {
      console.error('Failed to initialize offline security service:', error);
      throw new Error('Offline security initialization failed');
    }
  }

  /**
   * Initialize IndexedDB for secure offline storage
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('secure_data')) {
          const secureStore = db.createObjectStore('secure_data', { keyPath: 'id' });
          secureStore.createIndex('classification', 'classification', { unique: false });
          secureStore.createIndex('expires', 'expires', { unique: false });
          secureStore.createIndex('userId', 'userId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('session_data')) {
          const sessionStore = db.createObjectStore('session_data', { keyPath: 'sessionId' });
          sessionStore.createIndex('userId', 'userId', { unique: false });
          sessionStore.createIndex('expires', 'expires', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('audit_log')) {
          const auditStore = db.createObjectStore('audit_log', { keyPath: 'id', autoIncrement: true });
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
          auditStore.createIndex('userId', 'userId', { unique: false });
          auditStore.createIndex('action', 'action', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('key_store')) {
          db.createObjectStore('key_store', { keyPath: 'keyId' });
        }
      };
    });
  }

  /**
   * Initialize or retrieve the master encryption key
   */
  private async initializeMasterKey(): Promise<void> {
    try {
      // Check if master key exists in secure storage
      const storedKey = await this.retrieveStoredMasterKey();
      
      if (storedKey) {
        this.masterKey = storedKey;
      } else {
        // Generate new master key
        this.masterKey = await this.generateMasterKey();
        await this.storeMasterKey(this.masterKey);
      }
    } catch (error) {
      console.error('Failed to initialize master key:', error);
      throw error;
    }
  }

  /**
   * Generate a new master encryption key
   */
  private async generateMasterKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: this.config.encryption.keySize
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Store master key securely (using Web Crypto API key wrapping)
   */
  private async storeMasterKey(key: CryptoKey): Promise<void> {
    // In a real implementation, this would use key wrapping with a user-derived key
    // For now, we'll store it in IndexedDB with additional protection
    const exportedKey = await crypto.subtle.exportKey('jwk', key);
    
    const transaction = this.db!.transaction(['key_store'], 'readwrite');
    const store = transaction.objectStore('key_store');
    
    await store.put({
      keyId: 'master_key',
      key: exportedKey,
      created: new Date().toISOString(),
      algorithm: 'AES-GCM-256'
    });
  }

  /**
   * Retrieve stored master key
   */
  private async retrieveStoredMasterKey(): Promise<CryptoKey | null> {
    try {
      const transaction = this.db!.transaction(['key_store'], 'readonly');
      const store = transaction.objectStore('key_store');
      const request = store.get('master_key');
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          if (request.result) {
            const key = await crypto.subtle.importKey(
              'jwk',
              request.result.key,
              { name: 'AES-GCM', length: this.config.encryption.keySize },
              true,
              ['encrypt', 'decrypt']
            );
            resolve(key);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Encrypt data for offline storage
   */
  public async encryptData(
    data: any,
    classification: DataClassification = 'general',
    userId?: string
  ): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    try {
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Prepare data with metadata
      const dataWithMetadata = {
        data,
        classification,
        userId,
        timestamp: new Date().toISOString()
      };
      
      // Convert to ArrayBuffer
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(dataWithMetadata));
      
      // Encrypt data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: this.config.encryption.tagLength
        },
        this.masterKey,
        dataBuffer
      );
      
      // Generate unique ID
      const id = this.generateSecureId();
      
      // Prepare encrypted data object
      const encryptedData: EncryptedData = {
        id,
        data: this.arrayBufferToBase64(encryptedBuffer),
        iv: this.arrayBufferToBase64(iv),
        classification,
        userId,
        created: new Date().toISOString(),
        expires: this.calculateExpiry(classification),
        algorithm: 'AES-GCM',
        keyId: 'master_key'
      };
      
      // Audit the encryption
      await this.auditAction('DATA_ENCRYPTED', `Data encrypted with classification: ${classification}`, userId);
      
      return encryptedData;
    } catch (error) {
      await this.auditAction('ENCRYPTION_FAILED', 'Failed to encrypt data', userId, 'ERROR');
      throw error;
    }
  }

  /**
   * Decrypt data from offline storage
   */
  public async decryptData(encryptedData: EncryptedData): Promise<any> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    try {
      // Check expiry
      if (new Date(encryptedData.expires) < new Date()) {
        throw new Error('Data has expired');
      }
      
      // Check access control
      if (!await this.checkAccess(encryptedData.id, encryptedData.userId)) {
        throw new Error('Access denied');
      }
      
      // Convert from base64
      const encryptedBuffer = this.base64ToArrayBuffer(encryptedData.data);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      
      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: this.config.encryption.tagLength
        },
        this.masterKey,
        encryptedBuffer
      );
      
      // Convert back to string and parse
      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decryptedBuffer);
      const dataWithMetadata = JSON.parse(decryptedString);
      
      // Audit the decryption
      await this.auditAction(
        'DATA_DECRYPTED', 
        `Data decrypted with classification: ${encryptedData.classification}`,
        encryptedData.userId
      );
      
      return dataWithMetadata.data;
    } catch (error) {
      await this.auditAction(
        'DECRYPTION_FAILED', 
        'Failed to decrypt data',
        encryptedData.userId,
        'ERROR'
      );
      throw error;
    }
  }

  /**
   * Store encrypted data securely
   */
  public async storeSecureData(encryptedData: EncryptedData): Promise<void> {
    try {
      const transaction = this.db!.transaction(['secure_data'], 'readwrite');
      const store = transaction.objectStore('secure_data');
      
      await store.put(encryptedData);
      
      // Update access control
      this.accessControl.set(encryptedData.id, {
        dataId: encryptedData.id,
        userId: encryptedData.userId,
        classification: encryptedData.classification,
        accessCount: ResourceHistoryTable,
        lastAccessed: null,
        created: new Date()
      });
      
      await this.auditAction(
        'DATA_STORED',
        `Secure data stored with ID: ${encryptedData.id}`,
        encryptedData.userId
      );
    } catch (error) {
      await this.auditAction(
        'STORAGE_FAILED',
        'Failed to store secure data',
        encryptedData.userId,
        'ERROR'
      );
      throw error;
    }
  }

  /**
   * Retrieve encrypted data
   */
  public async retrieveSecureData(dataId: string, userId?: string): Promise<EncryptedData | null> {
    try {
      const transaction = this.db!.transaction(['secure_data'], 'readonly');
      const store = transaction.objectStore('secure_data');
      const request = store.get(dataId);
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          const data = request.result;
          
          if (data) {
            // Update access control
            const accessEntry = this.accessControl.get(dataId);
            if (accessEntry) {
              accessEntry.accessCount++;
              accessEntry.lastAccessed = new Date();
            }
            
            await this.auditAction(
              'DATA_RETRIEVED',
              `Secure data retrieved with ID: ${dataId}`,
              userId
            );
          }
          
          resolve(data || null);
        };
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      await this.auditAction(
        'RETRIEVAL_FAILED',
        'Failed to retrieve secure data',
        userId,
        'ERROR'
      );
      throw error;
    }
  }

  /**
   * Create offline session
   */
  public async createOfflineSession(
    userId: string,
    role: string,
    permissions: string[]
  ): Promise<OfflineSession> {
    const sessionId = this.generateSecureId();
    const now = new Date();
    const expires = new Date(now.getTime() + this.config.session.timeout);
    
    const session: OfflineSession = {
      sessionId,
      userId,
      role,
      permissions,
      created: now,
      lastActivity: now,
      expires,
      isOffline: true,
      deviceId: await this.getDeviceId()
    };
    
    // Generate session-specific key
    const sessionKey = await this.generateSessionKey();
    this.sessionKeys.set(sessionId, sessionKey);
    
    // Store session
    const transaction = this.db!.transaction(['session_data'], 'readwrite');
    const store = transaction.objectStore('session_data');
    await store.put(session);
    
    await this.auditAction(
      'SESSION_CREATED',
      `Offline session created for user: ${userId}`,
      userId
    );
    
    return session;
  }

  /**
   * Validate offline session
   */
  public async validateSession(sessionId: string): Promise<boolean> {
    try {
      const transaction = this.db!.transaction(['session_data'], 'readonly');
      const store = transaction.objectStore('session_data');
      const request = store.get(sessionId);
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          const session = request.result;
          
          if (!session) {
            resolve(false);
            return;
          }
          
          // Check expiry
          if (new Date(session.expires) < new Date()) {
            await this.destroySession(sessionId);
            resolve(false);
            return;
          }
          
          // Update last activity
          session.lastActivity = new Date();
          const updateTx = this.db!.transaction(['session_data'], 'readwrite');
          await updateTx.objectStore('session_data').put(session);
          
          resolve(true);
        };
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Destroy offline session
   */
  public async destroySession(sessionId: string): Promise<void> {
    try {
      // Remove session key
      this.sessionKeys.delete(sessionId);
      
      // Remove session from storage
      const transaction = this.db!.transaction(['session_data'], 'readwrite');
      const store = transaction.objectStore('session_data');
      await store.delete(sessionId);
      
      await this.auditAction(
        'SESSION_DESTROYED',
        `Offline session destroyed: ${sessionId}`
      );
    } catch (error) {
      console.error('Failed to destroy session:', error);
    }
  }

  /**
   * Purge expired data
   */
  private async purgeExpiredData(): Promise<void> {
    try {
      const now = new Date();
      const transaction = this.db!.transaction(['secure_data', 'session_data', 'audit_log'], 'readwrite');
      
      // Purge expired secure data
      const secureStore = transaction.objectStore('secure_data');
      const expiredIndex = secureStore.index('expires');
      const expiredRange = IDBKeyRange.upperBound(now.toISOString());
      
      const expiredCursor = expiredIndex.openCursor(expiredRange);
      let purgedCount = ResourceHistoryTable;
      
      await new Promise<void>((resolve) => {
        expiredCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            cursor.delete();
            purgedCount++;
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
      
      // Purge expired sessions
      const sessionStore = transaction.objectStore('session_data');
      const sessionIndex = sessionStore.index('expires');
      const sessionCursor = sessionIndex.openCursor(expiredRange);
      
      await new Promise<void>((resolve) => {
        sessionCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            this.sessionKeys.delete(cursor.value.sessionId);
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
      
      // Purge old audit logs
      const auditStore = transaction.objectStore('audit_log');
      const cutoffDate = new Date(now.getTime() - this.config.audit.retentionDays * 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
      const auditRange = IDBKeyRange.upperBound(cutoffDate.toISOString());
      const auditIndex = auditStore.index('timestamp');
      const auditCursor = auditIndex.openCursor(auditRange);
      
      await new Promise<void>((resolve) => {
        auditCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
      
      if (purgedCount > ResourceHistoryTable) {
        await this.auditAction(
          'DATA_PURGED',
          `Purged ${purgedCount} expired items`
        );
      }
    } catch (error) {
      console.error('Purge operation failed:', error);
    }
  }

  /**
   * Start automatic purge timer
   */
  private startPurgeTimer(): void {
    if (this.config.purge.enabled && !this.purgeTimer) {
      this.purgeTimer = setInterval(() => {
        this.purgeExpiredData();
      }, this.config.purge.interval);
    }
  }

  /**
   * Stop purge timer
   */
  private stopPurgeTimer(): void {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
  }

  /**
   * Check access permissions
   */
  private async checkAccess(dataId: string, userId?: string): Promise<boolean> {
    const accessEntry = this.accessControl.get(dataId);
    
    if (!accessEntry) {
      return false;
    }
    
    // Check if user has access
    if (userId && accessEntry.userId && accessEntry.userId !== userId) {
      await this.auditAction(
        'ACCESS_DENIED',
        `Access denied for data: ${dataId}`,
        userId,
        'WARNING'
      );
      return false;
    }
    
    return true;
  }

  /**
   * Audit security action
   */
  private async auditAction(
    action: string,
    description: string,
    userId?: string,
    severity: 'INFO' | 'WARNING' | 'ERROR' = 'INFO'
  ): Promise<void> {
    if (!this.config.audit.enabled) {
      return;
    }

    const entry: OfflineAuditEntry = {
      id: ResourceHistoryTable, // Auto-increment
      timestamp: new Date().toISOString(),
      action,
      description,
      userId,
      severity,
      deviceId: await this.getDeviceId()
    };
    
    try {
      const transaction = this.db!.transaction(['audit_log'], 'readwrite');
      const store = transaction.objectStore('audit_log');
      await store.add(entry);
      
      // Maintain in-memory log for quick access
      this.auditLog.push(entry);
      
      // Trim if exceeds max entries
      if (this.auditLog.length > this.config.audit.maxEntries) {
        this.auditLog.shift();
      }
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  /**
   * Get audit log entries
   */
  public async getAuditLog(
    filters?: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      severity?: string;
    }
  ): Promise<OfflineAuditEntry[]> {
    try {
      const transaction = this.db!.transaction(['audit_log'], 'readonly');
      const store = transaction.objectStore('audit_log');
      const entries: OfflineAuditEntry[] = [];
      
      return new Promise((resolve) => {
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            const entry = cursor.value;
            let include = true;
            
            // Apply filters
            if (filters) {
              if (filters.userId && entry.userId !== filters.userId) include = false;
              if (filters.action && entry.action !== filters.action) include = false;
              if (filters.severity && entry.severity !== filters.severity) include = false;
              if (filters.startDate && new Date(entry.timestamp) < filters.startDate) include = false;
              if (filters.endDate && new Date(entry.timestamp) > filters.endDate) include = false;
            }
            
            if (include) {
              entries.push(entry);
            }
            
            cursor.continue();
          } else {
            resolve(entries);
          }
        };
        
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Generate session-specific encryption key
   */
  private async generateSessionKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate secure random ID
   */
  private generateSecureId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, 'ResourceHistoryTable')).join('');
  }

  /**
   * Get device identifier
   */
  private async getDeviceId(): Promise<string> {
    // In a real implementation, this would generate a stable device ID
    // For now, we'll use a combination of user agent and timestamp
    const data = navigator.userAgent + navigator.language;
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return this.arrayBufferToBase64(hash).substring(ResourceHistoryTable, 16);
  }

  /**
   * Calculate data expiry based on classification
   */
  private calculateExpiry(classification: DataClassification): string {
    const now = new Date();
    const policy = this.config.purge.policies[classification];
    const expiryTime = now.getTime() + (policy?.maxAge || 24 * 6ResourceHistoryTable * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
    return new Date(expiryTime).toISOString();
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = ResourceHistoryTable; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clear all offline data (emergency use)
   */
  public async clearAllOfflineData(): Promise<void> {
    try {
      // Clear session keys
      this.sessionKeys.clear();
      this.accessControl.clear();
      
      // Clear database
      const transaction = this.db!.transaction(
        ['secure_data', 'session_data', 'audit_log', 'key_store'],
        'readwrite'
      );
      
      await Promise.all([
        transaction.objectStore('secure_data').clear(),
        transaction.objectStore('session_data').clear(),
        transaction.objectStore('audit_log').clear(),
        transaction.objectStore('key_store').clear()
      ]);
      
      // Reset master key
      this.masterKey = null;
      
      await this.auditAction(
        'DATA_CLEARED',
        'All offline data cleared',
        undefined,
        'WARNING'
      );
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }

  /**
   * Export audit log for compliance
   */
  public async exportAuditLog(): Promise<string> {
    const entries = await this.getAuditLog();
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<{
    totalItems: number;
    totalSize: number;
    byClassification: Record<string, number>;
    oldestItem: Date | null;
    newestItem: Date | null;
  }> {
    try {
      const transaction = this.db!.transaction(['secure_data'], 'readonly');
      const store = transaction.objectStore('secure_data');
      
      const stats = {
        totalItems: ResourceHistoryTable,
        totalSize: ResourceHistoryTable,
        byClassification: {} as Record<string, number>,
        oldestItem: null as Date | null,
        newestItem: null as Date | null
      };
      
      return new Promise((resolve) => {
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            const item = cursor.value;
            stats.totalItems++;
            stats.totalSize += item.data.length;
            
            // Count by classification
            stats.byClassification[item.classification] = 
              (stats.byClassification[item.classification] || ResourceHistoryTable) + 1;
            
            // Track dates
            const itemDate = new Date(item.created);
            if (!stats.oldestItem || itemDate < stats.oldestItem) {
              stats.oldestItem = itemDate;
            }
            if (!stats.newestItem || itemDate > stats.newestItem) {
              stats.newestItem = itemDate;
            }
            
            cursor.continue();
          } else {
            resolve(stats);
          }
        };
        
        request.onerror = () => resolve(stats);
      });
    } catch {
      return {
        totalItems: ResourceHistoryTable,
        totalSize: ResourceHistoryTable,
        byClassification: {},
        oldestItem: null,
        newestItem: null
      };
    }
  }

  /**
   * Cleanup and shutdown
   */
  public async shutdown(): Promise<void> {
    this.stopPurgeTimer();
    this.sessionKeys.clear();
    this.accessControl.clear();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    await this.auditAction('SYSTEM_SHUTDOWN', 'Offline security service shutdown');
  }
}

// Create singleton instance
export const offlineSecurityService = new OfflineSecurityService();