import React, { createContext, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export interface NetworkQuality {
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  latency: number;
  bandwidth: number;
  jitter: number;
  packetLoss: number;
}

interface NetworkStatusContextValue {
  isOnline: boolean;
  wasOffline: boolean;
  connectionQuality: 'good' | 'poor' | 'offline';
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  quality: NetworkQuality;
  refresh: () => void;
  retryQueue: RetryQueueItem[];
  addToRetryQueue: (item: RetryQueueItem) => void;
  removeFromRetryQueue: (id: string) => void;
  processRetryQueue: () => Promise<void>;
  isProcessingRetries: boolean;
  networkAwareMode: NetworkAwareMode;
  setNetworkAwareMode: (mode: NetworkAwareMode) => void;
  saveData: boolean;
  connectionType?: string;
}

export interface RetryQueueItem {
  id: string;
  action: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
  backoffMs: number;
  timestamp: number;
  description?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  priority?: 'low' | 'normal' | 'high';
}

export type NetworkAwareMode = 'auto' | 'quality' | 'save-data' | 'normal';

const NetworkStatusContext = createContext<NetworkStatusContextValue | undefined>(undefined);

interface NetworkStatusProviderProps {
  children: ReactNode;
  defaultMode?: NetworkAwareMode;
  retryOptions?: {
    maxRetries?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
    backoffMultiplier?: number;
  };
}

export const NetworkStatusProvider: React.FC<NetworkStatusProviderProps> = ({
  children,
  defaultMode = 'auto',
  retryOptions = {},
}) => {
  const networkStatus = useNetworkStatus();
  const [retryQueue, setRetryQueue] = React.useState<RetryQueueItem[]>([]);
  const [isProcessingRetries, setIsProcessingRetries] = React.useState(false);
  const [networkAwareMode, setNetworkAwareMode] = React.useState<NetworkAwareMode>(defaultMode);
  const processingRef = useRef(false);

  const {
    maxRetries = 3,
    initialBackoffMs = 1000,
    maxBackoffMs = 30000,
    backoffMultiplier = 2,
  } = retryOptions;

  const addToRetryQueue = useCallback((item: RetryQueueItem) => {
    setRetryQueue(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(i => i.id !== item.id);
      
      // Add with proper backoff calculation
      const newItem = {
        ...item,
        retryCount: item.retryCount || 0,
        maxRetries: item.maxRetries || maxRetries,
        backoffMs: item.backoffMs || initialBackoffMs,
        timestamp: Date.now(),
      };

      // Sort by priority and timestamp
      const sorted = [...filtered, newItem].sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const aPriority = priorityOrder[a.priority || 'normal'];
        const bPriority = priorityOrder[b.priority || 'normal'];
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return a.timestamp - b.timestamp;
      });

      return sorted;
    });
  }, [maxRetries, initialBackoffMs]);

  const removeFromRetryQueue = useCallback((id: string) => {
    setRetryQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const calculateBackoff = useCallback((retryCount: number, currentBackoff: number): number => {
    const nextBackoff = currentBackoff * backoffMultiplier;
    return Math.min(nextBackoff, maxBackoffMs);
  }, [backoffMultiplier, maxBackoffMs]);

  const processRetryQueue = useCallback(async () => {
    if (processingRef.current || !networkStatus.isOnline || retryQueue.length === 0) {
      return;
    }

    processingRef.current = true;
    setIsProcessingRetries(true);

    const currentQueue = [...retryQueue];
    
    for (const item of currentQueue) {
      // Skip if network went offline
      if (!networkStatus.isOnline) {
        break;
      }

      // Check if enough time has passed for backoff
      const timeSinceLastAttempt = Date.now() - item.timestamp;
      if (timeSinceLastAttempt < item.backoffMs) {
        continue;
      }

      try {
        const result = await item.action();
        
        // Success - remove from queue
        removeFromRetryQueue(item.id);
        
        if (item.onSuccess) {
          item.onSuccess(result);
        }
      } catch (error) {
        const newRetryCount = item.retryCount + 1;
        
        if (newRetryCount >= item.maxRetries) {
          // Max retries reached - remove and call error handler
          removeFromRetryQueue(item.id);
          
          if (item.onError) {
            item.onError(error);
          }
        } else {
          // Update retry count and backoff
          setRetryQueue(prev => 
            prev.map(i => 
              i.id === item.id
                ? {
                    ...i,
                    retryCount: newRetryCount,
                    backoffMs: calculateBackoff(newRetryCount, i.backoffMs),
                    timestamp: Date.now(),
                  }
                : i
            )
          );
        }
      }

      // Small delay between retries
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    processingRef.current = false;
    setIsProcessingRetries(false);
  }, [networkStatus.isOnline, retryQueue, removeFromRetryQueue, calculateBackoff]);

  // Auto-process retry queue when network comes back online
  useEffect(() => {
    if (networkStatus.isOnline && retryQueue.length > 0) {
      processRetryQueue();
    }
  }, [networkStatus.isOnline, processRetryQueue, retryQueue.length]);

  // Periodic retry processing
  useEffect(() => {
    const interval = setInterval(() => {
      if (networkStatus.isOnline && retryQueue.length > 0 && !processingRef.current) {
        processRetryQueue();
      }
    }, 500); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [networkStatus.isOnline, retryQueue.length, processRetryQueue]);

  // Compute quality metrics based on network status
  const computeQuality = useCallback((): NetworkQuality => {
    if (!networkStatus.isOnline) {
      return {
        quality: 'poor',
        latency: 9999,
        bandwidth: 0,
        jitter: 9999,
        packetLoss: 10
      };
    }

    const rtt = networkStatus.rtt || 0;
    const downlink = networkStatus.downlink || 0;
    
    // Estimate latency from RTT
    const latency = rtt;
    
    // Convert downlink (Mbps) to bandwidth
    const bandwidth = downlink;
    
    // Estimate jitter (variation in latency) - rough approximation
    const jitter = rtt > 0 ? Math.min(rtt * 0.1, 50) : 0;
    
    // Estimate packet loss based on connection quality
    let packetLoss = 0;
    if (networkStatus.connectionQuality === 'poor') {
      packetLoss = 5;
    }
    
    // Determine overall quality
    let quality: NetworkQuality['quality'] = 'excellent';
    if (rtt > 300 || downlink < 1 || networkStatus.connectionQuality === 'poor') {
      quality = 'poor';
    } else if (rtt > 150 || downlink < 5) {
      quality = 'fair';
    } else if (rtt > 50 || downlink < 10) {
      quality = 'good';
    }
    
    return {
      quality,
      latency,
      bandwidth,
      jitter,
      packetLoss
    };
  }, [networkStatus]);

  const refresh = useCallback(() => {
    // Trigger a manual network status update
    window.dispatchEvent(new Event('online'));
  }, []);

  const value: NetworkStatusContextValue = {
    ...networkStatus,
    quality: computeQuality(),
    refresh,
    retryQueue,
    addToRetryQueue,
    removeFromRetryQueue,
    processRetryQueue,
    isProcessingRetries,
    networkAwareMode,
    setNetworkAwareMode,
    saveData: false, // This could be determined from browser settings
    connectionType: networkStatus.effectiveType,
  };

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatusContext = () => {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error('useNetworkStatusContext must be used within NetworkStatusProvider');
  }
  return context;
};