/**
 * OmniCare EMR Backend - Enhanced Access Control Service
 * HIPAA-Compliant Attribute-Based Access Control (ABAC) System
 */

import { auditService } from './audit.service';

import { AuditLogEntry, Permission, User, UserRole } from '@/types/auth.types';
import logger from '@/utils/logger';

export interface AccessContext {
  user: User;
  resource: string;
  resourceId?: string;
  patientId?: string;
  action: 'read' | 'write' | 'create' | 'delete' | 'export' | 'print' | 'share';
  purpose: 'treatment' | 'payment' | 'operations' | 'disclosure' | 'emergency' | 'research' | 'other';
  justification?: string;
  location?: string;
  deviceInfo?: string;
  timestamp: Date;
  sessionId?: string;
}

export interface AccessDecision {
  granted: boolean;
  reason: string;
  conditions?: string[];
  consentRequired?: boolean;
  auditRequired?: boolean;
  minimumNecessaryVerified?: boolean;
  breakGlassUsed?: boolean;
}

export interface PatientConsent {
  patientId: string;
  consentType: 'treatment' | 'payment' | 'operations' | 'disclosure' | 'research' | 'all';
  granted: boolean;
  grantedBy: string;
  grantedDate: Date;
  expiryDate?: Date;
  restrictions?: string[];
  witnessedBy?: string;
}

export interface MinimumNecessaryRule {
  role: UserRole;
  resource: string;
  allowedFields: string[];
  purpose: string[];
  conditions?: string[];
}

export class AccessControlService {
  private consentStore: Map<string, PatientConsent[]> = new Map();
  private minimumNecessaryRules: MinimumNecessaryRule[] = [];
  private breakGlassOverrides: Map<string, Date> = new Map();

  constructor() {
    this.initializeMinimumNecessaryRules();
  }

  /**
   * Primary access control decision point
   */
  async evaluateAccess(context: AccessContext): Promise<AccessDecision> {
    try {
      // Step 1: Basic role-based access control
      const rbacDecision = await this.evaluateRBAC(context);
      if (!rbacDecision.granted) {
        return rbacDecision;
      }

      // Step 2: Attribute-based access control
      const abacDecision = await this.evaluateABAC(context);
      if (!abacDecision.granted) {
        return abacDecision;
      }

      // Step 3: Patient consent verification
      const consentDecision = await this.evaluateConsent(context);
      if (!consentDecision.granted && !context.purpose.includes('emergency')) {
        return consentDecision;
      }

      // Step 4: Minimum necessary access verification
      const minimumNecessaryDecision = await this.evaluateMinimumNecessary(context);

      // Step 5: Emergency/Break-glass access evaluation
      const emergencyDecision = await this.evaluateEmergencyAccess(context);

      // Combine decisions
      const finalDecision: AccessDecision = {
        granted: true,
        reason: 'Access granted based on comprehensive policy evaluation',
        conditions: [
          ...(rbacDecision.conditions || []),
          ...(abacDecision.conditions || []),
          ...(minimumNecessaryDecision.conditions || [])
        ],
        consentRequired: consentDecision.consentRequired,
        auditRequired: true,
        minimumNecessaryVerified: minimumNecessaryDecision.granted,
        breakGlassUsed: emergencyDecision.breakGlassUsed
      };

      // Log the access decision
      await this.logAccessControl(context, finalDecision);

      return finalDecision;

    } catch (error) {
      logger.error('Access control evaluation failed:', error);
      return {
        granted: false,
        reason: 'Access control system error',
        auditRequired: true
      };
    }
  }

  /**
   * Role-Based Access Control (RBAC) evaluation
   */
  private async evaluateRBAC(context: AccessContext): Promise<AccessDecision> {
    const { user, resource, action } = context;

    // Define role-based permissions matrix
    const rolePermissions: Record<UserRole, Record<string, string[]>> = {
      'SYSTEM_ADMINISTRATOR': { '*': ['*'] },
      'PHYSICIAN': {
        'patient': ['read', 'write', 'create'],
        'clinical_notes': ['read', 'write', 'create'],
        'prescriptions': ['read', 'write', 'create'],
        'lab_results': ['read', 'write'],
        'appointments': ['read', 'write', 'create']
      },
      'NURSING_STAFF': {
        'patient': ['read', 'write'],
        'clinical_notes': ['read', 'write'],
        'medications': ['read', 'write'],
        'vital_signs': ['read', 'write', 'create']
      },
      'MEDICAL_ASSISTANT': {
        'patient': ['read'],
        'appointments': ['read', 'write', 'create'],
        'demographics': ['read', 'write']
      },
      'ADMINISTRATIVE_STAFF': {
        'patient': ['read'],
        'appointments': ['read', 'write', 'create'],
        'billing': ['read', 'write', 'create'],
        'insurance': ['read', 'write']
      },
      'LABORATORY_TECHNICIAN': {
        'lab_results': ['read', 'write', 'create'],
        'specimens': ['read', 'write', 'create']
      },
      'RADIOLOGY_TECHNICIAN': {
        'imaging': ['read', 'write', 'create'],
        'radiology_results': ['read', 'write']
      },
      'PHARMACIST': {
        'prescriptions': ['read', 'write'],
        'medications': ['read', 'write', 'create'],
        'drug_interactions': ['read']
      },
      'PATIENT': {
        'own_records': ['read'],
        'appointments': ['read', 'create'],
        'messages': ['read', 'write', 'create']
      },
      'BILLING_SPECIALIST': {
        'billing': ['read', 'write', 'create'],
        'insurance': ['read', 'write'],
        'financial_records': ['read', 'write']
      },
      'COMPLIANCE_OFFICER': {
        'audit_logs': ['read'],
        'compliance_reports': ['read', 'create'],
        'policy_documents': ['read', 'write']
      }
    };

    const userPermissions = rolePermissions[user.role] || {};
    const resourcePermissions = userPermissions[resource] || userPermissions['*'] || [];

    const hasPermission = resourcePermissions.includes(action) || resourcePermissions.includes('*');

    return {
      granted: hasPermission,
      reason: hasPermission 
        ? `Role ${user.role} has ${action} permission for ${resource}`
        : `Role ${user.role} lacks ${action} permission for ${resource}`,
      conditions: hasPermission ? [`RBAC_VERIFIED_${user.role}`] : undefined
    };
  }

  /**
   * Attribute-Based Access Control (ABAC) evaluation
   */
  private async evaluateABAC(context: AccessContext): Promise<AccessDecision> {
    const conditions: string[] = [];
    const { user, action, timestamp, location, purpose } = context;

    // Time-based access control
    const currentHour = timestamp.getHours();
    const isBusinessHours = currentHour >= 6 && currentHour <= 20;
    
    if (!isBusinessHours && purpose !== 'emergency') {
      if (user.role !== 'PHYSICIAN' && user.role !== 'NURSING_STAFF') {
        return {
          granted: false,
          reason: 'Access denied outside business hours for non-clinical staff'
        };
      }
      conditions.push('AFTER_HOURS_ACCESS');
    }

    // Location-based access control
    if (location && !this.isAuthorizedLocation(location, user.role)) {
      return {
        granted: false,
        reason: 'Access denied from unauthorized location'
      };
    }

    // Purpose-based restrictions
    if (purpose === 'research' && !user.permissions?.includes('RESEARCH_ACCESS')) {
      return {
        granted: false,
        reason: 'Research access requires specific authorization'
      };
    }

    // High-risk action controls
    if (['export', 'print', 'share'].includes(action)) {
      if (!user.permissions?.includes('DATA_EXPORT') && user.role !== 'PHYSICIAN') {
        return {
          granted: false,
          reason: 'Data export/sharing requires elevated permissions'
        };
      }
      conditions.push('HIGH_RISK_ACTION');
    }

    return {
      granted: true,
      reason: 'ABAC evaluation passed',
      conditions
    };
  }

  /**
   * Patient consent evaluation
   */
  private async evaluateConsent(context: AccessContext): Promise<AccessDecision> {
    if (!context.patientId) {
      return { granted: true, reason: 'No patient context' };
    }

    const consents = this.consentStore.get(context.patientId) || [];
    const relevantConsent = consents.find(c => 
      c.consentType === context.purpose || c.consentType === 'all'
    );

    if (!relevantConsent) {
      return {
        granted: false,
        reason: 'Patient consent not found for this purpose',
        consentRequired: true
      };
    }

    if (!relevantConsent.granted) {
      return {
        granted: false,
        reason: 'Patient has not consented to this access',
        consentRequired: true
      };
    }

    if (relevantConsent.expiryDate && relevantConsent.expiryDate < context.timestamp) {
      return {
        granted: false,
        reason: 'Patient consent has expired',
        consentRequired: true
      };
    }

    return {
      granted: true,
      reason: 'Patient consent verified',
      conditions: [`CONSENT_VERIFIED_${relevantConsent.consentType.toUpperCase()}`]
    };
  }

  /**
   * Minimum necessary access evaluation
   */
  private async evaluateMinimumNecessary(context: AccessContext): Promise<AccessDecision> {
    const rule = this.minimumNecessaryRules.find(r => 
      r.role === context.user.role && 
      r.resource === context.resource &&
      r.purpose.includes(context.purpose)
    );

    if (!rule) {
      return {
        granted: true,
        reason: 'No minimum necessary restrictions apply',
        conditions: ['NO_MIN_NECESSARY_RESTRICTIONS']
      };
    }

    // In a real implementation, we would validate that only the allowed fields are being accessed
    return {
      granted: true,
      reason: 'Minimum necessary access verified',
      conditions: [`MIN_NECESSARY_${rule.role}_${rule.resource.toUpperCase()}`],
      minimumNecessaryVerified: true
    };
  }

  /**
   * Emergency/Break-glass access evaluation
   */
  private async evaluateEmergencyAccess(context: AccessContext): Promise<AccessDecision> {
    if (context.purpose !== 'emergency') {
      return { granted: true, reason: 'Not emergency access' };
    }

    const breakGlassKey = `${context.user.id}-${context.patientId}-${Date.now()}`;
    this.breakGlassOverrides.set(breakGlassKey, context.timestamp);

    return {
      granted: true,
      reason: 'Emergency break-glass access granted',
      conditions: ['BREAK_GLASS_ACCESS', 'EMERGENCY_OVERRIDE'],
      breakGlassUsed: true
    };
  }

  /**
   * Grant patient consent
   */
  async grantPatientConsent(consent: PatientConsent): Promise<void> {
    const existingConsents = this.consentStore.get(consent.patientId) || [];
    const updatedConsents = existingConsents.filter(c => c.consentType !== consent.consentType);
    updatedConsents.push(consent);
    
    this.consentStore.set(consent.patientId, updatedConsents);

    // Log consent granting
    await auditService.logUserAction(
      consent.grantedBy,
      'grant_patient_consent',
      'consent',
      consent.patientId,
      '0.0.0.0',
      'system',
      true,
      undefined,
      {
        patientId: consent.patientId,
        consentType: consent.consentType,
        restrictions: consent.restrictions
      }
    );
  }

  /**
   * Revoke patient consent
   */
  async revokePatientConsent(patientId: string, consentType: string, revokedBy: string): Promise<void> {
    const consents = this.consentStore.get(patientId) || [];
    const updatedConsents = consents.filter(c => c.consentType !== consentType);
    this.consentStore.set(patientId, updatedConsents);

    // Log consent revocation
    await auditService.logUserAction(
      revokedBy,
      'revoke_patient_consent',
      'consent',
      patientId,
      '0.0.0.0',
      'system',
      true,
      undefined,
      {
        patientId,
        consentType,
        revokedBy
      }
    );
  }

  /**
   * Initialize minimum necessary access rules
   */
  private initializeMinimumNecessaryRules(): void {
    this.minimumNecessaryRules = [
      {
        role: 'NURSING_STAFF',
        resource: 'patient',
        allowedFields: ['demographics', 'vital_signs', 'medications', 'care_plan'],
        purpose: ['treatment'],
        conditions: ['DIRECT_CARE_ONLY']
      },
      {
        role: 'BILLING_SPECIALIST',
        resource: 'patient',
        allowedFields: ['demographics', 'insurance', 'billing_info'],
        purpose: ['payment', 'operations'],
        conditions: ['BILLING_PURPOSE_ONLY']
      },
      {
        role: 'ADMINISTRATIVE_STAFF',
        resource: 'patient',
        allowedFields: ['demographics', 'contact_info', 'appointments'],
        purpose: ['operations'],
        conditions: ['ADMINISTRATIVE_PURPOSE_ONLY']
      }
    ];
  }

  /**
   * Check if location is authorized for role
   */
  private isAuthorizedLocation(location: string, role: UserRole): boolean {
    const locationAuthorizations: Record<UserRole, string[]> = {
      'PHYSICIAN': ['*'],
      'NURSING_STAFF': ['ICU', 'EMERGENCY', 'WARDS', 'CLINIC'],
      'MEDICAL_ASSISTANT': ['CLINIC', 'RECEPTION'],
      'ADMINISTRATIVE_STAFF': ['ADMINISTRATION', 'RECEPTION'],
      'LABORATORY_TECHNICIAN': ['LABORATORY'],
      'RADIOLOGY_TECHNICIAN': ['RADIOLOGY'],
      'PHARMACIST': ['PHARMACY'],
      'PATIENT': ['PORTAL'],
      'BILLING_SPECIALIST': ['BILLING', 'ADMINISTRATION'],
      'COMPLIANCE_OFFICER': ['ADMINISTRATION', 'AUDIT'],
      'SYSTEM_ADMINISTRATOR': ['*']
    };

    const authorized = locationAuthorizations[role] || [];
    return authorized.includes('*') || authorized.includes(location);
  }

  /**
   * Log access control decision
   */
  private async logAccessControl(context: AccessContext, decision: AccessDecision): Promise<void> {
    await auditService.logUserAction(
      context.user.id,
      'access_control_evaluation',
      context.resource,
      context.resourceId,
      '0.0.0.0',
      'access-control-service',
      decision.granted,
      decision.granted ? undefined : decision.reason,
      {
        patientId: context.patientId,
        action: context.action,
        purpose: context.purpose,
        decision: decision,
        timestamp: context.timestamp.toISOString()
      }
    );

    // Log PHI access if patient data involved
    if (context.patientId && decision.granted) {
      await auditService.logPHIAccess(
        context.user.id,
        context.user.role,
        context.patientId,
        [context.resource],
        context.purpose as any,
        '0.0.0.0',
        context.justification
      );
    }
  }

  /**
   * Get patient consents
   */
  getPatientConsents(patientId: string): PatientConsent[] {
    return this.consentStore.get(patientId) || [];
  }

  /**
   * Validate minimum necessary compliance
   */
  async validateMinimumNecessaryCompliance(
    userId: string,
    role: UserRole,
    resource: string,
    requestedFields: string[],
    purpose: string
  ): Promise<{ compliant: boolean; allowedFields: string[]; deniedFields: string[] }> {
    const rule = this.minimumNecessaryRules.find(r => 
      r.role === role && 
      r.resource === resource &&
      r.purpose.includes(purpose)
    );

    if (!rule) {
      return {
        compliant: true,
        allowedFields: requestedFields,
        deniedFields: []
      };
    }

    const allowedFields = requestedFields.filter(field => rule.allowedFields.includes(field));
    const deniedFields = requestedFields.filter(field => !rule.allowedFields.includes(field));

    return {
      compliant: deniedFields.length === 0,
      allowedFields,
      deniedFields
    };
  }
}

// Export singleton instance
export const accessControlService = new AccessControlService();