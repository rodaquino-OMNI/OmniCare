/**
 * OmniCare EMR - Offline Encryption Utilities
 * Client-side encryption helpers for secure offline data handling
 */

import { DataClassification } from '@/types/offline-security.types';

/**
 * Generate a cryptographically secure random key
 */
export async function generateSecureKey(length: number = 256): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a key from password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES key from password
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate secure random salt
 */
export function generateSalt(length: number = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate secure random IV
 */
export function generateIV(length: number = 12): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Calculate SHA-256 hash of data
 */
export async function calculateHash(data: string | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;
  
  if (typeof data === 'string') {
    const encoder = new TextEncoder();
    buffer = encoder.encode(data);
  } else {
    buffer = data;
  }
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return arrayBufferToHex(hashBuffer);
}

/**
 * Generate HMAC for data integrity
 */
export async function generateHMAC(
  data: string | ArrayBuffer,
  key: CryptoKey
): Promise<string> {
  let buffer: ArrayBuffer;
  
  if (typeof data === 'string') {
    const encoder = new TextEncoder();
    buffer = encoder.encode(data);
  } else {
    buffer = data;
  }
  
  const signature = await crypto.subtle.sign('HMAC', key, buffer);
  return arrayBufferToHex(signature);
}

/**
 * Verify HMAC
 */
export async function verifyHMAC(
  data: string | ArrayBuffer,
  hmac: string,
  key: CryptoKey
): Promise<boolean> {
  const expectedHMAC = await generateHMAC(data, key);
  return constantTimeCompare(hmac, expectedHMAC);
}

/**
 * Compress data before encryption (using native CompressionStream if available)
 */
export async function compressData(data: string): Promise<ArrayBuffer> {
  if ('CompressionStream' in window) {
    const encoder = new TextEncoder();
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(encoder.encode(data));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  } else {
    // Fallback: No compression
    const encoder = new TextEncoder();
    return encoder.encode(data).buffer;
  }
}

/**
 * Decompress data after decryption
 */
export async function decompressData(data: ArrayBuffer): Promise<string> {
  if ('DecompressionStream' in window) {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(new Uint8Array(data));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Combine chunks and decode
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(result);
  } else {
    // Fallback: No decompression
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }
}

/**
 * Secure random string generator
 */
export function generateSecureRandomString(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, byte => charset[byte % charset.length]).join('');
}

/**
 * Convert ArrayBuffer to hex string
 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex string to ArrayBuffer
 */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Securely clear sensitive data from memory
 */
export function secureClear(data: Uint8Array | ArrayBuffer): void {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  crypto.getRandomValues(bytes);
  bytes.fill(0);
}

/**
 * Generate key pair for asymmetric encryption
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with public key
 */
export async function encryptWithPublicKey(
  data: string,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  return await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicKey,
    dataBuffer
  );
}

/**
 * Decrypt data with private key
 */
export async function decryptWithPrivateKey(
  encryptedData: ArrayBuffer,
  privateKey: CryptoKey
): Promise<string> {
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP'
    },
    privateKey,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Create encryption metadata
 */
export function createEncryptionMetadata(
  classification: DataClassification,
  algorithm: string = 'AES-GCM'
): Record<string, any> {
  return {
    version: '1.0',
    algorithm,
    classification,
    created: new Date().toISOString(),
    client: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    }
  };
}

/**
 * Validate encryption parameters
 */
export function validateEncryptionParams(params: {
  algorithm?: string;
  keySize?: number;
  ivLength?: number;
}): boolean {
  const validAlgorithms = ['AES-GCM', 'AES-CBC', 'RSA-OAEP'];
  const validKeySizes = [128, 192, 256];
  const validIVLengths = [12, 16];
  
  if (params.algorithm && !validAlgorithms.includes(params.algorithm)) {
    return false;
  }
  
  if (params.keySize && !validKeySizes.includes(params.keySize)) {
    return false;
  }
  
  if (params.ivLength && !validIVLengths.includes(params.ivLength)) {
    return false;
  }
  
  return true;
}

/**
 * Generate deterministic key from seed
 */
export async function generateDeterministicKey(
  seed: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  return await deriveKeyFromPassword(seed, salt, iterations);
}

/**
 * Split data into chunks for secure storage
 */
export function splitDataIntoChunks(
  data: ArrayBuffer,
  chunkSize: number = 1024 * 1024 // 1MB
): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  const bytes = new Uint8Array(data);
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
    chunks.push(chunk.buffer);
  }
  
  return chunks;
}

/**
 * Combine data chunks
 */
export function combineDataChunks(chunks: ArrayBuffer[]): ArrayBuffer {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  
  return result.buffer;
}

/**
 * Create secure storage key identifier
 */
export function createStorageKeyId(
  userId: string,
  dataType: string,
  timestamp: Date = new Date()
): string {
  const components = [
    userId,
    dataType,
    timestamp.toISOString(),
    generateSecureRandomString(8)
  ];
  
  return components.join('_').replace(/[^a-zA-Z0-9_-]/g, '');
}