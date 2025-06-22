import { UserRole, Permission, RolePermissions } from '@/types/auth.types';
export declare const ROLE_PERMISSIONS: Record<UserRole, RolePermissions>;
export declare function getRolePermissions(role: UserRole): Permission[];
export declare function hasPermission(role: UserRole, permission: Permission): boolean;
export declare function getRoleInfo(role: UserRole): Omit<RolePermissions, 'permissions'>;
export declare function getAllRoles(): Array<Omit<RolePermissions, 'permissions'>>;
export declare const ROLE_HIERARCHY: Record<UserRole, number>;
export declare function hasHigherRole(roleA: UserRole, roleB: UserRole): boolean;
//# sourceMappingURL=role-permissions.d.ts.map