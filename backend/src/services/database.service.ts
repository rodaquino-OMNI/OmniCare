/**
 * OmniCare EMR Backend - Database Connection Service
 * Manages PostgreSQL connection pool and database operations
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

import config from '@/config';
import logger from '@/utils/logger';

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  latency: number;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  message?: string;
}

export class DatabaseService {
  private pool: Pool | null = null;
  private isShuttingDown = false;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    // Skip initialization if database is mocked for tests
    if (process.env.MOCK_DATABASE === 'true') {
      return;
    }
    
    try {
      // Dynamic pool sizing based on environment and load
      const poolSize = this.calculateOptimalPoolSize();
      
      this.pool = new Pool({
        connectionString: config.database.url,
        max: poolSize.max,
        min: poolSize.min,
        idleTimeoutMillis: 45000, // Increased for better connection reuse
        connectionTimeoutMillis: 5000, // Increased timeout for high load
        allowExitOnIdle: false,
        
        // SSL configuration for production
        ssl: config.server.env === 'production' ? { rejectUnauthorized: false } : false,
        
        // Optimized performance settings
        statement_timeout: 45000, // 45 seconds for complex queries
        query_timeout: 45000,
        idle_in_transaction_session_timeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 1000,
        
        // Enhanced connection options
        options: '-c default_transaction_isolation=read_committed -c statement_timeout=45s -c idle_in_transaction_session_timeout=30s',
        
        // Application-specific settings
        application_name: 'omnicare-emr-optimized',
      });

      // Test the connection
      await this.query('SELECT 1');

      // Set up error handlers
      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error:', err);
      });

      this.pool.on('connect', () => {
        logger.debug('New database client connected');
      });

      this.pool.on('acquire', () => {
        logger.debug('Database client acquired from pool');
      });

      this.pool.on('remove', () => {
        logger.debug('Database client removed from pool');
      });

      logger.info('Database connection pool initialized', {
        maxConnections: config.database.connectionPoolSize,
        database: this.extractDatabaseName(config.database.url),
      });
    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal pool size based on environment and CPU cores
   */
  private calculateOptimalPoolSize(): { min: number; max: number } {
    const cpuCores = require('os').cpus().length;
    const env = config.server.env;
    
    if (env === 'production') {
      return {
        min: Math.max(2, Math.floor(cpuCores / 2)),
        max: Math.min(50, cpuCores * 4), // Scale with CPU cores
      };
    } else if (env === 'staging') {
      return {
        min: 2,
        max: Math.min(20, cpuCores * 2),
      };
    } else {
      return {
        min: 1,
        max: Math.min(10, cpuCores),
      };
    }
  }

  /**
   * Execute a query with the connection pool and enhanced error handling
   */
  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    // Return mock response if database is mocked for tests
    if (process.env.MOCK_DATABASE === 'true') {
      return Promise.resolve({ rows: [] as T[], rowCount: 0 } as QueryResult<T>);
    }
    
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;

      // Enhanced query performance logging
      if (duration > 2000) {
        logger.error('Very slow database query detected', {
          query: text.substring(0, 200),
          duration,
          rows: result.rowCount,
          params: params ? JSON.stringify(params).substring(0, 100) : undefined,
        });
      } else if (duration > 1000) {
        logger.warn('Slow database query detected', {
          query: text.substring(0, 150),
          duration,
          rows: result.rowCount,
        });
      } else if (duration > 500) {
        logger.info('Moderate query execution time', {
          query: text.substring(0, 100),
          duration,
          rows: result.rowCount,
        });
      } else {
        logger.debug('Database query executed', {
          query: text.substring(0, 80),
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      logger.error('Database query error:', {
        query: text,
        error,
        duration: Date.now() - start,
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Get the database connection pool
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    return this.pool;
  }

  /**
   * Get a client for transaction operations
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    return this.pool.connect();
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute transaction with checkpoint support for resume functionality
   */
  async transactionWithCheckpoints<T>(
    transactionId: string,
    callback: (client: PoolClient, createCheckpoint: (name: string, data: unknown) => Promise<void>) => Promise<T>,
    resumeFromCheckpoint?: string
  ): Promise<T> {
    const client = await this.getClient();
    const checkpoints = new Map<string, unknown>();

    try {
      await client.query('BEGIN');
      
      // Create checkpoint function
      const createCheckpoint = async (name: string, data: unknown) => {
        checkpoints.set(name, data);
        // Store checkpoint in database for resume capability
        await client.query(
          'INSERT INTO audit.transaction_checkpoints (transaction_id, checkpoint_name, checkpoint_data, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (transaction_id, checkpoint_name) DO UPDATE SET checkpoint_data = $3, created_at = NOW()',
          [transactionId, name, JSON.stringify(data)]
        );
        logger.debug(`Transaction checkpoint created: ${transactionId}:${name}`);
      };

      // Resume from checkpoint if specified
      if (resumeFromCheckpoint) {
        const checkpointResult = await client.query(
          'SELECT checkpoint_data FROM audit.transaction_checkpoints WHERE transaction_id = $1 AND checkpoint_name = $2',
          [transactionId, resumeFromCheckpoint]
        );
        
        if (checkpointResult.rows.length > 0) {
          const resumeData = JSON.parse(checkpointResult.rows[0].checkpoint_data);
          logger.info(`Resuming transaction from checkpoint: ${transactionId}:${resumeFromCheckpoint}`);
          checkpoints.set(resumeFromCheckpoint, resumeData);
        }
      }

      const result = await callback(client, createCheckpoint);
      await client.query('COMMIT');
      
      // Clean up checkpoints on successful completion
      await client.query(
        'DELETE FROM audit.transaction_checkpoints WHERE transaction_id = $1',
        [transactionId]
      );
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Transaction with checkpoints failed: ${transactionId}`, error);
      
      // Keep checkpoints for potential resume
      logger.info(`Checkpoints preserved for potential resume: ${transactionId}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get available checkpoints for a transaction
   */
  async getTransactionCheckpoints(transactionId: string): Promise<Array<{ name: string; data: unknown; createdAt: Date }>> {
    const result = await this.query(
      'SELECT checkpoint_name, checkpoint_data, created_at FROM audit.transaction_checkpoints WHERE transaction_id = $1 ORDER BY created_at',
      [transactionId]
    );
    
    return result.rows.map(row => ({
      name: row.checkpoint_name,
      data: JSON.parse(row.checkpoint_data),
      createdAt: row.created_at
    }));
  }

  /**
   * Clean up old transaction checkpoints
   */
  async cleanupOldCheckpoints(olderThanHours: number = 24): Promise<number> {
    const result = await this.query(
      'DELETE FROM audit.transaction_checkpoints WHERE created_at < NOW() - INTERVAL $1 HOUR',
      [olderThanHours]
    );
    
    logger.info(`Cleaned up ${result.rowCount} old transaction checkpoints`);
    return result.rowCount || 0;
  }

  /**
   * Check database health
   */
  async checkHealth(): Promise<DatabaseHealth> {
    // Return healthy status if database is mocked for tests
    if (process.env.MOCK_DATABASE === 'true') {
      return {
        status: 'healthy',
        latency: 0,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        message: 'Mocked for tests',
      };
    }
    
    if (!this.pool) {
      return {
        status: 'unhealthy',
        latency: -1,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        message: 'Database pool not initialized',
      };
    }

    const start = Date.now();

    try {
      // Simple health check query
      await this.query('SELECT 1');
      const latency = Date.now() - start;

      const poolStats = this.pool as unknown as Pool & PoolStats;
      
      return {
        status: 'healthy',
        latency,
        activeConnections: poolStats.totalCount - poolStats.idleCount,
        idleConnections: poolStats.idleCount,
        totalConnections: poolStats.totalCount,
      };
    } catch (error) {
      const latency = Date.now() - start;
      
      return {
        status: 'unhealthy',
        latency,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute query with retry logic for transient failures
   */
  async queryWithRetry<T extends QueryResultRow = QueryResultRow>(
    text: string, 
    params?: unknown[], 
    maxRetries: number = 3
  ): Promise<QueryResult<T>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.query<T>(text, params);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry for syntax errors or constraint violations
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
          logger.warn(`Query failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
            error: (error as Error).message,
            query: text.substring(0, 100)
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Query execution failed after retries');
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    const message = (error as Error).message?.toLowerCase() || '';
    return (
      message.includes('syntax error') ||
      message.includes('constraint') ||
      message.includes('duplicate key') ||
      message.includes('foreign key') ||
      message.includes('not null violation') ||
      message.includes('check constraint')
    );
  }

  /**
   * Get enhanced pool statistics with utilization metrics
   */
  getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
    utilization: number;
    efficiency: number;
  } {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0 };
    }

    const poolStats = this.pool as unknown as Pool & PoolStats;
    const total = poolStats.totalCount || 0;
    const idle = poolStats.idleCount || 0;
    const waiting = poolStats.waitingCount || 0;
    const active = total - idle;
    
    return {
      total,
      idle,
      waiting,
      utilization: total > 0 ? active / total : 0,
      efficiency: total > 0 ? (active - waiting) / total : 0,
    };
  }

  /**
   * Shutdown database connection pool
   */
  async shutdown(): Promise<void> {
    // Skip shutdown if database is mocked for tests
    if (process.env.MOCK_DATABASE === 'true') {
      return;
    }
    
    if (!this.pool) {
      return;
    }

    this.isShuttingDown = true;

    try {
      await this.pool.end();
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error shutting down database pool:', error);
      throw error;
    } finally {
      this.pool = null;
      this.isShuttingDown = false;
    }
  }

  /**
   * Extract database name from connection URL
   */
  private extractDatabaseName(url: string): string {
    try {
      const match = url.match(/\/([^/?]+)(\?|$)/);
      return match?.[1] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Ensure audit schema exists
   */
  async ensureAuditSchema(): Promise<void> {
    // Skip schema creation if database is mocked for tests
    if (process.env.MOCK_DATABASE === 'true') {
      return;
    }
    
    try {
      // Create audit schema if it doesn't exist
      await this.query('CREATE SCHEMA IF NOT EXISTS audit');
      
      // Create admin schema if it doesn't exist
      await this.query('CREATE SCHEMA IF NOT EXISTS admin');
      
      // Ensure UUID extension is enabled
      await this.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      // Create transaction checkpoints table for resume functionality
      await this.query(`
        CREATE TABLE IF NOT EXISTS audit.transaction_checkpoints (
          id SERIAL PRIMARY KEY,
          transaction_id VARCHAR(255) NOT NULL,
          checkpoint_name VARCHAR(255) NOT NULL,
          checkpoint_data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(transaction_id, checkpoint_name)
        )
      `);
      
      // Create index on transaction_id for efficient lookups
      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_transaction_checkpoints_transaction_id 
        ON audit.transaction_checkpoints(transaction_id)
      `);
      
      // Create index on created_at for cleanup operations
      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_transaction_checkpoints_created_at 
        ON audit.transaction_checkpoints(created_at)
      `);
      
      logger.info('Database schemas and checkpoint tables verified');
    } catch (error) {
      logger.error('Failed to ensure database schemas:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();