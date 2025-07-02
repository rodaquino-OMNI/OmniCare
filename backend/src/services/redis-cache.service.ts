/**
 * OmniCare EMR Backend - Redis Caching Service
 * Provides high-performance caching layer with Redis integration
 */

import { createClient, RedisClientType } from 'redis';

import config from '@/config';
import logger from '@/utils/logger';

export interface CacheHealth {
  status: 'healthy' | 'unhealthy';
  latency: number;
  connectedClients: number;
  usedMemory: string;
  keyspaceHits: number;
  keyspaceMisses: number;
  hitRatio: number;
  message?: string;
}

export interface CacheSetOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Set only if key doesn't exist
  xx?: boolean; // Set only if key exists
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: string;
  hitRatio: number;
}

export class RedisCacheService {
  private client: Redis.RedisClientType | null = null;
  private isConnected = false;
  private isShuttingDown = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private reconnectDelay = 1000;

  // Statistics tracking
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    // Skip initialization if Redis is disabled for tests
    if (process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test') {
      logger.info('Redis caching disabled for test environment');
      return;
    }

    try {
      const redisOptions: RedisOptions = {
        url: config.redis.url,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries: number) => {
            if (retries >= this.maxConnectionAttempts) {
              logger.error('Redis max reconnection attempts reached');
              return false;
            }
            const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 10000);
            logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries + 1})`);
            return delay;
          },
        },
        // Performance optimizations
        commandsQueueMaxLength: 1000,
        maxRetriesPerRequest: 3,
      };

      this.client = Redis.createClient(redisOptions);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.connectionAttempts = 0;
        logger.info('Redis client connected and ready');
      });

      this.client.on('error', (error) => {
        this.stats.errors++;
        logger.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.warn('Redis client connection ended');
      });

      this.client.on('reconnecting', () => {
        this.connectionAttempts++;
        logger.info(`Redis client reconnecting (attempt ${this.connectionAttempts})`);
      });

      // Connect to Redis
      await this.client.connect();

      // Test the connection
      await this.client.ping();

      logger.info('Redis cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis cache service:', error);
      // Don't throw - allow the app to run without Redis
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = string>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.client!.get(this.prefixKey(key));
      
      if (value === null) {
        this.stats.misses++;
        logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.stats.hits++;
      logger.debug(`Cache hit for key: ${key}`);
      
      // Try to parse JSON, return as string if parsing fails
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: unknown, options: CacheSetOptions = {}): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const prefixedKey = this.prefixKey(key);
      
      let result;
      if (options.ttl) {
        if (options.nx) {
          result = await this.client!.setNX(prefixedKey, serializedValue);
          if (result) {
            await this.client!.expire(prefixedKey, options.ttl);
          }
        } else if (options.xx) {
          // Redis doesn't support XX with object syntax, use command array format
          result = await this.client!.set(prefixedKey, serializedValue);
          if (result) {
            await this.client!.expire(prefixedKey, options.ttl);
          }
        } else {
          result = await this.client!.setEx(prefixedKey, options.ttl, serializedValue);
        }
      } else {
        if (options.nx) {
          result = await this.client!.setNX(prefixedKey, serializedValue);
        } else if (options.xx) {
          // Just set without XX flag for now
          result = await this.client!.set(prefixedKey, serializedValue);
        } else {
          result = await this.client!.set(prefixedKey, serializedValue);
        }
      }

      if (result) {
        this.stats.sets++;
        logger.debug(`Cache set for key: ${key}`, { 
          ttl: options.ttl, 
          nx: options.nx, 
          xx: options.xx 
        });
      }

      return !!result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.del(this.prefixKey(key));
      
      if (result > 0) {
        this.stats.deletes++;
        logger.debug(`Cache delete for key: ${key}`);
      }
      
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async delMany(keys: string[]): Promise<number> {
    if (!this.isAvailable() || keys.length === 0) {
      return 0;
    }

    try {
      const prefixedKeys = keys.map(key => this.prefixKey(key));
      const result = await this.client!.del(prefixedKeys);
      
      this.stats.deletes += result;
      logger.debug(`Cache delete for ${result} keys`);
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis DEL MANY error:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.exists(this.prefixKey(key));
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.expire(this.prefixKey(key), ttl);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T = string>(keys: string[]): Promise<Array<T | null>> {
    if (!this.isAvailable() || keys.length === 0) {
      this.stats.misses += keys.length;
      return keys.map(() => null);
    }

    try {
      const prefixedKeys = keys.map(key => this.prefixKey(key));
      const values = await this.client!.mGet(prefixedKeys);
      
      let hits = 0;
      let misses = 0;
      
      const results = values.map((value, index) => {
        if (value === null) {
          misses++;
          return null;
        }
        
        hits++;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      });

      this.stats.hits += hits;
      this.stats.misses += misses;
      
      logger.debug(`Cache mget: ${hits} hits, ${misses} misses`);
      
      return results;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis MGET error:`, error);
      this.stats.misses += keys.length;
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, unknown>, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const prefixedPairs: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        prefixedPairs[this.prefixKey(key)] = serializedValue;
      }

      const result = await this.client!.mSet(prefixedPairs);
      
      if (result && ttl) {
        // Set TTL for all keys
        const pipeline = this.client!.multi();
        for (const key of Object.keys(prefixedPairs)) {
          pipeline.expire(key, ttl);
        }
        await pipeline.exec();
      }

      if (result) {
        this.stats.sets += Object.keys(keyValuePairs).length;
        logger.debug(`Cache mset for ${Object.keys(keyValuePairs).length} keys`, { ttl });
      }

      return !!result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis MSET error:`, error);
      return false;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const prefixedPattern = this.prefixKey(pattern);
      const keys = await this.client!.keys(prefixedPattern);
      
      // Remove prefix from returned keys
      return keys.map(key => this.unprefixKey(key));
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Clear all keys matching pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      
      return await this.delMany(keys);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis CLEAR PATTERN error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, by: number = 1): Promise<number | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = by === 1 
        ? await this.client!.incr(this.prefixKey(key))
        : await this.client!.incrBy(this.prefixKey(key), by);
      
      logger.debug(`Cache increment for key: ${key} by ${by}, result: ${result}`);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis INCR error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Decrement counter
   */
  async decr(key: string, by: number = 1): Promise<number | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = by === 1
        ? await this.client!.decr(this.prefixKey(key))
        : await this.client!.decrBy(this.prefixKey(key), by);
      
      logger.debug(`Cache decrement for key: ${key} by ${by}, result: ${result}`);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Redis DECR error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const baseStats = {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: 0,
      memory: '0B',
      hitRatio: this.stats.hits + this.stats.misses > 0 
        ? this.stats.hits / (this.stats.hits + this.stats.misses) 
        : 0,
    };

    if (!this.isAvailable()) {
      return baseStats;
    }

    try {
      const info = await this.client!.info('memory');
      const keyspace = await this.client!.info('keyspace');
      
      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch?.[1]?.trim() || '0B';
      
      // Parse key count (simplified - counts all keys)
      const keyMatch = keyspace.match(/keys=(\d+)/);
      const keys = keyMatch ? parseInt(keyMatch[1], 10) : 0;
      
      return {
        ...baseStats,
        keys,
        memory,
      };
    } catch (error) {
      logger.error('Redis STATS error:', error);
      return baseStats;
    }
  }

  /**
   * Check cache health
   */
  async checkHealth(): Promise<CacheHealth> {
    const baseHealth: CacheHealth = {
      status: 'unhealthy',
      latency: -1,
      connectedClients: 0,
      usedMemory: '0B',
      keyspaceHits: 0,
      keyspaceMisses: 0,
      hitRatio: 0,
    };

    if (!this.isAvailable()) {
      return {
        ...baseHealth,
        message: 'Redis client not available',
      };
    }

    const start = Date.now();

    try {
      // Test connectivity
      await this.client!.ping();
      const latency = Date.now() - start;

      // Get Redis info
      const info = await this.client!.info();
      
      // Parse info response
      const lines = info.split('\r\n');
      const stats: Record<string, string> = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          if (key) {
            stats[key] = value || '';
          }
        }
      }

      const keyspaceHits = parseInt(stats.keyspace_hits || '0', 10);
      const keyspaceMisses = parseInt(stats.keyspace_misses || '0', 10);
      const hitRatio = keyspaceHits + keyspaceMisses > 0 
        ? keyspaceHits / (keyspaceHits + keyspaceMisses) 
        : 0;

      return {
        status: 'healthy',
        latency,
        connectedClients: parseInt(stats.connected_clients || '0', 10),
        usedMemory: stats.used_memory_human || '0B',
        keyspaceHits,
        keyspaceMisses,
        hitRatio,
      };
    } catch (error) {
      const latency = Date.now() - start;
      
      return {
        ...baseHealth,
        latency,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Flush all cached data
   */
  async flushAll(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.flushAll();
      logger.warn('Redis cache flushed - all data cleared');
      
      // Reset stats
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.sets = 0;
      this.stats.deletes = 0;
      
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis FLUSH ALL error:', error);
      return false;
    }
  }

  /**
   * Shutdown Redis connection
   */
  async shutdown(): Promise<void> {
    if (!this.client || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      await this.client.quit();
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error('Error shutting down Redis client:', error);
      // Force disconnect
      await this.client.disconnect();
    } finally {
      this.client = null;
      this.isConnected = false;
      this.isShuttingDown = false;
    }
  }

  /**
   * Check if Redis is available
   */
  private isAvailable(): boolean {
    return this.client !== null && this.isConnected && !this.isShuttingDown;
  }

  /**
   * Add prefix to cache key
   */
  private prefixKey(key: string): string {
    const prefix = process.env.CACHE_KEY_PREFIX || 'omnicare';
    return `${prefix}:${key}`;
  }

  /**
   * Remove prefix from cache key
   */
  private unprefixKey(key: string): string {
    const prefix = process.env.CACHE_KEY_PREFIX || 'omnicare';
    const prefixWithColon = `${prefix}:`;
    return key.startsWith(prefixWithColon) ? key.slice(prefixWithColon.length) : key;
  }

  /**
   * Generate cache key for FHIR resources
   */
  generateFHIRKey(resourceType: string, operation: string, params?: Record<string, unknown>): string {
    const baseKey = `fhir:${resourceType.toLowerCase()}:${operation}`;
    
    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }
    
    // Sort parameters for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    
    return `${baseKey}:${Buffer.from(sortedParams).toString('base64')}`;
  }

  /**
   * Generate cache key for user sessions
   */
  generateUserKey(userId: string, operation: string): string {
    return `user:${userId}:${operation}`;
  }

  /**
   * Generate cache key for API rate limiting
   */
  generateRateLimitKey(identifier: string, window: string): string {
    return `rate_limit:${identifier}:${window}`;
  }
}

// Export singleton instance
export const redisCacheService = new RedisCacheService();