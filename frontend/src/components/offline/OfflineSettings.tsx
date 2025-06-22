'use client';

import { useState } from 'react';
import {
  Paper,
  Stack,
  Text,
  Switch,
  Slider,
  Button,
  Group,
  NumberInput,
  Select,
  Alert,
  Divider,
  Badge,
  Progress,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  IconWifi,
  IconDatabase,
  IconTrash,
  IconRefresh,
  IconDownload,
  IconInfoCircle,
  IconSettings
} from '@tabler/icons-react';
import { useOfflineStore } from '@/stores/offline';
import { formatBytes } from '@/utils';

interface OfflineSettingsProps {
  showHeader?: boolean;
  onClose?: () => void;
}

export function OfflineSettings({ 
  showHeader = true,
  onClose 
}: OfflineSettingsProps) {
  const {
    isOfflineEnabled,
    autoSync,
    syncInterval,
    cacheSize,
    maxCacheSize,
    retentionDays,
    syncOnCellular,
    backgroundSync,
    conflictResolution,
    selectedDataTypes,
    // Actions
    setOfflineEnabled,
    setAutoSync,
    setSyncInterval,
    setMaxCacheSize,
    setRetentionDays,
    setSyncOnCellular,
    setBackgroundSync,
    setConflictResolution,
    toggleDataType,
    clearCache,
    forceSync,
    downloadOfflineData
  } = useOfflineStore();

  const [isClearing, setIsClearing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const cacheUsagePercent = (cacheSize / maxCacheSize) * 100;

  const dataTypes = [
    { value: 'patients', label: 'Patient Records', size: '~2MB per patient' },
    { value: 'encounters', label: 'Encounters', size: '~500KB per encounter' },
    { value: 'medications', label: 'Medications', size: '~100KB per patient' },
    { value: 'labResults', label: 'Lab Results', size: '~200KB per result' },
    { value: 'vitalSigns', label: 'Vital Signs', size: '~50KB per set' },
    { value: 'clinicalNotes', label: 'Clinical Notes', size: '~300KB per note' },
    { value: 'appointments', label: 'Appointments', size: '~50KB per appointment' }
  ];

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await clearCache();
    } finally {
      setIsClearing(false);
    }
  };

  const handleDownloadData = async () => {
    setIsDownloading(true);
    try {
      await downloadOfflineData();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Paper p="lg" withBorder className="bg-white">
      <Stack gap="md">
        {showHeader && (
          <>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <IconSettings size={24} className="text-gray-700" />
                <Text fw={600} size="lg">Offline Settings</Text>
              </Group>
              {onClose && (
                <ActionIcon variant="subtle" onClick={onClose}>
                  <IconInfoCircle size={20} />
                </ActionIcon>
              )}
            </Group>
            <Divider />
          </>
        )}

        {/* Offline Mode Toggle */}
        <div>
          <Switch
            label={
              <Group gap="xs">
                <Text fw={500}>Enable Offline Mode</Text>
                <Tooltip label="Allows the app to work without internet connection">
                  <IconInfoCircle size={16} className="text-gray-500" />
                </Tooltip>
              </Group>
            }
            description="Store data locally for offline access"
            checked={isOfflineEnabled}
            onChange={(event) => setOfflineEnabled(event.currentTarget.checked)}
            size="md"
          />
        </div>

        {isOfflineEnabled && (
          <>
            {/* Auto Sync Settings */}
            <Stack gap="xs">
              <Switch
                label="Automatic Sync"
                description="Sync data automatically when online"
                checked={autoSync}
                onChange={(event) => setAutoSync(event.currentTarget.checked)}
              />
              
              {autoSync && (
                <NumberInput
                  label="Sync Interval"
                  description="How often to sync (in minutes)"
                  value={syncInterval}
                  onChange={(value) => setSyncInterval(Number(value) || 5)}
                  min={1}
                  max={60}
                  step={5}
                  rightSection={<Text size="xs" c="dimmed">min</Text>}
                />
              )}
            </Stack>

            {/* Data Types Selection */}
            <div>
              <Text size="sm" fw={500} mb="xs">Data to Store Offline</Text>
              <Stack gap="xs">
                {dataTypes.map((type) => (
                  <Paper key={type.value} p="xs" withBorder>
                    <Group justify="space-between">
                      <Switch
                        label={type.label}
                        checked={selectedDataTypes.includes(type.value)}
                        onChange={() => toggleDataType(type.value)}
                      />
                      <Text size="xs" c="dimmed">{type.size}</Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </div>

            {/* Cache Management */}
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Cache Storage</Text>
                <Badge color={cacheUsagePercent > 80 ? 'red' : 'blue'} variant="light">
                  {formatBytes(cacheSize)} / {formatBytes(maxCacheSize)}
                </Badge>
              </Group>
              <Progress 
                value={cacheUsagePercent} 
                color={cacheUsagePercent > 80 ? 'red' : cacheUsagePercent > 60 ? 'orange' : 'blue'}
                size="md"
                radius="xl"
                mb="sm"
              />
              <Group gap="xs">
                <Slider
                  label="Maximum Cache Size"
                  value={maxCacheSize / (1024 * 1024)} // Convert to MB
                  onChange={(value) => setMaxCacheSize(value * 1024 * 1024)}
                  min={50}
                  max={500}
                  step={50}
                  marks={[
                    { value: 50, label: '50MB' },
                    { value: 250, label: '250MB' },
                    { value: 500, label: '500MB' }
                  ]}
                  style={{ flex: 1 }}
                />
              </Group>
            </div>

            {/* Data Retention */}
            <NumberInput
              label="Data Retention Period"
              description="How long to keep offline data"
              value={retentionDays}
              onChange={(value) => setRetentionDays(Number(value) || 7)}
              min={1}
              max={30}
              rightSection={<Text size="xs" c="dimmed">days</Text>}
            />

            {/* Advanced Settings */}
            <Stack gap="xs">
              <Text size="sm" fw={500}>Advanced Settings</Text>
              
              <Switch
                label="Sync on Cellular Data"
                description="Allow syncing when using mobile data"
                checked={syncOnCellular}
                onChange={(event) => setSyncOnCellular(event.currentTarget.checked)}
              />
              
              <Switch
                label="Background Sync"
                description="Sync data in the background"
                checked={backgroundSync}
                onChange={(event) => setBackgroundSync(event.currentTarget.checked)}
              />
              
              <Select
                label="Conflict Resolution"
                description="How to handle sync conflicts"
                value={conflictResolution}
                onChange={(value) => setConflictResolution(value as any)}
                data={[
                  { value: 'ask', label: 'Ask Me' },
                  { value: 'local', label: 'Keep Local Changes' },
                  { value: 'remote', label: 'Accept Remote Changes' },
                  { value: 'newest', label: 'Keep Newest Version' }
                ]}
              />
            </Stack>

            <Divider />

            {/* Actions */}
            <Stack gap="sm">
              <Button
                leftSection={<IconDownload size={16} />}
                loading={isDownloading}
                onClick={handleDownloadData}
                variant="light"
              >
                Download All Offline Data
              </Button>
              
              <Group gap="xs">
                <Button
                  leftSection={<IconRefresh size={16} />}
                  onClick={forceSync}
                  variant="subtle"
                  style={{ flex: 1 }}
                >
                  Force Sync Now
                </Button>
                
                <Button
                  leftSection={<IconTrash size={16} />}
                  onClick={handleClearCache}
                  loading={isClearing}
                  color="red"
                  variant="subtle"
                  style={{ flex: 1 }}
                >
                  Clear Cache
                </Button>
              </Group>
            </Stack>

            {/* Storage Warning */}
            {cacheUsagePercent > 80 && (
              <Alert
                icon={<IconInfoCircle size={16} />}
                color="orange"
                variant="light"
              >
                Your offline storage is almost full. Consider clearing old data or increasing the cache size limit.
              </Alert>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export default OfflineSettings;