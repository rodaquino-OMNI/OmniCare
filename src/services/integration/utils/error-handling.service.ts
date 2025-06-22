/**
 * OmniCare EMR - Integration Error Handling Service
 * Handles error management, retry logic, and failure recovery for integration services
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';

export interface IntegrationError {
  id: string;
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  source: string;
  timestamp: Date;
  context?: ErrorContext;
  retryCount: number;
  maxRetries: number;
  status: ErrorStatus;
  resolution?: ErrorResolution;
  stackTrace?: string;
  correlationId?: string;
}

export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  VALIDATION_ERROR = 'validation_error',
  PARSING_ERROR = 'parsing_error',
  TRANSFORMATION_ERROR = 'transformation_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  DUPLICATE_RECORD = 'duplicate_record',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum ErrorCategory {
  SYSTEM = 'system',
  INTEGRATION = 'integration',
  BUSINESS = 'business',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  DATA = 'data'
}

export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ErrorStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  RETRY_SCHEDULED = 'retry_scheduled',
  RETRY_EXHAUSTED = 'retry_exhausted',
  IGNORED = 'ignored',
  ESCALATED = 'escalated'
}

export interface ErrorContext {
  operationId?: string;
  userId?: string;
  patientId?: string;
  sessionId?: string;
  requestId?: string;
  integrationFlow?: string;
  endpoint?: string;
  httpMethod?: string;
  requestPayload?: any;
  responsePayload?: any;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface ErrorResolution {
  resolvedBy: string;
  resolvedAt: Date;
  resolution: string;
  actionsTaken: string[];
  preventionMeasures?: string[];
  followUpRequired?: boolean;
  followUpDate?: Date;
}

export interface RetryConfiguration {
  enabled: boolean;
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  retryableErrors: ErrorType[];
  jitterEnabled: boolean;
  timeoutMs?: number;
}

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  conditions: PatternCondition[];
  actions: PatternAction[];
  priority: number;
  isActive: boolean;
  createdDate: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface PatternCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  caseSensitive?: boolean;
}

export interface PatternAction {
  type: 'retry' | 'escalate' | 'ignore' | 'notify' | 'custom';
  parameters?: any;
  delay?: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByStatus: Record<ErrorStatus, number>;
  errorsBySource: Record<string, number>;
  averageResolutionTime: number;
  errorTrends: ErrorTrend[];
  retrySuccessRate: number;
  escalationRate: number;
}

export interface ErrorTrend {
  period: string;
  errorCount: number;
  timestamp: Date;
}

export interface ErrorAlert {
  id: string;
  errorId: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  recipients: string[];
  channels: ('email' | 'sms' | 'webhook' | 'dashboard')[];
  sent: boolean;
  sentAt?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export class IntegrationErrorHandlingService extends EventEmitter {
  private errors: Map<string, IntegrationError> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private retryQueues: Map<string, IntegrationError[]> = new Map();
  private alerts: Map<string, ErrorAlert> = new Map();
  private defaultRetryConfig: RetryConfiguration;

  constructor() {
    super();
    this.defaultRetryConfig = {
      enabled: true,
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      backoffStrategy: 'exponential',
      retryableErrors: [
        ErrorType.NETWORK_ERROR,
        ErrorType.TIMEOUT_ERROR,
        ErrorType.EXTERNAL_SERVICE_ERROR
      ],
      jitterEnabled: true,
      timeoutMs: 30000
    };
    
    this.initializeService();
  }

  /**
   * Initialize error handling service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing integration error handling service');
    
    // TODO: Load error patterns, retry configurations, etc.
    await this.loadErrorPatterns();
    this.startRetryProcessor();
  }

  /**
   * Handle integration error
   */
  async handleError(
    error: Error | any,
    source: string,
    context?: ErrorContext,
    retryConfig?: Partial<RetryConfiguration>
  ): Promise<IntegrationError> {
    try {
      // Create error record
      const integrationError = this.createErrorRecord(error, source, context);
      
      // Store error
      this.errors.set(integrationError.id, integrationError);

      // Apply retry configuration
      const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };
      integrationError.maxRetries = finalRetryConfig.maxRetries;

      // Check error patterns
      await this.checkErrorPatterns(integrationError);

      // Determine if error should be retried
      if (this.shouldRetry(integrationError, finalRetryConfig)) {
        await this.scheduleRetry(integrationError, finalRetryConfig);
      } else {
        await this.handleNonRetryableError(integrationError);
      }

      // Emit error event
      this.emit('errorOccurred', integrationError);

      logger.error(`Integration error handled: ${integrationError.id} - ${integrationError.message}`);
      return integrationError;
    } catch (handlingError) {
      logger.error('Failed to handle integration error:', handlingError);
      throw handlingError;
    }
  }

  /**
   * Retry failed operation
   */
  async retryOperation(
    errorId: string,
    operation: () => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: IntegrationError }> {
    try {
      const error = this.errors.get(errorId);
      if (!error) {
        throw new Error('Error not found');
      }

      logger.debug(`Retrying operation for error ${errorId} (attempt ${error.retryCount + 1})`);

      error.retryCount++;
      error.status = ErrorStatus.IN_PROGRESS;

      try {
        const result = await operation();
        
        // Success - mark error as resolved
        error.status = ErrorStatus.RESOLVED;
        error.resolution = {
          resolvedBy: 'system',
          resolvedAt: new Date(),
          resolution: 'Retry successful',
          actionsTaken: ['Automatic retry']
        };

        this.emit('errorResolved', error);
        logger.info(`Operation retry successful for error ${errorId}`);
        
        return { success: true, result };
      } catch (retryError) {
        // Retry failed
        if (error.retryCount >= error.maxRetries) {
          error.status = ErrorStatus.RETRY_EXHAUSTED;
          await this.handleRetryExhausted(error);
        } else {
          error.status = ErrorStatus.RETRY_SCHEDULED;
        }

        const newError = await this.handleError(retryError, error.source, error.context);
        return { success: false, error: newError };
      }
    } catch (error) {
      logger.error('Failed to retry operation:', error);
      throw error;
    }
  }

  /**
   * Acknowledge error
   */
  async acknowledgeError(
    errorId: string,
    acknowledgedBy: string,
    notes?: string
  ): Promise<void> {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error('Error not found');
    }

    error.status = ErrorStatus.ACKNOWLEDGED;
    if (!error.resolution) {
      error.resolution = {
        resolvedBy: acknowledgedBy,
        resolvedAt: new Date(),
        resolution: notes || 'Error acknowledged',
        actionsTaken: ['Manual acknowledgment']
      };
    }

    this.emit('errorAcknowledged', { error, acknowledgedBy, notes });
    logger.info(`Error ${errorId} acknowledged by ${acknowledgedBy}`);
  }

  /**
   * Resolve error
   */
  async resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string,
    actionsTaken: string[],
    preventionMeasures?: string[]
  ): Promise<void> {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error('Error not found');
    }

    error.status = ErrorStatus.RESOLVED;
    error.resolution = {
      resolvedBy,
      resolvedAt: new Date(),
      resolution,
      actionsTaken,
      preventionMeasures
    };

    this.emit('errorResolved', error);
    logger.info(`Error ${errorId} resolved by ${resolvedBy}`);
  }

  /**
   * Escalate error
   */
  async escalateError(
    errorId: string,
    escalationReason: string,
    escalatedTo?: string[]
  ): Promise<void> {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error('Error not found');
    }

    error.status = ErrorStatus.ESCALATED;
    error.severity = ErrorSeverity.CRITICAL;

    // Create escalation alert
    const alert = await this.createAlert(
      error,
      'critical',
      `Error escalated: ${escalationReason}`,
      escalatedTo || ['admin@omnicare.com']
    );

    this.emit('errorEscalated', { error, reason: escalationReason, alert });
    logger.warn(`Error ${errorId} escalated: ${escalationReason}`);
  }

  /**
   * Get error metrics
   */
  async getErrorMetrics(timeframe?: { start: Date; end: Date }): Promise<ErrorMetrics> {
    const errors = Array.from(this.errors.values());
    const filteredErrors = timeframe 
      ? errors.filter(e => e.timestamp >= timeframe.start && e.timestamp <= timeframe.end)
      : errors;

    const totalErrors = filteredErrors.length;
    
    // Group by various dimensions
    const errorsByType = this.groupBy(filteredErrors, 'type');
    const errorsByCategory = this.groupBy(filteredErrors, 'category');
    const errorsBySeverity = this.groupBy(filteredErrors, 'severity');
    const errorsByStatus = this.groupBy(filteredErrors, 'status');
    const errorsBySource = this.groupBy(filteredErrors, 'source');

    // Calculate metrics
    const resolvedErrors = filteredErrors.filter(e => e.status === ErrorStatus.RESOLVED);
    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, error) => {
          if (error.resolution?.resolvedAt) {
            return sum + (error.resolution.resolvedAt.getTime() - error.timestamp.getTime());
          }
          return sum;
        }, 0) / resolvedErrors.length
      : 0;

    const retriedErrors = filteredErrors.filter(e => e.retryCount > 0);
    const successfulRetries = retriedErrors.filter(e => e.status === ErrorStatus.RESOLVED);
    const retrySuccessRate = retriedErrors.length > 0 
      ? (successfulRetries.length / retriedErrors.length) * 100 
      : 0;

    const escalatedErrors = filteredErrors.filter(e => e.status === ErrorStatus.ESCALATED);
    const escalationRate = totalErrors > 0 ? (escalatedErrors.length / totalErrors) * 100 : 0;

    return {
      totalErrors,
      errorsByType,
      errorsByCategory,
      errorsBySeverity,
      errorsByStatus,
      errorsBySource,
      averageResolutionTime,
      errorTrends: [], // TODO: Calculate trends
      retrySuccessRate,
      escalationRate
    };
  }

  /**
   * Create error record
   */
  private createErrorRecord(
    error: Error | any,
    source: string,
    context?: ErrorContext
  ): IntegrationError {
    const errorType = this.classifyError(error);
    const category = this.categorizeError(errorType);
    const severity = this.determineSeverity(errorType, context);

    return {
      id: this.generateErrorId(),
      type: errorType,
      category,
      severity,
      message: error.message || String(error),
      details: error.details || error,
      source,
      timestamp: new Date(),
      context,
      retryCount: 0,
      maxRetries: 0, // Will be set by handleError
      status: ErrorStatus.NEW,
      stackTrace: error.stack,
      correlationId: context?.requestId || context?.operationId
    };
  }

  /**
   * Classify error type
   */
  private classifyError(error: any): ErrorType {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    if (message.includes('network') || code.includes('enotfound') || code.includes('econnrefused')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (message.includes('timeout') || code.includes('timeout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    if (message.includes('unauthorized') || error.status === 401) {
      return ErrorType.AUTHENTICATION_ERROR;
    }
    if (message.includes('forbidden') || error.status === 403) {
      return ErrorType.AUTHORIZATION_ERROR;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (message.includes('parse') || message.includes('syntax')) {
      return ErrorType.PARSING_ERROR;
    }
    if (message.includes('not found') || error.status === 404) {
      return ErrorType.RESOURCE_NOT_FOUND;
    }
    if (message.includes('duplicate') || message.includes('already exists')) {
      return ErrorType.DUPLICATE_RECORD;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Categorize error
   */
  private categorizeError(errorType: ErrorType): ErrorCategory {
    const systemErrors = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.CONFIGURATION_ERROR
    ];
    
    const integrationErrors = [
      ErrorType.PARSING_ERROR,
      ErrorType.TRANSFORMATION_ERROR,
      ErrorType.EXTERNAL_SERVICE_ERROR
    ];
    
    const securityErrors = [
      ErrorType.AUTHENTICATION_ERROR,
      ErrorType.AUTHORIZATION_ERROR
    ];
    
    const dataErrors = [
      ErrorType.VALIDATION_ERROR,
      ErrorType.DUPLICATE_RECORD,
      ErrorType.CONSTRAINT_VIOLATION
    ];

    if (systemErrors.includes(errorType)) return ErrorCategory.SYSTEM;
    if (integrationErrors.includes(errorType)) return ErrorCategory.INTEGRATION;
    if (securityErrors.includes(errorType)) return ErrorCategory.SECURITY;
    if (dataErrors.includes(errorType)) return ErrorCategory.DATA;
    
    return ErrorCategory.BUSINESS;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(errorType: ErrorType, context?: ErrorContext): ErrorSeverity {
    // Critical errors
    if ([
      ErrorType.AUTHENTICATION_ERROR,
      ErrorType.AUTHORIZATION_ERROR
    ].includes(errorType)) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if ([
      ErrorType.EXTERNAL_SERVICE_ERROR,
      ErrorType.BUSINESS_LOGIC_ERROR
    ].includes(errorType)) {
      return ErrorSeverity.HIGH;
    }

    // Patient-related operations are higher priority
    if (context?.patientId) {
      return ErrorSeverity.HIGH;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: IntegrationError, config: RetryConfiguration): boolean {
    return config.enabled &&
           error.retryCount < error.maxRetries &&
           config.retryableErrors.includes(error.type) &&
           error.status !== ErrorStatus.RESOLVED;
  }

  /**
   * Schedule retry for error
   */
  private async scheduleRetry(error: IntegrationError, config: RetryConfiguration): Promise<void> {
    const delay = this.calculateRetryDelay(error.retryCount, config);
    error.status = ErrorStatus.RETRY_SCHEDULED;

    // Add to retry queue
    const queueKey = error.source;
    if (!this.retryQueues.has(queueKey)) {
      this.retryQueues.set(queueKey, []);
    }
    this.retryQueues.get(queueKey)!.push(error);

    // Schedule retry
    setTimeout(() => {
      this.processRetryQueue(queueKey);
    }, delay);

    logger.info(`Retry scheduled for error ${error.id} in ${delay}ms`);
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(retryCount: number, config: RetryConfiguration): number {
    let delay: number;

    switch (config.backoffStrategy) {
      case 'exponential':
        delay = Math.min(
          config.initialDelay * Math.pow(config.backoffMultiplier, retryCount),
          config.maxDelay
        );
        break;
      case 'linear':
        delay = Math.min(
          config.initialDelay + (retryCount * config.backoffMultiplier * 1000),
          config.maxDelay
        );
        break;
      case 'fixed':
      default:
        delay = config.initialDelay;
        break;
    }

    // Add jitter if enabled
    if (config.jitterEnabled) {
      delay = delay + (Math.random() * 1000);
    }

    return Math.round(delay);
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(queueKey: string): Promise<void> {
    const queue = this.retryQueues.get(queueKey);
    if (!queue || queue.length === 0) return;

    const error = queue.shift()!;
    
    // TODO: Implement actual retry logic based on error source
    // This would typically involve calling the original operation again
    
    this.emit('retryAttempted', error);
  }

  /**
   * Handle non-retryable errors
   */
  private async handleNonRetryableError(error: IntegrationError): Promise<void> {
    if (error.severity === ErrorSeverity.CRITICAL) {
      await this.escalateError(error.id, 'Critical non-retryable error');
    } else {
      await this.createAlert(error, 'warning', 'Non-retryable error occurred');
    }
  }

  /**
   * Handle retry exhausted
   */
  private async handleRetryExhausted(error: IntegrationError): Promise<void> {
    await this.createAlert(
      error,
      'critical',
      `Retry attempts exhausted for error: ${error.message}`
    );
    
    this.emit('retryExhausted', error);
  }

  /**
   * Check error patterns
   */
  private async checkErrorPatterns(error: IntegrationError): Promise<void> {
    const patterns = Array.from(this.errorPatterns.values())
      .filter(p => p.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const pattern of patterns) {
      if (this.matchesPattern(error, pattern)) {
        await this.executePatternActions(error, pattern);
        pattern.lastTriggered = new Date();
        pattern.triggerCount++;
        break; // Only execute first matching pattern
      }
    }
  }

  /**
   * Check if error matches pattern
   */
  private matchesPattern(error: IntegrationError, pattern: ErrorPattern): boolean {
    return pattern.conditions.every(condition => {
      const fieldValue = this.getErrorField(error, condition.field);
      return this.evaluatePatternCondition(fieldValue, condition);
    });
  }

  /**
   * Get error field value
   */
  private getErrorField(error: IntegrationError, fieldPath: string): any {
    const paths = fieldPath.split('.');
    let value: any = error;
    
    for (const path of paths) {
      value = value?.[path];
      if (value === undefined) break;
    }
    
    return value;
  }

  /**
   * Evaluate pattern condition
   */
  private evaluatePatternCondition(value: any, condition: PatternCondition): boolean {
    const compareValue = condition.caseSensitive !== false 
      ? condition.value 
      : String(condition.value).toLowerCase();
    const fieldValue = condition.caseSensitive !== false 
      ? value 
      : String(value).toLowerCase();

    switch (condition.operator) {
      case 'equals':
        return fieldValue === compareValue;
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'regex':
        return new RegExp(compareValue).test(String(fieldValue));
      case 'greater_than':
        return Number(fieldValue) > Number(compareValue);
      case 'less_than':
        return Number(fieldValue) < Number(compareValue);
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Execute pattern actions
   */
  private async executePatternActions(error: IntegrationError, pattern: ErrorPattern): Promise<void> {
    for (const action of pattern.actions) {
      try {
        await this.executePatternAction(error, action);
      } catch (actionError) {
        logger.error(`Failed to execute pattern action:`, actionError);
      }
    }
  }

  /**
   * Execute single pattern action
   */
  private async executePatternAction(error: IntegrationError, action: PatternAction): Promise<void> {
    switch (action.type) {
      case 'retry':
        if (error.retryCount < error.maxRetries) {
          await this.scheduleRetry(error, { ...this.defaultRetryConfig, ...action.parameters });
        }
        break;
      case 'escalate':
        await this.escalateError(error.id, action.parameters?.reason || 'Pattern-triggered escalation');
        break;
      case 'ignore':
        error.status = ErrorStatus.IGNORED;
        break;
      case 'notify':
        await this.createAlert(error, action.parameters?.level || 'warning', action.parameters?.message);
        break;
      case 'custom':
        // TODO: Implement custom action handling
        break;
    }
  }

  /**
   * Create alert
   */
  private async createAlert(
    error: IntegrationError,
    level: ErrorAlert['level'],
    message: string,
    recipients?: string[]
  ): Promise<ErrorAlert> {
    const alert: ErrorAlert = {
      id: this.generateAlertId(),
      errorId: error.id,
      level,
      message,
      recipients: recipients || ['admin@omnicare.com'],
      channels: ['email', 'dashboard'],
      sent: false,
      acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    
    // TODO: Send actual alerts
    alert.sent = true;
    alert.sentAt = new Date();

    this.emit('alertCreated', alert);
    return alert;
  }

  /**
   * Load error patterns
   */
  private async loadErrorPatterns(): Promise<void> {
    // TODO: Load from database or configuration
    logger.info('Error patterns loaded');
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    // TODO: Implement retry queue processor
    logger.info('Retry processor started');
  }

  /**
   * Group array by field
   */
  private groupBy<T>(array: T[], field: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = String(item[field]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Generate unique IDs
   */
  private generateErrorId(): string {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    const totalErrors = this.errors.size;
    const activeErrors = Array.from(this.errors.values()).filter(e => 
      e.status === ErrorStatus.NEW || e.status === ErrorStatus.IN_PROGRESS
    ).length;

    return {
      status: activeErrors > 10 ? 'DEGRADED' : 'UP',
      details: {
        totalErrors,
        activeErrors,
        errorPatternsCount: this.errorPatterns.size,
        retryQueuesCount: this.retryQueues.size,
        alertsCount: this.alerts.size
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.errors.clear();
    this.errorPatterns.clear();
    this.retryQueues.clear();
    this.alerts.clear();
    logger.info('Integration error handling service shut down');
  }
}

// Export singleton instance
export const integrationErrorHandlingService = new IntegrationErrorHandlingService();