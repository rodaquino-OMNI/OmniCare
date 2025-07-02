/**
 * OmniCare EMR Backend - Redis-based Rate Limiting Service
 * Provides distributed rate limiting with sliding window and burst protection
 */

import { redisCacheService } from './redis-cache.service';

import config from '@/config';
import logger from '@/utils/logger';

export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  skipOnError?: boolean;   // Skip rate limiting if Redis is down
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean;     // Only count successful requests
  enableBurstProtection?: boolean;  // Enable burst protection
  burstThreshold?: number; // Burst threshold (requests per minute)
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime: number;
  remainingRequests: number;
  totalRequests: number;
  retryAfter?: number;
}

export interface RateLimitStatus {
  identifier: string;
  requestCount: number;
  resetTime: number;
  blocked: boolean;
  burstProtected?: boolean;
}

export class RedisRateLimiterService {
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.maxRequests,
    skipOnError: true,
    enableBurstProtection: true,
    burstThreshold: 100, // 100 requests per minute burst threshold
  };

  /**
   * Check rate limit for identifier
   */
  async checkRateLimit(
    identifier: string,
    rateLimitConfig: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const config = { ...this.defaultConfig, ...rateLimitConfig };
    
    try {
      // Use sliding window rate limiting
      return await this.slidingWindowRateLimit(identifier, config);
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      
      if (config.skipOnError) {
        // Allow request if Redis is down and skipOnError is true
        return {
          allowed: true,
          resetTime: Date.now() + config.windowMs,
          remainingRequests: config.maxRequests,
          totalRequests: 0,
        };
      }
      
      // Deny request if Redis is down and skipOnError is false
      return {
        allowed: false,
        resetTime: Date.now() + config.windowMs,
        remainingRequests: 0,
        totalRequests: config.maxRequests,
        retryAfter: Math.ceil(config.windowMs / 1000),
      };
    }
  }

  /**
   * Increment rate limit counter for identifier
   */
  async incrementRateLimit(
    identifier: string,
    rateLimitConfig: Partial<RateLimitConfig> = {},
    success = true
  ): Promise<RateLimitResult> {
    const config = { ...this.defaultConfig, ...rateLimitConfig };
    
    // Skip counting based on configuration
    if (config.skipSuccessfulRequests && success) {
      return this.checkRateLimit(identifier, rateLimitConfig);
    }
    
    if (config.skipFailedRequests && !success) {
      return this.checkRateLimit(identifier, rateLimitConfig);
    }

    try {
      return await this.slidingWindowIncrement(identifier, config);
    } catch (error) {
      logger.error('Rate limit increment failed:', error);
      return this.checkRateLimit(identifier, rateLimitConfig);
    }
  }

  /**
   * Get rate limit status for identifier
   */
  async getRateLimitStatus(identifier: string): Promise<RateLimitStatus | null> {
    try {
      const windowKey = redisCacheService.generateRateLimitKey(identifier, 'window');
      const burstKey = redisCacheService.generateRateLimitKey(identifier, 'burst');
      
      const [windowData, burstData] = await Promise.all([
        redisCacheService.get<{ count: number; resetTime: number }>(windowKey),
        redisCacheService.get<{ count: number; resetTime: number }>(burstKey),
      ]);

      if (!windowData) {
        return null;
      }

      return {
        identifier,
        requestCount: windowData.count,
        resetTime: windowData.resetTime,
        blocked: windowData.count >= this.defaultConfig.maxRequests,
        burstProtected: burstData ? burstData.count >= (this.defaultConfig.burstThreshold || 100) : false,
      };
    } catch (error) {
      logger.error('Failed to get rate limit status:', error);
      return null;
    }
  }

  /**
   * Reset rate limit for identifier
   */
  async resetRateLimit(identifier: string): Promise<boolean> {
    try {
      const windowKey = redisCacheService.generateRateLimitKey(identifier, 'window');
      const burstKey = redisCacheService.generateRateLimitKey(identifier, 'burst');
      
      await Promise.all([
        redisCacheService.del(windowKey),
        redisCacheService.del(burstKey),
      ]);

      logger.info('Rate limit reset for identifier', { identifier });
      return true;
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
      return false;
    }
  }

  /**
   * Block identifier for specified duration
   */
  async blockIdentifier(identifier: string, durationMs: number): Promise<boolean> {
    try {
      const blockKey = redisCacheService.generateRateLimitKey(identifier, 'blocked');
      const expiryTime = Date.now() + durationMs;
      
      await redisCacheService.set(
        blockKey, 
        { blocked: true, expiryTime }, 
        { ttl: Math.ceil(durationMs / 1000) }
      );

      logger.warn('Identifier blocked', { identifier, durationMs });
      return true;
    } catch (error) {
      logger.error('Failed to block identifier:', error);
      return false;
    }
  }

  /**
   * Unblock identifier
   */
  async unblockIdentifier(identifier: string): Promise<boolean> {
    try {
      const blockKey = redisCacheService.generateRateLimitKey(identifier, 'blocked');
      await redisCacheService.del(blockKey);
      
      logger.info('Identifier unblocked', { identifier });
      return true;
    } catch (error) {
      logger.error('Failed to unblock identifier:', error);
      return false;
    }
  }

  /**
   * Check if identifier is blocked
   */
  async isBlocked(identifier: string): Promise<boolean> {
    try {
      const blockKey = redisCacheService.generateRateLimitKey(identifier, 'blocked');
      const blockData = await redisCacheService.get<{ blocked: boolean; expiryTime: number }>(blockKey);
      
      if (!blockData) {
        return false;
      }

      if (Date.now() > blockData.expiryTime) {
        // Block has expired, clean it up
        await redisCacheService.del(blockKey);
        return false;
      }

      return blockData.blocked;
    } catch (error) {
      logger.error('Failed to check if identifier is blocked:', error);
      return false;
    }
  }

  /**
   * Get rate limiting statistics
   */
  async getRateLimitingStats(): Promise<{
    totalIdentifiers: number;
    blockedIdentifiers: number;
    topRequesters: Array<{ identifier: string; requestCount: number }>;
  }> {
    try {
      // Get all rate limit keys
      const keys = await redisCacheService.keys('rate_limit:*:window');
      const blockedKeys = await redisCacheService.keys('rate_limit:*:blocked');
      
      // Get top requesters
      const requestCounts: Array<{ identifier: string; requestCount: number }> = [];
      
      for (const key of keys.slice(0, 100)) { // Limit to prevent performance issues
        const data = await redisCacheService.get<{ count: number }>(key);
        if (data) {
          const identifier = this.extractIdentifierFromKey(key);
          requestCounts.push({ identifier, requestCount: data.count });
        }
      }

      // Sort by request count
      requestCounts.sort((a, b) => b.requestCount - a.requestCount);

      return {
        totalIdentifiers: keys.length,
        blockedIdentifiers: blockedKeys.length,
        topRequesters: requestCounts.slice(0, 10), // Top 10
      };
    } catch (error) {
      logger.error('Failed to get rate limiting stats:', error);
      return {
        totalIdentifiers: 0,
        blockedIdentifiers: 0,
        topRequesters: [],
      };
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const keys = await redisCacheService.keys('rate_limit:*');
      let cleanedUp = 0;

      for (const key of keys) {
        const exists = await redisCacheService.exists(key);
        if (!exists) {
          cleanedUp++;
        }
      }

      logger.info('Rate limit cleanup completed', { cleanedUp });
      return cleanedUp;
    } catch (error) {
      logger.error('Failed to cleanup expired entries:', error);
      return 0;
    }
  }

  // Private methods

  /**
   * Sliding window rate limiting implementation
   */
  private async slidingWindowRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const windowKey = redisCacheService.generateRateLimitKey(identifier, 'window');
    
    // Check if blocked
    if (await this.isBlocked(identifier)) {
      return {
        allowed: false,
        resetTime: now + config.windowMs,
        remainingRequests: 0,
        totalRequests: config.maxRequests,
        retryAfter: Math.ceil(config.windowMs / 1000),
      };
    }

    // Get current window data
    const windowData = await redisCacheService.get<{ count: number; resetTime: number; timestamps: number[] }>(windowKey);
    
    if (!windowData) {
      return {
        allowed: true,
        resetTime: now + config.windowMs,
        remainingRequests: config.maxRequests - 1,
        totalRequests: 0,
      };
    }

    // Filter timestamps within the current window
    const validTimestamps = (windowData.timestamps || []).filter(ts => ts > windowStart);
    const currentCount = validTimestamps.length;

    // Check burst protection
    if (config.enableBurstProtection && config.burstThreshold) {
      const burstResult = await this.checkBurstProtection(identifier, config.burstThreshold);
      if (!burstResult.allowed) {
        return burstResult;
      }
    }

    const allowed = currentCount < config.maxRequests;
    const remainingRequests = Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0));

    return {
      allowed,
      resetTime: now + config.windowMs,
      remainingRequests,
      totalRequests: currentCount,
      retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000),
    };
  }

  /**
   * Increment sliding window counter
   */
  private async slidingWindowIncrement(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const windowKey = redisCacheService.generateRateLimitKey(identifier, 'window');
    
    // Get current window data
    const windowData = await redisCacheService.get<{ count: number; resetTime: number; timestamps: number[] }>(windowKey);
    
    // Filter and update timestamps
    const existingTimestamps = windowData?.timestamps || [];
    const validTimestamps = existingTimestamps.filter(ts => ts > windowStart);
    validTimestamps.push(now);

    const newData = {
      count: validTimestamps.length,
      resetTime: now + config.windowMs,
      timestamps: validTimestamps,
    };

    // Store updated data
    await redisCacheService.set(windowKey, newData, { ttl: Math.ceil(config.windowMs / 1000) });

    // Update burst protection if enabled
    if (config.enableBurstProtection && config.burstThreshold) {
      await this.updateBurstProtection(identifier, config.burstThreshold);
    }

    const allowed = newData.count <= config.maxRequests;
    const remainingRequests = Math.max(0, config.maxRequests - newData.count);

    return {
      allowed,
      resetTime: newData.resetTime,
      remainingRequests,
      totalRequests: newData.count,
      retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000),
    };
  }

  /**
   * Check burst protection (requests per minute)
   */
  private async checkBurstProtection(identifier: string, burstThreshold: number): Promise<RateLimitResult> {
    const now = Date.now();
    const minuteStart = now - 60000; // 1 minute window
    const burstKey = redisCacheService.generateRateLimitKey(identifier, 'burst');
    
    const burstData = await redisCacheService.get<{ count: number; resetTime: number; timestamps: number[] }>(burstKey);
    
    if (!burstData) {
      return { allowed: true, resetTime: now + 60000, remainingRequests: burstThreshold, totalRequests: 0 };
    }

    // Filter timestamps within the last minute
    const validTimestamps = (burstData.timestamps || []).filter(ts => ts > minuteStart);
    const currentCount = validTimestamps.length;

    const allowed = currentCount < burstThreshold;
    
    return {
      allowed,
      resetTime: now + 60000,
      remainingRequests: Math.max(0, burstThreshold - currentCount),
      totalRequests: currentCount,
      retryAfter: allowed ? undefined : 60, // 1 minute retry
    };
  }

  /**
   * Update burst protection counter
   */
  private async updateBurstProtection(identifier: string, burstThreshold: number): Promise<void> {
    const now = Date.now();
    const minuteStart = now - 60000; // 1 minute window
    const burstKey = redisCacheService.generateRateLimitKey(identifier, 'burst');
    
    const burstData = await redisCacheService.get<{ count: number; resetTime: number; timestamps: number[] }>(burstKey);
    
    // Filter and update timestamps
    const existingTimestamps = burstData?.timestamps || [];
    const validTimestamps = existingTimestamps.filter(ts => ts > minuteStart);
    validTimestamps.push(now);

    const newData = {
      count: validTimestamps.length,
      resetTime: now + 60000,
      timestamps: validTimestamps,
    };

    // Store updated data
    await redisCacheService.set(burstKey, newData, { ttl: 60 });
  }

  /**
   * Extract identifier from Redis key
   */
  private extractIdentifierFromKey(key: string): string {
    const parts = key.split(':');
    return parts.length >= 3 ? parts[1] : 'unknown';
  }
}

// Export singleton instance
export const redisRateLimiterService = new RedisRateLimiterService();