/**
 * OmniCare EMR Backend - Role-Based Access Control (RBAC) Permissions
 * HIPAA-Compliant Permission Definitions
 * 
 * @deprecated Use @/auth/unified-role-permissions instead for full role support
 */

import { UserRole, Permission, RolePermissions } from '../types/auth.types';
import { 
  UNIFIED_ROLE_PERMISSIONS, 
  getRolePermissions as getUnifiedRolePermissions,
  hasPermission as hasUnifiedPermission,
  getRoleInfo as getUnifiedRoleInfo
} from './unified-role-permissions';

/**
 * Basic Role-Based Permission Matrix for Backend (Legacy Support)
 * @deprecated Use UNIFIED_ROLE_PERMISSIONS from @/auth/unified-role-permissions instead
 */
export const ROLE_PERMISSIONS = UNIFIED_ROLE_PERMISSIONS;

/**
 * Helper function to get permissions for a specific role
 * @deprecated Use getUnifiedRolePermissions instead
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return getUnifiedRolePermissions(role);
}

/**
 * Helper function to check if a role has a specific permission
 * @deprecated Use hasUnifiedPermission instead
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return hasUnifiedPermission(role, permission);
}

/**
 * Helper function to get role description
 * @deprecated Use getUnifiedRoleInfo instead
 */
export function getRoleInfo(role: UserRole): Omit<RolePermissions, 'permissions'> {
  return getUnifiedRoleInfo(role);
}

/**
 * Permission hierarchy for role-based overrides
 * @deprecated Import ROLE_HIERARCHY from @/types/unified-user-roles instead
 */
export { ROLE_HIERARCHY } from '../types/unified-user-roles';

/**
 * Check if roleA has higher hierarchy than roleB
 * @deprecated Import hasHigherRole from @/types/unified-user-roles instead
 */
export { hasHigherRole } from '../types/unified-user-roles';
