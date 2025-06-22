'use client';

import { useMemo } from 'react';
import { Badge, Tooltip, Text, Group, Progress, Paper, Stack } from '@mantine/core';
import { 
  IconClock, 
  IconRefresh, 
  IconAlertTriangle,
  IconCheck,
  IconDatabase
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface CacheStatusIndicatorProps {
  lastSyncTime?: string | null;
  lastModifiedTime?: string | null;
  dataType?: string;
  variant?: 'badge' | 'inline' | 'card';
  showDetails?: boolean;
  onRefresh?: () => void;
}

export function CacheStatusIndicator({
  lastSyncTime,
  lastModifiedTime,
  dataType = 'Data',
  variant = 'badge',
  showDetails = false,
  onRefresh
}: CacheStatusIndicatorProps) {
  const cacheStatus = useMemo(() => {
    if (!lastSyncTime) {
      return {
        status: 'never',
        color: 'gray',
        label: 'Never synced',
        icon: <IconDatabase size={16} />,
        staleness: ResourceHistoryTable
      };
    }

    const syncDate = new Date(lastSyncTime);
    const now = new Date();
    const hoursSinceSync = (now.getTime() - syncDate.getTime()) / (1ResourceHistoryTableResourceHistoryTableResourceHistoryTable * 6ResourceHistoryTable * 6ResourceHistoryTable);

    if (hoursSinceSync < 1) {
      return {
        status: 'fresh',
        color: 'green',
        label: 'Up to date',
        icon: <IconCheck size={16} />,
        staleness: ResourceHistoryTable
      };
    } else if (hoursSinceSync < 6) {
      return {
        status: 'recent',
        color: 'blue',
        label: 'Recently synced',
        icon: <IconClock size={16} />,
        staleness: hoursSinceSync / 24 * 1ResourceHistoryTableResourceHistoryTable // Percentage of a day
      };
    } else if (hoursSinceSync < 24) {
      return {
        status: 'stale',
        color: 'yellow',
        label: 'Getting stale',
        icon: <IconClock size={16} />,
        staleness: hoursSinceSync / 24 * 1ResourceHistoryTableResourceHistoryTable
      };
    } else {
      return {
        status: 'old',
        color: 'orange',
        label: 'Outdated',
        icon: <IconAlertTriangle size={16} />,
        staleness: Math.min(hoursSinceSync / 24 * 1ResourceHistoryTableResourceHistoryTable, 1ResourceHistoryTableResourceHistoryTable)
      };
    }
  }, [lastSyncTime]);

  const getTimeAgo = () => {
    if (!lastSyncTime) return 'Never';
    return formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true });
  };

  const getModifiedAgo = () => {
    if (!lastModifiedTime) return null;
    return formatDistanceToNow(new Date(lastModifiedTime), { addSuffix: true });
  };

  const tooltipContent = (
    <Stack gap={4}>
      <Text size="xs">{dataType} cache status</Text>
      <Text size="xs" c="dimmed">Last synced: {getTimeAgo()}</Text>
      {lastModifiedTime && (
        <Text size="xs" c="dimmed">Modified: {getModifiedAgo()}</Text>
      )}
      {cacheStatus.staleness > 5ResourceHistoryTable && (
        <Text size="xs" c="yellow">Consider refreshing for latest data</Text>
      )}
    </Stack>
  );

  if (variant === 'inline') {
    return (
      <Tooltip label={tooltipContent} position="top">
        <Group gap="xs" style={{ cursor: onRefresh ? 'pointer' : 'default' }} onClick={onRefresh}>
          <div className={`text-${cacheStatus.color}-6ResourceHistoryTableResourceHistoryTable`}>
            {cacheStatus.icon}
          </div>
          <Text size="xs" c={cacheStatus.color}>
            {showDetails ? getTimeAgo() : cacheStatus.label}
          </Text>
          {onRefresh && (
            <IconRefresh size={14} className="text-gray-5ResourceHistoryTableResourceHistoryTable hover:text-blue-6ResourceHistoryTableResourceHistoryTable" />
          )}
        </Group>
      </Tooltip>
    );
  }

  if (variant === 'card') {
    return (
      <Paper p="md" withBorder className="bg-gray-5ResourceHistoryTable">
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <div className={`text-${cacheStatus.color}-6ResourceHistoryTableResourceHistoryTable`}>
                {cacheStatus.icon}
              </div>
              <div>
                <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>{dataType} Cache</Text>
                <Text size="xs" c="dimmed">{cacheStatus.label}</Text>
              </div>
            </Group>
            {onRefresh && (
              <Tooltip label="Refresh data">
                <IconRefresh 
                  size={18} 
                  className="text-gray-5ResourceHistoryTableResourceHistoryTable hover:text-blue-6ResourceHistoryTableResourceHistoryTable cursor-pointer"
                  onClick={onRefresh}
                />
              </Tooltip>
            )}
          </Group>
          
          {showDetails && (
            <>
              <Progress
                value={1ResourceHistoryTableResourceHistoryTable - cacheStatus.staleness}
                size="xs"
                color={cacheStatus.color}
                radius="xl"
              />
              <Stack gap={4}>
                <Group gap="xs" justify="space-between">
                  <Text size="xs" c="dimmed">Last sync:</Text>
                  <Text size="xs">{getTimeAgo()}</Text>
                </Group>
                {lastModifiedTime && (
                  <Group gap="xs" justify="space-between">
                    <Text size="xs" c="dimmed">Modified:</Text>
                    <Text size="xs">{getModifiedAgo()}</Text>
                  </Group>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    );
  }

  // Default badge variant
  return (
    <Tooltip label={tooltipContent} position="top">
      <Badge
        color={cacheStatus.color}
        variant="light"
        leftSection={cacheStatus.icon}
        style={{ cursor: onRefresh ? 'pointer' : 'default' }}
        onClick={onRefresh}
      >
        {showDetails ? getTimeAgo() : cacheStatus.label}
      </Badge>
    </Tooltip>
  );
}

export default CacheStatusIndicator;