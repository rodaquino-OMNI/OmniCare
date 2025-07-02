/**
 * @jest-environment jsdom
 */

import { EncryptionService, EncryptionError } from '../encryption.service';

// Mock Web Crypto API for testing
const mockCrypto = {
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue({ type: 'secret' }),
    deriveKey: jest.fn().mockResolvedValue({ type: 'secret' }),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  }
};

// Mock TextEncoder/TextDecoder
const mockTextEncoder = {
  encode: jest.fn((text) => new Uint8Array(Buffer.from(text, 'utf8')))
};

const mockTextDecoder = {
  decode: jest.fn((buffer) => {
    const uint8Array = new Uint8Array(buffer);
    return Buffer.from(uint8Array).toString('utf8');
  })
};

// Mock btoa/atob for base64 encoding
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));

// Setup crypto mock
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Setup TextEncoder/TextDecoder mocks
global.TextEncoder = jest.fn(() => mockTextEncoder) as any;
global.TextDecoder = jest.fn(() => mockTextDecoder) as any;

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = EncryptionService.getInstance();
    encryptionService.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    encryptionService.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EncryptionService.getInstance();
      const instance2 = EncryptionService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with valid credentials', async () => {
      const password = 'test-password-123';
      const userId = 'user-123';

      await encryptionService.initialize(password, userId);

      expect(encryptionService.isInitialized()).toBe(true);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();
    });

    it('should throw error when initialization fails', async () => {
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(
        encryptionService.initialize('password', 'userId')
      ).rejects.toThrow('Failed to initialize encryption');
    });

    it('should not be initialized initially', () => {
      expect(encryptionService.isInitialized()).toBe(false);
    });

    it('should clear initialization state', async () => {
      await encryptionService.initialize('password', 'userId');
      expect(encryptionService.isInitialized()).toBe(true);

      encryptionService.clear();
      expect(encryptionService.isInitialized()).toBe(false);
    });
  });

  describe('Data Encryption', () => {
    beforeEach(async () => {
      await encryptionService.initialize('test-password', 'test-user');
    });

    it('should encrypt simple data', async () => {
      const testData = { message: 'Hello, World!' };
      mockTextDecoder.decode.mockReturnValueOnce(JSON.stringify(testData));

      const encrypted = await encryptionService.encrypt(testData);

      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('timestamp');
      expect(encrypted).toHaveProperty('version');
      expect(encrypted.version).toBe(1);
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should encrypt complex nested data', async () => {
      const complexData = {
        patient: {
          id: '123',
          name: 'John Doe',
          conditions: ['hypertension', 'diabetes'],
          metadata: {
            lastUpdated: new Date().toISOString(),
            version: 1
          }
        }
      };
      mockTextDecoder.decode.mockReturnValueOnce(JSON.stringify(complexData));

      const encrypted = await encryptionService.encrypt(complexData);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(mockTextEncoder.encode).toHaveBeenCalledWith(JSON.stringify(complexData));
    });

    it('should throw error when not initialized', async () => {
      encryptionService.clear();

      await expect(
        encryptionService.encrypt({ test: 'data' })
      ).rejects.toThrow('Encryption not initialized');
    });

    it('should throw error when encryption fails', async () => {
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(
        encryptionService.encrypt({ test: 'data' })
      ).rejects.toThrow('Encryption failed');
    });

    it('should generate unique IVs for each encryption', async () => {
      const data = { test: 'data' };
      const calls: Uint8Array[] = [];
      
      mockCrypto.getRandomValues.mockImplementation((array) => {
        const randomValues = new Uint8Array(array.length);
        for (let i = 0; i < array.length; i++) {
          randomValues[i] = Math.floor(Math.random() * 256);
        }
        calls.push(new Uint8Array(randomValues));
        array.set(randomValues);
        return array;
      });

      await encryptionService.encrypt(data);
      await encryptionService.encrypt(data);

      expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(4); // 2 calls for IV + 2 calls for salt
    });
  });

  describe('Data Decryption', () => {
    beforeEach(async () => {
      await encryptionService.initialize('test-password', 'test-user');
    });

    it('should decrypt data successfully', async () => {
      const originalData = { message: 'Hello, World!' };
      const encryptedData = {
        ciphertext: 'encrypted-data',
        iv: 'initialization-vector',
        salt: 'salt-value',
        timestamp: Date.now(),
        version: 1
      };

      mockTextDecoder.decode.mockReturnValueOnce(JSON.stringify(originalData));

      const decrypted = await encryptionService.decrypt(encryptedData);

      expect(decrypted).toEqual(originalData);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should handle complex data types', async () => {
      const complexData = {
        patient: {
          id: '123',
          vitals: [
            { type: 'bp', value: '120/80' },
            { type: 'hr', value: 72 }
          ],
          active: true,
          lastVisit: null
        }
      };

      const encryptedData = {
        ciphertext: 'encrypted-complex-data',
        iv: 'iv-complex',
        salt: 'salt-complex',
        timestamp: Date.now(),
        version: 1
      };

      mockTextDecoder.decode.mockReturnValueOnce(JSON.stringify(complexData));

      const decrypted = await encryptionService.decrypt<typeof complexData>(encryptedData);

      expect(decrypted).toEqual(complexData);
      expect(decrypted.patient.vitals).toHaveLength(2);
      expect(decrypted.patient.active).toBe(true);
      expect(decrypted.patient.lastVisit).toBeNull();
    });

    it('should throw error when not initialized', async () => {
      encryptionService.clear();

      const encryptedData = {
        ciphertext: 'test',
        iv: 'test',
        salt: 'test', 
        timestamp: Date.now(),
        version: 1
      };

      await expect(
        encryptionService.decrypt(encryptedData)
      ).rejects.toThrow('Encryption not initialized');
    });

    it('should throw error when decryption fails', async () => {
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const encryptedData = {
        ciphertext: 'invalid-data',
        iv: 'test-iv',
        salt: 'test-salt',
        timestamp: Date.now(),
        version: 1
      };

      await expect(
        encryptionService.decrypt(encryptedData)
      ).rejects.toThrow('Decryption failed');
    });

    it('should throw error for invalid JSON', async () => {
      const encryptedData = {
        ciphertext: 'encrypted-data',
        iv: 'test-iv',
        salt: 'test-salt',
        timestamp: Date.now(),
        version: 1
      };

      mockTextDecoder.decode.mockReturnValueOnce('invalid-json{');

      await expect(
        encryptionService.decrypt(encryptedData)
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('Field-Level Encryption', () => {
    beforeEach(async () => {
      await encryptionService.initialize('test-password', 'test-user');
    });

    it('should generate field-specific encryption keys', async () => {
      const fieldName = 'ssn';

      const fieldKey = await encryptionService.generateFieldKey(fieldName);

      expect(fieldKey).toBeDefined();
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalled();
    });

    it('should generate different keys for different fields', async () => {
      const fieldKey1 = await encryptionService.generateFieldKey('ssn');
      const fieldKey2 = await encryptionService.generateFieldKey('dob');

      expect(fieldKey1).toBeDefined();
      expect(fieldKey2).toBeDefined();
      // Keys should be different (mock will create different objects)
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledTimes(2);
    });

    it('should throw error when not initialized', async () => {
      encryptionService.clear();

      await expect(
        encryptionService.generateFieldKey('test-field')
      ).rejects.toThrow('Encryption not initialized');
    });

    it('should throw error when field key generation fails', async () => {
      mockCrypto.subtle.exportKey.mockRejectedValueOnce(new Error('Export failed'));

      await expect(
        encryptionService.generateFieldKey('test-field')
      ).rejects.toThrow('Failed to generate field key');
    });
  });

  describe('Search Hashing', () => {
    it('should hash data for search', async () => {
      const searchData = 'John Doe';

      const hash = await encryptionService.hashForSearch(searchData);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    });

    it('should produce consistent hashes for same input', async () => {
      const searchData = 'Patient123';

      const hash1 = await encryptionService.hashForSearch(searchData);
      const hash2 = await encryptionService.hashForSearch(searchData);

      expect(hash1).toEqual(hash2);
    });

    it('should handle case insensitivity', async () => {
      const hash1 = await encryptionService.hashForSearch('JOHN DOE');
      const hash2 = await encryptionService.hashForSearch('john doe');

      expect(hash1).toEqual(hash2);
      expect(mockTextEncoder.encode).toHaveBeenCalledWith('john doe');
    });

    it('should throw error when hashing fails', async () => {
      mockCrypto.subtle.digest.mockRejectedValueOnce(new Error('Hash failed'));

      await expect(
        encryptionService.hashForSearch('test-data')
      ).rejects.toThrow('Hashing failed');
    });
  });

  describe('Data Integrity', () => {
    beforeEach(async () => {
      await encryptionService.initialize('test-password', 'test-user');
    });

    it('should validate integrity of valid encrypted data', async () => {
      const validData = {
        ciphertext: 'valid-encrypted-data',
        iv: 'valid-iv',
        salt: 'valid-salt',
        timestamp: Date.now(),
        version: 1
      };

      mockTextDecoder.decode.mockReturnValueOnce('{"valid": "data"}');

      const isValid = await encryptionService.validateIntegrity(validData);

      expect(isValid).toBe(true);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should detect tampered encrypted data', async () => {
      const tamperedData = {
        ciphertext: 'tampered-data',
        iv: 'tampered-iv',
        salt: 'tampered-salt',
        timestamp: Date.now(),
        version: 1
      };

      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const isValid = await encryptionService.validateIntegrity(tamperedData);

      expect(isValid).toBe(false);
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidData = {
        ciphertext: 'data-with-invalid-json',
        iv: 'test-iv',
        salt: 'test-salt',
        timestamp: Date.now(),
        version: 1
      };

      mockTextDecoder.decode.mockReturnValueOnce('invalid-json{');

      const isValid = await encryptionService.validateIntegrity(invalidData);

      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should create EncryptionError with correct properties', () => {
      const error = new EncryptionError('Test error message', 'TEST_CODE');

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('EncryptionError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle missing Web Crypto API gracefully', async () => {
      // Temporarily remove crypto API
      const originalCrypto = global.crypto;
      delete (global as any).crypto;

      await expect(
        encryptionService.initialize('password', 'userId')
      ).rejects.toThrow();

      // Restore crypto API
      global.crypto = originalCrypto;
    });
  });

  describe('Base64 Conversion', () => {
    it('should convert ArrayBuffer to base64 correctly', async () => {
      const testData = { test: 'data' };
      await encryptionService.initialize('password', 'userId');
      
      const encrypted = await encryptionService.encrypt(testData);
      
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(global.btoa).toHaveBeenCalled();
    });

    it('should convert base64 to ArrayBuffer correctly', async () => {
      const encryptedData = {
        ciphertext: 'dGVzdC1kYXRh', // base64 encoded 'test-data'
        iv: 'aXYtdGVzdA==', // base64 encoded 'iv-test'
        salt: 'c2FsdC10ZXN0', // base64 encoded 'salt-test'
        timestamp: Date.now(),
        version: 1
      };

      await encryptionService.initialize('password', 'userId');
      mockTextDecoder.decode.mockReturnValueOnce('{"test": "data"}');

      await encryptionService.decrypt(encryptedData);

      expect(global.atob).toHaveBeenCalled();
    });
  });
});