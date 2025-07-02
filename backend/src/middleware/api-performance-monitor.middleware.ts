/**
 * OmniCare EMR Backend - API Performance Monitoring Middleware
 * Advanced middleware for tracking API performance metrics and optimizations
 */

import { Request, Response, NextFunction } from 'express';

import { performanceMonitoringService } from '../services/performance-monitoring.service';
import { redisCacheService } from '../services/redis-cache.service';
import logger from '../utils/logger';

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  cacheHit?: boolean;
  queryCount?: number;
  payloadSize?: number;
  compressionRatio?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

declare global {
  namespace Express {
    interface Request {
      performanceMetrics?: PerformanceMetrics;
    }
  }
}

/**
 * Enhanced API performance monitoring middleware
 */
export function createAPIPerformanceMonitor(options: {
  trackMemory?: boolean;
  trackQueries?: boolean;
  logSlowRequests?: boolean;
  slowThreshold?: number;
  enableOptimizationHints?: boolean;
} = {}) {
  const config = {
    trackMemory: true,
    trackQueries: true,
    logSlowRequests: true,
    slowThreshold: 1000, // 1 second
    enableOptimizationHints: true,
    ...options,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const startMemory = config.trackMemory ? process.memoryUsage() : undefined;

    // Initialize performance tracking
    req.performanceMetrics = {
      startTime,
      memoryUsage: startMemory,
      queryCount: 0,
      cacheHit: false,
    };

    // Intercept response to measure performance
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(data: any) {
      measureAndTrackPerformance(req, res, data, config, startTime, startMemory);
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      measureAndTrackPerformance(req, res, data, config, startTime, startMemory);
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Measure and track API performance metrics
 */
function measureAndTrackPerformance(
  req: Request,
  res: Response,
  data: any,
  config: any,
  startTime: number,
  startMemory?: NodeJS.MemoryUsage
): void {
  try {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const endMemory = config.trackMemory ? process.memoryUsage() : undefined;

    // Calculate payload size
    const payloadSize = data ? Buffer.byteLength(JSON.stringify(data), 'utf8') : 0;

    // Update performance metrics
    if (req.performanceMetrics) {
      req.performanceMetrics.endTime = endTime;
      req.performanceMetrics.duration = duration;
      req.performanceMetrics.payloadSize = payloadSize;
    }

    // Calculate compression ratio if compression is enabled
    const compressionRatio = calculateCompressionRatio(res, payloadSize);

    // Set performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Payload-Size', `${payloadSize}B`);
    
    if (compressionRatio) {
      res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(2));
    }

    // Memory usage headers (if tracking enabled)
    if (startMemory && endMemory) {
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      res.setHeader('X-Memory-Delta', `${memoryDelta}B`);
    }

    // Cache status from other middleware
    const cacheStatus = res.getHeader('X-Cache-Status') || 'MISS';
    const isCacheHit = cacheStatus === 'HIT';

    // Track metrics asynchronously
    setImmediate(async () => {
      try {
        await performanceMonitoringService.trackAPIRequest(
          req.path,
          req.method,
          duration,
          res.statusCode,
          isCacheHit
        );

        // Log slow requests
        if (config.logSlowRequests && duration > config.slowThreshold) {
          logger.warn('Slow API request detected', {
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode,
            payloadSize,
            memoryDelta: startMemory && endMemory ? endMemory.heapUsed - startMemory.heapUsed : undefined,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id,
          });
        }

        // Store optimization hints
        if (config.enableOptimizationHints) {
          await storeOptimizationHints(req, res, duration, payloadSize, isCacheHit);
        }

      } catch (error) {
        logger.error('Failed to track API performance metrics:', error);
      }
    });

  } catch (error) {
    logger.error('Error in performance measurement:', error);
  }
}

/**
 * Calculate compression ratio if available
 */
function calculateCompressionRatio(res: Response, originalSize: number): number | null {
  const contentEncoding = res.getHeader('Content-Encoding');
  
  if (contentEncoding && originalSize > 0) {
    // This is an approximation - actual compressed size would need to be measured differently
    // For gzip, typical compression ratio is 60-80% for JSON
    if (contentEncoding === 'gzip') {
      return 0.7; // Approximate 70% compression
    }
    if (contentEncoding === 'br') {
      return 0.8; // Approximate 80% compression for Brotli
    }
  }
  
  return null;
}

/**
 * Store optimization hints for future improvements
 */
async function storeOptimizationHints(
  req: Request,
  res: Response,
  duration: number,
  payloadSize: number,
  cacheHit: boolean
): Promise<void> {
  try {
    const endpoint = `${req.method} ${req.path}`;
    const hintsKey = `optimization_hints:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    const hints = {
      endpoint,
      avgResponseTime: duration,
      avgPayloadSize: payloadSize,
      cacheHitRate: cacheHit ? 1 : 0,
      lastAccessed: new Date().toISOString(),
      recommendations: generateOptimizationRecommendations(req, duration, payloadSize, cacheHit),
    };

    // Store hints with 1-hour TTL
    await redisCacheService.set(hintsKey, hints, { ttl: 3600 });

  } catch (error) {
    logger.error('Failed to store optimization hints:', error);
  }
}

/**
 * Generate optimization recommendations based on performance metrics
 */
function generateOptimizationRecommendations(
  req: Request,
  duration: number,
  payloadSize: number,
  cacheHit: boolean
): string[] {
  const recommendations: string[] = [];

  // Response time recommendations
  if (duration > 2000) {
    recommendations.push('Consider implementing pagination for large datasets');
    recommendations.push('Add database query optimization or indexing');
    recommendations.push('Implement response caching for this endpoint');
  } else if (duration > 1000) {
    recommendations.push('Consider selective field loading (_elements parameter)');
    recommendations.push('Review database query efficiency');
  }

  // Payload size recommendations
  if (payloadSize > 500000) { // 500KB
    recommendations.push('Implement field selection to reduce payload size');
    recommendations.push('Consider pagination for large result sets');
    recommendations.push('Add compression if not already enabled');
  } else if (payloadSize > 100000) { // 100KB
    recommendations.push('Consider using _summary parameter for lightweight responses');
  }

  // Cache recommendations
  if (!cacheHit && req.method === 'GET') {
    recommendations.push('This endpoint could benefit from caching');
    recommendations.push('Consider implementing Redis caching for repeated requests');
  }

  // Query-specific recommendations
  if (req.query && Object.keys(req.query).length > 5) {
    recommendations.push('Consider optimizing search parameters');
    recommendations.push('Implement search result caching');
  }

  return recommendations;
}

/**
 * Middleware to add optimization hints to response headers (for development)
 */
export function addOptimizationHintsHeaders() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      const endpoint = `${req.method} ${req.path}`;
      const hintsKey = `optimization_hints:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      try {
        const hints = await redisCacheService.get(hintsKey);
        if (hints && (hints as any).recommendations) {
          res.setHeader('X-Optimization-Hints', (hints as any).recommendations.join('; '));
        }
      } catch (error) {
        // Silently ignore errors in development hints
      }
    }
    next();
  };
}

/**
 * Create performance monitoring dashboard data
 */
export async function getPerformanceDashboardData(): Promise<{
  slowEndpoints: Array<{ endpoint: string; avgResponseTime: number; recommendations: string[] }>;
  largePayloads: Array<{ endpoint: string; avgPayloadSize: number; recommendations: string[] }>;
  cacheMisses: Array<{ endpoint: string; cacheHitRate: number; recommendations: string[] }>;
}> {
  try {
    const hintsKeys = await redisCacheService.keys('optimization_hints:*');
    const allHints: any[] = [];

    for (const key of hintsKeys) {
      const hints = await redisCacheService.get(key);
      if (hints) {
        allHints.push(hints);
      }
    }

    return {
      slowEndpoints: allHints
        .filter(h => h.avgResponseTime > 1000)
        .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        .slice(0, 10),
      largePayloads: allHints
        .filter(h => h.avgPayloadSize > 50000)
        .sort((a, b) => b.avgPayloadSize - a.avgPayloadSize)
        .slice(0, 10),
      cacheMisses: allHints
        .filter(h => h.cacheHitRate < 0.5)
        .sort((a, b) => a.cacheHitRate - b.cacheHitRate)
        .slice(0, 10),
    };
  } catch (error) {
    logger.error('Failed to get performance dashboard data:', error);
    return {
      slowEndpoints: [],
      largePayloads: [],
      cacheMisses: [],
    };
  }
}