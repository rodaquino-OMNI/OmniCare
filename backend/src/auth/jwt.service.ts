/**
 * OmniCare EMR Backend - JWT Authentication Service
 * HIPAA-Compliant Token Management
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';

import { 
  User, 
  UserRole, 
  UserRoles,
  AuthToken, 
  MfaSetup,
  Permission
} from '@/types/auth.types';

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

const AUTH_CONFIG = {
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'omnicare-emr',
    audience: 'omnicare-app',
    algorithm: 'HS256' as const
  },
  security: {
    saltRounds: 12,
    sessionTimeout: 15 * 60 * 1000 // 15 minutes
  },
  mfa: {
    window: 1,
    digits: 6,
    period: 30,
    issuer: 'OmniCare EMR',
    backupCodesCount: 10
  },
  encryption: {
    ivLength: 16,
    encoding: 'hex' as const
  }
};

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};

const MFA_REQUIRED_ROLES: UserRole[] = [UserRoles.PHYSICIAN, UserRoles.SYSTEM_ADMINISTRATOR];

export class JWTAuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  constructor() {
    this.accessTokenSecret = AUTH_CONFIG.jwt.accessTokenSecret;
    this.refreshTokenSecret = AUTH_CONFIG.jwt.refreshTokenSecret;
    
    // Configure OTP library  
    authenticator.options = {
      window: AUTH_CONFIG.mfa.window,
      digits: AUTH_CONFIG.mfa.digits,
      step: AUTH_CONFIG.mfa.period
    };
  }

  /**
   * Generate JWT access and refresh tokens
   */
  generateTokens(user: User): AuthToken {
    const sessionId = uuidv4();
    const permissions = this.getRolePermissions(user.role);

    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions,
      sessionId
    };

    const accessToken = jwt.sign(
      payload, 
      this.accessTokenSecret, 
      {
        expiresIn: AUTH_CONFIG.jwt.accessTokenExpiry,
        issuer: AUTH_CONFIG.jwt.issuer,
        audience: AUTH_CONFIG.jwt.audience,
        algorithm: AUTH_CONFIG.jwt.algorithm
      } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId },
      this.refreshTokenSecret,
      {
        expiresIn: AUTH_CONFIG.jwt.refreshTokenExpiry,
        issuer: AUTH_CONFIG.jwt.issuer,
        audience: AUTH_CONFIG.jwt.audience,
        algorithm: AUTH_CONFIG.jwt.algorithm
      } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiryTime(AUTH_CONFIG.jwt.accessTokenExpiry),
      tokenType: 'Bearer'
    };
  }

  /**
   * Verify and decode JWT access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: AUTH_CONFIG.jwt.issuer,
        audience: AUTH_CONFIG.jwt.audience,
        algorithms: [AUTH_CONFIG.jwt.algorithm]
      }) as TokenPayload;

      return decoded;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify and decode JWT refresh token
   */
  verifyRefreshToken(token: string): { userId: string; sessionId: string } {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: AUTH_CONFIG.jwt.issuer,
        audience: AUTH_CONFIG.jwt.audience,
        algorithms: [AUTH_CONFIG.jwt.algorithm]
      }) as { userId: string; sessionId: string };

      return decoded;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using valid refresh token
   */
  refreshAccessToken(refreshToken: string, user: User): AuthToken {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (decoded.userId !== user.id) {
      throw new Error('Token user mismatch');
    }

    return this.generateTokens(user);
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, AUTH_CONFIG.security.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < PASSWORD_POLICY.minLength) {
      errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
    }

    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate MFA secret for user
   */
  async generateMfaSecret(user: User): Promise<MfaSetup> {
    const secret = authenticator.generateSecret();
    const keyuri = authenticator.keyuri(
      user.username,
      AUTH_CONFIG.mfa.issuer,
      secret
    );

    // Simplified QR code generation (would use proper library in production)
    const qrCode = `data:image/svg+xml;base64,${Buffer.from(keyuri).toString('base64')}`;
    const backupCodes = this.generateBackupCodes();

    return {
      secret,
      qrCode,
      backupCodes
    };
  }

  /**
   * Verify MFA token
   */
  verifyMfaToken(token: string, secret: string): boolean {
    return authenticator.check(token, secret);
  }

  /**
   * Check if MFA is required for user role
   */
  isMfaRequired(role: UserRole): boolean {
    return MFA_REQUIRED_ROLES.includes(role);
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Get role permissions (simplified)
   */
  private getRolePermissions(role: UserRole): Permission[] {
    // Simplified permission mapping using role strings
    const rolePermissions: Record<string, Permission[]> = {
      [UserRoles.PHYSICIAN]: [Permission.CREATE_CLINICAL_NOTES, Permission.VIEW_PATIENT_RECORDS, Permission.CREATE_PRESCRIPTIONS],
      [UserRoles.NURSING_STAFF]: [Permission.CREATE_CLINICAL_NOTES, Permission.VIEW_PATIENT_RECORDS, Permission.DOCUMENT_VITAL_SIGNS],
      [UserRoles.ADMINISTRATIVE_STAFF]: [Permission.SCHEDULE_APPOINTMENTS, Permission.MANAGE_BILLING, Permission.VIEW_PATIENT_DEMOGRAPHICS],
      [UserRoles.SYSTEM_ADMINISTRATOR]: [Permission.MANAGE_USERS, Permission.CONFIGURE_SYSTEM, Permission.VIEW_AUDIT_LOGS],
      [UserRoles.PHARMACIST]: [Permission.VIEW_PRESCRIPTIONS, Permission.VERIFY_PRESCRIPTIONS, Permission.DISPENSE_MEDICATIONS],
      [UserRoles.LABORATORY_TECHNICIAN]: [Permission.VIEW_LAB_RESULTS, Permission.ENTER_LAB_RESULTS],
      [UserRoles.RADIOLOGY_TECHNICIAN]: [Permission.PERFORM_IMAGING_STUDIES, Permission.VIEW_IMAGING_RESULTS],
      [UserRoles.PATIENT]: [Permission.VIEW_OWN_RECORDS, Permission.REQUEST_APPOINTMENTS]
    };
    
    return rolePermissions[role] || [];
  }

  /**
   * Generate backup codes for MFA
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < AUTH_CONFIG.mfa.backupCodesCount; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Convert JWT expiry string to seconds
   */
  private getTokenExpiryTime(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 15 * 60; // Default 15 minutes
    }
  }

  /**
   * Generate secure random token for password reset
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
