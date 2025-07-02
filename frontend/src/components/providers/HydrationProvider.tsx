'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

/**
 * Provider that handles manual hydration of Zustand stores
 * This prevents hydration mismatches during SSR
 */
export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Manually hydrate stores after client loads
    useUIStore.persist.rehydrate();
    useAuthStore.persist.rehydrate();
    
    setIsHydrated(true);
  }, []);

  // Render children immediately, but with client-side hydration
  return <>{children}</>;
}