'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { serviceWorkerManager } from '@/lib/service-worker';

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
        // Service worker update available
      },
      onOffline: () => {
        // App is offline
      },
      onOnline: () => {
        // App is back online
        // Refresh data when coming back online
        router.refresh();
      },
      onBackgroundSync: () => {
        // Background sync completed
        // Refresh current page data
        router.refresh();
      },
    }).then((success) => {
      if (success) {
        // Service worker successfully registered
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