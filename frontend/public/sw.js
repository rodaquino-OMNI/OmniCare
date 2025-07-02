/**
 * OmniCare Service Worker - Performance Optimized
 * Handles background sync, offline functionality, and performance caching
 */

const CACHE_VERSION = 'v1.2.0';
const STATIC_CACHE = `omnicare-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `omnicare-dynamic-${CACHE_VERSION}`;
const API_CACHE = `omnicare-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `omnicare-images-${CACHE_VERSION}`;

const SYNC_TAG = 'omnicare-sync';
const PERIODIC_SYNC_TAG = 'omnicare-periodic-sync';

// Performance configuration
const CACHE_STRATEGIES = {
  STATIC: 'cache-first',
  DYNAMIC: 'network-first',
  API: 'network-first-with-cache',
  IMAGES: 'cache-first-with-refresh'
};

const CACHE_DURATIONS = {
  STATIC: 24 * 60 * 60 * 1000, // 24 hours
  DYNAMIC: 30 * 60 * 1000,     // 30 minutes
  API: 5 * 60 * 1000,          // 5 minutes
  IMAGES: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/favicon.ico'
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/fhir\/Patient\?/,
  /\/api\/dashboard/,
  /\/api\/health/
];

// Performance metrics tracking
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  avgResponseTime: 0,
  lastOptimization: Date.now()
};

// Install event - cache critical resources with performance optimization
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker installing with performance optimizations');
  
  event.waitUntil(
    Promise.all([
      // Cache critical static resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Caching critical static resources');
        return cache.addAll(CRITICAL_RESOURCES);
      }),
      // Initialize other caches
      caches.open(DYNAMIC_CACHE),
      caches.open(API_CACHE),
      caches.open(IMAGE_CACHE)
    ]).then(() => {
      console.log('✅ All caches initialized');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches and optimize storage
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating and optimizing caches');
  
  event.waitUntil(
    Promise.all([
      // Clean up old cache versions
      caches.keys().then((cacheNames) => {
        const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE];
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Initialize performance tracking
      initializePerformanceTracking()
    ]).then(() => {
      console.log('✅ Cache optimization complete');
      self.clients.claim();
    })
  );
});

// Initialize performance tracking
async function initializePerformanceTracking() {
  try {
    const stored = await getStoredMetrics();
    if (stored) {
      performanceMetrics = { ...performanceMetrics, ...stored };
    }
  } catch (error) {
    console.warn('Failed to load stored performance metrics:', error);
  }
}

// Optimized fetch event with intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Route to appropriate caching strategy
  event.respondWith(handleRequest(request, url));
});

// Intelligent request handling with performance optimization
async function handleRequest(request, url) {
  const startTime = Date.now();
  
  try {
    let response;
    
    // Determine caching strategy based on request type
    if (isStaticResource(url)) {
      response = await handleStaticResource(request);
    } else if (isAPIRequest(url)) {
      response = await handleAPIRequest(request);
    } else if (isImageRequest(url)) {
      response = await handleImageRequest(request);
    } else {
      response = await handleDynamicResource(request);
    }
    
    // Track performance metrics
    updatePerformanceMetrics(startTime, response);
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    return handleFallback(request);
  }
}

// Cache-first strategy for static resources
async function handleStaticResource(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.STATIC)) {
    performanceMetrics.cacheHits++;
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    performanceMetrics.cacheMisses++;
    return cachedResponse || createErrorResponse();
  }
}

// Network-first strategy for API requests
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && isCacheableAPI(request.url)) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    // Fallback to cache if network fails
    const cachedResponse = await cache.match(request);
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.API)) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
    
    performanceMetrics.cacheMisses++;
    throw error;
  }
}

// Cache-first with background refresh for images
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    
    // Background refresh if expired
    if (isExpired(cachedResponse, CACHE_DURATIONS.IMAGES)) {
      fetch(request).then(response => {
        if (response.ok) {
          cache.put(request, response);
        }
      }).catch(() => {});
    }
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    performanceMetrics.cacheMisses++;
    return createErrorResponse();
  }
}

// Network-first for dynamic content
async function handleDynamicResource(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.DYNAMIC)) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
    
    performanceMetrics.cacheMisses++;
    return handleFallback(request);
  }
}

// Helper functions
function isStaticResource(url) {
  const staticExtensions = ['.js', '.css', '.woff2', '.woff', '.ttf', '.ico'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) || 
         url.pathname === '/' || url.pathname === '/manifest.json';
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => url.pathname.endsWith(ext));
}

function isCacheableAPI(url) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url));
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const responseTime = new Date(dateHeader).getTime();
  return (Date.now() - responseTime) > maxAge;
}

function createErrorResponse() {
  return new Response('Resource not available offline', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

function handleFallback(request) {
  if (request.mode === 'navigate') {
    return caches.match('/offline.html') || 
           caches.match('/') || 
           createErrorResponse();
  }
  return createErrorResponse();
}

function updatePerformanceMetrics(startTime, response) {
  const responseTime = Date.now() - startTime;
  const count = performanceMetrics.networkRequests + performanceMetrics.cacheHits;
  
  performanceMetrics.avgResponseTime = 
    (performanceMetrics.avgResponseTime * (count - 1) + responseTime) / count;
  
  // Store metrics periodically
  if (count % 50 === 0) {
    storeMetrics();
  }
}

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(performBackgroundSync());
  }
});

// Periodic background sync event (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync event:', event.tag);
  
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(performPeriodicSync());
  }
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SYNC_NOW':
      performBackgroundSync()
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;
      
    case 'REGISTER_PERIODIC_SYNC':
      registerPeriodicSync()
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Perform background sync
async function performBackgroundSync() {
  try {
    console.log('Performing background sync...');
    
    // Check if we're online
    if (!navigator.onLine) {
      console.log('Offline - skipping sync');
      return;
    }

    // Get pending sync operations from IndexedDB
    const db = await openSyncDatabase();
    const operations = await getPendingOperations(db);
    
    if (operations.length === 0) {
      console.log('No pending operations to sync');
      return;
    }

    console.log(`Syncing ${operations.length} operations`);
    
    // Process operations in batches
    const batchSize = 10;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      await processSyncBatch(batch);
    }
    
    console.log('Background sync completed successfully');
    
    // Notify clients about sync completion
    notifyClients('sync-completed', { operationsCount: operations.length });
    
  } catch (error) {
    console.error('Background sync failed:', error);
    
    // Notify clients about sync failure
    notifyClients('sync-failed', { error: error.message });
    
    // Re-throw to trigger retry
    throw error;
  }
}

// Perform periodic sync
async function performPeriodicSync() {
  try {
    console.log('Performing periodic sync...');
    
    // Check if there are pending changes
    const db = await openSyncDatabase();
    const pendingCount = await getPendingOperationsCount(db);
    
    if (pendingCount > 0) {
      await performBackgroundSync();
    }
    
    // Cleanup old data
    await cleanupOldData(db);
    
    console.log('Periodic sync completed');
    
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

// Register periodic background sync
async function registerPeriodicSync() {
  if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.periodicSync.register(PERIODIC_SYNC_TAG, {
        minInterval: 24 * 60 * 60 * 1000, // 24 hours
      });
      console.log('Periodic sync registered');
    } catch (error) {
      console.error('Failed to register periodic sync:', error);
    }
  } else {
    console.log('Periodic sync not supported');
  }
}

// Open sync database
function openSyncDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('omnicare-sync-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', { keyPath: 'id' });
        store.createIndex('resourceType', 'resourceType', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Performance metrics store
      if (!db.objectStoreNames.contains('performance-metrics')) {
        db.createObjectStore('performance-metrics');
      }
      
      // Auth cache store
      if (!db.objectStoreNames.contains('auth-cache')) {
        db.createObjectStore('auth-cache');
      }
    };
  });
}

// Get pending operations from database
async function getPendingOperations(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync-queue'], 'readonly');
    const store = transaction.objectStore('sync-queue');
    const operations = [];
    
    const request = store.openCursor();
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const operation = cursor.value;
        
        // Skip operations that are scheduled for future retry
        if (!operation.nextRetryAt || new Date() >= new Date(operation.nextRetryAt)) {
          operations.push(operation);
        }
        
        cursor.continue();
      } else {
        resolve(operations);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Get count of pending operations
async function getPendingOperationsCount(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync-queue'], 'readonly');
    const store = transaction.objectStore('sync-queue');
    
    const request = store.count();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Process a batch of sync operations
async function processSyncBatch(operations) {
  const syncRequest = {
    operations: operations.map(op => ({
      id: op.id,
      resourceType: op.resourceType,
      resourceId: op.resourceId,
      operation: op.operation,
      resource: op.resource,
      version: op.localVersion,
      timestamp: op.createdAt
    })),
    clientId: 'service-worker'
  };
  
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': await getAuthToken()
      },
      body: JSON.stringify(syncRequest)
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Remove successfully synced operations
    const db = await openSyncDatabase();
    const transaction = db.transaction(['sync-queue'], 'readwrite');
    const store = transaction.objectStore('sync-queue');
    
    for (const operation of operations) {
      const syncResult = result.data.operations.find(r => r.id === operation.id);
      if (syncResult && syncResult.success) {
        store.delete(operation.id);
      }
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
  } catch (error) {
    console.error('Failed to process sync batch:', error);
    throw error;
  }
}

// Enhanced authentication token handling with performance caching
async function getAuthToken() {
  try {
    // Check cache first
    if (self.cachedAuthToken && (Date.now() - self.tokenCacheTime) < 300000) { // 5 minutes
      return self.cachedAuthToken;
    }
    
    // Try to get token from IndexedDB first, then localStorage
    let token;
    try {
      const db = await openSyncDatabase();
      const transaction = db.transaction(['auth-cache'], 'readonly');
      const store = transaction.objectStore('auth-cache');
      const result = await new Promise((resolve) => {
        const request = store.get('authToken');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
      token = result?.token;
    } catch (dbError) {
      // Fallback to localStorage
      token = localStorage.getItem('authToken');
    }
    
    // Cache the token
    if (token) {
      self.cachedAuthToken = `Bearer ${token}`;
      self.tokenCacheTime = Date.now();
      return self.cachedAuthToken;
    }
    
    return '';
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return '';
  }
}

// Store performance metrics
async function storeMetrics() {
  try {
    const metricsData = {
      ...performanceMetrics,
      timestamp: Date.now()
    };
    
    // Store in IndexedDB for persistence
    const db = await openSyncDatabase();
    const transaction = db.transaction(['performance-metrics'], 'readwrite');
    const store = transaction.objectStore('performance-metrics');
    await store.put(metricsData, 'current');
    
    console.log('📊 Performance metrics stored:', metricsData);
  } catch (error) {
    console.error('Failed to store performance metrics:', error);
  }
}

// Get stored performance metrics
async function getStoredMetrics() {
  try {
    const db = await openSyncDatabase();
    const transaction = db.transaction(['performance-metrics'], 'readonly');
    const store = transaction.objectStore('performance-metrics');
    const result = await new Promise((resolve) => {
      const request = store.get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    
    return result;
  } catch (error) {
    console.error('Failed to get stored metrics:', error);
    return null;
  }
}

// Cleanup old data
async function cleanupOldData(db) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago
  
  // TODO: Implement cleanup logic for old sync operations and conflicts
  console.log('Cleanup old data (not implemented)');
}

// Notify all clients
function notifyClients(type, data) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, data });
    });
  });
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event.data?.text());
  
  // TODO: Handle push notifications for sync updates
});

// Handle notification clicks (for future use)
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  // TODO: Handle notification clicks
});