'use client';

import dynamic from 'next/dynamic';
import { Skeleton, Card, Stack, Group, Box, Center, Loader, Text } from '@mantine/core';

// Loading components for better UX during code splitting
const ComponentLoading = ({ height = 200 }: { height?: number }) => (
  <Card withBorder>
    <Stack gap="md">
      <Group gap="sm">
        <Skeleton height={40} circle />
        <Box style={{ flex: 1 }}>
          <Skeleton height={16} width="60%" mb="xs" />
          <Skeleton height={12} width="40%" />
        </Box>
      </Group>
      <Skeleton height={height} />
    </Stack>
  </Card>
);

const TableLoading = () => (
  <Card withBorder>
    <Stack gap="xs">
      <Group gap="sm" mb="md">
        <Skeleton height={20} width="20%" />
        <Skeleton height={20} width="15%" />
        <Skeleton height={20} width="25%" />
      </Group>
      {Array.from({ length: 5 }).map((_, index) => (
        <Group key={index} gap="sm">
          <Skeleton height={16} width="20%" />
          <Skeleton height={16} width="15%" />
          <Skeleton height={16} width="25%" />
          <Skeleton height={16} width="10%" />
        </Group>
      ))}
    </Stack>
  </Card>
);

const FormLoading = () => (
  <Card withBorder>
    <Stack gap="md">
      <Skeleton height={16} width="30%" />
      <Skeleton height={40} />
      <Skeleton height={16} width="25%" />
      <Skeleton height={40} />
      <Skeleton height={16} width="20%" />
      <Skeleton height={100} />
      <Group gap="sm" justify="flex-end">
        <Skeleton height={36} width={80} />
        <Skeleton height={36} width={100} />
      </Group>
    </Stack>
  </Card>
);

const FullPageLoading = ({ message = 'Loading...' }: { message?: string }) => (
  <Center style={{ height: '50vh' }}>
    <Stack align="center" gap="md">
      <Loader size="lg" />
      <Text c="dimmed">{message}</Text>
    </Stack>
  </Center>
);

// Lazy-loaded components with optimized loading states

// Clinical Components (Heavy dependencies)
export const LazyClinicalNoteInput = dynamic(
  () => import('@/components/clinical/ClinicalNoteInput'),
  {
    loading: () => <FormLoading />,
    ssr: false, // Clinical components are interactive
  }
);

export const LazyTaskBoard = dynamic(
  () => import('@/components/clinical/TaskBoard').then(mod => ({ default: mod.TaskBoard })),
  {
    loading: () => <ComponentLoading height={400} />,
    ssr: false,
  }
);

// Patient Components
export const LazyEnhancedPatientList = dynamic(
  () => import('@/components/patient/EnhancedPatientList'),
  {
    loading: () => <TableLoading />,
    ssr: true, // Patient lists can be server-rendered
  }
);

export const LazyVirtualizedPatientList = dynamic(
  () => import('@/components/patient/VirtualizedPatientList'),
  {
    loading: () => <TableLoading />,
    ssr: false, // Virtual scrolling requires client-side
  }
);

export const LazyPatientSummary = dynamic(
  () => import('@/components/patient/PatientSummary'),
  {
    loading: () => <ComponentLoading />,
    ssr: true,
  }
);

// Admin Components (Rarely used)
export const LazyPatientRegistration = dynamic(
  () => import('@/components/admin/PatientRegistration'),
  {
    loading: () => <FormLoading />,
    ssr: false,
  }
);

// Performance Components (Dev only)
export const LazyPerformanceMonitor = dynamic(
  () => import('@/components/performance/PerformanceMonitor'),
  {
    loading: () => null, // No loading state for monitoring
    ssr: false,
  }
);

// Sync Components (Offline functionality)
export const LazyConflictResolutionModal = dynamic(
  () => import('@/components/sync/ConflictResolutionModal'),
  {
    loading: () => (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    ),
    ssr: false,
  }
);

export const LazySyncProgressIndicator = dynamic(
  () => import('@/components/offline/SyncProgressIndicator'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Results Components (Charts and complex visualizations)
export const LazyLabResults = dynamic(
  () => import('@/components/results/LabResults'),
  {
    loading: () => <ComponentLoading height={300} />,
    ssr: false, // Charts need client-side rendering
  }
);

// Network Components
export const LazyNetworkAwareImage = dynamic(
  () => import('@/components/network/NetworkAwareImage'),
  {
    loading: () => <Skeleton height={200} />,
    ssr: false,
  }
);

// Cache Management (Admin functionality)
export const LazyCacheManager = dynamic(
  () => import('@/components/cache/CacheManager'),
  {
    loading: () => <ComponentLoading height={500} />,
    ssr: false,
  }
);

// Page-level lazy components for route-based code splitting
export const LazyDashboardPage = dynamic(
  () => import('@/app/dashboard/page'),
  {
    loading: () => <FullPageLoading message="Loading Dashboard..." />,
    ssr: true,
  }
);

export const LazyClinicalPage = dynamic(
  () => import('@/app/clinical/page').catch(() => ({ default: () => null })),
  {
    loading: () => <FullPageLoading message="Loading Clinical Tools..." />,
    ssr: false,
  }
);

export const LazyPatientsPage = dynamic(
  () => import('@/app/patients/page').catch(() => ({ default: () => null })),
  {
    loading: () => <FullPageLoading message="Loading Patients..." />,
    ssr: true,
  }
);

export const LazyReportsPage = dynamic(
  () => import('@/app/reports/page').catch(() => ({ default: () => null })),
  {
    loading: () => <FullPageLoading message="Loading Reports..." />,
    ssr: false,
  }
);

export const LazySchedulingPage = dynamic(
  () => import('@/app/scheduling/page').catch(() => ({ default: () => null })),
  {
    loading: () => <FullPageLoading message="Loading Scheduling..." />,
    ssr: false,
  }
);

// Utility for preloading components on user interaction
export const preloadComponent = (componentImport: () => Promise<any>) => {
  componentImport().catch(error => {
    console.warn('Failed to preload component:', error);
  });
};

// Preload critical components on hover/focus
export const usePreloadOnInteraction = (componentImport: () => Promise<any>) => {
  const handleMouseEnter = () => preloadComponent(componentImport);
  const handleFocus = () => preloadComponent(componentImport);
  
  return {
    onMouseEnter: handleMouseEnter,
    onFocus: handleFocus,
  };
};

// Bundle analysis helper (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Log dynamic imports for bundle analysis
  const originalImport = window.__webpack_require__;
  if (originalImport) {
    console.log('🔄 Dynamic imports configured for code splitting');
  }
}

export default {
  LazyClinicalNoteInput,
  LazyTaskBoard,
  LazyEnhancedPatientList,
  LazyVirtualizedPatientList,
  LazyPatientSummary,
  LazyPatientRegistration,
  LazyPerformanceMonitor,
  LazyConflictResolutionModal,
  LazySyncProgressIndicator,
  LazyLabResults,
  LazyNetworkAwareImage,
  LazyCacheManager,
  LazyDashboardPage,
  LazyClinicalPage,
  LazyPatientsPage,
  LazyReportsPage,
  LazySchedulingPage,
  preloadComponent,
  usePreloadOnInteraction,
};