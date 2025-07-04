/**
 * OmniCare EMR - Single Sign-On Integration Architecture
 * HIPAA-Compliant SSO Implementation with SAML 2.0 and OAuth 2.0/OIDC Support
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import passport from 'passport';
import { Strategy as JwtStrategy } from 'passport-jwt';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Strategy as SAMLStrategy, Profile as SAMLProfile } from 'passport-saml';

import { JWTAuthService } from '@/auth/jwt.service';
import { AuditService } from '@/services/audit.service';
import { SessionManager } from '@/services/session.service';
import { User, UserRole } from '@/types/auth.types';
import { getErrorMessage } from '@/utils/error.utils';

export interface SSOProvider {
  id: string;
  name: string;
  type: 'SAML' | 'OIDC' | 'OAuth2';
  enabled: boolean;
  config: SSOProviderConfig;
  metadata?: Record<string, unknown>;
}

export interface SSOProviderConfig {
  // SAML Configuration
  entryPoint?: string;
  issuer?: string;
  cert?: string;
  privateCert?: string;
  callbackUrl?: string;
  
  // OIDC Configuration
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
  scope?: string[];
  
  // OAuth2 Configuration
  authorizationURL?: string;
  tokenURL?: string;
  userProfileURL?: string;
  
  // Common Configuration
  attributeMapping?: AttributeMapping;
  autoProvision?: boolean;
  defaultRole?: UserRole;
  trustedDomains?: string[];
}

export interface AttributeMapping {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  department?: string;
  licenseNumber?: string;
  npiNumber?: string;
}

export interface SSOUser {
  providerId: string;
  providerUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  department?: string;
  licenseNumber?: string;
  npiNumber?: string;
  attributes?: Record<string, unknown>;
}

export class SSOIntegrationService extends EventEmitter {
  private jwtService: JWTAuthService;
  private auditService: AuditService;
  private sessionManager: SessionManager;
  private providers: Map<string, SSOProvider> = new Map();
  private userMappings: Map<string, string> = new Map(); // SSO user ID -> internal user ID

  constructor(
    jwtService: JWTAuthService,
    auditService: AuditService,
    sessionManager: SessionManager
  ) {
    super();
    this.jwtService = jwtService;
    this.auditService = auditService;
    this.sessionManager = sessionManager;
    
    this.initializeDefaultProviders();
    this.configurePassportStrategies();
  }

  /**
   * Configure Passport.js strategies for SSO providers
   */
  private configurePassportStrategies(): void {
    // SAML Strategy for healthcare identity providers
    // Only configure SAML if properly configured
    if (process.env.SAML_ENTRY_POINT && process.env.SAML_CERT) {
      passport.use('saml', new SAMLStrategy({
        entryPoint: process.env.SAML_ENTRY_POINT,
        issuer: process.env.SAML_ISSUER || 'omnicare-emr',
        cert: process.env.SAML_CERT,
        callbackUrl: process.env.SAML_CALLBACK_URL || '/auth/saml/callback',
        disableRequestedAuthnContext: true,
        identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress'
      }, (profile: any, done: (error: any, user?: any) => void) => {
        if (!profile) {
          done(new Error('No profile received from SAML provider'), false);
          return;
        }
        void this.handleSAMLCallback(profile as Record<string, unknown>, done);
      }));
    } else {
      console.warn('SAML configuration incomplete - SAML SSO disabled');
    }

    // OIDC Strategy for modern providers
    // Only configure OIDC if properly configured
    if (process.env.OIDC_AUTH_URL && process.env.OIDC_TOKEN_URL && 
        process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
      passport.use('oidc', new OAuth2Strategy({
        authorizationURL: process.env.OIDC_AUTH_URL,
        tokenURL: process.env.OIDC_TOKEN_URL,
        clientID: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        callbackURL: process.env.OIDC_CALLBACK_URL || '/auth/oidc/callback'
      }, (accessToken: string, refreshToken: string, profile: any, done: (error: unknown, user?: User | false) => void) => {
        if (!profile) {
          done(new Error('No profile received from OIDC provider'), false);
          return;
        }
        void this.handleOIDCCallback(accessToken, refreshToken, profile as Record<string, unknown>, done);
      }));
    } else {
      console.warn('OIDC configuration incomplete - OIDC SSO disabled');
    }

    // JWT Strategy for token validation
    passport.use('jwt', new JwtStrategy({
      jwtFromRequest: (req) => {
        return this.jwtService.extractTokenFromHeader(req.get('Authorization'));
      },
      secretOrKey: process.env.JWT_ACCESS_SECRET || '',
      issuer: 'OmniCare-EMR',
      audience: 'omnicare-users'
    }, (payload: any, done: (error: unknown, user?: User | false) => void) => {
      void this.handleJWTCallback(payload as Record<string, unknown>, done);
    }));
  }

  /**
   * Handle SAML authentication callback
   */
  private async handleSAMLCallback(profile: Record<string, unknown>, done: (error: unknown, user?: User | false) => void): Promise<void> {
    try {
      const ssoUser = this.mapSAMLProfileToUser(profile);
      const user = await this.processSSOLogin(ssoUser, 'saml');
      
      await this.auditService.logSecurityEvent({
        type: 'LOGIN_SUCCESS',
        userId: user.id,
        severity: 'LOW',
        description: 'SAML SSO login successful',
        metadata: {
          provider: 'saml',
          ssoUserId: ssoUser.providerUserId,
          email: ssoUser.email
        }
      });

      done(null, user);
    } catch (error) {
      await this.auditService.logSecurityEvent({
        type: 'LOGIN_FAILURE',
        severity: 'HIGH',
        description: 'SAML SSO login failed',
        metadata: {
          provider: 'saml',
          error: getErrorMessage(error),
          profile: profile
        }
      });

      done(error, false);
    }
  }

  /**
   * Handle OIDC authentication callback
   */
  private async handleOIDCCallback(accessToken: string, refreshToken: string, profile: Record<string, unknown>, done: (error: unknown, user?: User | false) => void): Promise<void> {
    try {
      const ssoUser = this.mapOIDCProfileToUser(profile);
      const user = await this.processSSOLogin(ssoUser, 'oidc');
      
      await this.auditService.logSecurityEvent({
        type: 'LOGIN_SUCCESS',
        userId: user.id,
        severity: 'LOW',
        description: 'OIDC SSO login successful',
        metadata: {
          provider: 'oidc',
          ssoUserId: ssoUser.providerUserId,
          email: ssoUser.email
        }
      });

      done(null, user);
    } catch (error) {
      await this.auditService.logSecurityEvent({
        type: 'LOGIN_FAILURE',
        severity: 'HIGH',
        description: 'OIDC SSO login failed',
        metadata: {
          provider: 'oidc',
          error: getErrorMessage(error),
          profile: profile
        }
      });

      done(error, false);
    }
  }

  /**
   * Handle JWT token validation
   */
  private async handleJWTCallback(payload: Record<string, unknown>, done: (error: unknown, user?: User | false) => void): Promise<void> {
    try {
      const userId = payload.userId;
      if (typeof userId !== 'string') {
        return done(new Error('Invalid token payload: missing userId'), false);
      }
      
      const user = await this.getUserById(userId);
      
      if (!user || !user.isActive) {
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }

  /**
   * Process SSO login and handle user provisioning
   */
  private async processSSOLogin(ssoUser: SSOUser, providerId: string): Promise<User> {
    // Check if user is already mapped
    const existingUserId = this.userMappings.get(`${providerId}:${ssoUser.providerUserId}`);
    
    if (existingUserId) {
      const user = await this.getUserById(existingUserId);
      if (user && user.isActive) {
        // Update user information from SSO
        await this.updateUserFromSSO(user, ssoUser);
        return user;
      }
    }

    // Check if user exists by email
    const userByEmail = await this.getUserByEmail(ssoUser.email);
    
    if (userByEmail) {
      // Link existing user to SSO provider
      this.userMappings.set(`${providerId}:${ssoUser.providerUserId}`, userByEmail.id);
      await this.updateUserFromSSO(userByEmail, ssoUser);
      return userByEmail;
    }

    // Auto-provision new user if enabled
    const provider = this.providers.get(providerId);
    if (provider?.config.autoProvision) {
      return await this.provisionUser(ssoUser, providerId);
    }

    throw new Error('User not found and auto-provisioning is disabled');
  }

  /**
   * Provision new user from SSO
   */
  private async provisionUser(ssoUser: SSOUser, providerId: string): Promise<User> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`SSO provider not found: ${providerId}`);
    }

    // Validate domain if specified
    if (provider.config.trustedDomains && provider.config.trustedDomains.length > 0) {
      const emailDomain = ssoUser.email.split('@')[1].toLowerCase();
      // Secure domain validation to prevent bypass attempts
      const isValidDomain = provider.config.trustedDomains.some(domain => {
        const normalizedDomain = domain.toLowerCase().trim();
        const normalizedEmailDomain = emailDomain.toLowerCase().trim();
        return normalizedEmailDomain === normalizedDomain || 
               normalizedEmailDomain.endsWith(`.${normalizedDomain}`);
      });
      
      if (!isValidDomain) {
        throw new Error(`Email domain not in trusted domains: ${emailDomain}`);
      }
    }

    // Generate cryptographically secure user ID
    const userIdBuffer = crypto.randomBytes(16);
    const timestamp = Date.now().toString(36);
    const newUser: User = {
      id: `usr_${timestamp}_${userIdBuffer.toString('hex')}`,
      username: ssoUser.email,
      email: ssoUser.email,
      firstName: ssoUser.firstName,
      lastName: ssoUser.lastName,
      role: ssoUser.role || provider.config.defaultRole || UserRole.PATIENT,
      department: ssoUser.department || '',
      licenseNumber: ssoUser.licenseNumber || '',
      npiNumber: ssoUser.npiNumber || '',
      isActive: true,
      isMfaEnabled: false,
      lastLogin: new Date(),
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save user mapping
    this.userMappings.set(`${providerId}:${ssoUser.providerUserId}`, newUser.id);

    // Log user provisioning
    await this.auditService.logSecurityEvent({
      type: 'SYSTEM_CONFIGURATION_CHANGE',
      userId: newUser.id,
      severity: 'MEDIUM',
      description: 'User auto-provisioned via SSO',
      metadata: {
        provider: providerId,
        ssoUserId: ssoUser.providerUserId,
        email: ssoUser.email,
        role: newUser.role
      }
    });

    this.emit('userProvisioned', { user: newUser, ssoUser, providerId });
    
    return newUser;
  }

  /**
   * Update user information from SSO
   */
  private async updateUserFromSSO(user: User, ssoUser: SSOUser): Promise<void> {
    let updated = false;

    if (user.firstName !== ssoUser.firstName) {
      user.firstName = ssoUser.firstName;
      updated = true;
    }

    if (user.lastName !== ssoUser.lastName) {
      user.lastName = ssoUser.lastName;
      updated = true;
    }

    if (ssoUser.department && user.department !== ssoUser.department) {
      user.department = ssoUser.department;
      updated = true;
    }

    if (ssoUser.licenseNumber && user.licenseNumber !== ssoUser.licenseNumber) {
      user.licenseNumber = ssoUser.licenseNumber;
      updated = true;
    }

    if (ssoUser.npiNumber && user.npiNumber !== ssoUser.npiNumber) {
      user.npiNumber = ssoUser.npiNumber;
      updated = true;
    }

    if (updated) {
      user.updatedAt = new Date();
      
      await this.auditService.logSecurityEvent({
        type: 'SYSTEM_CONFIGURATION_CHANGE',
        userId: user.id,
        severity: 'LOW',
        description: 'User information updated from SSO',
        metadata: { updatedFields: Object.keys(ssoUser) }
      });
    }
  }

  /**
   * Safely extract string value from profile
   */
  private safeGetString(profile: Record<string, unknown>, key: string): string {
    const value = profile[key];
    return typeof value === 'string' ? value : '';
  }

  /**
   * Map SAML profile to SSO user
   */
  private mapSAMLProfileToUser(profile: Record<string, unknown>): SSOUser {
    const provider = this.providers.get('saml');
    const mapping = provider?.config.attributeMapping;

    return {
      providerId: 'saml',
      providerUserId: this.safeGetString(profile, 'nameID') || this.safeGetString(profile, mapping?.userId || 'nameID'),
      email: this.safeGetString(profile, mapping?.email || 'email') || this.safeGetString(profile, 'nameID'),
      firstName: this.safeGetString(profile, mapping?.firstName || 'firstName') || this.safeGetString(profile, 'givenName'),
      lastName: this.safeGetString(profile, mapping?.lastName || 'lastName') || this.safeGetString(profile, 'surname'),
      role: this.mapSSORole(this.safeGetString(profile, mapping?.role || 'role')) || UserRole.PATIENT,
      department: this.safeGetString(profile, mapping?.department || 'department'),
      licenseNumber: this.safeGetString(profile, mapping?.licenseNumber || 'licenseNumber'),
      npiNumber: this.safeGetString(profile, mapping?.npiNumber || 'npiNumber'),
      attributes: profile
    };
  }

  /**
   * Map OIDC profile to SSO user
   */
  private mapOIDCProfileToUser(profile: Record<string, unknown>): SSOUser {
    const provider = this.providers.get('oidc');
    const mapping = provider?.config.attributeMapping;

    return {
      providerId: 'oidc',
      providerUserId: this.safeGetString(profile, 'sub') || this.safeGetString(profile, mapping?.userId || 'sub'),
      email: this.safeGetString(profile, 'email') || this.safeGetString(profile, mapping?.email || 'email'),
      firstName: this.safeGetString(profile, 'given_name') || this.safeGetString(profile, mapping?.firstName || 'given_name'),
      lastName: this.safeGetString(profile, 'family_name') || this.safeGetString(profile, mapping?.lastName || 'family_name'),
      role: this.mapSSORole(this.safeGetString(profile, mapping?.role || 'role')) || UserRole.PATIENT,
      department: this.safeGetString(profile, mapping?.department || 'department'),
      licenseNumber: this.safeGetString(profile, mapping?.licenseNumber || 'licenseNumber'),
      npiNumber: this.safeGetString(profile, mapping?.npiNumber || 'npiNumber'),
      attributes: profile
    };
  }

  /**
   * Map SSO role to internal UserRole
   */
  private mapSSORole(ssoRole: string): UserRole | undefined {
    if (!ssoRole) return undefined;

    const roleMapping: Record<string, UserRole> = {
      'physician': UserRole.PHYSICIAN,
      'doctor': UserRole.PHYSICIAN,
      'nurse': UserRole.NURSING_STAFF,
      'nursing': UserRole.NURSING_STAFF,
      'admin': UserRole.ADMINISTRATIVE_STAFF,
      'administrator': UserRole.ADMINISTRATIVE_STAFF,
      'sysadmin': UserRole.SYSTEM_ADMINISTRATOR,
      'pharmacist': UserRole.PHARMACIST,
      'lab': UserRole.LABORATORY_TECHNICIAN,
      'laboratory': UserRole.LABORATORY_TECHNICIAN,
      'radiology': UserRole.RADIOLOGY_TECHNICIAN,
      'patient': UserRole.PATIENT
    };

    return roleMapping[ssoRole.toLowerCase()];
  }

  /**
   * Add SSO provider configuration
   */
  addProvider(provider: SSOProvider): void {
    this.providers.set(provider.id, provider);
    this.emit('providerAdded', provider);
  }

  /**
   * Remove SSO provider
   */
  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.emit('providerRemoved', providerId);
  }

  /**
   * Get all configured SSO providers
   */
  getProviders(): SSOProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get SSO provider by ID
   */
  getProvider(providerId: string): SSOProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Initialize default SSO providers
   */
  private initializeDefaultProviders(): void {
    // SAML Provider for healthcare organizations
    if (process.env.SAML_ENABLED === 'true') {
      this.addProvider({
        id: 'saml',
        name: 'Healthcare SAML Provider',
        type: 'SAML',
        enabled: true,
        config: {
          entryPoint: process.env.SAML_ENTRY_POINT || '',
          issuer: process.env.SAML_ISSUER || '',
          cert: process.env.SAML_CERT || '',
          callbackUrl: process.env.SAML_CALLBACK_URL || '',
          attributeMapping: {
            userId: 'nameID',
            email: 'email',
            firstName: 'firstName',
            lastName: 'lastName',
            role: 'role',
            department: 'department',
            licenseNumber: 'licenseNumber',
            npiNumber: 'npiNumber'
          },
          autoProvision: process.env.SAML_AUTO_PROVISION === 'true',
          defaultRole: UserRole.PATIENT,
          trustedDomains: process.env.SAML_TRUSTED_DOMAINS?.split(',') || []
        }
      });
    }

    // OIDC Provider for modern authentication
    if (process.env.OIDC_ENABLED === 'true') {
      this.addProvider({
        id: 'oidc',
        name: 'OpenID Connect Provider',
        type: 'OIDC',
        enabled: true,
        config: {
          clientId: process.env.OIDC_CLIENT_ID || '',
          clientSecret: process.env.OIDC_CLIENT_SECRET || '',
          discoveryUrl: process.env.OIDC_DISCOVERY_URL || '',
          scope: ['openid', 'profile', 'email'],
          attributeMapping: {
            userId: 'sub',
            email: 'email',
            firstName: 'given_name',
            lastName: 'family_name',
            role: 'role',
            department: 'department'
          },
          autoProvision: process.env.OIDC_AUTO_PROVISION === 'true',
          defaultRole: UserRole.PATIENT,
          trustedDomains: process.env.OIDC_TRUSTED_DOMAINS?.split(',') || []
        }
      });
    }
  }

  /**
   * Mock user lookup functions (replace with actual database queries)
   */
  private getUserById(_id: string): Promise<User | null> {
    // Mock implementation - replace with actual database query
    return Promise.resolve(null);
  }

  private getUserByEmail(_email: string): Promise<User | null> {
    // Mock implementation - replace with actual database query
    return Promise.resolve(null);
  }
}