# Medplum React Architecture Analysis & OmniCare Comparison

## Executive Summary

This report analyzes Medplum's React component architecture and compares it with OmniCare's current implementation. The analysis reveals several architectural patterns and components that OmniCare should consider adopting to improve functionality, maintainability, and FHIR compliance.

## 1. Component Organization and Patterns

### Medplum's Approach

**Structure:**
- Components organized by FHIR resource type and functionality
- Consistent Display/Input pattern for most components
- Modular directory structure with each component having:
  - Main component (.tsx)
  - Tests (.test.tsx)
  - Stories (.stories.tsx)
  - Styles (.module.css)
  - Utilities (.utils.ts)

**Key Patterns:**
- Clear separation of concerns between display and input components
- Resource-specific components (Patient, Appointment, etc.)
- Utility components (Address, Attachment, CodeableConcept)
- Builder components for complex resources (QuestionnaireBuilder, PlanDefinitionBuilder)

### OmniCare's Current Implementation

**Structure:**
- Components organized by feature/domain (admin/, clinical/, patient/)
- Mix of smart and presentation components
- Backup files present in repository (.backup extensions)
- Strong offline-first architecture

**Gaps Identified:**
- Less consistent component structure
- Missing standardized Display/Input pattern
- No Storybook integration for component documentation
- Lacking resource-specific component abstractions

### Recommendations for OmniCare

1. **Adopt Display/Input Pattern**
   ```typescript
   // Example structure
   components/
   ├── resources/
   │   ├── Patient/
   │   │   ├── PatientDisplay.tsx
   │   │   ├── PatientInput.tsx
   │   │   ├── PatientDisplay.test.tsx
   │   │   ├── PatientInput.test.tsx
   │   │   └── Patient.stories.tsx
   ```

2. **Implement Storybook** for component documentation and visual testing

3. **Create Resource-Specific Components** for common FHIR resources

## 2. FHIR Resource Handling

### Medplum's Approach

**Strengths:**
- Native FHIR resource type support
- Dynamic resource schema loading
- Permission-aware resource rendering
- Flexible ResourceForm component
- ResourceTable with configurable columns
- Built-in FHIR validation

**Key Components:**
- `ResourceForm`: Dynamic form generation based on FHIR schemas
- `ResourceTable`: Flexible table display for any FHIR resource
- `ResourceTimeline`: Chronological display of resource changes
- `BackboneElementDisplay`: Handles nested FHIR structures

### OmniCare's Current Implementation

**Strengths:**
- Uses @medplum/fhirtypes for type safety
- Custom helpers for common operations
- Offline-capable FHIR operations

**Gaps:**
- No dynamic form generation from FHIR schemas
- Limited resource display components
- Manual resource validation
- No built-in timeline views

### Recommendations for OmniCare

1. **Implement Dynamic Resource Components**
   ```typescript
   // ResourceForm that auto-generates forms from FHIR definitions
   <ResourceForm
     resourceType="Patient"
     value={patient}
     onChange={handleChange}
     profileUrl={customProfile}
   />
   ```

2. **Add Resource Timeline Component**
   ```typescript
   <ResourceTimeline
     resource={patient}
     showVersions={true}
     onVersionClick={handleVersionClick}
   />
   ```

3. **Create Schema-Driven Validation**
   - Use FHIR StructureDefinitions for automatic validation
   - Implement custom validation rules through profiles

## 3. Form Components and Validation

### Medplum's Approach

**Form Components:**
- Schema-driven form generation
- Custom input components for FHIR types
- Built-in validation based on FHIR constraints
- Support for custom profiles and extensions

**Validation Features:**
- Real-time validation feedback
- Cardinality checking
- Value set validation
- Custom business rule support

### OmniCare's Current Implementation

**Current State:**
- Manual form creation (ClinicalNoteInput)
- Custom validation logic
- Good offline support with draft recovery
- SmartText component for intelligent input

**Gaps:**
- No automatic form generation
- Manual validation implementation
- Limited reusable form components
- No value set integration

### Recommendations for OmniCare

1. **Create Reusable FHIR Input Components**
   ```typescript
   // Components for common FHIR types
   <CodeableConceptInput
     binding={valueSet}
     onChange={handleChange}
     required={true}
   />
   
   <QuantityInput
     unit="mg"
     min={0}
     max={1000}
     onChange={handleChange}
   />
   ```

2. **Implement Value Set Integration**
   - Connect to terminology services
   - Cache value sets for offline use
   - Provide autocomplete functionality

3. **Add Form Generation Capability**
   ```typescript
   <FHIRForm
     questionnaire={questionnaire}
     onSubmit={handleSubmit}
     enableOffline={true}
   />
   ```

## 4. Data Display Patterns

### Medplum's Approach

**Display Components:**
- ResourceTable with dynamic columns
- SearchControl with advanced filtering
- Flexible display components for each data type
- Export functionality built-in

**Key Features:**
- Sortable and filterable tables
- Configurable column visibility
- Batch operations support
- CSV/JSON export options

### OmniCare's Current Implementation

**Current Components:**
- PatientList with basic table display
- PatientSummary with card-based layout
- Custom display components
- Good responsive design

**Gaps:**
- Limited table configuration options
- No built-in export functionality
- Missing advanced search controls
- No batch operations

### Recommendations for OmniCare

1. **Enhance Table Components**
   ```typescript
   <ResourceTable
     resources={patients}
     columns={['name', 'birthDate', 'gender']}
     onRowClick={handleRowClick}
     enableSort={true}
     enableFilter={true}
     enableExport={true}
     enableBatchOperations={true}
   />
   ```

2. **Add Search Control Component**
   ```typescript
   <SearchControl
     resourceType="Patient"
     fields={searchFields}
     onSearch={handleSearch}
     savedSearches={savedSearches}
   />
   ```

3. **Implement Data Export**
   - CSV export for reports
   - FHIR Bundle export
   - Print-friendly views

## 5. Authentication and Security Patterns

### Medplum's Approach

**Components:**
- Comprehensive auth forms (SignIn, Register, MFA)
- Profile and scope selection
- Project management integration
- OAuth2/SMART on FHIR support

**Security Features:**
- Permission-aware component rendering
- Resource-level access control
- Audit trail integration

### OmniCare's Current Implementation

**Current State:**
- Basic LoginForm component
- ProtectedRoute for route guarding
- JWT-based authentication
- Role-based access control

**Gaps:**
- No MFA support
- Limited scope management
- No profile selection
- Missing SMART on FHIR integration

### Recommendations for OmniCare

1. **Add MFA Support**
   ```typescript
   <MFASetup
     user={currentUser}
     methods={['totp', 'sms', 'email']}
     onComplete={handleMFASetup}
   />
   ```

2. **Implement Scope Management**
   ```typescript
   <ScopeSelector
     availableScopes={scopes}
     selectedScopes={userScopes}
     onChange={handleScopeChange}
   />
   ```

3. **Add SMART on FHIR Support**
   - Implement launch context
   - Support EHR integration
   - Handle patient context switching

## 6. Hooks and Custom Utilities

### Medplum's Approach

**Custom Hooks:**
- `useMedplum`: Core SDK access
- `useResource`: Resource fetching with caching
- `useSearch`: Search functionality
- `useSubscription`: Real-time updates
- `useDebouncedValue`: Input optimization
- `useCachedBinaryUrl`: Binary data handling

### OmniCare's Current Implementation

**Current Hooks:**
- `useAuth`: Authentication state
- `useNetworkStatus`: Online/offline detection
- `useOfflineSync`: Sync management
- `usePatientCache`: Local caching

**Gaps:**
- No resource-specific hooks
- Limited debouncing utilities
- No subscription support
- Missing binary data handling

### Recommendations for OmniCare

1. **Create Resource Hooks**
   ```typescript
   // useResource hook for consistent data fetching
   const { resource, loading, error, refresh } = useResource('Patient', patientId);
   
   // useResourceList for collections
   const { resources, loading, loadMore } = useResourceList('Appointment', {
     patient: patientId,
     date: today
   });
   ```

2. **Add Real-time Subscription Support**
   ```typescript
   useSubscription('Patient', patientId, (update) => {
     console.log('Patient updated:', update);
   });
   ```

3. **Implement Performance Hooks**
   ```typescript
   const debouncedSearch = useDebouncedValue(searchTerm, 300);
   const throttledScroll = useThrottledCallback(handleScroll, 100);
   ```

## 7. Testing Strategies

### Medplum's Approach

**Testing Setup:**
- Jest with jsdom environment
- 120-second timeout for complex tests
- Coverage reporting
- Storybook for visual testing
- Test files co-located with components

**Testing Patterns:**
- Unit tests for each component
- Integration tests for workflows
- Mock FHIR server responses
- Accessibility testing

### OmniCare's Current Implementation

**Current Testing:**
- Jest setup with React Testing Library
- Separate test directories
- Some integration tests
- Mock service implementations

**Gaps:**
- No visual regression testing
- Limited component documentation
- Missing accessibility tests
- No performance testing

### Recommendations for OmniCare

1. **Implement Storybook**
   ```typescript
   // Component.stories.tsx
   export default {
     title: 'Clinical/ClinicalNoteInput',
     component: ClinicalNoteInput,
     argTypes: {
       patient: { control: 'object' },
       noteType: { 
         control: 'select',
         options: ['progress', 'admission', 'discharge']
       }
     }
   };
   ```

2. **Add Visual Testing**
   - Chromatic or Percy integration
   - Snapshot testing for critical components
   - Responsive design testing

3. **Enhance Test Coverage**
   - Accessibility tests with jest-axe
   - Performance tests with React Testing Library
   - E2E tests for critical workflows

## 8. Specific Component Recommendations

### High Priority Adoptions

1. **ResourceForm Component**
   - Dynamic form generation from FHIR schemas
   - Built-in validation
   - Custom profile support
   - Offline capability

2. **SearchControl Component**
   - Advanced filtering and sorting
   - Saved searches
   - Export functionality
   - Batch operations

3. **ResourceTimeline Component**
   - Chronological view of changes
   - Version comparison
   - Audit trail integration

4. **MFA Components**
   - Multi-factor authentication
   - Recovery codes
   - Device management

### Medium Priority Adoptions

1. **Value Set Components**
   - CodeableConceptInput
   - ValueSetSelector
   - TerminologyBrowser

2. **Builder Components**
   - QuestionnaireBuilder
   - CarePlayBuilder
   - FormBuilder

3. **Display Components**
   - AddressDisplay/Input
   - ContactPointDisplay/Input
   - IdentifierDisplay/Input

### Implementation Roadmap

**Phase 1 (Months 1-2):**
- Set up Storybook
- Implement ResourceForm
- Create basic FHIR input components
- Add MFA support

**Phase 2 (Months 3-4):**
- Add SearchControl
- Implement ResourceTimeline
- Create value set components
- Enhance testing setup

**Phase 3 (Months 5-6):**
- Add builder components
- Implement subscriptions
- Complete SMART on FHIR integration
- Performance optimizations

## 9. Migration Strategy

### Incremental Adoption

1. **Start with New Features**
   - Use Medplum patterns for new components
   - Gradually refactor existing components
   - Maintain backward compatibility

2. **Component Library Approach**
   ```typescript
   // Create a shared component library
   @omnicare/fhir-components
   ├── ResourceForm
   ├── ResourceTable
   ├── SearchControl
   └── ValueSetInput
   ```

3. **Testing Migration**
   - Add Storybook stories for new components
   - Gradually add stories for existing components
   - Implement visual regression testing

### Code Examples

**Before (Current OmniCare):**
```typescript
// Manual form creation
<form onSubmit={handleSubmit}>
  <TextInput
    label="Family Name"
    value={patient.name?.[0]?.family || ''}
    onChange={(e) => updatePatient('name.0.family', e.target.value)}
  />
  <TextInput
    label="Given Name"
    value={patient.name?.[0]?.given?.[0] || ''}
    onChange={(e) => updatePatient('name.0.given.0', e.target.value)}
  />
</form>
```

**After (With Medplum Patterns):**
```typescript
// Dynamic form generation
<ResourceForm
  resourceType="Patient"
  value={patient}
  onChange={setPatient}
  fields={['name', 'birthDate', 'gender']}
  onSubmit={handleSubmit}
/>
```

## 10. Conclusion

Medplum's React architecture provides several advanced patterns that would significantly benefit OmniCare:

1. **Schema-driven components** reduce code duplication and ensure FHIR compliance
2. **Consistent patterns** improve maintainability and developer experience
3. **Built-in FHIR features** accelerate development of healthcare functionality
4. **Advanced search and display** components enhance user experience
5. **Comprehensive testing** strategies ensure reliability

By adopting these patterns incrementally, OmniCare can improve its EMR functionality while maintaining its strong offline-first architecture. The recommended approach balances immediate improvements with long-term architectural benefits.

## Appendix: Resource References

- [Medplum React Components](https://github.com/medplum/medplum/tree/main/packages/react)
- [FHIR Resource Definitions](https://www.hl7.org/fhir/resourcelist.html)
- [SMART on FHIR](https://docs.smarthealthit.org/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)