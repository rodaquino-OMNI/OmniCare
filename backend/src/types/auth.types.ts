/**
 * OmniCare EMR Backend - Authentication and Authorization Types
 * HIPAA-Compliant Role-Based Access Control System
 */

// Import unified role types for backend use
import type { 
  UserRole,
  UserRoleShort,
  UserRoleLong,
  UserRoleUnified
} from './unified-user-roles';

import { 
  toCanonicalRole,
  toShortRole,
  isCanonicalRole,
  isShortRole,
  isValidRole,
  getRoleDisplayName,
  hasHigherRole,
  ROLE_MAPPINGS,
  ROLE_DISPLAY_NAMES,
  ROLE_HIERARCHY,
  UserRoles
} from './unified-user-roles';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  licenseNumber?: string;
  npiNumber?: string;
  isActive: boolean;
  isMfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  passwordChangedAt: Date;
  failedLoginAttempts: number;
  accountLockedUntil?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Additional properties for backend compatibility
  passwordHash?: string;
  patient?: string;
  scope?: string[];
  permissions?: string[];
  clientId?: string;
}

// Re-export unified role types for backend use
export type { 
  UserRole,
  UserRoleShort,
  UserRoleLong,
  UserRoleUnified
};

export { 
  toCanonicalRole,
  toShortRole,
  isCanonicalRole,
  isShortRole,
  isValidRole,
  getRoleDisplayName,
  hasHigherRole,
  ROLE_MAPPINGS,
  ROLE_DISPLAY_NAMES,
  ROLE_HIERARCHY,
  UserRoles
};

export enum Permission {
  // Clinical Documentation
  CREATE_CLINICAL_NOTES = 'create_clinical_notes',
  EDIT_CLINICAL_NOTES = 'edit_clinical_notes',
  VIEW_CLINICAL_NOTES = 'view_clinical_notes',
  FINALIZE_CLINICAL_NOTES = 'finalize_clinical_notes',
  
  // Prescription Management
  CREATE_PRESCRIPTIONS = 'create_prescriptions',
  MODIFY_PRESCRIPTIONS = 'modify_prescriptions',
  VIEW_PRESCRIPTIONS = 'view_prescriptions',
  VERIFY_PRESCRIPTIONS = 'verify_prescriptions',
  DISPENSE_MEDICATIONS = 'dispense_medications',
  
  // Patient Management
  VIEW_PATIENT_RECORDS = 'view_patient_records',
  EDIT_PATIENT_RECORDS = 'edit_patient_records',
  CREATE_PATIENT_RECORDS = 'create_patient_records',
  VIEW_PATIENT_DEMOGRAPHICS = 'view_patient_demographics',
  EDIT_PATIENT_DEMOGRAPHICS = 'edit_patient_demographics',
  
  // Orders and Lab Results
  CREATE_MEDICAL_ORDERS = 'create_medical_orders',
  VIEW_LAB_RESULTS = 'view_lab_results',
  ENTER_LAB_RESULTS = 'enter_lab_results',
  ACKNOWLEDGE_CRITICAL_RESULTS = 'acknowledge_critical_results',
  
  // Administrative Functions
  SCHEDULE_APPOINTMENTS = 'schedule_appointments',
  MANAGE_BILLING = 'manage_billing',
  PROCESS_INSURANCE = 'process_insurance',
  GENERATE_REPORTS = 'generate_reports',
  
  // System Administration
  MANAGE_USERS = 'manage_users',
  CONFIGURE_SYSTEM = 'configure_system',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SECURITY_SETTINGS = 'manage_security_settings',
  
  // Imaging and Radiology
  PERFORM_IMAGING_STUDIES = 'perform_imaging_studies',
  VIEW_IMAGING_RESULTS = 'view_imaging_results',
  MANAGE_IMAGING_EQUIPMENT = 'manage_imaging_equipment',
  
  // Nursing Functions
  DOCUMENT_VITAL_SIGNS = 'document_vital_signs',
  ADMINISTER_MEDICATIONS = 'administer_medications',
  DOCUMENT_NURSING_CARE = 'document_nursing_care',
  MANAGE_PATIENT_CARE_PLANS = 'manage_patient_care_plans',
  
  // Patient Portal Functions
  VIEW_OWN_RECORDS = 'view_own_records',
  REQUEST_APPOINTMENTS = 'request_appointments',
  MESSAGE_CARE_TEAM = 'message_care_team',
  UPDATE_PERSONAL_INFO = 'update_personal_info'
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  description: string;
  restrictions?: string[];
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginCredentials {
  username: string;
  password: string;
  mfaToken?: string;
}

export interface MfaSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number;
  maxAgeInDays: number;
  lockoutThreshold: number;
  lockoutDurationMinutes: number;
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
  role: UserRole;
  permissions: Permission[];
  ipAddress: string;
  userAgent: string;
  lastActivity: Date;
  expiresAt: Date;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  patientId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  additionalData?: Record<string, any>;
}

export interface SecurityEvent {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'PASSWORD_CHANGE' | 
        'MFA_ENABLED' | 'MFA_DISABLED' | 'ACCOUNT_LOCKED' | 'UNAUTHORIZED_ACCESS' |
        'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM_CONFIGURATION_CHANGE';
  userId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?: Record<string, any>;
}

export interface ComplianceReport {
  reportId: string;
  reportType: 'HIPAA_ACCESS_LOG' | 'USER_ACTIVITY' | 'SECURITY_INCIDENTS' | 'PASSWORD_COMPLIANCE';
  generatedBy: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  data: any[];
  summary: Record<string, any>;
  createdAt: Date;
}
