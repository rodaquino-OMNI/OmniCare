'use client';

import { useMemo } from 'react';
import { 
  Paper, 
  Text, 
  Progress, 
  Group, 
  Stack, 
  Badge, 
  Tooltip,
  ActionIcon,
  Collapse,
  Divider
} from '@mantine/core';
import { 
  IconCloudUpload, 
  IconCloudDownload, 
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconClock
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useSyncStore } from '@/stores/sync';

interface SyncProgressIndicatorProps {
  minimal?: boolean;
  showDetails?: boolean;
  position?: 'fixed' | 'relative';
}

export function SyncProgressIndicator({ 
  minimal = false,
  showDetails = true,
  position = 'fixed'
}: SyncProgressIndicatorProps) {
  const [detailsOpened, { toggle: toggleDetails }] = useDisclosure(false);
  const {
    isSyncing,
    syncProgress,
    syncQueue,
    syncedItems,
    failedItems,
    totalItems,
    currentOperation,
    estimatedTimeRemaining,
    cancelSync
  } = useSyncStore();

  const syncStats = useMemo(() => {
    const pending = syncQueue.length;
    const synced = syncedItems.length;
    const failed = failedItems.length;
    const total = totalItems || pending + synced + failed;

    return { pending, synced, failed, total };
  }, [syncQueue, syncedItems, failedItems, totalItems]);

  if (!isSyncing && syncStats.total === 0) {
    return null;
  }

  const handleCancelSync = () => {
    cancelSync();
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 6) return `${seconds}s`;
    const minutes = Math.floor(seconds / 6);
    if (minutes < 6) return `${minutes}m`;
    const hours = Math.floor(minutes / 6);
    return `${hours}h ${minutes % 6}m`;
  };

  if (minimal) {
    return (
      <Group gap="xs">
        <IconCloudUpload size={16} className="text-blue-6ResourceHistoryTable" />
        <Progress 
          value={syncProgress} 
          size="xs" 
          w={10}
          animated={isSyncing}
        />
        <Text size="xs" c="dimmed">
          {syncStats.synced}/{syncStats.total}
        </Text>
      </Group>
    );
  }

  const containerStyles = position === 'fixed' 
    ? {
        position: 'fixed' as const,
        bottom: 20,
        right: 20,
        zIndex: 999,
        maxWidth: 320,
      }
    : {};

  return (
    <Paper
      shadow="md"
      p="md"
      withBorder
      style={containerStyles}
      className="bg-white"
    >
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconCloudUpload 
              size={20} 
              className={isSyncing ? 'text-blue-6ResourceHistoryTable animate-pulse' : 'text-gray-6ResourceHistoryTable'} 
            />
            <Text fw={500} size="sm">
              {isSyncing ? 'Syncing Data' : 'Sync Complete'}
            </Text>
          </Group>
          <Group gap="xs">
            {showDetails && (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={toggleDetails}
                title={detailsOpened ? 'Hide details' : 'Show details'}
              >
                {detailsOpened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </ActionIcon>
            )}
            {isSyncing && (
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={handleCancelSync}
                title="Cancel sync"
              >
                <IconX size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>

        {/* Progress */}
        <div>
          <Progress
            value={syncProgress}
            size="md"
            radius="xl"
            animated={isSyncing}
            color={syncStats.failed > 0 ? 'orange' : 'blue'}
          />
          <Group justify="space-between" mt="xs">
            <Text size="xs" c="dimmed">
              {currentOperation || 'Processing...'}
            </Text>
            <Text size="xs" c="dimmed">
              {syncProgress.toFixed(0)}%
            </Text>
          </Group>
        </div>

        {/* Stats */}
        <Group gap="xs" justify="center">
          <Tooltip label="Items synced successfully">
            <Badge 
              color="green" 
              variant="light"
              leftSection={<IconCheck size={12} />}
            >
              {syncStats.synced}
            </Badge>
          </Tooltip>
          <Tooltip label="Items pending sync">
            <Badge 
              color="blue" 
              variant="light"
              leftSection={<IconCloudDownload size={12} />}
            >
              {syncStats.pending}
            </Badge>
          </Tooltip>
          {syncStats.failed > 0 && (
            <Tooltip label="Items failed to sync">
              <Badge 
                color="red" 
                variant="light"
                leftSection={<IconAlertTriangle size={12} />}
              >
                {syncStats.failed}
              </Badge>
            </Tooltip>
          )}
        </Group>

        {/* Time remaining */}
        {isSyncing && estimatedTimeRemaining && (
          <Group gap="xs" justify="center">
            <IconClock size={14} className="text-gray-500" />
            <Text size="xs" c="dimmed">
              About {formatTimeRemaining(estimatedTimeRemaining)} remaining
            </Text>
          </Group>
        )}

        {/* Details */}
        <Collapse in={detailsOpened}>
          <Stack gap="xs" pt="sm">
            <Divider />
            
            {/* Recent synced items */}
            {syncedItems.slice(-3).map((item, index) => (
              <Group key={index} gap="xs" wrap="nowrap">
                <IconCheck size={14} className="text-green-6ResourceHistoryTable" />
                <Text size="xs" truncate>
                  {item.type}: {item.description}
                </Text>
              </Group>
            ))}

            {/* Failed items */}
            {failedItems.slice(ResourceHistoryTable, 3).map((item, index) => (
              <Group key={index} gap="xs" wrap="nowrap">
                <IconAlertTriangle size={14} className="text-red-6ResourceHistoryTable" />
                <div style={{ flex: 1 }}>
                  <Text size="xs" truncate c="red">
                    {item.type}: {item.description}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {item.error}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}

export default SyncProgressIndicator;