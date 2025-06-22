/**
 * Environment Setup for Frontend Tests
 * Configures test environment variables and global settings for React/Next.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.test' });

// Set required test environment variables
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_ENV = 'test';
process.env.TZ = 'UTC';

// API Configuration for tests
process.env.NEXT_PUBLIC_API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3001/api';
process.env.NEXT_PUBLIC_FHIR_BASE_URL = process.env.TEST_FHIR_BASE_URL || 'http://localhost:8080/fhir/R4';

// Authentication configuration for tests
process.env.NEXT_PUBLIC_AUTH_DOMAIN = 'test.omnicare.com';
process.env.NEXT_PUBLIC_AUTH_CLIENT_ID = 'test_client_id';

// Feature flags for tests
process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE = 'true';
process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER = 'false'; // Disable in tests
process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'false';
process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING = 'false';

// Mock external services
process.env.NEXT_PUBLIC_MOCK_EXTERNAL_SERVICES = 'true';

// Performance settings for tests
process.env.NEXT_PUBLIC_MAX_CACHE_SIZE = '50MB';
process.env.NEXT_PUBLIC_CACHE_TTL = '300';

// Testing specific settings
process.env.JEST_TIMEOUT = '15000';
process.env.SKIP_PREFLIGHT_CHECK = 'true';

// Disable telemetry and analytics in tests
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DISABLE_TELEMETRY = 'true';

// Set locale for consistent test results
process.env.LANG = 'en_US.UTF-8';
process.env.LC_ALL = 'en_US.UTF-8';

// Global polyfills for JSDOM environment
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
global.crypto = require('crypto').webcrypto;

// Mock window.location for Next.js
delete window.location;
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  toString: () => 'http://localhost:3000',
};

// Mock window.history
Object.defineProperty(window, 'history', {
  writable: true,
  value: {
    length: 1,
    action: 'POP',
    location: window.location,
    createHref: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    block: jest.fn(),
    listen: jest.fn(),
  },
});

// Mock IndexedDB for offline functionality tests
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

// Mock Service Worker
global.navigator.serviceWorker = {
  register: jest.fn(() => Promise.resolve({
    installing: null,
    waiting: null,
    active: {
      scriptURL: 'http://localhost:3000/sw.js',
      state: 'activated',
    },
    update: jest.fn(() => Promise.resolve()),
    unregister: jest.fn(() => Promise.resolve(true)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  ready: Promise.resolve({
    installing: null,
    waiting: null,
    active: {
      scriptURL: 'http://localhost:3000/sw.js',
      state: 'activated',
    },
    update: jest.fn(() => Promise.resolve()),
    unregister: jest.fn(() => Promise.resolve(true)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }),
  controller: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getRegistrations: jest.fn(() => Promise.resolve([])),
  getRegistration: jest.fn(() => Promise.resolve(undefined)),
};

// Mock Notification API
global.Notification = {
  permission: 'granted',
  requestPermission: jest.fn(() => Promise.resolve('granted')),
};

// Mock geolocation
global.navigator.geolocation = {
  getCurrentPosition: jest.fn((success) => success({
    coords: {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 100,
    },
  })),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// Mock File API
global.File = class MockFile {
  constructor(parts, filename, properties) {
    this.parts = parts;
    this.name = filename;
    this.size = parts.reduce((acc, part) => acc + part.length, 0);
    this.type = properties?.type || '';
    this.lastModified = Date.now();
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
    this.onloadstart = null;
    this.onloadend = null;
    this.onprogress = null;
    this.onabort = null;
  }

  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = file.parts ? file.parts.join('') : '';
      if (this.onload) this.onload();
      if (this.onloadend) this.onloadend();
    }, 0);
  }

  readAsDataURL(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = `data:${file.type};base64,dGVzdA==`;
      if (this.onload) this.onload();
      if (this.onloadend) this.onloadend();
    }, 0);
  }

  abort() {
    this.readyState = 2;
    if (this.onabort) this.onabort();
  }
};

// Mock clipboard API
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve()),
  readText: jest.fn(() => Promise.resolve('mocked clipboard text')),
  write: jest.fn(() => Promise.resolve()),
  read: jest.fn(() => Promise.resolve([])),
};

// Mock Web Share API
global.navigator.share = jest.fn(() => Promise.resolve());

// Mock performance API for timing tests
global.performance = {
  ...global.performance,
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  now: () => Date.now(),
};

// Mock requestIdleCallback
global.requestIdleCallback = jest.fn((callback) => {
  return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
});

global.cancelIdleCallback = jest.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(callback, 16); // ~60fps
});

global.cancelAnimationFrame = jest.fn();

// Console configuration for tests
if (process.env.SILENT_TESTS !== 'false') {
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    log: () => {},
    info: () => {},
    warn: () => {},
    error: originalConsole.error, // Keep errors visible
    debug: () => {},
  };
}

// Global test configuration
global.testConfig = {
  timeouts: {
    unit: 5000,
    integration: 15000,
    e2e: 30000,
  },
  retries: {
    unit: 0,
    integration: 1,
    e2e: 2,
  },
  cleanup: {
    indexedDB: true,
    localStorage: true,
    sessionStorage: true,
  },
  mocking: {
    externalServices: true,
    serviceWorker: true,
    notifications: true,
  },
  rendering: {
    defaultProviders: true,
    mockQueries: true,
    mockStores: true,
  },
};

// Export for CommonJS compatibility
module.exports = {};