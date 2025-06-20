import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown for E2E tests...');
  
  try {
    // Clean up test data, close connections, etc.
    await cleanupTestEnvironment();
    
    console.log('Global teardown completed successfully');
  } catch (error) {
    console.error('Global teardown failed:', error);
    // Don't throw here to avoid masking test failures
  }
}

async function cleanupTestEnvironment() {
  // Cleanup test data, reset database state, etc.
  // This could include:
  // - Removing test users
  // - Cleaning up test data from the database
  // - Closing persistent connections
  
  try {
    console.log('Cleaning up test environment...');
    
    // Example cleanup operations:
    // - Clear test data from database
    // - Reset authentication state
    // - Clean up uploaded files
    
    console.log('Test environment cleanup completed');
  } catch (error) {
    console.error('Test environment cleanup failed:', error);
    throw error;
  }
}

export default globalTeardown;