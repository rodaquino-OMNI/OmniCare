import React, { ErrorInfo, ReactNode, Suspense } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MedplumProvider } from '@medplum/react';
import { MedplumClient } from '@medplum/core';
import { ModalsProvider } from '@mantine/modals';
import { DatesProvider } from '@mantine/dates';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';

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
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
        variant: 'filled',
      },
      styles: {
        root: {
          transition: 'all 150ms ease',
        },
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'xs',
        radius: 'md',
        p: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Select: {
      defaultProps: {
        size: 'sm',
      },
    },
    Modal: {
      defaultProps: {
        size: 'md',
        centered: true,
      },
    },
    Notification: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
  other: {
    // Custom theme properties for testing
    testMode: true,
  },
});

// Error Boundary for better test error handling
class TestErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Test Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div role="alert" data-testid="error-boundary">
            <h2>Test Error</h2>
            <pre>{this.state.error?.message}</pre>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Loading fallback component
const TestLoadingFallback = () => (
  <div data-testid="loading-fallback" role="status" aria-busy="true">
    Loading...
  </div>
);

// Create test query client factory
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
    mutations: {
      retry: false,
    },
  },
  // Suppress console errors in tests removed - not supported in newer versions
});

// Create test Medplum client factory with comprehensive mocking
const createTestMedplumClient = () => {
  const mockStorage = {
    getObject: jest.fn().mockReturnValue(null),
    setObject: jest.fn(),
    removeObject: jest.fn(),
    clear: jest.fn(),
    getString: jest.fn().mockReturnValue(null),
    setString: jest.fn(),
  };

  const client = new MedplumClient({
    baseUrl: 'https://api.medplum.com/',
    clientId: 'test-client-id',
    storage: mockStorage,
    fetch: jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(''),
      headers: new Headers(),
    }) as any,
  });

  // Mock common methods
  (client as any).readResource = jest.fn().mockResolvedValue({});
  (client as any).createResource = jest.fn().mockResolvedValue({});
  (client as any).updateResource = jest.fn().mockResolvedValue({});
  (client as any).deleteResource = jest.fn().mockResolvedValue({});
  (client as any).searchResources = jest.fn().mockResolvedValue([]);
  (client as any).getProfile = jest.fn().mockResolvedValue({
    resourceType: 'Practitioner',
    id: 'test-practitioner',
  });
  (client as any).request = jest.fn().mockResolvedValue({});
  (client as any).isAuthenticated = jest.fn().mockReturnValue(true);
  (client as any).getActiveLogin = jest.fn().mockReturnValue({
    profile: { reference: 'Practitioner/test-practitioner' },
    project: { reference: 'Project/test-project' },
  });

  return client;
};

// Mock router context for Next.js apps
const MockRouterContext = ({ children }: { children: ReactNode }) => {
  // Mock router implementation if needed
  return <>{children}</>;
};

// Test provider props
interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  medplumClient?: MedplumClient;
  medplum?: MedplumClient; // Support legacy prop name
  withErrorBoundary?: boolean;
  withSuspense?: boolean;
  withRouter?: boolean;
  initialEntries?: string[];
}

// Main test providers component with all features
export function TestProviders({ 
  children, 
  queryClient = createTestQueryClient(),
  medplumClient,
  medplum,
  withErrorBoundary = true,
  withSuspense = true,
  withRouter = false,
}: TestProvidersProps) {
  // Support both medplum and medplumClient props
  const client = medplum || medplumClient || createTestMedplumClient();
  let content = children;
  
  // Wrap with router if needed
  if (withRouter) {
    content = <MockRouterContext>{content}</MockRouterContext>;
  }
  
  // Core providers structure
  content = (
    <QueryClientProvider client={queryClient}>
      <MedplumProvider medplum={client}>
        <MantineProvider theme={testTheme} defaultColorScheme="light">
          <DatesProvider settings={{ locale: 'en', firstDayOfWeek: 0, weekendDays: [0, 6] }}>
            <ModalsProvider>
              {content}
              <Notifications position="top-right" zIndex={1000} />
            </ModalsProvider>
          </DatesProvider>
        </MantineProvider>
      </MedplumProvider>
    </QueryClientProvider>
  );
  
  // Add Suspense wrapper if requested
  if (withSuspense) {
    content = (
      <Suspense fallback={<TestLoadingFallback />}>
        {content}
      </Suspense>
    );
  }
  
  // Add error boundary if requested
  if (withErrorBoundary) {
    content = (
      <TestErrorBoundary>
        {content}
      </TestErrorBoundary>
    );
  }
  
  return content;
}

// Individual provider wrappers for specific tests
export const WithMantine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider theme={testTheme} defaultColorScheme="light">
    {children}
  </MantineProvider>
);

export const WithQueryClient: React.FC<{ children: React.ReactNode; client?: QueryClient }> = ({ 
  children, 
  client = createTestQueryClient() 
}) => (
  <QueryClientProvider client={client}>
    {children}
  </QueryClientProvider>
);

export const WithMedplum: React.FC<{ children: React.ReactNode; client?: MedplumClient }> = ({ 
  children, 
  client = createTestMedplumClient() 
}) => (
  <MedplumProvider medplum={client}>
    {children}
  </MedplumProvider>
);

export const WithNotifications: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider theme={testTheme}>
    {children}
    <Notifications />
  </MantineProvider>
);

export const WithModals: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider theme={testTheme}>
    <ModalsProvider>
      {children}
    </ModalsProvider>
  </MantineProvider>
);

// Mock data provider for consistent test data
export const MockDataProvider: React.FC<{ children: React.ReactNode; mockData?: any }> = ({ 
  children, 
  mockData = {} 
}) => {
  const contextValue = React.useMemo(() => ({
    patients: mockData.patients || [],
    practitioners: mockData.practitioners || [],
    encounters: mockData.encounters || [],
    observations: mockData.observations || [],
    conditions: mockData.conditions || [],
    medications: mockData.medications || [],
    organizations: mockData.organizations || [],
  }), [mockData]);
  
  // Create a mock context if needed
  return <>{children}</>;
};

// Test utilities for creating mock contexts
export const createMockAuthContext = (overrides = {}) => ({
  user: {
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'practitioner',
  },
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  ...overrides,
});

export const createMockNotificationContext = () => ({
  showNotification: jest.fn(),
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  hideNotification: jest.fn(),
  cleanNotifications: jest.fn(),
});

// Helper to reset all mock clients
export const resetTestClients = () => {
  jest.clearAllMocks();
  // Clear any cached data
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }
};

// Custom render function with providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    queryClient?: QueryClient;
    medplumClient?: MedplumClient;
    withErrorBoundary?: boolean;
    withSuspense?: boolean;
    withRouter?: boolean;
  }
) {
  const {
    queryClient = createTestQueryClient(),
    medplumClient = createTestMedplumClient(),
    ...providerOptions
  } = options || {};

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestProviders
      queryClient={queryClient}
      medplumClient={medplumClient}
      {...providerOptions}
    >
      {children}
    </TestProviders>
  );

  // Import render from @testing-library/react
  const { render } = require('@testing-library/react');
  return render(ui, { wrapper: Wrapper });
}

// Export utilities
export { 
  createTestQueryClient, 
  createTestMedplumClient,
  TestErrorBoundary,
  TestLoadingFallback,
  testTheme,
};