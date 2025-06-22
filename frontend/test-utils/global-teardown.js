/**
 * Global Test Teardown for Frontend
 * Runs once after all tests complete
 */

const { promises: fs } = require('fs');
const { join } = require('path');

module.exports = async function globalTeardown() {
  console.log('🧹 Starting frontend test environment cleanup...');

  try {
    // Cleanup test server
    await cleanupTestServer();

    // Cleanup test databases
    await cleanupTestDatabases();

    // Cleanup test files
    await cleanupTestFiles();

    // Cleanup mock services
    await cleanupMockServices();

    // Generate test summary
    await generateTestSummary();

    console.log('✅ Frontend test environment cleanup completed successfully');
  } catch (error) {
    console.error('❌ Failed to cleanup frontend test environment:', error);
    // Don't fail the process on cleanup errors
  }
};

async function cleanupTestServer() {
  try {
    console.log('🌐 Cleaning up test server...');

    const server = global.__TEST_SERVER__;
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
      console.log('✅ Test server stopped');
    } else {
      console.log('🌐 No test server to cleanup');
    }

    delete global.__TEST_SERVER__;
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test server:', error);
  }
}

async function cleanupTestDatabases() {
  try {
    console.log('💾 Cleaning up test databases...');

    // Clear IndexedDB databases
    const testDatabases = [
      'omnicare-patients',
      'omnicare-encounters',
      'omnicare-cache',
      'omnicare-sync'
    ];

    for (const dbName of testDatabases) {
      try {
        if (typeof indexedDB !== 'undefined') {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          
          await new Promise((resolve, reject) => {
            deleteRequest.onerror = () => reject(deleteRequest.error);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onblocked = () => {
              console.warn(`⚠️ Database '${dbName}' deletion blocked`);
              resolve();
            };
          });

          console.log(`🗑️ Deleted test database: ${dbName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to delete test database '${dbName}':`, error);
      }
    }

    // Clear browser storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      console.log('🗑️ Cleared localStorage');
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
      console.log('🗑️ Cleared sessionStorage');
    }

    // Clear IndexedDB reference
    delete global.indexedDB;
    delete global.IDBKeyRange;

    console.log('✅ Test databases cleanup completed');
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test databases:', error);
  }
}

async function cleanupTestFiles() {
  try {
    console.log('📁 Cleaning up test files...');

    const tempDirs = [
      join(process.cwd(), '.next', 'cache', 'test'),
      join(process.cwd(), 'public', 'uploads', 'test'),
      join(process.cwd(), 'tmp'),
    ];

    for (const dir of tempDirs) {
      try {
        const stats = await fs.stat(dir);
        if (stats.isDirectory()) {
          await fs.rmdir(dir, { recursive: true });
          console.log(`🗑️ Removed test directory: ${dir}`);
        }
      } catch (error) {
        // Directory doesn't exist, which is fine
      }
    }

    // Clean up test screenshots and artifacts
    const testArtifacts = [
      join(process.cwd(), 'test-results', 'screenshots'),
      join(process.cwd(), 'test-results', 'videos'),
      join(process.cwd(), 'coverage', '.tmp'),
    ];

    for (const artifactDir of testArtifacts) {
      try {
        const stats = await fs.stat(artifactDir);
        if (stats.isDirectory()) {
          await fs.rmdir(artifactDir, { recursive: true });
          console.log(`🗑️ Removed test artifacts: ${artifactDir}`);
        }
      } catch (error) {
        // Directory doesn't exist, which is fine
      }
    }

    console.log('✅ Test files cleanup completed');
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test files:', error);
  }
}

async function cleanupMockServices() {
  try {
    console.log('🎭 Cleaning up mock services...');

    // Reset mock configurations
    delete global.__MOCK_API_CONFIG__;
    delete global.__MOCK_FHIR_CONFIG__;
    delete global.__TEST_DATA__;

    // Clear any remaining test timers
    if (typeof jest !== 'undefined') {
      jest.clearAllTimers();
      jest.restoreAllMocks();
    }

    // Reset any modified globals
    if (global.fetch && global.fetch.mockClear) {
      global.fetch.mockClear();
    }

    console.log('✅ Mock services cleanup completed');
  } catch (error) {
    console.warn('⚠️ Failed to cleanup mock services:', error);
  }
}

async function generateTestSummary() {
  try {
    console.log('📊 Generating test summary...');

    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      testType: process.env.TEST_TYPE || 'unit',
      browser: process.env.TEST_BROWSER || 'jsdom',
      testResults: {
        total: process.env.JEST_TOTAL_TESTS || 'unknown',
        passed: process.env.JEST_PASSED_TESTS || 'unknown',
        failed: process.env.JEST_FAILED_TESTS || 'unknown',
        skipped: process.env.JEST_SKIPPED_TESTS || 'unknown',
      },
      coverage: {
        statements: process.env.JEST_COVERAGE_STATEMENTS || 'unknown',
        branches: process.env.JEST_COVERAGE_BRANCHES || 'unknown',
        functions: process.env.JEST_COVERAGE_FUNCTIONS || 'unknown',
        lines: process.env.JEST_COVERAGE_LINES || 'unknown',
      },
      performance: {
        totalTime: process.env.JEST_TOTAL_TIME || 'unknown',
        averageTime: process.env.JEST_AVERAGE_TIME || 'unknown',
        slowestTest: process.env.JEST_SLOWEST_TEST || 'unknown',
      },
      resources: {
        testServer: global.__TEST_SERVER__ ? 'stopped' : 'not_used',
        indexedDB: 'cleaned',
        localStorage: 'cleaned',
        sessionStorage: 'cleaned',
        mockServices: 'reset',
      },
      features: {
        serviceWorker: process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === 'true',
        offlineMode: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE === 'true',
        mockExternalServices: process.env.NEXT_PUBLIC_MOCK_EXTERNAL_SERVICES === 'true',
      },
    };

    // Ensure test-results directory exists
    const resultsDir = join(process.cwd(), 'test-results');
    try {
      await fs.mkdir(resultsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Write summary to file
    const summaryPath = join(resultsDir, 'frontend-test-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`✅ Test summary generated: ${summaryPath}`);

    // Also generate a human-readable report
    const reportPath = join(resultsDir, 'frontend-test-report.txt');
    const report = generateHumanReadableReport(summary);
    await fs.writeFile(reportPath, report);

    console.log(`📋 Test report generated: ${reportPath}`);
  } catch (error) {
    console.warn('⚠️ Failed to generate test summary:', error);
  }
}

function generateHumanReadableReport(summary) {
  return `
Frontend Test Report
===================

Test Execution Summary
---------------------
Timestamp: ${summary.timestamp}
Environment: ${summary.environment}
Test Type: ${summary.testType}
Browser: ${summary.browser}

Test Results
-----------
Total Tests: ${summary.testResults.total}
Passed: ${summary.testResults.passed}
Failed: ${summary.testResults.failed}
Skipped: ${summary.testResults.skipped}

Coverage Report
--------------
Statements: ${summary.coverage.statements}%
Branches: ${summary.coverage.branches}%
Functions: ${summary.coverage.functions}%
Lines: ${summary.coverage.lines}%

Performance Metrics
------------------
Total Time: ${summary.performance.totalTime}
Average Time: ${summary.performance.averageTime}
Slowest Test: ${summary.performance.slowestTest}

Resource Cleanup
---------------
Test Server: ${summary.resources.testServer}
IndexedDB: ${summary.resources.indexedDB}
Local Storage: ${summary.resources.localStorage}
Session Storage: ${summary.resources.sessionStorage}
Mock Services: ${summary.resources.mockServices}

Feature Flags
------------
Service Worker: ${summary.features.serviceWorker ? 'Enabled' : 'Disabled'}
Offline Mode: ${summary.features.offlineMode ? 'Enabled' : 'Disabled'}
Mock External Services: ${summary.features.mockExternalServices ? 'Enabled' : 'Disabled'}

Generated: ${new Date().toISOString()}
`;
}

// Handle any remaining cleanup on process exit
process.on('exit', () => {
  console.log('👋 Frontend test process exiting...');
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception during frontend test cleanup:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled rejection during frontend test cleanup:', reason);
  process.exit(1);
});