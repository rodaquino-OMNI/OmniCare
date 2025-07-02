/**
 * Redis Connection Pool Configuration
 * Optimized settings for high-performance caching
 */

import { RedisOptions } from 'ioredis';

export interface RedisPoolConfig {
  // Connection pool settings
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  evictionRunIntervalMillis: number;
  
  // Performance settings
  enableOfflineQueue: boolean;
  enableReadyCheck: boolean;
  lazyConnect: boolean;
  
  // Retry strategy
  maxRetriesPerRequest: number;
  enableAutoPipelining: boolean;
  autoPipeliningIgnoredCommands: string[];
  
  // Monitoring
  enablePerformanceMonitoring: boolean;
  slowLogThreshold: number; // milliseconds
}

export const getOptimizedRedisConfig = (env: string = 'production'): RedisOptions & RedisPoolConfig => {
  const baseConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    
    // Connection settings
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: 10000,
    
    // Enable connection pooling
    connectionName: `omnicare-${env}`,
    
    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      if (times > 10) {
        // Stop retrying after 10 attempts
        return null;
      }
      // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
      return Math.min(times * 50, 2000);
    },
    
    // Reconnect settings
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        return true;
      }
      return false;
    },
  };

  const poolConfig: RedisPoolConfig = {
    // Connection pool settings
    minConnections: env === 'production' ? 10 : 2,
    maxConnections: env === 'production' ? 50 : 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    evictionRunIntervalMillis: 60000,
    
    // Performance settings
    enableOfflineQueue: true,
    enableReadyCheck: true,
    lazyConnect: false,
    
    // Retry strategy
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    autoPipeliningIgnoredCommands: ['ping', 'info', 'monitor'],
    
    // Monitoring
    enablePerformanceMonitoring: env === 'production',
    slowLogThreshold: 100, // Log commands slower than 100ms
  };

  // Production-specific optimizations
  if (env === 'production') {
    return {
      ...baseConfig,
      ...poolConfig,
      
      // Cluster configuration for production
      sentinels: process.env.REDIS_SENTINELS ? 
        process.env.REDIS_SENTINELS.split(',').map(s => {
          const [host, port] = s.split(':');
          return { host, port: parseInt(port || '26379') };
        }) : undefined,
      name: process.env.REDIS_SENTINEL_NAME,
      
      // Enable pipelining for better performance
      enableAutoPipelining: true,
      
      // Connection options (compatible with ioredis)
      keepAlive: 10000,
      
      // Read preference for cluster mode
      scaleReads: 'slave',
      
      // Connection pool specific for production
      poolOptions: {
        min: poolConfig.minConnections,
        max: poolConfig.maxConnections,
        acquireTimeoutMillis: poolConfig.acquireTimeoutMillis,
        idleTimeoutMillis: poolConfig.idleTimeoutMillis,
        evictionRunIntervalMillis: poolConfig.evictionRunIntervalMillis,
      },
    };
  }

  // Development/test configuration
  return {
    ...baseConfig,
    ...poolConfig,
    minConnections: 2,
    maxConnections: 10,
  };
};

/**
 * Create Redis pool monitoring configuration
 */
export const getRedisMonitoringConfig = () => ({
  // Health check settings
  healthCheckInterval: 30000, // 30 seconds
  healthCheckTimeout: 5000,   // 5 seconds
  
  // Metrics collection
  metricsInterval: 60000,     // 1 minute
  metricsRetention: 86400000, // 24 hours
  
  // Alert thresholds
  alertThresholds: {
    connectionPoolUsage: 0.8,   // 80% pool usage
    slowCommandRate: 0.1,       // 10% slow commands
    errorRate: 0.05,            // 5% error rate
    memoryUsage: 0.85,          // 85% memory usage
  },
  
  // Performance tracking
  trackCommands: [
    'get', 'set', 'del', 'mget', 'mset',
    'hget', 'hset', 'hdel', 'hgetall',
    'sadd', 'srem', 'smembers',
    'zadd', 'zrem', 'zrange',
    'eval', 'evalsha',
  ],
});

/**
 * Redis pool optimization recommendations based on metrics
 */
export const getPoolOptimizationRecommendations = (metrics: {
  poolUsage: number;
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
}) => {
  const recommendations: string[] = [];

  // Pool size recommendations
  if (metrics.poolUsage > 0.9) {
    recommendations.push('CRITICAL: Connection pool is at >90% capacity. Increase maxConnections.');
  } else if (metrics.poolUsage > 0.7) {
    recommendations.push('WARNING: Connection pool usage is high (>70%). Consider increasing pool size.');
  } else if (metrics.poolUsage < 0.2) {
    recommendations.push('INFO: Connection pool usage is low (<20%). Consider decreasing pool size to save resources.');
  }

  // Response time recommendations
  if (metrics.avgResponseTime > 100) {
    recommendations.push('WARNING: Average response time >100ms. Check network latency and Redis server performance.');
  }
  if (metrics.avgResponseTime > 50) {
    recommendations.push('INFO: Consider enabling pipelining for batch operations to reduce latency.');
  }

  // Error rate recommendations
  if (metrics.errorRate > 0.05) {
    recommendations.push('CRITICAL: High error rate (>5%). Check Redis server health and network stability.');
  } else if (metrics.errorRate > 0.01) {
    recommendations.push('WARNING: Elevated error rate (>1%). Monitor for connection issues.');
  }

  // Throughput recommendations
  if (metrics.throughput > 10000) {
    recommendations.push('INFO: High throughput detected. Consider Redis Cluster for horizontal scaling.');
    recommendations.push('INFO: Enable read replicas to distribute read load.');
  }

  return recommendations;
};

/**
 * Redis command optimization settings
 */
export const getCommandOptimizations = () => ({
  // Batch operation settings
  batchSize: {
    mget: 100,      // Max keys per MGET
    mset: 50,       // Max key-value pairs per MSET
    pipeline: 1000, // Max commands per pipeline
  },
  
  // TTL settings (seconds)
  defaultTTL: {
    session: 3600,      // 1 hour
    apiCache: 300,      // 5 minutes
    queryCache: 600,    // 10 minutes
    staticData: 86400,  // 24 hours
  },
  
  // Key patterns for optimization
  keyPatterns: {
    session: 'session:*',
    cache: 'cache:*',
    temp: 'temp:*',
    lock: 'lock:*',
  },
  
  // Eviction policies by key pattern
  evictionPolicies: {
    'session:*': 'volatile-lru',
    'cache:*': 'allkeys-lru',
    'temp:*': 'volatile-ttl',
    'lock:*': 'volatile-ttl',
  },
});

/**
 * Connection pool lifecycle hooks
 */
export const poolLifecycleHooks = {
  onConnect: (client: any) => {
    // Redis client connected to pool
    // Set client name for monitoring
    client.client('SETNAME', `omnicare-pool-${Date.now()}`);
  },
  
  onReady: (client: any) => {
    // Redis client ready
    // Warm up connection with PING
    client.ping();
  },
  
  onError: (error: Error, client: any) => {
    console.error('Redis client error:', error);
    // Log error metrics
  },
  
  onClose: (client: any) => {
    // Redis client disconnected from pool
    // Clean up resources
  },
  
  onReconnecting: (delay: number, attempt: number) => {
    // Redis reconnecting
  },
};

export default getOptimizedRedisConfig;