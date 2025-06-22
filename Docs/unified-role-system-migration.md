# Unified UserRole Type System Migration Guide

## Overview

This document describes the unified UserRole type system that resolves the mismatch between frontend and backend role representations. The system supports both naming conventions and provides type-safe conversions between them.

## Problem Statement

The OmniCare EMR system had inconsistent role definitions between frontend and backend:

- **Frontend**: Used short names (`nurse`, `admin`, `lab_tech`)
- **Backend**: Used full names with underscores (`nursing_staff`, `administrative_staff`, `laboratory_technician`)
- **Missing Roles**: Frontend had `billing` and `receptionist` roles not present in backend

This caused 82 TypeScript errors (28% of all errors) across the codebase.

## Solution Architecture

### Unified Type System

The new system provides:

1. **Canonical Role Enum**: `UserRole` - Source of truth with full names
2. **Frontend Type**: `UserRoleShort` - Short names for UI
3. **Backend Type**: `UserRoleLong` - Full names for API
4. **Unified Type**: `UserRoleUnified` - Accepts both conventions
5. **Conversion Functions**: Type-safe transformations between formats

### Files Structure

```
src/
├── types/
│   └── unified-user-roles.ts          # Core type definitions
├── auth/
│   └── unified-role-permissions.ts    # Permissions for all roles
frontend/src/
├── types/
│   └── index.ts                       # Re-exports unified types
└── auth/
    └── role-mappings.ts               # Updated mappings
backend/src/
├── types/
│   └── auth.types.ts                  # Re-exports unified types
└── auth/
    └── role-permissions.ts            # Legacy compatibility
```

## Role Definitions

### Complete Role List

| Short Name     | Canonical Name              | Display Name           |
|---------------|-----------------------------|------------------------|
| physician     | physician                   | Physician              |
| nurse         | nursing_staff               | Nursing Staff          |
| admin         | administrative_staff        | Administrative Staff   |
| system_admin  | system_administrator        | System Administrator   |
| pharmacist    | pharmacist                  | Pharmacist             |
| lab_tech      | laboratory_technician       | Laboratory Technician  |
| radiology_tech| radiology_technician        | Radiology Technician   |
| patient       | patient                     | Patient                |
| billing       | billing_staff               | Billing Staff          |
| receptionist  | receptionist                | Receptionist           |

### Role Hierarchy

1. System Administrator (100)
2. Physician (90)
3. Pharmacist (70)
4. Nursing Staff (60)
5. Laboratory Technician (50)
6. Radiology Technician (50)
7. Administrative Staff (30)
8. Billing Staff (25)
9. Receptionist (20)
10. Patient (10)

## Usage Examples

### Type Conversions

```typescript
import { 
  toCanonicalRole, 
  toShortRole, 
  getRoleDisplayName,
  isValidRole 
} from '@/types/unified-user-roles';

// Convert to canonical form
const canonical = toCanonicalRole('nurse'); // 'nursing_staff'

// Convert to short form
const short = toShortRole('nursing_staff'); // 'nurse'

// Get display name
const displayName = getRoleDisplayName('nurse'); // 'Nursing Staff'

// Validate role
const isValid = isValidRole('admin'); // true
```

### Permission Checking

```typescript
import { 
  getRolePermissions, 
  hasPermission,
  hasAnyRolePermission 
} from '@/auth/unified-role-permissions';

// Get permissions for any role format
const permissions = getRolePermissions('nurse'); // Permission[]

// Check specific permission
const canEdit = hasPermission('physician', Permission.EDIT_CLINICAL_NOTES);

// Check multiple roles
const canAny = hasAnyRolePermission(['nurse', 'physician'], Permission.VIEW_PATIENT_RECORDS);
```

### Frontend Components

```typescript
import { UserRoleShort, getRoleDisplayName } from '@/types';

interface UserProfileProps {
  role: UserRoleShort;
}

function UserProfile({ role }: UserProfileProps) {
  return (
    <div>
      <span>Role: {getRoleDisplayName(role)}</span>
    </div>
  );
}
```

### Backend Services

```typescript
import { UserRole, UserRoleUnified, toCanonicalRole } from '@/types/auth.types';

function createUser(userData: { role: UserRoleUnified }) {
  const canonicalRole = toCanonicalRole(userData.role);
  
  return {
    ...userData,
    role: canonicalRole
  };
}
```

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { UserRole, UserRoleType } from '@/types';
```

**After:**
```typescript
import { UserRole, UserRoleShort, UserRoleUnified } from '@/types';
```

### 2. Update Type Annotations

**Before:**
```typescript
function checkRole(role: UserRoleType) { }
```

**After:**
```typescript
function checkRole(role: UserRoleShort) { }
// or for functions that accept both formats:
function checkRole(role: UserRoleUnified) { }
```

### 3. Update Role Mappings

**Before:**
```typescript
import { mapBackendToFrontendRole } from '@/auth/role-mappings';
const frontendRole = mapBackendToFrontendRole(backendRole);
```

**After:**
```typescript
import { mapToFrontendRole } from '@/auth/role-mappings';
const frontendRole = mapToFrontendRole(backendRole);
```

### 4. Update Permission Checks

**Before:**
```typescript
import { getRolePermissions } from '@/auth/role-permissions';
```

**After:**
```typescript
import { getRolePermissions } from '@/auth/unified-role-permissions';
```

## Backward Compatibility

The system maintains backward compatibility through:

1. **Legacy Exports**: Old imports continue to work
2. **Deprecated Warnings**: Clear migration path
3. **Type Aliases**: `UserRoleType` = `UserRoleShort`
4. **Function Wrappers**: Legacy functions delegate to new implementations

## New Roles Added

### Billing Staff
- **Permissions**: Billing, insurance processing, financial reports
- **Restrictions**: Limited clinical access, diagnosis codes only

### Receptionist
- **Permissions**: Appointment scheduling, patient demographics
- **Restrictions**: No clinical notes or medical history access

## Testing

All role-related functionality has been updated to support the unified system:

```typescript
describe('Unified Role System', () => {
  it('should convert between role formats', () => {
    expect(toShortRole('nursing_staff')).toBe('nurse');
    expect(toCanonicalRole('nurse')).toBe('nursing_staff');
  });

  it('should validate roles correctly', () => {
    expect(isValidRole('nurse')).toBe(true);
    expect(isValidRole('invalid')).toBe(false);
  });

  it('should provide correct permissions', () => {
    const permissions = getRolePermissions('physician');
    expect(permissions).toContain(Permission.CREATE_PRESCRIPTIONS);
  });
});
```

## Benefits

1. **Type Safety**: Eliminates role-related TypeScript errors
2. **Consistency**: Single source of truth for all roles
3. **Flexibility**: Supports both naming conventions
4. **Extensibility**: Easy to add new roles
5. **Maintainability**: Centralized role management
6. **Performance**: Efficient role lookups and conversions

## Troubleshooting

### Common Issues

1. **Import Errors**: Verify import paths and use unified types
2. **Role Validation Failures**: Use `isValidRole()` before processing
3. **Permission Denials**: Check role hierarchy and permissions mapping
4. **Type Mismatches**: Use conversion functions between formats

### Migration Checklist

- [ ] Update all UserRole/UserRoleType imports
- [ ] Replace role mapping functions
- [ ] Update permission checking logic
- [ ] Test role-based UI components
- [ ] Verify API role serialization
- [ ] Update role validation logic
- [ ] Test new billing/receptionist roles
- [ ] Validate role hierarchy behavior

## Future Enhancements

1. **Dynamic Roles**: Runtime role creation and management
2. **Role Inheritance**: Hierarchical permission inheritance
3. **Conditional Permissions**: Context-based access control
4. **Role Templates**: Predefined role configurations
5. **Audit Integration**: Role change tracking