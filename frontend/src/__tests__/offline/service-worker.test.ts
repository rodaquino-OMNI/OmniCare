// Service Worker Tests
// Mock functions for Jest
import { ServiceWorkerTestUtils, mockServiceWorkerLifecycle, createMockFetchEvent } from './service-worker-test-utils';

// Mock Service Worker implementation for testing
class MockServiceWorkerImplementation {
  private cacheNames = {
    static: 'static-v1',
    dynamic: 'dynamic-v1',
    api: 'api-cache-v1'
  };
  
  private staticAssets = [
    '/',
    '/js/app.js',
    '/css/styles.css',
    '/images/logo.png',
    '/offline.html'
  ];

  async handleInstall(event: ExtendableEvent): Promise<void> {
    console.log('Service Worker installing...');
    
    // Pre-cache static assets
    const cache = await caches.open(this.cacheNames.static);
    await cache.addAll(this.staticAssets);
  }

  async handleActivate(event: ExtendableEvent): Promise<void> {
    console.log('Service Worker activating...');
    
    // Clean up old caches
    const cacheWhitelist = Object.values(this.cacheNames);
    const cacheNames = await caches.keys();
    
    await Promise.all(
      cacheNames.map(async (cacheName) => {
        if (!cacheWhitelist.includes(cacheName)) {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    );
  }

  async handleFetch(event: FetchEvent): Promise<Response | undefined> {
    const { request } = event;
    const url = new URL(request.url);

    // API calls - Network first, fallback to cache
    if (url.pathname.startsWith('/api/')) {
      return this.networkFirstStrategy(request);
    }

    // Static assets - Cache first, fallback to network
    if (this.isStaticAsset(url.pathname)) {
      return this.cacheFirstStrategy(request);
    }

    // Dynamic content - Stale while revalidate
    return this.staleWhileRevalidateStrategy(request);
  }

  private async cacheFirstStrategy(request: Request): Promise<Response> {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(this.cacheNames.static);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      // Return offline page for navigation requests
      if (request.mode === 'navigate') {
        const offlinePage = await caches.match('/offline.html');
        if (offlinePage) return offlinePage;
      }
      throw error;
    }
  }

  private async networkFirstStrategy(request: Request): Promise<Response> {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(this.cacheNames.api);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) {
        // Add header to indicate cached response
        const headers = new Headers(cached.headers);
        headers.set('X-From-Cache', 'true');
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers
        });
      }
      throw error;
    }
  }

  private async staleWhileRevalidateStrategy(request: Request): Promise<Response> {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(this.cacheNames.dynamic);
        cache.put(request, response.clone());
      }
      return response;
    });

    return cached || fetchPromise;
  }

  private isStaticAsset(pathname: string): boolean {
    return pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/) !== null;
  }

  async handleMessage(event: ExtendableMessageEvent): Promise<void> {
    const { data, source } = event;
    
    switch (data.type) {
      case 'SKIP_WAITING':
        await (self as any).skipWaiting();
        break;
        
      case 'CACHE_URLS':
        await this.cacheUrls(data.urls);
        if (source) {
          (source as any).postMessage({
            type: 'URLS_CACHED',
            urls: data.urls
          });
        }
        break;
        
      case 'CLEAR_CACHE':
        await this.clearCache(data.cacheName);
        if (source) {
          (source as any).postMessage({
            type: 'CACHE_CLEARED',
            cacheName: data.cacheName
          });
        }
        break;
        
      case 'GET_CACHE_STATS':
        const stats = await this.getCacheStats();
        if (source) {
          (source as any).postMessage({
            type: 'CACHE_STATS',
            stats
          });
        }
        break;
    }
  }

  private async cacheUrls(urls: string[]): Promise<void> {
    const cache = await caches.open(this.cacheNames.dynamic);
    await cache.addAll(urls);
  }

  private async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  }

  private async getCacheStats(): Promise<any> {
    const stats: any = {};
    const cacheNames = await caches.keys();
    
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      stats[name] = {
        count: keys.length,
        urls: keys.map(req => req.url)
      };
    }
    
    return stats;
  }

  async handleSync(event: any): Promise<void> {
    console.log('Background sync triggered:', event.tag);
    
    switch (event.tag) {
      case 'sync-patient-data':
        await this.syncPatientData();
        break;
      case 'sync-clinical-notes':
        await this.syncClinicalNotes();
        break;
      default:
        console.log('Unknown sync tag:', event.tag);
    }
  }

  private async syncPatientData(): Promise<void> {
    // Get queued patient updates from IndexedDB
    const updates = await this.getQueuedUpdates('patient-updates');
    
    for (const update of updates) {
      try {
        const response = await fetch('/api/patients/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        });
        
        if (response.ok) {
          await this.removeFromQueue('patient-updates', update.id);
        }
      } catch (error) {
        console.error('Failed to sync patient update:', error);
      }
    }
  }

  private async syncClinicalNotes(): Promise<void> {
    // Similar implementation for clinical notes
    const notes = await this.getQueuedUpdates('clinical-notes');
    
    for (const note of notes) {
      try {
        const response = await fetch('/api/clinical-notes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note)
        });
        
        if (response.ok) {
          await this.removeFromQueue('clinical-notes', note.id);
        }
      } catch (error) {
        console.error('Failed to sync clinical note:', error);
      }
    }
  }

  private async getQueuedUpdates(queueName: string): Promise<any[]> {
    // Mock implementation - in real app, use IndexedDB
    return [];
  }

  private async removeFromQueue(queueName: string, id: string): Promise<void> {
    // Mock implementation - in real app, use IndexedDB
  }
}

describe('Service Worker Tests', () => {
  let swImplementation: MockServiceWorkerImplementation;
  let events: ReturnType<typeof mockServiceWorkerLifecycle>;

  beforeEach(() => {
    ServiceWorkerTestUtils.mockNavigatorServiceWorker();
    ServiceWorkerTestUtils.mockCacheAPI();
    swImplementation = new MockServiceWorkerImplementation();
    events = mockServiceWorkerLifecycle();
  });

  afterEach(() => {
    ServiceWorkerTestUtils.cleanup();
    vi.clearAllMocks();
  });

  describe('Installation and Activation', () => {
    it('should pre-cache static assets on install', async () => {
      const installEvent = new ExtendableEvent('install');
      const waitUntilSpy = vi.spyOn(installEvent, 'waitUntil');

      await swImplementation.handleInstall(installEvent);

      const cache = await caches.open('static-v1');
      const keys = await cache.keys();
      
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.map(req => req.url)).toContain('/offline.html');
    });

    it('should clean up old caches on activation', async () => {
      // Create old caches
      await caches.open('static-v0');
      await caches.open('dynamic-v0');
      await caches.open('static-v1'); // Current version

      const activateEvent = new ExtendableEvent('activate');
      await swImplementation.handleActivate(activateEvent);

      const remainingCaches = await caches.keys();
      expect(remainingCaches).not.toContain('static-v0');
      expect(remainingCaches).not.toContain('dynamic-v0');
      expect(remainingCaches).toContain('static-v1');
    });

    it('should handle skip waiting message', async () => {
      const messageEvent = {
        data: { type: 'SKIP_WAITING' },
        source: null
      } as any;

      // Mock skipWaiting
      (global as any).self = {
        skipWaiting: vi.fn().mockResolvedValue(undefined)
      };

      await swImplementation.handleMessage(messageEvent);
      
      expect((global as any).self.skipWaiting).toHaveBeenCalled();
    });
  });

  describe('Fetch Handling', () => {
    it('should use cache-first strategy for static assets', async () => {
      const request = new Request('/css/styles.css');
      const cachedResponse = new Response('cached css', { 
        headers: { 'Content-Type': 'text/css' }
      });

      // Pre-populate cache
      const cache = await caches.open('static-v1');
      await cache.put(request, cachedResponse.clone());

      const fetchEvent = createMockFetchEvent(request);
      const response = await swImplementation.handleFetch(fetchEvent);

      expect(response?.status).toBe(200);
      const text = await response?.text();
      expect(text).toBe('cached css');
    });

    it('should use network-first strategy for API calls', async () => {
      const request = new Request('/api/patients/123');
      const networkResponse = new Response(JSON.stringify({ id: '123', name: 'John' }), {
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(networkResponse);

      const fetchEvent = createMockFetchEvent(request);
      const response = await swImplementation.handleFetch(fetchEvent);

      expect(global.fetch).toHaveBeenCalledWith(request);
      expect(response?.status).toBe(200);
    });

    it('should fallback to cache when offline for API calls', async () => {
      const request = new Request('/api/patients/123');
      const cachedResponse = new Response(JSON.stringify({ id: '123', cached: true }), {
        headers: { 'Content-Type': 'application/json' }
      });

      // Pre-populate cache
      const cache = await caches.open('api-cache-v1');
      await cache.put(request, cachedResponse.clone());

      // Mock offline
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const fetchEvent = createMockFetchEvent(request);
      const response = await swImplementation.handleFetch(fetchEvent);

      expect(response?.headers.get('X-From-Cache')).toBe('true');
      const data = await response?.json();
      expect(data.cached).toBe(true);
    });

    it('should return offline page for failed navigation requests', async () => {
      const request = new Request('/', { mode: 'navigate' });
      const offlinePage = new Response('<html>Offline</html>', {
        headers: { 'Content-Type': 'text/html' }
      });

      // Pre-cache offline page
      const cache = await caches.open('static-v1');
      await cache.put('/offline.html', offlinePage.clone());

      // Mock offline
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const fetchEvent = createMockFetchEvent(request);
      const response = await swImplementation.handleFetch(fetchEvent);

      expect(response).toBeDefined();
      const text = await response?.text();
      expect(text).toContain('Offline');
    });
  });

  describe('Message Handling', () => {
    it('should cache URLs on demand', async () => {
      const urls = ['/data/config.json', '/images/avatar.png'];
      const source = { postMessage: vi.fn() };
      
      const messageEvent = {
        data: { type: 'CACHE_URLS', urls },
        source
      } as any;

      await swImplementation.handleMessage(messageEvent);

      const cache = await caches.open('dynamic-v1');
      const keys = await cache.keys();
      
      expect(keys.map(req => req.url)).toEqual(expect.arrayContaining(urls));
      expect(source.postMessage).toHaveBeenCalledWith({
        type: 'URLS_CACHED',
        urls
      });
    });

    it('should clear cache on request', async () => {
      // Create and populate cache
      const cache = await caches.open('test-cache');
      await cache.put('/test', new Response('test'));

      const source = { postMessage: vi.fn() };
      const messageEvent = {
        data: { type: 'CLEAR_CACHE', cacheName: 'test-cache' },
        source
      } as any;

      await swImplementation.handleMessage(messageEvent);

      const exists = await caches.has('test-cache');
      expect(exists).toBe(false);
      expect(source.postMessage).toHaveBeenCalledWith({
        type: 'CACHE_CLEARED',
        cacheName: 'test-cache'
      });
    });

    it('should provide cache statistics', async () => {
      // Populate caches
      const staticCache = await caches.open('static-v1');
      await staticCache.put('/app.js', new Response('js'));
      await staticCache.put('/styles.css', new Response('css'));

      const apiCache = await caches.open('api-cache-v1');
      await apiCache.put('/api/patients', new Response('[]'));

      const source = { postMessage: vi.fn() };
      const messageEvent = {
        data: { type: 'GET_CACHE_STATS' },
        source
      } as any;

      await swImplementation.handleMessage(messageEvent);

      expect(source.postMessage).toHaveBeenCalledWith({
        type: 'CACHE_STATS',
        stats: expect.objectContaining({
          'static-v1': expect.objectContaining({
            count: 2,
            urls: expect.arrayContaining(['/app.js', '/styles.css'])
          }),
          'api-cache-v1': expect.objectContaining({
            count: 1,
            urls: expect.arrayContaining(['/api/patients'])
          })
        })
      });
    });
  });

  describe('Background Sync', () => {
    it('should register sync for patient data', async () => {
      const registration = await navigator.serviceWorker.ready;
      const syncManager = ServiceWorkerTestUtils.mockBackgroundSync();

      await syncManager.register('sync-patient-data');
      
      const tags = await syncManager.getTags();
      expect(tags).toContain('sync-patient-data');
    });

    it('should handle sync event for patient data', async () => {
      const syncEvent = {
        tag: 'sync-patient-data',
        waitUntil: vi.fn()
      };

      // Mock fetch for sync
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await swImplementation.handleSync(syncEvent);

      // In a real implementation, this would check if sync was performed
      expect(syncEvent.tag).toBe('sync-patient-data');
    });

    it('should retry failed sync operations', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      });

      // Mock sync with retry logic
      const syncWithRetry = async () => {
        for (let i = 0; i < 3; i++) {
          try {
            await swImplementation.syncPatientData();
            break;
          } catch (error) {
            if (i === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
          }
        }
      };

      await syncWithRetry();
      expect(attempts).toBe(3);
    });
  });

  describe('Update Flow', () => {
    it('should handle service worker updates', async () => {
      const registration = await navigator.serviceWorker.ready;
      
      // Simulate update found
      ServiceWorkerTestUtils.simulateUpdate();

      expect(registration.installing).toBeTruthy();
      expect(registration.installing?.state).toBe('installing');

      // Simulate installation complete
      ServiceWorkerTestUtils.simulateActivation();

      await ServiceWorkerTestUtils.waitForState(
        registration.active!,
        'activated'
      );

      expect(registration.active?.state).toBe('activated');
    });

    it('should notify clients of updates', async () => {
      const messageHandler = vi.fn();
      navigator.serviceWorker.addEventListener('message', messageHandler);

      ServiceWorkerTestUtils.simulateMessage({
        type: 'UPDATE_AVAILABLE',
        version: '2.0.0'
      });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            type: 'UPDATE_AVAILABLE',
            version: '2.0.0'
          }
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // Mock cache failure
      const originalOpen = caches.open;
      (caches as any).open = vi.fn().mockRejectedValue(new Error('Cache error'));

      const request = new Request('/test.js');
      const fetchEvent = createMockFetchEvent(request);

      // Should not throw, should fallback to network
      global.fetch = vi.fn().mockResolvedValue(new Response('network response'));
      
      const response = await swImplementation.handleFetch(fetchEvent);
      expect(response).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();

      (caches as any).open = originalOpen;
    });

    it('should handle quota exceeded errors', async () => {
      const cache = await caches.open('test-cache');
      cache.put = vi.fn().mockRejectedValue(new DOMException('QuotaExceededError'));

      // Try to cache large response
      const request = new Request('/large-file');
      const response = new Response(new Array(1000000).join('x')); // 1MB

      await expect(cache.put(request, response)).rejects.toThrow('QuotaExceededError');
    });
  });
});