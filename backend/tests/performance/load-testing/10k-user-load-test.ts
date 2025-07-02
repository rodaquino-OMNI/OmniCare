/**
 * OmniCare EMR - 10K Concurrent Users Load Test Suite
 * Comprehensive performance testing for production readiness
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { performance } from 'perf_hooks';

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

import logger from '../../../src/utils/logger';

interface LoadTestConfig {
  targetURL: string;
  targetUsers: number;
  rampUpTime: number; // seconds
  testDuration: number; // seconds
  thinkTime: number; // milliseconds between requests
  scenarios: LoadTestScenario[];
  performanceTargets: PerformanceTargets;
}

interface LoadTestScenario {
  name: string;
  weight: number; // Percentage of users executing this scenario
  steps: ScenarioStep[];
}

interface ScenarioStep {
  name: string;
  type: 'http' | 'websocket' | 'wait';
  method?: string;
  endpoint?: string;
  payload?: any;
  headers?: Record<string, string>;
  validation?: (response: any) => boolean;
  extractData?: (response: any) => Record<string, any>;
}

interface PerformanceTargets {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number; // requests per second
  errorRate: number; // percentage
  concurrentUsers: number;
}

interface TestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responseTimes: number[];
  throughput: number;
  errorRate: number;
  activeUsers: number;
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  scenarioMetrics: Map<string, ScenarioMetrics>;
}

interface ScenarioMetrics {
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
  errors: Map<string, number>;
}

export class LoadTestSuite extends EventEmitter {
  private config: LoadTestConfig;
  private metrics: TestMetrics;
  private virtualUsers: Map<string, VirtualUser> = new Map();
  private isRunning = false;
  private startTime?: number;
  private metricsInterval?: NodeJS.Timer;
  private progressInterval?: NodeJS.Timer;

  constructor() {
    super();
    this.config = this.createDefaultConfig();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Create default load test configuration for 10k users
   */
  private createDefaultConfig(): LoadTestConfig {
    return {
      targetURL: process.env.LOAD_TEST_URL || 'http://localhost:3000',
      targetUsers: 10000,
      rampUpTime: 300, // 5 minutes
      testDuration: 1800, // 30 minutes
      thinkTime: 1000, // 1 second
      scenarios: [
        {
          name: 'Patient Search and View',
          weight: 30,
          steps: [
            {
              name: 'Login',
              type: 'http',
              method: 'POST',
              endpoint: '/api/auth/login',
              payload: { username: 'testuser', password: 'testpass' },
              extractData: (res) => ({ token: res.data.token }),
            },
            {
              name: 'Search Patients',
              type: 'http',
              method: 'GET',
              endpoint: '/fhir/R4/Patient?name=smith&_count=20',
              headers: { Authorization: 'Bearer {{token}}' },
              validation: (res) => res.status === 200 && res.data.entry?.length > 0,
            },
            {
              name: 'View Patient Details',
              type: 'http',
              method: 'GET',
              endpoint: '/fhir/R4/Patient/{{patientId}}',
              headers: { Authorization: 'Bearer {{token}}' },
            },
            {
              name: 'Get Patient Vitals',
              type: 'http',
              method: 'GET',
              endpoint: '/fhir/R4/Observation?patient={{patientId}}&category=vital-signs',
              headers: { Authorization: 'Bearer {{token}}' },
            },
          ],
        },
        {
          name: 'Clinical Documentation',
          weight: 25,
          steps: [
            {
              name: 'Login',
              type: 'http',
              method: 'POST',
              endpoint: '/api/auth/login',
              payload: { username: 'clinician', password: 'testpass' },
              extractData: (res) => ({ token: res.data.token }),
            },
            {
              name: 'Get Active Encounters',
              type: 'http',
              method: 'GET',
              endpoint: '/fhir/R4/Encounter?status=in-progress&_count=10',
              headers: { Authorization: 'Bearer {{token}}' },
              extractData: (res) => ({ 
                encounterId: res.data.entry?.[0]?.resource?.id 
              }),
            },
            {
              name: 'Create Clinical Note',
              type: 'http',
              method: 'POST',
              endpoint: '/fhir/R4/DocumentReference',
              headers: { Authorization: 'Bearer {{token}}' },
              payload: {
                resourceType: 'DocumentReference',
                status: 'current',
                subject: { reference: 'Patient/{{patientId}}' },
                context: { encounter: [{ reference: 'Encounter/{{encounterId}}' }] },
                content: [{
                  attachment: {
                    contentType: 'text/plain',
                    data: 'VGVzdCBjbGluaWNhbCBub3Rl', // Base64 encoded
                  },
                }],
              },
            },
            {
              name: 'Think Time',
              type: 'wait',
            },
          ],
        },
        {
          name: 'Real-time Monitoring',
          weight: 20,
          steps: [
            {
              name: 'Login',
              type: 'http',
              method: 'POST',
              endpoint: '/api/auth/login',
              payload: { username: 'monitor', password: 'testpass' },
              extractData: (res) => ({ token: res.data.token }),
            },
            {
              name: 'Subscribe to Updates',
              type: 'websocket',
              endpoint: '/ws/subscriptions',
              headers: { Authorization: 'Bearer {{token}}' },
            },
            {
              name: 'Monitor for 30 seconds',
              type: 'wait',
            },
          ],
        },
        {
          name: 'Medication Management',
          weight: 15,
          steps: [
            {
              name: 'Login',
              type: 'http',
              method: 'POST',
              endpoint: '/api/auth/login',
              payload: { username: 'pharmacist', password: 'testpass' },
              extractData: (res) => ({ token: res.data.token }),
            },
            {
              name: 'Get Active Medications',
              type: 'http',
              method: 'GET',
              endpoint: '/fhir/R4/MedicationRequest?status=active&_count=50',
              headers: { Authorization: 'Bearer {{token}}' },
            },
            {
              name: 'Check Drug Interactions',
              type: 'http',
              method: 'POST',
              endpoint: '/api/clinical/drug-interactions',
              headers: { Authorization: 'Bearer {{token}}' },
              payload: {
                medications: ['medication1', 'medication2'],
              },
            },
          ],
        },
        {
          name: 'Batch Operations',
          weight: 10,
          steps: [
            {
              name: 'Login',
              type: 'http',
              method: 'POST',
              endpoint: '/api/auth/login',
              payload: { username: 'batchuser', password: 'testpass' },
              extractData: (res) => ({ token: res.data.token }),
            },
            {
              name: 'Batch Request',
              type: 'http',
              method: 'POST',
              endpoint: '/fhir/R4',
              headers: { 
                Authorization: 'Bearer {{token}}',
                'Content-Type': 'application/fhir+json',
              },
              payload: {
                resourceType: 'Bundle',
                type: 'batch',
                entry: [
                  {
                    request: { method: 'GET', url: 'Patient?_count=5' },
                  },
                  {
                    request: { method: 'GET', url: 'Observation?_count=10' },
                  },
                ],
              },
            },
          ],
        },
      ],
      performanceTargets: {
        responseTime: {
          p50: 200,   // 200ms median
          p95: 1000,  // 1s for 95th percentile
          p99: 2000,  // 2s for 99th percentile
        },
        throughput: 5000, // 5000 req/s
        errorRate: 1,     // 1% error rate
        concurrentUsers: 10000,
      },
    };
  }

  /**
   * Initialize test metrics
   */
  private initializeMetrics(): TestMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      throughput: 0,
      errorRate: 0,
      activeUsers: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      networkLatency: 0,
      scenarioMetrics: new Map(),
    };
  }

  /**
   * Run the load test
   */
  async run(customConfig?: Partial<LoadTestConfig>): Promise<TestMetrics> {
    this.config = { ...this.config, ...customConfig };
    this.isRunning = true;
    this.startTime = performance.now();

    logger.info('Starting 10K user load test', {
      targetURL: this.config.targetURL,
      targetUsers: this.config.targetUsers,
      rampUpTime: this.config.rampUpTime,
      testDuration: this.config.testDuration,
    });

    try {
      // Start monitoring
      this.startMonitoring();

      // Ramp up users
      await this.rampUpUsers();

      // Run test for specified duration
      await this.runTestDuration();

      // Ramp down users
      await this.rampDownUsers();

      // Calculate final metrics
      this.calculateFinalMetrics();

      // Generate report
      const report = this.generateReport();
      logger.info('Load test completed', { report });

      return this.metrics;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Ramp up virtual users gradually
   */
  private async rampUpUsers(): Promise<void> {
    const usersPerSecond = this.config.targetUsers / this.config.rampUpTime;
    const rampUpInterval = 1000; // 1 second
    let currentUsers = 0;

    logger.info(`Ramping up ${this.config.targetUsers} users over ${this.config.rampUpTime} seconds`);

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const usersToAdd = Math.min(
          Math.ceil(usersPerSecond),
          this.config.targetUsers - currentUsers
        );

        for (let i = 0; i < usersToAdd; i++) {
          const userId = `user-${currentUsers + i}`;
          const scenario = this.selectScenario();
          const user = new VirtualUser(userId, scenario, this.config);
          
          user.on('request-complete', (data) => this.handleRequestComplete(data));
          user.on('request-failed', (data) => this.handleRequestFailed(data));
          
          this.virtualUsers.set(userId, user);
          user.start();
        }

        currentUsers += usersToAdd;
        this.metrics.activeUsers = currentUsers;

        this.emit('users-ramped', { current: currentUsers, target: this.config.targetUsers });

        if (currentUsers >= this.config.targetUsers) {
          clearInterval(interval);
          logger.info('User ramp-up completed');
          resolve();
        }
      }, rampUpInterval);
    });
  }

  /**
   * Run test for specified duration
   */
  private async runTestDuration(): Promise<void> {
    logger.info(`Running test for ${this.config.testDuration} seconds`);

    return new Promise((resolve) => {
      setTimeout(() => {
        logger.info('Test duration completed');
        resolve();
      }, this.config.testDuration * 1000);
    });
  }

  /**
   * Ramp down users
   */
  private async rampDownUsers(): Promise<void> {
    logger.info('Ramping down users');

    const users = Array.from(this.virtualUsers.values());
    const batchSize = 100;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(batch.map(user => user.stop()));
      
      this.metrics.activeUsers = Math.max(0, this.metrics.activeUsers - batch.length);
      this.emit('users-ramped', { current: this.metrics.activeUsers, target: 0 });
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.virtualUsers.clear();
    logger.info('User ramp-down completed');
  }

  /**
   * Select scenario based on weights
   */
  private selectScenario(): LoadTestScenario {
    const random = Math.random() * 100;
    let accumulator = 0;

    for (const scenario of this.config.scenarios) {
      accumulator += scenario.weight;
      if (random <= accumulator) {
        return scenario;
      }
    }

    return this.config.scenarios[0];
  }

  /**
   * Handle completed request
   */
  private handleRequestComplete(data: {
    scenarioName: string;
    stepName: string;
    responseTime: number;
    statusCode?: number;
  }): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.responseTimes.push(data.responseTime);

    // Update scenario metrics
    const scenarioMetrics = this.getOrCreateScenarioMetrics(data.scenarioName);
    scenarioMetrics.executionCount++;
    scenarioMetrics.successCount++;
    scenarioMetrics.avgResponseTime = 
      (scenarioMetrics.avgResponseTime * (scenarioMetrics.executionCount - 1) + data.responseTime) / 
      scenarioMetrics.executionCount;
  }

  /**
   * Handle failed request
   */
  private handleRequestFailed(data: {
    scenarioName: string;
    stepName: string;
    error: string;
    responseTime?: number;
  }): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;

    if (data.responseTime) {
      this.metrics.responseTimes.push(data.responseTime);
    }

    // Update scenario metrics
    const scenarioMetrics = this.getOrCreateScenarioMetrics(data.scenarioName);
    scenarioMetrics.executionCount++;
    scenarioMetrics.failureCount++;
    
    const errorCount = scenarioMetrics.errors.get(data.error) || 0;
    scenarioMetrics.errors.set(data.error, errorCount + 1);
  }

  /**
   * Get or create scenario metrics
   */
  private getOrCreateScenarioMetrics(scenarioName: string): ScenarioMetrics {
    let metrics = this.metrics.scenarioMetrics.get(scenarioName);
    
    if (!metrics) {
      metrics = {
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        avgResponseTime: 0,
        errors: new Map(),
      };
      this.metrics.scenarioMetrics.set(scenarioName, metrics);
    }

    return metrics;
  }

  /**
   * Start monitoring system metrics
   */
  private startMonitoring(): void {
    // Monitor system resources
    this.metricsInterval = setInterval(() => {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      this.metrics.cpuUsage = 100 - (100 * totalIdle / totalTick);
      this.metrics.memoryUsage = (1 - os.freemem() / os.totalmem()) * 100;

      // Calculate throughput
      const elapsedSeconds = (performance.now() - this.startTime!) / 1000;
      this.metrics.throughput = this.metrics.totalRequests / elapsedSeconds;
      
      // Calculate error rate
      this.metrics.errorRate = this.metrics.totalRequests > 0
        ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100
        : 0;

    }, 1000); // Every second

    // Progress reporting
    this.progressInterval = setInterval(() => {
      this.emitProgress();
    }, 5000); // Every 5 seconds
  }

  /**
   * Emit progress update
   */
  private emitProgress(): void {
    const progress = {
      activeUsers: this.metrics.activeUsers,
      totalRequests: this.metrics.totalRequests,
      successRate: this.metrics.totalRequests > 0
        ? ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2)
        : 0,
      throughput: this.metrics.throughput.toFixed(2),
      avgResponseTime: this.calculateAvgResponseTime().toFixed(2),
      cpuUsage: this.metrics.cpuUsage.toFixed(2),
      memoryUsage: this.metrics.memoryUsage.toFixed(2),
    };

    this.emit('progress', progress);
    logger.info('Load test progress', progress);
  }

  /**
   * Calculate final metrics
   */
  private calculateFinalMetrics(): void {
    if (this.metrics.responseTimes.length === 0) return;

    // Sort response times for percentile calculations
    const sortedTimes = [...this.metrics.responseTimes].sort((a, b) => a - b);
    
    // Calculate percentiles
    const p50Index = Math.floor(sortedTimes.length * 0.5);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    this.emit('final-metrics', {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      errorRate: this.metrics.errorRate,
      throughput: this.metrics.throughput,
      responseTimePercentiles: {
        p50: sortedTimes[p50Index],
        p95: sortedTimes[p95Index],
        p99: sortedTimes[p99Index],
      },
      avgResponseTime: this.calculateAvgResponseTime(),
      minResponseTime: sortedTimes[0],
      maxResponseTime: sortedTimes[sortedTimes.length - 1],
    });
  }

  /**
   * Calculate average response time
   */
  private calculateAvgResponseTime(): number {
    if (this.metrics.responseTimes.length === 0) return 0;
    
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.responseTimes.length;
  }

  /**
   * Generate test report
   */
  private generateReport(): string {
    const sortedTimes = [...this.metrics.responseTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    const report = `
# OmniCare 10K User Load Test Report

## Test Configuration
- Target URL: ${this.config.targetURL}
- Target Users: ${this.config.targetUsers}
- Ramp-up Time: ${this.config.rampUpTime}s
- Test Duration: ${this.config.testDuration}s

## Overall Results
- Total Requests: ${this.metrics.totalRequests}
- Successful Requests: ${this.metrics.successfulRequests}
- Failed Requests: ${this.metrics.failedRequests}
- Error Rate: ${this.metrics.errorRate.toFixed(2)}%
- Average Throughput: ${this.metrics.throughput.toFixed(2)} req/s

## Response Time Percentiles
- 50th percentile (median): ${p50.toFixed(2)}ms
- 95th percentile: ${p95.toFixed(2)}ms
- 99th percentile: ${p99.toFixed(2)}ms
- Average: ${this.calculateAvgResponseTime().toFixed(2)}ms

## Performance Targets
- ✅ p50 Target: ${this.config.performanceTargets.responseTime.p50}ms (Actual: ${p50.toFixed(2)}ms)
- ${p95 <= this.config.performanceTargets.responseTime.p95 ? '✅' : '❌'} p95 Target: ${this.config.performanceTargets.responseTime.p95}ms (Actual: ${p95.toFixed(2)}ms)
- ${p99 <= this.config.performanceTargets.responseTime.p99 ? '✅' : '❌'} p99 Target: ${this.config.performanceTargets.responseTime.p99}ms (Actual: ${p99.toFixed(2)}ms)
- ${this.metrics.throughput >= this.config.performanceTargets.throughput ? '✅' : '❌'} Throughput Target: ${this.config.performanceTargets.throughput} req/s (Actual: ${this.metrics.throughput.toFixed(2)} req/s)
- ${this.metrics.errorRate <= this.config.performanceTargets.errorRate ? '✅' : '❌'} Error Rate Target: ${this.config.performanceTargets.errorRate}% (Actual: ${this.metrics.errorRate.toFixed(2)}%)

## Scenario Breakdown
${this.generateScenarioReport()}

## System Resources
- Peak CPU Usage: ${this.metrics.cpuUsage.toFixed(2)}%
- Peak Memory Usage: ${this.metrics.memoryUsage.toFixed(2)}%

## Recommendations
${this.generateRecommendations()}
`;

    return report;
  }

  /**
   * Generate scenario-specific report
   */
  private generateScenarioReport(): string {
    const lines: string[] = [];

    this.metrics.scenarioMetrics.forEach((metrics, scenarioName) => {
      lines.push(`\n### ${scenarioName}`);
      lines.push(`- Executions: ${metrics.executionCount}`);
      lines.push(`- Success Rate: ${((metrics.successCount / metrics.executionCount) * 100).toFixed(2)}%`);
      lines.push(`- Average Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
      
      if (metrics.errors.size > 0) {
        lines.push('- Top Errors:');
        const sortedErrors = Array.from(metrics.errors.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        sortedErrors.forEach(([error, count]) => {
          lines.push(`  - ${error}: ${count} occurrences`);
        });
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string {
    const recommendations: string[] = [];
    const sortedTimes = [...this.metrics.responseTimes].sort((a, b) => a - b);
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    if (p95 > this.config.performanceTargets.responseTime.p95) {
      recommendations.push('- Response times exceed p95 target. Consider:');
      recommendations.push('  - Implementing caching for frequently accessed data');
      recommendations.push('  - Optimizing database queries and adding indexes');
      recommendations.push('  - Scaling application servers horizontally');
    }

    if (this.metrics.errorRate > this.config.performanceTargets.errorRate) {
      recommendations.push('- Error rate exceeds target. Investigate:');
      recommendations.push('  - Connection pool exhaustion');
      recommendations.push('  - Database connection limits');
      recommendations.push('  - Application memory issues');
    }

    if (this.metrics.throughput < this.config.performanceTargets.throughput) {
      recommendations.push('- Throughput below target. Consider:');
      recommendations.push('  - Implementing request batching');
      recommendations.push('  - Adding more application instances');
      recommendations.push('  - Optimizing network configuration');
    }

    if (this.metrics.cpuUsage > 80) {
      recommendations.push('- High CPU usage detected. Consider:');
      recommendations.push('  - Profiling CPU-intensive operations');
      recommendations.push('  - Implementing async processing for heavy tasks');
      recommendations.push('  - Upgrading server specifications');
    }

    if (recommendations.length === 0) {
      recommendations.push('- All performance targets met! System is ready for 10K concurrent users.');
    }

    return recommendations.join('\n');
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Stop any remaining virtual users
    this.virtualUsers.forEach(user => user.stop());
    this.virtualUsers.clear();

    logger.info('Load test cleanup completed');
  }
}

/**
 * Virtual User implementation
 */
class VirtualUser extends EventEmitter {
  private userId: string;
  private scenario: LoadTestScenario;
  private config: LoadTestConfig;
  private httpClient: AxiosInstance;
  private websocket?: WebSocket;
  private isRunning = false;
  private context: Record<string, any> = {};

  constructor(userId: string, scenario: LoadTestScenario, config: LoadTestConfig) {
    super();
    this.userId = userId;
    this.scenario = scenario;
    this.config = config;

    this.httpClient = axios.create({
      baseURL: config.targetURL,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.executeScenario();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.websocket) {
      this.websocket.close();
    }
  }

  private async executeScenario(): Promise<void> {
    while (this.isRunning) {
      try {
        for (const step of this.scenario.steps) {
          if (!this.isRunning) break;

          const startTime = performance.now();

          try {
            await this.executeStep(step);
            
            const responseTime = performance.now() - startTime;
            this.emit('request-complete', {
              scenarioName: this.scenario.name,
              stepName: step.name,
              responseTime,
            });
          } catch (error) {
            const responseTime = performance.now() - startTime;
            this.emit('request-failed', {
              scenarioName: this.scenario.name,
              stepName: step.name,
              error: (error as Error).message,
              responseTime,
            });
          }

          // Think time between steps
          if (this.isRunning && step.type !== 'wait') {
            await this.wait(this.config.thinkTime);
          }
        }
      } catch (error) {
        logger.error(`Virtual user ${this.userId} scenario execution failed:`, error);
      }
    }
  }

  private async executeStep(step: ScenarioStep): Promise<void> {
    switch (step.type) {
      case 'http':
        await this.executeHttpStep(step);
        break;
      case 'websocket':
        await this.executeWebSocketStep(step);
        break;
      case 'wait':
        await this.wait(this.config.thinkTime * 5); // Longer wait
        break;
    }
  }

  private async executeHttpStep(step: ScenarioStep): Promise<void> {
    const url = this.replaceVariables(step.endpoint!);
    const headers = this.replaceVariables(step.headers || {});
    const payload = this.replaceVariables(step.payload);

    const response = await this.httpClient.request({
      method: step.method as any,
      url,
      headers,
      data: payload,
    });

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (step.validation && !step.validation(response)) {
      throw new Error('Response validation failed');
    }

    if (step.extractData) {
      const extracted = step.extractData(response);
      Object.assign(this.context, extracted);
    }
  }

  private async executeWebSocketStep(step: ScenarioStep): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws${this.config.targetURL.slice(4)}${step.endpoint}`;
      const headers = this.replaceVariables(step.headers || {});

      this.websocket = new WebSocket(url, { headers });

      this.websocket.on('open', () => {
        resolve();
      });

      this.websocket.on('error', (error) => {
        reject(error);
      });

      this.websocket.on('message', (data) => {
        // Handle incoming messages
        logger.debug(`WebSocket message received for user ${this.userId}`);
      });
    });
  }

  private replaceVariables(input: any): any {
    if (typeof input === 'string') {
      return input.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return this.context[key] || match;
      });
    }

    if (typeof input === 'object' && input !== null) {
      const result: any = Array.isArray(input) ? [] : {};
      
      for (const key in input) {
        result[key] = this.replaceVariables(input[key]);
      }
      
      return result;
    }

    return input;
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export the load test suite
export default LoadTestSuite;