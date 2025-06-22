"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTAuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const uuid_1 = require("uuid");
const role_permissions_1 = require("@/auth/role-permissions");
const auth_config_1 = require("@/config/auth.config");
class JWTAuthService {
    accessTokenSecret;
    refreshTokenSecret;
    constructor() {
        this.accessTokenSecret = auth_config_1.AUTH_CONFIG.jwt.accessTokenSecret;
        this.refreshTokenSecret = auth_config_1.AUTH_CONFIG.jwt.refreshTokenSecret;
        otplib_1.authenticator.options = {
            window: auth_config_1.AUTH_CONFIG.mfa.window,
            digits: auth_config_1.AUTH_CONFIG.mfa.digits,
            step: auth_config_1.AUTH_CONFIG.mfa.period
        };
    }
    generateTokens(user) {
        const sessionId = (0, uuid_1.v4)();
        const permissions = (0, role_permissions_1.getRolePermissions)(user.role);
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions,
            sessionId
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, this.accessTokenSecret, {
            expiresIn: auth_config_1.AUTH_CONFIG.jwt.accessTokenExpiry,
            issuer: auth_config_1.AUTH_CONFIG.jwt.issuer,
            audience: auth_config_1.AUTH_CONFIG.jwt.audience,
            algorithm: auth_config_1.AUTH_CONFIG.jwt.algorithm
        });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id, sessionId }, this.refreshTokenSecret, {
            expiresIn: auth_config_1.AUTH_CONFIG.jwt.refreshTokenExpiry,
            issuer: auth_config_1.AUTH_CONFIG.jwt.issuer,
            audience: auth_config_1.AUTH_CONFIG.jwt.audience,
            algorithm: auth_config_1.AUTH_CONFIG.jwt.algorithm
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: this.getTokenExpiryTime(auth_config_1.AUTH_CONFIG.jwt.accessTokenExpiry),
            tokenType: 'Bearer'
        };
    }
    verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.accessTokenSecret, {
                issuer: auth_config_1.AUTH_CONFIG.jwt.issuer,
                audience: auth_config_1.AUTH_CONFIG.jwt.audience,
                algorithms: [auth_config_1.AUTH_CONFIG.jwt.algorithm]
            });
            return decoded;
        }
        catch {
            const dummyToken = 'x'.repeat(token.length);
            try {
                jsonwebtoken_1.default.verify(dummyToken, this.accessTokenSecret, {
                    issuer: auth_config_1.AUTH_CONFIG.jwt.issuer,
                    audience: auth_config_1.AUTH_CONFIG.jwt.audience,
                    algorithms: [auth_config_1.AUTH_CONFIG.jwt.algorithm]
                });
            }
            catch {
            }
            throw new Error('Invalid or expired access token');
        }
    }
    verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.refreshTokenSecret, {
                issuer: auth_config_1.AUTH_CONFIG.jwt.issuer,
                audience: auth_config_1.AUTH_CONFIG.jwt.audience,
                algorithms: [auth_config_1.AUTH_CONFIG.jwt.algorithm]
            });
            return decoded;
        }
        catch {
            const dummyToken = 'x'.repeat(token.length);
            try {
                jsonwebtoken_1.default.verify(dummyToken, this.refreshTokenSecret, {
                    issuer: auth_config_1.AUTH_CONFIG.jwt.issuer,
                    audience: auth_config_1.AUTH_CONFIG.jwt.audience,
                    algorithms: [auth_config_1.AUTH_CONFIG.jwt.algorithm]
                });
            }
            catch {
            }
            throw new Error('Invalid or expired refresh token');
        }
    }
    refreshAccessToken(refreshToken, user) {
        const decoded = this.verifyRefreshToken(refreshToken);
        if (decoded.userId !== user.id) {
            throw new Error('Token user mismatch');
        }
        return this.generateTokens(user);
    }
    async hashPassword(password) {
        return bcrypt_1.default.hash(password, auth_config_1.AUTH_CONFIG.security.saltRounds);
    }
    async verifyPassword(password, hashedPassword) {
        return bcrypt_1.default.compare(password, hashedPassword);
    }
    validatePassword(password) {
        const errors = [];
        if (password.length < auth_config_1.PASSWORD_POLICY.minLength) {
            errors.push(`Password must be at least ${auth_config_1.PASSWORD_POLICY.minLength} characters long`);
        }
        if (auth_config_1.PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (auth_config_1.PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (auth_config_1.PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (auth_config_1.PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async generateMfaSecret(user) {
        const secret = otplib_1.authenticator.generateSecret();
        const keyuri = otplib_1.authenticator.keyuri(user.username, auth_config_1.AUTH_CONFIG.mfa.issuer, secret);
        const qrCode = await qrcode_1.default.toDataURL(keyuri);
        const backupCodes = this.generateBackupCodes();
        return {
            secret,
            qrCode,
            backupCodes
        };
    }
    verifyMfaToken(token, secret) {
        return otplib_1.authenticator.check(token, secret);
    }
    isMfaRequired(role) {
        return auth_config_1.MFA_REQUIRED_ROLES.includes(role) || auth_config_1.AUTH_CONFIG.security.requireMfaForPrivilegedRoles;
    }
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < auth_config_1.AUTH_CONFIG.mfa.backupCodesCount; i++) {
            const code = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }
    getTokenExpiryTime(expiry) {
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1));
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return 15 * 60;
        }
    }
    generateSecureToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    createSessionInfo(user, sessionId, ipAddress, userAgent) {
        const expiresAt = new Date();
        expiresAt.setTime(expiresAt.getTime() + auth_config_1.AUTH_CONFIG.security.sessionTimeout);
        return {
            userId: user.id,
            sessionId,
            role: user.role,
            permissions: (0, role_permissions_1.getRolePermissions)(user.role),
            ipAddress,
            userAgent,
            lastActivity: new Date(),
            expiresAt
        };
    }
    isSessionValid(session) {
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
        return (session.expiresAt > now &&
            timeSinceLastActivity < auth_config_1.AUTH_CONFIG.security.sessionTimeout);
    }
    updateSessionActivity(session) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + auth_config_1.AUTH_CONFIG.security.sessionTimeout);
        return {
            ...session,
            lastActivity: now,
            expiresAt
        };
    }
    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }
    generateSecureRandomString(length = 32) {
        return crypto_1.default.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }
    encryptData(data, key) {
        const iv = crypto_1.default.randomBytes(auth_config_1.AUTH_CONFIG.encryption.ivLength);
        const keyBuffer = crypto_1.default.scryptSync(key, 'salt', 32);
        const cipher = crypto_1.default.createCipheriv('aes-256-gcm', keyBuffer, iv);
        let encrypted = cipher.update(data, 'utf8', auth_config_1.AUTH_CONFIG.encryption.encoding);
        encrypted += cipher.final(auth_config_1.AUTH_CONFIG.encryption.encoding);
        const tag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString(auth_config_1.AUTH_CONFIG.encryption.encoding),
            tag: tag.toString(auth_config_1.AUTH_CONFIG.encryption.encoding)
        };
    }
    decryptData(encryptedData, key) {
        const keyBuffer = crypto_1.default.scryptSync(key, 'salt', 32);
        const iv = Buffer.from(encryptedData.iv, auth_config_1.AUTH_CONFIG.encryption.encoding);
        const tag = Buffer.from(encryptedData.tag, auth_config_1.AUTH_CONFIG.encryption.encoding);
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', keyBuffer, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encryptedData.encrypted, auth_config_1.AUTH_CONFIG.encryption.encoding, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
exports.JWTAuthService = JWTAuthService;
//# sourceMappingURL=jwt.service.js.map