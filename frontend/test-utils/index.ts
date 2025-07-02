/**
 * Test utilities index file
 * Re-exports all test utilities for easy importing
 */

// Re-export everything from test-providers
export * from './test-providers';

// Re-export common testing libraries
export * from '@testing-library/react';
export * from '@testing-library/jest-dom';
export * from '@testing-library/user-event';

// Re-export type definitions
export * from '../src/types/test-utils';

// Additional test utilities
export { default as userEvent } from '@testing-library/user-event';

// Mock data generators
import { faker } from '@faker-js/faker';

export const generateMockUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  role: 'practitioner' as const,
  permissions: [],
  isMfaEnabled: false,
  passwordChangedAt: new Date(),
  failedLoginAttempts: 0,
  isActive: true,
  ...overrides,
});

export const generateMockPatient = (overrides = {}) => ({
  resourceType: 'Patient' as const,
  id: faker.string.uuid(),
  name: [{
    given: [faker.person.firstName()],
    family: faker.person.lastName(),
  }],
  birthDate: faker.date.past({ years: 50 }).toISOString().split('T')[0],
  gender: faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female',
  telecom: [{
    system: 'email' as const,
    value: faker.internet.email(),
  }],
  address: [{
    line: [faker.location.streetAddress()],
    city: faker.location.city(),
    state: faker.location.state(),
    postalCode: faker.location.zipCode(),
    country: 'US',
  }],
  ...overrides,
});

export const generateMockPractitioner = (overrides = {}) => ({
  resourceType: 'Practitioner' as const,
  id: faker.string.uuid(),
  name: [{
    given: [faker.person.firstName()],
    family: faker.person.lastName(),
    prefix: ['Dr.'],
  }],
  telecom: [{
    system: 'email' as const,
    value: faker.internet.email(),
  }],
  qualification: [{
    code: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
        code: 'MD',
        display: 'Medical Doctor',
      }],
    },
  }],
  ...overrides,
});

// Test setup utilities
export const setupTestEnvironment = () => {
  // Mock console methods to reduce noise in tests
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeAll(() => {
    console.error = jest.fn((message) => {
      // Only log actual errors, not React warnings
      if (!message?.toString().includes('Warning:')) {
        originalError(message);
      }
    });
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock requestAnimationFrame
  global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
  global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));
};

// Common test patterns
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

export const expectToBeInTheDocument = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument();
};

export const expectNotToBeInTheDocument = (element: HTMLElement | null) => {
  expect(element).not.toBeInTheDocument();
};

// Accessibility testing helpers
export const testAccessibility = async (container: HTMLElement) => {
  const { axe } = await import('jest-axe');
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now();
  renderFn();
  await waitForLoadingToFinish();
  const end = performance.now();
  return end - start;
};

// Snapshot testing helpers
export const expectMatchSnapshot = (component: any) => {
  expect(component).toMatchSnapshot();
};

// Error boundary testing
export const expectErrorBoundaryToShow = (container: HTMLElement) => {
  const errorBoundary = container.querySelector('[data-testid="error-boundary"]');
  expect(errorBoundary).toBeInTheDocument();
};

// Form testing utilities
export const fillForm = async (form: HTMLFormElement, data: Record<string, string>) => {
  const user = userEvent.setup();
  
  for (const [field, value] of Object.entries(data)) {
    const input = form.querySelector(`[name="${field}"]`) as HTMLInputElement;
    if (input) {
      await user.clear(input);
      await user.type(input, value);
    }
  }
};

export const submitForm = async (form: HTMLFormElement) => {
  const user = userEvent.setup();
  const submitButton = form.querySelector('[type="submit"]') as HTMLButtonElement;
  if (submitButton) {
    await user.click(submitButton);
  }
};

// Network testing utilities
export const mockNetworkError = () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
  return () => {
    global.fetch = originalFetch;
  };
};

export const mockNetworkDelay = (delay: number) => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockImplementation((...args) => 
    new Promise(resolve => 
      setTimeout(() => resolve(originalFetch(...args)), delay)
    )
  );
  return () => {
    global.fetch = originalFetch;
  };
};

// Clean up utilities
export const cleanupAfterEach = () => {
  afterEach(() => {
    jest.clearAllMocks();
    // Clear any cached data if needed
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  });
};

export const cleanupAfterAll = () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });
};