import { Resource } from '@medplum/fhirtypes';

/**
 * Hybrid Cache Service
 * 
 * Provides a unified caching layer that combines:
 * - In-memory LRU cache for fast access
 * - IndexedDB persistence for offline support
 * - Intelligent cache invalidation
 * - TTL-based expiration
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
  etag?: string;
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  maxMemoryItems?: number;
  defaultTTL?: number;
  persistOffline?: boolean;
  namespace?: string;
}

export interface CacheStats {
  memorySize: number;
  persistentSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
}

export interface CacheLayer {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  invalidate(pattern: string | RegExp): Promise<number>;
  getStats(): CacheStats;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  
  constructor(private maxSize: number) {}
  
  get(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (most recently used)
      this.updateAccessOrder(key);
    }
    return entry;
  }
  
  set(key: string, entry: CacheEntry<T>): void {
    // Remove if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    
    // Add to cache
    this.cache.set(key, entry);
    this.accessOrder.push(key);
    
    // Evict if needed
    while (this.cache.size > this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
  
  delete(key: string): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  get size(): number {
    return this.cache.size;
  }
  
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }
}

export class HybridCache implements CacheLayer {
  private memoryCache: LRUCache<any>;
  private db?: IDBDatabase;
  private dbName: string;
  private storeName = 'cache';
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  
  constructor(private options: CacheOptions = {}) {
    const {
      maxMemoryItems = 1000,
      namespace = 'omnicare',
    } = options;
    
    this.memoryCache = new LRUCache(maxMemoryItems);
    this.dbName = `${namespace}-cache`;
    
    if (options.persistOffline && typeof window !== 'undefined') {
      this.initPersistentCache();
    }
  }
  
  /**
   * Initialize IndexedDB for persistent caching
   */
  private async initPersistentCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('namespace', 'namespace', { unique: false });
        }
      };
    });
  }
  
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      this.stats.hits++;
      return memEntry.data as T;
    }
    
    // Try persistent cache
    if (this.options.persistOffline && this.db) {
      const persistEntry = await this.getFromPersistent(key);
      if (persistEntry && !this.isExpired(persistEntry)) {
        // Populate memory cache
        this.memoryCache.set(key, persistEntry);
        this.stats.hits++;
        return persistEntry.data as T;
      }
    }
    
    this.stats.misses++;
    return null;
  }
  
  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.options.defaultTTL,
    };
    
    // Update memory cache
    const previousSize = this.memoryCache.size;
    this.memoryCache.set(key, entry);
    
    // Track evictions
    if (this.memoryCache.size < previousSize) {
      this.stats.evictions++;
    }
    
    // Persist if enabled
    if (this.options.persistOffline && this.db) {
      await this.persistToStorage(key, entry);
    }
  }
  
  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    // Check memory cache
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (entry && !this.isExpired(entry)) {
        return true;
      }
    }
    
    // Check persistent cache
    if (this.options.persistOffline && this.db) {
      const entry = await this.getFromPersistent(key);
      return entry !== null && !this.isExpired(entry);
    }
    
    return false;
  }
  
  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.memoryCache.delete(key);
    
    if (this.options.persistOffline && this.db) {
      await this.deleteFromPersistent(key);
    }
    
    return deleted;
  }
  
  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.options.persistOffline && this.db) {
      await this.clearPersistent();
    }
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }
  
  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string | RegExp): Promise<number> {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern.replace(/\*/g, '.*')) 
      : pattern;
    
    let invalidated = 0;
    
    // Invalidate memory cache
    const keys = this.memoryCache.keys();
    for (const key of keys) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }
    
    // Invalidate persistent cache
    if (this.options.persistOffline && this.db) {
      invalidated += await this.invalidatePersistent(regex);
    }
    
    return invalidated;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      memorySize: this.memoryCache.size,
      persistentSize: 0, // Would need to calculate from IndexedDB
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      evictions: this.stats.evictions,
    };
  }
  
  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl || entry.ttl === Infinity) {
      return false;
    }
    
    const age = Date.now() - entry.timestamp;
    return age > entry.ttl;
  }
  
  /**
   * Get from persistent storage
   */
  private async getFromPersistent(key: string): Promise<CacheEntry | null> {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.entry : null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Persist to storage
   */
  private async persistToStorage(key: string, entry: CacheEntry): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const record = {
        key,
        entry,
        timestamp: entry.timestamp,
        namespace: this.extractNamespace(key),
      };
      
      const request = store.put(record);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete from persistent storage
   */
  private async deleteFromPersistent(key: string): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Clear persistent storage
   */
  private async clearPersistent(): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Invalidate persistent entries matching pattern
   */
  private async invalidatePersistent(regex: RegExp): Promise<number> {
    if (!this.db) return 0;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      
      let invalidated = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (regex.test(cursor.value.key)) {
            cursor.delete();
            invalidated++;
          }
          cursor.continue();
        } else {
          resolve(invalidated);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Extract namespace from cache key
   */
  private extractNamespace(key: string): string {
    const parts = key.split(':');
    return parts.length > 1 ? parts[0] : 'default';
  }
}

// Cache key builders
export const cacheKeys = {
  resource: (type: string, id: string) => `resource:${type}:${id}`,
  search: (type: string, params: Record<string, any>) => 
    `search:${type}:${JSON.stringify(params)}`,
  patient: (id: string) => `patient:${id}`,
  patientData: (id: string, dataType: string) => `patient:${id}:${dataType}`,
  user: (id: string) => `user:${id}`,
  
  // Invalidation patterns
  allResources: (type: string) => `resource:${type}:*`,
  allPatientData: (id: string) => `patient:${id}:*`,
  allSearches: (type: string) => `search:${type}:*`,
};

// Global cache instance
let globalCache: HybridCache | null = null;

export function getHybridCache(options?: CacheOptions): HybridCache {
  if (!globalCache) {
    globalCache = new HybridCache({
      maxMemoryItems: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      persistOffline: true,
      ...options,
    });
  }
  return globalCache;
}

// React hook for cache
export function useCache(): HybridCache {
  return getHybridCache();
}