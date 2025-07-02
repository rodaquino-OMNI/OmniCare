/**
 * OmniCare EMR Backend - Redis Session Store
 * High-performance session management with Redis
 */

import { redisService } from './redis.service';
import { SessionStore } from './session.service';

import { SessionInfo } from '@/types/auth.types';
import logger from '@/utils/logger';

const SESSION_NAMESPACE = 'session';
const USER_SESSION_NAMESPACE = 'user_sessions';
const SESSION_TTL = 3600; // 1 hour default

export class RedisSessionStore implements SessionStore {
  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<SessionInfo | null> {
    try {
      const session = await redisService.get<SessionInfo>(sessionId, {
        namespace: SESSION_NAMESPACE
      });
      
      if (session) {
        // Check if session is expired
        const now = new Date();
        if (new Date(session.expiresAt) < now) {
          await this.delete(sessionId);
          return null;
        }
      }
      
      return session;
    } catch (error) {
      logger.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Set session with TTL
   */
  async set(sessionId: string, session: SessionInfo, ttl?: number): Promise<void> {
    try {
      const sessionTTL = ttl || SESSION_TTL;
      
      // Store session data
      await redisService.set(sessionId, session, {
        namespace: SESSION_NAMESPACE,
        ttl: sessionTTL
      });
      
      // Maintain user session index for multi-session management
      await this.addToUserIndex(session.userId, sessionId, sessionTTL);
      
      logger.debug(`Session stored: ${sessionId} for user: ${session.userId}`);
    } catch (error) {
      logger.error(`Failed to set session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<void> {
    try {
      // Get session to find user ID
      const session = await redisService.get<SessionInfo>(sessionId, {
        namespace: SESSION_NAMESPACE
      });
      
      // Delete session data
      await redisService.del(sessionId, {
        namespace: SESSION_NAMESPACE
      });
      
      // Remove from user index
      if (session) {
        await this.removeFromUserIndex(session.userId, sessionId);
      }
      
      logger.debug(`Session deleted: ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    try {
      return await redisService.exists(sessionId, {
        namespace: SESSION_NAMESPACE
      });
    } catch (error) {
      logger.error(`Failed to check session existence ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getAllUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      // Get session IDs from user index
      const sessionIds = await this.getUserSessionIds(userId);
      
      if (sessionIds.length === 0) {
        return [];
      }
      
      // Get all session data
      const sessions = await redisService.mget<SessionInfo>(sessionIds, {
        namespace: SESSION_NAMESPACE
      });
      
      // Filter out null sessions and expired ones
      const validSessions: SessionInfo[] = [];
      const now = new Date();
      
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        if (session && new Date(session.expiresAt) > now) {
          validSessions.push(session);
        } else if (session && new Date(session.expiresAt) <= now) {
          // Clean up expired session
          await this.delete(sessionIds[i]);
        }
      }
      
      return validSessions;
    } catch (error) {
      logger.error(`Failed to get user sessions for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.getUserSessionIds(userId);
      
      if (sessionIds.length === 0) {
        return;
      }
      
      // Delete all session data
      const deletePromises = sessionIds.map(sessionId => 
        redisService.del(sessionId, { namespace: SESSION_NAMESPACE })
      );
      
      await Promise.all(deletePromises);
      
      // Clear user session index
      await redisService.del(userId, { namespace: USER_SESSION_NAMESPACE });
      
      logger.info(`Deleted ${sessionIds.length} sessions for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete user sessions for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(): Promise<number> {
    try {
      const cleanedCount = 0;
      
      // Use Redis SCAN to iterate through session keys
      const pattern = `${SESSION_NAMESPACE}:*`;
      const expiredSessions: string[] = [];
      
      // Get Redis client through the service
      const redisInfo = await redisService.getInfo();
      if (!redisInfo) {
        logger.warn('Cannot perform cleanup - Redis not available');
        return 0;
      }
      
      // Note: In production, you might want to implement a more sophisticated 
      // cleanup strategy using Redis SCAN with MATCH and checking TTL
      // For now, we rely on Redis built-in expiration
      
      logger.debug(`Cleanup completed, expired sessions handled by Redis TTL`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    cacheStats: any;
  }> {
    try {
      const cacheStats = redisService.getStats();
      
      // This is a simplified implementation
      // In production, you might want to maintain counters
      return {
        totalSessions: 0, // Would need to be tracked separately
        activeSessions: 0, // Would need to be tracked separately
        cacheStats
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        cacheStats: redisService.getStats()
      };
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string, ttl: number): Promise<void> {
    try {
      await redisService.expire(sessionId, ttl, {
        namespace: SESSION_NAMESPACE
      });
      
      logger.debug(`Extended session TTL: ${sessionId} for ${ttl} seconds`);
    } catch (error) {
      logger.error(`Failed to extend session TTL ${sessionId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Add session ID to user index
   */
  private async addToUserIndex(userId: string, sessionId: string, ttl: number): Promise<void> {
    try {
      // Get existing session IDs for user
      const existingIds = await this.getUserSessionIds(userId);
      
      // Add new session ID
      const updatedIds = [...new Set([...existingIds, sessionId])];
      
      // Store updated list with TTL
      await redisService.set(userId, updatedIds, {
        namespace: USER_SESSION_NAMESPACE,
        ttl: ttl + 300 // Extra 5 minutes to ensure cleanup
      });
    } catch (error) {
      logger.error(`Failed to add session to user index: ${userId}:${sessionId}`, error);
    }
  }

  /**
   * Remove session ID from user index
   */
  private async removeFromUserIndex(userId: string, sessionId: string): Promise<void> {
    try {
      const existingIds = await this.getUserSessionIds(userId);
      const updatedIds = existingIds.filter(id => id !== sessionId);
      
      if (updatedIds.length === 0) {
        // No more sessions for user
        await redisService.del(userId, { namespace: USER_SESSION_NAMESPACE });
      } else {
        // Update with remaining sessions
        await redisService.set(userId, updatedIds, {
          namespace: USER_SESSION_NAMESPACE,
          ttl: SESSION_TTL + 300
        });
      }
    } catch (error) {
      logger.error(`Failed to remove session from user index: ${userId}:${sessionId}`, error);
    }
  }

  /**
   * Get session IDs for a user
   */
  private async getUserSessionIds(userId: string): Promise<string[]> {
    try {
      const sessionIds = await redisService.get<string[]>(userId, {
        namespace: USER_SESSION_NAMESPACE
      });
      
      return sessionIds || [];
    } catch (error) {
      logger.error(`Failed to get user session IDs for ${userId}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const redisSessionStore = new RedisSessionStore();
