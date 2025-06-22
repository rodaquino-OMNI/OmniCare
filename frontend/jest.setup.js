require('@testing-library/jest-dom');
require('jest-axe/extend-expect');
const { TextEncoder, TextDecoder } = require('util');
const React = require('react');
const { render } = require('@testing-library/react');
const { MantineProvider } = require('@mantine/core');

// Define ResourceHistoryTable as 0 to fix corrupted numeric values
global.ResourceHistoryTable = 0;

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// ReadableStream should already be polyfilled by env.setup.js
// This is a fallback check in case it's still missing
if (typeof ReadableStream === 'undefined') {
  console.warn('ReadableStream still undefined after env.setup.js - applying fallback polyfill');
  
  // Minimal polyfill for testing
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

// fake-indexeddb setup
require('fake-indexeddb/auto');

// Make sure indexedDB is available globally
global.indexedDB = require('fake-indexeddb');
global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
global.IDBRequest = require('fake-indexeddb/lib/FDBRequest');
global.IDBOpenDBRequest = require('fake-indexeddb/lib/FDBOpenDBRequest');
global.IDBDatabase = require('fake-indexeddb/lib/FDBDatabase');
global.IDBTransaction = require('fake-indexeddb/lib/FDBTransaction');
global.IDBObjectStore = require('fake-indexeddb/lib/FDBObjectStore');
global.IDBIndex = require('fake-indexeddb/lib/FDBIndex');
global.IDBCursor = require('fake-indexeddb/lib/FDBCursor');
global.IDBCursorWithValue = require('fake-indexeddb/lib/FDBCursorWithValue');

// Mock global media query for Mantine - ensure it's always available
const mockMatchMedia = (query) => ({
  matches: false,
  media: query || '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(mockMatchMedia)
});

// Also assign directly to window
window.matchMedia = jest.fn().mockImplementation(mockMatchMedia);

// Ensure document is available for JSDOM environment
if (typeof document !== 'undefined') {
  // Mock getComputedStyle for Mantine animations
  window.getComputedStyle = window.getComputedStyle || jest.fn(() => ({
    getPropertyValue: jest.fn(() => ''),
  }));
}

// Mock scrollTo
window.scrollTo = jest.fn();

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    };
  },
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// matchMedia already mocked above

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock HTMLElement.scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
});

// Mock Web APIs
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

Object.defineProperty(window, 'sessionStorage', {
  writable: true,
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (
        args[0].includes('Warning: ReactDOM.render is no longer supported') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)')
      )
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (
        args[0].includes('componentWillReceiveProps has been renamed') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)')
      )
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Test utilities
const mockPatientData = {
  id: 'test-patient-1',
  name: [{ given: ['John'], family: 'Doe' }],
  birthDate: '1990-01-01',
  gender: 'male',
  identifier: [
    {
      system: 'http://hospital.smarthealthit.org',
      value: 'MRN123456',
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '555-0123',
      use: 'mobile',
    },
    {
      system: 'email',
      value: 'john.doe@example.com',
      use: 'home',
    },
  ],
  address: [
    {
      use: 'home',
      line: ['123 Main St'],
      city: 'Anytown',
      state: 'NY',
      postalCode: '12345',
      country: 'US',
    },
  ],
};

const mockPractitionerData = {
  id: 'test-practitioner-1',
  name: [{ given: ['Jane'], family: 'Smith', prefix: ['Dr.'] }],
  identifier: [
    {
      system: 'http://hl7.org/fhir/sid/us-npi',
      value: '1234567890',
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '555-0456',
      use: 'work',
    },
    {
      system: 'email',
      value: 'dr.smith@hospital.com',
      use: 'work',
    },
  ],
  qualification: [
    {
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine',
          },
        ],
      },
    },
  ],
};

const mockEncounterData = {
  id: 'test-encounter-1',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  },
  subject: {
    reference: 'Patient/test-patient-1',
  },
  participant: [
    {
      individual: {
        reference: 'Practitioner/test-practitioner-1',
      },
    },
  ],
  period: {
    start: new Date().toISOString(),
  },
  serviceProvider: {
    reference: 'Organization/test-organization-1',
  },
};

// Import TestProviders - handle TypeScript module
let TestProviders;
try {
  TestProviders = require('./test-utils/test-providers').TestProviders;
} catch (error) {
  // Fallback if TypeScript module isn't available - create a simple wrapper
  TestProviders = ({ children }) => React.createElement(MantineProvider, null, children);
}

// Custom render function with MantineProvider
const renderWithProviders = (ui, options = {}) => {
  return render(ui, { wrapper: TestProviders, ...options });
};

// Make renderWithProviders globally available for test files
global.renderWithProviders = renderWithProviders;

// Provide vi as an alias to jest for compatibility
global.vi = jest;

// Mock MedplumClient to fix constructor issues
jest.mock('@medplum/core', () => ({
  MedplumClient: jest.fn().mockImplementation(() => ({
    readResource: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    searchResources: jest.fn(),
    getProfile: jest.fn(),
    request: jest.fn(),
  })),
}));

// Mock MedplumMock to fix LRUCache issues
jest.mock('@medplum/mock', () => ({
  MockClient: jest.fn().mockImplementation(() => ({
    readResource: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    searchResources: jest.fn(),
    getProfile: jest.fn(),
    request: jest.fn(),
  })),
}));

// Mock the medplum client module to prevent instantiation issues
jest.mock('@/lib/medplum', () => ({
  getMedplumClient: jest.fn(() => ({
    readResource: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    searchResources: jest.fn(),
    getProfile: jest.fn(),
    request: jest.fn(),
  })),
  medplumClient: {
    readResource: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    searchResources: jest.fn(),
    getProfile: jest.fn(),
    request: jest.fn(),
  },
  initializeMedplum: jest.fn().mockResolvedValue(true),
}));

// Mock offline services that use IndexedDB
jest.mock('@/services/offline-smarttext.service', () => ({
  offlineSmartTextService: {
    initializeDB: jest.fn().mockResolvedValue(true),
    storeSuggestion: jest.fn().mockResolvedValue(true),
    getSuggestions: jest.fn().mockResolvedValue([]),
    updateSuggestion: jest.fn().mockResolvedValue(true),
    deleteSuggestion: jest.fn().mockResolvedValue(true),
    clearDatabase: jest.fn().mockResolvedValue(true),
    getTemplates: jest.fn().mockResolvedValue([
      { id: '1', name: 'Progress Note', content: 'Sample progress note template' },
      { id: '2', name: 'Consultation', content: 'Sample consultation template' }
    ]),
    storeTemplate: jest.fn().mockResolvedValue(true),
    updateTemplate: jest.fn().mockResolvedValue(true),
    deleteTemplate: jest.fn().mockResolvedValue(true),
  }
}));

jest.mock('@/services/offline-notes.service', () => ({
  offlineNotesService: {
    initializeDB: jest.fn().mockResolvedValue(true),
    storeNote: jest.fn().mockResolvedValue(true),
    getNotes: jest.fn().mockResolvedValue([]),
    updateNote: jest.fn().mockResolvedValue(true),
    deleteNote: jest.fn().mockResolvedValue(true),
    clearDatabase: jest.fn().mockResolvedValue(true),
  }
}));

jest.mock('@/services/patient-cache.service', () => ({
  patientCacheService: {
    cachePatient: jest.fn().mockResolvedValue(true),
    getCachedPatient: jest.fn().mockResolvedValue(null),
    updateCachedPatient: jest.fn().mockResolvedValue(true),
    clearCache: jest.fn().mockResolvedValue(true),
  }
}));

// Export test utilities for CommonJS modules
module.exports = {
  mockPatientData,
  mockPractitionerData,
  mockEncounterData,
  renderWithProviders,
};