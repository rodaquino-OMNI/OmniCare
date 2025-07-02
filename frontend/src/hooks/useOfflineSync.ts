import { useState, useEffect, useCallback } from 'react';
import { useServiceWorker } from '@/lib/service-worker';
import { useOfflineFHIR } from '@/services/offline-fhir.service';
import { notifications } from '@mantine/notifications';
import { useOfflineSyncService } from '@/components/providers/OfflineSyncProvider';

interface OfflineSyncOptions {
  autoSync?: boolean;
  syncInterval?: number;
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

export function useOfflineSync(options: OfflineSyncOptions = {}) {
  const {
    autoSync = true,
    syncInterval = 30000, // 30 seconds
    onSyncComplete,
    onSyncError,
  } = options;

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'complete' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);

  const { isOffline, queueForSync } = useServiceWorker();
  const { service: fhirService } = useOfflineFHIR();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = async () => {
      if (autoSync && pendingChanges > 0) {
        await performSync();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autoSync, pendingChanges]);

  // Periodic sync check
  useEffect(() => {
    if (!autoSync || isOffline) return;

    const interval = setInterval(() => {
      checkPendingChanges();
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, isOffline, syncInterval]);

  const checkPendingChanges = useCallback(async () => {
    try {
      const status = await fhirService.getOfflineStatus();
      setPendingChanges(status.pendingSync);
    } catch (error) {
      console.error('Failed to check pending changes:', error);
    }
  }, [fhirService]);

  const performSync = useCallback(async () => {
    if (isSyncing || isOffline) return;

    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      // Trigger service worker sync
      const sw = navigator.serviceWorker.controller;
      if (sw) {
        sw.postMessage({ type: 'sync-now' });
      }

      // Wait for sync to complete (with timeout)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Sync timeout'));
        }, 60000); // 1 minute timeout

        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'sync-complete') {
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener('message', messageHandler);
            resolve(true);
          }
        };

        navigator.serviceWorker.addEventListener('message', messageHandler);
      });

      setSyncStatus('complete');
      setLastSyncTime(new Date());
      setPendingChanges(0);
      
      notifications.show({
        title: 'Sync Complete',
        message: 'All changes have been synchronized',
        color: 'green',
      });

      onSyncComplete?.();
    } catch (error) {
      setSyncStatus('error');
      console.error('Sync failed:', error);
      
      notifications.show({
        title: 'Sync Failed',
        message: 'Unable to sync changes. Will retry when connection is stable.',
        color: 'red',
      });

      onSyncError?.(error as Error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOffline, onSyncComplete, onSyncError]);

  const queueChange = useCallback(async (data: any) => {
    const id = await queueForSync(data);
    setPendingChanges((prev) => prev + 1);
    return id;
  }, [queueForSync]);

  return {
    isOffline,
    isSyncing,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    performSync,
    queueChange,
    checkPendingChanges,
  };
}

// Hook for offline-aware data fetching
export function useOfflineData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    cacheTime?: number;
    staleTime?: number;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const { isOffline } = useServiceWorker();
  const { service: fhirService } = useOfflineFHIR();

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (isOffline) {
          // Try to get from cache
          const cached = await getCachedData(key);
          if (cached) {
            if (mounted) {
              setData(cached.data);
              setIsStale(isDataStale(cached.timestamp, options?.staleTime));
            }
          } else {
            throw new Error('No cached data available');
          }
        } else {
          // Fetch fresh data
          const freshData = await fetcher();
          if (mounted) {
            setData(freshData);
            setIsStale(false);
            // Cache the data
            await cacheData(key, freshData);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          options?.onError?.(err as Error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [key, isOffline]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch: () => {
      setIsLoading(true);
      setError(null);
    },
  };
}

// Helper functions for caching
async function getCachedData(key: string): Promise<{ data: any; timestamp: number } | null> {
  try {
    const cached = localStorage.getItem(`offline-cache-${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function cacheData(key: string, data: any): Promise<void> {
  try {
    localStorage.setItem(
      `offline-cache-${key}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error('Failed to cache data:', error);
  }
}

function isDataStale(timestamp: number, staleTime: number = 5 * 6 * 1000): boolean {
  return Date.now() - timestamp > staleTime;
}