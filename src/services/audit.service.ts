/**
 * OmniCare EMR - Comprehensive Audit Logging Service
 * HIPAA-Compliant Audit Trail with Security Event Monitoring
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { AUDIT_CONFIG } from '@/config/auth.config';
import { AuditLogEntry, SecurityEvent, ComplianceReport, UserRole } from '@/types/auth.types';

export interface AuditDatabase {
  saveAuditEntry(entry: AuditLogEntry): Promise<void>;
  getAuditEntries(filters: AuditFilters): Promise<AuditLogEntry[]>;
  generateComplianceReport(reportType: string, dateRange: { start: Date; end: Date }): Promise<ComplianceReport>;
  searchAuditLogs(query: string, filters?: AuditFilters): Promise<AuditLogEntry[]>;
  getAuditStatistics(timeframe: 'daily' | 'weekly' | 'monthly'): Promise<AuditStatistics>;
}

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
  private logger: winston.Logger;
  private securityLogger: winston.Logger;
  private database?: AuditDatabase;
  private encryptionKey: string;

  constructor(database?: AuditDatabase) {
    super();
    this.database = database;
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key-change-in-production';
    
    this.initializeLoggers();
    this.setupEventListeners();
  }

  /**
   * Initialize Winston loggers for audit and security events
   */
  private initializeLoggers(): void {
    // Main audit logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf((info) => {
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            ...info,
            signature: this.signLogEntry(info)
          });
        })
      ),
      defaultMeta: { service: 'omnicare-audit' },
      transports: [
        // Daily rotating file for audit logs
        new DailyRotateFile({
          filename: 'logs/audit/audit-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: AUDIT_CONFIG.logRotation.compress,
          maxSize: AUDIT_CONFIG.logRotation.maxSize,
          maxFiles: AUDIT_CONFIG.logRotation.maxFiles,
          createSymlink: true,
          symlinkName: 'audit-current.log'
        }),
        
        // Console output for development
        ...(process.env.NODE_ENV !== 'production' ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ] : [])
      ]
    });

    // Security events logger
    this.securityLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf((info) => {
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            ...info,
            signature: this.signLogEntry(info)
          });
        })
      ),
      defaultMeta: { service: 'omnicare-security' },
      transports: [
        new DailyRotateFile({
          filename: 'logs/security/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '50m',
          maxFiles: '365d'
        }),
        
        // Immediate alerts for critical events
        new winston.transports.File({
          filename: 'logs/security/critical-events.log',
          level: 'error'
        })
      ]
    });
  }

  /**
   * Setup event listeners for audit logging
   */
  private setupEventListeners(): void {
    this.on('auditEntry', async (entry: AuditLogEntry) => {
      try {
        if (this.database) {
          await this.database.saveAuditEntry(entry);
        }
      } catch (error) {
        console.error('Failed to save audit entry to database:', error);
      }
    });

    this.on('securityEvent', async (event: SecurityEvent) => {
      try {
        if (AUDIT_CONFIG.criticalEvents.includes(event.type)) {
          await this.handleCriticalSecurityEvent(event);
        }
      } catch (error) {
        console.error('Failed to handle critical security event:', error);
      }
    });
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

    // Log to Winston
    this.logger.info('User action', entry);

    // Emit event for database storage
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

    // Determine log level based on severity
    const logLevel = this.mapSeverityToLogLevel(event.severity);
    
    this.securityLogger.log(logLevel, 'Security event', logEntry);

    // Emit event for additional processing
    this.emit('securityEvent', event);

    // Handle critical events immediately
    if (AUDIT_CONFIG.criticalEvents.includes(event.type)) {
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
    const reportId = this.generateAuditId();
    
    let data: AuditLogEntry[] = [];
    let summary: Record<string, any> = {};

    if (this.database) {
      const report = await this.database.generateComplianceReport(
        'HIPAA_ACCESS_LOG',
        { start: startDate, end: endDate }
      );
      data = report.data;
      summary = report.summary;
    } else {
      // Fallback to log file analysis
      data = await this.analyzeLogFiles(startDate, endDate);
      summary = this.generateReportSummary(data);
    }

    const report: ComplianceReport = {
      reportId,
      reportType: 'HIPAA_ACCESS_LOG',
      generatedBy,
      dateRange: { start: startDate, end: endDate },
      data,
      summary: {
        ...summary,
        totalAccesses: data.length,
        uniqueUsers: new Set(data.map(entry => entry.userId)).size,
        failedAttempts: data.filter(entry => !entry.success).length,
        securityIncidents: data.filter(entry => 
          this.isSecurityRelevantAction(entry.action) && !entry.success
        ).length
      },
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
    if (this.database) {
      return await this.database.searchAuditLogs(query, filters);
    }

    // Fallback to file-based search (limited functionality)
    return this.searchLogFiles(query, filters);
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    timeframe: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<AuditStatistics> {
    if (this.database) {
      return await this.database.getAuditStatistics(timeframe);
    }

    // Fallback implementation
    return this.calculateStatisticsFromLogs(timeframe);
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    // Immediate logging with high priority
    this.securityLogger.error('CRITICAL SECURITY EVENT', {
      ...event,
      timestamp: new Date(),
      priority: 'CRITICAL'
    });

    // In production, this would:
    // 1. Send real-time alerts to security team
    // 2. Trigger automated security responses
    // 3. Create incident tickets
    // 4. Send notifications to relevant stakeholders

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
   * Sign log entry for integrity verification
   */
  private signLogEntry(entry: any): string {
    const data = JSON.stringify(entry, Object.keys(entry).sort());
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Encrypt sensitive data in audit logs
   */
  private encryptSensitiveData(data: Record<string, any>): Record<string, any> {
    const encrypted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encryptedValue = cipher.update(JSON.stringify(value), 'utf8', 'hex');
        encryptedValue += cipher.final('hex');
        encrypted[key] = `encrypted:${encryptedValue}`;
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
   * Map severity to Winston log level
   */
  private mapSeverityToLogLevel(severity: SecurityEvent['severity']): string {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warn';
      case 'LOW': return 'info';
      default: return 'info';
    }
  }

  /**
   * Analyze log files for compliance reports (fallback method)
   */
  private async analyzeLogFiles(startDate: Date, endDate: Date): Promise<AuditLogEntry[]> {
    // Implementation would parse log files within date range
    // This is a simplified version
    return [];
  }

  /**
   * Generate report summary from audit data
   */
  private generateReportSummary(data: AuditLogEntry[]): Record<string, any> {
    return {
      totalEntries: data.length,
      successfulActions: data.filter(entry => entry.success).length,
      failedActions: data.filter(entry => !entry.success).length,
      uniqueUsers: new Set(data.map(entry => entry.userId)).size,
      topActions: this.getTopActions(data),
      timeRange: {
        earliest: data.reduce((min, entry) => 
          entry.timestamp < min ? entry.timestamp : min, 
          data[0]?.timestamp || new Date()
        ),
        latest: data.reduce((max, entry) => 
          entry.timestamp > max ? entry.timestamp : max, 
          data[0]?.timestamp || new Date()
        )
      }
    };
  }

  /**
   * Get top actions from audit data
   */
  private getTopActions(data: AuditLogEntry[]): Array<{ action: string; count: number }> {
    const actionCounts: Record<string, number> = {};
    
    data.forEach(entry => {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    });
    
    return Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Search log files (simplified implementation)
   */
  private async searchLogFiles(query: string, filters?: AuditFilters): Promise<AuditLogEntry[]> {
    // Implementation would search through log files
    // This is a placeholder
    return [];
  }

  /**
   * Calculate statistics from log files
   */
  private async calculateStatisticsFromLogs(timeframe: string): Promise<AuditStatistics> {
    // Implementation would analyze log files
    // This is a placeholder
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      uniqueUsers: 0,
      eventsByType: {},
      eventsByUser: {},
      topResources: [],
      securityIncidents: 0
    };
  }

  /**
   * Shutdown audit service
   */
  shutdown(): void {
    this.logger.end();
    this.securityLogger.end();
    this.removeAllListeners();
  }
}