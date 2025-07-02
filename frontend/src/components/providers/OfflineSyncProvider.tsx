'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
// Define the interface inline to avoid importing the service module
interface OfflineSyncServiceType {
  getSyncStatus(): any;
  on(eventType: string, handler: (data: any) => void): void;
  off(eventType: string): void;
  sync(options?: any): Promise<void>;
  queueOperation(operation: any, resource: any, options?: any): Promise<void>;
  getConflicts(resolved?: boolean): Promise<any[]>;
  resolveConflict(conflictId: string, resolution: any, resolvedBy?: string): Promise<void>;
  clearLocalData(): Promise<void>;
  exportSyncData(): Promise<any>;
  importSyncData(data: any): Promise<void>;
  syncNow(options?: any): Promise<void>;
  cleanup(daysToKeep?: number): Promise<void>;
  destroy(): void;
}

interface OfflineSyncContextValue {
  service: OfflineSyncServiceType | null;
  isReady: boolean;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  service: null,
  isReady: false
});

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [service, setService] = useState<OfflineSyncServiceType | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only import and initialize on client side
    if (typeof window !== 'undefined') {
      import('@/services/offline-sync.service').then((module) => {
        const instance = module.getOfflineSyncService();
        setService(instance);
        setIsReady(true);
      }).catch((error) => {
        console.error('Failed to initialize offline sync service:', error);
        setIsReady(true); // Set ready even on error to prevent hanging
      });
    }
  }, []);

  return (
    <OfflineSyncContext.Provider value={{ service, isReady }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncService() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSyncService must be used within OfflineSyncProvider');
  }
  return context;
}

// Export a mock service for server-side rendering
export const mockOfflineSyncService = {
  getSyncStatus: () => ({
    isOnline: true,
    isSyncing: false,
    pendingChanges: 0,
    failedChanges: 0,
    conflictedChanges: 0,
    errors: []
  }),
  on: () => {},
  off: () => {},
  sync: () => Promise.resolve(),
  queueOperation: () => Promise.resolve(),
  getConflicts: () => Promise.resolve([]),
  resolveConflict: () => Promise.resolve(),
  clearLocalData: () => Promise.resolve(),
  exportSyncData: () => Promise.resolve({
    resourceVersions: new Map(),
    pendingOperations: [],
    conflicts: []
  }),
  importSyncData: () => Promise.resolve(),
  syncNow: () => Promise.resolve(),
  cleanup: () => Promise.resolve(),
  destroy: () => {}
} as any;