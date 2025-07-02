/**
 * Redis Connection Pool Manager
 * Manages optimized Redis connections with monitoring and auto-scaling
 */

import { EventEmitter } from 'events';

import IORedis, { Redis, Cluster } from 'ioredis';

import { getOptimizedRedisConfig, getRedisMonitoringConfig, getPoolOptimizationRecommendations } from '../config/redis-pool.config';
import logger from '../utils/logger';

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  poolUsage: number;
  throughput: number;
  lastUpdated: Date;
}

interface ConnectionStats {
  created: Date;
  lastUsed: Date;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
}

export class RedisPoolManager extends EventEmitter {
  private pools: Map<string, Redis[]> = new Map();
  private activeConnections: Map<string, Redis> = new Map();
  private connectionStats: Map<string, ConnectionStats> = new Map();
  private metrics: PoolMetrics = this.initializeMetrics();
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  private readonly poolNames = ['default', 'cache', 'session', 'pubsub', 'blocking'];
  private readonly config = getOptimizedRedisConfig(process.env.NODE_ENV);
  private readonly monitoringConfig = getRedisMonitoringConfig();

  constructor() {
    super();
    this.initializePools();
    this.startMonitoring();
    this.startOptimization();
  }

  /**
   * Initialize connection pools
   */
  private async initializePools(): Promise<void> {
    for (const poolName of this.poolNames) {
      const pool: Redis[] = [];
      const minConnections = this.getMinConnectionsForPool(poolName);

      // Create minimum connections
      for (let i = 0; i < minConnections; i++) {
        const connection = await this.createConnection(poolName);
        pool.push(connection);
        this.trackConnection(connection, poolName);
      }

      this.pools.set(poolName, pool);
      logger.info(`Initialized Redis pool '${poolName}' with ${minConnections} connections`);
    }
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(poolName: string = 'default', options?: { 
    priority?: 'high' | 'normal' | 'low';
    timeout?: number;
  }): Promise<Redis> {
    const { priority = 'normal', timeout = 5000 } = options || {};
    
    if (this.isShuttingDown) {
      throw new Error('Pool manager is shutting down');
    }

    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool '${poolName}' does not exist`);
    }

    const startTime = Date.now();

    // Try to get an idle connection
    let connection = this.getIdleConnection(pool, poolName);

    if (!connection) {
      // Check if we can create a new connection
      if (this.canCreateNewConnection(poolName)) {
        connection = await this.createConnection(poolName);
        pool.push(connection);
      } else {
        // Wait for a connection to become available
        connection = await this.waitForConnection(poolName, timeout, priority);
      }
    }

    if (!connection) {
      throw new Error(`Failed to acquire connection from pool '${poolName}' within ${timeout}ms`);
    }

    // Mark connection as active
    this.activeConnections.set(this.getConnectionId(connection), connection);
    
    // Update metrics
    this.metrics.totalRequests++;
    this.updateConnectionStats(connection, Date.now() - startTime);

    this.emit('connection-acquired', { poolName, connectionId: this.getConnectionId(connection) });

    return this.wrapConnection(connection, poolName);
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection: Redis, poolName: string = 'default'): void {
    const connectionId = this.getConnectionId(connection);
    
    if (this.activeConnections.has(connectionId)) {
      this.activeConnections.delete(connectionId);
      
      // Check connection health before returning to pool
      if (this.isConnectionHealthy(connection)) {
        this.emit('connection-released', { poolName, connectionId });
      } else {
        // Replace unhealthy connection
        this.replaceConnection(connection, poolName);
      }
    }
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const metrics = this.getMetrics();
    return getPoolOptimizationRecommendations({
      poolUsage: metrics.poolUsage,
      avgResponseTime: metrics.avgResponseTime,
      errorRate: metrics.totalErrors / Math.max(1, metrics.totalRequests),
      throughput: metrics.throughput,
    });
  }

  /**
   * Perform manual optimization
   */
  async optimizePools(): Promise<void> {
    logger.info('Starting manual pool optimization...');

    for (const [poolName, pool] of this.pools) {
      const usage = this.calculatePoolUsage(poolName);
      
      if (usage > 0.8) {
        // Scale up
        await this.scalePool(poolName, 'up');
      } else if (usage < 0.2 && pool.length > this.getMinConnectionsForPool(poolName)) {
        // Scale down
        await this.scalePool(poolName, 'down');
      }

      // Clean up idle connections
      await this.cleanupIdleConnections(poolName);
    }

    logger.info('Pool optimization completed');
  }

  /**
   * Execute command with automatic pool selection
   */
  async execute(command: string, args: any[], options?: {
    poolName?: string;
    timeout?: number;
  }): Promise<any> {
    const poolName = options?.poolName || this.selectPoolForCommand(command);
    const connection = await this.getConnection(poolName, options);

    try {
      // Type-safe command execution
      const fn = (connection as any)[command];
      if (typeof fn !== 'function') {
        throw new Error(`Invalid Redis command: ${command}`);
      }
      const result = await fn.apply(connection, args);
      return result;
    } finally {
      this.releaseConnection(connection, poolName);
    }
  }

  /**
   * Execute pipeline with connection pooling
   */
  async pipeline(commands: Array<[string, ...any[]]>, poolName: string = 'default'): Promise<any[]> {
    const connection = await this.getConnection(poolName);

    try {
      const pipeline = connection.pipeline();
      
      for (const [command, ...args] of commands) {
        // Type-safe pipeline command execution
        const fn = (pipeline as any)[command];
        if (typeof fn === 'function') {
          fn.apply(pipeline, args);
        }
      }

      const results = await pipeline.exec();
      return results ? results.map(([err, result]) => {
        if (err) throw err;
        return result;
      }) : [];
    } finally {
      this.releaseConnection(connection, poolName);
    }
  }

  /**
   * Health check for all pools
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    pools: Record<string, {
      healthy: boolean;
      size: number;
      active: number;
      latency: number;
    }>;
  }> {
    const results: Record<string, any> = {};
    let overallHealthy = true;

    for (const [poolName, pool] of this.pools) {
      const poolHealth = {
        healthy: true,
        size: pool.length,
        active: 0,
        latency: -1,
      };

      try {
        // Test a connection from the pool
        const connection = pool[0];
        if (connection) {
          const start = Date.now();
          await connection.ping();
          poolHealth.latency = Date.now() - start;
          
          // Count active connections
          poolHealth.active = Array.from(this.activeConnections.values())
            .filter(conn => pool.includes(conn)).length;
        }
      } catch (error) {
        poolHealth.healthy = false;
        overallHealthy = false;
        logger.error(`Health check failed for pool '${poolName}':`, error);
      }

      results[poolName] = poolHealth;
    }

    return {
      healthy: overallHealthy,
      pools: results,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Redis pool manager...');
    this.isShuttingDown = true;

    // Stop monitoring and optimization
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    // Wait for active connections to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeConnections.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force close remaining active connections
    if (this.activeConnections.size > 0) {
      logger.warn(`Forcing close of ${this.activeConnections.size} active connections`);
      for (const connection of this.activeConnections.values()) {
        connection.disconnect();
      }
    }

    // Close all pool connections
    for (const [poolName, pool] of this.pools) {
      logger.info(`Closing ${pool.length} connections in pool '${poolName}'`);
      for (const connection of pool) {
        connection.disconnect();
      }
    }

    this.pools.clear();
    this.activeConnections.clear();
    this.connectionStats.clear();

    logger.info('Redis pool manager shutdown complete');
  }

  // Private helper methods

  private initializeMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0,
      poolUsage: 0,
      throughput: 0,
      lastUpdated: new Date(),
    };
  }

  private async createConnection(poolName: string): Promise<Redis> {
    const connection = new IORedis(this.config);
    
    // Set up event handlers
    connection.on('error', (error) => {
      logger.error(`Redis connection error in pool '${poolName}':`, error);
      this.metrics.totalErrors++;
      this.emit('connection-error', { poolName, error });
    });

    connection.on('close', () => {
      this.handleConnectionClose(connection, poolName);
    });

    // Wait for connection to be ready
    await new Promise<void>((resolve, reject) => {
      connection.once('ready', resolve);
      connection.once('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    // Set connection name for monitoring
    await connection.client('SETNAME', `omnicare-${poolName}-${Date.now()}`);

    this.metrics.totalConnections++;
    
    return connection;
  }

  private trackConnection(connection: Redis, poolName: string): void {
    const connectionId = this.getConnectionId(connection);
    
    this.connectionStats.set(connectionId, {
      created: new Date(),
      lastUsed: new Date(),
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
    });
  }

  private getConnectionId(connection: Redis): string {
    return `${connection.options.host}:${connection.options.port}:${(connection as any).stream?.id || Math.random()}`;
  }

  private getIdleConnection(pool: Redis[], poolName: string): Redis | null {
    for (const connection of pool) {
      const connectionId = this.getConnectionId(connection);
      if (!this.activeConnections.has(connectionId) && this.isConnectionHealthy(connection)) {
        return connection;
      }
    }
    return null;
  }

  private isConnectionHealthy(connection: Redis): boolean {
    return connection.status === 'ready' && !connection.stream?.destroyed;
  }

  private canCreateNewConnection(poolName: string): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) return false;
    
    const maxConnections = this.getMaxConnectionsForPool(poolName);
    return pool.length < maxConnections;
  }

  private getMinConnectionsForPool(poolName: string): number {
    const poolConfigs: Record<string, number> = {
      default: 5,
      cache: 10,
      session: 5,
      pubsub: 2,
      blocking: 2,
    };
    
    return poolConfigs[poolName] || this.config.minConnections || 2;
  }

  private getMaxConnectionsForPool(poolName: string): number {
    const poolConfigs: Record<string, number> = {
      default: 20,
      cache: 50,
      session: 30,
      pubsub: 10,
      blocking: 5,
    };
    
    return poolConfigs[poolName] || this.config.maxConnections || 10;
  }

  private async waitForConnection(
    poolName: string, 
    timeout: number, 
    priority: string
  ): Promise<Redis | null> {
    const startTime = Date.now();
    const checkInterval = 50; // Check every 50ms

    while (Date.now() - startTime < timeout) {
      const pool = this.pools.get(poolName);
      if (pool) {
        const connection = this.getIdleConnection(pool, poolName);
        if (connection) {
          return connection;
        }
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return null;
  }

  private wrapConnection(connection: Redis, poolName: string): Redis {
    // Create a proxy to intercept commands and update stats
    return new Proxy(connection, {
      get: (target, prop) => {
        const original = (target as any)[prop];
        
        if (typeof original === 'function' && typeof prop === 'string') {
          return (...args: any[]) => {
            const startTime = Date.now();
            
            try {
              const result = original.apply(target, args);
              
              if (result instanceof Promise) {
                return result
                  .then((value) => {
                    this.updateConnectionStats(connection, Date.now() - startTime);
                    return value;
                  })
                  .catch((error) => {
                    this.updateConnectionStats(connection, Date.now() - startTime, true);
                    throw error;
                  });
              }
              
              this.updateConnectionStats(connection, Date.now() - startTime);
              return result;
            } catch (error) {
              this.updateConnectionStats(connection, Date.now() - startTime, true);
              throw error;
            }
          };
        }
        
        return original;
      },
    });
  }

  private updateConnectionStats(connection: Redis, responseTime: number, isError = false): void {
    const connectionId = this.getConnectionId(connection);
    const stats = this.connectionStats.get(connectionId);
    
    if (stats) {
      stats.lastUsed = new Date();
      stats.requestCount++;
      
      if (isError) {
        stats.errorCount++;
      }
      
      // Update average response time
      stats.avgResponseTime = 
        (stats.avgResponseTime * (stats.requestCount - 1) + responseTime) / stats.requestCount;
    }
  }

  private async replaceConnection(oldConnection: Redis, poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    try {
      // Disconnect old connection
      oldConnection.disconnect();
      
      // Remove from pool
      const index = pool.indexOf(oldConnection);
      if (index > -1) {
        pool.splice(index, 1);
      }

      // Create new connection
      const newConnection = await this.createConnection(poolName);
      pool.push(newConnection);
      this.trackConnection(newConnection, poolName);

      logger.info(`Replaced unhealthy connection in pool '${poolName}'`);
    } catch (error) {
      logger.error(`Failed to replace connection in pool '${poolName}':`, error);
    }
  }

  private handleConnectionClose(connection: Redis, poolName: string): void {
    const connectionId = this.getConnectionId(connection);
    
    // Remove from active connections
    this.activeConnections.delete(connectionId);
    
    // Remove from pool
    const pool = this.pools.get(poolName);
    if (pool) {
      const index = pool.indexOf(connection);
      if (index > -1) {
        pool.splice(index, 1);
      }
    }

    // Remove stats
    this.connectionStats.delete(connectionId);

    this.emit('connection-closed', { poolName, connectionId });

    // Create replacement connection if not shutting down
    if (!this.isShuttingDown && pool && pool.length < this.getMinConnectionsForPool(poolName)) {
      this.createConnection(poolName)
        .then(newConnection => {
          pool.push(newConnection);
          this.trackConnection(newConnection, poolName);
        })
        .catch(error => {
          logger.error(`Failed to create replacement connection for pool '${poolName}':`, error);
        });
    }
  }

  private selectPoolForCommand(command: string): string {
    // Route commands to appropriate pools
    const commandPools: Record<string, string> = {
      // Blocking commands
      blpop: 'blocking',
      brpop: 'blocking',
      brpoplpush: 'blocking',
      bzpopmin: 'blocking',
      bzpopmax: 'blocking',
      
      // Pub/Sub commands
      subscribe: 'pubsub',
      psubscribe: 'pubsub',
      publish: 'pubsub',
      
      // Session commands
      setex: 'session',
      expire: 'session',
      ttl: 'session',
      
      // Cache commands
      get: 'cache',
      set: 'cache',
      mget: 'cache',
      mset: 'cache',
    };

    return commandPools[command.toLowerCase()] || 'default';
  }

  private updateMetrics(): void {
    let totalActive = 0;
    let totalIdle = 0;
    let totalConnections = 0;

    for (const [poolName, pool] of this.pools) {
      totalConnections += pool.length;
      
      for (const connection of pool) {
        const connectionId = this.getConnectionId(connection);
        if (this.activeConnections.has(connectionId)) {
          totalActive++;
        } else {
          totalIdle++;
        }
      }
    }

    this.metrics.totalConnections = totalConnections;
    this.metrics.activeConnections = totalActive;
    this.metrics.idleConnections = totalIdle;
    this.metrics.poolUsage = totalConnections > 0 ? totalActive / totalConnections : 0;
    this.metrics.lastUpdated = new Date();

    // Calculate throughput (requests per second)
    const timeDiff = Date.now() - this.metrics.lastUpdated.getTime();
    if (timeDiff > 0) {
      this.metrics.throughput = (this.metrics.totalRequests / timeDiff) * 1000;
    }
  }

  private calculatePoolUsage(poolName: string): number {
    const pool = this.pools.get(poolName);
    if (!pool || pool.length === 0) return 0;

    let activeCount = 0;
    for (const connection of pool) {
      const connectionId = this.getConnectionId(connection);
      if (this.activeConnections.has(connectionId)) {
        activeCount++;
      }
    }

    return activeCount / pool.length;
  }

  private async scalePool(poolName: string, direction: 'up' | 'down'): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    if (direction === 'up') {
      const maxConnections = this.getMaxConnectionsForPool(poolName);
      const connectionsToAdd = Math.min(5, maxConnections - pool.length);

      for (let i = 0; i < connectionsToAdd; i++) {
        try {
          const connection = await this.createConnection(poolName);
          pool.push(connection);
          this.trackConnection(connection, poolName);
        } catch (error) {
          logger.error(`Failed to scale up pool '${poolName}':`, error);
          break;
        }
      }

      if (connectionsToAdd > 0) {
        logger.info(`Scaled up pool '${poolName}' by ${connectionsToAdd} connections`);
      }
    } else {
      const minConnections = this.getMinConnectionsForPool(poolName);
      const connectionsToRemove = Math.min(5, pool.length - minConnections);
      
      // Remove idle connections
      let removed = 0;
      for (let i = pool.length - 1; i >= 0 && removed < connectionsToRemove; i--) {
        const connection = pool[i];
        if (!connection) continue;
        
        const connectionId = this.getConnectionId(connection);
        
        if (!this.activeConnections.has(connectionId)) {
          connection.disconnect();
          pool.splice(i, 1);
          this.connectionStats.delete(connectionId);
          removed++;
        }
      }

      if (removed > 0) {
        logger.info(`Scaled down pool '${poolName}' by ${removed} connections`);
      }
    }
  }

  private async cleanupIdleConnections(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const now = Date.now();
    const idleTimeout = 300000; // 5 minutes
    const minConnections = this.getMinConnectionsForPool(poolName);

    for (let i = pool.length - 1; i >= 0 && pool.length > minConnections; i--) {
      const connection = pool[i];
      if (!connection) continue;
      
      const connectionId = this.getConnectionId(connection);
      const stats = this.connectionStats.get(connectionId);

      if (stats && 
          !this.activeConnections.has(connectionId) && 
          now - stats.lastUsed.getTime() > idleTimeout) {
        
        connection.disconnect();
        pool.splice(i, 1);
        this.connectionStats.delete(connectionId);
        
        logger.debug(`Cleaned up idle connection in pool '${poolName}'`);
      }
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics-updated', this.getMetrics());
      
      // Log metrics periodically
      if (Math.random() < 0.1) { // Log 10% of the time
        logger.debug('Redis pool metrics:', this.getMetrics());
      }
    }, this.monitoringConfig.metricsInterval);
  }

  private startOptimization(): void {
    this.optimizationInterval = setInterval(async () => {
      try {
        await this.optimizePools();
      } catch (error) {
        logger.error('Pool optimization failed:', error);
      }
    }, 60000); // Run every minute
  }
}

// Export singleton instance
export const redisPoolManager = new RedisPoolManager();