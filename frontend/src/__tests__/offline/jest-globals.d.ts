// TypeScript declarations for Jest globals in test files
// This prevents auto-import of vitest types

declare global {
  // Jest globals
  const describe: jest.Describe;
  const it: jest.It;
  const test: jest.It;
  const expect: jest.Expect;
  const beforeAll: jest.Lifecycle;
  const afterAll: jest.Lifecycle;
  const beforeEach: jest.Lifecycle;
  const afterEach: jest.Lifecycle;
  const jest: typeof import('jest');
  const vi: typeof jest; // Alias for compatibility

  // Mock types
  type Mock = jest.Mock;
  type SpyInstance = jest.SpyInstance;
  type MockedFunction<T> = jest.MockedFunction<T>;
  type MockedClass<T> = jest.MockedClass<T>;
}

export {};