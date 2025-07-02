# Unified Type System for OmniCare EMR

## Overview

This directory contains the unified TypeScript type definitions shared between the frontend and backend components of the OmniCare EMR system. These types ensure consistency and type safety across the entire codebase.

## Structure

```
shared/types/
├── index.ts              # Main export point for all shared types
├── user-roles.types.ts   # Unified user role definitions
├── user.types.ts         # User-related type definitions
├── auth.types.ts         # Authentication and authorization types
└── sync.types.ts         # Data synchronization types
```

## Key Improvements

### 1. Unified User Roles
- **Problem**: Frontend used short form roles (e.g., 'nurse') while backend used long form (e.g., 'nursing_staff')
- **Solution**: Created `UserRoleUnified` type that supports both formats with proper mapping functions
- **Features**:
  - Frontend defaults to `UserRoleShort` for compatibility
  - Backend defaults to `UserRoleLong` for canonical representation
  - Utility functions: `toCanonicalRole()`, `toShortRole()`, `isValidRole()`
  - Consistent role hierarchy and display names

### 2. Aligned User Interfaces
- **Problem**: Different User interfaces in frontend vs backend
- **Solution**: Created base types with specific frontend/backend extensions
- **Types**:
  - `BaseUser`: Common properties
  - `FrontendUser`: Frontend-specific user type
  - `BackendUser`: Backend-specific user type with additional auth properties
  - `UnifiedUser`: Works with both environments

### 3. Shared Authentication Types
- **Problem**: Duplicate auth types and inconsistent permission enums
- **Solution**: Consolidated all auth types in shared location
- **Features**:
  - Unified `Permission` enum
  - Shared JWT payload interfaces
  - Common security event types
  - SMART on FHIR token types

### 4. Synchronization Types
- **Problem**: Sync types duplicated between frontend and backend
- **Solution**: Created shared sync type definitions
- **Types**:
  - `DataConflict`: Conflict detection
  - `ConflictResolution`: Resolution strategies
  - `SyncOptions` & `SyncResult`: Sync configuration and results
  - `OfflineChange` & `CacheEntry`: Offline data management

## Usage

### Frontend
```typescript
// Import from local re-export file
import { User, UserRole, Permission } from '@/types';

// Or import directly from shared types
import { FrontendUser } from '../../../../shared/types';
```

### Backend
```typescript
// Import from local re-export file
import { User, UserRole, Permission } from './types/auth.types';

// Or import directly from shared types
import { BackendUser } from '../../../../shared/types';
```

## Type Compatibility

### Role Conversion
```typescript
// Convert between short and long forms
const longRole = toCanonicalRole('nurse'); // Returns 'nursing_staff'
const shortRole = toShortRole('nursing_staff'); // Returns 'nurse'

// Check role types
if (isShortRole(role)) { /* ... */ }
if (isCanonicalRole(role)) { /* ... */ }
```

### Role Hierarchy
```typescript
// Check role privileges
if (hasHigherRole(userRole, 'nurse')) {
  // User has higher privileges than nurse
}
```

## Migration Notes

1. **Frontend**: Update imports to use shared types via local re-export files
2. **Backend**: Replace direct type definitions with imports from shared types
3. **Tests**: Update test fixtures to use unified types
4. **API**: Ensure role conversion when communicating between frontend/backend

## Best Practices

1. Always use utility functions for role conversion
2. Import types from local re-export files for better path management
3. Use `UserRoleUnified` when accepting any role format
4. Prefer specific types (`FrontendUser`, `BackendUser`) over generic `UnifiedUser`
5. Keep shared types minimal and focused on cross-component communication

## Future Enhancements

1. Add type guards for all shared interfaces
2. Create branded types for IDs (PatientId, UserId, etc.)
3. Add validation schemas alongside type definitions
4. Consider generating types from OpenAPI specs
5. Add runtime validation utilities