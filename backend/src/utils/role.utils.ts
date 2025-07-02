/**
 * Role Type Conversion Utilities
 * 
 * This module provides type-safe conversion functions between string and UserRoleLong types,
 * ensuring proper validation and preventing type assignment errors.
 */

import { UserRoleLong, UserRoleUnified } from '../types/unified-user-roles';
import { toCanonicalRole, isCanonicalRole, isValidRole } from '../types/unified-user-roles';

/**
 * Converts a string to UserRoleLong with proper validation
 * @param role - The role string to convert
 * @returns UserRoleLong if valid, null if invalid
 */
export function toUserRoleLong(role: string): UserRoleLong | null {
  if (!role || typeof role !== 'string') {
    return null;
  }

  // First check if it's already a valid canonical role
  if (isCanonicalRole(role)) {
    return role;
  }

  // Try to convert from unified role format
  if (isValidRole(role)) {
    return toCanonicalRole(role as UserRoleUnified);
  }

  return null;
}

/**
 * Type guard to check if a string is a valid UserRoleLong
 * @param role - The role string to validate
 * @returns true if the role is a valid UserRoleLong
 */
export function isValidUserRole(role: string): role is UserRoleLong {
  return isCanonicalRole(role);
}

/**
 * Safely converts a string role to UserRoleLong with fallback
 * @param role - The role string to convert
 * @param fallback - Fallback role to use if conversion fails
 * @returns UserRoleLong (converted role or fallback)
 */
export function toUserRoleLongSafe(role: string, fallback: UserRoleLong = 'guest'): UserRoleLong {
  const converted = toUserRoleLong(role);
  return converted ?? fallback;
}

/**
 * Validates an array of roles contains only valid UserRoleLong values
 * @param roles - Array of role strings to validate
 * @returns Array of valid UserRoleLong values
 */
export function validateRoleArray(roles: string[]): UserRoleLong[] {
  return roles
    .map(role => toUserRoleLong(role))
    .filter((role): role is UserRoleLong => role !== null);
}

/**
 * Checks if a user role is included in an array of allowed roles
 * @param userRole - The user's role (string)
 * @param allowedRoles - Array of allowed UserRoleLong values
 * @returns true if the user role is allowed
 */
export function isRoleAllowed(userRole: string, allowedRoles: UserRoleLong[]): boolean {
  const convertedRole = toUserRoleLong(userRole);
  if (!convertedRole) {
    return false;
  }
  return allowedRoles.includes(convertedRole);
}

/**
 * Role comparison helper that handles type conversion
 * @param role1 - First role (string)
 * @param role2 - Second role (string)
 * @returns true if roles are equivalent
 */
export function rolesEqual(role1: string, role2: string): boolean {
  const canonicalRole1 = toUserRoleLong(role1);
  const canonicalRole2 = toUserRoleLong(role2);
  
  if (!canonicalRole1 || !canonicalRole2) {
    return false;
  }
  
  return canonicalRole1 === canonicalRole2;
}

/**
 * Error messages for role validation failures
 */
export const RoleValidationErrors = {
  INVALID_ROLE: 'Invalid role provided',
  ROLE_NOT_ALLOWED: 'Role is not in the allowed roles list',
  ROLE_CONVERSION_FAILED: 'Failed to convert role to canonical format'
} as const;

/**
 * Role validation result type
 */
export interface RoleValidationResult {
  isValid: boolean;
  role?: UserRoleLong;
  error?: string;
}

/**
 * Comprehensive role validation with detailed result
 * @param role - The role string to validate
 * @returns RoleValidationResult with validation details
 */
export function validateRole(role: string): RoleValidationResult {
  if (!role || typeof role !== 'string') {
    return {
      isValid: false,
      error: RoleValidationErrors.INVALID_ROLE
    };
  }

  const convertedRole = toUserRoleLong(role);
  if (!convertedRole) {
    return {
      isValid: false,
      error: RoleValidationErrors.ROLE_CONVERSION_FAILED
    };
  }

  return {
    isValid: true,
    role: convertedRole
  };
}