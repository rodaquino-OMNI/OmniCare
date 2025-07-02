/**
 * Unified User Role System for OmniCare EMR - Backend Re-exports
 * 
 * Re-exports shared user role types for backend usage.
 * For backend compatibility, UserRole defaults to UserRoleLong.
 */

// Re-export all role types from shared types
export type {
  UserRoleShort,
  UserRoleLong,
  UserRoleUnified
} from '../../../shared/types/user-roles.types';

// Re-export UserRole with backend default (long form)
export type { UserRoleLong as UserRole } from '../../../shared/types/user-roles.types';

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
} from '../../../shared/types/user-roles.types';