/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
  coverageReporters: ['text', 'lcov', 'html', 'json', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Individual file thresholds for critical modules
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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  testTimeout: 15000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true,
  silent: false,
  bail: false,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: process.env.CI ? 2 : '50%',
  workerIdleMemoryLimit: '512MB',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { 
      useESM: false,
      isolatedModules: true,
      tsconfig: {
        baseUrl: './src',
        paths: {
          '@/*': ['*'],
        },
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true
      }
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
  },
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  // Enhanced error reporting
  errorOnDeprecated: true,
  // Memory management
  logHeapUsage: true,
  // Test execution optimization
  passWithNoTests: true,
  // Watch mode optimization
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '\\\\.git'
  ],
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'backend-junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: 'true'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Backend Test Report',
      outputPath: './test-results/backend-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      theme: 'darkTheme'
    }]
  ],
};