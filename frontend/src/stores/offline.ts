import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CacheMetadata {
  key: string;
  lastSynced: string;
  size: number;
  version: string;
  isCached: boolean;
  isStale: boolean;
}

interface OfflineState {
  // Settings
  isOfflineEnabled: boolean;
  autoSync: boolean;
  syncInterval: number; // in minutes
  maxCacheSize: number; // in bytes
  cacheSize: number; // current cache size
  retentionDays: number;
  syncOnCellular: boolean;
  backgroundSync: boolean;
  conflictResolution: 'ask' | 'local' | 'remote' | 'newest';
  selectedDataTypes: string[];
  
  // Cache metadata
  cacheMetadata: Record<string, CacheMetadata>;
  
  // Actions - Settings
  setOfflineEnabled: (enabled: boolean) => void;
  setAutoSync: (enabled: boolean) => void;
  setSyncInterval: (minutes: number) => void;
  setMaxCacheSize: (bytes: number) => void;
  setRetentionDays: (days: number) => void;
  setSyncOnCellular: (enabled: boolean) => void;
  setBackgroundSync: (enabled: boolean) => void;
  setConflictResolution: (strategy: OfflineState['conflictResolution']) => void;
  toggleDataType: (dataType: string) => void;
  
  // Actions - Cache Management
  updateCacheSize: (size: number) => void;
  addCacheMetadata: (key: string, metadata: Omit<CacheMetadata, 'key'>) => void;
  getCacheMetadata: (key: string) => CacheMetadata | undefined;
  removeCacheMetadata: (key: string) => void;
  clearCache: () => Promise<void>;
  forceSync: () => Promise<void>;
  downloadOfflineData: () => Promise<void>;
  
  // Actions - Cache Validation
  validateCache: () => void;
  cleanExpiredCache: () => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      // Default settings
      isOfflineEnabled: true,
      autoSync: true,
      syncInterval: 5, // 5 minutes
      maxCacheSize: 250 * 1024 * 1024, // 250MB
      cacheSize: 0,
      retentionDays: 7,
      syncOnCellular: false,
      backgroundSync: true,
      conflictResolution: 'ask',
      selectedDataTypes: ['patients', 'encounters', 'medications', 'vitalSigns'],
      cacheMetadata: {},

      // Settings actions
      setOfflineEnabled: (enabled) => set({ isOfflineEnabled: enabled }),
      setAutoSync: (enabled) => set({ autoSync: enabled }),
      setSyncInterval: (minutes) => set({ syncInterval: minutes }),
      setMaxCacheSize: (bytes) => set({ maxCacheSize: bytes }),
      setRetentionDays: (days) => set({ retentionDays: days }),
      setSyncOnCellular: (enabled) => set({ syncOnCellular: enabled }),
      setBackgroundSync: (enabled) => set({ backgroundSync: enabled }),
      setConflictResolution: (strategy) => set({ conflictResolution: strategy }),
      
      toggleDataType: (dataType) => {
        set((state) => {
          const isSelected = state.selectedDataTypes.includes(dataType);
          return {
            selectedDataTypes: isSelected
              ? state.selectedDataTypes.filter(t => t !== dataType)
              : [...state.selectedDataTypes, dataType]
          };
        });
      },

      // Cache management
      updateCacheSize: (size) => set({ cacheSize: size }),
      
      addCacheMetadata: (key, metadata) => {
        set((state) => ({
          cacheMetadata: {
            ...state.cacheMetadata,
            [key]: { ...metadata, key }
          }
        }));
      },
      
      getCacheMetadata: (key) => {
        const { cacheMetadata } = get();
        return cacheMetadata[key];
      },
      
      removeCacheMetadata: (key) => {
        set((state) => {
          const { [key]: removed, ...rest } = state.cacheMetadata;
          return { cacheMetadata: rest };
        });
      },

      clearCache: async () => {
        // Clear browser cache if available
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }
        
        // Clear IndexedDB
        if ('indexedDB' in window) {
          // This would be implemented based on your IndexedDB structure
          // Example: await db.clear();
        }
        
        // Reset state
        set({
          cacheSize: 0,
          cacheMetadata: {}
        });
      },

      forceSync: async () => {
        // This would trigger a sync through your sync service
        // Example: await syncService.forceSync();
        console.log('Force sync triggered');
      },

      downloadOfflineData: async () => {
        const { selectedDataTypes } = get();
        
        // This would download data for offline use
        // Example implementation:
        for (const dataType of selectedDataTypes) {
          console.log(`Downloading ${dataType} for offline use...`);
          // await offlineService.downloadDataType(dataType);
        }
      },

      validateCache: () => {
        const { cacheMetadata, retentionDays } = get();
        const now = new Date();
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        
        // Mark stale entries
        const updatedMetadata: Record<string, CacheMetadata> = {};
        
        Object.entries(cacheMetadata).forEach(([key, metadata]) => {
          const lastSyncDate = new Date(metadata.lastSynced);
          const ageMs = now.getTime() - lastSyncDate.getTime();
          
          updatedMetadata[key] = {
            ...metadata,
            isStale: ageMs > retentionMs
          };
        });
        
        set({ cacheMetadata: updatedMetadata });
      },

      cleanExpiredCache: () => {
        const { cacheMetadata } = get();
        const validMetadata: Record<string, CacheMetadata> = {};
        
        Object.entries(cacheMetadata).forEach(([key, metadata]) => {
          if (!metadata.isStale) {
            validMetadata[key] = metadata;
          }
        });
        
        set({ cacheMetadata: validMetadata });
      }
    }),
    {
      name: 'offline-storage',
      partialize: (state) => ({
        isOfflineEnabled: state.isOfflineEnabled,
        autoSync: state.autoSync,
        syncInterval: state.syncInterval,
        maxCacheSize: state.maxCacheSize,
        retentionDays: state.retentionDays,
        syncOnCellular: state.syncOnCellular,
        backgroundSync: state.backgroundSync,
        conflictResolution: state.conflictResolution,
        selectedDataTypes: state.selectedDataTypes,
        cacheMetadata: state.cacheMetadata
      })
    }
  )
);