/**
 * Performance Test Base Framework
 * Core utilities and base classes for performance testing
 */

import { performance } from 'perf_hooks';

import pidusage from 'pidusage';

export interface PerformanceMetrics {
  duration: number;
  throughput: number;
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage: number;
  errors: number;
  successRate: number;
}

export interface TestConfiguration {
  name: string;
  concurrency: number;
  duration: number; // seconds
  warmupTime: number; // seconds
  rampUpTime: number; // seconds
  targetRps?: number; // requests per second
  maxRequests?: number;
  thresholds: {
    responseTime: number; // ms
    successRate: number; // percentage
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
  };
}

export class PerformanceTestBase {
  protected config: TestConfiguration;
  protected metrics: PerformanceMetrics;
  protected responseTimes: number[] = [];
  protected errors: number = 0;
  protected requests: number = 0;
  protected startTime: number = 0;

  constructor(config: TestConfiguration) {
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      duration: 0,
      throughput: 0,
      responseTime: {
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0
      },
      memoryUsage: {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      cpuUsage: 0,
      errors: 0,
      successRate: 0
    };
  }

  /**
   * Start performance monitoring
   */
  protected startMonitoring(): void {
    this.startTime = performance.now();
    this.responseTimes = [];
    this.errors = 0;
    this.requests = 0;
  }

  /**
   * Record a request response time
   */
  protected recordResponseTime(responseTime: number, isError: boolean = false): void {
    this.responseTimes.push(responseTime);
    this.requests++;
    if (isError) {
      this.errors++;
    }
  }

  /**
   * Calculate performance metrics
   */
  protected async calculateMetrics(): Promise<PerformanceMetrics> {
    const endTime = performance.now();
    const duration = (endTime - this.startTime) / 1000; // seconds

    // Calculate response time statistics
    this.responseTimes.sort((a, b) => a - b);
    const responseTimeStats = {
      min: this.responseTimes[0] || 0,
      max: this.responseTimes[this.responseTimes.length - 1] || 0,
      avg: this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length || 0,
      p50: this.getPercentile(this.responseTimes, 50),
      p95: this.getPercentile(this.responseTimes, 95),
      p99: this.getPercentile(this.responseTimes, 99)
    };

    // Get system resource usage
    const usage = await pidusage(process.pid);

    this.metrics = {
      duration,
      throughput: this.requests / duration,
      responseTime: responseTimeStats,
      memoryUsage: {
        rss: usage.memory / 1024 / 1024, // MB
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
        external: process.memoryUsage().external / 1024 / 1024
      },
      cpuUsage: usage.cpu,
      errors: this.errors,
      successRate: ((this.requests - this.errors) / this.requests) * 100 || 0
    };

    return this.metrics;
  }

  /**
   * Calculate percentile value from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Validate performance against thresholds
   */
  protected validateThresholds(metrics: PerformanceMetrics): boolean {
    const thresholds = this.config.thresholds;
    
    return (
      metrics.responseTime.avg <= thresholds.responseTime &&
      metrics.successRate >= thresholds.successRate &&
      metrics.memoryUsage.heapUsed <= thresholds.memoryUsage &&
      metrics.cpuUsage <= thresholds.cpuUsage
    );
  }

  /**
   * Generate performance report
   */
  public generateReport(): string {
    const isValid = this.validateThresholds(this.metrics);
    
    return `
Performance Test Report: ${this.config.name}
===============================================

Test Configuration:
- Concurrency: ${this.config.concurrency}
- Duration: ${this.config.duration}s
- Target RPS: ${this.config.targetRps || 'N/A'}

Results:
- Total Requests: ${this.requests}
- Errors: ${this.errors}
- Success Rate: ${this.metrics.successRate.toFixed(2)}%
- Throughput: ${this.metrics.throughput.toFixed(2)} req/s

Response Times:
- Min: ${this.metrics.responseTime.min.toFixed(2)}ms
- Max: ${this.metrics.responseTime.max.toFixed(2)}ms
- Avg: ${this.metrics.responseTime.avg.toFixed(2)}ms
- P50: ${this.metrics.responseTime.p50.toFixed(2)}ms
- P95: ${this.metrics.responseTime.p95.toFixed(2)}ms
- P99: ${this.metrics.responseTime.p99.toFixed(2)}ms

Resource Usage:
- Memory (Heap): ${this.metrics.memoryUsage.heapUsed.toFixed(2)}MB
- Memory (RSS): ${this.metrics.memoryUsage.rss.toFixed(2)}MB
- CPU Usage: ${this.metrics.cpuUsage.toFixed(2)}%

Threshold Validation: ${isValid ? 'PASS' : 'FAIL'}
${!isValid ? this.getThresholdFailures() : ''}
    `.trim();
  }

  private getThresholdFailures(): string {
    const failures: string[] = [];
    const { thresholds } = this.config;
    
    if (this.metrics.responseTime.avg > thresholds.responseTime) {
      failures.push(`Response time exceeded: ${this.metrics.responseTime.avg}ms > ${thresholds.responseTime}ms`);
    }
    if (this.metrics.successRate < thresholds.successRate) {
      failures.push(`Success rate below threshold: ${this.metrics.successRate}% < ${thresholds.successRate}%`);
    }
    if (this.metrics.memoryUsage.heapUsed > thresholds.memoryUsage) {
      failures.push(`Memory usage exceeded: ${this.metrics.memoryUsage.heapUsed}MB > ${thresholds.memoryUsage}MB`);
    }
    if (this.metrics.cpuUsage > thresholds.cpuUsage) {
      failures.push(`CPU usage exceeded: ${this.metrics.cpuUsage}% > ${thresholds.cpuUsage}%`);
    }
    
    return '\nThreshold Failures:\n' + failures.map(f => `- ${f}`).join('\n');
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate exponential backoff delay
   */
  protected exponentialBackoff(attempt: number, baseDelay: number = 100): number {
    return Math.min(baseDelay * Math.pow(2, attempt), 5000);
  }
}