/**
 * OmniCare EMR - JWT Authentication Service
 * HIPAA-Compliant Token Management with Multi-Factor Authentication
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { AUTH_CONFIG, PASSWORD_POLICY, MFA_REQUIRED_ROLES } from '@/config/auth.config';
import { 
  User, 
  UserRole, 
  AuthToken, 
  LoginCredentials, 
  MfaSetup,
  SessionInfo,
  Permission
} from '@/types/auth.types';
import { getRolePermissions } from '@/auth/role-permissions';

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
      step: AUTH_CONFIG.mfa.period,
      algorithm: 'sha1' as any, // Force type compatibility
      encoding: 'base32' as any  // Force type compatibility
    };
  }

  /**
   * Generate JWT access and refresh tokens
   */
  async generateTokens(user: User): Promise<AuthToken> {
    const sessionId = uuidv4();
    const permissions = getRolePermissions(user.role);

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
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: AUTH_CONFIG.jwt.issuer,
        audience: AUTH_CONFIG.jwt.audience,
        algorithms: [AUTH_CONFIG.jwt.algorithm]
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify and decode JWT refresh token
   */
  async verifyRefreshToken(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: AUTH_CONFIG.jwt.issuer,
        audience: AUTH_CONFIG.jwt.audience,
        algorithms: [AUTH_CONFIG.jwt.algorithm]
      }) as { userId: string; sessionId: string };

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using valid refresh token
   */
  async refreshAccessToken(refreshToken: string, user: User): Promise<AuthToken> {
    const decoded = await this.verifyRefreshToken(refreshToken);
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

    if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
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

    const qrCode = await QRCode.toDataURL(keyuri);
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
    return MFA_REQUIRED_ROLES.includes(role) || AUTH_CONFIG.security.requireMfaForPrivilegedRoles;
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

  /**
   * Create session information
   */
  createSessionInfo(
    user: User, 
    sessionId: string, 
    ipAddress: string, 
    userAgent: string
  ): SessionInfo {
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + AUTH_CONFIG.security.sessionTimeout);

    return {
      userId: user.id,
      sessionId,
      role: user.role,
      permissions: getRolePermissions(user.role),
      ipAddress,
      userAgent,
      lastActivity: new Date(),
      expiresAt
    };
  }

  /**
   * Validate session and check for timeout
   */
  isSessionValid(session: SessionInfo): boolean {
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
    
    return (
      session.expiresAt > now &&
      timeSinceLastActivity < AUTH_CONFIG.security.sessionTimeout
    );
  }

  /**
   * Update session last activity
   */
  updateSessionActivity(session: SessionInfo): SessionInfo {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTH_CONFIG.security.sessionTimeout);
    
    return {
      ...session,
      lastActivity: now,
      expiresAt
    };
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
   * Generate cryptographically secure random string
   */
  generateSecureRandomString(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptData(data: string, key: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(AUTH_CONFIG.encryption.ivLength);
    const keyBuffer = Buffer.from(key.slice(0, 32).padEnd(32, '0'));
    const cipher = crypto.createCipher(AUTH_CONFIG.encryption.algorithm, keyBuffer);
    (cipher as any).setAAD(Buffer.from('OmniCare-EMR'));
    
    let encrypted = cipher.update(data, 'utf8', AUTH_CONFIG.encryption.encoding);
    encrypted += cipher.final(AUTH_CONFIG.encryption.encoding);
    
    const tag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString(AUTH_CONFIG.encryption.encoding),
      tag: tag.toString(AUTH_CONFIG.encryption.encoding)
    };
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: { encrypted: string; iv: string; tag: string }, key: string): string {
    const iv = Buffer.from(encryptedData.iv, AUTH_CONFIG.encryption.encoding);
    const tag = Buffer.from(encryptedData.tag, AUTH_CONFIG.encryption.encoding);
    const keyBuffer = Buffer.from(key.slice(0, 32).padEnd(32, '0'));
    
    const decipher = crypto.createDecipher(AUTH_CONFIG.encryption.algorithm, keyBuffer);
    (decipher as any).setAAD(Buffer.from('OmniCare-EMR'));
    (decipher as any).setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, AUTH_CONFIG.encryption.encoding, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}