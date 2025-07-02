/**
 * OmniCare EMR Backend - Enhanced Security Testing
 * Tests for newly implemented security features
 */

import request from 'supertest';
import { app } from '../../src/app';
import { CSRFProtection } from '../../src/middleware/csrf.middleware';
import { userService } from '../../src/services/user.service';
import { enhancedAuditService } from '../../src/services/enhanced-audit.service';
import { redisSessionStore } from '../../src/services/redis-session.service';
import { JWTAuthService } from '../../src/auth/jwt.service';
import logger from '../../src/utils/logger';

const jwtService = new JWTAuthService();

describe('Enhanced Security Features', () => {
  let validToken: string;
  let csrfToken: string;
  let sessionId: string;
  
  beforeAll(async () => {
    sessionId = 'test-session-' + Date.now();
    validToken = jwtService.generateAccessToken({
      userId: 'user-1',
      sessionId,
      role: 'physician'
    });
    
    // Generate CSRF token
    csrfToken = CSRFProtection.generateToken('user-1', sessionId);
  });

  afterAll(async () => {
    // Cleanup
    CSRFProtection.clearUserTokens('user-1');
  });

  describe('CSRF Protection Implementation', () => {
    it('should generate unique CSRF tokens', () => {
      const token1 = CSRFProtection.generateToken('user-1', sessionId);
      const token2 = CSRFProtection.generateToken('user-1', sessionId);
      
      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes in hex
      expect(token2).toHaveLength(64);
    });

    it('should validate CSRF tokens correctly', () => {
      const token = CSRFProtection.generateToken('user-1', sessionId);
      
      expect(CSRFProtection.validateToken(token, 'user-1')).toBe(true);
      expect(CSRFProtection.validateToken('invalid-token', 'user-1')).toBe(false);
      expect(CSRFProtection.validateToken(token, 'wrong-user')).toBe(false);
    });

    it('should clear user tokens on logout', () => {
      const token = CSRFProtection.generateToken('user-2', 'session-2');
      expect(CSRFProtection.validateToken(token, 'user-2')).toBe(true);
      
      CSRFProtection.clearUserTokens('user-2');
      expect(CSRFProtection.validateToken(token, 'user-2')).toBe(false);
    });

    it('should accept valid CSRF token in header', async () => {
      const response = await request(app)
        .post('/api/test-endpoint')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ data: 'test' });
      
      // Should not be rejected for CSRF
      expect(response.status).not.toBe(403);
    });

    it('should accept valid CSRF token in cookie', async () => {
      const response = await request(app)
        .post('/api/test-endpoint')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Cookie', `_csrf=${csrfToken}`)
        .send({ data: 'test' });
      
      // Should not be rejected for CSRF
      expect(response.status).not.toBe(403);
    });
  });

  describe('Database User Lookup', () => {
    it('should use database for user lookup', async () => {
      const spy = jest.spyOn(userService, 'findById');
      
      // Make authenticated request
      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(spy).toHaveBeenCalledWith('user-1');
      spy.mockRestore();
    });

    it('should fallback to mock users in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const spy = jest.spyOn(userService, 'getFallbackUser');
      
      // Simulate database error
      jest.spyOn(userService, 'findById').mockRejectedValueOnce(new Error('DB Error'));
      
      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(spy).toHaveBeenCalledWith('user-1');
      
      spy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Redis Session Management', () => {
    it('should store sessions in Redis', async () => {
      const sessionInfo = {
        userId: 'test-user',
        sessionId: 'test-session-redis',
        role: 'physician' as const,
        permissions: [],
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };
      
      await redisSessionStore.set('test-session-redis', sessionInfo);
      const retrieved = await redisSessionStore.get('test-session-redis');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('test-user');
      expect(retrieved?.sessionId).toBe('test-session-redis');
      
      // Cleanup
      await redisSessionStore.delete('test-session-redis');
    });

    it('should handle session expiration', async () => {
      const sessionInfo = {
        userId: 'test-user',
        sessionId: 'test-session-expire',
        role: 'physician' as const,
        permissions: [],
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() - 1000) // Already expired
      };
      
      await redisSessionStore.set('test-session-expire', sessionInfo, 1);
      const retrieved = await redisSessionStore.get('test-session-expire');
      
      expect(retrieved).toBeNull();
    });

    it('should track multiple sessions per user', async () => {
      const userId = 'multi-session-user';
      const sessions = [];
      
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const sessionInfo = {
          userId,
          sessionId: `session-${i}`,
          role: 'physician' as const,
          permissions: [],
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 3600000)
        };
        
        await redisSessionStore.set(`session-${i}`, sessionInfo);
        sessions.push(sessionInfo);
      }
      
      const userSessions = await redisSessionStore.getAllUserSessions(userId);
      expect(userSessions).toHaveLength(3);
      
      // Cleanup
      await redisSessionStore.deleteUserSessions(userId);
      
      const remainingSessions = await redisSessionStore.getAllUserSessions(userId);
      expect(remainingSessions).toHaveLength(0);
    });
  });

  describe('Security Headers Implementation', () => {
    it('should set all enhanced security headers', async () => {
      const response = await request(app).get('/ping');
      
      // Check all security headers
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
      expect(response.headers['strict-transport-security']).toContain('preload');
      expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
      expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include request ID header', async () => {
      const response = await request(app).get('/ping');
      
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('Request Sanitization Logging', () => {
    it('should log sanitization activities', async () => {
      const spy = jest.spyOn(logger, 'security');
      
      await request(app)
        .post('/api/test')
        .send({ data: 'test<script>alert("xss")</script>' });
      
      expect(spy).toHaveBeenCalledWith(
        'Request sanitized',
        expect.objectContaining({
          path: '/api/test',
          method: 'POST',
          sanitizationApplied: true
        })
      );
      
      spy.mockRestore();
    });
  });

  describe('Enhanced Audit Service', () => {
    it('should log PHI access with comprehensive tracking', async () => {
      const phiLog = {
        id: 'log-1',
        userId: 'user-1',
        patientId: 'patient-123',
        accessType: 'view' as const,
        dataCategory: 'MEDICAL_HISTORY' as const,
        fieldsAccessed: ['diagnosis', 'medications'],
        reason: 'Treatment',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };
      
      await expect(enhancedAuditService.logPHIAccess(phiLog)).resolves.not.toThrow();
    });

    it('should detect anomalous access patterns', async () => {
      const spy = jest.spyOn(enhancedAuditService, 'logSecurityEvent');
      
      // Simulate high volume access
      for (let i = 0; i < 150; i++) {
        await enhancedAuditService.logPHIAccess({
          id: `log-${i}`,
          userId: 'suspicious-user',
          patientId: `patient-${i}`,
          accessType: 'view',
          dataCategory: 'MEDICAL_HISTORY' as const,
          reason: 'Treatment',
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        });
      }
      
      // Should trigger anomaly detection
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UNAUTHORIZED_ACCESS',
          severity: expect.stringMatching(/MEDIUM|HIGH/)
        })
      );
      
      spy.mockRestore();
    });

    it('should encrypt sensitive field names', async () => {
      const spy = jest.spyOn(enhancedAuditService as any, 'encryptSensitiveFields');
      
      await enhancedAuditService.logPHIAccess({
        id: 'log-encrypt',
        userId: 'user-1',
        patientId: 'patient-123',
        accessType: 'view',
        dataCategory: 'MENTAL_HEALTH' as const,
        fieldsAccessed: ['psychiatricHistory', 'medications'],
        reason: 'Treatment',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });
      
      expect(spy).toHaveBeenCalledWith(['psychiatricHistory', 'medications']);
      
      spy.mockRestore();
    });
  });

  describe('Cookie Security', () => {
    it('should set secure cookie attributes', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test@example.com',
          password: 'password123'
        });
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
        expect(cookies.some((c: string) => c.includes('SameSite=Strict'))).toBe(true);
        
        // In production, should also include Secure
        if (process.env.NODE_ENV === 'production') {
          expect(cookies.some((c: string) => c.includes('Secure'))).toBe(true);
        }
      }
    });
  });

  describe('Input Validation Enhancement', () => {
    it('should detect command injection attempts', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({
          command: 'ls -la; rm -rf /'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('injection');
    });

    it('should detect LDAP injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin)(uid=*))(|(uid=*',
          password: 'password'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('injection');
    });

    it('should validate FHIR resource IDs', async () => {
      const response = await request(app)
        .get('/api/fhir/Patient/../../etc/passwd')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
    });
  });
});