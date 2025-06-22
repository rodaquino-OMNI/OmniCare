/**
 * OmniCare EMR Backend - Audit Logging Service
 * HIPAA-Compliant Audit Trail
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import { AuditLogEntry, SecurityEvent, ComplianceReport } from '@/types/auth.types';

export interface AuditFilters {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueUsers: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  topResources: Array<{ resource: string; count: number }>;
  securityIncidents: number;
}

export class AuditService extends EventEmitter {
  private encryptionKey: string;
  private auditEntries: AuditLogEntry[] = [];

  constructor() {
    super();
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key-change-in-production';
  }

  /**
   * Log a user action audit entry
   */
  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId: string | undefined,
    ipAddress: string,
    userAgent: string,
    success: boolean = true,
    errorMessage?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateAuditId(),
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success,
      errorMessage,
      additionalData: additionalData ? this.encryptSensitiveData(additionalData) : undefined
    };

    // Store in memory (in production, this would go to a database)
    this.auditEntries.push(entry);

    // Console log for development
    console.log('Audit Entry:', JSON.stringify(entry, null, 2));

    // Emit event for additional processing
    this.emit('auditEntry', entry);

    // Check if this action requires security monitoring
    if (this.isSecurityRelevantAction(action)) {
      const securityEvent: SecurityEvent = {
        type: this.mapActionToSecurityEventType(action),
        userId,
        severity: this.determineSeverity(action, success),
        description: `User action: ${action} on ${resource}`,
        metadata: { action, resource, resourceId, success, ipAddress }
      };

      await this.logSecurityEvent(securityEvent);
    }
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      ...event,
      timestamp: new Date(),
      id: this.generateAuditId()
    };

    // Console log for development
    console.log('Security Event:', JSON.stringify(logEntry, null, 2));

    // Emit event for additional processing
    this.emit('securityEvent', event);

    // Handle critical events immediately
    if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
      await this.handleCriticalSecurityEvent(event);
    }
  }

  /**
   * Generate HIPAA compliance report
   */
  async generateHipaaComplianceReport(
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<ComplianceReport> {
    // Validate dates
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date parameters provided');
    }
    
    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }
    
    const reportId = this.generateAuditId();
    
    // Filter audit entries by date range
    const data = this.auditEntries.filter(entry => 
      entry.timestamp >= startDate && entry.timestamp <= endDate
    );

    const summary = {
      totalAccesses: data.length,
      uniqueUsers: new Set(data.map(entry => entry.userId)).size,
      failedAttempts: data.filter(entry => !entry.success).length,
      securityIncidents: data.filter(entry => 
        this.isSecurityRelevantAction(entry.action) && !entry.success
      ).length
    };

    const report: ComplianceReport = {
      reportId,
      reportType: 'HIPAA_ACCESS_LOG',
      generatedBy,
      dateRange: { start: startDate, end: endDate },
      data,
      summary,
      createdAt: new Date()
    };

    // Log report generation
    await this.logSecurityEvent({
      type: 'SYSTEM_CONFIGURATION_CHANGE',
      userId: generatedBy,
      severity: 'MEDIUM',
      description: `HIPAA compliance report generated for period ${startDate.toISOString()} to ${endDate.toISOString()}`,
      metadata: { reportId, reportType: 'HIPAA_ACCESS_LOG' }
    });

    return report;
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(
    query: string,
    filters?: AuditFilters
  ): Promise<AuditLogEntry[]> {
    let results = this.auditEntries;

    // Apply filters
    if (filters) {
      if (filters.userId) {
        results = results.filter(entry => entry.userId === filters.userId);
      }
      if (filters.action) {
        results = results.filter(entry => entry.action.includes(filters.action!));
      }
      if (filters.resource) {
        results = results.filter(entry => entry.resource === filters.resource);
      }
      if (filters.startDate) {
        results = results.filter(entry => entry.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        results = results.filter(entry => entry.timestamp <= filters.endDate!);
      }
      if (filters.success !== undefined) {
        results = results.filter(entry => entry.success === filters.success);
      }
      if (filters.ipAddress) {
        results = results.filter(entry => entry.ipAddress === filters.ipAddress);
      }
    }

    // Apply text search
    if (query) {
      results = results.filter(entry => 
        JSON.stringify(entry).toLowerCase().includes(query.toLowerCase())
      );
    }

    // Apply pagination
    if (filters?.limit) {
      const offset = filters.offset || 0;
      results = results.slice(offset, offset + filters.limit);
    }

    return results;
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    timeframe: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<AuditStatistics> {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const relevantEntries = this.auditEntries.filter(entry => entry.timestamp >= startDate);

    const eventsByType: Record<string, number> = {};
    const eventsByUser: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};

    relevantEntries.forEach(entry => {
      eventsByType[entry.action] = (eventsByType[entry.action] || 0) + 1;
      eventsByUser[entry.userId] = (eventsByUser[entry.userId] || 0) + 1;
      resourceCounts[entry.resource] = (resourceCounts[entry.resource] || 0) + 1;
    });

    const topResources = Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: relevantEntries.length,
      successfulEvents: relevantEntries.filter(entry => entry.success).length,
      failedEvents: relevantEntries.filter(entry => !entry.success).length,
      uniqueUsers: new Set(relevantEntries.map(entry => entry.userId)).size,
      eventsByType,
      eventsByUser,
      topResources,
      securityIncidents: relevantEntries.filter(entry => 
        this.isSecurityRelevantAction(entry.action) && !entry.success
      ).length
    };
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    console.error(`CRITICAL SECURITY EVENT: ${event.type} - ${event.description}`);
    
    // Emit critical event for external handling
    this.emit('criticalSecurityEvent', event);
  }

  /**
   * Generate cryptographically secure audit ID
   */
  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Encrypt sensitive data in audit logs
   */
  private encryptSensitiveData(data: Record<string, any>): Record<string, any> {
    const encrypted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        encrypted[key] = `encrypted:${crypto.createHash('sha256').update(JSON.stringify(value) + this.encryptionKey).digest('hex')}`;
      } else {
        encrypted[key] = value;
      }
    }
    
    return encrypted;
  }

  /**
   * Check if field contains sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'ssn', 'dob', 'phone', 'email',
      'address', 'medicalRecord', 'diagnosis',
      'treatment', 'medication', 'notes'
    ];
    
    return sensitiveFields.some(field => 
      fieldName.toLowerCase().includes(field)
    );
  }

  /**
   * Check if action is security relevant
   */
  private isSecurityRelevantAction(action: string): boolean {
    const securityActions = [
      'login', 'logout', 'password_change', 'mfa_setup',
      'user_creation', 'user_modification', 'permission_change',
      'data_access', 'data_modification', 'data_deletion',
      'system_configuration', 'backup', 'restore'
    ];
    
    return securityActions.some(secAction => 
      action.toLowerCase().includes(secAction)
    );
  }

  /**
   * Map action to security event type
   */
  private mapActionToSecurityEventType(action: string): SecurityEvent['type'] {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('login')) return 'LOGIN_SUCCESS';
    if (actionLower.includes('logout')) return 'LOGOUT';
    if (actionLower.includes('password')) return 'PASSWORD_CHANGE';
    if (actionLower.includes('data_access')) return 'DATA_ACCESS';
    if (actionLower.includes('data_modification')) return 'DATA_MODIFICATION';
    if (actionLower.includes('unauthorized')) return 'UNAUTHORIZED_ACCESS';
    
    return 'DATA_ACCESS'; // Default
  }

  /**
   * Determine event severity
   */
  private determineSeverity(action: string, success: boolean): SecurityEvent['severity'] {
    if (!success) {
      if (action.includes('login') || action.includes('unauthorized')) {
        return 'HIGH';
      }
      return 'MEDIUM';
    }
    
    if (action.includes('system_configuration') || action.includes('user_creation')) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  /**
   * Shutdown audit service
   */
  shutdown(): void {
    this.removeAllListeners();
  }
}

// Export singleton instance
export const auditService = new AuditService();
