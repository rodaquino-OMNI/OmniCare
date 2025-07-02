/**
 * Network monitoring utility functions
 */

export interface NetworkMetrics {
  rtt: number;
  downlink: number;
  effectiveType: string;
  saveData: boolean;
}

/**
 * Get current network metrics from the Network Information API
 */
export function getNetworkMetrics(): NetworkMetrics | null {
  if (typeof window === 'undefined') return null;
  
  interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
  
  interface NetworkInformation {
    rtt?: number;
    downlink?: number;
    effectiveType?: string;
    saveData?: boolean;
  }
  
  const navWithConnection = navigator as NavigatorWithConnection;
  const connection = navWithConnection.connection || 
                    navWithConnection.mozConnection || 
                    navWithConnection.webkitConnection;
  
  if (!connection) return null;
  
  return {
    rtt: connection.rtt || 0,
    downlink: connection.downlink || 0,
    effectiveType: connection.effectiveType || 'unknown',
    saveData: connection.saveData || false,
  };
}

/**
 * Check if the browser supports the Network Information API
 */
export function isNetworkAPISupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  return 'connection' in navigator || 
         'mozConnection' in navigator || 
         'webkitConnection' in navigator;
}

/**
 * Estimate bandwidth based on download timing
 */
export async function estimateBandwidth(url: string, sizeBytes: number): Promise<number> {
  const start = performance.now();
  
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    await response.blob();
    
    const duration = (performance.now() - start) / 1000; // Convert to seconds
    const bandwidth = (sizeBytes * 8) / duration / 1024 / 1024; // Mbps
    
    return Math.round(bandwidth * 100) / 100;
  } catch {
    throw new Error('Failed to estimate bandwidth');
  }
}

/**
 * Get network quality score (ResourceHistoryTable-10)
 */
export function calculateNetworkQualityScore(metrics: {
  latency: number;
  bandwidth: number;
  jitter: number;
  packetLoss: number;
}): number {
  // Weight factors for each metric
  const weights = {
    latency: 0.3,
    bandwidth: 0.3,
    jitter: 0.2,
    packetLoss: 0.2,
  };
  
  // Normalize metrics to ResourceHistoryTable-10 scale (10 being best)
  const scores = {
    latency: Math.max(0, 100 - (metrics.latency / 3)), // 300ms = 0 score
    bandwidth: Math.min(100, (metrics.bandwidth / 50) * 100), // 50Mbps = 10 score
    jitter: Math.max(0, 100 - (metrics.jitter / 0.5)), // 50ms = 0 score
    packetLoss: Math.max(0, 100 - metrics.packetLoss), // Direct percentage
  };
  
  // Calculate weighted score
  const totalScore = 
    scores.latency * weights.latency +
    scores.bandwidth * weights.bandwidth +
    scores.jitter * weights.jitter +
    scores.packetLoss * weights.packetLoss;
  
  return Math.round(totalScore);
}

/**
 * Get recommended settings based on network quality
 */
export function getNetworkOptimizationSettings(quality: 'poor' | 'fair' | 'good' | 'excellent') {
  const settings = {
    poor: {
      imageQuality: 'low',
      videoQuality: 'low',
      prefetchData: false,
      enableAnimations: false,
      cacheStrategy: 'aggressive',
      batchRequests: true,
      compressionLevel: 'high',
    },
    fair: {
      imageQuality: 'medium',
      videoQuality: 'medium',
      prefetchData: false,
      enableAnimations: true,
      cacheStrategy: 'moderate',
      batchRequests: true,
      compressionLevel: 'medium',
    },
    good: {
      imageQuality: 'high',
      videoQuality: 'high',
      prefetchData: true,
      enableAnimations: true,
      cacheStrategy: 'balanced',
      batchRequests: false,
      compressionLevel: 'low',
    },
    excellent: {
      imageQuality: 'original',
      videoQuality: 'hd',
      prefetchData: true,
      enableAnimations: true,
      cacheStrategy: 'minimal',
      batchRequests: false,
      compressionLevel: 'none',
    },
  };
  
  return settings[quality];
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if we should use reduced data mode
 */
export function shouldUseReducedData(
  networkQuality: 'poor' | 'fair' | 'good' | 'excellent',
  saveDataEnabled: boolean,
  userPreference: 'auto' | 'quality' | 'save-data' | 'normal'
): boolean {
  if (userPreference === 'save-data') return true;
  if (userPreference === 'quality') return false;
  if (saveDataEnabled) return true;
  
  if (userPreference === 'auto') {
    return networkQuality === 'poor' || networkQuality === 'fair';
  }
  
  return false;
}

/**
 * Get retry strategy based on network conditions
 */
export function getRetryStrategy(networkQuality: 'poor' | 'fair' | 'good' | 'excellent') {
  const strategies = {
    poor: {
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 60000,
      backoffMultiplier: 3,
    },
    fair: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    },
    good: {
      maxRetries: 2,
      initialDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
    excellent: {
      maxRetries: 1,
      initialDelay: 250,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
    },
  };
  
  return strategies[networkQuality];
}