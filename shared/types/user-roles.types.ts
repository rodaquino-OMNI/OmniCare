// Shared user role types between frontend and backend

export type UserRoleShort = 
  | 'SUPER_ADMIN'
  | 'ADMIN' 
  | 'PHYSICIAN'
  | 'NURSE'
  | 'PATIENT'
  | 'COMPLIANCE_OFFICER'
  | 'MEDICAL_ASSISTANT'
  | 'LAB_TECHNICIAN';

export type UserRoleLong = 
  | 'SUPER_ADMINISTRATOR'
  | 'ADMINISTRATOR'
  | 'PHYSICIAN'
  | 'REGISTERED_NURSE'
  | 'PATIENT'
  | 'COMPLIANCE_OFFICER'
  | 'MEDICAL_ASSISTANT'
  | 'LABORATORY_TECHNICIAN';

export type UserRoleUnified = UserRoleShort | UserRoleLong;

export type UserRoleType = UserRoleUnified;

// Role mappings between short and long forms
export const ROLE_MAPPINGS: Record<UserRoleShort, UserRoleLong> = {
  'SUPER_ADMIN': 'SUPER_ADMINISTRATOR',
  'ADMIN': 'ADMINISTRATOR',
  'PHYSICIAN': 'PHYSICIAN',
  'NURSE': 'REGISTERED_NURSE',
  'PATIENT': 'PATIENT',
  'COMPLIANCE_OFFICER': 'COMPLIANCE_OFFICER',
  'MEDICAL_ASSISTANT': 'MEDICAL_ASSISTANT',
  'LAB_TECHNICIAN': 'LABORATORY_TECHNICIAN'
};

// Display names for roles
export const ROLE_DISPLAY_NAMES: Record<UserRoleUnified, string> = {
  'SUPER_ADMIN': 'Super Administrator',
  'SUPER_ADMINISTRATOR': 'Super Administrator',
  'ADMIN': 'Administrator',
  'ADMINISTRATOR': 'Administrator',
  'PHYSICIAN': 'Physician',
  'NURSE': 'Nurse',
  'REGISTERED_NURSE': 'Registered Nurse',
  'PATIENT': 'Patient',
  'COMPLIANCE_OFFICER': 'Compliance Officer',
  'MEDICAL_ASSISTANT': 'Medical Assistant',
  'LAB_TECHNICIAN': 'Lab Technician',
  'LABORATORY_TECHNICIAN': 'Laboratory Technician'
};

// Role hierarchy (higher numbers = more permissions)
export const ROLE_HIERARCHY: Record<UserRoleUnified, number> = {
  'PATIENT': 1,
  'LAB_TECHNICIAN': 2,
  'LABORATORY_TECHNICIAN': 2,
  'MEDICAL_ASSISTANT': 3,
  'NURSE': 4,
  'REGISTERED_NURSE': 4,
  'PHYSICIAN': 5,
  'COMPLIANCE_OFFICER': 6,
  'ADMIN': 7,
  'ADMINISTRATOR': 7,
  'SUPER_ADMIN': 8,
  'SUPER_ADMINISTRATOR': 8
};

// Utility functions
export function toCanonicalRole(role: UserRoleUnified): UserRoleLong {
  if (role in ROLE_MAPPINGS) {
    return ROLE_MAPPINGS[role as UserRoleShort];
  }
  return role as UserRoleLong;
}

export function toShortRole(role: UserRoleUnified): UserRoleShort {
  const reverseMapping = Object.entries(ROLE_MAPPINGS).find(([_, long]) => long === role);
  return reverseMapping ? reverseMapping[0] as UserRoleShort : role as UserRoleShort;
}

export function isCanonicalRole(role: string): role is UserRoleLong {
  return Object.values(ROLE_MAPPINGS).includes(role as UserRoleLong);
}

export function isShortRole(role: string): role is UserRoleShort {
  return Object.keys(ROLE_MAPPINGS).includes(role as UserRoleShort);
}

export function isValidRole(role: string): role is UserRoleUnified {
  return isCanonicalRole(role) || isShortRole(role);
}

export function getRoleDisplayName(role: UserRoleUnified): string {
  return ROLE_DISPLAY_NAMES[role] || role;
}

export function hasHigherRole(role1: UserRoleUnified, role2: UserRoleUnified): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

// Legacy export for backward compatibility
export const UserRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN' as const,
  ADMIN: 'ADMIN' as const,
  PHYSICIAN: 'PHYSICIAN' as const,
  NURSE: 'NURSE' as const,
  PATIENT: 'PATIENT' as const,
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER' as const,
  MEDICAL_ASSISTANT: 'MEDICAL_ASSISTANT' as const,
  LAB_TECHNICIAN: 'LAB_TECHNICIAN' as const,
  SUPER_ADMINISTRATOR: 'SUPER_ADMINISTRATOR' as const,
  ADMINISTRATOR: 'ADMINISTRATOR' as const,
  REGISTERED_NURSE: 'REGISTERED_NURSE' as const,
  LABORATORY_TECHNICIAN: 'LABORATORY_TECHNICIAN' as const
} as const;