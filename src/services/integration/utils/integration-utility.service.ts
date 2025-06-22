/**
 * OmniCare EMR - Integration Utility Service
 * Provides common utilities, helpers, and shared functionality for integration services
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import logger from '@/utils/logger';

export interface ConnectionPool {
  id: string;
  name: string;
  type: ConnectionType;
  maxConnections: number;
  activeConnections: number;
  idleTimeout: number;
  connections: Connection[];
  healthCheck: HealthCheckConfig;
  lastHealthCheck?: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

export enum ConnectionType {
  HTTP = 'http',
  HTTPS = 'https',
  TCP = 'tcp',
  UDP = 'udp',
  DATABASE = 'database',
  MESSAGE_QUEUE = 'message_queue',
  FTP = 'ftp',
  SFTP = 'sftp',
  SOAP = 'soap',
  REST = 'rest',
  HL7_MLLP = 'hl7_mllp'
}

export interface Connection {
  id: string;
  poolId: string;
  endpoint: string;
  status: 'active' | 'idle' | 'error' | 'closed';
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  metadata?: Record<string, any>;
  client?: any;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  endpoint?: string;
  method?: string;
  expectedStatus?: number;
  expectedResponse?: string;
  retries: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (context: any) => string;
  onLimitReached?: (context: any) => void;
}

export interface CacheConfig {
  ttl: number; // seconds
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  keyPrefix?: string;
  serializer?: 'json' | 'msgpack';
}

export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyRotationInterval?: number; // hours
    keyDerivationRounds?: number;
  };
  authentication: {
    type: 'bearer' | 'basic' | 'oauth2' | 'api-key' | 'mutual-tls' | 'custom';
    credentials?: any;
    tokenRefreshThreshold?: number; // minutes
  };
  validation: {
    certificateValidation?: boolean;
    hostnameVerification?: boolean;
    allowedHosts?: string[];
    blockedHosts?: string[];
  };
}

export interface MessageEnvelope {
  id: string;
  type: string;
  version: string;
  timestamp: Date;
  source: string;
  destination: string;
  correlationId?: string;
  replyTo?: string;
  headers: Record<string, string>;
  payload: any;
  metadata?: Record<string, any>;
  signature?: string;
}

export interface TransformationPipeline {
  id: string;
  name: string;
  description: string;
  steps: TransformationStep[];
  isActive: boolean;
  version: string;
  createdAt: Date;
  lastModified: Date;
}

export interface TransformationStep {
  id: string;
  name: string;
  type: 'validate' | 'transform' | 'enrich' | 'filter' | 'route' | 'custom';
  order: number;
  configuration: any;
  errorHandling: 'continue' | 'stop' | 'retry' | 'skip';
  timeout?: number;
  retries?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface BatchProcessingConfig {
  batchSize: number;
  maxConcurrency: number;
  timeoutMs: number;
  retryConfig: {
    enabled: boolean;
    maxRetries: number;
    backoffMs: number;
  };
  errorHandling: 'fail-fast' | 'continue' | 'partial-success';
}

export interface BatchResult<T> {
  success: boolean;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  results: T[];
  errors: any[];
  executionTime: number;
}

export class IntegrationUtilityService extends EventEmitter {
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private rateLimiters: Map<string, any> = new Map();
  private caches: Map<string, any> = new Map();
  private transformationPipelines: Map<string, TransformationPipeline> = new Map();
  private encryptionKeys: Map<string, Buffer> = new Map();

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize integration utility service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing integration utility service');
    
    // Initialize default components
    await this.initializeConnectionPools();
    await this.initializeCaches();
    await this.initializeEncryption();
    this.startHealthChecks();
  }

  /**
   * Create HTTP client with connection pooling
   */
  async createHttpClient(
    poolId: string,
    endpoint: string,
    options?: {
      timeout?: number;
      retries?: number;
      headers?: Record<string, string>;
      auth?: any;
    }
  ): Promise<any> {
    try {
      const pool = this.connectionPools.get(poolId);
      if (!pool) {
        throw new Error(`Connection pool not found: ${poolId}`);
      }

      // Get or create connection
      let connection = pool.connections.find(c => 
        c.status === 'idle' && c.endpoint === endpoint
      );

      if (!connection) {
        if (pool.activeConnections >= pool.maxConnections) {
          throw new Error(`Connection pool exhausted: ${poolId}`);
        }

        connection = await this.createConnection(pool, endpoint, options);
      }

      connection.status = 'active';
      connection.lastUsed = new Date();
      connection.useCount++;
      pool.activeConnections++;

      logger.debug(`HTTP client created for ${endpoint} using pool ${poolId}`);
      return connection.client;
    } catch (error) {
      logger.error('Failed to create HTTP client:', error);
      throw error;
    }
  }

  /**
   * Create message envelope
   */
  createMessageEnvelope(
    type: string,
    payload: any,
    options?: {
      source?: string;
      destination?: string;
      correlationId?: string;
      headers?: Record<string, string>;
      sign?: boolean;
    }
  ): MessageEnvelope {
    const envelope: MessageEnvelope = {
      id: this.generateMessageId(),
      type,
      version: '1.0',
      timestamp: new Date(),
      source: options?.source || 'omnicare-emr',
      destination: options?.destination || 'unknown',
      correlationId: options?.correlationId || this.generateCorrelationId(),
      headers: {
        'content-type': 'application/json',
        ...options?.headers
      },
      payload
    };

    // Sign message if requested
    if (options?.sign) {
      envelope.signature = this.signMessage(envelope);
    }

    return envelope;
  }

  /**
   * Validate message envelope
   */
  async validateMessageEnvelope(envelope: MessageEnvelope): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation
    if (!envelope.id) {
      errors.push({
        field: 'id',
        code: 'REQUIRED',
        message: 'Message ID is required',
        severity: 'error'
      });
    }

    if (!envelope.type) {
      errors.push({
        field: 'type',
        code: 'REQUIRED',
        message: 'Message type is required',
        severity: 'error'
      });
    }

    if (!envelope.payload) {
      errors.push({
        field: 'payload',
        code: 'REQUIRED',
        message: 'Message payload is required',
        severity: 'error'
      });
    }

    // Validate signature if present
    if (envelope.signature) {
      const isValidSignature = this.verifyMessageSignature(envelope);
      if (!isValidSignature) {
        errors.push({
          field: 'signature',
          code: 'INVALID_SIGNATURE',
          message: 'Message signature verification failed',
          severity: 'critical'
        });
      }
    }

    // Check message age
    const messageAge = Date.now() - envelope.timestamp.getTime();
    if (messageAge > 5 * 60 * 1000) { // 5 minutes
      warnings.push({
        field: 'timestamp',
        code: 'OLD_MESSAGE',
        message: 'Message is older than 5 minutes'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Apply rate limiting
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
    context?: any
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const limiterKey = config.keyGenerator ? config.keyGenerator(context) : key;
    
    // Simple in-memory rate limiter (in production, use Redis or similar)
    if (!this.rateLimiters.has(limiterKey)) {
      this.rateLimiters.set(limiterKey, {
        requests: [],
        windowStart: Date.now()
      });
    }

    const limiter = this.rateLimiters.get(limiterKey);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean old requests
    limiter.requests = limiter.requests.filter((time: number) => time > windowStart);

    const remaining = Math.max(0, config.maxRequests - limiter.requests.length);
    const allowed = limiter.requests.length < config.maxRequests;

    if (allowed) {
      limiter.requests.push(now);
    } else if (config.onLimitReached) {
      config.onLimitReached(context);
    }

    const resetTime = new Date(limiter.windowStart + config.windowMs);

    return { allowed, remaining, resetTime };
  }

  /**
   * Cache data
   */
  async cacheSet(
    cacheId: string,
    key: string,
    value: any,
    ttl?: number
  ): Promise<void> {
    const cache = this.caches.get(cacheId);
    if (!cache) {
      throw new Error(`Cache not found: ${cacheId}`);
    }

    // Simple cache implementation (in production, use Redis or similar)
    const item = {
      value,
      expiry: Date.now() + (ttl || cache.defaultTtl) * 1000
    };

    cache.data.set(key, item);
    this.cleanExpiredCacheItems(cache);
  }

  /**
   * Get cached data
   */
  async cacheGet(cacheId: string, key: string): Promise<any> {
    const cache = this.caches.get(cacheId);
    if (!cache) {
      throw new Error(`Cache not found: ${cacheId}`);
    }

    const item = cache.data.get(key);
    if (!item || item.expiry < Date.now()) {
      return null;
    }

    return item.value;
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data: any, keyId: string = 'default'): string {
    const key = this.encryptionKeys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    
    const serialized = JSON.stringify(data);
    let encrypted = cipher.update(serialized, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: string, keyId: string = 'default'): any {
    const key = this.encryptionKeys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Process batch operations
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    config: BatchProcessingConfig
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: any[] = [];
    let successfulItems = 0;
    let failedItems = 0;

    try {
      // Process in batches
      for (let i = 0; i < items.length; i += config.batchSize) {
        const batch = items.slice(i, i + config.batchSize);
        
        const batchPromises = batch.map(async (item, index) => {
          try {
            const result = await Promise.race([
              processor(item),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), config.timeoutMs)
              )
            ]);
            
            results[i + index] = result;
            successfulItems++;
            return result;
          } catch (error) {
            errors[i + index] = error;
            failedItems++;
            
            if (config.errorHandling === 'fail-fast') {
              throw error;
            }
            
            return null;
          }
        });

        // Limit concurrency
        const chunks = this.chunkArray(batchPromises, config.maxConcurrency);
        for (const chunk of chunks) {
          await Promise.allSettled(chunk);
        }
      }

      const executionTime = Date.now() - startTime;
      const success = config.errorHandling === 'fail-fast' 
        ? failedItems === 0 
        : successfulItems > 0;

      return {
        success,
        totalItems: items.length,
        processedItems: successfulItems + failedItems,
        successfulItems,
        failedItems,
        results: results.filter(r => r !== undefined),
        errors: errors.filter(e => e !== undefined),
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        totalItems: items.length,
        processedItems: successfulItems + failedItems,
        successfulItems,
        failedItems,
        results,
        errors: [...errors, error],
        executionTime
      };
    }
  }

  /**
   * Generate correlation ID
   */
  generateCorrelationId(): string {
    return `corr_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate message ID
   */
  generateMessageId(): string {
    return `msg_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Format response for standardized API responses
   */
  formatResponse<T>(
    data?: T,
    success: boolean = true,
    message?: string,
    metadata?: any
  ): {
    success: boolean;
    message?: string;
    data?: T;
    timestamp: string;
    metadata?: any;
  } {
    return {
      success,
      message,
      data,
      timestamp: new Date().toISOString(),
      metadata
    };
  }

  /**
   * Parse and validate URL
   */
  parseUrl(url: string): {
    isValid: boolean;
    protocol?: string;
    hostname?: string;
    port?: number;
    pathname?: string;
    search?: string;
    hash?: string;
    error?: string;
  } {
    try {
      const parsed = new URL(url);
      return {
        isValid: true,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : undefined,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid URL'
      };
    }
  }

  /**
   * Initialize connection pools
   */
  private async initializeConnectionPools(): Promise<void> {
    // Create default HTTP pool
    const httpPool: ConnectionPool = {
      id: 'default-http',
      name: 'Default HTTP Pool',
      type: ConnectionType.HTTP,
      maxConnections: 50,
      activeConnections: 0,
      idleTimeout: 30000,
      connections: [],
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3
      },
      status: 'healthy'
    };

    this.connectionPools.set(httpPool.id, httpPool);
    logger.info('Connection pools initialized');
  }

  /**
   * Initialize caches
   */
  private async initializeCaches(): Promise<void> {
    const defaultCache = {
      id: 'default',
      data: new Map(),
      defaultTtl: 300 // 5 minutes
    };

    this.caches.set('default', defaultCache);
    logger.info('Caches initialized');
  }

  /**
   * Initialize encryption
   */
  private async initializeEncryption(): Promise<void> {
    // Generate default encryption key
    const defaultKey = crypto.scrypt(
      process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production',
      'salt',
      32
    );

    this.encryptionKeys.set('default', defaultKey as Buffer);
    logger.info('Encryption initialized');
  }

  /**
   * Create new connection
   */
  private async createConnection(
    pool: ConnectionPool,
    endpoint: string,
    options?: any
  ): Promise<Connection> {
    const connection: Connection = {
      id: this.generateConnectionId(),
      poolId: pool.id,
      endpoint,
      status: 'idle',
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
      metadata: options
    };

    // Create actual client (simplified for demonstration)
    connection.client = {
      endpoint,
      options,
      // In real implementation, this would be the actual HTTP client
    };

    pool.connections.push(connection);
    return connection;
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, 60000); // Check every minute

    logger.info('Health checks started');
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const pool of this.connectionPools.values()) {
      if (pool.healthCheck.enabled) {
        try {
          // TODO: Implement actual health check logic
          pool.status = 'healthy';
          pool.lastHealthCheck = new Date();
        } catch (error) {
          pool.status = 'unhealthy';
          logger.warn(`Health check failed for pool ${pool.id}:`, error);
        }
      }
    }
  }

  /**
   * Sign message
   */
  private signMessage(envelope: MessageEnvelope): string {
    const payload = JSON.stringify({
      id: envelope.id,
      type: envelope.type,
      timestamp: envelope.timestamp,
      payload: envelope.payload
    });

    return crypto
      .createHmac('sha256', process.env.MESSAGE_SIGNING_KEY || 'default-signing-key')
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify message signature
   */
  private verifyMessageSignature(envelope: MessageEnvelope): boolean {
    const expectedSignature = this.signMessage(envelope);
    return crypto.timingSafeEqual(
      Buffer.from(envelope.signature!, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Clean expired cache items
   */
  private cleanExpiredCacheItems(cache: any): void {
    const now = Date.now();
    for (const [key, item] of cache.data.entries()) {
      if (item.expiry < now) {
        cache.data.delete(key);
      }
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Generate connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    const poolStatuses = Array.from(this.connectionPools.values()).map(pool => ({
      id: pool.id,
      status: pool.status,
      activeConnections: pool.activeConnections,
      maxConnections: pool.maxConnections
    }));

    const overallHealthy = poolStatuses.every(pool => pool.status === 'healthy');

    return {
      status: overallHealthy ? 'UP' : 'DEGRADED',
      details: {
        connectionPools: poolStatuses,
        cacheCount: this.caches.size,
        rateLimiterCount: this.rateLimiters.size,
        encryptionKeysCount: this.encryptionKeys.size
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    
    // Close all connections
    for (const pool of this.connectionPools.values()) {
      for (const connection of pool.connections) {
        connection.status = 'closed';
        // TODO: Close actual connections
      }
    }

    this.connectionPools.clear();
    this.rateLimiters.clear();
    this.caches.clear();
    this.transformationPipelines.clear();
    this.encryptionKeys.clear();
    
    logger.info('Integration utility service shut down');
  }
}

// Export singleton instance
export const integrationUtilityService = new IntegrationUtilityService();