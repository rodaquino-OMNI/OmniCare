/**
 * Offline Indicator Component
 * Shows offline/online status and sync progress
 */

import React from 'react';
import { 
  IconWifi, 
  IconWifiOff, 
  IconRefresh, 
  IconAlertCircle,
  IconCheck 
} from '@tabler/icons-react';
import { Badge, Button, Progress, Popover, Text, Stack, Group } from '@mantine/core';
import { useIndexedDBSync } from '@/hooks/useIndexedDB';

export function OfflineIndicator() {
  const { status, progress, sync, clearErrors } = useIndexedDBSync();

  if (!status) return null;

  const { isOnline, isSyncing, pendingChanges, syncErrors, lastSyncTime } = status;

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = Date.now();
    const diff = now - lastSyncTime;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return new Date(lastSyncTime).toLocaleDateString();
  };

  return (
    <Popover width={300} position="bottom-end" withArrow>
      <Popover.Target>
        <Button
          variant="subtle"
          size="sm"
          leftSection={
            isOnline ? (
              <IconWifi size={16} />
            ) : (
              <IconWifiOff size={16} />
            )
          }
          color={isOnline ? 'green' : 'orange'}
          loading={isSyncing}
        >
          {isOnline ? 'Online' : 'Offline'}
          {pendingChanges > 0 && (
            <Badge size="xs" color="red" ml={8}>
              {pendingChanges}
            </Badge>
          )}
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack spacing="sm">
          {/* Connection Status */}
          <Group justify="space-between">
            <Text size="sm" fw={500}>Connection Status</Text>
            <Badge
              color={isOnline ? 'green' : 'orange'}
              leftSection={
                isOnline ? (
                  <IconCheck size={12} />
                ) : (
                  <IconWifiOff size={12} />
                )
              }
            >
              {isOnline ? 'Connected' : 'No Connection'}
            </Badge>
          </Group>

          {/* Sync Status */}
          {isSyncing && progress && (
            <>
              <Text size="sm" c="dimmed">
                Syncing {progress.currentResource}...
              </Text>
              <Progress
                value={(progress.completed / progress.total) * 100}
                size="sm"
                striped
                animate
              />
              <Text size="xs" c="dimmed">
                {progress.completed} of {progress.total} items
                {progress.conflicts > 0 && ` (${progress.conflicts} conflicts)`}
              </Text>
            </>
          )}

          {/* Pending Changes */}
          {!isSyncing && pendingChanges > 0 && (
            <Group justify="space-between">
              <Text size="sm">
                {pendingChanges} pending {pendingChanges === 1 ? 'change' : 'changes'}
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                onClick={() => sync()}
                disabled={!isOnline}
              >
                Sync Now
              </Button>
            </Group>
          )}

          {/* Sync Errors */}
          {syncErrors.length > 0 && (
            <>
              <Group justify="space-between">
                <Text size="sm" c="red">
                  <IconAlertCircle size={14} style={{ verticalAlign: 'middle' }} />
                  {' '}{syncErrors.length} sync {syncErrors.length === 1 ? 'error' : 'errors'}
                </Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={clearErrors}
                >
                  Clear
                </Button>
              </Group>
              <Stack spacing={4}>
                {syncErrors.slice(0, 3).map((error, index) => (
                  <Text key={index} size="xs" c="dimmed">
                    {error.resourceType}/{error.resourceId}: {error.error}
                  </Text>
                ))}
                {syncErrors.length > 3 && (
                  <Text size="xs" c="dimmed">
                    ...and {syncErrors.length - 3} more
                  </Text>
                )}
              </Stack>
            </>
          )}

          {/* Last Sync */}
          <Text size="xs" c="dimmed">
            Last sync: {formatLastSync()}
          </Text>

          {/* Offline Mode Info */}
          {!isOnline && (
            <Text size="xs" c="dimmed">
              You can continue working offline. Changes will sync when connection is restored.
            </Text>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}