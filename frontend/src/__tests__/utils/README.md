# API and External Service Mocks

This directory contains comprehensive mocking utilities for testing the OmniCare application. The mocks provide consistent response formats and simulate real-world scenarios including network failures, authentication errors, and FHIR compliance.

## Overview

The mocking system consists of several layers:

1. **API Mocks** (`api-mocks.ts`) - Direct fetch mocking with consistent response formats
2. **MSW Handlers** (`msw-handlers.ts`) - Network-level mocking using Mock Service Worker
3. **External Service Mocks** (`external-service-mocks.ts`) - Comprehensive Medplum and third-party service mocks
4. **Test Setup** (`test-setup.ts`) - Test environment configuration and utilities
5. **Mock Registry** (`mock-registry.ts`) - Centralized mock management and scenarios
6. **Network Mocks** (`network-mock.utils.ts`) - Network state simulation utilities

## Quick Start

### Basic Test Setup

```typescript
import { setupGlobalTests } from './test-setup';

// In your test file
setupGlobalTests();

describe('My Component', () => {
  test('should work', () => {
    // Your test code here
    // All mocks are automatically configured
  });
});
```

### Using Mock Registry

```typescript
import { mockRegistry, setupMockEnvironment } from './mock-registry';

describe('API Integration Tests', () => {
  beforeEach(() => {
    // Setup default mock environment
    setupMockEnvironment('default');
  });

  test('should handle offline scenario', () => {
    // Switch to offline scenario
    mockRegistry.applyScenario('offline');
    
    // Your test code here
  });
});
```

## Available Scenarios

### Network Scenarios

- `offline` - Simulates network unavailability
- `slow-network` - Simulates slow network connections (3s delay)
- `auth-required` - All requests return 401 Unauthorized
- `server-error` - All requests return 500 Internal Server Error
- `fhir-validation-error` - FHIR operations fail validation
- `sync-conflict` - Sync operations return conflicts

### Mock Configurations

- `default` - Normal operation with all services available
- `offline` - Offline mode with cached data
- `unauthenticated` - No authentication, limited access
- `error` - Various error conditions
- `slow` - Slow network and service responses

## API Endpoints Mocked

### Authentication
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout
- `GET /auth/me` - Current user info
- `POST /auth/setup-mfa` - MFA setup
- `POST /auth/verify-mfa` - MFA verification

### Health & Monitoring
- `GET /health` - Application health
- `GET /api/health` - API health check
- `GET /api/bandwidth-test` - Network bandwidth testing
- `GET /api/network-quality` - Network quality metrics
- `GET /api/connection-test` - Connection testing
- `POST /api/simulate-condition` - Network condition simulation

### Sync Operations
- `POST /api/sync` - Data synchronization
- `POST /api/sync/batch` - Batch synchronization
- `GET /api/sync/status/:clientId` - Sync status
- `POST /api/sync/validate-token` - Token validation
- `POST /api/sync/resolve-conflict` - Conflict resolution
- `GET /api/sync/conflicts` - Pending conflicts
- `GET /api/sync/config` - Sync configuration

### FHIR Resources
- `GET /fhir/R4/metadata` - Capability statement
- `POST /fhir/R4/:resourceType` - Create resource
- `GET /fhir/R4/:resourceType` - Search resources
- `GET /fhir/R4/:resourceType/:id` - Read resource
- `PUT /fhir/R4/:resourceType/:id` - Update resource
- `DELETE /fhir/R4/:resourceType/:id` - Delete resource
- `POST /fhir/R4/:resourceType/$validate` - Validate resource
- `GET /fhir/R4/Patient/:id/$everything` - Patient everything
- `POST /fhir/R4` - Batch/transaction operations
- `POST /fhir/R4/$graphql` - GraphQL queries

### Clinical Operations
- `POST /api/vitals/:patientId` - Record vital signs
- `POST /api/prescriptions` - Create prescriptions
- `POST /api/care-plans` - Create care plans

### CDS Hooks
- `GET /cds-services` - Available CDS services
- `POST /cds-services/:serviceId` - Execute CDS hook

### Admin
- `GET /admin/stats` - System statistics

## External Service Mocks

### Medplum Client

The `MockMedplumClient` provides a complete implementation of the Medplum SDK:

```typescript
import { createMockMedplumClient } from './external-service-mocks';

const mockClient = createMockMedplumClient({
  baseUrl: 'https://api.medplum.test',
  accessToken: 'mock-token'
});

// Use like a real Medplum client
const patient = await mockClient.createResource({
  resourceType: 'Patient',
  name: [{ family: 'Doe', given: ['John'] }]
});
```

### Third-Party Services

Mock implementations for:
- **Lab Service** - Lab order submission and results
- **Pharmacy Service** - Prescription management
- **Insurance Service** - Eligibility verification and claims
- **Imaging Service** - Imaging orders and results

```typescript
import { mockThirdPartyServices } from './external-service-mocks';

// Submit lab order
const labResult = await mockThirdPartyServices.labService.submitLabOrder({
  patientId: 'patient-123',
  tests: ['CBC', 'BMP']
});

// Verify insurance
const eligibility = await mockThirdPartyServices.insuranceService.verifyEligibility(
  'patient-123',
  { insuranceId: 'INS123' }
);
```

## Test Utilities

### Network State Mocking

```typescript
import { NetworkStateMocker } from './network-mock.utils';

const networkMocker = new NetworkStateMocker();

// Set offline
networkMocker.setOffline();

// Set online
networkMocker.setOnline();

// Toggle state
networkMocker.toggle();

// Restore original state
networkMocker.restore();
```

### Data Generators

```typescript
import { generateTestData } from './mock-registry';

// Generate test patient
const patient = generateTestData.patient({
  name: [{ family: 'Smith', given: ['Jane'] }]
});

// Generate test observation
const observation = generateTestData.observation('patient-123', {
  valueQuantity: { value: 120, unit: 'mmHg' }
});
```

### Error Scenarios

```typescript
import { mockErrorScenarios } from './test-setup';

describe('Error Handling', () => {
  test('should handle network errors', () => {
    mockErrorScenarios.networkError();
    // Test network error handling
  });

  test('should handle auth errors', () => {
    mockErrorScenarios.authError();
    // Test authentication error handling
  });

  test('should handle server errors', () => {
    mockErrorScenarios.serverError();
    // Test server error handling
  });
});
```

## Advanced Usage

### Custom Mock Responses

```typescript
import { mockRegistry } from './mock-registry';

// Create custom FHIR response
const customResponse = mockRegistry.createFhirResponse('Patient', {
  resourceType: 'Patient',
  id: 'custom-patient',
  name: [{ family: 'Custom', given: ['Patient'] }]
}, { bundle: true });

// Create custom error response
const errorResponse = mockRegistry.createOperationOutcome(
  'error',
  'Custom validation error'
);
```

### MSW Handler Overrides

```typescript
import { server } from './msw-handlers';
import { rest } from 'msw';

// Override specific endpoint for a test
test('should handle custom scenario', () => {
  server.use(
    rest.get('/api/custom-endpoint', (req, res, ctx) => {
      return res(ctx.json({ custom: 'response' }));
    })
  );

  // Your test code here
});
```

### Scenario Combinations

```typescript
import { mockRegistry } from './mock-registry';

// Apply multiple scenarios
mockRegistry.applyScenario('slow-network');
mockRegistry.applyScenario('auth-required');

// Your test code here
```

## Environment Configuration

The mocks automatically configure the test environment with:

- Mocked `window` properties (location, navigator, etc.)
- Mocked storage APIs (localStorage, sessionStorage)
- Mocked browser APIs (ResizeObserver, IntersectionObserver, etc.)
- Environment variables for testing
- Console method mocking

## Best Practices

1. **Use scenarios** for consistent test setups
2. **Reset between tests** to ensure isolation
3. **Use realistic data** in mock responses
4. **Test error conditions** as well as success cases
5. **Leverage the registry** for centralized mock management

## Integration with Jest

Add to your `setupTests.ts`:

```typescript
import { setupJestMocks } from './src/__tests__/utils/mock-registry';

setupJestMocks();
```

This automatically configures all mocks for your Jest test environment.

## Mock Response Formats

All mocks follow consistent response formats:

### FHIR Responses
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-123",
        "meta": {
          "versionId": "1",
          "lastUpdated": "2023-01-01T00:00:00.000Z"
        }
      }
    }
  ]
}
```

### API Responses
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### Error Responses
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "diagnostics": "Error message"
    }
  ]
}
```

This comprehensive mocking system ensures reliable, consistent testing across the entire OmniCare application.