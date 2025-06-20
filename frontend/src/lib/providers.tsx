'use client';

import { ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { MedplumProvider } from '@medplum/react';
import { MANTINE_THEME } from '@/constants/theme';
import { medplumClient } from './medplum';

// Import Mantine styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/charts/styles.css';

// Import Medplum styles
import '@medplum/react/styles.css';

// Create custom Mantine theme
const theme = createTheme({
  ...MANTINE_THEME,
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'xs',
        radius: 'md',
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
    MultiSelect: {
      defaultProps: {
        size: 'sm',
      },
    },
    Textarea: {
      defaultProps: {
        size: 'sm',
        autosize: true,
        minRows: 2,
      },
    },
    DateInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        withTableBorder: true,
        verticalSpacing: 'sm',
        horizontalSpacing: 'md',
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 3 },
        transitionProps: { transition: 'fade', duration: 200 },
      },
    },
    Drawer: {
      defaultProps: {
        overlayProps: { backgroundOpacity: 0.55, blur: 3 },
        transitionProps: { transition: 'slide-right', duration: 200 },
      },
    },
    Badge: {
      defaultProps: {
        size: 'sm',
        radius: 'sm',
      },
    },
    Anchor: {
      defaultProps: {
        underline: 'hover',
      },
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        position: 'top',
        transition: 'fade',
      },
    },
    Popover: {
      defaultProps: {
        withArrow: true,
        shadow: 'md',
        radius: 'md',
      },
    },
    Menu: {
      defaultProps: {
        shadow: 'md',
        radius: 'md',
        withArrow: true,
      },
    },
    ActionIcon: {
      defaultProps: {
        size: 'sm',
        variant: 'subtle',
      },
    },
    Avatar: {
      defaultProps: {
        size: 'sm',
        radius: 'xl',
      },
    },
    Progress: {
      defaultProps: {
        size: 'sm',
        radius: 'xl',
      },
    },
    Alert: {
      defaultProps: {
        radius: 'md',
      },
    },
    Tabs: {
      defaultProps: {
        variant: 'outline',
        radius: 'md',
      },
    },
    Accordion: {
      defaultProps: {
        variant: 'separated',
        radius: 'md',
      },
    },
    Stepper: {
      defaultProps: {
        size: 'sm',
        radius: 'md',
      },
    },
    Timeline: {
      defaultProps: {
        bulletSize: 20,
        lineWidth: 2,
      },
    },
    Spotlight: {
      defaultProps: {
        radius: 'md',
        shadow: 'lg',
      },
    },
  },
});

// Create Query Client with healthcare-specific defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MedplumProvider medplum={medplumClient}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <ModalsProvider
            modalProps={{
              centered: true,
              overlayProps: { backgroundOpacity: 0.55, blur: 3 },
              transitionProps: { transition: 'fade', duration: 200 },
            }}
          >
            <Notifications
              position="top-right"
              autoClose={5000}
              limit={5}
              containerWidth={400}
            />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </MedplumProvider>
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom-right"
        buttonPosition="bottom-right"
      />
    </QueryClientProvider>
  );
}

// Custom hook for accessing the query client
export { queryClient };