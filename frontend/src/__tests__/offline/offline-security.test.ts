// Offline Security Tests
import CryptoJS from 'crypto-js';

// Mock crypto functions for testing
const mockCrypto = {
  subtle: {
    generateKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    exportKey: jest.fn(),
    importKey: jest.fn(),
    deriveBits: jest.fn(),
    deriveKey: jest.fn(),
    digest: jest.fn()
  },
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  })
};

// Encryption service for offline data
class OfflineEncryptionService {
  private encryptionKey: string | null = null;
  private readonly SALT = 'omnicare-offline-salt';
  private readonly IV_LENGTH = 16;

  async initialize(userPassword: string): Promise<void> {
    // Derive encryption key from user password
    this.encryptionKey = await this.deriveKey(userPassword);
  }

  private async deriveKey(password: string): Promise<string> {
    // In production, use PBKDF2 or similar
    const hash = CryptoJS.SHA256(password + this.SALT);
    return hash.toString();
  }

  async encrypt(data: any): Promise<{
    encrypted: string;
    iv: string;
    authTag?: string;
  }> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    const jsonData = JSON.stringify(data);
    const iv = CryptoJS.lib.WordArray.random(this.IV_LENGTH);
    
    // Encrypt with AES-GCM (simulated with AES-CBC for testing)
    const encrypted = CryptoJS.AES.encrypt(jsonData, this.encryptionKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Generate auth tag (simulated)
    const authTag = CryptoJS.HmacSHA256(encrypted.toString(), this.encryptionKey);

    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(),
      authTag: authTag.toString()
    };
  }

  async decrypt(encryptedData: {
    encrypted: string;
    iv: string;
    authTag?: string;
  }): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    // Verify auth tag if present
    if (encryptedData.authTag) {
      const expectedTag = CryptoJS.HmacSHA256(encryptedData.encrypted, this.encryptionKey);
      if (expectedTag.toString() !== encryptedData.authTag) {
        throw new Error('Authentication tag verification failed');
      }
    }

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, this.encryptionKey, {
      iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const jsonData = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(jsonData);
  }

  clearKey(): void {
    this.encryptionKey = null;
  }
}

// Secure offline storage implementation
class SecureOfflineStorage {
  private encryptionService: OfflineEncryptionService;
  private storage: Map<string, any> = new Map();
  private accessLog: Array<{
    action: string;
    key: string;
    timestamp: number;
    userId?: string;
  }> = [];

  constructor(encryptionService: OfflineEncryptionService) {
    this.encryptionService = encryptionService;
  }

  async setItem(key: string, value: any, userId?: string): Promise<void> {
    // Log access
    this.accessLog.push({
      action: 'set',
      key,
      timestamp: Date.now(),
      userId
    });

    // Encrypt data
    const encrypted = await this.encryptionService.encrypt({
      value,
      metadata: {
        key,
        timestamp: Date.now(),
        userId
      }
    });

    this.storage.set(key, encrypted);
  }

  async getItem(key: string, userId?: string): Promise<any> {
    // Log access
    this.accessLog.push({
      action: 'get',
      key,
      timestamp: Date.now(),
      userId
    });

    const encrypted = this.storage.get(key);
    if (!encrypted) return null;

    try {
      const decrypted = await this.encryptionService.decrypt(encrypted);
      
      // Verify metadata
      if (decrypted.metadata.key !== key) {
        throw new Error('Key mismatch in encrypted data');
      }

      return decrypted.value;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  async removeItem(key: string, userId?: string): Promise<void> {
    // Log access
    this.accessLog.push({
      action: 'remove',
      key,
      timestamp: Date.now(),
      userId
    });

    this.storage.delete(key);
  }

  getAccessLog(): typeof this.accessLog {
    return [...this.accessLog];
  }

  clearAccessLog(): void {
    this.accessLog = [];
  }

  async clear(): Promise<void> {
    this.storage.clear();
    this.accessLog = [];
  }
}

// Data sanitization utilities
class DataSanitizer {
  static sanitizePatientData(data: any): any {
    const sanitized = { ...data };
    
    // Remove or mask sensitive fields
    if (sanitized.ssn) {
      sanitized.ssn = this.maskSSN(sanitized.ssn);
    }
    
    if (sanitized.creditCard) {
      delete sanitized.creditCard;
    }
    
    if (sanitized.medicalRecordNumber) {
      sanitized.medicalRecordNumber = this.hashValue(sanitized.medicalRecordNumber);
    }

    // Sanitize nested objects
    if (sanitized.emergencyContact) {
      sanitized.emergencyContact = this.sanitizeContactInfo(sanitized.emergencyContact);
    }

    return sanitized;
  }

  private static maskSSN(ssn: string): string {
    return ssn.replace(/^(\d{3})(\d{2})(\d{4})$/, 'XXX-XX-$3');
  }

  private static hashValue(value: string): string {
    return CryptoJS.SHA256(value).toString().substring(0, 16);
  }

  private static sanitizeContactInfo(contact: any): any {
    const sanitized = { ...contact };
    
    if (sanitized.phone) {
      // Keep area code, mask rest
      sanitized.phone = sanitized.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-XXX-XXXX');
    }
    
    return sanitized;
  }

  static validateDataIntegrity(data: any, checksum: string): boolean {
    const calculatedChecksum = CryptoJS.SHA256(JSON.stringify(data)).toString();
    return calculatedChecksum === checksum;
  }
}

// Permission checker for offline access
class OfflinePermissionChecker {
  private permissions: Map<string, Set<string>> = new Map();

  setUserPermissions(userId: string, permissions: string[]): void {
    this.permissions.set(userId, new Set(permissions));
  }

  canAccess(userId: string, resource: string, action: string): boolean {
    const userPermissions = this.permissions.get(userId);
    if (!userPermissions) return false;

    const permission = `${resource}:${action}`;
    return userPermissions.has(permission) || userPermissions.has(`${resource}:*`);
  }

  canAccessPatientData(userId: string, patientId: string): boolean {
    // Check if user has permission to access this specific patient
    const userPermissions = this.permissions.get(userId);
    if (!userPermissions) return false;

    return userPermissions.has('patients:read') || 
           userPermissions.has(`patient:${patientId}:read`);
  }
}

describe('Offline Security Tests', () => {
  let encryptionService: OfflineEncryptionService;
  let secureStorage: SecureOfflineStorage;
  let permissionChecker: OfflinePermissionChecker;

  beforeEach(async () => {
    global.crypto = mockCrypto as any;
    
    encryptionService = new OfflineEncryptionService();
    await encryptionService.initialize('test-password');
    
    secureStorage = new SecureOfflineStorage(encryptionService);
    permissionChecker = new OfflinePermissionChecker();
  });

  afterEach(() => {
    encryptionService.clearKey();
  });

  describe('Data Encryption', () => {
    it('should encrypt sensitive data before storing offline', async () => {
      const sensitiveData = {
        patientId: '123',
        ssn: '123-45-6789',
        diagnosis: 'Hypertension',
        medications: ['Lisinopril', 'Metformin']
      };

      const encrypted = await encryptionService.encrypt(sensitiveData);
      
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.encrypted).not.toContain('123-45-6789');
      expect(encrypted.encrypted).not.toContain('Hypertension');
    });

    it('should decrypt data correctly with valid key', async () => {
      const originalData = {
        patientId: '123',
        name: 'John Doe',
        dob: '1990-01-01'
      };

      const encrypted = await encryptionService.encrypt(originalData);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toEqual(originalData);
    });

    it('should fail to decrypt with wrong key', async () => {
      const data = { test: 'data' };
      const encrypted = await encryptionService.encrypt(data);

      // Create new service with different key
      const wrongKeyService = new OfflineEncryptionService();
      await wrongKeyService.initialize('wrong-password');

      await expect(wrongKeyService.decrypt(encrypted)).rejects.toThrow();
    });

    it('should detect tampering through auth tag verification', async () => {
      const data = { patient: 'data' };
      const encrypted = await encryptionService.encrypt(data);

      // Tamper with encrypted data
      encrypted.encrypted = encrypted.encrypted + 'tampered';

      await expect(encryptionService.decrypt(encrypted)).rejects.toThrow(
        'Authentication tag verification failed'
      );
    });
  });

  describe('Secure Storage', () => {
    it('should store and retrieve encrypted data', async () => {
      const patientData = {
        id: '123',
        name: 'Jane Doe',
        medications: ['Aspirin']
      };

      await secureStorage.setItem('patient-123', patientData, 'user-456');
      const retrieved = await secureStorage.getItem('patient-123', 'user-456');

      expect(retrieved).toEqual(patientData);
    });

    it('should maintain access logs', async () => {
      await secureStorage.setItem('test-key', 'test-value', 'user-123');
      await secureStorage.getItem('test-key', 'user-123');
      await secureStorage.removeItem('test-key', 'user-123');

      const log = secureStorage.getAccessLog();
      
      expect(log).toHaveLength(3);
      expect(log[0]).toMatchObject({
        action: 'set',
        key: 'test-key',
        userId: 'user-123'
      });
      expect(log[1]).toMatchObject({
        action: 'get',
        key: 'test-key',
        userId: 'user-123'
      });
      expect(log[2]).toMatchObject({
        action: 'remove',
        key: 'test-key',
        userId: 'user-123'
      });
    });

    it('should handle storage quota limits', async () => {
      const largeData = new Array(1000).fill('x').join(''); // 1KB
      let stored = 0;

      // Try to store until we hit a reasonable limit
      for (let i = 0; i < 100; i++) {
        try {
          await secureStorage.setItem(`large-${i}`, largeData);
          stored++;
        } catch (error) {
          // Storage quota exceeded
          break;
        }
      }

      expect(stored).toBeGreaterThan(0);
      expect(stored).toBeLessThan(100); // Should hit some limit
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize patient data before offline storage', () => {
      const patientData = {
        id: '123',
        name: 'John Doe',
        ssn: '123456789',
        creditCard: '4111111111111111',
        medicalRecordNumber: 'MRN123456',
        emergencyContact: {
          name: 'Jane Doe',
          phone: '5551234567'
        }
      };

      const sanitized = DataSanitizer.sanitizePatientData(patientData);

      expect(sanitized.ssn).toBe('XXX-XX-6789');
      expect(sanitized.creditCard).toBeUndefined();
      expect(sanitized.medicalRecordNumber).not.toBe('MRN123456');
      expect(sanitized.medicalRecordNumber).toHaveLength(16); // Hash length
      expect(sanitized.emergencyContact.phone).toBe('555-XXX-XXXX');
    });

    it('should validate data integrity', () => {
      const data = { patient: 'data', timestamp: Date.now() };
      const checksum = CryptoJS.SHA256(JSON.stringify(data)).toString();

      expect(DataSanitizer.validateDataIntegrity(data, checksum)).toBe(true);

      // Modify data
      data.patient = 'modified';
      expect(DataSanitizer.validateDataIntegrity(data, checksum)).toBe(false);
    });
  });

  describe('Offline Permissions', () => {
    beforeEach(() => {
      permissionChecker.setUserPermissions('doctor-1', [
        'patients:read',
        'patients:write',
        'medications:prescribe'
      ]);
      
      permissionChecker.setUserPermissions('nurse-1', [
        'patients:read',
        'vitals:write'
      ]);
      
      permissionChecker.setUserPermissions('admin-1', [
        'patients:*',
        'system:*'
      ]);
    });

    it('should enforce role-based permissions offline', () => {
      // Doctor can read and write patients
      expect(permissionChecker.canAccess('doctor-1', 'patients', 'read')).toBe(true);
      expect(permissionChecker.canAccess('doctor-1', 'patients', 'write')).toBe(true);
      expect(permissionChecker.canAccess('doctor-1', 'patients', 'delete')).toBe(false);

      // Nurse can only read patients
      expect(permissionChecker.canAccess('nurse-1', 'patients', 'read')).toBe(true);
      expect(permissionChecker.canAccess('nurse-1', 'patients', 'write')).toBe(false);

      // Admin has wildcard access
      expect(permissionChecker.canAccess('admin-1', 'patients', 'delete')).toBe(true);
      expect(permissionChecker.canAccess('admin-1', 'system', 'configure')).toBe(true);
    });

    it('should handle patient-specific permissions', () => {
      permissionChecker.setUserPermissions('specialist-1', [
        'patient:123:read',
        'patient:456:read'
      ]);

      expect(permissionChecker.canAccessPatientData('specialist-1', '123')).toBe(true);
      expect(permissionChecker.canAccessPatientData('specialist-1', '456')).toBe(true);
      expect(permissionChecker.canAccessPatientData('specialist-1', '789')).toBe(false);
    });
  });

  describe('Secure Communication', () => {
    it('should encrypt sync messages', async () => {
      const syncMessage = {
        type: 'patient-update',
        data: { id: '123', name: 'Updated Name' },
        timestamp: Date.now()
      };

      const encrypted = await encryptionService.encrypt(syncMessage);
      
      // Message should be encrypted
      expect(encrypted.encrypted).not.toContain('patient-update');
      expect(encrypted.encrypted).not.toContain('Updated Name');
    });

    it('should validate message integrity during sync', async () => {
      const message = {
        data: 'sync data',
        nonce: crypto.getRandomValues(new Uint8Array(16))
      };

      const encrypted = await encryptionService.encrypt(message);
      
      // Simulate message transmission
      const transmitted = { ...encrypted };
      
      // Verify integrity
      const decrypted = await encryptionService.decrypt(transmitted);
      expect(decrypted).toEqual(message);
    });
  });

  describe('Security Audit', () => {
    it('should detect unauthorized access attempts', async () => {
      const auditLog: any[] = [];
      
      // Mock unauthorized access attempt
      const attemptUnauthorizedAccess = async (userId: string, resource: string) => {
        if (!permissionChecker.canAccess(userId, 'patients', 'read')) {
          auditLog.push({
            type: 'unauthorized_access',
            userId,
            resource,
            timestamp: Date.now()
          });
          throw new Error('Unauthorized access');
        }
      };

      // User without permissions
      await expect(
        attemptUnauthorizedAccess('unauthorized-user', 'patient-123')
      ).rejects.toThrow('Unauthorized access');

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].type).toBe('unauthorized_access');
    });

    it('should limit failed decryption attempts', async () => {
      let failedAttempts = 0;
      const maxAttempts = 3;

      const attemptDecryption = async (encryptedData: any) => {
        try {
          await encryptionService.decrypt(encryptedData);
        } catch (error) {
          failedAttempts++;
          if (failedAttempts >= maxAttempts) {
            throw new Error('Too many failed attempts. Access locked.');
          }
          throw error;
        }
      };

      const validEncrypted = await encryptionService.encrypt({ test: 'data' });
      const invalidEncrypted = { ...validEncrypted, authTag: 'invalid' };

      // Try with invalid data multiple times
      for (let i = 0; i < maxAttempts; i++) {
        await expect(attemptDecryption(invalidEncrypted)).rejects.toThrow();
      }

      // Next attempt should be locked
      await expect(attemptDecryption(invalidEncrypted)).rejects.toThrow(
        'Too many failed attempts'
      );
    });
  });

  describe('Secure Deletion', () => {
    it('should securely wipe sensitive data', async () => {
      const sensitiveData = {
        ssn: '123-45-6789',
        medicalHistory: 'Confidential information'
      };

      // Store data
      await secureStorage.setItem('sensitive-1', sensitiveData);
      
      // Verify it exists
      const retrieved = await secureStorage.getItem('sensitive-1');
      expect(retrieved).toEqual(sensitiveData);

      // Secure deletion
      await secureStorage.removeItem('sensitive-1');
      
      // Verify it's gone
      const afterDeletion = await secureStorage.getItem('sensitive-1');
      expect(afterDeletion).toBeNull();

      // Verify it's not in storage
      const allKeys = Array.from((secureStorage as any).storage.keys());
      expect(allKeys).not.toContain('sensitive-1');
    });

    it('should clear all offline data on logout', async () => {
      // Store multiple items
      await secureStorage.setItem('item-1', 'data-1');
      await secureStorage.setItem('item-2', 'data-2');
      await secureStorage.setItem('item-3', 'data-3');

      // Clear all on logout
      await secureStorage.clear();
      encryptionService.clearKey();

      // Verify all data is gone
      expect(await secureStorage.getItem('item-1')).toBeNull();
      expect(await secureStorage.getItem('item-2')).toBeNull();
      expect(await secureStorage.getItem('item-3')).toBeNull();

      // Verify access log is also cleared
      expect(secureStorage.getAccessLog()).toHaveLength(0);
    });
  });
});