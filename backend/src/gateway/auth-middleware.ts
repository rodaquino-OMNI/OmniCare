/**
 * Centralized Authentication Middleware for API Gateway
 * Handles JWT, SMART on FHIR, and API Key authentication
 */

import { IncomingMessage } from 'http';

import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { UserRoles, UserRoleUnified, toCanonicalRole } from '../types/unified-user-roles';
import logger from '../utils/logger';
import { toUserRoleLongSafe } from '../utils/role.utils';

import { AuthResult, GatewayUser } from './types';

interface ApiKeyData {
  id: string;
  name: string;
  scopes: string[];
  active: boolean;
}

interface JwtPayload {
  userId?: string;
  sub?: string;
  username?: string;
  preferred_username?: string;
  role?: string;
  scope?: string;
  patient?: string;
  encounter?: string;
}

// AuthenticatedRequest interface removed - using Express.Request type extensions from express.d.ts

interface GatewayAuthConfig {
  jwtSecret: string;
  smartFhirUrl?: string;
  introspectionUrl?: string;
  bypassPaths?: string[];
}

export class GatewayAuthMiddleware {
  private config: GatewayAuthConfig;
  private apiKeys: Map<string, ApiKeyData> = new Map(); // In production, this would be in a database

  constructor(config: GatewayAuthConfig) {
    this.config = config;
    this.initializeApiKeys();
  }

  /**
   * Initialize API keys (placeholder for database lookup)
   */
  private initializeApiKeys(): void {
    // In production, load from database
    this.apiKeys.set('omnicare-admin-key', {
      id: 'admin-api-key',
      name: 'Admin API Key',
      scopes: ['admin', 'system/*.*'],
      active: true,
    });
  }

  /**
   * Get authentication middleware
   */
  getMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if path should bypass authentication
      if (this.shouldBypassAuth(req.path)) {
        return next();
      }

      void this.authenticate(req, res, next);
    };
  }

  /**
   * Main authentication method
   */
  private async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authResult = await this.performAuthentication(req);
      
      if (!authResult.authenticated) {
        return this.sendUnauthorized(res, authResult.error || 'Authentication failed');
      }

      // Add user to request (cast to Express.User format)
      req.user = authResult.user as GatewayUser;
      req.authType = authResult.authType;

      // Log successful authentication
      logger.info('Gateway authentication successful', {
        userId: authResult.user?.id,
        authType: authResult.authType,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      logger.error('Gateway authentication error', error);
      this.sendUnauthorized(res, 'Authentication error');
    }
  }

  /**
   * Perform authentication using different methods
   */
  private async performAuthentication(req: Request): Promise<AuthResult> {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    // Try API Key authentication first
    if (apiKey) {
      return this.authenticateApiKey(apiKey);
    }

    // Try JWT/SMART authentication
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Try SMART on FHIR introspection first
        if (this.config.smartFhirUrl || this.config.introspectionUrl) {
          const smartResult = await this.authenticateSmartToken(token);
          if (smartResult.authenticated) {
            return smartResult;
          }
        }

        // Fall back to JWT authentication
        return this.authenticateJWT(token);
      }
    }

    return { authenticated: false, error: 'No valid authentication provided' };
  }

  /**
   * Authenticate using JWT
   */
  private authenticateJWT(token: string): AuthResult {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JwtPayload;
      
      // Validate JWT payload
      if (!decoded.userId && !decoded.sub) {
        return { authenticated: false, error: 'Invalid JWT payload' };
      }

      const user: GatewayUser = {
        id: decoded.userId || decoded.sub || '',
        username: decoded.username || decoded.preferred_username || 'unknown',
        role: toUserRoleLongSafe(decoded.role || 'guest', UserRoles.GUEST),
        scope: decoded.scope ? decoded.scope.split(' ') : [],
        patient: decoded.patient,
        encounter: decoded.encounter,
      };

      return {
        authenticated: true,
        authType: 'jwt',
        user,
      };
    } catch (error) {
      logger.debug('JWT authentication failed', { error: (error as Error).message });
      return { authenticated: false, error: 'Invalid JWT token' };
    }
  }

  /**
   * Authenticate using SMART on FHIR token introspection
   */
  private async authenticateSmartToken(token: string): Promise<AuthResult> {
    try {
      const introspectionUrl = this.config.introspectionUrl;
      if (!introspectionUrl) {
        return { authenticated: false, error: 'SMART introspection not configured' };
      }

      const response = await axios.post(introspectionUrl, 
        `token=${encodeURIComponent(token)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
        }
      );

      const introspection = response.data;
      
      if (!introspection.active) {
        return { authenticated: false, error: 'SMART token not active' };
      }

      const user: GatewayUser = {
        id: introspection.sub || introspection.patient || 'unknown',
        username: introspection.username || introspection.sub || 'smart-user',
        role: 'patient', // More appropriate default for SMART tokens
        scope: introspection.scope ? introspection.scope.split(' ') : [],
        patient: introspection.patient,
        encounter: introspection.encounter,
      };

      return {
        authenticated: true,
        authType: 'smart',
        user,
      };
    } catch (error) {
      logger.debug('SMART token introspection failed', { error: (error as Error).message });
      return { authenticated: false, error: 'SMART token introspection failed' };
    }
  }

  /**
   * Authenticate using API Key
   */
  private authenticateApiKey(apiKey: string): AuthResult {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData || !keyData.active) {
      return { authenticated: false, error: 'Invalid or inactive API key' };
    }

    const user: GatewayUser = {
      id: keyData.id,
      username: keyData.name || 'api-user',
      role: 'system_administrator', // More appropriate for API keys
      scope: keyData.scopes || [],
    };

    return {
      authenticated: true,
      authType: 'api-key',
      user,
    };
  }

  /**
   * Authenticate WebSocket connections
   */
  async authenticateWebSocket(request: IncomingMessage): Promise<AuthResult> {
    try {
      // Extract token from query parameters or headers
      const url = new URL(request.url || '', 'http://localhost');
      const token = url.searchParams.get('token') || 
                   request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return { authenticated: false, error: 'No token provided for WebSocket' };
      }

      // Use same authentication logic as HTTP requests
      const mockReq = {
        headers: { authorization: `Bearer ${token}` },
      } as Request;

      return this.performAuthentication(mockReq);
    } catch (error) {
      logger.error('WebSocket authentication error', error);
      return { authenticated: false, error: 'WebSocket authentication failed' };
    }
  }

  /**
   * Check if path should bypass authentication
   */
  private shouldBypassAuth(path: string): boolean {
    const bypassPaths = [
      '/health',
      '/ping',
      '/.well-known/smart_configuration',
      '/fhir/R4/metadata',
      '/cds-services',
      ...(this.config.bypassPaths || []),
    ];

    return bypassPaths.some(bypassPath => {
      if (bypassPath.includes('*')) {
        const pattern = bypassPath.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(path);
      }
      return path.startsWith(bypassPath);
    });
  }

  /**
   * Send unauthorized response
   */
  private sendUnauthorized(res: Response, message: string): void {
    res.status(401).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'login',
        diagnostics: message,
      }],
    });
  }

  /**
   * Require admin privileges middleware
   */
  requireAdmin() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      
      if (!user) {
        return this.sendUnauthorized(res, 'Authentication required');
      }

      const isAdmin = user.scope?.includes('admin') || 
                     user.scope?.includes('system/*.*') ||
                     toCanonicalRole(user.role as UserRoleUnified) === UserRoles.ADMINISTRATIVE_STAFF || 
                     toCanonicalRole(user.role as UserRoleUnified) === UserRoles.SYSTEM_ADMINISTRATOR;

      if (!isAdmin) {
        return res.status(403).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'forbidden',
            diagnostics: 'Administrator privileges required',
          }],
        });
      }

      next();
    };
  }

  /**
   * Require specific scopes middleware
   */
  requireScopes(requiredScopes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      
      if (!user) {
        return this.sendUnauthorized(res, 'Authentication required');
      }

      const userScopes = user.scope || [];
      const hasRequiredScope = requiredScopes.some(requiredScope => {
        return userScopes.some((userScope: string) => {
          // Exact match
          if (userScope === requiredScope) return true;
          
          // Wildcard match
          if (userScope === '*') return true;
          
          // Pattern match (e.g., system/* matches system/Patient.read)
          if (userScope.endsWith('*')) {
            const prefix = userScope.slice(0, -1);
            return requiredScope.startsWith(prefix);
          }
          
          return false;
        });
      });

      if (!hasRequiredScope) {
        return res.status(403).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'forbidden',
            diagnostics: `Insufficient scopes. Required: ${requiredScopes.join(' or ')}`,
          }],
        });
      }

      next();
    };
  }

  /**
   * Add API key
   */
  addApiKey(key: string, data: ApiKeyData): void {
    this.apiKeys.set(key, data);
    logger.info('API key added', { keyId: data.id });
  }

  /**
   * Remove API key
   */
  removeApiKey(key: string): void {
    this.apiKeys.delete(key);
    logger.info('API key removed', { key });
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    activeApiKeys: number;
    supportedMethods: string[];
    configuration: {
      smartFhirEnabled: boolean;
      jwtEnabled: boolean;
      apiKeyEnabled: boolean;
    };
  } {
    return {
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.active).length,
      supportedMethods: ['jwt', 'smart', 'api-key'],
      configuration: {
        smartFhirEnabled: !!(this.config.smartFhirUrl || this.config.introspectionUrl),
        jwtEnabled: !!this.config.jwtSecret,
        apiKeyEnabled: true,
      },
    };
  }
}