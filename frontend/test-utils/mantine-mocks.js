// Mantine-specific mocks that must be set up before importing any Mantine components

// Mock matchMedia
const createMockMediaQuery = (query) => ({
  matches: false,
  media: query || '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

// Ensure window.matchMedia is mocked before Mantine components are imported
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = jest.fn((query) => createMockMediaQuery(query));
}

// Mock getComputedStyle if not already present
if (typeof window !== 'undefined' && !window.getComputedStyle) {
  window.getComputedStyle = jest.fn(() => ({
    getPropertyValue: jest.fn(() => ''),
  }));
}

// Mock scrollTo
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = jest.fn();
}

// Mock IntersectionObserver
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  window.IntersectionObserver = jest.fn(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  }));
}

// Mock ResizeObserver
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  }));
}

module.exports = {};