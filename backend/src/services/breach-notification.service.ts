/**
 * OmniCare EMR Backend - Breach Notification Service
 * HIPAA-Compliant Breach Detection and Notification System
 */

import { EventEmitter } from 'events';

import { auditService } from './audit.service';
import { dataIntegrityService } from './data-integrity.service';

import logger from '@/utils/logger';

export interface BreachIncident {
  id: string;
  type: 'unauthorized_access' | 'data_theft' | 'system_intrusion' | 'insider_threat' | 'accidental_disclosure' | 'device_loss' | 'ransomware' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'investigating' | 'confirmed' | 'contained' | 'mitigated' | 'resolved' | 'false_positive';
  detectionTime: Date;
  discoveryTime?: Date;
  containmentTime?: Date;
  resolutionTime?: Date;
  affectedPatients: string[];
  affectedRecords: number;
  dataTypes: string[];
  description: string;
  cause?: string;
  impact: BreachImpact;
  notification: BreachNotificationStatus;
  investigation: BreachInvestigation;
  remediation: BreachRemediation;
  compliance: BreachCompliance;
  reportedBy: string;
  assignedTo?: string;
  organizationContact: string;
  externalEntities?: string[];
}

export interface BreachImpact {
  estimatedRecordsAffected: number;
  dataTypesInvolved: string[];
  geographicScope: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  systemsAffected: string[];
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  riskAssessment: 'low' | 'medium' | 'high' | 'critical';
}

export interface BreachNotificationStatus {
  patientsNotified: boolean;
  patientsNotificationDate?: Date;
  mediaNotified: boolean;
  mediaNotificationDate?: Date;
  hhsReported: boolean;
  hhsReportDate?: Date;
  hhsControlNumber?: string;
  attorneyNotified: boolean;
  insuranceNotified: boolean;
  lawEnforcementNotified: boolean;
  businessAssociatesNotified: boolean;
  notificationMethod: 'mail' | 'email' | 'phone' | 'substitute_notice' | 'web_posting';
  notificationContent?: string;
}

export interface BreachInvestigation {
  status: 'not_started' | 'in_progress' | 'completed' | 'escalated';
  assignedInvestigator?: string;
  investigationStartDate?: Date;
  investigationEndDate?: Date;
  findings: string[];
  evidenceCollected: string[];
  interviews: Array<{
    person: string;
    date: Date;
    summary: string;
  }>;
  timeline: Array<{
    timestamp: Date;
    event: string;
    source: string;
  }>;
  rootCause?: string;
  contributingFactors: string[];
}

export interface BreachRemediation {
  status: 'not_started' | 'in_progress' | 'completed';
  immediateActions: Array<{
    action: string;
    completedDate?: Date;
    responsible: string;
  }>;
  longTermActions: Array<{
    action: string;
    targetDate: Date;
    completedDate?: Date;
    responsible: string;
  }>;
  preventiveMeasures: string[];
  costEstimate?: number;
  actualCost?: number;
}

export interface BreachCompliance {
  hipaaViolationType: 'privacy' | 'security' | 'both';
  reportingDeadlineMet: boolean;
  notificationDeadlineMet: boolean;
  reportingDeadline: Date;
  notificationDeadline: Date;
  regulatoryRequirements: string[];
  complianceGaps: string[];
  mitigatingFactors: string[];
}

export interface BreachPattern {
  patternType: 'time_based' | 'user_based' | 'location_based' | 'data_type_based';
  description: string;
  occurrences: number;
  timeFrame: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedActions: string[];
}

export interface ComplianceDashboard {
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  averageResolutionTime: number;
  complianceScore: number;
  reportingCompliance: number;
  recentTrends: BreachPattern[];
  upcomingDeadlines: Array<{
    incidentId: string;
    deadline: Date;
    type: 'investigation' | 'notification' | 'reporting';
  }>;
  riskIndicators: Array<{
    indicator: string;
    level: 'green' | 'yellow' | 'red';
    trend: 'improving' | 'stable' | 'deteriorating';
  }>;
}

export class BreachNotificationService extends EventEmitter {
  private incidents: Map<string, BreachIncident> = new Map();
  private patterns: BreachPattern[] = [];
  private readonly notificationThresholds = {
    patientNotification: 500, // Number of affected individuals
    mediaNotification: 500,
    hhsReporting: 1, // Report all breaches to HHS
    immediateNotification: 1000 // Critical threshold for immediate notification
  };

  constructor() {
    super();
    this.initializeMonitoring();
  }

  /**
   * Detect potential breach from security events
   */
  async detectBreach(
    event: any,
    userId: string,
    affectedPatients: string[],
    dataTypes: string[]
  ): Promise<BreachIncident | null> {
    // Analyze event for breach indicators
    const suspiciousPatterns = [
      affectedPatients.length > 10,
      dataTypes.some(type => ['SSN', 'financial', 'medical_records'].includes(type)),
      event.action?.includes('export') || event.action?.includes('download'),
      event.timestamp && this.isAfterHours(new Date(event.timestamp)),
      event.ipAddress && this.isSuspiciousLocation(event.ipAddress),
      event.userAgent && this.isSuspiciousUserAgent(event.userAgent)
    ];

    const suspiciousScore = suspiciousPatterns.filter(Boolean).length;
    
    if (suspiciousScore >= 3) {
      const incident = await this.createBreachIncident({
        type: this.classifyBreachType(event),
        severity: this.calculateSeverity(affectedPatients.length, dataTypes),
        affectedPatients,
        dataTypes,
        description: `Potential breach detected: ${event.action} by user ${userId}`,
        reportedBy: 'system',
        event
      });

      return incident;
    }

    return null;
  }

  /**
   * Create a new breach incident
   */
  async createBreachIncident(params: {
    type: BreachIncident['type'];
    severity: BreachIncident['severity'];
    affectedPatients: string[];
    dataTypes: string[];
    description: string;
    reportedBy: string;
    event?: any;
    cause?: string;
  }): Promise<BreachIncident> {
    const now = new Date();
    const incidentId = `breach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const incident: BreachIncident = {
      id: incidentId,
      type: params.type,
      severity: params.severity,
      status: 'detected',
      detectionTime: now,
      affectedPatients: params.affectedPatients,
      affectedRecords: params.affectedPatients.length,
      dataTypes: params.dataTypes,
      description: params.description,
      cause: params.cause,
      impact: this.calculateImpact(params.affectedPatients, params.dataTypes),
      notification: this.initializeNotificationStatus(),
      investigation: this.initializeInvestigation(params.reportedBy),
      remediation: this.initializeRemediation(),
      compliance: this.calculateCompliance(params.affectedPatients.length),
      reportedBy: params.reportedBy,
      organizationContact: 'compliance@omnicare.com'
    };

    // Store incident
    this.incidents.set(incidentId, incident);

    // Log breach detection
    await auditService.logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      severity: incident.severity.toUpperCase() as any,
      description: `Breach incident created: ${incident.description}`,
      metadata: {
        incidentId,
        affectedPatients: incident.affectedPatients.length,
        dataTypes: incident.dataTypes,
        severity: incident.severity
      }
    });

    // Emit breach detected event
    this.emit('breachDetected', incident);

    // Auto-escalate critical incidents
    if (incident.severity === 'critical') {
      await this.escalateIncident(incidentId);
    }

    // Check if immediate notification required
    if (incident.affectedRecords >= this.notificationThresholds.immediateNotification) {
      await this.triggerImmediateNotification(incident);
    }

    logger.error('Breach incident created', {
      incidentId,
      severity: incident.severity,
      affectedRecords: incident.affectedRecords,
      type: incident.type
    });

    return incident;
  }

  /**
   * Update incident status and timeline
   */
  async updateIncident(incidentId: string, updates: Partial<BreachIncident>): Promise<BreachIncident | null> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    const updatedIncident = { ...incident, ...updates };
    
    // Update timestamps based on status
    if (updates.status) {
      switch (updates.status) {
        case 'investigating':
          updatedIncident.discoveryTime = new Date();
          break;
        case 'contained':
          updatedIncident.containmentTime = new Date();
          break;
        case 'resolved':
          updatedIncident.resolutionTime = new Date();
          break;
      }
    }

    this.incidents.set(incidentId, updatedIncident);

    // Log status update
    await auditService.logUserAction(
      updates.assignedTo || incident.reportedBy,
      'breach_incident_update',
      'breach_incident',
      incidentId,
      '0.0.0.0',
      'breach-notification-service',
      true,
      undefined,
      {
        previousStatus: incident.status,
        newStatus: updates.status,
        updates: Object.keys(updates)
      }
    );

    this.emit('incidentUpdated', updatedIncident);
    return updatedIncident;
  }

  /**
   * Escalate incident to management and legal
   */
  async escalateIncident(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    // Auto-assign to compliance officer
    await this.updateIncident(incidentId, {
      assignedTo: 'compliance_officer',
      status: 'investigating'
    });

    // Send escalation notifications
    await this.sendEscalationNotifications(incident);

    // Log escalation
    await auditService.logSecurityEvent({
      type: 'SYSTEM_CONFIGURATION_CHANGE',
      severity: 'HIGH',
      description: `Breach incident ${incidentId} escalated due to ${incident.severity} severity`,
      metadata: { incidentId, reason: 'automatic_escalation' }
    });
  }

  /**
   * Execute notification workflow
   */
  async executeNotificationWorkflow(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const notifications = [];

    // Patient notification (required if > threshold)
    if (incident.affectedRecords >= this.notificationThresholds.patientNotification) {
      notifications.push(this.notifyPatients(incident));
    }

    // Media notification (required if > threshold)
    if (incident.affectedRecords >= this.notificationThresholds.mediaNotification) {
      notifications.push(this.notifyMedia(incident));
    }

    // HHS reporting (required for all breaches)
    notifications.push(this.reportToHHS(incident));

    // Execute notifications
    await Promise.all(notifications);
  }

  /**
   * Generate compliance dashboard
   */
  generateComplianceDashboard(): ComplianceDashboard {
    const incidents = Array.from(this.incidents.values());
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const openIncidents = incidents.filter(i => 
      !['resolved', 'false_positive'].includes(i.status)
    );

    const criticalIncidents = incidents.filter(i => 
      i.severity === 'critical' && !['resolved', 'false_positive'].includes(i.status)
    );

    const recentIncidents = incidents.filter(i => 
      i.detectionTime >= thirtyDaysAgo
    );

    const resolvedIncidents = incidents.filter(i => 
      i.status === 'resolved' && i.resolutionTime
    );

    const averageResolutionTime = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, incident) => {
          const resolution = incident.resolutionTime!.getTime() - incident.detectionTime.getTime();
          return sum + resolution;
        }, 0) / resolvedIncidents.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    return {
      totalIncidents: incidents.length,
      openIncidents: openIncidents.length,
      criticalIncidents: criticalIncidents.length,
      averageResolutionTime,
      complianceScore: this.calculateComplianceScore(incidents),
      reportingCompliance: this.calculateReportingCompliance(incidents),
      recentTrends: this.analyzeBreachPatterns(recentIncidents),
      upcomingDeadlines: this.getUpcomingDeadlines(openIncidents),
      riskIndicators: this.calculateRiskIndicators(incidents)
    };
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(incidents: BreachIncident[]): number {
    if (incidents.length === 0) return 100;

    const factors = {
      timelyReporting: incidents.filter(i => i.compliance.reportingDeadlineMet).length / incidents.length * 30,
      timelyNotification: incidents.filter(i => i.compliance.notificationDeadlineMet).length / incidents.length * 30,
      properInvestigation: incidents.filter(i => i.investigation.status === 'completed').length / incidents.length * 20,
      adequateRemediation: incidents.filter(i => i.remediation.status === 'completed').length / incidents.length * 20
    };

    return Math.round(Object.values(factors).reduce((sum, val) => sum + val, 0));
  }

  /**
   * Calculate reporting compliance percentage
   */
  private calculateReportingCompliance(incidents: BreachIncident[]): number {
    if (incidents.length === 0) return 100;
    
    const reported = incidents.filter(i => i.notification.hhsReported).length;
    return Math.round((reported / incidents.length) * 100);
  }

  /**
   * Analyze breach patterns
   */
  private analyzeBreachPatterns(incidents: BreachIncident[]): BreachPattern[] {
    const patterns: BreachPattern[] = [];

    // Time-based patterns
    const timePattern = this.analyzeTimePattern(incidents);
    if (timePattern) patterns.push(timePattern);

    // Data type patterns
    const dataPattern = this.analyzeDataTypePattern(incidents);
    if (dataPattern) patterns.push(dataPattern);

    return patterns;
  }

  /**
   * Get upcoming compliance deadlines
   */
  private getUpcomingDeadlines(incidents: BreachIncident[]): ComplianceDashboard['upcomingDeadlines'] {
    const deadlines: ComplianceDashboard['upcomingDeadlines'] = [];
    const now = new Date();

    incidents.forEach(incident => {
      // Investigation deadline (30 days from detection)
      if (incident.investigation.status !== 'completed') {
        const investigationDeadline = new Date(incident.detectionTime.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (investigationDeadline > now) {
          deadlines.push({
            incidentId: incident.id,
            deadline: investigationDeadline,
            type: 'investigation'
          });
        }
      }

      // Notification deadline
      if (!incident.notification.patientsNotified && incident.affectedRecords >= this.notificationThresholds.patientNotification) {
        deadlines.push({
          incidentId: incident.id,
          deadline: incident.compliance.notificationDeadline,
          type: 'notification'
        });
      }

      // HHS reporting deadline
      if (!incident.notification.hhsReported) {
        deadlines.push({
          incidentId: incident.id,
          deadline: incident.compliance.reportingDeadline,
          type: 'reporting'
        });
      }
    });

    return deadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  }

  /**
   * Calculate risk indicators
   */
  private calculateRiskIndicators(incidents: BreachIncident[]): ComplianceDashboard['riskIndicators'] {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    
    const recentIncidents = incidents.filter(i => i.detectionTime >= thirtyDaysAgo);
    const olderIncidents = incidents.filter(i => i.detectionTime >= sixtyDaysAgo && i.detectionTime < thirtyDaysAgo);

    return [
      {
        indicator: 'Incident Frequency',
        level: recentIncidents.length > 5 ? 'red' : recentIncidents.length > 2 ? 'yellow' : 'green',
        trend: recentIncidents.length > olderIncidents.length ? 'deteriorating' : 
               recentIncidents.length < olderIncidents.length ? 'improving' : 'stable'
      },
      {
        indicator: 'Critical Incidents',
        level: recentIncidents.filter(i => i.severity === 'critical').length > 0 ? 'red' : 'green',
        trend: 'stable'
      },
      {
        indicator: 'Resolution Time',
        level: this.calculateComplianceScore(incidents) < 70 ? 'red' : 
               this.calculateComplianceScore(incidents) < 85 ? 'yellow' : 'green',
        trend: 'stable'
      }
    ];
  }

  /**
   * Initialize notification status
   */
  private initializeNotificationStatus(): BreachNotificationStatus {
    return {
      patientsNotified: false,
      mediaNotified: false,
      hhsReported: false,
      attorneyNotified: false,
      insuranceNotified: false,
      lawEnforcementNotified: false,
      businessAssociatesNotified: false,
      notificationMethod: 'mail'
    };
  }

  /**
   * Initialize investigation
   */
  private initializeInvestigation(reportedBy: string): BreachInvestigation {
    return {
      status: 'not_started',
      investigationStartDate: new Date(),
      findings: [],
      evidenceCollected: [],
      interviews: [],
      timeline: [{
        timestamp: new Date(),
        event: 'Incident reported',
        source: reportedBy
      }],
      contributingFactors: []
    };
  }

  /**
   * Initialize remediation
   */
  private initializeRemediation(): BreachRemediation {
    return {
      status: 'not_started',
      immediateActions: [],
      longTermActions: [],
      preventiveMeasures: []
    };
  }

  /**
   * Calculate impact assessment
   */
  private calculateImpact(affectedPatients: string[], dataTypes: string[]): BreachImpact {
    return {
      estimatedRecordsAffected: affectedPatients.length,
      dataTypesInvolved: dataTypes,
      geographicScope: ['United States'], // Default scope
      timeRange: {
        start: new Date(),
        end: new Date()
      },
      systemsAffected: ['EMR System'],
      businessImpact: affectedPatients.length > 1000 ? 'critical' : 
                     affectedPatients.length > 100 ? 'high' : 
                     affectedPatients.length > 10 ? 'medium' : 'low',
      riskAssessment: dataTypes.some(type => ['SSN', 'financial'].includes(type)) ? 'high' : 'medium'
    };
  }

  /**
   * Calculate compliance requirements
   */
  private calculateCompliance(affectedRecords: number): BreachCompliance {
    const now = new Date();
    return {
      hipaaViolationType: 'both',
      reportingDeadlineMet: false,
      notificationDeadlineMet: false,
      reportingDeadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days
      notificationDeadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days
      regulatoryRequirements: [
        'HIPAA Privacy Rule § 164.408',
        'HIPAA Security Rule § 164.308',
        'State breach notification laws'
      ],
      complianceGaps: [],
      mitigatingFactors: []
    };
  }

  /**
   * Helper methods for breach analysis
   */
  private classifyBreachType(event: any): BreachIncident['type'] {
    if (event.action?.includes('unauthorized')) return 'unauthorized_access';
    if (event.action?.includes('export') || event.action?.includes('download')) return 'data_theft';
    if (event.userAgent?.includes('suspicious')) return 'system_intrusion';
    return 'other';
  }

  private calculateSeverity(affectedCount: number, dataTypes: string[]): BreachIncident['severity'] {
    if (affectedCount > 1000 || dataTypes.includes('SSN')) return 'critical';
    if (affectedCount > 100 || dataTypes.includes('financial')) return 'high';
    if (affectedCount > 10) return 'medium';
    return 'low';
  }

  private isAfterHours(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    return hour < 6 || hour > 20;
  }

  private isSuspiciousLocation(ipAddress: string): boolean {
    // Placeholder for IP geolocation checking
    return false;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    // Placeholder for user agent analysis
    return userAgent?.includes('suspicious') || false;
  }

  private analyzeTimePattern(incidents: BreachIncident[]): BreachPattern | null {
    const afterHoursIncidents = incidents.filter(i => this.isAfterHours(i.detectionTime));
    
    if (afterHoursIncidents.length > incidents.length * 0.3) {
      return {
        patternType: 'time_based',
        description: 'High frequency of after-hours incidents detected',
        occurrences: afterHoursIncidents.length,
        timeFrame: '30 days',
        riskLevel: 'high',
        recommendedActions: ['Implement stricter after-hours access controls', 'Enhance monitoring during off-hours']
      };
    }
    
    return null;
  }

  private analyzeDataTypePattern(incidents: BreachIncident[]): BreachPattern | null {
    const sensitiveDataIncidents = incidents.filter(i => 
      i.dataTypes.some(type => ['SSN', 'financial'].includes(type))
    );
    
    if (sensitiveDataIncidents.length > incidents.length * 0.5) {
      return {
        patternType: 'data_type_based',
        description: 'High frequency of sensitive data breaches',
        occurrences: sensitiveDataIncidents.length,
        timeFrame: '30 days',
        riskLevel: 'critical',
        recommendedActions: ['Enhanced encryption for sensitive data', 'Additional access controls for financial/SSN data']
      };
    }
    
    return null;
  }

  private async sendEscalationNotifications(incident: BreachIncident): Promise<void> {
    // Placeholder for actual notification implementation
    logger.info('Breach escalation notifications sent', { incidentId: incident.id });
  }

  private async notifyPatients(incident: BreachIncident): Promise<void> {
    // Placeholder for patient notification
    await this.updateIncident(incident.id, {
      notification: {
        ...incident.notification,
        patientsNotified: true,
        patientsNotificationDate: new Date()
      }
    });
  }

  private async notifyMedia(incident: BreachIncident): Promise<void> {
    // Placeholder for media notification
    await this.updateIncident(incident.id, {
      notification: {
        ...incident.notification,
        mediaNotified: true,
        mediaNotificationDate: new Date()
      }
    });
  }

  private async reportToHHS(incident: BreachIncident): Promise<void> {
    // Placeholder for HHS reporting
    await this.updateIncident(incident.id, {
      notification: {
        ...incident.notification,
        hhsReported: true,
        hhsReportDate: new Date(),
        hhsControlNumber: `HHS-${Date.now()}`
      }
    });
  }

  private async triggerImmediateNotification(incident: BreachIncident): Promise<void> {
    // Immediate notification for critical breaches
    logger.error('Critical breach - immediate notification triggered', {
      incidentId: incident.id,
      affectedRecords: incident.affectedRecords
    });
    
    await this.executeNotificationWorkflow(incident.id);
  }

  private initializeMonitoring(): void {
    // Listen to audit service events
    auditService.on('breachDetected', (breach) => {
      this.detectBreach(breach, breach.userId, [breach.patientId], [breach.dataType]);
    });

    // Listen to data integrity events
    dataIntegrityService.on('integrityFailure', (failure) => {
      this.detectBreach(failure, 'system', [], ['integrity_check']);
    });
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): BreachIncident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): BreachIncident | null {
    return this.incidents.get(incidentId) || null;
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
  }
}

// Export singleton instance
export const breachNotificationService = new BreachNotificationService();