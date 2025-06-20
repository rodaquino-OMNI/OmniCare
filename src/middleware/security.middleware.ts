/**
 * OmniCare EMR - Security Middleware
 * HIPAA-Compliant API Protection with Authentication, Authorization, and Security Controls
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import hpp from 'hpp';

import { JWTAuthService } from '@/auth/jwt.service';
import { SessionManager } from '@/services/session.service';
import { AuditService } from '@/services/audit.service';
import { AUTH_CONFIG, SECURITY_HEADERS, IP_RESTRICTIONS } from '@/config/auth.config';
import { hasPermission } from '@/auth/role-permissions';
import { User, UserRole, Permission, SessionInfo } from '@/types/auth.types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: SessionInfo;
  sessionId?: string;
}

export class SecurityMiddleware {
  private jwtService: JWTAuthService;
  private sessionManager: SessionManager;
  private auditService: AuditService;

  constructor(
    jwtService: JWTAuthService,
    sessionManager: SessionManager,
    auditService: AuditService
  ) {
    this.jwtService = jwtService;
    this.sessionManager = sessionManager;
    this.auditService = auditService;
  }

  /**
   * Security headers middleware using Helmet
   */
  public securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: SECURITY_HEADERS.contentSecurityPolicy.directives
      },
      hsts: SECURITY_HEADERS.hsts,
      noSniff: SECURITY_HEADERS.noSniff,
      xssFilter: SECURITY_HEADERS.xssFilter,
      referrerPolicy: { policy: SECURITY_HEADERS.referrerPolicy },
      permittedCrossDomainPolicies: SECURITY_HEADERS.permittedCrossDomainPolicies
    });
  }

  /**
   * General rate limiting middleware
   */
  public rateLimiting() {
    return rateLimit({
      windowMs: AUTH_CONFIG.rateLimiting.general.windowMs,
      max: AUTH_CONFIG.rateLimiting.general.max,
      standardHeaders: AUTH_CONFIG.rateLimiting.general.standardHeaders,
      legacyHeaders: AUTH_CONFIG.rateLimiting.general.legacyHeaders,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      },
      handler: (req: Request, res: Response) => {
        this.auditService.logSecurityEvent({
          type: 'UNAUTHORIZED_ACCESS',
          severity: 'MEDIUM',
          description: 'Rate limit exceeded',
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method
          }
        });

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.'
        });
      }
    });
  }

  /**
   * Input sanitization middleware
   */
  public sanitizeInput() {
    return [
      // Prevent NoSQL injection
      mongoSanitize(),
      
      // Prevent HTTP Parameter Pollution
      hpp(),
      
      // XSS protection for request body
      (req: Request, res: Response, next: NextFunction) => {
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }
        if (req.query) {
          req.query = this.sanitizeObject(req.query);
        }
        if (req.params) {
          req.params = this.sanitizeObject(req.params);
        }
        next();
      }
    ];
  }

  /**
   * IP address restriction middleware
   */
  public ipRestriction() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!IP_RESTRICTIONS.enabled) {
        return next();
      }

      const clientIp = req.ip || req.connection.remoteAddress;
      
      if (!clientIp) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Unable to determine client IP address'
        });
      }

      // Check if IP is in blocked ranges
      if (this.isIpInRanges(clientIp, IP_RESTRICTIONS.blockedRanges)) {
        this.auditService.logSecurityEvent({
          type: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: 'Blocked IP address attempted access',
          metadata: { ipAddress: clientIp, path: req.path }
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Your IP address is not allowed to access this resource'
        });
      }

      // Check if IP is in allowed ranges (if specified)
      if (IP_RESTRICTIONS.allowedRanges.length > 0) {
        if (!this.isIpInRanges(clientIp, IP_RESTRICTIONS.allowedRanges)) {
          this.auditService.logSecurityEvent({
            type: 'UNAUTHORIZED_ACCESS',
            severity: 'HIGH',
            description: 'Non-whitelisted IP address attempted access',
            metadata: { ipAddress: clientIp, path: req.path }
          });

          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'Your IP address is not authorized to access this resource'
          });
        }
      }

      next();
    };
  }

  /**
   * JWT authentication middleware
   */
  public authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.get('Authorization');
        const token = this.jwtService.extractTokenFromHelper(authHeader);

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'No authentication token provided'
          });
        }

        // Verify JWT token
        const tokenPayload = await this.jwtService.verifyAccessToken(token);
        
        // Get session information
        const session = await this.sessionManager.getSession(tokenPayload.sessionId);
        
        if (!session) {
          return res.status(401).json({
            success: false,
            error: 'Session expired',
            message: 'Your session has expired. Please log in again.'
          });
        }

        // Validate session security
        const securityValidation = await this.sessionManager.validateSessionSecurity(
          session,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown'
        );

        if (!securityValidation.isValid) {
          await this.auditService.logSecurityEvent({
            type: 'UNAUTHORIZED_ACCESS',
            userId: session.userId,
            severity: 'HIGH',
            description: 'Session security validation failed',
            metadata: {
              sessionId: session.sessionId,
              securityIssues: securityValidation.securityIssues,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            }
          });

          // Destroy compromised session
          await this.sessionManager.destroySession(session.sessionId);

          return res.status(401).json({
            success: false,
            error: 'Security validation failed',
            message: 'Session security validation failed. Please log in again.'
          });
        }

        // Update session activity
        await this.sessionManager.updateSessionActivity(session.sessionId);

        // Mock user lookup (replace with actual database query)
        const user = await this.getUserById(tokenPayload.userId);
        
        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            error: 'User not found or inactive',
            message: 'User account is not active'
          });
        }

        // Attach user and session to request
        req.user = user;
        req.session = session;
        req.sessionId = session.sessionId;

        // Log successful authentication
        await this.auditService.logUserAction(
          user.id,
          'authenticate',
          req.path,
          undefined,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          true
        );

        next();
      } catch (error) {
        // Log authentication failure
        await this.auditService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          severity: 'MEDIUM',
          description: 'Authentication failed',
          metadata: {
            error: error.message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          }
        });

        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid or expired authentication token'
        });
      }
    };
  }

  /**
   * Authorization middleware - check if user has required permissions
   */
  public authorize(requiredPermissions: Permission | Permission[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { user } = req;
        
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'User not authenticated'
          });
        }

        const permissions = Array.isArray(requiredPermissions) 
          ? requiredPermissions 
          : [requiredPermissions];

        // Check if user has all required permissions
        const hasAllPermissions = permissions.every(permission => 
          hasPermission(user.role, permission)
        );

        if (!hasAllPermissions) {
          await this.auditService.logUserAction(
            user.id,
            'unauthorized_access_attempt',
            req.path,
            undefined,
            req.ip || 'unknown',
            req.get('User-Agent') || 'unknown',
            false,
            `Missing required permissions: ${permissions.join(', ')}`
          );

          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: 'You do not have permission to access this resource'
          });
        }

        // Log successful authorization
        await this.auditService.logUserAction(
          user.id,
          'authorize',
          req.path,
          undefined,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          true,
          undefined,
          { requiredPermissions: permissions }
        );

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Authorization error',
          message: 'An error occurred during authorization'
        });
      }
    };
  }

  /**
   * Role-based authorization middleware
   */
  public requireRole(allowedRoles: UserRole | UserRole[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { user } = req;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      if (!roles.includes(user.role)) {
        this.auditService.logUserAction(
          user.id,
          'unauthorized_role_access',
          req.path,
          undefined,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          false,
          `User role ${user.role} not in allowed roles: ${roles.join(', ')}`
        );

        return res.status(403).json({
          success: false,
          error: 'Insufficient privileges',
          message: 'Your role does not have access to this resource'
        });
      }

      next();
    };
  }

  /**
   * CORS middleware with security considerations
   */
  public corsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.get('Origin');
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

      if (!origin || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      }

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * Request logging middleware
   */
  public requestLogging() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Log request
      const requestId = require('uuid').v4();
      req.requestId = requestId;

      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        const { user } = req;

        await this.auditService.logUserAction(
          user?.id || 'anonymous',
          `${req.method.toLowerCase()}_request`,
          req.path,
          requestId,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          res.statusCode < 400,
          res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            requestId
          }
        );
      });

      next();
    };
  }

  /**
   * Sanitize object recursively to prevent XSS
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return xss(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Check if IP address is in specified ranges
   */
  private isIpInRanges(ip: string, ranges: string[]): boolean {
    // Simplified IP range checking
    // In production, use a proper IP range library like 'ip-range-check'
    return ranges.some(range => {
      if (range.includes('/')) {
        // CIDR notation
        return this.isIpInCidr(ip, range);
      } else {
        // Exact match
        return ip === range;
      }
    });
  }

  /**
   * Check if IP is in CIDR range (simplified)
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    // This is a simplified implementation
    // In production, use a proper CIDR library
    const [network, prefixLength] = cidr.split('/');
    
    // For simplicity, just check if it starts with the network
    return ip.startsWith(network.split('.').slice(0, Math.ceil(parseInt(prefixLength) / 8)).join('.'));
  }

  /**
   * Mock user lookup (replace with actual database query)
   */
  private async getUserById(id: string): Promise<User | null> {
    // Mock implementation - replace with actual database query
    return null;
  }
}