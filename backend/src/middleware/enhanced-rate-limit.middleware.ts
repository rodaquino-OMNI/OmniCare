/**
 * OmniCare EMR Backend - Enhanced Rate Limiting Middleware
 * Provides sophisticated rate limiting with Redis backend and user-specific rules
 */

import { Request, Response, NextFunction } from 'express';

import { redisRateLimiterService, RateLimitConfig } from '../services/redis-rate-limiter.service';
import { toCanonicalRole, UserRoles } from '../types/unified-user-roles';
import logger from '../utils/logger';

export interface EnhancedRateLimitOptions {
  // Basic rate limiting
  windowMs?: number;
  maxRequests?: number;
  
  // User-specific rules
  userRoleRules?: Record<string, Partial<RateLimitConfig>>;
  authenticatedUserMultiplier?: number;
  
  // Advanced options
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableBurstProtection?: boolean;
  burstThreshold?: number;
  
  // Custom functions
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
  
  // Response options
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  message?: any;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

declare global {
  namespace Express {
    interface Request {
      rateLimit?: RateLimitInfo;
    }
  }
}

/**
 * Create enhanced rate limiting middleware
 */
export function createEnhancedRateLimit(options: EnhancedRateLimitOptions = {}) {
  const defaults: Required<EnhancedRateLimitOptions> = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    userRoleRules: {
      [UserRoles.SYSTEM_ADMIN]: { maxRequests: 1000, windowMs: 15 * 60 * 1000 },
      [UserRoles.PHYSICIAN]: { maxRequests: 500, windowMs: 15 * 60 * 1000 },
      [UserRoles.NURSING_STAFF]: { maxRequests: 300, windowMs: 15 * 60 * 1000 },
      [UserRoles.PATIENT]: { maxRequests: 50, windowMs: 15 * 60 * 1000 },
    },
    authenticatedUserMultiplier: 2,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    enableBurstProtection: true,
    burstThreshold: 100,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise IP address
      if (req.user?.id) {
        return `user:${req.user.id}`;
      }
      return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
    },
    skip: () => false,
    onLimitReached: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        identifier: defaults.keyGenerator(req),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'throttled',
        diagnostics: 'Too many requests. Please try again later.',
      }],
    },
  };

  const config = { ...defaults, ...options };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip if configured to do so
      if (config.skip(req)) {
        return next();
      }

      const identifier = config.keyGenerator(req);
      
      // Check if identifier is blocked
      const isBlocked = await redisRateLimiterService.isBlocked(identifier);
      if (isBlocked) {
        config.onLimitReached(req, res);
        res.status(429).json({
          ...config.message,
          issue: [{
            ...config.message.issue[0],
            diagnostics: 'Request blocked due to abuse. Contact support if you believe this is an error.',
          }],
        });
        return;
      }

      // Get rate limit configuration for this request
      const rateLimitConfig = getRateLimitConfigForRequest(req, config);
      
      // Check rate limit
      const result = await redisRateLimiterService.checkRateLimit(identifier, rateLimitConfig);
      
      // Add rate limit info to request
      req.rateLimit = {
        limit: rateLimitConfig.maxRequests || config.maxRequests,
        current: result.totalRequests,
        remaining: result.remainingRequests,
        resetTime: new Date(result.resetTime),
      };

      // Set headers
      if (config.standardHeaders) {
        res.set({
          'RateLimit-Limit': req.rateLimit.limit.toString(),
          'RateLimit-Remaining': req.rateLimit.remaining.toString(),
          'RateLimit-Reset': new Date(result.resetTime).toISOString(),
        });
      }

      if (config.legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': req.rateLimit.limit.toString(),
          'X-RateLimit-Remaining': req.rateLimit.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
        });
      }

      if (!result.allowed) {
        config.onLimitReached(req, res);
        
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }

        res.status(429).json(config.message);
        return;
      }

      // Allow request and track it
      next();

      // Increment counter after request completes
      res.on('finish', async () => {
        try {
          const success = res.statusCode < 400;
          await redisRateLimiterService.incrementRateLimit(
            identifier,
            rateLimitConfig,
            success
          );
        } catch (error) {
          logger.error('Failed to increment rate limit counter:', error);
        }
      });

    } catch (error) {
      logger.error('Rate limiting middleware error:', error);
      
      // If rate limiting fails, allow the request to proceed
      // This prevents the entire API from failing if Redis is down
      next();
    }
  };
}

/**
 * Get rate limit configuration based on request context
 */
function getRateLimitConfigForRequest(
  req: Request, 
  config: Required<EnhancedRateLimitOptions>
): RateLimitConfig {
  const baseConfig: RateLimitConfig = {
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    skipSuccessfulRequests: config.skipSuccessfulRequests,
    skipFailedRequests: config.skipFailedRequests,
    enableBurstProtection: config.enableBurstProtection,
    burstThreshold: config.burstThreshold,
  };

  // Apply user role-specific rules
  if (req.user?.role) {
    const canonicalRole = toCanonicalRole(req.user.role);
    const roleConfig = config.userRoleRules[canonicalRole];
    
    if (roleConfig) {
      Object.assign(baseConfig, roleConfig);
    }
  }

  // Apply authenticated user multiplier
  if (req.user?.id && config.authenticatedUserMultiplier > 1) {
    baseConfig.maxRequests = Math.floor(
      (baseConfig.maxRequests || config.maxRequests) * config.authenticatedUserMultiplier
    );
  }

  // Adjust limits based on endpoint criticality
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  const endpointConfig = getEndpointSpecificConfig(endpoint);
  
  if (endpointConfig) {
    Object.assign(baseConfig, endpointConfig);
  }

  return baseConfig;
}

/**
 * Get endpoint-specific rate limit configuration
 */
function getEndpointSpecificConfig(endpoint: string): Partial<RateLimitConfig> | null {
  // Critical endpoints - stricter limits
  const criticalEndpoints = [
    'POST /auth/login',
    'POST /auth/register',
    'POST /auth/token',
    'POST /fhir/R4/Patient',
  ];

  // High-frequency endpoints - more lenient limits
  const highFrequencyEndpoints = [
    'GET /fhir/R4/metadata',
    'GET /health',
    'GET /ping',
  ];

  // Search endpoints - moderate limits with caching considerations
  const searchEndpoints = [
    'GET /fhir/R4/Patient',
    'GET /fhir/R4/Observation',
    'GET /fhir/R4/Encounter',
  ];

  if (criticalEndpoints.some(pattern => endpoint.includes(pattern))) {
    return {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
      enableBurstProtection: true,
      burstThreshold: 20,
    };
  }

  if (highFrequencyEndpoints.some(pattern => endpoint.includes(pattern))) {
    return {
      maxRequests: 1000,
      windowMs: 15 * 60 * 1000,
      enableBurstProtection: false,
    };
  }

  if (searchEndpoints.some(pattern => endpoint.includes(pattern))) {
    return {
      maxRequests: 200,
      windowMs: 15 * 60 * 1000,
      enableBurstProtection: true,
      burstThreshold: 300,
    };
  }

  return null;
}

/**
 * Middleware to block abusive users
 */
export function createAbuseProtectionMiddleware(options: {
  errorThreshold?: number;
  timeWindow?: number;
  blockDuration?: number;
} = {}) {
  const config = {
    errorThreshold: 50, // 50 errors in time window
    timeWindow: 5 * 60 * 1000, // 5 minutes
    blockDuration: 60 * 60 * 1000, // 1 hour
    ...options,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    
    // Track response to detect error patterns
    res.on('finish', async () => {
      if (res.statusCode >= 400) {
        try {
          const errorKey = `errors:${identifier}`;
          const errorCount = await redisRateLimiterService.incrementRateLimit(
            errorKey,
            {
              windowMs: config.timeWindow,
              maxRequests: config.errorThreshold,
            },
            false // Count as error
          );

          // Block if threshold exceeded
          if (!errorCount.allowed) {
            await redisRateLimiterService.blockIdentifier(identifier, config.blockDuration);
            
            logger.warn('User blocked due to excessive errors', {
              identifier,
              errorCount: errorCount.totalRequests,
              threshold: config.errorThreshold,
              blockDuration: config.blockDuration,
            });
          }
        } catch (error) {
          logger.error('Failed to track errors for abuse protection:', error);
        }
      }
    });

    next();
  };
}

/**
 * Create admin middleware for rate limit management
 */
export function createRateLimitAdminMiddleware() {
  return {
    // Get rate limit status for identifier
    async getStatus(req: Request, res: Response): Promise<void> {
      try {
        const { identifier } = req.params;
        
        if (!identifier) {
          res.status(400).json({ error: 'Identifier required' });
          return;
        }

        const status = await redisRateLimiterService.getRateLimitStatus(identifier);
        
        if (!status) {
          res.status(404).json({ error: 'No rate limit data found for identifier' });
          return;
        }

        res.json(status);
      } catch (error) {
        logger.error('Failed to get rate limit status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    // Reset rate limit for identifier
    async resetLimit(req: Request, res: Response): Promise<void> {
      try {
        const { identifier } = req.params;
        
        if (!identifier) {
          res.status(400).json({ error: 'Identifier required' });
          return;
        }

        const success = await redisRateLimiterService.resetRateLimit(identifier);
        
        if (success) {
          res.json({ message: 'Rate limit reset successfully' });
        } else {
          res.status(500).json({ error: 'Failed to reset rate limit' });
        }
      } catch (error) {
        logger.error('Failed to reset rate limit:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    // Block identifier
    async blockIdentifier(req: Request, res: Response): Promise<void> {
      try {
        const { identifier } = req.params;
        const { duration = 3600000 } = req.body; // Default 1 hour
        
        if (!identifier) {
          res.status(400).json({ error: 'Identifier required' });
          return;
        }

        const success = await redisRateLimiterService.blockIdentifier(identifier, duration);
        
        if (success) {
          res.json({ message: 'Identifier blocked successfully' });
        } else {
          res.status(500).json({ error: 'Failed to block identifier' });
        }
      } catch (error) {
        logger.error('Failed to block identifier:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    // Unblock identifier
    async unblockIdentifier(req: Request, res: Response): Promise<void> {
      try {
        const { identifier } = req.params;
        
        if (!identifier) {
          res.status(400).json({ error: 'Identifier required' });
          return;
        }

        const success = await redisRateLimiterService.unblockIdentifier(identifier);
        
        if (success) {
          res.json({ message: 'Identifier unblocked successfully' });
        } else {
          res.status(500).json({ error: 'Failed to unblock identifier' });
        }
      } catch (error) {
        logger.error('Failed to unblock identifier:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    // Get rate limiting statistics
    async getStats(req: Request, res: Response): Promise<void> {
      try {
        const stats = await redisRateLimiterService.getRateLimitingStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get rate limiting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  };
}

// Export admin controls
export { createAdminRateLimitControls };