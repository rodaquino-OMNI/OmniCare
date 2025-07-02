/**
 * Test Cleanup Utilities
 * Prevents memory leaks and worker crashes by ensuring proper resource cleanup
 */

const { cleanup: rtlCleanup } = require('@testing-library/react');

/**
 * Track active timers for cleanup
 */
const activeTimers = new Set();
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;

// Override timer functions to track them
global.setTimeout = function(callback, delay, ...args) {
  const timerId = originalSetTimeout.call(this, () => {
    activeTimers.delete(timerId);
    callback(...args);
  }, delay);
  activeTimers.add(timerId);
  return timerId;
};

global.setInterval = function(callback, delay, ...args) {
  const timerId = originalSetInterval.call(this, callback, delay, ...args);
  activeTimers.add(timerId);
  return timerId;
};

/**
 * Clean up all active timers
 */
const cleanupTimers = () => {
  activeTimers.forEach(timerId => {
    clearTimeout(timerId);
    clearInterval(timerId);
  });
  activeTimers.clear();
};

/**
 * Clean up IndexedDB databases
 */
const cleanupIndexedDB = async () => {
  if (typeof indexedDB === 'undefined') return;
  
  try {
    const databases = await indexedDB.databases?.() || [];
    await Promise.all(
      databases.map(db => indexedDB.deleteDatabase(db.name))
    );
  } catch (error) {
    console.warn('Failed to cleanup IndexedDB:', error);
  }
};

/**
 * Clean up localStorage and sessionStorage
 */
const cleanupStorage = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (error) {
    console.warn('Failed to cleanup storage:', error);
  }
};

/**
 * Clean up fetch mocks
 */
const cleanupFetchMocks = () => {
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
    global.fetch.mockReset();
  }
};

/**
 * Clean up console mocks
 */
const cleanupConsoleMocks = () => {
  ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
    if (console[method] && typeof console[method].mockClear === 'function') {
      console[method].mockClear();
    }
  });
};

/**
 * Clean up DOM mutations and event listeners
 */
const cleanupDOM = () => {
  if (typeof document === 'undefined') return;
  
  // Remove all event listeners from body
  const body = document.body;
  if (body) {
    const newBody = body.cloneNode(true);
    body.parentNode.replaceChild(newBody, body);
  }
  
  // Clear any remaining DOM content
  document.body.innerHTML = '';
  document.head.innerHTML = '';
};

/**
 * Clean up service worker registrations
 */
const cleanupServiceWorkers = async () => {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(registration => registration.unregister())
    );
  } catch (error) {
    console.warn('Failed to cleanup service workers:', error);
  }
};

/**
 * Force garbage collection if available
 */
const forceGarbageCollection = () => {
  if (global.gc && typeof global.gc === 'function') {
    global.gc();
  }
};

/**
 * Comprehensive cleanup function for tests
 * Call this in afterEach hooks to prevent memory leaks
 */
const cleanup = async () => {
  // Clean up React components
  if (typeof rtlCleanup === 'function') {
    rtlCleanup();
  }
  
  // Clean up all resources
  cleanupTimers();
  cleanupFetchMocks();
  cleanupConsoleMocks();
  cleanupStorage();
  cleanupDOM();
  
  // Async cleanup
  await cleanupIndexedDB();
  await cleanupServiceWorkers();
  
  // Clear all Jest mocks
  if (typeof jest !== 'undefined') {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  }
  
  // Force garbage collection
  forceGarbageCollection();
  
  // Wait for any pending microtasks
  await new Promise(resolve => setImmediate(resolve));
};

/**
 * Setup global error handlers for tests
 */
const setupErrorHandlers = () => {
  const unhandledRejections = new Map();
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    unhandledRejections.set(promise, reason);
  });
  
  process.on('rejectionHandled', (promise) => {
    unhandledRejections.delete(promise);
  });
  
  // Return cleanup function
  return () => {
    if (unhandledRejections.size > 0) {
      const errors = Array.from(unhandledRejections.values());
      unhandledRejections.clear();
      throw new Error(`Unhandled promise rejections: ${errors.join(', ')}`);
    }
  };
};

/**
 * Monitor memory usage during tests
 */
const memoryMonitor = {
  initialMemory: null,
  
  start() {
    if (process.memoryUsage) {
      this.initialMemory = process.memoryUsage();
    }
  },
  
  check(testName) {
    if (!this.initialMemory || !process.memoryUsage) return;
    
    const currentMemory = process.memoryUsage();
    const heapUsedDiff = currentMemory.heapUsed - this.initialMemory.heapUsed;
    
    // Warn if memory usage increased by more than 50MB
    if (heapUsedDiff > 50 * 1024 * 1024) {
      console.warn(`⚠️  High memory usage in test "${testName}": +${Math.round(heapUsedDiff / 1024 / 1024)}MB`);
    }
  },
  
  reset() {
    this.initialMemory = null;
  }
};

/**
 * Wrapper for test functions with automatic cleanup
 */
const withCleanup = (testFn) => {
  return async (...args) => {
    memoryMonitor.start();
    const cleanupErrorHandler = setupErrorHandlers();
    
    try {
      await testFn(...args);
    } finally {
      await cleanup();
      cleanupErrorHandler();
      memoryMonitor.check(testFn.name || 'anonymous');
      memoryMonitor.reset();
    }
  };
};

/**
 * Enhanced afterEach with comprehensive cleanup
 */
const setupCleanupHooks = () => {
  if (typeof afterEach === 'function') {
    afterEach(async () => {
      await cleanup();
    });
  }
  
  if (typeof afterAll === 'function') {
    afterAll(async () => {
      await cleanup();
      forceGarbageCollection();
    });
  }
};

module.exports = {
  cleanup,
  cleanupTimers,
  cleanupIndexedDB,
  cleanupStorage,
  cleanupFetchMocks,
  cleanupConsoleMocks,
  cleanupDOM,
  cleanupServiceWorkers,
  forceGarbageCollection,
  setupErrorHandlers,
  memoryMonitor,
  withCleanup,
  setupCleanupHooks,
};