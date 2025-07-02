export type UserRoleShort = 'SUPER_ADMIN' | 'ADMIN' | 'PHYSICIAN' | 'NURSE' | 'PATIENT' | 'COMPLIANCE_OFFICER' | 'MEDICAL_ASSISTANT' | 'LAB_TECHNICIAN';
export type UserRoleLong = 'SUPER_ADMINISTRATOR' | 'ADMINISTRATOR' | 'PHYSICIAN' | 'REGISTERED_NURSE' | 'PATIENT' | 'COMPLIANCE_OFFICER' | 'MEDICAL_ASSISTANT' | 'LABORATORY_TECHNICIAN';
export type UserRoleUnified = UserRoleShort | UserRoleLong;
export type UserRoleType = UserRoleUnified;
export declare const ROLE_MAPPINGS: Record<UserRoleShort, UserRoleLong>;
export declare const ROLE_DISPLAY_NAMES: Record<UserRoleUnified, string>;
export declare const ROLE_HIERARCHY: Record<UserRoleUnified, number>;
export declare function toCanonicalRole(role: UserRoleUnified): UserRoleLong;
export declare function toShortRole(role: UserRoleUnified): UserRoleShort;
export declare function isCanonicalRole(role: string): role is UserRoleLong;
export declare function isShortRole(role: string): role is UserRoleShort;
export declare function isValidRole(role: string): role is UserRoleUnified;
export declare function getRoleDisplayName(role: UserRoleUnified): string;
export declare function hasHigherRole(role1: UserRoleUnified, role2: UserRoleUnified): boolean;
export declare const UserRoles: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly ADMIN: "ADMIN";
    readonly PHYSICIAN: "PHYSICIAN";
    readonly NURSE: "NURSE";
    readonly PATIENT: "PATIENT";
    readonly COMPLIANCE_OFFICER: "COMPLIANCE_OFFICER";
    readonly MEDICAL_ASSISTANT: "MEDICAL_ASSISTANT";
    readonly LAB_TECHNICIAN: "LAB_TECHNICIAN";
    readonly SUPER_ADMINISTRATOR: "SUPER_ADMINISTRATOR";
    readonly ADMINISTRATOR: "ADMINISTRATOR";
    readonly REGISTERED_NURSE: "REGISTERED_NURSE";
    readonly LABORATORY_TECHNICIAN: "LABORATORY_TECHNICIAN";
};
//# sourceMappingURL=user-roles.types.d.ts.map