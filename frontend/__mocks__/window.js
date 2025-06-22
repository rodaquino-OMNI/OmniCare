// Mock browser APIs that Mantine needs
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

// Set up global mocks
global.window = Object.assign(global.window || {}, {
  matchMedia: jest.fn().mockImplementation(createMockMediaQuery),
  getComputedStyle: jest.fn(() => ({
    getPropertyValue: jest.fn(() => ''),
  })),
  scrollTo: jest.fn(),
  IntersectionObserver: jest.fn(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  })),
  ResizeObserver: jest.fn(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  })),
});

module.exports = {};