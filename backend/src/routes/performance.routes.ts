/**
 * Performance Monitoring API Routes
 * Enhanced real-time performance metrics and API optimization insights
 */

import { performance } from 'perf_hooks';

import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import pidusage from 'pidusage';

import config from '../config';
import { getPerformanceDashboardData } from '../middleware/api-performance-monitor.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { getCompressionStats } from '../middleware/enhanced-compression.middleware';
import { createEnhancedRateLimit } from '../middleware/enhanced-rate-limit.middleware';
import { performanceMonitoringService } from '../services/performance-monitoring.service';
import { redisCacheService } from '../services/redis-cache.service';
import logger from '../utils/logger';

const router = express.Router();

// Apply authentication and rate limiting to sensitive performance routes
router.use('/api/*', authMiddleware);
router.use('/optimization/*', authMiddleware);
router.use('/cache/clear', authMiddleware);
router.use(createEnhancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200,
  skipIf: (req) => req.user?.role === 'SYSTEM_ADMIN', // Admins get unlimited access
}));

// Performance metrics storage
let performanceMetrics: any[] = [];
let isMonitoring = false;
let monitoringInterval: NodeJS.Timeout | null = null;

// Database connection for performance queries
const dbPool = new Pool({
  connectionString: config.database.url,
  max: 5, // Separate small pool for monitoring
});

/**
 * Health check endpoint with performance metrics
 */
router.get('/health', async (req, res) => {
  const startTime = performance.now();
  
  try {
    // Test database connection
    const dbStart = performance.now();
    await dbPool.query('SELECT 1');
    const dbResponseTime = performance.now() - dbStart;
    
    // Get system metrics
    const systemMetrics = await getSystemMetrics();
    
    const totalResponseTime = performance.now() - startTime;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      performance: {
        responseTime: Math.round(totalResponseTime),
        database: {
          responseTime: Math.round(dbResponseTime),
          status: 'connected'
        },
        system: systemMetrics
      },
      thresholds: {
        responseTime: totalResponseTime < 100 ? 'good' : totalResponseTime < 500 ? 'warning' : 'critical',
        database: dbResponseTime < 50 ? 'good' : dbResponseTime < 200 ? 'warning' : 'critical',
        memory: systemMetrics.memory.heapUsed < 500 ? 'good' : systemMetrics.memory.heapUsed < 1000 ? 'warning' : 'critical',
        cpu: systemMetrics.cpu.usage < 70 ? 'good' : systemMetrics.cpu.usage < 90 ? 'warning' : 'critical'
      }
    });
  } catch (error) {
    const totalResponseTime = performance.now() - startTime;
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      performance: {
        responseTime: Math.round(totalResponseTime)
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start performance monitoring
 */
router.post('/monitoring/start', async (req, res) => {
  if (isMonitoring) {
    return res.json({ message: 'Monitoring already started', isMonitoring: true });
  }

  console.log('🔍 Starting performance monitoring...');
  isMonitoring = true;
  performanceMetrics = [];

  monitoringInterval = setInterval(async () => {
    try {
      const metrics = await collectPerformanceMetrics();
      performanceMetrics.push(metrics);
      
      // Keep only last 1000 metrics to prevent memory bloat
      if (performanceMetrics.length > 1000) {
        performanceMetrics = performanceMetrics.slice(-1000);
      }
      
      // Check for alerts
      checkPerformanceAlerts(metrics);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }, 5000); // Collect every 5 seconds

  return res.json({
    message: 'Performance monitoring started',
    isMonitoring: true,
    interval: 5000
  });
});

/**
 * Stop performance monitoring
 */
router.post('/monitoring/stop', (req, res) => {
  if (!isMonitoring) {
    return res.json({ message: 'Monitoring not started', isMonitoring: false });
  }

  console.log('🛑 Stopping performance monitoring...');
  isMonitoring = false;
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  return res.json({
    message: 'Performance monitoring stopped',
    isMonitoring: false,
    metricsCollected: performanceMetrics.length
  });
});

/**
 * Get current performance metrics
 */
router.get('/metrics', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const recentMetrics = performanceMetrics.slice(-limit);
  
  res.json({
    isMonitoring,
    totalMetrics: performanceMetrics.length,
    metrics: recentMetrics,
    summary: calculateMetricsSummary(recentMetrics)
  });
});

/**
 * Get performance dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const currentMetrics = await getSystemMetrics();
    const recentMetrics = performanceMetrics.slice(-50); // Last 50 data points
    const summary = calculateMetricsSummary(performanceMetrics);
    
    // Get FHIR endpoint performance
    const fhirMetrics = await getFHIREndpointMetrics();
    
    // Get database performance
    const dbMetrics = await getDatabaseMetrics();
    
    // Get Redis cache performance
    const cacheMetrics = await getCacheMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      isMonitoring,
      current: currentMetrics,
      recent: recentMetrics,
      summary,
      fhir: fhirMetrics,
      database: dbMetrics,
      cache: cacheMetrics,
      alerts: checkCurrentAlerts(currentMetrics)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Run performance benchmarks
 */
router.post('/benchmark', async (req, res) => {
  try {
    console.log('🚀 Starting performance benchmarks...');
    const benchmarkResults = await runPerformanceBenchmarks();
    
    res.json({
      timestamp: new Date().toISOString(),
      benchmarks: benchmarkResults,
      summary: generateBenchmarkSummary(benchmarkResults)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Benchmark failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get performance alerts
 */
router.get('/alerts', (req, res) => {
  const recentMetrics = performanceMetrics.slice(-10);
  const alerts = recentMetrics.flatMap(metric => generateAlerts(metric));
  
  res.json({
    alerts: alerts.filter(alert => alert.severity !== 'normal'),
    timestamp: new Date().toISOString()
  });
});

/**
 * Enhanced API Performance Monitoring Endpoints
 */

/**
 * GET /performance/api/metrics - Get comprehensive API performance metrics
 */
router.get('/api/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiMetrics = await performanceMonitoringService.getAPIMetrics();
    const systemMetrics = await performanceMonitoringService.getSystemMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      api: apiMetrics,
      system: systemMetrics,
    });
  } catch (error) {
    logger.error('Failed to get API performance metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve API performance metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /performance/api/slow - Get slowest API endpoints
 */
router.get('/api/slow', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const apiMetrics = await performanceMonitoringService.getAPIMetrics();
    
    const slowEndpoints = apiMetrics
      .filter(metric => metric.averageResponseTime > 500) // > 500ms
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, limit)
      .map(metric => ({
        ...metric,
        performanceGrade: getPerformanceGrade(metric.averageResponseTime),
        optimizationPriority: getOptimizationPriority(metric),
      }));

    res.json({
      timestamp: new Date().toISOString(),
      count: slowEndpoints.length,
      endpoints: slowEndpoints,
    });
  } catch (error) {
    logger.error('Failed to get slow endpoints:', error);
    res.status(500).json({
      error: 'Failed to retrieve slow endpoints',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /performance/api/errors - Get endpoints with high error rates
 */
router.get('/api/errors', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const apiMetrics = await performanceMonitoringService.getAPIMetrics();
    
    const errorEndpoints = apiMetrics
      .filter(metric => metric.errorRate > 0.01) // > 1% error rate
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit)
      .map(metric => ({
        ...metric,
        errorRatePercentage: Math.round(metric.errorRate * 100 * 100) / 100,
        reliabilityGrade: getReliabilityGrade(metric.errorRate),
      }));

    res.json({
      timestamp: new Date().toISOString(),
      count: errorEndpoints.length,
      endpoints: errorEndpoints,
    });
  } catch (error) {
    logger.error('Failed to get error endpoints:', error);
    res.status(500).json({
      error: 'Failed to retrieve error endpoints',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /performance/optimization/dashboard - Get optimization insights dashboard
 */
router.get('/optimization/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const [dashboardData, compressionStats, alerts, recommendations] = await Promise.all([
      getPerformanceDashboardData(),
      getCompressionStats(),
      performanceMonitoringService.getPerformanceAlerts(),
      performanceMonitoringService.generateOptimizationRecommendations(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      ...dashboardData,
      compression: compressionStats,
      alerts: alerts.slice(0, 10), // Latest 10 alerts
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    });
  } catch (error) {
    logger.error('Failed to get optimization dashboard data:', error);
    res.status(500).json({
      error: 'Failed to retrieve optimization dashboard data',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /performance/optimization/recommendations - Get optimization recommendations
 */
router.get('/optimization/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const recommendations = await performanceMonitoringService.generateOptimizationRecommendations();
    
    // Group recommendations by category
    const groupedRecommendations = recommendations.reduce((acc, rec) => {
      if (!acc[rec.category]) {
        acc[rec.category] = [];
      }
      acc[rec.category].push(rec);
      return acc;
    }, {} as Record<string, typeof recommendations>);

    res.json({
      timestamp: new Date().toISOString(),
      total: recommendations.length,
      byCategory: groupedRecommendations,
      prioritized: recommendations
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, 10),
    });
  } catch (error) {
    logger.error('Failed to get optimization recommendations:', error);
    res.status(500).json({
      error: 'Failed to retrieve optimization recommendations',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /performance/compression/stats - Get compression statistics
 */
router.get('/compression/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getCompressionStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      ...stats,
      efficiencyPercentage: Math.round((1 - stats.averageCompressionRatio) * 100),
      cacheHitRatePercentage: stats.totalRequests > 0 
        ? Math.round((stats.cacheHits / stats.totalRequests) * 100)
        : 0,
    });
  } catch (error) {
    logger.error('Failed to get compression statistics:', error);
    res.status(500).json({
      error: 'Failed to retrieve compression statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /performance/alerts/{alertId}/acknowledge - Acknowledge performance alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    const success = await performanceMonitoringService.acknowledgeAlert(alertId);
    
    if (success) {
      res.json({
        message: 'Alert acknowledged successfully',
        alertId,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(404).json({
        error: 'Alert not found',
        alertId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Failed to acknowledge alert:', error);
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /performance/cache/clear - Clear performance caches (admin only)
 */
router.delete('/cache/clear', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check admin permission
    if (req.user?.role !== 'SYSTEM_ADMIN') {
      res.status(403).json({
        error: 'Insufficient permissions',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { namespace } = req.query;
    let clearedCount = 0;

    if (namespace && typeof namespace === 'string') {
      // Clear specific namespace
      clearedCount = await redisCacheService.clearPattern(`${namespace}:*`);
    } else {
      // Clear all performance-related caches
      const patterns = ['api:*', 'optimization_hints:*', 'compressed:*', 'alerts:performance:*'];
      for (const pattern of patterns) {
        clearedCount += await redisCacheService.clearPattern(pattern);
      }
    }

    logger.info('Performance caches cleared', {
      clearedCount,
      namespace: namespace || 'all',
      userId: req.user?.id,
    });

    res.json({
      message: 'Cache cleared successfully',
      clearedCount,
      namespace: namespace || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString(),
    });
  }
});

// Enhanced Helper Functions

function getPerformanceGrade(responseTime: number): string {
  if (responseTime < 200) return 'A';
  if (responseTime < 500) return 'B';
  if (responseTime < 1000) return 'C';
  if (responseTime < 2000) return 'D';
  return 'F';
}

function getReliabilityGrade(errorRate: number): string {
  if (errorRate < 0.001) return 'A'; // < 0.1%
  if (errorRate < 0.005) return 'B'; // < 0.5%
  if (errorRate < 0.01) return 'C';  // < 1%
  if (errorRate < 0.05) return 'D';  // < 5%
  return 'F';
}

function getOptimizationPriority(metric: any): 'high' | 'medium' | 'low' {
  const score = metric.averageResponseTime * metric.totalRequests * (1 + metric.errorRate);
  
  if (score > 100000) return 'high';
  if (score > 10000) return 'medium';
  return 'low';
}

// Helper Functions

async function getSystemMetrics() {
  const pid = process.pid;
  const usage = await pidusage(pid);
  const memUsage = process.memoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    cpu: {
      usage: Math.round(usage.cpu * 100) / 100,
      system: Math.round(usage.cpu * 100) / 100
    },
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    },
    uptime: Math.round(process.uptime()),
    eventLoop: await getEventLoopDelay()
  };
}

async function collectPerformanceMetrics() {
  const systemMetrics = await getSystemMetrics();
  const dbMetrics = await quickDatabaseCheck();
  
  return {
    ...systemMetrics,
    database: dbMetrics
  };
}

async function getEventLoopDelay(): Promise<number> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delta = process.hrtime.bigint() - start;
      resolve(Number(delta) / 1000000); // Convert to milliseconds
    });
  });
}

async function quickDatabaseCheck() {
  try {
    const start = performance.now();
    await dbPool.query('SELECT 1');
    const responseTime = performance.now() - start;
    
    return {
      status: 'connected',
      responseTime: Math.round(responseTime)
    };
  } catch (error) {
    return {
      status: 'error',
      responseTime: null,
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

function calculateMetricsSummary(metrics: any[]) {
  if (metrics.length === 0) {
    return {
      cpu: { avg: 0, min: 0, max: 0 },
      memory: { avg: 0, min: 0, max: 0 },
      eventLoop: { avg: 0, min: 0, max: 0 }
    };
  }

  const cpuValues = metrics.map(m => m.cpu?.usage || 0);
  const memoryValues = metrics.map(m => m.memory?.heapUsed || 0);
  const eventLoopValues = metrics.map(m => m.eventLoop || 0);

  return {
    cpu: {
      avg: Math.round(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length * 100) / 100,
      min: Math.min(...cpuValues),
      max: Math.max(...cpuValues)
    },
    memory: {
      avg: Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length),
      min: Math.min(...memoryValues),
      max: Math.max(...memoryValues)
    },
    eventLoop: {
      avg: Math.round(eventLoopValues.reduce((a, b) => a + b, 0) / eventLoopValues.length * 100) / 100,
      min: Math.min(...eventLoopValues),
      max: Math.max(...eventLoopValues)
    }
  };
}

async function getFHIREndpointMetrics() {
  // Mock FHIR endpoint performance data
  // In a real implementation, this would query actual endpoint metrics
  return {
    patient: {
      avgResponseTime: 120,
      successRate: 99.2,
      requestsPerMinute: 45
    },
    observation: {
      avgResponseTime: 85,
      successRate: 99.8,
      requestsPerMinute: 78
    },
    encounter: {
      avgResponseTime: 160,
      successRate: 98.9,
      requestsPerMinute: 32
    }
  };
}

async function getDatabaseMetrics() {
  try {
    const result = await dbPool.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    return {
      connections: result.rows[0],
      queryTime: await quickDatabaseCheck(),
      poolStatus: {
        total: dbPool.totalCount,
        idle: dbPool.idleCount,
        waiting: dbPool.waitingCount
      }
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Database metrics unavailable'
    };
  }
}

function checkPerformanceAlerts(metrics: any) {
  const alerts = generateAlerts(metrics);
  alerts.forEach(alert => {
    if (alert.severity === 'critical') {
      console.warn(`🚨 CRITICAL ALERT: ${alert.message}`);
    } else if (alert.severity === 'warning') {
      console.warn(`⚠️  WARNING: ${alert.message}`);
    }
  });
}

function generateAlerts(metrics: any) {
  const alerts = [];
  
  // CPU alerts
  if (metrics.cpu?.usage > 90) {
    alerts.push({
      type: 'cpu',
      severity: 'critical',
      message: `CPU usage is critical: ${metrics.cpu.usage}%`,
      value: metrics.cpu.usage,
      threshold: 90
    });
  } else if (metrics.cpu?.usage > 70) {
    alerts.push({
      type: 'cpu',
      severity: 'warning',
      message: `CPU usage is high: ${metrics.cpu.usage}%`,
      value: metrics.cpu.usage,
      threshold: 70
    });
  }
  
  // Memory alerts
  if (metrics.memory?.heapUsed > 1000) {
    alerts.push({
      type: 'memory',
      severity: 'critical',
      message: `Memory usage is critical: ${metrics.memory.heapUsed}MB`,
      value: metrics.memory.heapUsed,
      threshold: 1000
    });
  } else if (metrics.memory?.heapUsed > 500) {
    alerts.push({
      type: 'memory',
      severity: 'warning',
      message: `Memory usage is high: ${metrics.memory.heapUsed}MB`,
      value: metrics.memory.heapUsed,
      threshold: 500
    });
  }
  
  // Event loop alerts
  if (metrics.eventLoop > 50) {
    alerts.push({
      type: 'eventLoop',
      severity: 'critical',
      message: `Event loop delay is critical: ${metrics.eventLoop}ms`,
      value: metrics.eventLoop,
      threshold: 50
    });
  } else if (metrics.eventLoop > 10) {
    alerts.push({
      type: 'eventLoop',
      severity: 'warning',
      message: `Event loop delay is high: ${metrics.eventLoop}ms`,
      value: metrics.eventLoop,
      threshold: 10
    });
  }
  
  // Database alerts
  if (metrics.database?.responseTime > 200) {
    alerts.push({
      type: 'database',
      severity: 'warning',
      message: `Database response time is high: ${metrics.database.responseTime}ms`,
      value: metrics.database.responseTime,
      threshold: 200
    });
  }
  
  return alerts;
}

function checkCurrentAlerts(metrics: any) {
  return generateAlerts(metrics);
}

async function runPerformanceBenchmarks() {
  const benchmarks = [];
  
  // Database benchmark
  const dbBenchmark = await benchmarkDatabase();
  benchmarks.push(dbBenchmark);
  
  // Memory allocation benchmark
  const memBenchmark = await benchmarkMemory();
  benchmarks.push(memBenchmark);
  
  // API response benchmark
  const apiBenchmark = await benchmarkAPI();
  benchmarks.push(apiBenchmark);
  
  return benchmarks;
}

async function benchmarkDatabase() {
  const iterations = 100;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await dbPool.query('SELECT 1');
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  
  return {
    name: 'Database Query',
    iterations,
    avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length * 100) / 100 : 0,
    minTime: times.length > 0 ? Math.round((times[0] ?? 0) * 100) / 100 : 0,
    maxTime: times.length > 0 ? Math.round((times[times.length - 1] ?? 0) * 100) / 100 : 0,
    p50: times.length > 0 ? Math.round((times[Math.floor(times.length * 0.5)] ?? 0) * 100) / 100 : 0,
    p95: times.length > 0 ? Math.round((times[Math.floor(times.length * 0.95)] ?? 0) * 100) / 100 : 0,
    p99: times.length > 0 ? Math.round((times[Math.floor(times.length * 0.99)] ?? 0) * 100) / 100 : 0
  };
}

async function benchmarkMemory() {
  const iterations = 50;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Allocate and release memory
    new Array(100000).fill(Math.random());
    const end = performance.now();
    times.push(end - start);
    // Let GC clean up
    if (global.gc) global.gc();
  }
  
  return {
    name: 'Memory Allocation',
    iterations,
    avgTime: Math.round(times.reduce((a, b) => a + b) / times.length * 100) / 100,
    minTime: Math.round(Math.min(...times) * 100) / 100,
    maxTime: Math.round(Math.max(...times) * 100) / 100
  };
}

async function benchmarkAPI() {
  // Simulate API response time benchmark
  const iterations = 20;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    const end = performance.now();
    times.push(end - start);
  }
  
  return {
    name: 'API Response',
    iterations,
    avgTime: Math.round(times.reduce((a, b) => a + b) / times.length * 100) / 100,
    minTime: Math.round(Math.min(...times) * 100) / 100,
    maxTime: Math.round(Math.max(...times) * 100) / 100
  };
}

function generateBenchmarkSummary(benchmarks: any[]) {
  return {
    totalBenchmarks: benchmarks.length,
    overallHealth: benchmarks.every(b => b.avgTime < 100) ? 'excellent' : 
                   benchmarks.every(b => b.avgTime < 500) ? 'good' : 'needs-attention',
    recommendations: generateBenchmarkRecommendations(benchmarks)
  };
}

function generateBenchmarkRecommendations(benchmarks: any[]) {
  const recommendations = [];
  
  const dbBenchmark = benchmarks.find(b => b.name === 'Database Query');
  if (dbBenchmark && dbBenchmark.avgTime > 50) {
    recommendations.push('Consider database query optimization and connection pooling');
  }
  
  const memBenchmark = benchmarks.find(b => b.name === 'Memory Allocation');
  if (memBenchmark && memBenchmark.avgTime > 100) {
    recommendations.push('Monitor memory allocation patterns and garbage collection');
  }
  
  const apiBenchmark = benchmarks.find(b => b.name === 'API Response');
  if (apiBenchmark && apiBenchmark.avgTime > 200) {
    recommendations.push('Review API endpoint performance and caching strategies');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance is within optimal thresholds');
  }
  
  return recommendations;
}

async function getCacheMetrics() {
  try {
    const { redisService } = await import('@/services/redis.service');
    const { databaseCacheService } = await import('@/services/database-cache.service');
    
    const [redisHealth, redisStats, cacheHealth, queryStats] = await Promise.all([
      redisService.healthCheck(),
      redisService.getStats(),
      databaseCacheService.getCacheHealth(),
      databaseCacheService.getStats()
    ]);
    
    return {
      redis: {
        health: redisHealth,
        stats: redisStats,
        performance: {
          latency: redisHealth.latency,
          status: redisHealth.status
        }
      },
      database: {
        queryCache: queryStats,
        health: cacheHealth
      },
      apiCache: {
        hitRate: redisStats.hitRate,
        totalRequests: redisStats.totalRequests,
        hits: redisStats.hits,
        misses: redisStats.misses
      },
      recommendations: generateCacheRecommendations(redisStats, queryStats)
    };
  } catch (error) {
    console.error('Failed to get cache metrics:', error);
    return {
      redis: { health: { status: 'error' }, stats: {}, performance: {} },
      database: { queryCache: {}, health: {} },
      apiCache: { hitRate: 0, totalRequests: 0, hits: 0, misses: 0 },
      recommendations: ['Cache metrics unavailable']
    };
  }
}

function generateCacheRecommendations(redisStats: any, queryStats: any) {
  const recommendations = [];
  
  if (redisStats.hitRate < 70) {
    recommendations.push('Cache hit rate is low - consider adjusting TTL values or cache warming strategies');
  }
  
  if (queryStats.hitRate < 50) {
    recommendations.push('Database query cache hit rate is low - review query optimization');
  }
  
  if (redisStats.totalRequests > 10000 && redisStats.hitRate > 90) {
    recommendations.push('Excellent cache performance - consider increasing cache memory if available');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Cache performance is optimal');
  }
  
  return recommendations;
}

export default router;