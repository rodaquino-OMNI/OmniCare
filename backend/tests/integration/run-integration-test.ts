#!/usr/bin/env node

/**
 * Simple integration test runner to bypass complex Jest setup issues
 */

import { join } from 'path';

import { config } from 'dotenv';

// Load test environment variables
config({ path: join(__dirname, '..', '..', '.env.test') });

// Set NODE_ENV before loading any modules
process.env.NODE_ENV = 'test';

// Use ts-node to run tests directly
import tsNode from 'ts-node';

tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2022',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    baseUrl: '.',
    paths: {
      '@/*': ['src/*'],
      '@/config': ['src/config/index.ts'],
      '@/config/*': ['src/config/*'],
      '@/utils/*': ['src/utils/*'],
      '@/services/*': ['src/services/*'],
      '@/controllers/*': ['src/controllers/*'],
      '@/middleware/*': ['src/middleware/*'],
      '@/models/*': ['src/models/*'],
      '@/auth/*': ['src/auth/*'],
      '@/types/*': ['src/types/*'],
    },
  },
});

// Now run the test
import logger from '../../src/utils/logger';
logger.info('Running integration tests...');

// Import and run test setup
import('./setup-integration')
  .then(({ setupTestDatabase, insertTestData }) => {
    return setupTestDatabase().then(() => insertTestData());
  })
  .then(() => {
    logger.info('Test database setup complete');
    // Run the actual tests
    return import('./auth.controller.integration.test');
  })
  .catch(error => {
    console.error('Integration test failed:', error);
    process.exit(1);
  });