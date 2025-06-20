/**
 * OmniCare EMR - Role-Based Access Control (RBAC) Permissions Matrix
 * HIPAA-Compliant Permission Definitions for All User Roles
 */

import { UserRole, Permission, RolePermissions } from '@/types/auth.types';

/**
 * Comprehensive Role-Based Permission Matrix
 * Each role is mapped to specific permissions based on healthcare workflows
 */
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.PHYSICIAN]: {
    role: UserRole.PHYSICIAN,
    description: 'Full clinical access with prescription authority and medical decision-making capabilities',
    permissions: [
      // Clinical Documentation - Full Access
      Permission.CREATE_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.FINALIZE_CLINICAL_NOTES,
      
      // Prescription Management - Full Authority
      Permission.CREATE_PRESCRIPTIONS,
      Permission.MODIFY_PRESCRIPTIONS,
      Permission.VIEW_PRESCRIPTIONS,
      
      // Patient Management - Full Clinical Access
      Permission.VIEW_PATIENT_RECORDS,
      Permission.EDIT_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      
      // Medical Orders and Results - Full Authority
      Permission.CREATE_MEDICAL_ORDERS,
      Permission.VIEW_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      Permission.VIEW_IMAGING_RESULTS,
      
      // Administrative Functions - Limited
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.GENERATE_REPORTS
    ],
    restrictions: [
      'Cannot manage system users or security settings',
      'Cannot access billing functions directly',
      'Cannot perform technical imaging or lab procedures'
    ]
  },

  [UserRole.NURSING_STAFF]: {
    role: UserRole.NURSING_STAFF,
    description: 'Clinical documentation and patient care management with medication administration rights',
    permissions: [
      // Clinical Documentation - Nursing Specific
      Permission.CREATE_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      
      // Patient Care Management
      Permission.VIEW_PATIENT_RECORDS,
      Permission.EDIT_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      
      // Nursing-Specific Functions
      Permission.DOCUMENT_VITAL_SIGNS,
      Permission.ADMINISTER_MEDICATIONS,
      Permission.DOCUMENT_NURSING_CARE,
      Permission.MANAGE_PATIENT_CARE_PLANS,
      
      // Medication Management - Administration Only
      Permission.VIEW_PRESCRIPTIONS,
      
      // Lab and Results - View Only
      Permission.VIEW_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      
      // Limited Administrative
      Permission.SCHEDULE_APPOINTMENTS
    ],
    restrictions: [
      'Cannot create or modify prescriptions',
      'Cannot finalize physician documentation',
      'Cannot create medical orders',
      'Limited access to sensitive patient information'
    ]
  },

  [UserRole.ADMINISTRATIVE_STAFF]: {
    role: UserRole.ADMINISTRATIVE_STAFF,
    description: 'Patient registration, scheduling, billing, and non-clinical administrative functions',
    permissions: [
      // Patient Demographics and Registration
      Permission.CREATE_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      
      // Administrative Functions - Full Access
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.MANAGE_BILLING,
      Permission.PROCESS_INSURANCE,
      Permission.GENERATE_REPORTS,
      
      // Limited Clinical Access
      Permission.VIEW_CLINICAL_NOTES, // Read-only for billing purposes
      
      // Limited Patient Record Access
      Permission.VIEW_PATIENT_RECORDS // Limited to non-clinical information
    ],
    restrictions: [
      'Cannot access detailed clinical information',
      'Cannot create, edit, or finalize clinical documentation',
      'Cannot access prescription information',
      'Cannot view sensitive lab results or imaging',
      'Cannot administer medications or document clinical care'
    ]
  },

  [UserRole.SYSTEM_ADMINISTRATOR]: {
    role: UserRole.SYSTEM_ADMINISTRATOR,
    description: 'System configuration, user management, and technical administration with security oversight',
    permissions: [
      // System Administration - Full Access
      Permission.MANAGE_USERS,
      Permission.CONFIGURE_SYSTEM,
      Permission.VIEW_AUDIT_LOGS,
      Permission.MANAGE_SECURITY_SETTINGS,
      
      // Reporting and Analytics
      Permission.GENERATE_REPORTS,
      
      // Limited Clinical Access for System Maintenance
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_CLINICAL_NOTES, // Read-only for system maintenance
      
      // User Account Management
      Permission.VIEW_PATIENT_RECORDS // Limited administrative access
    ],
    restrictions: [
      'Cannot create or modify clinical documentation',
      'Cannot prescribe medications or create medical orders',
      'Cannot perform clinical procedures',
      'Access to clinical data limited to system maintenance purposes',
      'Must document all administrative access for audit purposes'
    ]
  },

  [UserRole.PHARMACIST]: {
    role: UserRole.PHARMACIST,
    description: 'Medication verification, dispensing, and pharmaceutical care management',
    permissions: [
      // Medication Management - Full Authority
      Permission.VIEW_PRESCRIPTIONS,
      Permission.VERIFY_PRESCRIPTIONS,
      Permission.DISPENSE_MEDICATIONS,
      Permission.MODIFY_PRESCRIPTIONS, // Limited to pharmaceutical adjustments
      
      // Patient Information - Medication Related
      Permission.VIEW_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_LAB_RESULTS, // For medication monitoring
      
      // Clinical Documentation - Pharmacy Specific
      Permission.CREATE_CLINICAL_NOTES, // Pharmaceutical care notes
      Permission.VIEW_CLINICAL_NOTES,
      
      // Administrative Functions
      Permission.GENERATE_REPORTS // Pharmacy-specific reports
    ],
    restrictions: [
      'Cannot create medical orders or diagnose',
      'Cannot finalize physician documentation',
      'Cannot access non-medication related clinical information',
      'Cannot schedule appointments or manage billing',
      'Prescription modifications limited to pharmaceutical parameters'
    ]
  },

  [UserRole.LABORATORY_TECHNICIAN]: {
    role: UserRole.LABORATORY_TECHNICIAN,
    description: 'Laboratory specimen processing, test result entry, and quality control management',
    permissions: [
      // Laboratory Functions - Full Access
      Permission.VIEW_LAB_RESULTS,
      Permission.ENTER_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      
      // Patient Information - Limited
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_PATIENT_RECORDS, // Limited to lab-related information
      
      // Clinical Notes - Lab Specific
      Permission.CREATE_CLINICAL_NOTES, // Lab technical notes
      Permission.VIEW_CLINICAL_NOTES, // Limited to lab orders and results
      
      // Administrative Functions
      Permission.GENERATE_REPORTS // Lab-specific reports
    ],
    restrictions: [
      'Cannot create medical orders or prescriptions',
      'Cannot access clinical documentation unrelated to laboratory',
      'Cannot schedule appointments or manage billing',
      'Cannot administer medications or document patient care',
      'Access limited to laboratory workflow and results'
    ]
  },

  [UserRole.RADIOLOGY_TECHNICIAN]: {
    role: UserRole.RADIOLOGY_TECHNICIAN,
    description: 'Imaging study performance, equipment management, and radiology workflow coordination',
    permissions: [
      // Imaging Functions - Full Access
      Permission.PERFORM_IMAGING_STUDIES,
      Permission.VIEW_IMAGING_RESULTS,
      Permission.MANAGE_IMAGING_EQUIPMENT,
      
      // Patient Information - Limited
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_PATIENT_RECORDS, // Limited to imaging-related information
      
      // Clinical Notes - Imaging Specific
      Permission.CREATE_CLINICAL_NOTES, // Technical imaging notes
      Permission.VIEW_CLINICAL_NOTES, // Limited to imaging orders
      
      // Administrative Functions
      Permission.SCHEDULE_APPOINTMENTS, // Imaging appointments only
      Permission.GENERATE_REPORTS // Imaging-specific reports
    ],
    restrictions: [
      'Cannot create medical orders or prescriptions',
      'Cannot access clinical documentation unrelated to imaging',
      'Cannot manage billing or insurance processing',
      'Cannot administer medications or document patient care',
      'Cannot access lab results or other clinical data',
      'Appointment scheduling limited to imaging services'
    ]
  },

  [UserRole.PATIENT]: {
    role: UserRole.PATIENT,
    description: 'Personal health record access and patient portal functions for self-care management',
    permissions: [
      // Personal Health Record Access
      Permission.VIEW_OWN_RECORDS,
      Permission.UPDATE_PERSONAL_INFO,
      
      // Patient Portal Functions
      Permission.REQUEST_APPOINTMENTS,
      Permission.MESSAGE_CARE_TEAM,
      
      // Limited Clinical Access
      Permission.VIEW_PRESCRIPTIONS, // Own prescriptions only
      Permission.VIEW_LAB_RESULTS, // Own results only
      Permission.VIEW_IMAGING_RESULTS, // Own imaging only
      Permission.VIEW_CLINICAL_NOTES // Own shared notes only
    ],
    restrictions: [
      'Can only access own medical records',
      'Cannot access other patients\' information',
      'Cannot create or modify clinical documentation',
      'Cannot prescribe medications or create medical orders',
      'Cannot access system administration functions',
      'Cannot view audit logs or system reports',
      'All access is limited to personal health information only'
    ]
  }
};

/**
 * Helper function to get permissions for a specific role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role]?.permissions || [];
}

/**
 * Helper function to check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}

/**
 * Helper function to get role description and restrictions
 */
export function getRoleInfo(role: UserRole): Omit<RolePermissions, 'permissions'> {
  const roleData = ROLE_PERMISSIONS[role];
  return {
    role: roleData.role,
    description: roleData.description,
    restrictions: roleData.restrictions
  };
}

/**
 * Get all available roles with their basic information
 */
export function getAllRoles(): Array<Omit<RolePermissions, 'permissions'>> {
  return Object.values(UserRole).map(role => getRoleInfo(role));
}

/**
 * Permission hierarchy for role-based overrides
 * Higher values can override permissions of lower values in specific contexts
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SYSTEM_ADMINISTRATOR]: 100,
  [UserRole.PHYSICIAN]: 90,
  [UserRole.PHARMACIST]: 70,
  [UserRole.NURSING_STAFF]: 60,
  [UserRole.LABORATORY_TECHNICIAN]: 50,
  [UserRole.RADIOLOGY_TECHNICIAN]: 50,
  [UserRole.ADMINISTRATIVE_STAFF]: 30,
  [UserRole.PATIENT]: 10
};

/**
 * Check if roleA has higher hierarchy than roleB
 */
export function hasHigherRole(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}