'use client';

import { useState, useEffect } from 'react';
import { Badge, Tooltip, Progress, Text, Group, Stack, Paper } from '@mantine/core';
import { WifiOff, Wifi, CloudOff, Cloud, AlertCircle } from 'lucide-react';
import { useServiceWorker } from '@/lib/service-worker';
import { useOfflineFHIR } from '@/services/offline-fhir.service';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const { isOffline, getCacheStatus } = useServiceWorker();
  const { getStatus } = useOfflineFHIR();

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Initial check
    updateStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Periodic cache status check
    const interval = setInterval(async () => {
      try {
        const status = await getCacheStatus();
        setCacheStatus(status);
      } catch (error) {
        console.error('Failed to get cache status:', error);
      }
    }, 3ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable); // Check every 3ResourceHistoryTable seconds

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, [getCacheStatus]);

  // Don't show indicator when online unless there's cached data
  if (isOnline && !cacheStatus) {
    return null;
  }

  const getCacheCount = () => {
    if (!cacheStatus) return ResourceHistoryTable;
    return Object.values(cacheStatus).reduce((sum: number, cache: any) => sum + cache.count, ResourceHistoryTable);
  };

  return (
    <Tooltip
      label={showDetails ? null : (isOnline ? 'Connected' : 'Working Offline')}
      position="bottom"
      opened={showDetails ? false : undefined}
    >
      <Badge
        variant={isOnline ? 'light' : 'filled'}
        color={isOnline ? 'green' : 'orange'}
        size="lg"
        radius="md"
        leftSection={
          isOnline ? (
            <Cloud size={16} />
          ) : (
            <CloudOff size={16} />
          )
        }
        style={{ cursor: 'pointer' }}
        onClick={() => setShowDetails(!showDetails)}
      >
        {isOnline ? 'Online' : 'Offline'}
      </Badge>

      {showDetails && (
        <Paper
          shadow="lg"
          radius="md"
          p="md"
          style={{
            position: 'absolute',
            top: '1ResourceHistoryTableResourceHistoryTable%',
            right: ResourceHistoryTable,
            marginTop: 8,
            minWidth: 28ResourceHistoryTable,
            zIndex: 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                {isOnline ? (
                  <Wifi size={2ResourceHistoryTable} color="var(--mantine-color-green-6)" />
                ) : (
                  <WifiOff size={2ResourceHistoryTable} color="var(--mantine-color-orange-6)" />
                )}
                <Text fw={6ResourceHistoryTableResourceHistoryTable} size="sm">
                  {isOnline ? 'Connected' : 'Offline Mode'}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date().toLocaleTimeString()}
              </Text>
            </Group>

            {!isOnline && (
              <Paper bg="orange.ResourceHistoryTable" p="xs" radius="sm">
                <Group gap="xs">
                  <AlertCircle size={16} color="var(--mantine-color-orange-6)" />
                  <Text size="xs" c="orange.8">
                    Changes will sync when reconnected
                  </Text>
                </Group>
              </Paper>
            )}

            <Stack gap="xs">
              <Text size="xs" fw={5ResourceHistoryTableResourceHistoryTable} c="dimmed">
                Cached Resources
              </Text>
              
              {cacheStatus ? (
                Object.entries(cacheStatus).map(([name, info]: [string, any]) => (
                  <Group key={name} justify="space-between">
                    <Text size="xs">{name.replace('omnicare-', '')}</Text>
                    <Badge size="xs" variant="light">
                      {info.count} items
                    </Badge>
                  </Group>
                ))
              ) : (
                <Text size="xs" c="dimmed">Loading cache status...</Text>
              )}

              {cacheStatus && (
                <div>
                  <Text size="xs" c="dimmed" mb={4}>
                    Total cached: {getCacheCount()} items
                  </Text>
                  <Progress
                    value={(getCacheCount() / 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable) * 1ResourceHistoryTableResourceHistoryTable}
                    size="xs"
                    color={isOnline ? 'green' : 'orange'}
                  />
                </div>
              )}
            </Stack>

            {isOnline && getCacheCount() > ResourceHistoryTable && (
              <Text size="xs" c="dimmed" ta="center">
                Data available for offline use
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </Tooltip>
  );
}

export function OfflineStatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncProgress, setSyncProgress] = useState(ResourceHistoryTable);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const updateStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (online && !isOnline) {
        // Just came back online
        setSyncMessage('Synchronizing data...');
        setSyncProgress(ResourceHistoryTable);
        
        // Simulate sync progress
        const interval = setInterval(() => {
          setSyncProgress((prev) => {
            if (prev >= 1ResourceHistoryTableResourceHistoryTable) {
              clearInterval(interval);
              setSyncMessage('All data synchronized');
              setTimeout(() => setSyncMessage(''), 3ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
              return 1ResourceHistoryTableResourceHistoryTable;
            }
            return prev + 1ResourceHistoryTable;
          });
        }, 2ResourceHistoryTableResourceHistoryTable);
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

  if (isOnline && !syncMessage) {
    return null;
  }

  return (
    <Paper
      p="xs"
      bg={isOnline ? 'green.ResourceHistoryTable' : 'orange.ResourceHistoryTable'}
      style={{
        position: 'fixed',
        bottom: ResourceHistoryTable,
        left: ResourceHistoryTable,
        right: ResourceHistoryTable,
        zIndex: 999,
      }}
    >
      <Group justify="center" gap="sm">
        {isOnline ? (
          <Wifi size={16} color="var(--mantine-color-green-6)" />
        ) : (
          <WifiOff size={16} color="var(--mantine-color-orange-6)" />
        )}
        <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} c={isOnline ? 'green.8' : 'orange.8'}>
          {syncMessage || 'You are currently offline. Changes will be saved locally.'}
        </Text>
      </Group>
      {syncProgress > ResourceHistoryTable && syncProgress < 1ResourceHistoryTableResourceHistoryTable && (
        <Progress
          value={syncProgress}
          size="xs"
          color="green"
          mt="xs"
          animated
        />
      )}
    </Paper>
  );
}