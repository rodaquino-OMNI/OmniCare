/**
 * OmniCare EMR - Encryption Service
 * HIPAA-Compliant Encryption for Data at Rest and in Transit
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AUTH_CONFIG } from '@/config/auth.config';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  algorithm: string;
  keyId?: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  encoding: BufferEncoding;
}

export class EncryptionService {
  private readonly config: EncryptionConfig;
  private readonly masterKey: Buffer;
  private keyPairs: Map<string, KeyPair> = new Map();
  private dataKeys: Map<string, Buffer> = new Map();

  constructor() {
    this.config = {
      algorithm: AUTH_CONFIG.encryption.algorithm,
      keyLength: AUTH_CONFIG.encryption.keyLength,
      ivLength: AUTH_CONFIG.encryption.ivLength,
      tagLength: AUTH_CONFIG.encryption.tagLength,
      encoding: AUTH_CONFIG.encryption.encoding
    };

    // Initialize master key (in production, use secure key management service)
    this.masterKey = this.deriveMasterKey();
    
    this.initializeDefaultKeys();
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptData(data: string, keyId?: string): EncryptedData {
    const key = keyId ? this.getDataKey(keyId) : this.masterKey;
    const iv = crypto.randomBytes(this.config.ivLength);
    
    const cipher = crypto.createCipherGCM(this.config.algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', this.config.encoding);
    encrypted += cipher.final(this.config.encoding);
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString(this.config.encoding),
      tag: tag.toString(this.config.encoding),
      algorithm: this.config.algorithm,
      keyId
    };
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: EncryptedData): string {
    const key = encryptedData.keyId 
      ? this.getDataKey(encryptedData.keyId) 
      : this.masterKey;
    
    const iv = Buffer.from(encryptedData.iv, this.config.encoding);
    const tag = Buffer.from(encryptedData.tag, this.config.encoding);
    
    const decipher = crypto.createDecipherGCM(encryptedData.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, this.config.encoding, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypt PHI (Protected Health Information) with additional safeguards
   */
  encryptPHI(phi: any, patientId: string): EncryptedData {
    // Add additional metadata for PHI
    const phiData = {
      data: phi,
      patientId,
      timestamp: new Date().toISOString(),
      type: 'PHI'
    };

    // Use patient-specific key derivation
    const patientKey = this.derivePatientKey(patientId);
    const keyId = `phi_${patientId}`;
    
    // Store the derived key
    this.dataKeys.set(keyId, patientKey);
    
    return this.encryptData(JSON.stringify(phiData), keyId);
  }

  /**
   * Decrypt PHI with validation
   */
  decryptPHI(encryptedPHI: EncryptedData, expectedPatientId: string): any {
    const decryptedData = this.decryptData(encryptedPHI);
    const phiData = JSON.parse(decryptedData);
    
    // Validate patient ID matches
    if (phiData.patientId !== expectedPatientId) {
      throw new Error('Patient ID mismatch in PHI decryption');
    }
    
    // Validate data type
    if (phiData.type !== 'PHI') {
      throw new Error('Invalid PHI data type');
    }
    
    return phiData.data;
  }

  /**
   * Generate RSA key pair for asymmetric encryption
   */
  generateKeyPair(keySize: number = 2048): KeyPair {
    const keyId = this.generateKeyId();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const keyPair: KeyPair = {
      publicKey,
      privateKey,
      keyId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };

    this.keyPairs.set(keyId, keyPair);
    return keyPair;
  }

  /**
   * Encrypt data using RSA public key
   */
  encryptWithPublicKey(data: string, publicKey: string): string {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(data, 'utf8')
    );
    
    return encrypted.toString('base64');
  }

  /**
   * Decrypt data using RSA private key
   */
  decryptWithPrivateKey(encryptedData: string, privateKey: string): string {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encryptedData, 'base64')
    );
    
    return decrypted.toString('utf8');
  }

  /**
   * Generate HMAC for data integrity
   */
  generateHMAC(data: string, key?: Buffer): string {
    const hmacKey = key || this.masterKey;
    return crypto
      .createHmac('sha256', hmacKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data: string, hmac: string, key?: Buffer): boolean {
    const expectedHmac = this.generateHMAC(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );
  }

  /**
   * Hash sensitive data (one-way)
   */
  hashData(data: string, salt?: string): { hash: string; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
    const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha512');
    
    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex')
    };
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(data, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), verifyHash);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate encryption key for specific purpose
   */
  generateDataKey(purpose: string): { keyId: string; key: Buffer } {
    const keyId = `${purpose}_${this.generateKeyId()}`;
    const key = crypto.randomBytes(this.config.keyLength);
    
    this.dataKeys.set(keyId, key);
    
    return { keyId, key };
  }

  /**
   * Rotate encryption keys
   */
  rotateKeys(): void {
    // Generate new master key
    const newMasterKey = crypto.randomBytes(this.config.keyLength);
    
    // Re-encrypt all data with new key (in production, this would be a background process)
    console.log('Key rotation initiated - implement gradual re-encryption process');
    
    // Generate new key pairs
    this.generateKeyPair();
    
    // Mark old keys for retirement
    const currentTime = new Date();
    for (const [keyId, keyPair] of this.keyPairs.entries()) {
      if (!keyPair.expiresAt || keyPair.expiresAt < currentTime) {
        // Mark for deletion after grace period
        keyPair.expiresAt = new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }
    }
  }

  /**
   * Encrypt file
   */
  async encryptFile(filePath: string, outputPath?: string): Promise<string> {
    const data = await fs.readFile(filePath);
    const encrypted = this.encryptData(data.toString('base64'));
    
    const output = outputPath || `${filePath}.encrypted`;
    await fs.writeFile(output, JSON.stringify(encrypted));
    
    return output;
  }

  /**
   * Decrypt file
   */
  async decryptFile(encryptedFilePath: string, outputPath?: string): Promise<string> {
    const encryptedData = JSON.parse(await fs.readFile(encryptedFilePath, 'utf8'));
    const decrypted = this.decryptData(encryptedData);
    const data = Buffer.from(decrypted, 'base64');
    
    const output = outputPath || encryptedFilePath.replace('.encrypted', '');
    await fs.writeFile(output, data);
    
    return output;
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    totalKeys: number;
    activeKeyPairs: number;
    expiredKeyPairs: number;
    dataKeys: number;
  } {
    const currentTime = new Date();
    const activeKeyPairs = Array.from(this.keyPairs.values())
      .filter(kp => !kp.expiresAt || kp.expiresAt > currentTime).length;
    const expiredKeyPairs = this.keyPairs.size - activeKeyPairs;

    return {
      totalKeys: this.keyPairs.size + this.dataKeys.size,
      activeKeyPairs,
      expiredKeyPairs,
      dataKeys: this.dataKeys.size
    };
  }

  /**
   * Derive master key from environment
   */
  private deriveMasterKey(): Buffer {
    const keyMaterial = process.env.ENCRYPTION_MASTER_KEY || 'default-master-key-change-in-production';
    const salt = process.env.ENCRYPTION_SALT || 'omnicare-emr-salt';
    
    return crypto.pbkdf2Sync(keyMaterial, salt, 100000, this.config.keyLength, 'sha512');
  }

  /**
   * Derive patient-specific encryption key
   */
  private derivePatientKey(patientId: string): Buffer {
    const keyMaterial = `patient_${patientId}`;
    return crypto.pbkdf2Sync(keyMaterial, this.masterKey, 10000, this.config.keyLength, 'sha512');
  }

  /**
   * Get data key by ID
   */
  private getDataKey(keyId: string): Buffer {
    const key = this.dataKeys.get(keyId);
    if (!key) {
      throw new Error(`Data key not found: ${keyId}`);
    }
    return key;
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Initialize default encryption keys
   */
  private initializeDefaultKeys(): void {
    // Generate default RSA key pair
    this.generateKeyPair();
    
    // Generate some default data keys
    this.generateDataKey('session');
    this.generateDataKey('audit');
    this.generateDataKey('temporary');
  }
}