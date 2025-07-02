/**
 * Type definitions for OmniCare API Gateway
 */

import { Request } from 'express';

import { UserRoleUnified } from '../types/unified-user-roles';

// Use the Express.User interface for consistency across the gateway
export interface GatewayUser {
  id: string;
  username: string;
  role: UserRoleUnified | string; // Support unified roles while maintaining flexibility
  scope?: string[];
  patient?: string;
  encounter?: string;
  clientId?: string;
  permissions?: string[];
}

export interface GatewayConfig {
  port: number;
  host: string;
  ssl: {
    enabled: boolean;
    keyPath?: string;
    certPath?: string;
  };
  cors: {
    allowedOrigins: string[] | boolean;
  };
  maxRequestSize: string;
  auth: {
    jwtSecret: string;
    smartFhirUrl?: string;
    introspectionUrl?: string;
    bypassPaths?: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
    skipPaths?: string[];
  };
  loadBalancing: {
    algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash' | 'random';
    stickySession?: boolean;
    sessionKey?: string;
  };
  circuitBreaker: {
    errorThreshold: number;
    volumeThreshold: number;
    timeout: number;
    resetTimeout: number;
  };
  transformations: {
    request?: TransformationRule[];
    response?: TransformationRule[];
  };
  versioning: {
    defaultVersion: string;
    supportedVersions: string[];
    versionHeader?: string;
    versionInPath?: boolean;
  };
}

export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  weight?: number;
  healthy: boolean;
  metadata?: Record<string, unknown>;
  lastHealthCheck?: Date;
  activeConnections?: number;
}

export interface ServiceDefinition {
  name: string;
  instances: ServiceInstance[];
  healthCheck?: {
    path: string;
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  loadBalancing?: {
    algorithm?: string;
    stickySession?: boolean;
  };
  circuitBreaker?: {
    enabled: boolean;
    errorThreshold?: number;
    timeout?: number;
  };
}

export interface TransformationRule {
  pattern: string | RegExp;
  service?: string;
  transform: (data: unknown, context: TransformContext) => unknown;
}

export interface TransformContext {
  service: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  user?: GatewayUser;
}

export interface HealthCheckResult {
  healthy: boolean;
  services: Record<string, {
    healthy: boolean;
    instances: {
      id: string;
      healthy: boolean;
      lastCheck: Date;
      responseTime?: number;
      error?: string;
    }[];
  }>;
  timestamp: Date;
}

export interface MetricsData {
  requests: {
    total: number;
    byMethod: Record<string, number>;
    byService: Record<string, number>;
    byStatus: Record<string, number>;
  };
  performance: {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  errors: {
    total: number;
    byService: Record<string, number>;
    byType: Record<string, number>;
  };
  circuitBreakers: Record<string, {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    successRate: number;
  }>;
  timestamp: Date;
}

export interface RateLimitInfo {
  key: string;
  count: number;
  resetTime: Date;
  blocked: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  user?: GatewayUser;
  error?: string;
  authType?: 'jwt' | 'smart' | 'api-key';
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}