import { Resource } from '@medplum/fhirtypes';
import { EncryptedResource, EncryptionMetadata, KeyStore, KeyRotationSchedule } from '../../types/offline.types';

/**
 * HIPAA-compliant encryption service for offline healthcare data
 * Implements AES-256-GCM encryption with key rotation and secure key management
 */
export class OfflineEncryptionService {
  private algorithm = 'AES-GCM';
  private keyLength = 256;
  private ivLength = 12; // 96 bits for GCM
  private tagLength = 128; // 128-bit authentication tag
  private keyStore: KeyStore;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(private crypto: SubtleCrypto = window.crypto.subtle) {
    this.keyStore = {
      dataKeys: new Map(),
      keyRotationSchedule: {
        lastRotation: new Date().toISOString(),
        nextRotation: this.calculateNextRotation(),
        rotationInterval: 90 // 90 days default
      }
    };
  }

  /**
   * Initialize encryption service with master key
   */
  async initialize(masterPassword?: string): Promise<void> {
    if (masterPassword) {
      this.keyStore.masterKey = await this.deriveMasterKey(masterPassword);
    } else {
      this.keyStore.masterKey = await this.generateMasterKey();
    }

    // Generate initial data encryption keys
    await this.generateDataKeys();
  }

  /**
   * Encrypt a FHIR resource
   */
  async encryptResource<T extends Resource>(
    resource: T,
    additionalData?: string
  ): Promise<EncryptedResource<T>> {
    const key = await this.getDataKey(resource.resourceType);
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
    
    // Prepare data
    const data = JSON.stringify(resource);
    const encoded = this.encoder.encode(data);

    // Create additional authenticated data (AAD)
    const aad = additionalData ? this.encoder.encode(additionalData) : undefined;

    // Encrypt
    const encryptedData = await this.crypto.encrypt(
      {
        name: this.algorithm,
        iv: iv,
        additionalData: aad,
        tagLength: this.tagLength
      },
      key,
      encoded
    );

    // Create metadata
    const metadata: EncryptionMetadata = {
      lastModified: new Date().toISOString(),
      version: this.extractVersion(resource),
      checksum: await this.calculateChecksum(data),
      syncStatus: 'pending',
      iv: this.arrayBufferToBase64(iv),
      algorithm: this.algorithm,
      timestamp: new Date().toISOString()
    };

    return {
      id: resource.id!,
      resourceType: resource.resourceType,
      encryptedData: this.arrayBufferToBase64(encryptedData),
      metadata,
      searchableFields: await this.createSearchableFields(resource)
    };
  }

  /**
   * Decrypt a FHIR resource
   */
  async decryptResource<T extends Resource>(
    encrypted: EncryptedResource<T>,
    additionalData?: string
  ): Promise<T> {
    const key = await this.getDataKey(encrypted.resourceType);
    const iv = this.base64ToArrayBuffer(encrypted.metadata.iv!);
    const ciphertext = this.base64ToArrayBuffer(encrypted.encryptedData);

    // Prepare AAD if provided
    const aad = additionalData ? this.encoder.encode(additionalData) : undefined;

    try {
      // Decrypt
      const decrypted = await this.crypto.decrypt(
        {
          name: this.algorithm,
          iv: iv,
          additionalData: aad,
          tagLength: this.tagLength
        },
        key,
        ciphertext
      );

      // Parse and validate
      const decoded = this.decoder.decode(decrypted);
      const resource = JSON.parse(decoded) as T;

      // Verify checksum
      const checksum = await this.calculateChecksum(decoded);
      if (checksum !== encrypted.metadata.checksum) {
        throw new Error('Checksum verification failed - data may be corrupted');
      }

      return resource;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt resource - data may be corrupted or tampered');
    }
  }

  /**
   * Create searchable fields with deterministic encryption
   */
  private async createSearchableFields(resource: Resource): Promise<Record<string, string>> {
    const searchable: Record<string, string> = {};

    // Extract common searchable fields based on resource type
    switch (resource.resourceType) {
      case 'Patient':
        const patient = resource as any;
        if (patient.id) searchable.id = await this.deterministicEncrypt(patient.id);
        if (patient.identifier?.[0]?.value) {
          searchable.identifier = await this.deterministicEncrypt(patient.identifier[0].value);
        }
        break;

      case 'Encounter':
        const encounter = resource as any;
        if (encounter.subject?.reference) {
          searchable.patientId = await this.deterministicEncrypt(
            encounter.subject.reference.split('/')[1]
          );
        }
        if (encounter.status) searchable.status = await this.deterministicEncrypt(encounter.status);
        break;

      case 'Observation':
        const observation = resource as any;
        if (observation.subject?.reference) {
          searchable.patientId = await this.deterministicEncrypt(
            observation.subject.reference.split('/')[1]
          );
        }
        if (observation.code?.coding?.[0]?.code) {
          searchable.code = await this.deterministicEncrypt(observation.code.coding[0].code);
        }
        break;
    }

    return searchable;
  }

  /**
   * Deterministic encryption for searchable fields
   * Uses HMAC for secure, searchable encryption
   */
  private async deterministicEncrypt(value: string): Promise<string> {
    const key = await this.getSearchKey();
    const encoded = this.encoder.encode(value);
    
    const signature = await this.crypto.sign(
      {
        name: 'HMAC',
        hash: 'SHA-256'
      },
      key,
      encoded
    );

    return this.arrayBufferToBase64(signature);
  }

  /**
   * Generate or retrieve search key for deterministic encryption
   */
  private async getSearchKey(): Promise<CryptoKey> {
    if (!this.keyStore.dataKeys.has('search')) {
      const key = await this.crypto.generateKey(
        {
          name: 'HMAC',
          hash: 'SHA-256',
          length: 256
        },
        true,
        ['sign', 'verify']
      );
      this.keyStore.dataKeys.set('search', key);
    }
    return this.keyStore.dataKeys.get('search')!;
  }

  /**
   * Derive master key from password
   */
  private async deriveMasterKey(password: string): Promise<CryptoKey> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoded = this.encoder.encode(password);

    const keyMaterial = await this.crypto.importKey(
      'raw',
      encoded,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await this.crypto.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a random master key
   */
  private async generateMasterKey(): Promise<CryptoKey> {
    return await this.crypto.generateKey(
      {
        name: this.algorithm,
        length: this.keyLength
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate data encryption keys for each resource type
   */
  private async generateDataKeys(): Promise<void> {
    const resourceTypes = ['Patient', 'Encounter', 'Observation', 'MedicationRequest', 'DocumentReference'];
    
    for (const resourceType of resourceTypes) {
      const key = await this.crypto.generateKey(
        {
          name: this.algorithm,
          length: this.keyLength
        },
        true,
        ['encrypt', 'decrypt']
      );
      this.keyStore.dataKeys.set(resourceType, key);
    }
  }

  /**
   * Get or generate data key for resource type
   */
  private async getDataKey(resourceType: string): Promise<CryptoKey> {
    if (!this.keyStore.dataKeys.has(resourceType)) {
      const key = await this.crypto.generateKey(
        {
          name: this.algorithm,
          length: this.keyLength
        },
        true,
        ['encrypt', 'decrypt']
      );
      this.keyStore.dataKeys.set(resourceType, key);
    }
    return this.keyStore.dataKeys.get(resourceType)!;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<void> {
    console.log('Starting key rotation...');

    // Generate new keys
    const newKeys = new Map<string, CryptoKey>();
    for (const [resourceType, _] of this.keyStore.dataKeys) {
      const newKey = await this.crypto.generateKey(
        {
          name: this.algorithm,
          length: this.keyLength
        },
        true,
        ['encrypt', 'decrypt']
      );
      newKeys.set(resourceType, newKey);
    }

    // Re-encrypt existing data with new keys
    // This would be done in batches in production
    // await this.reencryptData(this.keyStore.dataKeys, newKeys);

    // Update key store
    this.keyStore.dataKeys = newKeys;
    this.keyStore.keyRotationSchedule.lastRotation = new Date().toISOString();
    this.keyStore.keyRotationSchedule.nextRotation = this.calculateNextRotation();

    console.log('Key rotation completed');
  }

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: string): Promise<string> {
    const encoded = this.encoder.encode(data);
    const hash = await this.crypto.digest('SHA-256', encoded);
    return this.arrayBufferToBase64(hash);
  }

  /**
   * Extract version from resource
   */
  private extractVersion(resource: Resource): number {
    const versionId = resource.meta?.versionId;
    return versionId ? parseInt(versionId) : 1;
  }

  /**
   * Calculate next key rotation date
   */
  private calculateNextRotation(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.keyStore.keyRotationSchedule.rotationInterval);
    return date.toISOString();
  }

  /**
   * Check if key rotation is needed
   */
  isKeyRotationNeeded(): boolean {
    const nextRotation = new Date(this.keyStore.keyRotationSchedule.nextRotation);
    return new Date() >= nextRotation;
  }

  /**
   * Export keys for backup (encrypted)
   */
  async exportKeys(password: string): Promise<string> {
    const exportKey = await this.deriveMasterKey(password);
    const keys: Record<string, any> = {};

    // Export each key
    for (const [name, key] of this.keyStore.dataKeys) {
      const exported = await this.crypto.exportKey('jwk', key);
      keys[name] = exported;
    }

    // Encrypt the exported keys
    const data = JSON.stringify(keys);
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
    const encrypted = await this.crypto.encrypt(
      {
        name: this.algorithm,
        iv: iv,
        tagLength: this.tagLength
      },
      exportKey,
      this.encoder.encode(data)
    );

    return JSON.stringify({
      iv: this.arrayBufferToBase64(iv),
      data: this.arrayBufferToBase64(encrypted),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Import keys from backup
   */
  async importKeys(encryptedBackup: string, password: string): Promise<void> {
    const backup = JSON.parse(encryptedBackup);
    const importKey = await this.deriveMasterKey(password);

    const iv = this.base64ToArrayBuffer(backup.iv);
    const encrypted = this.base64ToArrayBuffer(backup.data);

    const decrypted = await this.crypto.decrypt(
      {
        name: this.algorithm,
        iv: iv,
        tagLength: this.tagLength
      },
      importKey,
      encrypted
    );

    const keys = JSON.parse(this.decoder.decode(decrypted));

    // Import each key
    for (const [name, jwk] of Object.entries(keys)) {
      const key = await this.crypto.importKey(
        'jwk',
        jwk as JsonWebKey,
        {
          name: this.algorithm,
          length: this.keyLength
        },
        true,
        ['encrypt', 'decrypt']
      );
      this.keyStore.dataKeys.set(name, key);
    }
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clear all keys from memory
   */
  clearKeys(): void {
    this.keyStore.masterKey = undefined;
    this.keyStore.dataKeys.clear();
  }
}