'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Progress,
  Alert,
  Modal,
  List,
  ActionIcon,
  Tooltip,
  Paper,
  Center,
  RingProgress,
  SimpleGrid,
  Accordion,
  ScrollArea,
} from '@mantine/core';
import {
  IconWifi,
  IconWifiOff,
  IconDatabase,
  IconShieldCheck,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconTrash,
  IconDownload,
  IconHeart,
  IconStethoscope,
  IconPill,
  IconTestPipe,
  IconNotes,
  IconUser,
  IconCalendar,
  IconRefresh,
  IconEye,
  IconSettings,
} from '@tabler/icons-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePWAHealthcare } from '@/components/pwa/PWAHealthcareProvider';
import { formatDistanceToNow, format } from 'date-fns';

interface OfflineData {
  id: string;
  type: 'patient' | 'note' | 'medication' | 'vital' | 'appointment';
  title: string;
  description: string;
  timestamp: Date;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  size: number;
  critical: boolean;
}

interface StorageUsage {
  used: number;
  available: number;
  critical: number;
  patientData: number;
  clinicalNotes: number;
  medications: number;
  emergency: number;
}

export function OfflineHealthcareManager() {
  const [showDetails, setShowDetails] = useState(false);
  const [offlineData, setOfflineData] = useState<OfflineData[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({
    used: 45,
    available: 100,
    critical: 15,
    patientData: 20,
    clinicalNotes: 15,
    medications: 8,
    emergency: 2,
  });
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(new Date());

  const {
    isOnline,
    syncProgress,
    offlineQueueSize,
    syncOfflineData,
    getOfflineCapabilities,
  } = usePWAHealthcare();

  const {
    buttonPress,
    successAction,
    errorAction,
    criticalValue,
  } = useHapticFeedback();

  // Mock offline data
  useEffect(() => {
    const mockData: OfflineData[] = [
      {
        id: '1',
        type: 'patient',
        title: 'John Smith - Vital Signs',
        description: 'Updated blood pressure and heart rate',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        status: 'pending',
        size: 2.5,
        critical: true,
      },
      {
        id: '2',
        type: 'note',
        title: 'Clinical Note - Sarah Johnson',
        description: 'Post-operative assessment notes',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'pending',
        size: 1.2,
        critical: false,
      },
      {
        id: '3',
        type: 'medication',
        title: 'Medication Update - David Brown',
        description: 'Changed dosage for hypertension medication',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'synced',
        size: 0.8,
        critical: true,
      },
      {
        id: '4',
        type: 'appointment',
        title: 'Emergency Appointment',
        description: 'Scheduled urgent consultation',
        timestamp: new Date(Date.now() - 20 * 60 * 1000),
        status: 'error',
        size: 0.5,
        critical: true,
      },
    ];
    setOfflineData(mockData);
  }, []);

  const handleSync = useCallback(async () => {
    buttonPress();
    setSyncInProgress(true);
    
    try {
      await syncOfflineData();
      setLastSync(new Date());
      successAction();
      
      // Update mock data status
      setOfflineData(prev => prev.map(item => 
        item.status === 'pending' ? { ...item, status: 'synced' } : item
      ));
    } catch (error) {
      errorAction();
    } finally {
      setSyncInProgress(false);
    }
  }, [syncOfflineData, buttonPress, successAction, errorAction]);

  const handleDeleteOfflineItem = useCallback((id: string) => {
    criticalValue();
    setOfflineData(prev => prev.filter(item => item.id !== id));
  }, [criticalValue]);

  const getTypeIcon = (type: OfflineData['type']) => {
    switch (type) {
      case 'patient': return <IconUser size={16} />;
      case 'note': return <IconNotes size={16} />;
      case 'medication': return <IconPill size={16} />;
      case 'vital': return <IconHeart size={16} />;
      case 'appointment': return <IconCalendar size={16} />;
      default: return <IconDatabase size={16} />;
    }
  };

  const getStatusColor = (status: OfflineData['status']) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'syncing': return 'blue';
      case 'synced': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: OfflineData['status']) => {
    switch (status) {
      case 'pending': return <IconClock size={14} />;
      case 'syncing': return <IconRefresh size={14} />;
      case 'synced': return <IconCheck size={14} />;
      case 'error': return <IconAlertTriangle size={14} />;
      default: return <IconDatabase size={14} />;
    }
  };

  const pendingItems = offlineData.filter(item => item.status === 'pending');
  const criticalPendingItems = pendingItems.filter(item => item.critical);
  const capabilities = getOfflineCapabilities();
  const criticalCapabilities = capabilities.filter(cap => cap.critical);

  const storagePercentage = (storageUsage.used / storageUsage.available) * 100;

  return (
    <Stack gap="md">
      {/* Connection Status */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            {isOnline ? (
              <>
                <IconWifi size={20} className="text-green-500" />
                <Text fw={600} c="green">Online</Text>
              </>
            ) : (
              <>
                <IconWifiOff size={20} className="text-orange-500" />
                <Text fw={600} c="orange">Offline</Text>
              </>
            )}
          </Group>
          
          <Badge
            color={isOnline ? 'green' : 'orange'}
            variant="light"
            size="sm"
          >
            {isOnline ? 'Connected' : 'Offline Mode'}
          </Badge>
        </Group>

        {!isOnline && (
          <Alert
            icon={<IconShieldCheck size={16} />}
            color="blue"
            variant="light"
            title="Healthcare Data Available Offline"
          >
            <Text size="sm">
              Critical patient data, emergency protocols, and medication information 
              are available while offline. Changes will sync when you reconnect.
            </Text>
          </Alert>
        )}

        {lastSync && (
          <Text size="xs" c="dimmed" mt="sm">
            Last sync: {formatDistanceToNow(lastSync, { addSuffix: true })}
          </Text>
        )}
      </Card>

      {/* Sync Status */}
      {(syncInProgress || syncProgress > 0) && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Syncing Data</Text>
            <IconRefresh size={20} className="animate-spin" />
          </Group>
          <Progress value={syncProgress} size="sm" />
          <Text size="xs" c="dimmed" mt="xs">
            Syncing offline changes with server...
          </Text>
        </Card>
      )}

      {/* Offline Queue Summary */}
      {offlineQueueSize > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs" style={{ flex: 1 }}>
              <Group gap="sm">
                <IconDatabase size={20} className="text-blue-500" />
                <Text fw={600}>Offline Queue</Text>
              </Group>
              
              <Text size="sm" c="dimmed">
                {pendingItems.length} items waiting to sync
                {criticalPendingItems.length > 0 && (
                  <Text span c="red" fw={500} ml={4}>
                    ({criticalPendingItems.length} critical)
                  </Text>
                )}
              </Text>
            </Stack>

            <Group gap="xs">
              <Tooltip label="View details">
                <ActionIcon
                  size="lg"
                  variant="outline"
                  onClick={() => setShowDetails(true)}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <IconEye size={18} />
                </ActionIcon>
              </Tooltip>
              
              <Tooltip label="Sync now">
                <ActionIcon
                  size="lg"
                  color="blue"
                  variant="filled"
                  onClick={handleSync}
                  disabled={!isOnline || syncInProgress}
                  loading={syncInProgress}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Card>
      )}

      {/* Storage Usage */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Storage Usage</Text>
          <Badge
            color={storagePercentage > 80 ? 'red' : storagePercentage > 60 ? 'orange' : 'green'}
            variant="light"
            size="sm"
          >
            {storagePercentage.toFixed(1)}% used
          </Badge>
        </Group>

        <Center mb="md">
          <RingProgress
            size={120}
            thickness={8}
            sections={[
              { value: (storageUsage.patientData / storageUsage.available) * 100, color: 'blue' },
              { value: (storageUsage.clinicalNotes / storageUsage.available) * 100, color: 'green' },
              { value: (storageUsage.medications / storageUsage.available) * 100, color: 'purple' },
              { value: (storageUsage.emergency / storageUsage.available) * 100, color: 'red' },
            ]}
            label={
              <Text size="xs" ta="center" fw={700}>
                {storageUsage.used}MB<br/>
                <Text size="xs" c="dimmed">of {storageUsage.available}MB</Text>
              </Text>
            }
          />
        </Center>

        <SimpleGrid cols={2} spacing="xs">
          <Group gap="xs">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <Text size="xs">Patient Data ({storageUsage.patientData}MB)</Text>
          </Group>
          <Group gap="xs">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <Text size="xs">Clinical Notes ({storageUsage.clinicalNotes}MB)</Text>
          </Group>
          <Group gap="xs">
            <div className="w-3 h-3 bg-purple-500 rounded-full" />
            <Text size="xs">Medications ({storageUsage.medications}MB)</Text>
          </Group>
          <Group gap="xs">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <Text size="xs">Emergency ({storageUsage.emergency}MB)</Text>
          </Group>
        </SimpleGrid>
      </Card>

      {/* Offline Capabilities */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text fw={600} mb="md">Offline Capabilities</Text>
        
        <Accordion variant="contained">
          <Accordion.Item value="critical">
            <Accordion.Control
              icon={<IconShieldCheck size={16} className="text-red-500" />}
            >
              Critical Features ({criticalCapabilities.length})
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {criticalCapabilities.map((capability, index) => (
                  <Group key={index} justify="space-between">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>{capability.name}</Text>
                      <Text size="xs" c="dimmed">{capability.description}</Text>
                    </Stack>
                    <Badge
                      color={capability.available ? 'green' : 'red'}
                      variant="light"
                      size="xs"
                    >
                      {capability.available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="all">
            <Accordion.Control
              icon={<IconDatabase size={16} className="text-blue-500" />}
            >
              All Features ({capabilities.length})
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {capabilities.map((capability, index) => (
                  <Group key={index} justify="space-between">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>{capability.name}</Text>
                      <Text size="xs" c="dimmed">{capability.description}</Text>
                    </Stack>
                    <Badge
                      color={capability.available ? 'green' : 'gray'}
                      variant="light"
                      size="xs"
                    >
                      {capability.available ? 'Available' : 'Online Only'}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Card>

      {/* Offline Data Details Modal */}
      <Modal
        opened={showDetails}
        onClose={() => setShowDetails(false)}
        title="Offline Data Queue"
        size="lg"
      >
        <Stack gap="md">
          {offlineData.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No offline data queued
            </Text>
          ) : (
            <ScrollArea h={400}>
              <Stack gap="sm">
                {offlineData.map((item) => (
                  <Paper key={item.id} p="md" withBorder>
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm" style={{ flex: 1 }}>
                        {getTypeIcon(item.type)}
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Text fw={500} size="sm">{item.title}</Text>
                            {item.critical && (
                              <Badge color="red" size="xs">
                                Critical
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">{item.description}</Text>
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">
                              {format(item.timestamp, 'MMM d, h:mm a')}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {item.size}KB
                            </Text>
                          </Group>
                        </Stack>
                      </Group>

                      <Group gap="xs">
                        <Badge
                          color={getStatusColor(item.status)}
                          variant="light"
                          size="xs"
                          leftSection={getStatusIcon(item.status)}
                        >
                          {item.status}
                        </Badge>
                        
                        {item.status === 'pending' && (
                          <Tooltip label="Delete">
                            <ActionIcon
                              size="sm"
                              color="red"
                              variant="outline"
                              onClick={() => handleDeleteOfflineItem(item.id)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          )}

          <Group justify="space-between">
            <Button
              variant="outline"
              onClick={() => setShowDetails(false)}
            >
              Close
            </Button>
            
            {pendingItems.length > 0 && (
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={handleSync}
                disabled={!isOnline || syncInProgress}
                loading={syncInProgress}
              >
                Sync All
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default OfflineHealthcareManager;