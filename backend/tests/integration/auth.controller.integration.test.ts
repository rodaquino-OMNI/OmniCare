import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authController } from '../../src/controllers/auth.controller';
import { smartFHIRService } from '../../src/services/smart-fhir.service';
import config from '../../src/config';
import logger from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/services/smart-fhir.service');
jest.mock('../../src/config', () => ({
  smart: {
    scopes: ['patient/*.read', 'user/*.read'],
  },
  fhir: {
    baseUrl: 'https://test-fhir.omnicare.com',
  },
  jwt: {
    secret: 'test-jwt-secret',
    expiresIn: '1h',
    refreshExpiresIn: '30d',
  },
}));
jest.mock('../../src/utils/logger');

describe('Auth Controller Integration Tests', () => {
  let app: express.Application;
  const mockSmartFHIRService = smartFHIRService as jest.Mocked<typeof smartFHIRService>;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Set up routes
    app.get('/auth/authorize', authController.authorize.bind(authController));
    app.post('/auth/token', authController.token.bind(authController));
    app.post('/auth/introspect', authController.introspect.bind(authController));
    app.post('/auth/login', authController.login.bind(authController));
    app.post('/auth/refresh', authController.refreshInternalToken.bind(authController));

    jest.clearAllMocks();
  });

  describe('SMART on FHIR Authorization', () => {
    describe('GET /auth/authorize', () => {
      it('should handle standalone authorization request', async () => {
        mockSmartFHIRService.initiateAuthorization.mockResolvedValue({
          state: 'test-state-123',
          aud: 'https://test-fhir.omnicare.com',
        });

        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
            scope: 'patient/*.read user/*.read',
            state: 'client-state-456',
          });

        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(/https:\/\/app\.example\.com\/callback/);
        expect(response.headers.location).toMatch(/code=/);
        expect(response.headers.location).toMatch(/state=client-state-456/);

        expect(mockSmartFHIRService.initiateAuthorization).toHaveBeenCalledWith(
          'test-client',
          'https://app.example.com/callback',
          ['patient/*.read', 'user/*.read'],
          'client-state-456',
          undefined
        );

        expect(mockLogger.security).toHaveBeenCalledWith(
          'SMART authorization request',
          expect.objectContaining({
            client_id: 'test-client',
            response_type: 'code',
            scope: 'patient/*.read user/*.read',
          })
        );
      });

      it('should handle EHR launch authorization request', async () => {
        mockSmartFHIRService.handleEHRLaunch.mockResolvedValue({
          state: 'ehr-state-789',
          aud: 'https://test-fhir.omnicare.com',
        });

        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
            scope: 'launch patient/*.read',
            aud: 'https://test-fhir.omnicare.com',
            launch: 'launch-context-123',
          });

        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(/code=/);

        expect(mockSmartFHIRService.handleEHRLaunch).toHaveBeenCalledWith(
          'https://test-fhir.omnicare.com',
          'launch-context-123',
          'test-client',
          'https://app.example.com/callback',
          ['launch', 'patient/*.read']
        );
      });

      it('should return error for invalid response_type', async () => {
        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'token',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_request',
          error_description: 'response_type must be "code"',
        });
      });

      it('should return error for missing client_id', async () => {
        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            redirect_uri: 'https://app.example.com/callback',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_request',
          error_description: 'client_id is required',
        });
      });

      it('should return error for missing redirect_uri', async () => {
        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_request',
          error_description: 'redirect_uri is required',
        });
      });

      it('should return error for EHR launch without aud', async () => {
        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
            launch: 'launch-context-123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_request',
          error_description: 'aud parameter required for EHR launch',
        });
      });

      it('should handle authorization errors', async () => {
        mockSmartFHIRService.initiateAuthorization.mockRejectedValue(
          new Error('Authorization service error')
        );

        const response = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
          });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'server_error',
          error_description: 'Authorization server error',
        });
      });
    });

    describe('POST /auth/token', () => {
      it('should exchange authorization code for tokens', async () => {
        // First, get an authorization code
        mockSmartFHIRService.initiateAuthorization.mockResolvedValue({
          state: 'test-state-123',
          aud: 'https://test-fhir.omnicare.com',
        });

        const authResponse = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
            scope: 'patient/*.read user/*.read',
          });

        // Extract authorization code from redirect URL
        const redirectUrl = new URL(authResponse.headers.location);
        const authCode = redirectUrl.searchParams.get('code');

        // Exchange code for tokens
        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: 'https://app.example.com/callback',
            client_id: 'test-client',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'patient/*.read user/*.read',
          refresh_token: expect.any(String),
        });

        // Verify token contains expected claims
        const decodedToken = jwt.decode(response.body.access_token) as any;
        expect(decodedToken).toMatchObject({
          client_id: 'test-client',
          scope: 'patient/*.read user/*.read',
          type: 'access',
          iss: config.fhir.baseUrl,
        });
      });

      it('should handle refresh token grant', async () => {
        // Create a valid refresh token
        const refreshToken = jwt.sign(
          {
            client_id: 'test-client',
            scope: 'patient/*.read',
            type: 'refresh',
            iss: config.fhir.baseUrl,
          },
          config.jwt.secret,
          { expiresIn: '30d' }
        );

        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: 'test-client',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'patient/*.read',
        });
      });

      it('should handle client credentials grant', async () => {
        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'client_credentials',
            client_id: 'omnicare-client',
            client_secret: 'omnicare-secret',
            scope: 'system/*.read',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'system/*.read',
        });

        const decodedToken = jwt.decode(response.body.access_token) as any;
        expect(decodedToken).toMatchObject({
          client_id: 'omnicare-client',
          scope: 'system/*.read',
          type: 'system',
        });
      });

      it('should return error for invalid authorization code', async () => {
        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'authorization_code',
            code: 'invalid-code',
            redirect_uri: 'https://app.example.com/callback',
            client_id: 'test-client',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code',
        });
      });

      it('should return error for invalid refresh token', async () => {
        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'refresh_token',
            refresh_token: 'invalid-refresh-token',
            client_id: 'test-client',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token',
        });
      });

      it('should return error for invalid client credentials', async () => {
        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'client_credentials',
            client_id: 'invalid-client',
            client_secret: 'invalid-secret',
          });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        });
      });

      it('should return error for unsupported grant type', async () => {
        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'implicit',
            client_id: 'test-client',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'unsupported_grant_type',
          error_description: 'Supported grant types: authorization_code, refresh_token, client_credentials',
        });
      });

      it('should return error for expired authorization code', async () => {
        // Get authorization code
        mockSmartFHIRService.initiateAuthorization.mockResolvedValue({
          state: 'test-state-123',
          aud: 'https://test-fhir.omnicare.com',
        });

        const authResponse = await request(app)
          .get('/auth/authorize')
          .query({
            response_type: 'code',
            client_id: 'test-client',
            redirect_uri: 'https://app.example.com/callback',
          });

        const redirectUrl = new URL(authResponse.headers.location);
        const authCode = redirectUrl.searchParams.get('code');

        // Wait for code to expire (simulate by manipulating internal state)
        // In a real test, you might use fake timers to advance time
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

        // Manually expire the code by accessing private property (for test purposes)
        const controller = authController as any;
        const codeData = controller.authCodes.get(authCode);
        if (codeData) {
          codeData.expiresAt = Date.now() - 1000; // Set to past time
        }

        const response = await request(app)
          .post('/auth/token')
          .send({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: 'https://app.example.com/callback',
            client_id: 'test-client',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_grant',
          error_description: 'Authorization code expired',
        });
      });
    });

    describe('POST /auth/introspect', () => {
      it('should return active token information', async () => {
        const accessToken = jwt.sign(
          {
            client_id: 'test-client',
            scope: 'patient/*.read',
            sub: 'user-123',
            type: 'access',
            iss: config.fhir.baseUrl,
            aud: config.fhir.baseUrl,
            patient: 'patient-456',
            encounter: 'encounter-789',
            fhirUser: 'Practitioner/practitioner-123',
          },
          config.jwt.secret,
          { expiresIn: '1h' }
        );

        const response = await request(app)
          .post('/auth/introspect')
          .send({ token: accessToken });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          active: true,
          scope: 'patient/*.read',
          client_id: 'test-client',
          sub: 'user-123',
          patient: 'patient-456',
          encounter: 'encounter-789',
          fhirUser: 'Practitioner/practitioner-123',
        });
      });

      it('should return inactive for invalid token', async () => {
        const response = await request(app)
          .post('/auth/introspect')
          .send({ token: 'invalid-token' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ active: false });
      });

      it('should return error for missing token', async () => {
        const response = await request(app)
          .post('/auth/introspect')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_request',
          error_description: 'token parameter is required',
        });
      });
    });
  });

  describe('Internal API Authentication', () => {
    describe('POST /auth/login', () => {
      it('should authenticate admin user successfully', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            username: 'admin',
            password: 'admin123',
            clientId: 'omnicare-admin',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          token_type: 'bearer',
          expires_in: 24 * 60 * 60,
          refresh_token: expect.any(String),
          scope: 'admin system/*.read system/*.write user/*.read user/*.write',
          user: {
            id: 'user-1',
            username: 'admin',
            name: 'System Administrator',
            role: 'admin',
          },
        });

        const decodedToken = jwt.decode(response.body.access_token) as any;
        expect(decodedToken).toMatchObject({
          sub: 'user-1',
          username: 'admin',
          type: 'internal',
          iss: config.fhir.baseUrl,
          aud: config.fhir.baseUrl,
        });
      });

      it('should authenticate clinician user successfully', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            username: 'clinician',
            password: 'clinic123',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          user: {
            id: 'user-2',
            username: 'clinician',
            name: 'Dr. Jane Smith',
            role: 'clinician',
          },
        });
      });

      it('should return error for invalid credentials', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            username: 'invalid',
            password: 'invalid',
          });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: 'invalid_credentials',
          error_description: 'Invalid username or password',
        });

        expect(mockLogger.security).toHaveBeenCalledWith(
          'Login failed - invalid credentials',
          expect.objectContaining({
            username: 'invalid',
          })
        );
      });
    });

    describe('POST /auth/refresh', () => {
      it('should refresh internal token successfully', async () => {
        const refreshToken = jwt.sign(
          {
            sub: 'user-1',
            username: 'admin',
            type: 'refresh',
          },
          config.jwt.secret,
          { expiresIn: '30d' }
        );

        const response = await request(app)
          .post('/auth/refresh')
          .send({
            refresh_token: refreshToken,
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          token_type: 'bearer',
          expires_in: 24 * 60 * 60,
          scope: 'admin system/*.read system/*.write user/*.read user/*.write',
        });
      });

      it('should return error for invalid refresh token', async () => {
        const response = await request(app)
          .post('/auth/refresh')
          .send({
            refresh_token: 'invalid-refresh-token',
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token',
        });
      });

      it('should return error for missing refresh token', async () => {
        const response = await request(app)
          .post('/auth/refresh')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_request',
          error_description: 'refresh_token is required',
        });
      });

      it('should return error for non-existent user', async () => {
        const refreshToken = jwt.sign(
          {
            sub: 'non-existent-user',
            username: 'non-existent',
            type: 'refresh',
          },
          config.jwt.secret,
          { expiresIn: '30d' }
        );

        const response = await request(app)
          .post('/auth/refresh')
          .send({
            refresh_token: refreshToken,
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_grant',
          error_description: 'User not found',
        });
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should log security events for all authentication attempts', async () => {
      await request(app)
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        });

      expect(mockLogger.security).toHaveBeenCalledWith(
        'Internal API login attempt',
        expect.objectContaining({
          username: 'admin',
        })
      );

      expect(mockLogger.security).toHaveBeenCalledWith(
        'Internal API login successful',
        expect.objectContaining({
          userId: 'user-1',
          username: 'admin',
        })
      );
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/auth/token')
        .send('{invalid-json');

      expect(response.status).toBe(400);
    });
  });
});