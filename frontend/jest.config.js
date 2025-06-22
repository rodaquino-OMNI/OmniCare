/** @type {import('jest').Config} */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  setupFiles: ['<rootDir>/test-utils/env.setup.js'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json'
    }
  },
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
    '!src/**/*.types.{ts,tsx}',
    '!src/**/*.interface.{ts,tsx}',
    '!src/app/**/layout.{tsx,jsx}',
    '!src/app/**/loading.{tsx,jsx}',
    '!src/app/**/not-found.{tsx,jsx}',
    '!src/app/**/error.{tsx,jsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    // Component-specific thresholds
    './src/components/**/*.{tsx,jsx}': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/stores/**/*.{ts,tsx}': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/**/*.{ts,tsx}': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/', 
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/tests/e2e/global-setup.ts',
    '<rootDir>/tests/e2e/global-teardown.ts',
    '<rootDir>/test-utils/global-setup.js',
    '<rootDir>/test-utils/global-teardown.js',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@test-utils/(.*)$': '<rootDir>/test-utils/$1',
    '^@fixtures/(.*)$': '<rootDir>/test-utils/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/__mocks__/$1',
    // Mock static assets
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/test-utils/file-mock.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { 
      presets: [
        ['next/babel', { 
          'preset-typescript': { 
            allowDeclareFields: true,
            allowNamespaces: true,
            allowConstEnumeration: true
          }
        }]
      ]
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@mantine|@testing-library|@medplum|@tanstack|@tabler|zustand)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true,
  silent: false,
  bail: false,
  maxWorkers: process.env.CI ? 2 : '50%',
  workerIdleMemoryLimit: '512MB',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 15000,
  // Enhanced error reporting
  errorOnDeprecated: true,
  // Memory management
  logHeapUsage: process.env.NODE_ENV !== 'production',
  // Test execution optimization
  passWithNoTests: true,
  detectOpenHandles: true,
  // Global setup and teardown
  globalSetup: '<rootDir>/test-utils/global-setup.js',
  globalTeardown: '<rootDir>/test-utils/global-teardown.js',
  // Watch mode optimization
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/.next/',
    '/dist/',
    '\\.git'
  ],
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'frontend-junit.xml',
      suiteName: 'Frontend Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Frontend Test Report',
      outputPath: './test-results/frontend-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      theme: 'darkTheme'
    }]
  ],
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
    customExportConditions: [''],
  },
  // Additional setup
  fakeTimers: {
    enableGlobally: false,
  },
  // Snapshot testing
  // Removed enzyme-to-json as we're using React Testing Library
  // Custom matchers
  testResultsProcessor: '<rootDir>/test-utils/test-results-processor.js',
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);