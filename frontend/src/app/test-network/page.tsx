'use client';

import React, { useState } from 'react';
import { Container, Title, Card, Stack, Button, Text, Group, Badge, Table } from '@mantine/core';
import { IconWifi, IconWifiOff, IconRefresh, IconDatabase } from '@tabler/icons-react';
import { useNetworkStatusContext } from '@/contexts/NetworkStatusContext';
import { NetworkStatusIndicator } from '@/components/network/NetworkStatusIndicator';
import { NetworkAwareImage } from '@/components/network/NetworkAwareImage';
import { useNetworkAwareFHIRResource, useNetworkAwareFHIRSearch, initializeFHIRBackgroundSync } from '@/hooks/useNetworkAwareFHIR';
import { getSyncStats, syncNow } from '@/services/background-sync.service';

// Initialize background sync on mount
if (typeof window !== 'undefined') {
  initializeFHIRBackgroundSync();
}

export default function TestNetworkPage() {
  const networkStatus = useNetworkStatusContext();
  const [syncStats, setSyncStats] = useState(getSyncStats());

  // Example: Network-aware FHIR resource fetch
  const { data: patient, loading, error, refetch } = useNetworkAwareFHIRResource(
    'Patient',
    'example-patient-123',
    {
      enableAutoRetry: true,
      cacheStrategy: 'cache-first',
    }
  );

  const refreshSyncStats = () => {
    setSyncStats(getSyncStats());
  };

  const handleManualSync = async () => {
    await syncNow();
    refreshSyncStats();
  };

  const qualityBadgeColor = {
    poor: 'red',
    fair: 'orange',
    good: 'blue',
    excellent: 'green',
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Title order={1}>Network Monitoring Test Page</Title>

        {/* Network Status Card */}
        <Card shadow="sm" p="lg">
          <Title order={3} mb="md">Network Status</Title>
          
          <Group justify="space-between" mb="md">
            <Group>
              {networkStatus.isOnline ? (
                <IconWifi size={24} color="green" />
              ) : (
                <IconWifiOff size={24} color="red" />
              )}
              <Text fw={500}>
                {networkStatus.isOnline ? 'Online' : 'Offline'}
              </Text>
            </Group>
            
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              size="sm"
              onClick={() => networkStatus.refresh()}
            >
              Refresh Status
            </Button>
          </Group>

          <Table>
            <tbody>
              <tr>
                <td>Connection Quality</td>
                <td>
                  <Badge color={qualityBadgeColor[networkStatus.connectionQuality as keyof typeof qualityBadgeColor] || 'gray'}>
                    {networkStatus.connectionQuality.toUpperCase()}
                  </Badge>
                </td>
              </tr>
              <tr>
                <td>Connection Type</td>
                <td>{networkStatus.connectionType || 'Unknown'}</td>
              </tr>
              <tr>
                <td>Effective Type</td>
                <td>{networkStatus.effectiveType.toUpperCase()}</td>
              </tr>
              <tr>
                <td>Latency</td>
                <td>{networkStatus.quality.latency}ms</td>
              </tr>
              <tr>
                <td>Bandwidth</td>
                <td>{networkStatus.quality.bandwidth} Mbps</td>
              </tr>
              <tr>
                <td>Jitter</td>
                <td>{networkStatus.quality.jitter}ms</td>
              </tr>
              <tr>
                <td>Packet Loss</td>
                <td>{networkStatus.quality.packetLoss}%</td>
              </tr>
              <tr>
                <td>Save Data Mode</td>
                <td>{networkStatus.saveData ? 'Enabled' : 'Disabled'}</td>
              </tr>
              <tr>
                <td>Network Aware Mode</td>
                <td>{networkStatus.networkAwareMode}</td>
              </tr>
            </tbody>
          </Table>
        </Card>

        {/* Retry Queue Status */}
        <Card shadow="sm" p="lg">
          <Title order={3} mb="md">Retry Queue</Title>
          
          <Group justify="space-between" mb="md">
            <Text>
              Pending Retries: <strong>{networkStatus.retryQueue.length}</strong>
            </Text>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="filled"
              size="sm"
              onClick={() => networkStatus.processRetryQueue()}
              disabled={networkStatus.isProcessingRetries || !networkStatus.isOnline}
              loading={networkStatus.isProcessingRetries}
            >
              Process Queue
            </Button>
          </Group>

          {networkStatus.retryQueue.length > 0 && (
            <Stack gap="xs">
              {networkStatus.retryQueue.slice(0, 5).map((item) => (
                <Card key={item.id} p="xs" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>{item.description}</Text>
                      <Text size="xs" c="dimmed">
                        Retry {item.retryCount}/{item.maxRetries} • Priority: {item.priority}
                      </Text>
                    </div>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() => networkStatus.removeFromRetryQueue(item.id)}
                    >
                      Remove
                    </Button>
                  </Group>
                </Card>
              ))}
              {networkStatus.retryQueue.length > 5 && (
                <Text size="sm" c="dimmed" ta="center">
                  And {networkStatus.retryQueue.length - 5} more...
                </Text>
              )}
            </Stack>
          )}
        </Card>

        {/* Background Sync Status */}
        <Card shadow="sm" p="lg">
          <Title order={3} mb="md">Background Sync</Title>
          
          <Group justify="space-between" mb="md">
            <IconDatabase size={24} />
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              size="sm"
              onClick={handleManualSync}
            >
              Sync Now
            </Button>
          </Group>

          <Table>
            <tbody>
              <tr>
                <td>Pending Tasks</td>
                <td>{syncStats.pendingTasks}</td>
              </tr>
              <tr>
                <td>Completed Tasks</td>
                <td>{syncStats.completedTasks}</td>
              </tr>
              <tr>
                <td>Failed Tasks</td>
                <td>{syncStats.failedTasks}</td>
              </tr>
              <tr>
                <td>Last Sync</td>
                <td>
                  {syncStats.lastSyncTime
                    ? new Date(syncStats.lastSyncTime).toLocaleString()
                    : 'Never'}
                </td>
              </tr>
              <tr>
                <td>Next Sync</td>
                <td>
                  {syncStats.nextSyncTime
                    ? new Date(syncStats.nextSyncTime).toLocaleString()
                    : 'Not scheduled'}
                </td>
              </tr>
              <tr>
                <td>Average Sync Duration</td>
                <td>{Math.round(syncStats.averageSyncDuration)}ms</td>
              </tr>
            </tbody>
          </Table>
        </Card>

        {/* Network-Aware Image Demo */}
        <Card shadow="sm" p="lg">
          <Title order={3} mb="md">Network-Aware Image Loading</Title>
          
          <Text size="sm" c="dimmed" mb="md">
            This image adapts its quality based on network conditions
          </Text>
          
          <NetworkAwareImage
            sources={[
              { src: '/api/images/sample-low.jpg', quality: 'low', width: 400 },
              { src: '/api/images/sample-medium.jpg', quality: 'medium', width: 800 },
              { src: '/api/images/sample-high.jpg', quality: 'high', width: 1200 },
              { src: '/api/images/sample-original.jpg', quality: 'original', width: 2400 },
            ]}
            alt="Sample medical image"
            aspectRatio={16 / 9}
            showQualityIndicator
            onQualityChange={(quality) => console.log('Image quality changed to:', quality)}
          />
        </Card>

        {/* Mode Switcher */}
        <Card shadow="sm" p="lg">
          <Title order={3} mb="md">Network Aware Mode</Title>
          
          <Group>
            <Button
              variant={networkStatus.networkAwareMode === 'auto' ? 'filled' : 'light'}
              onClick={() => networkStatus.setNetworkAwareMode('auto')}
            >
              Auto
            </Button>
            <Button
              variant={networkStatus.networkAwareMode === 'quality' ? 'filled' : 'light'}
              onClick={() => networkStatus.setNetworkAwareMode('quality')}
            >
              Quality
            </Button>
            <Button
              variant={networkStatus.networkAwareMode === 'save-data' ? 'filled' : 'light'}
              onClick={() => networkStatus.setNetworkAwareMode('save-data')}
            >
              Save Data
            </Button>
            <Button
              variant={networkStatus.networkAwareMode === 'normal' ? 'filled' : 'light'}
              onClick={() => networkStatus.setNetworkAwareMode('normal')}
            >
              Normal
            </Button>
          </Group>
        </Card>
      </Stack>

      {/* Network Status Indicator (floating) */}
      <NetworkStatusIndicator
        position="bottom-right"
        showDetails
        autoHide
        autoHideDelay={5000}
      />
    </Container>
  );
}