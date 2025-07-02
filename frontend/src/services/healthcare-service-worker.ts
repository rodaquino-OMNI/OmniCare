/**
 * Healthcare-Optimized Service Worker for OmniCare EMR
 * Provides advanced offline capabilities with FHIR resource caching,
 * background sync, and encryption support
 */

/// <reference lib="webworker" />

import { EncryptedData } from './encryption.service';

declare const self: ServiceWorkerGlobalScope;

// Configuration constants
const CACHE_VERSION = 'v2.0.0';
const CACHE_PREFIX = 'omnicare';
const CACHES = {
  STATIC: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  DYNAMIC: `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  FHIR: `${CACHE_PREFIX}-fhir-${CACHE_VERSION}`,
  IMAGES: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
  OFFLINE: `${CACHE_PREFIX}-offline-${CACHE_VERSION}`
};

// Sync tags
const SYNC_TAGS = {
  IMMEDIATE: 'omnicare-sync-immediate',
  PERIODIC: 'omnicare-sync-periodic',
  BATCH: 'omnicare-sync-batch',
  CRITICAL: 'omnicare-sync-critical'
};

// Cache strategies
enum CacheStrategy {
  NetworkFirst = 'network-first',
  CacheFirst = 'cache-first',
  NetworkOnly = 'network-only',
  CacheOnly = 'cache-only',
  StaleWhileRevalidate = 'stale-while-revalidate'
}

// Resource priorities for offline caching
interface ResourcePriority {
  pattern: RegExp;
  strategy: CacheStrategy;
  cacheName: string;
  maxAge?: number;
  maxItems?: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const RESOURCE_PRIORITIES: ResourcePriority[] = [
  // Critical patient data
  {
    pattern: /\/api\/fhir\/Patient/,
    strategy: CacheStrategy.NetworkFirst,
    cacheName: CACHES.FHIR,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    priority: 'critical'
  },
  // Encounter data
  {
    pattern: /\/api\/fhir\/Encounter/,
    strategy: CacheStrategy.NetworkFirst,
    cacheName: CACHES.FHIR,
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    priority: 'high'
  },
  // Observations (vitals, labs)
  {
    pattern: /\/api\/fhir\/Observation/,
    strategy: CacheStrategy.StaleWhileRevalidate,
    cacheName: CACHES.FHIR,
    maxAge: 6 * 60 * 60 * 1000, // 6 hours
    priority: 'high'
  },
  // Medication data
  {
    pattern: /\/api\/fhir\/MedicationRequest/,
    strategy: CacheStrategy.NetworkFirst,
    cacheName: CACHES.FHIR,
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    priority: 'high'
  },
  // Static assets
  {
    pattern: /\.(js|css|woff2?|ttf|eot)$/,
    strategy: CacheStrategy.CacheFirst,
    cacheName: CACHES.STATIC,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    priority: 'low'
  },
  // Images
  {
    pattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
    strategy: CacheStrategy.CacheFirst,
    cacheName: CACHES.IMAGES,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    priority: 'low'
  }
];

// Offline queue for failed requests
interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retries: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  resourceType?: string;
}

class OfflineQueue {
  private readonly DB_NAME = 'omnicare-offline-queue';
  private readonly STORE_NAME = 'requests';
  private db?: IDBDatabase;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('priority', 'priority');
        }
      };
    });
  }

  async add(request: QueuedRequest): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const addRequest = store.add(request);
      
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    });
  }

  async getAll(): Promise<QueuedRequest[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('priority');
      const request = index.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }
}

// Initialize offline queue
const offlineQueue = new OfflineQueue();

// Critical resources to cache on install
const CRITICAL_RESOURCES = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

// Install event - cache critical resources
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('🚀 Healthcare Service Worker installing');
  
  event.waitUntil(
    Promise.all([
      // Initialize offline queue
      offlineQueue.init(),
      
      // Cache critical resources
      caches.open(CACHES.STATIC).then(cache => {
        console.log('📦 Caching critical resources');
        return cache.addAll(CRITICAL_RESOURCES);
      }),
      
      // Pre-cache offline fallback page
      caches.open(CACHES.OFFLINE).then(cache => {
        return fetch('/offline.html').then(response => {
          return cache.put('/offline.html', response);
        });
      })
    ]).then(() => {
      console.log('✅ Service Worker installation complete');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('🔄 Healthcare Service Worker activating');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        const currentCaches = Object.values(CACHES);
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith(CACHE_PREFIX) && !currentCaches.includes(name))
            .map(name => {
              console.log('🗑️ Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activation complete');
    })
  );
});

// Fetch event - implement intelligent caching strategies
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and non-HTTP(S) URLs
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine caching strategy
  const priority = getResourcePriority(url);
  
  if (priority) {
    event.respondWith(
      handleRequest(request, priority).then(response => 
        response || new Response('Request failed', { status: 500 })
      )
    );
  } else {
    // Default strategy for unmatched requests
    event.respondWith(
      fetch(request).catch(() => {
        // Fallback to offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/offline.html') || new Response('Offline', { status: 503 });
        }
        return new Response('Network error', { status: 503 });
      })
    );
  }
});

// Background sync event
self.addEventListener('sync', (event: any) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.IMMEDIATE:
      event.waitUntil(performImmediateSync());
      break;
      
    case SYNC_TAGS.PERIODIC:
      event.waitUntil(performPeriodicSync());
      break;
      
    case SYNC_TAGS.BATCH:
      event.waitUntil(performBatchSync());
      break;
      
    case SYNC_TAGS.CRITICAL:
      event.waitUntil(performCriticalSync());
      break;
      
    default:
      console.log('Unknown sync tag:', event.tag);
  }
});

// Message handling for communication with main thread
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'QUEUE_REQUEST':
      event.waitUntil(
        queueFailedRequest(payload).then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
      
    case 'SYNC_NOW':
      event.waitUntil(
        performImmediateSync().then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        clearCaches(payload.cacheNames).then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
      
    case 'GET_CACHE_STATS':
      event.waitUntil(
        getCacheStatistics().then(stats => {
          event.ports[0].postMessage({ success: true, data: stats });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
  }
});

// Helper functions

function getResourcePriority(url: URL): ResourcePriority | null {
  const pathname = url.pathname;
  
  for (const priority of RESOURCE_PRIORITIES) {
    if (priority.pattern.test(pathname)) {
      return priority;
    }
  }
  
  return null;
}

async function handleRequest(request: Request, priority: ResourcePriority): Promise<Response> {
  switch (priority.strategy) {
    case CacheStrategy.NetworkFirst:
      return networkFirst(request, priority);
      
    case CacheStrategy.CacheFirst:
      return cacheFirst(request, priority);
      
    case CacheStrategy.StaleWhileRevalidate:
      return staleWhileRevalidate(request, priority);
      
    case CacheStrategy.NetworkOnly:
      return networkOnly(request);
      
    case CacheStrategy.CacheOnly:
      return cacheOnly(request, priority);
      
    default:
      return fetch(request);
  }
}

async function networkFirst(request: Request, priority: ResourcePriority): Promise<Response> {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(priority.cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    
    if (cached && isResponseFresh(cached, priority.maxAge)) {
      return cached;
    }
    
    // Queue for later sync if it's a critical resource
    if (priority.priority === 'critical' || priority.priority === 'high') {
      await queueFailedRequest({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        priority: priority.priority
      });
    }
    
    throw error;
  }
}

async function cacheFirst(request: Request, priority: ResourcePriority): Promise<Response> {
  const cached = await caches.match(request);
  
  if (cached && isResponseFresh(cached, priority.maxAge)) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(priority.cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request: Request, priority: ResourcePriority): Promise<Response> {
  const cached = await caches.match(request);
  
  // Return cached immediately if available
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(priority.cacheName);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  });
  
  return cached || fetchPromise;
}

async function networkOnly(request: Request): Promise<Response> {
  return fetch(request);
}

async function cacheOnly(request: Request, priority: ResourcePriority): Promise<Response> {
  const cached = await caches.match(request);
  
  if (!cached) {
    throw new Error('Resource not available in cache');
  }
  
  return cached;
}

function isResponseFresh(response: Response, maxAge?: number): boolean {
  if (!maxAge) return true;
  
  const date = response.headers.get('date');
  if (!date) return false;
  
  const age = Date.now() - new Date(date).getTime();
  return age < maxAge;
}

async function queueFailedRequest(request: Partial<QueuedRequest>): Promise<void> {
  const queuedRequest: QueuedRequest = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    url: request.url || '',
    method: request.method || 'GET',
    headers: request.headers || {},
    body: request.body,
    timestamp: Date.now(),
    retries: 0,
    priority: request.priority || 'medium',
    resourceType: extractResourceType(request.url || '')
  };
  
  await offlineQueue.add(queuedRequest);
  
  // Try to register sync
  if ('sync' in self.registration && self.registration.sync) {
    try {
      await self.registration.sync.register(SYNC_TAGS.IMMEDIATE);
    } catch (error) {
      console.error('Failed to register sync:', error);
    }
  }
}

function extractResourceType(url: string): string | undefined {
  const match = url.match(/\/api\/fhir\/(\w+)/);
  return match ? match[1] : undefined;
}

async function performImmediateSync(): Promise<void> {
  console.log('Performing immediate sync...');
  
  const requests = await offlineQueue.getAll();
  const priorityRequests = requests
    .filter(r => r.priority === 'critical' || r.priority === 'high')
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  
  for (const request of priorityRequests) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      if (response.ok) {
        await offlineQueue.remove(request.id);
        notifyClients('sync-success', { request });
      } else {
        throw new Error(`Request failed: ${response.status}`);
      }
    } catch (error) {
      request.retries++;
      
      if (request.retries >= 3) {
        await offlineQueue.remove(request.id);
        notifyClients('sync-failed', { request, error });
      }
    }
  }
}

async function performPeriodicSync(): Promise<void> {
  console.log('Performing periodic sync...');
  
  // Clean up old cached data
  await cleanupOldCaches();
  
  // Process all queued requests
  const requests = await offlineQueue.getAll();
  
  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      if (response.ok) {
        await offlineQueue.remove(request.id);
      }
    } catch (error) {
      // Keep in queue for next sync
      console.error('Sync failed for request:', request.id, error);
    }
  }
}

async function performBatchSync(): Promise<void> {
  console.log('Performing batch sync...');
  
  const requests = await offlineQueue.getAll();
  
  // Group requests by resource type
  const grouped = requests.reduce((acc, req) => {
    const type = req.resourceType || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(req);
    return acc;
  }, {} as Record<string, QueuedRequest[]>);
  
  // Process each group
  for (const [type, typeRequests] of Object.entries(grouped)) {
    try {
      // Create batch request
      const batchResponse = await fetch('/api/fhir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          ...typeRequests[0].headers
        },
        body: JSON.stringify({
          resourceType: 'Bundle',
          type: 'batch',
          entry: typeRequests.map(req => ({
            request: {
              method: req.method,
              url: req.url.replace(/^.*\/api\/fhir\//, '')
            },
            resource: req.body ? JSON.parse(req.body) : undefined
          }))
        })
      });
      
      if (batchResponse.ok) {
        // Remove successful requests
        for (const req of typeRequests) {
          await offlineQueue.remove(req.id);
        }
      }
    } catch (error) {
      console.error(`Batch sync failed for ${type}:`, error);
    }
  }
}

async function performCriticalSync(): Promise<void> {
  console.log('Performing critical sync...');
  
  const requests = await offlineQueue.getAll();
  const criticalRequests = requests.filter(r => r.priority === 'critical');
  
  for (const request of criticalRequests) {
    let success = false;
    let lastError;
    
    // Retry critical requests up to 5 times with exponential backoff
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        if (response.ok) {
          await offlineQueue.remove(request.id);
          success = true;
          break;
        }
        
        lastError = new Error(`Request failed: ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      
      // Exponential backoff
      if (i < 4) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    
    if (!success) {
      notifyClients('critical-sync-failed', { request, error: lastError });
    }
  }
}

async function cleanupOldCaches(): Promise<void> {
  const now = Date.now();
  
  for (const [cacheName, cache] of Object.entries(CACHES)) {
    const cacheObj = await caches.open(cacheName);
    const requests = await cacheObj.keys();
    
    for (const request of requests) {
      const response = await cacheObj.match(request);
      
      if (response) {
        const priority = getResourcePriority(new URL(request.url));
        
        if (priority && priority.maxAge && !isResponseFresh(response, priority.maxAge)) {
          await cacheObj.delete(request);
        }
      }
    }
  }
}

async function clearCaches(cacheNames?: string[]): Promise<void> {
  const namesToClear = cacheNames || Object.values(CACHES);
  
  await Promise.all(
    namesToClear.map(name => caches.delete(name))
  );
}

async function getCacheStatistics(): Promise<any> {
  const stats: any = {
    caches: {},
    totalSize: 0,
    itemCount: 0
  };
  
  for (const [name, cacheName] of Object.entries(CACHES)) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    stats.caches[name] = {
      itemCount: keys.length,
      urls: keys.map(k => k.url)
    };
    
    stats.itemCount += keys.length;
  }
  
  // Get storage estimate if available
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    stats.usage = estimate.usage;
    stats.quota = estimate.quota;
  }
  
  return stats;
}

function notifyClients(type: string, data: any): void {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: `sw-${type}`, data });
    });
  });
}

// Export for TypeScript
export {};