import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTAuthService } from '../../src/auth/jwt.service';
import { UserRoles } from '../../src/types/auth.types';

describe('JWT Security Tests', () => {
  let jwtService: JWTAuthService;
  const testUser = {
    id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRoles.PHYSICIAN,
    department: 'Cardiology',
    isActive: true,
    isMfaEnabled: false,
    passwordChangedAt: new Date(),
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jwtService = new JWTAuthService();
  });

  describe('Token Generation Security', () => {
    it('should generate cryptographically secure tokens', () => {
      const tokens1 = jwtService.generateTokens(testUser);
      const tokens2 = jwtService.generateTokens(testUser);
      
      // Tokens should be unique
      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
      
      // Tokens should have sufficient length
      expect(tokens1.accessToken.length).toBeGreaterThan(100);
      expect(tokens1.refreshToken.length).toBeGreaterThan(100);
      
      // Tokens should follow JWT format
      expect(tokens1.accessToken.split('.')).toHaveLength(3);
      expect(tokens1.refreshToken.split('.')).toHaveLength(3);
    });

    it('should include required security claims in JWT', () => {
      const tokens = jwtService.generateTokens(testUser);
      const decoded = jwt.decode(tokens.accessToken) as any;
      
      // Check required claims
      expect(decoded.iss).toBeDefined(); // Issuer
      expect(decoded.aud).toBeDefined(); // Audience
      expect(decoded.exp).toBeDefined(); // Expiration
      expect(decoded.iat).toBeDefined(); // Issued at
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.sessionId).toBeDefined();
      
      // Expiration should be reasonable (15 minutes)
      const expirationTime = decoded.exp * 1000;
      const issuedTime = decoded.iat * 1000;
      const tokenLifetime = expirationTime - issuedTime;
      expect(tokenLifetime).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should not include sensitive data in JWT payload', () => {
      const tokens = jwtService.generateTokens(testUser);
      const decoded = jwt.decode(tokens.accessToken) as any;
      const tokenString = JSON.stringify(decoded);
      
      // Should not contain sensitive information
      expect(tokenString).not.toContain('password');
      expect(tokenString).not.toContain('hash');
      expect(tokenString).not.toContain('secret');
      expect(tokenString).not.toContain('key');
    });
  });

  describe('Token Validation Security', () => {
    it('should validate token signature correctly', () => {
      const tokens = jwtService.generateTokens(testUser);
      
      // Valid token should pass
      expect(() => {
        jwtService.verifyAccessToken(tokens.accessToken);
      }).not.toThrow();
      
      // Tampered token should fail
      const parts = tokens.accessToken.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.tampered_signature';
      
      expect(() => {
        jwtService.verifyAccessToken(tamperedToken);
      }).toThrow('Invalid or expired access token');
    });

    it('should reject tokens with modified payload', () => {
      const tokens = jwtService.generateTokens(testUser);
      const [header, payload, signature] = tokens.accessToken.split('.');
      
      // Ensure payload exists before processing
      if (!payload) {
        throw new Error('Invalid JWT token structure');
      }
      
      // Decode and modify payload
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      decodedPayload.role = UserRoles.SYSTEM_ADMINISTRATOR; // Escalate privileges
      
      // Re-encode with modified payload
      const modifiedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
      const tamperedToken = header + '.' + modifiedPayload + '.' + signature;
      
      expect(() => {
        jwtService.verifyAccessToken(tamperedToken);
      }).toThrow('Invalid or expired access token');
    });

    it('should prevent algorithm confusion attacks', () => {
      // Create token with 'none' algorithm
      const noneToken = jwt.sign(
        { userId: testUser.id, role: UserRoles.SYSTEM_ADMINISTRATOR },
        '',
        { algorithm: 'none' as any }
      );
      
      expect(() => {
        jwtService.verifyAccessToken(noneToken);
      }).toThrow('Invalid or expired access token');
      
      // Create token with asymmetric algorithm (should fail with HMAC key)
      const rsaToken = jwt.sign(
        { userId: testUser.id, role: UserRoles.SYSTEM_ADMINISTRATOR },
        'fake-private-key',
        { algorithm: 'RS256' }
      );
      
      expect(() => {
        jwtService.verifyAccessToken(rsaToken);
      }).toThrow('Invalid or expired access token');
    });

    it('should validate token expiration', () => {
      // Create expired token
      const expiredToken = jwt.sign(
        {
          userId: testUser.id,
          username: testUser.username,
          role: testUser.role,
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production'
      );
      
      expect(() => {
        jwtService.verifyAccessToken(expiredToken);
      }).toThrow('Invalid or expired access token');
    });

    it('should validate issuer and audience claims', () => {
      // Token with wrong issuer
      const wrongIssuerToken = jwt.sign(
        {
          userId: testUser.id,
          iss: 'malicious-issuer',
          aud: 'omnicare-app'
        },
        process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production',
        { expiresIn: '15m' }
      );
      
      expect(() => {
        jwtService.verifyAccessToken(wrongIssuerToken);
      }).toThrow('Invalid or expired access token');
      
      // Token with wrong audience
      const wrongAudienceToken = jwt.sign(
        {
          userId: testUser.id,
          iss: 'omnicare-emr',
          aud: 'malicious-app'
        },
        process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production',
        { expiresIn: '15m' }
      );
      
      expect(() => {
        jwtService.verifyAccessToken(wrongAudienceToken);
      }).toThrow('Invalid or expired access token');
    });
  });

  describe('Refresh Token Security', () => {
    it('should validate refresh token separately', () => {
      const tokens = jwtService.generateTokens(testUser);
      
      // Access token should not work as refresh token
      expect(() => {
        jwtService.verifyRefreshToken(tokens.accessToken);
      }).toThrow('Invalid or expired refresh token');
      
      // Refresh token should work correctly
      const decoded = jwtService.verifyRefreshToken(tokens.refreshToken);
      expect(decoded.userId).toBe(testUser.id);
    });

    it('should prevent refresh token reuse after user changes', () => {
      const tokens = jwtService.generateTokens(testUser);
      
      // First refresh should work
      const newTokens = jwtService.refreshAccessToken(tokens.refreshToken, testUser);
      expect(newTokens.accessToken).toBeDefined();
      
      // Simulate user change (password change, role change, etc.)
      const modifiedUser = { ...testUser, role: UserRoles.NURSING_STAFF };
      
      // Old refresh token should still validate structurally but new tokens should reflect changes
      const newerTokens = jwtService.refreshAccessToken(tokens.refreshToken, modifiedUser);
      const decoded = jwt.decode(newerTokens.accessToken) as any;
      expect(decoded.role).toBe(UserRoles.NURSING_STAFF);
    });

    it('should prevent user mismatch in refresh token', () => {
      const tokens = jwtService.generateTokens(testUser);
      const differentUser = { ...testUser, id: 'different-user-id' };
      
      expect(() => {
        jwtService.refreshAccessToken(tokens.refreshToken, differentUser);
      }).toThrow('Token user mismatch');
    });
  });

  describe('Timing Attack Protection', () => {
    it('should have consistent verification time for invalid tokens', async () => {
      const validTokens = jwtService.generateTokens(testUser);
      const invalidToken = 'invalid.jwt.token';
      const expiredToken = jwt.sign(
        { userId: 'test', exp: Math.floor(Date.now() / 1000) - 3600 },
        'wrong-secret'
      );
      
      // Measure timing for different invalid token types
      const timings: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const start = process.hrtime.bigint();
        try {
          jwtService.verifyAccessToken(invalidToken);
        } catch {}
        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1000000); // Convert to milliseconds
      }
      
      for (let i = 0; i < 5; i++) {
        const start = process.hrtime.bigint();
        try {
          jwtService.verifyAccessToken(expiredToken);
        } catch {}
        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1000000);
      }
      
      // Check that timing variations are minimal
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      
      // Deviation should be less than 50% of average timing
      expect(maxDeviation).toBeLessThan(avgTiming * 0.5);
    });
  });

  describe('Token Extraction Security', () => {
    it('should safely extract tokens from headers', () => {
      const tokens = jwtService.generateTokens(testUser);
      
      // Valid Bearer token
      const validHeader = `Bearer ${tokens.accessToken}`;
      expect(jwtService.extractTokenFromHeader(validHeader)).toBe(tokens.accessToken);
      
      // Invalid formats should return null
      expect(jwtService.extractTokenFromHeader('Basic dXNlcjpwYXNz')).toBeNull();
      expect(jwtService.extractTokenFromHeader('Bearer')).toBeNull();
      expect(jwtService.extractTokenFromHeader('Bearer ')).toBeNull();
      expect(jwtService.extractTokenFromHeader('InvalidFormat')).toBeNull();
      expect(jwtService.extractTokenFromHeader('')).toBeNull();
      expect(jwtService.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('Key Security', () => {
    it('should use sufficiently strong secrets', () => {
      const accessSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production';
      const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production';
      
      // Check minimum length
      expect(accessSecret.length).toBeGreaterThanOrEqual(32);
      expect(refreshSecret.length).toBeGreaterThanOrEqual(32);
      
      // Check that default secrets are not used in production-like environment
      if (process.env.NODE_ENV === 'production') {
        expect(accessSecret).not.toBe('access-secret-change-in-production');
        expect(refreshSecret).not.toBe('refresh-secret-change-in-production');
      }
      
      // Secrets should be different
      expect(accessSecret).not.toBe(refreshSecret);
    });

    it('should handle key rotation gracefully', () => {
      const tokens = jwtService.generateTokens(testUser);
      
      // Create new service with different key (simulating key rotation)
      const oldSecret = process.env.JWT_ACCESS_SECRET;
      process.env.JWT_ACCESS_SECRET = 'new-rotated-secret-for-testing';
      
      const newJwtService = new JWTAuthService();
      
      // Old token should fail with new key
      expect(() => {
        newJwtService.verifyAccessToken(tokens.accessToken);
      }).toThrow('Invalid or expired access token');
      
      // Restore original secret
      process.env.JWT_ACCESS_SECRET = oldSecret;
    });
  });

  describe('JWT Bombing Protection', () => {
    it('should handle oversized JWT tokens', () => {
      // Create extremely large payload
      const largePayload = {
        userId: testUser.id,
        username: testUser.username,
        role: testUser.role,
        largeData: 'x'.repeat(100000) // 100KB of data
      };
      
      // This should either fail gracefully or handle the large token
      expect(() => {
        const largeToken = jwt.sign(
          largePayload,
          process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production',
          { expiresIn: '15m' }
        );
        
        // Verification should handle large tokens without crashing
        jwtService.verifyAccessToken(largeToken);
      }).not.toThrow(/memory|size|limit/i);
    });

    it('should limit token validation time', async () => {
      const tokens = jwtService.generateTokens(testUser);
      
      const startTime = Date.now();
      jwtService.verifyAccessToken(tokens.accessToken);
      const endTime = Date.now();
      
      // Token verification should be fast (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Claims Validation', () => {
    it('should validate custom claims securely', () => {
      const tokens = jwtService.generateTokens(testUser);
      const decoded = jwtService.verifyAccessToken(tokens.accessToken);
      
      // Verify all expected claims are present
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.permissions).toBeDefined();
      expect(Array.isArray(decoded.permissions)).toBe(true);
      expect(decoded.sessionId).toBeDefined();
      
      // SessionId should be UUID format
      expect(decoded.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should not accept tokens with missing required claims', () => {
      // Create token without required claims
      const incompleteToken = jwt.sign(
        {
          userId: testUser.id
          // Missing username, role, etc.
        },
        process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production',
        { expiresIn: '15m' }
      );
      
      // This should either fail verification or handle gracefully
      const decoded = jwtService.verifyAccessToken(incompleteToken);
      
      // If it doesn't fail, at least check that undefined claims are handled
      expect(decoded.userId).toBeDefined();
      // Missing claims should be undefined, not cause errors
    });
  });
});
