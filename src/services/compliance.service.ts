/**
 * OmniCare EMR - Compliance Reporting Service
 * HIPAA-Compliant Security Audit and Compliance Reporting System
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

import { createObjectCsvWriter } from 'csv-writer';

import { AUDIT_CONFIG } from '@/config/auth.config';
import { AuditService } from '@/services/audit.service';
import { 
  ComplianceReport, 
  AuditLogEntry, 
  SecurityEvent, 
  User, 
  UserRole 
} from '@/types/auth.types';

export interface ComplianceMetrics {
  reportPeriod: {
    start: Date;
    end: Date;
  };
  userActivity: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    newUsers: number;
    usersByRole: Record<UserRole, number>;
  };
  accessMetrics: {
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    uniqueLoginUsers: number;
    averageSessionDuration: number;
  };
  securityMetrics: {
    securityIncidents: number;
    passwordChanges: number;
    mfaEnrollments: number;
    accountLockouts: number;
    unauthorizedAccesses: number;
  };
  dataAccess: {
    totalDataAccess: number;
    patientRecordAccesses: number;
    adminFunctionAccesses: number;
    reportGenerations: number;
    dataModifications: number;
  };
  systemMetrics: {
    systemConfigChanges: number;
    userAccountChanges: number;
    permissionChanges: number;
    backupOperations: number;
  };
}

export interface HIPAAAccessLog {
  timestamp: Date;
  userId: string;
  username: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  patientId?: string;
  ipAddress: string;
  sessionId: string;
  success: boolean;
  reasonForAccess?: string;
  dataModified?: boolean;
}

export interface SecurityIncident {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  userId?: string;
  ipAddress?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  metadata?: Record<string, any>;
}

export class ComplianceService extends EventEmitter {
  private auditService: AuditService;
  private incidentHistory: SecurityIncident[] = [];
  private reportCache: Map<string, ComplianceReport> = new Map();

  constructor(auditService: AuditService) {
    super();
    this.auditService = auditService;
    
    this.setupEventListeners();
  }

  /**
   * Generate comprehensive HIPAA compliance report
   */
  async generateHIPAAComplianceReport(
    startDate: Date,
    endDate: Date,
    generatedBy: string,
    includePatientData: boolean = false
  ): Promise<ComplianceReport> {
    const reportId = `hipaa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Gather audit data for the specified period
      const auditData = await this.auditService.searchAuditLogs('', {
        startDate,
        endDate,
        limit: 100000 // Large limit for comprehensive reporting
      });

      // Calculate compliance metrics
      const metrics = await this.calculateComplianceMetrics(auditData, startDate, endDate);
      
      // Generate HIPAA access logs
      const accessLogs = await this.generateHIPAAAccessLogs(auditData);
      
      // Identify security incidents
      const securityIncidents = await this.identifySecurityIncidents(auditData);
      
      // Generate summary
      const summary = this.generateComplianceSummary(metrics, securityIncidents, accessLogs);

      const report: ComplianceReport = {
        reportId,
        reportType: 'HIPAA_ACCESS_LOG',
        generatedBy,
        dateRange: { start: startDate, end: endDate },
        data: includePatientData ? auditData : this.anonymizeAuditData(auditData),
        summary: {
          ...summary,
          metrics,
          accessLogs: accessLogs.length,
          securityIncidents: securityIncidents.length,
          complianceScore: this.calculateComplianceScore(metrics, securityIncidents)
        },
        createdAt: new Date()
      };

      // Cache the report
      this.reportCache.set(reportId, report);

      // Export to various formats
      await this.exportReportToCSV(report);
      await this.exportReportToJSON(report);

      // Log report generation
      await this.auditService.logSecurityEvent({
        type: 'SYSTEM_CONFIGURATION_CHANGE',
        userId: generatedBy,
        severity: 'MEDIUM',
        description: `HIPAA compliance report generated: ${reportId}`,
        metadata: {
          reportId,
          reportType: 'HIPAA_ACCESS_LOG',
          dateRange: { start: startDate, end: endDate },
          includePatientData
        }
      });

      this.emit('reportGenerated', report);
      return report;

    } catch (error) {
      await this.auditService.logSecurityEvent({
        type: 'SYSTEM_CONFIGURATION_CHANGE',
        userId: generatedBy,
        severity: 'HIGH',
        description: `Failed to generate HIPAA compliance report`,
        metadata: {
          error: error.message,
          dateRange: { start: startDate, end: endDate }
        }
      });

      throw error;
    }
  }

  /**
   * Generate security incident report
   */
  async generateSecurityIncidentReport(
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<ComplianceReport> {
    const reportId = `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const incidents = this.incidentHistory.filter(incident => 
      incident.timestamp >= startDate && incident.timestamp <= endDate
    );

    const summary = {
      totalIncidents: incidents.length,
      criticalIncidents: incidents.filter(i => i.severity === 'CRITICAL').length,
      highSeverityIncidents: incidents.filter(i => i.severity === 'HIGH').length,
      resolvedIncidents: incidents.filter(i => i.resolved).length,
      unresolvedIncidents: incidents.filter(i => !i.resolved).length,
      averageResolutionTime: this.calculateAverageResolutionTime(incidents),
      incidentsByType: this.groupIncidentsByType(incidents)
    };

    const report: ComplianceReport = {
      reportId,
      reportType: 'SECURITY_INCIDENTS',
      generatedBy,
      dateRange: { start: startDate, end: endDate },
      data: incidents,
      summary,
      createdAt: new Date()
    };

    this.reportCache.set(reportId, report);
    
    await this.exportReportToJSON(report);
    
    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Generate user activity report
   */
  async generateUserActivityReport(
    startDate: Date,
    endDate: Date,
    generatedBy: string,
    userId?: string
  ): Promise<ComplianceReport> {
    const reportId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const filters: any = { startDate, endDate };
    if (userId) filters.userId = userId;

    const auditData = await this.auditService.searchAuditLogs('', filters);
    
    const activityMetrics = this.calculateUserActivityMetrics(auditData);
    
    const report: ComplianceReport = {
      reportId,
      reportType: 'USER_ACTIVITY',
      generatedBy,
      dateRange: { start: startDate, end: endDate },
      data: auditData,
      summary: {
        userMetrics: activityMetrics,
        totalActions: auditData.length,
        uniqueUsers: new Set(auditData.map(entry => entry.userId)).size,
        timeRange: {
          start: startDate,
          end: endDate,
          durationDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        }
      },
      createdAt: new Date()
    };

    this.reportCache.set(reportId, report);
    
    await this.exportReportToCSV(report);
    
    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Generate password compliance report
   */
  async generatePasswordComplianceReport(
    generatedBy: string
  ): Promise<ComplianceReport> {
    const reportId = `password_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would typically query user database for password-related metrics
    const passwordMetrics = {
      totalUsers: 0,
      usersWithExpiredPasswords: 0,
      usersWithWeakPasswords: 0,
      usersWithMFAEnabled: 0,
      usersWithRecentPasswordChange: 0,
      passwordPolicyViolations: 0
    };

    const report: ComplianceReport = {
      reportId,
      reportType: 'PASSWORD_COMPLIANCE',
      generatedBy,
      dateRange: { 
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date() 
      },
      data: [], // Would contain user password compliance data
      summary: {
        passwordMetrics,
        compliancePercentage: this.calculatePasswordComplianceScore(passwordMetrics)
      },
      createdAt: new Date()
    };

    this.reportCache.set(reportId, report);
    
    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Calculate comprehensive compliance metrics
   */
  private async calculateComplianceMetrics(
    auditData: AuditLogEntry[],
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceMetrics> {
    const loginEvents = auditData.filter(entry => 
      entry.action.toLowerCase().includes('login')
    );

    const dataAccessEvents = auditData.filter(entry => 
      entry.action.toLowerCase().includes('access') || 
      entry.action.toLowerCase().includes('view') ||
      entry.action.toLowerCase().includes('read')
    );

    const securityEvents = auditData.filter(entry => 
      ['password_change', 'mfa_enabled', 'account_locked', 'unauthorized_access'].includes(entry.action)
    );

    return {
      reportPeriod: { start: startDate, end: endDate },
      userActivity: {
        totalUsers: new Set(auditData.map(entry => entry.userId)).size,
        activeUsers: new Set(loginEvents.filter(entry => entry.success).map(entry => entry.userId)).size,
        inactiveUsers: 0, // Would require user database query
        newUsers: 0, // Would require user creation audit events
        usersByRole: this.groupUsersByRole(auditData)
      },
      accessMetrics: {
        totalLogins: loginEvents.length,
        successfulLogins: loginEvents.filter(entry => entry.success).length,
        failedLogins: loginEvents.filter(entry => !entry.success).length,
        uniqueLoginUsers: new Set(loginEvents.filter(entry => entry.success).map(entry => entry.userId)).size,
        averageSessionDuration: this.calculateAverageSessionDuration(auditData)
      },
      securityMetrics: {
        securityIncidents: securityEvents.filter(entry => !entry.success).length,
        passwordChanges: securityEvents.filter(entry => entry.action === 'password_change').length,
        mfaEnrollments: securityEvents.filter(entry => entry.action === 'mfa_enabled').length,
        accountLockouts: securityEvents.filter(entry => entry.action === 'account_locked').length,
        unauthorizedAccesses: securityEvents.filter(entry => entry.action === 'unauthorized_access').length
      },
      dataAccess: {
        totalDataAccess: dataAccessEvents.length,
        patientRecordAccesses: dataAccessEvents.filter(entry => 
          entry.resource.toLowerCase().includes('patient')
        ).length,
        adminFunctionAccesses: dataAccessEvents.filter(entry => 
          entry.resource.toLowerCase().includes('admin')
        ).length,
        reportGenerations: auditData.filter(entry => 
          entry.action.toLowerCase().includes('report')
        ).length,
        dataModifications: auditData.filter(entry => 
          ['create', 'update', 'delete', 'modify'].some(action => 
            entry.action.toLowerCase().includes(action)
          )
        ).length
      },
      systemMetrics: {
        systemConfigChanges: auditData.filter(entry => 
          entry.action.toLowerCase().includes('config')
        ).length,
        userAccountChanges: auditData.filter(entry => 
          entry.action.toLowerCase().includes('user') && 
          ['create', 'update', 'delete'].some(action => 
            entry.action.toLowerCase().includes(action)
          )
        ).length,
        permissionChanges: auditData.filter(entry => 
          entry.action.toLowerCase().includes('permission')
        ).length,
        backupOperations: auditData.filter(entry => 
          entry.action.toLowerCase().includes('backup')
        ).length
      }
    };
  }

  /**
   * Generate HIPAA-specific access logs
   */
  private async generateHIPAAAccessLogs(auditData: AuditLogEntry[]): Promise<HIPAAAccessLog[]> {
    return auditData
      .filter(entry => this.isHIPAARelevantAccess(entry))
      .map(entry => ({
        timestamp: entry.timestamp,
        userId: entry.userId,
        username: entry.additionalData?.username || 'Unknown',
        userRole: entry.additionalData?.role || UserRole.PATIENT,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        patientId: this.extractPatientId(entry),
        ipAddress: entry.ipAddress,
        sessionId: entry.additionalData?.sessionId || 'Unknown',
        success: entry.success,
        reasonForAccess: entry.additionalData?.reasonForAccess,
        dataModified: this.isDataModificationAction(entry.action)
      }));
  }

  /**
   * Identify security incidents from audit data
   */
  private async identifySecurityIncidents(auditData: AuditLogEntry[]): Promise<SecurityIncident[]> {
    const incidents: SecurityIncident[] = [];

    // Failed login attempts
    const failedLogins = auditData.filter(entry => 
      entry.action.toLowerCase().includes('login') && !entry.success
    );

    // Group by user and identify patterns
    const failedLoginsByUser = this.groupBy(failedLogins, 'userId');
    
    for (const [userId, attempts] of Object.entries(failedLoginsByUser)) {
      if (attempts.length >= 5) { // Threshold for suspicious activity
        incidents.push({
          id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: attempts[0].timestamp,
          type: 'SUSPICIOUS_LOGIN_ACTIVITY',
          severity: 'HIGH',
          description: `Multiple failed login attempts for user ${userId}`,
          userId,
          ipAddress: attempts[0].ipAddress,
          resolved: false,
          metadata: { attemptCount: attempts.length, attempts }
        });
      }
    }

    // Unauthorized access attempts
    const unauthorizedAccess = auditData.filter(entry => 
      entry.action.toLowerCase().includes('unauthorized') && !entry.success
    );

    for (const access of unauthorizedAccess) {
      incidents.push({
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: access.timestamp,
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'CRITICAL',
        description: `Unauthorized access attempt to ${access.resource}`,
        userId: access.userId,
        ipAddress: access.ipAddress,
        resolved: false,
        metadata: { auditEntry: access }
      });
    }

    return incidents;
  }

  /**
   * Export report to CSV format
   */
  private async exportReportToCSV(report: ComplianceReport): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: path.join('reports', `${report.reportId}.csv`),
      header: this.getCSVHeaders(report.reportType)
    });

    await csvWriter.writeRecords(report.data);
  }

  /**
   * Export report to JSON format
   */
  private async exportReportToJSON(report: ComplianceReport): Promise<void> {
    const reportPath = path.join('reports', `${report.reportId}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(
    metrics: ComplianceMetrics,
    incidents: SecurityIncident[]
  ): number {
    let score = 100;

    // Deduct points for security issues
    score -= incidents.filter(i => i.severity === 'CRITICAL').length * 10;
    score -= incidents.filter(i => i.severity === 'HIGH').length * 5;
    score -= incidents.filter(i => i.severity === 'MEDIUM').length * 2;

    // Deduct points for failed logins
    const failureRate = metrics.accessMetrics.failedLogins / metrics.accessMetrics.totalLogins;
    score -= failureRate * 20;

    // Deduct points for unresolved incidents
    const unresolvedIncidents = incidents.filter(i => !i.resolved).length;
    score -= unresolvedIncidents * 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.auditService.on('securityEvent', (event: SecurityEvent) => {
      this.handleSecurityEvent(event);
    });
  }

  /**
   * Handle security events for incident tracking
   */
  private handleSecurityEvent(event: SecurityEvent): void {
    if (this.isCriticalSecurityEvent(event)) {
      const incident: SecurityIncident = {
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        type: event.type,
        severity: event.severity,
        description: event.description,
        userId: event.userId,
        resolved: false,
        metadata: event.metadata
      };

      this.incidentHistory.push(incident);
      this.emit('securityIncident', incident);
    }
  }

  // Helper methods
  private isHIPAARelevantAccess(entry: AuditLogEntry): boolean {
    const relevantActions = ['access', 'view', 'read', 'create', 'update', 'delete'];
    const relevantResources = ['patient', 'medical_record', 'phi', 'clinical_data'];
    
    return relevantActions.some(action => entry.action.toLowerCase().includes(action)) &&
           relevantResources.some(resource => entry.resource.toLowerCase().includes(resource));
  }

  private extractPatientId(entry: AuditLogEntry): string | undefined {
    return entry.additionalData?.patientId || 
           (entry.resource.toLowerCase().includes('patient') ? entry.resourceId : undefined);
  }

  private isDataModificationAction(action: string): boolean {
    return ['create', 'update', 'delete', 'modify', 'edit'].some(mod => 
      action.toLowerCase().includes(mod)
    );
  }

  private isCriticalSecurityEvent(event: SecurityEvent): boolean {
    return ['CRITICAL', 'HIGH'].includes(event.severity) ||
           ['UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'ACCOUNT_COMPROMISE'].includes(event.type);
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private groupUsersByRole(auditData: AuditLogEntry[]): Record<UserRole, number> {
    const roleCount: Record<UserRole, number> = {} as Record<UserRole, number>;
    
    const userRoles = new Map<string, UserRole>();
    auditData.forEach(entry => {
      if (entry.additionalData?.role) {
        userRoles.set(entry.userId, entry.additionalData.role as UserRole);
      }
    });

    userRoles.forEach(role => {
      roleCount[role] = (roleCount[role] || 0) + 1;
    });

    return roleCount;
  }

  private calculateAverageSessionDuration(auditData: AuditLogEntry[]): number {
    // Simplified calculation - would need more sophisticated session tracking
    return 25; // minutes
  }

  private calculateUserActivityMetrics(auditData: AuditLogEntry[]): any {
    return {
      totalActions: auditData.length,
      uniqueUsers: new Set(auditData.map(entry => entry.userId)).size,
      actionsByType: this.groupBy(auditData, 'action'),
      resourcesByType: this.groupBy(auditData, 'resource')
    };
  }

  private calculateAverageResolutionTime(incidents: SecurityIncident[]): number {
    const resolvedIncidents = incidents.filter(i => i.resolved && i.resolvedAt);
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      const resolutionTime = incident.resolvedAt!.getTime() - incident.timestamp.getTime();
      return sum + resolutionTime;
    }, 0);

    return totalTime / resolvedIncidents.length / (1000 * 60 * 60); // Convert to hours
  }

  private groupIncidentsByType(incidents: SecurityIncident[]): Record<string, number> {
    return incidents.reduce((groups, incident) => {
      groups[incident.type] = (groups[incident.type] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private calculatePasswordComplianceScore(metrics: any): number {
    if (metrics.totalUsers === 0) return 100;
    
    const compliantUsers = metrics.totalUsers - 
      metrics.usersWithExpiredPasswords - 
      metrics.usersWithWeakPasswords - 
      metrics.passwordPolicyViolations;
    
    return Math.max(0, (compliantUsers / metrics.totalUsers) * 100);
  }

  private anonymizeAuditData(auditData: AuditLogEntry[]): AuditLogEntry[] {
    return auditData.map(entry => ({
      ...entry,
      userId: this.hashUserId(entry.userId),
      ipAddress: this.anonymizeIpAddress(entry.ipAddress),
      additionalData: this.anonymizeAdditionalData(entry.additionalData)
    }));
  }

  private hashUserId(userId: string): string {
    return `user_${userId.slice(0, 8)}***`;
  }

  private anonymizeIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return 'xxx.xxx.xxx.xxx';
  }

  private anonymizeAdditionalData(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return data;
    
    const anonymized = { ...data };
    delete anonymized.email;
    delete anonymized.phone;
    delete anonymized.ssn;
    delete anonymized.patientId;
    
    return anonymized;
  }

  private getCSVHeaders(reportType: string): Array<{id: string, title: string}> {
    const commonHeaders = [
      { id: 'timestamp', title: 'Timestamp' },
      { id: 'userId', title: 'User ID' },
      { id: 'action', title: 'Action' },
      { id: 'resource', title: 'Resource' },
      { id: 'success', title: 'Success' }
    ];

    switch (reportType) {
      case 'HIPAA_ACCESS_LOG':
        return [
          ...commonHeaders,
          { id: 'patientId', title: 'Patient ID' },
          { id: 'ipAddress', title: 'IP Address' },
          { id: 'reasonForAccess', title: 'Reason for Access' }
        ];
      case 'SECURITY_INCIDENTS':
        return [
          { id: 'id', title: 'Incident ID' },
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'type', title: 'Type' },
          { id: 'severity', title: 'Severity' },
          { id: 'description', title: 'Description' },
          { id: 'resolved', title: 'Resolved' }
        ];
      default:
        return commonHeaders;
    }
  }

  private generateComplianceSummary(
    metrics: ComplianceMetrics,
    incidents: SecurityIncident[],
    accessLogs: HIPAAAccessLog[]
  ): any {
    return {
      overview: {
        reportPeriod: `${metrics.reportPeriod.start.toISOString()} to ${metrics.reportPeriod.end.toISOString()}`,
        totalUsers: metrics.userActivity.totalUsers,
        totalAccesses: accessLogs.length,
        securityIncidents: incidents.length,
        complianceStatus: incidents.filter(i => i.severity === 'CRITICAL').length === 0 ? 'COMPLIANT' : 'NON_COMPLIANT'
      },
      highlights: {
        mostActiveUsers: this.getMostActiveUsers(accessLogs),
        topAccessedResources: this.getTopAccessedResources(accessLogs),
        securityTrends: this.analyzeSecurityTrends(incidents),
        complianceGaps: this.identifyComplianceGaps(metrics, incidents)
      }
    };
  }

  private getMostActiveUsers(accessLogs: HIPAAAccessLog[]): Array<{userId: string, accessCount: number}> {
    const userAccess = this.groupBy(accessLogs, 'userId');
    return Object.entries(userAccess)
      .map(([userId, accesses]) => ({ userId, accessCount: accesses.length }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);
  }

  private getTopAccessedResources(accessLogs: HIPAAAccessLog[]): Array<{resource: string, accessCount: number}> {
    const resourceAccess = this.groupBy(accessLogs, 'resource');
    return Object.entries(resourceAccess)
      .map(([resource, accesses]) => ({ resource, accessCount: accesses.length }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);
  }

  private analyzeSecurityTrends(incidents: SecurityIncident[]): any {
    return {
      totalIncidents: incidents.length,
      trendDirection: incidents.length > 0 ? 'INCREASING' : 'STABLE',
      mostCommonType: this.getMostCommonIncidentType(incidents)
    };
  }

  private getMostCommonIncidentType(incidents: SecurityIncident[]): string {
    if (incidents.length === 0) return 'NONE';
    
    const typeCount = this.groupIncidentsByType(incidents);
    return Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  private identifyComplianceGaps(metrics: ComplianceMetrics, incidents: SecurityIncident[]): string[] {
    const gaps: string[] = [];

    if (incidents.filter(i => i.severity === 'CRITICAL').length > 0) {
      gaps.push('Critical security incidents require immediate attention');
    }

    if (metrics.accessMetrics.failedLogins / metrics.accessMetrics.totalLogins > 0.1) {
      gaps.push('High rate of failed login attempts indicates potential security issues');
    }

    if (metrics.securityMetrics.mfaEnrollments < metrics.userActivity.totalUsers * 0.5) {
      gaps.push('Low MFA enrollment rate may not meet security requirements');
    }

    return gaps;
  }
}