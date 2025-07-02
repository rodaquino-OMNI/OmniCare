/**
 * Database-specific test setup
 * This file configures database connections and utilities for tests
 */

import { jest } from '@jest/globals';

import { setupTestDatabase, teardownTestDatabase, testDatabase } from './utils/test-database.utils';

import { databaseService } from '@/services/database.service';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      pass,
      message: () => pass 
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`,
    };
  },
  
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be within range ${floor} - ${ceiling}`
        : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// Global test lifecycle hooks for database tests
beforeAll(async () => {
  // Set longer timeout for database setup
  jest.setTimeout(30000);
  
  // Initialize test database if not mocked
  if (process.env.MOCK_DATABASE !== 'true') {
    try {
      await setupTestDatabase();
      
      // Initialize the main database service for integration tests
      await databaseService.initialize();
      await databaseService.ensureAuditSchema();
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }
});

afterAll(async () => {
  // Cleanup test database
  if (process.env.MOCK_DATABASE !== 'true') {
    try {
      await teardownTestDatabase();
      await databaseService.shutdown();
    } catch (error) {
      console.error('Failed to teardown test database:', error);
    }
  }
});

// Reset database state between test suites
beforeEach(async () => {
  if (process.env.MOCK_DATABASE !== 'true' && process.env.RESET_DB_BETWEEN_TESTS === 'true') {
    await testDatabase.reset();
  }
});

// Clean up after each test
afterEach(async () => {
  if (process.env.MOCK_DATABASE !== 'true') {
    await testDatabase.executeCleanupHandlers();
  }
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Export test database utilities for use in tests
export { testDatabase, withTransaction, withCleanup } from './utils/test-database.utils';

// Helper to switch between mocked and real database for specific tests
export const useRealDatabase = () => {
  const originalMockValue = process.env.MOCK_DATABASE;
  
  beforeAll(() => {
    process.env.MOCK_DATABASE = 'false';
  });
  
  afterAll(() => {
    process.env.MOCK_DATABASE = originalMockValue;
  });
};

// Helper to ensure mocked database for specific tests
export const useMockedDatabase = () => {
  const originalMockValue = process.env.MOCK_DATABASE;
  
  beforeAll(() => {
    process.env.MOCK_DATABASE = 'true';
  });
  
  afterAll(() => {
    process.env.MOCK_DATABASE = originalMockValue;
  });
};