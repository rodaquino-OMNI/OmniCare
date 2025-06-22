import { EventEmitter } from 'events';
import { SessionInfo, User, UserRole } from '@/types/auth.types';
export interface SessionStore {
    get(sessionId: string): Promise<SessionInfo | null>;
    set(sessionId: string, session: SessionInfo, ttl?: number): Promise<void>;
    delete(sessionId: string): Promise<void>;
    exists(sessionId: string): Promise<boolean>;
    getAllUserSessions(userId: string): Promise<SessionInfo[]>;
    deleteUserSessions(userId: string): Promise<void>;
    cleanup(): Promise<number>;
}
export declare class RedisSessionStore implements SessionStore {
    private redis;
    private keyPrefix;
    constructor(redisConfig?: any);
    get(sessionId: string): Promise<SessionInfo | null>;
    set(sessionId: string, session: SessionInfo, ttl?: number): Promise<void>;
    delete(sessionId: string): Promise<void>;
    exists(sessionId: string): Promise<boolean>;
    getAllUserSessions(userId: string): Promise<SessionInfo[]>;
    deleteUserSessions(userId: string): Promise<void>;
    cleanup(): Promise<number>;
}
export declare class InMemorySessionStore implements SessionStore {
    private sessions;
    private userSessions;
    get(sessionId: string): Promise<SessionInfo | null>;
    set(sessionId: string, session: SessionInfo, _ttl?: number): Promise<void>;
    delete(sessionId: string): Promise<void>;
    exists(sessionId: string): Promise<boolean>;
    getAllUserSessions(userId: string): Promise<SessionInfo[]>;
    deleteUserSessions(userId: string): Promise<void>;
    cleanup(): Promise<number>;
}
export declare class SessionManager extends EventEmitter {
    private store;
    private auditService;
    private cleanupInterval;
    constructor(store?: SessionStore);
    createSession(user: User, ipAddress: string, userAgent: string): Promise<SessionInfo>;
    getSession(sessionId: string): Promise<SessionInfo | null>;
    updateSessionActivity(sessionId: string): Promise<SessionInfo | null>;
    destroySession(sessionId: string): Promise<void>;
    destroyUserSessions(userId: string, excludeSessionId?: string): Promise<void>;
    getUserSessions(userId: string): Promise<SessionInfo[]>;
    isSessionValid(session: SessionInfo): boolean;
    validateSessionSecurity(session: SessionInfo, currentIpAddress: string, currentUserAgent: string): Promise<{
        isValid: boolean;
        securityIssues: string[];
    }>;
    getSessionStatistics(): Promise<{
        totalActiveSessions: number;
        sessionsByRole: Record<UserRole, number>;
        averageSessionDuration: number;
        expiredSessionsCleanedToday: number;
    }>;
    forceLogout(userId: string, reason: string): Promise<void>;
    private cleanupExpiredSessions;
    shutdown(): void;
}
//# sourceMappingURL=session.service.d.ts.map