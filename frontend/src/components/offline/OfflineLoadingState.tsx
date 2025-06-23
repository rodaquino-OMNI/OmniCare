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
            <Skeleton height={40} circle />
            <div style={{ flex: 1 }}>
              <Skeleton height={8} width="30%" mb="xs" />
              <Skeleton height={6} width="50%" />
            </div>
          </Group>
        </Paper>
      ))}
    </Stack>
  );

  const renderCardSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Paper key={index} p="lg" withBorder>
          <Skeleton height={120} mb="md" />
          <Skeleton height={8} width="60%" mb="xs" />
          <Skeleton height={6} width="80%" mb="xs" />
          <Skeleton height={6} width="40%" />
        </Paper>
      ))}
    </div>
  );

  const renderTableSkeleton = () => (
    <Paper withBorder>
      <div style={{ padding: '1rem' }}>
        <Skeleton height={40} mb="md" />
        {Array.from({ length: rows }).map((_, index) => (
          <Group key={index} gap="md" mb="sm">
            <Skeleton height={20} width={40} />
            <Skeleton height={20} style={{ flex: 1 }} />
            <Skeleton height={20} width={100} />
            <Skeleton height={20} width={80} />
          </Group>
        ))}
      </div>
    </Paper>
  );

  const renderFormSkeleton = () => (
    <Stack gap="md">
      <div>
        <Skeleton height={8} width={100} mb="xs" />
        <Skeleton height={36} />
      </div>
      <div>
        <Skeleton height={8} width={120} mb="xs" />
        <Skeleton height={36} />
      </div>
      <div>
        <Skeleton height={8} width={80} mb="xs" />
        <Skeleton height={100} />
      </div>
      <Group>
        <Skeleton height={36} width={100} />
        <Skeleton height={36} width={100} />
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
        <Paper p="md" mb="md" withBorder className="bg-orange-50 border-orange-200">
          <Group gap="sm">
            <IconWifiOff size={20} className="text-orange-600" />
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={500} className="text-orange-800">
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