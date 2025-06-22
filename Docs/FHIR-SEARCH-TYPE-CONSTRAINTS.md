# FHIR Search Type Constraints Resolution

## Overview
This document describes the TypeScript generic type constraints solution implemented for FHIR `searchResources` calls to ensure type safety and proper inference.

## Problem Statement
The original `searchResources<T>` method calls lacked proper generic constraints, causing:
- Type safety issues with resource type mismatches
- Poor IntelliSense support 
- Runtime type errors
- Inconsistent API usage across clinical services

## Solution Architecture

### 1. Type-Safe Search Types (`src/types/fhir-search.types.ts`)

```typescript
// Resource type mapping for proper constraints
export type ResourceTypeMap = {
  'Patient': Patient;
  'Practitioner': Practitioner;
  'ServiceRequest': ServiceRequest;
  'Task': Task;
  // ... complete mapping
};

// Generic constraint ensuring T matches the resource type
export type SearchableResource<T extends keyof ResourceTypeMap> = ResourceTypeMap[T];

// Type-safe search parameters
export interface FHIRSearchParams {
  [key: string]: string | number | boolean | undefined;
  _count?: number;
  _sort?: string;
  // ... standard FHIR search parameters
}
```

### 2. Type-Safe Search Utilities (`src/utils/fhir-search.utils.ts`)

```typescript
export class TypeSafeFHIRSearch {
  // Main search method with proper constraints
  async searchResources<T extends keyof ResourceTypeMap>(
    resourceType: T,
    searchParams: FHIRSearchParams = {}
  ): Promise<SearchBundle<ResourceTypeMap[T]>> {
    // Implementation handles various return formats from Medplum
  }

  // Specialized methods for common resources
  async searchPatients(params: PatientSearchParams): Promise<SearchResult<Patient>>
  async searchEncounters(params: EncounterSearchParams): Promise<SearchResult<Encounter>>
  async searchTasks(params: TaskSearchParams): Promise<SearchResult<Task>>
  // ... more specialized methods
}
```

### 3. Backend Service Improvements

```typescript
// Updated MedplumService with proper constraints
async searchResources<T extends Resource & { resourceType: ResourceType }>(
  resourceType: T['resourceType'], 
  searchParams: FHIRSearchParams = {}
): Promise<Bundle<T>> {
  // Type-safe implementation
}
```

### 4. Clinical Service Integration

```typescript
export class ReferralManagementService {
  private typeSafeSearch: TypeSafeFHIRSearch;
  
  constructor(private medplum: MedplumClient) {
    this.typeSafeSearch = new TypeSafeFHIRSearch(medplum);
  }

  // Type-safe search usage
  async updateReferralStatus(referralId: string, status: string) {
    const taskResults = await this.typeSafeSearch.searchTasks({
      focus: `ServiceRequest/${referralId}`
    });
    const tasks = taskResults.resources; // Properly typed as Task[]
  }
}
```

## Implementation Patterns

### Generic Constraint Pattern
```typescript
// Before: Weak typing
async searchResources<T extends Resource>(resourceType: string, params: any): Promise<Bundle<T>>

// After: Strong typing with constraints
async searchResources<T extends keyof ResourceTypeMap>(
  resourceType: T, 
  params: FHIRSearchParams
): Promise<Bundle<ResourceTypeMap[T]>>
```

### Type-Safe Resource Extraction
```typescript
// Extract resources with proper typing
function extractResourcesFromBundle<T extends Resource>(bundle: Bundle<T>): T[] {
  return bundle.entry?.map(entry => entry.resource).filter((resource): resource is T => 
    resource !== undefined
  ) || [];
}
```

### Specialized Search Parameters
```typescript
// Resource-specific search parameters
export type PatientSearchParams = FHIRSearchParams & {
  name?: string;
  family?: string;
  identifier?: string;
  birthdate?: string;
};
```

## Benefits Achieved

1. **Compile-Time Type Safety**: Generic constraints prevent resource type mismatches
2. **Enhanced IntelliSense**: Proper autocomplete for resource properties
3. **Runtime Error Prevention**: Type guards prevent undefined resource access
4. **Consistent API**: Unified search interface across all clinical services
5. **Better Maintainability**: Easier refactoring with proper type checking

## Usage Guidelines

### For New Clinical Services
1. Inject `TypeSafeFHIRSearch` in constructor
2. Use specialized search methods when available
3. Fall back to generic `searchResources` with proper constraints
4. Always use `transformSearchResult` for consistent results

### For Legacy Code Migration
1. Replace direct `medplum.search` calls with `typeSafeSearch` methods
2. Update generic constraints on existing methods
3. Use `legacySearchResources` for gradual migration
4. Add proper type assertions where needed

## Testing and Validation

### Type Checking
- All `searchResources` calls now compile without type errors
- Proper type inference in IDE environments
- Resource properties are correctly typed in results

### Runtime Validation
- Search results maintain proper typing throughout the application
- Bundle extraction works correctly with all resource types
- Error handling preserves type safety

## Future Enhancements

1. Add more specialized search methods for common use cases
2. Implement advanced search operations (sorting, filtering)
3. Add caching layer with type preservation
4. Create search result pagination utilities
5. Develop FHIR query builder with type constraints

## Files Modified

### Created
- `src/types/fhir-search.types.ts` - Type definitions and constraints
- `src/utils/fhir-search.utils.ts` - Type-safe search utilities

### Updated
- `backend/src/services/medplum.service.ts` - Generic constraints
- `src/clinical/referrals/ReferralManagementService.ts` - Type-safe integration
- `src/clinical/telemedicine/TelemedicineWorkflowService.ts` - Type-safe integration

## Memory Storage
All patterns and implementations have been saved to memory under key:
`swarm-development-centralized-1750513345894/fhir-references/generics`