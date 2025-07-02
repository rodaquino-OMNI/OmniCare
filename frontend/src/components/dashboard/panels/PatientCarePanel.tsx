'use client';

import { useState, useEffect } from 'react';
import { extendPatientForUI, type UIPatient } from '@/utils/patient.utils';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Button,
  ActionIcon,
  Tabs,
  Progress,
  Alert,
  SimpleGrid,
  Paper,
  Avatar,
  Divider,
  Skeleton,
  RingProgress,
  Center
} from '@mantine/core';
import {
  IconUser,
  IconActivity,
  IconHeart,
  IconThermometer,
  IconDroplet,
  IconStethoscope,
  IconCalendar,
  IconNotes,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowRight,
  IconClock,
  IconPhone,
  IconMail,
  IconShield
} from '@tabler/icons-react';
import { usePatientCache } from '@/hooks/usePatientCache';
import { formatDateTime, formatDate } from '@/utils';

interface PatientCarePanelProps {
  patientId?: string;
  onNavigate?: (section: string, data?: any) => void;
  isMaximized?: boolean;
}

interface VitalSign {
  type: string;
  value: string;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  timestamp: Date;
  trend?: 'up' | 'down' | 'stable';
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

export function PatientCarePanel({ 
  patientId, 
  onNavigate, 
  isMaximized = false 
}: PatientCarePanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const {
    patient,
    vitals,
    encounters,
    conditions,
    allergies,
    loading,
    lastUpdated
  } = usePatientCache(patientId || '', {
    enableSync: true,
    prefetchRelated: true
  });
  
  // Mock vital signs data - in real app, this would come from the cache
  const [recentVitals] = useState<VitalSign[]>([
    {
      type: 'Heart Rate',
      value: '72',
      unit: 'bpm',
      status: 'normal',
      timestamp: new Date(Date.now() - 60000),
      trend: 'stable'
    },
    {
      type: 'Blood Pressure',
      value: '120/80',
      unit: 'mmHg',
      status: 'normal',
      timestamp: new Date(Date.now() - 120000),
      trend: 'down'
    },
    {
      type: 'Temperature',
      value: '98.6',
      unit: '°F',
      status: 'normal',
      timestamp: new Date(Date.now() - 180000),
      trend: 'stable'
    },
    {
      type: 'O2 Saturation',
      value: '98',
      unit: '%',
      status: 'normal',
      timestamp: new Date(Date.now() - 240000),
      trend: 'up'
    }
  ]);

  const quickActions: QuickAction[] = [
    {
      id: 'record-vitals',
      label: 'Record Vitals',
      icon: IconActivity,
      color: 'blue',
      onClick: () => onNavigate?.('vitals', { patientId, action: 'record' })
    },
    {
      id: 'new-encounter',
      label: 'New Encounter',
      icon: IconStethoscope,
      color: 'green',
      onClick: () => onNavigate?.('encounters', { patientId, action: 'create' })
    },
    {
      id: 'clinical-notes',
      label: 'Clinical Notes',
      icon: IconNotes,
      color: 'orange',
      onClick: () => onNavigate?.('notes', { patientId })
    },
    {
      id: 'care-plan',
      label: 'Care Plan',
      icon: IconCalendar,
      color: 'purple',
      onClick: () => onNavigate?.('care-plans', { patientId })
    }
  ];

  const getVitalStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'red';
      case 'abnormal': return 'orange';
      case 'normal': return 'green';
      default: return 'gray';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return <IconTrendingUp size={14} className="text-green-500" />;
      case 'down': return <IconTrendingDown size={14} className="text-red-500" />;
      case 'stable': return <div className="w-3 h-0.5 bg-gray-400 rounded" />;
      default: return null;
    }
  };

  if (!patientId) {
    return (
      <Stack align="center" justify="center" h="100%">
        <IconUser size={48} className="text-gray-400" />
        <Text c="dimmed" ta="center">
          Select a patient to view care information
        </Text>
        <Button 
          variant="light" 
          leftSection={<IconUser size={16} />}
          onClick={() => onNavigate?.('patients')}
        >
          Browse Patients
        </Button>
      </Stack>
    );
  }

  if (loading && !patient) {
    return (
      <Stack gap="md">
        <Skeleton height={60} />
        <SimpleGrid cols={2} spacing="xs">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </SimpleGrid>
        <Skeleton height={120} />
      </Stack>
    );
  }

  return (
    <Stack gap="md" h="100%">
      {/* Patient Header */}
      {patient && (() => {
        const uiPatient = extendPatientForUI(patient);
        return (
          <Card p="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <Group gap="md">
                <Avatar
                  size={isMaximized ? 'lg' : 'md'}
                  color="blue"
                  radius="md"
                >
                  {uiPatient.firstName?.[0]}{uiPatient.lastName?.[0]}
                </Avatar>
                
                <div>
                  <Text fw={600} size={isMaximized ? 'lg' : 'md'}>
                    {uiPatient.fullName}
                  </Text>
                  <Group gap="xs" mt="xs">
                    <Badge size="sm" variant="light">
                      MRN: {uiPatient.mrn}
                    </Badge>
                    <Badge size="sm" variant="light" color="gray">
                      DOB: {formatDate(uiPatient.dateOfBirth)}
                    </Badge>
                    <Badge 
                      size="sm" 
                      variant="light" 
                      color={uiPatient.status === 'active' ? 'green' : 'gray'}
                    >
                      {uiPatient.status.toUpperCase()}
                    </Badge>
                  </Group>
                </div>
              </Group>
            
            {isMaximized && (
              <Group gap="xs">
                <ActionIcon variant="light" size="sm">
                  <IconPhone size={14} />
                </ActionIcon>
                <ActionIcon variant="light" size="sm">
                  <IconMail size={14} />
                </ActionIcon>
              </Group>
            )}
          </Group>
        </Card>
        );
      })()}

      {/* Quick Actions */}
      <SimpleGrid cols={isMaximized ? 4 : 2} spacing="xs">
        {quickActions.map((action) => (
          <Button
            key={action.id}
            variant="light"
            color={action.color}
            leftSection={<action.icon size={16} />}
            onClick={action.onClick}
            disabled={action.disabled}
            size={isMaximized ? 'sm' : 'xs'}
            fullWidth
          >
            {action.label}
          </Button>
        ))}
      </SimpleGrid>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} flex={1}>
        <Tabs.List grow={!isMaximized}>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={14} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="vitals" leftSection={<IconHeart size={14} />}>
            Vitals
          </Tabs.Tab>
          {isMaximized && (
            <>
              <Tabs.Tab value="encounters" leftSection={<IconStethoscope size={14} />}>
                Encounters
              </Tabs.Tab>
              <Tabs.Tab value="conditions" leftSection={<IconShield size={14} />}>
                Conditions
              </Tabs.Tab>
            </>
          )}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {/* Critical Alerts */}
            {allergies.length > 0 && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                color="red"
                variant="light"
              >
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {allergies.length} Active Allerg{allergies.length === 1 ? 'y' : 'ies'}
                  </Text>
                  <Button 
                    size="xs" 
                    variant="subtle" 
                    color="red"
                    rightSection={<IconArrowRight size={12} />}
                    onClick={() => onNavigate?.('allergies', { patientId })}
                  >
                    View All
                  </Button>
                </Group>
              </Alert>
            )}

            {/* Recent Vitals Summary */}
            <Card withBorder>
              <Group justify="space-between" mb="md">
                <Text fw={500} size="sm">
                  Recent Vital Signs
                </Text>
                <Text size="xs" c="dimmed">
                  {recentVitals[0]?.timestamp && formatDateTime(recentVitals[0].timestamp)}
                </Text>
              </Group>
              
              <SimpleGrid cols={isMaximized ? 4 : 2} spacing="md">
                {recentVitals.map((vital, index) => (
                  <Paper key={index} p="sm" className="bg-gray-50 rounded-lg">
                    <Group justify="space-between" align="center">
                      <div>
                        <Text size="xs" c="dimmed">
                          {vital.type}
                        </Text>
                        <Group gap="xs" align="center">
                          <Text fw={600} size="sm">
                            {vital.value} {vital.unit}
                          </Text>
                          {getTrendIcon(vital.trend)}
                        </Group>
                      </div>
                      <Badge 
                        size="xs" 
                        color={getVitalStatusColor(vital.status)}
                        variant="dot"
                      >
                        {vital.status}
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            </Card>

            {/* Active Conditions */}
            {conditions.length > 0 && (
              <Card withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={500} size="sm">
                    Active Conditions
                  </Text>
                  <Button 
                    size="xs" 
                    variant="subtle"
                    rightSection={<IconArrowRight size={12} />}
                    onClick={() => onNavigate?.('conditions', { patientId })}
                  >
                    View All
                  </Button>
                </Group>
                
                <Stack gap="xs">
                  {conditions.slice(0, isMaximized ? 5 : 3).map((condition, index) => (
                    <Paper key={index} p="xs" className="border border-gray-200 rounded">
                      <Text size="sm">
                        {condition.code?.text || 'Unknown Condition'}
                      </Text>
                    </Paper>
                  ))}
                  {conditions.length > (isMaximized ? 5 : 3) && (
                    <Text size="xs" c="dimmed" ta="center">
                      +{conditions.length - (isMaximized ? 5 : 3)} more conditions
                    </Text>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="vitals" pt="md">
          <Stack gap="md">
            {recentVitals.map((vital, index) => (
              <Card key={index} withBorder>
                <Group justify="space-between" align="center">
                  <Group gap="md">
                    <div className={`p-2 rounded-lg ${
                      vital.status === 'normal' ? 'bg-green-100' :
                      vital.status === 'abnormal' ? 'bg-orange-100' :
                      'bg-red-100'
                    }`}>
                      {vital.type.includes('Heart') && <IconHeart size={20} />}
                      {vital.type.includes('Blood') && <IconDroplet size={20} />}
                      {vital.type.includes('Temperature') && <IconThermometer size={20} />}
                      {vital.type.includes('O2') && <IconActivity size={20} />}
                    </div>
                    
                    <div>
                      <Text fw={500} size="sm">
                        {vital.type}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDateTime(vital.timestamp)}
                      </Text>
                    </div>
                  </Group>
                  
                  <Group gap="sm">
                    <Text fw={600} size="lg">
                      {vital.value} {vital.unit}
                    </Text>
                    {getTrendIcon(vital.trend)}
                    <Badge 
                      color={getVitalStatusColor(vital.status)}
                      variant="light"
                      size="sm"
                    >
                      {vital.status.toUpperCase()}
                    </Badge>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>

        {isMaximized && (
          <>
            <Tabs.Panel value="encounters" pt="md">
              <Stack gap="md">
                {encounters.slice(0, 5).map((encounter, index) => (
                  <Card key={index} withBorder>
                    <Group justify="space-between" align="center">
                      <div>
                        <Text fw={500} size="sm">
                          {encounter.type?.replace('_', ' ').toUpperCase()}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {encounter.period?.start && formatDateTime(encounter.period.start)}
                        </Text>
                      </div>
                      <Badge 
                        color={encounter.status === 'finished' ? 'green' : 'blue'}
                        variant="light"
                      >
                        {encounter.status?.toUpperCase()}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="conditions" pt="md">
              <Stack gap="md">
                {conditions.map((condition, index) => (
                  <Card key={index} withBorder>
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={500} size="sm">
                          {condition.code?.text || 'Unknown Condition'}
                        </Text>
                        {condition.recordedDate && (
                          <Text size="xs" c="dimmed">
                            Recorded: {formatDate(condition.recordedDate)}
                          </Text>
                        )}
                      </div>
                      <Badge 
                        size="xs" 
                        color="blue" 
                        variant="light"
                      >
                        {condition.verificationStatus?.coding?.[0]?.code?.toUpperCase() || 'ACTIVE'}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Tabs.Panel>
          </>
        )}
      </Tabs>
    </Stack>
  );
}

export default PatientCarePanel;