import { useState, useEffect, useCallback, useRef } from 'react';
import { Resource } from '@medplum/fhirtypes';
import { enhancedMedplumClient } from '@/lib/enhanced-medplum-client';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineSync } from './useOfflineSync';
import { getOfflineSyncService } from '@/services/offline-sync.service';

export interface UseResourceOptions {
  // Cache configuration
  cacheTime?: number; // How long to cache in milliseconds
  staleTime?: number; // How long before cache is considered stale
  cacheKey?: string[]; // Additional cache key segments
  
  // Behavior options
  enabled?: boolean; // Whether to fetch automatically
  refetchInterval?: number; // Refetch interval in milliseconds
  refetchOnWindowFocus?: boolean; // Refetch when window regains focus
  refetchOnReconnect?: boolean; // Refetch when connection restored
  
  // Offline options
  offlineFirst?: boolean; // Try offline cache first
  syncStrategy?: 'optimistic' | 'pessimistic'; // Sync strategy
  
  // Callbacks
  onSuccess?: (data: Resource) => void;
  onError?: (error: Error) => void;
}

export interface UseResourceResult<T extends Resource> {
  // Data state
  data: T | undefined;
  error: Error | undefined;
  
  // Loading states
  isLoading: boolean; // Initial load
  isFetching: boolean; // Any fetch including background
  isRefetching: boolean; // Manual refetch
  
  // Status flags
  isSuccess: boolean;
  isError: boolean;
  isStale: boolean;
  isFromCache: boolean;
  
  // Timestamps
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  
  // Actions
  refetch: () => Promise<T | undefined>;
  invalidate: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Enhanced hook for fetching and managing FHIR resources
 * Combines Medplum patterns with OmniCare's offline capabilities
 */
export function useResource<T extends Resource>(
  resourceType: string,
  id: string | undefined,
  options: UseResourceOptions = {}
): UseResourceResult<T> {
  // Options with defaults
  const {
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 0, // Immediately stale
    cacheKey = [],
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    offlineFirst = true,
    syncStrategy = 'optimistic',
    onSuccess,
    onError,
  } = options;

  // State
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState(0);
  const [errorUpdatedAt, setErrorUpdatedAt] = useState(0);

  // Refs
  const isMountedRef = useRef(true);
  const refetchIntervalRef = useRef<NodeJS.Timeout>();
  const cacheTimerRef = useRef<NodeJS.Timeout>();

  // Hooks
  const { isOnline } = useNetworkStatus();
  const offlineSync = getOfflineSyncService();

  // Compute cache key
  const fullCacheKey = ['resource', resourceType, id, ...cacheKey].filter(Boolean).join(':');

  // Compute derived state
  const isSuccess = !error && !isLoading && data !== undefined;
  const isError = !!error;
  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > staleTime;

  /**
   * Fetch resource from server
   */
  const fetchResource = useCallback(async (): Promise<T | undefined> => {
    if (!resourceType || !id) return undefined;

    try {
      const resource = await enhancedMedplumClient.readResource(resourceType, id) as T;
      
      // Cache in offline storage
      if (offlineSync) {
        await offlineSync.saveLocalResource(resource);
      }
      
      return resource;
    } catch (error) {
      throw error;
    }
  }, [resourceType, id, offlineSync]);

  /**
   * Load resource (from cache or server)
   */
  const loadResource = useCallback(async (isRefetch = false) => {
    if (!resourceType || !id || !enabled) return;

    const isInitialLoad = !data && !error;
    
    if (isInitialLoad) setIsLoading(true);
    if (isRefetch) setIsRefetching(true);
    setIsFetching(true);
    setError(undefined);

    try {
      let resource: T | undefined;
      let fromCache = false;

      // Try offline cache first if specified
      if (offlineFirst && offlineSync) {
        const cached = await offlineSync.getLocalResource(resourceType, id);
        if (cached) {
          resource = cached as T;
          fromCache = true;
          
          // Update state immediately (optimistic)
          if (syncStrategy === 'optimistic' && isMountedRef.current) {
            setData(resource);
            setIsFromCache(true);
            setDataUpdatedAt(Date.now());
            if (isInitialLoad) setIsLoading(false);
          }
        }
      }

      // Fetch from server if online
      if (isOnline || !resource) {
        const fresh = await fetchResource();
        if (fresh && isMountedRef.current) {
          resource = fresh;
          fromCache = false;
        }
      }

      // Update state
      if (isMountedRef.current && resource) {
        setData(resource);
        setIsFromCache(fromCache);
        setDataUpdatedAt(Date.now());
        onSuccess?.(resource);
      }
    } catch (err) {
      const error = err as Error;
      
      if (isMountedRef.current) {
        // Try to use cached data on error
        if (offlineSync && !data) {
          const cached = await offlineSync.getLocalResource(resourceType, id);
          if (cached) {
            setData(cached as T);
            setIsFromCache(true);
            setDataUpdatedAt(Date.now());
          }
        }
        
        setError(error);
        setErrorUpdatedAt(Date.now());
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
        setIsRefetching(false);
      }
    }
  }, [resourceType, id, enabled, data, error, offlineFirst, offlineSync, syncStrategy, isOnline, fetchResource, onSuccess, onError]);

  /**
   * Refetch the resource
   */
  const refetch = useCallback(async () => {
    await loadResource(true);
    return data;
  }, [loadResource, data]);

  /**
   * Invalidate cache and refetch
   */
  const invalidate = useCallback(() => {
    setDataUpdatedAt(0); // Mark as stale
    refetch();
  }, [refetch]);

  /**
   * Manually update data
   */
  const setDataCallback = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setData(prev => {
      const newData = typeof updater === 'function' ? updater(prev) : updater;
      setDataUpdatedAt(Date.now());
      setIsFromCache(false);
      
      // Update offline cache
      if (offlineSync && newData) {
        offlineSync.saveLocalResource(newData).catch(console.error);
      }
      
      return newData;
    });
  }, [offlineSync]);

  // Initial fetch
  useEffect(() => {
    loadResource();
  }, [resourceType, id, enabled]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    refetchIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        loadResource();
      }
    }, refetchInterval);

    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, [refetchInterval, enabled, loadResource]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      if (isStale) {
        loadResource();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, isStale, loadResource]);

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect || !enabled) return;

    const handleOnline = () => {
      loadResource();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, enabled, loadResource]);

  // Cache expiration
  useEffect(() => {
    if (!data || cacheTime === Infinity) return;

    cacheTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        invalidate();
      }
    }, cacheTime);

    return () => {
      if (cacheTimerRef.current) {
        clearTimeout(cacheTimerRef.current);
      }
    };
  }, [data, cacheTime, invalidate]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    isFetching,
    isRefetching,
    isSuccess,
    isError,
    isStale,
    isFromCache,
    dataUpdatedAt,
    errorUpdatedAt,
    refetch,
    invalidate,
    setData: setDataCallback,
  };
}

/**
 * Hook for fetching multiple resources with deduplication
 */
export function useResources<T extends Resource>(
  requests: Array<{ resourceType: string; id: string }>,
  options: UseResourceOptions = {}
): UseResourceResult<T>[] {
  return requests.map(({ resourceType, id }) => 
    useResource<T>(resourceType, id, options)
  );
}

/**
 * Hook for searching resources
 */
export function useResourceSearch<T extends Resource>(
  resourceType: string,
  searchParams?: Record<string, any>,
  options: UseResourceOptions = {}
): UseResourceResult<T[]> & { 
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<void>;
  fetchPreviousPage: () => Promise<void>;
} {
  // Implementation would handle search with pagination
  // This is a placeholder for the full implementation
  const result = useResource<any>(resourceType, undefined, options);
  
  return {
    ...result,
    data: result.data ? [result.data] : [],
    hasNextPage: false,
    hasPreviousPage: false,
    fetchNextPage: async () => {},
    fetchPreviousPage: async () => {},
  };
}