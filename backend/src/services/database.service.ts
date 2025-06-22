/**
 * OmniCare EMR Backend - Database Connection Service
 * Manages PostgreSQL connection pool and database operations
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
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
    try {
      this.pool = new Pool({
        connectionString: config.database.url,
        max: config.database.connectionPoolSize,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        // SSL configuration for production
        ssl: config.server.env === 'production' ? { rejectUnauthorized: false } : false,
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
   * Execute a query with the connection pool
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
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

      // Log slow queries
      if (duration > 1000) {
        logger.warn('Slow database query detected', {
          query: text,
          duration,
          rows: result.rowCount,
        });
      } else {
        logger.debug('Database query executed', {
          query: text.substring(0, 100),
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
   * Check database health
   */
  async checkHealth(): Promise<DatabaseHealth> {
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

      const poolStats = this.pool as any;
      
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
   * Get pool statistics
   */
  getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0 };
    }

    const poolStats = this.pool as any;
    
    return {
      total: poolStats.totalCount || 0,
      idle: poolStats.idleCount || 0,
      waiting: poolStats.waitingCount || 0,
    };
  }

  /**
   * Shutdown database connection pool
   */
  async shutdown(): Promise<void> {
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
    try {
      // Create audit schema if it doesn't exist
      await this.query('CREATE SCHEMA IF NOT EXISTS audit');
      
      // Create admin schema if it doesn't exist
      await this.query('CREATE SCHEMA IF NOT EXISTS admin');
      
      // Ensure UUID extension is enabled
      await this.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      logger.info('Database schemas verified');
    } catch (error) {
      logger.error('Failed to ensure database schemas:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();