import React, { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Tooltip,
  Progress,
  Modal,
  Stack,
  Group,
  Text,
  Alert,
  Divider,
  SimpleGrid,
  List,
  Collapse,
  Menu,
  Container,
  Paper,
  Title,
  ThemeIcon,
  Box,
  Loader,
  Card
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSync,
  IconCloudOff,
  IconAlertTriangle,
  IconCloud,
  IconCloudUpload,
  IconCloudDownload,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconSettings,
  IconRefresh,
  IconDownload,
  IconUpload,
  IconTrash,
  IconAlertCircle,
  IconCircleCheck
} from '@tabler/icons-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { ConflictResolution } from '@/services/offline-sync.service';
import ConflictResolutionModal from './ConflictResolutionModal';

interface SyncStatusIndicatorProps {
  minimal?: boolean;
  showDetails?: boolean;
  position?: 'fixed' | 'relative';
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  minimal = false,
  showDetails = true,
  position = 'fixed'
}) => {
  const {
    status,
    isOnline,
    isSyncing,
    pendingChanges,
    failedChanges,
    conflicts,
    sync,
    clearLocalData,
    exportData,
    importData,
    syncProgress,
    lastSyncTime,
    canSync
  } = useOfflineSync({
    onSyncComplete: (duration) => {
      notifications.show({
        title: 'Sync completed',
        message: `Synchronized in ${(duration / 1000).toFixed(1)} seconds`,
        color: 'green',
        icon: <IconCheck />
      });
    },
    onSyncError: (error) => {
      notifications.show({
        title: 'Sync failed',
        message: error,
        color: 'red',
        icon: <IconX />
      });
    },
    onConflictDetected: (conflict) => {
      notifications.show({
        title: 'Sync conflict detected',
        message: `Conflict in ${conflict.resourceType}/${conflict.resourceId}`,
        color: 'orange',
        icon: <IconAlertTriangle />
      });
    }
  });

  const [opened, { open, close }] = useDisclosure(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Calculate sync status
  const getSyncIcon = () => {
    if (!isOnline) return IconCloudOff;
    if (isSyncing) return IconSync;
    if (failedChanges > 0 || conflicts.length > 0) return IconAlertTriangle;
    if (pendingChanges > 0) return IconCloudUpload;
    return IconCloud;
  };

  const getSyncColor = () => {
    if (!isOnline) return 'gray';
    if (isSyncing) return 'blue';
    if (failedChanges > 0 || conflicts.length > 0) return 'red';
    if (pendingChanges > 0) return 'orange';
    return 'green';
  };

  const getSyncTooltip = () => {
    if (!isOnline) return 'Offline - Changes will sync when connection restored';
    if (isSyncing) return 'Synchronizing...';
    if (failedChanges > 0) return `${failedChanges} failed changes`;
    if (conflicts.length > 0) return `${conflicts.length} conflicts need resolution`;
    if (pendingChanges > 0) return `${pendingChanges} pending changes`;
    return 'All changes synchronized';
  };

  // Handle manual sync
  const handleManualSync = async () => {
    try {
      await sync();
    } catch (error) {
      // Error already handled by hook
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omnicare-sync-data-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      notifications.show({
        title: 'Export successful',
        message: 'Sync data exported successfully',
        color: 'green',
        icon: <IconCheck />
      });
    } catch (error: any) {
      notifications.show({
        title: 'Export failed',
        message: error.message,
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importData(data);
        
        notifications.show({
          title: 'Import successful',
          message: 'Sync data imported successfully',
          color: 'green',
          icon: <IconCheck />
        });
      } catch (error: any) {
        notifications.show({
          title: 'Import failed',
          message: error.message,
          color: 'red',
          icon: <IconX />
        });
      } finally {
        setIsImporting(false);
      }
    };
    
    input.click();
  };

  // Handle clear data
  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all local sync data? This action cannot be undone.')) {
      return;
    }

    try {
      await clearLocalData();
      notifications.show({
        title: 'Data cleared',
        message: 'All local sync data has been cleared',
        color: 'green',
        icon: <IconCheck />
      });
    } catch (error: any) {
      notifications.show({
        title: 'Clear failed',
        message: error.message,
        color: 'red',
        icon: <IconX />
      });
    }
  };

  const SyncIcon = getSyncIcon();

  // Minimal view
  if (minimal) {
    return (
      <Tooltip label={getSyncTooltip()} position="bottom">
        <Box pos="relative" display="inline-block">
          <ActionIcon
            variant="subtle"
            color={getSyncColor()}
            size="md"
            onClick={open}
            className={isSyncing ? 'rotating' : ''}
          >
            <SyncIcon size={20} />
          </ActionIcon>
          {(pendingChanges > 0 || failedChanges > 0 || conflicts.length > 0) && (
            <Badge
              size="xs"
              color={failedChanges > 0 || conflicts.length > 0 ? 'red' : 'orange'}
              circle
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {pendingChanges + failedChanges + conflicts.length}
            </Badge>
          )}
        </Box>
      </Tooltip>
    );
  }

  return (
    <>
      {/* Status Indicator */}
      <Paper
        shadow="lg"
        p="md"
        radius="md"
        style={position === 'fixed' ? {
          position: 'fixed',
          bottom: 16,
          right: 16,
          minWidth: 200,
          zIndex: 1000
        } : undefined}
      >
        <Stack gap="sm">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon
                color={getSyncColor()}
                variant="light"
                size="md"
                className={isSyncing ? 'rotating' : ''}
              >
                <SyncIcon size={18} />
              </ThemeIcon>
              <Text fw={600} size="sm">
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </Group>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="sm">
                  <IconSettings size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleManualSync}
                  disabled={!canSync}
                >
                  Sync Now
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconInfoCircle size={16} />}
                  onClick={open}
                >
                  View Details
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  Export Data
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconUpload size={16} />}
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  Import Data
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={16} />}
                  onClick={handleClearData}
                  color="red"
                >
                  Clear Local Data
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {/* Sync Progress */}
          {isSyncing && syncProgress && (
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  Syncing... {syncProgress.percentage}%
                </Text>
                <Text size="xs" c="dimmed">
                  {syncProgress.completed}/{syncProgress.total}
                </Text>
              </Group>
              <Progress
                value={syncProgress.percentage}
                size="xs"
                color="blue"
                animated
              />
            </Box>
          )}

          {/* Status Summary */}
          {showDetails && (
            <Stack gap={4}>
              {pendingChanges > 0 && (
                <Group gap="xs">
                  <IconCloudUpload size={14} color="var(--mantine-color-orange-6)" />
                  <Text size="xs">{pendingChanges} pending changes</Text>
                </Group>
              )}
              {failedChanges > 0 && (
                <Group gap="xs">
                  <IconX size={14} color="var(--mantine-color-red-6)" />
                  <Text size="xs">{failedChanges} failed changes</Text>
                </Group>
              )}
              {conflicts.length > 0 && (
                <Group gap="xs">
                  <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />
                  <Text size="xs">{conflicts.length} conflicts</Text>
                </Group>
              )}
              {pendingChanges === 0 && failedChanges === 0 && conflicts.length === 0 && (
                <Group gap="xs">
                  <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
                  <Text size="xs">All synced</Text>
                </Group>
              )}
            </Stack>
          )}

          {/* Last Sync Time */}
          <Text size="xs" c="dimmed">
            Last sync: {lastSyncTime === 'Never' ? 'Never' : formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
          </Text>
        </Stack>
      </Paper>

      {/* Details Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title="Sync Status Details"
        size="xl"
      >
        <Stack gap="md">
          {/* Connection Status */}
          <Alert
            icon={isOnline ? <IconCheck /> : <IconAlertCircle />}
            color={isOnline ? 'green' : 'orange'}
          >
            <Text fw={600}>{isOnline ? 'Connected' : 'Offline'}</Text>
            <Text size="sm" c="dimmed">
              {isOnline 
                ? 'You are connected to the server'
                : 'Changes will be synchronized when connection is restored'
              }
            </Text>
          </Alert>

          {/* Statistics */}
          <SimpleGrid cols={3}>
            <Card padding="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pending</Text>
              <Text size="xl" fw={700} c="orange">{pendingChanges}</Text>
              <Text size="xs" c="dimmed">Changes to sync</Text>
            </Card>
            <Card padding="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Failed</Text>
              <Text size="xl" fw={700} c="red">{failedChanges}</Text>
              <Text size="xs" c="dimmed">Need retry</Text>
            </Card>
            <Card padding="sm">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Conflicts</Text>
              <Text size="xl" fw={700} c="red">{conflicts.length}</Text>
              <Text size="xs" c="dimmed">Need resolution</Text>
            </Card>
          </SimpleGrid>

          <Divider />

          {/* Sync Errors */}
          {status.errors.length > 0 && (
            <Box>
              <Text fw={600} mb="sm">Recent Errors</Text>
              <Stack gap="xs">
                {status.errors.slice(-5).map((error, index) => (
                  <Group key={index} gap="sm" align="flex-start">
                    <ThemeIcon color="red" variant="light" size="sm">
                      <IconX size={14} />
                    </ThemeIcon>
                    <Box style={{ flex: 1 }}>
                      <Text size="sm">{error.error}</Text>
                      <Text size="xs" c="dimmed">
                        {error.resourceType}/{error.resourceId} - {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                      </Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <Box>
              <Group justify="space-between" mb="sm">
                <Text fw={600}>Conflicts</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setShowConflicts(!showConflicts)}
                >
                  {showConflicts ? 'Hide' : 'Show'}
                </Button>
              </Group>
              <Collapse in={showConflicts}>
                <Stack gap="xs">
                  {conflicts.map((conflict) => (
                    <Group key={conflict.id} justify="space-between">
                      <Box style={{ flex: 1 }}>
                        <Text size="sm">
                          {conflict.resourceType}/{conflict.resourceId}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Detected {formatDistanceToNow(new Date(conflict.detectedAt), { addSuffix: true })}
                        </Text>
                      </Box>
                      <Button
                        size="xs"
                        onClick={() => setSelectedConflict(conflict.id)}
                      >
                        Resolve
                      </Button>
                    </Group>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          )}
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={close}>
            Close
          </Button>
          <Button
            onClick={handleManualSync}
            loading={isSyncing}
            disabled={!canSync}
            leftSection={<IconSync size={16} />}
          >
            Sync Now
          </Button>
        </Group>
      </Modal>

      {/* Conflict Resolution Modal */}
      {selectedConflict && (
        <ConflictResolutionModal
          conflict={conflicts.find(c => c.id === selectedConflict)!}
          isOpen={!!selectedConflict}
          onClose={() => setSelectedConflict(null)}
          onResolve={async (resolution: ConflictResolution) => {
            // Resolution handled by the modal
            setSelectedConflict(null);
          }}
        />
      )}

      <style jsx>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </>
  );
};

export default SyncStatusIndicator;