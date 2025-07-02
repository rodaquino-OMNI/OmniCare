/**
 * Shared Jest Configuration
 * Centralizes common test settings to prevent configuration drift
 * and ensure consistent behavior across all test suites
 */

const os = require('os');

/**
 * Calculate optimal worker count based on system resources
 * Prevents worker crashes by limiting parallel execution
 */
const getOptimalWorkerCount = () => {
  const cpuCount = os.cpus().length;
  const isCI = process.env.CI === 'true';
  
  if (isCI) {
    // Conservative settings for CI environments
    return 2;
  }
  
  // Leave at least one CPU free for system operations
  return Math.min(4, Math.max(1, cpuCount - 1));
};

/**
 * Memory limits based on environment
 * Prevents Jest workers from consuming too much memory
 */
const getMemoryLimit = () => {
  const isCI = process.env.CI === 'true';
  const totalMemory = os.totalmem();
  const availableMemory = os.freemem();
  
  if (isCI) {
    return '768MB';
  }
  
  // Use 1GB for development, but cap at 25% of available memory
  const maxMemory = Math.min(1024 * 1024 * 1024, availableMemory * 0.25);
  return `${Math.floor(maxMemory / (1024 * 1024))}MB`;
};

/**
 * Test timeouts by category
 * Prevents timeout failures for different test types
 */
const testTimeouts = {
  unit: 10000,        // 10 seconds
  integration: 30000, // 30 seconds
  e2e: 60000,        // 60 seconds
  performance: 120000 // 2 minutes
};

/**
 * Common test patterns to ignore
 */
const commonIgnorePatterns = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '\\.d\\.ts$',
  'fixtures',
  'mocks',
  '__mocks__',
  'test-utils',
  'setup\\.ts$',
  'setup\\.js$',
  'global-setup',
  'global-teardown',
];

/**
 * Coverage thresholds by project type
 */
const coverageThresholds = {
  backend: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    critical: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    }
  },
  frontend: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    critical: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    }
  },
  integration: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    }
  }
};

/**
 * Base Jest configuration
 * These settings should be applied to all Jest projects
 */
const baseConfig = {
  // Test execution settings
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Worker and memory management
  maxWorkers: getOptimalWorkerCount(),
  workerIdleMemoryLimit: getMemoryLimit(),
  
  // Prevent worker crashes
  detectOpenHandles: false,
  forceExit: false,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Logging
  verbose: process.env.VERBOSE_TESTS === 'true' || !process.env.CI,
  silent: process.env.SILENT_TESTS === 'true',
  
  // Memory debugging
  logHeapUsage: process.env.LOG_HEAP === 'true' || (!process.env.CI && process.env.NODE_ENV !== 'production'),
};

/**
 * Reporter configuration factory
 */
const createReporters = (projectName) => {
  const reporters = ['default'];
  
  if (process.env.CI || process.env.GENERATE_REPORTS === 'true') {
    reporters.push([
      'jest-junit',
      {
        outputDirectory: `<rootDir>/test-results/${projectName}`,
        outputName: 'junit.xml',
        suiteName: `${projectName} Tests`,
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: 'true'
      }
    ]);
    
    reporters.push([
      'jest-html-reporter',
      {
        pageTitle: `${projectName} Test Report`,
        outputPath: `<rootDir>/test-results/${projectName}/report.html`,
        includeFailureMsg: true,
        includeConsoleLog: true,
        theme: 'darkTheme'
      }
    ]);
  }
  
  return reporters;
};

/**
 * Environment-specific configurations
 */
const getEnvironmentConfig = () => {
  const isCI = process.env.CI === 'true';
  const testCategory = process.env.TEST_CATEGORY || 'unit';
  
  return {
    testTimeout: testTimeouts[testCategory] || testTimeouts.unit,
    bail: isCI ? 1 : false, // Stop on first failure in CI
    passWithNoTests: !isCI, // Allow empty test suites in development
  };
};

module.exports = {
  // Exported functions
  getOptimalWorkerCount,
  getMemoryLimit,
  
  // Exported constants
  testTimeouts,
  commonIgnorePatterns,
  coverageThresholds,
  
  // Configuration factories
  baseConfig,
  createReporters,
  getEnvironmentConfig,
  
  // Helper to merge configurations
  mergeConfig: (...configs) => {
    return configs.reduce((merged, config) => ({
      ...merged,
      ...config,
      // Special handling for arrays
      testPathIgnorePatterns: [
        ...(merged.testPathIgnorePatterns || []),
        ...(config.testPathIgnorePatterns || [])
      ],
      setupFilesAfterEnv: [
        ...(merged.setupFilesAfterEnv || []),
        ...(config.setupFilesAfterEnv || [])
      ],
      setupFiles: [
        ...(merged.setupFiles || []),
        ...(config.setupFiles || [])
      ],
      reporters: config.reporters || merged.reporters,
    }), {});
  }
};