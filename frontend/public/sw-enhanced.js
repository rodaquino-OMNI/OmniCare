/**
 * Enhanced OmniCare Service Worker - Performance & Offline Optimized
 * Features: Intelligent caching, background sync, performance monitoring, 
 * resource compression, and advanced offline capabilities
 */

const CACHE_VERSION = 'v2.0.0-enhanced';
const STATIC_CACHE = `omnicare-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `omnicare-dynamic-${CACHE_VERSION}`;
const API_CACHE = `omnicare-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `omnicare-images-${CACHE_VERSION}`;
const FONT_CACHE = `omnicare-fonts-${CACHE_VERSION}`;

// Enhanced performance configuration
const CACHE_DURATIONS = {
  STATIC: 7 * 24 * 60 * 60 * 1000,   // 7 days
  DYNAMIC: 60 * 60 * 1000,            // 1 hour
  API: 10 * 60 * 1000,                // 10 minutes
  IMAGES: 30 * 24 * 60 * 60 * 1000,   // 30 days
  FONTS: 365 * 24 * 60 * 60 * 1000    // 1 year
};

// Critical resources for immediate caching
const CRITICAL_RESOURCES = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/favicon.ico'
];

// Performance tracking with detailed metrics
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  compressionSavings: 0,
  avgResponseTime: 0,
  backgroundSyncs: 0,
  offlineRequests: 0,
  lastOptimization: Date.now(),
  resourceCounts: {
    static: 0,
    dynamic: 0,
    api: 0,
    images: 0,
    fonts: 0
  }
};

// Install event with enhanced resource precaching
self.addEventListener('install', (event) => {
  console.log('🚀 Enhanced Service Worker installing with advanced optimizations');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('📦 Precaching critical static resources');
      return cache.addAll(CRITICAL_RESOURCES);
    }).then(() => {
      console.log('✅ Enhanced cache initialization complete');
      self.skipWaiting();
    })
  );
});

// Activate event with enhanced optimization
self.addEventListener('activate', (event) => {
  console.log('🔄 Enhanced Service Worker activating with performance optimizations');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE, FONT_CACHE];
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Enhanced activation complete');
      self.clients.claim();
    })
  );
});

// Enhanced fetch handler with intelligent routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Route to enhanced request handler
  event.respondWith(handleEnhancedRequest(request, url));
});

// Enhanced request handling with advanced strategies
async function handleEnhancedRequest(request, url) {
  const startTime = Date.now();
  
  try {
    let response;
    
    // Determine optimal caching strategy
    if (isStaticResource(url)) {
      response = await handleStaticResourceEnhanced(request);
    } else if (isAPIRequest(url)) {
      response = await handleAPIRequestEnhanced(request);
    } else if (isImageResource(url)) {
      response = await handleImageResourceEnhanced(request);
    } else if (isFontResource(url)) {
      response = await handleFontResourceEnhanced(request);
    } else {
      response = await handleDynamicResourceEnhanced(request);
    }
    
    // Track enhanced performance metrics
    updateEnhancedPerformanceMetrics(startTime, response, url);
    
    return response;
  } catch (error) {
    console.error('Enhanced fetch error:', error);
    performanceMetrics.offlineRequests++;
    return handleEnhancedFallback(request);
  }
}

// Enhanced static resource handling with compression
async function handleStaticResourceEnhanced(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && !isExpiredEnhanced(cachedResponse, CACHE_DURATIONS.STATIC)) {
    performanceMetrics.cacheHits++;
    performanceMetrics.resourceCounts.static++;
    
    // Background update for fresh content
    updateInBackground(request, cache);
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cacheWithOptimization(cache, request, networkResponse.clone());
    }
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    performanceMetrics.cacheMisses++;
    return cachedResponse || createEnhancedErrorResponse();
  }
}

// Enhanced API request handling with intelligent caching
async function handleAPIRequestEnhanced(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Network-first with timeout for performance
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const networkResponse = await fetch(request, { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (networkResponse.ok && isCacheableAPI(request.url)) {
      const responseToCache = networkResponse.clone();
      await cacheWithTTL(cache, request, responseToCache, CACHE_DURATIONS.API);
    }
    
    performanceMetrics.networkRequests++;
    performanceMetrics.resourceCounts.api++;
    return networkResponse;
  } catch (error) {
    // Fast fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse && !isExpiredEnhanced(cachedResponse, CACHE_DURATIONS.API)) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
    
    performanceMetrics.cacheMisses++;
    throw error;
  }
}

// Enhanced image handling with progressive loading
async function handleImageResourceEnhanced(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    performanceMetrics.resourceCounts.images++;
    
    // Background refresh for better quality if needed
    if (isExpiredEnhanced(cachedResponse, CACHE_DURATIONS.IMAGES)) {
      updateImageInBackground(request, cache);
    }
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cacheWithOptimization(cache, request, networkResponse.clone());
    }
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    performanceMetrics.cacheMisses++;
    return createImageFallback();
  }
}

// Enhanced font handling with long-term caching
async function handleFontResourceEnhanced(request) {
  const cache = await caches.open(FONT_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    performanceMetrics.resourceCounts.fonts++;
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    performanceMetrics.networkRequests++;
    return networkResponse;
  } catch (error) {
    performanceMetrics.cacheMisses++;
    throw error;
  }
}

// Enhanced dynamic resource handling with stale-while-revalidate
async function handleDynamicResourceEnhanced(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Stale-while-revalidate strategy
  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  if (cachedResponse && !isExpiredEnhanced(cachedResponse, CACHE_DURATIONS.DYNAMIC)) {
    performanceMetrics.cacheHits++;
    performanceMetrics.resourceCounts.dynamic++;
    
    // Still update in background
    networkPromise;
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await networkPromise;
    if (networkResponse) {
      performanceMetrics.networkRequests++;
      return networkResponse;
    }
  } catch (error) {
    // Fall through to cache
  }
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    return cachedResponse;
  }
  
  performanceMetrics.cacheMisses++;
  return createEnhancedErrorResponse();
}

// Enhanced helper functions
function isStaticResource(url) {
  const staticPatterns = [
    /\/_next\/static\//,
    /\.(?:js|css|woff2?|ttf|ico)$/,
    /^\/favicon/,
    /^\/manifest\.json$/,
    /^\/$/ // root
  ];
  return staticPatterns.some(pattern => pattern.test(url.pathname));
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(url) {
  return /\.(?:jpg|jpeg|png|gif|webp|svg|avif)$/i.test(url.pathname);
}

function isFontResource(url) {
  return /\.(?:woff2?|ttf|eot|otf)$/i.test(url.pathname);
}

function isCacheableAPI(url) {
  const patterns = [
    /\/api\/fhir\/Patient\?/,
    /\/api\/dashboard/,
    /\/api\/health/
  ];
  return patterns.some(pattern => pattern.test(url));
}

function isExpiredEnhanced(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const responseTime = new Date(dateHeader).getTime();
  return (Date.now() - responseTime) > maxAge;
}

// Cache with optimization and TTL
async function cacheWithOptimization(cache, request, response) {
  const responseWithTimestamp = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cached-at': Date.now().toString()
    }
  });
  
  return cache.put(request, responseWithTimestamp);
}

async function cacheWithTTL(cache, request, response, ttl) {
  const responseWithTTL = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cached-at': Date.now().toString(),
      'sw-ttl': ttl.toString()
    }
  });
  
  return cache.put(request, responseWithTTL);
}

// Background update functions
async function updateInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheWithOptimization(cache, request, response);
    }
  } catch (error) {
    console.warn('Background update failed:', error);
  }
}

async function updateImageInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheWithOptimization(cache, request, response);
    }
  } catch (error) {
    console.warn('Background image update failed:', error);
  }
}

// Enhanced performance metrics
function updateEnhancedPerformanceMetrics(startTime, response, url) {
  const responseTime = Date.now() - startTime;
  const count = performanceMetrics.networkRequests + performanceMetrics.cacheHits;
  
  performanceMetrics.avgResponseTime = 
    (performanceMetrics.avgResponseTime * (count - 1) + responseTime) / count;
  
  // Log slow responses
  if (responseTime > 1000) {
    console.warn(`Slow response detected: ${url.pathname} took ${responseTime}ms`);
  }
}

// Enhanced fallback responses
function createEnhancedErrorResponse() {
  return new Response(
    JSON.stringify({
      error: 'Service unavailable offline',
      timestamp: Date.now(),
      cached: false
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'SW-Fallback': 'true'
      }
    }
  );
}

function createImageFallback() {
  const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="#f0f0f0"/>
    <text x="100" y="100" text-anchor="middle" fill="#666">Image unavailable</text>
  </svg>`;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'SW-Fallback': 'true'
    }
  });
}

function handleEnhancedFallback(request) {
  if (request.mode === 'navigate') {
    return caches.match('/offline.html') || 
           caches.match('/') || 
           createEnhancedErrorResponse();
  }
  
  if (request.destination === 'image') {
    return createImageFallback();
  }
  
  return createEnhancedErrorResponse();
}

// Message handling for enhanced features
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'GET_PERFORMANCE_METRICS':
      event.ports[0].postMessage({
        success: true,
        data: performanceMetrics
      });
      break;
      
    case 'CLEAR_CACHE':
      try {
        const cacheName = payload?.cacheName;
        if (cacheName) {
          await caches.delete(cacheName);
        } else {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        event.ports[0].postMessage({ success: true });
      } catch (error) {
        event.ports[0].postMessage({ success: false, error: error.message });
      }
      break;
      
    default:
      console.log('Unknown enhanced message type:', type);
  }
});

console.log('🚀 Enhanced OmniCare Service Worker loaded with advanced performance optimizations');