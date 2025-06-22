/**
 * OmniCare EMR - Unified User Role Type System
 * 
 * This file provides a unified type system for user roles across frontend and backend.
 * It supports both naming conventions and provides type-safe conversions between them.
 */

/**
 * Canonical user roles using backend naming convention (full names with underscores)
 * These are the source of truth for all role definitions
 */
export enum UserRole {
  PHYSICIAN = 'physician',
  NURSING_STAFF = 'nursing_staff',
  ADMINISTRATIVE_STAFF = 'administrative_staff',
  SYSTEM_ADMINISTRATOR = 'system_administrator',
  PHARMACIST = 'pharmacist',
  LABORATORY_TECHNICIAN = 'laboratory_technician',
  RADIOLOGY_TECHNICIAN = 'radiology_technician',
  PATIENT = 'patient',
  BILLING_STAFF = 'billing_staff',
  RECEPTIONIST = 'receptionist'
}

/**
 * Frontend-friendly role type using short names
 * Used for UI components and frontend logic
 */
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

/**
 * Backend role values (string literals from enum)
 */
export type UserRoleLong = `${UserRole}`;

/**
 * Union type that accepts both naming conventions
 */
export type UserRoleUnified = UserRoleShort | UserRoleLong;

/**
 * Bidirectional mapping between short and long role names
 */
export const ROLE_MAPPINGS = {
  // Short to Long mappings
  shortToLong: {
    'physician': UserRole.PHYSICIAN,
    'nurse': UserRole.NURSING_STAFF,
    'admin': UserRole.ADMINISTRATIVE_STAFF,
    'system_admin': UserRole.SYSTEM_ADMINISTRATOR,
    'pharmacist': UserRole.PHARMACIST,
    'lab_tech': UserRole.LABORATORY_TECHNICIAN,
    'radiology_tech': UserRole.RADIOLOGY_TECHNICIAN,
    'patient': UserRole.PATIENT,
    'billing': UserRole.BILLING_STAFF,
    'receptionist': UserRole.RECEPTIONIST
  },
  
  // Long to Short mappings
  longToShort: {
    [UserRole.PHYSICIAN]: 'physician' as const,
    [UserRole.NURSING_STAFF]: 'nurse' as const,
    [UserRole.ADMINISTRATIVE_STAFF]: 'admin' as const,
    [UserRole.SYSTEM_ADMINISTRATOR]: 'system_admin' as const,
    [UserRole.PHARMACIST]: 'pharmacist' as const,
    [UserRole.LABORATORY_TECHNICIAN]: 'lab_tech' as const,
    [UserRole.RADIOLOGY_TECHNICIAN]: 'radiology_tech' as const,
    [UserRole.PATIENT]: 'patient' as const,
    [UserRole.BILLING_STAFF]: 'billing' as const,
    [UserRole.RECEPTIONIST]: 'receptionist' as const
  }
} as const;

/**
 * Role display names for UI
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.PHYSICIAN]: 'Physician',
  [UserRole.NURSING_STAFF]: 'Nursing Staff',
  [UserRole.ADMINISTRATIVE_STAFF]: 'Administrative Staff',
  [UserRole.SYSTEM_ADMINISTRATOR]: 'System Administrator',
  [UserRole.PHARMACIST]: 'Pharmacist',
  [UserRole.LABORATORY_TECHNICIAN]: 'Laboratory Technician',
  [UserRole.RADIOLOGY_TECHNICIAN]: 'Radiology Technician',
  [UserRole.PATIENT]: 'Patient',
  [UserRole.BILLING_STAFF]: 'Billing Staff',
  [UserRole.RECEPTIONIST]: 'Receptionist'
};

/**
 * Converts any role representation to the canonical UserRole enum
 */
export function toCanonicalRole(role: UserRoleUnified): UserRole {
  // If it's already a canonical role, return it
  if (Object.values(UserRole).includes(role as UserRole)) {
    return role as UserRole;
  }
  
  // Convert from short form
  const canonicalRole = ROLE_MAPPINGS.shortToLong[role as UserRoleShort];
  if (canonicalRole) {
    return canonicalRole;
  }
  
  throw new Error(`Invalid role: ${role}`);
}

/**
 * Converts a role to the short form used in frontend
 */
export function toShortRole(role: UserRoleUnified): UserRoleShort {
  // If it's already short form, return it
  if (role in ROLE_MAPPINGS.shortToLong) {
    return role as UserRoleShort;
  }
  
  // Convert from canonical form
  const shortRole = ROLE_MAPPINGS.longToShort[role as UserRole];
  if (shortRole) {
    return shortRole;
  }
  
  throw new Error(`Invalid role: ${role}`);
}

/**
 * Type guard to check if a value is a valid canonical role
 */
export function isCanonicalRole(role: unknown): role is UserRole {
  return typeof role === 'string' && Object.values(UserRole).includes(role as UserRole);
}

/**
 * Type guard to check if a value is a valid short role
 */
export function isShortRole(role: unknown): role is UserRoleShort {
  return typeof role === 'string' && role in ROLE_MAPPINGS.shortToLong;
}

/**
 * Type guard to check if a value is any valid role
 */
export function isValidRole(role: unknown): role is UserRoleUnified {
  return isCanonicalRole(role) || isShortRole(role);
}

/**
 * Gets the display name for any role representation
 */
export function getRoleDisplayName(role: UserRoleUnified): string {
  const canonicalRole = toCanonicalRole(role);
  return ROLE_DISPLAY_NAMES[canonicalRole];
}

/**
 * Role hierarchy for permission escalation
 * Higher numbers indicate higher authority
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SYSTEM_ADMINISTRATOR]: 100,
  [UserRole.PHYSICIAN]: 90,
  [UserRole.PHARMACIST]: 70,
  [UserRole.NURSING_STAFF]: 60,
  [UserRole.LABORATORY_TECHNICIAN]: 50,
  [UserRole.RADIOLOGY_TECHNICIAN]: 50,
  [UserRole.ADMINISTRATIVE_STAFF]: 30,
  [UserRole.BILLING_STAFF]: 25,
  [UserRole.RECEPTIONIST]: 20,
  [UserRole.PATIENT]: 10
};

/**
 * Check if roleA has higher hierarchy than roleB
 */
export function hasHigherRole(roleA: UserRoleUnified, roleB: UserRoleUnified): boolean {
  const canonicalA = toCanonicalRole(roleA);
  const canonicalB = toCanonicalRole(roleB);
  return ROLE_HIERARCHY[canonicalA] > ROLE_HIERARCHY[canonicalB];
}

/**
 * Legacy compatibility exports
 * These maintain backward compatibility with existing code
 */
export type UserRoleType = UserRoleShort; // For frontend compatibility
export { UserRole as BackendUserRole }; // For systems expecting the backend enum name