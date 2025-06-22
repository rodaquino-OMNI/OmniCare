/**
 * Rate limiting middleware for OmniCare EMR Backend
 * Implements various rate limiting strategies for API protection
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error.utils';

interface RateLimitStore {
  [key: string]: {
    count: number;
    lastReset: number;
    blocked?: boolean;
    blockUntil?: number;
  };
}

class MemoryRateLimitStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    Object.keys(this.store).forEach(key => {
      const entry = this.store[key];
      if (entry && now - entry.lastReset > oneHour) {
        delete this.store[key];
      }
    });
  }

  get(key: string): { count: number; lastReset: number; blocked?: boolean; blockUntil?: number } {
    return this.store[key] || { count: 0, lastReset: Date.now() };
  }

  set(key: string, value: { count: number; lastReset: number; blocked?: boolean; blockUntil?: number }): void {
    this.store[key] = value;
  }

  delete(key: string): void {
    delete this.store[key];
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string; // Custom error message
  statusCode?: number; // HTTP status code for rate limit exceeded
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
  onLimitReached?: (req: Request, res: Response) => void; // Callback when limit is reached
  store?: any; // Custom store (defaults to memory store)
}

/**
 * Default key generator using IP address
 */
const defaultKeyGenerator = (req: Request): string => {
  return req.ip || req.connection.remoteAddress || 'unknown';
};

/**
 * Create a rate limiting middleware
 */
export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    onLimitReached,
    store = new MemoryRateLimitStore(),
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if the skip function returns true
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const entry = store.get(key);

    // Check if currently blocked
    if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
      const resetTime = new Date(entry.blockUntil);
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toISOString(),
        'Retry-After': Math.ceil((entry.blockUntil - now) / 1000).toString(),
      });

      if (onLimitReached) {
        onLimitReached(req, res);
      }

      return next(new AppError(message, statusCode, true, 'RATE_LIMIT_EXCEEDED'));
    }

    // Reset window if needed
    if (now - entry.lastReset >= windowMs) {
      entry.count = 0;
      entry.lastReset = now;
      entry.blocked = false;
      entry.blockUntil = undefined;
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      entry.blocked = true;
      entry.blockUntil = now + windowMs;
      store.set(key, entry);

      const resetTime = new Date(entry.blockUntil);
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toISOString(),
        'Retry-After': Math.ceil(windowMs / 1000).toString(),
      });

      if (onLimitReached) {
        onLimitReached(req, res);
      }

      return next(new AppError(message, statusCode, true, 'RATE_LIMIT_EXCEEDED'));
    }

    // Increment counter (conditionally)
    let shouldCount = true;

    if (skipSuccessfulRequests || skipFailedRequests) {
      // We'll handle this in the response phase
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;
        const isSuccessful = statusCode >= 200 && statusCode < 300;
        const isFailed = statusCode >= 400;

        if ((skipSuccessfulRequests && isSuccessful) || (skipFailedRequests && isFailed)) {
          // Don't count this request
        } else {
          entry.count++;
          store.set(key, entry);
        }

        return originalSend.call(this, body);
      };
    } else {
      entry.count++;
      store.set(key, entry);
    }

    // Set rate limit headers
    const remaining = Math.max(0, max - entry.count);
    const resetTime = new Date(entry.lastReset + windowMs);

    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toISOString(),
    });

    next();
  };
}

/**
 * Predefined rate limiters for common use cases
 */
export const RateLimiters = {
  // General API rate limiting
  general: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
  }),

  // Strict rate limiting for authentication endpoints
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (req: Request) => {
      // Rate limit by IP + user agent for auth endpoints
      return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
    },
  }),

  // Very strict rate limiting for password reset
  passwordReset: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset requests per hour
    message: 'Too many password reset attempts, please try again later',
  }),

  // Moderate rate limiting for search endpoints
  search: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 search requests per minute
    message: 'Too many search requests, please slow down',
  }),

  // Lenient rate limiting for data retrieval
  read: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 read requests per minute
    message: 'Too many read requests, please slow down',
    skipFailedRequests: true, // Don't count failed requests
  }),

  // Strict rate limiting for data modification
  write: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 write requests per minute
    message: 'Too many write requests, please slow down',
  }),

  // File upload rate limiting
  upload: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 uploads per minute
    message: 'Too many file uploads, please wait before uploading again',
  }),

  // Admin endpoint rate limiting
  admin: createRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Limit each IP to 50 admin requests per 5 minutes
    message: 'Too many admin requests, please slow down',
  }),
};

/**
 * Rate limiter by user ID (requires authentication)
 */
export function createUserRateLimit(options: RateLimitOptions) {
  return createRateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      // Use user ID from request (assumes auth middleware has run)
      const userId = (req as any).user?.id || (req as any).userId;
      if (userId) {
        return `user:${userId}`;
      }
      // Fallback to IP if no user ID
      return defaultKeyGenerator(req);
    },
  });
}

/**
 * Rate limiter by API key
 */
export function createApiKeyRateLimit(options: RateLimitOptions) {
  return createRateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      if (apiKey && typeof apiKey === 'string') {
        return `apikey:${apiKey}`;
      }
      // Fallback to IP if no API key
      return defaultKeyGenerator(req);
    },
  });
}

/**
 * Sliding window rate limiter (more sophisticated)
 */
export function createSlidingWindowRateLimit(options: RateLimitOptions & { bucketSize?: number }) {
  const { bucketSize = 10 } = options;
  const bucketDuration = options.windowMs / bucketSize;

  return createRateLimit({
    ...options,
    store: new (class SlidingWindowStore extends MemoryRateLimitStore {
      get(key: string) {
        const entry = super.get(key);
        const now = Date.now();
        
        // Calculate how many full buckets have passed
        const bucketsElapsed = Math.floor((now - entry.lastReset) / bucketDuration);
        
        if (bucketsElapsed > 0) {
          // Decay the count based on elapsed buckets
          const decayFactor = Math.max(0, 1 - (bucketsElapsed / bucketSize));
          entry.count = Math.floor(entry.count * decayFactor);
          entry.lastReset = now;
        }

        return entry;
      }
    })(),
  });
}

/**
 * Export the memory store for testing
 */
export { MemoryRateLimitStore };