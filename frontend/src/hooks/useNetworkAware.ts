import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatusContext } from '@/contexts/NetworkStatusContext';
import { networkRetryService, createRetryQueueItem } from '@/services/network-retry.service';

export interface NetworkAwareOptions {
  enableAutoRetry?: boolean;
  priority?: 'low' | 'normal' | 'high';
  cacheStrategy?: 'cache-first' | 'network-first' | 'cache-only' | 'network-only';
  cacheDuration?: number; // milliseconds
  backgroundSync?: boolean;
  optimizeForSaveData?: boolean;
  qualityThreshold?: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface NetworkAwareResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  refetch: () => Promise<void>;
  prefetch: () => Promise<void>;
  clearCache: () => void;
  lastFetchTime: number | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

export function useNetworkAware<T = any>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = [],
  options: NetworkAwareOptions = {}
): NetworkAwareResult<T> {
  const {
    enableAutoRetry = true,
    priority = 'normal',
    cacheStrategy = 'network-first',
    cacheDuration = 5 * 6ResourceHistoryTable * 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable, // 5 minutes
    backgroundSync = true,
    optimizeForSaveData = true,
    qualityThreshold = 'fair',
  } = options;

  const networkStatus = useNetworkStatusContext();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  
  const cacheRef = useRef<CacheEntry<T> | null>(null);
  const fetchIdRef = useRef<string>('');
  const backgroundSyncTimeoutRef = useRef<NodeJS.Timeout>();

  // Determine if we should use reduced data mode
  const shouldOptimizeData = useCallback(() => {
    if (!optimizeForSaveData) return false;
    
    if (networkStatus.saveData) return true;
    
    if (networkStatus.networkAwareMode === 'save-data') return true;
    
    if (networkStatus.networkAwareMode === 'auto') {
      const qualityOrder = { poor: ResourceHistoryTable, fair: 1, good: 2, excellent: 3 };
      const currentQuality = qualityOrder[networkStatus.quality.quality];
      const threshold = qualityOrder[qualityThreshold];
      return currentQuality < threshold;
    }
    
    return false;
  }, [networkStatus, optimizeForSaveData, qualityThreshold]);

  // Check if cache is still valid
  const isCacheValid = useCallback(() => {
    if (!cacheRef.current) return false;
    
    const age = Date.now() - cacheRef.current.timestamp;
    return age < cacheDuration;
  }, [cacheDuration]);

  // Get data from cache
  const getFromCache = useCallback(() => {
    if (isCacheValid() && cacheRef.current) {
      setData(cacheRef.current.data);
      setIsFromCache(true);
      setError(null);
      return true;
    }
    return false;
  }, [isCacheValid]);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current = null;
    setIsFromCache(false);
  }, []);

  // Perform the actual fetch
  const performFetch = useCallback(async (isBackgroundSync = false) => {
    const fetchId = Date.now().toString();
    fetchIdRef.current = fetchId;

    try {
      if (!isBackgroundSync) {
        setLoading(true);
        setError(null);
      }

      // Apply cache strategy
      if (cacheStrategy === 'cache-first' && getFromCache()) {
        if (!isBackgroundSync) {
          setLoading(false);
        }
        
        // Schedule background sync if enabled
        if (backgroundSync && networkStatus.isOnline && !isBackgroundSync) {
          backgroundSyncTimeoutRef.current = setTimeout(() => {
            performFetch(true);
          }, 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
        }
        
        return;
      }

      if (cacheStrategy === 'cache-only') {
        if (!getFromCache()) {
          throw new Error('No cached data available');
        }
        if (!isBackgroundSync) {
          setLoading(false);
        }
        return;
      }

      // Check network status
      if (!networkStatus.isOnline) {
        if (cacheStrategy !== 'network-only' && getFromCache()) {
          if (!isBackgroundSync) {
            setLoading(false);
          }
          return;
        }
        throw new Error('Network unavailable');
      }

      // Optimize fetch based on network conditions
      let result: T;
      
      if (shouldOptimizeData()) {
        // Could modify fetchFn here to request reduced data
        // For now, just proceed with normal fetch
        result = await fetchFn();
      } else {
        result = await fetchFn();
      }

      // Check if this fetch is still relevant
      if (fetchId !== fetchIdRef.current) {
        return;
      }

      // Update cache
      cacheRef.current = {
        data: result,
        timestamp: Date.now(),
      };

      // Update state
      setData(result);
      setIsFromCache(false);
      setLastFetchTime(Date.now());
      
      if (!isBackgroundSync) {
        setLoading(false);
      }
    } catch (err) {
      // Check if this fetch is still relevant
      if (fetchId !== fetchIdRef.current) {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));

      // Try cache on error if available
      if (cacheStrategy !== 'network-only' && getFromCache()) {
        if (!isBackgroundSync) {
          setLoading(false);
        }
        
        // Add to retry queue if enabled
        if (enableAutoRetry && networkStatus.isOnline) {
          const retryItem = createRetryQueueItem(
            {
              url: 'custom-fetch',
              options: { method: 'GET' },
              transformResponse: async () => fetchFn(),
            },
            (result) => {
              cacheRef.current = {
                data: result,
                timestamp: Date.now(),
              };
              setData(result);
              setIsFromCache(false);
              setLastFetchTime(Date.now());
            },
            (retryError) => {
              console.error('Retry failed:', retryError);
            }
          );

          networkStatus.addToRetryQueue({
            ...retryItem,
            priority,
          });
        }
        
        return;
      }

      if (!isBackgroundSync) {
        setError(error);
        setLoading(false);
      }

      // Add to retry queue if network error and auto-retry enabled
      if (enableAutoRetry && networkRetryService.isRetryableError(error)) {
        const retryItem = createRetryQueueItem(
          {
            url: 'custom-fetch',
            options: { method: 'GET' },
            transformResponse: async () => fetchFn(),
          },
          (result) => {
            cacheRef.current = {
              data: result,
              timestamp: Date.now(),
            };
            setData(result);
            setError(null);
            setIsFromCache(false);
            setLastFetchTime(Date.now());
          },
          (retryError) => {
            setError(retryError instanceof Error ? retryError : new Error(String(retryError)));
          }
        );

        networkStatus.addToRetryQueue({
          ...retryItem,
          priority,
        });
      }
    }
  }, [
    fetchFn,
    cacheStrategy,
    getFromCache,
    backgroundSync,
    networkStatus,
    shouldOptimizeData,
    enableAutoRetry,
    priority,
  ]);

  // Refetch function
  const refetch = useCallback(async () => {
    await performFetch();
  }, [performFetch]);

  // Prefetch function
  const prefetch = useCallback(async () => {
    if (!isCacheValid()) {
      await performFetch();
    }
  }, [isCacheValid, performFetch]);

  // Effect to fetch on mount and dependency changes
  useEffect(() => {
    performFetch();

    return () => {
      // Cancel any pending background syncs
      if (backgroundSyncTimeoutRef.current) {
        clearTimeout(backgroundSyncTimeoutRef.current);
      }
    };
  }, [...dependencies, networkStatus.networkAwareMode]);

  // Effect to refetch when coming back online
  useEffect(() => {
    if (networkStatus.isOnline && error && enableAutoRetry) {
      performFetch();
    }
  }, [networkStatus.isOnline, error, enableAutoRetry, performFetch]);

  return {
    data,
    loading,
    error,
    isFromCache,
    refetch,
    prefetch,
    clearCache,
    lastFetchTime,
  };
}