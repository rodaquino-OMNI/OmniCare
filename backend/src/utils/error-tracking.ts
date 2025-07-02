/**
 * Error Tracking and Analytics System
 * Provides comprehensive error monitoring and analytics
 */

import { AppError, ErrorCategory, ErrorSeverity } from './error-transformer';
import logger from './logger';

/**
 * Error Event for tracking
 */
export interface ErrorEvent {
  id: string;
  timestamp: Date;
  error: AppError;
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    [key: string]: unknown;
  };
  environment: string;
  version: string;
  stackTrace?: string;
  fingerprint?: string;
}

/**
 * Error Metrics
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCode: Record<string, number>;
  errorRate: number;
  meanTimeToResolve?: number;
  topErrors: Array<{
    code: string;
    count: number;
    lastSeen: Date;
    message: string;
  }>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Error Alert Configuration
 */
export interface AlertConfig {
  id: string;
  name: string;
  conditions: {
    errorCount?: number;
    errorRate?: number;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    timeWindow: number; // in milliseconds
  };
  notifications: {
    email?: string[];
    webhook?: string;
    slack?: {
      webhook: string;
      channel: string;
    };
  };
  enabled: boolean;
}

/**
 * Error Fingerprinting
 */
class ErrorFingerprinter {
  /**
   * Generate fingerprint for error grouping
   */
  static generate(error: AppError, context?: Record<string, unknown>): string {
    const components = [
      error.code,
      error.category,
      this.normalizeMessage(error.message),
      this.getStackSignature(error.stack)
    ];

    // Add contextual information for better grouping
    if (context?.url) {
      components.push(this.normalizeUrl(String(context.url)));
    }

    return this.hash(components.join('|'));
  }

  /**
   * Normalize error message for consistent grouping
   */
  private static normalizeMessage(message: string): string {
    return message
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/\b\w+@\w+\.\w+\b/g, 'EMAIL') // Replace emails
      .toLowerCase();
  }

  /**
   * Get stack trace signature
   */
  private static getStackSignature(stack?: string): string {
    if (!stack) return '';
    
    const lines = stack.split('\n').slice(0, 5); // Top 5 stack frames
    return lines
      .map(line => line.replace(/:\d+:\d+/g, ':N:N')) // Normalize line numbers
      .join('|');
  }

  /**
   * Normalize URL for grouping
   */
  private static normalizeUrl(url: string): string {
    return url
      .replace(/\/\d+/g, '/N') // Replace numeric path segments
      .replace(/[?&]\w+=[^&]*/g, '') // Remove query parameters
      .toLowerCase();
  }

  /**
   * Simple hash function
   */
  private static hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Error Tracker
 */
export class ErrorTracker {
  private errors: ErrorEvent[] = [];
  private maxErrors = 10000; // Keep last 10k errors in memory
  private alerts: AlertConfig[] = [];
  private alertTimers = new Map<string, NodeJS.Timeout>();

  constructor(private environment: string = process.env.NODE_ENV || 'development') {}

  /**
   * Track an error
   */
  track(
    error: AppError,
    context?: Record<string, unknown>
  ): void {
    const errorEvent: ErrorEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      error,
      context: context || {},
      environment: this.environment,
      version: process.env.APP_VERSION || '1.0.0',
      stackTrace: error.stack,
      fingerprint: ErrorFingerprinter.generate(error, context)
    };

    // Add to collection
    this.errors.unshift(errorEvent);
    
    // Trim if exceeding max size
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log the error
    this.logError(errorEvent);

    // Check alerts
    this.checkAlerts(errorEvent);

    // Send to external services if configured
    this.sendToExternalServices(errorEvent);
  }

  /**
   * Log error event
   */
  private logError(errorEvent: ErrorEvent): void {
    const logData = {
      errorId: errorEvent.id,
      fingerprint: errorEvent.fingerprint,
      code: errorEvent.error.code,
      category: errorEvent.error.category,
      severity: errorEvent.error.severity,
      context: errorEvent.context
    };

    logger.error(errorEvent.error.message, logData);
  }

  /**
   * Get error metrics for a time range
   */
  getMetrics(timeRange?: { start: Date; end: Date }): ErrorMetrics {
    const start = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = timeRange?.end || new Date();

    const filteredErrors = this.errors.filter(
      event => event.timestamp >= start && event.timestamp <= end
    );

    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;
    const errorsByCode: Record<string, number> = {};

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    filteredErrors.forEach(event => {
      errorsByCategory[event.error.category]++;
      errorsBySeverity[event.error.severity]++;
      errorsByCode[event.error.code] = (errorsByCode[event.error.code] || 0) + 1;
    });

    // Calculate error rate (errors per hour)
    const timeRangeHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const errorRate = timeRangeHours > 0 ? filteredErrors.length / timeRangeHours : 0;

    // Get top errors
    const topErrors = Object.entries(errorsByCode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, count]) => {
        const latestError = filteredErrors.find(e => e.error.code === code);
        return {
          code,
          count,
          lastSeen: latestError?.timestamp || new Date(),
          message: latestError?.error.message || 'Unknown'
        };
      });

    return {
      totalErrors: filteredErrors.length,
      errorsByCategory,
      errorsBySeverity,
      errorsByCode,
      errorRate,
      topErrors,
      timeRange: { start, end }
    };
  }

  /**
   * Get grouped errors by fingerprint
   */
  getGroupedErrors(limit = 50): Array<{
    fingerprint: string;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    error: AppError;
    recentEvents: ErrorEvent[];
  }> {
    const groups = new Map<string, ErrorEvent[]>();

    // Group by fingerprint
    this.errors.forEach(event => {
      if (!event.fingerprint) return;
      
      const existing = groups.get(event.fingerprint) || [];
      existing.push(event);
      groups.set(event.fingerprint, existing);
    });

    // Convert to array and sort by count
    return Array.from(groups.entries())
      .map(([fingerprint, events]) => {
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const firstEvent = events[events.length - 1];
        const lastEvent = events[0];
        
        if (!firstEvent || !lastEvent) {
          return null; // Skip empty event groups
        }
        
        return {
          fingerprint,
          count: events.length,
          firstSeen: firstEvent.timestamp,
          lastSeen: lastEvent.timestamp,
          error: lastEvent.error,
          recentEvents: events.slice(0, 5)
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Add alert configuration
   */
  addAlert(config: AlertConfig): void {
    this.alerts.push(config);
  }

  /**
   * Remove alert
   */
  removeAlert(alertId: string): boolean {
    const index = this.alerts.findIndex(alert => alert.id === alertId);
    if (index >= 0) {
      this.alerts.splice(index, 1);
      // Clear any active timer
      const timer = this.alertTimers.get(alertId);
      if (timer) {
        clearTimeout(timer);
        this.alertTimers.delete(alertId);
      }
      return true;
    }
    return false;
  }

  /**
   * Check alerts for new error
   */
  private checkAlerts(errorEvent: ErrorEvent): void {
    this.alerts
      .filter(alert => alert.enabled)
      .forEach(alert => {
        if (this.shouldTriggerAlert(alert, errorEvent)) {
          this.triggerAlert(alert, errorEvent);
        }
      });
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(alert: AlertConfig, errorEvent: ErrorEvent): boolean {
    const { conditions } = alert;
    const { error } = errorEvent;

    // Check category filter
    if (conditions.category && error.category !== conditions.category) {
      return false;
    }

    // Check severity filter
    if (conditions.severity && error.severity !== conditions.severity) {
      return false;
    }

    // Check error count in time window
    if (conditions.errorCount) {
      const windowStart = new Date(Date.now() - conditions.timeWindow);
      const recentErrors = this.errors.filter(
        e => e.timestamp >= windowStart &&
             (!conditions.category || e.error.category === conditions.category) &&
             (!conditions.severity || e.error.severity === conditions.severity)
      );
      
      if (recentErrors.length < conditions.errorCount) {
        return false;
      }
    }

    // Check error rate
    if (conditions.errorRate) {
      const windowStart = new Date(Date.now() - conditions.timeWindow);
      const recentErrors = this.errors.filter(e => e.timestamp >= windowStart);
      const hours = conditions.timeWindow / (1000 * 60 * 60);
      const currentRate = recentErrors.length / hours;
      
      if (currentRate < conditions.errorRate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger alert
   */
  private triggerAlert(alert: AlertConfig, errorEvent: ErrorEvent): void {
    // Prevent duplicate alerts within 5 minutes
    const alertKey = `${alert.id}-${errorEvent.fingerprint}`;
    const lastAlert = this.alertTimers.get(alertKey);
    
    if (lastAlert) {
      return; // Alert already sent recently
    }

    logger.warn(`Alert triggered: ${alert.name}`, {
      alertId: alert.id,
      errorId: errorEvent.id,
      fingerprint: errorEvent.fingerprint
    });

    // Send notifications
    this.sendAlertNotifications(alert, errorEvent);

    // Set timer to prevent duplicate alerts
    const timer = setTimeout(() => {
      this.alertTimers.delete(alertKey);
    }, 5 * 60 * 1000); // 5 minutes
    
    this.alertTimers.set(alertKey, timer);
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: AlertConfig, errorEvent: ErrorEvent): Promise<void> {
    const { notifications } = alert;

    // Email notifications (would integrate with email service)
    if (notifications.email && notifications.email.length > 0) {
      logger.info('Would send email alert', {
        recipients: notifications.email,
        subject: `Alert: ${alert.name}`,
        errorId: errorEvent.id
      });
    }

    // Webhook notifications
    if (notifications.webhook) {
      try {
        // Would make HTTP request to webhook
        logger.info('Would send webhook alert', {
          webhook: notifications.webhook,
          errorId: errorEvent.id
        });
      } catch (error) {
        logger.error('Failed to send webhook alert', { error: String(error) });
      }
    }

    // Slack notifications
    if (notifications.slack) {
      try {
        // Would send to Slack
        logger.info('Would send Slack alert', {
          webhook: notifications.slack.webhook,
          channel: notifications.slack.channel,
          errorId: errorEvent.id
        });
      } catch (error) {
        logger.error('Failed to send Slack alert', { error: String(error) });
      }
    }
  }

  /**
   * Send to external monitoring services
   */
  private sendToExternalServices(errorEvent: ErrorEvent): void {
    // Integration points for external services like Sentry, DataDog, etc.
    // This would be implemented based on the specific service
    
    if (process.env.SENTRY_DSN) {
      // Would send to Sentry
      logger.debug('Would send to Sentry', { errorId: errorEvent.id });
    }

    if (process.env.DATADOG_API_KEY) {
      // Would send to DataDog
      logger.debug('Would send to DataDog', { errorId: errorEvent.id });
    }
  }

  /**
   * Clear old errors
   */
  clearOldErrors(olderThan: Date): number {
    const initialCount = this.errors.length;
    this.errors = this.errors.filter(error => error.timestamp >= olderThan);
    const removedCount = initialCount - this.errors.length;
    
    if (removedCount > 0) {
      logger.info(`Cleared ${removedCount} old errors`);
    }
    
    return removedCount;
  }

  /**
   * Get error by ID
   */
  getError(id: string): ErrorEvent | undefined {
    return this.errors.find(error => error.id === id);
  }

  /**
   * Search errors
   */
  searchErrors(query: {
    code?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    message?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
  }): ErrorEvent[] {
    let filtered = this.errors;

    if (query.code) {
      filtered = filtered.filter(e => e.error.code === query.code);
    }

    if (query.category) {
      filtered = filtered.filter(e => e.error.category === query.category);
    }

    if (query.severity) {
      filtered = filtered.filter(e => e.error.severity === query.severity);
    }

    if (query.message) {
      const searchTerm = query.message.toLowerCase();
      filtered = filtered.filter(e => 
        e.error.message.toLowerCase().includes(searchTerm)
      );
    }

    if (query.timeRange) {
      filtered = filtered.filter(e => 
        e.timestamp >= query.timeRange!.start && 
        e.timestamp <= query.timeRange!.end
      );
    }

    return filtered.slice(0, query.limit || 100);
  }

  /**
   * Export errors for analysis
   */
  exportErrors(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'code', 'category', 'severity', 'message', 'fingerprint'];
      const rows = this.errors.map(e => [
        e.id,
        e.timestamp.toISOString(),
        e.error.code,
        e.error.category,
        e.error.severity,
        e.error.message.replace(/,/g, ';'), // Escape commas
        e.fingerprint || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(this.errors, null, 2);
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

/**
 * Middleware for automatic error tracking
 */
export function errorTrackingMiddleware(
  tracker: ErrorTracker = errorTracker
) {
  return (error: unknown, req?: any, res?: any, next?: any) => {
    if (error instanceof AppError) {
      const context = req ? {
        requestId: req.id,
        userId: req.user?.id,
        sessionId: req.sessionID,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection?.remoteAddress
      } : {};

      tracker.track(error, context);
    }

    if (next) {
      next(error);
    }
  };
}

/**
 * Express middleware for error tracking
 */
export function expressErrorTrackingMiddleware(
  tracker: ErrorTracker = errorTracker
) {
  return (error: any, req: any, res: any, next: any) => {
    errorTrackingMiddleware(tracker)(error, req, res, next);
  };
}