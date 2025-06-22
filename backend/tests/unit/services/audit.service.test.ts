import { AuditService } from '../../../src/services/audit.service';
import { AuditLogEntry, SecurityEvent, ComplianceReport } from '../../../src/types/auth.types';

// Mock crypto for deterministic testing
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mockedrandom123')
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockedhash')
  })
}));

// Mock console.log to avoid test output pollution
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('AuditService', () => {
  let auditService: AuditService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, AUDIT_ENCRYPTION_KEY: 'test-key-123' };
    auditService = new AuditService();
  });

  afterEach(() => {
    process.env = originalEnv;
    auditService.shutdown();
  });

  describe('logUserAction', () => {
    it('should log a successful user action', async () => {
      const eventSpy = jest.fn();
      auditService.on('auditEntry', eventSpy);

      await auditService.logUserAction(
        'user123',
        'read',
        'Patient',
        'pat123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'read',
          resource: 'Patient',
          resourceId: 'pat123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true,
          errorMessage: undefined
        })
      );
    });

    it('should log a failed user action with error message', async () => {
      const eventSpy = jest.fn();
      auditService.on('auditEntry', eventSpy);

      await auditService.logUserAction(
        'user123',
        'update',
        'Patient',
        'pat123',
        '192.168.1.1',
        'Mozilla/5.0',
        false,
        'Access denied'
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'update',
          resource: 'Patient',
          resourceId: 'pat123',
          success: false,
          errorMessage: 'Access denied'
        })
      );
    });

    it('should emit security event for security-relevant actions', async () => {
      const securityEventSpy = jest.fn();
      auditService.on('securityEvent', securityEventSpy);

      await auditService.logUserAction(
        'user123',
        'login',
        'User',
        'user123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(securityEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN_SUCCESS',
          userId: 'user123',
          severity: 'LOW',
          description: 'User action: login on User'
        })
      );
    });

    it('should handle additional data encryption', async () => {
      const additionalData = {
        patientSSN: '123-45-6789',
        medicalRecord: 'Sensitive info',
        diagnosis: 'Test diagnosis'
      };

      await auditService.logUserAction(
        'user123',
        'read',
        'Patient',
        'pat123',
        '192.168.1.1',
        'Mozilla/5.0',
        true,
        undefined,
        additionalData
      );

      // Check that sensitive fields are encrypted
      expect(console.log).toHaveBeenCalledWith(
        'Audit Entry:',
        expect.stringContaining('encrypted:')
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log a security event', async () => {
      const eventSpy = jest.fn();
      auditService.on('securityEvent', eventSpy);

      const securityEvent: SecurityEvent = {
        type: 'DATA_ACCESS',
        userId: 'user123',
        severity: 'MEDIUM',
        description: 'Accessed patient data',
        metadata: { resource: 'Patient', action: 'read' }
      };

      await auditService.logSecurityEvent(securityEvent);

      expect(eventSpy).toHaveBeenCalledWith(securityEvent);
    });

    it('should handle critical security events', async () => {
      const criticalEventSpy = jest.fn();
      auditService.on('criticalSecurityEvent', criticalEventSpy);

      const criticalEvent: SecurityEvent = {
        type: 'UNAUTHORIZED_ACCESS',
        userId: 'user123',
        severity: 'CRITICAL',
        description: 'Attempted unauthorized access',
        metadata: {}
      };

      await auditService.logSecurityEvent(criticalEvent);

      expect(criticalEventSpy).toHaveBeenCalledWith(criticalEvent);
    });
  });

  describe('generateHipaaComplianceReport', () => {
    beforeEach(async () => {
      // Set up some test audit entries
      await auditService.logUserAction(
        'user1',
        'read',
        'Patient',
        'pat1',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
      await auditService.logUserAction(
        'user2',
        'update',
        'Patient',
        'pat2',
        '192.168.1.2',
        'Mozilla/5.0',
        false,
        'Validation error'
      );
      await auditService.logUserAction(
        'user1',
        'login',
        'User',
        'user1',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
    });

    it('should generate HIPAA compliance report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      const generatedBy = 'admin123';

      const report = await auditService.generateHipaaComplianceReport(
        startDate,
        endDate,
        generatedBy
      );

      expect(report).toEqual(
        expect.objectContaining({
          reportType: 'HIPAA_ACCESS_LOG',
          generatedBy,
          dateRange: { start: startDate, end: endDate },
          summary: expect.objectContaining({
            totalAccesses: 3,
            uniqueUsers: 2,
            failedAttempts: 1,
            securityIncidents: 0
          })
        })
      );

      expect(report.data).toHaveLength(3);
      expect(report.reportId).toMatch(/^audit_/);
    });
  });

  describe('searchAuditLogs', () => {
    beforeEach(async () => {
      // Set up test data
      await auditService.logUserAction(
        'user1',
        'read',
        'Patient',
        'pat1',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
      await auditService.logUserAction(
        'user2',
        'update',
        'Observation',
        'obs1',
        '192.168.1.2',
        'Mozilla/5.0',
        false
      );
    });

    it('should search audit logs with filters', async () => {
      const results = await auditService.searchAuditLogs('', {
        userId: 'user1',
        success: true
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          userId: 'user1',
          success: true
        })
      );
    });

    it('should search audit logs with text query', async () => {
      const results = await auditService.searchAuditLogs('Observation');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          resource: 'Observation'
        })
      );
    });

    it('should apply pagination', async () => {
      const results = await auditService.searchAuditLogs('', {
        limit: 1,
        offset: 1
      });

      expect(results).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
      const endDate = new Date();

      const results = await auditService.searchAuditLogs('', {
        startDate,
        endDate
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(entry => {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(entry.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });
  });

  describe('getAuditStatistics', () => {
    beforeEach(async () => {
      // Set up test data
      await auditService.logUserAction(
        'user1',
        'read',
        'Patient',
        'pat1',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
      await auditService.logUserAction(
        'user1',
        'update',
        'Patient',
        'pat1',
        '192.168.1.1',
        'Mozilla/5.0',
        false
      );
      await auditService.logUserAction(
        'user2',
        'read',
        'Observation',
        'obs1',
        '192.168.1.2',
        'Mozilla/5.0',
        true
      );
    });

    it('should generate audit statistics for daily timeframe', async () => {
      const stats = await auditService.getAuditStatistics('daily');

      expect(stats).toEqual(
        expect.objectContaining({
          totalEvents: 3,
          successfulEvents: 2,
          failedEvents: 1,
          uniqueUsers: 2,
          eventsByType: expect.objectContaining({
            read: 2,
            update: 1
          }),
          eventsByUser: expect.objectContaining({
            user1: 2,
            user2: 1
          }),
          topResources: expect.arrayContaining([
            expect.objectContaining({ resource: 'Patient', count: 2 }),
            expect.objectContaining({ resource: 'Observation', count: 1 })
          ]),
          securityIncidents: 0
        })
      );
    });

    it('should generate statistics for different timeframes', async () => {
      const weeklyStats = await auditService.getAuditStatistics('weekly');
      const monthlyStats = await auditService.getAuditStatistics('monthly');

      expect(weeklyStats.totalEvents).toBe(3);
      expect(monthlyStats.totalEvents).toBe(3);
    });
  });

  describe('security event classification', () => {
    it('should classify login actions correctly', async () => {
      const securityEventSpy = jest.fn();
      auditService.on('securityEvent', securityEventSpy);

      await auditService.logUserAction(
        'user123',
        'login',
        'User',
        'user123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(securityEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN_SUCCESS',
          severity: 'LOW'
        })
      );
    });

    it('should classify failed login as high severity', async () => {
      const securityEventSpy = jest.fn();
      auditService.on('securityEvent', securityEventSpy);

      await auditService.logUserAction(
        'user123',
        'login',
        'User',
        'user123',
        '192.168.1.1',
        'Mozilla/5.0',
        false,
        'Invalid credentials'
      );

      expect(securityEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN_SUCCESS',
          severity: 'HIGH'
        })
      );
    });

    it('should classify password changes correctly', async () => {
      const securityEventSpy = jest.fn();
      auditService.on('securityEvent', securityEventSpy);

      await auditService.logUserAction(
        'user123',
        'password_change',
        'User',
        'user123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(securityEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PASSWORD_CHANGE',
          severity: 'LOW'
        })
      );
    });

    it('should classify system configuration as medium severity', async () => {
      const securityEventSpy = jest.fn();
      auditService.on('securityEvent', securityEventSpy);

      await auditService.logUserAction(
        'user123',
        'system_configuration',
        'Config',
        'config1',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(securityEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DATA_ACCESS',
          severity: 'MEDIUM'
        })
      );
    });
  });

  describe('data encryption', () => {
    it('should identify sensitive fields correctly', () => {
      const sensitiveData = {
        password: 'secret123',
        ssn: '123-45-6789',
        email: 'test@example.com',
        medicalRecord: 'sensitive info',
        normalField: 'not sensitive'
      };

      // Test through logUserAction which calls the private method
      auditService.logUserAction(
        'user123',
        'read',
        'Patient',
        'pat123',
        '192.168.1.1',
        'Mozilla/5.0',
        true,
        undefined,
        sensitiveData
      );

      // Verify encrypted output in console.log
      expect(console.log).toHaveBeenCalledWith(
        'Audit Entry:',
        expect.stringContaining('encrypted:')
      );
    });
  });

  describe('audit ID generation', () => {
    it('should generate unique audit IDs', async () => {
      const ids = new Set();
      
      for (let i = 0; i < 10; i++) {
        await auditService.logUserAction(
          'user123',
          'read',
          'Patient',
          'pat123',
          '192.168.1.1',
          'Mozilla/5.0',
          true
        );
      }

      // All IDs should be unique
      expect(ids.size).toBe(10);
    });

    it('should generate audit IDs with correct format', async () => {
      const eventSpy = jest.fn();
      auditService.on('auditEntry', eventSpy);

      await auditService.logUserAction(
        'user123',
        'read',
        'Patient',
        'pat123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      const auditEntry = eventSpy.mock.calls[0][0];
      expect(auditEntry.id).toMatch(/^audit_[a-z0-9]+_[a-f0-9]+$/);
    });
  });

  describe('event emission', () => {
    it('should emit auditEntry events', (done) => {
      auditService.on('auditEntry', (entry: AuditLogEntry) => {
        expect(entry).toBeDefined();
        expect(entry.userId).toBe('user123');
        done();
      });

      auditService.logUserAction(
        'user123',
        'read',
        'Patient',
        'pat123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
    });

    it('should emit securityEvent events', (done) => {
      auditService.on('securityEvent', (event: SecurityEvent) => {
        expect(event).toBeDefined();
        expect(event.userId).toBe('user123');
        done();
      });

      auditService.logUserAction(
        'user123',
        'login',
        'User',
        'user123',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
    });

    it('should emit criticalSecurityEvent for critical events', (done) => {
      auditService.on('criticalSecurityEvent', (event: SecurityEvent) => {
        expect(event).toBeDefined();
        expect(event.severity).toBe('CRITICAL');
        done();
      });

      const criticalEvent: SecurityEvent = {
        type: 'UNAUTHORIZED_ACCESS',
        userId: 'user123',
        severity: 'CRITICAL',
        description: 'Critical security event',
        metadata: {}
      };

      auditService.logSecurityEvent(criticalEvent);
    });
  });

  describe('error handling', () => {
    it('should handle invalid dates gracefully', async () => {
      const invalidStartDate = new Date('invalid');
      const endDate = new Date();
      
      expect(() => 
        auditService.generateHipaaComplianceReport(
          invalidStartDate,
          endDate,
          'admin'
        )
      ).not.toThrow();
    });

    it('should handle empty search results', async () => {
      const results = await auditService.searchAuditLogs('nonexistent');
      expect(results).toEqual([]);
    });

    it('should handle statistics with no data', async () => {
      const freshService = new AuditService();
      const stats = await freshService.getAuditStatistics();
      
      expect(stats.totalEvents).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.eventsByType).toEqual({});
      
      freshService.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should clean up event listeners on shutdown', () => {
      const eventSpy = jest.fn();
      auditService.on('auditEntry', eventSpy);
      
      expect(auditService.listenerCount('auditEntry')).toBe(1);
      
      auditService.shutdown();
      
      expect(auditService.listenerCount('auditEntry')).toBe(0);
    });
  });
});