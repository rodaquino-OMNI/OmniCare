/**
 * OmniCare EMR Backend - Redis Service
 * High-performance caching and session management
 */

import { createClient, RedisClientType, RedisModules, RedisFunctions, RedisScripts } from 'redis';

import config from '@/config';
import logger from '@/utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

export class RedisService {
  private client: RedisClientType<RedisModules, RedisFunctions, RedisScripts> | null = null;
  private isConnected = false;
  private stats: CacheStats = { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 };
  private connectionPromise: Promise<void> | null = null;
  
  // Enhanced performance tracking
  private operationMetrics = new Map<string, {
    count: number;
    totalTime: number;
    errors: number;
  }>();
  
  // Connection pool for high-throughput operations
  private connectionPool: RedisClientType[] = [];
  private readonly maxPoolSize = 10;
  private poolIndex = 0;
  
  // Batch operation queue
  private batchQueue: Array<{
    operation: string;
    key: string;
    value?: any;
    options?: CacheOptions;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchTimeout = 10; // milliseconds
  private readonly maxBatchSize = 100;

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Return immediately if already connected
    if (this.isConnected && this.client) {
      return;
    }

    this.connectionPromise = this.connect();
    return this.connectionPromise;
  }

  private async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: config.redis.url,
        socket: {
          reconnectStrategy: (retries) => {
            // Enhanced exponential backoff with circuit breaker
            if (retries > 10) {
              logger.error('Redis connection failed after 10 retries, implementing circuit breaker');
              return null; // Stop retrying
            }
            const delay = Math.min(retries * 100, 5000) + Math.random() * 200;
            logger.warn(`Redis reconnection attempt ${retries}, waiting ${delay}ms`);
            return delay;
          },
          connectTimeout: 10000, // Increased timeout
          commandTimeout: 5000,
          keepAlive: 30000, // 30 second keepalive
        },
        
        // Optimized Redis configuration
        database: 0,
        lazyConnect: false,
        
        // Enable Redis pipelining for better performance
        enableAutoPipelining: true,
        
        // Retry configuration
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });

      // Set up error handlers
      this.client.on('error', (err) => {
        logger.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test the connection
      await this.client.ping();
      
      logger.info('Redis service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis service:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Get Redis client (ensure connection first)
   */
  private async getClient(): Promise<RedisClientType<RedisModules, RedisFunctions, RedisScripts>> {
    if (!this.client || !this.isConnected) {
      await this.initialize();
    }
    
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    
    return this.client;
  }

  /**
   * Set a value in cache with enhanced performance tracking
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use batching for high-frequency operations
      if (this.shouldBatch('SET')) {
        return this.batchedSet(key, value, options);
      }
      
      const client = await this.getOptimalClient();
      const serializedValue = this.serialize(value);
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;

      if (options.ttl) {
        await client.setEx(finalKey, options.ttl, serializedValue);
      } else {
        await client.set(finalKey, serializedValue);
      }
      
      this.updateOperationMetrics('SET', Date.now() - startTime, false);
      logger.debug(`Cache SET: ${finalKey}`);
    } catch (error) {
      this.updateOperationMetrics('SET', Date.now() - startTime, true);
      logger.error(`Cache SET error for key ${key}:`, error);
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Get a value from cache with intelligent client selection
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const client = await this.getOptimalClient();
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
      
      const value = await client.get(finalKey);
      
      this.stats.totalRequests++;
      
      if (value === null) {
        this.stats.misses++;
        this.updateOperationMetrics('GET_MISS', Date.now() - startTime, false);
        logger.debug(`Cache MISS: ${finalKey}`);
        return null;
      }
      
      this.stats.hits++;
      this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;
      this.updateOperationMetrics('GET_HIT', Date.now() - startTime, false);
      
      logger.debug(`Cache HIT: ${finalKey}`);
      return this.deserialize<T>(value);
    } catch (error) {
      this.updateOperationMetrics('GET_ERROR', Date.now() - startTime, true);
      logger.error(`Cache GET error for key ${key}:`, error);
      this.stats.misses++;
      this.stats.totalRequests++;
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string, options: CacheOptions = {}): Promise<void> {
    try {
      const client = await this.getClient();
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
      
      await client.del(finalKey);
      logger.debug(`Cache DEL: ${finalKey}`);
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = await this.getClient();
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
      
      const exists = await client.exists(finalKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number, options: CacheOptions = {}): Promise<void> {
    try {
      const client = await this.getClient();
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
      
      await client.expire(finalKey, seconds);
    } catch (error) {
      logger.error(`Cache EXPIRE error for key ${key}:`, error);
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const client = await this.getClient();
      const finalKeys = keys.map(key => 
        options.namespace ? `${options.namespace}:${key}` : key
      );
      
      const values = await client.mGet(finalKeys);
      
      return values.map(value => {
        this.stats.totalRequests++;
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        this.stats.hits++;
        return this.deserialize<T>(value);
      });
    } catch (error) {
      logger.error(`Cache MGET error:`, error);
      return keys.map(() => null);
    } finally {
      this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;
    }
  }

  /**
   * Set multiple keys at once with optimized pipelining
   */
  async mset(keyValues: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = await this.getOptimalClient();
      const entries = Object.entries(keyValues);
      
      // Process in chunks for very large datasets
      const chunkSize = 1000;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const pipeline = client.multi();
        
        chunk.forEach(([key, value]) => {
          const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
          const serializedValue = this.serialize(value);
          
          if (options.ttl) {
            pipeline.setEx(finalKey, options.ttl, serializedValue);
          } else {
            pipeline.set(finalKey, serializedValue);
          }
        });
        
        await pipeline.exec();
      }
      
      this.updateOperationMetrics('MSET', Date.now() - startTime, false);
      logger.debug(`Cache MSET: ${entries.length} keys`);
    } catch (error) {
      this.updateOperationMetrics('MSET', Date.now() - startTime, true);
      logger.error(`Cache MSET error:`, error);
    }
  }

  /**
   * Clear all keys in a namespace
   */
  async clearNamespace(namespace: string): Promise<number> {
    try {
      const client = await this.getClient();
      const pattern = `${namespace}:*`;
      
      // Use SCAN to find keys (more efficient than KEYS)
      const keys: string[] = [];
      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
      }
      
      if (keys.length > 0) {
        await client.del(keys);
      }
      
      logger.info(`Cleared ${keys.length} keys from namespace: ${namespace}`);
      return keys.length;
    } catch (error) {
      logger.error(`Cache CLEAR_NAMESPACE error for ${namespace}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 };
  }

  /**
   * Get optimal client based on load balancing
   */
  private async getOptimalClient(): Promise<RedisClientType<RedisModules, RedisFunctions, RedisScripts>> {
    // For now, return main client. In production, implement load balancing
    return this.getClient();
  }
  
  /**
   * Determine if operation should be batched
   */
  private shouldBatch(operation: string): boolean {
    // Batch SET operations during high load
    return operation === 'SET' && this.batchQueue.length < this.maxBatchSize;
  }
  
  /**
   * Batched SET operation
   */
  private async batchedSet(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        operation: 'SET',
        key,
        value,
        options,
        resolve,
        reject
      });
      
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.executeBatch();
        }, this.batchTimeout);
      }
    });
  }
  
  /**
   * Execute batched operations
   */
  private async executeBatch(): Promise<void> {
    const operations = [...this.batchQueue];
    this.batchQueue.length = 0;
    this.batchTimer = null;
    
    if (operations.length === 0) return;
    
    try {
      const client = await this.getClient();
      const pipeline = client.multi();
      
      operations.forEach(({ key, value, options }) => {
        const finalKey = options?.namespace ? `${options.namespace}:${key}` : key;
        const serializedValue = this.serialize(value);
        
        if (options?.ttl) {
          pipeline.setEx(finalKey, options.ttl, serializedValue);
        } else {
          pipeline.set(finalKey, serializedValue);
        }
      });
      
      await pipeline.exec();
      
      // Resolve all promises
      operations.forEach(({ resolve }) => resolve(undefined));
      
      logger.debug(`Executed batch of ${operations.length} operations`);
    } catch (error) {
      logger.error('Batch execution failed:', error);
      // Reject all promises
      operations.forEach(({ reject }) => reject(error as Error));
    }
  }
  
  /**
   * Update operation metrics
   */
  private updateOperationMetrics(operation: string, duration: number, isError: boolean): void {
    const existing = this.operationMetrics.get(operation) || {
      count: 0,
      totalTime: 0,
      errors: 0
    };
    
    existing.count++;
    existing.totalTime += duration;
    
    if (isError) {
      existing.errors++;
    }
    
    this.operationMetrics.set(operation, existing);
  }
  
  /**
   * Get performance metrics for all operations
   */
  getPerformanceMetrics(): Record<string, {
    count: number;
    averageTime: number;
    errorRate: number;
  }> {
    const metrics: Record<string, any> = {};
    
    for (const [operation, data] of this.operationMetrics) {
      metrics[operation] = {
        count: data.count,
        averageTime: data.count > 0 ? data.totalTime / data.count : 0,
        errorRate: data.count > 0 ? data.errors / data.count : 0
      };
    }
    
    return metrics;
  }
  
  /**
   * Add key scanning capability for pattern matching
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const client = await this.getClient();
      const keys: string[] = [];
      
      // Use SCAN instead of KEYS for better performance
      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
      }
      
      return keys;
    } catch (error) {
      logger.error(`Failed to scan keys with pattern ${pattern}:`, error);
      return [];
    }
  }
  
  /**
   * Increment counter with error handling
   */
  async incr(key: string, increment: number = 1): Promise<number | null> {
    try {
      const client = await this.getClient();
      return await client.incrBy(key, increment);
    } catch (error) {
      logger.error(`Failed to increment key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get Redis info with enhanced parsing
   */
  async getInfo(): Promise<any> {
    try {
      const client = await this.getClient();
      const info = await client.info();
      return this.parseRedisInfo(info);
    } catch (error) {
      logger.error('Failed to get Redis info:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const start = Date.now();
    
    try {
      const client = await this.getClient();
      await client.ping();
      
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      return {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Shutdown Redis connection
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      } finally {
        this.client = null;
        this.isConnected = false;
        this.connectionPromise = null;
      }
    }
  }

  /**
   * Serialize value for storage
   */
  private serialize(value: any): string {
    try {
      if (typeof value === 'string') {
        return value;
      }
      return JSON.stringify(value);
    } catch (error) {
      logger.error('Serialization error:', error);
      return String(value);
    }
  }

  /**
   * Deserialize value from storage
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      // If parsing fails, return as string
      return value as unknown as T;
    }
  }

  /**
   * Parse Redis INFO output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');
    
    let currentSection = 'general';
    result[currentSection] = {};
    
    for (const line of lines) {
      if (line.startsWith('#')) {
        // Section header
        const sectionMatch = line.match(/^# (.+)/);
        if (sectionMatch) {
          currentSection = sectionMatch[1].toLowerCase().replace(/\s+/g, '_');
          result[currentSection] = {};
        }
      } else if (line.includes(':')) {
        // Key-value pair
        const [key, value] = line.split(':', 2);
        if (key && value !== undefined) {
          // Try to parse numeric values
          const numValue = Number(value);
          result[currentSection][key] = isNaN(numValue) ? value : numValue;
        }
      }
    }
    
    return result;
  }
}

// Export singleton instance
export const redisService = new RedisService();
