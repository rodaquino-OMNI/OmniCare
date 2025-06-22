'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { serviceWorkerManager } from '@/lib/service-worker';
import { showNotification } from '@mantine/notifications';

interface ServiceWorkerProviderProps {
  children: ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register service worker
    serviceWorkerManager.register({
      onUpdate: () => {
        console.log('[ServiceWorker] Update available');
      },
      onOffline: () => {
        console.log('[ServiceWorker] App is offline');
      },
      onOnline: () => {
        console.log('[ServiceWorker] App is back online');
        // Refresh data when coming back online
        router.refresh();
      },
      onBackgroundSync: () => {
        console.log('[ServiceWorker] Background sync completed');
        // Refresh current page data
        router.refresh();
      },
    }).then((success) => {
      if (success) {
        console.log('[ServiceWorker] Successfully registered');
      }
    });

    // Cleanup on unmount
    return () => {
      // Service worker remains registered across page loads
      // Only unregister if explicitly needed
    };
  }, [router]);

  return <>{children}</>;
}