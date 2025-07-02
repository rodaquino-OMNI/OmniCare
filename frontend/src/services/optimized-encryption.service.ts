/**
 * Optimized Encryption Service for OmniCare EMR
 * Implements lazy loading and performance optimizations for encrypted operations
 */

import { EventEmitter } from 'events';

interface EncryptionConfig {
  algorithm: 'AES-GCM';
  keyLength: 256;
  ivLength: 12;
  saltLength: 16;
  iterations: 10000;
  lazyLoadThreshold: 100; // Number of items before switching to lazy mode
  batchSize: 50; // Items to process per batch
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds
}

interface EncryptionMetrics {
  totalOperations: number;
  averageEncryptTime: number;
  averageDecryptTime: number;
  cacheHits: number;
  cacheMisses: number;
  lazyLoadActivations: number;
  batchesProcessed: number;
}

interface LazyEncryptedField<T> {
  id: string;
  isEncrypted: boolean;
  isLoaded: boolean;
  encryptedData?: ArrayBuffer;
  decryptedData?: T;
  lastAccessed?: number;
  accessCount: number;
}

export class OptimizedEncryptionService extends EventEmitter {
  private config: EncryptionConfig = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,
    saltLength: 16,
    iterations: 10000,
    lazyLoadThreshold: 100,
    batchSize: 50,
    cacheEnabled: true,
    cacheTTL: 300000, // 5 minutes
  };

  private metrics: EncryptionMetrics = {
    totalOperations: 0,
    averageEncryptTime: 0,
    averageDecryptTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lazyLoadActivations: 0,
    batchesProcessed: 0,
  };

  private keyCache: Map<string, CryptoKey> = new Map();
  private decryptionCache: Map<string, { data: any; timestamp: number }> = new Map();
  private encryptionQueue: Array<{ id: string; data: any; resolve: Function; reject: Function }> = [];
  private isProcessingBatch = false;
  private worker?: Worker;

  constructor() {
    super();
    this.initializeWebWorker();
    this.startCacheCleanup();
  }

  /**
   * Initialize Web Worker for background encryption operations
   */
  private initializeWebWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        // Create inline worker for encryption operations
        const workerCode = `
          self.onmessage = async function(e) {
            const { type, data } = e.data;
            
            if (type === 'encrypt-batch') {
              const results = [];
              for (const item of data.items) {
                try {
                  const encrypted = await encryptData(item.data, data.key);
                  results.push({ id: item.id, success: true, result: encrypted });
                } catch (error) {
                  results.push({ id: item.id, success: false, error: error.message });
                }
              }
              self.postMessage({ type: 'encrypt-batch-complete', results });
            }
          };
          
          async function encryptData(data, key) {
            // Simplified encryption for worker
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await crypto.subtle.encrypt(
              { name: 'AES-GCM', iv },
              key,
              dataBuffer
            );
            
            return { encrypted, iv };
          }
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
        
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
      } catch (error) {
        console.warn('Web Worker initialization failed, falling back to main thread:', error);
      }
    }
  }

  /**
   * Derive encryption key from password with caching
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const cacheKey = `${password}-${btoa(String.fromCharCode(...salt))}`;
    
    // Check cache first
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.config.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.config.algorithm, length: this.config.keyLength },
      false,
      ['encrypt', 'decrypt']
    );

    // Cache the derived key
    this.keyCache.set(cacheKey, key);
    
    // Limit cache size
    if (this.keyCache.size > 100) {
      const firstKey = this.keyCache.keys().next().value;
      if (firstKey) {
        this.keyCache.delete(firstKey);
      }
    }

    return key;
  }

  /**
   * Encrypt data with performance tracking
   */
  async encryptData<T>(data: T, password: string): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }> {
    const startTime = performance.now();
    
    try {
      const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength));
      const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));
      const key = await this.deriveKey(password, salt);

      const encoder = new TextEncoder();
      const dataString = JSON.stringify(data);
      const dataBuffer = encoder.encode(dataString);

      const encrypted = await crypto.subtle.encrypt(
        { name: this.config.algorithm, iv },
        key,
        dataBuffer
      );

      const encryptTime = performance.now() - startTime;
      this.updateMetrics('encrypt', encryptTime);

      return { encrypted, salt, iv };
    } catch (error) {
      this.emit('encryption-error', error);
      throw error;
    }
  }

  /**
   * Decrypt data with caching
   */
  async decryptData<T>(
    encrypted: ArrayBuffer,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array,
    cacheKey?: string
  ): Promise<T> {
    // Check cache if enabled and cache key provided
    if (this.config.cacheEnabled && cacheKey) {
      const cached = this.decryptionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.metrics.cacheHits++;
        return cached.data as T;
      }
      this.metrics.cacheMisses++;
    }

    const startTime = performance.now();

    try {
      const key = await this.deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: this.config.algorithm, iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decrypted);
      const data = JSON.parse(decryptedString) as T;

      const decryptTime = performance.now() - startTime;
      this.updateMetrics('decrypt', decryptTime);

      // Cache the decrypted data
      if (this.config.cacheEnabled && cacheKey) {
        this.decryptionCache.set(cacheKey, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      this.emit('decryption-error', error);
      throw error;
    }
  }

  /**
   * Create a lazy-loaded encrypted field
   */
  createLazyField<T>(id: string, encryptedData?: ArrayBuffer): LazyEncryptedField<T> {
    return {
      id,
      isEncrypted: !!encryptedData,
      isLoaded: false,
      encryptedData,
      decryptedData: undefined,
      lastAccessed: undefined,
      accessCount: 0,
    };
  }

  /**
   * Load a lazy field on demand
   */
  async loadLazyField<T>(
    field: LazyEncryptedField<T>,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<T> {
    if (field.isLoaded && field.decryptedData) {
      field.accessCount++;
      field.lastAccessed = Date.now();
      return field.decryptedData;
    }

    if (!field.encryptedData) {
      throw new Error('No encrypted data available');
    }

    const decrypted = await this.decryptData<T>(
      field.encryptedData,
      password,
      salt,
      iv,
      field.id
    );

    field.decryptedData = decrypted;
    field.isLoaded = true;
    field.accessCount = 1;
    field.lastAccessed = Date.now();

    this.metrics.lazyLoadActivations++;

    return decrypted;
  }

  /**
   * Batch encrypt multiple items
   */
  async batchEncrypt<T>(
    items: Array<{ id: string; data: T }>,
    password: string
  ): Promise<Map<string, { encrypted: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }>> {
    const results = new Map();
    const batches = this.createBatches(items, this.config.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async item => {
        const result = await this.encryptData(item.data, password);
        return { id: item.id, result };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ id, result }) => {
        results.set(id, result);
      });

      this.metrics.batchesProcessed++;
      
      // Emit progress event
      this.emit('batch-progress', {
        processed: results.size,
        total: items.length,
        percentage: (results.size / items.length) * 100,
      });
    }

    return results;
  }

  /**
   * Batch decrypt with lazy loading support
   */
  async batchDecryptLazy<T>(
    items: Array<{
      id: string;
      encrypted: ArrayBuffer;
      salt: Uint8Array;
      iv: Uint8Array;
    }>,
    password: string
  ): Promise<Map<string, LazyEncryptedField<T>>> {
    const results = new Map();

    // If items exceed threshold, use lazy loading
    if (items.length > this.config.lazyLoadThreshold) {
      items.forEach(item => {
        const lazyField = this.createLazyField<T>(item.id, item.encrypted);
        results.set(item.id, lazyField);
      });
      
      this.emit('lazy-mode-activated', { itemCount: items.length });
      return results;
    }

    // Otherwise, decrypt immediately in batches
    const batches = this.createBatches(items, this.config.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async item => {
        const decrypted = await this.decryptData<T>(
          item.encrypted,
          password,
          item.salt,
          item.iv,
          item.id
        );
        
        const field: LazyEncryptedField<T> = {
          id: item.id,
          isEncrypted: true,
          isLoaded: true,
          encryptedData: item.encrypted,
          decryptedData: decrypted,
          lastAccessed: Date.now(),
          accessCount: 1,
        };
        
        return { id: item.id, field };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ id, field }) => {
        results.set(id, field);
      });

      this.metrics.batchesProcessed++;
    }

    return results;
  }

  /**
   * Optimize cache based on access patterns
   */
  optimizeCache(fields: Map<string, LazyEncryptedField<any>>): void {
    const now = Date.now();
    const accessThreshold = 60000; // 1 minute
    const minAccessCount = 2;

    // Find fields to unload
    const unloadCandidates: string[] = [];
    
    fields.forEach((field, id) => {
      if (
        field.isLoaded &&
        field.lastAccessed &&
        now - field.lastAccessed > accessThreshold &&
        field.accessCount < minAccessCount
      ) {
        unloadCandidates.push(id);
      }
    });

    // Unload least recently used fields
    unloadCandidates.forEach(id => {
      const field = fields.get(id);
      if (field) {
        field.isLoaded = false;
        field.decryptedData = undefined;
        this.emit('field-unloaded', { id, reason: 'optimize-cache' });
      }
    });

    // Clear old decryption cache entries
    this.decryptionCache.forEach((value, key) => {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.decryptionCache.delete(key);
      }
    });
  }

  /**
   * Get encryption performance metrics
   */
  getMetrics(): EncryptionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      averageEncryptTime: 0,
      averageDecryptTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lazyLoadActivations: 0,
      batchesProcessed: 0,
    };
  }

  /**
   * Configure encryption service
   */
  configure(config: Partial<EncryptionConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  // Private helper methods

  private updateMetrics(operation: 'encrypt' | 'decrypt', time: number): void {
    this.metrics.totalOperations++;
    
    if (operation === 'encrypt') {
      const currentAvg = this.metrics.averageEncryptTime;
      const currentCount = Math.floor(this.metrics.totalOperations / 2);
      this.metrics.averageEncryptTime = (currentAvg * currentCount + time) / (currentCount + 1);
    } else {
      const currentAvg = this.metrics.averageDecryptTime;
      const currentCount = Math.ceil(this.metrics.totalOperations / 2);
      this.metrics.averageDecryptTime = (currentAvg * currentCount + time) / (currentCount + 1);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { type, results } = event.data;
    
    if (type === 'encrypt-batch-complete') {
      this.emit('worker-batch-complete', results);
    }
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      this.optimizeCache(new Map());
    }, 60000); // Run every minute
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    this.keyCache.clear();
    this.decryptionCache.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const optimizedEncryptionService = new OptimizedEncryptionService();