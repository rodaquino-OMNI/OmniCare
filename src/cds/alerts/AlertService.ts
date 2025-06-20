/**
 * OmniCare Alert Service
 * 
 * Central alert management system for real-time clinical notifications
 * Coordinates alerts from all CDS components and manages alert lifecycle
 */

import {
  Alert,
  Patient,
  Medication,
  DrugInteraction,
  AllergyAlert,
  RiskScore,
  CDSCard,
  CDSConfiguration
} from '../types/CDSTypes';

// Alert subscription interface
interface AlertSubscription {
  subscriberId: string;
  alertTypes: string[];
  severity: ('Info' | 'Warning' | 'Critical')[];
  callback: (alert: Alert) => void;
  filters?: AlertFilter[];
}

// Alert filtering
interface AlertFilter {
  type: 'patient' | 'provider' | 'department' | 'condition' | 'medication';
  values: string[];
}

// Alert statistics
interface AlertStatistics {
  totalAlerts: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  dismissalRate: number;
  averageResponseTime: number;
  topDismissalReasons: Array<{ reason: string; count: number }>;
}

export class AlertService {
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private subscriptions: Map<string, AlertSubscription> = new Map();
  private config: CDSConfiguration;
  private alertQueue: Alert[] = [];
  private processingQueue = false;

  constructor(config: CDSConfiguration) {
    this.config = config;
    this.startAlertProcessor();
  }

  /**
   * Create and queue a new alert
   */
  async createAlert(alertData: Partial<Alert>): Promise<Alert> {
    const alert: Alert = {
      alertId: alertData.alertId || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId: alertData.patientId!,
      alertType: alertData.alertType!,
      severity: alertData.severity!,
      title: alertData.title!,
      message: alertData.message!,
      timestamp: new Date(),
      source: alertData.source!,
      actionable: alertData.actionable !== false,
      dismissed: false,
      relatedData: alertData.relatedData
    };

    // Add to queue for processing
    this.alertQueue.push(alert);
    
    // Start processing if not already running
    if (!this.processingQueue) {
      this.processAlertQueue();
    }

    return alert;
  }

  /**
   * Create drug interaction alert
   */
  async createDrugInteractionAlert(
    patientId: string, 
    interaction: DrugInteraction
  ): Promise<Alert> {
    return this.createAlert({
      patientId,
      alertType: 'Drug Interaction',
      severity: this.mapInteractionSeverityToAlertSeverity(interaction.severity),
      title: `Drug Interaction: ${interaction.drug1} + ${interaction.drug2}`,
      message: `${interaction.severity} interaction detected. ${interaction.effect}`,
      source: 'Drug Interaction Service',
      relatedData: interaction
    });
  }

  /**
   * Create allergy alert
   */
  async createAllergyAlert(
    patientId: string, 
    allergyAlert: AllergyAlert
  ): Promise<Alert> {
    return this.createAlert({
      patientId,
      alertType: 'Allergy',
      severity: this.mapAllergySeverityToAlertSeverity(allergyAlert.severity),
      title: `Allergy Alert: ${allergyAlert.allergen}`,
      message: allergyAlert.message,
      source: 'Allergy Alert Service',
      relatedData: allergyAlert
    });
  }

  /**
   * Create risk score alert
   */
  async createRiskScoreAlert(
    patientId: string, 
    riskScore: RiskScore
  ): Promise<Alert> {
    const severity = riskScore.risk === 'Very High' || riskScore.risk === 'High' ? 'Critical' : 
                    riskScore.risk === 'Intermediate' ? 'Warning' : 'Info';

    return this.createAlert({
      patientId,
      alertType: 'Risk Score',
      severity,
      title: `${riskScore.scoreName}: ${riskScore.risk} Risk`,
      message: `${riskScore.scoreName} indicates ${riskScore.risk.toLowerCase()} risk (Score: ${riskScore.score})`,
      source: 'Risk Scoring Service',
      relatedData: riskScore
    });
  }

  /**
   * Create clinical guideline alert
   */
  async createGuidelineAlert(
    patientId: string,
    guidelineName: string,
    recommendation: string,
    severity: 'Info' | 'Warning' | 'Critical' = 'Info'
  ): Promise<Alert> {
    return this.createAlert({
      patientId,
      alertType: 'Clinical Guideline',
      severity,
      title: `Clinical Guideline: ${guidelineName}`,
      message: recommendation,
      source: 'Clinical Guidelines Service'
    });
  }

  /**
   * Create quality measure alert
   */
  async createQualityMeasureAlert(
    patientId: string,
    measureName: string,
    gapDescription: string
  ): Promise<Alert> {
    return this.createAlert({
      patientId,
      alertType: 'Quality Measure',
      severity: 'Info',
      title: `Quality Measure Gap: ${measureName}`,
      message: gapDescription,
      source: 'Quality Measures Service'
    });
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(
    alertId: string, 
    dismissedBy: string, 
    dismissalReason?: string
  ): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.dismissed = true;
    alert.dismissedBy = dismissedBy;
    alert.dismissedAt = new Date();
    alert.dismissalReason = dismissalReason;

    // Move to history
    this.alertHistory.push(alert);
    this.activeAlerts.delete(alertId);

    // Notify subscribers
    this.notifySubscribers(alert);

    return true;
  }

  /**
   * Get active alerts for a patient
   */
  getActiveAlertsForPatient(patientId: string): Alert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.patientId === patientId)
      .sort((a, b) => {
        // Sort by severity, then by timestamp
        const severityOrder = { 'Critical': 3, 'Warning': 2, 'Info': 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(timeRange?: { start: Date; end: Date }): AlertStatistics {
    const alerts = timeRange 
      ? this.alertHistory.filter(a => 
          a.timestamp >= timeRange.start && a.timestamp <= timeRange.end
        )
      : this.alertHistory;

    const totalAlerts = alerts.length;
    const dismissedAlerts = alerts.filter(a => a.dismissed).length;
    
    const alertsByType: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};
    const dismissalReasons: Record<string, number> = {};

    for (const alert of alerts) {
      // Count by type
      alertsByType[alert.alertType] = (alertsByType[alert.alertType] || 0) + 1;
      
      // Count by severity
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      
      // Count dismissal reasons
      if (alert.dismissalReason) {
        dismissalReasons[alert.dismissalReason] = (dismissalReasons[alert.dismissalReason] || 0) + 1;
      }
    }

    const topDismissalReasons = Object.entries(dismissalReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalAlerts,
      alertsByType,
      alertsBySeverity,
      dismissalRate: totalAlerts > 0 ? (dismissedAlerts / totalAlerts) * 100 : 0,
      averageResponseTime: this.calculateAverageResponseTime(alerts),
      topDismissalReasons
    };
  }

  /**
   * Subscribe to alert notifications
   */
  subscribe(subscription: AlertSubscription): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.subscriptions.set(subscriptionId, { ...subscription, subscriberId: subscriptionId });
    return subscriptionId;
  }

  /**
   * Unsubscribe from alert notifications
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Convert alerts to CDS cards
   */
  convertAlertsToCDSCards(alerts: Alert[]): CDSCard[] {
    return alerts.map(alert => ({
      summary: alert.title,
      detail: alert.message,
      indicator: this.mapAlertSeverityToIndicator(alert.severity),
      source: {
        label: alert.source,
        url: `https://omnicare.example.com/alerts/${alert.alertId}`
      },
      suggestions: alert.actionable ? [{
        label: 'Review and take action',
        actions: [{
          type: 'create',
          description: 'Open alert details',
          resource: {
            resourceType: 'Task',
            code: 'review-alert',
            for: alert.patientId
          }
        }]
      }] : [],
      overrideReasons: [
        { code: 'not-applicable', display: 'Not applicable to this patient' },
        { code: 'already-addressed', display: 'Already addressed' },
        { code: 'patient-refuses', display: 'Patient declines recommendation' },
        { code: 'clinical-judgment', display: 'Clinical judgment override' }
      ]
    }));
  }

  /**
   * Alert deduplication
   */
  async deduplicateAlerts(newAlert: Alert): Promise<boolean> {
    const similarAlerts = Array.from(this.activeAlerts.values()).filter(alert =>
      alert.patientId === newAlert.patientId &&
      alert.alertType === newAlert.alertType &&
      alert.title === newAlert.title &&
      !alert.dismissed
    );

    // If similar alert exists and is recent (within 1 hour), don't create duplicate
    const recentSimilar = similarAlerts.find(alert => 
      Date.now() - alert.timestamp.getTime() < 60 * 60 * 1000
    );

    return !recentSimilar;
  }

  /**
   * Auto-dismiss expired alerts
   */
  async cleanupExpiredAlerts(): Promise<void> {
    const expiredAlerts = Array.from(this.activeAlerts.values()).filter(alert => {
      const alertAge = Date.now() - alert.timestamp.getTime();
      const maxAge = this.getMaxAlertAge(alert.alertType);
      return alertAge > maxAge;
    });

    for (const alert of expiredAlerts) {
      await this.dismissAlert(alert.alertId, 'system', 'Auto-dismissed due to age');
    }
  }

  /**
   * Process alert queue
   */
  private async processAlertQueue(): Promise<void> {
    this.processingQueue = true;

    while (this.alertQueue.length > 0) {
      const alert = this.alertQueue.shift()!;
      
      // Check for duplicates
      const shouldCreate = await this.deduplicateAlerts(alert);
      
      if (shouldCreate) {
        // Add to active alerts
        this.activeAlerts.set(alert.alertId, alert);
        
        // Notify subscribers
        this.notifySubscribers(alert);
      }
    }

    this.processingQueue = false;
  }

  /**
   * Notify alert subscribers
   */
  private notifySubscribers(alert: Alert): void {
    for (const subscription of this.subscriptions.values()) {
      // Check if subscriber is interested in this alert type
      if (subscription.alertTypes.includes(alert.alertType)) {
        // Check severity filter
        if (subscription.severity.includes(alert.severity)) {
          // Apply custom filters
          if (this.passesFilters(alert, subscription.filters)) {
            try {
              subscription.callback(alert);
            } catch (error) {
              console.error(`Error notifying subscriber ${subscription.subscriberId}:`, error);
            }
          }
        }
      }
    }
  }

  /**
   * Check if alert passes subscription filters
   */
  private passesFilters(alert: Alert, filters?: AlertFilter[]): boolean {
    if (!filters || filters.length === 0) return true;

    return filters.every(filter => {
      switch (filter.type) {
        case 'patient':
          return filter.values.includes(alert.patientId);
        case 'provider':
          return true; // Would need provider context
        case 'department':
          return true; // Would need department context
        default:
          return true;
      }
    });
  }

  /**
   * Start periodic alert processor
   */
  private startAlertProcessor(): void {
    // Cleanup expired alerts every 30 minutes
    setInterval(() => {
      this.cleanupExpiredAlerts();
    }, 30 * 60 * 1000);
  }

  /**
   * Calculate average response time for alerts
   */
  private calculateAverageResponseTime(alerts: Alert[]): number {
    const dismissedAlerts = alerts.filter(a => a.dismissed && a.dismissedAt);
    
    if (dismissedAlerts.length === 0) return 0;

    const totalResponseTime = dismissedAlerts.reduce((sum, alert) => {
      return sum + (alert.dismissedAt!.getTime() - alert.timestamp.getTime());
    }, 0);

    return totalResponseTime / dismissedAlerts.length / 1000; // Return in seconds
  }

  /**
   * Get maximum alert age based on type
   */
  private getMaxAlertAge(alertType: string): number {
    // Return in milliseconds
    switch (alertType) {
      case 'Drug Interaction':
      case 'Allergy':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'Risk Score':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'Clinical Guideline':
      case 'Quality Measure':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 24 * 60 * 60 * 1000; // 24 hours default
    }
  }

  /**
   * Utility mapping functions
   */
  private mapInteractionSeverityToAlertSeverity(severity: string): 'Info' | 'Warning' | 'Critical' {
    switch (severity) {
      case 'Contraindicated':
      case 'Major':
        return 'Critical';
      case 'Moderate':
        return 'Warning';
      default:
        return 'Info';
    }
  }

  private mapAllergySeverityToAlertSeverity(severity: string): 'Info' | 'Warning' | 'Critical' {
    switch (severity) {
      case 'High':
        return 'Critical';
      case 'Medium':
        return 'Warning';
      default:
        return 'Info';
    }
  }

  private mapAlertSeverityToIndicator(severity: string): 'info' | 'warning' | 'critical' {
    switch (severity) {
      case 'Critical':
        return 'critical';
      case 'Warning':
        return 'warning';
      default:
        return 'info';
    }
  }
}