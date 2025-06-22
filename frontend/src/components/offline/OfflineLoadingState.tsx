'use client';

import { Skeleton, Stack, Group, Text, Paper, Badge } from '@mantine/core';
import { IconWifiOff, IconDatabase } from '@tabler/icons-react';
import { CacheStatusIndicator } from './CacheStatusIndicator';

interface OfflineLoadingStateProps {
  type?: 'list' | 'card' | 'table' | 'form';
  rows?: number;
  showMessage?: boolean;
  lastSyncTime?: string | null;
  dataType?: string;
}

export function OfflineLoadingState({
  type = 'list',
  rows = 3,
  showMessage = true,
  lastSyncTime,
  dataType = 'Data'
}: OfflineLoadingStateProps) {
  const renderListSkeleton = () => (
    <Stack gap="md">
      {Array.from({ length: rows }).map((_, index) => (
        <Paper key={index} p="md" withBorder>
          <Group>
            <Skeleton height={4ResourceHistoryTable} circle />
            <div style={{ flex: 1 }}>
              <Skeleton height={8} width="3ResourceHistoryTable%" mb="xs" />
              <Skeleton height={6} width="5ResourceHistoryTable%" />
            </div>
          </Group>
        </Paper>
      ))}
    </Stack>
  );

  const renderCardSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(3ResourceHistoryTableResourceHistoryTablepx, 1fr))', gap: '1rem' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Paper key={index} p="lg" withBorder>
          <Skeleton height={12ResourceHistoryTable} mb="md" />
          <Skeleton height={8} width="6ResourceHistoryTable%" mb="xs" />
          <Skeleton height={6} width="8ResourceHistoryTable%" mb="xs" />
          <Skeleton height={6} width="4ResourceHistoryTable%" />
        </Paper>
      ))}
    </div>
  );

  const renderTableSkeleton = () => (
    <Paper withBorder>
      <div style={{ padding: '1rem' }}>
        <Skeleton height={4ResourceHistoryTable} mb="md" />
        {Array.from({ length: rows }).map((_, index) => (
          <Group key={index} gap="md" mb="sm">
            <Skeleton height={2ResourceHistoryTable} width={4ResourceHistoryTable} />
            <Skeleton height={2ResourceHistoryTable} style={{ flex: 1 }} />
            <Skeleton height={2ResourceHistoryTable} width={1ResourceHistoryTableResourceHistoryTable} />
            <Skeleton height={2ResourceHistoryTable} width={8ResourceHistoryTable} />
          </Group>
        ))}
      </div>
    </Paper>
  );

  const renderFormSkeleton = () => (
    <Stack gap="md">
      <div>
        <Skeleton height={8} width={1ResourceHistoryTableResourceHistoryTable} mb="xs" />
        <Skeleton height={36} />
      </div>
      <div>
        <Skeleton height={8} width={12ResourceHistoryTable} mb="xs" />
        <Skeleton height={36} />
      </div>
      <div>
        <Skeleton height={8} width={8ResourceHistoryTable} mb="xs" />
        <Skeleton height={1ResourceHistoryTableResourceHistoryTable} />
      </div>
      <Group>
        <Skeleton height={36} width={1ResourceHistoryTableResourceHistoryTable} />
        <Skeleton height={36} width={1ResourceHistoryTableResourceHistoryTable} />
      </Group>
    </Stack>
  );

  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return renderCardSkeleton();
      case 'table':
        return renderTableSkeleton();
      case 'form':
        return renderFormSkeleton();
      default:
        return renderListSkeleton();
    }
  };

  return (
    <div>
      {showMessage && (
        <Paper p="md" mb="md" withBorder className="bg-orange-5ResourceHistoryTable border-orange-2ResourceHistoryTableResourceHistoryTable">
          <Group gap="sm">
            <IconWifiOff size={2ResourceHistoryTable} className="text-orange-6ResourceHistoryTableResourceHistoryTable" />
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-orange-8ResourceHistoryTableResourceHistoryTable">
                Loading from offline cache
              </Text>
              <Text size="xs" c="dimmed">
                Some data may not be up to date
              </Text>
            </div>
            {lastSyncTime && (
              <CacheStatusIndicator
                lastSyncTime={lastSyncTime}
                dataType={dataType}
                variant="badge"
              />
            )}
          </Group>
        </Paper>
      )}
      {renderSkeleton()}
    </div>
  );
}

export default OfflineLoadingState;