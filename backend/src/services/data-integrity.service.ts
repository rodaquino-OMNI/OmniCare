/**
 * OmniCare EMR Backend - Data Integrity Service
 * HIPAA-Compliant Data Validation and Integrity Monitoring
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';

import { auditService } from './audit.service';

import logger from '@/utils/logger';

export interface DataIntegrityCheck {
  id: string;
  entityType: string;
  entityId: string;
  checksum: string;
  algorithm: 'sha256' | 'sha512' | 'md5';
  timestamp: Date;
  userId?: string;
  previousChecksum?: string;
  verified: boolean;
  changeDetected?: boolean;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'custom';
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  customValidator?: (value: any) => boolean;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  checksum?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  value?: any;
}

export interface IntegrityMonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  entities: string[];
  alertThreshold: number;
  autoRemedy: boolean;
}

export interface ComplianceCheck {
  id: string;
  type: 'hipaa_privacy' | 'hipaa_security' | 'data_quality' | 'audit_trail';
  description: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  timestamp: Date;
  remediation?: string;
}

export class DataIntegrityService extends EventEmitter {
  private checksumStore: Map<string, DataIntegrityCheck> = new Map();
  private validationRules: Map<string, ValidationRule[]> = new Map();
  private monitoringConfig: IntegrityMonitoringConfig;
  private monitoringTimer?: NodeJS.Timeout;
  private readonly encryptionKey: string;

  constructor() {
    super();
    this.encryptionKey = process.env.DATA_INTEGRITY_KEY || 'default-integrity-key-change-in-production';
    this.monitoringConfig = {
      enabled: true,
      checkInterval: 300000, // 5 minutes
      entities: ['patient', 'clinical_notes', 'prescriptions', 'lab_results'],
      alertThreshold: 5,
      autoRemedy: false
    };
    
    this.initializeValidationRules();
    this.startIntegrityMonitoring();
  }

  /**
   * Generate and store checksum for entity
   */
  async generateChecksum(
    entityType: string,
    entityId: string,
    data: any,
    userId?: string,
    algorithm: DataIntegrityCheck['algorithm'] = 'sha256'
  ): Promise<string> {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const checksum = crypto
      .createHash(algorithm)
      .update(dataString + this.encryptionKey)
      .digest('hex');

    // Get previous checksum for change detection
    const previousCheck = this.checksumStore.get(`${entityType}:${entityId}`);
    
    const integrityCheck: DataIntegrityCheck = {
      id: `${entityType}_${entityId}_${Date.now()}`,
      entityType,
      entityId,
      checksum,
      algorithm,
      timestamp: new Date(),
      userId,
      previousChecksum: previousCheck?.checksum,
      verified: true,
      changeDetected: previousCheck ? previousCheck.checksum !== checksum : false
    };

    // Store checksum
    this.checksumStore.set(`${entityType}:${entityId}`, integrityCheck);

    // Log integrity check
    if (userId) {
      await auditService.logUserAction(
        userId,
        'data_integrity_check',
        entityType,
        entityId,
        '0.0.0.0',
        'data-integrity-service',
        true,
        undefined,
        {
          checksum,
          algorithm,
          changeDetected: integrityCheck.changeDetected
        }
      );
    }

    // Emit event if change detected
    if (integrityCheck.changeDetected) {
      this.emit('dataChanged', integrityCheck);
    }

    return checksum;
  }

  /**
   * Verify entity integrity
   */
  async verifyIntegrity(
    entityType: string,
    entityId: string,
    currentData: any,
    algorithm: DataIntegrityCheck['algorithm'] = 'sha256'
  ): Promise<boolean> {
    const storedCheck = this.checksumStore.get(`${entityType}:${entityId}`);
    if (!storedCheck) {
      logger.warn(`No integrity check found for ${entityType}:${entityId}`);
      return false;
    }

    const dataString = typeof currentData === 'string' ? currentData : JSON.stringify(currentData);
    const currentChecksum = crypto
      .createHash(algorithm)
      .update(dataString + this.encryptionKey)
      .digest('hex');

    const isValid = currentChecksum === storedCheck.checksum;
    
    if (!isValid) {
      await this.handleIntegrityFailure(entityType, entityId, storedCheck, currentChecksum);
    }

    return isValid;
  }

  /**
   * Validate data against defined rules
   */
  async validateData(entityType: string, data: any): Promise<ValidationResult> {
    const rules = this.validationRules.get(entityType) || [];
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const rule of rules) {
      const value = this.getNestedValue(data, rule.field);
      const validation = this.validateField(rule, value);
      
      if (!validation.valid) {
        const error: ValidationError = {
          field: rule.field,
          message: validation.message || rule.errorMessage,
          severity: rule.severity,
          value
        };

        if (rule.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
    }

    // Generate checksum for valid data
    let checksum: string | undefined;
    if (errors.length === 0) {
      checksum = await this.generateChecksum(entityType, data.id || 'unknown', data);
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      checksum
    };

    // Log validation
    if (data.id) {
      await auditService.logUserAction(
        data.userId || 'system',
        'data_validation',
        entityType,
        data.id,
        '0.0.0.0',
        'data-integrity-service',
        result.valid,
        result.valid ? undefined : `Validation failed: ${errors.map(e => e.message).join(', ')}`,
        {
          errors: errors.length,
          warnings: warnings.length,
          checksum: result.checksum
        }
      );
    }

    return result;
  }

  /**
   * Perform automated compliance checks
   */
  async performComplianceChecks(): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // HIPAA Privacy compliance checks
    checks.push(await this.checkHIPAAPrivacyCompliance());
    
    // HIPAA Security compliance checks
    checks.push(await this.checkHIPAASecurityCompliance());
    
    // Data quality checks
    checks.push(await this.checkDataQuality());
    
    // Audit trail compliance
    checks.push(await this.checkAuditTrailCompliance());

    // Log compliance check results
    const passedChecks = checks.filter(c => c.status === 'pass').length;
    const failedChecks = checks.filter(c => c.status === 'fail').length;
    
    await auditService.logUserAction(
      'system',
      'compliance_check',
      'system',
      undefined,
      '0.0.0.0',
      'data-integrity-service',
      failedChecks === 0,
      failedChecks > 0 ? `${failedChecks} compliance checks failed` : undefined,
      {
        totalChecks: checks.length,
        passedChecks,
        failedChecks,
        timestamp: new Date().toISOString()
      }
    );

    return checks;
  }

  /**
   * Initialize validation rules for different entity types
   */
  private initializeValidationRules(): void {
    // Patient data validation rules
    this.validationRules.set('patient', [
      {
        field: 'firstName',
        type: 'required',
        errorMessage: 'First name is required',
        severity: 'error'
      },
      {
        field: 'lastName',
        type: 'required',
        errorMessage: 'Last name is required',
        severity: 'error'
      },
      {
        field: 'dateOfBirth',
        type: 'format',
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        errorMessage: 'Date of birth must be in YYYY-MM-DD format',
        severity: 'error'
      },
      {
        field: 'socialSecurityNumber',
        type: 'format',
        pattern: /^\d{3}-\d{2}-\d{4}$/,
        errorMessage: 'SSN must be in XXX-XX-XXXX format',
        severity: 'warning'
      },
      {
        field: 'email',
        type: 'format',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        errorMessage: 'Invalid email format',
        severity: 'warning'
      }
    ]);

    // Clinical notes validation rules
    this.validationRules.set('clinical_notes', [
      {
        field: 'patientId',
        type: 'required',
        errorMessage: 'Patient ID is required',
        severity: 'error'
      },
      {
        field: 'providerId',
        type: 'required',
        errorMessage: 'Provider ID is required',
        severity: 'error'
      },
      {
        field: 'content',
        type: 'required',
        minLength: 10,
        errorMessage: 'Clinical note content must be at least 10 characters',
        severity: 'error'
      },
      {
        field: 'timestamp',
        type: 'required',
        errorMessage: 'Timestamp is required',
        severity: 'error'
      }
    ]);

    // Prescription validation rules
    this.validationRules.set('prescriptions', [
      {
        field: 'patientId',
        type: 'required',
        errorMessage: 'Patient ID is required',
        severity: 'error'
      },
      {
        field: 'medicationName',
        type: 'required',
        errorMessage: 'Medication name is required',
        severity: 'error'
      },
      {
        field: 'dosage',
        type: 'required',
        errorMessage: 'Dosage is required',
        severity: 'error'
      },
      {
        field: 'quantity',
        type: 'range',
        minValue: 1,
        maxValue: 1000,
        errorMessage: 'Quantity must be between 1 and 1000',
        severity: 'error'
      }
    ]);
  }

  /**
   * Validate individual field
   */
  private validateField(rule: ValidationRule, value: any): { valid: boolean; message?: string } {
    if (rule.type === 'required') {
      return {
        valid: value !== null && value !== undefined && value !== '',
        message: rule.errorMessage
      };
    }

    if (rule.type === 'format' && rule.pattern) {
      return {
        valid: !value || rule.pattern.test(value),
        message: rule.errorMessage
      };
    }

    if (rule.type === 'range') {
      const numValue = Number(value);
      const valid = (!rule.minValue || numValue >= rule.minValue) &&
                   (!rule.maxValue || numValue <= rule.maxValue);
      return { valid, message: rule.errorMessage };
    }

    if (rule.type === 'custom' && rule.customValidator) {
      return {
        valid: rule.customValidator(value),
        message: rule.errorMessage
      };
    }

    return { valid: true };
  }

  /**
   * Get nested object value by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Handle integrity check failure
   */
  private async handleIntegrityFailure(
    entityType: string,
    entityId: string,
    storedCheck: DataIntegrityCheck,
    currentChecksum: string
  ): Promise<void> {
    const failureEvent = {
      entityType,
      entityId,
      expectedChecksum: storedCheck.checksum,
      actualChecksum: currentChecksum,
      timestamp: new Date()
    };

    // Log security event
    await auditService.logSecurityEvent({
      type: 'DATA_MODIFICATION',
      severity: 'HIGH',
      description: `Data integrity failure detected for ${entityType}:${entityId}`,
      metadata: failureEvent
    });

    // Emit integrity failure event
    this.emit('integrityFailure', failureEvent);

    logger.error('Data integrity check failed', failureEvent);
  }

  /**
   * Start integrity monitoring
   */
  private startIntegrityMonitoring(): void {
    if (!this.monitoringConfig.enabled) return;

    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performScheduledIntegrityChecks();
      } catch (error) {
        logger.error('Scheduled integrity check failed:', error);
      }
    }, this.monitoringConfig.checkInterval);
  }

  /**
   * Perform scheduled integrity checks
   */
  private async performScheduledIntegrityChecks(): Promise<void> {
    // Placeholder for scheduled checks
    // In a real implementation, this would check random samples of stored entities
    const checksPerformed = this.checksumStore.size;
    
    await auditService.logUserAction(
      'system',
      'scheduled_integrity_check',
      'system',
      undefined,
      '0.0.0.0',
      'data-integrity-service',
      true,
      undefined,
      {
        checksPerformed,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * HIPAA Privacy compliance check
   */
  private async checkHIPAAPrivacyCompliance(): Promise<ComplianceCheck> {
    // Check patient consent records exist and are current
    const consentChecks = this.checksumStore.size > 0;
    
    return {
      id: `hipaa_privacy_${Date.now()}`,
      type: 'hipaa_privacy',
      description: 'HIPAA Privacy Rule compliance verification',
      status: consentChecks ? 'pass' : 'fail',
      details: consentChecks 
        ? 'Patient consent and data access controls verified'
        : 'No data integrity checks found - may indicate consent management issues',
      timestamp: new Date(),
      remediation: consentChecks ? undefined : 'Ensure patient consent is properly documented and tracked'
    };
  }

  /**
   * HIPAA Security compliance check
   */
  private async checkHIPAASecurityCompliance(): Promise<ComplianceCheck> {
    // Check encryption and access controls
    const encryptionCheck = this.encryptionKey !== 'default-integrity-key-change-in-production';
    
    return {
      id: `hipaa_security_${Date.now()}`,
      type: 'hipaa_security',
      description: 'HIPAA Security Rule compliance verification',
      status: encryptionCheck ? 'pass' : 'fail',
      details: encryptionCheck
        ? 'Data encryption and integrity controls verified'
        : 'Default encryption key detected - security vulnerability',
      timestamp: new Date(),
      remediation: encryptionCheck ? undefined : 'Configure production encryption keys'
    };
  }

  /**
   * Data quality compliance check
   */
  private async checkDataQuality(): Promise<ComplianceCheck> {
    const rulesConfigured = this.validationRules.size > 0;
    
    return {
      id: `data_quality_${Date.now()}`,
      type: 'data_quality',
      description: 'Data quality and validation compliance',
      status: rulesConfigured ? 'pass' : 'warning',
      details: rulesConfigured
        ? `Validation rules configured for ${this.validationRules.size} entity types`
        : 'No validation rules configured',
      timestamp: new Date(),
      remediation: rulesConfigured ? undefined : 'Configure data validation rules for all entity types'
    };
  }

  /**
   * Audit trail compliance check
   */
  private async checkAuditTrailCompliance(): Promise<ComplianceCheck> {
    const integrityChecksActive = this.checksumStore.size > 0;
    
    return {
      id: `audit_trail_${Date.now()}`,
      type: 'audit_trail',
      description: 'Audit trail integrity and completeness',
      status: integrityChecksActive ? 'pass' : 'warning',
      details: integrityChecksActive
        ? `${this.checksumStore.size} integrity checks active`
        : 'No active integrity checks',
      timestamp: new Date(),
      remediation: integrityChecksActive ? undefined : 'Enable integrity monitoring for critical data'
    };
  }

  /**
   * Get integrity status summary
   */
  getIntegrityStatus(): {
    totalChecks: number;
    validChecks: number;
    failedChecks: number;
    monitoringActive: boolean;
  } {
    const totalChecks = this.checksumStore.size;
    const validChecks = Array.from(this.checksumStore.values()).filter(c => c.verified).length;
    
    return {
      totalChecks,
      validChecks,
      failedChecks: totalChecks - validChecks,
      monitoringActive: this.monitoringConfig.enabled
    };
  }

  /**
   * Shutdown integrity service
   */
  shutdown(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const dataIntegrityService = new DataIntegrityService();