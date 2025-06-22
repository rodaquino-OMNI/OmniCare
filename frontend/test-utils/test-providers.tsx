import React from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Ensure matchMedia is mocked before any Mantine components use it
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query || '',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// Create test theme compatible with Mantine v7
const testTheme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
  colorScheme: 'light',
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'xs',
        radius: 'md',
      },
    },
  },
});

// Create test query client
const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <MantineProvider theme={testTheme} defaultColorScheme="light">
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
}