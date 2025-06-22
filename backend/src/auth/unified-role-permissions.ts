/**
 * OmniCare EMR Backend - Unified Role-Based Permissions System
 * HIPAA-Compliant Permission Definitions with Role Unification
 */

import { UserRole, UserRoles, Permission, RolePermissions } from '@/types/auth.types';

/**
 * Unified Role-Based Permission Matrix
 * Maps all role types (short and long form) to their permissions
 */
export const UNIFIED_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRoles.PHYSICIAN]: {
    role: UserRoles.PHYSICIAN,
    permissions: [
      // Clinical Documentation
      Permission.CREATE_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.FINALIZE_CLINICAL_NOTES,
      
      // Prescription Management
      Permission.CREATE_PRESCRIPTIONS,
      Permission.MODIFY_PRESCRIPTIONS,
      Permission.VIEW_PRESCRIPTIONS,
      
      // Patient Management
      Permission.VIEW_PATIENT_RECORDS,
      Permission.EDIT_PATIENT_RECORDS,
      Permission.CREATE_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      
      // Orders and Lab Results
      Permission.CREATE_MEDICAL_ORDERS,
      Permission.VIEW_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      
      // Imaging and Radiology
      Permission.VIEW_IMAGING_RESULTS,
      
      // Administrative Functions
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.GENERATE_REPORTS
    ],
    description: 'Licensed physician with full clinical privileges',
    restrictions: [
      'Cannot access administrative functions',
      'Cannot manage system configuration'
    ]
  },

  [UserRoles.NURSING_STAFF]: {
    role: UserRoles.NURSING_STAFF,
    permissions: [
      // Clinical Documentation
      Permission.CREATE_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      
      // Patient Management
      Permission.VIEW_PATIENT_RECORDS,
      Permission.EDIT_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      
      // Nursing Functions
      Permission.DOCUMENT_VITAL_SIGNS,
      Permission.ADMINISTER_MEDICATIONS,
      Permission.DOCUMENT_NURSING_CARE,
      Permission.MANAGE_PATIENT_CARE_PLANS,
      
      // Orders and Lab Results
      Permission.VIEW_LAB_RESULTS,
      
      // Administrative Functions
      Permission.SCHEDULE_APPOINTMENTS
    ],
    description: 'Licensed nursing staff with patient care responsibilities',
    restrictions: [
      'Cannot create prescriptions',
      'Cannot finalize physician notes'
    ]
  },

  [UserRoles.ADMINISTRATIVE_STAFF]: {
    role: UserRoles.ADMINISTRATIVE_STAFF,
    permissions: [
      // Administrative Functions
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.MANAGE_BILLING,
      Permission.PROCESS_INSURANCE,
      Permission.GENERATE_REPORTS,
      
      // Patient Management
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      Permission.CREATE_PATIENT_RECORDS
    ],
    description: 'Administrative staff with billing and scheduling privileges',
    restrictions: [
      'Cannot access clinical data',
      'Cannot view medical records'
    ]
  },

  [UserRoles.SYSTEM_ADMINISTRATOR]: {
    role: UserRoles.SYSTEM_ADMINISTRATOR,
    permissions: [
      // System Administration
      Permission.MANAGE_USERS,
      Permission.CONFIGURE_SYSTEM,
      Permission.VIEW_AUDIT_LOGS,
      Permission.MANAGE_SECURITY_SETTINGS,
      
      // All other permissions (admin override)
      Permission.GENERATE_REPORTS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.MANAGE_BILLING
    ],
    description: 'System administrator with full system access',
    restrictions: [
      'Limited clinical data access for technical purposes only'
    ]
  },

  [UserRoles.PHARMACIST]: {
    role: UserRoles.PHARMACIST,
    permissions: [
      // Prescription Management
      Permission.VIEW_PRESCRIPTIONS,
      Permission.VERIFY_PRESCRIPTIONS,
      Permission.DISPENSE_MEDICATIONS,
      Permission.MODIFY_PRESCRIPTIONS,
      
      // Patient Management (limited)
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      
      // Clinical Documentation (limited)
      Permission.VIEW_CLINICAL_NOTES
    ],
    description: 'Licensed pharmacist with medication management privileges',
    restrictions: [
      'Limited to medication-related activities',
      'Cannot access full patient records'
    ]
  },

  [UserRoles.LABORATORY_TECHNICIAN]: {
    role: UserRoles.LABORATORY_TECHNICIAN,
    permissions: [
      // Orders and Lab Results
      Permission.VIEW_LAB_RESULTS,
      Permission.ENTER_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      
      // Patient Management (minimal)
      Permission.VIEW_PATIENT_DEMOGRAPHICS
    ],
    description: 'Laboratory technician with lab result management privileges',
    restrictions: [
      'Limited to laboratory functions only',
      'Cannot access clinical notes'
    ]
  },

  [UserRoles.RADIOLOGY_TECHNICIAN]: {
    role: UserRoles.RADIOLOGY_TECHNICIAN,
    permissions: [
      // Imaging and Radiology
      Permission.PERFORM_IMAGING_STUDIES,
      Permission.VIEW_IMAGING_RESULTS,
      Permission.MANAGE_IMAGING_EQUIPMENT,
      
      // Patient Management (minimal)
      Permission.VIEW_PATIENT_DEMOGRAPHICS
    ],
    description: 'Radiology technician with imaging privileges',
    restrictions: [
      'Limited to radiology functions only',
      'Cannot access clinical notes'
    ]
  },

  [UserRoles.PATIENT]: {
    role: UserRoles.PATIENT,
    permissions: [
      // Patient Portal Functions
      Permission.VIEW_OWN_RECORDS,
      Permission.REQUEST_APPOINTMENTS,
      Permission.MESSAGE_CARE_TEAM,
      Permission.UPDATE_PERSONAL_INFO
    ],
    description: 'Patient with access to their own health information',
    restrictions: [
      'Can only access own records',
      'Cannot access other patients data',
      'Limited administrative functions'
    ]
  },

  [UserRoles.BILLING]: {
    role: UserRoles.BILLING,
    permissions: [
      // Administrative Functions
      Permission.MANAGE_BILLING,
      Permission.PROCESS_INSURANCE,
      Permission.GENERATE_REPORTS,
      
      // Patient Management (limited)
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS
    ],
    description: 'Billing specialist with financial management privileges',
    restrictions: [
      'Limited to billing and insurance functions',
      'Cannot access clinical data'
    ]
  },

  [UserRoles.RECEPTIONIST]: {
    role: UserRoles.RECEPTIONIST,
    permissions: [
      // Administrative Functions
      Permission.SCHEDULE_APPOINTMENTS,
      
      // Patient Management (minimal)
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      Permission.CREATE_PATIENT_RECORDS
    ],
    description: 'Front desk staff with scheduling privileges',
    restrictions: [
      'Limited to scheduling and demographics',
      'Cannot access clinical or billing data'
    ]
  }
};

/**
 * Get permissions for a specific role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  const roleInfo = UNIFIED_ROLE_PERMISSIONS[role];
  return roleInfo ? roleInfo.permissions : [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Get role information (excluding permissions for lighter payloads)
 */
export function getRoleInfo(role: UserRole): Omit<RolePermissions, 'permissions'> {
  const roleInfo = UNIFIED_ROLE_PERMISSIONS[role];
  if (!roleInfo) {
    return {
      role,
      description: 'Unknown role',
      restrictions: ['Role not defined']
    };
  }
  
  const { permissions: _permissions, ...info } = roleInfo;
  return info;
}

/**
 * Get all available roles
 */
export function getAllRoles(): UserRole[] {
  return Object.keys(UNIFIED_ROLE_PERMISSIONS) as UserRole[];
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(role: UserRole, requiredPermissions: Permission[]): boolean {
  const userPermissions = getRolePermissions(role);
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

/**
 * Check if user has all of the required permissions
 */
export function hasAllPermissions(role: UserRole, requiredPermissions: Permission[]): boolean {
  const userPermissions = getRolePermissions(role);
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}