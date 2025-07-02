/**
 * Automated Performance Regression Testing System
 * Continuously monitors for performance degradation
 */

import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

import axios from 'axios';
import { Pool } from 'pg';

interface PerformanceBaseline {
  testName: string;
  metric: string;
  baseline: number;
  threshold: number; // Max acceptable deviation from baseline (percentage)
  unit: string;
  lastUpdated: string;
}

interface RegressionTestResult {
  testName: string;
  metric: string;
  currentValue: number;
  baseline: number;
  deviation: number; // Percentage deviation from baseline
  status: 'pass' | 'warning' | 'fail';
  threshold: number;
  unit: string;
  timestamp: string;
}

interface RegressionTestSuite {
  timestamp: string;
  duration: number;
  totalTests: number;
  passed: number;
  warnings: number;
  failed: number;
  results: RegressionTestResult[];
  overallStatus: 'pass' | 'warning' | 'fail';
  recommendations: string[];
}

export class PerformanceRegressionTester {
  private baselines: PerformanceBaseline[] = [];
  private baselineFile = path.join(__dirname, '../data/performance-baselines.json');
  private resultsDir = path.join(__dirname, '../reports/regression');
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Initialize the regression tester
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Performance Regression Tester...');
    
    // Ensure directories exist
    await fs.mkdir(path.dirname(this.baselineFile), { recursive: true });
    await fs.mkdir(this.resultsDir, { recursive: true });
    
    // Load existing baselines
    await this.loadBaselines();
    
    console.log('✅ Performance Regression Tester initialized');
  }

  /**
   * Load performance baselines from file
   */
  private async loadBaselines(): Promise<void> {
    try {
      const data = await fs.readFile(this.baselineFile, 'utf-8');
      this.baselines = JSON.parse(data);
      console.log(`📊 Loaded ${this.baselines.length} performance baselines`);
    } catch (error) {
      console.log('📋 No existing baselines found, will create new ones');
      this.baselines = this.getDefaultBaselines();
      await this.saveBaselines();
    }
  }

  /**
   * Save performance baselines to file
   */
  private async saveBaselines(): Promise<void> {
    await fs.writeFile(this.baselineFile, JSON.stringify(this.baselines, null, 2));
  }

  /**
   * Get default performance baselines
   */
  private getDefaultBaselines(): PerformanceBaseline[] {
    return [
      {
        testName: 'FHIR Patient Search',
        metric: 'responseTime',
        baseline: 200, // 200ms
        threshold: 25, // 25% increase is warning
        unit: 'ms',
        lastUpdated: new Date().toISOString()
      },
      {
        testName: 'FHIR Patient Creation',
        metric: 'responseTime',
        baseline: 300,
        threshold: 30,
        unit: 'ms',
        lastUpdated: new Date().toISOString()
      },
      {
        testName: 'Database Query',
        metric: 'responseTime',
        baseline: 50,
        threshold: 40,
        unit: 'ms',
        lastUpdated: new Date().toISOString()
      },
      {
        testName: 'Observation Creation',
        metric: 'responseTime',
        baseline: 150,
        threshold: 35,
        unit: 'ms',
        lastUpdated: new Date().toISOString()
      },
      {
        testName: 'System Memory',
        metric: 'heapUsage',
        baseline: 400,
        threshold: 50,
        unit: 'MB',
        lastUpdated: new Date().toISOString()
      },
      {
        testName: 'System CPU',
        metric: 'usage',
        baseline: 60,
        threshold: 40,
        unit: '%',
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  /**
   * Run full regression test suite
   */
  async runRegressionTests(): Promise<RegressionTestSuite> {
    console.log('🧪 Starting Performance Regression Test Suite...');
    const startTime = performance.now();
    const results: RegressionTestResult[] = [];

    try {
      // Test FHIR endpoints
      const fhirResults = await this.testFHIREndpoints();
      results.push(...fhirResults);

      // Test database performance
      const dbResults = await this.testDatabasePerformance();
      results.push(...dbResults);

      // Test system performance
      const systemResults = await this.testSystemPerformance();
      results.push(...systemResults);

      // Test memory usage
      const memoryResults = await this.testMemoryUsage();
      results.push(...memoryResults);

    } catch (error) {
      console.error('❌ Error during regression testing:', error);
    }

    const duration = performance.now() - startTime;
    const testSuite = this.analyzeResults(results, duration);
    
    // Save results
    await this.saveResults(testSuite);
    
    console.log(`🏁 Regression test suite completed in ${Math.round(duration)}ms`);
    this.printSummary(testSuite);
    
    return testSuite;
  }

  /**
   * Test FHIR endpoint performance
   */
  private async testFHIREndpoints(): Promise<RegressionTestResult[]> {
    const results: RegressionTestResult[] = [];
    const baseUrl = this.config.apiUrl || 'http://localhost:3000';

    // Test Patient Search
    try {
      const startTime = performance.now();
      await axios.get(`${baseUrl}/fhir/R4/Patient?_count=10`);
      const responseTime = performance.now() - startTime;
      
      results.push(this.createTestResult('FHIR Patient Search', 'responseTime', responseTime, 'ms'));
    } catch (error) {
      results.push(this.createFailedTestResult('FHIR Patient Search', 'responseTime', 'ms', 'Endpoint unreachable'));
    }

    // Test Patient Creation
    try {
      const testPatient = {
        resourceType: 'Patient',
        name: [{ given: ['Test'], family: 'Regression' }],
        gender: 'unknown',
        birthDate: '1990-01-01'
      };

      const startTime = performance.now();
      await axios.post(`${baseUrl}/fhir/R4/Patient`, testPatient);
      const responseTime = performance.now() - startTime;
      
      results.push(this.createTestResult('FHIR Patient Creation', 'responseTime', responseTime, 'ms'));
    } catch (error) {
      results.push(this.createFailedTestResult('FHIR Patient Creation', 'responseTime', 'ms', 'Creation failed'));
    }

    return results;
  }

  /**
   * Test database performance
   */
  private async testDatabasePerformance(): Promise<RegressionTestResult[]> {
    const results: RegressionTestResult[] = [];
    
    try {
      const pool = new Pool({
        connectionString: this.config.database?.url,
        max: 1
      });

      // Simple query test
      const startTime = performance.now();
      await pool.query('SELECT 1');
      const responseTime = performance.now() - startTime;
      
      results.push(this.createTestResult('Database Query', 'responseTime', responseTime, 'ms'));
      
      await pool.end();
    } catch (error) {
      results.push(this.createFailedTestResult('Database Query', 'responseTime', 'ms', 'Database unreachable'));
    }

    return results;
  }

  /**
   * Test system performance
   */
  private async testSystemPerformance(): Promise<RegressionTestResult[]> {
    const results: RegressionTestResult[] = [];

    try {
      // Get system metrics from performance API
      const response = await axios.get(`${this.config.apiUrl || 'http://localhost:3000'}/performance/health`);
      const metrics = response.data.performance.system;

      if (metrics.cpu) {
        results.push(this.createTestResult('System CPU', 'usage', metrics.cpu.usage, '%'));
      }

    } catch (error) {
      results.push(this.createFailedTestResult('System CPU', 'usage', '%', 'Metrics unavailable'));
    }

    return results;
  }

  /**
   * Test memory usage
   */
  private async testMemoryUsage(): Promise<RegressionTestResult[]> {
    const results: RegressionTestResult[] = [];

    try {
      const response = await axios.get(`${this.config.apiUrl || 'http://localhost:3000'}/performance/health`);
      const metrics = response.data.performance.system;

      if (metrics.memory) {
        results.push(this.createTestResult('System Memory', 'heapUsage', metrics.memory.heapUsed, 'MB'));
      }

    } catch (error) {
      results.push(this.createFailedTestResult('System Memory', 'heapUsage', 'MB', 'Metrics unavailable'));
    }

    return results;
  }

  /**
   * Create test result comparing against baseline
   */
  private createTestResult(testName: string, metric: string, currentValue: number, unit: string): RegressionTestResult {
    const baseline = this.baselines.find(b => b.testName === testName && b.metric === metric);
    
    if (!baseline) {
      // Create new baseline
      const newBaseline: PerformanceBaseline = {
        testName,
        metric,
        baseline: currentValue,
        threshold: 25, // Default 25% threshold
        unit,
        lastUpdated: new Date().toISOString()
      };
      this.baselines.push(newBaseline);
      
      return {
        testName,
        metric,
        currentValue,
        baseline: currentValue,
        deviation: 0,
        status: 'pass',
        threshold: 25,
        unit,
        timestamp: new Date().toISOString()
      };
    }

    const deviation = ((currentValue - baseline.baseline) / baseline.baseline) * 100;
    let status: 'pass' | 'warning' | 'fail' = 'pass';

    if (Math.abs(deviation) > baseline.threshold) {
      status = 'fail';
    } else if (Math.abs(deviation) > baseline.threshold * 0.75) {
      status = 'warning';
    }

    return {
      testName,
      metric,
      currentValue,
      baseline: baseline.baseline,
      deviation,
      status,
      threshold: baseline.threshold,
      unit,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create failed test result
   */
  private createFailedTestResult(testName: string, metric: string, unit: string, error: string): RegressionTestResult {
    return {
      testName,
      metric,
      currentValue: -1,
      baseline: -1,
      deviation: 100,
      status: 'fail',
      threshold: 0,
      unit,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze test results and create summary
   */
  private analyzeResults(results: RegressionTestResult[], duration: number): RegressionTestSuite {
    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const failed = results.filter(r => r.status === 'fail').length;

    let overallStatus: 'pass' | 'warning' | 'fail' = 'pass';
    if (failed > 0) {
      overallStatus = 'fail';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    }

    const recommendations = this.generateRecommendations(results);

    return {
      timestamp: new Date().toISOString(),
      duration: Math.round(duration),
      totalTests: results.length,
      passed,
      warnings,
      failed,
      results,
      overallStatus,
      recommendations
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(results: RegressionTestResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedTests = results.filter(r => r.status === 'fail');
    const warningTests = results.filter(r => r.status === 'warning');

    if (failedTests.length > 0) {
      recommendations.push(`Critical: ${failedTests.length} tests failed - immediate investigation required`);
      
      const slowEndpoints = failedTests.filter(t => t.testName.includes('FHIR') && t.deviation > 50);
      if (slowEndpoints.length > 0) {
        recommendations.push('FHIR endpoints showing significant slowdown - check database indexes and query optimization');
      }

      const highMemory = failedTests.filter(t => t.testName.includes('Memory'));
      if (highMemory.length > 0) {
        recommendations.push('Memory usage exceeded threshold - check for memory leaks and optimize garbage collection');
      }

      const highCpu = failedTests.filter(t => t.testName.includes('CPU'));
      if (highCpu.length > 0) {
        recommendations.push('CPU usage too high - review algorithm efficiency and consider horizontal scaling');
      }
    }

    if (warningTests.length > 0) {
      recommendations.push(`Warning: ${warningTests.length} tests showing performance degradation - monitor closely`);
    }

    if (failedTests.length === 0 && warningTests.length === 0) {
      recommendations.push('All performance tests passed - system performance is optimal');
    }

    return recommendations;
  }

  /**
   * Save test results to file
   */
  private async saveResults(testSuite: RegressionTestSuite): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `regression-test-${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(testSuite, null, 2));
    
    // Also save as latest.json
    const latestPath = path.join(this.resultsDir, 'latest.json');
    await fs.writeFile(latestPath, JSON.stringify(testSuite, null, 2));
    
    console.log(`💾 Test results saved to: ${filepath}`);
  }

  /**
   * Print test summary to console
   */
  private printSummary(testSuite: RegressionTestSuite): void {
    console.log(`
🧪 PERFORMANCE REGRESSION TEST SUMMARY
======================================

Overall Status: ${testSuite.overallStatus.toUpperCase()} ${this.getStatusEmoji(testSuite.overallStatus)}
Duration: ${testSuite.duration}ms
Timestamp: ${testSuite.timestamp}

RESULTS:
--------
✅ Passed: ${testSuite.passed}
⚠️  Warnings: ${testSuite.warnings}
❌ Failed: ${testSuite.failed}
📊 Total: ${testSuite.totalTests}

DETAILED RESULTS:
----------------`);

    testSuite.results.forEach(result => {
      const emoji = this.getStatusEmoji(result.status);
      const deviationStr = result.deviation > 0 ? `+${result.deviation.toFixed(1)}%` : `${result.deviation.toFixed(1)}%`;
      
      console.log(`${emoji} ${result.testName} (${result.metric}): ${result.currentValue.toFixed(1)}${result.unit} (${deviationStr} from baseline)`);
    });

    if (testSuite.recommendations.length > 0) {
      console.log(`
RECOMMENDATIONS:
---------------`);
      testSuite.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('======================================');
  }

  /**
   * Get emoji for status
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'fail': return '❌';
      default: return '❓';
    }
  }

  /**
   * Update baseline for a specific test
   */
  async updateBaseline(testName: string, metric: string, newBaseline: number): Promise<void> {
    const baseline = this.baselines.find(b => b.testName === testName && b.metric === metric);
    
    if (baseline) {
      baseline.baseline = newBaseline;
      baseline.lastUpdated = new Date().toISOString();
    } else {
      this.baselines.push({
        testName,
        metric,
        baseline: newBaseline,
        threshold: 25,
        unit: 'ms', // Default unit
        lastUpdated: new Date().toISOString()
      });
    }
    
    await this.saveBaselines();
    console.log(`📊 Updated baseline for ${testName} (${metric}): ${newBaseline}`);
  }

  /**
   * Get current baselines
   */
  getBaselines(): PerformanceBaseline[] {
    return [...this.baselines];
  }

  /**
   * Schedule regular regression tests
   */
  scheduleRegularTests(intervalMinutes: number = 30): void {
    console.log(`⏰ Scheduling regression tests every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      console.log('🔄 Running scheduled regression tests...');
      try {
        await this.runRegressionTests();
      } catch (error) {
        console.error('❌ Scheduled regression test failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}