/**
 * Custom Test Sequencer for Backend Tests
 * Optimizes test execution order for better performance and reliability
 */

const Sequencer = require('@jest/test-sequencer').default;

class BackendTestSequencer extends Sequencer {
  /**
   * Sort tests to optimize execution order
   * Priority: unit -> integration -> e2e
   * Within each category: fastest -> slowest (based on file size)
   */
  sort(tests) {
    const testsByType = {
      unit: [],
      integration: [],
      e2e: [],
      other: []
    };

    // Categorize tests by type
    tests.forEach(test => {
      const testPath = test.path;
      
      if (testPath.includes('/unit/') || testPath.includes('.unit.test.')) {
        testsByType.unit.push(test);
      } else if (testPath.includes('/integration/') || testPath.includes('.integration.test.')) {
        testsByType.integration.push(test);
      } else if (testPath.includes('/e2e/') || testPath.includes('.e2e.test.')) {
        testsByType.e2e.push(test);
      } else {
        testsByType.other.push(test);
      }
    });

    // Sort each category by file size (smaller files typically run faster)
    Object.keys(testsByType).forEach(type => {
      testsByType[type].sort((a, b) => {
        try {
          const aSize = require('fs').statSync(a.path).size;
          const bSize = require('fs').statSync(b.path).size;
          return aSize - bSize;
        } catch (error) {
          // If we can't get file size, use alphabetical order
          return a.path.localeCompare(b.path);
        }
      });
    });

    // Special ordering for specific test files
    const priorityTests = [
      'database.test',
      'connection.test',
      'auth.test',
      'config.test'
    ];

    const deprioritizedTests = [
      'slow.test',
      'heavy.test',
      'external.test'
    ];

    // Apply priority ordering within categories
    Object.keys(testsByType).forEach(type => {
      testsByType[type] = this.applyPriorityOrdering(
        testsByType[type],
        priorityTests,
        deprioritizedTests
      );
    });

    // Return in execution order: unit -> other -> integration -> e2e
    return [
      ...testsByType.unit,
      ...testsByType.other,
      ...testsByType.integration,
      ...testsByType.e2e
    ];
  }

  /**
   * Apply priority ordering to a list of tests
   */
  applyPriorityOrdering(tests, priorityTests, deprioritizedTests) {
    const priority = [];
    const normal = [];
    const deprioritized = [];

    tests.forEach(test => {
      const testName = test.path.toLowerCase();
      
      if (priorityTests.some(p => testName.includes(p))) {
        priority.push(test);
      } else if (deprioritizedTests.some(d => testName.includes(d))) {
        deprioritized.push(test);
      } else {
        normal.push(test);
      }
    });

    return [...priority, ...normal, ...deprioritized];
  }

  /**
   * Determine if tests should run in parallel
   * Integration and e2e tests should run sequentially to avoid conflicts
   */
  allFailedTests(tests) {
    // Prioritize failed tests for faster feedback
    const failedFirst = tests.sort((a, b) => {
      if (a.failed && !b.failed) return -1;
      if (!a.failed && b.failed) return 1;
      return 0;
    });

    return this.sort(failedFirst);
  }
}

module.exports = BackendTestSequencer;