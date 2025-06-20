import React, {createContext, useContext, useEffect, useCallback} from 'react';
import {AppState} from 'react-native';
import {useOffline} from './OfflineProvider';
import {useAuth} from './AuthProvider';
import {useNotifications} from './NotificationProvider';
import {medplumClient} from '@config/medplum';
import {FHIR_RESOURCES} from '@config/medplum';
import {SyncableData} from '@types/index';

interface SyncContextType {
  syncPatientData: (patientId: string) => Promise<void>;
  syncVitalSigns: (patientId: string) => Promise<void>;
  syncMedications: (patientId: string) => Promise<void>;
  syncTasks: () => Promise<void>;
  syncObservations: (patientId: string) => Promise<void>;
  forceSyncAll: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

interface SyncProviderProps {
  children: React.ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({children}) => {
  const {isOnline, storeOfflineData, syncData} = useOffline();
  const {user} = useAuth();
  const {sendLocalNotification} = useNotifications();

  useEffect(() => {
    // Set up background sync
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isOnline) {
        // App became active and we're online - trigger sync
        syncData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isOnline, syncData]);

  // Periodic sync when app is active
  useEffect(() => {
    if (isOnline && user) {
      const syncInterval = setInterval(() => {
        syncData();
      }, 5 * 60 * 1000); // Sync every 5 minutes

      return () => clearInterval(syncInterval);
    }
  }, [isOnline, user, syncData]);

  const syncPatientData = useCallback(async (patientId: string) => {
    try {
      const patient = await medplumClient.readResource(FHIR_RESOURCES.PATIENT, patientId);
      
      const syncData: SyncableData = {
        id: patientId,
        resourceType: FHIR_RESOURCES.PATIENT,
        lastModified: new Date().toISOString(),
        syncStatus: isOnline ? 'synced' : 'pending',
        localChanges: patient,
      };

      await storeOfflineData(syncData);
      
      // Also sync related data
      await Promise.all([
        syncVitalSigns(patientId),
        syncMedications(patientId),
        syncObservations(patientId),
      ]);
      
    } catch (error) {
      console.error('Error syncing patient data:', error);
      
      if (!isOnline) {
        // Store as pending sync
        const pendingSync: SyncableData = {
          id: patientId,
          resourceType: FHIR_RESOURCES.PATIENT,
          lastModified: new Date().toISOString(),
          syncStatus: 'pending',
        };
        await storeOfflineData(pendingSync);
      }
    }
  }, [isOnline, storeOfflineData]);

  const syncVitalSigns = useCallback(async (patientId: string) => {
    try {
      const vitals = await medplumClient.searchResources(FHIR_RESOURCES.OBSERVATION, {
        subject: `Patient/${patientId}`,
        category: 'vital-signs',
        _sort: '-date',
        _count: '50',
      });

      for (const vital of vitals) {
        const syncData: SyncableData = {
          id: vital.id!,
          resourceType: FHIR_RESOURCES.OBSERVATION,
          lastModified: vital.meta?.lastUpdated || new Date().toISOString(),
          syncStatus: isOnline ? 'synced' : 'pending',
          localChanges: vital,
        };

        await storeOfflineData(syncData);
      }
    } catch (error) {
      console.error('Error syncing vital signs:', error);
    }
  }, [isOnline, storeOfflineData]);

  const syncMedications = useCallback(async (patientId: string) => {
    try {
      const medications = await medplumClient.searchResources(FHIR_RESOURCES.MEDICATION_REQUEST, {
        subject: `Patient/${patientId}`,
        status: 'active',
        _sort: '-authored-on',
      });

      for (const medication of medications) {
        const syncData: SyncableData = {
          id: medication.id!,
          resourceType: FHIR_RESOURCES.MEDICATION_REQUEST,
          lastModified: medication.meta?.lastUpdated || new Date().toISOString(),
          syncStatus: isOnline ? 'synced' : 'pending',
          localChanges: medication,
        };

        await storeOfflineData(syncData);
      }

      // Also sync medication administrations
      const administrations = await medplumClient.searchResources(FHIR_RESOURCES.MEDICATION_ADMINISTRATION, {
        subject: `Patient/${patientId}`,
        status: 'completed,in-progress',
        _sort: '-effective-time',
        _count: '100',
      });

      for (const administration of administrations) {
        const syncData: SyncableData = {
          id: administration.id!,
          resourceType: FHIR_RESOURCES.MEDICATION_ADMINISTRATION,
          lastModified: administration.meta?.lastUpdated || new Date().toISOString(),
          syncStatus: isOnline ? 'synced' : 'pending',
          localChanges: administration,
        };

        await storeOfflineData(syncData);
      }
    } catch (error) {
      console.error('Error syncing medications:', error);
    }
  }, [isOnline, storeOfflineData]);

  const syncTasks = useCallback(async () => {
    try {
      if (!user?.practitionerId) return;

      const tasks = await medplumClient.searchResources(FHIR_RESOURCES.TASK, {
        owner: `Practitioner/${user.practitionerId}`,
        status: 'ready,in-progress,requested',
        _sort: '-authored-on',
        _count: '100',
      });

      for (const task of tasks) {
        const syncData: SyncableData = {
          id: task.id!,
          resourceType: FHIR_RESOURCES.TASK,
          lastModified: task.meta?.lastUpdated || new Date().toISOString(),
          syncStatus: isOnline ? 'synced' : 'pending',
          localChanges: task,
        };

        await storeOfflineData(syncData);

        // Check for overdue tasks and create notifications
        if (task.executionPeriod?.end) {
          const dueDate = new Date(task.executionPeriod.end);
          const now = new Date();
          
          if (dueDate < now && task.status !== 'completed') {
            sendLocalNotification({
              type: 'task_reminder',
              title: 'Task Overdue',
              body: `${task.description || 'Clinical task'} is overdue`,
              priority: 'high',
              data: {
                taskId: task.id,
                patientId: task.for?.reference?.split('/')[1],
              },
            });
          }
        }
      }
    } catch (error) {
      console.error('Error syncing tasks:', error);
    }
  }, [user, isOnline, storeOfflineData, sendLocalNotification]);

  const syncObservations = useCallback(async (patientId: string) => {
    try {
      const observations = await medplumClient.searchResources(FHIR_RESOURCES.OBSERVATION, {
        subject: `Patient/${patientId}`,
        _sort: '-date',
        _count: '100',
      });

      for (const observation of observations) {
        const syncData: SyncableData = {
          id: observation.id!,
          resourceType: FHIR_RESOURCES.OBSERVATION,
          lastModified: observation.meta?.lastUpdated || new Date().toISOString(),
          syncStatus: isOnline ? 'synced' : 'pending',
          localChanges: observation,
        };

        await storeOfflineData(syncData);

        // Check for critical values and create alerts
        if (observation.valueQuantity && observation.code?.coding?.[0]?.code) {
          const isAbnormal = checkAbnormalValue(observation);
          if (isAbnormal) {
            sendLocalNotification({
              type: 'patient_alert',
              title: 'Abnormal Lab Result',
              body: `${observation.code.coding[0].display || 'Lab value'} is abnormal for patient`,
              priority: 'high',
              data: {
                patientId,
                observationId: observation.id,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error('Error syncing observations:', error);
    }
  }, [isOnline, storeOfflineData, sendLocalNotification]);

  const checkAbnormalValue = (observation: any): boolean => {
    // Simplified abnormal value checking
    // In a real implementation, this would use reference ranges
    const value = observation.valueQuantity?.value;
    const code = observation.code?.coding?.[0]?.code;
    
    if (!value || !code) return false;
    
    // Example abnormal ranges (simplified)
    const abnormalRanges: Record<string, {min: number; max: number}> = {
      '8310-5': {min: 36.5, max: 37.5}, // Body temperature
      '8867-4': {min: 60, max: 100}, // Heart rate
      '8480-6': {min: 90, max: 140}, // Systolic BP
      '8462-4': {min: 60, max: 90}, // Diastolic BP
      '2708-6': {min: 95, max: 100}, // Oxygen saturation
    };
    
    const range = abnormalRanges[code];
    if (range) {
      return value < range.min || value > range.max;
    }
    
    return false;
  };

  const forceSyncAll = useCallback(async () => {
    try {
      if (!isOnline) {
        sendLocalNotification({
          type: 'system_message',
          title: 'Sync Failed',
          body: 'Device is offline. Sync will resume when connection is restored.',
          priority: 'normal',
          data: {},
        });
        return;
      }

      // Force sync all pending data
      await syncData();
      
      // Sync current tasks
      await syncTasks();
      
      sendLocalNotification({
        type: 'system_message',
        title: 'Sync Complete',
        body: 'All data has been synchronized successfully.',
        priority: 'low',
        data: {},
      });
    } catch (error) {
      console.error('Error in force sync:', error);
      sendLocalNotification({
        type: 'system_message',
        title: 'Sync Error',
        body: 'Some data could not be synchronized. Please try again later.',
        priority: 'normal',
        data: {},
      });
    }
  }, [isOnline, syncData, syncTasks, sendLocalNotification]);

  const contextValue: SyncContextType = {
    syncPatientData,
    syncVitalSigns,
    syncMedications,
    syncTasks,
    syncObservations,
    forceSyncAll,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};