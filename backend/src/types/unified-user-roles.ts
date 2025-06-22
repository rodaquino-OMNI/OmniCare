/**
 * Unified User Role System for OmniCare EMR Backend
 * 
 * This module provides backend-specific unified role types that can work
 * with both frontend short form and backend long form roles.
 */

// Short form roles (used in frontend)
export type UserRoleShort = 
  | 'physician'
  | 'nurse' 
  | 'admin'
  | 'system_admin'
  | 'pharmacist'
  | 'lab_tech'
  | 'radiology_tech'
  | 'patient'
  | 'billing'
  | 'receptionist';

// Long form role names (canonical backend format)
export type UserRoleLong =
  | 'physician'
  | 'nursing_staff'
  | 'administrative_staff'
  | 'system_administrator'
  | 'pharmacist'
  | 'laboratory_technician'
  | 'radiology_technician'
  | 'patient'
  | 'billing'
  | 'receptionist';

// Main UserRole type (defaults to long form for backend)
export type UserRole = UserRoleLong;

// Unified type that includes both formats
export type UserRoleUnified = UserRoleShort | UserRoleLong;

// Role mapping between short and long forms
export const ROLE_MAPPINGS = {
  // Short to Long
  'physician': 'physician',
  'nurse': 'nursing_staff',
  'admin': 'administrative_staff',
  'system_admin': 'system_administrator',
  'pharmacist': 'pharmacist',
  'lab_tech': 'laboratory_technician',
  'radiology_tech': 'radiology_technician',
  'patient': 'patient',
  'billing': 'billing',
  'receptionist': 'receptionist',
  
  // Long to Short
  'nursing_staff': 'nurse',
  'administrative_staff': 'admin',
  'system_administrator': 'system_admin',
  'laboratory_technician': 'lab_tech',
  'radiology_technician': 'radiology_tech'
} as const;

// Display names for roles
export const ROLE_DISPLAY_NAMES: Record<UserRoleLong, string> = {
  'physician': 'Physician',
  'nursing_staff': 'Nurse',
  'administrative_staff': 'Administrator',
  'system_administrator': 'System Administrator',
  'pharmacist': 'Pharmacist',
  'laboratory_technician': 'Lab Technician',
  'radiology_technician': 'Radiology Technician',
  'patient': 'Patient',
  'billing': 'Billing',
  'receptionist': 'Receptionist'
};

// Role hierarchy (higher numbers = higher privileges)
export const ROLE_HIERARCHY: Record<UserRoleLong, number> = {
  'patient': 1,
  'receptionist': 2,
  'billing': 3,
  'laboratory_technician': 4,
  'radiology_technician': 4,
  'nursing_staff': 5,
  'pharmacist': 6,
  'physician': 7,
  'administrative_staff': 8,
  'system_administrator': 9
};

// Utility functions
export function toCanonicalRole(role: UserRoleUnified): UserRoleLong {
  if (role in ROLE_MAPPINGS) {
    const mapped = ROLE_MAPPINGS[role as keyof typeof ROLE_MAPPINGS];
    // Check if the mapped value is a long form role
    const longRoles: UserRoleLong[] = [
      'physician', 'nursing_staff', 'administrative_staff', 'system_administrator',
      'pharmacist', 'laboratory_technician', 'radiology_technician', 'patient',
      'billing', 'receptionist'
    ];
    return longRoles.includes(mapped as UserRoleLong) ? mapped as UserRoleLong : role as UserRoleLong;
  }
  return role as UserRoleLong;
}

export function toShortRole(role: UserRoleUnified): UserRoleShort {
  if (role in ROLE_MAPPINGS) {
    const mapped = ROLE_MAPPINGS[role as keyof typeof ROLE_MAPPINGS];
    // Check if the mapped value is a short form role
    const shortRoles: UserRoleShort[] = [
      'physician', 'nurse', 'admin', 'system_admin', 'pharmacist',
      'lab_tech', 'radiology_tech', 'patient', 'billing', 'receptionist'
    ];
    return shortRoles.includes(mapped as UserRoleShort) ? mapped as UserRoleShort : role as UserRoleShort;
  }
  return role as UserRoleShort;
}

export function isCanonicalRole(role: string): role is UserRoleLong {
  const longRoles: UserRoleLong[] = [
    'physician', 'nursing_staff', 'administrative_staff', 'system_administrator',
    'pharmacist', 'laboratory_technician', 'radiology_technician', 'patient',
    'billing', 'receptionist'
  ];
  return longRoles.includes(role as UserRoleLong);
}

export function isShortRole(role: string): role is UserRoleShort {
  const shortRoles: UserRoleShort[] = [
    'physician', 'nurse', 'admin', 'system_admin', 'pharmacist',
    'lab_tech', 'radiology_tech', 'patient', 'billing', 'receptionist'
  ];
  return shortRoles.includes(role as UserRoleShort);
}

export function isValidRole(role: string): role is UserRoleUnified {
  return isShortRole(role) || isCanonicalRole(role);
}

export function getRoleDisplayName(role: UserRoleUnified): string {
  const longRole = toCanonicalRole(role);
  return ROLE_DISPLAY_NAMES[longRole] || role;
}

export function hasHigherRole(role1: UserRoleUnified, role2: UserRoleUnified): boolean {
  const longRole1 = toCanonicalRole(role1);
  const longRole2 = toCanonicalRole(role2);
  return ROLE_HIERARCHY[longRole1] > ROLE_HIERARCHY[longRole2];
}

// Constants for type-safe role comparisons
export const UserRoles = {
  PHYSICIAN: 'physician' as const,
  NURSING_STAFF: 'nursing_staff' as const,
  ADMINISTRATIVE_STAFF: 'administrative_staff' as const,
  SYSTEM_ADMINISTRATOR: 'system_administrator' as const,
  PHARMACIST: 'pharmacist' as const,
  LABORATORY_TECHNICIAN: 'laboratory_technician' as const,
  RADIOLOGY_TECHNICIAN: 'radiology_technician' as const,
  PATIENT: 'patient' as const,
  BILLING: 'billing' as const,
  RECEPTIONIST: 'receptionist' as const
} as const;