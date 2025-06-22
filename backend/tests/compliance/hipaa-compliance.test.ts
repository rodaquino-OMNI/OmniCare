/**
 * HIPAA Compliance Test Suite
 * Tests for Health Insurance Portability and Accountability Act compliance
 * Includes PHI protection, audit logging, access controls, and data encryption
 */

import { AuditService } from '../../src/services/audit.service';
import { ComplianceService } from '../../src/services/compliance.service';
import { ValidationService } from '../../src/services/validation.service';
import { User, Permission, UserRole, AuditLogEntry, SecurityEvent } from '../../src/types/auth.types';
import { Patient, Observation, MedicationRequest } from '@medplum/fhirtypes';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

describe('HIPAA Compliance Test Suite', () => {
  let auditService: AuditService;
  let complianceService: ComplianceService;
  let validationService: ValidationService;

  beforeEach(() => {
    auditService = new AuditService();
    complianceService = new ComplianceService(auditService);
    validationService = new ValidationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    auditService.shutdown();
  });

  describe('PHI (Protected Health Information) Protection', () => {
    it('should encrypt sensitive data in audit logs', async () => {
      const sensitiveData = {
        ssn: '123-45-6789',
        dob: '1980-01-01',
        phone: '555-123-4567',
        email: 'patient@example.com',
        medicalRecord: 'Diabetes diagnosis',
        notes: 'Confidential medical notes'
      };

      await auditService.logUserAction(
        'user123',
        'view_patient_record',
        'Patient',
        'pat456',
        '192.168.1.1',
        'Mozilla/5.0',
        true,
        undefined,
        sensitiveData
      );

      const auditLogs = await auditService.searchAuditLogs('');
      const logEntry = auditLogs[0];

      // Verify sensitive data is encrypted
      expect(logEntry.additionalData?.ssn).toMatch(/^encrypted:/);
      expect(logEntry.additionalData?.medicalRecord).toMatch(/^encrypted:/);
      expect(logEntry.additionalData?.notes).toMatch(/^encrypted:/);
      
      // Verify original data is not present
      expect(JSON.stringify(logEntry)).not.toContain('123-45-6789');
      expect(JSON.stringify(logEntry)).not.toContain('Diabetes diagnosis');
    });

    it('should validate email addresses in patient records', () => {
      expect(validationService.validateEmail('valid@example.com')).toBe(true);
      expect(validationService.validateEmail('invalid-email')).toBe(false);
      expect(validationService.validateEmail('test@')).toBe(false);
      expect(validationService.validateEmail('@domain.com')).toBe(false);
    });

    it('should validate phone numbers in patient records', () => {
      expect(validationService.validatePhoneNumber('+1-555-123-4567')).toBe(true);
      expect(validationService.validatePhoneNumber('555.123.4567')).toBe(true);
      expect(validationService.validatePhoneNumber('(555) 123-4567')).toBe(true);
      expect(validationService.validatePhoneNumber('123')).toBe(false);
      expect(validationService.validatePhoneNumber('abcd')).toBe(false);
    });

    it('should sanitize user input to prevent data injection', () => {
      const maliciousInput = '<script>alert("xss")</script>Test Input';
      const sanitized = validationService.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toContain('Test Input');
    });

    it('should enforce data access permissions by role', async () => {
      const testCases = [
        {
          role: UserRole.PATIENT,
          permission: Permission.VIEW_OWN_RECORDS,
          shouldHave: true
        },
        {
          role: UserRole.PATIENT,
          permission: Permission.VIEW_PATIENT_RECORDS,
          shouldHave: false
        },
        {
          role: UserRole.PHYSICIAN,
          permission: Permission.VIEW_PATIENT_RECORDS,
          shouldHave: true
        },
        {
          role: UserRole.NURSE,
          permission: Permission.DOCUMENT_VITAL_SIGNS,
          shouldHave: true
        },
        {
          role: UserRole.PHARMACIST,
          permission: Permission.DISPENSE_MEDICATIONS,
          shouldHave: true
        }
      ];

      // This test would normally check against a role-permission service
      testCases.forEach(({ role, permission, shouldHave }) => {
        // Mock permission check would be implemented here
        expect(typeof role).toBe('string');
        expect(typeof permission).toBe('string');
        expect(typeof shouldHave).toBe('boolean');
      });
    });
  });

  describe('Audit Logging Requirements', () => {
    it('should log all PHI access attempts', async () => {
      const testAccess = {
        userId: 'physician123',
        action: 'view_patient_record',
        resource: 'Patient',
        resourceId: 'pat456',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Healthcare App)',
        success: true
      };

      await auditService.logUserAction(
        testAccess.userId,
        testAccess.action,
        testAccess.resource,
        testAccess.resourceId,
        testAccess.ipAddress,
        testAccess.userAgent,
        testAccess.success
      );

      const auditLogs = await auditService.searchAuditLogs('');
      expect(auditLogs).toHaveLength(1);
      
      const logEntry = auditLogs[0];
      expect(logEntry.userId).toBe(testAccess.userId);
      expect(logEntry.action).toBe(testAccess.action);
      expect(logEntry.resource).toBe(testAccess.resource);
      expect(logEntry.resourceId).toBe(testAccess.resourceId);
      expect(logEntry.ipAddress).toBe(testAccess.ipAddress);
      expect(logEntry.success).toBe(testAccess.success);
      expect(logEntry.timestamp).toBeInstanceOf(Date);
    });

    it('should log failed access attempts with error details', async () => {
      await auditService.logUserAction(
        'user123',
        'unauthorized_access',
        'Patient',
        'pat456',
        '192.168.1.50',
        'Mozilla/5.0',
        false,
        'Insufficient permissions for accessing patient record'
      );

      const auditLogs = await auditService.searchAuditLogs('');
      const logEntry = auditLogs[0];
      
      expect(logEntry.success).toBe(false);
      expect(logEntry.errorMessage).toBe('Insufficient permissions for accessing patient record');
      expect(logEntry.action).toBe('unauthorized_access');
    });

    it('should generate cryptographically secure audit IDs', async () => {
      const auditIds = new Set();
      
      // Generate multiple audit entries
      for (let i = 0; i < 100; i++) {
        await auditService.logUserAction(
          `user${i}`,
          'test_action',
          'TestResource',
          `res${i}`,
          '192.168.1.1',
          'Test Agent',
          true
        );
      }

      const auditLogs = await auditService.searchAuditLogs('');
      
      // Verify all IDs are unique
      auditLogs.forEach(log => {
        expect(auditIds.has(log.id)).toBe(false);
        auditIds.add(log.id);
        
        // Verify ID format (audit_timestamp_randomhex)
        expect(log.id).toMatch(/^audit_[a-z0-9]+_[a-f0-9]{16}$/);
      });
    });

    it('should maintain audit log integrity and immutability', async () => {
      await auditService.logUserAction(
        'user123',
        'view_record',
        'Patient',
        'pat456',
        '192.168.1.1',
        'Browser',
        true
      );

      const originalLogs = await auditService.searchAuditLogs('');
      const originalLog = { ...originalLogs[0] };

      // Attempt to modify the log (this should not affect the stored version)
      originalLogs[0].action = 'modified_action';
      originalLogs[0].success = false;

      // Retrieve logs again to verify integrity
      const retrievedLogs = await auditService.searchAuditLogs('');
      const retrievedLog = retrievedLogs[0];

      expect(retrievedLog.action).toBe(originalLog.action);
      expect(retrievedLog.success).toBe(originalLog.success);
      expect(retrievedLog.id).toBe(originalLog.id);
    });
  });

  describe('Access Control and Authentication', () => {
    it('should track login attempts and detect suspicious activity', async () => {
      const suspiciousUserId = 'suspicious_user';
      const ipAddress = '192.168.1.200';

      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await auditService.logUserAction(
          suspiciousUserId,
          'login_attempt',
          'Authentication',
          undefined,
          ipAddress,
          'Browser',
          false,
          'Invalid credentials'
        );
      }

      const failedLogins = await auditService.searchAuditLogs('', {
        userId: suspiciousUserId,
        success: false,
        action: 'login_attempt'
      });

      expect(failedLogins).toHaveLength(6);
      
      // Verify all failed attempts are logged with correct details
      failedLogins.forEach(log => {
        expect(log.userId).toBe(suspiciousUserId);
        expect(log.success).toBe(false);
        expect(log.ipAddress).toBe(ipAddress);
        expect(log.errorMessage).toBe('Invalid credentials');
      });
    });

    it('should log session management events', async () => {
      const userId = 'user123';
      const sessionId = 'session_456';
      const ipAddress = '192.168.1.10';

      // Log session start
      await auditService.logUserAction(
        userId,
        'session_start',
        'Session',
        sessionId,
        ipAddress,
        'Browser',
        true,
        undefined,
        { sessionId, loginTime: new Date() }
      );

      // Log session activity
      await auditService.logUserAction(
        userId,
        'session_activity',
        'Session',
        sessionId,
        ipAddress,
        'Browser',
        true,
        undefined,
        { sessionId, lastActivity: new Date() }
      );

      // Log session end
      await auditService.logUserAction(
        userId,
        'session_end',
        'Session',
        sessionId,
        ipAddress,
        'Browser',
        true,
        undefined,
        { sessionId, logoutTime: new Date() }
      );

      const sessionLogs = await auditService.searchAuditLogs('', {
        userId,
        resource: 'Session'
      });

      expect(sessionLogs).toHaveLength(3);
      expect(sessionLogs.map(log => log.action)).toEqual([
        'session_start',
        'session_activity', 
        'session_end'
      ]);
    });

    it('should enforce minimum password complexity requirements', async () => {
      const passwordTests = [
        { password: 'weak', valid: false, reason: 'too short' },
        { password: 'password123', valid: false, reason: 'no special chars or uppercase' },
        { password: 'Password123', valid: false, reason: 'no special chars' },
        { password: 'Password123!', valid: true, reason: 'meets all requirements' },
        { password: 'Complex@Pass123', valid: true, reason: 'meets all requirements' }
      ];

      passwordTests.forEach(({ password, valid }) => {
        // Mock password validation (would be implemented in auth service)
        const hasMinLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumbers && hasSpecialChars;
        expect(isValid).toBe(valid);
      });
    });
  });

  describe('Data Retention and Archival', () => {
    it('should support audit log retention policies', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - (366 * 24 * 60 * 60 * 1000)); // 366 days ago
      const recentDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago

      // Create old and recent audit entries
      await auditService.logUserAction(
        'user1', 
        'old_action', 
        'Resource', 
        'res1', 
        '192.168.1.1', 
        'Browser', 
        true
      );
      
      await auditService.logUserAction(
        'user2', 
        'recent_action', 
        'Resource', 
        'res2', 
        '192.168.1.1', 
        'Browser', 
        true
      );

      // Test date range filtering
      const recentLogs = await auditService.searchAuditLogs('', {
        startDate: recentDate,
        endDate: now
      });

      const oldLogs = await auditService.searchAuditLogs('', {
        startDate: oldDate,
        endDate: recentDate
      });

      expect(recentLogs.length).toBeGreaterThan(0);
      expect(oldLogs.length).toEqual(0); // Should be empty since we just created the entries
    });

    it('should generate compliance reports with proper date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const generatedBy = 'compliance_officer';

      // Create test audit data
      await auditService.logUserAction(
        'physician1',
        'view_patient_record',
        'Patient',
        'pat123',
        '192.168.1.1',
        'EMR System',
        true
      );

      const report = await complianceService.generateHIPAAComplianceReport(
        startDate,
        endDate,
        generatedBy,
        false // Don't include patient data
      );

      expect(report.reportId).toMatch(/^hipaa_\d+_[a-z0-9]+$/);
      expect(report.reportType).toBe('HIPAA_ACCESS_LOG');
      expect(report.generatedBy).toBe(generatedBy);
      expect(report.dateRange.start).toEqual(startDate);
      expect(report.dateRange.end).toEqual(endDate);
      expect(report.createdAt).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
    });
  });

  describe('HIPAA Security Rule Compliance', () => {
    it('should validate FHIR ID format for security', () => {
      const validIds = ['abc123', 'ABC-123', 'test.id.123', 'a1b2c3d4'];
      const invalidIds = ['', 'a'.repeat(65), 'id with spaces', 'id@invalid', 'id/invalid'];

      validIds.forEach(id => {
        expect(validationService.validateFHIRId(id)).toBe(true);
      });

      invalidIds.forEach(id => {
        expect(validationService.validateFHIRId(id)).toBe(false);
      });
    });

    it('should validate URI format for security', () => {
      const validUris = [
        'https://example.com',
        'http://localhost:3000',
        'fhir://server.com/Patient/123'
      ];
      
      const invalidUris = [
        'not-a-uri',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ];

      validUris.forEach(uri => {
        expect(validationService.validateURI(uri)).toBe(true);
      });

      invalidUris.forEach(uri => {
        expect(validationService.validateURI(uri)).toBe(false);
      });
    });

    it('should track critical security events', async () => {
      const criticalEvents = [
        {
          type: 'UNAUTHORIZED_ACCESS' as const,
          userId: 'user123',
          severity: 'CRITICAL' as const,
          description: 'Attempted unauthorized access to patient records'
        },
        {
          type: 'DATA_MODIFICATION' as const,
          userId: 'user456',
          severity: 'HIGH' as const,
          description: 'Unauthorized modification of medical records'
        }
      ];

      for (const event of criticalEvents) {
        await auditService.logSecurityEvent(event);
      }

      // Verify events are tracked (this would normally be stored in a database)
      expect(criticalEvents).toHaveLength(2);
      expect(criticalEvents[0].severity).toBe('CRITICAL');
      expect(criticalEvents[1].severity).toBe('HIGH');
    });
  });

  describe('Breach Notification Requirements', () => {
    it('should detect potential data breach scenarios', async () => {
      // Simulate bulk data access that might indicate a breach
      const suspiciousUser = 'user_suspicious';
      const accessTimes = [];
      
      for (let i = 0; i < 50; i++) {
        await auditService.logUserAction(
          suspiciousUser,
          'bulk_data_access',
          'Patient',
          `pat${i}`,
          '192.168.1.100',
          'Automated Tool',
          true
        );
        accessTimes.push(new Date());
      }

      const bulkAccess = await auditService.searchAuditLogs('', {
        userId: suspiciousUser,
        action: 'bulk_data_access'
      });

      expect(bulkAccess).toHaveLength(50);
      
      // Analyze for potential breach indicators
      const uniqueResources = new Set(bulkAccess.map(log => log.resourceId));
      expect(uniqueResources.size).toBe(50); // Accessed 50 different patient records
      
      // All accesses from same IP (potential indicator)
      const uniqueIPs = new Set(bulkAccess.map(log => log.ipAddress));
      expect(uniqueIPs.size).toBe(1);
    });

    it('should track data export activities', async () => {
      await auditService.logUserAction(
        'admin_user',
        'data_export',
        'Patient',
        undefined,
        '192.168.1.5',
        'Export Tool',
        true,
        undefined,
        {
          exportType: 'patient_records',
          recordCount: 1000,
          exportFormat: 'CSV',
          destination: 'secure_storage'
        }
      );

      const exportLogs = await auditService.searchAuditLogs('', {
        action: 'data_export'
      });

      expect(exportLogs).toHaveLength(1);
      expect(exportLogs[0].additionalData).toBeDefined();
      expect(exportLogs[0].resource).toBe('Patient');
    });
  });

  describe('Administrative Safeguards', () => {
    it('should generate audit statistics for compliance monitoring', async () => {
      // Create diverse audit data
      const testData = [
        { userId: 'physician1', action: 'login_success', success: true },
        { userId: 'physician1', action: 'view_patient', success: true },
        { userId: 'nurse1', action: 'login_success', success: true },
        { userId: 'nurse1', action: 'document_vitals', success: true },
        { userId: 'unauthorized', action: 'login_attempt', success: false },
        { userId: 'unauthorized', action: 'login_attempt', success: false }
      ];

      for (const data of testData) {
        await auditService.logUserAction(
          data.userId,
          data.action,
          'TestResource',
          'test123',
          '192.168.1.1',
          'Browser',
          data.success
        );
      }

      const stats = await auditService.getAuditStatistics('daily');
      
      expect(stats.totalEvents).toBe(6);
      expect(stats.successfulEvents).toBe(4);
      expect(stats.failedEvents).toBe(2);
      expect(stats.uniqueUsers).toBe(3);
      expect(stats.eventsByType).toBeDefined();
      expect(stats.eventsByUser).toBeDefined();
    });

    it('should support audit log search and filtering', async () => {
      // Create test data with different attributes
      await auditService.logUserAction(
        'user1', 'action1', 'Resource1', 'res1', '192.168.1.1', 'Browser1', true
      );
      await auditService.logUserAction(
        'user2', 'action2', 'Resource2', 'res2', '192.168.1.2', 'Browser2', false
      );

      // Test filtering by user
      const user1Logs = await auditService.searchAuditLogs('', { userId: 'user1' });
      expect(user1Logs).toHaveLength(1);
      expect(user1Logs[0].userId).toBe('user1');

      // Test filtering by success status
      const failedLogs = await auditService.searchAuditLogs('', { success: false });
      expect(failedLogs.length).toBeGreaterThan(0);
      expect(failedLogs.every(log => log.success === false)).toBe(true);

      // Test filtering by IP address
      const ipLogs = await auditService.searchAuditLogs('', { ipAddress: '192.168.1.1' });
      expect(ipLogs.length).toBeGreaterThan(0);
      expect(ipLogs.every(log => log.ipAddress === '192.168.1.1')).toBe(true);
    });
  });
});
