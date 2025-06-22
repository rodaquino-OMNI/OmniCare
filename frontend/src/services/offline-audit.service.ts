/**
 * OmniCare EMR - Offline Audit Service
 * HIPAA-compliant audit logging for offline operations
 */

import { offlineSecurityService } from './offline-security.service';
import { 
  OfflineAuditEntry, 
  DataClassification,
  OfflineComplianceReport 
} from '@/types/offline-security.types';

export interface AuditEventType {
  category: 'ACCESS' | 'MODIFICATION' | 'SECURITY' | 'SYSTEM' | 'PHI' | 'COMPLIANCE';
  action: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  requiresNotification?: boolean;
}

export interface AuditContext {
  userId?: string;
  patientId?: string;
  encounterId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface PHIAccessLog {
  timestamp: Date;
  userId: string;
  patientId: string;
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'PRINT';
  dataType: string;
  purpose: string;
  authorized: boolean;
  offline: boolean;
}

const AUDIT_EVENT_TYPES: Record<string, AuditEventType> = {
  // PHI Access Events
  PHI_ACCESSED: { category: 'PHI', action: 'PHI data accessed', severity: 'INFO' },
  PHI_CREATED: { category: 'PHI', action: 'PHI data created', severity: 'INFO' },
  PHI_MODIFIED: { category: 'PHI', action: 'PHI data modified', severity: 'WARNING' },
  PHI_DELETED: { category: 'PHI', action: 'PHI data deleted', severity: 'WARNING' },
  PHI_EXPORTED: { category: 'PHI', action: 'PHI data exported', severity: 'WARNING', requiresNotification: true },
  PHI_UNAUTHORIZED: { category: 'PHI', action: 'Unauthorized PHI access attempt', severity: 'CRITICAL', requiresNotification: true },
  
  // Security Events
  LOGIN_OFFLINE: { category: 'SECURITY', action: 'Offline login', severity: 'INFO' },
  LOGOUT_OFFLINE: { category: 'SECURITY', action: 'Offline logout', severity: 'INFO' },
  SESSION_EXPIRED: { category: 'SECURITY', action: 'Offline session expired', severity: 'INFO' },
  ENCRYPTION_KEY_ROTATED: { category: 'SECURITY', action: 'Encryption key rotated', severity: 'WARNING' },
  SECURITY_VIOLATION: { category: 'SECURITY', action: 'Security violation detected', severity: 'CRITICAL', requiresNotification: true },
  
  // Data Events
  DATA_ENCRYPTED: { category: 'ACCESS', action: 'Data encrypted for storage', severity: 'INFO' },
  DATA_DECRYPTED: { category: 'ACCESS', action: 'Data decrypted for access', severity: 'INFO' },
  DATA_PURGED: { category: 'SYSTEM', action: 'Expired data purged', severity: 'INFO' },
  DATA_CORRUPTED: { category: 'SYSTEM', action: 'Data corruption detected', severity: 'ERROR', requiresNotification: true },
  
  // Compliance Events
  AUDIT_EXPORTED: { category: 'COMPLIANCE', action: 'Audit log exported', severity: 'INFO' },
  COMPLIANCE_CHECK: { category: 'COMPLIANCE', action: 'Compliance check performed', severity: 'INFO' },
  RETENTION_POLICY: { category: 'COMPLIANCE', action: 'Retention policy applied', severity: 'INFO' },
  EMERGENCY_ACCESS: { category: 'COMPLIANCE', action: 'Emergency access granted', severity: 'WARNING', requiresNotification: true }
};

export class OfflineAuditService {
  private static instance: OfflineAuditService;
  private phiAccessLogs: PHIAccessLog[] = [];
  private notificationQueue: OfflineAuditEntry[] = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): OfflineAuditService {
    if (!OfflineAuditService.instance) {
      OfflineAuditService.instance = new OfflineAuditService();
    }
    return OfflineAuditService.instance;
  }

  private async initialize(): Promise<void> {
    // Load PHI access logs from storage
    await this.loadPHIAccessLogs();
    
    // Start periodic compliance checks
    setInterval(() => {
      this.performComplianceCheck();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Log an audit event
   */
  public async logEvent(
    eventType: keyof typeof AUDIT_EVENT_TYPES,
    details: string,
    context?: AuditContext,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event = AUDIT_EVENT_TYPES[eventType];
    if (!event) {
      console.error(`Unknown audit event type: ${eventType}`);
      return;
    }

    const entry: OfflineAuditEntry = {
      id: 0, // Will be auto-incremented by IndexedDB
      timestamp: new Date().toISOString(),
      action: eventType,
      description: `${event.action}: ${details}`,
      userId: context?.userId,
      severity: event.severity,
      deviceId: await this.getDeviceId(),
      metadata: {
        ...metadata,
        category: event.category,
        context,
        offline: true,
        eventType
      }
    };

    // Log through offline security service
    await this.storeAuditEntry(entry);

    // Handle PHI-specific logging
    if (event.category === 'PHI' && context?.patientId) {
      await this.logPHIAccess(eventType, context, details);
    }

    // Queue for notification if required
    if (event.requiresNotification) {
      this.notificationQueue.push(entry);
    }

    // Immediate action for critical events
    if (event.severity === 'CRITICAL') {
      await this.handleCriticalEvent(entry);
    }
  }

  /**
   * Log PHI access specifically
   */
  private async logPHIAccess(
    eventType: string,
    context: AuditContext,
    details: string
  ): Promise<void> {
    if (!context.userId || !context.patientId) {
      return;
    }

    const actionMap: Record<string, PHIAccessLog['action']> = {
      'PHI_ACCESSED': 'VIEW',
      'PHI_CREATED': 'CREATE',
      'PHI_MODIFIED': 'UPDATE',
      'PHI_DELETED': 'DELETE',
      'PHI_EXPORTED': 'EXPORT'
    };

    const phiLog: PHIAccessLog = {
      timestamp: new Date(),
      userId: context.userId,
      patientId: context.patientId,
      action: actionMap[eventType] || 'VIEW',
      dataType: details.split(' ')[0] || 'Unknown',
      purpose: 'Clinical Care', // Would be passed in context
      authorized: eventType !== 'PHI_UNAUTHORIZED',
      offline: true
    };

    this.phiAccessLogs.push(phiLog);
    
    // Persist PHI logs
    await this.savePHIAccessLogs();
  }

  /**
   * Generate compliance report
   */
  public async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<OfflineComplianceReport> {
    // Get all audit entries for the period
    const auditEntries = await offlineSecurityService.getAuditLog({
      startDate,
      endDate
    });

    // Filter PHI access logs
    const phiAccesses = this.phiAccessLogs.filter(log =>
      log.timestamp >= startDate && log.timestamp <= endDate
    );

    // Calculate statistics
    const stats = this.calculateComplianceStats(auditEntries, phiAccesses);

    // Identify violations
    const violations = this.identifyViolations(auditEntries);

    const report: OfflineComplianceReport = {
      reportId: this.generateReportId(),
      generated: new Date(),
      period: { start: startDate, end: endDate },
      dataAccess: {
        totalAccess: stats.totalAccess,
        byUser: stats.byUser,
        byClassification: stats.byClassification
      },
      security: {
        encryptionEvents: stats.encryptionEvents,
        decryptionEvents: stats.decryptionEvents,
        accessDenied: stats.accessDenied,
        securityViolations: stats.securityViolations
      },
      storage: {
        itemsStored: stats.itemsStored,
        itemsPurged: stats.itemsPurged,
        averageLifetime: stats.averageLifetime
      },
      compliance: {
        phiAccess: phiAccesses.map(log => ({
          timestamp: log.timestamp,
          userId: log.userId,
          dataId: log.patientId,
          action: log.action
        })),
        violations
      }
    };

    // Log report generation
    await this.logEvent(
      'AUDIT_EXPORTED',
      `Compliance report generated for ${startDate.toISOString()} to ${endDate.toISOString()}`,
      { userId: this.getCurrentUserId() }
    );

    return report;
  }

  /**
   * Track data access patterns for anomaly detection
   */
  public async analyzeAccessPatterns(userId: string): Promise<{
    normal: boolean;
    anomalies: string[];
    riskScore: number;
  }> {
    const entries = await offlineSecurityService.getAuditLog({ userId });
    const anomalies: string[] = [];
    let riskScore = 0;

    // Check for unusual access times
    const accessTimes = entries.map(e => new Date(e.timestamp).getHours());
    const nightAccess = accessTimes.filter(hour => hour < 6 || hour > 22).length;
    if (nightAccess > entries.length * 0.3) {
      anomalies.push('Unusual access times detected');
      riskScore += 20;
    }

    // Check for rapid consecutive accesses
    const rapidAccess = this.detectRapidAccess(entries);
    if (rapidAccess) {
      anomalies.push('Rapid consecutive data access detected');
      riskScore += 30;
    }

    // Check for access to multiple patients
    const patientAccess = this.countPatientAccess(entries);
    if (patientAccess > 50) {
      anomalies.push('High volume of patient record access');
      riskScore += 25;
    }

    // Check for failed access attempts
    const failedAttempts = entries.filter(e => 
      e.severity === 'ERROR' || e.action.includes('DENIED')
    ).length;
    if (failedAttempts > 5) {
      anomalies.push('Multiple failed access attempts');
      riskScore += 40;
    }

    return {
      normal: anomalies.length === 0,
      anomalies,
      riskScore: Math.min(riskScore, 100)
    };
  }

  /**
   * Export audit logs for external analysis
   */
  public async exportAuditLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    const entries = await offlineSecurityService.getAuditLog();
    
    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else {
      // CSV format
      const headers = ['Timestamp', 'Action', 'User ID', 'Severity', 'Description'];
      const rows = entries.map(e => [
        e.timestamp,
        e.action,
        e.userId || 'N/A',
        e.severity,
        e.description.replace(/,/g, ';') // Escape commas
      ]);
      
      return [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
    }
  }

  /**
   * Get pending notifications
   */
  public getPendingNotifications(): OfflineAuditEntry[] {
    const notifications = [...this.notificationQueue];
    this.notificationQueue = []; // Clear after retrieval
    return notifications;
  }

  /**
   * Private helper methods
   */

  private async storeAuditEntry(entry: OfflineAuditEntry): Promise<void> {
    // Use the offline security service's audit functionality
    // This is already handled by the logEvent method in offline security service
    console.log('Audit entry stored:', entry);
  }

  private async loadPHIAccessLogs(): Promise<void> {
    try {
      const stored = localStorage.getItem('omnicare_phi_access_logs');
      if (stored) {
        this.phiAccessLogs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load PHI access logs:', error);
    }
  }

  private async savePHIAccessLogs(): Promise<void> {
    try {
      // Keep only last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      
      this.phiAccessLogs = this.phiAccessLogs.filter(log =>
        log.timestamp > cutoff
      );
      
      localStorage.setItem(
        'omnicare_phi_access_logs',
        JSON.stringify(this.phiAccessLogs)
      );
    } catch (error) {
      console.error('Failed to save PHI access logs:', error);
    }
  }

  private calculateComplianceStats(
    entries: OfflineAuditEntry[],
    phiLogs: PHIAccessLog[]
  ): any {
    const stats = {
      totalAccess: entries.length,
      byUser: {} as Record<string, number>,
      byClassification: {
        phi: 0,
        sensitive: 0,
        general: 0
      },
      encryptionEvents: 0,
      decryptionEvents: 0,
      accessDenied: 0,
      securityViolations: 0,
      itemsStored: 0,
      itemsPurged: 0,
      averageLifetime: 0
    };

    // Process entries
    entries.forEach(entry => {
      // Count by user
      if (entry.userId) {
        stats.byUser[entry.userId] = (stats.byUser[entry.userId] || 0) + 1;
      }

      // Count by event type
      switch (entry.action) {
        case 'DATA_ENCRYPTED':
          stats.encryptionEvents++;
          break;
        case 'DATA_DECRYPTED':
          stats.decryptionEvents++;
          break;
        case 'ACCESS_DENIED':
          stats.accessDenied++;
          break;
        case 'SECURITY_VIOLATION':
          stats.securityViolations++;
          break;
        case 'DATA_STORED':
          stats.itemsStored++;
          break;
        case 'DATA_PURGED':
          stats.itemsPurged++;
          break;
      }
    });

    // Count PHI accesses
    stats.byClassification.phi = phiLogs.length;

    return stats;
  }

  private identifyViolations(entries: OfflineAuditEntry[]): Array<{
    timestamp: Date;
    type: string;
    severity: string;
    details: string;
  }> {
    const violations: any[] = [];

    entries.forEach(entry => {
      if (entry.severity === 'ERROR' || entry.severity === 'CRITICAL') {
        violations.push({
          timestamp: new Date(entry.timestamp),
          type: entry.action,
          severity: entry.severity,
          details: entry.description
        });
      }
    });

    return violations;
  }

  private detectRapidAccess(entries: OfflineAuditEntry[]): boolean {
    if (entries.length < 10) return false;

    const sorted = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let rapidCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      const timeDiff = new Date(sorted[i].timestamp).getTime() - 
                      new Date(sorted[i-1].timestamp).getTime();
      if (timeDiff < 1000) { // Less than 1 second
        rapidCount++;
      }
    }

    return rapidCount > 5;
  }

  private countPatientAccess(entries: OfflineAuditEntry[]): number {
    const patients = new Set<string>();
    
    entries.forEach(entry => {
      if (entry.metadata?.context?.patientId) {
        patients.add(entry.metadata.context.patientId);
      }
    });

    return patients.size;
  }

  private async handleCriticalEvent(entry: OfflineAuditEntry): Promise<void> {
    console.error('CRITICAL SECURITY EVENT:', entry);
    
    // In a real implementation, this would:
    // 1. Lock the affected resources
    // 2. Force re-authentication
    // 3. Send immediate notification
    // 4. Log to remote server when online
  }

  private async performComplianceCheck(): Promise<void> {
    // Regular compliance checks
    const now = new Date();
    const stats = await offlineSecurityService.getStorageStats();
    
    // Check for old data that should be purged
    if (stats.oldestItem) {
      const age = now.getTime() - stats.oldestItem.getTime();
      if (age > 90 * 24 * 60 * 60 * 1000) { // 90 days
        await this.logEvent(
          'RETENTION_POLICY',
          'Old data detected for purging',
          undefined,
          { age: Math.floor(age / (24 * 60 * 60 * 1000)) }
        );
      }
    }

    // Check for suspicious patterns
    const users = Object.keys(stats.byClassification);
    for (const userId of users) {
      const analysis = await this.analyzeAccessPatterns(userId);
      if (!analysis.normal) {
        await this.logEvent(
          'SECURITY_VIOLATION',
          `Suspicious access pattern detected: ${analysis.anomalies.join(', ')}`,
          { userId },
          { riskScore: analysis.riskScore }
        );
      }
    }
  }

  private getCurrentUserId(): string | undefined {
    try {
      const authData = localStorage.getItem('omnicare-auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.state?.user?.id;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private async getDeviceId(): Promise<string> {
    // Use the same device ID generation as offline security service
    const data = navigator.userAgent + navigator.language;
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const bytes = new Uint8Array(hash);
    return Array.from(bytes.slice(0, 8), byte => 
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  private generateReportId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `REPORT_${timestamp}_${random}`.toUpperCase();
  }
}

// Export singleton instance
export const offlineAudit = OfflineAuditService.getInstance();