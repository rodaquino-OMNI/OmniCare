// Network Simulation Utilities for Offline Testing
import type { 
  NetworkConditions, 
  MockFetchOptions,
  NetworkSimulator as INetworkSimulator 
} from './offline-test.types';

// Store original fetch
const originalFetch = global.fetch;
const originalNavigatorOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

// Network interceptor registry
interface InterceptorRule {
  pattern: string | RegExp;
  options: MockFetchOptions;
}

class NetworkSimulatorImpl implements INetworkSimulator {
  private isOnline: boolean = true;
  private conditions: NetworkConditions = {
    isOnline: true,
    latency: 0,
    bandwidth: Infinity,
    packetLoss: 0,
    errorRate: 0
  };
  private interceptors: InterceptorRule[] = [];
  private fetchMocked: boolean = false;

  constructor() {
    // Ensure cleanup on process exit
    if (typeof process !== 'undefined') {
      process.on('exit', () => this.restore());
    }
  }

  mockFetch(): void {
    if (this.fetchMocked) return;
    
    this.fetchMocked = true;
    
    // Mock fetch
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      
      // Check if offline
      if (!this.isOnline) {
        throw new Error('Network request failed: No internet connection');
      }
      
      // Apply network conditions
      if (this.conditions.errorRate > 0 && Math.random() < this.conditions.errorRate) {
        throw new Error('Network request failed: Random network error');
      }
      
      // Check interceptors
      for (const interceptor of this.interceptors) {
        const matches = typeof interceptor.pattern === 'string' 
          ? url.includes(interceptor.pattern)
          : interceptor.pattern.test(url);
          
        if (matches) {
          // Apply latency
          const delay = interceptor.options.delay || this.conditions.latency;
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // Check if should fail
          if (interceptor.options.shouldFail) {
            throw new Error('Network request failed: Interceptor configured to fail');
          }
          
          // Check failure rate
          if (interceptor.options.failureRate && Math.random() < interceptor.options.failureRate) {
            throw new Error('Network request failed: Random interceptor failure');
          }
          
          // Return mocked response
          return new Response(
            JSON.stringify(interceptor.options.response || {}),
            {
              status: interceptor.options.status || 200,
              headers: {
                'Content-Type': 'application/json',
                ...(interceptor.options.headers || {})
              }
            }
          );
        }
      }
      
      // Default to original fetch with latency
      if (this.conditions.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, this.conditions.latency));
      }
      
      return originalFetch(input, init);
    }) as any;
  }

  goOffline(): void {
    this.isOnline = false;
    this.conditions.isOnline = false;
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false
    });
    
    // Dispatch offline event
    window.dispatchEvent(new Event('offline'));
  }

  goOnline(): void {
    this.isOnline = true;
    this.conditions.isOnline = true;
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true
    });
    
    // Dispatch online event
    window.dispatchEvent(new Event('online'));
  }

  setConditions(conditions: Partial<NetworkConditions>): void {
    this.conditions = {
      ...this.conditions,
      ...conditions
    };
    
    if (conditions.isOnline !== undefined) {
      this.isOnline = conditions.isOnline;
      
      if (conditions.isOnline) {
        this.goOnline();
      } else {
        this.goOffline();
      }
    }
  }

  intercept(pattern: string | RegExp, options: MockFetchOptions): void {
    this.interceptors.push({ pattern, options });
  }

  restore(): void {
    // Restore fetch
    if (this.fetchMocked) {
      global.fetch = originalFetch;
      this.fetchMocked = false;
    }
    
    // Restore navigator.onLine
    if (originalNavigatorOnLine) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnLine);
    }
    
    // Clear interceptors
    this.interceptors = [];
    
    // Reset conditions
    this.conditions = {
      isOnline: true,
      latency: 0,
      bandwidth: Infinity,
      packetLoss: 0,
      errorRate: 0
    };
    this.isOnline = true;
  }
}

// Export singleton instance
export const NetworkSimulator = new NetworkSimulatorImpl();

// Helper functions for common scenarios
export const simulateSlowNetwork = () => {
  NetworkSimulator.setConditions({
    latency: 2000,
    bandwidth: 50000 // 50KB/s
  });
};

export const simulateUnstableNetwork = () => {
  NetworkSimulator.setConditions({
    errorRate: 0.2,
    packetLoss: 0.1,
    latency: 500
  });
};

export const simulateOffline = () => {
  NetworkSimulator.goOffline();
};

export const simulateOnline = () => {
  NetworkSimulator.goOnline();
};

// Mock response builders
export const createMockResponse = (data: any, options: Partial<MockFetchOptions> = {}) => ({
  response: data,
  status: 200,
  ...options
});

export const createErrorResponse = (message: string, status: number = 500) => ({
  response: { error: message },
  status,
  shouldFail: false
});

export const createDelayedResponse = (data: any, delay: number) => ({
  response: data,
  delay,
  status: 200
});

// Pattern helpers
export const API_PATTERNS = {
  patients: /\/api\/patients/,
  encounters: /\/api\/encounters/,
  vitals: /\/api\/vitals/,
  appointments: /\/api\/appointments/,
  billing: /\/api\/billing/,
  auth: /\/api\/auth/
};

// Setup function for network simulation tests
export function setupNetworkSimulation() {
  beforeEach(() => {
    NetworkSimulator.mockFetch();
  });

  afterEach(() => {
    NetworkSimulator.restore();
  });
}

// Create offline-aware fetch wrapper
export function createOfflineAwareFetch(onOffline?: () => void) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!navigator.onLine) {
      if (onOffline) onOffline();
      throw new Error('Network request failed: No internet connection');
    }
    return fetch(input, init);
  };
}

// Retry tester for network operations
export class RetryTester {
  private attempts: number = 0;
  private maxAttempts: number;
  private delay: number;

  constructor(maxAttempts: number = 3, delay: number = 1000) {
    this.maxAttempts = maxAttempts;
    this.delay = delay;
  }

  async retry<T>(operation: () => Promise<T>): Promise<T> {
    while (this.attempts < this.maxAttempts) {
      try {
        this.attempts++;
        return await operation();
      } catch (error) {
        if (this.attempts >= this.maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    throw new Error('Max retry attempts reached');
  }

  getAttempts(): number {
    return this.attempts;
  }

  reset(): void {
    this.attempts = 0;
  }
}

// Mock IndexedDB implementation with proper event handling
export class IndexedDBMock {
  private databases: Map<string, Map<string, Map<string, any>>> = new Map();
  private version: number = 1;

  open(name: string, version?: number) {
    if (!this.databases.has(name)) {
      this.databases.set(name, new Map());
    }
    
    const db = this.databases.get(name)!;
    const request: any = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      readyState: 'pending'
    };

    // Simulate async database opening
    setTimeout(() => {
      request.result = {
        name,
        version: version || this.version,
        objectStoreNames: Array.from(db.keys()),
        
        transaction: (storeNames: string | string[], mode: 'readonly' | 'readwrite' = 'readonly') => {
          const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
          
          return {
            objectStore: (storeName: string) => {
              if (!db.has(storeName)) {
                db.set(storeName, new Map());
              }
              const store = db.get(storeName)!;
              
              return {
                name: storeName,
                keyPath: null,
                indexNames: [],
                
                put: (value: any, key?: string) => {
                  const putRequest: any = {
                    result: key || Date.now().toString(),
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    store.set(putRequest.result, value);
                    if (putRequest.onsuccess) {
                      putRequest.onsuccess({ target: putRequest });
                    }
                  }, 0);
                  
                  return putRequest;
                },
                
                get: (key: string) => {
                  const getRequest: any = {
                    result: store.get(key),
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    if (getRequest.onsuccess) {
                      getRequest.onsuccess({ target: getRequest });
                    }
                  }, 0);
                  
                  return getRequest;
                },
                
                delete: (key: string) => {
                  const deleteRequest: any = {
                    result: undefined,
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    store.delete(key);
                    if (deleteRequest.onsuccess) {
                      deleteRequest.onsuccess({ target: deleteRequest });
                    }
                  }, 0);
                  
                  return deleteRequest;
                },
                
                getAll: (query?: any, count?: number) => {
                  const getAllRequest: any = {
                    result: Array.from(store.values()).slice(0, count),
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    if (getAllRequest.onsuccess) {
                      getAllRequest.onsuccess({ target: getAllRequest });
                    }
                  }, 0);
                  
                  return getAllRequest;
                },
                
                getAllKeys: (query?: any, count?: number) => {
                  const getAllKeysRequest: any = {
                    result: Array.from(store.keys()).slice(0, count),
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    if (getAllKeysRequest.onsuccess) {
                      getAllKeysRequest.onsuccess({ target: getAllKeysRequest });
                    }
                  }, 0);
                  
                  return getAllKeysRequest;
                },
                
                clear: () => {
                  const clearRequest: any = {
                    result: undefined,
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    store.clear();
                    if (clearRequest.onsuccess) {
                      clearRequest.onsuccess({ target: clearRequest });
                    }
                  }, 0);
                  
                  return clearRequest;
                },
                
                count: (query?: any) => {
                  const countRequest: any = {
                    result: store.size,
                    onsuccess: null,
                    onerror: null
                  };
                  
                  setTimeout(() => {
                    if (countRequest.onsuccess) {
                      countRequest.onsuccess({ target: countRequest });
                    }
                  }, 0);
                  
                  return countRequest;
                }
              };
            },
            
            oncomplete: null,
            onerror: null,
            onabort: null,
            mode
          };
        },
        
        createObjectStore: (name: string, options?: any) => {
          if (!db.has(name)) {
            db.set(name, new Map());
          }
          return {
            name,
            keyPath: options?.keyPath || null,
            autoIncrement: options?.autoIncrement || false,
            createIndex: jest.fn()
          };
        },
        
        deleteObjectStore: (name: string) => {
          db.delete(name);
        },
        
        close: jest.fn()
      };
      
      request.readyState = 'done';
      if (request.onsuccess) {
        request.onsuccess({ target: request });
      }
    }, 0);
    
    return request;
  }

  deleteDatabase(name: string) {
    const request: any = {
      result: undefined,
      onsuccess: null,
      onerror: null
    };
    
    setTimeout(() => {
      this.databases.delete(name);
      if (request.onsuccess) {
        request.onsuccess({ target: request });
      }
    }, 0);
    
    return request;
  }

  clear() {
    this.databases.clear();
  }

  // Helper method to get all data from a store
  getStoreData(dbName: string, storeName: string) {
    const db = this.databases.get(dbName);
    if (!db) return [];
    
    const store = db.get(storeName);
    if (!store) return [];
    
    return Array.from(store.entries()).map(([key, value]) => ({ key, value }));
  }
}

// Wait for online status
export async function waitForOnline(timeout: number = 5000): Promise<void> {
  if (navigator.onLine) return;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', handler);
      reject(new Error('Timeout waiting for online status'));
    }, timeout);

    const handler = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    window.addEventListener('online', handler, { once: true });
  });
}

// Wait for offline status
export async function waitForOffline(timeout: number = 5000): Promise<void> {
  if (!navigator.onLine) return;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('offline', handler);
      reject(new Error('Timeout waiting for offline status'));
    }, timeout);

    const handler = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    window.addEventListener('offline', handler, { once: true });
  });
}

export default NetworkSimulator;