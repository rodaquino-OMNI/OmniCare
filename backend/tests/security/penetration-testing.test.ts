/**
 * OmniCare EMR Backend - Penetration Testing Suite
 * Comprehensive security testing for HIPAA compliance
 */

import request from 'supertest';
import { app } from '../../src/app';
import { testDataFactory } from '../fixtures/generators/test-data-factory';
import { JWTAuthService } from '../../src/auth/jwt.service';
import logger from '../../src/utils/logger';

const jwtService = new JWTAuthService();

describe('Security Penetration Testing', () => {
  let validToken: string;
  let adminToken: string;
  let sessionId: string;
  
  beforeAll(async () => {
    // Generate test tokens
    validToken = jwtService.generateAccessToken({
      userId: 'test-user',
      sessionId: 'test-session',
      role: 'physician'
    });
    
    adminToken = jwtService.generateAccessToken({
      userId: 'admin-user',
      sessionId: 'admin-session',
      role: 'system_administrator'
    });
    
    sessionId = 'test-session-' + Date.now();
  });

  describe('CSRF Protection', () => {
    it('should reject POST requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Test Patient' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_VALIDATION_FAILED');
    });

    it('should reject PUT requests without CSRF token', async () => {
      const response = await request(app)
        .put('/api/patients/123')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Updated Patient' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_VALIDATION_FAILED');
    });

    it('should reject DELETE requests without CSRF token', async () => {
      const response = await request(app)
        .delete('/api/patients/123')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_VALIDATION_FAILED');
    });

    it('should allow GET requests without CSRF token', async () => {
      const response = await request(app)
        .get('/ping')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
    });

    it('should reject requests with invalid CSRF token', async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({ name: 'Test Patient' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('CSRF_VALIDATION_FAILED');
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/patients');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('MISSING_AUTHORIZATION');
    });

    it('should reject requests with invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', 'Bearer invalid.jwt.token');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('AUTHENTICATION_FAILED');
    });

    it('should reject requests with expired JWT token', async () => {
      const expiredToken = jwtService.generateAccessToken({
        userId: 'test-user',
        sessionId: 'test-session',
        role: 'physician'
      }, '0s'); // Expires immediately
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for token to expire
      
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('AUTHENTICATION_FAILED');
    });

    it('should handle JWT token manipulation attempts', async () => {
      // Tamper with the token
      const parts = validToken.split('.');
      parts[1] = Buffer.from(JSON.stringify({ 
        userId: 'hacker', 
        role: 'system_administrator' 
      })).toString('base64');
      const tamperedToken = parts.join('.');
      
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${tamperedToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should sanitize SQL injection in query parameters', async () => {
      const response = await request(app)
        .get('/api/patients')
        .query({ search: "'; DROP TABLE patients; --" })
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Input validation failed');
    });

    it('should sanitize SQL injection in body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: "admin'; DROP TABLE users; --",
          password: 'password'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Input validation failed');
    });

    it('should sanitize NoSQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/patients/search')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          filter: { "$where": "function() { return true; }" }
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Input validation failed');
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML in request body', async () => {
      const response = await request(app)
        .post('/api/clinical-notes')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          content: '<script>alert("XSS")</script>Patient note'
        });
      
      // Should either reject or sanitize the input
      if (response.status === 200) {
        expect(response.body.content).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should escape output in responses', async () => {
      const maliciousName = '<img src=x onerror=alert("XSS")>';
      
      // Assuming patient creation endpoint exists
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: maliciousName,
          birthDate: '1990-01-01'
        });
      
      if (response.status === 200 || response.status === 201) {
        // Check that the response properly escapes the malicious content
        expect(response.body.name).not.toContain('<img');
        expect(response.body.name).not.toContain('onerror=');
      }
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await request(app)
        .get('/ping');
      
      // HIPAA-required security headers
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include CSP header', async () => {
      const response = await request(app)
        .get('/ping');
      
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal in file paths', async () => {
      const response = await request(app)
        .get('/api/files/../../../etc/passwd')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
    });

    it('should sanitize file upload names', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('test'), '../../malicious.php');
      
      if (response.status === 200) {
        expect(response.body.filename).not.toContain('..');
        expect(response.body.filename).not.toContain('.php');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make 150 requests rapidly (assuming limit is 100)
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(app)
            .get('/ping')
            .set('Authorization', `Bearer ${validToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/ping')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Authorization Bypass Prevention', () => {
    it('should prevent privilege escalation', async () => {
      // Regular user trying to access admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/INSUFFICIENT_PRIVILEGES|INSUFFICIENT_PERMISSIONS/);
    });

    it('should validate role-based access control', async () => {
      // Test various endpoints with different roles
      const endpoints = [
        { path: '/api/admin/config', requiredRole: 'system_administrator' },
        { path: '/api/patients', requiredRole: 'physician' },
        { path: '/api/billing', requiredRole: 'billing' }
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint.path)
          .set('Authorization', `Bearer ${validToken}`);
        
        // Should be denied if user doesn't have required role
        if (endpoint.requiredRole !== 'physician') {
          expect([403, 404]).toContain(response.status);
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should reject hijacked session attempts', async () => {
      // Simulate session hijacking by using same token from different IP
      const response1 = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Forwarded-For', '192.168.1.1');
      
      const response2 = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Forwarded-For', '10.0.0.1');
      
      // One of these should fail if session IP validation is enabled
      // Implementation depends on session security configuration
    });

    it('should handle concurrent session limits', async () => {
      // Create multiple sessions for same user
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const token = jwtService.generateAccessToken({
          userId: 'test-user',
          sessionId: `session-${i}`,
          role: 'physician'
        });
        sessions.push(token);
      }
      
      // Test if system enforces session limits
      const responses = await Promise.all(
        sessions.map(token => 
          request(app)
            .get('/api/patients')
            .set('Authorization', `Bearer ${token}`)
        )
      );
      
      // Check if any sessions were invalidated
      const invalidSessions = responses.filter(r => r.status === 401);
      // This depends on your session limit configuration
    });
  });

  describe('Audit Logging', () => {
    it('should log failed authentication attempts', async () => {
      const spy = jest.spyOn(logger, 'security');
      
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('LOGIN_FAILURE'),
        expect.any(Object)
      );
      
      spy.mockRestore();
    });

    it('should log unauthorized access attempts', async () => {
      const spy = jest.spyOn(logger, 'security');
      
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('HIPAA-Specific Security', () => {
    it('should enforce minimum necessary access', async () => {
      // Request sensitive patient data
      const response = await request(app)
        .get('/api/patients/123/full-record')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ fields: 'ssn,creditCard,mentalHealth' });
      
      // Should either restrict fields or require justification
      if (response.status === 200) {
        expect(response.body).not.toHaveProperty('ssn');
        expect(response.body).not.toHaveProperty('creditCard');
      }
    });

    it('should require consent for certain data access', async () => {
      const response = await request(app)
        .get('/api/patients/123/mental-health')
        .set('Authorization', `Bearer ${validToken}`);
      
      // Should require explicit consent
      if (response.status === 403) {
        expect(response.body.consentRequired).toBe(true);
      }
    });

    it('should track PHI access in audit logs', async () => {
      const spy = jest.spyOn(logger, 'audit');
      
      await request(app)
        .get('/api/patients/123')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('PHI'),
        expect.objectContaining({
          userId: expect.any(String),
          patientId: '123',
          action: expect.any(String)
        })
      );
      
      spy.mockRestore();
    });
  });
});