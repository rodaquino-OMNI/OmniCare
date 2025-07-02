/**
 * Encryption Service for HIPAA-compliant data storage
 * Uses Web Crypto API for client-side encryption of healthcare data
 */

import { getErrorMessage } from '@/utils/error.utils';

// Encryption configuration
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  timestamp: number;
  version: number;
}

export class EncryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * HIPAA-compliant encryption service for healthcare data
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey?: CryptoKey;
  private keyDerivationSalt?: Uint8Array;
  private readonly textEncoder = new TextEncoder();
  private readonly textDecoder = new TextDecoder();

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize encryption with user credentials
   * @param password User password or passphrase
   * @param userId User identifier for key derivation
   */
  async initialize(password: string, userId: string): Promise<void> {
    try {
      // Generate salt from userId for consistent key derivation
      this.keyDerivationSalt = await this.generateSalt(userId);
      
      // Derive master key from password
      this.masterKey = await this.deriveKey(password, this.keyDerivationSalt);
    } catch (error) {
      throw new EncryptionError(
        `Failed to initialize encryption: ${getErrorMessage(error)}`,
        'INIT_FAILED'
      );
    }
  }

  /**
   * Check if encryption is initialized
   */
  isInitialized(): boolean {
    return !!this.masterKey;
  }

  /**
   * Clear encryption keys from memory
   */
  clear(): void {
    this.masterKey = undefined;
    this.keyDerivationSalt = undefined;
  }

  /**
   * Encrypt data for storage
   */
  async encrypt(data: any): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new EncryptionError('Encryption not initialized', 'NOT_INITIALIZED');
    }

    try {
      // Convert data to JSON string
      const plaintext = JSON.stringify(data);
      const plaintextBuffer = this.textEncoder.encode(plaintext);

      // Generate random IV for this encryption
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

      // Encrypt data
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: ALGORITHM,
          iv: iv
        },
        this.masterKey,
        plaintextBuffer
      );

      return {
        ciphertext: this.arrayBufferToBase64(ciphertext),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: this.arrayBufferToBase64(salt.buffer),
        timestamp: Date.now(),
        version: 1
      };
    } catch (error) {
      throw new EncryptionError(
        `Encryption failed: ${getErrorMessage(error)}`,
        'ENCRYPT_FAILED'
      );
    }
  }

  /**
   * Decrypt data from storage
   */
  async decrypt<T = any>(encryptedData: EncryptedData): Promise<T> {
    if (!this.masterKey) {
      throw new EncryptionError('Encryption not initialized', 'NOT_INITIALIZED');
    }

    try {
      // Convert from base64
      const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);

      // Decrypt data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: new Uint8Array(iv)
        },
        this.masterKey,
        ciphertext
      );

      // Convert back to JSON
      const plaintext = this.textDecoder.decode(decrypted);
      return JSON.parse(plaintext);
    } catch (error) {
      throw new EncryptionError(
        `Decryption failed: ${getErrorMessage(error)}`,
        'DECRYPT_FAILED'
      );
    }
  }

  /**
   * Generate encryption key for field-level encryption
   */
  async generateFieldKey(fieldName: string): Promise<CryptoKey> {
    if (!this.masterKey) {
      throw new EncryptionError('Encryption not initialized', 'NOT_INITIALIZED');
    }

    try {
      // Derive field-specific key from master key
      const fieldSalt = await this.generateSalt(fieldName);
      const keyMaterial = await crypto.subtle.exportKey('raw', this.masterKey);
      
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: fieldSalt,
          iterations: 1000,
          hash: 'SHA-256'
        },
        await crypto.subtle.importKey(
          'raw',
          keyMaterial,
          'PBKDF2',
          false,
          ['deriveKey']
        ),
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new EncryptionError(
        `Failed to generate field key: ${getErrorMessage(error)}`,
        'FIELD_KEY_FAILED'
      );
    }
  }

  /**
   * Hash sensitive data for searching (one-way)
   */
  async hashForSearch(data: string): Promise<string> {
    try {
      const dataBuffer = this.textEncoder.encode(data.toLowerCase());
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      return this.arrayBufferToBase64(hashBuffer);
    } catch (error) {
      throw new EncryptionError(
        `Hashing failed: ${getErrorMessage(error)}`,
        'HASH_FAILED'
      );
    }
  }

  /**
   * Validate encrypted data integrity
   */
  async validateIntegrity(encryptedData: EncryptedData): Promise<boolean> {
    try {
      // Attempt to decrypt - will fail if tampered
      await this.decrypt(encryptedData);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordBuffer = this.textEncoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async generateSalt(input: string): Promise<Uint8Array> {
    const inputBuffer = this.textEncoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', inputBuffer);
    return new Uint8Array(hashBuffer.slice(0, SALT_LENGTH));
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();