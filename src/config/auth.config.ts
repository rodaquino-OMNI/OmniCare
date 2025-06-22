/**
 * OmniCare EMR - Authentication Configuration
 * HIPAA-Compliant Security Settings and Constants
 */

import { PasswordPolicy } from '@/types/auth.types';

export const AUTH_CONFIG = {
  // JWT Configuration
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'omnicare-access-secret-key-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'omnicare-refresh-secret-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m', // 15 minutes for security
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d', // 7 days
    issuer: 'OmniCare-EMR',
    audience: 'omnicare-users',
    algorithm: 'HS256' as const
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || 'omnicare-session-secret-change-in-production',
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    rolling: true, // Reset expiry on activity
    saveUninitialized: false,
    resave: false
  },

  // Multi-Factor Authentication
  mfa: {
    issuer: 'OmniCare EMR',
    window: 2, // Allow 2 time-steps before/after current time
    digits: 6,
    period: 30, // 30 seconds
    algorithm: 'sha1' as const,
    encoding: 'base32' as const,
    backupCodesCount: 10
  },

  // Account Security
  security: {
    saltRounds: 12, // bcrypt salt rounds
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes in milliseconds
    passwordResetExpiry: 60 * 60 * 1000, // 1 hour in milliseconds
    sessionTimeout: 15 * 60 * 1000, // 15 minutes of inactivity
    forceLogoutOnPasswordChange: true,
    requireMfaForPrivilegedRoles: true
  },

  // Rate Limiting
  rateLimiting: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      skipSuccessfulRequests: true
    },
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per window
      standardHeaders: true,
      legacyHeaders: false
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 reset attempts per hour
      skipSuccessfulRequests: false
    }
  },

  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    encoding: 'hex' as const
  }
};

/**
 * HIPAA-Compliant Password Policy
 * Based on NIST SP 800-63B guidelines for healthcare systems
 */
export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12, // Minimum 12 characters for healthcare systems
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventReuse: 12, // Prevent reuse of last 12 passwords
  maxAgeInDays: 90, // Force password change every 90 days
  lockoutThreshold: 5, // Lock account after 5 failed attempts
  lockoutDurationMinutes: 30 // Lock for 30 minutes
};

/**
 * Role-based MFA requirements
 * High-privilege roles require MFA by default
 */
export const MFA_REQUIRED_ROLES = [
  'physician',
  'system_administrator',
  'pharmacist'
];

/**
 * Session timeout by role (in milliseconds)
 * More sensitive roles have shorter session timeouts
 */
export const ROLE_SESSION_TIMEOUTS: Record<string, number> = {
  physician: 15 * 60 * 1000, // 15 minutes
  nursing_staff: 20 * 60 * 1000, // 20 minutes
  administrative_staff: 30 * 60 * 1000, // 30 minutes
  system_administrator: 10 * 60 * 1000, // 10 minutes
  pharmacist: 15 * 60 * 1000, // 15 minutes
  laboratory_technician: 25 * 60 * 1000, // 25 minutes
  radiology_technician: 25 * 60 * 1000, // 25 minutes
  patient: 60 * 60 * 1000, // 60 minutes for patients
  billing_staff: 30 * 60 * 1000, // 30 minutes
  receptionist: 45 * 60 * 1000 // 45 minutes
};

/**
 * HIPAA Audit Requirements
 */
export const AUDIT_CONFIG = {
  // Events that must be logged for HIPAA compliance
  requiredEvents: [
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGOUT',
    'DATA_ACCESS',
    'DATA_MODIFICATION',
    'UNAUTHORIZED_ACCESS',
    'SYSTEM_CONFIGURATION_CHANGE',
    'USER_ACCOUNT_CREATION',
    'USER_ACCOUNT_MODIFICATION',
    'USER_ACCOUNT_DELETION',
    'PASSWORD_CHANGE',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED'
  ],
  
  // Retention period for audit logs (7 years for HIPAA)
  retentionPeriodYears: 7,
  
  // Log rotation settings
  logRotation: {
    frequency: 'daily',
    maxFiles: '365d', // Keep daily logs for 1 year
    maxSize: '100m', // Max 100MB per log file
    compress: true
  },
  
  // Critical events that require immediate alerting
  criticalEvents: [
    'UNAUTHORIZED_ACCESS',
    'SYSTEM_CONFIGURATION_CHANGE',
    'MASSIVE_DATA_ACCESS',
    'PRIVILEGE_ESCALATION',
    'ACCOUNT_COMPROMISE'
  ]
};

/**
 * IP Address Restrictions
 * Can be configured per environment
 */
export const IP_RESTRICTIONS = {
  enabled: process.env.ENABLE_IP_RESTRICTIONS === 'true',
  allowedRanges: process.env.ALLOWED_IP_RANGES?.split(',') || [],
  blockedRanges: process.env.BLOCKED_IP_RANGES?.split(',') || [],
  allowPrivateNetworks: process.env.NODE_ENV !== 'production'
};

/**
 * Security Headers Configuration
 */
export const SECURITY_HEADERS = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permittedCrossDomainPolicies: false
};