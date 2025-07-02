import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

import { JWTAuthService } from '../auth/jwt.service';
import { getRolePermissions } from '../auth/role-permissions';
import config from '../config';
import { AuditService } from '../services/audit.service';
import { databaseService } from '../services/database.service';
import { SessionManager } from '../services/session.service';
import { smartFHIRService } from '../services/smart-fhir.service';
import { User } from '../types/auth.types';
import logger from '../utils/logger';

/**
 * Safely convert query parameter to string
 */
function toSafeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return '';
}

interface AuthCodeData {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  launchContext?: Record<string, unknown>;
  authResult?: Record<string, unknown>;
  createdAt?: Date;
  expiresAt?: number;
}

interface TokenData {
  scope?: string;
  client_id?: string;
  sub?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  patient?: string;
  encounter?: string;
  fhirUser?: string;
  type?: string;
  userId?: string;
  sessionId?: string;
  username?: string;
  role?: string;
}

/**
 * Authentication Controller
 * Handles OAuth2/SMART on FHIR and internal authentication
 */
export class AuthController {
  private jwtService: JWTAuthService;
  private sessionManager: SessionManager;
  private auditService: AuditService;
  private authCodes: Map<string, AuthCodeData> = new Map();

  constructor() {
    this.jwtService = new JWTAuthService();
    this.sessionManager = new SessionManager();
    this.auditService = new AuditService();
  }

  /**
   * SMART on FHIR Authorization endpoint
   * GET /auth/authorize
   */
  async authorize(req: Request, res: Response): Promise<void> {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
        aud,
        launch,
      } = req.query;

      logger.security('SMART authorization request', {
        client_id,
        response_type,
        scope,
        launch: !!launch,
      });

      // Validate required parameters
      if (response_type !== 'code') {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'response_type must be "code"',
        });
        return;
      }

      if (!client_id) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'client_id is required',
        });
        return;
      }

      if (!redirect_uri) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'redirect_uri is required',
        });
        return;
      }

      // Handle EHR launch
      if (launch) {
        if (!aud) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'aud parameter required for EHR launch',
          });
          return;
        }

        const launchResult = await smartFHIRService.handleEHRLaunch(
          aud as string,
          launch as string,
          client_id as string,
          redirect_uri as string,
          (scope as string)?.split(' ') || []
        );

        // Generate authorization code
        const authCode = this.generateAuthCode();
        this.authCodes.set(authCode, {
          clientId: toSafeString(client_id),
          redirectUri: toSafeString(redirect_uri),
          scope: toSafeString(scope),
          state: state ? toSafeString(state) : undefined,
          launchContext: launchResult,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        const redirectUrl = new URL(redirect_uri as string);
        redirectUrl.searchParams.set('code', authCode);
        if (state) {
          redirectUrl.searchParams.set('state', state as string);
        }

        res.redirect(redirectUrl.toString());
        return;
      }

      // Handle standalone launch
      const authResult = await smartFHIRService.initiateAuthorization(
        client_id as string,
        redirect_uri as string,
        (scope as string)?.split(' ') || [],
        state as string,
        undefined
      );

      // Generate authorization code
      const authCode = this.generateAuthCode();
      this.authCodes.set(authCode, {
        clientId: toSafeString(client_id),
        redirectUri: toSafeString(redirect_uri),
        scope: toSafeString(scope),
        state: state ? toSafeString(state) : undefined,
        authResult,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      const redirectUrl = new URL(redirect_uri as string);
      redirectUrl.searchParams.set('code', authCode);
      if (state) {
        redirectUrl.searchParams.set('state', state as string);
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Authorization server error',
      });
    }
  }

  /**
   * Token endpoint
   * POST /auth/token
   */
  async token(req: Request, res: Response): Promise<void> {
    try {
      const { grant_type, code, redirect_uri, client_id, refresh_token, client_secret, scope } = req.body;

      switch (grant_type) {
        case 'authorization_code':
          await this.handleAuthorizationCodeGrant(req, res, code, redirect_uri, client_id);
          break;
        case 'refresh_token':
          await this.handleRefreshTokenGrant(req, res, refresh_token, client_id);
          break;
        case 'client_credentials':
          await this.handleClientCredentialsGrant(req, res, client_id, client_secret, scope);
          break;
        default:
          res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Supported grant types: authorization_code, refresh_token, client_credentials',
          });
      }
    } catch (error) {
      logger.error('Token endpoint error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Token server error',
      });
    }
  }

  /**
   * Token introspection endpoint
   * POST /auth/introspect
   */
  async introspect(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'token parameter is required',
        });
        return;
      }

      try {
        // Simulate async operation for ESLint compliance
        await Promise.resolve();
        const decoded = jwt.verify(token, config.jwt.secret) as TokenData;
        
        res.json({
          active: true,
          scope: decoded.scope,
          client_id: decoded.client_id,
          sub: decoded.sub,
          aud: decoded.aud,
          iss: decoded.iss,
          exp: decoded.exp,
          iat: decoded.iat,
          patient: decoded.patient,
          encounter: decoded.encounter,
          fhirUser: decoded.fhirUser,
        });
      } catch {
        res.json({ active: false });
      }
    } catch (error) {
      logger.error('Introspection error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Introspection server error',
      });
    }
  }

  /**
   * Internal login endpoint
   * POST /auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      logger.security('Login attempt', { username });

      // Query user from database
      const userResult = await databaseService.query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
      );

      if (userResult.rows.length === 0) {
        await this.auditService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          userId: username,
          severity: 'MEDIUM',
          description: 'Login failed: User not found',
          metadata: {
            username,
            reason: 'User not found',
            ipAddress: req.ip,
          }
        });

        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        });
        return;
      }

      const user = userResult.rows[0];
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        await this.auditService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          userId: username,
          severity: 'MEDIUM',
          description: 'Login failed: Invalid password',
          metadata: {
            username,
            reason: 'Invalid password',
            ipAddress: req.ip,
          }
        });

        res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        });
        return;
      }

      // Create session
      const session = await this.sessionManager.createSession(user as User, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown');

      // Get permissions for the user's role
      const permissions = getRolePermissions(user.role);

      // Generate tokens
      const accessToken = this.jwtService.generateAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions,
        sessionId: session.sessionId,
      });

      const refreshToken = this.jwtService.generateRefreshToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions,
        sessionId: session.sessionId,
      });

      await this.auditService.logSecurityEvent({
        type: 'LOGIN_SUCCESS',
        userId: user.id,
        severity: 'LOW',
        description: `Successful login for user ${username}`,
        metadata: {
          username,
          ipAddress: req.ip,
        }
      });

      res.json({
        success: true,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        session: {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'An error occurred during login',
      });
    }
  }

  /**
   * Refresh token endpoint
   * POST /auth/refresh
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
        });
        return;
      }

      try {
        const decoded = jwt.verify(refreshToken, config.jwt.secret) as TokenData;

        if (decoded.type !== 'refresh') {
          throw new Error('Invalid token type');
        }

        // Check if user exists
        const userResult = await databaseService.query(
          'SELECT * FROM users WHERE id = $1 AND is_active = true',
          [decoded.userId]
        );

        if (userResult.rows.length === 0) {
          throw new Error('User not found');
        }

        const user = userResult.rows[0];
        if (!user) {
          throw new Error('User not found');
        }
        
        // Get permissions for the user's role
        const permissions = getRolePermissions(user.role);

        // Generate new tokens
        const newAccessToken = this.jwtService.generateAccessToken({
          userId: user.id,
          username: user.username,
          role: user.role,
          permissions,
          sessionId: decoded.sessionId || '',
        });

        const newRefreshToken = this.jwtService.generateRefreshToken({
          userId: user.id,
          username: user.username,
          role: user.role,
          permissions,
          sessionId: decoded.sessionId || '',
        });

        res.json({
          success: true,
          tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        });
      } catch {
        res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }
    } catch (error) {
      logger.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'An error occurred during token refresh',
      });
    }
  }

  /**
   * Logout endpoint
   * POST /auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.session?.sessionId;

      if (sessionId && typeof sessionId === 'string') {
        await this.sessionManager.terminateSession(sessionId);
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'An error occurred during logout',
      });
    }
  }

  /**
   * Get current user
   * GET /auth/me
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const authUser = req.user;
      
      if (!authUser || !authUser.id) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
        return;
      }

      const userId = authUser.id;

      const userResult = await databaseService.query(
        'SELECT id, username, email, first_name, last_name, role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        return;
      }

      const user = userResult.rows[0];
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'An error occurred while fetching user data',
      });
    }
  }

  /**
   * Setup MFA
   * POST /auth/setup-mfa
   */
  async setupMfa(req: Request, res: Response): Promise<void> {
    // TODO: Implement MFA setup
    await Promise.resolve(); // Placeholder for future async implementation
    res.status(501).json({
      success: false,
      error: 'NOT_IMPLEMENTED',
      message: 'MFA setup not yet implemented',
    });
  }

  /**
   * Verify MFA
   * POST /auth/verify-mfa
   */
  async verifyMfa(req: Request, res: Response): Promise<void> {
    // TODO: Implement MFA verification
    await Promise.resolve(); // Placeholder for future async implementation
    res.status(501).json({
      success: false,
      error: 'NOT_IMPLEMENTED',
      message: 'MFA verification not yet implemented',
    });
  }

  // Private methods

  private generateAuthCode(): string {
    return `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async handleAuthorizationCodeGrant(
    req: Request,
    res: Response,
    code: string,
    redirect_uri: string,
    client_id: string
  ): Promise<void> {
    if (!code || !redirect_uri || !client_id) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters',
      });
      return Promise.resolve();
    }

    const codeData = this.authCodes.get(code);
    if (!codeData) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code',
      });
      return Promise.resolve();
    }

    // Check if code is expired
    if (codeData.expiresAt && typeof codeData.expiresAt === 'number' && Date.now() > codeData.expiresAt) {
      this.authCodes.delete(code);
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      });
      return Promise.resolve();
    }

    // Validate client_id and redirect_uri
    if (codeData.clientId !== client_id || codeData.redirectUri !== redirect_uri) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid client_id or redirect_uri',
      });
      return;
    }

    // Delete the code (one-time use)
    this.authCodes.delete(code);

    // Generate tokens
    const accessToken = jwt.sign(
      {
        type: 'access',
        client_id,
        scope: codeData.scope,
        iss: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
        aud: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
        ...codeData.launchContext,
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      {
        type: 'refresh',
        client_id,
        scope: codeData.scope,
        iss: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
      },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      scope: codeData.scope,
      refresh_token: refreshToken,
    });
  }

  private async handleRefreshTokenGrant(
    req: Request,
    res: Response,
    refresh_token: string,
    client_id: string
  ): Promise<void> {
    if (!refresh_token) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token is required',
      });
      return Promise.resolve();
    }

    try {
      const decoded = jwt.verify(refresh_token, config.jwt.secret) as TokenData;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      if (client_id && decoded.client_id !== client_id) {
        throw new Error('Client ID mismatch');
      }

      // Generate new access token
      const accessToken = jwt.sign(
        {
          type: 'access',
          client_id: decoded.client_id,
          scope: decoded.scope,
          iss: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
          aud: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
        },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      res.json({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        scope: decoded.scope,
      });
    } catch {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid refresh token',
      });
    }
  }

  private async handleClientCredentialsGrant(
    req: Request,
    res: Response,
    client_id: string,
    client_secret: string,
    scope: string
  ): Promise<void> {
    if (!client_id || !client_secret) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id and client_secret are required',
      });
      return;
    }

    // Validate client credentials
    const clientResult = await databaseService.query(
      'SELECT * FROM oauth_clients WHERE client_id = $1 AND client_secret = $2 AND is_active = true',
      [client_id, client_secret]
    );

    if (clientResult.rows.length === 0) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
      return;
    }

    const client = clientResult.rows[0];
    if (!client) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
      return;
    }

    // Validate scope
    const requestedScopes = scope ? scope.split(' ') : [];
    const allowedScopes = client.allowed_scopes || [];
    const grantedScopes = requestedScopes.filter(s => allowedScopes.includes(s));

    // Generate access token
    const accessToken = jwt.sign(
      {
        type: 'access',
        client_id,
        scope: grantedScopes.join(' '),
        iss: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
        aud: config.fhir.baseUrl || 'https://test-fhir.omnicare.com',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      scope: grantedScopes.join(' '),
    });
  }
}

// Export singleton instance
export const authController = new AuthController();