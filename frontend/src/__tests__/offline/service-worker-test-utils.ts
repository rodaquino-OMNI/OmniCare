// Service Worker Test Utilities
import type {
  ServiceWorkerTestUtils as IServiceWorkerTestUtils,
  ExtendableEvent,
  FetchEvent,
  ExtendableMessageEvent,
  SyncManager,
  CacheStorage,
  Cache,
  Client
} from './offline-test.types';

// Mock implementations
class MockCache implements Cache {
  private cache = new Map<string, Response>();

  async match(request: RequestInfo, options?: any): Promise<Response | undefined> {
    const url = request instanceof Request ? request.url : request.toString();
    return this.cache.get(url);
  }

  async matchAll(request?: RequestInfo, options?: any): Promise<Response[]> {
    if (!request) {
      return Array.from(this.cache.values());
    }
    const url = request instanceof Request ? request.url : request.toString();
    const response = this.cache.get(url);
    return response ? [response] : [];
  }

  async add(request: RequestInfo): Promise<void> {
    const url = request instanceof Request ? request.url : request.toString();
    const response = new Response('', { status: 200 });
    this.cache.set(url, response);
  }

  async addAll(requests: RequestInfo[]): Promise<void> {
    await Promise.all(requests.map(req => this.add(req)));
  }

  async put(request: RequestInfo, response: Response): Promise<void> {
    const url = request instanceof Request ? request.url : request.toString();
    this.cache.set(url, response);
  }

  async delete(request: RequestInfo, options?: any): Promise<boolean> {
    const url = request instanceof Request ? request.url : request.toString();
    return this.cache.delete(url);
  }

  async keys(request?: RequestInfo, options?: any): Promise<Request[]> {
    const urls = Array.from(this.cache.keys());
    return urls.map(url => new Request(url));
  }
}

class MockCacheStorage implements CacheStorage {
  private caches = new Map<string, MockCache>();

  async open(cacheName: string): Promise<Cache> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new MockCache());
    }
    return this.caches.get(cacheName)!;
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName);
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }

  async match(request: RequestInfo, options?: any): Promise<Response | undefined> {
    const cacheArray = Array.from(this.caches.values());
    for (const cache of cacheArray) {
      const response = await cache.match(request, options);
      if (response) return response;
    }
    return undefined;
  }
}

class MockSyncManager implements SyncManager {
  private tags = new Set<string>();

  async getTags(): Promise<string[]> {
    return Array.from(this.tags);
  }

  async register(tag: string): Promise<void> {
    this.tags.add(tag);
  }
}

class MockServiceWorker {
  state: 'installing' | 'installed' | 'activating' | 'activated' = 'installing';
  scriptURL: string = '/sw.js';
  
  postMessage(message: any): void {
    // Mock message handling
    console.log('Service Worker received message:', message);
  }
}

class MockServiceWorkerRegistration {
  installing: MockServiceWorker | null = null;
  waiting: MockServiceWorker | null = null;
  active: MockServiceWorker | null = null;
  scope: string = '/';
  updateViaCache: 'imports' | 'all' | 'none' = 'imports';
  sync = new MockSyncManager();
  
  async update(): Promise<void> {
    // Mock update logic
    console.log('Service Worker update triggered');
  }
  
  async unregister(): Promise<boolean> {
    return true;
  }
}

// Export MockServiceWorker for use in tests
export { MockServiceWorker };

// Mock ExtendableEvent
export class MockExtendableEvent implements ExtendableEvent {
  type: string;
  defaultPrevented: boolean = false;
  promises: Promise<any>[] = [];

  constructor(type: string) {
    this.type = type;
  }

  waitUntil(promise: Promise<any>): void {
    this.promises.push(promise);
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    // Mock implementation
  }

  stopImmediatePropagation(): void {
    // Mock implementation
  }

  // Required Event properties
  bubbles: boolean = false;
  cancelBubble: boolean = false;
  cancelable: boolean = false;
  composed: boolean = false;
  currentTarget: EventTarget | null = null;
  eventPhase: number = 0;
  isTrusted: boolean = false;
  returnValue: boolean = true;
  srcElement: EventTarget | null = null;
  target: EventTarget | null = null;
  timeStamp: number = Date.now();
  
  composedPath(): EventTarget[] {
    return [];
  }
  
  initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void {
    // Mock implementation
  }

  get NONE(): 0 { return 0; }
  get CAPTURING_PHASE(): 1 { return 1; }
  get AT_TARGET(): 2 { return 2; }
  get BUBBLING_PHASE(): 3 { return 3; }
}

// Service Worker Test Utils Implementation
class ServiceWorkerTestUtilsImpl implements IServiceWorkerTestUtils {
  private originalServiceWorker: any;
  private originalCaches: any;
  private mockRegistration: MockServiceWorkerRegistration | null = null;

  mockNavigatorServiceWorker(): void {
    this.originalServiceWorker = (navigator as any).serviceWorker;
    
    const mockContainer = {
      register: jest.fn(async (scriptURL: string, options?: any) => {
        this.mockRegistration = new MockServiceWorkerRegistration();
        const sw = new MockServiceWorker();
        sw.scriptURL = scriptURL;
        sw.state = 'installing';
        this.mockRegistration.installing = sw;
        
        // Simulate installation
        setTimeout(() => {
          if (this.mockRegistration) {
            sw.state = 'installed';
            this.mockRegistration.installing = null;
            this.mockRegistration.waiting = sw;
          }
        }, 100);
        
        return this.mockRegistration;
      }),
      
      getRegistration: jest.fn(async () => this.mockRegistration),
      getRegistrations: jest.fn(async () => this.mockRegistration ? [this.mockRegistration] : []),
      
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      
      ready: Promise.resolve(this.mockRegistration || new MockServiceWorkerRegistration())
    };
    
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: mockContainer
    });
  }

  mockCacheAPI(): void {
    this.originalCaches = (global as any).caches;
    (global as any).caches = new MockCacheStorage();
  }

  mockBackgroundSync(): SyncManager {
    return new MockSyncManager();
  }

  simulateUpdate(): void {
    if (this.mockRegistration && this.mockRegistration.waiting) {
      const sw = this.mockRegistration.waiting;
      sw.state = 'activating';
      this.mockRegistration.waiting = null;
      this.mockRegistration.active = sw;
      
      setTimeout(() => {
        sw.state = 'activated';
      }, 50);
    }
  }

  simulateActivation(): void {
    if (this.mockRegistration && this.mockRegistration.active) {
      this.mockRegistration.active.state = 'activated';
    }
  }

  simulateMessage(data: any, source?: any): void {
    const event = new MessageEvent('message', {
      data,
      source: source || (this.mockRegistration?.active || null)
    });
    
    if ((navigator as any).serviceWorker) {
      const listeners = (navigator as any).serviceWorker.addEventListener.mock.calls
        .filter((call: any[]) => call[0] === 'message')
        .map((call: any[]) => call[1]);
      
      listeners.forEach((listener: Function) => listener(event));
    }
  }

  cleanup(): void {
    if (this.originalServiceWorker !== undefined) {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: this.originalServiceWorker
      });
    }
    
    if (this.originalCaches !== undefined) {
      (global as any).caches = this.originalCaches;
    }
    
    this.mockRegistration = null;
  }

  async waitForState(sw: ServiceWorker | MockServiceWorker, state: string): Promise<void> {
    return new Promise((resolve) => {
      if ((sw as any).state === state) {
        resolve();
        return;
      }
      
      // Simulate state change
      setTimeout(() => {
        (sw as any).state = state;
        resolve();
      }, 100);
    });
  }

  createMockServiceWorker(): MockServiceWorker {
    return new MockServiceWorker();
  }
}

// Export singleton instance
export const ServiceWorkerTestUtils = new ServiceWorkerTestUtilsImpl();

// Mock Service Worker Lifecycle
export const mockServiceWorkerLifecycle = () => {
  const events = {
    install: jest.fn(),
    activate: jest.fn(),
    fetch: jest.fn(),
    message: jest.fn(),
    sync: jest.fn(),
    push: jest.fn()
  };
  
  // Mock self for service worker context
  const mockSelf = {
    addEventListener: jest.fn((event: string, handler: Function) => {
      events[event as keyof typeof events] = handler as any;
    }),
    
    skipWaiting: jest.fn(() => Promise.resolve()),
    
    clients: {
      claim: jest.fn(() => Promise.resolve()),
      get: jest.fn(async (id: string) => null),
      matchAll: jest.fn(async () => []),
      openWindow: jest.fn(async (url: string) => null)
    },
    
    registration: new MockServiceWorkerRegistration()
  };
  
  (global as any).self = mockSelf;
  
  return {
    mockSelf,
    events,
    triggerInstall: () => {
      const event = new MockExtendableEvent('install');
      events.install(event);
      return event.promises;
    },
    triggerActivate: () => {
      const event = new MockExtendableEvent('activate');
      events.activate(event);
      return event.promises;
    },
    triggerFetch: (request: Request) => {
      const event = createMockFetchEvent(request);
      events.fetch(event);
      return event;
    },
    cleanup: () => {
      delete (global as any).self;
    }
  };
};

// Create Mock Fetch Event
export const createMockFetchEvent = (request: Request): FetchEvent & { response?: Response } => {
  let respondWithCalled = false;
  let response: Response | undefined;
  
  const baseEvent = new MockExtendableEvent('fetch');
  const event = Object.assign(baseEvent, {
    request,
    clientId: 'test-client-id',
    resultingClientId: '',
    replacesClientId: '',
    handled: Promise.resolve(undefined),
    preloadResponse: Promise.resolve(undefined),
    response: undefined as Response | undefined,
    
    respondWith(r: Response | Promise<Response>): void {
      if (respondWithCalled) {
        throw new Error('respondWith() already called');
      }
      respondWithCalled = true;
      
      Promise.resolve(r).then(res => {
        response = res;
        event.response = res;
      });
    }
  }) as FetchEvent & { response?: Response };
  
  return event;
};

// Helper to create mock clients
export const createMockClient = (options: Partial<Client> = {}): Client => ({
  id: 'test-client-123',
  type: 'window',
  url: 'http://localhost:3000/',
  postMessage: jest.fn(),
  ...options
});

// Helper to simulate network conditions in service worker
export const simulateOfflineInServiceWorker = () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(() => 
    Promise.reject(new Error('Network request failed'))
  ) as any;
  
  return () => {
    global.fetch = originalFetch;
  };
};

// Helper to test cache strategies
export const testCacheStrategy = async (
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate',
  request: Request,
  cachedResponse?: Response,
  networkResponse?: Response
) => {
  const cache = new MockCache();
  if (cachedResponse) {
    await cache.put(request, cachedResponse);
  }
  
  const originalFetch = global.fetch;
  global.fetch = jest.fn(() => 
    networkResponse 
      ? Promise.resolve(networkResponse)
      : Promise.reject(new Error('Network error'))
  ) as any;
  
  let result: Response | undefined;
  
  switch (strategy) {
    case 'cache-first':
      result = await cache.match(request) || await fetch(request).catch(() => undefined);
      break;
      
    case 'network-first':
      try {
        result = await fetch(request);
        await cache.put(request, result.clone());
      } catch {
        result = await cache.match(request);
      }
      break;
      
    case 'stale-while-revalidate':
      const cached = await cache.match(request);
      if (cached) {
        result = cached;
        // Update cache in background
        fetch(request).then(response => {
          cache.put(request, response);
        }).catch(() => {});
      } else {
        result = await fetch(request);
        await cache.put(request, result.clone());
      }
      break;
  }
  
  global.fetch = originalFetch;
  return result;
};

// Setup function for service worker tests
export function setupServiceWorkerTests() {
  beforeEach(() => {
    ServiceWorkerTestUtils.mockNavigatorServiceWorker();
    ServiceWorkerTestUtils.mockCacheAPI();
  });

  afterEach(() => {
    ServiceWorkerTestUtils.cleanup();
  });
}

export default ServiceWorkerTestUtils;