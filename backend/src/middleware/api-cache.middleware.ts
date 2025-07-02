/**
 * OmniCare EMR Backend - API Response Caching Middleware
 * High-performance API response caching with Redis
 */

import crypto from 'crypto';

import { Request, Response, NextFunction } from 'express';

import { redisService } from '@/services/redis.service';
import logger from '@/utils/logger';

interface CacheOptions {
  ttl?: number;
  varyBy?: string[];
  skipIf?: (req: Request, res: Response) => boolean;
  keyGenerator?: (req: Request) => string;
}

const DEFAULT_TTL = 300; // 5 minutes
const API_CACHE_NAMESPACE = 'api';

/**
 * Create API caching middleware
 */
export function createApiCache(options: CacheOptions = {}) {
  const {
    ttl = DEFAULT_TTL,
    varyBy = ['url', 'query'],
    skipIf,
    keyGenerator
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if condition is met
    if (skipIf && skipIf(req, res)) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator ? keyGenerator(req) : generateCacheKey(req, varyBy);
      
      // Try to get cached response
      const cachedResponse = await redisService.get<{
        statusCode: number;
        headers: Record<string, string>;
        body: any;
        timestamp: number;
      }>(cacheKey, {
        namespace: API_CACHE_NAMESPACE
      });

      if (cachedResponse) {
        // Serve from cache
        logger.debug(`API cache HIT: ${req.path}`);
        
        // Set cached headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', Math.floor((Date.now() - cachedResponse.timestamp) / 1000));
        
        return res.status(cachedResponse.statusCode).json(cachedResponse.body);
      }

      // Cache miss - intercept response
      logger.debug(`API cache MISS: ${req.path}`);
      
      // Store original json method
      const originalJson = res.json;
      const originalStatus = res.status;
      let statusCode = 200;
      
      // Intercept status method
      res.status = function(code: number) {
        statusCode = code;
        return originalStatus.call(this, code);
      };
      
      // Intercept json method
      res.json = function(body: any) {
        // Only cache successful responses
        if (statusCode >= 200 && statusCode < 300) {
          const cacheData = {
            statusCode,
            headers: extractCacheableHeaders(res),
            body,
            timestamp: Date.now()
          };
          
          // Cache the response asynchronously
          redisService.set(cacheKey, cacheData, {
            namespace: API_CACHE_NAMESPACE,
            ttl
          }).catch(error => {
            logger.error('Failed to cache API response:', error);
          });
        }
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS');
        
        return originalJson.call(this, body);
      };
      
      next();
    } catch (error) {
      logger.error('API cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache middleware for FHIR resources
 */
export function fhirResourceCache(ttl: number = 600) {
  return createApiCache({
    ttl,
    varyBy: ['url', 'query', 'headers.authorization'],
    keyGenerator: (req) => {
      // Extract resource type and ID from FHIR path
      const pathMatch = req.path.match(/\/fhir\/R4\/([^/]+)(?:\/([^/]+))?/);
      if (pathMatch) {
        const [, resourceType, id] = pathMatch;
        const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
        return `fhir:${resourceType}:${id || 'search'}:${crypto.createHash('md5').update(queryString).digest('hex')}`;
      }
      return generateCacheKey(req, ['url', 'query']);
    },
    skipIf: (req) => {
      // Skip caching for write operations or real-time data
      return req.path.includes('/vital-signs') || req.path.includes('/alerts');
    }
  });
}

/**
 * Cache middleware for patient data
 */
export function patientDataCache(ttl: number = 900) {
  return createApiCache({
    ttl,
    varyBy: ['url', 'query', 'headers.authorization'],
    keyGenerator: (req) => {
      const patientMatch = req.path.match(/\/patients?\/([^/]+)/);
      if (patientMatch) {
        const [, patientId] = patientMatch;
        const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
        return `patient:${patientId}:${crypto.createHash('md5').update(queryString).digest('hex')}`;
      }
      return generateCacheKey(req, ['url', 'query']);
    }
  });
}

/**
 * Cache middleware for analytics data
 */
export function analyticsCache(ttl: number = 1800) {
  return createApiCache({
    ttl,
    varyBy: ['url', 'query', 'headers.authorization'],
    skipIf: (req) => {
      // Skip caching for real-time analytics
      return req.query.realtime === 'true';
    }
  });
}

/**
 * Invalidate API cache by pattern
 */
export async function invalidateApiCache(pattern: string): Promise<number> {
  try {
    logger.info(`Invalidating API cache with pattern: ${pattern}`);
    return await redisService.clearNamespace(`${API_CACHE_NAMESPACE}`);
  } catch (error) {
    logger.error('Failed to invalidate API cache:', error);
    return 0;
  }
}

/**
 * Invalidate cache for specific resource
 */
export async function invalidateResourceCache(resourceType: string, id?: string): Promise<void> {
  try {
    if (id) {
      // Invalidate specific resource
      const pattern = `fhir:${resourceType}:${id}:`;
      logger.debug(`Invalidating resource cache: ${pattern}`);
    } else {
      // Invalidate all resources of type
      const pattern = `fhir:${resourceType}:`;
      logger.debug(`Invalidating resource type cache: ${pattern}`);
    }
    
    // This is a simplified implementation
    // In production, you would use Redis SCAN with MATCH to find and delete matching keys
  } catch (error) {
    logger.error(`Failed to invalidate resource cache ${resourceType}/${id}:`, error);
  }
}

/**
 * Get API cache statistics
 */
export async function getApiCacheStats(): Promise<{
  cacheStats: any;
  namespaceInfo: any;
}> {
  try {
    const cacheStats = redisService.getStats();
    const redisInfo = await redisService.getInfo();
    
    return {
      cacheStats,
      namespaceInfo: redisInfo?.keyspace || {}
    };
  } catch (error) {
    logger.error('Failed to get API cache stats:', error);
    return {
      cacheStats: redisService.getStats(),
      namespaceInfo: {}
    };
  }
}

// Helper functions

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, varyBy: string[]): string {
  const parts: string[] = [];
  
  if (varyBy.includes('url')) {
    parts.push(req.path);
  }
  
  if (varyBy.includes('query')) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    parts.push(sortedQuery);
  }
  
  if (varyBy.includes('headers.authorization')) {
    // Use user ID from JWT instead of full token for privacy
    const auth = req.headers.authorization;
    if (auth) {
      const userId = extractUserIdFromAuth(auth);
      parts.push(`user:${userId}`);
    }
  }
  
  const combined = parts.join('|');
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Extract cacheable headers from response
 */
function extractCacheableHeaders(res: Response): Record<string, string> {
  const cacheableHeaders: Record<string, string> = {};
  
  // Include important headers that should be cached
  const headersToCache = [
    'content-type',
    'content-encoding',
    'etag',
    'last-modified'
  ];
  
  headersToCache.forEach(header => {
    const value = res.getHeader(header);
    if (value) {
      cacheableHeaders[header] = String(value);
    }
  });
  
  return cacheableHeaders;
}

/**
 * Extract user ID from authorization header
 */
function extractUserIdFromAuth(authHeader: string): string {
  try {
    // This is a simplified implementation
    // In production, you would decode the JWT and extract the user ID
    const token = authHeader.replace('Bearer ', '');
    return crypto.createHash('md5').update(token).digest('hex').substring(0, 8);
  } catch {
    return 'anonymous';
  }
}
