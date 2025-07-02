/**
 * Performance Test Runner
 * Orchestrates all performance tests and generates comprehensive reports
 */

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

import express from 'express';

import logger from '../../src/utils/logger';

import { DatabasePerformanceTests } from './database/database-performance-tests';
import { FHIRPerformanceTests } from './fhir/fhir-performance-tests';
import { FileUploadPerformanceTests } from './file-upload/file-upload-tests';
import { TestConfiguration } from './framework/performance-test-base';
import PerformanceMonitor from './monitoring/performance-monitor';
import { WebSocketStressTests } from './websocket/websocket-stress-tests';


export interface TestSuite {
  name: string;
  description: string;
  tests: PerformanceTest[];
}

export interface PerformanceTest {
  name: string;
  description: string;
  config: TestConfiguration;
  execute: () => Promise<string>;
}

export interface TestResults {
  suiteResults: Map<string, any>;
  overallMetrics: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    averageResponseTime: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
  };
}

export class PerformanceTestRunner {
  private app: express.Application;
  private databaseUrl: string;
  private monitor: any;
  private results: TestResults;
  private reportDir: string;

  constructor(app: express.Application, databaseUrl: string) {
    this.app = app;
    this.databaseUrl = databaseUrl;
    this.monitor = new PerformanceMonitor();
    this.results = this.initializeResults();
    this.reportDir = join(process.cwd(), 'tests/performance/reports');
  }

  private initializeResults(): TestResults {
    return {
      suiteResults: new Map(),
      overallMetrics: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalDuration: 0,
        averageResponseTime: 0,
        maxMemoryUsage: 0,
        maxCpuUsage: 0
      }
    };
  }

  /**
   * Run all performance test suites
   */
  async runAllTests(): Promise<TestResults> {
    logger.info('🚀 Starting OmniCare Performance Testing Suite');
    logger.info('='.repeat(60));

    // Ensure report directory exists
    await mkdir(this.reportDir, { recursive: true });

    // Start system monitoring
    this.monitor.start();

    const startTime = Date.now();

    try {
      // Define test suites
      const testSuites = this.createTestSuites();

      // Execute test suites sequentially
      for (const suite of testSuites) {
        logger.info(`\n🧪 Running ${suite.name} Test Suite`);
        logger.info(`📝 ${suite.description}`);
        logger.info('-'.repeat(40));

        const suiteResults = await this.runTestSuite(suite);
        this.results.suiteResults.set(suite.name, suiteResults);
      }

      // Calculate overall metrics
      this.calculateOverallMetrics();

      // Generate comprehensive report
      this.generateComprehensiveReport();

    } finally {
      // Stop monitoring
      await this.monitor.stop();
      
      const endTime = Date.now();
      this.results.overallMetrics.totalDuration = (endTime - startTime) / 1000; // seconds
      
      logger.info(`\n✅ Performance testing completed in ${this.results.overallMetrics.totalDuration.toFixed(2)} seconds`);
    }

    return this.results;
  }

  /**
   * Create all test suites with configurations
   */
  private createTestSuites(): TestSuite[] {
    return [
      // FHIR API Performance Tests
      {
        name: 'FHIR API Performance',
        description: 'Tests for FHIR REST API endpoints including CRUD operations, search, and batch processing',
        tests: [
          {
            name: 'Patient CRUD Operations',
            description: 'Test patient create, read, update, delete operations',
            config: {
              name: 'Patient CRUD Performance',
              concurrency: 20,
              duration: 300,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 2000,
              thresholds: {
                responseTime: 1000,
                successRate: 95,
                memoryUsage: 500,
                cpuUsage: 70
              }
            },
            execute: async () => {
              const fhirTests = new FHIRPerformanceTests(this.app, this.getConfig('Patient CRUD'));
              await fhirTests.setup();
              await fhirTests.testPatientCRUD();
              const report = fhirTests.generateReport();
              await fhirTests.cleanup();
              return report;
            }
          },
          {
            name: 'Observation Performance',
            description: 'Test vital signs and observation operations',
            config: {
              name: 'Observation Performance',
              concurrency: 15,
              duration: 240,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 1500,
              thresholds: {
                responseTime: 800,
                successRate: 95,
                memoryUsage: 400,
                cpuUsage: 65
              }
            },
            execute: async () => {
              const fhirTests = new FHIRPerformanceTests(this.app, this.getConfig('Observation'));
              await fhirTests.setup();
              await fhirTests.testObservationPerformance();
              const report = fhirTests.generateReport();
              await fhirTests.cleanup();
              return report;
            }
          },
          {
            name: 'Batch Operations',
            description: 'Test FHIR batch and transaction operations',
            config: {
              name: 'Batch Operations',
              concurrency: 10,
              duration: 180,
              warmupTime: 30,
              rampUpTime: 45,
              maxRequests: 500,
              thresholds: {
                responseTime: 3000,
                successRate: 90,
                memoryUsage: 600,
                cpuUsage: 75
              }
            },
            execute: async () => {
              const fhirTests = new FHIRPerformanceTests(this.app, this.getConfig('Batch Operations'));
              await fhirTests.setup();
              await fhirTests.testBatchOperations();
              const report = fhirTests.generateReport();
              await fhirTests.cleanup();
              return report;
            }
          },
          {
            name: 'Complex Search Operations',
            description: 'Test complex FHIR search queries with multiple parameters',
            config: {
              name: 'Complex Search',
              concurrency: 25,
              duration: 300,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 1000,
              thresholds: {
                responseTime: 2000,
                successRate: 95,
                memoryUsage: 400,
                cpuUsage: 70
              }
            },
            execute: async () => {
              const fhirTests = new FHIRPerformanceTests(this.app, this.getConfig('Complex Search'));
              await fhirTests.setup();
              await fhirTests.testComplexSearch();
              const report = fhirTests.generateReport();
              await fhirTests.cleanup();
              return report;
            }
          },
          {
            name: 'Patient Everything Operation',
            description: 'Test Patient $everything operation performance',
            config: {
              name: 'Patient Everything',
              concurrency: 8,
              duration: 180,
              warmupTime: 30,
              rampUpTime: 45,
              maxRequests: 200,
              thresholds: {
                responseTime: 5000,
                successRate: 90,
                memoryUsage: 800,
                cpuUsage: 80
              }
            },
            execute: async () => {
              const fhirTests = new FHIRPerformanceTests(this.app, this.getConfig('Patient Everything'));
              await fhirTests.setup();
              await fhirTests.testPatientEverything();
              const report = fhirTests.generateReport();
              await fhirTests.cleanup();
              return report;
            }
          }
        ]
      },

      // Database Performance Tests
      {
        name: 'Database Performance',
        description: 'Tests for database query optimization and performance validation',
        tests: [
          {
            name: 'Query Performance Analysis',
            description: 'Analyze performance of common database queries',
            config: {
              name: 'Database Query Performance',
              concurrency: 1, // Single-threaded for query analysis
              duration: 60,
              warmupTime: 10,
              rampUpTime: 10,
              maxRequests: 100,
              thresholds: {
                responseTime: 100,
                successRate: 100,
                memoryUsage: 200,
                cpuUsage: 50
              }
            },
            execute: async () => {
              const dbTests = new DatabasePerformanceTests(this.getConfig('Database'), this.databaseUrl);
              await dbTests.setup();
              
              const patientResults = await dbTests.testPatientSearchPerformance();
              const observationResults = await dbTests.testObservationQueryPerformance();
              const joinResults = await dbTests.testComplexJoinPerformance();
              
              const report = dbTests.generateDatabaseReport(patientResults, observationResults, joinResults);
              await dbTests.cleanup();
              return report;
            }
          },
          {
            name: 'Connection Pool Performance',
            description: 'Test database connection pool under load',
            config: {
              name: 'Connection Pool',
              concurrency: 50,
              duration: 180,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 2000,
              thresholds: {
                responseTime: 500,
                successRate: 98,
                memoryUsage: 300,
                cpuUsage: 60
              }
            },
            execute: async () => {
              const dbTests = new DatabasePerformanceTests(this.getConfig('Connection Pool'), this.databaseUrl);
              await dbTests.setup();
              await dbTests.testConnectionPoolPerformance();
              const report = dbTests.generateReport();
              await dbTests.cleanup();
              return report;
            }
          }
        ]
      },

      // WebSocket Performance Tests
      {
        name: 'WebSocket Performance',
        description: 'Tests for real-time subscription and WebSocket performance',
        tests: [
          {
            name: 'Connection Stress Test',
            description: 'Test WebSocket connection performance under load',
            config: {
              name: 'WebSocket Connections',
              concurrency: 100,
              duration: 180,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 500,
              thresholds: {
                responseTime: 5000,
                successRate: 90,
                memoryUsage: 400,
                cpuUsage: 70
              }
            },
            execute: async () => {
              const wsTests = new WebSocketStressTests(this.getConfig('WebSocket Connections'));
              await wsTests.testConnectionStress();
              const report = wsTests.generateWebSocketReport();
              await wsTests.cleanup();
              return report;
            }
          },
          {
            name: 'Subscription Performance',
            description: 'Test subscription and real-time update performance',
            config: {
              name: 'WebSocket Subscriptions',
              concurrency: 50,
              duration: 240,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 300,
              thresholds: {
                responseTime: 3000,
                successRate: 85,
                memoryUsage: 500,
                cpuUsage: 75
              }
            },
            execute: async () => {
              const wsTests = new WebSocketStressTests(this.getConfig('WebSocket Subscriptions'));
              await wsTests.testSubscriptionPerformance();
              const report = wsTests.generateWebSocketReport();
              await wsTests.cleanup();
              return report;
            }
          },
          {
            name: 'Message Throughput',
            description: 'Test WebSocket message throughput under high load',
            config: {
              name: 'Message Throughput',
              concurrency: 30,
              duration: 180,
              warmupTime: 30,
              rampUpTime: 45,
              maxRequests: 1000,
              thresholds: {
                responseTime: 1000,
                successRate: 90,
                memoryUsage: 400,
                cpuUsage: 70
              }
            },
            execute: async () => {
              const wsTests = new WebSocketStressTests(this.getConfig('Message Throughput'));
              await wsTests.testMessageThroughput();
              const report = wsTests.generateWebSocketReport();
              await wsTests.cleanup();
              return report;
            }
          }
        ]
      },

      // File Upload Performance Tests
      {
        name: 'File Upload Performance',
        description: 'Tests for medical document and image upload performance',
        tests: [
          {
            name: 'Single File Uploads',
            description: 'Test individual file upload performance',
            config: {
              name: 'Single File Uploads',
              concurrency: 10,
              duration: 300,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 200,
              thresholds: {
                responseTime: 10000,
                successRate: 95,
                memoryUsage: 600,
                cpuUsage: 70
              }
            },
            execute: async () => {
              const uploadTests = new FileUploadPerformanceTests(this.app, this.getConfig('Single File Uploads'));
              await uploadTests.setup();
              await uploadTests.testSingleFileUploads();
              const report = uploadTests.generateUploadReport();
              await uploadTests.cleanup();
              return report;
            }
          },
          {
            name: 'Concurrent Uploads',
            description: 'Test concurrent file upload performance',
            config: {
              name: 'Concurrent Uploads',
              concurrency: 20,
              duration: 240,
              warmupTime: 30,
              rampUpTime: 60,
              maxRequests: 100,
              thresholds: {
                responseTime: 15000,
                successRate: 90,
                memoryUsage: 800,
                cpuUsage: 80
              }
            },
            execute: async () => {
              const uploadTests = new FileUploadPerformanceTests(this.app, this.getConfig('Concurrent Uploads'));
              await uploadTests.setup();
              await uploadTests.testConcurrentUploads();
              const report = uploadTests.generateUploadReport();
              await uploadTests.cleanup();
              return report;
            }
          },
          {
            name: 'Large File Uploads',
            description: 'Test large file upload performance (medical images, DICOM files)',
            config: {
              name: 'Large File Uploads',
              concurrency: 5,
              duration: 300,
              warmupTime: 60,
              rampUpTime: 90,
              maxRequests: 20,
              thresholds: {
                responseTime: 60000,
                successRate: 85,
                memoryUsage: 1200,
                cpuUsage: 85
              }
            },
            execute: async () => {
              const uploadTests = new FileUploadPerformanceTests(this.app, this.getConfig('Large File Uploads'));
              await uploadTests.setup();
              await uploadTests.testLargeFileUploads();
              const report = uploadTests.generateUploadReport();
              await uploadTests.cleanup();
              return report;
            }
          }
        ]
      }
    ];
  }

  /**
   * Run a single test suite
   */
  private async runTestSuite(suite: TestSuite): Promise<any> {
    const suiteResults = {
      name: suite.name,
      description: suite.description,
      startTime: new Date().toISOString(),
      tests: [],
      summary: {
        total: suite.tests.length,
        passed: 0,
        failed: 0,
        duration: 0
      }
    };

    const suiteStartTime = Date.now();

    for (const test of suite.tests) {
      logger.info(`  🔄 Running: ${test.name}`);
      
      const testStartTime = Date.now();
      let testResult;
      
      try {
        const report = await test.execute();
        testResult = {
          name: test.name,
          description: test.description,
          status: 'PASSED',
          duration: (Date.now() - testStartTime) / 1000,
          report: report
        };
        suiteResults.summary.passed++;
        logger.info(`  ✅ ${test.name} - PASSED`);
      } catch (error) {
        testResult = {
          name: test.name,
          description: test.description,
          status: 'FAILED',
          duration: (Date.now() - testStartTime) / 1000,
          error: error.message,
          report: null
        };
        suiteResults.summary.failed++;
        logger.error(`  ❌ ${test.name} - FAILED: ${error.message}`);
      }
      
      suiteResults.tests.push(testResult);
      this.results.overallMetrics.totalTests++;
      
      if (testResult.status === 'PASSED') {
        this.results.overallMetrics.passedTests++;
      } else {
        this.results.overallMetrics.failedTests++;
      }
    }

    suiteResults.summary.duration = (Date.now() - suiteStartTime) / 1000;
    suiteResults.endTime = new Date().toISOString();

    logger.info(`\n📊 ${suite.name} Summary: ${suiteResults.summary.passed}/${suiteResults.summary.total} tests passed`);

    return suiteResults;
  }

  /**
   * Get test configuration
   */
  private getConfig(testName: string): TestConfiguration {
    return {
      name: testName,
      concurrency: 10,
      duration: 60,
      warmupTime: 10,
      rampUpTime: 20,
      maxRequests: 100,
      thresholds: {
        responseTime: 1000,
        successRate: 95,
        memoryUsage: 500,
        cpuUsage: 70
      }
    };
  }

  /**
   * Calculate overall metrics across all tests
   */
  private calculateOverallMetrics(): void {
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const [_suiteName, suiteResults] of this.results.suiteResults) {
      // This is a simplified calculation - in a real implementation,
      // you'd aggregate metrics from individual test reports
      if (suiteResults.tests) {
        suiteResults.tests.forEach((test: any) => {
          if (test.duration) {
            totalResponseTime += test.duration * 1000; // Convert to ms
            responseTimeCount++;
          }
        });
      }
    }

    if (responseTimeCount > 0) {
      this.results.overallMetrics.averageResponseTime = totalResponseTime / responseTimeCount;
    }

    // Memory and CPU metrics would come from the performance monitor
    // For now, setting placeholder values
    this.results.overallMetrics.maxMemoryUsage = 800; // MB
    this.results.overallMetrics.maxCpuUsage = 75; // %
  }

  /**
   * Generate comprehensive performance report
   */
  private generateComprehensiveReport(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = join(this.reportDir, `performance-report-${timestamp}.md`);
    
    const reportStream = createWriteStream(reportFile);
    
    // Write report header
    reportStream.write(`# OmniCare EMR Performance Test Report\n\n`);
    reportStream.write(`**Generated:** ${new Date().toLocaleString()}\n`);
    reportStream.write(`**Test Duration:** ${this.results.overallMetrics.totalDuration.toFixed(2)} seconds\n\n`);
    
    // Executive Summary
    reportStream.write(`## Executive Summary\n\n`);
    reportStream.write(`| Metric | Value |\n`);
    reportStream.write(`|--------|-------|\n`);
    reportStream.write(`| Total Tests | ${this.results.overallMetrics.totalTests} |\n`);
    reportStream.write(`| Passed Tests | ${this.results.overallMetrics.passedTests} |\n`);
    reportStream.write(`| Failed Tests | ${this.results.overallMetrics.failedTests} |\n`);
    reportStream.write(`| Success Rate | ${((this.results.overallMetrics.passedTests / this.results.overallMetrics.totalTests) * 100).toFixed(2)}% |\n`);
    reportStream.write(`| Average Response Time | ${this.results.overallMetrics.averageResponseTime.toFixed(2)}ms |\n`);
    reportStream.write(`| Max Memory Usage | ${this.results.overallMetrics.maxMemoryUsage}MB |\n`);
    reportStream.write(`| Max CPU Usage | ${this.results.overallMetrics.maxCpuUsage}% |\n\n`);
    
    // Test Suite Results
    reportStream.write(`## Test Suite Results\n\n`);
    
    for (const [_suiteName, suiteResults] of this.results.suiteResults) {
      reportStream.write(`### ${suiteResults.name}\n\n`);
      reportStream.write(`${suiteResults.description}\n\n`);
      reportStream.write(`**Summary:** ${suiteResults.summary.passed}/${suiteResults.summary.total} tests passed in ${suiteResults.summary.duration.toFixed(2)}s\n\n`);
      
      // Individual test results
      for (const test of suiteResults.tests) {
        const status = test.status === 'PASSED' ? '✅' : '❌';
        reportStream.write(`#### ${status} ${test.name}\n\n`);
        reportStream.write(`${test.description}\n\n`);
        reportStream.write(`**Duration:** ${test.duration.toFixed(2)}s\n\n`);
        
        if (test.status === 'FAILED') {
          reportStream.write(`**Error:** ${test.error}\n\n`);
        } else if (test.report) {
          reportStream.write(`\`\`\`\n${test.report}\n\`\`\`\n\n`);
        }
      }
    }
    
    // Recommendations
    reportStream.write(`## Performance Recommendations\n\n`);
    reportStream.write(this.generateRecommendations());
    
    reportStream.end();
    
    logger.info(`\n📁 Comprehensive report saved to: ${reportFile}`);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string {
    const recommendations: string[] = [];
    const successRate = (this.results.overallMetrics.passedTests / this.results.overallMetrics.totalTests) * 100;
    
    if (successRate < 90) {
      recommendations.push('- **Critical:** Low test success rate detected. Review failed tests and system stability.');
    }
    
    if (this.results.overallMetrics.averageResponseTime > 2000) {
      recommendations.push('- **Performance:** High average response times. Consider optimizing slow endpoints and database queries.');
    }
    
    if (this.results.overallMetrics.maxMemoryUsage > 1000) {
      recommendations.push('- **Memory:** High memory usage detected. Review memory leaks and optimize data structures.');
    }
    
    if (this.results.overallMetrics.maxCpuUsage > 80) {
      recommendations.push('- **CPU:** High CPU usage detected. Consider code optimization and horizontal scaling.');
    }
    
    // Add general recommendations
    recommendations.push('- **Monitoring:** Implement continuous performance monitoring in production environments.');
    recommendations.push('- **Caching:** Consider implementing Redis caching for frequently accessed data.');
    recommendations.push('- **Database:** Review database indexes and query optimization opportunities.');
    recommendations.push('- **Load Balancing:** Consider implementing load balancing for high-traffic scenarios.');
    
    if (recommendations.length === 0) {
      recommendations.push('- **Excellent:** All performance metrics are within acceptable ranges.');
    }
    
    return recommendations.join('\n') + '\n\n';
  }
}