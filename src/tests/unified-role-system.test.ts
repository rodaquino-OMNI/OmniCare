/**
 * Unified UserRole Type System Tests
 * Validates all role conversions, permissions, and type safety
 */

import {
  UserRole,
  UserRoleShort,
  UserRoleLong,
  UserRoleUnified,
  toCanonicalRole,
  toShortRole,
  isCanonicalRole,
  isShortRole,
  isValidRole,
  getRoleDisplayName,
  hasHigherRole,
  ROLE_MAPPINGS,
  ROLE_DISPLAY_NAMES,
  ROLE_HIERARCHY
} from '@/types/unified-user-roles';

import {
  getRolePermissions,
  hasPermission,
  getRoleInfo,
  getCombinedPermissions,
  hasAnyRolePermission,
  UNIFIED_ROLE_PERMISSIONS
} from '@/auth/unified-role-permissions';

import { Permission } from '@/types/auth.types';

describe('Unified Role System', () => {
  describe('Role Type Conversions', () => {
    test('should convert short to canonical roles', () => {
      expect(toCanonicalRole('nurse')).toBe(UserRole.NURSING_STAFF);
      expect(toCanonicalRole('admin')).toBe(UserRole.ADMINISTRATIVE_STAFF);
      expect(toCanonicalRole('system_admin')).toBe(UserRole.SYSTEM_ADMINISTRATOR);
      expect(toCanonicalRole('lab_tech')).toBe(UserRole.LABORATORY_TECHNICIAN);
      expect(toCanonicalRole('radiology_tech')).toBe(UserRole.RADIOLOGY_TECHNICIAN);
      expect(toCanonicalRole('billing')).toBe(UserRole.BILLING_STAFF);
      expect(toCanonicalRole('receptionist')).toBe(UserRole.RECEPTIONIST);
    });

    test('should convert canonical to short roles', () => {
      expect(toShortRole(UserRole.NURSING_STAFF)).toBe('nurse');
      expect(toShortRole(UserRole.ADMINISTRATIVE_STAFF)).toBe('admin');
      expect(toShortRole(UserRole.SYSTEM_ADMINISTRATOR)).toBe('system_admin');
      expect(toShortRole(UserRole.LABORATORY_TECHNICIAN)).toBe('lab_tech');
      expect(toShortRole(UserRole.RADIOLOGY_TECHNICIAN)).toBe('radiology_tech');
      expect(toShortRole(UserRole.BILLING_STAFF)).toBe('billing');
      expect(toShortRole(UserRole.RECEPTIONIST)).toBe('receptionist');
    });

    test('should handle identity conversions', () => {
      // Already canonical
      expect(toCanonicalRole(UserRole.PHYSICIAN)).toBe(UserRole.PHYSICIAN);
      expect(toCanonicalRole(UserRole.PATIENT)).toBe(UserRole.PATIENT);
      
      // Already short
      expect(toShortRole('physician')).toBe('physician');
      expect(toShortRole('patient')).toBe('patient');
    });

    test('should throw on invalid roles', () => {
      expect(() => toCanonicalRole('invalid_role' as any)).toThrow('Invalid role: invalid_role');
      expect(() => toShortRole('invalid_role' as any)).toThrow('Invalid role: invalid_role');
    });
  });

  describe('Role Validation', () => {
    test('isCanonicalRole should identify canonical roles', () => {
      expect(isCanonicalRole(UserRole.PHYSICIAN)).toBe(true);
      expect(isCanonicalRole('nursing_staff')).toBe(true);
      expect(isCanonicalRole('billing_staff')).toBe(true);
      expect(isCanonicalRole('nurse')).toBe(false);
      expect(isCanonicalRole('invalid')).toBe(false);
    });

    test('isShortRole should identify short roles', () => {
      expect(isShortRole('nurse')).toBe(true);
      expect(isShortRole('admin')).toBe(true);
      expect(isShortRole('billing')).toBe(true);
      expect(isShortRole('nursing_staff')).toBe(false);
      expect(isShortRole('invalid')).toBe(false);
    });

    test('isValidRole should identify any valid role', () => {
      expect(isValidRole('nurse')).toBe(true);
      expect(isValidRole('nursing_staff')).toBe(true);
      expect(isValidRole('billing')).toBe(true);
      expect(isValidRole('billing_staff')).toBe(true);
      expect(isValidRole('invalid')).toBe(false);
    });
  });

  describe('Role Display Names', () => {
    test('should provide correct display names for all roles', () => {
      expect(getRoleDisplayName('physician')).toBe('Physician');
      expect(getRoleDisplayName('nurse')).toBe('Nursing Staff');
      expect(getRoleDisplayName('admin')).toBe('Administrative Staff');
      expect(getRoleDisplayName('system_admin')).toBe('System Administrator');
      expect(getRoleDisplayName('billing')).toBe('Billing Staff');
      expect(getRoleDisplayName('receptionist')).toBe('Receptionist');
    });

    test('should work with canonical role names', () => {
      expect(getRoleDisplayName(UserRole.NURSING_STAFF)).toBe('Nursing Staff');
      expect(getRoleDisplayName(UserRole.BILLING_STAFF)).toBe('Billing Staff');
    });
  });

  describe('Role Hierarchy', () => {
    test('should correctly identify higher roles', () => {
      expect(hasHigherRole('system_admin', 'physician')).toBe(true);
      expect(hasHigherRole('physician', 'nurse')).toBe(true);
      expect(hasHigherRole('nurse', 'admin')).toBe(true);
      expect(hasHigherRole('admin', 'billing')).toBe(true);
      expect(hasHigherRole('billing', 'receptionist')).toBe(true);
      expect(hasHigherRole('receptionist', 'patient')).toBe(true);
    });

    test('should work with canonical roles', () => {
      expect(hasHigherRole(UserRole.SYSTEM_ADMINISTRATOR, UserRole.PHYSICIAN)).toBe(true);
      expect(hasHigherRole(UserRole.PHYSICIAN, UserRole.NURSING_STAFF)).toBe(true);
    });

    test('should handle equal roles', () => {
      expect(hasHigherRole('nurse', 'nurse')).toBe(false);
      expect(hasHigherRole(UserRole.PHYSICIAN, UserRole.PHYSICIAN)).toBe(false);
    });

    test('should handle mixed role formats', () => {
      expect(hasHigherRole('nurse', UserRole.ADMINISTRATIVE_STAFF)).toBe(true);
      expect(hasHigherRole(UserRole.NURSING_STAFF, 'admin')).toBe(true);
    });
  });

  describe('Role Permissions', () => {
    test('should provide correct permissions for physicians', () => {
      const permissions = getRolePermissions('physician');
      expect(permissions).toContain(Permission.CREATE_PRESCRIPTIONS);
      expect(permissions).toContain(Permission.CREATE_CLINICAL_NOTES);
      expect(permissions).toContain(Permission.FINALIZE_CLINICAL_NOTES);
    });

    test('should provide correct permissions for nurses', () => {
      const permissions = getRolePermissions('nurse');
      expect(permissions).toContain(Permission.DOCUMENT_VITAL_SIGNS);
      expect(permissions).toContain(Permission.ADMINISTER_MEDICATIONS);
      expect(permissions).not.toContain(Permission.CREATE_PRESCRIPTIONS);
    });

    test('should provide correct permissions for billing staff', () => {
      const permissions = getRolePermissions('billing');
      expect(permissions).toContain(Permission.MANAGE_BILLING);
      expect(permissions).toContain(Permission.PROCESS_INSURANCE);
      expect(permissions).not.toContain(Permission.CREATE_PRESCRIPTIONS);
    });

    test('should provide correct permissions for receptionists', () => {
      const permissions = getRolePermissions('receptionist');
      expect(permissions).toContain(Permission.SCHEDULE_APPOINTMENTS);
      expect(permissions).toContain(Permission.VIEW_PATIENT_DEMOGRAPHICS);
      expect(permissions).not.toContain(Permission.VIEW_CLINICAL_NOTES);
    });

    test('should work with canonical role names', () => {
      const permissions = getRolePermissions(UserRole.NURSING_STAFF);
      expect(permissions).toContain(Permission.DOCUMENT_VITAL_SIGNS);
    });
  });

  describe('Permission Checking', () => {
    test('should correctly check individual permissions', () => {
      expect(hasPermission('physician', Permission.CREATE_PRESCRIPTIONS)).toBe(true);
      expect(hasPermission('nurse', Permission.CREATE_PRESCRIPTIONS)).toBe(false);
      expect(hasPermission('billing', Permission.MANAGE_BILLING)).toBe(true);
      expect(hasPermission('receptionist', Permission.SCHEDULE_APPOINTMENTS)).toBe(true);
    });

    test('should check permissions across multiple roles', () => {
      const roles: UserRoleShort[] = ['nurse', 'billing'];
      expect(hasAnyRolePermission(roles, Permission.DOCUMENT_VITAL_SIGNS)).toBe(true);
      expect(hasAnyRolePermission(roles, Permission.MANAGE_BILLING)).toBe(true);
      expect(hasAnyRolePermission(roles, Permission.CREATE_PRESCRIPTIONS)).toBe(false);
    });

    test('should combine permissions from multiple roles', () => {
      const roles: UserRoleShort[] = ['nurse', 'billing'];
      const combined = getCombinedPermissions(roles);
      
      expect(combined).toContain(Permission.DOCUMENT_VITAL_SIGNS); // From nurse
      expect(combined).toContain(Permission.MANAGE_BILLING); // From billing
      expect(combined).not.toContain(Permission.CREATE_PRESCRIPTIONS); // Not in either
    });
  });

  describe('Role Information', () => {
    test('should provide complete role information', () => {
      const info = getRoleInfo('physician');
      expect(info.role).toBe(UserRole.PHYSICIAN);
      expect(info.description).toContain('prescription authority');
    });

    test('should provide restrictions for limited roles', () => {
      const billingInfo = getRoleInfo('billing');
      expect(billingInfo.restrictions).toBeDefined();
      expect(billingInfo.restrictions![0]).toContain('clinical information');

      const receptionistInfo = getRoleInfo('receptionist');
      expect(receptionistInfo.restrictions).toBeDefined();
      expect(receptionistInfo.restrictions![0]).toContain('clinical notes');
    });
  });

  describe('Role Mappings Consistency', () => {
    test('should have bidirectional mappings for all roles', () => {
      Object.entries(ROLE_MAPPINGS.shortToLong).forEach(([short, long]) => {
        expect(ROLE_MAPPINGS.longToShort[long]).toBe(short);
      });

      Object.entries(ROLE_MAPPINGS.longToShort).forEach(([long, short]) => {
        expect(ROLE_MAPPINGS.shortToLong[short]).toBe(long);
      });
    });

    test('should have display names for all roles', () => {
      Object.values(UserRole).forEach(role => {
        expect(ROLE_DISPLAY_NAMES[role]).toBeDefined();
        expect(ROLE_DISPLAY_NAMES[role].length).toBeGreaterThan(0);
      });
    });

    test('should have hierarchy values for all roles', () => {
      Object.values(UserRole).forEach(role => {
        expect(ROLE_HIERARCHY[role]).toBeDefined();
        expect(typeof ROLE_HIERARCHY[role]).toBe('number');
      });
    });

    test('should have permissions for all roles', () => {
      Object.values(UserRole).forEach(role => {
        expect(UNIFIED_ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(UNIFIED_ROLE_PERMISSIONS[role].permissions)).toBe(true);
      });
    });
  });

  describe('Type Safety', () => {
    test('should maintain type safety in conversions', () => {
      const shortRole: UserRoleShort = 'nurse';
      const canonicalRole: UserRole = toCanonicalRole(shortRole);
      const backToShort: UserRoleShort = toShortRole(canonicalRole);
      
      expect(backToShort).toBe(shortRole);
    });

    test('should work with unified type parameters', () => {
      function testUnifiedRole(role: UserRoleUnified): string {
        return getRoleDisplayName(role);
      }

      expect(testUnifiedRole('nurse')).toBe('Nursing Staff');
      expect(testUnifiedRole(UserRole.NURSING_STAFF)).toBe('Nursing Staff');
    });
  });
});

describe('Integration Tests', () => {
  test('should handle complete user role workflow', () => {
    // Simulate backend response
    const backendUser = {
      id: '123',
      email: 'nurse@hospital.com',
      role: 'nursing_staff' as UserRoleLong
    };

    // Convert to frontend format
    const frontendRole = toShortRole(backendUser.role);
    expect(frontendRole).toBe('nurse');

    // Get permissions
    const permissions = getRolePermissions(frontendRole);
    expect(permissions).toContain(Permission.DOCUMENT_VITAL_SIGNS);

    // Check specific permission
    const canDocument = hasPermission(frontendRole, Permission.DOCUMENT_VITAL_SIGNS);
    expect(canDocument).toBe(true);

    // Get display name for UI
    const displayName = getRoleDisplayName(frontendRole);
    expect(displayName).toBe('Nursing Staff');
  });

  test('should handle new billing and receptionist roles', () => {
    // Test billing role
    const billingPermissions = getRolePermissions('billing');
    expect(billingPermissions).toContain(Permission.MANAGE_BILLING);
    expect(billingPermissions).toContain(Permission.PROCESS_INSURANCE);
    expect(billingPermissions).not.toContain(Permission.CREATE_PRESCRIPTIONS);

    // Test receptionist role
    const receptionistPermissions = getRolePermissions('receptionist');
    expect(receptionistPermissions).toContain(Permission.SCHEDULE_APPOINTMENTS);
    expect(receptionistPermissions).not.toContain(Permission.VIEW_CLINICAL_NOTES);

    // Test hierarchy
    expect(hasHigherRole('admin', 'billing')).toBe(true);
    expect(hasHigherRole('billing', 'receptionist')).toBe(true);
  });
});