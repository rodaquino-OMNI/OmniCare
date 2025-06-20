"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartFHIRService = exports.SMARTFHIRService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
class SMARTFHIRService {
    defaultScopes = config_1.default.smart.scopes;
    stateStore = new Map();
    authCodeStore = new Map();
    async initiateAuthorization(clientId, redirectUri, scope = this.defaultScopes, state, aud, launch) {
        try {
            const authState = state || this.generateSecureState();
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = this.generateCodeChallenge(codeVerifier);
            this.stateStore.set(authState, {
                clientId,
                redirectUri,
                scope,
                codeVerifier,
                aud,
                launch,
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
            });
            if (aud) {
                authParams.append('aud', aud);
            }
            if (launch) {
                authParams.append('launch', launch);
            }
            const authorizationUrl = `${config_1.default.smart.authorizationUrl}?${authParams.toString()}`;
            logger_1.default.security('SMART authorization initiated', {
                clientId,
                scope: scope.join(' '),
                state: authState,
                aud,
                launch: !!launch,
            });
            return { authorizationUrl, state: authState };
        }
        catch (error) {
            logger_1.default.error('Failed to initiate SMART authorization:', error);
            throw error;
        }
    }
    async exchangeCodeForToken(code, state, clientId) {
        try {
            const storedData = this.stateStore.get(state);
            if (!storedData) {
                throw new Error('Invalid or expired state parameter');
            }
            if (Date.now() > storedData.expiresAt) {
                this.stateStore.delete(state);
                throw new Error('Authorization state has expired');
            }
            const effectiveClientId = clientId || storedData.clientId;
            const tokenParams = {
                grant_type: 'authorization_code',
                code,
                redirect_uri: storedData.redirectUri,
                client_id: effectiveClientId,
                code_verifier: storedData.codeVerifier,
            };
            const response = await axios_1.default.post(config_1.default.smart.tokenUrl, new URLSearchParams(tokenParams).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout: 30000,
            });
            const tokenResponse = response.data;
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
            this.stateStore.delete(state);
            logger_1.default.security('SMART token exchange completed', {
                clientId: effectiveClientId,
                scope: tokenResponse.scope,
                patient: tokenResponse.patient,
                encounter: tokenResponse.encounter,
                fhirUser: tokenResponse.fhirUser,
                hasRefreshToken: !!tokenResponse.refresh_token,
            });
            return tokenResponse;
        }
        catch (error) {
            logger_1.default.error('Failed to exchange code for token:', error);
            if (axios_1.default.isAxiosError(error)) {
                logger_1.default.error('Token exchange error details:', {
                    status: error.response?.status,
                    data: error.response?.data,
                });
            }
            throw error;
        }
    }
    async refreshToken(refreshToken, clientId) {
        try {
            const tokenParams = {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
            };
            const response = await axios_1.default.post(config_1.default.smart.tokenUrl, new URLSearchParams(tokenParams).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout: 30000,
            });
            const tokenResponse = response.data;
            logger_1.default.security('SMART token refreshed', {
                clientId,
                scope: tokenResponse.scope,
            });
            return tokenResponse;
        }
        catch (error) {
            logger_1.default.error('Failed to refresh token:', error);
            throw error;
        }
    }
    async introspectToken(accessToken) {
        try {
            const response = await axios_1.default.post(config_1.default.smart.introspectionUrl, new URLSearchParams({ token: accessToken }).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout: 10000,
            });
            const introspectionResult = response.data;
            logger_1.default.security('Token introspection completed', {
                active: introspectionResult.active,
                scope: introspectionResult.scope,
                client_id: introspectionResult.client_id,
            });
            return introspectionResult;
        }
        catch (error) {
            logger_1.default.error('Failed to introspect token:', error);
            throw error;
        }
    }
    async getSMARTConfiguration(fhirBaseUrl) {
        try {
            const configUrl = `${fhirBaseUrl.replace(/\/$/, '')}/.well-known/smart_configuration`;
            const response = await axios_1.default.get(configUrl, {
                headers: {
                    'Accept': 'application/json',
                },
                timeout: 10000,
            });
            const smartConfig = response.data;
            logger_1.default.integration('SMART configuration retrieved', {
                fhirBaseUrl,
                authorizationEndpoint: smartConfig.authorization_endpoint,
                tokenEndpoint: smartConfig.token_endpoint,
                capabilities: smartConfig.capabilities,
            });
            return smartConfig;
        }
        catch (error) {
            logger_1.default.error('Failed to get SMART configuration:', error);
            throw error;
        }
    }
    async launchStandaloneApp(fhirBaseUrl, clientId, redirectUri, scope = this.defaultScopes) {
        try {
            const smartConfig = await this.getSMARTConfiguration(fhirBaseUrl);
            const authState = this.generateSecureState();
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = this.generateCodeChallenge(codeVerifier);
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
            logger_1.default.integration('Standalone app launch initiated', {
                fhirBaseUrl,
                clientId,
                scope: scope.join(' '),
                state: authState,
            });
            return { authorizationUrl, state: authState };
        }
        catch (error) {
            logger_1.default.error('Failed to launch standalone app:', error);
            throw error;
        }
    }
    async handleEHRLaunch(iss, launch, clientId, redirectUri, scope = this.defaultScopes) {
        try {
            const smartConfig = await this.getSMARTConfiguration(iss);
            const authState = this.generateSecureState();
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = this.generateCodeChallenge(codeVerifier);
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
            logger_1.default.integration('EHR launch handled', {
                iss,
                launch,
                clientId,
                scope: scope.join(' '),
                state: authState,
            });
            return { authorizationUrl, state: authState };
        }
        catch (error) {
            logger_1.default.error('Failed to handle EHR launch:', error);
            throw error;
        }
    }
    async authenticateWithEpic(privateKeyPath) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const privateKey = await fs.readFile(privateKeyPath, 'utf8');
            const jwtPayload = {
                iss: config_1.default.ehr.epic.clientId,
                sub: config_1.default.ehr.epic.clientId,
                aud: config_1.default.ehr.epic.fhirBaseUrl.replace(/\/fhir.*$/, '/oauth2/token'),
                jti: crypto_1.default.randomUUID(),
                exp: Math.floor(Date.now() / 1000) + (5 * 60),
            };
            const signedJWT = jsonwebtoken_1.default.sign(jwtPayload, privateKey, { algorithm: 'RS384' });
            const tokenParams = {
                grant_type: 'client_credentials',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: signedJWT,
            };
            const response = await axios_1.default.post(config_1.default.ehr.epic.fhirBaseUrl.replace(/\/fhir.*$/, '/oauth2/token'), new URLSearchParams(tokenParams).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout: 30000,
            });
            const accessToken = response.data.access_token;
            logger_1.default.integration('Epic authentication successful', {
                clientId: config_1.default.ehr.epic.clientId,
            });
            return accessToken;
        }
        catch (error) {
            logger_1.default.error('Failed to authenticate with Epic:', error);
            throw error;
        }
    }
    async authenticateWithCerner() {
        try {
            const tokenParams = {
                grant_type: 'client_credentials',
                client_id: config_1.default.ehr.cerner.clientId,
                client_secret: config_1.default.ehr.cerner.clientSecret,
                scope: 'system/Patient.read system/Observation.read',
            };
            const response = await axios_1.default.post(config_1.default.ehr.cerner.fhirBaseUrl.replace(/\/r4.*$/, '/tenants/oauth/token'), new URLSearchParams(tokenParams).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout: 30000,
            });
            const accessToken = response.data.access_token;
            logger_1.default.integration('Cerner authentication successful', {
                clientId: config_1.default.ehr.cerner.clientId,
            });
            return accessToken;
        }
        catch (error) {
            logger_1.default.error('Failed to authenticate with Cerner:', error);
            throw error;
        }
    }
    generateSecureState() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    generateCodeVerifier() {
        return crypto_1.default.randomBytes(43).toString('base64url');
    }
    generateCodeChallenge(codeVerifier) {
        return crypto_1.default
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');
    }
    validateJWT(token, publicKey) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, publicKey || config_1.default.jwt.secret);
            logger_1.default.security('JWT validation successful', {
                sub: decoded.sub,
                iss: decoded.iss,
                aud: decoded.aud,
            });
            return decoded;
        }
        catch (error) {
            logger_1.default.error('JWT validation failed:', error);
            throw error;
        }
    }
    cleanupExpiredEntries() {
        const now = Date.now();
        for (const [key, value] of this.stateStore.entries()) {
            if (value.expiresAt && now > value.expiresAt) {
                this.stateStore.delete(key);
            }
        }
        for (const [key, value] of this.authCodeStore.entries()) {
            if (now - value.timestamp > 3600000) {
                this.authCodeStore.delete(key);
            }
        }
        logger_1.default.debug('Expired SMART entries cleaned up');
    }
    async getHealthStatus() {
        try {
            const details = {
                stateStoreSize: this.stateStore.size,
                authCodeStoreSize: this.authCodeStore.size,
                config: {
                    authorizationUrl: config_1.default.smart.authorizationUrl,
                    tokenUrl: config_1.default.smart.tokenUrl,
                    introspectionUrl: config_1.default.smart.introspectionUrl,
                },
            };
            return { status: 'UP', details };
        }
        catch (error) {
            return {
                status: 'DOWN',
                details: { error: error instanceof Error ? error.message : String(error) },
            };
        }
    }
}
exports.SMARTFHIRService = SMARTFHIRService;
exports.smartFHIRService = new SMARTFHIRService();
setInterval(() => {
    exports.smartFHIRService.cleanupExpiredEntries();
}, 5 * 60 * 1000);
//# sourceMappingURL=smart-fhir.service.js.map