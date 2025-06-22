/**
 * Role Mappings for OmniCare EMR Frontend
 * 
 * This module provides utilities for mapping between different role formats
 * used in frontend and backend systems.
 */

import type { UserRole, UserRoleShort, UserRoleLong, UserRoleUnified } from '@/types';

// Role mapping between short and long forms
export const ROLE_MAPPINGS = {
  // Short to Long (frontend to backend)
  'physician': 'physician',
  'nurse': 'nursing_staff',
  'admin': 'administrative_staff',
  'system_admin': 'system_administrator',
  'pharmacist': 'pharmacist',
  'lab_tech': 'laboratory_technician',
  'radiology_tech': 'radiology_technician',
  'patient': 'patient',
  'billing': 'billing',
  'receptionist': 'receptionist',
  
  // Long to Short (backend to frontend)
  'nursing_staff': 'nurse',
  'administrative_staff': 'admin',
  'system_administrator': 'system_admin',
  'laboratory_technician': 'lab_tech',
  'radiology_technician': 'radiology_tech'
} as const;

// Map any role format to frontend format
export function mapToFrontendRole(role: string): UserRole {
  if (role in ROLE_MAPPINGS) {
    const mapped = ROLE_MAPPINGS[role as keyof typeof ROLE_MAPPINGS];
    // Return the short form if available, otherwise return the original
    const shortRoles: UserRole[] = [
      'physician', 'nurse', 'admin', 'system_admin', 'pharmacist',
      'lab_tech', 'radiology_tech', 'patient', 'billing', 'receptionist'
    ];
    return shortRoles.includes(mapped as UserRole) ? mapped as UserRole : role as UserRole;
  }
  return role as UserRole;
}

// Map frontend role to backend format  
export function mapToBackendRole(role: UserRole): string {
  return ROLE_MAPPINGS[role] || role;
}

// Check if role is in short format
export function isShortRole(role: string): boolean {
  const shortRoles = [
    'physician', 'nurse', 'admin', 'system_admin', 'pharmacist',
    'lab_tech', 'radiology_tech', 'patient', 'billing', 'receptionist'
  ];
  return shortRoles.includes(role);
}

// Check if role is in long format
export function isLongRole(role: string): boolean {
  const longRoles = [
    'physician', 'nursing_staff', 'administrative_staff', 'system_administrator',
    'pharmacist', 'laboratory_technician', 'radiology_technician', 'patient',
    'billing', 'receptionist'
  ];
  return longRoles.includes(role);
}

// Validate if role is in any supported format
export function isValidRole(role: string): boolean {
  return isShortRole(role) || isLongRole(role);
}

// Get display name for any role format
export function getRoleDisplayName(role: string): string {
  const frontendRole = mapToFrontendRole(role);
  
  const displayNames: Record<UserRole, string> = {
    'physician': 'Physician',
    'nurse': 'Nurse',
    'admin': 'Administrator',
    'system_admin': 'System Administrator',
    'pharmacist': 'Pharmacist',
    'lab_tech': 'Lab Technician',
    'radiology_tech': 'Radiology Technician',
    'patient': 'Patient',
    'billing': 'Billing',
    'receptionist': 'Receptionist'
  };
  
  return displayNames[frontendRole] || role;
}

// Deprecated function name for backwards compatibility
export const mapBackendToFrontendRole = mapToFrontendRole;