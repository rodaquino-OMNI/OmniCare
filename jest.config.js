/** @type {import('jest').Config} */
module.exports = {
  // Projects configuration - each project handles its own settings
  projects: [
    '<rootDir>/backend/jest.config.js',
    '<rootDir>/frontend/jest.config.js',
    '<rootDir>/tests/integration/jest.config.js'
  ],
  // Global configuration to avoid haste module naming collisions
  watchPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ]
};