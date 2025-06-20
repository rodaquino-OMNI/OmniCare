"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = exports.requireAdmin = exports.requireResourceAccess = exports.requirePatientAccess = exports.requireScope = exports.optionalAuthenticate = exports.authenticate = exports.AuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const smart_fhir_service_1 = require("@/services/smart-fhir.service");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
class AuthMiddleware {
    static async authenticate(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                logger_1.default.security('Missing authorization header', {
                    path: req.path,
                    method: req.method,
                    ip: req.ip,
                });
                res.status(401).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'login',
                            diagnostics: 'Authorization header is required',
                        }],
                });
                return;
            }
            const parts = authHeader.split(' ');
            if (parts.length !== 2 || parts[0] !== 'Bearer') {
                logger_1.default.security('Invalid authorization header format', {
                    path: req.path,
                    method: req.method,
                    ip: req.ip,
                });
                res.status(401).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'login',
                            diagnostics: 'Invalid authorization header format. Expected: Bearer <token>',
                        }],
                });
                return;
            }
            const token = parts[1];
            req.token = token;
            try {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
                req.user = {
                    id: decoded.sub || decoded.id,
                    sub: decoded.sub,
                    scope: decoded.scope ? decoded.scope.split(' ') : [],
                    patient: decoded.patient,
                    encounter: decoded.encounter,
                    fhirUser: decoded.fhirUser,
                    iss: decoded.iss,
                    aud: decoded.aud,
                    clientId: decoded.client_id,
                    tokenType: 'internal',
                };
                logger_1.default.security('Internal JWT authentication successful', {
                    userId: req.user.id,
                    path: req.path,
                    method: req.method,
                });
                next();
                return;
            }
            catch (jwtError) {
            }
            try {
                const introspectionResult = await smart_fhir_service_1.smartFHIRService.introspectToken(token);
                if (!introspectionResult.active) {
                    logger_1.default.security('Inactive SMART token', {
                        path: req.path,
                        method: req.method,
                        ip: req.ip,
                    });
                    res.status(401).json({
                        resourceType: 'OperationOutcome',
                        issue: [{
                                severity: 'error',
                                code: 'login',
                                diagnostics: 'Token is not active',
                            }],
                    });
                    return;
                }
                req.user = {
                    id: introspectionResult.sub || introspectionResult.patient,
                    sub: introspectionResult.sub,
                    scope: introspectionResult.scope ? introspectionResult.scope.split(' ') : [],
                    patient: introspectionResult.patient,
                    encounter: introspectionResult.encounter,
                    fhirUser: introspectionResult.fhirUser,
                    iss: introspectionResult.iss,
                    aud: introspectionResult.aud,
                    clientId: introspectionResult.client_id,
                    tokenType: 'smart',
                };
                logger_1.default.security('SMART token authentication successful', {
                    userId: req.user.id,
                    clientId: req.user.clientId,
                    path: req.path,
                    method: req.method,
                });
                next();
                return;
            }
            catch (smartError) {
                logger_1.default.error('Token authentication failed:', smartError);
            }
            logger_1.default.security('Token authentication failed', {
                path: req.path,
                method: req.method,
                ip: req.ip,
            });
            res.status(401).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'login',
                        diagnostics: 'Invalid or expired token',
                    }],
            });
        }
        catch (error) {
            logger_1.default.error('Authentication middleware error:', error);
            res.status(500).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'exception',
                        diagnostics: 'Internal authentication error',
                    }],
            });
        }
    }
    static async optionalAuthenticate(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            next();
            return;
        }
        await AuthMiddleware.authenticate(req, res, next);
    }
    static requireScope(...requiredScopes) {
        return (req, res, next) => {
            if (!req.user) {
                logger_1.default.security('Authorization check failed - no user context', {
                    path: req.path,
                    method: req.method,
                    requiredScopes,
                });
                res.status(401).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'login',
                            diagnostics: 'Authentication required',
                        }],
                });
                return;
            }
            const userScopes = req.user.scope || [];
            const hasRequiredScope = requiredScopes.some(scope => userScopes.includes(scope) ||
                userScopes.includes('*') ||
                AuthMiddleware.checkWildcardScope(userScopes, scope));
            if (!hasRequiredScope) {
                logger_1.default.security('Authorization check failed - insufficient scope', {
                    userId: req.user.id,
                    userScopes,
                    requiredScopes,
                    path: req.path,
                    method: req.method,
                });
                res.status(403).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'forbidden',
                            diagnostics: `Required scope: ${requiredScopes.join(' or ')}`,
                        }],
                });
                return;
            }
            logger_1.default.security('Authorization check passed', {
                userId: req.user.id,
                requiredScopes,
                path: req.path,
                method: req.method,
            });
            next();
        };
    }
    static requirePatientAccess(req, res, next) {
        if (!req.user) {
            res.status(401).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'login',
                        diagnostics: 'Authentication required',
                    }],
            });
            return;
        }
        const requestedPatientId = req.params.patientId || req.params.id;
        const authorizedPatientId = req.user.patient;
        const hasSystemAccess = req.user.scope?.some(scope => scope.includes('system/') || scope === '*');
        if (hasSystemAccess) {
            next();
            return;
        }
        if (!authorizedPatientId) {
            logger_1.default.security('Patient access denied - no patient context', {
                userId: req.user.id,
                requestedPatientId,
                path: req.path,
                method: req.method,
            });
            res.status(403).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'forbidden',
                        diagnostics: 'No patient context available',
                    }],
            });
            return;
        }
        if (requestedPatientId && authorizedPatientId !== requestedPatientId) {
            logger_1.default.security('Patient access denied - patient ID mismatch', {
                userId: req.user.id,
                authorizedPatientId,
                requestedPatientId,
                path: req.path,
                method: req.method,
            });
            res.status(403).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'forbidden',
                        diagnostics: 'Access denied to requested patient',
                    }],
            });
            return;
        }
        next();
    }
    static requireResourceAccess(resourceType, operation) {
        return (req, res, next) => {
            if (!req.user) {
                res.status(401).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'login',
                            diagnostics: 'Authentication required',
                        }],
                });
                return;
            }
            const userScopes = req.user.scope || [];
            const resourceScopes = [
                `system/${resourceType}.${operation}`,
                `system/${resourceType}.*`,
                `user/${resourceType}.${operation}`,
                `user/${resourceType}.*`,
                `patient/${resourceType}.${operation}`,
                `patient/${resourceType}.*`,
                operation === 'read' ? `system/${resourceType}.read` : null,
                operation === 'write' ? `system/${resourceType}.write` : null,
                '*',
            ].filter(Boolean);
            const hasAccess = resourceScopes.some(scope => userScopes.includes(scope));
            if (!hasAccess) {
                logger_1.default.security('Resource access denied', {
                    userId: req.user.id,
                    resourceType,
                    operation,
                    userScopes,
                    path: req.path,
                    method: req.method,
                });
                res.status(403).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'forbidden',
                            diagnostics: `Insufficient permissions for ${resourceType} ${operation}`,
                        }],
                });
                return;
            }
            next();
        };
    }
    static requireAdmin(req, res, next) {
        if (!req.user) {
            res.status(401).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'login',
                        diagnostics: 'Authentication required',
                    }],
            });
            return;
        }
        const isAdmin = req.user.scope?.includes('admin') ||
            req.user.scope?.includes('*') ||
            req.user.scope?.includes('system/*.*');
        if (!isAdmin) {
            logger_1.default.security('Admin access denied', {
                userId: req.user.id,
                userScopes: req.user.scope,
                path: req.path,
                method: req.method,
            });
            res.status(403).json({
                resourceType: 'OperationOutcome',
                issue: [{
                        severity: 'error',
                        code: 'forbidden',
                        diagnostics: 'Administrator privileges required',
                    }],
            });
            return;
        }
        next();
    }
    static checkWildcardScope(userScopes, requiredScope) {
        return userScopes.some(userScope => {
            if (userScope.endsWith('.*')) {
                const prefix = userScope.slice(0, -2);
                return requiredScope.startsWith(prefix);
            }
            return false;
        });
    }
    static createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {
        const rateLimitStore = new Map();
        return (req, res, next) => {
            const key = req.user?.id || req.user?.clientId || req.ip;
            const now = Date.now();
            const userLimit = rateLimitStore.get(key);
            if (!userLimit || now > userLimit.resetTime) {
                rateLimitStore.set(key, {
                    count: 1,
                    resetTime: now + windowMs,
                });
                res.setHeader('X-RateLimit-Limit', max);
                res.setHeader('X-RateLimit-Remaining', max - 1);
                res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
                next();
                return;
            }
            if (userLimit.count >= max) {
                logger_1.default.security('Rate limit exceeded', {
                    key,
                    userId: req.user?.id,
                    clientId: req.user?.clientId,
                    path: req.path,
                    method: req.method,
                    count: userLimit.count,
                    limit: max,
                });
                res.status(429).json({
                    resourceType: 'OperationOutcome',
                    issue: [{
                            severity: 'error',
                            code: 'throttled',
                            diagnostics: 'Rate limit exceeded. Please try again later.',
                        }],
                });
                return;
            }
            userLimit.count++;
            rateLimitStore.set(key, userLimit);
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', max - userLimit.count);
            res.setHeader('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());
            next();
        };
    }
    static auditLog(req, res, next) {
        const startTime = Date.now();
        logger_1.default.audit('API request initiated', {
            userId: req.user?.id,
            clientId: req.user?.clientId,
            method: req.method,
            path: req.path,
            query: req.query,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        const originalJson = res.json;
        res.json = function (body) {
            const duration = Date.now() - startTime;
            logger_1.default.audit('API request completed', {
                userId: req.user?.id,
                clientId: req.user?.clientId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString(),
            });
            return originalJson.call(this, body);
        };
        next();
    }
}
exports.AuthMiddleware = AuthMiddleware;
exports.authenticate = AuthMiddleware.authenticate;
exports.optionalAuthenticate = AuthMiddleware.optionalAuthenticate;
exports.requireScope = AuthMiddleware.requireScope;
exports.requirePatientAccess = AuthMiddleware.requirePatientAccess;
exports.requireResourceAccess = AuthMiddleware.requireResourceAccess;
exports.requireAdmin = AuthMiddleware.requireAdmin;
exports.auditLog = AuthMiddleware.auditLog;
//# sourceMappingURL=auth.middleware.js.map