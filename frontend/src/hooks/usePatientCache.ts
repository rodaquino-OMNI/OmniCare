/**
 * Custom hook for patient cache management
 * Provides easy access to cached patient data with automatic updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Patient, 
  AllergyIntolerance, 
  Condition, 
  MedicationRequest,
  Encounter,
  Observation,
  DocumentReference
} from '@medplum/fhirtypes';
import { patientCacheService } from '@/services/patient-cache.service';
import { patientSyncService, SyncStatus } from '@/services/patient-sync.service';

// Hook options
interface UsePatientCacheOptions {
  enableSync?: boolean;
  prefetchRelated?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Hook return type
interface UsePatientCacheReturn {
  // Data
  patient: Patient | null;
  allergies: AllergyIntolerance[];
  conditions: Condition[];
  medications: MedicationRequest[];
  encounters: Encounter[];
  vitals: Observation[];
  labs: Observation[];
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  
  // Cache info
  fromCache: boolean;
  lastUpdated: Date | null;
  cacheStats: {
    hitRate: number;
    totalSize: number;
    patientCount: number;
  };
  
  // Sync status
  syncStatus: SyncStatus;
  
  // Actions
  refresh: (force?: boolean) => Promise<void>;
  invalidate: () => void;
  prefetch: (patientIds: string[]) => Promise<void>;
}

/**
 * Hook for accessing cached patient data
 */
export function usePatientCache(
  patientId: string | null,
  options: UsePatientCacheOptions = {}
): UsePatientCacheReturn {
  const {
    enableSync = true,
    prefetchRelated = true,
    autoRefresh = false,
    refreshInterval = 300000 // 5 minutes
  } = options;

  // State
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [vitals, setVitals] = useState<Observation[]>([]);
  const [labs, setLabs] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cacheStats, setCacheStats] = useState({
    hitRate: ResourceHistoryTable,
    totalSize: ResourceHistoryTable,
    patientCount: ResourceHistoryTable
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.DISCONNECTED);

  // Refs
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // Load patient data
  const loadPatientData = useCallback(async (id: string, forceRefresh = false) => {
    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      // Load patient
      const patientData = await patientCacheService.getPatient(id, {
        includeRelated: prefetchRelated,
        forceRefresh
      });
      
      if (isMountedRef.current) {
        setPatient(patientData);
      }

      // Load related data in parallel
      const [
        allergyData,
        conditionData,
        medicationData,
        encounterData,
        vitalData,
        labData
      ] = await Promise.all([
        patientCacheService.getPatientAllergies(id, forceRefresh),
        patientCacheService.getPatientConditions(id, forceRefresh),
        patientCacheService.getPatientMedications(id, forceRefresh),
        patientCacheService.getPatientEncounters(id, forceRefresh),
        patientCacheService.getPatientVitalSigns(id, forceRefresh),
        patientCacheService.getPatientLabResults(id, forceRefresh)
      ]);

      if (isMountedRef.current) {
        setAllergies(allergyData);
        setConditions(conditionData);
        setMedications(medicationData);
        setEncounters(encounterData);
        setVitals(vitalData);
        setLabs(labData);
        setLastUpdated(new Date());

        // Update cache stats
        const stats = patientCacheService.getStats();
        const sizeInfo = patientCacheService.getCacheSizeInfo();
        setCacheStats({
          hitRate: stats.hitRate,
          totalSize: sizeInfo.totalSize,
          patientCount: sizeInfo.patientCount
        });
        setFromCache(!forceRefresh && stats.hitRate > 0.5);
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
      // Reset data on error
      if (isMountedRef.current) {
        setPatient(null);
        setAllergies([]);
        setConditions([]);
        setMedications([]);
        setEncounters([]);
        setVitals([]);
        setLabs([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [prefetchRelated]);

  // Refresh function
  const refresh = useCallback(async (force = true) => {
    if (!patientId || refreshing) return;
    
    setRefreshing(true);
    try {
      await loadPatientData(patientId, force);
      
      // Trigger sync if enabled
      if (enableSync && force) {
        await patientSyncService.syncPatient(patientId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [patientId, refreshing, loadPatientData, enableSync]);

  // Invalidate cache
  const invalidate = useCallback(() => {
    if (patientId) {
      patientCacheService.invalidatePatient(patientId);
    }
  }, [patientId]);

  // Prefetch patients
  const prefetch = useCallback(async (patientIds: string[]) => {
    await patientCacheService.batchGetPatients(patientIds);
  }, []);

  // Effect: Load patient data
  useEffect(() => {
    if (!patientId) {
      // Clear data when no patient
      setPatient(null);
      setAllergies([]);
      setConditions([]);
      setMedications([]);
      setEncounters([]);
      setVitals([]);
      setLabs([]);
      return;
    }

    loadPatientData(patientId);
  }, [patientId, loadPatientData]);

  // Effect: Setup auto-refresh
  useEffect(() => {
    if (!autoRefresh || !patientId) return;

    refreshTimerRef.current = setInterval(() => {
      refresh(false); // Soft refresh
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, patientId, refreshInterval, refresh]);

  // Effect: Setup cache event listeners
  useEffect(() => {
    if (!patientId) return;

    const handleCacheUpdate = (event: any) => {
      if (event.patientId === patientId && isMountedRef.current) {
        loadPatientData(patientId);
      }
    };

    const handleCacheInvalidated = (event: any) => {
      if (event.patientId === patientId && isMountedRef.current) {
        loadPatientData(patientId, true);
      }
    };

    const handleSyncUpdate = (event: any) => {
      if (event.patientId === patientId && isMountedRef.current) {
        loadPatientData(patientId);
      }
    };

    const handleSyncStatusChange = (event: any) => {
      if (isMountedRef.current) {
        setSyncStatus(event.newStatus);
      }
    };

    // Cache events
    patientCacheService.on('cache:patient-updated', handleCacheUpdate);
    patientCacheService.on('cache:related-invalidated', handleCacheUpdate);
    patientCacheService.on('cache:invalidated', handleCacheInvalidated);

    // Sync events
    if (enableSync) {
      patientSyncService.on('sync:patient-updated', handleSyncUpdate);
      patientSyncService.on('sync:status-changed', handleSyncStatusChange);
      
      // Get initial sync status
      setSyncStatus(patientSyncService.getSyncStatus().status);
    }

    return () => {
      patientCacheService.off('cache:patient-updated', handleCacheUpdate);
      patientCacheService.off('cache:related-invalidated', handleCacheUpdate);
      patientCacheService.off('cache:invalidated', handleCacheInvalidated);
      
      if (enableSync) {
        patientSyncService.off('sync:patient-updated', handleSyncUpdate);
        patientSyncService.off('sync:status-changed', handleSyncStatusChange);
      }
    };
  }, [patientId, loadPatientData, enableSync]);

  // Effect: Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    // Data
    patient,
    allergies,
    conditions,
    medications,
    encounters,
    vitals,
    labs,
    
    // Loading states
    loading,
    refreshing,
    
    // Cache info
    fromCache,
    lastUpdated,
    cacheStats,
    
    // Sync status
    syncStatus,
    
    // Actions
    refresh,
    invalidate,
    prefetch
  };
}

/**
 * Hook for cache statistics
 */
export function useCacheStats() {
  const [stats, setStats] = useState(patientCacheService.getStats());
  const [sizeInfo, setSizeInfo] = useState(patientCacheService.getCacheSizeInfo());

  useEffect(() => {
    const updateStats = () => {
      setStats(patientCacheService.getStats());
      setSizeInfo(patientCacheService.getCacheSizeInfo());
    };

    // Update every 5 seconds
    const interval = setInterval(updateStats, 500);

    // Listen for cache events
    const events = [
      'cache:patient-added',
      'cache:patient-removed',
      'cache:cleared',
      'cache:cleanup'
    ];

    events.forEach(event => {
      patientCacheService.on(event, updateStats);
    });

    return () => {
      clearInterval(interval);
      events.forEach(event => {
        patientCacheService.off(event, updateStats);
      });
    };
  }, []);

  return { stats, sizeInfo };
}

/**
 * Hook for sync status
 */
export function useSyncStatus() {
  const [syncState, setSyncState] = useState(patientSyncService.getSyncStatus());

  useEffect(() => {
    const updateSyncState = () => {
      setSyncState(patientSyncService.getSyncStatus());
    };

    // Update every 2 seconds
    const interval = setInterval(updateSyncState, 200);

    // Listen for sync events
    const handleStatusChange = () => {
      updateSyncState();
    };

    patientSyncService.on('sync:status-changed', handleStatusChange);
    patientSyncService.on('sync:error', handleStatusChange);
    patientSyncService.on('sync:completed', handleStatusChange);

    return () => {
      clearInterval(interval);
      patientSyncService.off('sync:status-changed', handleStatusChange);
      patientSyncService.off('sync:error', handleStatusChange);
      patientSyncService.off('sync:completed', handleStatusChange);
    };
  }, []);

  const clearErrors = useCallback(() => {
    patientSyncService.clearErrors();
    setSyncState(patientSyncService.getSyncStatus());
  }, []);

  const syncAll = useCallback(async () => {
    await patientSyncService.syncAll();
  }, []);

  return {
    ...syncState,
    clearErrors,
    syncAll
  };
}