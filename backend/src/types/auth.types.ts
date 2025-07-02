/**
 * OmniCare EMR Backend - Authentication and Authorization Types
 * HIPAA-Compliant Role-Based Access Control System
 */

import { Request } from 'express';

// Define User interface locally since BackendUser doesn't exist in shared types
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRoleLong;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Import types from shared types
import type { 
  UserRole,
  UserRoleLong,
  UserRoleShort,
  UserRoleUnified,
  SessionInfo as SharedSessionInfo,
  RequestUser as SharedRequestUser,
  Permission as SharedPermissionEnum,
  RolePermissions as SharedRolePermissions,
  AuthToken as SharedAuthToken,
  LoginCredentials as SharedLoginCredentials,
  MfaSetup as SharedMfaSetup,
  PasswordPolicy as SharedPasswordPolicy,
  AuditLogEntry as SharedAuditLogEntry,
  SecurityEvent as SharedSecurityEvent,
  ComplianceReport as SharedComplianceReport,
  JWTAccessTokenPayload as SharedJWTAccessTokenPayload,
  JWTRefreshTokenPayload as SharedJWTRefreshTokenPayload,
  SMARTTokenPayload as SharedSMARTTokenPayload,
  AuthorizationCodeData as SharedAuthorizationCodeData,
  ExtendedSMARTTokenResponse as SharedExtendedSMARTTokenResponse,
  ConfigValue as SharedConfigValue
} from '../../../../shared/types';

// Re-export unified role types for backend use
export type { 
  UserRole,
  UserRoleShort,
  UserRoleLong,
  UserRoleUnified
} from './unified-user-roles';

export { 
  toCanonicalRole,
  toShortRole,
  isCanonicalRole,
  isShortRole,
  isValidRole,
  getRoleDisplayName,
  hasHigherRole,
  ROLE_MAPPINGS,
  ROLE_DISPLAY_NAMES,
  ROLE_HIERARCHY,
  UserRoles
} from './unified-user-roles';

// Re-export types with backend-specific modifications if needed
// User interface defined above

// Re-export Permission enum from shared types
export { PermissionEnum as Permission } from '../../../../shared/types';

// Update SessionInfo to use backend UserRole
export interface SessionInfo extends Omit<SharedSessionInfo, 'permissions'> {
  role: UserRole;
  permissions: SharedPermissionEnum[];
}

// Re-export shared types
export type RolePermissions = SharedRolePermissions;
export type AuthToken = SharedAuthToken;
export type LoginCredentials = SharedLoginCredentials;
export type MfaSetup = SharedMfaSetup;
export type PasswordPolicy = SharedPasswordPolicy;
export type AuditLogEntry = SharedAuditLogEntry;
export type SecurityEvent = SharedSecurityEvent;
export type ComplianceReport = SharedComplianceReport;
export type JWTAccessTokenPayload = SharedJWTAccessTokenPayload;
export type JWTRefreshTokenPayload = SharedJWTRefreshTokenPayload;
export type SMARTTokenPayload = SharedSMARTTokenPayload;
export type AuthorizationCodeData = SharedAuthorizationCodeData;
export type ExtendedSMARTTokenResponse = SharedExtendedSMARTTokenResponse;
export type RequestUser = SharedRequestUser;
export type ConfigValue = SharedConfigValue;

// Express Request extension for authenticated requests
export interface AuthenticatedRequest extends Request {
  // User is defined in Express namespace via express.d.ts
}
