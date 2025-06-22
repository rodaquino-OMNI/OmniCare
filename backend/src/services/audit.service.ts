/**
 * OmniCare EMR Backend - Audit Logging Service
 * HIPAA-Compliant Audit Trail
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import { AuditLogEntry, SecurityEvent, ComplianceReport } from '@/types/auth.types';
import { auditRepository } from '@/repositories/audit.repository';
import { databaseService } from './database.service';

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
  private sessionId?: string;

  constructor() {
    super();
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key-change-in-production';
  }

  /**
   * Set the current session ID for audit tracking
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
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
    additionalData?: Record<string, unknown>
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

    // Store in database
    try {
      await auditRepository.logActivity(entry, this.sessionId);
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to log audit entry to database:', error);
      // Fallback to console logging
      console.log('Audit Entry (fallback):', JSON.stringify(entry, null, 2));
    }

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
   * Log an access event
   */
  async logAccess(params: {
    userId: string;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logUserAction(
      params.userId,
      params.action,
      params.resource || 'system',
      params.resourceId,
      '0.0.0.0', // Default IP for sync operations
      'sync-service', // Default user agent for sync operations
      true,
      undefined,
      params.metadata
    );
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Get userId from event metadata or use 'system'
      const userId = event.userId || 'system';
      await auditRepository.logSecurityEvent(event, userId, this.sessionId);
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to log security event to database:', error);
      // Fallback to console logging
      console.log('Security Event (fallback):', JSON.stringify(event, null, 2));
    }

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
    
    // Get audit entries from database
    const data = await auditRepository.searchLogs(
      {
        startDate,
        endDate
      },
      undefined,
      undefined
    );

    // Get statistics from database
    const stats = await auditRepository.getStatistics(startDate, endDate);

    const summary = {
      totalAccesses: stats.totalEvents,
      uniqueUsers: stats.uniqueUsers,
      failedAttempts: stats.failedEvents,
      securityIncidents: stats.securityIncidents
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
    // Convert filters to repository format
    const repoFilters = {
      userId: filters?.userId,
      action: query || filters?.action, // Use query as action filter if provided
      resource: filters?.resource,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      success: filters?.success,
      ipAddress: filters?.ipAddress
    };

    // Search in database
    const results = await auditRepository.searchLogs(
      repoFilters,
      filters?.limit,
      filters?.offset
    );

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

    // Get statistics from database
    const stats = await auditRepository.getStatistics(startDate, now);

    // Get detailed event data for additional statistics
    const entries = await auditRepository.searchLogs(
      { startDate, endDate: now },
      1000 // Limit to recent 1000 entries for performance
    );

    // Calculate events by user
    const eventsByUser: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};

    entries.forEach(entry => {
      eventsByUser[entry.userId] = (eventsByUser[entry.userId] || 0) + 1;
      resourceCounts[entry.resource] = (resourceCounts[entry.resource] || 0) + 1;
    });

    const topResources = Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: stats.totalEvents,
      successfulEvents: stats.successfulEvents,
      failedEvents: stats.failedEvents,
      uniqueUsers: stats.uniqueUsers,
      eventsByType: stats.eventsByType,
      eventsByUser,
      topResources,
      securityIncidents: stats.securityIncidents
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
    try {
      const uuid = uuidv4().replace(/-/g, '');
      return `audit_${timestamp}_${uuid.substring(0, 16)}`;
    } catch (error) {
      // Fallback for test environment
      const random = Math.random().toString(36).substring(2, 18);
      return `audit_${timestamp}_${random}`;
    }
  }

  /**
   * Encrypt sensitive data in audit logs
   */
  private encryptSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const encrypted: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        try {
          encrypted[key] = `encrypted:${crypto.createHash('sha256').update(JSON.stringify(value) + this.encryptionKey).digest('hex')}`;
        } catch (error) {
          // Fallback for test environment
          encrypted[key] = `encrypted:test-${key}`;
        }
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
   * Create a new session for user authentication
   */
  async createSession(
    userId: string,
    sessionId: string,
    authMethod: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await auditRepository.createSession(userId, sessionId, authMethod, ipAddress, userAgent);
      this.sessionId = sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await auditRepository.updateSessionActivity(sessionId);
    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  /**
   * End user session
   */
  async endSession(sessionId: string, reason: string = 'logout'): Promise<void> {
    try {
      await auditRepository.endSession(sessionId, reason);
      if (this.sessionId === sessionId) {
        this.sessionId = undefined;
      }
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  /**
   * Log patient data access
   */
  async logPatientAccess(
    userId: string,
    patientId: string,
    accessType: 'view' | 'create' | 'update' | 'delete' | 'print' | 'export' | 'search' | 'query',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await auditRepository.logPatientAccess(
        userId,
        patientId,
        accessType,
        this.sessionId,
        metadata
      );
    } catch (error) {
      console.error('Failed to log patient access:', error);
    }
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
