import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {OfflineState, SyncableData} from '@types/index';

interface OfflineContextType {
  offlineState: OfflineState;
  storeOfflineData: (data: SyncableData) => Promise<void>;
  getOfflineData: (resourceType: string, id?: string) => Promise<SyncableData[]>;
  syncData: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
  isOnline: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: React.ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({children}) => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: true,
    pendingSyncCount: 0,
    lastSyncTime: null,
    syncInProgress: false,
  });

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initialize offline state from storage
    loadOfflineState();

    // Listen to network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true;
      setIsOnline(online);
      setOfflineState(prev => ({...prev, isOnline: online}));
      
      // Trigger sync when coming online
      if (online && !prev.isOnline) {
        syncData();
      }
    });

    return unsubscribe;
  }, []);

  const loadOfflineState = async () => {
    try {
      const storedState = await AsyncStorage.getItem('offlineState');
      if (storedState) {
        const parsed = JSON.parse(storedState);
        setOfflineState(prev => ({...prev, ...parsed}));
      }
      
      // Count pending sync items
      const pendingCount = await countPendingSyncItems();
      setOfflineState(prev => ({...prev, pendingSyncCount: pendingCount}));
    } catch (error) {
      console.error('Error loading offline state:', error);
    }
  };

  const saveOfflineState = async (state: Partial<OfflineState>) => {
    try {
      const newState = {...offlineState, ...state};
      setOfflineState(newState);
      await AsyncStorage.setItem('offlineState', JSON.stringify(newState));
    } catch (error) {
      console.error('Error saving offline state:', error);
    }
  };

  const countPendingSyncItems = async (): Promise<number> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const syncKeys = keys.filter(key => key.startsWith('sync:'));
      let count = 0;
      
      for (const key of syncKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed: SyncableData = JSON.parse(data);
          if (parsed.syncStatus === 'pending' || parsed.syncStatus === 'failed') {
            count++;
          }
        }
      }
      
      return count;
    } catch (error) {
      console.error('Error counting pending sync items:', error);
      return 0;
    }
  };

  const storeOfflineData = useCallback(async (data: SyncableData) => {
    try {
      const key = `sync:${data.resourceType}:${data.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(data));
      
      // Update pending sync count
      const pendingCount = await countPendingSyncItems();
      await saveOfflineState({pendingSyncCount: pendingCount});
      
      console.log(`Stored offline data: ${key}`);
    } catch (error) {
      console.error('Error storing offline data:', error);
      throw error;
    }
  }, []);

  const getOfflineData = useCallback(async (resourceType: string, id?: string): Promise<SyncableData[]> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const syncKeys = keys.filter(key => {
        if (id) {
          return key === `sync:${resourceType}:${id}`;
        }
        return key.startsWith(`sync:${resourceType}:`);
      });
      
      const data: SyncableData[] = [];
      for (const key of syncKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          data.push(JSON.parse(item));
        }
      }
      
      return data.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    } catch (error) {
      console.error('Error getting offline data:', error);
      return [];
    }
  }, []);

  const syncData = useCallback(async () => {
    if (!isOnline || offlineState.syncInProgress) {
      return;
    }

    try {
      await saveOfflineState({syncInProgress: true});
      
      const keys = await AsyncStorage.getAllKeys();
      const syncKeys = keys.filter(key => key.startsWith('sync:'));
      
      let successCount = 0;
      let failedCount = 0;
      
      for (const key of syncKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const syncItem: SyncableData = JSON.parse(data);
          
          if (syncItem.syncStatus === 'pending' || syncItem.syncStatus === 'failed') {
            try {
              // Attempt to sync with server
              await syncWithServer(syncItem);
              
              // Mark as synced
              syncItem.syncStatus = 'synced';
              syncItem.lastModified = new Date().toISOString();
              await AsyncStorage.setItem(key, JSON.stringify(syncItem));
              successCount++;
            } catch (syncError) {
              console.error(`Failed to sync ${key}:`, syncError);
              syncItem.syncStatus = 'failed';
              await AsyncStorage.setItem(key, JSON.stringify(syncItem));
              failedCount++;
            }
          }
        }
      }
      
      const pendingCount = await countPendingSyncItems();
      await saveOfflineState({
        syncInProgress: false,
        pendingSyncCount: pendingCount,
        lastSyncTime: new Date().toISOString(),
      });
      
      console.log(`Sync completed: ${successCount} successful, ${failedCount} failed`);
    } catch (error) {
      console.error('Error during sync:', error);
      await saveOfflineState({syncInProgress: false});
    }
  }, [isOnline, offlineState.syncInProgress]);

  const syncWithServer = async (syncItem: SyncableData) => {
    // This would implement the actual sync logic with Medplum
    // For now, we'll simulate a successful sync
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // Simulate network request
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 1000);
    });
  };

  const clearOfflineData = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const syncKeys = keys.filter(key => key.startsWith('sync:'));
      await AsyncStorage.multiRemove(syncKeys);
      
      await saveOfflineState({
        pendingSyncCount: 0,
        lastSyncTime: new Date().toISOString(),
      });
      
      console.log('Cleared offline data');
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && offlineState.pendingSyncCount > 0) {
      const syncTimer = setTimeout(() => {
        syncData();
      }, 5000); // Wait 5 seconds after coming online
      
      return () => clearTimeout(syncTimer);
    }
  }, [isOnline, offlineState.pendingSyncCount, syncData]);

  const contextValue: OfflineContextType = {
    offlineState,
    storeOfflineData,
    getOfflineData,
    syncData,
    clearOfflineData,
    isOnline,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
};