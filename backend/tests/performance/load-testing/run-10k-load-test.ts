/**
 * Runner script for 10K user load test
 */

import { createWriteStream } from 'fs';
import { join } from 'path';

import logger from '../../../src/utils/logger';

import LoadTestSuite from './10k-user-load-test';

async function run10KLoadTest() {
  const loadTest = new LoadTestSuite();
  const reportPath = join(__dirname, `load-test-report-${Date.now()}.md`);
  const reportStream = createWriteStream(reportPath);

  console.log('🚀 Starting OmniCare 10K User Load Test');
  console.log('=====================================');

  // Configure test based on environment
  const config = {
    targetURL: process.env.LOAD_TEST_URL || 'http://localhost:3000',
    targetUsers: parseInt(process.env.LOAD_TEST_USERS || '10000'),
    rampUpTime: parseInt(process.env.LOAD_TEST_RAMP_UP || '300'),
    testDuration: parseInt(process.env.LOAD_TEST_DURATION || '1800'),
  };

  // Progress tracking
  let lastProgress: any = {};
  
  loadTest.on('progress', (progress) => {
    lastProgress = progress;
    console.log(`
📊 Progress Update:
  Active Users: ${progress.activeUsers}
  Total Requests: ${progress.totalRequests}
  Success Rate: ${progress.successRate}%
  Throughput: ${progress.throughput} req/s
  Avg Response Time: ${progress.avgResponseTime}ms
  CPU Usage: ${progress.cpuUsage}%
  Memory Usage: ${progress.memoryUsage}%
    `);
  });

  loadTest.on('users-ramped', (data) => {
    console.log(`👥 Users: ${data.current}/${data.target}`);
  });

  loadTest.on('final-metrics', (metrics) => {
    console.log('\n✅ Test Completed!');
    console.log('==================');
    console.log(`Total Requests: ${metrics.totalRequests}`);
    console.log(`Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${metrics.errorRate.toFixed(2)}%`);
    console.log(`Throughput: ${metrics.throughput.toFixed(2)} req/s`);
    console.log('\nResponse Time Percentiles:');
    console.log(`  p50: ${metrics.responseTimePercentiles.p50.toFixed(2)}ms`);
    console.log(`  p95: ${metrics.responseTimePercentiles.p95.toFixed(2)}ms`);
    console.log(`  p99: ${metrics.responseTimePercentiles.p99.toFixed(2)}ms`);
  });

  try {
    // Run the load test
    const results = await loadTest.run(config);

    // Write report
    reportStream.write(loadTest['generateReport']());
    reportStream.end();

    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Check if targets were met
    const targets = config.targetUsers >= 10000;
    if (targets && results.errorRate <= 1 && results.throughput >= 5000) {
      console.log('\n🎉 SUCCESS: System passed 10K concurrent user test!');
      process.exit(0);
    } else {
      console.log('\n⚠️  WARNING: Some performance targets were not met.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Load test interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Load test terminated');
  process.exit(143);
});

// Run the test
run10KLoadTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});