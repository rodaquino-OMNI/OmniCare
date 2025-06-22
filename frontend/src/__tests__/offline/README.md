# Offline Testing Suite

This directory contains comprehensive tests for offline functionality in the OmniCare healthcare application. The test suite covers various aspects of offline capabilities including service workers, data synchronization, conflict resolution, performance, and security.

## Test Structure

### Test Files

1. **service-worker-test-utils.ts**
   - Utilities for mocking and testing Service Worker functionality
   - Provides mock implementations for Service Worker APIs
   - Includes helpers for simulating updates, messages, and lifecycle events

2. **network-simulation-utils.ts**
   - Tools for simulating various network conditions
   - Mock fetch implementation with configurable latency, errors, and offline states
   - Helpers for testing connection transitions and request queueing

3. **sync-conflict-test-utils.ts**
   - Utilities for testing data synchronization and conflict resolution
   - Mock conflict scenarios for different resource types (patients, encounters, vitals)
   - Merge strategy testing and conflict resolution simulation

4. **offline-component.test.tsx**
   - Unit tests for individual offline-aware components
   - Tests for offline indicators, sync status, and data persistence
   - Component behavior under different network conditions

5. **offline-performance.test.ts**
   - Performance benchmarks for offline operations
   - Tests for cache efficiency, IndexedDB operations, and queue processing
   - Memory usage and optimization tests

6. **offline-security.test.ts**
   - Security tests for offline data storage
   - Encryption/decryption testing
   - Access control and data sanitization tests

7. **service-worker.test.ts**
   - Comprehensive Service Worker functionality tests
   - Cache strategies, background sync, and update flow testing
   - Error handling and recovery scenarios

8. **offline-integration.test.tsx**
   - End-to-end integration tests
   - Complete offline workflow testing
   - Multi-session and error recovery scenarios

## Running Tests

### Run all offline tests:
```bash
npm test -- src/__tests__/offline/
```

### Run specific test suite:
```bash
# Service Worker tests
npm test -- src/__tests__/offline/service-worker.test.ts

# Performance tests
npm test -- src/__tests__/offline/offline-performance.test.ts

# Security tests
npm test -- src/__tests__/offline/offline-security.test.ts
```

### Run with coverage:
```bash
npm test -- --coverage src/__tests__/offline/
```

## Test Scenarios Covered

### 1. Network Conditions
- Online to offline transitions
- Offline to online transitions
- Flaky connections
- Slow network conditions
- Request failures and retries

### 2. Data Synchronization
- Queue management for offline actions
- Automatic sync when coming online
- Conflict detection and resolution
- Batch synchronization
- Partial sync handling

### 3. Service Worker
- Installation and activation
- Cache strategies (cache-first, network-first, stale-while-revalidate)
- Background sync
- Update notifications
- Message passing

### 4. Security
- Data encryption for offline storage
- Access control enforcement
- Data sanitization
- Secure deletion
- Audit logging

### 5. Performance
- Cache efficiency
- Large dataset handling
- Memory management
- Queue processing speed
- UI responsiveness during sync

### 6. Error Handling
- Network failures
- Corrupted cache recovery
- Sync failures with retry
- Quota exceeded errors
- Authentication errors

## Writing New Tests

### Example: Adding a new offline component test

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { NetworkSimulator } from './network-simulation-utils';

describe('MyOfflineComponent', () => {
  beforeEach(() => {
    NetworkSimulator.mockFetch();
  });

  afterEach(() => {
    NetworkSimulator.restore();
  });

  it('should handle offline state', async () => {
    NetworkSimulator.goOffline();
    
    render(<MyOfflineComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('Offline mode')).toBeInTheDocument();
    });
  });
});
```

### Example: Testing sync conflicts

```typescript
import { SyncConflictSimulator } from './sync-conflict-test-utils';

describe('Conflict Resolution', () => {
  it('should resolve patient data conflicts', async () => {
    const simulator = new SyncConflictSimulator();
    const conflict = simulator.createPatientConflict('patient-123');
    
    const resolved = await simulator.resolveConflict(conflict.id, 'merge');
    
    expect(resolved).toHaveProperty('firstName');
    expect(resolved).toHaveProperty('lastName');
  });
});
```

## Best Practices

1. **Always clean up** - Use beforeEach/afterEach to reset state
2. **Mock external dependencies** - Use the provided utilities for consistent mocking
3. **Test edge cases** - Include tests for error scenarios and boundary conditions
4. **Performance matters** - Use performance metrics for critical paths
5. **Security first** - Always test encryption and access control for sensitive data

## Debugging Tips

### Enable verbose logging:
```typescript
// In your test file
beforeAll(() => {
  console.log = jest.fn(); // Capture all logs
});

afterAll(() => {
  // Print captured logs for debugging
  const logs = (console.log as jest.Mock).mock.calls;
  logs.forEach(([message]) => console.info(message));
});
```

### Inspect Service Worker state:
```typescript
const registration = await navigator.serviceWorker.ready;
console.log('SW State:', registration.active?.state);
console.log('Cache names:', await caches.keys());
```

### Monitor network requests:
```typescript
NetworkSimulator.intercept(/.*/, {
  response: (url) => {
    console.log('Intercepted:', url);
    return { success: true };
  }
});
```

## Continuous Integration

These tests are designed to run in CI environments. Ensure your CI configuration:

1. Supports Service Worker APIs (may need polyfills)
2. Has sufficient memory for performance tests
3. Runs tests in isolation to prevent cross-contamination
4. Captures performance metrics for trend analysis

## Contributing

When adding new offline functionality:

1. Add corresponding tests in this directory
2. Use existing utilities where possible
3. Document any new test patterns
4. Ensure tests are deterministic and don't rely on timing
5. Add performance benchmarks for critical operations