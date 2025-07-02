// Stub implementation for rate limiter
import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export class GatewayRateLimiter {
  constructor(_config: RateLimitConfig) {}
  
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      next();
    };
  }
}

export function createRateLimit(_config: RateLimitConfig) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}