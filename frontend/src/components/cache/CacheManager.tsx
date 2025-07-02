'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Group,
  Stack,
  Progress,
  Button,
  Badge,
  Paper,
  Grid,
  RingProgress,
  ActionIcon,
  Tooltip,
  Alert,
  Modal,
  TextInput,
  NumberInput,
  Switch,
  Divider,
  ScrollArea,
  Table
} from '@mantine/core';
import {
  IconDatabase,
  IconRefresh,
  IconTrash,
  IconSettings,
  IconAlertCircle,
  IconChartBar,
  IconClock,
  IconUsers,
  IconDownload,
  IconUpload,
  IconSearch
} from '@tabler/icons-react';
import { patientCacheService } from '@/services/patient-cache.service';

interface CacheManagerProps {
  minimal?: boolean;
}

export function CacheManager({ minimal = false }: CacheManagerProps) {
  const [stats, setStats] = useState(patientCacheService.getStats());
  const [sizeInfo, setSizeInfo] = useState(patientCacheService.getCacheSizeInfo());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [patientIds, setPatientIds] = useState('');
  const [cacheEntries, setCacheEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(patientCacheService.getStats());
      setSizeInfo(patientCacheService.getCacheSizeInfo());
    }, 5000);

    // Listen for cache events
    const handleCacheEvent = () => {
      setStats(patientCacheService.getStats());
      setSizeInfo(patientCacheService.getCacheSizeInfo());
    };

    patientCacheService.on('cache:cleared', handleCacheEvent);
    patientCacheService.on('cache:cleanup', handleCacheEvent);
    patientCacheService.on('cache:patient-added', handleCacheEvent);
    patientCacheService.on('cache:patient-removed', handleCacheEvent);

    return () => {
      clearInterval(interval);
      patientCacheService.off('cache:cleared', handleCacheEvent);
      patientCacheService.off('cache:cleanup', handleCacheEvent);
      patientCacheService.off('cache:patient-added', handleCacheEvent);
      patientCacheService.off('cache:patient-removed', handleCacheEvent);
    };
  }, []);

  const handleRefreshCache = async () => {
    setRefreshing(true);
    try {
      // Trigger refresh of stale data
      await new Promise(resolve => setTimeout(resolve, 1000));
      patientCacheService.emit('cache:refresh-requested');
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      patientCacheService.clearAll();
    } finally {
      setClearing(false);
    }
  };

  const handleWarmupCache = async () => {
    const ids = patientIds.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      await patientCacheService.warmupCache(ids);
      setWarmupOpen(false);
      setPatientIds('');
    }
  };

  const handleExportCache = () => {
    const state = patientCacheService.exportCacheState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cache-state-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadCacheEntries = async () => {
    const state = await patientCacheService.exportCacheState();
    setCacheEntries(state.patients || []);
  };

  const filteredEntries = cacheEntries.filter(entry =>
    entry.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (minimal) {
    return (
      <Paper p="sm" withBorder>
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconDatabase size={16} />
            <Text size="sm" fw={500}>Cache</Text>
          </Group>
          <Group gap="xs">
            <Badge size="sm" variant="light" color={stats.hitRate > 0.7 ? 'green' : 'orange'}>
              {(stats.hitRate * 100).toFixed(0)}% Hit
            </Badge>
            <Badge size="sm" variant="light">
              {sizeInfo.patientCount} patients
            </Badge>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={handleRefreshCache}
              loading={refreshing}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Group>
        </Group>
      </Paper>
    );
  }

  return (
    <>
      <Card>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Cache Management</Title>
            <Group gap="xs">
              <Button
                leftSection={<IconDownload size={16} />}
                variant="subtle"
                size="sm"
                onClick={handleExportCache}
              >
                Export
              </Button>
              <Button
                leftSection={<IconUpload size={16} />}
                variant="subtle"
                size="sm"
                onClick={() => setWarmupOpen(true)}
              >
                Warmup
              </Button>
              <Button
                leftSection={<IconSettings size={16} />}
                variant="subtle"
                size="sm"
                onClick={() => {
                  loadCacheEntries();
                  setSettingsOpen(true);
                }}
              >
                Details
              </Button>
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Paper p="md" withBorder>
                <Stack gap="xs" align="center">
                  <RingProgress
                    size={100}
                    thickness={8}
                    sections={[
                      { value: stats.hitRate * 100, color: 'green' },
                      { value: (1 - stats.hitRate) * 100, color: 'red' }
                    ]}
                    label={
                      <Text size="xl" fw={700} ta="center">
                        {(stats.hitRate * 100).toFixed(0)}%
                      </Text>
                    }
                  />
                  <Text size="sm" c="dimmed">Cache Hit Rate</Text>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <IconUsers size={24} color="var(--mantine-color-blue-6)" />
                    <Text size="xl" fw={700}>{sizeInfo.patientCount}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">Cached Patients</Text>
                  <Progress
                    value={sizeInfo.utilizationPercentage}
                    size="sm"
                    color={sizeInfo.utilizationPercentage > 80 ? 'orange' : 'blue'}
                  />
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <IconDatabase size={24} color="var(--mantine-color-green-6)" />
                    <Text size="xl" fw={700}>
                      {formatBytes(sizeInfo.totalSize)}
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed">Cache Size</Text>
                  <Progress
                    value={sizeInfo.utilizationPercentage}
                    size="sm"
                    color={sizeInfo.utilizationPercentage > 80 ? 'orange' : 'green'}
                  />
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <IconClock size={24} color="var(--mantine-color-orange-6)" />
                    <Text size="xl" fw={700}>{stats.hits + stats.misses}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">Total Requests</Text>
                  <Text size="xs" c="dimmed">
                    Last: {stats.lastCleanup.toLocaleTimeString()}
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Divider />

          <Group justify="space-between">
            <Stack gap={4}>
              <Text size="sm" fw={500}>Cache Statistics</Text>
              <Group gap="xs">
                <Badge size="sm" variant="light">
                  {stats.evictions} Evictions
                </Badge>
                <Badge size="sm" variant="light" color="blue">
                  {stats.hits} Cache Hits
                </Badge>
              </Group>
            </Stack>

            <Group gap="xs">
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                size="sm"
                onClick={handleRefreshCache}
                loading={refreshing}
              >
                Refresh Stale
              </Button>
              <Button
                leftSection={<IconTrash size={16} />}
                variant="light"
                color="red"
                size="sm"
                onClick={handleClearCache}
                loading={clearing}
              >
                Clear Cache
              </Button>
            </Group>
          </Group>

          {sizeInfo.utilizationPercentage > 80 && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="orange"
              variant="light"
            >
              Cache is {sizeInfo.utilizationPercentage.toFixed(0)}% full. 
              Consider clearing old entries to improve performance.
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Settings Modal */}
      <Modal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Cache Details"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            placeholder="Search by patient ID..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />

          <ScrollArea h={400}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Patient ID</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Access Count</Table.Th>
                  <Table.Th>Last Accessed</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredEntries.map(entry => (
                  <Table.Tr key={entry.id}>
                    <Table.Td>{entry.id}</Table.Td>
                    <Table.Td>{formatBytes(entry.size)}</Table.Td>
                    <Table.Td>{entry.accessCount}</Table.Td>
                    <Table.Td>
                      {new Date(entry.lastAccessed).toLocaleTimeString()}
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        onClick={() => patientCacheService.invalidatePatient(entry.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* Warmup Modal */}
      <Modal
        opened={warmupOpen}
        onClose={() => setWarmupOpen(false)}
        title="Cache Warmup"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Preload patient data into cache for faster access. 
            Enter comma-separated patient IDs.
          </Text>
          <TextInput
            label="Patient IDs"
            placeholder="patient1, patient2, patient3..."
            value={patientIds}
            onChange={(e) => setPatientIds(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setWarmupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWarmupCache}>
              Start Warmup
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// Helper function for formatting bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

