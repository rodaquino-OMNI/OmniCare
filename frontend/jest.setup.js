// Load environment setup first
require('./test-utils/env.setup');

// Core testing libraries
require('@testing-library/jest-dom');
require('jest-axe/extend-expect');

// Node.js utilities
const { TextEncoder, TextDecoder } = require('util');
const React = require('react');
const { render, waitFor, cleanup } = require('@testing-library/react');
const { MantineProvider } = require('@mantine/core');

// =============================================================================
// Global Constants and Resource Tables
// =============================================================================

// Define 0 as 0 to fix corrupted numeric values
global.ResourceHistoryTable = 0;

// FHIR Resource Type Constants
global.FHIR_RESOURCE_TYPES = {
  PATIENT: 'Patient',
  PRACTITIONER: 'Practitioner',
  ENCOUNTER: 'Encounter',
  OBSERVATION: 'Observation',
  CONDITION: 'Condition',
  PROCEDURE: 'Procedure',
  MEDICATION_REQUEST: 'MedicationRequest',
  ALLERGY_INTOLERANCE: 'AllergyIntolerance',
  DIAGNOSTIC_REPORT: 'DiagnosticReport',
  IMMUNIZATION: 'Immunization',
};

// =============================================================================
// Web API Polyfills
// =============================================================================

// Text encoding/decoding
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Blob polyfill
if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts, options = {}) {
      this._parts = parts || [];
      this.type = options.type || '';
      this.size = this._parts.reduce((acc, part) => {
        if (typeof part === 'string') return acc + part.length;
        if (part instanceof ArrayBuffer) return acc + part.byteLength;
        if (part instanceof Blob) return acc + part.size;
        return acc;
      }, 0);
    }
    async text() {
      return this._parts.join('');
    }
    async arrayBuffer() {
      const text = await this.text();
      return new TextEncoder().encode(text).buffer;
    }
    stream() {
      return new ReadableStream({
        start(controller) {
          this._parts.forEach(part => controller.enqueue(part));
          controller.close();
        }
      });
    }
    slice(start = 0, end = this.size, contentType = '') {
      return new Blob([], { type: contentType });
    }
  };
}

// FormData polyfill
if (typeof FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this._data = new Map();
    }
    append(name, value, filename) {
      const existing = this._data.get(name);
      const newValue = filename ? { value, filename } : value;
      if (existing) {
        if (Array.isArray(existing)) {
          existing.push(newValue);
        } else {
          this._data.set(name, [existing, newValue]);
        }
      } else {
        this._data.set(name, newValue);
      }
    }
    delete(name) {
      this._data.delete(name);
    }
    get(name) {
      const value = this._data.get(name);
      return Array.isArray(value) ? value[0] : value;
    }
    getAll(name) {
      const value = this._data.get(name);
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }
    has(name) {
      return this._data.has(name);
    }
    set(name, value, filename) {
      this._data.set(name, filename ? { value, filename } : value);
    }
    entries() {
      return this._data.entries();
    }
    keys() {
      return this._data.keys();
    }
    values() {
      return this._data.values();
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

// URL and URLSearchParams polyfills
if (typeof URL === 'undefined') {
  global.URL = require('url').URL;
}
if (typeof URLSearchParams === 'undefined') {
  global.URLSearchParams = require('url').URLSearchParams;
}

// Streams API - ensure they're properly available
if (typeof ReadableStream === 'undefined') {
  console.warn('ReadableStream still undefined after env.setup.js - applying comprehensive polyfill');
  
  // Comprehensive Stream polyfills
  const streams = require('stream/web');
  global.ReadableStream = streams.ReadableStream;
  global.WritableStream = streams.WritableStream;
  global.TransformStream = streams.TransformStream;
  global.ReadableStreamDefaultReader = streams.ReadableStreamDefaultReader;
  global.WritableStreamDefaultWriter = streams.WritableStreamDefaultWriter;
}

// Add structuredClone polyfill before fake-indexeddb
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    // Simple deep clone implementation for test environment
    return JSON.parse(JSON.stringify(obj));
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

// =============================================================================
// Window and DOM Mocks
// =============================================================================

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
    getPropertyPriority: jest.fn(() => ''),
    removeProperty: jest.fn(),
    setProperty: jest.fn(),
    item: jest.fn(() => ''),
    length: 0,
  }));
}

// Mock scrollTo and scroll behavior
window.scrollTo = jest.fn();
window.scroll = jest.fn();
window.scrollBy = jest.fn();

// Mock requestAnimationFrame with proper timing
let rafCallbacks = [];
let rafId = 0;
global.requestAnimationFrame = jest.fn((callback) => {
  const id = ++rafId;
  rafCallbacks.push({ id, callback });
  setTimeout(() => {
    const index = rafCallbacks.findIndex(cb => cb.id === id);
    if (index !== -1) {
      const cb = rafCallbacks[index];
      rafCallbacks.splice(index, 1);
      cb.callback(performance.now());
    }
  }, 16); // ~60fps
  return id;
});

global.cancelAnimationFrame = jest.fn((id) => {
  const index = rafCallbacks.findIndex(cb => cb.id === id);
  if (index !== -1) {
    rafCallbacks.splice(index, 1);
  }
});

// Mock Web Animations API
if (typeof Animation === 'undefined') {
  global.Animation = class Animation {
    constructor() {
      this.playState = 'idle';
      this.currentTime = 0;
      this.playbackRate = 1;
      this.finished = Promise.resolve(this);
    }
    play() { this.playState = 'running'; }
    pause() { this.playState = 'paused'; }
    cancel() { this.playState = 'idle'; }
    finish() { this.playState = 'finished'; }
    reverse() { this.playbackRate = -this.playbackRate; }
  };
}

// Element.animate mock
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function(keyframes, options) {
    return new global.Animation();
  };
}

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

// Mock document.elementFromPoint
if (typeof document !== 'undefined') {
  document.elementFromPoint = jest.fn((x, y) => {
    // Return a mock element or null
    return null;
  });
  
  document.elementsFromPoint = jest.fn((x, y) => {
    // Return an empty array of elements
    return [];
  });
}

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

// =============================================================================
// Console and Error Handling
// =============================================================================

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
        args[0].includes('act(...)') ||
        args[0].includes('Warning: Failed prop type') ||
        args[0].includes('Warning: Invalid DOM property') ||
        args[0].includes('Warning: Unknown event handler property')
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
        args[0].includes('act(...)') ||
        args[0].includes('Warning: Failed prop type') ||
        args[0].includes('DevTools failed to load')
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

// =============================================================================
// Test Lifecycle Hooks
// =============================================================================

// Global error handler for unhandled promise rejections
const unhandledRejections = new Map();
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
  unhandledRejections.set(promise, reason);
});

process.on('rejectionHandled', (promise) => {
  unhandledRejections.delete(promise);
});

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Clear storage
  if (global.localStorage) {
    localStorage.clear();
  }
  if (global.sessionStorage) {
    sessionStorage.clear();
  }
  
  // Clear IndexedDB
  if (global.indexedDB) {
    const databases = await indexedDB.databases?.() || [];
    for (const db of databases) {
      await indexedDB.deleteDatabase(db.name);
    }
  }
  
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear RAF callbacks
  rafCallbacks = [];
  rafId = 0;
  
  // Cleanup React Testing Library
  cleanup();
  
  // Wait for pending promises
  await new Promise(resolve => setImmediate(resolve));
  
  // Check for unhandled rejections
  if (unhandledRejections.size > 0) {
    const rejections = Array.from(unhandledRejections.entries());
    unhandledRejections.clear();
    throw new Error(`Unhandled promise rejections: ${rejections.map(([_, reason]) => reason).join(', ')}`);
  }
});

// =============================================================================
// Async Operation Helpers
// =============================================================================

// Helper to wait for all promises to settle
global.waitForPromises = () => new Promise(resolve => {
  setImmediate(resolve);
});

// Helper to flush all pending microtasks
global.flushMicrotasks = () => new Promise(resolve => {
  Promise.resolve().then(resolve);
});

// Helper to wait for specific conditions with timeout
global.waitForCondition = async (condition, timeout = 5000, interval = 100) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Enhanced waitFor with better error messages
global.enhancedWaitFor = async (callback, options = {}) => {
  const { timeout = 5000, ...restOptions } = options;
  try {
    return await waitFor(callback, { timeout, ...restOptions });
  } catch (error) {
    console.error('waitFor failed:', error.message);
    throw error;
  }
};

// =============================================================================
// Test Data and Mock Resources
// =============================================================================

// Enhanced mock patient data with all FHIR fields
const mockPatientData = {
  resourceType: 'Patient',
  id: 'test-patient-1',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient']
  },
  identifier: [
    {
      use: 'usual',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'MR',
          display: 'Medical record number'
        }]
      },
      system: 'http://hospital.smarthealthit.org',
      value: 'MRN123456',
    },
  ],
  active: true,
  name: [
    { 
      use: 'official',
      given: ['John', 'Michael'], 
      family: 'Doe',
      period: { start: '1990-01-01' }
    }
  ],
  birthDate: '1990-01-01',
  gender: 'male',
  telecom: [
    {
      system: 'phone',
      value: '555-0123',
      use: 'mobile',
      rank: 1,
    },
    {
      system: 'email',
      value: 'john.doe@example.com',
      use: 'home',
      rank: 2,
    },
  ],
  address: [
    {
      use: 'home',
      type: 'both',
      line: ['123 Main St', 'Apt 4B'],
      city: 'Anytown',
      state: 'NY',
      postalCode: '12345',
      country: 'US',
      period: { start: '2020-01-01' }
    },
  ],
  maritalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
      code: 'M',
      display: 'Married'
    }]
  },
  contact: [
    {
      relationship: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
          code: 'C',
          display: 'Emergency Contact'
        }]
      }],
      name: { given: ['Jane'], family: 'Doe' },
      telecom: [{ system: 'phone', value: '555-0124' }]
    }
  ],
  communication: [
    {
      language: {
        coding: [{
          system: 'urn:ietf:bcp:47',
          code: 'en-US',
          display: 'English (United States)'
        }]
      },
      preferred: true
    }
  ],
  generalPractitioner: [
    { reference: 'Practitioner/test-practitioner-1' }
  ],
  managingOrganization: {
    reference: 'Organization/test-organization-1'
  }
};

const mockPractitionerData = {
  resourceType: 'Practitioner',
  id: 'test-practitioner-1',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner']
  },
  identifier: [
    {
      use: 'official',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'NPI',
          display: 'National provider identifier'
        }]
      },
      system: 'http://hl7.org/fhir/sid/us-npi',
      value: '1234567890',
    },
    {
      use: 'official',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'DEA',
          display: 'Drug Enforcement Administration registration number'
        }]
      },
      system: 'http://hl7.org/fhir/sid/us-dea',
      value: 'BS1234563'
    }
  ],
  active: true,
  name: [
    { 
      use: 'official',
      given: ['Jane', 'Elizabeth'], 
      family: 'Smith', 
      prefix: ['Dr.'],
      suffix: ['MD', 'PhD']
    }
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
    {
      system: 'fax',
      value: '555-0457',
      use: 'work',
    }
  ],
  address: [
    {
      use: 'work',
      line: ['456 Hospital Way', 'Suite 200'],
      city: 'Medical City',
      state: 'NY',
      postalCode: '12346',
      country: 'US'
    }
  ],
  gender: 'female',
  birthDate: '1975-05-15',
  qualification: [
    {
      identifier: [{
        system: 'http://example.org/UniversityIdentifier',
        value: 'MD-12345'
      }],
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine',
          },
        ],
        text: 'MD'
      },
      period: {
        start: '1998-06-01'
      },
      issuer: {
        display: 'State Medical Board'
      }
    },
    {
      code: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
          code: 'BS',
          display: 'Bachelor of Science'
        }],
        text: 'Bachelor of Science'
      },
      period: {
        start: '1994-06-01',
        end: '1998-05-31'
      },
      issuer: {
        display: 'University of Medicine'
      }
    }
  ],
  communication: [
    {
      coding: [{
        system: 'urn:ietf:bcp:47',
        code: 'en-US',
        display: 'English (United States)'
      }]
    },
    {
      coding: [{
        system: 'urn:ietf:bcp:47',
        code: 'es',
        display: 'Spanish'
      }]
    }
  ]
};

const mockEncounterData = {
  resourceType: 'Encounter',
  id: 'test-encounter-1',
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter']
  },
  identifier: [
    {
      use: 'official',
      system: 'http://hospital.smarthealthit.org/encounters',
      value: 'ENC-2024-001'
    }
  ],
  status: 'in-progress',
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date(Date.now() - 3600000).toISOString()
      }
    },
    {
      status: 'arrived',
      period: {
        start: new Date(Date.now() - 3600000).toISOString(),
        end: new Date(Date.now() - 1800000).toISOString()
      }
    },
    {
      status: 'in-progress',
      period: {
        start: new Date(Date.now() - 1800000).toISOString()
      }
    }
  ],
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  },
  type: [
    {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '308335008',
        display: 'Patient encounter procedure'
      }],
      text: 'Routine follow-up'
    }
  ],
  serviceType: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/service-type',
      code: '124',
      display: 'General Practice'
    }]
  },
  priority: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
      code: 'R',
      display: 'routine'
    }]
  },
  subject: {
    reference: 'Patient/test-patient-1',
    display: 'John Doe'
  },
  episodeOfCare: [
    {
      reference: 'EpisodeOfCare/test-episode-1'
    }
  ],
  participant: [
    {
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'PPRF',
          display: 'primary performer'
        }]
      }],
      period: {
        start: new Date(Date.now() - 1800000).toISOString()
      },
      individual: {
        reference: 'Practitioner/test-practitioner-1',
        display: 'Dr. Jane Smith'
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/test-appointment-1'
    }
  ],
  period: {
    start: new Date(Date.now() - 1800000).toISOString(),
  },
  reasonCode: [
    {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '185345009',
        display: 'Encounter for symptom'
      }],
      text: 'Annual physical exam'
    }
  ],
  diagnosis: [
    {
      condition: {
        reference: 'Condition/test-condition-1'
      },
      use: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
          code: 'CC',
          display: 'Chief complaint'
        }]
      },
      rank: 1
    }
  ],
  account: [
    {
      reference: 'Account/test-account-1'
    }
  ],
  hospitalization: {
    preAdmissionIdentifier: {
      use: 'official',
      system: 'http://hospital.smarthealthit.org/pre-admissions',
      value: 'PA-2024-001'
    }
  },
  location: [
    {
      location: {
        reference: 'Location/test-location-1',
        display: 'Exam Room 3'
      },
      status: 'active',
      physicalType: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'ro',
          display: 'Room'
        }]
      },
      period: {
        start: new Date(Date.now() - 1800000).toISOString()
      }
    }
  ],
  serviceProvider: {
    reference: 'Organization/test-organization-1',
    display: 'Test Hospital'
  },
};

// Additional mock FHIR resources
const mockObservationData = {
  resourceType: 'Observation',
  id: 'test-observation-1',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns']
  },
  identifier: [{
    use: 'official',
    system: 'http://hospital.smarthealthit.org/observations',
    value: 'OBS-2024-001'
  }],
  basedOn: [{
    reference: 'ServiceRequest/test-service-request-1'
  }],
  partOf: [{
    reference: 'Procedure/test-procedure-1'
  }],
  status: 'final',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'vital-signs',
      display: 'Vital Signs'
    }],
    text: 'Vital Signs'
  }],
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '85354-9',
      display: 'Blood pressure panel with all children optional'
    }],
    text: 'Blood Pressure'
  },
  subject: {
    reference: 'Patient/test-patient-1',
    display: 'John Doe'
  },
  encounter: {
    reference: 'Encounter/test-encounter-1'
  },
  effectiveDateTime: new Date().toISOString(),
  issued: new Date().toISOString(),
  performer: [{
    reference: 'Practitioner/test-practitioner-1',
    display: 'Dr. Jane Smith'
  }],
  valueQuantity: {
    value: 120,
    unit: 'mmHg',
    system: 'http://unitsofmeasure.org',
    code: 'mm[Hg]'
  },
  interpretation: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
      code: 'N',
      display: 'Normal'
    }],
    text: 'Normal'
  }],
  note: [{
    authorReference: {
      reference: 'Practitioner/test-practitioner-1'
    },
    time: new Date().toISOString(),
    text: 'Patient appears healthy'
  }],
  bodySite: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '368209003',
      display: 'Right arm'
    }]
  },
  method: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '37931006',
      display: 'Auscultation'
    }]
  },
  device: {
    reference: 'Device/test-device-1'
  },
  referenceRange: [{
    low: {
      value: 90,
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
      code: 'mm[Hg]'
    },
    high: {
      value: 140,
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
      code: 'mm[Hg]'
    },
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/referencerange-meaning',
        code: 'normal',
        display: 'Normal Range'
      }]
    },
    appliesTo: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0080',
        code: 'normal',
        display: 'Normal'
      }]
    }],
    age: {
      low: {
        value: 18,
        unit: 'year',
        system: 'http://unitsofmeasure.org',
        code: 'a'
      }
    }
  }],
  hasMember: [
    { reference: 'Observation/test-observation-2' },
    { reference: 'Observation/test-observation-3' }
  ],
  component: [
    {
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '8480-6',
          display: 'Systolic blood pressure'
        }]
      },
      valueQuantity: {
        value: 120,
        unit: 'mmHg',
        system: 'http://unitsofmeasure.org',
        code: 'mm[Hg]'
      }
    },
    {
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '8462-4',
          display: 'Diastolic blood pressure'
        }]
      },
      valueQuantity: {
        value: 80,
        unit: 'mmHg',
        system: 'http://unitsofmeasure.org',
        code: 'mm[Hg]'
      }
    }
  ]
};

const mockConditionData = {
  resourceType: 'Condition',
  id: 'test-condition-1',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition']
  },
  identifier: [{
    use: 'official',
    system: 'http://hospital.smarthealthit.org/conditions',
    value: 'COND-2024-001'
  }],
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      code: 'active',
      display: 'Active'
    }]
  },
  verificationStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      code: 'confirmed',
      display: 'Confirmed'
    }]
  },
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-category',
      code: 'problem-list-item',
      display: 'Problem List Item'
    }]
  }],
  severity: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '6736007',
      display: 'Moderate'
    }]
  },
  code: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '38341003',
      display: 'Hypertensive disorder'
    }],
    text: 'Hypertension'
  },
  bodySite: [{
    coding: [{
      system: 'http://snomed.info/sct',
      code: '113257007',
      display: 'Structure of cardiovascular system'
    }]
  }],
  subject: {
    reference: 'Patient/test-patient-1',
    display: 'John Doe'
  },
  encounter: {
    reference: 'Encounter/test-encounter-1'
  },
  onsetDateTime: '2020-01-01T00:00:00.000Z',
  recordedDate: '2020-01-15T00:00:00.000Z',
  recorder: {
    reference: 'Practitioner/test-practitioner-1',
    display: 'Dr. Jane Smith'
  },
  asserter: {
    reference: 'Practitioner/test-practitioner-1',
    display: 'Dr. Jane Smith'
  },
  stage: [{
    summary: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '73211009',
        display: 'Stage 2 hypertension'
      }]
    },
    assessment: [{
      reference: 'ClinicalImpression/test-clinical-impression-1'
    }],
    type: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '260998006',
        display: 'Clinical staging'
      }]
    }
  }],
  evidence: [{
    code: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: '271649006',
        display: 'Systolic blood pressure'
      }]
    }],
    detail: [{
      reference: 'Observation/test-observation-1'
    }]
  }],
  note: [{
    authorReference: {
      reference: 'Practitioner/test-practitioner-1'
    },
    time: '2020-01-15T00:00:00.000Z',
    text: 'Patient has family history of hypertension'
  }]
};

const mockMedicationRequestData = {
  resourceType: 'MedicationRequest',
  id: 'test-medication-request-1',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest']
  },
  identifier: [{
    use: 'official',
    system: 'http://hospital.smarthealthit.org/prescriptions',
    value: 'RX-2024-001'
  }],
  status: 'active',
  statusReason: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-status-reason',
      code: 'clarif',
      display: 'Prescription requires clarification'
    }]
  },
  intent: 'order',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category',
      code: 'outpatient',
      display: 'Outpatient'
    }]
  }],
  priority: 'routine',
  doNotPerform: false,
  reportedBoolean: false,
  medicationCodeableConcept: {
    coding: [{
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '314076',
      display: 'Lisinopril 10 MG Oral Tablet'
    }],
    text: 'Lisinopril 10mg tablet'
  },
  subject: {
    reference: 'Patient/test-patient-1',
    display: 'John Doe'
  },
  encounter: {
    reference: 'Encounter/test-encounter-1'
  },
  supportingInformation: [{
    reference: 'Condition/test-condition-1'
  }],
  authoredOn: '2024-01-01T00:00:00.000Z',
  requester: {
    reference: 'Practitioner/test-practitioner-1',
    display: 'Dr. Jane Smith'
  },
  performer: {
    reference: 'Organization/test-pharmacy-1'
  },
  performerType: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '26369006',
      display: 'Public Health Nurse'
    }]
  },
  recorder: {
    reference: 'Practitioner/test-practitioner-1'
  },
  reasonCode: [{
    coding: [{
      system: 'http://snomed.info/sct',
      code: '38341003',
      display: 'Hypertensive disorder'
    }]
  }],
  reasonReference: [{
    reference: 'Condition/test-condition-1'
  }],
  instantiatesCanonical: ['http://hl7.org/fhir/Protocol/example'],
  instantiatesUri: ['http://example.org/protocol-for-hypertension'],
  basedOn: [{
    reference: 'CarePlan/test-care-plan-1'
  }],
  groupIdentifier: {
    use: 'official',
    system: 'http://hospital.smarthealthit.org/prescription-groups',
    value: 'PG-2024-001'
  },
  courseOfTherapyType: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy',
      code: 'continuous',
      display: 'Continuous long term therapy'
    }]
  },
  insurance: [{
    reference: 'Coverage/test-coverage-1'
  }],
  note: [{
    authorReference: {
      reference: 'Practitioner/test-practitioner-1'
    },
    time: '2024-01-01T00:00:00.000Z',
    text: 'Patient should monitor blood pressure daily'
  }],
  dosageInstruction: [{
    sequence: 1,
    text: 'Take 1 tablet by mouth once daily',
    additionalInstruction: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: '311504000',
        display: 'With or after food'
      }]
    }],
    patientInstruction: 'Take this medication with food to reduce stomach upset',
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        periodUnit: 'd',
        boundsDuration: {
          value: 30,
          unit: 'days',
          system: 'http://unitsofmeasure.org',
          code: 'd'
        }
      }
    },
    asNeededBoolean: false,
    site: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '181220002',
        display: 'Entire oral cavity'
      }]
    },
    route: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '26643006',
        display: 'Oral route'
      }]
    },
    method: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '421521009',
        display: 'Swallow'
      }]
    },
    doseAndRate: [{
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
          code: 'ordered',
          display: 'Ordered'
        }]
      },
      doseQuantity: {
        value: 1,
        unit: 'TAB',
        system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
        code: 'TAB'
      }
    }],
    maxDosePerPeriod: {
      numerator: {
        value: 1,
        unit: 'TAB'
      },
      denominator: {
        value: 1,
        unit: 'day'
      }
    },
    maxDosePerAdministration: {
      value: 1,
      unit: 'TAB'
    }
  }],
  dispenseRequest: {
    initialFill: {
      quantity: {
        value: 30,
        unit: 'TAB',
        system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
        code: 'TAB'
      },
      duration: {
        value: 30,
        unit: 'days',
        system: 'http://unitsofmeasure.org',
        code: 'd'
      }
    },
    dispenseInterval: {
      value: 30,
      unit: 'days',
      system: 'http://unitsofmeasure.org',
      code: 'd'
    },
    validityPeriod: {
      start: '2024-01-01T00:00:00.000Z',
      end: '2025-01-01T00:00:00.000Z'
    },
    numberOfRepeatsAllowed: 11,
    quantity: {
      value: 30,
      unit: 'TAB',
      system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
      code: 'TAB'
    },
    expectedSupplyDuration: {
      value: 30,
      unit: 'days',
      system: 'http://unitsofmeasure.org',
      code: 'd'
    },
    performer: {
      reference: 'Organization/test-pharmacy-1'
    }
  },
  substitution: {
    allowedBoolean: true,
    reason: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
        code: 'FP',
        display: 'formulary policy'
      }]
    }
  },
  priorPrescription: {
    reference: 'MedicationRequest/test-medication-request-0'
  },
  detectedIssue: [{
    reference: 'DetectedIssue/test-detected-issue-1'
  }],
  eventHistory: [{
    reference: 'Provenance/test-provenance-1'
  }]
};

const mockOrganizationData = {
  resourceType: 'Organization',
  id: 'test-organization-1',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-organization']
  },
  identifier: [{
    use: 'official',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
        code: 'TAX',
        display: 'Tax ID number'
      }]
    },
    system: 'urn:oid:2.16.840.1.113883.4.4',
    value: '12-3456789'
  }],
  active: true,
  type: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/organization-type',
      code: 'prov',
      display: 'Healthcare Provider'
    }]
  }],
  name: 'Test Hospital',
  alias: ['TH', 'Test Medical Center'],
  telecom: [
    {
      system: 'phone',
      value: '555-0100',
      use: 'work'
    },
    {
      system: 'fax',
      value: '555-0101',
      use: 'work'
    },
    {
      system: 'email',
      value: 'info@testhospital.com',
      use: 'work'
    },
    {
      system: 'url',
      value: 'https://www.testhospital.com',
      use: 'work'
    }
  ],
  address: [{
    use: 'work',
    type: 'both',
    line: ['789 Medical Center Drive'],
    city: 'Health City',
    state: 'NY',
    postalCode: '12347',
    country: 'US'
  }],
  partOf: {
    reference: 'Organization/test-parent-org-1',
    display: 'Test Healthcare Network'
  },
  contact: [{
    purpose: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/contactentity-type',
        code: 'ADMIN',
        display: 'Administrative'
      }]
    },
    name: {
      given: ['Admin'],
      family: 'Contact'
    },
    telecom: [{
      system: 'phone',
      value: '555-0102',
      use: 'work'
    }],
    address: {
      use: 'work',
      line: ['789 Medical Center Drive'],
      city: 'Health City',
      state: 'NY',
      postalCode: '12347'
    }
  }],
  endpoint: [{
    reference: 'Endpoint/test-endpoint-1'
  }]
};

// Mock data factory functions
const createMockResource = (resourceType, overrides = {}) => {
  const baseResources = {
    Patient: mockPatientData,
    Practitioner: mockPractitionerData,
    Encounter: mockEncounterData,
    Observation: mockObservationData,
    Condition: mockConditionData,
    MedicationRequest: mockMedicationRequestData,
    Organization: mockOrganizationData,
  };
  
  const baseResource = baseResources[resourceType] || {
    resourceType,
    id: `test-${resourceType.toLowerCase()}-1`,
    meta: {
      versionId: '1',
      lastUpdated: new Date().toISOString()
    }
  };
  
  return { ...baseResource, ...overrides };
};

// Bundle factory for search results
const createSearchBundle = (resources = [], total = null) => ({
  resourceType: 'Bundle',
  id: `test-bundle-${Date.now()}`,
  meta: {
    lastUpdated: new Date().toISOString()
  },
  type: 'searchset',
  total: total ?? resources.length,
  link: [
    {
      relation: 'self',
      url: 'http://localhost/fhir/Bundle'
    }
  ],
  entry: resources.map(resource => ({
    fullUrl: `http://localhost/fhir/${resource.resourceType}/${resource.id}`,
    resource,
    search: {
      mode: 'match',
      score: 1
    }
  }))
});

// Operation outcome factory
const createOperationOutcome = (severity, code, diagnostics) => ({
  resourceType: 'OperationOutcome',
  id: `test-outcome-${Date.now()}`,
  issue: [{
    severity,
    code,
    diagnostics,
    details: {
      text: diagnostics
    }
  }]
});

// Import TestProviders - handle TypeScript module
let TestProviders;
try {
  TestProviders = require('./test-utils/test-providers').TestProviders;
} catch (error) {
  // Fallback if TypeScript module isn't available - create a simple wrapper
  TestProviders = ({ children }) => React.createElement(MantineProvider, {
    theme: {
      primaryColor: 'blue',
      colorScheme: 'light'
    }
  }, children);
}

// Custom render function with providers
const renderWithProviders = (ui, options = {}) => {
  return render(ui, { wrapper: TestProviders, ...options });
};

// Make utilities globally available for test files
global.renderWithProviders = renderWithProviders;
global.createMockResource = createMockResource;
global.createSearchBundle = createSearchBundle;
global.createOperationOutcome = createOperationOutcome;

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
  createReference: jest.fn((resource) => {
    if (!resource) return null;
    const resourceType = resource.resourceType || 'Patient';
    const id = resource.id || 'unknown-id';
    return { reference: `${resourceType}/${id}` };
  }),
  formatDate: jest.fn((date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }),
  formatDateTime: jest.fn((date) => {
    if (!date) return '';
    return new Date(date).toLocaleString();
  }),
  formatHumanName: jest.fn((name) => {
    if (!name) return '';
    if (Array.isArray(name)) name = name[0];
    const parts = [];
    if (name.prefix) parts.push(...name.prefix);
    if (name.given) parts.push(...name.given);
    if (name.family) parts.push(name.family);
    if (name.suffix) parts.push(...name.suffix);
    return parts.join(' ');
  }),
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
    recoverDrafts: jest.fn().mockResolvedValue([]),
  }
}));

jest.mock('@/services/patient-cache.service', () => ({
  patientCacheService: {
    cachePatient: jest.fn().mockResolvedValue(true),
    getCachedPatient: jest.fn().mockResolvedValue(null),
    updateCachedPatient: jest.fn().mockResolvedValue(true),
    clearCache: jest.fn().mockResolvedValue(true),
    getPatient: jest.fn().mockResolvedValue(null),
    deletePatient: jest.fn().mockResolvedValue(true),
    getAllPatients: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    clear: jest.fn().mockResolvedValue(true),
    isInitialized: true,
    initialize: jest.fn().mockResolvedValue(true),
  }
}));

// Mock offline-sync.service
jest.mock('@/services/offline-sync.service', () => ({
  offlineSyncService: {
    queueOperation: jest.fn().mockResolvedValue(true),
    syncPendingOperations: jest.fn().mockResolvedValue({ success: true, synced: 0, failed: 0 }),
    getQueueStatus: jest.fn().mockReturnValue({ pending: 0, failed: 0, total: 0 }),
    clearQueue: jest.fn().mockResolvedValue(true),
    retryFailedOperations: jest.fn().mockResolvedValue({ success: true, synced: 0, failed: 0 }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    initialize: jest.fn().mockResolvedValue(true),
    isOnline: jest.fn().mockReturnValue(true),
    setOnlineStatus: jest.fn(),
    getSyncStatus: jest.fn().mockReturnValue({ 
      isRunning: false, 
      lastSync: null, 
      pendingOperations: 0,
      failedOperations: 0 
    }),
    exportSyncData: jest.fn().mockResolvedValue({
      queue: [],
      metadata: {},
      timestamp: new Date().toISOString()
    }),
    importSyncData: jest.fn().mockResolvedValue(true),
    pauseSync: jest.fn(),
    resumeSync: jest.fn(),
    getOperationById: jest.fn().mockResolvedValue(null),
    updateOperation: jest.fn().mockResolvedValue(true),
    deleteOperation: jest.fn().mockResolvedValue(true),
    clearLocalData: jest.fn().mockResolvedValue(true),
  }
}));

// =============================================================================
// Export Test Utilities
// =============================================================================

// Export all test utilities and mock data for CommonJS modules
module.exports = {
  // Mock data
  mockPatientData,
  mockPractitionerData,
  mockEncounterData,
  mockObservationData,
  mockConditionData,
  mockMedicationRequestData,
  mockOrganizationData,
  
  // Render utilities
  renderWithProviders,
  
  // Factory functions
  createMockResource,
  createSearchBundle,
  createOperationOutcome,
  
  // Async helpers
  waitForPromises: global.waitForPromises,
  flushMicrotasks: global.flushMicrotasks,
  waitForCondition: global.waitForCondition,
  enhancedWaitFor: global.enhancedWaitFor,
  
  // Constants
  FHIR_RESOURCE_TYPES: global.FHIR_RESOURCE_TYPES,
};

// Database setup for tests
require('./test-utils/test-db-setup.js');
