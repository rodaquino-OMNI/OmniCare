/**
 * IndexedDB Test Utilities
 * Provides consistent IndexedDB setup and cleanup for tests
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
// Import types only - the actual implementation comes from fake-indexeddb/auto
// @ts-ignore - fake-indexeddb doesn't have proper type exports for these paths

// Track all open databases for cleanup
const openDatabases = new Set<IDBDatabase>();
const databaseNames = new Set<string>();

/**
 * Initialize IndexedDB test environment
 */
export function setupIndexedDB(): void {
  // Ensure fake-indexeddb is properly initialized
  if (typeof indexedDB === 'undefined') {
    (global as any).indexedDB = new IDBFactory();
  }
  
  // IDBKeyRange should be automatically available from fake-indexeddb/auto
  
  // Track database creation for cleanup
  const originalOpen = indexedDB.open.bind(indexedDB);
  (indexedDB as any).open = function(name: string, version?: number) {
    databaseNames.add(name);
    const request = originalOpen(name, version);
    
    request.onsuccess = function(event: any) {
      const db = (event.target as IDBOpenDBRequest).result;
      openDatabases.add(db);
      
      // Track when database is closed
      const originalClose = db.close.bind(db);
      db.close = function() {
        openDatabases.delete(db);
        originalClose();
      };
    };
    
    return request;
  };
}

/**
 * Clean up all IndexedDB resources
 */
export async function cleanupIndexedDB(): Promise<void> {
  // Close all open databases
  for (const db of openDatabases) {
    try {
      db.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  openDatabases.clear();
  
  // Delete all databases
  const deletePromises: Promise<void>[] = [];
  
  for (const name of databaseNames) {
    deletePromises.push(
      new Promise<void>((resolve) => {
        const deleteReq = indexedDB.deleteDatabase(name);
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => resolve(); // Don't fail on errors
        deleteReq.onblocked = () => resolve(); // Don't wait if blocked
      })
    );
  }
  
  await Promise.all(deletePromises);
  databaseNames.clear();
  
  // Reset IndexedDB if possible
  if ((indexedDB as any).reset) {
    (indexedDB as any).reset();
  }
}

/**
 * Wait for all IndexedDB operations to complete
 */
export async function waitForIndexedDB(): Promise<void> {
  // Give time for any pending operations
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Create a test database with schema
 */
export async function createTestDatabase(
  name: string,
  version: number,
  schema: (db: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      schema(db);
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onerror = () => {
      reject(new Error(`Failed to create test database: ${request.error}`));
    };
  });
}

/**
 * Jest lifecycle hooks for IndexedDB
 */
export function setupIndexedDBHooks(): void {
  beforeAll(() => {
    setupIndexedDB();
  });
  
  afterEach(async () => {
    await cleanupIndexedDB();
  });
  
  afterAll(async () => {
    await cleanupIndexedDB();
  });
}

/**
 * Mock IndexedDB error scenarios
 */
export function mockIndexedDBError(operation: 'open' | 'delete' | 'transaction'): void {
  switch (operation) {
    case 'open':
      jest.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new Error('Failed to open database');
      });
      break;
    case 'delete':
      jest.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
        throw new Error('Failed to delete database');
      });
      break;
    case 'transaction':
      // This would need to be mocked on the database instance
      break;
  }
}

/**
 * Restore IndexedDB mocks
 */
export function restoreIndexedDBMocks(): void {
  jest.restoreAllMocks();
}