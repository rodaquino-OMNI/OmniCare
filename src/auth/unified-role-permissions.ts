/**
 * OmniCare EMR - Unified Role-Based Access Control (RBAC) Permissions
 * HIPAA-Compliant Permission Definitions
 */

import { UserRole, UserRoleUnified, toCanonicalRole } from '@/types/unified-user-roles';
import { Permission, RolePermissions } from '@/types/auth.types';

/**
 * Comprehensive Role-Based Permission Matrix
 * Includes all roles with their specific permissions
 */
export const UNIFIED_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.PHYSICIAN]: {
    role: UserRole.PHYSICIAN,
    description: 'Full clinical access with prescription authority',
    permissions: [
      Permission.CREATE_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.FINALIZE_CLINICAL_NOTES,
      Permission.CREATE_PRESCRIPTIONS,
      Permission.MODIFY_PRESCRIPTIONS,
      Permission.VIEW_PRESCRIPTIONS,
      Permission.VIEW_PATIENT_RECORDS,
      Permission.EDIT_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.CREATE_MEDICAL_ORDERS,
      Permission.VIEW_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      Permission.VIEW_IMAGING_RESULTS,
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.GENERATE_REPORTS
    ]
  },

  [UserRole.NURSING_STAFF]: {
    role: UserRole.NURSING_STAFF,
    description: 'Clinical documentation and patient care management',
    permissions: [
      Permission.CREATE_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.VIEW_PATIENT_RECORDS,
      Permission.EDIT_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.DOCUMENT_VITAL_SIGNS,
      Permission.ADMINISTER_MEDICATIONS,
      Permission.DOCUMENT_NURSING_CARE,
      Permission.MANAGE_PATIENT_CARE_PLANS,
      Permission.VIEW_PRESCRIPTIONS,
      Permission.VIEW_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      Permission.SCHEDULE_APPOINTMENTS
    ]
  },

  [UserRole.ADMINISTRATIVE_STAFF]: {
    role: UserRole.ADMINISTRATIVE_STAFF,
    description: 'Patient registration, scheduling, and general administration',
    permissions: [
      Permission.CREATE_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.MANAGE_BILLING,
      Permission.PROCESS_INSURANCE,
      Permission.GENERATE_REPORTS,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.VIEW_PATIENT_RECORDS
    ]
  },

  [UserRole.SYSTEM_ADMINISTRATOR]: {
    role: UserRole.SYSTEM_ADMINISTRATOR,
    description: 'System configuration and user management',
    permissions: [
      Permission.MANAGE_USERS,
      Permission.CONFIGURE_SYSTEM,
      Permission.VIEW_AUDIT_LOGS,
      Permission.MANAGE_SECURITY_SETTINGS,
      Permission.GENERATE_REPORTS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.VIEW_PATIENT_RECORDS
    ]
  },

  [UserRole.PHARMACIST]: {
    role: UserRole.PHARMACIST,
    description: 'Medication verification and pharmaceutical care',
    permissions: [
      Permission.VIEW_PRESCRIPTIONS,
      Permission.VERIFY_PRESCRIPTIONS,
      Permission.DISPENSE_MEDICATIONS,
      Permission.MODIFY_PRESCRIPTIONS,
      Permission.VIEW_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_LAB_RESULTS,
      Permission.CREATE_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.GENERATE_REPORTS
    ]
  },

  [UserRole.LABORATORY_TECHNICIAN]: {
    role: UserRole.LABORATORY_TECHNICIAN,
    description: 'Laboratory specimen processing and result entry',
    permissions: [
      Permission.VIEW_LAB_RESULTS,
      Permission.ENTER_LAB_RESULTS,
      Permission.ACKNOWLEDGE_CRITICAL_RESULTS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_PATIENT_RECORDS,
      Permission.CREATE_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.GENERATE_REPORTS
    ]
  },

  [UserRole.RADIOLOGY_TECHNICIAN]: {
    role: UserRole.RADIOLOGY_TECHNICIAN,
    description: 'Imaging study performance and equipment management',
    permissions: [
      Permission.PERFORM_IMAGING_STUDIES,
      Permission.VIEW_IMAGING_RESULTS,
      Permission.MANAGE_IMAGING_EQUIPMENT,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_PATIENT_RECORDS,
      Permission.CREATE_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.GENERATE_REPORTS
    ]
  },

  [UserRole.BILLING_STAFF]: {
    role: UserRole.BILLING_STAFF,
    description: 'Billing, insurance claims, and financial administration',
    permissions: [
      Permission.MANAGE_BILLING,
      Permission.PROCESS_INSURANCE,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_PATIENT_RECORDS,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.GENERATE_REPORTS,
      Permission.SCHEDULE_APPOINTMENTS
    ],
    restrictions: [
      'Cannot view detailed clinical information beyond diagnosis codes',
      'Limited to financial and insurance-related patient data'
    ]
  },

  [UserRole.RECEPTIONIST]: {
    role: UserRole.RECEPTIONIST,
    description: 'Front desk operations, appointment scheduling, and patient check-in',
    permissions: [
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.VIEW_PATIENT_DEMOGRAPHICS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      Permission.CREATE_PATIENT_RECORDS,
      Permission.VIEW_PATIENT_RECORDS
    ],
    restrictions: [
      'Cannot view clinical notes or medical history',
      'Limited to demographic and scheduling information'
    ]
  },

  [UserRole.PATIENT]: {
    role: UserRole.PATIENT,
    description: 'Personal health record access and patient portal functions',
    permissions: [
      Permission.VIEW_OWN_RECORDS,
      Permission.UPDATE_PERSONAL_INFO,
      Permission.REQUEST_APPOINTMENTS,
      Permission.MESSAGE_CARE_TEAM,
      Permission.VIEW_PRESCRIPTIONS,
      Permission.VIEW_LAB_RESULTS,
      Permission.VIEW_IMAGING_RESULTS,
      Permission.VIEW_CLINICAL_NOTES
    ],
    restrictions: [
      'Can only access their own medical records',
      'Cannot modify clinical information'
    ]
  }
};

/**
 * Helper function to get permissions for any role representation
 */
export function getRolePermissions(role: UserRoleUnified): Permission[] {
  const canonicalRole = toCanonicalRole(role);
  return UNIFIED_ROLE_PERMISSIONS[canonicalRole]?.permissions || [];
}

/**
 * Helper function to check if a role has a specific permission
 */
export function hasPermission(role: UserRoleUnified, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}

/**
 * Helper function to get role information
 */
export function getRoleInfo(role: UserRoleUnified): Omit<RolePermissions, 'permissions'> {
  const canonicalRole = toCanonicalRole(role);
  const roleData = UNIFIED_ROLE_PERMISSIONS[canonicalRole];
  return {
    role: roleData.role,
    description: roleData.description,
    restrictions: roleData.restrictions
  };
}

/**
 * Get all permissions for multiple roles (useful for users with multiple roles)
 */
export function getCombinedPermissions(roles: UserRoleUnified[]): Permission[] {
  const permissionSet = new Set<Permission>();
  
  for (const role of roles) {
    const permissions = getRolePermissions(role);
    permissions.forEach(permission => permissionSet.add(permission));
  }
  
  return Array.from(permissionSet);
}

/**
 * Check if any of the provided roles has the specified permission
 */
export function hasAnyRolePermission(roles: UserRoleUnified[], permission: Permission): boolean {
  return roles.some(role => hasPermission(role, permission));
}

/**
 * Legacy export for backward compatibility
 */
export { UNIFIED_ROLE_PERMISSIONS as ROLE_PERMISSIONS };