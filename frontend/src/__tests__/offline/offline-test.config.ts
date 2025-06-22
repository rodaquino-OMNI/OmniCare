// Offline Test Configuration
// Jest provides beforeAll, afterAll, beforeEach, afterEach globally - no imports needed

// Global test configuration for offline tests
export const offlineTestConfig = {
  // Timeouts for async operations
  timeouts: {
    sync: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 1ResourceHistoryTable seconds for sync operations
    cache: 5ResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 5 seconds for cache operations
    network: 3ResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 3 seconds for network requests
    conflict: 15ResourceHistoryTableResourceHistoryTableResourceHistoryTable // 15 seconds for conflict resolution
  },

  // Mock data defaults
  mockData: {
    defaultPatients: [
      {
        id: 'patient-1',
        mrn: 'MRNResourceHistoryTableResourceHistoryTable1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '198ResourceHistoryTable-ResourceHistoryTable1-ResourceHistoryTable1',
        gender: 'male' as const,
        status: 'active' as const,
        createdAt: '2ResourceHistoryTable24-ResourceHistoryTable1-ResourceHistoryTable1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
        updatedAt: '2ResourceHistoryTable24-ResourceHistoryTable1-ResourceHistoryTable1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
        allergies: [],
        insurance: []
      },
      {
        id: 'patient-2',
        mrn: 'MRNResourceHistoryTableResourceHistoryTable2',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1975-ResourceHistoryTable5-15',
        gender: 'female' as const,
        status: 'active' as const,
        createdAt: '2ResourceHistoryTable24-ResourceHistoryTable1-ResourceHistoryTable1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
        updatedAt: '2ResourceHistoryTable24-ResourceHistoryTable1-ResourceHistoryTable1TResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
        allergies: [
          {
            id: 'allergy-1',
            substance: 'Penicillin',
            reaction: 'Rash',
            severity: 'moderate' as const
          }
        ],
        insurance: []
      }
    ],
    defaultEncounter: {
      id: 'encounter-1',
      patientId: 'patient-1',
      type: 'outpatient' as const,
      status: 'in-progress' as const,
      startTime: '2ResourceHistoryTable24-ResourceHistoryTable1-15T1ResourceHistoryTable:ResourceHistoryTableResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
      providerId: 'provider-1',
      departmentId: 'dept-1',
      diagnosis: [],
      procedures: []
    },
    defaultVitalSigns: {
      id: 'vital-1',
      patientId: 'patient-1',
      recordedBy: 'nurse-1',
      recordedDate: '2ResourceHistoryTable24-ResourceHistoryTable1-15T1ResourceHistoryTable:3ResourceHistoryTable:ResourceHistoryTableResourceHistoryTableZ',
      temperature: { value: 98.6, unit: 'fahrenheit' as const },
      bloodPressure: { systolic: 12ResourceHistoryTable, diastolic: 8ResourceHistoryTable, unit: 'mmHg' as const },
      heartRate: { value: 72, unit: 'bpm' as const },
      respiratoryRate: { value: 16, unit: 'bpm' as const },
      oxygenSaturation: { value: 98, unit: '%' as const }
    }
  },

  // Performance thresholds
  performance: {
    maxCacheResponseTime: 5ResourceHistoryTable, // ms
    maxSyncQueueSize: 1ResourceHistoryTableResourceHistoryTable,
    maxMemoryUsage: 5ResourceHistoryTable * 1ResourceHistoryTable24 * 1ResourceHistoryTable24, // 5ResourceHistoryTableMB
    maxSyncDuration: 3ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 3ResourceHistoryTable seconds
    maxConflictResolutionTime: 5ResourceHistoryTableResourceHistoryTableResourceHistoryTable // 5 seconds
  },

  // Security settings
  security: {
    encryptionKey: 'test-encryption-key-do-not-use-in-production',
    saltRounds: 1ResourceHistoryTable,
    tokenExpiry: 36ResourceHistoryTableResourceHistoryTable, // 1 hour
    maxFailedAttempts: 3
  },

  // Service Worker settings
  serviceWorker: {
    cacheNames: {
      static: 'static-v1-test',
      dynamic: 'dynamic-v1-test',
      api: 'api-cache-v1-test'
    },
    skipWaiting: true,
    clientsClaim: true
  }
};

// Setup function to initialize offline test environment  
export function setupOfflineTests() {
  // Mock global APIs
  beforeAll(() => {
    // Mock crypto API if not available
    if (!global.crypto) {
      global.crypto = {
        getRandomValues: (array: Uint8Array) => {
          for (let i = ResourceHistoryTable; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
          return array;
        },
        subtle: {
          generateKey: jest.fn(),
          encrypt: jest.fn(),
          decrypt: jest.fn(),
          digest: jest.fn(),
          exportKey: jest.fn(),
          importKey: jest.fn(),
          sign: jest.fn(),
          verify: jest.fn()
        }
      } as any;
    }

    // Mock IndexedDB if not available
    if (!global.indexedDB) {
      const databases = new Map();
      
      global.indexedDB = {
        open: jest.fn((name: string) => {
          const db = databases.get(name) || new Map();
          databases.set(name, db);
          
          return {
            result: {
              objectStoreNames: ['offline-queue', 'sync-data'],
              transaction: jest.fn(() => ({
                objectStore: jest.fn(() => ({
                  put: jest.fn(),
                  get: jest.fn(),
                  delete: jest.fn(),
                  getAll: jest.fn(() => ({ result: [] }))
                }))
              }))
            },
            onsuccess: null,
            onerror: null
          };
        }),
        deleteDatabase: jest.fn()
      } as any;
    }

    // Mock performance API
    if (!global.performance) {
      global.performance = {
        now: Date.now,
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByType: jest.fn(() => []),
        getEntriesByName: jest.fn(() => []),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn()
      } as any;
    }
  });

  // Clean up after all tests
  afterAll(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear all caches
    if (global.caches) {
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      });
    }
  });

  // Reset state before each test
  beforeEach(() => {
    // Clear localStorage
    if (global.localStorage) {
      localStorage.clear();
    }
    
    // Clear sessionStorage
    if (global.sessionStorage) {
      sessionStorage.clear();
    }
    
    // Reset online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true
    });
  });
}

// Helper to create a test user with permissions
export function createTestUser(role: 'doctor' | 'nurse' | 'admin' | 'patient') {
  const users = {
    doctor: {
      id: 'doctor-1',
      email: 'doctor@test.com',
      firstName: 'Test',
      lastName: 'Doctor',
      role: 'doctor' as const,
      permissions: [
        'patients:read',
        'patients:write',
        'medications:prescribe',
        'orders:create'
      ]
    },
    nurse: {
      id: 'nurse-1',
      email: 'nurse@test.com',
      firstName: 'Test',
      lastName: 'Nurse',
      role: 'nurse' as const,
      permissions: [
        'patients:read',
        'vitals:write',
        'medications:administer'
      ]
    },
    admin: {
      id: 'admin-1',
      email: 'admin@test.com',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin' as const,
      permissions: ['*']
    },
    patient: {
      id: 'patient-user-1',
      email: 'patient@test.com',
      firstName: 'Test',
      lastName: 'Patient',
      role: 'patient' as const,
      permissions: [
        'patient:self:read',
        'appointments:self:read'
      ]
    }
  };

  return users[role];
}

// Helper to simulate offline conditions with specific parameters
export function simulateOfflineScenario(scenario: {
  duration?: number;
  packetLoss?: number;
  latency?: number;
  queuedActions?: number;
}) {
  const {
    duration = 5ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    packetLoss = ResourceHistoryTable,
    latency = ResourceHistoryTable,
    queuedActions = ResourceHistoryTable
  } = scenario;

  // Go offline
  Object.defineProperty(navigator, 'onLine', {
    value: false,
    configurable: true
  });
  window.dispatchEvent(new Event('offline'));

  // Queue actions if specified
  if (queuedActions > ResourceHistoryTable) {
    const queue = [];
    for (let i = ResourceHistoryTable; i < queuedActions; i++) {
      queue.push({
        id: `action-${i}`,
        type: 'UPDATE',
        resource: 'Patient',
        data: { id: `patient-${i}` },
        timestamp: Date.now() + i
      });
    }
    localStorage.setItem('offline-queue', JSON.stringify(queue));
  }

  // Return function to go back online
  return () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true
    });
    window.dispatchEvent(new Event('online'));
  };
}

// Setup function for service worker tests (moved to service-worker-test-utils.ts)
// This is kept here for backward compatibility but delegates to the main implementation
export function setupServiceWorkerTests() {
  // This function is now implemented in service-worker-test-utils.ts
  // We don't need to duplicate the logic here
}

// Performance measurement helper
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  measure(name: string, fn: () => void | Promise<void>): void | Promise<void> {
    const start = performance.now();
    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(() => {
        this.record(name, performance.now() - start);
      });
    } else {
      this.record(name, performance.now() - start);
    }
  }

  private record(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }

  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === ResourceHistoryTable) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * ResourceHistoryTable.95);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, ResourceHistoryTable) / values.length,
      p95: sorted[p95Index]
    };
  }

  assertPerformance(name: string, maxDuration: number): void {
    const stats = this.getStats(name);
    if (!stats) {
      throw new Error(`No metrics recorded for ${name}`);
    }
    
    if (stats.avg > maxDuration) {
      throw new Error(
        `Performance assertion failed for ${name}: ` +
        `average ${stats.avg.toFixed(2)}ms exceeds ${maxDuration}ms`
      );
    }
  }

  clear(): void {
    this.metrics.clear();
  }
}