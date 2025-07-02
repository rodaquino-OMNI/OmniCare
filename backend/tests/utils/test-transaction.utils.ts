/**
 * Test Transaction Management Utilities
 * Provides transaction-based test isolation for database tests
 */

import { PoolClient } from 'pg';

import { databaseService } from '@/services/database.service';

export interface TestTransactionContext {
  client: PoolClient;
  testId: string;
  savepoint: string;
}

class TestTransactionManager {
  private contexts: Map<string, TestTransactionContext> = new Map();
  private savepointCounter = 0;

  /**
   * Create a new transaction context for a test
   */
  async createContext(testName: string): Promise<TestTransactionContext> {
    const testId = `${testName}-${Date.now()}-${Math.random()}`;
    const savepoint = `sp_${this.savepointCounter++}`;
    
    // Get a client from the pool
    const client = await databaseService.getClient();
    
    // Begin transaction if not already in one
    await client.query('BEGIN');
    
    // Create savepoint for nested transaction support
    await client.query(`SAVEPOINT ${savepoint}`);
    
    const context: TestTransactionContext = {
      client,
      testId,
      savepoint,
    };
    
    this.contexts.set(testId, context);
    return context;
  }

  /**
   * Rollback to savepoint and release context
   */
  async rollbackContext(testId: string): Promise<void> {
    const context = this.contexts.get(testId);
    if (!context) {
      return;
    }

    try {
      // Rollback to savepoint
      await context.client.query(`ROLLBACK TO SAVEPOINT ${context.savepoint}`);
      
      // Rollback entire transaction
      await context.client.query('ROLLBACK');
    } finally {
      // Release the client back to pool
      context.client.release();
      this.contexts.delete(testId);
    }
  }

  /**
   * Get active context
   */
  getContext(testId: string): TestTransactionContext | undefined {
    return this.contexts.get(testId);
  }

  /**
   * Clean up all contexts
   */
  async cleanupAll(): Promise<void> {
    for (const [testId, context] of this.contexts.entries()) {
      try {
        await context.client.query('ROLLBACK');
        context.client.release();
      } catch (error) {
        console.error(`Failed to cleanup context ${testId}:`, error);
      }
    }
    this.contexts.clear();
  }
}

export const transactionManager = new TestTransactionManager();

/**
 * Decorator for wrapping test functions in transactions
 */
export function transactional() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = await transactionManager.createContext(propertyKey);
      
      try {
        // Inject the client into the test function
        const result = await originalMethod.apply(this, [...args, context.client]);
        return result;
      } finally {
        await transactionManager.rollbackContext(context.testId);
      }
    };

    return descriptor;
  };
}

/**
 * Jest test wrapper for transaction isolation
 */
export const withTestTransaction = <T extends jest.It>(testFn: T): T => {
  return (((name: string, fn: jest.TestFn, timeout?: number) => {
    testFn(name, async () => {
      const context = await transactionManager.createContext(name);
      
      try {
        // Make the client available globally for the test
        (global as any).testDbClient = context.client;
        
        // Run the test
        await fn();
      } finally {
        // Clean up
        delete (global as any).testDbClient;
        await transactionManager.rollbackContext(context.testId);
      }
    }, timeout);
  }) as unknown) as T;
};

/**
 * Create isolated test suite with transaction support
 */
export const describeWithTransaction = (
  name: string,
  fn: () => void
): void => {
  describe(name, () => {
    let suiteContext: TestTransactionContext;

    beforeAll(async () => {
      if (process.env.MOCK_DATABASE !== 'true') {
        suiteContext = await transactionManager.createContext(`suite-${name}`);
      }
    });

    afterAll(async () => {
      if (suiteContext) {
        await transactionManager.rollbackContext(suiteContext.testId);
      }
    });

    // Execute the test suite
    fn();
  });
};

/**
 * Helper to get current test database client
 */
export const getTestDbClient = (): PoolClient => {
  const client = (global as any).testDbClient;
  if (!client) {
    throw new Error('No test database client available. Use withTestTransaction wrapper.');
  }
  return client;
};

/**
 * Execute query in test context
 */
export const testQuery = async <T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> => {
  const client = getTestDbClient();
  const result = await client.query(sql, params);
  return result.rows;
};

/**
 * Create test data within transaction
 */
export const createTestData = async (
  table: string,
  data: Record<string, any>
): Promise<any> => {
  const client = getTestDbClient();
  
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await client.query(query, values);
  return result.rows[0];
};

/**
 * Verify data exists in test context
 */
export const verifyTestData = async (
  table: string,
  conditions: Record<string, any>
): Promise<boolean> => {
  const client = getTestDbClient();
  
  const whereClause = Object.keys(conditions)
    .map((key, i) => `${key} = $${i + 1}`)
    .join(' AND ');
  
  const query = `SELECT 1 FROM ${table} WHERE ${whereClause} LIMIT 1`;
  const result = await client.query(query, Object.values(conditions));
  
  return result.rows.length > 0;
};