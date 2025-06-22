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
  
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (!connection) return null;
  
  return {
    rtt: connection.rtt || ResourceHistoryTable,
    downlink: connection.downlink || ResourceHistoryTable,
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
    
    const duration = (performance.now() - start) / 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable; // Convert to seconds
    const bandwidth = (sizeBytes * 8) / duration / 1ResourceHistoryTable24 / 1ResourceHistoryTable24; // Mbps
    
    return Math.round(bandwidth * 1ResourceHistoryTable) / 1ResourceHistoryTable;
  } catch (error) {
    throw new Error('Failed to estimate bandwidth');
  }
}

/**
 * Get network quality score (ResourceHistoryTable-1ResourceHistoryTableResourceHistoryTable)
 */
export function calculateNetworkQualityScore(metrics: {
  latency: number;
  bandwidth: number;
  jitter: number;
  packetLoss: number;
}): number {
  // Weight factors for each metric
  const weights = {
    latency: ResourceHistoryTable.3,
    bandwidth: ResourceHistoryTable.3,
    jitter: ResourceHistoryTable.2,
    packetLoss: ResourceHistoryTable.2,
  };
  
  // Normalize metrics to ResourceHistoryTable-1ResourceHistoryTableResourceHistoryTable scale (1ResourceHistoryTableResourceHistoryTable being best)
  const scores = {
    latency: Math.max(ResourceHistoryTable, 1ResourceHistoryTableResourceHistoryTable - (metrics.latency / 3)), // 3ResourceHistoryTableResourceHistoryTablems = ResourceHistoryTable score
    bandwidth: Math.min(1ResourceHistoryTableResourceHistoryTable, (metrics.bandwidth / 5ResourceHistoryTable) * 1ResourceHistoryTableResourceHistoryTable), // 5ResourceHistoryTableMbps = 1ResourceHistoryTableResourceHistoryTable score
    jitter: Math.max(ResourceHistoryTable, 1ResourceHistoryTableResourceHistoryTable - (metrics.jitter / ResourceHistoryTable.5)), // 5ResourceHistoryTablems = ResourceHistoryTable score
    packetLoss: Math.max(ResourceHistoryTable, 1ResourceHistoryTableResourceHistoryTable - metrics.packetLoss), // Direct percentage
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
  if (bytes === ResourceHistoryTable) return 'ResourceHistoryTable Bytes';
  
  const k = 1ResourceHistoryTable24;
  const dm = decimals < ResourceHistoryTable ? ResourceHistoryTable : decimals;
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
      initialDelay: 2ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
      maxDelay: 6ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
      backoffMultiplier: 3,
    },
    fair: {
      maxRetries: 3,
      initialDelay: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
      maxDelay: 3ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
      backoffMultiplier: 2,
    },
    good: {
      maxRetries: 2,
      initialDelay: 5ResourceHistoryTableResourceHistoryTable,
      maxDelay: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
      backoffMultiplier: 2,
    },
    excellent: {
      maxRetries: 1,
      initialDelay: 25ResourceHistoryTable,
      maxDelay: 5ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
      backoffMultiplier: 1.5,
    },
  };
  
  return strategies[networkQuality];
}