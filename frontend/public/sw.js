/**
 * OmniCare Service Worker
 * Handles background sync and offline functionality
 */

const CACHE_NAME = 'omnicare-v1';
const SYNC_TAG = 'omnicare-sync';
const PERIODIC_SYNC_TAG = 'omnicare-periodic-sync';

// URLs to cache for offline functionality
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cache for API requests (except health checks)
  if (request.url.includes('/api/') && !request.url.includes('/health')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Return a fallback page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

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

// Get authentication token
async function getAuthToken() {
  // Try to get token from IndexedDB or localStorage
  // This is a simplified implementation
  try {
    const token = localStorage.getItem('authToken');
    return token ? `Bearer ${token}` : '';
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return '';
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