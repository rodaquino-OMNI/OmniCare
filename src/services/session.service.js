"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = exports.InMemorySessionStore = exports.RedisSessionStore = void 0;
const events_1 = require("events");
const ioredis_1 = __importDefault(require("ioredis"));
const uuid_1 = require("uuid");
const auth_config_1 = require("@/config/auth.config");
const audit_service_1 = require("@/services/audit.service");
class RedisSessionStore {
    redis;
    keyPrefix = 'omnicare:session:';
    constructor(redisConfig) {
        this.redis = new ioredis_1.default(redisConfig || {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        });
    }
    async get(sessionId) {
        try {
            const data = await this.redis.get(this.keyPrefix + sessionId);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            console.error('Redis session get error:', error);
            return null;
        }
    }
    async set(sessionId, session, ttl) {
        try {
            const key = this.keyPrefix + sessionId;
            const data = JSON.stringify(session);
            if (ttl) {
                await this.redis.setex(key, ttl, data);
            }
            else {
                await this.redis.set(key, data);
            }
            await this.redis.sadd(`omnicare:user:${session.userId}:sessions`, sessionId);
        }
        catch (error) {
            console.error('Redis session set error:', error);
            throw error;
        }
    }
    async delete(sessionId) {
        try {
            const session = await this.get(sessionId);
            await this.redis.del(this.keyPrefix + sessionId);
            if (session) {
                await this.redis.srem(`omnicare:user:${session.userId}:sessions`, sessionId);
            }
        }
        catch (error) {
            console.error('Redis session delete error:', error);
            throw error;
        }
    }
    async exists(sessionId) {
        try {
            const result = await this.redis.exists(this.keyPrefix + sessionId);
            return result === 1;
        }
        catch (error) {
            console.error('Redis session exists error:', error);
            return false;
        }
    }
    async getAllUserSessions(userId) {
        try {
            const sessionIds = await this.redis.smembers(`omnicare:user:${userId}:sessions`);
            const sessions = [];
            for (const sessionId of sessionIds) {
                const session = await this.get(sessionId);
                if (session) {
                    sessions.push(session);
                }
            }
            return sessions;
        }
        catch (error) {
            console.error('Redis get user sessions error:', error);
            return [];
        }
    }
    async deleteUserSessions(userId) {
        try {
            const sessionIds = await this.redis.smembers(`omnicare:user:${userId}:sessions`);
            for (const sessionId of sessionIds) {
                await this.redis.del(this.keyPrefix + sessionId);
            }
            await this.redis.del(`omnicare:user:${userId}:sessions`);
        }
        catch (error) {
            console.error('Redis delete user sessions error:', error);
            throw error;
        }
    }
    async cleanup() {
        try {
            const pattern = this.keyPrefix + '*';
            const keys = await this.redis.keys(pattern);
            let cleanedCount = 0;
            for (const key of keys) {
                const sessionId = key.replace(this.keyPrefix, '');
                const session = await this.get(sessionId);
                if (session && new Date(session.expiresAt) < new Date()) {
                    await this.delete(sessionId);
                    cleanedCount++;
                }
            }
            return cleanedCount;
        }
        catch (error) {
            console.error('Redis session cleanup error:', error);
            return 0;
        }
    }
}
exports.RedisSessionStore = RedisSessionStore;
class InMemorySessionStore {
    sessions = new Map();
    userSessions = new Map();
    async get(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    async set(sessionId, session, _ttl) {
        this.sessions.set(sessionId, session);
        if (!this.userSessions.has(session.userId)) {
            this.userSessions.set(session.userId, new Set());
        }
        this.userSessions.get(session.userId).add(sessionId);
    }
    async delete(sessionId) {
        const session = this.sessions.get(sessionId);
        this.sessions.delete(sessionId);
        if (session) {
            const userSessions = this.userSessions.get(session.userId);
            if (userSessions) {
                userSessions.delete(sessionId);
                if (userSessions.size === 0) {
                    this.userSessions.delete(session.userId);
                }
            }
        }
    }
    async exists(sessionId) {
        return this.sessions.has(sessionId);
    }
    async getAllUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId) || new Set();
        const sessions = [];
        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (session) {
                sessions.push(session);
            }
        }
        return sessions;
    }
    async deleteUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId) || new Set();
        for (const sessionId of sessionIds) {
            this.sessions.delete(sessionId);
        }
        this.userSessions.delete(userId);
    }
    async cleanup() {
        let cleanedCount = 0;
        const now = new Date();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (new Date(session.expiresAt) < now) {
                await this.delete(sessionId);
                cleanedCount++;
            }
        }
        return cleanedCount;
    }
}
exports.InMemorySessionStore = InMemorySessionStore;
class SessionManager extends events_1.EventEmitter {
    store;
    auditService;
    cleanupInterval;
    constructor(store) {
        super();
        this.store = store || new InMemorySessionStore();
        this.auditService = new audit_service_1.AuditService();
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }
    async createSession(user, ipAddress, userAgent) {
        const sessionId = (0, uuid_1.v4)();
        const now = new Date();
        const sessionTimeout = auth_config_1.ROLE_SESSION_TIMEOUTS[user.role] || auth_config_1.AUTH_CONFIG.security.sessionTimeout;
        const expiresAt = new Date(now.getTime() + sessionTimeout);
        const session = {
            userId: user.id,
            sessionId,
            role: user.role,
            permissions: [],
            ipAddress,
            userAgent,
            lastActivity: now,
            expiresAt
        };
        await this.store.set(sessionId, session, Math.floor(sessionTimeout / 1000));
        await this.auditService.logSecurityEvent({
            type: 'LOGIN_SUCCESS',
            userId: user.id,
            severity: 'LOW',
            description: `Session created for user ${user.username}`,
            metadata: { sessionId, ipAddress, userAgent, role: user.role }
        });
        this.emit('sessionCreated', session);
        return session;
    }
    async getSession(sessionId) {
        const session = await this.store.get(sessionId);
        if (!session) {
            return null;
        }
        if (!this.isSessionValid(session)) {
            await this.destroySession(sessionId);
            return null;
        }
        return session;
    }
    async updateSessionActivity(sessionId) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return null;
        }
        const now = new Date();
        const sessionTimeout = auth_config_1.ROLE_SESSION_TIMEOUTS[session.role] || auth_config_1.AUTH_CONFIG.security.sessionTimeout;
        session.lastActivity = now;
        session.expiresAt = new Date(now.getTime() + sessionTimeout);
        await this.store.set(sessionId, session, Math.floor(sessionTimeout / 1000));
        this.emit('sessionUpdated', session);
        return session;
    }
    async destroySession(sessionId) {
        const session = await this.store.get(sessionId);
        await this.store.delete(sessionId);
        if (session) {
            await this.auditService.logSecurityEvent({
                type: 'LOGOUT',
                userId: session.userId,
                severity: 'LOW',
                description: `Session destroyed for user`,
                metadata: { sessionId, ipAddress: session.ipAddress }
            });
            this.emit('sessionDestroyed', session);
        }
    }
    async destroyUserSessions(userId, excludeSessionId) {
        const sessions = await this.store.getAllUserSessions(userId);
        for (const session of sessions) {
            if (!excludeSessionId || session.sessionId !== excludeSessionId) {
                await this.destroySession(session.sessionId);
            }
        }
        await this.auditService.logSecurityEvent({
            type: 'LOGOUT',
            userId,
            severity: 'MEDIUM',
            description: `All user sessions destroyed`,
            metadata: { sessionCount: sessions.length, excludeSessionId }
        });
    }
    async getUserSessions(userId) {
        return await this.store.getAllUserSessions(userId);
    }
    isSessionValid(session) {
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - new Date(session.lastActivity).getTime();
        const sessionTimeout = auth_config_1.ROLE_SESSION_TIMEOUTS[session.role] || auth_config_1.AUTH_CONFIG.security.sessionTimeout;
        return (new Date(session.expiresAt) > now &&
            timeSinceLastActivity < sessionTimeout);
    }
    async validateSessionSecurity(session, currentIpAddress, currentUserAgent) {
        const securityIssues = [];
        if (session.ipAddress !== currentIpAddress) {
            securityIssues.push('IP address mismatch');
            await this.auditService.logSecurityEvent({
                type: 'UNAUTHORIZED_ACCESS',
                userId: session.userId,
                severity: 'HIGH',
                description: `IP address mismatch for session ${session.sessionId}`,
                metadata: {
                    sessionId: session.sessionId,
                    originalIp: session.ipAddress,
                    currentIp: currentIpAddress
                }
            });
        }
        if (session.userAgent !== currentUserAgent) {
            securityIssues.push('User agent mismatch');
            await this.auditService.logSecurityEvent({
                type: 'UNAUTHORIZED_ACCESS',
                userId: session.userId,
                severity: 'MEDIUM',
                description: `User agent mismatch for session ${session.sessionId}`,
                metadata: {
                    sessionId: session.sessionId,
                    originalUserAgent: session.userAgent,
                    currentUserAgent
                }
            });
        }
        return {
            isValid: securityIssues.length === 0,
            securityIssues
        };
    }
    async getSessionStatistics() {
        return {
            totalActiveSessions: 0,
            sessionsByRole: {},
            averageSessionDuration: 0,
            expiredSessionsCleanedToday: 0
        };
    }
    async forceLogout(userId, reason) {
        await this.destroyUserSessions(userId);
        await this.auditService.logSecurityEvent({
            type: 'LOGOUT',
            userId,
            severity: 'HIGH',
            description: `Forced logout: ${reason}`,
            metadata: { reason, forced: true }
        });
        this.emit('forceLogout', { userId, reason });
    }
    async cleanupExpiredSessions() {
        try {
            const cleanedCount = await this.store.cleanup();
            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} expired sessions`);
                this.emit('sessionsCleanedUp', cleanedCount);
            }
        }
        catch (error) {
            console.error('Error during session cleanup:', error);
        }
    }
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.removeAllListeners();
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=session.service.js.map