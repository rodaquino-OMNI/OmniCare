import request from 'supertest';
import { performance } from 'perf_hooks';
import express from 'express';
import { Pool } from 'pg';
import * as Redis from 'redis';
import autocannon from 'autocannon';
import { MedplumClient } from '@medplum/core';
import { Patient, Bundle, Encounter, Observation } from '@medplum/fhirtypes';

// Import server components
import config from '../../backend/src/config';
import routes from '../../backend/src/routes';

interface PerformanceMetrics {
  operation: string;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  throughput: number;
  errorRate: number;
  concurrentUsers: number;
}

describe('OmniCare EMR Performance Benchmarks', () => {
  let app: express.Application;
  let server: any;
  let dbPool: Pool;
  let redisClient: any;
  let authToken: string;
  const performanceResults: PerformanceMetrics[] = [];

  beforeAll(async () => {
    // Initialize Express app
    app = express();
    app.use(express.json());
    app.use('/api', routes);
    server = app.listen(3002);

    // Initialize database connection
    dbPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'omnicare_test',
      user: process.env.DB_USER || 'omnicare',
      password: process.env.DB_PASSWORD || 'omnicare123',
      max: 20, // Maximum number of clients in the pool
    });

    // Initialize Redis connection
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();

    // Get auth token for tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'performance_test',
        password: 'test123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    // Generate performance report
    generatePerformanceReport(performanceResults);
    
    // Cleanup
    await dbPool?.end();
    await redisClient?.quit();
    server?.close();
  });

  describe('1. Authentication Performance', () => {
    test('should handle high-volume login requests', async () => {
      const metrics = await runLoadTest({
        url: 'http://localhost:3002/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'performance_test',
          password: 'test123',
        }),
        connections: 100,
        duration: 30,
        title: 'Authentication Load Test',
      });

      performanceResults.push({
        operation: 'Authentication',
        ...metrics,
      });

      // Performance assertions
      expect(metrics.p95).toBeLessThan(200); // 95th percentile under 200ms
      expect(metrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate
      expect(metrics.throughput).toBeGreaterThan(100); // At least 100 req/s
    });

    test('should efficiently validate JWT tokens', async () => {
      const iterations = 10000;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .get('/api/fhir/R4/metadata')
          .set('Authorization', `Bearer ${authToken}`);
        const end = performance.now();
        timings.push(end - start);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const sortedTimings = timings.sort((a, b) => a - b);
      const p95Time = sortedTimings[Math.floor(iterations * 0.95)];

      expect(avgTime).toBeLessThan(10); // Average under 10ms
      expect(p95Time).toBeLessThan(20); // 95th percentile under 20ms
    });
  });

  describe('2. Patient Data Operations Performance', () => {
    test('should handle concurrent patient searches efficiently', async () => {
      const metrics = await runLoadTest({
        url: 'http://localhost:3002/api/fhir/R4/Patient?_count=10',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        connections: 200,
        duration: 60,
        title: 'Patient Search Load Test',
      });

      performanceResults.push({
        operation: 'Patient Search',
        ...metrics,
      });

      expect(metrics.p95).toBeLessThan(150); // 95th percentile under 150ms
      expect(metrics.throughput).toBeGreaterThan(200); // At least 200 req/s
    });

    test('should create patients with acceptable latency', async () => {
      const testPatient = {
        resourceType: 'Patient',
        name: [{ given: ['Performance'], family: 'Test' }],
        gender: 'male',
        birthDate: '1990-01-01',
      };

      const metrics = await runLoadTest({
        url: 'http://localhost:3002/api/fhir/R4/Patient',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPatient),
        connections: 50,
        duration: 30,
        title: 'Patient Creation Load Test',
      });

      performanceResults.push({
        operation: 'Patient Creation',
        ...metrics,
      });

      expect(metrics.p95).toBeLessThan(300); // 95th percentile under 300ms
      expect(metrics.errorRate).toBeLessThan(0.05); // Less than 5% error rate
    });

    test('should retrieve patient records quickly with caching', async () => {
      // Create a test patient first
      const createResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'Patient',
          name: [{ given: ['Cache'], family: 'Test' }],
          gender: 'female',
          birthDate: '1985-05-15',
        });

      const patientId = createResponse.body.id;

      // First retrieval (cache miss)
      const firstMetrics = await measureSingleRequest(
        `http://localhost:3002/api/fhir/R4/Patient/${patientId}`,
        'GET',
        { 'Authorization': `Bearer ${authToken}` }
      );

      // Subsequent retrievals (cache hits)
      const cachedMetrics = await runLoadTest({
        url: `http://localhost:3002/api/fhir/R4/Patient/${patientId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        connections: 100,
        duration: 10,
        title: 'Cached Patient Retrieval',
      });

      // Cached requests should be significantly faster
      expect(cachedMetrics.avgResponseTime).toBeLessThan(firstMetrics.responseTime * 0.5);
      expect(cachedMetrics.p99).toBeLessThan(50); // 99th percentile under 50ms for cached
    });
  });

  describe('3. Clinical Workflow Performance', () => {
    test('should handle high-volume vital signs recording', async () => {
      const vitalsData = {
        encounterId: 'test-encounter',
        vitals: {
          temperature: 98.6,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 72,
          respiratoryRate: 16,
          oxygenSaturation: 98,
        },
      };

      const metrics = await runLoadTest({
        url: 'http://localhost:3002/api/vitals/test-patient-123',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vitalsData),
        connections: 100,
        duration: 30,
        title: 'Vital Signs Recording',
      });

      performanceResults.push({
        operation: 'Vital Signs Recording',
        ...metrics,
      });

      expect(metrics.p95).toBeLessThan(250); // 95th percentile under 250ms
      expect(metrics.throughput).toBeGreaterThan(100); // At least 100 req/s
    });

    test('should process batch operations efficiently', async () => {
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: Array(10).fill(null).map((_, i) => ({
          request: {
            method: 'GET',
            url: `Patient?_count=1&_offset=${i}`,
          },
        })),
      };

      const metrics = await runLoadTest({
        url: 'http://localhost:3002/api/fhir/R4',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchBundle),
        connections: 50,
        duration: 30,
        title: 'Batch Operations',
      });

      performanceResults.push({
        operation: 'Batch Processing',
        ...metrics,
      });

      expect(metrics.p95).toBeLessThan(500); // 95th percentile under 500ms for batch
      expect(metrics.errorRate).toBeLessThan(0.02); // Less than 2% error rate
    });
  });

  describe('4. Database Performance', () => {
    test('should maintain connection pool efficiency', async () => {
      const poolStats: any[] = [];
      
      // Monitor pool during load test
      const monitorInterval = setInterval(async () => {
        const stats = await dbPool.query(`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections,
            count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting_connections
          FROM pg_stat_activity 
          WHERE application_name = 'omnicare'
        `);
        poolStats.push(stats.rows[0]);
      }, 1000);

      // Run load test
      await runLoadTest({
        url: 'http://localhost:3002/api/fhir/R4/Patient?_count=20',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        connections: 200,
        duration: 30,
      });

      clearInterval(monitorInterval);

      // Analyze pool performance
      const maxConnections = Math.max(...poolStats.map(s => parseInt(s.total_connections)));
      const avgActiveConnections = poolStats.reduce((sum, s) => sum + parseInt(s.active_connections), 0) / poolStats.length;

      expect(maxConnections).toBeLessThanOrEqual(25); // Pool limit + some overhead
      expect(avgActiveConnections).toBeLessThan(15); // Efficient connection usage
    });

    test('should execute complex queries efficiently', async () => {
      const complexQueries = [
        // Patient search with multiple parameters
        'Patient?name=Smith&gender=female&birthdate=ge1980-01-01&birthdate=le1990-12-31',
        // Encounter search with includes
        'Encounter?patient=test-patient&_include=Encounter:practitioner&_include=Encounter:location',
        // Observation search with sorting
        'Observation?patient=test-patient&category=vital-signs&_sort=-date&_count=50',
      ];

      const queryMetrics: any[] = [];

      for (const query of complexQueries) {
        const metrics = await measureSingleRequest(
          `http://localhost:3002/api/fhir/R4/${query}`,
          'GET',
          { 'Authorization': `Bearer ${authToken}` }
        );
        queryMetrics.push({ query, ...metrics });
      }

      // All complex queries should complete within reasonable time
      queryMetrics.forEach(metric => {
        expect(metric.responseTime).toBeLessThan(200); // Under 200ms
      });
    });
  });

  describe('5. Cache Performance', () => {
    test('should demonstrate effective caching strategy', async () => {
      const testData = {
        resourceType: 'Patient',
        name: [{ given: ['Cache'], family: 'Performance' }],
        gender: 'male',
        birthDate: '1990-01-01',
      };

      // Create patient
      const createResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData);

      const patientId = createResponse.body.id;

      // Measure cache effectiveness
      const cacheTestResults = [];

      // Cold cache
      await redisClient.flushAll();
      const coldCacheMetrics = await measureSingleRequest(
        `http://localhost:3002/api/fhir/R4/Patient/${patientId}`,
        'GET',
        { 'Authorization': `Bearer ${authToken}` }
      );
      cacheTestResults.push({ type: 'cold', ...coldCacheMetrics });

      // Warm cache
      for (let i = 0; i < 5; i++) {
        const warmCacheMetrics = await measureSingleRequest(
          `http://localhost:3002/api/fhir/R4/Patient/${patientId}`,
          'GET',
          { 'Authorization': `Bearer ${authToken}` }
        );
        cacheTestResults.push({ type: 'warm', ...warmCacheMetrics });
      }

      // Calculate improvement
      const coldTime = cacheTestResults.find(r => r.type === 'cold')!.responseTime;
      const avgWarmTime = cacheTestResults
        .filter(r => r.type === 'warm')
        .reduce((sum, r) => sum + r.responseTime, 0) / 5;

      const cacheImprovement = ((coldTime - avgWarmTime) / coldTime) * 100;

      expect(cacheImprovement).toBeGreaterThan(50); // At least 50% improvement
      expect(avgWarmTime).toBeLessThan(20); // Cached responses under 20ms
    });

    test('should handle cache invalidation correctly', async () => {
      const patientData = {
        resourceType: 'Patient',
        name: [{ given: ['Invalidation'], family: 'Test' }],
        gender: 'female',
        birthDate: '1995-03-20',
      };

      // Create patient
      const createResponse = await request(app)
        .post('/api/fhir/R4/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData);

      const patientId = createResponse.body.id;

      // Warm the cache
      await request(app)
        .get(`/api/fhir/R4/Patient/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Update patient (should invalidate cache)
      const updatedData = {
        ...patientData,
        id: patientId,
        name: [{ given: ['InvalidationUpdated'], family: 'Test' }],
      };

      await request(app)
        .put(`/api/fhir/R4/Patient/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData);

      // Retrieve again
      const getResponse = await request(app)
        .get(`/api/fhir/R4/Patient/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should get updated data
      expect(getResponse.body.name[0].given[0]).toBe('InvalidationUpdated');
    });
  });

  describe('6. Scalability Testing', () => {
    test('should handle increasing load gracefully', async () => {
      const loadLevels = [50, 100, 200, 400];
      const scalabilityMetrics: any[] = [];

      for (const connections of loadLevels) {
        const metrics = await runLoadTest({
          url: 'http://localhost:3002/api/fhir/R4/Patient?_count=5',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          connections,
          duration: 20,
          title: `Scalability Test - ${connections} connections`,
        });

        scalabilityMetrics.push({
          connections,
          ...metrics,
        });
      }

      // Analyze scalability
      // Response time should not increase linearly with load
      const baselineMetrics = scalabilityMetrics[0];
      const maxLoadMetrics = scalabilityMetrics[scalabilityMetrics.length - 1];

      const responseTimeIncrease = (maxLoadMetrics.p95 / baselineMetrics.p95);
      const loadIncrease = maxLoadMetrics.connections / baselineMetrics.connections;

      // Response time should increase sub-linearly
      expect(responseTimeIncrease).toBeLessThan(loadIncrease * 0.5);

      // Throughput should scale reasonably
      expect(maxLoadMetrics.throughput).toBeGreaterThan(baselineMetrics.throughput * 2);
    });
  });

  describe('7. Memory and Resource Usage', () => {
    test('should not have memory leaks under sustained load', async () => {
      const memorySnapshots: any[] = [];
      const duration = 60; // 1 minute test

      // Take initial memory snapshot
      const initialMemory = process.memoryUsage();
      memorySnapshots.push({ time: 0, ...initialMemory });

      // Monitor memory during load test
      const memoryInterval = setInterval(() => {
        const memory = process.memoryUsage();
        memorySnapshots.push({
          time: memorySnapshots.length,
          ...memory,
        });
      }, 5000); // Every 5 seconds

      // Run sustained load test
      await runLoadTest({
        url: 'http://localhost:3002/api/fhir/R4/Patient',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        connections: 100,
        duration,
      });

      clearInterval(memoryInterval);

      // Allow garbage collection
      if (global.gc) {
        global.gc();
      }
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Take final memory snapshot
      const finalMemory = process.memoryUsage();

      // Memory should not grow significantly
      const heapGrowth = ((finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed) * 100;
      expect(heapGrowth).toBeLessThan(25); // Less than 25% growth

      // Check for steady state (memory stabilizes)
      const lastSnapshots = memorySnapshots.slice(-5);
      const memoryVariance = calculateVariance(lastSnapshots.map(s => s.heapUsed));
      expect(memoryVariance).toBeLessThan(0.1); // Low variance indicates stability
    });
  });
});

// Helper Functions

async function runLoadTest(options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  connections: number;
  duration: number;
  title?: string;
}): Promise<PerformanceMetrics> {
  return new Promise((resolve) => {
    const instance = autocannon({
      ...options,
      duration: options.duration,
      connections: options.connections,
      pipelining: 1,
      bailout: 1000, // Stop if error rate too high
    }, (err, result) => {
      if (err) {
        console.error('Load test error:', err);
      }

      const metrics: PerformanceMetrics = {
        operation: options.title || 'Unknown',
        avgResponseTime: result.latency.mean,
        minResponseTime: result.latency.min,
        maxResponseTime: result.latency.max,
        p50: result.latency.p50,
        p90: result.latency.p90,
        p95: result.latency.p95,
        p99: result.latency.p99,
        throughput: result.throughput.mean,
        errorRate: result.errors / result.requests.total,
        concurrentUsers: options.connections,
      };

      resolve(metrics);
    });

    // Optional: Log progress
    autocannon.track(instance, { renderProgressBar: false });
  });
}

async function measureSingleRequest(
  url: string,
  method: string,
  headers: Record<string, string>
): Promise<{ responseTime: number; statusCode: number }> {
  const start = performance.now();
  
  const response = await fetch(url, {
    method,
    headers,
  });
  
  const end = performance.now();
  
  return {
    responseTime: end - start,
    statusCode: response.status,
  };
}

function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDifferences = numbers.map(x => Math.pow(x - mean, 2));
  const variance = squaredDifferences.reduce((a, b) => a + b, 0) / numbers.length;
  return variance / (mean * mean); // Coefficient of variation
}

function generatePerformanceReport(results: PerformanceMetrics[]) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalOperations: results.length,
      avgResponseTime: results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length,
      maxP95: Math.max(...results.map(r => r.p95)),
      overallThroughput: results.reduce((sum, r) => sum + r.throughput, 0),
    },
    details: results,
    recommendations: generateRecommendations(results),
  };

  console.log('\n=== OmniCare EMR Performance Report ===\n');
  console.log(JSON.stringify(report, null, 2));

  // Save to file
  const fs = require('fs');
  const reportPath = '/Users/rodrigo/claude-projects/OmniCare/tests/integration/performance-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

function generateRecommendations(results: PerformanceMetrics[]): string[] {
  const recommendations: string[] = [];

  // Check for slow operations
  const slowOperations = results.filter(r => r.p95 > 300);
  if (slowOperations.length > 0) {
    recommendations.push(
      `Optimize these slow operations: ${slowOperations.map(op => op.operation).join(', ')}`
    );
  }

  // Check for high error rates
  const highErrorOperations = results.filter(r => r.errorRate > 0.05);
  if (highErrorOperations.length > 0) {
    recommendations.push(
      `Investigate high error rates in: ${highErrorOperations.map(op => op.operation).join(', ')}`
    );
  }

  // Check throughput
  const lowThroughputOperations = results.filter(r => r.throughput < 50);
  if (lowThroughputOperations.length > 0) {
    recommendations.push(
      `Improve throughput for: ${lowThroughputOperations.map(op => op.operation).join(', ')}`
    );
  }

  // General recommendations
  if (results.some(r => r.p99 > 1000)) {
    recommendations.push('Consider implementing request queuing for peak loads');
  }

  if (results.some(r => r.concurrentUsers > 200 && r.errorRate > 0.01)) {
    recommendations.push('Implement circuit breakers for better fault tolerance');
  }

  return recommendations;
}