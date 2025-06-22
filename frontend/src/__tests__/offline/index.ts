// Offline Testing Suite - Main Export File
// This file provides a centralized export for all offline testing utilities

// Core test utilities
export * from './service-worker-test-utils';
export * from './network-simulation-utils';
export * from './sync-conflict-test-utils';

// Test configuration
export * from './offline-test.config';

// Convenience exports for common test scenarios
export { setupOfflineTests, offlineTestConfig } from './offline-test.config';
export { 
  ServiceWorkerTestUtils, 
  setupServiceWorkerTests,
  mockServiceWorkerLifecycle,
  createMockFetchEvent 
} from './service-worker-test-utils';
export { 
  NetworkSimulator,
  setupNetworkSimulation,
  createOfflineAwareFetch,
  RetryTester,
  IndexedDBMock,
  waitForOnline,
  waitForOffline
} from './network-simulation-utils';
export {
  SyncConflictSimulator,
  createSyncTestScenario,
  defaultMergeStrategies,
  mockConflictResolutionUI,
  type SyncConflict,
  type SyncOperation,
  type MergeStrategy
} from './sync-conflict-test-utils';

// Combined setup function for comprehensive offline testing
export function setupComprehensiveOfflineTests() {
  setupOfflineTests();
  setupServiceWorkerTests();
  setupNetworkSimulation();
}

// Helper to create a complete offline test environment
export function createOfflineTestEnvironment() {
  const networkSimulator = NetworkSimulator;
  const serviceWorkerUtils = ServiceWorkerTestUtils;
  const syncSimulator = new SyncConflictSimulator();
  
  // Register default merge strategies
  defaultMergeStrategies.forEach(strategy => {
    syncSimulator.registerMergeStrategy(strategy);
  });

  return {
    network: networkSimulator,
    serviceWorker: serviceWorkerUtils,
    sync: syncSimulator,
    
    // Convenience methods
    goOffline: () => networkSimulator.goOffline(),
    goOnline: () => networkSimulator.goOnline(),
    simulateSlowNetwork: () => networkSimulator.simulateSlowConnection(),
    simulateFastNetwork: () => networkSimulator.simulateFastConnection(),
    
    // Cleanup
    cleanup: () => {
      networkSimulator.restore();
      serviceWorkerUtils.cleanup();
      syncSimulator.clear();
    }
  };
}

// Test data factories
export const testDataFactories = {
  createPatient: (overrides?: Partial<any>) => ({
    id: `patient-${Date.now()}`,
    mrn: `MRN${Date.now()}`,
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    gender: 'other' as const,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    allergies: [],
    insurance: [],
    ...overrides
  }),

  createEncounter: (patientId: string, overrides?: Partial<any>) => ({
    id: `encounter-${Date.now()}`,
    patientId,
    type: 'outpatient' as const,
    status: 'scheduled' as const,
    startTime: new Date().toISOString(),
    providerId: 'provider-1',
    departmentId: 'dept-1',
    diagnosis: [],
    procedures: [],
    ...overrides
  }),

  createVitalSigns: (patientId: string, overrides?: Partial<any>) => ({
    id: `vital-${Date.now()}`,
    patientId,
    recordedBy: 'nurse-1',
    recordedDate: new Date().toISOString(),
    temperature: { value: 98.6, unit: 'fahrenheit' as const },
    bloodPressure: { systolic: 120, diastolic: 80, unit: 'mmHg' as const },
    heartRate: { value: 72, unit: 'bpm' as const },
    ...overrides
  }),

  createSyncAction: (type: string, resource: any) => ({
    id: `sync-${Date.now()}`,
    type,
    resource,
    timestamp: new Date().toISOString(),
    retries: 0,
    status: 'pending' as const
  })
};

// Common test assertions for offline functionality
export const offlineAssertions = {
  assertDataIsCached: async (key: string) => {
    const cached = localStorage.getItem(key);
    expect(cached).toBeTruthy();
    return JSON.parse(cached!);
  },

  assertQueueContains: (actionType: string) => {
    const queue = JSON.parse(localStorage.getItem('sync-queue') || '[]');
    const hasAction = queue.some((action: any) => action.type === actionType);
    expect(hasAction).toBe(true);
  },

  assertServiceWorkerCached: async (url: string) => {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const response = await cache.match(url);
      if (response) return response;
    }
    throw new Error(`URL ${url} not found in any cache`);
  },

  assertOfflineIndicatorVisible: (container: HTMLElement) => {
    const indicator = container.querySelector('[role="alert"]');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain('offline');
  },

  assertSyncInProgress: (container: HTMLElement) => {
    const syncStatus = container.querySelector('[data-testid="sync-status"]');
    expect(syncStatus?.textContent).toContain('Syncing');
  }
};

// Performance benchmarking utilities
export const performanceBenchmarks = {
  measureCacheOperation: async (operation: () => Promise<void>, maxDuration: number) => {
    const start = performance.now();
    await operation();
    const duration = performance.now() - start;
    
    if (duration > maxDuration) {
      throw new Error(`Cache operation took ${duration}ms, expected less than ${maxDuration}ms`);
    }
    
    return duration;
  },

  measureSyncOperation: async (operation: () => Promise<void>, itemCount: number) => {
    const start = performance.now();
    await operation();
    const duration = performance.now() - start;
    const perItemDuration = duration / itemCount;
    
    return {
      totalDuration: duration,
      perItemDuration,
      itemsPerSecond: 1000 / perItemDuration
    };
  },

  measureMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }
};

// Export type definitions for TypeScript support
export type OfflineTestEnvironment = ReturnType<typeof createOfflineTestEnvironment>;
export type TestDataFactories = typeof testDataFactories;
export type OfflineAssertions = typeof offlineAssertions;
export type PerformanceBenchmarks = typeof performanceBenchmarks;