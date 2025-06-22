import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { JWTAuthService } from '@/auth/jwt.service';
import { hasPermission, hasHigherRole } from '@/auth/role-permissions';
import config from '@/config';
import { AuditService } from '@/services/audit.service';
import { SessionManager } from '@/services/session.service';
import { smartFHIRService } from '@/services/smart-fhir.service';
import { User, UserRole, UserRoles, Permission, SessionInfo } from '@/types/auth.types';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';

// Extended Request interface to include authentication data
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: SessionInfo;
      token?: string;
      requestId?: string;
      smartAuth?: {
        id: string;
        sub: string;
        scope: string[];
        patient?: string;
        encounter?: string;
        fhirUser?: string;
        iss?: string;
        aud?: string;
        clientId?: string;
        tokenType?: string;
      };
    }
  }
}

/**
 * Authentication middleware for SMART on FHIR and OmniCare JWT authentication
 */
export class AuthMiddleware {
  private static jwtService = new JWTAuthService();
  private static sessionManager = new SessionManager();
  private static auditService = new AuditService();

  /**
   * OmniCare JWT Authentication middleware
   */
  static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        await AuthMiddleware.auditService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          severity: 'LOW',
          description: 'Missing authorization header',
          metadata: { 
            path: req.path,
            method: req.method,
            ip: req.ip,
          }
        });
        
        res.status(401).json({
          success: false,
          error: 'MISSING_AUTHORIZATION',
          message: 'Authorization header is required'
        });
        return;
      }

      const token = AuthMiddleware.jwtService.extractTokenFromHeader(authHeader);
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid authorization header format. Expected: Bearer <token>'
        });
        return;
      }

      req.token = token;

      // Verify JWT token
      const tokenPayload = await AuthMiddleware.jwtService.verifyAccessToken(token);
      
      // Get and validate session
      const session = await AuthMiddleware.sessionManager.getSession(tokenPayload.sessionId);
      if (!session) {
        res.status(401).json({
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.'
        });
        return;
      }

      // Validate session security
      const securityValidation = await AuthMiddleware.sessionManager.validateSessionSecurity(
        session,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown'
      );

      if (!securityValidation.isValid) {
        await AuthMiddleware.auditService.logSecurityEvent({
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
        await AuthMiddleware.sessionManager.destroySession(session.sessionId);

        res.status(401).json({
          success: false,
          error: 'SECURITY_VIOLATION',
          message: 'Session security validation failed. Please log in again.'
        });
        return;
      }

      // Update session activity
      const updatedSession = await AuthMiddleware.sessionManager.updateSessionActivity(session.sessionId);
      if (updatedSession) {
        req.session = updatedSession;
      }

      // Mock user lookup - replace with actual database query
      const user = await AuthMiddleware.getUserById(tokenPayload.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'USER_INACTIVE',
          message: 'User account is not active'
        });
        return;
      }

      req.user = user;

      // Log successful authentication
      await AuthMiddleware.auditService.logUserAction(
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
      await AuthMiddleware.auditService.logSecurityEvent({
        type: 'LOGIN_FAILURE',
        severity: 'MEDIUM',
        description: 'Authentication failed',
        metadata: {
          error: getErrorMessage(error),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        }
      });

      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid or expired authentication token'
      });
    }
  }

  /**
   * SMART on FHIR Authentication (for external systems)
   */
  static async smartAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'login',
            diagnostics: 'Authorization header is required',
          }],
        });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'login',
            diagnostics: 'Invalid authorization header format. Expected: Bearer <token>',
          }],
        });
        return;
      }

      const token = parts[1];
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'MISSING_TOKEN',
          message: 'No token provided'
        });
        return;
      }
      
      req.token = token;

      // Try SMART token introspection
      const introspectionResult = await smartFHIRService.introspectToken(token);
      
      if (!introspectionResult.active) {
        res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'login',
            diagnostics: 'Token is not active',
          }],
        });
        return;
      }

      req.smartAuth = {
        id: introspectionResult.sub || introspectionResult.patient,
        sub: introspectionResult.sub,
        scope: introspectionResult.scope ? introspectionResult.scope.split(' ') : [],
        patient: introspectionResult.patient,
        encounter: introspectionResult.encounter,
        fhirUser: introspectionResult.fhirUser,
        iss: introspectionResult.iss,
        aud: introspectionResult.aud,
        clientId: introspectionResult.client_id,
        tokenType: 'smart',
      };

      logger.security('SMART token authentication successful', {
        userId: req.smartAuth.id,
        clientId: req.smartAuth.clientId,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      logger.error('SMART authentication failed:', error);
      res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          diagnostics: 'Invalid or expired token',
        }],
      });
    }
  }

  /**
   * Optional authentication - allows both authenticated and unauthenticated requests
   */
  static async optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No authentication provided, continue without user context
      next();
      return;
    }

    // Authentication provided, validate it
    await AuthMiddleware.authenticate(req, res, next);
  }

  /**
   * Permission-based authorization middleware
   */
  static requirePermission(...requiredPermissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        });
        return;
      }

      const { user } = req;
      
      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(permission => 
        hasPermission(user.role, permission)
      );

      if (!hasAllPermissions) {
        await AuthMiddleware.auditService.logUserAction(
          user.id,
          'unauthorized_access_attempt',
          req.path,
          undefined,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          false,
          `Missing required permissions: ${requiredPermissions.join(', ')}`
        );

        res.status(403).json({
          success: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource'
        });
        return;
      }

      next();
    };
  }

  /**
   * Role-based authorization middleware
   */
  static requireRole(...allowedRoles: UserRole[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        });
        return;
      }

      const { user } = req;
      
      if (!allowedRoles.includes(user.role)) {
        await AuthMiddleware.auditService.logUserAction(
          user.id,
          'unauthorized_role_access',
          req.path,
          undefined,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          false,
          `User role ${user.role} not in allowed roles: ${allowedRoles.join(', ')}`
        );

        res.status(403).json({
          success: false,
          error: 'INSUFFICIENT_PRIVILEGES',
          message: 'Your role does not have access to this resource'
        });
        return;
      }

      next();
    };
  }

  /**
   * Hierarchical role authorization (user must have higher or equal role)
   */
  static requireMinimumRole(minimumRole: UserRole) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        });
        return;
      }

      const { user } = req;
      
      if (!hasHigherRole(user.role, minimumRole) && user.role !== minimumRole) {
        await AuthMiddleware.auditService.logUserAction(
          user.id,
          'insufficient_role_level',
          req.path,
          undefined,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          false,
          `User role ${user.role} below minimum required role: ${minimumRole}`
        );

        res.status(403).json({
          success: false,
          error: 'INSUFFICIENT_ROLE_LEVEL',
          message: 'Your role level is insufficient for this resource'
        });
        return;
      }

      next();
    };
  }

  /**
   * Patient-specific authorization - ensure user can access specific patient data
   */
  static requirePatientAccess(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          diagnostics: 'Authentication required',
        }],
      });
      return;
    }

    const requestedPatientId = req.params.patientId || req.params.id;
    const authorizedPatientId = req.user.patient;

    // Check if user has system-level access
    const hasSystemAccess = req.user.scope?.some(scope => 
      scope.includes('system/') || scope === '*'
    );

    if (hasSystemAccess) {
      // System-level access allows access to any patient
      next();
      return;
    }

    // For patient-level access, verify patient ID matches
    if (!authorizedPatientId) {
      logger.security('Patient access denied - no patient context', {
        userId: req.user.id,
        requestedPatientId,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'forbidden',
          diagnostics: 'No patient context available',
        }],
      });
      return;
    }

    if (requestedPatientId && authorizedPatientId !== requestedPatientId) {
      logger.security('Patient access denied - patient ID mismatch', {
        userId: req.user.id,
        authorizedPatientId,
        requestedPatientId,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'forbidden',
          diagnostics: 'Access denied to requested patient',
        }],
      });
      return;
    }

    next();
  }

  /**
   * Resource-specific authorization middleware
   */
  static requireResourceAccess(resourceType: string, operation: 'read' | 'write' | 'create' | 'delete' | '*') {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'login',
            diagnostics: 'Authentication required',
          }],
        });
        return;
      }

      const userScopes = req.user.scope || [];
      
      // Check for specific resource access
      const resourceScopes = [
        `system/${resourceType}.${operation}`,
        `system/${resourceType}.*`,
        `user/${resourceType}.${operation}`,
        `user/${resourceType}.*`,
        `patient/${resourceType}.${operation}`,
        `patient/${resourceType}.*`,
        operation === 'read' ? `system/${resourceType}.read` : null,
        operation === 'write' ? `system/${resourceType}.write` : null,
        '*',
      ].filter(Boolean) as string[];

      const hasAccess = resourceScopes.some(scope => userScopes.includes(scope));

      if (!hasAccess) {
        logger.security('Resource access denied', {
          userId: req.user.id,
          resourceType,
          operation,
          userScopes,
          path: req.path,
          method: req.method,
        });
        res.status(403).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'forbidden',
            diagnostics: `Insufficient permissions for ${resourceType} ${operation}`,
          }],
        });
        return;
      }

      next();
    };
  }

  /**
   * SMART on FHIR scope authorization middleware
   */
  static requireScope(requiredScopes: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user && !req.smartAuth) {
        res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'login',
            diagnostics: 'Authentication required',
          }],
        });
        return;
      }

      const userScopes = req.user?.scope || req.smartAuth?.scope || [];
      
      // Check if user has any of the required scopes
      const hasRequiredScope = requiredScopes.some(requiredScope => {
        // Check for exact match
        if (userScopes.includes(requiredScope)) {
          return true;
        }
        
        // Check for wildcard matches
        if (userScopes.includes('*')) {
          return true;
        }
        
        // Check for partial wildcard matches (e.g., system/* matches system/*.read)
        const scopeParts = requiredScope.split('/');
        const resourcePart = scopeParts[0];
        const permissionPart = scopeParts[1];
        
        return userScopes.some(userScope => {
          if (userScope === `${resourcePart}/*`) {
            return true;
          }
          if (permissionPart && userScope === `${resourcePart}/${permissionPart.split('.')[0]}.*`) {
            return true;
          }
          return false;
        });
      });

      if (!hasRequiredScope) {
        logger.security('Scope access denied', {
          userId: req.user?.id || req.smartAuth?.id,
          requiredScopes,
          userScopes,
          path: req.path,
          method: req.method,
        });
        res.status(403).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'forbidden',
            diagnostics: `Insufficient scopes. Required: ${requiredScopes.join(' or ')}`,
          }],
        });
        return;
      }

      next();
    };
  }

  /**
   * Admin role authorization
   */
  static requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          diagnostics: 'Authentication required',
        }],
      });
      return;
    }

    const isAdmin = req.user.scope?.includes('admin') || 
                   req.user.scope?.includes('*') ||
                   req.user.scope?.includes('system/*.*');

    if (!isAdmin) {
      logger.security('Admin access denied', {
        userId: req.user.id,
        userScopes: req.user.scope,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'forbidden',
          diagnostics: 'Administrator privileges required',
        }],
      });
      return;
    }

    next();
  }

  /**
   * Mock user lookup - replace with actual database query
   */
  private static async getUserById(userId: string): Promise<User | null> {
    try {
      // Mock implementation - replace with actual database query
      const mockUsers: Record<string, User> = {
        'user-1': {
          id: 'user-1',
          username: 'admin@omnicare.com',
          email: 'admin@omnicare.com',
          firstName: 'System',
          lastName: 'Administrator',
          role: UserRoles.SYSTEM_ADMINISTRATOR,
          department: 'IT',
          isActive: true,
          isMfaEnabled: true,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        'user-2': {
          id: 'user-2',
          username: 'doctor@omnicare.com',
          email: 'doctor@omnicare.com',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          role: UserRoles.PHYSICIAN,
          department: 'Cardiology',
          licenseNumber: 'MD123456',
          npiNumber: '1234567890',
          isActive: true,
          isMfaEnabled: true,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        'user-3': {
          id: 'user-3',
          username: 'nurse@omnicare.com',
          email: 'nurse@omnicare.com',
          firstName: 'Sarah',
          lastName: 'Johnson',
          role: UserRoles.NURSING_STAFF,
          department: 'Emergency',
          licenseNumber: 'RN789012',
          isActive: true,
          isMfaEnabled: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      return mockUsers[userId] || null;
    } catch (error) {
      logger.error('Get user by ID failed:', error);
      return null;
    }
  }

  /**
   * Rate limiting based on user or client
   */
  static createRateLimiter(windowMs: number = 15 * 60 * 1000, max: number = 100) {
    const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
    
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = req.user?.id || req.user?.clientId || req.ip || 'unknown';
      const now = Date.now();
      
      const userLimit = rateLimitStore.get(key);
      
      if (!userLimit || now > userLimit.resetTime) {
        // Reset or create new limit
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs,
        });
        
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', max - 1);
        res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
        
        next();
        return;
      }
      
      if (userLimit.count >= max) {
        logger.security('Rate limit exceeded', {
          key,
          userId: req.user?.id,
          clientId: req.user?.clientId,
          path: req.path,
          method: req.method,
          count: userLimit.count,
          limit: max,
        });
        
        res.status(429).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'throttled',
            diagnostics: 'Rate limit exceeded. Please try again later.',
          }],
        });
        return;
      }
      
      userLimit.count++;
      rateLimitStore.set(key, userLimit);
      
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - userLimit.count);
      res.setHeader('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());
      
      next();
    };
  }

  /**
   * Audit logging middleware
   */
  static auditLog(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    
    // Log request
    logger.audit('API request initiated', {
      userId: req.user?.id,
      clientId: req.user?.clientId,
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      
      logger.audit('API request completed', {
        userId: req.user?.id,
        clientId: req.user?.clientId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      
      return originalJson.call(this, body);
    };

    next();
  }
}

// Convenience exports for OmniCare authentication
export const authenticate = AuthMiddleware.authenticate;
export const authMiddleware = AuthMiddleware.authenticate; // Alias for test compatibility
export const authenticateToken = AuthMiddleware.authenticate; // Alias for backward compatibility
export const smartAuthenticate = AuthMiddleware.smartAuthenticate;
export const optionalAuthenticate = AuthMiddleware.optionalAuthenticate;
export const requirePermission = AuthMiddleware.requirePermission;
export const requirePermissions = AuthMiddleware.requirePermission; // Alias for test compatibility
export const requireRole = AuthMiddleware.requireRole;
export const requireMinimumRole = AuthMiddleware.requireMinimumRole;
export const requirePatientAccess = AuthMiddleware.requirePatientAccess;
export const requireResourceAccess = AuthMiddleware.requireResourceAccess;
export const requireAdmin = AuthMiddleware.requireAdmin;
export const auditLog = AuthMiddleware.auditLog;
export const requireScope = AuthMiddleware.requireScope;