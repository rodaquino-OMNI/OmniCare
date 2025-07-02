# OmniCare EMR - Security Guidelines

## Overview

OmniCare EMR implements a comprehensive security framework that exceeds HIPAA requirements and follows industry best practices for healthcare data protection. This document outlines the security measures, implementation guidelines, and compliance requirements.

## Security Architecture

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    External Security Layer                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   WAF       │  │  DDoS        │  │  Rate Limiting   │  │
│  │ Protection  │  │  Protection  │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Network Security Layer                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   VPC       │  │  Private     │  │  Network        │  │
│  │  Isolation  │  │  Subnets     │  │  Segmentation   │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Application Security Layer                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │Authentication│  │Authorization │  │  Input          │  │
│  │   (OAuth)   │  │   (RBAC)     │  │  Validation     │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Data Security Layer                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Encryption  │  │  Access      │  │  Audit          │  │
│  │  at Rest    │  │  Controls    │  │  Logging        │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Authentication and Authorization

### Authentication Implementation

#### 1. Multi-Factor Authentication (MFA)
```typescript
// backend/src/services/auth/mfa.service.ts
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

export class MFAService {
  async setupMFA(userId: string): Promise<{
    secret: string;
    qrCode: string;
  }> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `OmniCare EMR (${userId})`,
      issuer: 'OmniCare',
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store encrypted secret
    await this.storeUserSecret(userId, secret.base32);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const secret = await this.getUserSecret(userId);
    
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time windows for clock drift
    });
  }

  private async storeUserSecret(userId: string, secret: string): Promise<void> {
    const encrypted = await this.encryptionService.encrypt(secret);
    await this.db.query(
      'UPDATE users SET mfa_secret = $1 WHERE id = $2',
      [encrypted, userId]
    );
  }
}
```

#### 2. OAuth 2.0 / SMART on FHIR
```typescript
// backend/src/auth/smart-auth.service.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export class SmartAuthService {
  async authorize(req: Request, res: Response) {
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      aud
    } = req.query;

    // Validate client
    const client = await this.validateClient(client_id as string);
    if (!client) {
      return res.status(400).json({ error: 'invalid_client' });
    }

    // Validate redirect URI
    if (!this.isValidRedirectUri(client, redirect_uri as string)) {
      return res.status(400).json({ error: 'invalid_redirect_uri' });
    }

    // Generate authorization code
    const code = await this.generateAuthCode({
      clientId: client_id as string,
      scope: scope as string,
      redirectUri: redirect_uri as string,
      userId: req.user.id
    });

    // Redirect with code
    const redirectUrl = new URL(redirect_uri as string);
    redirectUrl.searchParams.append('code', code);
    redirectUrl.searchParams.append('state', state as string);
    
    res.redirect(redirectUrl.toString());
  }

  async token(req: Request, res: Response) {
    const { grant_type, code, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      return this.handleAuthCodeGrant(req, res, code);
    } else if (grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(req, res, refresh_token);
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
  }

  private async handleAuthCodeGrant(
    req: Request, 
    res: Response, 
    code: string
  ) {
    // Validate code
    const authCode = await this.validateAuthCode(code);
    if (!authCode) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // Generate tokens
    const accessToken = this.generateAccessToken({
      userId: authCode.userId,
      clientId: authCode.clientId,
      scope: authCode.scope
    });

    const refreshToken = await this.generateRefreshToken({
      userId: authCode.userId,
      clientId: authCode.clientId
    });

    // Mark code as used
    await this.markCodeAsUsed(code);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope,
      patient: authCode.patientId
    });
  }
}
```

### Authorization Implementation

#### 1. Role-Based Access Control (RBAC)
```typescript
// backend/src/middleware/rbac.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Permission } from '../types/auth.types';

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has required permission
    const hasPermission = await this.authService.userHasPermission(
      user.id,
      permission
    );

    if (!hasPermission) {
      // Log unauthorized access attempt
      await this.auditService.logUnauthorizedAccess({
        userId: user.id,
        permission,
        resource: req.path,
        timestamp: new Date()
      });

      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

// Usage example
router.post(
  '/api/prescriptions',
  requirePermission(Permission.CREATE_PRESCRIPTIONS),
  async (req, res) => {
    // Only users with prescription permission can access
  }
);
```

#### 2. Attribute-Based Access Control (ABAC)
```typescript
// backend/src/auth/abac.service.ts
export class ABACService {
  async canAccess(
    user: User,
    resource: any,
    action: string,
    context?: any
  ): Promise<boolean> {
    // Define access policies
    const policies = [
      // Physicians can only access their own patients
      {
        condition: (u: User, r: Patient) => 
          u.role === 'physician' && 
          r.generalPractitioner?.some(gp => gp.reference === `Practitioner/${u.practitionerId}`),
        actions: ['read', 'write']
      },
      
      // Nurses can access patients in their department
      {
        condition: (u: User, r: Patient, ctx: any) =>
          u.role === 'nurse' &&
          ctx.department === u.department,
        actions: ['read']
      },
      
      // Time-based access control
      {
        condition: (u: User, r: any, ctx: any) => {
          const now = new Date();
          const hour = now.getHours();
          return u.shift === 'night' ? 
            (hour >= 19 || hour < 7) : 
            (hour >= 7 && hour < 19);
        },
        actions: ['read', 'write']
      }
    ];

    // Evaluate policies
    for (const policy of policies) {
      if (policy.actions.includes(action) && 
          policy.condition(user, resource, context)) {
        return true;
      }
    }

    return false;
  }
}
```

## Data Protection

### Encryption at Rest

#### 1. Database Encryption
```typescript
// backend/src/services/encryption.service.ts
import crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyDerivationIterations = 100000;

  async encryptField(plaintext: string, fieldKey: string): Promise<{
    encrypted: string;
    iv: string;
    authTag: string;
  }> {
    // Derive field-specific key
    const key = await this.deriveKey(fieldKey);
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  async decryptField(
    encrypted: string, 
    iv: string, 
    authTag: string,
    fieldKey: string
  ): Promise<string> {
    // Derive field-specific key
    const key = await this.deriveKey(fieldKey);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      this.algorithm, 
      key, 
      Buffer.from(iv, 'hex')
    );
    
    // Set auth tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async deriveKey(fieldKey: string): Promise<Buffer> {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
    
    return crypto.pbkdf2Sync(
      masterKey,
      fieldKey,
      this.keyDerivationIterations,
      32,
      'sha256'
    );
  }
}
```

#### 2. File Storage Encryption
```typescript
// backend/src/services/secure-storage.service.ts
import AWS from 'aws-sdk';
import crypto from 'crypto';

export class SecureStorageService {
  private s3 = new AWS.S3({
    region: process.env.AWS_REGION
  });

  async uploadEncryptedFile(
    file: Buffer,
    key: string,
    metadata: any
  ): Promise<string> {
    // Generate data encryption key
    const dataKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // Encrypt file
    const cipher = crypto.createCipheriv('aes-256-cbc', dataKey, iv);
    const encryptedFile = Buffer.concat([
      cipher.update(file),
      cipher.final()
    ]);
    
    // Encrypt data key with KMS
    const kms = new AWS.KMS();
    const { CiphertextBlob } = await kms.encrypt({
      KeyId: process.env.KMS_KEY_ID!,
      Plaintext: dataKey
    }).promise();
    
    // Upload to S3 with encrypted data key in metadata
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: encryptedFile,
      Metadata: {
        ...metadata,
        'x-amz-encrypted-key': CiphertextBlob!.toString('base64'),
        'x-amz-iv': iv.toString('base64')
      },
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID
    }).promise();
    
    return `s3://${process.env.S3_BUCKET}/${key}`;
  }
}
```

### Encryption in Transit

#### 1. TLS Configuration
```typescript
// backend/src/server.ts
import https from 'https';
import fs from 'fs';

const tlsOptions = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem'),
  
  // Strong cipher configuration
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384'
  ].join(':'),
  
  // Disable weak protocols
  secureProtocol: 'TLSv1_2_method',
  honorCipherOrder: true,
  
  // Enable HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

https.createServer(tlsOptions, app).listen(443);
```

## Audit and Compliance

### Comprehensive Audit Logging

#### 1. Audit Service Implementation
```typescript
// backend/src/services/audit.service.ts
export class AuditService {
  async logAccess(event: {
    userId: string;
    patientId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    ipAddress: string;
    userAgent: string;
    sessionId: string;
    result: 'success' | 'failure';
    reason?: string;
  }): Promise<void> {
    const auditEntry = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      ...event,
      
      // Add security context
      securityContext: {
        authenticationMethod: this.getAuthMethod(event.sessionId),
        mfaUsed: await this.wasMFAUsed(event.userId),
        riskScore: await this.calculateRiskScore(event)
      }
    };
    
    // Write to audit database
    await this.db.query(
      `INSERT INTO audit_log 
       (id, timestamp, user_id, patient_id, action, resource_type, 
        resource_id, ip_address, user_agent, session_id, result, 
        reason, security_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        auditEntry.id,
        auditEntry.timestamp,
        auditEntry.userId,
        auditEntry.patientId,
        auditEntry.action,
        auditEntry.resourceType,
        auditEntry.resourceId,
        auditEntry.ipAddress,
        auditEntry.userAgent,
        auditEntry.sessionId,
        auditEntry.result,
        auditEntry.reason,
        JSON.stringify(auditEntry.securityContext)
      ]
    );
    
    // Send to SIEM if configured
    if (process.env.SIEM_ENDPOINT) {
      await this.sendToSIEM(auditEntry);
    }
  }

  private async calculateRiskScore(event: any): Promise<number> {
    let score = 0;
    
    // Check for suspicious patterns
    if (await this.isUnusualAccessTime(event.userId)) score += 20;
    if (await this.isUnusualLocation(event.userId, event.ipAddress)) score += 30;
    if (await this.hasRecentFailures(event.userId)) score += 25;
    if (event.action.includes('delete')) score += 15;
    if (event.action.includes('export')) score += 10;
    
    return Math.min(score, 100);
  }
}
```

#### 2. HIPAA Compliance Tracking
```typescript
// backend/src/services/hipaa-compliance.service.ts
export class HIPAAComplianceService {
  async trackDisclosure(disclosure: {
    patientId: string;
    recipientOrganization: string;
    purpose: string;
    dataShared: string[];
    authorizedBy: string;
    method: 'api' | 'export' | 'print';
  }): Promise<void> {
    // Log disclosure for accounting
    await this.db.query(
      `INSERT INTO hipaa_disclosures 
       (id, patient_id, recipient_org, purpose, data_shared, 
        authorized_by, method, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuid(),
        disclosure.patientId,
        disclosure.recipientOrganization,
        disclosure.purpose,
        JSON.stringify(disclosure.dataShared),
        disclosure.authorizedBy,
        disclosure.method,
        new Date().toISOString()
      ]
    );
    
    // Notify patient if required
    if (await this.requiresPatientNotification(disclosure)) {
      await this.notifyPatient(disclosure);
    }
  }

  async generateAccountingReport(
    patientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const disclosures = await this.db.query(
      `SELECT * FROM hipaa_disclosures 
       WHERE patient_id = $1 
       AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp DESC`,
      [patientId, startDate, endDate]
    );
    
    return disclosures.rows;
  }
}
```

## Security Best Practices

### Input Validation

#### 1. Request Validation Middleware
```typescript
// backend/src/middleware/validation.middleware.ts
import { body, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

export const validatePatientInput = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Invalid first name'),
    
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Invalid last name'),
    
  body('birthDate')
    .isISO8601()
    .toDate()
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      return date <= now && date > new Date('1900-01-01');
    }),
    
  body('ssn')
    .optional()
    .matches(/^\d{3}-\d{2}-\d{4}$/)
    .withMessage('Invalid SSN format'),
    
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
    ALLOWED_ATTR: []
  });
}
```

### SQL Injection Prevention

#### 1. Parameterized Queries
```typescript
// backend/src/repositories/base.repository.ts
export class BaseRepository {
  protected async query(
    text: string,
    params: any[] = []
  ): Promise<any> {
    // Always use parameterized queries
    const client = await this.pool.connect();
    try {
      // Log query for audit (without params)
      this.logger.debug('Executing query', { 
        query: text,
        paramCount: params.length 
      });
      
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      // Log error securely
      this.logger.error('Query failed', {
        error: error.message,
        query: text.substring(0, 100) // Truncate for security
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Safe query builder
  protected buildWhereClause(
    conditions: Record<string, any>
  ): { clause: string; params: any[] } {
    const params: any[] = [];
    const clauses: string[] = [];
    
    let paramIndex = 1;
    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        // Whitelist column names
        if (!this.isValidColumn(key)) {
          throw new Error(`Invalid column name: ${key}`);
        }
        
        clauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    return {
      clause: clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '',
      params
    };
  }
}
```

### Session Security

#### 1. Secure Session Management
```typescript
// backend/src/config/session.config.ts
import session from 'express-session';
import RedisStore from 'connect-redis';
import { redisClient } from './redis.config';

export const sessionConfig = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    httpOnly: true, // No JS access
    maxAge: 30 * 60 * 1000, // 30 minutes
    sameSite: 'strict' // CSRF protection
  },
  
  name: 'omnicare.sid', // Custom session name
  
  genid: () => {
    // Generate cryptographically secure session IDs
    return crypto.randomBytes(32).toString('hex');
  }
});

// Session timeout handling
export function enforceSessionTimeout(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.session && req.session.lastActivity) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity;
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    if (now - lastActivity > timeout) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
      });
      return res.status(401).json({ error: 'Session expired' });
    }
  }
  
  if (req.session) {
    req.session.lastActivity = Date.now();
  }
  
  next();
}
```

## Security Monitoring

### Real-time Threat Detection

#### 1. Anomaly Detection Service
```typescript
// backend/src/services/security-monitoring.service.ts
export class SecurityMonitoringService {
  async detectAnomalies(userId: string, action: string): Promise<void> {
    const recentActivity = await this.getRecentActivity(userId);
    
    // Check for suspicious patterns
    const anomalies = [];
    
    // Rapid file access
    if (this.detectRapidAccess(recentActivity)) {
      anomalies.push({
        type: 'RAPID_ACCESS',
        severity: 'medium',
        description: 'Unusually rapid file access detected'
      });
    }
    
    // After-hours access
    if (this.detectAfterHoursAccess(recentActivity)) {
      anomalies.push({
        type: 'AFTER_HOURS',
        severity: 'low',
        description: 'Access outside normal working hours'
      });
    }
    
    // Bulk data export
    if (this.detectBulkExport(recentActivity)) {
      anomalies.push({
        type: 'BULK_EXPORT',
        severity: 'high',
        description: 'Large volume data export detected'
      });
    }
    
    // Alert if anomalies detected
    if (anomalies.length > 0) {
      await this.alertSecurityTeam(userId, anomalies);
    }
  }

  private detectRapidAccess(activities: any[]): boolean {
    const recentMinutes = 5;
    const threshold = 50;
    
    const recentCount = activities.filter(a => {
      const minutesAgo = (Date.now() - new Date(a.timestamp).getTime()) / 1000 / 60;
      return minutesAgo <= recentMinutes;
    }).length;
    
    return recentCount > threshold;
  }
}
```

---

*For deployment instructions, see the [Deployment Instructions](./05-Deployment-Instructions.md)*

*Document Version: 1.0.0*  
*Last Updated: ${new Date().toISOString().split('T')[0]}*  
*© 2025 OmniCare EMR - Proprietary and Confidential*