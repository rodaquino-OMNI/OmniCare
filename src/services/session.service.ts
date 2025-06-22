/**
 * OmniCare EMR - Session Management Service
 * HIPAA-Compliant Session Handling with Security Controls
 */

import { EventEmitter } from 'events';

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

import { AUTH_CONFIG, ROLE_SESSION_TIMEOUTS } from '@/config/auth.config';
import { AuditService } from '@/services/audit.service';
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

export class RedisSessionStore implements SessionStore {
  private redis: Redis;
  private keyPrefix = 'omnicare:session:';

  constructor(redisConfig?: any) {
    this.redis = new Redis(redisConfig || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }

  async get(sessionId: string): Promise<SessionInfo | null> {
    try {
      const data = await this.redis.get(this.keyPrefix + sessionId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis session get error:', error);
      return null;
    }
  }

  async set(sessionId: string, session: SessionInfo, ttl?: number): Promise<void> {
    try {
      const key = this.keyPrefix + sessionId;
      const data = JSON.stringify(session);
      
      if (ttl) {
        await this.redis.setex(key, ttl, data);
      } else {
        await this.redis.set(key, data);
      }

      // Also store in user index for bulk operations
      await this.redis.sadd(`omnicare:user:${session.userId}:sessions`, sessionId);
    } catch (error) {
      console.error('Redis session set error:', error);
      throw error;
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      const session = await this.get(sessionId);
      await this.redis.del(this.keyPrefix + sessionId);
      
      if (session) {
        await this.redis.srem(`omnicare:user:${session.userId}:sessions`, sessionId);
      }
    } catch (error) {
      console.error('Redis session delete error:', error);
      throw error;
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.keyPrefix + sessionId);
      return result === 1;
    } catch (error) {
      console.error('Redis session exists error:', error);
      return false;
    }
  }

  async getAllUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const sessionIds = await this.redis.smembers(`omnicare:user:${userId}:sessions`);
      const sessions: SessionInfo[] = [];
      
      for (const sessionId of sessionIds) {
        const session = await this.get(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Redis get user sessions error:', error);
      return [];
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.redis.smembers(`omnicare:user:${userId}:sessions`);
      
      for (const sessionId of sessionIds) {
        await this.redis.del(this.keyPrefix + sessionId);
      }
      
      await this.redis.del(`omnicare:user:${userId}:sessions`);
    } catch (error) {
      console.error('Redis delete user sessions error:', error);
      throw error;
    }
  }

  async cleanup(): Promise<number> {
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
    } catch (error) {
      console.error('Redis session cleanup error:', error);
      return 0;
    }
  }
}

export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, SessionInfo> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  async get(sessionId: string): Promise<SessionInfo | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(sessionId: string, session: SessionInfo, _ttl?: number): Promise<void> {
    this.sessions.set(sessionId, session);
    
    // Add to user index
    if (!this.userSessions.has(session.userId)) {
      this.userSessions.set(session.userId, new Set());
    }
    this.userSessions.get(session.userId)!.add(sessionId);
  }

  async delete(sessionId: string): Promise<void> {
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

  async exists(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async getAllUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = this.userSessions.get(userId) || new Set();
    const sessions: SessionInfo[] = [];
    
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const sessionIds = this.userSessions.get(userId) || new Set();
    
    for (const sessionId of sessionIds) {
      this.sessions.delete(sessionId);
    }
    
    this.userSessions.delete(userId);
  }

  async cleanup(): Promise<number> {
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

export class SessionManager extends EventEmitter {
  private store: SessionStore;
  private auditService: AuditService;
  private cleanupInterval: NodeJS.Timeout;

  constructor(store?: SessionStore) {
    super();
    this.store = store || new InMemorySessionStore();
    this.auditService = new AuditService();
    
    // Setup periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Create a new session
   */
  async createSession(user: User, ipAddress: string, userAgent: string): Promise<SessionInfo> {
    const sessionId = uuidv4();
    const now = new Date();
    const sessionTimeout = ROLE_SESSION_TIMEOUTS[user.role] || AUTH_CONFIG.security.sessionTimeout;
    const expiresAt = new Date(now.getTime() + sessionTimeout);

    const session: SessionInfo = {
      userId: user.id,
      sessionId,
      role: user.role,
      permissions: [], // Will be populated by role permissions
      ipAddress,
      userAgent,
      lastActivity: now,
      expiresAt
    };

    await this.store.set(sessionId, session, Math.floor(sessionTimeout / 1000));

    // Log session creation
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

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const session = await this.store.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (!this.isSessionValid(session)) {
      await this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<SessionInfo | null> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    const now = new Date();
    const sessionTimeout = ROLE_SESSION_TIMEOUTS[session.role] || AUTH_CONFIG.security.sessionTimeout;
    
    session.lastActivity = now;
    session.expiresAt = new Date(now.getTime() + sessionTimeout);

    await this.store.set(sessionId, session, Math.floor(sessionTimeout / 1000));
    
    this.emit('sessionUpdated', session);
    return session;
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = await this.store.get(sessionId);
    await this.store.delete(sessionId);

    if (session) {
      // Log session destruction
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

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    const sessions = await this.store.getAllUserSessions(userId);
    
    for (const session of sessions) {
      if (!excludeSessionId || session.sessionId !== excludeSessionId) {
        await this.destroySession(session.sessionId);
      }
    }

    // Log bulk session destruction
    await this.auditService.logSecurityEvent({
      type: 'LOGOUT',
      userId,
      severity: 'MEDIUM',
      description: `All user sessions destroyed`,
      metadata: { sessionCount: sessions.length, excludeSessionId }
    });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    return await this.store.getAllUserSessions(userId);
  }

  /**
   * Check if session is valid
   */
  isSessionValid(session: SessionInfo): boolean {
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - new Date(session.lastActivity).getTime();
    const sessionTimeout = ROLE_SESSION_TIMEOUTS[session.role] || AUTH_CONFIG.security.sessionTimeout;
    
    return (
      new Date(session.expiresAt) > now &&
      timeSinceLastActivity < sessionTimeout
    );
  }

  /**
   * Validate session security
   */
  async validateSessionSecurity(session: SessionInfo, currentIpAddress: string, currentUserAgent: string): Promise<{
    isValid: boolean;
    securityIssues: string[];
  }> {
    const securityIssues: string[] = [];

    // Check IP address consistency
    if (session.ipAddress !== currentIpAddress) {
      securityIssues.push('IP address mismatch');
      
      // Log security event
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

    // Check user agent consistency (basic check)
    if (session.userAgent !== currentUserAgent) {
      securityIssues.push('User agent mismatch');
      
      // Log security event
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

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    totalActiveSessions: number;
    sessionsByRole: Record<UserRole, number>;
    averageSessionDuration: number;
    expiredSessionsCleanedToday: number;
  }> {
    // This would be implemented based on your specific requirements
    // For now, return a mock structure
    return {
      totalActiveSessions: 0,
      sessionsByRole: {} as Record<UserRole, number>,
      averageSessionDuration: 0,
      expiredSessionsCleanedToday: 0
    };
  }

  /**
   * Force logout based on security policy
   */
  async forceLogout(userId: string, reason: string): Promise<void> {
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

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const cleanedCount = await this.store.cleanup();
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`);
        this.emit('sessionsCleanedUp', cleanedCount);
      }
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }

  /**
   * Shutdown session manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}