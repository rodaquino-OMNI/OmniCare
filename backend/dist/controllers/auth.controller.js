"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const smart_fhir_service_1 = require("@/services/smart-fhir.service");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
const jwt_service_1 = require("@/auth/jwt.service");
const session_service_1 = require("@/services/session.service");
const audit_service_1 = require("@/services/audit.service");
const auth_types_1 = require("@/types/auth.types");
class AuthController {
    jwtService;
    sessionManager;
    auditService;
    constructor() {
        this.jwtService = new jwt_service_1.JWTAuthService();
        this.sessionManager = new session_service_1.SessionManager();
        this.auditService = new audit_service_1.AuditService();
    }
    async authorize(req, res) {
        try {
            const { response_type, client_id, redirect_uri, scope, state, aud, launch, } = req.query;
            logger_1.default.security('SMART authorization request', {
                client_id,
                response_type,
                scope,
                aud,
                launch: !!launch,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });
            if (!response_type || response_type !== 'code') {
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
            const scopes = scope ? scope.split(' ') : config_1.default.smart.scopes;
            let authResult;
            if (launch) {
                if (!aud) {
                    res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'aud parameter required for EHR launch',
                    });
                    return;
                }
                authResult = await smart_fhir_service_1.smartFHIRService.handleEHRLaunch(aud, launch, client_id, redirect_uri, scopes);
            }
            else {
                authResult = await smart_fhir_service_1.smartFHIRService.initiateAuthorization(client_id, redirect_uri, scopes, state, aud);
            }
            const authCode = this.generateAuthorizationCode();
            const finalState = state || authResult.state;
            this.storeAuthorizationCode(authCode, {
                client_id,
                redirect_uri,
                scope: scopes.join(' '),
                state: finalState,
                aud,
                launch,
                expiresAt: Date.now() + (10 * 60 * 1000),
            });
            const redirectUrl = new URL(redirect_uri);
            redirectUrl.searchParams.append('code', authCode);
            redirectUrl.searchParams.append('state', finalState);
            logger_1.default.security('SMART authorization code generated', {
                client_id,
                state: finalState,
                hasLaunch: !!launch,
            });
            res.redirect(redirectUrl.toString());
        }
        catch (error) {
            logger_1.default.error('SMART authorization failed:', error);
            res.status(500).json({
                error: 'server_error',
                error_description: 'Authorization server error',
            });
        }
    }
    async token(req, res) {
        try {
            const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token, } = req.body;
            logger_1.default.security('SMART token request', {
                grant_type,
                client_id,
                hasCode: !!code,
                hasRefreshToken: !!refresh_token,
                ip: req.ip,
            });
            if (grant_type === 'authorization_code') {
                await this.handleAuthorizationCodeGrant(req, res);
            }
            else if (grant_type === 'refresh_token') {
                await this.handleRefreshTokenGrant(req, res);
            }
            else if (grant_type === 'client_credentials') {
                await this.handleClientCredentialsGrant(req, res);
            }
            else {
                res.status(400).json({
                    error: 'unsupported_grant_type',
                    error_description: 'Supported grant types: authorization_code, refresh_token, client_credentials',
                });
            }
        }
        catch (error) {
            logger_1.default.error('SMART token request failed:', error);
            res.status(500).json({
                error: 'server_error',
                error_description: 'Token server error',
            });
        }
    }
    async handleAuthorizationCodeGrant(req, res) {
        const { code, redirect_uri, client_id, code_verifier } = req.body;
        if (!code || !redirect_uri || !client_id) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'code, redirect_uri, and client_id are required',
            });
            return;
        }
        const authData = this.getAuthorizationCode(code);
        if (!authData) {
            res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid or expired authorization code',
            });
            return;
        }
        if (authData.client_id !== client_id || authData.redirect_uri !== redirect_uri) {
            res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid client_id or redirect_uri',
            });
            return;
        }
        if (Date.now() > authData.expiresAt) {
            this.removeAuthorizationCode(code);
            res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Authorization code expired',
            });
            return;
        }
        const accessToken = this.generateAccessToken({
            client_id,
            scope: authData.scope,
            aud: authData.aud,
            launch: authData.launch,
        });
        const refreshToken = this.generateRefreshToken({
            client_id,
            scope: authData.scope,
        });
        this.removeAuthorizationCode(code);
        const tokenResponse = {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: 3600,
            scope: authData.scope,
            refresh_token: refreshToken,
        };
        if (authData.launch) {
            tokenResponse.patient = 'example-patient-id';
            tokenResponse.encounter = 'example-encounter-id';
            tokenResponse.need_patient_banner = true;
            tokenResponse.smart_style_url = `${config_1.default.fhir.baseUrl}/smart-style.json`;
        }
        logger_1.default.security('SMART access token issued', {
            client_id,
            scope: authData.scope,
            hasLaunch: !!authData.launch,
        });
        res.json(tokenResponse);
    }
    async handleRefreshTokenGrant(req, res) {
        const { refresh_token, client_id } = req.body;
        if (!refresh_token || !client_id) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'refresh_token and client_id are required',
            });
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(refresh_token, config_1.default.jwt.secret);
            if (decoded.client_id !== client_id || decoded.type !== 'refresh') {
                res.status(400).json({
                    error: 'invalid_grant',
                    error_description: 'Invalid refresh token',
                });
                return;
            }
            const accessToken = this.generateAccessToken({
                client_id,
                scope: decoded.scope,
                aud: decoded.aud,
            });
            const tokenResponse = {
                access_token: accessToken,
                token_type: 'bearer',
                expires_in: 3600,
                scope: decoded.scope,
            };
            logger_1.default.security('SMART token refreshed', {
                client_id,
                scope: decoded.scope,
            });
            res.json(tokenResponse);
        }
        catch (error) {
            res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid refresh token',
            });
        }
    }
    async handleClientCredentialsGrant(req, res) {
        const { client_id, client_secret, scope } = req.body;
        if (!client_id || !client_secret) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'client_id and client_secret are required',
            });
            return;
        }
        const isValidClient = await this.validateClientCredentials(client_id, client_secret);
        if (!isValidClient) {
            res.status(401).json({
                error: 'invalid_client',
                error_description: 'Invalid client credentials',
            });
            return;
        }
        const requestedScope = scope || 'system/*.read';
        const accessToken = this.generateAccessToken({
            client_id,
            scope: requestedScope,
            type: 'system',
        });
        const tokenResponse = {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: 3600,
            scope: requestedScope,
        };
        logger_1.default.security('System access token issued', {
            client_id,
            scope: requestedScope,
        });
        res.json(tokenResponse);
    }
    async introspect(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                res.status(400).json({
                    error: 'invalid_request',
                    error_description: 'token parameter is required',
                });
                return;
            }
            logger_1.default.security('Token introspection request', {
                ip: req.ip,
            });
            try {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
                const introspectionResponse = {
                    active: true,
                    scope: decoded.scope,
                    client_id: decoded.client_id,
                    sub: decoded.sub,
                    exp: decoded.exp,
                    iat: decoded.iat,
                    aud: decoded.aud,
                    iss: decoded.iss,
                    patient: decoded.patient,
                    encounter: decoded.encounter,
                    fhirUser: decoded.fhirUser,
                };
                res.json(introspectionResponse);
            }
            catch (jwtError) {
                res.json({ active: false });
            }
        }
        catch (error) {
            logger_1.default.error('Token introspection failed:', error);
            res.status(500).json({
                error: 'server_error',
                error_description: 'Introspection server error',
            });
        }
    }
    async login(req, res) {
        try {
            const { username, password, mfaToken } = req.body;
            const ipAddress = req.ip || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            await this.auditService.logSecurityEvent({
                type: 'LOGIN_FAILURE',
                severity: 'LOW',
                description: `Login attempt for username: ${username}`,
                metadata: { username, ipAddress, userAgent }
            });
            const user = await this.validateUserCredentials(username, password);
            if (!user) {
                await this.auditService.logSecurityEvent({
                    type: 'LOGIN_FAILURE',
                    severity: 'MEDIUM',
                    description: `Failed login attempt - invalid credentials`,
                    metadata: { username, ipAddress, userAgent }
                });
                res.status(401).json({
                    success: false,
                    error: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                });
                return;
            }
            if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
                await this.auditService.logSecurityEvent({
                    type: 'LOGIN_FAILURE',
                    userId: user.id,
                    severity: 'MEDIUM',
                    description: 'Login attempt on locked account',
                    metadata: { username, ipAddress, userAgent, lockedUntil: user.accountLockedUntil }
                });
                res.status(423).json({
                    success: false,
                    error: 'ACCOUNT_LOCKED',
                    message: 'Account is temporarily locked due to multiple failed login attempts'
                });
                return;
            }
            if (!user.isActive) {
                await this.auditService.logSecurityEvent({
                    type: 'LOGIN_FAILURE',
                    userId: user.id,
                    severity: 'MEDIUM',
                    description: 'Login attempt on inactive account',
                    metadata: { username, ipAddress, userAgent }
                });
                res.status(403).json({
                    success: false,
                    error: 'ACCOUNT_INACTIVE',
                    message: 'Account is not active'
                });
                return;
            }
            if (this.jwtService.isMfaRequired(user.role) && user.isMfaEnabled) {
                if (!mfaToken) {
                    res.status(200).json({
                        success: false,
                        requiresMfa: true,
                        message: 'Multi-factor authentication required'
                    });
                    return;
                }
                if (!this.jwtService.verifyMfaToken(mfaToken, user.mfaSecret)) {
                    await this.auditService.logSecurityEvent({
                        type: 'LOGIN_FAILURE',
                        userId: user.id,
                        severity: 'HIGH',
                        description: 'Invalid MFA token provided',
                        metadata: { username, ipAddress, userAgent }
                    });
                    res.status(401).json({
                        success: false,
                        error: 'INVALID_MFA_TOKEN',
                        message: 'Invalid multi-factor authentication token'
                    });
                    return;
                }
            }
            const tokens = await this.jwtService.generateTokens(user);
            const session = await this.sessionManager.createSession(user, ipAddress, userAgent);
            await this.updateUserLoginInfo(user.id, ipAddress);
            await this.auditService.logSecurityEvent({
                type: 'LOGIN_SUCCESS',
                userId: user.id,
                severity: 'LOW',
                description: `Successful login for ${user.username}`,
                metadata: {
                    username: user.username,
                    role: user.role,
                    sessionId: session.sessionId,
                    ipAddress,
                    userAgent
                }
            });
            res.json({
                success: true,
                tokens,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    department: user.department,
                    isActive: user.isActive,
                    isMfaEnabled: user.isMfaEnabled,
                    lastLogin: user.lastLogin
                },
                session: {
                    sessionId: session.sessionId,
                    expiresAt: session.expiresAt
                }
            });
        }
        catch (error) {
            logger_1.default.error('Login failed:', error);
            await this.auditService.logSecurityEvent({
                type: 'LOGIN_FAILURE',
                severity: 'HIGH',
                description: 'Login system error',
                metadata: { error: error.message, ipAddress: req.ip }
            });
            res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'An internal error occurred during login'
            });
        }
    }
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            const ipAddress = req.ip || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    error: 'MISSING_REFRESH_TOKEN',
                    message: 'Refresh token is required'
                });
                return;
            }
            const decoded = await this.jwtService.verifyRefreshToken(refreshToken);
            const user = await this.getUserById(decoded.userId);
            if (!user || !user.isActive) {
                res.status(401).json({
                    success: false,
                    error: 'USER_NOT_FOUND',
                    message: 'User not found or inactive'
                });
                return;
            }
            const tokens = await this.jwtService.refreshAccessToken(refreshToken, user);
            await this.auditService.logUserAction(user.id, 'token_refresh', '/auth/refresh', undefined, ipAddress, userAgent, true);
            res.json({
                success: true,
                tokens
            });
        }
        catch (error) {
            logger_1.default.error('Token refresh failed:', error);
            await this.auditService.logSecurityEvent({
                type: 'LOGIN_FAILURE',
                severity: 'MEDIUM',
                description: 'Token refresh failed',
                metadata: { error: error.message, ipAddress: req.ip }
            });
            res.status(401).json({
                success: false,
                error: 'INVALID_REFRESH_TOKEN',
                message: 'Invalid or expired refresh token'
            });
        }
    }
    async logout(req, res) {
        try {
            const authHeader = req.get('Authorization');
            const token = this.jwtService.extractTokenFromHeader(authHeader);
            const ipAddress = req.ip || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            if (token) {
                try {
                    const tokenPayload = await this.jwtService.verifyAccessToken(token);
                    await this.sessionManager.destroySession(tokenPayload.sessionId);
                    await this.auditService.logSecurityEvent({
                        type: 'LOGOUT',
                        userId: tokenPayload.userId,
                        severity: 'LOW',
                        description: `User ${tokenPayload.username} logged out`,
                        metadata: {
                            sessionId: tokenPayload.sessionId,
                            ipAddress,
                            userAgent
                        }
                    });
                }
                catch (error) {
                    logger_1.default.warn('Token verification failed during logout:', error.message);
                }
            }
            res.json({
                success: true,
                message: 'Successfully logged out'
            });
        }
        catch (error) {
            logger_1.default.error('Logout failed:', error);
            res.status(500).json({
                success: false,
                error: 'LOGOUT_ERROR',
                message: 'An error occurred during logout'
            });
        }
    }
    async setupMfa(req, res) {
        try {
            const { userId } = req.body;
            const user = await this.getUserById(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'USER_NOT_FOUND',
                    message: 'User not found'
                });
                return;
            }
            const mfaSetup = await this.jwtService.generateMfaSecret(user);
            await this.storeTempMfaSecret(userId, mfaSetup.secret);
            await this.auditService.logUserAction(userId, 'mfa_setup_initiated', '/auth/setup-mfa', undefined, req.ip || 'unknown', req.get('User-Agent') || 'unknown', true);
            res.json({
                success: true,
                mfaSetup: {
                    qrCode: mfaSetup.qrCode,
                    backupCodes: mfaSetup.backupCodes
                }
            });
        }
        catch (error) {
            logger_1.default.error('MFA setup failed:', error);
            res.status(500).json({
                success: false,
                error: 'MFA_SETUP_ERROR',
                message: 'Failed to setup multi-factor authentication'
            });
        }
    }
    async verifyMfa(req, res) {
        try {
            const { userId, token } = req.body;
            const tempSecret = await this.getTempMfaSecret(userId);
            if (!tempSecret) {
                res.status(400).json({
                    success: false,
                    error: 'NO_PENDING_MFA_SETUP',
                    message: 'No pending MFA setup found'
                });
                return;
            }
            if (!this.jwtService.verifyMfaToken(token, tempSecret)) {
                res.status(401).json({
                    success: false,
                    error: 'INVALID_MFA_TOKEN',
                    message: 'Invalid MFA token'
                });
                return;
            }
            await this.enableUserMfa(userId, tempSecret);
            await this.clearTempMfaSecret(userId);
            await this.auditService.logSecurityEvent({
                type: 'MFA_ENABLED',
                userId,
                severity: 'MEDIUM',
                description: 'Multi-factor authentication enabled',
                metadata: { ipAddress: req.ip }
            });
            res.json({
                success: true,
                message: 'Multi-factor authentication enabled successfully'
            });
        }
        catch (error) {
            logger_1.default.error('MFA verification failed:', error);
            res.status(500).json({
                success: false,
                error: 'MFA_VERIFICATION_ERROR',
                message: 'Failed to verify multi-factor authentication'
            });
        }
    }
    async getCurrentUser(req, res) {
        try {
            const authHeader = req.get('Authorization');
            const token = this.jwtService.extractTokenFromHeader(authHeader);
            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'NO_TOKEN',
                    message: 'No authentication token provided'
                });
                return;
            }
            const tokenPayload = await this.jwtService.verifyAccessToken(token);
            const user = await this.getUserById(tokenPayload.userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'USER_NOT_FOUND',
                    message: 'User not found'
                });
                return;
            }
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    department: user.department,
                    isActive: user.isActive,
                    isMfaEnabled: user.isMfaEnabled,
                    lastLogin: user.lastLogin
                }
            });
        }
        catch (error) {
            res.status(401).json({
                success: false,
                error: 'INVALID_TOKEN',
                message: 'Invalid or expired token'
            });
        }
    }
    generateAuthorizationCode() {
        return `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateAccessToken(payload) {
        return jsonwebtoken_1.default.sign({
            ...payload,
            type: 'access',
            iss: config_1.default.fhir.baseUrl,
            aud: payload.aud || config_1.default.fhir.baseUrl,
            iat: Math.floor(Date.now() / 1000),
        }, config_1.default.jwt.secret, { expiresIn: '1h' });
    }
    generateRefreshToken(payload) {
        return jsonwebtoken_1.default.sign({
            ...payload,
            type: 'refresh',
            iss: config_1.default.fhir.baseUrl,
            iat: Math.floor(Date.now() / 1000),
        }, config_1.default.jwt.secret, { expiresIn: '30d' });
    }
    authCodes = new Map();
    storeAuthorizationCode(code, data) {
        this.authCodes.set(code, data);
        setTimeout(() => {
            this.authCodes.delete(code);
        }, 10 * 60 * 1000);
    }
    getAuthorizationCode(code) {
        return this.authCodes.get(code);
    }
    removeAuthorizationCode(code) {
        this.authCodes.delete(code);
    }
    async validateClientCredentials(clientId, clientSecret) {
        return clientId === 'omnicare-client' && clientSecret === 'omnicare-secret';
    }
    async validateUserCredentials(username, password) {
        try {
            const user = await this.getUserByUsernameOrEmail(username);
            if (!user) {
                return null;
            }
            const isPasswordValid = await this.jwtService.verifyPassword(password, user.passwordHash || '');
            if (!isPasswordValid) {
                await this.incrementFailedLoginAttempts(user.id);
                return null;
            }
            await this.resetFailedLoginAttempts(user.id);
            return user;
        }
        catch (error) {
            logger_1.default.error('User credential validation failed:', error);
            return null;
        }
    }
    async getUserById(userId) {
        try {
            const mockUsers = {
                'user-1': {
                    id: 'user-1',
                    username: 'admin@omnicare.com',
                    email: 'admin@omnicare.com',
                    firstName: 'System',
                    lastName: 'Administrator',
                    role: auth_types_1.UserRole.SYSTEM_ADMINISTRATOR,
                    department: 'IT',
                    isActive: true,
                    isMfaEnabled: true,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    passwordHash: await this.jwtService.hashPassword('admin123')
                },
                'user-2': {
                    id: 'user-2',
                    username: 'doctor@omnicare.com',
                    email: 'doctor@omnicare.com',
                    firstName: 'Dr. Jane',
                    lastName: 'Smith',
                    role: auth_types_1.UserRole.PHYSICIAN,
                    department: 'Cardiology',
                    licenseNumber: 'MD123456',
                    npiNumber: '1234567890',
                    isActive: true,
                    isMfaEnabled: true,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    passwordHash: await this.jwtService.hashPassword('demo123')
                },
                'user-3': {
                    id: 'user-3',
                    username: 'nurse@omnicare.com',
                    email: 'nurse@omnicare.com',
                    firstName: 'Sarah',
                    lastName: 'Johnson',
                    role: auth_types_1.UserRole.NURSING_STAFF,
                    department: 'Emergency',
                    licenseNumber: 'RN789012',
                    isActive: true,
                    isMfaEnabled: false,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    passwordHash: await this.jwtService.hashPassword('demo123')
                }
            };
            return mockUsers[userId] || null;
        }
        catch (error) {
            logger_1.default.error('Get user by ID failed:', error);
            return null;
        }
    }
    async getUserByUsernameOrEmail(usernameOrEmail) {
        try {
            const mockUsers = [
                {
                    id: 'user-1',
                    username: 'admin@omnicare.com',
                    email: 'admin@omnicare.com',
                    firstName: 'System',
                    lastName: 'Administrator',
                    role: auth_types_1.UserRole.SYSTEM_ADMINISTRATOR,
                    department: 'IT',
                    isActive: true,
                    isMfaEnabled: true,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    passwordHash: await this.jwtService.hashPassword('admin123')
                },
                {
                    id: 'user-2',
                    username: 'doctor@omnicare.com',
                    email: 'doctor@omnicare.com',
                    firstName: 'Dr. Jane',
                    lastName: 'Smith',
                    role: auth_types_1.UserRole.PHYSICIAN,
                    department: 'Cardiology',
                    licenseNumber: 'MD123456',
                    npiNumber: '1234567890',
                    isActive: true,
                    isMfaEnabled: true,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    passwordHash: await this.jwtService.hashPassword('demo123')
                },
                {
                    id: 'user-3',
                    username: 'nurse@omnicare.com',
                    email: 'nurse@omnicare.com',
                    firstName: 'Sarah',
                    lastName: 'Johnson',
                    role: auth_types_1.UserRole.NURSING_STAFF,
                    department: 'Emergency',
                    licenseNumber: 'RN789012',
                    isActive: true,
                    isMfaEnabled: false,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    passwordHash: await this.jwtService.hashPassword('demo123')
                }
            ];
            return mockUsers.find(user => user.username === usernameOrEmail || user.email === usernameOrEmail) || null;
        }
        catch (error) {
            logger_1.default.error('Get user by username/email failed:', error);
            return null;
        }
    }
    async updateUserLoginInfo(userId, ipAddress) {
        try {
            logger_1.default.info(`Updated login info for user ${userId} from ${ipAddress}`);
        }
        catch (error) {
            logger_1.default.error('Update user login info failed:', error);
        }
    }
    async incrementFailedLoginAttempts(userId) {
        try {
            logger_1.default.info(`Incremented failed login attempts for user ${userId}`);
        }
        catch (error) {
            logger_1.default.error('Increment failed login attempts failed:', error);
        }
    }
    async resetFailedLoginAttempts(userId) {
        try {
            logger_1.default.info(`Reset failed login attempts for user ${userId}`);
        }
        catch (error) {
            logger_1.default.error('Reset failed login attempts failed:', error);
        }
    }
    async storeTempMfaSecret(userId, secret) {
        try {
            logger_1.default.info(`Stored temporary MFA secret for user ${userId}`);
        }
        catch (error) {
            logger_1.default.error('Store temp MFA secret failed:', error);
        }
    }
    async getTempMfaSecret(userId) {
        try {
            logger_1.default.info(`Retrieved temporary MFA secret for user ${userId}`);
            return null;
        }
        catch (error) {
            logger_1.default.error('Get temp MFA secret failed:', error);
            return null;
        }
    }
    async clearTempMfaSecret(userId) {
        try {
            logger_1.default.info(`Cleared temporary MFA secret for user ${userId}`);
        }
        catch (error) {
            logger_1.default.error('Clear temp MFA secret failed:', error);
        }
    }
    async enableUserMfa(userId, secret) {
        try {
            logger_1.default.info(`Enabled MFA for user ${userId}`);
        }
        catch (error) {
            logger_1.default.error('Enable user MFA failed:', error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map