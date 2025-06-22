'use client';

import { useState, useEffect } from 'react';
import { Alert, Group, Text, Progress, ActionIcon, Transition } from '@mantine/core';
import { 
  IconWifi, 
  IconWifiOff, 
  IconX, 
  IconRefresh,
  IconCloudDownload
} from '@tabler/icons-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncStore } from '@/stores/sync';

interface OfflineStatusBannerProps {
  dismissible?: boolean;
  position?: 'top' | 'bottom';
  showSyncProgress?: boolean;
}

export function OfflineStatusBanner({ 
  dismissible = true,
  position = 'top',
  showSyncProgress = true
}: OfflineStatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isOnline, wasOffline } = useNetworkStatus();
  const { 
    syncProgress, 
    isSyncing, 
    pendingChanges,
    lastSyncTime,
    syncError,
    retrySync
  } = useSyncStore();

  useEffect(() => {
    setMounted(true);
    // Reset dismissed state when going offline
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleRetrySync = async () => {
    await retrySync();
  };

  // Don't show if dismissed or always online
  if (dismissed || (isOnline && !wasOffline && !isSyncing && !syncError)) {
    return null;
  }

  const getBannerColor = () => {
    if (syncError) return 'red';
    if (!isOnline) return 'orange';
    if (isSyncing) return 'blue';
    return 'green';
  };

  const getBannerIcon = () => {
    if (syncError) return <IconWifiOff size={20} />;
    if (!isOnline) return <IconWifiOff size={20} />;
    if (isSyncing) return <IconCloudDownload size={20} />;
    return <IconWifi size={20} />;
  };

  const getBannerTitle = () => {
    if (syncError) return 'Sync Error';
    if (!isOnline) return 'Working Offline';
    if (isSyncing) return 'Syncing Data...';
    if (wasOffline && isOnline) return 'Back Online';
    return 'Connected';
  };

  const getBannerMessage = () => {
    if (syncError) {
      return `Failed to sync data: ${syncError}`;
    }
    if (!isOnline) {
      return `You're working offline. ${pendingChanges} changes will sync when connection is restored.`;
    }
    if (isSyncing) {
      return `Syncing ${pendingChanges} pending changes...`;
    }
    if (wasOffline && isOnline) {
      return 'Connection restored. Your changes are being synced.';
    }
    return 'All changes are synced.';
  };

  const showProgressBar = showSyncProgress && (isSyncing || syncProgress > 0);

  return (
    <Transition
      mounted={mounted}
      transition="slide-down"
      duration={400}
      timingFunction="ease"
    >
      {(styles) => (
        <div
          style={{
            ...styles,
            position: 'fixed',
            [position]: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            padding: '0.5rem',
          }}
        >
          <Alert
            icon={getBannerIcon()}
            color={getBannerColor()}
            variant="filled"
            withCloseButton={false}
            radius="md"
            styles={{
              root: {
                backgroundColor: getBannerColor() === 'orange' 
                  ? 'var(--mantine-color-orange-8)' 
                  : undefined,
              },
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Text fw={600} size="sm">
                    {getBannerTitle()}
                  </Text>
                  {pendingChanges > 0 && !isSyncing && (
                    <Text 
                      size="xs" 
                      opacity={0.8}
                      bg="rgba(255,255,255,0.2)"
                      px={8}
                      py={2}
                      style={{ borderRadius: '12px' }}
                    >
                      {pendingChanges} pending
                    </Text>
                  )}
                </Group>
                <Text size="xs" opacity={0.9}>
                  {getBannerMessage()}
                </Text>
                {lastSyncTime && !isSyncing && (
                  <Text size="xs" opacity={0.7} mt={4}>
                    Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
                  </Text>
                )}
                {showProgressBar && (
                  <Progress
                    value={syncProgress}
                    size="xs"
                    color="white"
                    mt={8}
                    radius="xl"
                    animated={isSyncing}
                    styles={{
                      root: { backgroundColor: 'rgba(255,255,255,0.2)' },
                      bar: { backgroundColor: 'rgba(255,255,255,0.8)' },
                    }}
                  />
                )}
              </div>
              <Group gap="xs">
                {syncError && (
                  <ActionIcon
                    variant="transparent"
                    color="white"
                    size="sm"
                    onClick={handleRetrySync}
                    title="Retry sync"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                )}
                {dismissible && (
                  <ActionIcon
                    variant="transparent"
                    color="white"
                    size="sm"
                    onClick={handleDismiss}
                    title="Dismiss"
                  >
                    <IconX size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Group>
          </Alert>
        </div>
      )}
    </Transition>
  );
}

export default OfflineStatusBanner;