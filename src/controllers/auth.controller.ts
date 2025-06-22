/**
 * OmniCare EMR - Authentication Controller
 * HIPAA-Compliant Authentication Endpoints with Comprehensive Security
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { validationResult } from 'express-validator';

import { JWTAuthService } from '@/auth/jwt.service';
import { AUTH_CONFIG, ROLE_SESSION_TIMEOUTS } from '@/config/auth.config';
import { AuditService } from '@/services/audit.service';
import { 
  User, 
  LoginCredentials, 
  SecurityEvent,
  SessionInfo
} from '@/types/auth.types';
import { hasPasswordHash, hasSessionId, hasMFAProperties, toRecordWithIndexSignature } from '@/utils/type-guards';

export interface AuthRequest extends Request {
  user?: User;
  sessionId?: string;
}

export class AuthController {
  private jwtService: JWTAuthService;
  private auditService: AuditService;

  // SECURITY WARNING: In production, these MUST be replaced with Redis or database
  // These in-memory stores will lose data on restart and don't scale
  private activeSessions: Map<string, Record<string, unknown>> = new Map();
  private failedAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  private passwordResetTokens: Map<string, { userId: string; expires: Date }> = new Map();
  
  // TODO: Replace with proper session store implementation
  // private sessionStore: SessionStore; // Redis or database-backed session store
  // private rateLimitStore: RateLimitStore; // Redis-backed rate limiting

  constructor() {
    this.jwtService = new JWTAuthService();
    this.auditService = new AuditService();
  }

  /**
   * Rate limiting for login attempts
   */
  public static loginRateLimit = rateLimit({
    windowMs: AUTH_CONFIG.rateLimiting.login.windowMs,
    max: AUTH_CONFIG.rateLimiting.login.max,
    message: {
      error: 'Too many login attempts, please try again later',
      retryAfter: Math.ceil(AUTH_CONFIG.rateLimiting.login.windowMs / 1000 / 60)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many login attempts. Please try again later.'
      });
    }
  });

  /**
   * Rate limiting for password reset requests
   */
  public static passwordResetRateLimit = rateLimit({
    windowMs: AUTH_CONFIG.rateLimiting.passwordReset.windowMs,
    max: AUTH_CONFIG.rateLimiting.passwordReset.max,
    message: {
      error: 'Too many password reset requests, please try again later',
      retryAfter: Math.ceil(AUTH_CONFIG.rateLimiting.passwordReset.windowMs / 1000 / 60)
    }
  });

  /**
   * User login with optional MFA
   */
  public login = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const { username, password, mfaToken }: LoginCredentials = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check for account lockout
      const lockoutKey = `${username}:${ipAddress}`;
      const failureInfo = this.failedAttempts.get(lockoutKey);
      
      if (failureInfo && failureInfo.count >= AUTH_CONFIG.security.maxLoginAttempts) {
        const lockoutTime = failureInfo.lastAttempt.getTime() + AUTH_CONFIG.security.lockoutDuration;
        if (Date.now() < lockoutTime) {
          await this.logSecurityEvent({
            type: 'LOGIN_FAILURE',
            severity: 'HIGH',
            description: `Login attempt on locked account: ${username}`,
            metadata: { username, ipAddress, userAgent, reason: 'account_locked' }
          });

          res.status(423).json({
            success: false,
            error: 'Account locked',
            message: 'Account is temporarily locked due to too many failed attempts',
            retryAfter: Math.ceil((lockoutTime - Date.now()) / 1000 / 60)
          });
          return;
        } else {
          // Reset failed attempts after lockout period
          this.failedAttempts.delete(lockoutKey);
        }
      }

      // Simulate user lookup (in production, query database)
      const user = await this.findUserByUsername(username);
      
      if (!user || !user.isActive) {
        this.recordFailedAttempt(lockoutKey);
        await this.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          severity: 'MEDIUM',
          description: `Failed login attempt for ${username}`,
          metadata: { username, ipAddress, userAgent, reason: 'invalid_credentials' }
        });

        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid credentials'
        });
        return;
      }

      // Verify password with type guard
      if (!hasPasswordHash(user)) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: 'User configuration error'
        });
        return;
      }
      const isValidPassword = await this.jwtService.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        this.recordFailedAttempt(lockoutKey);
        await this.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          userId: user.id,
          severity: 'MEDIUM',
          description: `Invalid password for user ${username}`,
          metadata: { username, ipAddress, userAgent, reason: 'invalid_password' }
        });

        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid credentials'
        });
        return;
      }

      // Check if MFA is required
      const mfaRequired = this.jwtService.isMfaRequired(user.role) || user.isMfaEnabled;
      
      if (mfaRequired && !mfaToken) {
        res.status(202).json({
          success: false,
          error: 'MFA required',
          message: 'Multi-factor authentication required',
          mfaRequired: true
        });
        return;
      }

      // Verify MFA if provided
      if (mfaRequired && mfaToken) {
        if (!user.mfaSecret || !this.jwtService.verifyMfaToken(mfaToken, user.mfaSecret)) {
          this.recordFailedAttempt(lockoutKey);
          await this.logSecurityEvent({
            type: 'LOGIN_FAILURE',
            userId: user.id,
            severity: 'HIGH',
            description: `Invalid MFA token for user ${username}`,
            metadata: { username, ipAddress, userAgent, reason: 'invalid_mfa' }
          });

          res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: 'Invalid MFA token'
          });
          return;
        }
      }

      // Clear failed attempts on successful login
      this.failedAttempts.delete(lockoutKey);

      // Generate tokens
      const tokens = this.jwtService.generateTokens(user);
      
      // Create session
      const sessionInfo = this.jwtService.createSessionInfo(user, tokens.sessionId, ipAddress, userAgent);
      if (hasSessionId(tokens)) {
        this.activeSessions.set(tokens.sessionId, toRecordWithIndexSignature(sessionInfo));
      }

      // Update user last login
      user.lastLogin = new Date();

      // Log successful login
      await this.logSecurityEvent({
        type: 'LOGIN_SUCCESS',
        userId: user.id,
        severity: 'LOW',
        description: `Successful login for user ${username}`,
        metadata: { username, ipAddress, userAgent, role: user.role }
      });

      // Set secure cookie with refresh token
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: AUTH_CONFIG.session.secure,
        sameSite: AUTH_CONFIG.session.sameSite,
        maxAge: ROLE_SESSION_TIMEOUTS[user.role] || AUTH_CONFIG.session.maxAge
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            department: user.department,
            lastLogin: user.lastLogin
          },
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
          sessionTimeout: ROLE_SESSION_TIMEOUTS[user.role] || AUTH_CONFIG.session.maxAge
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * User logout
   */
  public logout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, user } = req;
      
      if (sessionId) {
        this.activeSessions.delete(sessionId);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      // Log logout event
      if (user) {
        await this.logSecurityEvent({
          type: 'LOGOUT',
          userId: user.id,
          severity: 'LOW',
          description: `User ${user.username} logged out`,
          metadata: { 
            username: user.username,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   */
  public refreshToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: 'No refresh token provided'
        });
        return;
      }

      const decoded = this.jwtService.verifyRefreshToken(refreshToken);
      const user = await this.findUserById(decoded.userId);
      
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
        return;
      }

      // Check if session is still valid
      if (!hasSessionId(decoded)) {
        res.status(401).json({
          success: false,
          error: 'Invalid session'
        });
        return;
      }
      const sessionRecord = this.activeSessions.get(decoded.sessionId);
      if (!sessionRecord || !this.jwtService.isSessionValid(sessionRecord as SessionInfo)) {
        this.activeSessions.delete(decoded.sessionId);
        res.status(401).json({
          success: false,
          error: 'Session expired'
        });
        return;
      }

      // Generate new tokens
      const tokens = this.jwtService.generateTokens(user);
      
      // Update session
      const updatedSession = this.jwtService.updateSessionActivity(sessionRecord as SessionInfo);
      if (hasSessionId(tokens) && hasSessionId(decoded)) {
        this.activeSessions.set(tokens.sessionId, toRecordWithIndexSignature(updatedSession));
        this.activeSessions.delete(decoded.sessionId); // Remove old session
      }

      // Set new refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: AUTH_CONFIG.session.secure,
        sameSite: AUTH_CONFIG.session.sameSite,
        maxAge: ROLE_SESSION_TIMEOUTS[user.role] || AUTH_CONFIG.session.maxAge
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Setup Multi-Factor Authentication
   */
  public setupMfa = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const mfaSetup = await this.jwtService.generateMfaSecret(user);

      // Log MFA setup initiation
      await this.logSecurityEvent({
        type: 'MFA_ENABLED',
        userId: user.id,
        severity: 'MEDIUM',
        description: `MFA setup initiated for user ${user.username}`,
        metadata: { username: user.username }
      });

      res.status(200).json({
        success: true,
        message: 'MFA setup initiated',
        data: {
          qrCode: mfaSetup.qrCode,
          backupCodes: mfaSetup.backupCodes
          // SECRET NEVER RETURNED - stored server-side only
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify MFA setup
   */
  public verifyMfa = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;
      const { token, secret } = req.body;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const isValid = this.jwtService.verifyMfaToken(token, secret);
      
      if (!isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid MFA token'
        });
        return;
      }

      // Update user MFA settings (in production, update database)
      user.isMfaEnabled = true;
      user.mfaSecret = secret;
      
      // Store MFA secret securely (encrypt before storing)
      const encryptedSecret = this.jwtService.encryptData(secret, process.env.MFA_ENCRYPTION_KEY || 'default-key');
      if (hasMFAProperties(user)) {
        user.mfaSecretEncrypted = JSON.stringify(encryptedSecret);
      }

      await this.logSecurityEvent({
        type: 'MFA_ENABLED',
        userId: user.id,
        severity: 'MEDIUM',
        description: `MFA successfully enabled for user ${user.username}`,
        metadata: { username: user.username }
      });

      res.status(200).json({
        success: true,
        message: 'MFA enabled successfully'
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password
   */
  public changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;
      const { currentPassword, newPassword } = req.body;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Verify current password with type guard
      if (!hasPasswordHash(user)) {
        res.status(400).json({
          success: false,
          error: 'Cannot update password',
          message: 'User password configuration error'
        });
        return;
      }
      const isValidPassword = await this.jwtService.verifyPassword(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
        return;
      }

      // Validate new password
      const passwordValidation = this.jwtService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Password validation failed',
          details: passwordValidation.errors
        });
        return;
      }

      // Hash new password
      const hashedPassword = await this.jwtService.hashPassword(newPassword);
      
      // Update user password (in production, update database)
      user.passwordHash = hashedPassword;
      
      // Clear sensitive data
      if ('password' in user) {
        delete (user as User & { password?: string }).password;
      }
      user.passwordChangedAt = new Date();

      // Invalidate all sessions if configured
      if (AUTH_CONFIG.security.forceLogoutOnPasswordChange) {
        // Remove all user sessions
        const sessionsToDelete: string[] = [];
        this.activeSessions.forEach((session, sessionId) => {
          if (session.userId === user.id) {
            sessionsToDelete.push(sessionId);
          }
        });
        sessionsToDelete.forEach(sessionId => {
          this.activeSessions.delete(sessionId);
        });
      }

      await this.logSecurityEvent({
        type: 'PASSWORD_CHANGE',
        userId: user.id,
        severity: 'MEDIUM',
        description: `Password changed for user ${user.username}`,
        metadata: { username: user.username }
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        forceLogout: AUTH_CONFIG.security.forceLogoutOnPasswordChange
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user info
   */
  public getCurrentUser = (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const { user } = req;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department,
          licenseNumber: user.licenseNumber,
          npiNumber: user.npiNumber,
          isMfaEnabled: user.isMfaEnabled,
          lastLogin: user.lastLogin,
          passwordChangedAt: user.passwordChangedAt
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Record failed login attempt
   */
  private recordFailedAttempt(key: string): void {
    const current = this.failedAttempts.get(key) || { count: 0, lastAttempt: new Date() };
    current.count += 1;
    current.lastAttempt = new Date();
    this.failedAttempts.set(key, current);
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.auditService.logSecurityEvent(event);
  }

  /**
   * Mock user lookup functions (replace with actual database queries)
   */
  private findUserByUsername(_username: string): Promise<User | null> {
    // Mock implementation - replace with actual database query
    // This would typically query your user database
    return Promise.resolve(null);
  }

  private findUserById(_id: string): Promise<User | null> {
    // Mock implementation - replace with actual database query
    return Promise.resolve(null);
  }
}