import { SessionManager, InMemorySessionStore, SessionStore } from '../../../src/services/session.service';
import { AuditService } from '../../../src/services/audit.service';
import { SessionInfo, User, UserRoles } from '../../../src/types/auth.types';

// Mock dependencies
jest.mock('../../../src/services/audit.service');

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-id'),
}));

describe('SessionService', () => {
  let sessionManager: SessionManager;
  let mockAuditService: jest.Mocked<AuditService>;
  let sessionStore: InMemorySessionStore;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRoles.PHYSICIAN,
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSessionInfo: SessionInfo = {
    userId: 'user-123',
    sessionId: 'test-session-id',
    role: UserRoles.PHYSICIAN,
    permissions: [],
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockAuditService = new AuditService() as jest.Mocked<AuditService>;
    mockAuditService.logSecurityEvent = jest.fn().mockResolvedValue(undefined);

    sessionStore = new InMemorySessionStore();
    sessionManager = new SessionManager(sessionStore);
    
    // Replace the audit service instance
    (sessionManager as any).auditService = mockAuditService;

    // Clear any existing intervals from previous tests
    jest.clearAllTimers();
  });

  afterEach(() => {
    sessionManager.shutdown();
    jest.clearAllTimers();
  });

  describe('InMemorySessionStore', () => {
    describe('Basic Operations', () => {
      it('should store and retrieve sessions', async () => {
        await sessionStore.set('session-1', mockSessionInfo);
        const retrieved = await sessionStore.get('session-1');
        
        expect(retrieved).toEqual(mockSessionInfo);
      });

      it('should return null for non-existent sessions', async () => {
        const retrieved = await sessionStore.get('non-existent');
        
        expect(retrieved).toBeNull();
      });

      it('should check session existence', async () => {
        await sessionStore.set('session-1', mockSessionInfo);
        
        expect(await sessionStore.exists('session-1')).toBe(true);
        expect(await sessionStore.exists('non-existent')).toBe(false);
      });

      it('should delete sessions', async () => {
        await sessionStore.set('session-1', mockSessionInfo);
        await sessionStore.delete('session-1');
        
        expect(await sessionStore.exists('session-1')).toBe(false);
        expect(await sessionStore.get('session-1')).toBeNull();
      });
    });

    describe('User Session Management', () => {
      it('should track sessions by user', async () => {
        const session1 = { ...mockSessionInfo, sessionId: 'session-1' };
        const session2 = { ...mockSessionInfo, sessionId: 'session-2' };
        
        await sessionStore.set('session-1', session1);
        await sessionStore.set('session-2', session2);
        
        const userSessions = await sessionStore.getAllUserSessions('user-123');
        
        expect(userSessions).toHaveLength(2);
        expect(userSessions.map(s => s.sessionId)).toContain('session-1');
        expect(userSessions.map(s => s.sessionId)).toContain('session-2');
      });

      it('should delete all user sessions', async () => {
        const session1 = { ...mockSessionInfo, sessionId: 'session-1' };
        const session2 = { ...mockSessionInfo, sessionId: 'session-2' };
        
        await sessionStore.set('session-1', session1);
        await sessionStore.set('session-2', session2);
        
        await sessionStore.deleteUserSessions('user-123');
        
        expect(await sessionStore.exists('session-1')).toBe(false);
        expect(await sessionStore.exists('session-2')).toBe(false);
        expect(await sessionStore.getAllUserSessions('user-123')).toHaveLength(0);
      });

      it('should clean up user index when deleting individual sessions', async () => {
        const session1 = { ...mockSessionInfo, sessionId: 'session-1' };
        
        await sessionStore.set('session-1', session1);
        await sessionStore.delete('session-1');
        
        const userSessions = await sessionStore.getAllUserSessions('user-123');
        expect(userSessions).toHaveLength(0);
      });
    });

    describe('Session Cleanup', () => {
      it('should clean up expired sessions', async () => {
        const expiredSession = {
          ...mockSessionInfo,
          sessionId: 'expired-session',
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        };
        const validSession = {
          ...mockSessionInfo,
          sessionId: 'valid-session',
          expiresAt: new Date(Date.now() + 60000), // 1 minute from now
        };
        
        await sessionStore.set('expired-session', expiredSession);
        await sessionStore.set('valid-session', validSession);
        
        const cleanedCount = await sessionStore.cleanup();
        
        expect(cleanedCount).toBe(1);
        expect(await sessionStore.exists('expired-session')).toBe(false);
        expect(await sessionStore.exists('valid-session')).toBe(true);
      });
    });
  });

  describe('SessionManager', () => {
    describe('Session Creation', () => {
      it('should create a new session with correct properties', async () => {
        const session = await sessionManager.createSession(
          mockUser,
          '192.168.1.1',
          'Mozilla/5.0'
        );

        expect(session).toEqual(
          expect.objectContaining({
            userId: mockUser.id,
            sessionId: 'test-session-id',
            role: mockUser.role,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          })
        );
        
        expect(session.expiresAt).toBeInstanceOf(Date);
        expect(session.lastActivity).toBeInstanceOf(Date);
      });

      it('should use role-specific session timeout', async () => {
        const physicianUser = { ...mockUser, role: UserRoles.PHYSICIAN };
        const patientUser = { ...mockUser, role: UserRoles.PATIENT };

        const physicianSession = await sessionManager.createSession(
          physicianUser,
          '192.168.1.1',
          'Mozilla/5.0'
        );
        
        const patientSession = await sessionManager.createSession(
          patientUser,
          '192.168.1.1',
          'Mozilla/5.0'
        );

        const physicianTimeout = physicianSession.expiresAt.getTime() - physicianSession.lastActivity.getTime();
        const patientTimeout = patientSession.expiresAt.getTime() - patientSession.lastActivity.getTime();

        // Physician should have 30 minutes, patient should have 60 minutes
        expect(physicianTimeout).toBe(30 * 60 * 1000);
        expect(patientTimeout).toBe(60 * 60 * 1000);
      });

      it('should log session creation', async () => {
        await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');

        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
          type: 'LOGIN_SUCCESS',
          userId: mockUser.id,
          severity: 'LOW',
          description: `Session created for user ${mockUser.username}`,
          metadata: {
            sessionId: 'test-session-id',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            role: mockUser.role,
          },
        });
      });

      it('should emit sessionCreated event', async () => {
        const eventSpy = jest.fn();
        sessionManager.on('sessionCreated', eventSpy);

        const session = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');

        expect(eventSpy).toHaveBeenCalledWith(session);
      });
    });

    describe('Session Retrieval', () => {
      it('should retrieve valid sessions', async () => {
        const createdSession = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const retrievedSession = await sessionManager.getSession(createdSession.sessionId);

        expect(retrievedSession).toEqual(createdSession);
      });

      it('should return null for non-existent sessions', async () => {
        const session = await sessionManager.getSession('non-existent');

        expect(session).toBeNull();
      });

      it('should automatically destroy expired sessions', async () => {
        const expiredSession = {
          ...mockSessionInfo,
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        };
        
        await sessionStore.set('expired-session', expiredSession);
        const retrievedSession = await sessionManager.getSession('expired-session');

        expect(retrievedSession).toBeNull();
        expect(await sessionStore.exists('expired-session')).toBe(false);
      });
    });

    describe('Session Activity Updates', () => {
      it('should update session activity and extend expiration', async () => {
        const createdSession = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const originalExpiration = createdSession.expiresAt;
        
        // Wait a bit to ensure time difference
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const updatedSession = await sessionManager.updateSessionActivity(createdSession.sessionId);

        expect(updatedSession).not.toBeNull();
        expect(updatedSession!.lastActivity.getTime()).toBeGreaterThan(createdSession.lastActivity.getTime());
        expect(updatedSession!.expiresAt.getTime()).toBeGreaterThan(originalExpiration.getTime());
      });

      it('should return null when updating non-existent session', async () => {
        const result = await sessionManager.updateSessionActivity('non-existent');

        expect(result).toBeNull();
      });

      it('should emit sessionUpdated event', async () => {
        const eventSpy = jest.fn();
        sessionManager.on('sessionUpdated', eventSpy);

        const createdSession = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const updatedSession = await sessionManager.updateSessionActivity(createdSession.sessionId);

        expect(eventSpy).toHaveBeenCalledWith(updatedSession);
      });
    });

    describe('Session Destruction', () => {
      it('should destroy individual sessions', async () => {
        const createdSession = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        
        await sessionManager.destroySession(createdSession.sessionId);

        expect(await sessionStore.exists(createdSession.sessionId)).toBe(false);
      });

      it('should log session destruction', async () => {
        const createdSession = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        
        // Clear previous audit calls
        mockAuditService.logSecurityEvent.mockClear();
        
        await sessionManager.destroySession(createdSession.sessionId);

        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
          type: 'LOGOUT',
          userId: mockUser.id,
          severity: 'LOW',
          description: 'Session destroyed for user',
          metadata: {
            sessionId: createdSession.sessionId,
            ipAddress: '192.168.1.1',
          },
        });
      });

      it('should emit sessionDestroyed event', async () => {
        const eventSpy = jest.fn();
        sessionManager.on('sessionDestroyed', eventSpy);

        const createdSession = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        await sessionManager.destroySession(createdSession.sessionId);

        expect(eventSpy).toHaveBeenCalledWith(createdSession);
      });

      it('should destroy all user sessions', async () => {
        const session1 = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const session2 = await sessionManager.createSession(mockUser, '192.168.1.2', 'Chrome');

        await sessionManager.destroyUserSessions(mockUser.id);

        expect(await sessionStore.exists(session1.sessionId)).toBe(false);
        expect(await sessionStore.exists(session2.sessionId)).toBe(false);
      });

      it('should destroy user sessions except excluded one', async () => {
        const session1 = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const session2 = await sessionManager.createSession(mockUser, '192.168.1.2', 'Chrome');

        await sessionManager.destroyUserSessions(mockUser.id, session1.sessionId);

        expect(await sessionStore.exists(session1.sessionId)).toBe(true);
        expect(await sessionStore.exists(session2.sessionId)).toBe(false);
      });
    });

    describe('Session Validation', () => {
      it('should validate active sessions', () => {
        const validSession = {
          ...mockSessionInfo,
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        };

        expect(sessionManager.isSessionValid(validSession)).toBe(true);
      });

      it('should invalidate expired sessions', () => {
        const expiredSession = {
          ...mockSessionInfo,
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        };

        expect(sessionManager.isSessionValid(expiredSession)).toBe(false);
      });

      it('should invalidate sessions with old activity', () => {
        const staleSession = {
          ...mockSessionInfo,
          lastActivity: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Still valid expiration
        };

        expect(sessionManager.isSessionValid(staleSession)).toBe(false);
      });
    });

    describe('Security Validation', () => {
      it('should pass security validation for consistent IP and user agent', async () => {
        const result = await sessionManager.validateSessionSecurity(
          mockSessionInfo,
          '192.168.1.1',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        );

        expect(result.isValid).toBe(true);
        expect(result.securityIssues).toHaveLength(0);
      });

      it('should fail security validation for IP mismatch', async () => {
        const result = await sessionManager.validateSessionSecurity(
          mockSessionInfo,
          '192.168.1.2', // Different IP
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        );

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('IP address mismatch');
        
        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
          type: 'UNAUTHORIZED_ACCESS',
          userId: mockSessionInfo.userId,
          severity: 'HIGH',
          description: `IP address mismatch for session ${mockSessionInfo.sessionId}`,
          metadata: {
            sessionId: mockSessionInfo.sessionId,
            originalIp: '192.168.1.1',
            currentIp: '192.168.1.2',
          },
        });
      });

      it('should fail security validation for user agent mismatch', async () => {
        const result = await sessionManager.validateSessionSecurity(
          mockSessionInfo,
          '192.168.1.1',
          'Chrome/91.0.4472.124' // Different user agent
        );

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('User agent mismatch');
        
        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
          type: 'UNAUTHORIZED_ACCESS',
          userId: mockSessionInfo.userId,
          severity: 'MEDIUM',
          description: `User agent mismatch for session ${mockSessionInfo.sessionId}`,
          metadata: {
            sessionId: mockSessionInfo.sessionId,
            originalUserAgent: mockSessionInfo.userAgent,
            currentUserAgent: 'Chrome/91.0.4472.124',
          },
        });
      });
    });

    describe('Force Logout', () => {
      it('should force logout and destroy all user sessions', async () => {
        const session1 = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const session2 = await sessionManager.createSession(mockUser, '192.168.1.2', 'Chrome');

        await sessionManager.forceLogout(mockUser.id, 'Security violation');

        expect(await sessionStore.exists(session1.sessionId)).toBe(false);
        expect(await sessionStore.exists(session2.sessionId)).toBe(false);
      });

      it('should log force logout event', async () => {
        await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        
        // Clear previous audit calls
        mockAuditService.logSecurityEvent.mockClear();

        await sessionManager.forceLogout(mockUser.id, 'Security violation');

        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
          type: 'LOGOUT',
          userId: mockUser.id,
          severity: 'HIGH',
          description: 'Forced logout: Security violation',
          metadata: {
            reason: 'Security violation',
            forced: true,
          },
        });
      });

      it('should emit forceLogout event', async () => {
        const eventSpy = jest.fn();
        sessionManager.on('forceLogout', eventSpy);

        await sessionManager.forceLogout(mockUser.id, 'Security violation');

        expect(eventSpy).toHaveBeenCalledWith({
          userId: mockUser.id,
          reason: 'Security violation',
        });
      });
    });

    describe('User Session Management', () => {
      it('should get all user sessions', async () => {
        const session1 = await sessionManager.createSession(mockUser, '192.168.1.1', 'Mozilla/5.0');
        const session2 = await sessionManager.createSession(mockUser, '192.168.1.2', 'Chrome');

        const userSessions = await sessionManager.getUserSessions(mockUser.id);

        expect(userSessions).toHaveLength(2);
        expect(userSessions.map(s => s.sessionId)).toContain(session1.sessionId);
        expect(userSessions.map(s => s.sessionId)).toContain(session2.sessionId);
      });
    });

    describe('Cleanup and Shutdown', () => {
      it('should clean up expired sessions periodically', (done) => {
        jest.useFakeTimers();
        
        const cleanupSpy = jest.spyOn(sessionStore, 'cleanup').mockResolvedValue(2);
        
        // Fast forward past the cleanup interval (5 minutes)
        jest.advanceTimersByTime(5 * 60 * 1000 + 1000);
        
        // Give the cleanup a chance to run
        setImmediate(() => {
          expect(cleanupSpy).toHaveBeenCalled();
          jest.useRealTimers();
          done();
        });
      });

      it('should shut down cleanly', () => {
        const removeListenersSpy = jest.spyOn(sessionManager, 'removeAllListeners');
        
        sessionManager.shutdown();
        
        expect(removeListenersSpy).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle storage errors gracefully', async () => {
        const mockError = new Error('Storage error');
        jest.spyOn(sessionStore, 'get').mockRejectedValueOnce(mockError);

        const session = await sessionManager.getSession('test-session');

        expect(session).toBeNull();
      });

      it('should handle cleanup errors gracefully', async () => {
        const mockError = new Error('Cleanup error');
        jest.spyOn(sessionStore, 'cleanup').mockRejectedValueOnce(mockError);
        
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        // Trigger cleanup manually
        await (sessionManager as any).cleanupExpiredSessions();

        expect(consoleSpy).toHaveBeenCalledWith('Error during session cleanup:', mockError);
        
        consoleSpy.mockRestore();
      });
    });
  });
});