/**
 * Custom hook for fetching and managing dashboard data
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { dashboardService, DashboardData } from '@/services/dashboard.service';
import { useNetworkStatus } from './useNetworkStatus';

// Performance tracking for dashboard data loading
let loadCount = 0;
const loadTimes: number[] = [];

const getAverageLoadTime = () => {
  if (loadTimes.length === 0) return 0;
  return loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
};

export interface UseDashboardDataOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  onError?: (error: Error) => void;
}

export interface UseDashboardDataReturn {
  data: DashboardData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export const useDashboardData = (options: UseDashboardDataOptions = {}): UseDashboardDataReturn => {
  const memoizedOptions = useMemo(() => ({
    autoRefresh: options.autoRefresh ?? true,
    refreshInterval: options.refreshInterval ?? 30, // 30 seconds default
    onError: options.onError
  }), [options.autoRefresh, options.refreshInterval, options.onError]);

  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageLoadTime: 0,
    lastLoadTime: 0,
    loadCount: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const cacheRef = useRef<{ data: DashboardData | null; timestamp: number }>({ data: null, timestamp: 0 });
  const CACHE_DURATION = 30000; // 30 seconds cache

  // Optimized fetch dashboard data with caching and performance tracking
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    const startTime = Date.now();
    
    try {
      if (!isOnline) {
        throw new Error('No internet connection. Dashboard data requires online access.');
      }

      // Check cache first if not refreshing
      if (!isRefresh && cacheRef.current.data && 
          (Date.now() - cacheRef.current.timestamp) < CACHE_DURATION) {
        console.log('Using cached dashboard data');
        if (isMountedRef.current) {
          setData(cacheRef.current.data);
          setLastUpdated(cacheRef.current.data.lastUpdated);
          setError(null);
          setIsLoading(false);
          setIsRefreshing(false);
        }
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const dashboardData = await dashboardService.getDashboardData();
      const loadTime = Date.now() - startTime;
      
      // Update performance tracking
      loadCount++;
      loadTimes.push(loadTime);
      if (loadTimes.length > 10) {
        loadTimes.shift(); // Keep only last 10 load times
      }
      
      // Cache the data
      cacheRef.current = {
        data: dashboardData,
        timestamp: Date.now()
      };
      
      if (isMountedRef.current) {
        setData(dashboardData);
        setLastUpdated(dashboardData.lastUpdated);
        setError(null);
        setPerformanceMetrics({
          averageLoadTime: getAverageLoadTime(),
          lastLoadTime: loadTime,
          loadCount
        });
        
        // Performance warning
        if (loadTime > 2000) {
          console.warn(`Dashboard data load time exceeded 2s: ${loadTime}ms`);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Failed to fetch dashboard data');
        setError(error);
        
        if (memoizedOptions.onError) {
          memoizedOptions.onError(error);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isOnline, memoizedOptions]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Setup auto-refresh with optimized dependencies
  useEffect(() => {
    if (memoizedOptions.autoRefresh && isOnline && memoizedOptions.refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchDashboardData(true);
      }, memoizedOptions.refreshInterval * 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [memoizedOptions.autoRefresh, isOnline, memoizedOptions.refreshInterval, fetchDashboardData]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Refresh when coming back online
  useEffect(() => {
    if (isOnline && error?.message.includes('No internet connection')) {
      fetchDashboardData();
    }
  }, [isOnline, error, fetchDashboardData]);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    data,
    isLoading,
    isRefreshing,
    error,
    refresh,
    lastUpdated,
    performanceMetrics
  }), [data, isLoading, isRefreshing, error, refresh, lastUpdated, performanceMetrics]);
};