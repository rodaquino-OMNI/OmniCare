/**
 * Unified User Role System for OmniCare EMR - Frontend Re-exports
 * 
 * Re-exports shared user role types for frontend usage.
 * For frontend compatibility, UserRole defaults to UserRoleShort.
 */

// Re-export all role types from shared types
export type {
  UserRoleShort,
  UserRoleLong,
  UserRoleUnified,
  UserRoleType
} from '../../../../shared/types/user-roles.types';

// Re-export UserRole with frontend default (short form)
export type { UserRoleShort as UserRole } from '../../../../shared/types/user-roles.types';

// Re-export all constants and utilities
export {
  ROLE_MAPPINGS,
  ROLE_DISPLAY_NAMES,
  ROLE_HIERARCHY,
  toCanonicalRole,
  toShortRole,
  isCanonicalRole,
  isShortRole,
  isValidRole,
  getRoleDisplayName,
  hasHigherRole,
  UserRoles
} from '../../../../shared/types/user-roles.types';