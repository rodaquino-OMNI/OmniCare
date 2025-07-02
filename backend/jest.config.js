/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Backend',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Performance optimizations
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  maxWorkers: process.env.CI ? '75%' : '50%',
  workerIdleMemoryLimit: '512MB',
  
  // Test matching and paths
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    '.*\\.d\\.ts$',
    'tests/global-setup\\.ts',
    'tests/global-teardown\\.ts', 
    'tests/setup\\.ts',
    'tests/env\\.setup\\.ts',
    'tests/fixtures',
    'tests/.*generators',
    'tests/.*generator\\.(ts|js)',
    'tests/.*\\.(mock|base|runner|factory)\\.ts',
    'tests/performance/framework',
    'tests/performance/.*/.*-tests\\.ts'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.types.ts',
    '!src/**/*.interface.ts',
    '!src/**/migrations/**',
    '!src/**/seeds/**',
    '!src/**/fixtures/**',
    '!src/**/generators/**',
    '!src/**/*-generator.ts'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/controllers/**/*.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  
  // Transform configuration - optimized
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        skipLibCheck: true,
        incremental: true,
        isolatedModules: true,
      },
    }],
  },
  
  // Compiler optimizations
  extensionsToTreatAsEsm: [],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // Module configuration
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
  },
  
  // Test execution configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Performance improvements
  detectOpenHandles: false,
  // forceExit: false,
  // bail: process.env.CI ? 3 : 0,
  
  // Parallel execution optimization
  // runInBand: process.env.TEST_SERIAL === 'true',
  
  // Test environment options
  testTimeout: process.env.TEST_CATEGORY === 'integration' ? 30000 : 15000,
  
  // Reporters for CI optimization
  // reporters: process.env.CI 
  //   ? [['github-actions', { silent: false }], 'summary']
  //   : ['default'],
  
  // Watch mode optimizations
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname',
  // ],
  
  // Memory management
  // logHeapUsage: process.env.CI,
};