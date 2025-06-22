import { FullConfig, chromium } from '@playwright/test';
import { TEST_RUN_ID, getTestDataCleanupIds } from './helpers/test-data';

/**
 * Enhanced Global Teardown for E2E Tests
 * Cleans up test environment, generates reports, and ensures proper cleanup
 */

// TypeScript interfaces for test data structures
interface TestResult {
  suites?: TestSuite[];
  [key: string]: any;
}

interface TestSuite {
  specs?: TestSpec[];
  [key: string]: any;
}

interface TestSpec {
  ok: boolean;
  duration?: number;
  [key: string]: any;
}

interface TestResultsCollection {
  [filename: string]: TestResult;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
  totalDuration: string;
  categories: {
    authentication: { tests: number; passed: number };
    patientManagement: { tests: number; passed: number };
    clinicalWorkflows: { tests: number; passed: number };
    fhirOperations: { tests: number; passed: number };
    errorHandling: { tests: number; passed: number };
  };
}

interface PerformanceData {
  [key: string]: any;
}

interface CoverageData {
  [key: string]: any;
}

interface TestReport {
  testRunId: string;
  timestamp: string;
  environment: string;
  baseURL?: string;
  config: {
    browsers: string[];
    timeout?: number;
    retries?: number;
    workers?: number;
  };
  results: TestResultsCollection;
  summary: TestSummary;
  performance: PerformanceData;
  coverage: CoverageData;
}

interface TeardownSummary {
  testRunId: string;
  teardownTime: number;
  timestamp: string;
  cleanupOperations: string[];
  status: string;
}

interface TeardownFailure {
  testRunId: string;
  error: string;
  stack?: string;
  timestamp: string;
  phase: string;
}

async function globalTeardown(config: FullConfig) {
  const startTime = Date.now();
  
  console.log('🧹 Starting comprehensive E2E test teardown...');
  console.log(`📊 Test Run ID: ${TEST_RUN_ID}`);
  
  try {
    // Generate test reports
    await generateTestReports(config);
    
    // Clean up test environment
    await cleanupTestEnvironment();
    
    // Clean up test data
    await cleanupTestData();
    
    // Validate cleanup completion
    await validateCleanup();
    
    // Generate final summary
    await generateTeardownSummary(startTime);
    
    const teardownTime = Date.now() - startTime;
    console.log(`✅ Global teardown completed successfully in ${teardownTime}ms`);
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    
    // Capture teardown failure information
    await captureTeardownFailure(error);
    
    // Don't throw here to avoid masking test failures
    console.warn('⚠️ Continuing despite teardown failure to preserve test results');
  }
}

/**
 * Generate comprehensive test reports
 */
async function generateTestReports(config: FullConfig) {
  console.log('📈 Generating test reports...');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Read test results
    const resultsDir = path.join(process.cwd(), 'test-results');
    const reportDir = path.join(process.cwd(), 'test-results', 'reports');
    
    // Ensure report directory exists
    fs.mkdirSync(reportDir, { recursive: true });
    
    // Collect all test result files
    const testResults: TestResultsCollection = {};
    try {
      const resultsFiles = fs.readdirSync(resultsDir)
        .filter((file: string) => file.endsWith('.json') && file.includes('results'));
      
      for (const file of resultsFiles) {
        const filePath = path.join(resultsDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TestResult;
        testResults[file] = content;
      }
    } catch (error) {
      console.warn('⚠️ Could not read test results files:', error);
    }
    
    // Generate comprehensive report
    const report: TestReport = {
      testRunId: TEST_RUN_ID,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      baseURL: config.projects[0].use.baseURL,
      config: {
        browsers: config.projects.map(p => p.name),
        timeout: (config as any).globalTimeout || (config as any).timeout,
        retries: (config as any).retries,
        workers: (config as any).workers
      },
      results: testResults,
      summary: await generateTestSummary(testResults),
      performance: await collectPerformanceMetrics(),
      coverage: await collectCoverageData()
    };
    
    // Write comprehensive report
    const reportPath = path.join(reportDir, `e2e-test-report-${TEST_RUN_ID}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    await generateHTMLReport(report, reportDir);
    
    console.log(`✅ Test reports generated at: ${reportDir}`);
    
  } catch (error) {
    console.error('❌ Test report generation failed:', error);
    throw error;
  }
}

/**
 * Generate test summary statistics
 */
async function generateTestSummary(testResults: TestResultsCollection): Promise<TestSummary> {
  try {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let totalDuration = 0;
    
    // Parse test results to generate summary
    for (const [filename, results] of Object.entries(testResults)) {
      if (results && typeof results === 'object') {
        // Handle different result formats
        if (results.suites) {
          // Playwright format
          results.suites.forEach((suite: TestSuite) => {
            if (suite.specs) {
              suite.specs.forEach((spec: TestSpec) => {
                totalTests++;
                if (spec.ok) passedTests++;
                else failedTests++;
                totalDuration += spec.duration || 0;
              });
            }
          });
        }
      }
    }
    
    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      skipped: skippedTests,
      passRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) + '%' : '0%',
      totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
      categories: {
        authentication: { tests: 0, passed: 0 },
        patientManagement: { tests: 0, passed: 0 },
        clinicalWorkflows: { tests: 0, passed: 0 },
        fhirOperations: { tests: 0, passed: 0 },
        errorHandling: { tests: 0, passed: 0 }
      }
    };
    
  } catch (error) {
    console.warn('⚠️ Could not generate test summary:', error);
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: '0%',
      totalDuration: '0s',
      categories: {
        authentication: { tests: 0, passed: 0 },
        patientManagement: { tests: 0, passed: 0 },
        clinicalWorkflows: { tests: 0, passed: 0 },
        fhirOperations: { tests: 0, passed: 0 },
        errorHandling: { tests: 0, passed: 0 }
      }
    };
  }
}

/**
 * Collect performance metrics from tests
 */
async function collectPerformanceMetrics(): Promise<PerformanceData> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Look for performance data files
    const performanceFiles = ['setup-metadata.json', 'performance-*.json'];
    const performanceData: PerformanceData = {};
    
    for (const pattern of performanceFiles) {
      try {
        const files = fs.readdirSync(path.join(process.cwd(), 'test-results'))
          .filter((file: string) => file.match(pattern.replace('*', '.*')));
        
        for (const file of files) {
          const filePath = path.join(process.cwd(), 'test-results', file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any;
          performanceData[file] = content;
        }
      } catch (error) {
        // Ignore missing performance files
      }
    }
    
    return performanceData;
    
  } catch (error) {
    console.warn('⚠️ Could not collect performance metrics:', error);
    return {};
  }
}

/**
 * Collect test coverage data
 */
async function collectCoverageData(): Promise<CoverageData> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Look for coverage files
    const coveragePath = path.join(process.cwd(), 'coverage');
    
    if (fs.existsSync(coveragePath)) {
      const coverageFiles = fs.readdirSync(coveragePath)
        .filter((file: string) => file.endsWith('.json'));
      
      const coverage: CoverageData = {};
      for (const file of coverageFiles) {
        const filePath = path.join(coveragePath, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any;
        coverage[file] = content;
      }
      
      return coverage;
    }
    
    return {};
    
  } catch (error) {
    console.warn('⚠️ Could not collect coverage data:', error);
    return {};
  }
}

/**
 * Generate HTML report
 */
async function generateHTMLReport(report: TestReport, reportDir: string): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniCare E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 0.9em; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .test-category { margin-bottom: 20px; }
        .category-title { font-weight: bold; margin-bottom: 10px; color: #333; }
        .progress-bar { background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 OmniCare E2E Test Report</h1>
            <p>Test Run ID: ${report.testRunId}</p>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Environment: ${report.environment}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${report.summary.total}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value passed">${report.summary.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value failed">${report.summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.passRate}</div>
                <div class="stat-label">Pass Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.totalDuration}</div>
                <div class="stat-label">Duration</div>
            </div>
        </div>
        
        <div class="details">
            <h2>Test Categories</h2>
            ${Object.entries(report.summary.categories || {}).map(([category, data]: [string, { tests: number; passed: number }]) => `
                <div class="test-category">
                    <div class="category-title">${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.tests > 0 ? (data.passed / data.tests) * 100 : 0}%"></div>
                    </div>
                    <p>${data.passed}/${data.tests} tests passed</p>
                </div>
            `).join('')}
        </div>
        
        <div class="details">
            <h2>Configuration</h2>
            <ul>
                <li><strong>Browsers:</strong> ${report.config.browsers.join(', ')}</li>
                <li><strong>Base URL:</strong> ${report.baseURL}</li>
                <li><strong>Timeout:</strong> ${report.config.timeout}ms</li>
                <li><strong>Retries:</strong> ${report.config.retries}</li>
                <li><strong>Workers:</strong> ${report.config.workers}</li>
            </ul>
        </div>
    </div>
</body>
</html>
    `;
    
    const htmlPath = path.join(reportDir, `e2e-test-report-${TEST_RUN_ID}.html`);
    fs.writeFileSync(htmlPath, htmlTemplate);
    
    console.log(`📊 HTML report generated: ${htmlPath}`);
    
  } catch (error) {
    console.warn('⚠️ Could not generate HTML report:', error);
  }
}

/**
 * Clean up test environment
 */
async function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Launch browser for cleanup operations
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Navigate to application to access localStorage
      await page.goto('http://localhost:3000');
      
      // Clear test-specific localStorage items
      await page.evaluate(() => {
        const testKeys = [
          'E2E_TEST_MODE',
          'TEST_RUN_ID',
          'USE_MOCK_DATA',
          'E2E_CONFIG',
          'TEST_PATIENTS',
          'TEST_ENCOUNTERS',
          'TEST_MEDICATIONS',
          'E2E_PERFORMANCE_BASELINE'
        ];
        
        testKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Clear any keys starting with 'test-'
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('test-') || key.startsWith('TEST_')) {
            localStorage.removeItem(key);
          }
        });
      });
      
      // Clear sessionStorage
      await page.evaluate(() => {
        sessionStorage.clear();
      });
      
      // Clear cookies
      await context.clearCookies();
      
    } finally {
      await context.close();
      await browser.close();
    }
    
    console.log('✅ Test environment cleanup completed');
    
  } catch (error) {
    console.error('❌ Test environment cleanup failed:', error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('📄 Cleaning up test data...');
  
  try {
    const testDataIds = getTestDataCleanupIds();
    
    // In a real implementation, this would clean up:
    // - Test patients from database
    // - Test encounters
    // - Test medications
    // - Test lab results
    // - Uploaded test files
    
    console.log(`🔄 Marked ${testDataIds.length} test data items for cleanup`);
    
    // Clean up temporary files
    const fs = require('fs');
    const path = require('path');
    
    const tempDirs = [
      path.join(process.cwd(), 'temp'),
      path.join(process.cwd(), 'uploads', 'test'),
      path.join(process.cwd(), 'test-uploads')
    ];
    
    for (const dir of tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`📋 Removed temporary directory: ${dir}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not remove directory ${dir}:`, error);
      }
    }
    
    console.log('✅ Test data cleanup completed');
    
  } catch (error) {
    console.error('❌ Test data cleanup failed:', error);
    throw error;
  }
}

/**
 * Validate that cleanup was successful
 */
async function validateCleanup() {
  console.log('✅ Validating cleanup completion...');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check that temporary directories are gone
    const tempDirs = [
      path.join(process.cwd(), 'temp'),
      path.join(process.cwd(), 'test-uploads')
    ];
    
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        console.warn(`⚠️ Temporary directory still exists: ${dir}`);
      }
    }
    
    // Validate that browser storage was cleared
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto('http://localhost:3000');
      
      const hasTestData = await page.evaluate(() => {
        return Object.keys(localStorage).some(key => 
          key.startsWith('test-') || key.startsWith('TEST_') || key.includes('E2E')
        );
      });
      
      if (hasTestData) {
        console.warn('⚠️ Some test data still present in localStorage');
      } else {
        console.log('✅ Browser storage cleanup verified');
      }
      
    } finally {
      await context.close();
      await browser.close();
    }
    
    console.log('✅ Cleanup validation completed');
    
  } catch (error) {
    console.warn('⚠️ Cleanup validation failed:', error);
  }
}

/**
 * Generate teardown summary
 */
async function generateTeardownSummary(startTime: number): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const summary: TeardownSummary = {
      testRunId: TEST_RUN_ID,
      teardownTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      cleanupOperations: [
        'Test environment cleanup',
        'Test data cleanup',
        'Temporary file cleanup',
        'Browser storage cleanup',
        'Report generation'
      ],
      status: 'completed'
    };
    
    const summaryPath = path.join(process.cwd(), 'test-results', 'teardown-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`📄 Teardown summary saved to: ${summaryPath}`);
    
  } catch (error) {
    console.warn('⚠️ Could not generate teardown summary:', error);
  }
}

/**
 * Capture teardown failure information
 */
async function captureTeardownFailure(error: any): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const failureInfo: TeardownFailure = {
      testRunId: TEST_RUN_ID,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      phase: 'teardown'
    };
    
    const failurePath = path.join(process.cwd(), 'test-results', 'teardown-failure.json');
    fs.mkdirSync(path.dirname(failurePath), { recursive: true });
    fs.writeFileSync(failurePath, JSON.stringify(failureInfo, null, 2));
    
    console.log(`📄 Teardown failure info saved to: ${failurePath}`);
    
  } catch (captureError) {
    console.warn('⚠️ Could not capture teardown failure information:', captureError);
  }
}

export default globalTeardown;