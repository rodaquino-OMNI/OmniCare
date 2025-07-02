/**
 * @jest-environment jsdom
 */

import {
  generateSecureKey,
  deriveKeyFromPassword,
  generateSalt,
  generateIV,
  calculateHash,
  generateHMAC,
  verifyHMAC,
  compressData,
  decompressData,
  generateSecureRandomString,
  arrayBufferToHex,
  hexToArrayBuffer,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  constantTimeCompare,
  secureClear,
  generateKeyPair,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  createEncryptionMetadata,
  validateEncryptionParams,
  generateDeterministicKey,
  splitDataIntoChunks,
  combineDataChunks,
  createStorageKeyId
} from '../offline-encryption.utils';

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    generateKey: jest.fn(),
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    deriveBits: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    digest: jest.fn(),
    exportKey: jest.fn()
  }
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

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

global.TextEncoder = jest.fn(() => mockTextEncoder) as any;
global.TextDecoder = jest.fn(() => mockTextDecoder) as any;

// Mock btoa/atob
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));

// Mock CompressionStream/DecompressionStream
const mockCompressionStream = jest.fn(() => ({
  writable: {
    getWriter: () => ({
      write: jest.fn(),
      close: jest.fn()
    })
  },
  readable: {
    getReader: () => ({
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
        .mockResolvedValueOnce({ done: true })
    })
  }
}));

const mockDecompressionStream = jest.fn(() => ({
  writable: {
    getWriter: () => ({
      write: jest.fn(),
      close: jest.fn()
    })
  },
  readable: {
    getReader: () => ({
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([72, 101, 108, 108, 111]) })
        .mockResolvedValueOnce({ done: true })
    })
  }
}));

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'test-agent',
    platform: 'test-platform',
    language: 'en-US'
  }
});

describe('Offline Encryption Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Key Generation', () => {
    it('should generate secure key with default length', async () => {
      const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 }, extractable: true, usages: ['encrypt', 'decrypt'] } as CryptoKey;
      mockCrypto.subtle.generateKey.mockResolvedValueOnce(mockKey);

      const key = await generateSecureKey();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(key).toBe(mockKey);
    });

    it('should generate secure key with custom length', async () => {
      const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 }, extractable: true, usages: ['encrypt', 'decrypt'] } as CryptoKey;
      mockCrypto.subtle.generateKey.mockResolvedValueOnce(mockKey);

      const key = await generateSecureKey(128);

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 128 },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('should derive key from password', async () => {
      const mockKeyMaterial = { type: 'raw', algorithm: { name: 'PBKDF2' }, extractable: false, usages: ['deriveKey'] } as unknown as CryptoKey;
      const mockDerivedKey = { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 }, extractable: true, usages: ['encrypt', 'decrypt'] } as CryptoKey;
      const salt = new Uint8Array([1, 2, 3, 4]);

      mockCrypto.subtle.importKey.mockResolvedValueOnce(mockKeyMaterial);
      mockCrypto.subtle.deriveKey.mockResolvedValueOnce(mockDerivedKey);

      const key = await deriveKeyFromPassword('password123', salt, 50000);

      expect(mockTextEncoder.encode).toHaveBeenCalledWith('password123');
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt,
          iterations: 50000,
          hash: 'SHA-256'
        },
        mockKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(key).toBe(mockDerivedKey);
    });

    it('should generate salt with default length', () => {
      const salt = generateSalt();

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32);
    });

    it('should generate salt with custom length', () => {
      const salt = generateSalt(16);

      expect(salt.length).toBe(16);
    });

    it('should generate IV with default length', () => {
      const iv = generateIV();

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(12);
    });

    it('should generate IV with custom length', () => {
      const iv = generateIV(16);

      expect(iv.length).toBe(16);
    });
  });

  describe('Hashing', () => {
    it('should calculate hash for string data', async () => {
      const mockHashBuffer = new ArrayBuffer(32);
      mockCrypto.subtle.digest.mockResolvedValueOnce(mockHashBuffer);

      const hash = await calculateHash('test data');

      expect(mockTextEncoder.encode).toHaveBeenCalledWith('test data');
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      expect(hash).toContain('00'); // Should be hex string
    });

    it('should calculate hash for ArrayBuffer data', async () => {
      const mockHashBuffer = new ArrayBuffer(32);
      const inputBuffer = new ArrayBuffer(16);
      mockCrypto.subtle.digest.mockResolvedValueOnce(mockHashBuffer);

      const hash = await calculateHash(inputBuffer);

      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', inputBuffer);
    });

    it('should generate HMAC for string data', async () => {
      const mockSignature = new ArrayBuffer(32);
      const mockKey = { type: 'secret', algorithm: { name: 'HMAC' }, extractable: true, usages: ['sign', 'verify'] } as CryptoKey;
      mockCrypto.subtle.sign.mockResolvedValueOnce(mockSignature);

      const hmac = await generateHMAC('test data', mockKey);

      expect(mockTextEncoder.encode).toHaveBeenCalledWith('test data');
      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith('HMAC', mockKey, expect.any(Uint8Array));
      expect(hmac).toContain('00'); // Should be hex string
    });

    it('should generate HMAC for ArrayBuffer data', async () => {
      const mockSignature = new ArrayBuffer(32);
      const mockKey = { type: 'secret', algorithm: { name: 'HMAC' }, extractable: true, usages: ['sign', 'verify'] } as CryptoKey;
      const inputBuffer = new ArrayBuffer(16);
      mockCrypto.subtle.sign.mockResolvedValueOnce(mockSignature);

      const hmac = await generateHMAC(inputBuffer, mockKey);

      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith('HMAC', mockKey, inputBuffer);
    });

    it('should verify HMAC correctly', async () => {
      const mockKey = { type: 'secret', algorithm: { name: 'HMAC' }, extractable: true, usages: ['sign', 'verify'] } as CryptoKey;
      const mockSignature = new ArrayBuffer(32);
      mockCrypto.subtle.sign.mockResolvedValueOnce(mockSignature);

      const result = await verifyHMAC('test data', arrayBufferToHex(mockSignature), mockKey);

      expect(result).toBe(true);
    });
  });

  describe('Compression', () => {
    it('should compress data with CompressionStream', async () => {
      Object.defineProperty(global, 'window', { value: {} });
      global.CompressionStream = mockCompressionStream as any;

      const compressed = await compressData('Hello World');

      expect(mockCompressionStream).toHaveBeenCalledWith('gzip');
      expect(compressed).toBeInstanceOf(ArrayBuffer);
    });

    it('should use fallback when CompressionStream is not available', async () => {
      delete (global as any).CompressionStream;

      const compressed = await compressData('Hello World');

      expect(mockTextEncoder.encode).toHaveBeenCalledWith('Hello World');
      expect(compressed).toBeInstanceOf(ArrayBuffer);
    });

    it('should decompress data with DecompressionStream', async () => {
      Object.defineProperty(global, 'window', { value: {} });
      global.DecompressionStream = mockDecompressionStream as any;

      const data = new ArrayBuffer(16);
      const decompressed = await decompressData(data);

      expect(mockDecompressionStream).toHaveBeenCalledWith('gzip');
      expect(decompressed).toBe('Hello');
    });

    it('should use fallback when DecompressionStream is not available', async () => {
      delete (global as any).DecompressionStream;

      const data = new ArrayBuffer(16);
      const decompressed = await decompressData(data);

      expect(mockTextDecoder.decode).toHaveBeenCalledWith(data);
    });
  });

  describe('String Generation', () => {
    it('should generate secure random string with default length', () => {
      const randomString = generateSecureRandomString();

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(randomString).toHaveLength(32);
      expect(randomString).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate secure random string with custom length', () => {
      const randomString = generateSecureRandomString(16);

      expect(randomString).toHaveLength(16);
    });
  });

  describe('Format Conversion', () => {
    it('should convert ArrayBuffer to hex', () => {
      const buffer = new Uint8Array([255, 0, 128, 64]).buffer;
      const hex = arrayBufferToHex(buffer);

      expect(hex).toBe('ff008040');
    });

    it('should convert hex to ArrayBuffer', () => {
      const hex = 'ff008040';
      const buffer = hexToArrayBuffer(hex);

      expect(new Uint8Array(buffer)).toEqual(new Uint8Array([255, 0, 128, 64]));
    });

    it('should convert ArrayBuffer to base64', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
      const base64 = arrayBufferToBase64(buffer);

      expect(global.btoa).toHaveBeenCalled();
      expect(base64).toBeDefined();
    });

    it('should convert base64 to ArrayBuffer', () => {
      const base64 = 'SGVsbG8='; // "Hello" in base64
      const buffer = base64ToArrayBuffer(base64);

      expect(global.atob).toHaveBeenCalledWith(base64);
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('Security Functions', () => {
    it('should perform constant time comparison for equal strings', () => {
      const result = constantTimeCompare('hello', 'hello');
      expect(result).toBe(true);
    });

    it('should perform constant time comparison for different strings', () => {
      const result = constantTimeCompare('hello', 'world');
      expect(result).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const result = constantTimeCompare('hello', 'hi');
      expect(result).toBe(false);
    });

    it('should securely clear Uint8Array', () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      secureClear(data);

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(data);
      expect(data).toEqual(new Uint8Array([0, 0, 0, 0]));
    });

    it('should securely clear ArrayBuffer', () => {
      const data = new Uint8Array([1, 2, 3, 4]).buffer;
      secureClear(data);

      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });
  });

  describe('Asymmetric Encryption', () => {
    it('should generate key pair', async () => {
      const mockKeyPair = { 
        publicKey: { type: 'public', algorithm: { name: 'RSA-OAEP', modulusLength: 2048 }, extractable: true, usages: ['encrypt', 'wrapKey'] } as CryptoKey,
        privateKey: { type: 'private', algorithm: { name: 'RSA-OAEP', modulusLength: 2048 }, extractable: false, usages: ['decrypt', 'unwrapKey'] } as CryptoKey
      };
      mockCrypto.subtle.generateKey.mockResolvedValueOnce(mockKeyPair);

      const keyPair = await generateKeyPair();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      );
      expect(keyPair).toBe(mockKeyPair);
    });

    it('should encrypt with public key', async () => {
      const mockEncrypted = new ArrayBuffer(256);
      const mockPublicKey = { type: 'public', algorithm: { name: 'RSA-OAEP' }, extractable: true, usages: ['encrypt'] } as CryptoKey;
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(mockEncrypted);

      const encrypted = await encryptWithPublicKey('test data', mockPublicKey);

      expect(mockTextEncoder.encode).toHaveBeenCalledWith('test data');
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        { name: 'RSA-OAEP' },
        mockPublicKey,
        expect.any(Uint8Array)
      );
      expect(encrypted).toBe(mockEncrypted);
    });

    it('should decrypt with private key', async () => {
      const mockDecrypted = new ArrayBuffer(16);
      const mockPrivateKey = { type: 'private', algorithm: { name: 'RSA-OAEP' }, extractable: false, usages: ['decrypt'] } as CryptoKey;
      const encryptedData = new ArrayBuffer(256);
      
      mockCrypto.subtle.decrypt.mockResolvedValueOnce(mockDecrypted);
      mockTextDecoder.decode.mockReturnValueOnce('test data');

      const decrypted = await decryptWithPrivateKey(encryptedData, mockPrivateKey);

      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        { name: 'RSA-OAEP' },
        mockPrivateKey,
        encryptedData
      );
      expect(mockTextDecoder.decode).toHaveBeenCalledWith(mockDecrypted);
      expect(decrypted).toBe('test data');
    });
  });

  describe('Metadata and Validation', () => {
    it('should create encryption metadata with defaults', () => {
      const metadata = createEncryptionMetadata('phi');

      expect(metadata).toMatchObject({
        version: '1.0',
        algorithm: 'AES-GCM',
        classification: 'phi',
        created: expect.any(String),
        client: {
          userAgent: 'test-agent',
          platform: 'test-platform',
          language: 'en-US'
        }
      });
    });

    it('should create encryption metadata with custom algorithm', () => {
      const metadata = createEncryptionMetadata('sensitive', 'AES-CBC');

      expect(metadata.algorithm).toBe('AES-CBC');
      expect(metadata.classification).toBe('sensitive');
    });

    it('should validate valid encryption parameters', () => {
      const validParams = {
        algorithm: 'AES-GCM',
        keySize: 256,
        ivLength: 12
      };

      expect(validateEncryptionParams(validParams)).toBe(true);
    });

    it('should reject invalid algorithm', () => {
      const invalidParams = {
        algorithm: 'INVALID-ALG'
      };

      expect(validateEncryptionParams(invalidParams)).toBe(false);
    });

    it('should reject invalid key size', () => {
      const invalidParams = {
        keySize: 512
      };

      expect(validateEncryptionParams(invalidParams)).toBe(false);
    });

    it('should reject invalid IV length', () => {
      const invalidParams = {
        ivLength: 8
      };

      expect(validateEncryptionParams(invalidParams)).toBe(false);
    });

    it('should validate empty parameters', () => {
      expect(validateEncryptionParams({})).toBe(true);
    });
  });

  describe('Deterministic Key Generation', () => {
    it('should generate deterministic key', async () => {
      const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 }, extractable: true, usages: ['encrypt', 'decrypt'] } as CryptoKey;
      const salt = new Uint8Array([1, 2, 3, 4]);
      
      mockCrypto.subtle.importKey.mockResolvedValueOnce({ type: 'raw', algorithm: { name: 'PBKDF2' }, extractable: false, usages: ['deriveKey'] } as unknown as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValueOnce(mockKey);

      const key = await generateDeterministicKey('seed123', salt, 10000);

      expect(key).toBe(mockKey);
    });
  });

  describe('Data Chunking', () => {
    it('should split data into chunks', () => {
      const data = new Uint8Array(3000).buffer; // 3KB
      const chunks = splitDataIntoChunks(data, 1024); // 1KB chunks

      expect(chunks).toHaveLength(3);
      expect(chunks[0].byteLength).toBe(1024);
      expect(chunks[1].byteLength).toBe(1024);
      expect(chunks[2].byteLength).toBe(952); // Remaining data
    });

    it('should handle data smaller than chunk size', () => {
      const data = new Uint8Array(500).buffer;
      const chunks = splitDataIntoChunks(data, 1024);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].byteLength).toBe(500);
    });

    it('should combine data chunks', () => {
      const chunk1 = new Uint8Array([1, 2, 3]).buffer;
      const chunk2 = new Uint8Array([4, 5, 6]).buffer;
      const chunk3 = new Uint8Array([7, 8, 9]).buffer;

      const combined = combineDataChunks([chunk1, chunk2, chunk3]);

      expect(combined.byteLength).toBe(9);
      expect(new Uint8Array(combined)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });

    it('should handle empty chunks array', () => {
      const combined = combineDataChunks([]);

      expect(combined.byteLength).toBe(0);
    });
  });

  describe('Storage Key ID Generation', () => {
    it('should create storage key ID with default timestamp', () => {
      const keyId = createStorageKeyId('user123', 'patient-data');

      expect(keyId).toContain('user123');
      expect(keyId).toContain('patient-data');
      expect(keyId).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    it('should create storage key ID with custom timestamp', () => {
      const timestamp = new Date('2024-01-01T00:00:00Z');
      const keyId = createStorageKeyId('user456', 'medication-data', timestamp);

      expect(keyId).toContain('user456');
      expect(keyId).toContain('medication-data');
      expect(keyId).toContain('2024-01-01T00_00_00_000Z');
    });

    it('should sanitize special characters', () => {
      const keyId = createStorageKeyId('user@123', 'patient:data');

      expect(keyId).not.toContain('@');
      expect(keyId).not.toContain(':');
      expect(keyId).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string in calculations', async () => {
      const mockHashBuffer = new ArrayBuffer(32);
      mockCrypto.subtle.digest.mockResolvedValueOnce(mockHashBuffer);

      await expect(calculateHash('')).resolves.toBeDefined();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const randomString = generateSecureRandomString(longString.length);

      expect(randomString).toHaveLength(longString.length);
    });

    it('should handle zero-length arrays', () => {
      const emptyArray = new Uint8Array(0);
      secureClear(emptyArray);
      // Should not throw
    });

    it('should handle malformed hex strings', () => {
      expect(() => hexToArrayBuffer('invalid')).not.toThrow();
    });

    it('should handle very large chunk sizes', () => {
      const data = new Uint8Array(100).buffer;
      const chunks = splitDataIntoChunks(data, 1000000); // Larger than data

      expect(chunks).toHaveLength(1);
      expect(chunks[0].byteLength).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle crypto API failures gracefully', async () => {
      mockCrypto.subtle.generateKey.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(generateSecureKey()).rejects.toThrow('Crypto error');
    });

    it('should handle digest failures', async () => {
      mockCrypto.subtle.digest.mockRejectedValueOnce(new Error('Digest error'));

      await expect(calculateHash('test')).rejects.toThrow('Digest error');
    });

    it('should handle sign failures', async () => {
      mockCrypto.subtle.sign.mockRejectedValueOnce(new Error('Sign error'));

      await expect(generateHMAC('test', { type: 'secret', algorithm: { name: 'HMAC' }, extractable: true, usages: ['sign', 'verify'] } as CryptoKey)).rejects.toThrow('Sign error');
    });
  });
});