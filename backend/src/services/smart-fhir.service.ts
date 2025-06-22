import crypto from 'crypto';

import axios from 'axios';
import jwt from 'jsonwebtoken';

import config from '@/config';
import { 
  SMARTTokenResponse, 
  SMARTLaunchContext,
} from '@/types/fhir';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';

/**
 * SMART on FHIR Integration Service
 * Implements SMART on FHIR authorization and integration with external EHR systems
 * Supports both standalone and EHR-launched applications
 */
export class SMARTFHIRService {
  private readonly defaultScopes = config.smart.scopes;
  private readonly stateStore = new Map<string, any>(); // In production, use Redis
  private readonly authCodeStore = new Map<string, any>(); // In production, use Redis

  // ===============================
  // SMART AUTHORIZATION FLOW
  // ===============================

  /**
   * Initiate SMART authorization flow
   */
  async initiateAuthorization(
    clientId: string,
    redirectUri: string,
    scope: string[] = this.defaultScopes,
    state?: string,
    aud?: string,
    launch?: string
  ): Promise<{ authorizationUrl: string; state: string }> {
    try {
      const authState = state || this.generateSecureState();
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      // Store state and code verifier for later verification
      this.stateStore.set(authState, {
        clientId,
        redirectUri,
        scope,
        codeVerifier,
        aud,
        launch,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
      });

      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope.join(' '),
        state: authState,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      if (aud) {
        authParams.append('aud', aud);
      }

      if (launch) {
        authParams.append('launch', launch);
      }

      const authorizationUrl = `${config.smart.authorizationUrl}?${authParams.toString()}`;

      logger.security('SMART authorization initiated', {
        clientId,
        scope: scope.join(' '),
        state: authState,
        aud,
        launch: !!launch,
      });

      return { authorizationUrl, state: authState };
    } catch (error) {
      logger.error('Failed to initiate SMART authorization:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    state: string,
    clientId?: string
  ): Promise<SMARTTokenResponse> {
    try {
      // Verify state and retrieve stored data
      const storedData = this.stateStore.get(state);
      if (!storedData) {
        throw new Error('Invalid or expired state parameter');
      }

      if (Date.now() > storedData.expiresAt) {
        this.stateStore.delete(state);
        throw new Error('Authorization state has expired');
      }

      // Use stored client ID if not provided
      const effectiveClientId = clientId || storedData.clientId;

      const tokenParams = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: storedData.redirectUri,
        client_id: effectiveClientId,
        code_verifier: storedData.codeVerifier,
      };

      const response = await axios.post(
        config.smart.tokenUrl,
        new URLSearchParams(tokenParams).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 30000,
        }
      );

      const tokenResponse: SMARTTokenResponse = response.data;

      // Store authorization code mapping for potential refresh
      if (tokenResponse.refresh_token) {
        this.authCodeStore.set(tokenResponse.access_token, {
          refreshToken: tokenResponse.refresh_token,
          clientId: effectiveClientId,
          scope: tokenResponse.scope,
          patient: tokenResponse.patient,
          encounter: tokenResponse.encounter,
          fhirUser: tokenResponse.fhirUser,
          timestamp: Date.now(),
        });
      }

      // Clean up state store
      this.stateStore.delete(state);

      logger.security('SMART token exchange completed', {
        clientId: effectiveClientId,
        scope: tokenResponse.scope,
        patient: tokenResponse.patient,
        encounter: tokenResponse.encounter,
        fhirUser: tokenResponse.fhirUser,
        hasRefreshToken: !!tokenResponse.refresh_token,
      });

      return tokenResponse;
    } catch (error) {
      logger.error('Failed to exchange code for token:', error);
      if (axios.isAxiosError(error)) {
        logger.error('Token exchange error details:', {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, clientId: string): Promise<SMARTTokenResponse> {
    try {
      const tokenParams = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      };

      const response = await axios.post(
        config.smart.tokenUrl,
        new URLSearchParams(tokenParams).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 30000,
        }
      );

      const tokenResponse: SMARTTokenResponse = response.data;

      logger.security('SMART token refreshed', {
        clientId,
        scope: tokenResponse.scope,
      });

      return tokenResponse;
    } catch (error) {
      logger.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Introspect access token
   */
  async introspectToken(accessToken: string): Promise<any> {
    try {
      const response = await axios.post(
        config.smart.introspectionUrl,
        new URLSearchParams({ token: accessToken }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );

      const introspectionResult = response.data;

      logger.security('Token introspection completed', {
        active: introspectionResult.active,
        scope: introspectionResult.scope,
        client_id: introspectionResult.client_id,
      });

      return introspectionResult;
    } catch (error) {
      logger.error('Failed to introspect token:', error);
      throw error;
    }
  }

  // ===============================
  // EHR INTEGRATION
  // ===============================

  /**
   * Get SMART configuration from EHR
   */
  async getSMARTConfiguration(fhirBaseUrl: string): Promise<any> {
    try {
      const configUrl = `${fhirBaseUrl.replace(/\/$/, '')}/.well-known/smart_configuration`;
      
      const response = await axios.get(configUrl, {
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      const smartConfig = response.data;

      logger.integration('SMART configuration retrieved', {
        fhirBaseUrl,
        authorizationEndpoint: smartConfig.authorization_endpoint,
        tokenEndpoint: smartConfig.token_endpoint,
        capabilities: smartConfig.capabilities,
      });

      return smartConfig;
    } catch (error) {
      logger.error('Failed to get SMART configuration:', error);
      throw error;
    }
  }

  /**
   * Launch standalone app
   */
  async launchStandaloneApp(
    fhirBaseUrl: string,
    clientId: string,
    redirectUri: string,
    scope: string[] = this.defaultScopes
  ): Promise<{ authorizationUrl: string; state: string }> {
    try {
      // Get SMART configuration
      const smartConfig = await this.getSMARTConfiguration(fhirBaseUrl);

      const authState = this.generateSecureState();
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      // Store launch context
      this.stateStore.set(authState, {
        clientId,
        redirectUri,
        scope,
        codeVerifier,
        fhirBaseUrl,
        authorizationEndpoint: smartConfig.authorization_endpoint,
        tokenEndpoint: smartConfig.token_endpoint,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000),
      });

      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope.join(' '),
        state: authState,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        aud: fhirBaseUrl,
      });

      const authorizationUrl = `${smartConfig.authorization_endpoint}?${authParams.toString()}`;

      logger.integration('Standalone app launch initiated', {
        fhirBaseUrl,
        clientId,
        scope: scope.join(' '),
        state: authState,
      });

      return { authorizationUrl, state: authState };
    } catch (error) {
      logger.error('Failed to launch standalone app:', error);
      throw error;
    }
  }

  /**
   * Handle EHR launch
   */
  async handleEHRLaunch(
    iss: string,
    launch: string,
    clientId: string,
    redirectUri: string,
    scope: string[] = this.defaultScopes
  ): Promise<{ authorizationUrl: string; state: string }> {
    try {
      // Get SMART configuration from the issuer
      const smartConfig = await this.getSMARTConfiguration(iss);

      const authState = this.generateSecureState();
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      // Store EHR launch context
      this.stateStore.set(authState, {
        clientId,
        redirectUri,
        scope,
        codeVerifier,
        iss,
        launch,
        authorizationEndpoint: smartConfig.authorization_endpoint,
        tokenEndpoint: smartConfig.token_endpoint,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000),
      });

      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope.join(' '),
        state: authState,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        aud: iss,
        launch,
      });

      const authorizationUrl = `${smartConfig.authorization_endpoint}?${authParams.toString()}`;

      logger.integration('EHR launch handled', {
        iss,
        launch,
        clientId,
        scope: scope.join(' '),
        state: authState,
      });

      return { authorizationUrl, state: authState };
    } catch (error) {
      logger.error('Failed to handle EHR launch:', error);
      throw error;
    }
  }

  // ===============================
  // EPIC INTEGRATION
  // ===============================

  /**
   * Authenticate with Epic using JWT
   */
  async authenticateWithEpic(privateKeyPath: string): Promise<string> {
    try {
      const fs = await import('fs/promises');
      const privateKey = await fs.readFile(privateKeyPath, 'utf8');

      const jwtPayload = {
        iss: config.ehr.epic.clientId,
        sub: config.ehr.epic.clientId,
        aud: config.ehr.epic.fhirBaseUrl.replace(/\/fhir.*$/, '/oauth2/token'),
        jti: crypto.randomUUID(),
        exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes
      };

      const signedJWT = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS384' });

      const tokenParams = {
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: signedJWT,
      };

      const response = await axios.post(
        config.ehr.epic.fhirBaseUrl.replace(/\/fhir.*$/, '/oauth2/token'),
        new URLSearchParams(tokenParams).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 30000,
        }
      );

      const accessToken = response.data.access_token;

      logger.integration('Epic authentication successful', {
        clientId: config.ehr.epic.clientId,
      });

      return accessToken;
    } catch (error) {
      logger.error('Failed to authenticate with Epic:', error);
      throw error;
    }
  }

  // ===============================
  // CERNER INTEGRATION
  // ===============================

  /**
   * Authenticate with Cerner
   */
  async authenticateWithCerner(): Promise<string> {
    try {
      const tokenParams = {
        grant_type: 'client_credentials',
        client_id: config.ehr.cerner.clientId,
        client_secret: config.ehr.cerner.clientSecret,
        scope: 'system/Patient.read system/Observation.read',
      };

      const response = await axios.post(
        config.ehr.cerner.fhirBaseUrl.replace(/\/r4.*$/, '/tenants/oauth/token'),
        new URLSearchParams(tokenParams).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 30000,
        }
      );

      const accessToken = response.data.access_token;

      logger.integration('Cerner authentication successful', {
        clientId: config.ehr.cerner.clientId,
      });

      return accessToken;
    } catch (error) {
      logger.error('Failed to authenticate with Cerner:', error);
      throw error;
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Generate secure state parameter
   */
  private generateSecureState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(43).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  /**
   * Validate JWT token (for SMART apps)
   */
  validateJWT(token: string, publicKey?: string): any {
    try {
      const decoded = jwt.verify(token, publicKey || config.jwt.secret);
      
      logger.security('JWT validation successful', {
        sub: (decoded as any).sub,
        iss: (decoded as any).iss,
        aud: (decoded as any).aud,
      });

      return decoded;
    } catch (error) {
      logger.error('JWT validation failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired state and auth code entries
   */
  cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean up state store
    for (const [key, value] of this.stateStore.entries()) {
      if (value.expiresAt && now > value.expiresAt) {
        this.stateStore.delete(key);
      }
    }

    // Clean up auth code store (older than 1 hour)
    for (const [key, value] of this.authCodeStore.entries()) {
      if (now - value.timestamp > 3600000) {
        this.authCodeStore.delete(key);
      }
    }

    logger.debug('Expired SMART entries cleaned up');
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      const details = {
        stateStoreSize: this.stateStore.size,
        authCodeStoreSize: this.authCodeStore.size,
        config: {
          authorizationUrl: config.smart.authorizationUrl,
          tokenUrl: config.smart.tokenUrl,
          introspectionUrl: config.smart.introspectionUrl,
        },
      };

      return { status: 'UP', details };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { error: getErrorMessage(error) },
      };
    }
  }
}

// Export singleton instance
export const smartFHIRService = new SMARTFHIRService();

// Schedule cleanup of expired entries every 5 minutes (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    smartFHIRService.cleanupExpiredEntries();
  }, 5 * 60 * 1000);
}