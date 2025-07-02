/**
 * OmniCare EMR Backend - Cached Authentication Service
 * Enhances JWT authentication with Redis caching for improved performance
 */

import { JWTAuthService, TokenPayload } from '../auth/jwt.service';
import { User, UserRole, Permission } from '../types/auth.types';
import logger from '../utils/logger';

import { redisCacheService } from './redis-cache.service';

export interface CachedUserSession {
  userId: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionMetrics {
  totalActiveSessions: number;
  sessionsByRole: Record<string, number>;
  averageSessionDuration: number;
  recentLogins: number;
}

export class CachedAuthService extends JWTAuthService {
  private readonly sessionTtl = 15 * 60; // 15 minutes in seconds
  private readonly permissionCacheTtl = 60 * 60; // 1 hour in seconds
  private readonly blacklistTtl = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Verify access token with caching
   */
  async verifyAccessTokenCached(token: string): Promise<TokenPayload | null> {
    try {
      // Check token blacklist first
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        logger.warn('Attempted use of blacklisted token');
        return null;
      }

      // Check cache first
      const cacheKey = this.generateTokenCacheKey(token);
      const cachedPayload = await redisCacheService.get<TokenPayload>(cacheKey);
      
      if (cachedPayload) {
        logger.debug('Token payload served from cache');
        return cachedPayload;
      }

      // Verify token normally
      const payload = this.verifyAccessToken(token);
      
      // Cache the payload (with shorter TTL than token expiry)
      const cacheTtl = Math.min(this.sessionTtl, this.getRemainingTokenTime(payload));
      await redisCacheService.set(cacheKey, payload, { ttl: cacheTtl });
      
      return payload;
    } catch (error) {
      logger.debug('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Create user session with caching
   */
  async createUserSession(
    user: User, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<{ tokens: any; session: CachedUserSession }> {
    const tokens = this.generateTokens(user);
    const permissions = this.getRolePermissions(user.role);
    
    const session: CachedUserSession = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions,
      sessionId: this.extractSessionIdFromToken(tokens.accessToken),
      lastActivity: Date.now(),
      ipAddress,
      userAgent,
    };

    // Cache the session
    const sessionKey = this.generateSessionKey(session.sessionId);
    await redisCacheService.set(sessionKey, session, { ttl: this.sessionTtl });

    // Cache user permissions separately for faster lookup
    const permissionsKey = this.generatePermissionsKey(user.id);
    await redisCacheService.set(permissionsKey, permissions, { ttl: this.permissionCacheTtl });

    // Track session metrics
    await this.trackSessionCreation(user.role);

    logger.info('User session created', {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: session.sessionId,
      ipAddress,
    });

    return { tokens, session };
  }

  /**
   * Get user session from cache
   */
  async getUserSession(sessionId: string): Promise<CachedUserSession | null> {
    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const session = await redisCacheService.get<CachedUserSession>(sessionKey);
      
      if (session) {
        // Update last activity
        session.lastActivity = Date.now();
        await redisCacheService.set(sessionKey, session, { ttl: this.sessionTtl });
      }
      
      return session;
    } catch (error) {
      logger.error('Failed to get user session:', error);
      return null;
    }
  }

  /**
   * Invalidate user session
   */
  async invalidateUserSession(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const session = await redisCacheService.get<CachedUserSession>(sessionKey);
      
      if (session) {
        // Remove session
        await redisCacheService.del(sessionKey);
        
        // Track session termination
        await this.trackSessionTermination(session.userId, session.role);
        
        logger.info('User session invalidated', {
          userId: session.userId,
          sessionId: session.sessionId,
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to invalidate user session:', error);
      return false;
    }
  }

  /**
   * Invalidate all user sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    try {
      const pattern = `session:user:${userId}:*`;
      const sessionKeys = await redisCacheService.keys(pattern);
      
      let invalidated = 0;
      for (const key of sessionKeys) {
        const success = await redisCacheService.del(key);
        if (success) {
          invalidated++;
        }
      }

      // Clear user permissions cache
      const permissionsKey = this.generatePermissionsKey(userId);
      await redisCacheService.del(permissionsKey);

      logger.info('All user sessions invalidated', { userId, count: invalidated });
      return invalidated;
    } catch (error) {
      logger.error('Failed to invalidate all user sessions:', error);
      return 0;
    }
  }

  /**
   * Get user permissions from cache
   */
  async getUserPermissionsCached(userId: string, role: UserRole): Promise<Permission[]> {
    try {
      const permissionsKey = this.generatePermissionsKey(userId);
      const cachedPermissions = await redisCacheService.get<Permission[]>(permissionsKey);
      
      if (cachedPermissions) {
        logger.debug('User permissions served from cache', { userId });
        return cachedPermissions;
      }

      // Get permissions from role
      const permissions = this.getRolePermissions(role);
      
      // Cache permissions
      await redisCacheService.set(permissionsKey, permissions, { ttl: this.permissionCacheTtl });
      
      return permissions;
    } catch (error) {
      logger.error('Failed to get user permissions:', error);
      return this.getRolePermissions(role);
    }
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token: string, reason = 'Manual blacklist'): Promise<boolean> {
    try {
      const payload = this.verifyAccessToken(token);
      const blacklistKey = this.generateBlacklistKey(token);
      const remainingTime = this.getRemainingTokenTime(payload);
      
      await redisCacheService.set(
        blacklistKey, 
        { reason, timestamp: Date.now(), userId: payload.userId }, 
        { ttl: Math.max(remainingTime, this.blacklistTtl) }
      );

      // Remove from token cache
      const tokenCacheKey = this.generateTokenCacheKey(token);
      await redisCacheService.del(tokenCacheKey);

      logger.warn('Token blacklisted', { userId: payload.userId, reason });
      return true;
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistKey = this.generateBlacklistKey(token);
      const blacklistEntry = await redisCacheService.get(blacklistKey);
      return blacklistEntry !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveUserSessions(userId: string): Promise<CachedUserSession[]> {
    try {
      const pattern = `session:user:${userId}:*`;
      const sessionKeys = await redisCacheService.keys(pattern);
      
      const sessions: CachedUserSession[] = [];
      for (const key of sessionKeys) {
        const session = await redisCacheService.get<CachedUserSession>(key);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (error) {
      logger.error('Failed to get active user sessions:', error);
      return [];
    }
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(): Promise<SessionMetrics> {
    try {
      const sessionKeys = await redisCacheService.keys('session:*');
      const sessions: CachedUserSession[] = [];
      
      for (const key of sessionKeys) {
        const session = await redisCacheService.get<CachedUserSession>(key);
        if (session) {
          sessions.push(session);
        }
      }

      const sessionsByRole: Record<string, number> = {};
      let totalSessionDuration = 0;
      const now = Date.now();
      const recentLoginThreshold = now - (60 * 60 * 1000); // 1 hour
      let recentLogins = 0;

      for (const session of sessions) {
        // Count by role
        sessionsByRole[session.role] = (sessionsByRole[session.role] || 0) + 1;
        
        // Calculate session duration
        const sessionDuration = now - session.lastActivity;
        totalSessionDuration += sessionDuration;
        
        // Count recent logins
        if (session.lastActivity > recentLoginThreshold) {
          recentLogins++;
        }
      }

      return {
        totalActiveSessions: sessions.length,
        sessionsByRole,
        averageSessionDuration: sessions.length > 0 ? totalSessionDuration / sessions.length : 0,
        recentLogins,
      };
    } catch (error) {
      logger.error('Failed to get session metrics:', error);
      return {
        totalActiveSessions: 0,
        sessionsByRole: {},
        averageSessionDuration: 0,
        recentLogins: 0,
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const sessionKeys = await redisCacheService.keys('session:*');
      let cleaned = 0;

      for (const key of sessionKeys) {
        const session = await redisCacheService.get<CachedUserSession>(key);
        if (!session) {
          // Key exists but no data (expired)
          cleaned++;
        } else {
          // Check if session is too old
          const sessionAge = Date.now() - session.lastActivity;
          if (sessionAge > this.sessionTtl * 1000 * 2) { // Double the TTL threshold
            await redisCacheService.del(key);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        logger.info('Cleaned up expired sessions', { count: cleaned });
      }

      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  // Private helper methods

  private generateTokenCacheKey(token: string): string {
    const tokenHash = this.hashToken(token);
    return `auth:token:${tokenHash}`;
  }

  private generateSessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private generatePermissionsKey(userId: string): string {
    return `auth:permissions:${userId}`;
  }

  private generateBlacklistKey(token: string): string {
    const tokenHash = this.hashToken(token);
    return `auth:blacklist:${tokenHash}`;
  }

  private hashToken(token: string): string {
    // Use first and last parts of token for cache key (avoid storing full token)
    return token.substring(0, 8) + token.substring(token.length - 8);
  }

  private extractSessionIdFromToken(token: string): string {
    try {
      const payload = this.verifyAccessToken(token);
      return payload.sessionId;
    } catch {
      return 'unknown';
    }
  }

  private getRemainingTokenTime(payload: TokenPayload): number {
    if (!payload.exp) {
      return this.sessionTtl;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = payload.exp - now;
    return Math.max(0, remaining);
  }

  private async trackSessionCreation(role: UserRole): Promise<void> {
    try {
      const metricsKey = 'auth:metrics:sessions:created';
      const dailyKey = `auth:metrics:daily:${new Date().toISOString().split('T')[0]}`;
      
      await Promise.all([
        redisCacheService.incr(metricsKey),
        redisCacheService.incr(`${dailyKey}:total`),
        redisCacheService.incr(`${dailyKey}:role:${role}`),
      ]);
    } catch (error) {
      logger.error('Failed to track session creation:', error);
    }
  }

  private async trackSessionTermination(userId: string, role: UserRole): Promise<void> {
    try {
      const metricsKey = 'auth:metrics:sessions:terminated';
      const dailyKey = `auth:metrics:daily:${new Date().toISOString().split('T')[0]}`;
      
      await Promise.all([
        redisCacheService.incr(metricsKey),
        redisCacheService.incr(`${dailyKey}:terminated`),
        redisCacheService.incr(`${dailyKey}:terminated:role:${role}`),
      ]);
    } catch (error) {
      logger.error('Failed to track session termination:', error);
    }
  }
}

// Export singleton instance
export const cachedAuthService = new CachedAuthService();