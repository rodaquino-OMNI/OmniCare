import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SyncItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
  retryCount?: number;
}

export interface SyncState {
  // Sync status
  isSyncing: boolean;
  syncProgress: number;
  lastSyncTime: string | null;
  syncError: string | null;
  
  // Sync queue
  syncQueue: SyncItem[];
  syncedItems: SyncItem[];
  failedItems: SyncItem[];
  totalItems: number;
  pendingChanges: number;
  
  // Current operation
  currentOperation: string | null;
  estimatedTimeRemaining: number | null;
  
  // Session resume
  sessionId: string | null;
  isResuming: boolean;
  resumePoint: number;
  interruptedAt: string | null;
  
  // Actions
  addToSyncQueue: (item: Omit<SyncItem, 'id' | 'timestamp' | 'status'>) => void;
  startSync: () => void;
  updateSyncProgress: (progress: number) => void;
  markItemSynced: (itemId: string) => void;
  markItemFailed: (itemId: string, error: string) => void;
  retrySync: () => Promise<void>;
  cancelSync: () => void;
  clearSyncQueue: () => void;
  triggerSync: () => void;
  
  // Sync management
  setSyncError: (error: string | null) => void;
  setCurrentOperation: (operation: string | null) => void;
  setEstimatedTime: (seconds: number | null) => void;
  completeSync: () => void;
  
  // Session resume
  resumeSession: () => Promise<void>;
  pauseSync: () => void;
  initializeSession: () => void;
  restoreFromSession: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      // Initial state
      isSyncing: false,
      syncProgress: 0,
      lastSyncTime: null,
      syncError: null,
      syncQueue: [],
      syncedItems: [],
      failedItems: [],
      totalItems: 0,
      pendingChanges: 0,
      currentOperation: null,
      estimatedTimeRemaining: null,
      
      // Session resume state
      sessionId: null,
      isResuming: false,
      resumePoint: 0,
      interruptedAt: null,

      // Add item to sync queue
      addToSyncQueue: (item) => {
        const syncItem: SyncItem = {
          ...item,
          id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };
        
        set((state) => ({
          syncQueue: [...state.syncQueue, syncItem],
          pendingChanges: state.pendingChanges + 1,
          totalItems: state.totalItems + 1
        }));
      },

      // Start syncing process
      startSync: () => {
        set({
          isSyncing: true,
          syncProgress: 0,
          syncError: null,
          currentOperation: 'Initializing sync...'
        });
      },

      // Update sync progress
      updateSyncProgress: (progress) => {
        set({ syncProgress: Math.min(100, Math.max(0, progress)) });
      },

      // Mark item as synced
      markItemSynced: (itemId) => {
        set((state) => {
          const item = state.syncQueue.find(i => i.id === itemId);
          if (!item) return state;

          const updatedItem = { ...item, status: 'synced' as const };
          const newQueue = state.syncQueue.filter(i => i.id !== itemId);
          const syncedCount = state.syncedItems.length + 1;
          const progress = (syncedCount / state.totalItems) * 10;

          return {
            syncQueue: newQueue,
            syncedItems: [...state.syncedItems, updatedItem],
            pendingChanges: Math.max(0, state.pendingChanges - 1),
            syncProgress: progress
          };
        });
      },

      // Mark item as failed
      markItemFailed: (itemId, error) => {
        set((state) => {
          const item = state.syncQueue.find(i => i.id === itemId);
          if (!item) return state;

          const updatedItem = { 
            ...item, 
            status: 'failed' as const, 
            error,
            retryCount: (item.retryCount || 0) + 1
          };
          
          const newQueue = state.syncQueue.filter(i => i.id !== itemId);

          return {
            syncQueue: newQueue,
            failedItems: [...state.failedItems, updatedItem],
            syncError: error
          };
        });
      },

      // Retry failed sync
      retrySync: async () => {
        const { failedItems } = get();
        
        // Move failed items back to queue
        set((state) => ({
          syncQueue: [...state.syncQueue, ...failedItems.map(item => ({
            ...item,
            status: 'pending' as const,
            error: undefined
          }))],
          failedItems: [],
          syncError: null
        }));

        // Start sync again
        get().startSync();
      },

      // Cancel ongoing sync
      cancelSync: () => {
        set({
          isSyncing: false,
          currentOperation: null,
          estimatedTimeRemaining: null
        });
      },

      // Clear sync queue
      clearSyncQueue: () => {
        set({
          syncQueue: [],
          syncedItems: [],
          failedItems: [],
          pendingChanges: 0,
          totalItems: 0,
          syncProgress: 0
        });
      },

      // Trigger sync (called when coming online)
      triggerSync: () => {
        const { syncQueue, isSyncing } = get();
        if (syncQueue.length > 0 && !isSyncing) {
          get().startSync();
        }
      },

      // Set sync error
      setSyncError: (error) => {
        set({ syncError: error });
      },

      // Set current operation
      setCurrentOperation: (operation) => {
        set({ currentOperation: operation });
      },

      // Set estimated time
      setEstimatedTime: (seconds) => {
        set({ estimatedTimeRemaining: seconds });
      },

      // Complete sync
      completeSync: () => {
        set({
          isSyncing: false,
          lastSyncTime: new Date().toISOString(),
          currentOperation: null,
          estimatedTimeRemaining: null,
          syncProgress: 100,
          sessionId: null,
          isResuming: false,
          resumePoint: 0,
          interruptedAt: null
        });
      },
      
      // Initialize session for resume capability
      initializeSession: () => {
        const sessionId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set({ sessionId });
      },
      
      // Pause sync and save state for resume
      pauseSync: () => {
        const state = get();
        if (state.isSyncing) {
          set({
            isSyncing: false,
            interruptedAt: new Date().toISOString(),
            resumePoint: state.syncProgress
          });
        }
      },
      
      // Resume interrupted sync session
      resumeSession: async () => {
        const state = get();
        if (state.interruptedAt && state.syncQueue.length > 0) {
          set({
            isResuming: true,
            isSyncing: true,
            syncProgress: state.resumePoint,
            currentOperation: 'Resuming sync...',
            syncError: null
          });
          
          // Continue sync from where it left off
          setTimeout(() => {
            set({ isResuming: false });
            get().triggerSync();
          }, 1000);
        }
      },
      
      // Restore state from previous session
      restoreFromSession: () => {
        const state = get();
        if (state.interruptedAt) {
          const timeSinceInterrupt = Date.now() - new Date(state.interruptedAt).getTime();
          const maxResumeTime = 30 * 60 * 1000; // 30 minutes
          
          if (timeSinceInterrupt < maxResumeTime && state.syncQueue.length > 0) {
            // Auto-resume if interrupted recently
            setTimeout(() => {
              get().resumeSession();
            }, 2000);
          } else {
            // Clear stale session data
            set({
              interruptedAt: null,
              resumePoint: 0,
              sessionId: null
            });
          }
        }
      }
    }),
    {
      name: 'sync-storage',
      partialize: (state) => ({
        syncQueue: state.syncQueue,
        failedItems: state.failedItems,
        lastSyncTime: state.lastSyncTime,
        pendingChanges: state.pendingChanges,
        sessionId: state.sessionId,
        resumePoint: state.resumePoint,
        interruptedAt: state.interruptedAt,
        totalItems: state.totalItems,
        syncedItems: state.syncedItems
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Auto-restore session on rehydration
          setTimeout(() => {
            state.restoreFromSession();
          }, 1000);
        }
      }
    }
  )
);