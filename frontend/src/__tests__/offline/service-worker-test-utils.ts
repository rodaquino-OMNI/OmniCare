// Service Worker Testing Utilities
// Jest is available globally - no imports needed

// Mock Response constructor for Node.js test environment
if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(public body: any, public options: any = {}) {}
    status = this.options.status || 200;
    statusText = this.options.statusText || 'OK';
    ok = this.status >= 200 && this.status < 300;
    headers = new Map(Object.entries(this.options.headers || {}));
    json() { return Promise.resolve(JSON.parse(this.body)); }
    text() { return Promise.resolve(this.body); }
    clone() { return new Response(this.body, this.options); }
  } as any;
}

// Mock Service Worker type definitions
export interface Client {
  frameType: 'auxiliary' | 'top-level' | 'nested' | 'none';
  id: string;
  type: 'window' | 'worker' | 'sharedworker';
  url: string;
  postMessage(message: any, transfer?: Transferable[]): void;
}

export interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<any>): void;
}

export interface FetchEvent extends ExtendableEvent {
  request: Request;
  clientId: string;
  resultingClientId: string;
  replacesClientId: string;
  handled: Promise<undefined>;
  preloadResponse: Promise<any | undefined>;
  respondWith(response: Response | Promise<Response>): void;
}

export interface ExtendableMessageEvent extends ExtendableEvent {
  data: any;
  origin: string;
  lastEventId: string;
  source: Client | ServiceWorker | MockServiceWorker | MessagePort | null;
  ports: readonly MessagePort[];
}

export interface SyncManager {
  getTags(): Promise<string[]>;
  register(tag: string): Promise<void>;
}

// Mock ExtendableEvent implementation
export class MockExtendableEvent implements ExtendableEvent {
  type: string;
  promises: Promise<any>[] = [];
  
  constructor(type: string) {
    this.type = type;
  }
  
  waitUntil(promise: Promise<any>): void {
    this.promises.push(promise);
  }
  
  // Event interface properties
  bubbles = false;
  cancelBubble = false;
  cancelable = false;
  composed = false;
  currentTarget = null;
  defaultPrevented = false;
  eventPhase = 0;
  isTrusted = true;
  returnValue = true;
  srcElement = null;
  target = null;
  timeStamp = Date.now();
  readonly NONE = 0 as const;
  readonly CAPTURING_PHASE = 1 as const;
  readonly AT_TARGET = 2 as const;
  readonly BUBBLING_PHASE = 3 as const;
  
  composedPath(): EventTarget[] { return []; }
  initEvent(): void {}
  preventDefault(): void {}
  stopImmediatePropagation(): void {}
  stopPropagation(): void {}
}

// Note: ExtendableEvent is a type interface, not a constructor
// MockExtendableEvent provides the implementation for testing

// Mock Service Worker registration
export interface MockServiceWorkerRegistration {
  installing: MockServiceWorker | null;
  waiting: MockServiceWorker | null;
  active: MockServiceWorker | null;
  navigationPreload: any;
  updateViaCache: 'imports' | 'all' | 'none';
  scope: string;
  update: jest.Mock;
  unregister: jest.Mock;
  showNotification: jest.Mock;
  getNotifications: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  pushManager: any;
  sync: any;
  index: any;
  paymentManager: any;
  periodicSync: any;
  backgroundFetch: any;
  cookies: any;
  taskQueue: any;
  dispatchEvent: jest.Mock;
  onupdatefound: ((this: ServiceWorkerRegistration, ev: Event) => any) | null;
}

export interface MockServiceWorker {
  state: ServiceWorkerState;
  scriptURL: string;
  postMessage: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  onstatechange: ((this: MockServiceWorker, ev: Event) => any) | null;
  dispatchEvent: jest.Mock;
  onerror: ((this: MockServiceWorker, ev: ErrorEvent) => any) | null;
  onmessage: ((this: MockServiceWorker, ev: MessageEvent) => any) | null;
}

export class ServiceWorkerTestUtils {
  private static mockRegistration: MockServiceWorkerRegistration | null = null;
  private static mockWorker: MockServiceWorker | null = null;
  private static registrationPromise: Promise<MockServiceWorkerRegistration> | null = null;
  private static updateFoundCallbacks: Array<() => void> = [];
  private static messageListeners: Map<string, Function> = new Map();

  // Create a mock service worker
  static createMockServiceWorker(state: ServiceWorkerState = 'activated'): MockServiceWorker {
    const worker: MockServiceWorker = {
      state,
      scriptURL: '/sw.js',
      postMessage: jest.fn(),
      addEventListener: jest.fn((event, callback) => {
        if (event === 'message') {
          ServiceWorkerTestUtils.messageListeners.set(callback.toString(), callback);
        }
      }),
      removeEventListener: jest.fn(),
      onstatechange: null,
      dispatchEvent: jest.fn(),
      onerror: null,
      onmessage: null
    } as MockServiceWorker;

    this.mockWorker = worker;
    return worker;
  }

  // Create a mock service worker registration
  static createMockRegistration(
    activeWorker?: MockServiceWorker
  ): MockServiceWorkerRegistration {
    const registration = {
      installing: null,
      waiting: null,
      active: activeWorker || this.createMockServiceWorker(),
      navigationPreload: {},
      updateViaCache: 'imports' as const,
      scope: '/',
      update: jest.fn().mockResolvedValue(undefined),
      unregister: jest.fn().mockResolvedValue(true),
      showNotification: jest.fn(),
      getNotifications: jest.fn(() => Promise.resolve([])),
      addEventListener: jest.fn((event, callback) => {
        if (event === 'updatefound') {
          this.updateFoundCallbacks.push(callback as () => void);
        }
      }),
      removeEventListener: jest.fn(),
      pushManager: {} as PushManager,
      sync: {
        getTags: jest.fn(() => Promise.resolve([])),
        register: jest.fn(() => Promise.resolve())
      } as any,
      index: {} as any,
      paymentManager: {} as any,
      periodicSync: {} as any,
      backgroundFetch: {} as any,
      cookies: {} as any,
      taskQueue: {} as any,
      dispatchEvent: jest.fn(),
      onupdatefound: null
    };

    this.mockRegistration = registration;
    return registration;
  }

  // Mock navigator.serviceWorker
  static mockNavigatorServiceWorker() {
    const registration = this.createMockRegistration();
    this.registrationPromise = Promise.resolve(registration);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: this.registrationPromise,
        register: jest.fn(() => this.registrationPromise),
        getRegistration: jest.fn(() => this.registrationPromise),
        getRegistrations: jest.fn(() => Promise.resolve([registration])),
        controller: this.mockWorker,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        startMessages: jest.fn()
      },
      configurable: true,
      writable: true
    });
  }

  // Simulate service worker update
  static simulateUpdate(newWorker?: MockServiceWorker) {
    if (!this.mockRegistration) {
      throw new Error('No mock registration available');
    }

    const installing = newWorker || this.createMockServiceWorker('installing');
    this.mockRegistration.installing = installing;

    // Trigger updatefound event
    this.updateFoundCallbacks.forEach(callback => callback());

    // Simulate installation process
    setTimeout(() => {
      if (installing.state === 'installing') {
        (installing as any).state = 'installed';
        installing.onstatechange?.call(installing, new Event('statechange'));
      }
    }, 100);
  }

  // Simulate service worker activation
  static simulateActivation() {
    if (!this.mockRegistration?.installing) {
      throw new Error('No installing worker available');
    }

    const worker = this.mockRegistration.installing;
    (worker as any).state = 'activating';
    worker.onstatechange?.call(worker, new Event('statechange'));

    setTimeout(() => {
      (worker as any).state = 'activated';
      worker.onstatechange?.call(worker, new Event('statechange'));
      this.mockRegistration!.active = worker;
      this.mockRegistration!.installing = null;
    }, 100);
  }

  // Simulate service worker message
  static simulateMessage(data: any, source?: ServiceWorker | MockServiceWorker) {
    const messageEvent = new MessageEvent('message', {
      data,
      source: (source || this.mockWorker || undefined) as MessageEventSource,
      origin: window.location.origin
    });

    this.messageListeners.forEach(listener => {
      listener(messageEvent);
    });
  }

  // Simulate network conditions
  static simulateOffline() {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true
    });
    window.dispatchEvent(new Event('offline'));
  }

  static simulateOnline() {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true
    });
    window.dispatchEvent(new Event('online'));
  }

  // Simulate cache operations
  static mockCacheAPI() {
    const cacheStorage = new Map<string, Map<string, Response>>();

    const createCache = (name: string) => {
      if (!cacheStorage.has(name)) {
        cacheStorage.set(name, new Map());
      }
      const cache = cacheStorage.get(name)!;

      return {
        match: jest.fn(async (request: RequestInfo) => {
          const url = typeof request === 'string' ? request : request.url;
          return cache.get(url) || undefined;
        }),
        matchAll: jest.fn(async (request?: RequestInfo) => {
          if (!request) {
            return Array.from(cache.values());
          }
          const url = typeof request === 'string' ? request : request.url;
          const match = cache.get(url);
          return match ? [match] : [];
        }),
        add: jest.fn(async (request: RequestInfo) => {
          const url = typeof request === 'string' ? request : request.url;
          const response = new Response('cached', { status: 200 });
          cache.set(url, response);
        }),
        addAll: jest.fn(async (requests: RequestInfo[]) => {
          for (const request of requests) {
            const url = typeof request === 'string' ? request : request.url;
            const response = new Response('cached', { status: 200 });
            cache.set(url, response);
          }
        }),
        put: jest.fn(async (request: RequestInfo, response: Response) => {
          const url = typeof request === 'string' ? request : request.url;
          cache.set(url, response);
        }),
        delete: jest.fn(async (request: RequestInfo) => {
          const url = typeof request === 'string' ? request : request.url;
          return cache.delete(url);
        }),
        keys: jest.fn(async () => {
          return Array.from(cache.keys()).map(url => new Request(url));
        })
      };
    };

    (global as any).caches = {
      open: jest.fn(async (name: string) => createCache(name)),
      has: jest.fn(async (name: string) => cacheStorage.has(name)),
      delete: jest.fn(async (name: string) => cacheStorage.delete(name)),
      keys: jest.fn(async () => Array.from(cacheStorage.keys())),
      match: jest.fn(async (request: RequestInfo) => {
        const url = typeof request === 'string' ? request : request.url;
        for (const cache of cacheStorage.values()) {
          const response = cache.get(url);
          if (response) return response;
        }
        return undefined;
      })
    };
  }

  // Clean up all mocks
  static cleanup() {
    this.mockRegistration = null;
    this.mockWorker = null;
    this.registrationPromise = null;
    this.updateFoundCallbacks = [];
    this.messageListeners.clear();
    
    if ('serviceWorker' in navigator) {
      delete (navigator as any).serviceWorker;
    }
    
    if ('caches' in global) {
      delete (global as any).caches;
    }
  }

  // Utility to wait for service worker state
  static async waitForState(worker: ServiceWorker, state: ServiceWorkerState): Promise<void> {
    if (worker.state === state) return;

    return new Promise((resolve) => {
      const checkState = () => {
        if (worker.state === state) {
          worker.removeEventListener('statechange', checkState);
          resolve();
        }
      };
      worker.addEventListener('statechange', checkState);
    });
  }

  // Simulate background sync
  static mockBackgroundSync() {
    const syncTags = new Set<string>();

    const syncManager = {
      register: jest.fn(async (tag: string) => {
        syncTags.add(tag);
      }),
      getTags: jest.fn(async () => Array.from(syncTags))
    };

    if (this.mockRegistration) {
      (this.mockRegistration as any).sync = syncManager;
    }

    return syncManager;
  }

  // Simulate push notifications
  static mockPushNotifications() {
    const subscription = {
      endpoint: 'https://example.com/push',
      expirationTime: null,
      options: {
        applicationServerKey: new Uint8Array([1, 2, 3]),
        userVisibleOnly: true
      },
      getKey: jest.fn(),
      toJSON: jest.fn(() => ({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'key', auth: 'auth' }
      })),
      unsubscribe: jest.fn(() => Promise.resolve(true))
    };

    const pushManager = {
      subscribe: jest.fn(() => Promise.resolve(subscription)),
      getSubscription: jest.fn(() => Promise.resolve(subscription)),
      permissionState: jest.fn(() => Promise.resolve('granted' as PermissionState))
    };

    if (this.mockRegistration) {
      (this.mockRegistration as any).pushManager = pushManager;
    }

    return { pushManager, subscription };
  }
}

// Helper function to setup service worker testing environment
export function setupServiceWorkerTests() {
  beforeEach(() => {
    ServiceWorkerTestUtils.mockNavigatorServiceWorker();
    ServiceWorkerTestUtils.mockCacheAPI();
  });

  afterEach(() => {
    ServiceWorkerTestUtils.cleanup();
    jest.clearAllMocks();
  });
}

// Mock service worker lifecycle events
export function mockServiceWorkerLifecycle() {
  const events = {
    install: jest.fn(),
    activate: jest.fn(),
    fetch: jest.fn(),
    message: jest.fn(),
    sync: jest.fn(),
    push: jest.fn()
  };

  (global as any).addEventListener = jest.fn((event, handler) => {
    if (event in events) {
      events[event as keyof typeof events] = handler;
    }
  });

  return events;
}

// Helper to create mock fetch event
export function createMockFetchEvent(
  request: Request,
  clientId?: string
): any {
  const respondWith = jest.fn();
  const waitUntil = jest.fn();

  return {
    request,
    clientId: clientId || 'test-client',
    resultingClientId: clientId || 'test-client',
    replacesClientId: '',
    handled: Promise.resolve(),
    preloadResponse: Promise.resolve(undefined),
    respondWith,
    waitUntil,
    type: 'fetch',
    target: null,
    currentTarget: null,
    eventPhase: 0,
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    composed: false,
    isTrusted: true,
    timeStamp: Date.now(),
    srcElement: null,
    returnValue: true,
    cancelBubble: false,
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
    composedPath: () => [],
    initEvent: () => {},
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    stopPropagation: () => {}
  } as unknown as FetchEvent;
}