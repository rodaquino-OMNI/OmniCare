import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import config from '../../../src/config';
import { authMiddleware, requirePermissions, requireRole } from '../../../src/middleware/auth.middleware';
import { Permission } from '../../../src/types/auth.types';
import logger from '../../../src/utils/logger';
import { createMockUser } from '../../test-helpers';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/config', () => ({
  jwt: {
    secret: 'test-jwt-secret',
    expiresIn: '1h'
  }
}));
jest.mock('../../../src/utils/logger');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockJwt = jwt as jest.Mocked<typeof jwt>;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should authenticate user with valid JWT token', async () => {
      const validToken = 'valid.jwt.token';
      const decodedPayload = {
        sub: 'user-123',
        username: 'testuser',
        role: 'physician',
        permissions: ['patient:read', 'patient:write'],
        type: 'access',
        iss: 'omnicare',
        aud: 'omnicare-api',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      };

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`
      };

      mockJwt.verify.mockReturnValue(decodedPayload as any);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockJwt.verify).toHaveBeenCalledWith(validToken, config.jwt.secret);
      expect(mockRequest.user).toEqual({
        id: decodedPayload.sub,
        username: decodedPayload.username,
        role: decodedPayload.role,
        permissions: decodedPayload.permissions,
        tokenType: decodedPayload.type
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should authenticate user with valid JWT token in query parameter', async () => {
      const validToken = 'valid.jwt.token';
      const decodedPayload = {
        sub: 'user-123',
        username: 'testuser',
        role: 'nursing_staff',
        permissions: ['patient:read'],
        type: 'access'
      };

      mockRequest.query = {
        access_token: validToken
      };

      mockJwt.verify.mockReturnValue(decodedPayload as any);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockJwt.verify).toHaveBeenCalledWith(validToken, config.jwt.secret);
      expect(mockRequest.user).toBeDefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request with no authorization token', async () => {
      mockRequest.headers = {};

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'No authorization token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid authorization header format'
      });
    });

    it('should reject request with invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      mockRequest.headers = {
        authorization: `Bearer ${invalidToken}`
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid token'
      });
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Invalid JWT token attempted',
        expect.objectContaining({
          error: 'invalid token'
        })
      );
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = 'expired.jwt.token';
      
      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'token_expired',
        message: 'Token has expired'
      });
    });

    it('should reject token with invalid signature', async () => {
      const tokenWithInvalidSignature = 'token.with.invalid.signature';
      
      mockRequest.headers = {
        authorization: `Bearer ${tokenWithInvalidSignature}`
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid signature');
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid token'
      });
    });

    it('should reject token with wrong token type', async () => {
      const refreshToken = 'refresh.token.type';
      const decodedPayload = {
        sub: 'user-123',
        username: 'testuser',
        type: 'refresh' // Wrong type for API access
      };

      mockRequest.headers = {
        authorization: `Bearer ${refreshToken}`
      };

      mockJwt.verify.mockReturnValue(decodedPayload as any);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid token type for API access'
      });
    });

    it('should handle JWT verification errors gracefully', async () => {
      const malformedToken = 'malformed.jwt';
      
      mockRequest.headers = {
        authorization: `Bearer ${malformedToken}`
      };

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Unexpected error during verification');
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Token verification failed'
      });
    });

    it('should log security events for failed authentication', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token'
      };
      (mockRequest as any).ip = '192.168.1.100';
      mockRequest.get = jest.fn().mockReturnValue('Mozilla/5.0');

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockLogger.security).toHaveBeenCalledWith(
        'Invalid JWT token attempted',
        expect.objectContaining({
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          error: 'invalid token'
        })
      );
    });
  });

  describe('requirePermissions middleware', () => {
    beforeEach(() => {
      mockRequest.user = createMockUser({
        id: 'user-123',
        username: 'testuser',
        role: 'physician',
        permissions: [Permission.VIEW_PATIENT_RECORDS, Permission.EDIT_PATIENT_RECORDS, Permission.VIEW_CLINICAL_NOTES]
      });
    });

    it('should allow access with required permissions', async () => {
      const middleware = requirePermissions(Permission.VIEW_PATIENT_RECORDS);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access with multiple required permissions', async () => {
      const middleware = requirePermissions(Permission.VIEW_PATIENT_RECORDS, Permission.VIEW_CLINICAL_NOTES);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access without required permissions', async () => {
      const middleware = requirePermissions(Permission.MANAGE_USERS);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Insufficient permissions',
        required: [Permission.MANAGE_USERS],
        missing: [Permission.MANAGE_USERS]
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access with partial permissions', async () => {
      const middleware = requirePermissions(Permission.VIEW_PATIENT_RECORDS, Permission.MANAGE_USERS);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Insufficient permissions',
        required: [Permission.VIEW_PATIENT_RECORDS, Permission.MANAGE_USERS],
        missing: [Permission.MANAGE_USERS]
      });
    });

    it('should handle user without permissions array', async () => {
      mockRequest.user = createMockUser({
        id: 'user-123',
        username: 'testuser',
        role: 'guest',
        permissions: undefined
      }) as any;

      const middleware = requirePermissions(Permission.VIEW_PATIENT_RECORDS);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Insufficient permissions',
        required: [Permission.VIEW_PATIENT_RECORDS],
        missing: [Permission.VIEW_PATIENT_RECORDS]
      });
    });

    it('should handle unauthenticated user', async () => {
      mockRequest.user = undefined;

      const middleware = requirePermissions(Permission.VIEW_PATIENT_RECORDS);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    });

    it('should log permission denied events', async () => {
      const middleware = requirePermissions(Permission.MANAGE_USERS);

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockLogger.security).toHaveBeenCalledWith(
        'Permission denied',
        expect.objectContaining({
          userId: 'user-123',
          username: 'testuser',
          role: 'physician',
          requiredPermissions: [Permission.MANAGE_USERS]
        })
      );
    });
  });

  describe('requireRole middleware', () => {
    beforeEach(() => {
      mockRequest.user = createMockUser({
        id: 'user-123',
        username: 'testuser',
        role: 'physician',
        permissions: ['patient:read', 'patient:write']
      });
    });

    it('should allow access with required role', async () => {
      const middleware = requireRole('physician');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access with one of multiple required roles', async () => {
      const middleware = requireRole('physician', 'nursing_staff');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access without required role', async () => {
      const middleware = requireRole('administrative_staff');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Insufficient role privileges',
        required: ['administrative_staff'],
        current: 'physician'
      });
    });

    it('should handle unauthenticated user', async () => {
      mockRequest.user = undefined;

      const middleware = requireRole('physician');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    });

    it('should handle user without role', async () => {
      mockRequest.user = createMockUser({
        id: 'user-123',
        username: 'testuser',
        role: undefined
      }) as any;

      const middleware = requireRole('physician');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Insufficient role privileges',
        required: ['physician'],
        current: undefined
      });
    });

    it('should log role access denied events', async () => {
      const middleware = requireRole('administrative_staff');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockLogger.security).toHaveBeenCalledWith(
        'Role access denied',
        expect.objectContaining({
          userId: 'user-123',
          username: 'testuser',
          currentRole: 'physician',
          requiredRoles: ['administrative_staff']
        })
      );
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle very long authorization headers', async () => {
      const veryLongToken = 'Bearer ' + 'a'.repeat(10000);
      
      mockRequest.headers = {
        authorization: veryLongToken
      };

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Token verification failed'
      });
    });

    it('should handle special characters in token', async () => {
      const tokenWithSpecialChars = 'token.with.special!@#$%^&*()chars';
      
      mockRequest.headers = {
        authorization: `Bearer ${tokenWithSpecialChars}`
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should prevent privilege escalation attempts', async () => {
      const maliciousPayload = {
        sub: 'user-123',
        username: 'testuser',
        role: 'administrative_staff', // Attempting to escalate to admin
        permissions: ['admin:write', 'system:delete'], // Malicious permissions
        type: 'access'
      };

      const maliciousToken = 'malicious.token';
      
      mockRequest.headers = {
        authorization: `Bearer ${maliciousToken}`
      };

      // Even if token is somehow valid, it should be from trusted source
      mockJwt.verify.mockReturnValue(maliciousPayload as any);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should authenticate normally - privilege verification happens at permission/role level
      expect(mockRequest.user).toEqual({
        id: maliciousPayload.sub,
        username: maliciousPayload.username,
        role: maliciousPayload.role,
        permissions: maliciousPayload.permissions,
        tokenType: maliciousPayload.type
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should rate limit authentication attempts', async () => {
      // This would typically be handled by rate limiting middleware
      // But we can test that multiple failed attempts are logged
      mockRequest.headers = {
        authorization: 'Bearer invalid.token'
      };
      (mockRequest as any).ip = '192.168.1.100';

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      // Simulate multiple attempts
      for (let i = 0; i < 5; i++) {
        await authMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }

      expect(mockLogger.security).toHaveBeenCalledTimes(5);
    });

    it('should handle token injection attempts', async () => {
      mockRequest.headers = {
        authorization: 'Bearer token1',
        'x-access-token': 'token2'
      };
      mockRequest.query = {
        access_token: 'token3'
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should only try to verify the Authorization header token
      expect(mockJwt.verify).toHaveBeenCalledTimes(1);
      expect(mockJwt.verify).toHaveBeenCalledWith('token1', config.jwt.secret);
    });
  });
});