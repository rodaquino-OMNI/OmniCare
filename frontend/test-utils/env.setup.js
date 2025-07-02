/**
 * Environment Setup for Frontend Tests
 * Configures test environment variables and global settings for React/Next.js
 */

// Load environment variables from both root and frontend .env.test
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.test') }); // Root .env.test
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') }); // Frontend .env.test (overrides)

// Set required test environment variables
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_ENV = 'test';
process.env.TZ = 'UTC';

// API Configuration for tests - use values from .env.test
process.env.NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.TEST_API_BASE_URL || 'http://localhost:3001/api';
process.env.NEXT_PUBLIC_FHIR_BASE_URL = process.env.NEXT_PUBLIC_FHIR_BASE_URL || process.env.TEST_FHIR_BASE_URL || 'http://localhost:8080/fhir/R4';

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

// Add structuredClone polyfill
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    // Simple deep clone implementation for test environment
    return JSON.parse(JSON.stringify(obj));
  };
}

// setImmediate polyfill for tests
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => {
    return setTimeout(() => callback(...args), 0);
  };
}

if (typeof clearImmediate === 'undefined') {
  global.clearImmediate = (id) => {
    clearTimeout(id);
  };
}

// Web API polyfills - MUST be before any module that uses them
// MessagePort and MessageChannel
if (typeof MessagePort === 'undefined') {
  global.MessagePort = class MessagePort {
    constructor() {
      this.onmessage = null;
      this.onmessageerror = null;
    }
    postMessage() {}
    start() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  };
}

if (typeof MessageChannel === 'undefined') {
  global.MessageChannel = class MessageChannel {
    constructor() {
      this.port1 = new global.MessagePort();
      this.port2 = new global.MessagePort();
    }
  };
}

// Web Streams API polyfill - MUST be before any module that uses it
if (typeof ReadableStream === 'undefined') {
  // Try to use web-streams-polyfill if available
  try {
    const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
    global.ReadableStream = ReadableStream;
    global.WritableStream = WritableStream;
    global.TransformStream = TransformStream;
  } catch (e) {
    // Fallback to basic implementation
    global.ReadableStream = class ReadableStream {
      constructor() {
        this.locked = false;
      }
      getReader() {
        return {
          read: () => Promise.resolve({ done: true, value: undefined }),
          releaseLock: () => {},
          closed: Promise.resolve(),
          cancel: () => Promise.resolve()
        };
      }
      cancel() {
        return Promise.resolve();
      }
    };
    
    global.WritableStream = class WritableStream {
      constructor() {
        this.locked = false;
      }
      getWriter() {
        return {
          write: () => Promise.resolve(),
          close: () => Promise.resolve(),
          abort: () => Promise.resolve(),
          releaseLock: () => {},
          closed: Promise.resolve(),
          desiredSize: 1,
          ready: Promise.resolve()
        };
      }
    };
    
    global.TransformStream = class TransformStream {
      constructor() {
        this.readable = new global.ReadableStream();
        this.writable = new global.WritableStream();
      }
    };
  }
}

// Request and Response polyfills - MUST be before any module that uses them
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = input instanceof Request ? input.url : input;
      this.method = init.method || (input instanceof Request ? input.method : 'GET');
      this.headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      this.body = init.body || (input instanceof Request ? input.body : null);
      this.mode = init.mode || (input instanceof Request ? input.mode : 'cors');
      this.credentials = init.credentials || (input instanceof Request ? input.credentials : 'same-origin');
      this.cache = init.cache || (input instanceof Request ? input.cache : 'default');
      this.redirect = init.redirect || (input instanceof Request ? input.redirect : 'follow');
      this.referrer = init.referrer || (input instanceof Request ? input.referrer : 'about:client');
      this.integrity = init.integrity || (input instanceof Request ? input.integrity : '');
    }
    
    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body,
        mode: this.mode,
        credentials: this.credentials,
        cache: this.cache,
        redirect: this.redirect,
        referrer: this.referrer,
        integrity: this.integrity
      });
    }
    
    async text() {
      return this.body || '';
    }
    
    async json() {
      return this.body ? JSON.parse(this.body) : {};
    }
  };
}

if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Headers(init.headers || {});
      this.ok = this.status >= 200 && this.status < 300;
      this.redirected = false;
      this.type = 'default';
      this.url = init.url || '';
    }
    
    clone() {
      return new Response(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers
      });
    }
    
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
    
    async blob() {
      return new Blob([this.body || '']);
    }
    
    async arrayBuffer() {
      const encoder = new TextEncoder();
      const text = await this.text();
      return encoder.encode(text).buffer;
    }
  };
}

if (typeof Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      this._headers = {};
      
      if (init instanceof Headers) {
        init.forEach((value, key) => {
          this.append(key, value);
        });
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => {
          this.append(key, value);
        });
      } else if (init && typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => {
          this.append(key, value);
        });
      }
    }
    
    append(name, value) {
      name = name.toLowerCase();
      if (!this._headers[name]) {
        this._headers[name] = [];
      }
      this._headers[name].push(value);
    }
    
    delete(name) {
      delete this._headers[name.toLowerCase()];
    }
    
    get(name) {
      const values = this._headers[name.toLowerCase()];
      return values ? values.join(', ') : null;
    }
    
    has(name) {
      return name.toLowerCase() in this._headers;
    }
    
    set(name, value) {
      this._headers[name.toLowerCase()] = [value];
    }
    
    forEach(callback, thisArg) {
      Object.entries(this._headers).forEach(([name, values]) => {
        values.forEach(value => {
          callback.call(thisArg, value, name, this);
        });
      });
    }
    
    entries() {
      const entries = [];
      this.forEach((value, name) => {
        entries.push([name, value]);
      });
      return entries[Symbol.iterator]();
    }
    
    keys() {
      return Object.keys(this._headers)[Symbol.iterator]();
    }
    
    values() {
      const values = [];
      this.forEach(value => values.push(value));
      return values[Symbol.iterator]();
    }
    
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || '';
      this.size = parts.reduce((acc, part) => {
        if (typeof part === 'string') return acc + part.length;
        if (part instanceof ArrayBuffer) return acc + part.byteLength;
        if (part instanceof Blob) return acc + part.size;
        return acc;
      }, 0);
    }
    
    async text() {
      return this.parts.join('');
    }
    
    async arrayBuffer() {
      const text = await this.text();
      const encoder = new TextEncoder();
      return encoder.encode(text).buffer;
    }
    
    slice(start = 0, end = this.size, contentType = '') {
      return new Blob(this.parts.slice(start, end), { type: contentType });
    }
  };
}

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
global.navigator.canShare = jest.fn(() => true);

// Mock Web Speech API
global.SpeechSynthesis = class SpeechSynthesis {
  constructor() {
    this.pending = false;
    this.speaking = false;
    this.paused = false;
    this.onvoiceschanged = null;
  }
  cancel() {}
  pause() {}
  resume() {}
  speak() {}
  getVoices() { return []; }
};

global.speechSynthesis = new global.SpeechSynthesis();

global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) {
    this.text = text || '';
    this.lang = 'en-US';
    this.voice = null;
    this.volume = 1;
    this.rate = 1;
    this.pitch = 1;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
    this.onmark = null;
    this.onboundary = null;
  }
};

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
  timing: {
    navigationStart: Date.now() - 5000,
    loadEventEnd: Date.now() - 1000,
    domComplete: Date.now() - 2000,
    domContentLoadedEventEnd: Date.now() - 3000,
  },
  navigation: {
    type: 0,
    redirectCount: 0,
  },
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

// Mock Battery API
global.navigator.getBattery = jest.fn(() => Promise.resolve({
  charging: true,
  chargingTime: Infinity,
  dischargingTime: Infinity,
  level: 1,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onchargingchange: null,
  onchargingtimechange: null,
  ondischargingtimechange: null,
  onlevelchange: null,
}));

// Mock Connection API (Network Information)
global.navigator.connection = {
  effectiveType: '4g',
  type: 'wifi',
  downlink: 10,
  rtt: 50,
  saveData: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onchange: null,
};

// Mock Permissions API
global.navigator.permissions = {
  query: jest.fn((descriptor) => Promise.resolve({
    name: descriptor.name,
    state: 'granted',
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
};

// Mock Gamepad API
global.navigator.getGamepads = jest.fn(() => []);

// Mock WebRTC APIs
global.RTCPeerConnection = class RTCPeerConnection {
  constructor(config) {
    this.localDescription = null;
    this.remoteDescription = null;
    this.signalingState = 'stable';
    this.iceConnectionState = 'new';
    this.iceGatheringState = 'new';
    this.connectionState = 'new';
    this.canTrickleIceCandidates = null;
    this.onconnectionstatechange = null;
    this.ondatachannel = null;
    this.onicecandidate = null;
    this.oniceconnectionstatechange = null;
    this.onicegatheringstatechange = null;
    this.onnegotiationneeded = null;
    this.onsignalingstatechange = null;
    this.ontrack = null;
  }
  
  createOffer() { return Promise.resolve({}); }
  createAnswer() { return Promise.resolve({}); }
  setLocalDescription() { return Promise.resolve(); }
  setRemoteDescription() { return Promise.resolve(); }
  addIceCandidate() { return Promise.resolve(); }
  getStats() { return Promise.resolve(new Map()); }
  addTrack() { return {}; }
  removeTrack() {}
  createDataChannel() { return {}; }
  close() {}
};

global.RTCSessionDescription = class RTCSessionDescription {
  constructor(init) {
    this.type = init?.type || 'offer';
    this.sdp = init?.sdp || '';
  }
};

global.RTCIceCandidate = class RTCIceCandidate {
  constructor(init) {
    this.candidate = init?.candidate || '';
    this.sdpMLineIndex = init?.sdpMLineIndex || 0;
    this.sdpMid = init?.sdpMid || null;
    this.usernameFragment = null;
  }
};

// Mock MediaDevices and getUserMedia
global.navigator.mediaDevices = {
  getUserMedia: jest.fn(() => Promise.resolve({
    getTracks: () => [],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  getDisplayMedia: jest.fn(() => Promise.resolve({
    getTracks: () => [],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  enumerateDevices: jest.fn(() => Promise.resolve([])),
  getSupportedConstraints: jest.fn(() => ({})),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Legacy getUserMedia
global.navigator.getUserMedia = jest.fn((constraints, success, error) => {
  global.navigator.mediaDevices.getUserMedia(constraints)
    .then(success)
    .catch(error);
});

// Mock Crypto.subtle API with more realistic implementations
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(16))),
    deriveBits: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    deriveKey: jest.fn((algorithm, baseKey, derivedKeyAlgorithm, extractable, keyUsages) => 
      Promise.resolve({
        type: 'secret',
        extractable,
        algorithm: derivedKeyAlgorithm,
        usages: keyUsages
      })
    ),
    digest: jest.fn((algorithm, data) => {
      // Simple mock hash
      const hash = new ArrayBuffer(32);
      const view = new Uint8Array(hash);
      for (let i = 0; i < 32; i++) {
        view[i] = i;
      }
      return Promise.resolve(hash);
    }),
    encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    exportKey: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    generateKey: jest.fn((algorithm, extractable, keyUsages) => 
      Promise.resolve({
        type: 'secret',
        extractable,
        algorithm,
        usages: keyUsages
      })
    ),
    importKey: jest.fn((format, keyData, algorithm, extractable, keyUsages) => 
      Promise.resolve({
        type: 'secret',
        extractable,
        algorithm,
        usages: keyUsages
      })
    ),
    sign: jest.fn(() => Promise.resolve(new ArrayBuffer(64))),
    unwrapKey: jest.fn(() => Promise.resolve({})),
    verify: jest.fn(() => Promise.resolve(true)),
    wrapKey: jest.fn(() => Promise.resolve(new ArrayBuffer(48))),
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
    webapis: true,
  },
  rendering: {
    defaultProviders: true,
    mockQueries: true,
    mockStores: true,
  },
  features: {
    webrtc: true,
    crypto: true,
    media: true,
    speech: true,
    battery: true,
    network: true,
    permissions: true,
  },
};

// Test utilities for environment
global.testEnv = {
  // Helper to check if a feature is enabled
  isFeatureEnabled: (feature) => global.testConfig.features[feature] || false,
  
  // Helper to get mock storage
  getMockStorage: () => ({
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
    indexedDB: global.indexedDB,
  }),
  
  // Helper to reset all mocked APIs
  resetMocks: () => {
    // Reset navigator mocks
    Object.getOwnPropertyNames(global.navigator).forEach(prop => {
      if (typeof global.navigator[prop] === 'function' && global.navigator[prop].mockReset) {
        global.navigator[prop].mockReset();
      }
    });
    
    // Reset window mocks
    if (global.window) {
      Object.getOwnPropertyNames(global.window).forEach(prop => {
        if (typeof global.window[prop] === 'function' && global.window[prop].mockReset) {
          global.window[prop].mockReset();
        }
      });
    }
  },
  
  // Helper to configure mock responses
  configureMock: (apiName, method, response) => {
    if (global.navigator[apiName] && global.navigator[apiName][method]) {
      if (typeof response === 'function') {
        global.navigator[apiName][method].mockImplementation(response);
      } else {
        global.navigator[apiName][method].mockResolvedValue(response);
      }
    }
  },
};

// Export for CommonJS compatibility
module.exports = {
  testConfig: global.testConfig,
  testEnv: global.testEnv,
};