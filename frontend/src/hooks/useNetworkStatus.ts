'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSyncStore } from '@/stores/sync';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  connectionQuality: 'good' | 'poor' | 'offline';
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    connectionQuality: 'good'
  });

  const { triggerSync } = useSyncStore();

  const updateNetworkStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    const wasOffline = !status.isOnline && isOnline;

    // Get connection quality if available
    let connectionQuality: 'good' | 'poor' | 'offline' = 'offline';
    let effectiveType: string | undefined;
    let downlink: number | undefined;
    let rtt: number | undefined;

    if (isOnline) {
      // @ts-ignore - Navigator.connection is not in TypeScript types yet
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        effectiveType = connection.effectiveType;
        downlink = connection.downlink;
        rtt = connection.rtt;

        // Determine connection quality based on effective type and metrics
        if (effectiveType === '4g' || (downlink && downlink > 1.5)) {
          connectionQuality = 'good';
        } else if (effectiveType === '3g' || effectiveType === '2g' || (rtt && rtt > 300)) {
          connectionQuality = 'poor';
        } else {
          connectionQuality = 'good'; // Default to good if we can't determine
        }
      } else {
        connectionQuality = 'good'; // Assume good if we can't detect
      }
    }

    setStatus({
      isOnline,
      wasOffline,
      connectionQuality,
      effectiveType,
      downlink,
      rtt
    });

    // Trigger sync when coming back online
    if (wasOffline) {
      triggerSync();
    }
  }, [status.isOnline, triggerSync]);

  useEffect(() => {
    // Update status on mount
    updateNetworkStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Listen for connection changes if available
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    // Check network status periodically
    const interval = setInterval(updateNetworkStatus, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
      clearInterval(interval);
    };
  }, [updateNetworkStatus]);

  return status;
}

// Hook for monitoring specific resources
export function useResourceNetworkStatus(resourceUrl: string) {
  const [isReachable, setIsReachable] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (!isOnline) {
      setIsReachable(false);
      return;
    }

    const checkReachability = async () => {
      const startTime = performance.now();
      
      try {
        const response = await fetch(resourceUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        
        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));
        setIsReachable(true);
      } catch (error) {
        setIsReachable(false);
        setLatency(null);
      }
    };

    // Initial check
    checkReachability();

    // Periodic checks
    const interval = setInterval(checkReachability, 60000); // Every minute

    return () => clearInterval(interval);
  }, [resourceUrl, isOnline]);

  return { isReachable, latency };
}