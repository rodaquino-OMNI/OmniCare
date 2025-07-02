'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to check if component has hydrated on the client
 * Prevents hydration mismatches for client-only features
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

/**
 * Hook to safely use Zustand stores with SSR
 * Returns undefined during SSR to prevent hydration mismatches
 */
export function useSSRSafeStore<T>(store: () => T): T | undefined {
  const isHydrated = useHydration();
  const result = store();
  
  return isHydrated ? result : undefined;
}