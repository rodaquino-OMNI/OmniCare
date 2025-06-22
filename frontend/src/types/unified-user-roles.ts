/**
 * Unified User Role System for OmniCare EMR
 * 
 * This module provides a unified type system for user roles that works
 * across both frontend and backend components. It handles the translation
 * between different role formats used throughout the application.
 */

// Core role definitions using string literals for consistency
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

// Long form role names (used in backend)
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

// Main UserRole type (defaults to short form for frontend compatibility)
export type UserRole = UserRoleShort;

// Unified type that includes both formats
export type UserRoleUnified = UserRoleShort | UserRoleLong;

// Backward compatibility alias
export type UserRoleType = UserRoleShort;

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
export const ROLE_DISPLAY_NAMES: Record<UserRoleShort, string> = {
  'physician': 'Physician',
  'nurse': 'Nurse',
  'admin': 'Administrator',
  'system_admin': 'System Administrator',
  'pharmacist': 'Pharmacist',
  'lab_tech': 'Lab Technician',
  'radiology_tech': 'Radiology Technician',
  'patient': 'Patient',
  'billing': 'Billing',
  'receptionist': 'Receptionist'
};

// Role hierarchy (higher numbers = higher privileges)
export const ROLE_HIERARCHY: Record<UserRoleShort, number> = {
  'patient': 1,
  'receptionist': 2,
  'billing': 3,
  'lab_tech': 4,
  'radiology_tech': 4,
  'nurse': 5,
  'pharmacist': 6,
  'physician': 7,
  'admin': 8,
  'system_admin': 9
};

// Utility functions
export function toCanonicalRole(role: UserRoleUnified): UserRoleLong {
  if (role in ROLE_MAPPINGS) {
    const mapped = ROLE_MAPPINGS[role as keyof typeof ROLE_MAPPINGS];
    // If it maps to a long form, return it; otherwise it's already canonical
    return (Object.values(ROLE_MAPPINGS).includes(mapped) ? mapped : role) as UserRoleLong;
  }
  return role as UserRoleLong;
}

export function toShortRole(role: UserRoleUnified): UserRoleShort {
  if (role in ROLE_MAPPINGS) {
    const mapped = ROLE_MAPPINGS[role as keyof typeof ROLE_MAPPINGS];
    // If it maps to a short form, return it; otherwise it's already short
    return (Object.keys(ROLE_MAPPINGS).includes(mapped) ? mapped : role) as UserRoleShort;
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
  const shortRole = toShortRole(role);
  return ROLE_DISPLAY_NAMES[shortRole] || role;
}

export function hasHigherRole(role1: UserRoleUnified, role2: UserRoleUnified): boolean {
  const shortRole1 = toShortRole(role1);
  const shortRole2 = toShortRole(role2);
  return ROLE_HIERARCHY[shortRole1] > ROLE_HIERARCHY[shortRole2];
}

// Constants for type-safe role comparisons
export const UserRoles = {
  PHYSICIAN: 'physician' as const,
  NURSE: 'nurse' as const,
  ADMIN: 'admin' as const,
  SYSTEM_ADMIN: 'system_admin' as const,
  PHARMACIST: 'pharmacist' as const,
  LAB_TECH: 'lab_tech' as const,
  RADIOLOGY_TECH: 'radiology_tech' as const,
  PATIENT: 'patient' as const,
  BILLING: 'billing' as const,
  RECEPTIONIST: 'receptionist' as const
} as const;