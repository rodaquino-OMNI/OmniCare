/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'backend',
      testMatch: ['<rootDir>/backend/tests/**/*.+(ts|tsx|js)'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/backend/src', '<rootDir>/backend/tests'],
      setupFilesAfterEnv: ['<rootDir>/backend/tests/setup.ts'],
      collectCoverageFrom: [
        '<rootDir>/backend/src/**/*.{ts,tsx}',
        '!<rootDir>/backend/src/**/*.d.ts',
        '!<rootDir>/backend/src/**/index.ts',
        '!<rootDir>/backend/src/**/*.types.ts',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { 
          useESM: false,
          tsconfig: '<rootDir>/backend/tsconfig.json'
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/backend/src/$1',
      },
    },
    {
      displayName: 'frontend',
      testMatch: ['<rootDir>/frontend/src/**/*.+(test|spec).+(ts|tsx|js)'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/frontend/jest.setup.js'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          useESM: false,
          tsconfig: {
            jsx: 'react-jsx',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            moduleResolution: 'node',
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'es6'],
            skipLibCheck: true,
            strict: false,
            forceConsistentCasingInFileNames: true,
            noEmit: true,
            isolatedModules: true,
            resolveJsonModule: true,
          }
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/frontend/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(@mantine|@testing-library))',
      ],
    }
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true,
  bail: false,
  maxWorkers: '50%',
};