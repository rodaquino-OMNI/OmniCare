/** @type {import('jest').Config} */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  displayName: 'Frontend',
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  setupFiles: ['<rootDir>/test-utils/env.setup.js'],
  
  // Test matching and paths
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
    '<rootDir>/test-utils/',
    '<rootDir>/src/.*\\.stories\\.(tsx|ts|js|jsx)',
  ],
  
  // Coverage configuration
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
    '!src/**/generators/**',
    '!src/**/*-generator.{ts,tsx,js,jsx}',
    '!src/**/*.mock.{ts,tsx,js,jsx}',
    '!src/**/fixtures/**',
    '!src/**/test-utils/**',
  ],
  
  // Module configuration
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test-utils/(.*)$': '<rootDir>/test-utils/$1',
    '^@fixtures/(.*)$': '<rootDir>/test-utils/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/__mocks__/$1',
    // Mock static assets
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/test-utils/file-mock.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // Transform configuration
  transformIgnorePatterns: [
    'node_modules/(?!(@mantine|@testing-library|@medplum|@tanstack|@tabler|zustand|react-router-dom)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  
  // Test execution configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);