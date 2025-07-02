/**
 * OmniCare EMR Backend - CSRF Protection Middleware
 * HIPAA-Compliant Cross-Site Request Forgery Protection
 */

import crypto from 'crypto';

import { Request, Response, NextFunction } from 'express';

import { auditService } from '../services/audit.service';
import logger from '../utils/logger';

interface CSRFToken {
  token: string;
  expiresAt: Date;
  userId?: string;
  sessionId?: string;
}

export class CSRFProtection {
  private static tokenStore = new Map<string, CSRFToken>();
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_EXPIRY_MS = 3600000; // 1 hour
  private static readonly HEADER_NAME = 'X-CSRF-Token';
  private static readonly COOKIE_NAME = '_csrf';
  
  // Paths that don't require CSRF protection (e.g., public endpoints, auth)
  private static readonly EXCLUDED_PATHS = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/ping',
    '/.well-known',
    '/fhir/metadata'
  ];

  // Methods that require CSRF protection
  private static readonly PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

  /**
   * Generate a new CSRF token
   */
  static generateToken(userId?: string, sessionId?: string): string {
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MS);
    
    this.tokenStore.set(token, {
      token,
      expiresAt,
      userId,
      sessionId
    });

    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Validate a CSRF token
   */
  static validateToken(token: string, userId?: string): boolean {
    const storedToken = this.tokenStore.get(token);
    
    if (!storedToken) {
      return false;
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      this.tokenStore.delete(token);
      return false;
    }

    // If userId is provided, verify it matches
    if (userId && storedToken.userId && storedToken.userId !== userId) {
      return false;
    }

    return true;
  }

  /**
   * Main CSRF protection middleware
   */
  static protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip CSRF check for excluded paths
      if (this.isExcludedPath(req.path)) {
        next();
        return;
      }

      // Skip CSRF check for safe methods
      if (!this.PROTECTED_METHODS.includes(req.method)) {
        next();
        return;
      }

      // Get token from header or cookie
      const token = req.headers[this.HEADER_NAME.toLowerCase()] as string || 
                   req.cookies?.[this.COOKIE_NAME];

      if (!token) {
        await this.handleCSRFFailure(req, res, 'Missing CSRF token');
        return;
      }

      // Validate token
      const userId = req.user?.id;
      if (!this.validateToken(token, userId)) {
        await this.handleCSRFFailure(req, res, 'Invalid CSRF token');
        return;
      }

      // Token is valid, proceed
      next();
    } catch (error) {
      logger.error('CSRF protection error:', error);
      res.status(500).json({
        success: false,
        error: 'CSRF_PROTECTION_ERROR',
        message: 'An error occurred while validating CSRF token'
      });
    }
  };

  /**
   * Middleware to generate and attach CSRF token to response
   */
  static attachToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Generate new token for authenticated users
    if (req.user) {
      const token = this.generateToken(req.user.id, req.session?.sessionId);
      
      // Set token in cookie (httpOnly for additional security)
      res.cookie(this.COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: this.TOKEN_EXPIRY_MS
      });

      // Also send in header for SPA compatibility
      res.setHeader(this.HEADER_NAME, token);
    }

    next();
  };

  /**
   * Handle CSRF validation failure
   */
  private static async handleCSRFFailure(req: Request, res: Response, reason: string): Promise<void> {
    // Log security event
    await auditService.logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      userId: req.user?.id,
      severity: 'MEDIUM',
      description: 'CSRF validation failed',
      metadata: {
        reason,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.security('CSRF validation failed', {
      userId: req.user?.id,
      reason,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(403).json({
      success: false,
      error: 'CSRF_VALIDATION_FAILED',
      message: 'Invalid or missing CSRF token'
    });
  }

  /**
   * Check if path is excluded from CSRF protection
   */
  private static isExcludedPath(path: string): boolean {
    return this.EXCLUDED_PATHS.some(excludedPath => 
      path.startsWith(excludedPath)
    );
  }

  /**
   * Clean up expired tokens
   */
  private static cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    this.tokenStore.forEach((tokenData, token) => {
      if (tokenData.expiresAt < now) {
        expiredTokens.push(token);
      }
    });

    expiredTokens.forEach(token => this.tokenStore.delete(token));
  }

  /**
   * Clear all tokens for a user (e.g., on logout)
   */
  static clearUserTokens(userId: string): void {
    const userTokens: string[] = [];

    this.tokenStore.forEach((tokenData, token) => {
      if (tokenData.userId === userId) {
        userTokens.push(token);
      }
    });

    userTokens.forEach(token => this.tokenStore.delete(token));
  }

  /**
   * Clear all tokens for a session
   */
  static clearSessionTokens(sessionId: string): void {
    const sessionTokens: string[] = [];

    this.tokenStore.forEach((tokenData, token) => {
      if (tokenData.sessionId === sessionId) {
        sessionTokens.push(token);
      }
    });

    sessionTokens.forEach(token => this.tokenStore.delete(token));
  }
}

// Export middleware functions
export const csrfProtect = CSRFProtection.protect;
export const csrfAttachToken = CSRFProtection.attachToken;
export const csrfClearUserTokens = CSRFProtection.clearUserTokens;
export const csrfClearSessionTokens = CSRFProtection.clearSessionTokens;