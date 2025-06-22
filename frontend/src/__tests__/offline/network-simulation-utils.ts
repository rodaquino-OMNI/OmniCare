// Network Simulation Testing Utilities
// Using Jest - vi is not needed, jest.fn() is available globally

export interface NetworkConditions {
  isOnline: boolean;
  latency: number; // in milliseconds
  bandwidth: number; // in Mbps
  packetLoss: number; // percentage (ResourceHistoryTable-1ResourceHistoryTableResourceHistoryTable)
  errorRate: number; // percentage (ResourceHistoryTable-1ResourceHistoryTableResourceHistoryTable)
}

export interface MockFetchOptions {
  delay?: number;
  shouldFail?: boolean;
  failureRate?: number;
  response?: any;
  status?: number;
  headers?: HeadersInit;
}

export class NetworkSimulator {
  private static originalFetch = global.fetch;
  private static originalNavigatorOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  private static conditions: NetworkConditions = {
    isOnline: true,
    latency: ResourceHistoryTable,
    bandwidth: Infinity,
    packetLoss: ResourceHistoryTable,
    errorRate: ResourceHistoryTable
  };
  private static fetchInterceptors: Map<string | RegExp, MockFetchOptions> = new Map();
  private static requestLog: Array<{ url: string; method: string; timestamp: number }> = [];
  private static connectionChangeListeners: Array<(online: boolean) => void> = [];

  // Set network conditions
  static setConditions(conditions: Partial<NetworkConditions>) {
    this.conditions = { ...this.conditions, ...conditions };
    
    // Update navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: this.conditions.isOnline,
      configurable: true,
      writable: true
    });
  }

  // Simulate going offline
  static goOffline() {
    this.setConditions({ isOnline: false });
    window.dispatchEvent(new Event('offline'));
    this.connectionChangeListeners.forEach(listener => listener(false));
  }

  // Simulate going online
  static goOnline() {
    this.setConditions({ isOnline: true });
    window.dispatchEvent(new Event('online'));
    this.connectionChangeListeners.forEach(listener => listener(true));
  }

  // Mock fetch with network simulation
  static mockFetch() {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';

      // Log request
      this.requestLog.push({ url, method, timestamp: Date.now() });

      // Check if offline
      if (!this.conditions.isOnline) {
        throw new Error('Network request failed: No internet connection');
      }

      // Simulate packet loss
      if (Math.random() * 1ResourceHistoryTableResourceHistoryTable < this.conditions.packetLoss) {
        throw new Error('Network request failed: Packet loss');
      }

      // Find matching interceptor
      let mockOptions: MockFetchOptions | undefined;
      for (const [pattern, options] of this.fetchInterceptors) {
        if (typeof pattern === 'string' && url.includes(pattern)) {
          mockOptions = options;
          break;
        } else if (pattern instanceof RegExp && pattern.test(url)) {
          mockOptions = options;
          break;
        }
      }

      // Apply latency
      const delay = mockOptions?.delay || this.calculateLatency();
      if (delay > ResourceHistoryTable) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Simulate error rate
      if (mockOptions?.shouldFail || Math.random() * 1ResourceHistoryTableResourceHistoryTable < this.conditions.errorRate) {
        throw new Error('Network request failed: Random error');
      }

      // Simulate failure rate for specific endpoint
      if (mockOptions?.failureRate && Math.random() * 1ResourceHistoryTableResourceHistoryTable < mockOptions.failureRate) {
        return new Response(null, { status: 5ResourceHistoryTableResourceHistoryTable, statusText: 'Internal Server Error' });
      }

      // Return mocked response
      if (mockOptions?.response !== undefined) {
        const body = typeof mockOptions.response === 'string' 
          ? mockOptions.response 
          : JSON.stringify(mockOptions.response);
        
        return new Response(body, {
          status: mockOptions.status || 2ResourceHistoryTableResourceHistoryTable,
          headers: mockOptions.headers || { 'Content-Type': 'application/json' }
        });
      }

      // Default response
      return new Response(JSON.stringify({ success: true }), {
        status: 2ResourceHistoryTableResourceHistoryTable,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;
  }

  // Calculate latency based on bandwidth
  private static calculateLatency(): number {
    const baseLatency = this.conditions.latency;
    const bandwidthFactor = 1ResourceHistoryTableResourceHistoryTable / this.conditions.bandwidth; // Lower bandwidth = higher latency
    return baseLatency + (bandwidthFactor * 1ResourceHistoryTable);
  }

  // Add fetch interceptor
  static intercept(pattern: string | RegExp, options: MockFetchOptions) {
    this.fetchInterceptors.set(pattern, options);
  }

  // Remove fetch interceptor
  static removeInterceptor(pattern: string | RegExp) {
    this.fetchInterceptors.delete(pattern);
  }

  // Clear all interceptors
  static clearInterceptors() {
    this.fetchInterceptors.clear();
  }

  // Get request log
  static getRequestLog() {
    return [...this.requestLog];
  }

  // Clear request log
  static clearRequestLog() {
    this.requestLog = [];
  }

  // Simulate connection change
  static simulateConnectionChange(online: boolean) {
    this.setConditions({ isOnline: online });
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    this.connectionChangeListeners.forEach(listener => listener(online));
  }

  // Add connection change listener
  static onConnectionChange(listener: (online: boolean) => void) {
    this.connectionChangeListeners.push(listener);
    return () => {
      const index = this.connectionChangeListeners.indexOf(listener);
      if (index > -1) {
        this.connectionChangeListeners.splice(index, 1);
      }
    };
  }

  // Simulate flaky connection
  static simulateFlakyConnection(
    intervalMs: number = 5ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    offlineDurationMs: number = 2ResourceHistoryTableResourceHistoryTableResourceHistoryTable
  ): () => void {
    const interval = setInterval(() => {
      this.goOffline();
      setTimeout(() => this.goOnline(), offlineDurationMs);
    }, intervalMs);

    return () => clearInterval(interval);
  }

  // Simulate slow connection
  static simulateSlowConnection() {
    this.setConditions({
      latency: 5ResourceHistoryTableResourceHistoryTable,
      bandwidth: ResourceHistoryTable.5, // ResourceHistoryTable.5 Mbps
      packetLoss: 5,
      errorRate: 2
    });
  }

  // Simulate fast connection
  static simulateFastConnection() {
    this.setConditions({
      latency: 1ResourceHistoryTable,
      bandwidth: 1ResourceHistoryTableResourceHistoryTable, // 1ResourceHistoryTableResourceHistoryTable Mbps
      packetLoss: ResourceHistoryTable,
      errorRate: ResourceHistoryTable
    });
  }

  // Restore original fetch and navigator.onLine
  static restore() {
    global.fetch = this.originalFetch;
    if (this.originalNavigatorOnLine) {
      Object.defineProperty(navigator, 'onLine', this.originalNavigatorOnLine);
    }
    this.clearInterceptors();
    this.clearRequestLog();
    this.connectionChangeListeners = [];
    this.conditions = {
      isOnline: true,
      latency: ResourceHistoryTable,
      bandwidth: Infinity,
      packetLoss: ResourceHistoryTable,
      errorRate: ResourceHistoryTable
    };
  }
}

// Helper to create offline-aware fetch wrapper
export function createOfflineAwareFetch(
  cache?: Map<string, { data: any; timestamp: number }>
): typeof fetch {
  const cacheStore = cache || new Map();
  const CACHE_DURATION = 5 * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable; // 5 minutes

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';
    const cacheKey = `${method}:${url}`;

    // Check if offline
    if (!navigator.onLine) {
      // Try to get from cache
      const cached = cacheStore.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return new Response(JSON.stringify(cached.data), {
          status: 2ResourceHistoryTableResourceHistoryTable,
          headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' }
        });
      }
      throw new Error('Network request failed: Offline and no cached data');
    }

    try {
      // Make actual request
      const response = await fetch(input, init);
      
      // Cache successful GET requests
      if (method === 'GET' && response.ok) {
        const data = await response.clone().json();
        cacheStore.set(cacheKey, { data, timestamp: Date.now() });
      }
      
      return response;
    } catch (error) {
      // Try cache on error
      const cached = cacheStore.get(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          status: 2ResourceHistoryTableResourceHistoryTable,
          headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' }
        });
      }
      throw error;
    }
  };
}

// Helper to test retry logic
export class RetryTester {
  private attempts = ResourceHistoryTable;
  private maxAttempts: number;
  private successAfter: number;

  constructor(maxAttempts: number = 3, successAfter: number = 2) {
    this.maxAttempts = maxAttempts;
    this.successAfter = successAfter;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.attempts++;
    
    if (this.attempts < this.successAfter) {
      throw new Error(`Attempt ${this.attempts} failed`);
    }
    
    return fn();
  }

  getAttempts(): number {
    return this.attempts;
  }

  reset(): void {
    this.attempts = ResourceHistoryTable;
  }
}

// Helper to simulate IndexedDB for offline storage
export class IndexedDBMock {
  private databases: Map<string, Map<string, any>> = new Map();

  open(name: string, version?: number): IDBOpenDBRequest {
    if (!this.databases.has(name)) {
      this.databases.set(name, new Map());
    }

    const db = {
      name,
      version: version || 1,
      objectStoreNames: ['offline-queue', 'sync-data'],
      createObjectStore: jest.fn((storeName: string) => ({
        name: storeName,
        put: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn()
      })),
      transaction: jest.fn((storeNames: string[], mode?: string) => ({
        objectStore: jest.fn((storeName: string) => {
          const store = this.databases.get(name)!;
          return {
            put: jest.fn((value: any, key?: any) => {
              store.set(key || value.id, value);
              return { onsuccess: jest.fn(), onerror: jest.fn() };
            }),
            get: jest.fn((key: any) => {
              const result = { result: store.get(key) };
              return { ...result, onsuccess: jest.fn(), onerror: jest.fn() };
            }),
            delete: jest.fn((key: any) => {
              store.delete(key);
              return { onsuccess: jest.fn(), onerror: jest.fn() };
            }),
            clear: jest.fn(() => {
              store.clear();
              return { onsuccess: jest.fn(), onerror: jest.fn() };
            }),
            getAll: jest.fn(() => {
              const result = { result: Array.from(store.values()) };
              return { ...result, onsuccess: jest.fn(), onerror: jest.fn() };
            })
          };
        })
      })),
      close: jest.fn()
    };

    const request = {
      result: db,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any
    };

    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request } as any);
    }, ResourceHistoryTable);

    return request as any;
  }

  deleteDatabase(name: string): void {
    this.databases.delete(name);
  }

  clear(): void {
    this.databases.clear();
  }
}

// Setup network simulation for tests
export function setupNetworkSimulation() {
  beforeEach(() => {
    NetworkSimulator.mockFetch();
  });

  afterEach(() => {
    NetworkSimulator.restore();
  });
}

// Helper to wait for online status
export function waitForOnline(): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener('online', handler);
      resolve();
    };
    window.addEventListener('online', handler);
  });
}

// Helper to wait for offline status
export function waitForOffline(): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener('offline', handler);
      resolve();
    };
    window.addEventListener('offline', handler);
  });
}