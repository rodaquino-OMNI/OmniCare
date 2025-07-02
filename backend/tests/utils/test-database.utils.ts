import { Pool, PoolClient } from 'pg';

import logger from '@/utils/logger';

export interface TestDatabaseUtils {
  pool: Pool | null;
  cleanupHandlers: (() => Promise<void>)[];
}

class TestDatabaseManager {
  private pool: Pool | null = null;
  private transactionClients: Map<string, PoolClient> = new Map();
  private cleanupHandlers: (() => Promise<void>)[] = [];
  private isInitialized = false;

  /**
   * Initialize test database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || process.env.MOCK_DATABASE === 'true') {
      return;
    }

    try {
      // Use test-specific connection configuration
      const testDatabaseUrl = process.env.DATABASE_URL || 
        'postgresql://omnicare:omnicare123@localhost:5433/omnicare_test';

      this.pool = new Pool({
        connectionString: testDatabaseUrl,
        max: 5, // Smaller pool for tests
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      });

      // Test the connection
      await this.pool.query('SELECT 1');

      // Set up error handlers
      this.pool.on('error', (err) => {
        logger.error('Test database pool error:', err);
      });

      this.isInitialized = true;
      logger.info('Test database initialized');
    } catch (error) {
      logger.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  /**
   * Get database pool
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Test database not initialized');
    }
    return this.pool;
  }

  /**
   * Begin a transaction for a test
   */
  async beginTransaction(testId: string): Promise<PoolClient> {
    const pool = this.getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      this.transactionClients.set(testId, client);
      return client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  /**
   * Rollback transaction after test
   */
  async rollbackTransaction(testId: string): Promise<void> {
    const client = this.transactionClients.get(testId);
    if (!client) {
      return;
    }

    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
      this.transactionClients.delete(testId);
    }
  }

  /**
   * Clean up all test data
   */
  async cleanupAllTestData(): Promise<void> {
    if (!this.pool || process.env.MOCK_DATABASE === 'true') {
      return;
    }

    const client = await this.pool.connect();
    try {
      // Clean up in reverse order of foreign key dependencies
      const cleanupQueries = [
        'DELETE FROM audit.security_logs',
        'DELETE FROM audit.transaction_checkpoints',
        'DELETE FROM sessions',
        'DELETE FROM users WHERE email LIKE \'%@test.com\'',
        'DELETE FROM oauth_clients WHERE client_id LIKE \'test-%\'',
      ];

      for (const query of cleanupQueries) {
        await client.query(query);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Create test user
   */
  async createTestUser(userData: {
    username?: string;
    email?: string;
    role?: string;
  } = {}): Promise<any> {
    const pool = this.getPool();
    
    const defaultData = {
      username: `test-user-${Date.now()}@test.com`,
      email: `test-user-${Date.now()}@test.com`,
      password_hash: '$2b$10$TestHashedPassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'PROVIDER',
      ...userData,
    };

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [defaultData.username, defaultData.email, defaultData.password_hash, 
       defaultData.first_name, defaultData.last_name, defaultData.role]
    );

    return result.rows[0];
  }

  /**
   * Create test session
   */
  async createTestSession(userId: string): Promise<any> {
    const pool = this.getPool();
    
    const result = await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, 'test-token-hash', new Date(Date.now() + 3600000), '127.0.0.1', 'Test Agent']
    );

    return result.rows[0];
  }

  /**
   * Seed test database with initial data
   */
  async seedTestData(): Promise<void> {
    if (process.env.MOCK_DATABASE === 'true') {
      return;
    }

    const pool = this.getPool();
    
    // Check if data already exists
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      return; // Data already seeded
    }

    // Create test users
    await this.createTestUser({
      username: 'admin@omnicare.com',
      email: 'admin@omnicare.com',
      role: 'SYSTEM_ADMINISTRATOR',
    });

    await this.createTestUser({
      username: 'doctor@omnicare.com',
      email: 'doctor@omnicare.com',
      role: 'PHYSICIAN',
    });

    await this.createTestUser({
      username: 'nurse@omnicare.com',
      email: 'nurse@omnicare.com',
      role: 'NURSE',
    });

    logger.info('Test data seeded successfully');
  }

  /**
   * Add cleanup handler to be executed after tests
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Execute all cleanup handlers
   */
  async executeCleanupHandlers(): Promise<void> {
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        logger.error('Cleanup handler error:', error);
      }
    }
    this.cleanupHandlers = [];
  }

  /**
   * Shutdown test database
   */
  async shutdown(): Promise<void> {
    // Rollback any remaining transactions
    for (const [testId, client] of this.transactionClients.entries()) {
      try {
        await client.query('ROLLBACK');
        client.release();
      } catch (error) {
        logger.error(`Failed to rollback transaction ${testId}:`, error);
      }
    }
    this.transactionClients.clear();

    // Execute cleanup handlers
    await this.executeCleanupHandlers();

    // Close pool
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isInitialized = false;
    }
  }

  /**
   * Reset database state between tests
   */
  async reset(): Promise<void> {
    await this.cleanupAllTestData();
    await this.seedTestData();
  }

  /**
   * Wait for database to be ready
   */
  async waitForDatabase(maxRetries = 30, retryDelay = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.initialize();
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

// Export singleton instance
export const testDatabase = new TestDatabaseManager();

// Test helper functions
export const withTransaction = async <T>(
  testFn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const testId = `test-${Date.now()}-${Math.random()}`;
  const client = await testDatabase.beginTransaction(testId);
  
  try {
    return await testFn(client);
  } finally {
    await testDatabase.rollbackTransaction(testId);
  }
};

export const withCleanup = async <T>(
  testFn: () => Promise<T>,
  cleanupFn: () => Promise<void>
): Promise<T> => {
  testDatabase.addCleanupHandler(cleanupFn);
  return testFn();
};

// Jest lifecycle hooks
export const setupTestDatabase = async (): Promise<void> => {
  if (process.env.MOCK_DATABASE !== 'true') {
    await testDatabase.waitForDatabase();
    await testDatabase.seedTestData();
  }
};

export const teardownTestDatabase = async (): Promise<void> => {
  await testDatabase.shutdown();
};

// Test data factories
export const testDataFactory = {
  user: (overrides = {}) => ({
    username: `test-${Date.now()}@test.com`,
    email: `test-${Date.now()}@test.com`,
    password_hash: '$2b$10$TestHashedPassword',
    first_name: 'Test',
    last_name: 'User',
    role: 'PROVIDER',
    ...overrides,
  }),
  
  session: (userId: string, overrides = {}) => ({
    user_id: userId,
    token_hash: `test-token-${Date.now()}`,
    expires_at: new Date(Date.now() + 3600000),
    ip_address: '127.0.0.1',
    user_agent: 'Test Agent',
    ...overrides,
  }),
  
  auditLog: (overrides = {}) => ({
    event_type: 'test_event',
    user_id: null,
    ip_address: '127.0.0.1',
    user_agent: 'Test Agent',
    details: {},
    ...overrides,
  }),
};