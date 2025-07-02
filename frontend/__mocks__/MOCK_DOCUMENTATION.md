# OmniCare Frontend Mock Files Documentation

This document provides comprehensive documentation for all mock files used in the OmniCare frontend testing environment.

## Overview

The frontend testing environment uses Jest mocks to simulate external dependencies and components. All mock files are located in the `frontend/__mocks__/` directory and follow a specific structure to ensure consistent testing behavior.

## Mock Files Structure

### Core Component Mocks

#### `@mantine/core.tsx`
- **Purpose**: Mocks all Mantine UI components used throughout the application
- **Components**: Group, Text, Badge, Avatar, Paper, Stack, Button, Menu, Alert, etc.
- **Features**: 
  - Maintains component hierarchy and props
  - Preserves data attributes for testing
  - Handles styling props properly
- **Usage**: Automatically imported by Jest for all `@mantine/core` imports

#### `@mantine/form.tsx`
- **Purpose**: Mocks Mantine form components and hooks
- **Components**: useForm hook, form validation utilities
- **Features**: Returns mock form state and handlers

#### `@mantine/notifications.tsx`
- **Purpose**: Mocks notification system
- **Functions**: notifications.show, notifications.clean, etc.

### Medical Component Mocks

#### `@medplum/react.tsx`
- **Purpose**: Mocks Medplum React components for FHIR resource handling
- **Components**: ResourceBadge, ResourceAvatar, Document, DocumentEditor, NoteDisplay
- **Features**: 
  - Handles FHIR resource rendering
  - Maintains prop structure for testing
  - Simulates medical data display

#### `@medplum/core.tsx`
- **Purpose**: Mocks core Medplum utilities
- **Functions**: FHIR validation, resource utilities
- **Features**: Returns mock implementations of FHIR operations

### Icon Mocks

#### `@tabler/icons-react.tsx`
- **Purpose**: Mocks all Tabler icons used in the application
- **Implementation**: Returns span elements with data-icon attributes
- **Benefits**: Prevents icon rendering issues in test environment

### State Management Mocks

#### `zustand.ts`
- **Purpose**: Mocks Zustand store creation
- **Features**: Returns mock store with get/set functions
- **Usage**: Used by all Zustand-based stores in tests

#### `@tanstack/react-query.tsx`
- **Purpose**: Mocks React Query hooks and utilities
- **Hooks**: useQuery, useMutation, useQueryClient
- **Features**: Returns predictable mock data for testing

### Next.js Mocks

#### `next/image.tsx`
- **Purpose**: Mocks Next.js Image component
- **Features**: Renders as img element with proper attributes

#### `next/link.tsx`
- **Purpose**: Mocks Next.js Link component
- **Features**: Renders as anchor element with href attribute

### Utility Mocks

#### `window.js`
- **Purpose**: Mocks browser window object and APIs
- **Features**: matchMedia, localStorage, sessionStorage mocks

## Mock Integration Patterns

### Component Testing
```typescript
// Components automatically use mocks when imported
import { Group, Text } from '@mantine/core';
import { ResourceBadge } from '@medplum/react';

// Mocks are applied automatically by Jest
render(<Group><Text>Test</Text><ResourceBadge value={resource} /></Group>);
```

### Service Testing
```typescript
// Mock service dependencies
jest.mock('@/services/patient-cache.service', () => ({
  patientCacheService: {
    getPatientAllergies: jest.fn(),
    getPatientConditions: jest.fn(),
  }
}));
```

### Store Testing
```typescript
// Zustand stores are automatically mocked
import { usePatientStore } from '@/stores/patient';

// Mock store returns predictable state
const mockState = usePatientStore.getState();
```

## Testing Best Practices

### 1. Mock Data Structure
- Use realistic FHIR resource structures
- Include required fields for proper testing
- Maintain consistent mock data across tests

### 2. Component Mocking
- Preserve component hierarchy
- Maintain testable attributes
- Handle props appropriately

### 3. Service Mocking
- Mock at the service boundary
- Return realistic response structures
- Handle error cases

## Common Issues and Solutions

### Issue: Component Not Rendering
**Cause**: Missing or incorrect mock implementation
**Solution**: Verify mock component returns valid JSX with proper props

### Issue: Props Not Passing Through
**Cause**: Mock component not handling props correctly
**Solution**: Ensure mock spreads props: `{...props}`

### Issue: Test Data Not Loading
**Cause**: Service mock not returning expected data structure
**Solution**: Verify mock returns data matching component expectations

## Mock File Maintenance

### Adding New Mocks
1. Create mock file in appropriate subdirectory
2. Follow existing naming conventions
3. Include comprehensive prop handling
4. Add documentation for complex mocks

### Updating Existing Mocks
1. Maintain backward compatibility
2. Update all dependent tests
3. Document changes in this file
4. Test integration with existing components

### Removing Deprecated Mocks
1. Check for usage across all test files
2. Update documentation
3. Remove references from jest.config.js if needed

## Integration Status

### ✅ Working Mocks
- @mantine/core - All components properly mocked
- @medplum/react - Core components working
- @tabler/icons-react - All icons mocked
- zustand - Store mocking functional
- next/image and next/link - Working correctly

### ⚠️ Partial Issues
- @mantine/core - Some prop validation warnings
- @medplum/core - Limited function coverage
- @tanstack/react-query - Basic implementation only

### ❌ Known Issues
- Backend TypeScript factory files missing
- Some test timeouts in complex components
- IndexedDB mocking incomplete in some tests

## Testing Environment Setup

The testing environment includes:
- Automated test database initialization
- Mock service configuration
- Test data seeding
- Cleanup procedures

All mocks work together to provide a consistent, isolated testing environment that closely mirrors production behavior while remaining fast and reliable.