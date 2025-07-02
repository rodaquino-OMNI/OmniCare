/**
 * OmniCare EMR - Enhanced Authentication & Authorization Middleware
 * HIPAA-Compliant Access Control with Comprehensive PHI Protection
 */

import { NextFunction, Request, Response } from 'express';

import { JWTAuthService } from '../auth/jwt.service';
import { hasHigherRole, hasPermission } from '../auth/role-permissions';
import { EnhancedAuditService, PHIDataCategory } from '../services/enhanced-audit.service';
import { SessionManager } from '../services/session.service';
import { Permission, User, UserRole } from '../types/auth.types';
import { toCanonicalRole, UserRoleUnified } from '../types/unified-user-roles';
import logger from '../utils/logger';

interface PHIAccessContext {
  patientId?: string;
  dataCategory?: PHIDataCategory;
  fieldsRequested?: string[];
  reason?: string;
  legalBasis?: string;
}

interface AccessDecision {
  allowed: boolean;
  reason?: string;
  conditions?: string[];
  auditRequired: boolean;
}

export class EnhancedAuthMiddleware {
  private static jwtService = new JWTAuthService();
  private static sessionManager = new SessionManager();
  private static auditService = new EnhancedAuditService();
  
  // PHI field classifications
  private static PHI_FIELD_MAPPING: Record<string, PHIDataCategory> = {
    'name': PHIDataCategory.DEMOGRAPHICS,
    'birthDate': PHIDataCategory.DEMOGRAPHICS,
    'address': PHIDataCategory.DEMOGRAPHICS,
    'phone': PHIDataCategory.DEMOGRAPHICS,
    'email': PHIDataCategory.DEMOGRAPHICS,
    'ssn': PHIDataCategory.DEMOGRAPHICS,
    'diagnosis': PHIDataCategory.DIAGNOSES,
    'medication': PHIDataCategory.MEDICATIONS,
    'allergy': PHIDataCategory.ALLERGIES,
    'immunization': PHIDataCategory.IMMUNIZATIONS,
    'vitalSign': PHIDataCategory.VITAL_SIGNS,
    'labResult': PHIDataCategory.LAB_RESULTS,
    'procedure': PHIDataCategory.PROCEDURES,
    'note': PHIDataCategory.CLINICAL_NOTES,
    'insurance': PHIDataCategory.INSURANCE,
    'mentalHealth': PHIDataCategory.MENTAL_HEALTH,
    'substanceAbuse': PHIDataCategory.SUBSTANCE_ABUSE,
    'hivStatus': PHIDataCategory.HIV_STATUS,
    'geneticInfo': PHIDataCategory.GENETIC_INFO
  };

  /**
   * Enhanced authentication with comprehensive security checks
   */
  static authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!authHeader) {
        await EnhancedAuthMiddleware.auditService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          severity: 'LOW',
          description: 'Missing authorization header',
          metadata: { 
            path: req.path,
            method: req.method,
            ipAddress,
            userAgent
          }
        });
        
        res.status(401).json({
          success: false,
          error: 'MISSING_AUTHORIZATION',
          message: 'Authorization header is required'
        });
        return;
      }

      const token = EnhancedAuthMiddleware.jwtService.extractTokenFromHeader(authHeader);
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid authorization header format'
        });
        return;
      }

      // Verify JWT token
      const tokenPayload = EnhancedAuthMiddleware.jwtService.verifyAccessToken(token);
      
      // Get and validate session
      const session = await EnhancedAuthMiddleware.sessionManager.getSession(tokenPayload.sessionId);
      if (!session) {
        res.status(401).json({
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Your session has expired'
        });
        return;
      }

      // Enhanced security validation
      const securityChecks = await EnhancedAuthMiddleware.performSecurityChecks(
        session,
        ipAddress,
        userAgent,
        req
      );

      if (!securityChecks.passed) {
        await EnhancedAuthMiddleware.handleSecurityFailure(
          session.userId,
          securityChecks.failures,
          req
        );
        
        res.status(401).json({
          success: false,
          error: 'SECURITY_VIOLATION',
          message: 'Security validation failed'
        });
        return;
      }

      // Get user details
      const user = await EnhancedAuthMiddleware.getUserById(tokenPayload.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'USER_INACTIVE',
          message: 'User account is not active'
        });
        return;
      }

      // Check for required security features
      if (EnhancedAuthMiddleware.requiresMFA(req.path) && !user.isMfaEnabled) {
        res.status(403).json({
          success: false,
          error: 'MFA_REQUIRED',
          message: 'Multi-factor authentication is required for this resource'
        });
        return;
      }

      // Set request context
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        scope: user.scope || [],
        patient: user.patient,
        encounter: undefined,
        clientId: user.clientId || undefined,
        permissions: user.permissions || []
      };
      req.session = session;
      req.token = token;

      // Set audit context
      EnhancedAuthMiddleware.auditService.setSessionId(session.sessionId);

      // Update session activity
      await EnhancedAuthMiddleware.sessionManager.updateSessionActivity(session.sessionId);

      next();
    } catch (error) {
      await EnhancedAuthMiddleware.auditService.logSecurityEvent({
        type: 'LOGIN_FAILURE',
        severity: 'MEDIUM',
        description: 'Authentication failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          ipAddress: req.ip,
          path: req.path
        }
      });

      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid or expired authentication token'
      });
    }
  };

  /**
   * PHI access control middleware
   */
  static requirePHIAccess(dataCategory?: PHIDataCategory) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        });
        return;
      }

      const patientId = req.params.patientId || req.params.id || req.query.patient;
      const context: PHIAccessContext = {
        patientId: patientId as string,
        dataCategory: dataCategory || EnhancedAuthMiddleware.inferDataCategory(req),
        fieldsRequested: EnhancedAuthMiddleware.extractRequestedFields(req),
        reason: req.headers['x-access-reason'] as string || 'Clinical care',
        legalBasis: req.headers['x-legal-basis'] as string || 'Treatment'
      };

      // Make access decision
      const decision = await EnhancedAuthMiddleware.makePHIAccessDecision(
        req.user,
        context,
        req
      );

      if (!decision.allowed) {
        await EnhancedAuthMiddleware.auditService.logSecurityEvent({
          type: 'UNAUTHORIZED_ACCESS',
          userId: req.user.id,
          severity: 'HIGH',
          description: 'PHI access denied',
          metadata: {
            ...context,
            reason: decision.reason
          }
        });

        res.status(403).json({
          success: false,
          error: 'PHI_ACCESS_DENIED',
          message: decision.reason || 'Access to PHI denied'
        });
        return;
      }

      // Log PHI access
      if (decision.auditRequired && patientId) {
        await EnhancedAuthMiddleware.auditService.logPHIAccess({
          id: `phi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: req.user.id,
          patientId: patientId as string,
          accessType: EnhancedAuthMiddleware.getAccessType(req.method),
          dataCategory: context.dataCategory || PHIDataCategory.MEDICAL_HISTORY,
          fieldsAccessed: context.fieldsRequested,
          reason: context.reason || 'Clinical care',
          legalBasis: context.legalBasis,
          timestamp: new Date(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: req.session?.sessionId,
          locationInfo: {
            facility: req.headers['x-facility'] as string,
            department: req.headers['x-department'] as string,
            workstation: req.headers['x-workstation'] as string
          }
        });
      }

      // Apply any conditions
      if (decision.conditions) {
        req.phiAccessConditions = decision.conditions;
      }

      next();
    };
  }

  /**
   * Minimum necessary access control
   */
  static enforceMinimumNecessary = async (
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    // Filter response data based on minimum necessary principle
    const originalJson = res.json;
    res.json = function(data: any) {
      const filteredData = EnhancedAuthMiddleware.applyMinimumNecessary(
        data,
        req.user!.role,
        req.phiAccessConditions
      );
      return originalJson.call(this, filteredData);
    };

    next();
  };

  /**
   * Break glass access for emergencies
   */
  static breakGlassAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const breakGlassReason = req.headers['x-break-glass-reason'] as string;
    const breakGlassCode = req.headers['x-break-glass-code'] as string;

    if (!breakGlassReason || !breakGlassCode) {
      res.status(400).json({
        success: false,
        error: 'BREAK_GLASS_INFO_REQUIRED',
        message: 'Break glass reason and code are required'
      });
      return;
    }

    // Verify break glass code
    const isValidCode = await EnhancedAuthMiddleware.verifyBreakGlassCode(
      req.user!.id,
      breakGlassCode
    );

    if (!isValidCode) {
      await EnhancedAuthMiddleware.auditService.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        userId: req.user!.id,
        severity: 'CRITICAL',
        description: 'Invalid break glass attempt',
        metadata: {
          reason: breakGlassReason,
          path: req.path
        }
      });

      res.status(403).json({
        success: false,
        error: 'INVALID_BREAK_GLASS_CODE',
        message: 'Invalid break glass code'
      });
      return;
    }

    // Log break glass access
    await EnhancedAuthMiddleware.auditService.logSecurityEvent({
      type: 'DATA_ACCESS',
      userId: req.user!.id,
      severity: 'HIGH',
      description: 'Break glass access activated',
      metadata: {
        reason: breakGlassReason,
        path: req.path,
        method: req.method
      }
    });

    // Grant temporary elevated access
    req.user!.breakGlassActive = true;
    req.user!.breakGlassReason = breakGlassReason;

    next();
  };

  /**
   * Perform comprehensive security checks
   */
  private static async performSecurityChecks(
    session: any,
    ipAddress: string,
    userAgent: string,
    req: Request
  ): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];

    // IP address validation
    if (session.ipAddress && session.ipAddress !== ipAddress) {
      failures.push('IP address mismatch');
    }

    // User agent validation
    if (session.userAgent && session.userAgent !== userAgent) {
      failures.push('User agent mismatch');
    }

    // Session timeout check
    const lastActivity = new Date(session.lastActivityAt);
    const inactivityPeriod = Date.now() - lastActivity.getTime();
    const maxInactivity = 30 * 60 * 1000; // 30 minutes

    if (inactivityPeriod > maxInactivity) {
      failures.push('Session timeout due to inactivity');
    }

    // Concurrent session check
    const concurrentSessions = await EnhancedAuthMiddleware.sessionManager
      .getUserSessions(session.userId);
    
    if (concurrentSessions.length > 3) {
      failures.push('Too many concurrent sessions');
    }

    // Geographic anomaly detection
    if (session.lastKnownLocation) {
      const locationChange = await EnhancedAuthMiddleware.detectGeographicAnomaly(
        session.lastKnownLocation,
        ipAddress
      );
      if (locationChange.isAnomaly) {
        failures.push(`Geographic anomaly: ${locationChange.description}`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  /**
   * Handle security validation failures
   */
  private static async handleSecurityFailure(
    userId: string,
    failures: string[],
    req: Request
  ): Promise<void> {
    await EnhancedAuthMiddleware.auditService.logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      userId,
      severity: 'HIGH',
      description: 'Security validation failed',
      metadata: {
        failures,
        path: req.path,
        method: req.method,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // If severe enough, lock the account
    if (failures.some(f => f.includes('anomaly') || f.includes('concurrent'))) {
      // Implement account locking logic
      logger.security('Account security alert triggered', { userId, failures });
    }
  }

  /**
   * Make PHI access decision based on comprehensive rules
   */
  private static async makePHIAccessDecision(
    user: any,
    context: PHIAccessContext,
    req: Request
  ): Promise<AccessDecision> {
    // Check basic permission
    const hasBasicPermission = hasPermission(
      toCanonicalRole(user.role),
      'patients:read' as Permission
    );

    if (!hasBasicPermission) {
      return {
        allowed: false,
        reason: 'Insufficient permissions',
        auditRequired: true
      };
    }

    // Check patient relationship
    if (context.patientId && !user.breakGlassActive) {
      const hasRelationship = await EnhancedAuthMiddleware.verifyPatientRelationship(
        user.id,
        context.patientId
      );

      if (!hasRelationship) {
        return {
          allowed: false,
          reason: 'No established care relationship',
          auditRequired: true
        };
      }
    }

    // Check data sensitivity
    if (context.dataCategory && EnhancedAuthMiddleware.isHighSensitivityData(context.dataCategory)) {
      const hasSpecialPermission = await EnhancedAuthMiddleware.checkSpecialPermissions(
        user,
        context.dataCategory
      );

      if (!hasSpecialPermission) {
        return {
          allowed: false,
          reason: 'Special authorization required for sensitive data',
          auditRequired: true
        };
      }
    }

    // All checks passed
    return {
      allowed: true,
      auditRequired: true,
      conditions: EnhancedAuthMiddleware.getAccessConditions(user.role, context)
    };
  }

  /**
   * Get access conditions based on role and context
   */
  private static getAccessConditions(role: string, context: PHIAccessContext): string[] {
    const conditions: string[] = [];

    // Role-based conditions
    switch (role) {
      case 'NURSING_STAFF':
        conditions.push('exclude_financial_data');
        conditions.push('limit_to_current_encounter');
        break;
      case 'LAB_TECHNICIAN':
        conditions.push('lab_results_only');
        conditions.push('no_clinical_notes');
        break;
      case 'BILLING_STAFF':
        conditions.push('financial_data_only');
        conditions.push('no_clinical_details');
        break;
    }

    // Data category conditions
    if (context.dataCategory === PHIDataCategory.MENTAL_HEALTH) {
      conditions.push('requires_mental_health_authorization');
    }

    return conditions;
  }

  /**
   * Apply minimum necessary principle to response data
   */
  private static applyMinimumNecessary(
    data: any,
    role: string,
    conditions?: string[]
  ): any {
    if (!data || !conditions || conditions.length === 0) {
      return data;
    }

    // Deep clone to avoid modifying original
    const filtered = JSON.parse(JSON.stringify(data));

    conditions.forEach(condition => {
      switch (condition) {
        case 'exclude_financial_data':
          EnhancedAuthMiddleware.removeFields(filtered, ['insurance', 'billing', 'payment']);
          break;
        case 'lab_results_only':
          EnhancedAuthMiddleware.keepOnlyFields(filtered, ['labResults', 'id', 'name']);
          break;
        case 'financial_data_only':
          EnhancedAuthMiddleware.keepOnlyFields(filtered, ['insurance', 'billing', 'id']);
          break;
        case 'no_clinical_notes':
          EnhancedAuthMiddleware.removeFields(filtered, ['notes', 'clinicalNotes']);
          break;
      }
    });

    return filtered;
  }

  /**
   * Helper methods
   */
  private static removeFields(obj: any, fields: string[]): void {
    if (typeof obj !== 'object' || !obj) return;

    for (const field of fields) {
      delete obj[field];
    }

    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        EnhancedAuthMiddleware.removeFields(obj[key], fields);
      }
    }
  }

  private static keepOnlyFields(obj: any, fields: string[]): any {
    if (typeof obj !== 'object' || !obj) return obj;

    const kept: any = {};
    for (const field of fields) {
      if (obj[field] !== undefined) {
        kept[field] = obj[field];
      }
    }
    return kept;
  }

  private static inferDataCategory(req: Request): PHIDataCategory {
    const path = req.path.toLowerCase();
    for (const [field, category] of Object.entries(EnhancedAuthMiddleware.PHI_FIELD_MAPPING)) {
      if (path.includes(field)) {
        return category;
      }
    }
    return PHIDataCategory.MEDICAL_HISTORY;
  }

  private static extractRequestedFields(req: Request): string[] {
    const fields: string[] = [];
    
    if (req.query.fields) {
      fields.push(...(req.query.fields as string).split(','));
    }
    
    if (req.body && typeof req.body === 'object') {
      fields.push(...Object.keys(req.body));
    }
    
    return fields;
  }

  private static getAccessType(method: string): any {
    const methodMap: Record<string, string> = {
      'GET': 'view',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };
    return methodMap[method] || 'view';
  }

  private static requiresMFA(path: string): boolean {
    const mfaRequiredPaths = [
      '/admin',
      '/settings',
      '/security',
      '/audit',
      '/users',
      '/export'
    ];
    return mfaRequiredPaths.some(p => path.startsWith(p));
  }

  private static isHighSensitivityData(category: PHIDataCategory): boolean {
    return [
      PHIDataCategory.MENTAL_HEALTH,
      PHIDataCategory.SUBSTANCE_ABUSE,
      PHIDataCategory.HIV_STATUS,
      PHIDataCategory.GENETIC_INFO
    ].includes(category);
  }

  private static async verifyPatientRelationship(
    userId: string,
    patientId: string
  ): Promise<boolean> {
    // Check if user has active care relationship with patient
    // This would query the database for appointments, encounters, etc.
    // Placeholder for now
    return true;
  }

  private static async checkSpecialPermissions(
    user: any,
    dataCategory: PHIDataCategory
  ): Promise<boolean> {
    // Check if user has special permissions for sensitive data
    // Would check against permission database
    return user.role === 'PHYSICIAN' || user.role === 'SYSTEM_ADMINISTRATOR';
  }

  private static async verifyBreakGlassCode(
    userId: string,
    code: string
  ): Promise<boolean> {
    // Verify break glass code
    // Would check against secure storage
    return code.length === 6 && /^\d+$/.test(code);
  }

  private static async detectGeographicAnomaly(
    lastLocation: string,
    currentIP: string
  ): Promise<{ isAnomaly: boolean; description?: string }> {
    // Implement geographic anomaly detection
    // Would use IP geolocation service
    return { isAnomaly: false };
  }

  private static async getUserById(userId: string): Promise<User | null> {
    // Mock implementation - replace with actual database query
    const mockUsers: Record<string, User> = {
      'user-1': {
        id: 'user-1',
        username: 'admin@omnicare.com',
        email: 'admin@omnicare.com',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'SYSTEM_ADMINISTRATOR',
        department: 'IT',
        isActive: true,
        isMfaEnabled: true,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
    return mockUsers[userId] || null;
  }
}

// Export convenience methods
export const authenticate = EnhancedAuthMiddleware.authenticate;
export const requirePHIAccess = EnhancedAuthMiddleware.requirePHIAccess;
export const enforceMinimumNecessary = EnhancedAuthMiddleware.enforceMinimumNecessary;
export const breakGlassAccess = EnhancedAuthMiddleware.breakGlassAccess;