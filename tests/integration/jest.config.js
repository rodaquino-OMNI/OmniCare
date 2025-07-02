/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Integration Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test matching and paths
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  
  // Setup files (correct path for integration tests)
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  
  // Test execution configuration
  maxWorkers: 1, // Run integration tests sequentially
  
  // Coverage configuration
  coverageDirectory: '<rootDir>/../../coverage/integration',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/',
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  
  // Module configuration
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../backend/src/$1',
    '^@frontend/(.*)$': '<rootDir>/../../frontend/src/$1',
  },
};