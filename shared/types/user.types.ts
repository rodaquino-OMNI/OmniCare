/**
 * Unified User Types for OmniCare EMR
 * 
 * This module provides unified user type definitions that work
 * across both frontend and backend components.
 */

import type { UserRole, UserRoleShort, UserRoleLong, UserRoleUnified } from './user-roles.types';

// Re-export role types
export type { UserRole, UserRoleShort, UserRoleLong, UserRoleUnified };

// Base user interface shared between frontend and backend
export interface BaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Frontend-specific user interface
export interface FrontendUser extends BaseUser {
  role: UserRoleShort;
  permissions: Permission[] | string[];
  department?: string;
  title?: string;
  avatar?: string;
  isMfaEnabled?: boolean;
  passwordChangedAt?: Date;
  failedLoginAttempts?: number;
}

// Backend-specific user interface
export interface BackendUser extends BaseUser {
  username: string;
  role: UserRole; // Can be either short or long form
  department?: string;
  licenseNumber?: string;
  npiNumber?: string;
  isActive: boolean;
  isMfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  passwordChangedAt: Date;
  failedLoginAttempts: number;
  accountLockedUntil?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Additional properties for backend compatibility
  passwordHash?: string;
  patient?: string;
  scope?: string[];
  permissions?: string[];
  clientId?: string;
}

// Unified user interface that works with both frontend and backend
export interface UnifiedUser extends BaseUser {
  username?: string;
  role: UserRoleUnified;
  permissions?: Permission[] | string[];
  department?: string;
  title?: string;
  avatar?: string;
  licenseNumber?: string;
  npiNumber?: string;
  isMfaEnabled?: boolean;
  mfaSecret?: string;
  lastLogin?: Date | string;
  passwordChangedAt?: Date | string;
  failedLoginAttempts?: number;
  accountLockedUntil?: Date | string;
  
  // SMART on FHIR / OAuth properties
  patient?: string;
  scope?: string[];
  clientId?: string;
}

// Permission interface
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

// Request user interface for authenticated requests
export interface RequestUser {
  id: string;
  username?: string;
  email?: string;
  role: UserRoleUnified;
  permissions?: string[];
  department?: string;
  scope?: string[];
  patient?: string;
  encounter?: string;
  clientId?: string;
}

// Session info interface
export interface SessionInfo {
  userId: string;
  sessionId: string;
  role: UserRoleUnified;
  permissions?: Permission[] | string[];
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date | string;
  expiresAt: Date | string;
}

// Type aliases for convenience
export type User = UnifiedUser;
export type { FrontendUser as ClientUser };
export type { BackendUser as ServerUser };