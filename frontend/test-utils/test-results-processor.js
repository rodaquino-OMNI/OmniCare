/**
 * Custom Test Results Processor
 * Enhances Jest test results with additional metadata and formatting
 */

module.exports = function(testResults) {
  // Add custom metadata to test results
  const enhancedResults = {
    ...testResults,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    testType: process.env.TEST_TYPE || 'unit',
    browser: process.env.TEST_BROWSER || 'jsdom',
    
    // Calculate additional metrics
    metrics: {
      totalTime: testResults.testResults.reduce((acc, result) => 
        acc + (result.perfStats?.end - result.perfStats?.start || 0), 0),
      averageTime: testResults.testResults.length > 0 
        ? testResults.testResults.reduce((acc, result) => 
            acc + (result.perfStats?.end - result.perfStats?.start || 0), 0) / testResults.testResults.length
        : 0,
      slowestTest: testResults.testResults.reduce((slowest, result) => {
        const duration = result.perfStats?.end - result.perfStats?.start || 0;
        return duration > (slowest.duration || 0) 
          ? { name: result.testFilePath, duration }
          : slowest;
      }, {}),
      fastestTest: testResults.testResults.reduce((fastest, result) => {
        const duration = result.perfStats?.end - result.perfStats?.start || 0;
        return duration < (fastest.duration || Infinity)
          ? { name: result.testFilePath, duration }
          : fastest;
      }, {}),
    },

    // Categorize test results
    categories: {
      unit: testResults.testResults.filter(r => 
        r.testFilePath.includes('/unit/') || r.testFilePath.includes('.unit.test.')
      ).length,
      integration: testResults.testResults.filter(r => 
        r.testFilePath.includes('/integration/') || r.testFilePath.includes('.integration.test.')
      ).length,
      e2e: testResults.testResults.filter(r => 
        r.testFilePath.includes('/e2e/') || r.testFilePath.includes('.e2e.test.')
      ).length,
      component: testResults.testResults.filter(r => 
        r.testFilePath.includes('/components/') && r.testFilePath.includes('.test.')
      ).length,
      hook: testResults.testResults.filter(r => 
        r.testFilePath.includes('/hooks/') && r.testFilePath.includes('.test.')
      ).length,
      service: testResults.testResults.filter(r => 
        r.testFilePath.includes('/services/') && r.testFilePath.includes('.test.')
      ).length,
      store: testResults.testResults.filter(r => 
        r.testFilePath.includes('/stores/') && r.testFilePath.includes('.test.')
      ).length,
    },

    // Failure analysis
    failureAnalysis: {
      byType: analyzeFailuresByType(testResults),
      byFile: analyzeFailuresByFile(testResults),
      commonPatterns: identifyCommonFailurePatterns(testResults),
    },

    // Coverage analysis
    coverageAnalysis: testResults.coverageMap ? {
      uncoveredLines: getCriticalUncoveredLines(testResults.coverageMap),
      lowCoverageFiles: getLowCoverageFiles(testResults.coverageMap),
    } : null,

    // Performance warnings
    performanceWarnings: identifyPerformanceIssues(testResults),
  };

  // Set environment variables for teardown
  process.env.JEST_TOTAL_TESTS = testResults.numTotalTests.toString();
  process.env.JEST_PASSED_TESTS = testResults.numPassedTests.toString();
  process.env.JEST_FAILED_TESTS = testResults.numFailedTests.toString();
  process.env.JEST_SKIPPED_TESTS = (testResults.numPendingTests + testResults.numTodoTests).toString();
  
  if (testResults.coverageMap) {
    const coverage = testResults.coverageMap.getCoverageSummary();
    process.env.JEST_COVERAGE_STATEMENTS = coverage.statements.pct.toString();
    process.env.JEST_COVERAGE_BRANCHES = coverage.branches.pct.toString();
    process.env.JEST_COVERAGE_FUNCTIONS = coverage.functions.pct.toString();
    process.env.JEST_COVERAGE_LINES = coverage.lines.pct.toString();
  }

  process.env.JEST_TOTAL_TIME = enhancedResults.metrics.totalTime.toString();
  process.env.JEST_AVERAGE_TIME = enhancedResults.metrics.averageTime.toString();
  process.env.JEST_SLOWEST_TEST = enhancedResults.metrics.slowestTest.name || 'unknown';

  return enhancedResults;
};

function analyzeFailuresByType(testResults) {
  const failures = {};
  
  testResults.testResults.forEach(result => {
    result.testResults.forEach(test => {
      if (test.status === 'failed') {
        test.failureMessages.forEach(message => {
          if (message.includes('TypeError')) {
            failures.TypeError = (failures.TypeError || 0) + 1;
          } else if (message.includes('ReferenceError')) {
            failures.ReferenceError = (failures.ReferenceError || 0) + 1;
          } else if (message.includes('AssertionError')) {
            failures.AssertionError = (failures.AssertionError || 0) + 1;
          } else if (message.includes('Timeout')) {
            failures.Timeout = (failures.Timeout || 0) + 1;
          } else {
            failures.Other = (failures.Other || 0) + 1;
          }
        });
      }
    });
  });

  return failures;
}

function analyzeFailuresByFile(testResults) {
  const failures = {};
  
  testResults.testResults.forEach(result => {
    if (result.numFailingTests > 0) {
      failures[result.testFilePath] = result.numFailingTests;
    }
  });

  return failures;
}

function identifyCommonFailurePatterns(testResults) {
  const patterns = [];
  const allFailures = [];
  
  testResults.testResults.forEach(result => {
    result.testResults.forEach(test => {
      if (test.status === 'failed') {
        test.failureMessages.forEach(message => {
          allFailures.push(message);
        });
      }
    });
  });

  // Look for common patterns
  const commonErrors = [
    'Cannot read property',
    'is not a function',
    'undefined is not an object',
    'Network request failed',
    'Element not found',
    'Timeout exceeded',
  ];

  commonErrors.forEach(error => {
    const count = allFailures.filter(message => message.includes(error)).length;
    if (count > 0) {
      patterns.push({ pattern: error, count });
    }
  });

  return patterns.sort((a, b) => b.count - a.count);
}

function getCriticalUncoveredLines(coverageMap) {
  const uncovered = [];
  
  coverageMap.files().forEach(file => {
    const fileCoverage = coverageMap.fileCoverageFor(file);
    const uncoveredLines = fileCoverage.getUncoveredLines();
    
    if (uncoveredLines.length > 0 && file.includes('/services/')) {
      uncovered.push({
        file,
        lines: uncoveredLines,
        critical: true, // Services are critical
      });
    }
  });

  return uncovered;
}

function getLowCoverageFiles(coverageMap) {
  const lowCoverage = [];
  
  coverageMap.files().forEach(file => {
    const fileCoverage = coverageMap.fileCoverageFor(file);
    const summary = fileCoverage.toSummary();
    
    if (summary.statements.pct < 70) {
      lowCoverage.push({
        file,
        coverage: summary.statements.pct,
      });
    }
  });

  return lowCoverage.sort((a, b) => a.coverage - b.coverage);
}

function identifyPerformanceIssues(testResults) {
  const warnings = [];
  
  testResults.testResults.forEach(result => {
    const duration = result.perfStats?.end - result.perfStats?.start || 0;
    
    // Warn about slow tests
    if (duration > 5000) { // 5 seconds
      warnings.push({
        type: 'slow_test',
        file: result.testFilePath,
        duration,
        message: `Test file took ${duration}ms to complete`,
      });
    }

    // Warn about memory usage
    if (result.memoryUsage && result.memoryUsage > 100 * 1024 * 1024) { // 100MB
      warnings.push({
        type: 'high_memory',
        file: result.testFilePath,
        memory: result.memoryUsage,
        message: `Test file used ${Math.round(result.memoryUsage / 1024 / 1024)}MB of memory`,
      });
    }

    // Warn about many tests in one file
    if (result.numTotalTests > 50) {
      warnings.push({
        type: 'too_many_tests',
        file: result.testFilePath,
        count: result.numTotalTests,
        message: `Test file contains ${result.numTotalTests} tests (consider splitting)`,
      });
    }
  });

  return warnings;
}