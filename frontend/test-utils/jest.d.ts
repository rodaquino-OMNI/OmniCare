// Jest global type declarations for test files
/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  var renderWithProviders: (ui: React.ReactElement, options?: any) => any;
  var vi: typeof jest; // vi is an alias for jest

  interface Window {
    matchMedia: jest.Mock;
    scrollTo: jest.Mock;
    localStorage: {
      getItem: jest.Mock;
      setItem: jest.Mock;
      removeItem: jest.Mock;
      clear: jest.Mock;
    };
    sessionStorage: {
      getItem: jest.Mock;
      setItem: jest.Mock;
      removeItem: jest.Mock;
      clear: jest.Mock;
    };
  }

  interface Navigator {
    serviceWorker: {
      register: jest.Mock;
      ready: Promise<any>;
      controller: any;
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
      getRegistrations: jest.Mock;
      getRegistration: jest.Mock;
    };
    onLine: boolean;
    clipboard: {
      writeText: jest.Mock;
      readText: jest.Mock;
      write: jest.Mock;
      read: jest.Mock;
    };
    share: jest.Mock;
    geolocation: {
      getCurrentPosition: jest.Mock;
      watchPosition: jest.Mock;
      clearWatch: jest.Mock;
    };
  }

  var caches: {
    open: jest.Mock;
    has: jest.Mock;
    delete: jest.Mock;
    keys: jest.Mock;
    match: jest.Mock;
  };
}

export {};