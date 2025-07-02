/**
 * Test script for Redis distributed rate limiting and horizontal scaling
 */

import axios from 'axios';
import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { redisService } from '../src/services/redis.service';
import { redisRateLimiterService } from '../src/services/redis-rate-limiter.service';
import logger from '../src/utils/logger';

interface TestResults {
  totalRequests: number;
  blockedRequests: number;
  successfulRequests: number;
  instanceResults: Map<number, InstanceResult>;
  redisHealth: any;
  rateLimitStats: any;
}

interface InstanceResult {
  port: number;
  requestsSent: number;
  requestsBlocked: number;
  requestsSucceeded: number;
  errors: number;
}

class HorizontalScalingTest {
  private instances: ChildProcess[] = [];
  private basePort = 8080;
  private instanceCount = 3;
  private results: TestResults = {
    totalRequests: 0,
    blockedRequests: 0,
    successfulRequests: 0,
    instanceResults: new Map(),
    redisHealth: null,
    rateLimitStats: null,
  };

  /**
   * Start multiple backend instances
   */
  private async startInstances(): Promise<void> {
    logger.info(`Starting ${this.instanceCount} backend instances...`);

    for (let i = 0; i < this.instanceCount; i++) {
      const port = this.basePort + i;
      const env = {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'development',
        DISABLE_REDIS: 'false',
      };

      const instance = fork(
        path.join(__dirname, '../src/index.ts'),
        [],
        {
          env,
          silent: true,
          execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'],
        }
      );

      instance.on('message', (msg) => {
        logger.info(`Instance ${port}: ${msg}`);
      });

      instance.on('error', (err) => {
        logger.error(`Instance ${port} error:`, err);
      });

      this.instances.push(instance);
      this.results.instanceResults.set(port, {
        port,
        requestsSent: 0,
        requestsBlocked: 0,
        requestsSucceeded: 0,
        errors: 0,
      });

      // Wait for instance to start
      await this.waitForInstance(port);
    }

    logger.info(`All ${this.instanceCount} instances started`);
  }

  /**
   * Wait for instance to be ready
   */
  private async waitForInstance(port: number, maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await axios.get(`http://localhost:${port}/ping`);
        logger.info(`Instance on port ${port} is ready`);
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Instance on port ${port} failed to start`);
  }

  /**
   * Test distributed rate limiting
   */
  private async testRateLimiting(): Promise<void> {
    logger.info('Testing distributed rate limiting across instances...');

    const testDuration = 30000; // 30 seconds
    const requestsPerSecond = 50; // Per instance
    const testEndTime = Date.now() + testDuration;

    // Create concurrent request generators for each instance
    const requestGenerators = Array.from(this.results.instanceResults.entries()).map(
      ([port, result]) => this.generateRequests(port, result, testEndTime, requestsPerSecond)
    );

    // Run all generators concurrently
    await Promise.all(requestGenerators);

    // Calculate totals
    for (const result of this.results.instanceResults.values()) {
      this.results.totalRequests += result.requestsSent;
      this.results.blockedRequests += result.requestsBlocked;
      this.results.successfulRequests += result.requestsSucceeded;
    }
  }

  /**
   * Generate requests for a specific instance
   */
  private async generateRequests(
    port: number,
    result: InstanceResult,
    endTime: number,
    requestsPerSecond: number
  ): Promise<void> {
    const client = axios.create({
      baseURL: `http://localhost:${port}`,
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
    });

    const interval = 1000 / requestsPerSecond;
    
    while (Date.now() < endTime) {
      try {
        const response = await client.get('/api/patients', {
          headers: {
            'X-Test-IP': '192.168.1.100', // Same IP for all instances to test distributed limiting
          },
        });

        result.requestsSent++;

        if (response.status === 429) {
          result.requestsBlocked++;
        } else if (response.status >= 200 && response.status < 300) {
          result.requestsSucceeded++;
        }

        // Log rate limit headers
        if (result.requestsSent % 100 === 0) {
          logger.info(`Instance ${port} - Sent: ${result.requestsSent}, Blocked: ${result.requestsBlocked}`, {
            rateLimitRemaining: response.headers['x-ratelimit-remaining'],
            rateLimitLimit: response.headers['x-ratelimit-limit'],
          });
        }

      } catch (error) {
        result.errors++;
        logger.error(`Request error on port ${port}:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  /**
   * Test Redis failover
   */
  private async testRedisFailover(): Promise<void> {
    logger.info('Testing Redis failover behavior...');

    // Simulate Redis connection loss
    logger.info('Simulating Redis connection loss...');
    await redisService.shutdown();

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send requests to verify fallback behavior
    const failoverResults = await Promise.all(
      Array.from(this.results.instanceResults.keys()).map(async (port) => {
        try {
          const response = await axios.get(`http://localhost:${port}/api/patients`, {
            timeout: 5000,
          });
          return { port, status: response.status, success: true };
        } catch (error) {
          return { port, status: 0, success: false, error: error.message };
        }
      })
    );

    logger.info('Failover test results:', failoverResults);

    // Reconnect Redis
    logger.info('Reconnecting Redis...');
    await redisService.initialize();
  }

  /**
   * Collect final statistics
   */
  private async collectStatistics(): Promise<void> {
    logger.info('Collecting final statistics...');

    try {
      this.results.redisHealth = await redisService.healthCheck();
      this.results.rateLimitStats = await redisRateLimiterService.getRateLimitingStats();
    } catch (error) {
      logger.error('Failed to collect statistics:', error);
    }
  }

  /**
   * Stop all instances
   */
  private async stopInstances(): Promise<void> {
    logger.info('Stopping all instances...');
    
    for (const instance of this.instances) {
      instance.kill('SIGTERM');
    }

    // Wait for instances to stop
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Generate test report
   */
  private generateReport(): string {
    const report = `
=== Redis Horizontal Scaling Test Report ===

Test Configuration:
- Instance Count: ${this.instanceCount}
- Test Duration: 30 seconds
- Request Rate: 50 requests/second per instance

Overall Results:
- Total Requests Sent: ${this.results.totalRequests}
- Successful Requests: ${this.results.successfulRequests}
- Rate Limited Requests: ${this.results.blockedRequests}
- Success Rate: ${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%
- Block Rate: ${((this.results.blockedRequests / this.results.totalRequests) * 100).toFixed(2)}%

Per-Instance Results:
${Array.from(this.results.instanceResults.entries())
  .map(([port, result]) => `
  Port ${port}:
  - Requests Sent: ${result.requestsSent}
  - Successful: ${result.requestsSucceeded}
  - Blocked: ${result.requestsBlocked}
  - Errors: ${result.errors}`)
  .join('\n')}

Redis Health:
- Status: ${this.results.redisHealth?.status || 'Unknown'}
- Latency: ${this.results.redisHealth?.latency || 'N/A'}ms

Rate Limiting Stats:
- Total Identifiers Tracked: ${this.results.rateLimitStats?.totalIdentifiers || 0}
- Blocked Identifiers: ${this.results.rateLimitStats?.blockedIdentifiers || 0}

Conclusion:
${this.generateConclusion()}
`;

    return report;
  }

  /**
   * Generate test conclusion
   */
  private generateConclusion(): string {
    const blockRate = (this.results.blockedRequests / this.results.totalRequests) * 100;
    
    if (blockRate > 0 && blockRate < 100) {
      return `✅ Distributed rate limiting is working correctly across all ${this.instanceCount} instances.
The rate limiter successfully coordinated limits through Redis, blocking ${blockRate.toFixed(2)}% of requests
when the threshold was exceeded. All instances shared the same rate limit state.`;
    } else if (blockRate === 0) {
      return `⚠️  No requests were rate limited. This might indicate the rate limit threshold was not reached
or there's an issue with the rate limiting configuration.`;
    } else {
      return `❌ All requests were blocked. This might indicate an issue with the rate limiting configuration
or the test parameters need adjustment.`;
    }
  }

  /**
   * Run the complete test suite
   */
  async run(): Promise<void> {
    try {
      logger.info('Starting Redis horizontal scaling test...');

      // Initialize Redis
      await redisService.initialize();

      // Start instances
      await this.startInstances();

      // Run rate limiting test
      await this.testRateLimiting();

      // Test Redis failover
      await this.testRedisFailover();

      // Collect statistics
      await this.collectStatistics();

      // Generate and display report
      const report = this.generateReport();
      console.log(report);

      // Save report to file
      const fs = require('fs');
      const reportPath = path.join(__dirname, `../redis-scaling-test-${Date.now()}.txt`);
      fs.writeFileSync(reportPath, report);
      logger.info(`Report saved to: ${reportPath}`);

    } catch (error) {
      logger.error('Test failed:', error);
    } finally {
      // Cleanup
      await this.stopInstances();
      await redisService.shutdown();
      process.exit(0);
    }
  }
}

// Run test if called directly
if (require.main === module) {
  const test = new HorizontalScalingTest();
  test.run().catch(console.error);
}

export { HorizontalScalingTest };