'use client';

import { useState, useEffect } from 'react';
import { extendPatientForUI, type UIPatient } from '@/utils/patient.utils';
import {
  Container,
  Grid,
  Card,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Stack,
  SimpleGrid,
  Paper,
  Avatar,
  Tabs,
  ScrollArea,
  Alert,
  Progress,
  RingProgress,
  Center,
  Divider,
  Timeline,
  ThemeIcon,
  Skeleton
} from '@mantine/core';
import {
  IconUser,
  IconHeart,
  IconActivity,
  IconPill,
  IconTestPipe,
  IconStethoscope,
  IconCalendar,
  IconNotes,
  IconAlertTriangle,
  IconShield,
  IconPhone,
  IconMail,
  IconMapPin,
  IconClock,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowRight,
  IconEdit,
  IconPrinter,
  IconShare,
  IconRefresh,
  IconMaximize,
  IconChevronRight,
  IconExternalLink,
  IconDroplet,
  IconThermometer,
  IconLungs,
  IconScale
} from '@tabler/icons-react';
import { usePatientCache } from '@/hooks/usePatientCache';
import { formatDateTime, formatDate } from '@/utils';
import { useAuth } from '@/stores/auth';
import { PatientSummary } from '@/components/patient/PatientSummary';

interface UnifiedPatientSummaryProps {
  patientId: string;
  onNavigate?: (section: string, data?: any) => void;
  isFullScreen?: boolean;
  showQuickActions?: boolean;
}

interface HealthMetric {
  id: string;
  name: string;
  value: string;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  trend: 'up' | 'down' | 'stable';
  timestamp: Date;
  icon: React.ComponentType<any>;
}

interface ClinicalSummary {
  activeConditions: number;
  activeMedications: number;
  allergies: number;
  recentEncounters: number;
  pendingOrders: number;
  pendingResults: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}

export function UnifiedPatientSummary({
  patientId,
  onNavigate,
  isFullScreen = false,
  showQuickActions = true
}: UnifiedPatientSummaryProps) {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const { user, hasAnyRole } = useAuth();
  
  const {
    patient,
    vitals,
    medications,
    allergies,
    conditions,
    encounters,
    labs,
    loading,
    refreshing,
    lastUpdated,
    refresh
  } = usePatientCache(patientId, {
    enableSync: true,
    prefetchRelated: true,
    autoRefresh: true
  });

  // Mock health metrics - in real app, this would be computed from actual vitals
  const [healthMetrics] = useState<HealthMetric[]>([
    {
      id: '1',
      name: 'Heart Rate',
      value: '72',
      unit: 'bpm',
      status: 'normal',
      trend: 'stable',
      timestamp: new Date(Date.now() - 300000),
      icon: IconHeart
    },
    {
      id: '2',
      name: 'Blood Pressure',
      value: '120/80',
      unit: 'mmHg',
      status: 'normal',
      trend: 'down',
      timestamp: new Date(Date.now() - 600000),
      icon: IconDroplet
    },
    {
      id: '3',
      name: 'Temperature',
      value: '98.6',
      unit: '°F',
      status: 'normal',
      trend: 'stable',
      timestamp: new Date(Date.now() - 900000),
      icon: IconThermometer
    },
    {
      id: '4',
      name: 'O2 Saturation',
      value: '98',
      unit: '%',
      status: 'normal',
      trend: 'up',
      timestamp: new Date(Date.now() - 1200000),
      icon: IconLungs
    }
  ]);

  const clinicalSummary: ClinicalSummary = {
    activeConditions: conditions.length,
    activeMedications: medications.length,
    allergies: allergies.length,
    recentEncounters: encounters.slice(0, 5).length,
    pendingOrders: 3, // Mock data
    pendingResults: 2  // Mock data
  };

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
      id: 'prescribe-medication',
      label: 'Prescribe',
      icon: IconPill,
      color: 'orange',
      onClick: () => onNavigate?.('medications', { patientId, action: 'prescribe' }),
      disabled: !hasAnyRole(['physician'])
    },
    {
      id: 'order-labs',
      label: 'Order Labs',
      icon: IconTestPipe,
      color: 'purple',
      onClick: () => onNavigate?.('orders', { patientId, type: 'lab' }),
      disabled: !hasAnyRole(['physician'])
    },
    {
      id: 'clinical-notes',
      label: 'Clinical Notes',
      icon: IconNotes,
      color: 'teal',
      onClick: () => onNavigate?.('notes', { patientId })
    },
    {
      id: 'schedule-appointment',
      label: 'Schedule',
      icon: IconCalendar,
      color: 'indigo',
      onClick: () => onNavigate?.('scheduling', { patientId, action: 'create' })
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'red';
      case 'abnormal': return 'orange';
      case 'normal': return 'green';
      default: return 'gray';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <IconTrendingUp size={14} className="text-green-500" />;
      case 'down': return <IconTrendingDown size={14} className="text-red-500" />;
      case 'stable': return <div className="w-3 h-0.5 bg-gray-400 rounded" />;
      default: return null;
    }
  };

  const calculateHealthScore = () => {
    const normalCount = healthMetrics.filter(m => m.status === 'normal').length;
    return Math.round((normalCount / healthMetrics.length) * 100);
  };

  if (loading && !patient) {
    return (
      <Container size={isFullScreen ? 'xl' : 'lg'} p="md">
        <Stack gap="md">
          <Skeleton height={120} />
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
      <Container size={isFullScreen ? 'xl' : 'lg'} p="md">
        <Alert icon={<IconUser />} color="orange">
          <Text>Patient not found or you don't have permission to view this patient.</Text>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size={isFullScreen ? 'xl' : 'lg'} p="md">
      <Stack gap="md">
        {/* Patient Header */}
        <Card p="lg" withBorder className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <Group justify="space-between" align="flex-start">
            <Group gap="lg">
              <Avatar
                size={isFullScreen ? 'xl' : 'lg'}
                color="blue"
                radius="md"
              >
                {(() => { const ui = extendPatientForUI(patient); return `${ui.firstName?.[0] || ''}${ui.lastName?.[0] || ''}`; })()}
              </Avatar>
              
              <div>
                <Group gap="md" align="center">
                  <Text size={isFullScreen ? 'xl' : 'lg'} fw={700}>
                    {extendPatientForUI(patient).fullName}
                  </Text>
                  {extendPatientForUI(patient).status !== 'active' && (
                    <Badge color="red" variant="filled">
                      {extendPatientForUI(patient).status.toUpperCase()}
                    </Badge>
                  )}
                </Group>
                
                <Group gap="md" mt="sm">
                  <Badge size={isFullScreen ? 'md' : 'sm'} variant="light">
                    MRN: {extendPatientForUI(patient).mrn}
                  </Badge>
                  <Badge size={isFullScreen ? 'md' : 'sm'} variant="light" color="gray">
                    DOB: {formatDate(extendPatientForUI(patient).dateOfBirth)}
                  </Badge>
                  <Badge size={isFullScreen ? 'md' : 'sm'} variant="light" color="purple">
                    {patient.gender?.toUpperCase()}
                  </Badge>
                </Group>
                
                {isFullScreen && (
                  <Group gap="md" mt="sm">
                    {extendPatientForUI(patient).phone && (
                      <Group gap="xs">
                        <IconPhone size={14} className="text-gray-500" />
                        <Text size="sm" c="dimmed">{extendPatientForUI(patient).phone}</Text>
                      </Group>
                    )}
                    {extendPatientForUI(patient).email && (
                      <Group gap="xs">
                        <IconMail size={14} className="text-gray-500" />
                        <Text size="sm" c="dimmed">{extendPatientForUI(patient).email}</Text>
                      </Group>
                    )}
                    {extendPatientForUI(patient).address && (
                      <Group gap="xs">
                        <IconMapPin size={14} className="text-gray-500" />
                        <Text size="sm" c="dimmed">
                          {extendPatientForUI(patient).address}
                        </Text>
                      </Group>
                    )}
                  </Group>
                )}
              </div>
            </Group>
            
            <Group gap="xs">
              <ActionIcon 
                variant="light" 
                onClick={refresh}
                loading={refreshing}
                title="Refresh patient data"
              >
                <IconRefresh size={16} />
              </ActionIcon>
              
              {isFullScreen && (
                <>
                  <ActionIcon variant="light" title="Print summary">
                    <IconPrinter size={16} />
                  </ActionIcon>
                  <ActionIcon variant="light" title="Share patient">
                    <IconShare size={16} />
                  </ActionIcon>
                  <ActionIcon 
                    variant="light" 
                    onClick={() => onNavigate?.('patients', { patientId, action: 'edit' })}
                    title="Edit patient"
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </>
              )}
            </Group>
          </Group>
        </Card>

        {/* Critical Alerts */}
        {allergies.length > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="light"
          >
            <Group justify="space-between">
              <Text fw={500}>
                <IconShield size={16} className="inline mr-2" />
                {allergies.length} Active Allergies - Review before prescribing
              </Text>
              <Button 
                size="xs" 
                color="red" 
                variant="light"
                rightSection={<IconArrowRight size={12} />}
                onClick={() => onNavigate?.('allergies', { patientId })}
              >
                View Details
              </Button>
            </Group>
          </Alert>
        )}

        {/* Quick Actions */}
        {showQuickActions && (
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={600} size="sm">
                Quick Actions
              </Text>
              {lastUpdated && (
                <Text size="xs" c="dimmed">
                  Last updated: {formatDateTime(lastUpdated)}
                </Text>
              )}
            </Group>
            
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
              {quickActions.filter(action => !action.disabled).map((action) => (
                <Button
                  key={action.id}
                  variant="light"
                  color={action.color}
                  size={isFullScreen ? 'sm' : 'xs'}
                  leftSection={<action.icon size={16} />}
                  onClick={action.onClick}
                  fullWidth
                >
                  {action.label}
                  {action.badge && (
                    <Badge size="xs" ml="xs">
                      {action.badge}
                    </Badge>
                  )}
                </Button>
              ))}
            </SimpleGrid>
          </Card>
        )}

        {/* Main Content Grid */}
        <Grid>
          {/* Left Column - Clinical Overview */}
          <Grid.Col span={{ base: 12, lg: isFullScreen ? 8 : 12 }}>
            <Stack gap="md">
              {/* Health Score & Vitals */}
              <Card withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={600} size="sm">
                    Current Health Status
                  </Text>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      Health Score
                    </Text>
                    <RingProgress
                      size={40}
                      thickness={4}
                      sections={[{ value: calculateHealthScore(), color: 'green' }]}
                      label={
                        <Text size="xs" ta="center" fw={700}>
                          {calculateHealthScore()}%
                        </Text>
                      }
                    />
                  </Group>
                </Group>
                
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                  {healthMetrics.map((metric) => {
                    const IconComponent = metric.icon;
                    return (
                      <Paper key={metric.id} p="sm" className="bg-gray-50 rounded-lg">
                        <Group justify="space-between" align="center">
                          <div>
                            <Group gap="xs" align="center">
                              <IconComponent size={16} className={`text-${getStatusColor(metric.status)}-500`} />
                              <Text size="xs" c="dimmed">
                                {metric.name}
                              </Text>
                            </Group>
                            <Group gap="xs" align="center" mt="xs">
                              <Text fw={600} size="sm">
                                {metric.value} {metric.unit}
                              </Text>
                              {getTrendIcon(metric.trend)}
                            </Group>
                          </div>
                          <Badge 
                            size="xs" 
                            color={getStatusColor(metric.status)}
                            variant="dot"
                          >
                            {metric.status}
                          </Badge>
                        </Group>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Card>

              {/* Clinical Summary Cards */}
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                <Card withBorder className="text-center">
                  <ThemeIcon size="lg" color="blue" variant="light" mx="auto" mb="xs">
                    <IconStethoscope size={24} />
                  </ThemeIcon>
                  <Text fw={700} size="xl" c="blue">
                    {clinicalSummary.activeConditions}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Active Conditions
                  </Text>
                  <Button 
                    size="xs" 
                    variant="subtle" 
                    mt="xs"
                    rightSection={<IconChevronRight size={12} />}
                    onClick={() => onNavigate?.('conditions', { patientId })}
                  >
                    View All
                  </Button>
                </Card>

                <Card withBorder className="text-center">
                  <ThemeIcon size="lg" color="orange" variant="light" mx="auto" mb="xs">
                    <IconPill size={24} />
                  </ThemeIcon>
                  <Text fw={700} size="xl" c="orange">
                    {clinicalSummary.activeMedications}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Active Medications
                  </Text>
                  <Button 
                    size="xs" 
                    variant="subtle" 
                    mt="xs"
                    rightSection={<IconChevronRight size={12} />}
                    onClick={() => onNavigate?.('medications', { patientId })}
                  >
                    View All
                  </Button>
                </Card>

                <Card withBorder className="text-center">
                  <ThemeIcon size="lg" color="red" variant="light" mx="auto" mb="xs">
                    <IconShield size={24} />
                  </ThemeIcon>
                  <Text fw={700} size="xl" c="red">
                    {clinicalSummary.allergies}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Known Allergies
                  </Text>
                  <Button 
                    size="xs" 
                    variant="subtle" 
                    mt="xs"
                    rightSection={<IconChevronRight size={12} />}
                    onClick={() => onNavigate?.('allergies', { patientId })}
                  >
                    View All
                  </Button>
                </Card>
              </SimpleGrid>

              {/* Detailed Patient Summary */}
              <PatientSummary
                patient={patient}
                showVitals={true}
                showMedications={true}
                showAllergies={false} // Already shown above
                showConditions={true}
                showRecentActivity={true}
                onViewDetails={(section) => onNavigate?.(section, { patientId })}
              />
            </Stack>
          </Grid.Col>

          {/* Right Column - Quick Info & Actions (Full Screen Only) */}
          {isFullScreen && (
            <Grid.Col span={4}>
              <Stack gap="md">
                {/* Recent Activity Timeline */}
                <Card withBorder>
                  <Group justify="space-between" mb="md">
                    <Text fw={600} size="sm">
                      Recent Activity
                    </Text>
                    <ActionIcon 
                      variant="light" 
                      size="sm"
                      onClick={() => onNavigate?.('timeline', { patientId })}
                    >
                      <IconExternalLink size={14} />
                    </ActionIcon>
                  </Group>
                  
                  <ScrollArea h={300}>
                    <Timeline active={3}>
                      <Timeline.Item
                        bullet={<IconStethoscope size={12} />}
                        title="Encounter Completed"
                      >
                        <Text c="dimmed" size="sm">
                          Annual physical exam completed
                        </Text>
                        <Text size="xs" c="dimmed">
                          2 hours ago
                        </Text>
                      </Timeline.Item>
                      
                      <Timeline.Item
                        bullet={<IconTestPipe size={12} />}
                        title="Lab Results Available"
                      >
                        <Text c="dimmed" size="sm">
                          Complete blood count results
                        </Text>
                        <Text size="xs" c="dimmed">
                          4 hours ago
                        </Text>
                      </Timeline.Item>
                      
                      <Timeline.Item
                        bullet={<IconPill size={12} />}
                        title="Medication Prescribed"
                      >
                        <Text c="dimmed" size="sm">
                          Lisinopril 10mg daily
                        </Text>
                        <Text size="xs" c="dimmed">
                          1 day ago
                        </Text>
                      </Timeline.Item>
                      
                      <Timeline.Item
                        bullet={<IconCalendar size={12} />}
                        title="Appointment Scheduled"
                      >
                        <Text c="dimmed" size="sm">
                          Follow-up in 3 months
                        </Text>
                        <Text size="xs" c="dimmed">
                          2 days ago
                        </Text>
                      </Timeline.Item>
                    </Timeline>
                  </ScrollArea>
                </Card>

                {/* Pending Actions */}
                <Card withBorder>
                  <Text fw={600} size="sm" mb="md">
                    Pending Actions
                  </Text>
                  
                  <Stack gap="xs">
                    <Alert icon={<IconTestPipe size={16} />} color="orange" variant="light">
                      <Text size="sm">2 lab results pending review</Text>
                    </Alert>
                    
                    <Alert icon={<IconCalendar size={16} />} color="blue" variant="light">
                      <Text size="sm">Follow-up appointment due</Text>
                    </Alert>
                    
                    <Alert icon={<IconNotes size={16} />} color="purple" variant="light">
                      <Text size="sm">Clinical note requires signature</Text>
                    </Alert>
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
          )}
        </Grid>
      </Stack>
    </Container>
  );
}

export default UnifiedPatientSummary;