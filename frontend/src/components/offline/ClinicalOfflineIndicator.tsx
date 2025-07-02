/**
 * Clinical Offline Indicator
 * Shows detailed offline status for clinical workflows with patient context
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Badge, 
  Tooltip, 
  Progress, 
  Text, 
  Group, 
  Stack, 
  Paper, 
  Button,
  Alert,
  Divider,
  ActionIcon,
  Notification
} from '@mantine/core';
import { 
  IconWifiOff, 
  IconWifi, 
  IconCloudOff, 
  IconCloud, 
  IconAlertCircle,
  IconHeartbeat,
  IconNotes,
  IconPaperclip,
  IconMicrophone,
  IconUser,
  IconShieldCheck,
  IconRefresh,
  IconClock,
  IconCheck,
  IconX,
  IconExclamationMark
} from '@tabler/icons-react';
import { getClinicalOfflineSyncService, ClinicalSyncStatus } from '@/services/offline-sync-enhanced.service';
import { clinicalIndexedDBService } from '@/services/indexeddb.clinical.service';

interface ClinicalOfflineIndicatorProps {
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
  showWhenOnline?: boolean;
  patientContext?: {
    patientId: string;
    patientName: string;
    isActive: boolean;
  };
  onSyncComplete?: () => void;
}

export function ClinicalOfflineIndicator({
  position = 'bottom-right',
  showWhenOnline = true,
  patientContext,
  onSyncComplete
}: ClinicalOfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [clinicalStatus, setClinicalStatus] = useState<ClinicalSyncStatus | null>(null);
  const [clinicalStats, setClinicalStats] = useState<any>(null);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const positionStyles = {
    'top-right': { top: 16, right: 16 },
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'top-left': { top: 16, left: 16 }
  };

  // Network status monitoring
  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // Clinical status monitoring
  const updateClinicalStatus = useCallback(async () => {
    try {
      const clinicalSyncService = getClinicalOfflineSyncService();
      const status = clinicalSyncService.getClinicalSyncStatus();
      setClinicalStatus(status);

      const stats = await clinicalIndexedDBService.getClinicalStats();
      setClinicalStats(stats);
    } catch (error) {
      console.error('Failed to update clinical status:', error);
    }
  }, []);

  useEffect(() => {
    updateClinicalStatus();
    const interval = setInterval(updateClinicalStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [updateClinicalStatus]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && clinicalStatus && !clinicalStatus.isSyncing) {
      const pendingOperations = getPendingOperationsCount();
      if (pendingOperations > 0) {
        handleManualSync();
      }
    }
  }, [isOnline, clinicalStatus]);

  const getPendingOperationsCount = () => {
    if (!clinicalStatus?.clinicalSyncProgress) return 0;
    
    const { notes, attachments, workflows } = clinicalStatus.clinicalSyncProgress;
    return (notes?.pending || 0) + (attachments?.pending || 0) + (workflows?.pending || 0);
  };

  const getStatusColor = () => {
    if (!isOnline) return 'red';
    if (clinicalStatus?.isSyncing) return 'blue';
    if (getPendingOperationsCount() > 0) return 'orange';
    return 'green';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <IconCloudOff size={16} />;
    if (clinicalStatus?.isSyncing) return <IconRefresh size={16} className="animate-spin" />;
    if (getPendingOperationsCount() > 0) return <IconClock size={16} />;
    return <IconCloud size={16} />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (clinicalStatus?.isSyncing) return 'Syncing';
    
    const pending = getPendingOperationsCount();
    if (pending > 0) return `${pending} Pending`;
    
    return 'Online';
  };

  const handleManualSync = async () => {
    if (!isOnline || clinicalStatus?.isSyncing) return;

    try {
      setLastSyncAttempt(new Date());
      setSyncError(null);
      
      const clinicalSyncService = getClinicalOfflineSyncService();
      await clinicalSyncService.syncClinicalData({
        prioritizeActivePatient: true,
        activePatientId: patientContext?.patientId
      });
      
      onSyncComplete?.();
      await updateClinicalStatus();
      
    } catch (error) {
      console.error('Manual sync failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    }
  };

  // Don't show when online unless specified or there are pending operations
  if (isOnline && !showWhenOnline && getPendingOperationsCount() === 0) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', zIndex: 1000, ...positionStyles[position] }}>
      <Tooltip
        label={showDetails ? null : getStatusText()}
        position="left"
        disabled={showDetails}
      >
        <Badge
          variant={isOnline ? 'light' : 'filled'}
          color={getStatusColor()}
          size="lg"
          radius="md"
          leftSection={getStatusIcon()}
          style={{ cursor: 'pointer' }}
          onClick={() => setShowDetails(!showDetails)}
        >
          {getStatusText()}
          {getPendingOperationsCount() > 0 && (
            <Text size="xs" ml={4}>
              ({getPendingOperationsCount()})
            </Text>
          )}
        </Badge>
      </Tooltip>

      {showDetails && (
        <Paper
          shadow="lg"
          radius="md"
          p="md"
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 8,
            minWidth: 320,
            maxWidth: 380,
            zIndex: 1001,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Stack gap="sm">
            {/* Header */}
            <Group justify="space-between">
              <Group gap="xs">
                <IconHeartbeat size={20} color="var(--mantine-color-blue-6)" />
                <Text fw={600} size="sm">
                  Clinical Status
                </Text>
              </Group>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setShowDetails(false)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>

            {/* Network Status */}
            <Group justify="space-between">
              <Group gap="xs">
                {isOnline ? (
                  <IconWifi size={16} color="var(--mantine-color-green-6)" />
                ) : (
                  <IconWifiOff size={16} color="var(--mantine-color-red-6)" />
                )}
                <Text size="sm">
                  {isOnline ? 'Connected' : 'Offline Mode'}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date().toLocaleTimeString()}
              </Text>
            </Group>

            {/* Patient Context */}
            {patientContext && (
              <Paper bg="blue.0" p="xs" radius="sm">
                <Group gap="xs">
                  <IconUser size={16} color="var(--mantine-color-blue-6)" />
                  <div>
                    <Text size="sm" fw={500}>
                      {patientContext.patientName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {patientContext.isActive ? 'Active Patient' : 'Patient Context'}
                      {clinicalStatus?.patientDataCacheStatus && (
                        <> • Cache: {clinicalStatus.patientDataCacheStatus}</>
                      )}
                    </Text>
                  </div>
                </Group>
              </Paper>
            )}

            {/* Offline Alert */}
            {!isOnline && (
              <Alert icon={<IconShieldCheck size={16} />} color="orange" variant="light">
                <Text size="xs">
                  Working offline. All data is encrypted and saved locally.
                  Changes will sync when reconnected.
                </Text>
              </Alert>
            )}

            {/* Sync Error */}
            {syncError && (
              <Alert icon={<IconExclamationMark size={16} />} color="red" variant="light">
                <Text size="xs">
                  Last sync failed: {syncError}
                </Text>
              </Alert>
            )}

            <Divider />

            {/* Clinical Data Status */}
            <Stack gap="xs">
              <Text size="xs" fw={500} c="dimmed">
                Clinical Data
              </Text>
              
              {/* Clinical Notes */}
              <Group justify="space-between">
                <Group gap="xs">
                  <IconNotes size={16} color="var(--mantine-color-blue-6)" />
                  <Text size="xs">Notes</Text>
                </Group>
                <Badge size="xs" variant="light" color={
                  clinicalStatus?.clinicalSyncProgress?.notes?.pending ? 'orange' : 'green'
                }>
                  {clinicalStatus?.clinicalSyncProgress?.notes?.pending || 0} pending
                </Badge>
              </Group>

              {/* Attachments */}
              <Group justify="space-between">
                <Group gap="xs">
                  <IconPaperclip size={16} color="var(--mantine-color-purple-6)" />
                  <Text size="xs">Attachments</Text>
                </Group>
                <Badge size="xs" variant="light" color={
                  clinicalStatus?.clinicalSyncProgress?.attachments?.pending ? 'orange' : 'green'
                }>
                  {clinicalStatus?.clinicalSyncProgress?.attachments?.pending || 0} pending
                </Badge>
              </Group>

              {/* Workflows */}
              <Group justify="space-between">
                <Group gap="xs">
                  <IconHeartbeat size={16} color="var(--mantine-color-green-6)" />
                  <Text size="xs">Workflows</Text>
                </Group>
                <Badge size="xs" variant="light" color={
                  clinicalStatus?.clinicalSyncProgress?.workflows?.pending ? 'orange' : 'green'
                }>
                  {clinicalStatus?.clinicalSyncProgress?.workflows?.pending || 0} pending
                </Badge>
              </Group>
            </Stack>

            {/* Storage Status */}
            {clinicalStats && (
              <>
                <Divider />
                <Stack gap="xs">
                  <Text size="xs" fw={500} c="dimmed">
                    Local Storage
                  </Text>
                  
                  <Group justify="space-between">
                    <Text size="xs">Notes stored:</Text>
                    <Text size="xs" fw={500}>{clinicalStats.totalNotes}</Text>
                  </Group>
                  
                  <Group justify="space-between">
                    <Text size="xs">Attachments:</Text>
                    <Text size="xs" fw={500}>{clinicalStats.totalAttachments}</Text>
                  </Group>
                  
                  {clinicalStats.recentActivity > 0 && (
                    <Group justify="space-between">
                      <Text size="xs">Recent activity (24h):</Text>
                      <Text size="xs" fw={500}>{clinicalStats.recentActivity}</Text>
                    </Group>
                  )}
                </Stack>
              </>
            )}

            {/* Performance Metrics */}
            {clinicalStatus && (
              <>
                <Divider />
                <Stack gap="xs">
                  <Text size="xs" fw={500} c="dimmed">
                    Performance
                  </Text>
                  
                  <Group justify="space-between">
                    <Text size="xs">Avg sync time:</Text>
                    <Text size="xs" fw={500}>
                      {Math.round(clinicalStatus.averageNoteSync || 0)}ms
                    </Text>
                  </Group>
                  
                  <Group justify="space-between">
                    <Text size="xs">Offline time:</Text>
                    <Text size="xs" fw={500}>
                      {Math.round(clinicalStatus.offlineTimeSpent || 0)}min
                    </Text>
                  </Group>
                </Stack>
              </>
            )}

            {/* Actions */}
            <Group grow>
              <Button
                size="xs"
                variant="light"
                onClick={updateClinicalStatus}
              >
                Refresh
              </Button>
              
              {isOnline && getPendingOperationsCount() > 0 && (
                <Button
                  size="xs"
                  color="green"
                  onClick={handleManualSync}
                  loading={clinicalStatus?.isSyncing}
                  leftSection={<IconRefresh size={14} />}
                >
                  Sync Now
                </Button>
              )}
            </Group>

            {/* Last Sync Info */}
            {(clinicalStatus?.lastSyncAt || lastSyncAttempt) && (
              <Text size="xs" c="dimmed" ta="center">
                Last sync: {(clinicalStatus?.lastSyncAt || lastSyncAttempt)?.toLocaleTimeString()}
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </div>
  );
}

export function ClinicalOfflineStatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  const [clinicalStatus, setClinicalStatus] = useState<ClinicalSyncStatus | null>(null);
  const [autoSyncProgress, setAutoSyncProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const updateStatus = async () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (online && !isOnline) {
        // Just came back online - start auto sync
        setShowProgress(true);
        setAutoSyncProgress(0);
        
        try {
          const clinicalSyncService = getClinicalOfflineSyncService();
          
          // Simulate progress (this would be real progress in production)
          const progressInterval = setInterval(() => {
            setAutoSyncProgress((prev) => {
              if (prev >= 100) {
                clearInterval(progressInterval);
                setTimeout(() => setShowProgress(false), 2000);
                return 100;
              }
              return prev + 10;
            });
          }, 200);
          
          await clinicalSyncService.syncClinicalData();
          
        } catch (error) {
          console.error('Auto-sync failed:', error);
          setShowProgress(false);
        }
      }
      
      // Update clinical status
      try {
        const clinicalSyncService = getClinicalOfflineSyncService();
        const status = clinicalSyncService.getClinicalSyncStatus();
        setClinicalStatus(status);
      } catch (error) {
        console.error('Failed to get clinical status:', error);
      }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [isOnline]);

  // Don't show if online and no pending operations
  const pendingOps = clinicalStatus?.clinicalSyncProgress 
    ? (clinicalStatus.clinicalSyncProgress.notes?.pending || 0) +
      (clinicalStatus.clinicalSyncProgress.attachments?.pending || 0) +
      (clinicalStatus.clinicalSyncProgress.workflows?.pending || 0)
    : 0;

  if (isOnline && !showProgress && pendingOps === 0) {
    return null;
  }

  return (
    <Paper
      p="sm"
      bg={isOnline ? (showProgress ? 'blue.1' : 'orange.1') : 'red.1'}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 999,
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      <Group justify="center" gap="sm">
        {isOnline ? (
          showProgress ? (
            <>
              <IconCloud size={16} color="var(--mantine-color-blue-6)" />
              <Text size="sm" fw={500} c="blue.8">
                Synchronizing clinical data...
              </Text>
            </>
          ) : (
            <>
              <IconClock size={16} color="var(--mantine-color-orange-6)" />
              <Text size="sm" fw={500} c="orange.8">
                {pendingOps} clinical operations pending sync
              </Text>
            </>
          )
        ) : (
          <>
            <IconShieldCheck size={16} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={500} c="red.8">
              Working offline. Clinical data is encrypted and saved locally.
            </Text>
          </>
        )}
      </Group>
      
      {showProgress && autoSyncProgress > 0 && autoSyncProgress < 100 && (
        <Progress
          value={autoSyncProgress}
          size="xs"
          color="blue"
          mt="xs"
          animated
        />
      )}
    </Paper>
  );
}

export default ClinicalOfflineIndicator;