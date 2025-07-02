/**
 * Global test teardown for backend integration tests
 * Cleans up test resources and connections after all tests complete
 */

// Register tsconfig paths before any other imports
import { readFileSync } from 'fs';
import { join } from 'path';

import { register } from 'tsconfig-paths';

// Load tsconfig.test.json and register paths 
const tsconfigPath = join(__dirname, '..', 'tsconfig.test.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
register({
  baseUrl: join(__dirname, '..'),
  paths: tsconfig.compilerOptions.paths,
});

import { databaseService } from '@/services/database.service';

export default async function globalTeardown(): Promise<void> {
  try {
    // Only shutdown database if it was initialized for integration tests
    if (process.env.MOCK_DATABASE !== 'true' && databaseService) {
      await databaseService.shutdown();
    }
  } catch (error) {
    // Don't throw - we want teardown to always complete
  }
}