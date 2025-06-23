'use client';

import { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  Title,
  Tabs,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Alert,
  Progress,
  Skeleton
} from '@mantine/core';
import {
  IconUser,
  IconStethoscope,
  IconPill,
  IconFlask,
  IconDatabase,
  IconSync,
  IconAlertCircle
} from '@tabler/icons-react';
import { useParams } from 'next/navigation';
import { usePatientCache, useCacheStats, useSyncStatus } from '@/hooks/usePatientCache';
import { PatientHeader } from './PatientHeader';
import { CacheManager } from '@/components/cache/CacheManager';
import { SyncStatus } from '@/services/patient-sync.service';

export function PatientDashboard() {
  const params = useParams();
  const patientId = params?.id as string;
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  // Use patient cache hook
  const {
    patient,
    allergies,
    conditions,
    medications,
    vitals,
    labs,
    loading,
    refreshing,
    fromCache,
    lastUpdated,
    cacheStats,
    syncStatus,
    refresh,
    invalidate
  } = usePatientCache(patientId, {
    enableSync: true,
    prefetchRelated: true,
    autoRefresh: true,
    refreshInterval: 300000 // 5 minutes
  });

  // Use cache statistics
  const { stats, sizeInfo } = useCacheStats();

  // Use sync status
  const syncState = useSyncStatus();

  if (loading && !patient) {
    return (
      <Container size="xl">
        <Stack gap="md">
          <Skeleton height={200} />
          <Grid>
            <Grid.Col span={8}>
              <Skeleton height={400} />
            </Grid.Col>
            <Grid.Col span={4}>
              <Skeleton height={400} />
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    );
  }

  if (!patient) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle />} color="red">
          Patient not found
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="md">
        {/* Sync Status Bar */}
        {syncStatus !== SyncStatus.CONNECTED && (
          <Alert
            icon={<IconSync />}
            color={syncStatus === SyncStatus.ERROR ? 'red' : 'yellow'}
            variant="light"
          >
            <Group justify="space-between">
              <Text>
                {syncStatus === SyncStatus.ERROR
                  ? 'Sync error - changes may not be saved'
                  : 'Connecting to sync service...'}
              </Text>
              {syncState.errors.length > 0 && (
                <Button size="xs" variant="subtle" onClick={syncState.clearErrors}>
                  Clear Errors ({syncState.errors.length})
                </Button>
              )}
            </Group>
          </Alert>
        )}

        {/* Patient Header with Cache Status */}
        <Card>
          <Stack gap="md">
            <PatientHeader patient={patient} />
            
            {/* Cache & Sync Info */}
            <Group justify="space-between">
              <Group gap="xs">
                {fromCache && (
                  <Badge
                    leftSection={<IconDatabase size={12} />}
                    color="green"
                    variant="light"
                  >
                    Cached Data
                  </Badge>
                )}
                {lastUpdated && (
                  <Text size="xs" c="dimmed">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </Text>
                )}
              </Group>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => refresh()}
                  loading={refreshing}
                >
                  Refresh
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={invalidate}
                >
                  Clear Cache
                </Button>
              </Group>
            </Group>
          </Stack>
        </Card>

        <Grid>
          {/* Main Content */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card>
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
                    Overview
                  </Tabs.Tab>
                  <Tabs.Tab value="vitals" leftSection={<IconStethoscope size={16} />}>
                    Vitals ({vitals.length})
                  </Tabs.Tab>
                  <Tabs.Tab value="medications" leftSection={<IconPill size={16} />}>
                    Medications ({medications.length})
                  </Tabs.Tab>
                  <Tabs.Tab value="labs" leftSection={<IconFlask size={16} />}>
                    Labs ({labs.length})
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="overview" pt="md">
                  <Stack gap="md">
                    {/* Conditions */}
                    <div>
                      <Title order={5} mb="xs">Active Conditions</Title>
                      {conditions.length === 0 ? (
                        <Text c="dimmed">No active conditions</Text>
                      ) : (
                        <Stack gap="xs">
                          {conditions.map((condition, index) => (
                            <Badge key={index} variant="light">
                              {condition.code?.text || 'Unknown'}
                            </Badge>
                          ))}
                        </Stack>
                      )}
                    </div>

                    {/* Allergies */}
                    <div>
                      <Title order={5} mb="xs">Allergies</Title>
                      {allergies.length === 0 ? (
                        <Text c="dimmed">No known allergies</Text>
                      ) : (
                        <Stack gap="xs">
                          {allergies.map((allergy, index) => (
                            <Badge key={index} color="red" variant="light">
                              {allergy.code?.text || 'Unknown'}
                            </Badge>
                          ))}
                        </Stack>
                      )}
                    </div>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="vitals" pt="md">
                  {vitals.length === 0 ? (
                    <Text c="dimmed">No vital signs recorded</Text>
                  ) : (
                    <Stack gap="md">
                      {vitals.slice(0, 5).map((vital, index) => (
                        <Card key={index} withBorder>
                          <Group justify="space-between">
                            <Text fw={500}>
                              {vital.code?.text || 'Vital Sign'}
                            </Text>
                            <Badge>
                              {vital.valueQuantity?.value} {vital.valueQuantity?.unit}
                            </Badge>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="medications" pt="md">
                  {medications.length === 0 ? (
                    <Text c="dimmed">No active medications</Text>
                  ) : (
                    <Stack gap="md">
                      {medications.map((med, index) => (
                        <Card key={index} withBorder>
                          <Text fw={500}>
                            {med.medicationCodeableConcept?.text || 'Medication'}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {med.dosageInstruction?.[0]?.text || 'No dosage info'}
                          </Text>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="labs" pt="md">
                  {labs.length === 0 ? (
                    <Text c="dimmed">No lab results</Text>
                  ) : (
                    <Stack gap="md">
                      {labs.slice(0, 5).map((lab, index) => (
                        <Card key={index} withBorder>
                          <Group justify="space-between">
                            <Text fw={500}>
                              {lab.code?.text || 'Lab Result'}
                            </Text>
                            <Badge color={lab.interpretation?.[0]?.coding?.[0]?.code === 'H' ? 'red' : 'green'}>
                              {lab.valueQuantity?.value} {lab.valueQuantity?.unit}
                            </Badge>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Tabs.Panel>
              </Tabs>
            </Card>
          </Grid.Col>

          {/* Sidebar */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Cache Manager */}
              <CacheManager minimal />

              {/* Cache Performance */}
              <Card>
                <Title order={5} mb="md">Cache Performance</Title>
                <Stack gap="sm">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Hit Rate</Text>
                      <Text size="sm" fw={500}>
                        {(cacheStats.hitRate * 100).toFixed(0)}%
                      </Text>
                    </Group>
                    <Progress
                      value={cacheStats.hitRate * 100}
                      color={cacheStats.hitRate > 0.7 ? 'green' : 'orange'}
                    />
                  </div>
                  
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Cache Size</Text>
                      <Text size="sm" fw={500}>
                        {(cacheStats.totalSize / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    </Group>
                    <Progress
                      value={(cacheStats.totalSize / (100 * 1024 * 1024)) * 100}
                      color="blue"
                    />
                  </div>
                  
                  <Group justify="space-between">
                    <Text size="sm">Cached Patients</Text>
                    <Badge>{cacheStats.patientCount}</Badge>
                  </Group>
                </Stack>
              </Card>

              {/* Sync Status */}
              <Card>
                <Title order={5} mb="md">Sync Status</Title>
                <Stack gap="sm">
                  <Badge
                    fullWidth
                    size="lg"
                    color={
                      syncState.status === SyncStatus.CONNECTED
                        ? 'green'
                        : syncState.status === SyncStatus.SYNCING
                        ? 'blue'
                        : syncState.status === SyncStatus.ERROR
                        ? 'red'
                        : 'yellow'
                    }
                  >
                    {syncState.status}
                  </Badge>
                  
                  {syncState.lastSync && (
                    <Text size="sm" c="dimmed">
                      Last sync: {new Date(syncState.lastSync).toLocaleTimeString()}
                    </Text>
                  )}
                  
                  {syncState.pendingSync > 0 && (
                    <Badge color="orange" variant="light">
                      {syncState.pendingSync} pending
                    </Badge>
                  )}
                  
                  <Button
                    size="xs"
                    variant="light"
                    onClick={syncState.syncAll}
                    fullWidth
                  >
                    Force Sync All
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}