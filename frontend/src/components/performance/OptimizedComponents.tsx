'use client';

import dynamic from 'next/dynamic';
import { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Skeleton, 
  Stack, 
  Group, 
  Box, 
  Center, 
  Loader, 
  Text,
  Button,
  Alert
} from '@mantine/core';
import { IconAlertTriangle, IconWifi, IconWifiOff } from '@tabler/icons-react';

// Enhanced loading states with performance optimization
const OptimizedSkeleton = ({ height = 200, rows = 3 }: { height?: number; rows?: number }) => (
  <Card withBorder p="md">
    <Stack gap="sm">
      {Array.from({ length: rows }).map((_, index) => (
        <Group key={index} gap="sm">
          <Skeleton height={20} circle />
          <Box style={{ flex: 1 }}>
            <Skeleton height={14} width="60%" mb="xs" />
            <Skeleton height={12} width="40%" />
          </Box>
        </Group>
      ))}
      <Skeleton height={height} mt="md" />
    </Stack>
  </Card>
);

const ComponentErrorBoundary = ({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (hasError) {
    return fallback || (
      <Alert icon={<IconAlertTriangle size={16} />} color="red">
        Component failed to load. Please refresh the page.
      </Alert>
    );
  }

  return <>{children}</>;
};

// Network-aware lazy loading
const NetworkAwareLazy = ({ 
  importFn, 
  children,
  fallback,
  offlineComponent 
}: {
  importFn: () => Promise<any>;
  children: React.ComponentType<any>;
  fallback?: React.ReactNode;
  offlineComponent?: React.ComponentType<any>;
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [loadAttempted, setLoadAttempted] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setLoadAttempted(false);
    window.location.reload();
  }, []);

  if (!isOnline && !loadAttempted) {
    const OfflineComponent = offlineComponent;
    return OfflineComponent ? (
      <OfflineComponent />
    ) : (
      <Alert 
        icon={<IconWifiOff size={16} />} 
        color="orange"
        title="You're offline"
      >
        <Text size="sm" mb="md">
          Some features may not be available while offline.
        </Text>
        <Button size="xs" onClick={handleRetry}>
          Retry when online
        </Button>
      </Alert>
    );
  }

  return (
    <ComponentErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback || <OptimizedSkeleton />}>
        {children}
      </Suspense>
    </ComponentErrorBoundary>
  );
};

// Performance-optimized lazy components with intelligent loading
export const OptimizedLazyPatientList = dynamic(
  () => import('@/components/patient/VirtualizedPatientList').then(mod => {
    // Preload critical dependencies
    import('@/components/patient/PatientSummary');
    return mod;
  }),
  {
    loading: () => <OptimizedSkeleton height={400} rows={5} />,
    ssr: false, // Virtual scrolling requires client-side
  }
);

export const OptimizedLazyClinicalNoteInput = dynamic(
  () => import('@/components/clinical/ClinicalNoteInput').then(mod => {
    // Preload related components that are likely to be used
    import('@/components/clinical/TemplateManager');
    import('@/components/clinical/AttachmentManager');
    return mod;
  }),
  {
    loading: () => <OptimizedSkeleton height={300} rows={4} />,
    ssr: false,
  }
);

export const OptimizedLazyTaskBoard = dynamic(
  () => import('@/components/clinical/TaskBoard').then(mod => {
    // Preload drag-and-drop dependencies
    return { default: mod.TaskBoard };
  }),
  {
    loading: () => <OptimizedSkeleton height={500} rows={6} />,
    ssr: false,
  }
);

// Dashboard components with intelligent bundling
export const OptimizedLazyDashboardCharts = dynamic(
  () => import('@/components/dashboard/DashboardCharts'),
  {
    loading: () => <OptimizedSkeleton height={300} rows={3} />,
    ssr: false, // Charts need client-side rendering
  }
);

export const OptimizedLazyReportsGenerator = dynamic(
  () => import('@/components/reports/ReportsGenerator'),
  {
    loading: () => <OptimizedSkeleton height={400} rows={5} />,
    ssr: false,
  }
);

// Admin components (rarely used, heavily optimized)
export const OptimizedLazyAdminPanel = dynamic(
  () => import('@/components/admin/AdminPanel'),
  {
    loading: () => (
      <Center p="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading administration panel...</Text>
        </Stack>
      </Center>
    ),
    ssr: false,
  }
);

// PWA-specific optimized components
export const OptimizedLazyOfflineManager = dynamic(
  () => import('@/components/offline/OfflineManager'),
  {
    loading: () => null, // No loading state for offline manager
    ssr: false,
  }
);

export const OptimizedLazySyncManager = dynamic(
  () => import('@/components/sync/SyncManager'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Mobile-optimized components
export const OptimizedLazyMobileNavigation = dynamic(
  () => import('@/components/mobile/MobileNavigation'),
  {
    loading: () => <Skeleton height={60} />,
    ssr: true, // Navigation can be server-rendered
  }
);

export const OptimizedLazyTouchControls = dynamic(
  () => import('@/components/mobile/TouchControls'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Performance monitoring with lazy loading
export const OptimizedLazyPerformanceMonitor = dynamic(
  () => import('@/components/performance/PerformanceMonitor'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Preloading utilities for improved performance
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be needed soon
  if (typeof window !== 'undefined') {
    import('@/components/patient/VirtualizedPatientList');
    import('@/components/clinical/ClinicalNoteInput');
    import('@/components/auth/LoginForm');
  }
};

export const preloadComponentOnInteraction = (
  componentImport: () => Promise<any>,
  triggerElement: HTMLElement | null
) => {
  if (!triggerElement) return;

  const preload = () => {
    componentImport().catch(error => {
      console.warn('Failed to preload component:', error);
    });
  };

  // Preload on hover with a small delay
  let timeoutId: NodeJS.Timeout;
  const handleMouseEnter = () => {
    timeoutId = setTimeout(preload, 200);
  };
  
  const handleMouseLeave = () => {
    clearTimeout(timeoutId);
  };

  triggerElement.addEventListener('mouseenter', handleMouseEnter);
  triggerElement.addEventListener('mouseleave', handleMouseLeave);
  triggerElement.addEventListener('focus', preload);

  // Return cleanup function
  return () => {
    triggerElement.removeEventListener('mouseenter', handleMouseEnter);
    triggerElement.removeEventListener('mouseleave', handleMouseLeave);
    triggerElement.removeEventListener('focus', preload);
    clearTimeout(timeoutId);
  };
};

// Bundle splitting configuration for optimal loading
export const getOptimalBundleSplit = () => {
  return {
    // Core components (loaded immediately)
    core: [
      '@/components/auth/ProtectedRoute',
      '@/components/layout/AppLayout',
      '@/components/ui/OfflineIndicator',
    ],
    
    // Patient management (high priority)
    patient: [
      '@/components/patient/VirtualizedPatientList',
      '@/components/patient/PatientSummary',
      '@/components/patient/PatientHeader',
    ],
    
    // Clinical tools (medium priority)
    clinical: [
      '@/components/clinical/ClinicalNoteInput',
      '@/components/clinical/TaskBoard',
      '@/components/clinical/TemplateManager',
    ],
    
    // Reports and analytics (low priority)
    reports: [
      '@/components/reports/ReportsGenerator',
      '@/components/dashboard/DashboardCharts',
    ],
    
    // Admin tools (very low priority)
    admin: [
      '@/components/admin/AdminPanel',
      '@/components/admin/UserManagement',
    ],
  };
};

// Performance tracking for lazy-loaded components
const componentLoadTimes: Record<string, number> = {};

export const trackComponentLoadTime = (componentName: string) => {
  const startTime = performance.now();
  
  return () => {
    const loadTime = performance.now() - startTime;
    componentLoadTimes[componentName] = loadTime;
    
    // Log slow-loading components
    if (loadTime > 1000) {
      console.warn(`Slow component load: ${componentName} took ${loadTime.toFixed(2)}ms`);
    }
    
    // Send to performance monitoring
    if (typeof window !== 'undefined' && window.navigator?.sendBeacon) {
      window.navigator.sendBeacon('/api/performance', JSON.stringify({
        type: 'component_load',
        component: componentName,
        loadTime,
        timestamp: Date.now()
      }));
    }
  };
};

export default {
  OptimizedLazyPatientList,
  OptimizedLazyClinicalNoteInput,
  OptimizedLazyTaskBoard,
  OptimizedLazyDashboardCharts,
  OptimizedLazyReportsGenerator,
  OptimizedLazyAdminPanel,
  OptimizedLazyOfflineManager,
  OptimizedLazySyncManager,
  OptimizedLazyMobileNavigation,
  OptimizedLazyTouchControls,
  OptimizedLazyPerformanceMonitor,
  preloadCriticalComponents,
  preloadComponentOnInteraction,
  getOptimalBundleSplit,
  trackComponentLoadTime,
};