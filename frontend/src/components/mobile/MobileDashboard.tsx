'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Stack,
  Card,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Alert,
  Progress,
  RingProgress,
  Center,
  SimpleGrid,
  Paper,
  Box,
  Skeleton,
  Transition,
  Notification,
  Portal,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  IconRefresh,
  IconBell,
  IconAlertTriangle,
  IconUsers,
  IconCalendar,
  IconTestPipe,
  IconPill,
  IconStethoscope,
  IconCheck,
  IconX,
  IconExclamationCircle,
  IconHeart,
  IconClock,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconPhone,
  IconMessage,
  IconUrgent,
  IconEye,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAuth } from '@/stores/auth';
import { formatDistanceToNow, format } from 'date-fns';

interface MobileDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface CriticalAlert {
  id: string;
  type: 'emergency' | 'critical' | 'warning' | 'medication' | 'allergy';
  title: string;
  message: string;
  patientName?: string;
  time: Date;
  priority: 'high' | 'medium' | 'low';
  acknowledged?: boolean;
}

interface TouchableStatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  isLoading?: boolean;
  onClick?: () => void;
  showAlert?: boolean;
}

function TouchableStatCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  isLoading = false,
  onClick,
  showAlert = false,
}: TouchableStatCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { buttonPress, criticalValue } = useHapticFeedback();

  const handlePress = useCallback(() => {
    setIsPressed(true);
    buttonPress();
    
    if (showAlert) {
      criticalValue();
    }
    
    onClick?.();
    
    setTimeout(() => setIsPressed(false), 150);
  }, [onClick, buttonPress, criticalValue, showAlert]);

  const getColorClasses = () => {
    switch (color) {
      case 'blue': return 'text-blue-500 bg-blue-50 border-blue-200';
      case 'green': return 'text-green-500 bg-green-50 border-green-200';
      case 'orange': return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'red': return 'text-red-500 bg-red-50 border-red-200';
      case 'purple': return 'text-purple-500 bg-purple-50 border-purple-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <IconTrendingUp size={12} />;
    if (trend === 'down') return <IconTrendingDown size={12} />;
    return <IconMinus size={12} />;
  };

  if (isLoading) {
    return (
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        h="140px"
        className="min-h-[140px]"
      >
        <Group justify="space-between" mb="xs">
          <Skeleton height={16} width={100} />
          <Skeleton height={24} width={24} circle />
        </Group>
        <Skeleton height={32} width={80} mt="md" mb="md" />
        <Skeleton height={20} width={120} />
      </Card>
    );
  }

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      h="140px"
      className={`min-h-[140px] cursor-pointer transition-all duration-150 ${
        isPressed ? 'scale-95 shadow-lg' : 'hover:shadow-md'
      } ${showAlert ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
      onClick={handlePress}
      style={{
        transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        touchAction: 'manipulation',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed" fw={500}>
          {title}
        </Text>
        <Box pos="relative">
          <Icon size={24} className={getColorClasses().split(' ')[0]} />
          {showAlert && (
            <Box
              pos="absolute"
              top={-4}
              right={-4}
              w={12}
              h={12}
              bg="red"
              style={{ borderRadius: '50%' }}
            />
          )}
        </Box>
      </Group>

      <Text size="xl" fw={700} className="text-gray-800" mb="sm">
        {value}
      </Text>

      {change && (
        <Group gap="xs" align="center">
          {getTrendIcon()}
          <Text size="xs" fw={500} c={trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'gray'}>
            {change}
          </Text>
        </Group>
      )}
    </Card>
  );
}

interface CriticalAlertBannerProps {
  alert: CriticalAlert;
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
}

function CriticalAlertBanner({ alert, onAcknowledge, onDismiss }: CriticalAlertBannerProps) {
  const { emergencyAlert, allergyAlert, medicationConfirm } = useHapticFeedback();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Trigger haptic feedback based on alert type
    switch (alert.type) {
      case 'emergency':
        emergencyAlert();
        break;
      case 'allergy':
        allergyAlert();
        break;
      case 'medication':
        medicationConfirm();
        break;
      default:
        break;
    }
  }, [alert.type, emergencyAlert, allergyAlert, medicationConfirm]);

  const getAlertColor = () => {
    switch (alert.type) {
      case 'emergency': return 'red';
      case 'critical': return 'red';
      case 'allergy': return 'red';
      case 'medication': return 'orange';
      case 'warning': return 'yellow';
      default: return 'blue';
    }
  };

  const getAlertIcon = () => {
    switch (alert.type) {
      case 'emergency': return <IconUrgent size={20} />;
      case 'allergy': return <IconShieldCheck size={20} />;
      case 'medication': return <IconPill size={20} />;
      case 'critical': return <IconExclamationCircle size={20} />;
      default: return <IconAlertTriangle size={20} />;
    }
  };

  const handleAcknowledge = () => {
    medicationConfirm();
    onAcknowledge(alert.id);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    onDismiss(alert.id);
    setIsVisible(false);
  };

  return (
    <Transition mounted={isVisible} transition="slide-down" duration={300}>
      {(styles) => (
        <Alert
          style={styles}
          icon={getAlertIcon()}
          color={getAlertColor()}
          title={alert.title}
          withCloseButton={false}
          className="mb-4"
        >
          <Stack gap="xs">
            <Text size="sm">
              {alert.message}
              {alert.patientName && (
                <Text span fw={600} ml={4}>
                  - {alert.patientName}
                </Text>
              )}
            </Text>
            
            <Group gap="xs" mt="xs">
              <Button
                size="xs"
                color={getAlertColor()}
                onClick={handleAcknowledge}
                leftSection={<IconCheck size={14} />}
                className="min-h-[32px]"
              >
                Acknowledge
              </Button>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={handleDismiss}
                className="min-h-[32px] min-w-[32px]"
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Stack>
        </Alert>
      )}
    </Transition>
  );
}

export function MobileDashboard({
  className,
  autoRefresh = true,
  refreshInterval = 30,
}: MobileDashboardProps) {
  const { user } = useAuth();
  const { data, isLoading, error, refresh } = useDashboardData({
    autoRefresh,
    refreshInterval,
  });

  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([
    {
      id: '1',
      type: 'emergency',
      title: 'Critical Lab Values',
      message: 'Troponin levels critically elevated',
      patientName: 'John Smith',
      time: new Date(),
      priority: 'high',
    },
    {
      id: '2',
      type: 'allergy',
      title: 'Allergy Alert',
      message: 'Patient has severe penicillin allergy',
      patientName: 'Mary Johnson',
      time: new Date(),
      priority: 'high',
    },
  ]);

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const {
    buttonPress,
    successAction,
    criticalValue,
    emergencyAlert,
  } = useHapticFeedback();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    buttonPress();
    
    try {
      await refresh();
      setLastRefresh(new Date());
      successAction();
    } catch (error) {
      criticalValue();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, buttonPress, successAction, criticalValue]);

  const handleAlertAcknowledge = useCallback((alertId: string) => {
    setCriticalAlerts(prev => prev.filter(alert => alert.id !== alertId));
    successAction();
  }, [successAction]);

  const handleAlertDismiss = useCallback((alertId: string) => {
    setCriticalAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const stats = useMemo(() => {
    if (!data) return [];
    
    return [
      {
        title: 'Patients Today',
        value: data.stats.totalPatients.value.toLocaleString(),
        change: `${data.stats.totalPatients.change}%`,
        trend: data.stats.totalPatients.trend,
        icon: IconUsers,
        color: 'blue',
        showAlert: data.stats.totalPatients.value > 100,
        onClick: () => {
          // Navigate to patients
        },
      },
      {
        title: 'Active Orders',
        value: data.stats.activeOrders.value.toLocaleString(),
        change: `${data.stats.activeOrders.change}%`,
        trend: data.stats.activeOrders.trend,
        icon: IconStethoscope,
        color: 'green',
        showAlert: data.stats.activeOrders.value > 50,
        onClick: () => {
          // Navigate to orders
        },
      },
      {
        title: 'Pending Results',
        value: data.stats.pendingResults.value.toLocaleString(),
        change: `${data.stats.pendingResults.change}%`,
        trend: data.stats.pendingResults.trend,
        icon: IconTestPipe,
        color: 'orange',
        showAlert: data.stats.pendingResults.value > 20,
        onClick: () => {
          criticalValue();
          // Navigate to results
        },
      },
      {
        title: 'Medications',
        value: data.stats.medications.value.toLocaleString(),
        change: `${data.stats.medications.change}%`,
        trend: data.stats.medications.trend,
        icon: IconPill,
        color: 'purple',
        showAlert: false,
        onClick: () => {
          // Navigate to medications
        },
      },
    ];
  }, [data, criticalValue]);

  const quickActions = useMemo(() => [
    {
      label: 'Emergency Call',
      icon: IconPhone,
      color: 'red',
      action: () => {
        emergencyAlert();
        // Handle emergency call
      },
    },
    {
      label: 'Quick Note',
      icon: IconMessage,
      color: 'blue',
      action: () => {
        buttonPress();
        // Open quick note
      },
    },
    {
      label: 'View Schedule',
      icon: IconCalendar,
      color: 'green',
      action: () => {
        buttonPress();
        // View schedule
      },
    },
    {
      label: 'Lab Results',
      icon: IconTestPipe,
      color: 'orange',
      action: () => {
        buttonPress();
        // View lab results
      },
    },
  ], [emergencyAlert, buttonPress]);

  return (
    <Stack gap="md" className={className}>
      {/* Critical Alerts */}
      {criticalAlerts.map(alert => (
        <CriticalAlertBanner
          key={alert.id}
          alert={alert}
          onAcknowledge={handleAlertAcknowledge}
          onDismiss={handleAlertDismiss}
        />
      ))}

      {/* Header with refresh */}
      <Group justify="space-between" align="center">
        <Box>
          <Text size="lg" fw={600}>
            Welcome, {user?.firstName}
          </Text>
          <Text size="sm" c="dimmed">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </Text>
        </Box>
        
        <ActionIcon
          size="lg"
          variant="outline"
          onClick={handleRefresh}
          loading={refreshing}
          className="min-h-[44px] min-w-[44px]"
          aria-label="Refresh dashboard"
        >
          <IconRefresh size={20} />
        </ActionIcon>
      </Group>

      {/* Last refresh indicator */}
      <Text size="xs" c="dimmed" ta="center">
        Last updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
      </Text>

      {/* Error state */}
      {error && (
        <Alert
          icon={<IconExclamationCircle size={16} />}
          color="red"
          title="Error Loading Dashboard"
          withCloseButton
        >
          {error.message}
        </Alert>
      )}

      {/* Stats Grid */}
      <SimpleGrid cols={2} spacing="md">
        {stats.map((stat) => (
          <TouchableStatCard
            key={stat.title}
            {...stat}
            isLoading={isLoading}
          />
        ))}
      </SimpleGrid>

      {/* Quick Actions */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text fw={600} size="md" mb="md">
          Quick Actions
        </Text>
        
        <SimpleGrid cols={2} spacing="sm">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="light"
              color={action.color}
              size="lg"
              leftSection={<action.icon size={20} />}
              onClick={action.action}
              className="min-h-[56px]"
              fullWidth
            >
              {action.label}
            </Button>
          ))}
        </SimpleGrid>
      </Card>

      {/* Today's Schedule Preview */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600} size="md">
            Today's Schedule
          </Text>
          <IconCalendar size={20} className="text-gray-500" />
        </Group>

        <ScrollArea h={200}>
          {isLoading ? (
            <Stack gap="sm">
              {Array.from({ length: 3 }).map((_, index) => (
                <Paper key={index} p="sm" withBorder>
                  <Group>
                    <Skeleton height={40} width={40} circle />
                    <Box style={{ flex: 1 }}>
                      <Skeleton height={16} width="70%" mb={4} />
                      <Skeleton height={12} width="50%" />
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : data?.upcomingAppointments?.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No appointments scheduled for today
            </Text>
          ) : (
            <Stack gap="sm">
              {data?.upcomingAppointments?.slice(0, 5).map((appointment) => (
                <Paper
                  key={appointment.id}
                  p="sm"
                  withBorder
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => buttonPress()}
                >
                  <Group>
                    <Center
                      w={40}
                      h={40}
                      bg="blue.1"
                      style={{ borderRadius: '50%' }}
                    >
                      <IconCalendar size={20} className="text-blue-600" />
                    </Center>
                    
                    <Box style={{ flex: 1 }}>
                      <Text fw={500} size="sm">
                        {appointment.patientName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {format(appointment.time, 'h:mm a')} • {appointment.type}
                      </Text>
                    </Box>
                    
                    <Badge
                      size="xs"
                      color={appointment.status === 'confirmed' ? 'green' : 'yellow'}
                      variant="light"
                    >
                      {appointment.status}
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Card>

      {/* Performance Metrics */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text fw={600} size="md" mb="md">
          Performance Today
        </Text>
        
        <SimpleGrid cols={3} spacing="md">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Center key={index}>
                <Skeleton height={80} width={80} circle />
              </Center>
            ))
          ) : (
            <>
              <Center>
                <Stack align="center" gap="xs">
                  <RingProgress
                    size={80}
                    thickness={6}
                    sections={[{ value: data?.performanceMetrics.patientSatisfaction || 0, color: 'blue' }]}
                    label={
                      <Text size="xs" ta="center" fw={700}>
                        {data?.performanceMetrics.patientSatisfaction || 0}%
                      </Text>
                    }
                  />
                  <Text size="xs" ta="center" c="dimmed">
                    Satisfaction
                  </Text>
                </Stack>
              </Center>
              
              <Center>
                <Stack align="center" gap="xs">
                  <RingProgress
                    size={80}
                    thickness={6}
                    sections={[{ value: data?.performanceMetrics.onTimePerformance || 0, color: 'green' }]}
                    label={
                      <Text size="xs" ta="center" fw={700}>
                        {data?.performanceMetrics.onTimePerformance || 0}%
                      </Text>
                    }
                  />
                  <Text size="xs" ta="center" c="dimmed">
                    On-Time
                  </Text>
                </Stack>
              </Center>
              
              <Center>
                <Stack align="center" gap="xs">
                  <RingProgress
                    size={80}
                    thickness={6}
                    sections={[{ value: data?.performanceMetrics.resourceUtilization || 0, color: 'orange' }]}
                    label={
                      <Text size="xs" ta="center" fw={700}>
                        {data?.performanceMetrics.resourceUtilization || 0}%
                      </Text>
                    }
                  />
                  <Text size="xs" ta="center" c="dimmed">
                    Utilization
                  </Text>
                </Stack>
              </Center>
            </>
          )}
        </SimpleGrid>
      </Card>
    </Stack>
  );
}

export default MobileDashboard;