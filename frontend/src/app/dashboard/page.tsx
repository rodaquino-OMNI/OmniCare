'use client';

import { useEffect } from 'react';
import { 
  Grid, 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  SimpleGrid, 
  Paper, 
  Center, 
  RingProgress, 
  Skeleton, 
  Alert,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconUsers, 
  IconStethoscope, 
  IconPill, 
  IconTestPipe, 
  IconChartLine, 
  IconCalendar, 
  IconAlertTriangle, 
  IconCheck,
  IconRefresh,
  IconExclamationCircle
} from '@tabler/icons-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { ClientOnly } from '@/components/ClientOnly';
import { useAuth, initializeAuthStore } from '@/stores/auth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatDistanceToNow, format } from 'date-fns';
import { LazyPerformanceMonitor } from '@/components/lazy/LazyComponents';

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

function DashboardContent() {
  const { user } = useAuth();
  const { data, isLoading, isRefreshing, error, refresh, lastUpdated } = useDashboardData({
    autoRefresh: true,
    refreshInterval: 60 // Refresh every 60 seconds
  });
  
  // Announce data updates to screen readers
  const announceUpdate = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 2000);
  };

  useEffect(() => {
    // Initialize auth store on client-side mount
    initializeAuthStore();
  }, []);

  const formatTimeAgo = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const formatAppointmentTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const stats = data ? [
    {
      title: 'Total Patients',
      value: data.stats.totalPatients.value.toLocaleString(),
      change: `${data.stats.totalPatients.trend === 'up' ? '+' : data.stats.totalPatients.trend === 'down' ? '-' : ''}${data.stats.totalPatients.change}%`,
      icon: IconUsers,
      color: 'blue',
      trend: data.stats.totalPatients.trend,
    },
    {
      title: 'Active Orders',
      value: data.stats.activeOrders.value.toLocaleString(),
      change: `${data.stats.activeOrders.trend === 'up' ? '+' : data.stats.activeOrders.trend === 'down' ? '-' : ''}${data.stats.activeOrders.change}%`,
      icon: IconStethoscope,
      color: 'green',
      trend: data.stats.activeOrders.trend,
    },
    {
      title: 'Pending Results',
      value: data.stats.pendingResults.value.toLocaleString(),
      change: `${data.stats.pendingResults.trend === 'up' ? '+' : data.stats.pendingResults.trend === 'down' ? '-' : ''}${data.stats.pendingResults.change}%`,
      icon: IconTestPipe,
      color: 'orange',
      trend: data.stats.pendingResults.trend,
    },
    {
      title: 'Medications',
      value: data.stats.medications.value.toLocaleString(),
      change: `${data.stats.medications.trend === 'up' ? '+' : data.stats.medications.trend === 'down' ? '-' : ''}${data.stats.medications.change}%`,
      icon: IconPill,
      color: 'purple',
      trend: data.stats.medications.trend,
    },
  ] : [];

  return (
    <AppLayout
      title={`Welcome back, ${user?.firstName}!`}
      subtitle="Here's what's happening with your patients today"
    >
      <main role="main" id="main-content" aria-label="Dashboard content">
        <Stack gap="xl">
        {/* Auto-refresh indicator */}
        {lastUpdated && (
          <Group justify="space-between" role="region" aria-labelledby="refresh-status">
            <Text size="sm" c="dimmed" id="refresh-status">
              Last updated {formatTimeAgo(lastUpdated)}
            </Text>
            <Tooltip label="Refresh dashboard">
              <ActionIcon 
                variant="subtle" 
                onClick={() => {
                  refresh();
                  announceUpdate('Dashboard data refreshing');
                }} 
                loading={isRefreshing}
                disabled={isLoading}
                aria-label="Refresh dashboard data"
                aria-describedby="refresh-help"
              >
                <IconRefresh size={16} aria-hidden="true" />
              </ActionIcon>
            </Tooltip>
            <div id="refresh-help" className="sr-only">
              Click to manually refresh all dashboard data
            </div>
          </Group>
        )}

        {/* Error Alert */}
        {error && (
          <Alert 
            icon={<IconExclamationCircle size={16} aria-hidden="true" />} 
            title="Error loading dashboard" 
            color="red"
            withCloseButton
            onClose={() => {}}
            role="alert"
            aria-live="assertive"
          >
            {error.message}
          </Alert>
        )}

        {/* Stats Cards */}
        <SimpleGrid 
          cols={{ base: 1, sm: 2, lg: 4 }} 
          spacing="md"
          role="region"
          aria-labelledby="stats-heading"
        >
          <h2 id="stats-heading" className="sr-only">Dashboard Statistics</h2>
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 4 }).map((_, index) => (
              <Card 
                key={index} 
                shadow="sm" 
                padding="lg" 
                radius="md" 
                withBorder
                role="article"
                aria-label="Loading statistics"
              >
                <Group justify="space-between" mb="xs">
                  <Skeleton height={16} width={100} aria-label="Loading statistic title" />
                  <Skeleton height={20} width={20} circle aria-label="Loading icon" />
                </Group>
                <Skeleton height={28} width={80} mt="md" mb="md" aria-label="Loading value" />
                <Skeleton height={20} width={120} aria-label="Loading trend" />
              </Card>
            ))
          ) : (
            stats.map((stat) => (
              <Card 
                key={stat.title} 
                shadow="sm" 
                padding="lg" 
                radius="md" 
                withBorder
                role="article"
                aria-labelledby={`stat-${stat.title.replace(/\s+/g, '-').toLowerCase()}`}
                aria-describedby={`trend-${stat.title.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <Group justify="space-between" mb="xs">
                  <Text 
                    size="sm" 
                    c="dimmed" 
                    fw={500}
                    id={`stat-${stat.title.replace(/\s+/g, '-').toLowerCase()}`}
                    component="h3"
                  >
                    {stat.title}
                  </Text>
                  <stat.icon 
                    size={20} 
                    className={
                      stat.color === 'blue' ? 'text-blue-500' :
                      stat.color === 'green' ? 'text-green-500' :
                      stat.color === 'orange' ? 'text-orange-500' :
                      stat.color === 'purple' ? 'text-purple-500' :
                      'text-gray-500'
                    }
                    aria-hidden="true"
                  />
                </Group>
                
                <Text 
                  size="xl" 
                  fw={700} 
                  className="text-gray-800"
                  aria-label={`${stat.title}: ${stat.value}`}
                >
                  {stat.value}
                </Text>
                
                <Badge
                  color={stat.trend === 'up' ? 'green' : stat.trend === 'down' ? 'red' : 'gray'}
                  variant="light"
                  size="sm"
                  id={`trend-${stat.title.replace(/\s+/g, '-').toLowerCase()}`}
                  aria-label={`Trend: ${stat.change} from last month, ${stat.trend === 'up' ? 'increasing' : stat.trend === 'down' ? 'decreasing' : 'stable'}`}
                >
                  {stat.change} from last month
                </Badge>
              </Card>
            ))
          )}
        </SimpleGrid>

        <Grid role="region" aria-labelledby="dashboard-sections">
          <h2 id="dashboard-sections" className="sr-only">Dashboard Sections</h2>
          {/* Today's Schedule */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card 
              shadow="sm" 
              padding="lg" 
              radius="md" 
              withBorder 
              h="100%"
              role="region"
              aria-labelledby="schedule-heading"
            >
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg" id="schedule-heading" component="h3">
                  Today&apos;s Schedule
                </Text>
                <IconCalendar size={20} className="text-gray-500" aria-hidden="true" />
              </Group>
              
              <Stack gap="md">
                {isLoading ? (
                  // Loading skeletons
                  <div role="status" aria-label="Loading today's appointments">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Paper key={index} p="sm" className="bg-gray-50 rounded-lg">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Skeleton height={16} width={120} mb="xs" aria-label="Loading patient name" />
                            <Skeleton height={14} width={80} aria-label="Loading appointment type" />
                          </div>
                          <div className="text-right">
                            <Skeleton height={16} width={60} mb="xs" aria-label="Loading appointment time" />
                            <Skeleton height={20} width={70} aria-label="Loading appointment status" />
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </div>
                ) : data?.upcomingAppointments.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="md" role="status">
                    No appointments scheduled for today
                  </Text>
                ) : (
                  <div role="list" aria-label="Today's appointments">
                    {data?.upcomingAppointments.map((appointment) => (
                      <Paper 
                        key={appointment.id} 
                        p="sm" 
                        className="bg-gray-50 rounded-lg"
                        role="listitem"
                        aria-label={`Appointment with ${appointment.patientName} at ${formatAppointmentTime(appointment.time)}`}
                      >
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={500} size="sm">
                              {appointment.patientName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {appointment.type}
                            </Text>
                          </div>
                          <div className="text-right">
                            <Text size="sm" fw={500}>
                              {formatAppointmentTime(appointment.time)}
                            </Text>
                            <Badge
                              size="xs"
                              color={appointment.status === 'confirmed' ? 'green' : 'yellow'}
                              variant="light"
                              aria-label={`Status: ${appointment.status}`}
                            >
                              {appointment.status}
                            </Badge>
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </div>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          {/* Recent Activity */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card 
              shadow="sm" 
              padding="lg" 
              radius="md" 
              withBorder 
              h="100%"
              role="region"
              aria-labelledby="activity-heading"
            >
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg" id="activity-heading" component="h3">
                  Recent Activity
                </Text>
                <IconChartLine size={20} className="text-gray-500" aria-hidden="true" />
              </Group>
              
              <Stack gap="md">
                {isLoading ? (
                  // Loading skeletons
                  <div role="status" aria-label="Loading recent activities">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Group key={index} gap="sm">
                        <Skeleton height={24} width={24} circle aria-label="Loading activity icon" />
                        <div className="flex-1">
                          <Skeleton height={16} width={120} mb="xs" aria-label="Loading patient name" />
                          <Skeleton height={14} width={180} aria-label="Loading activity description" />
                        </div>
                        <Skeleton height={14} width={60} aria-label="Loading activity time" />
                      </Group>
                    ))}
                  </div>
                ) : data?.recentActivities.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="md" role="status">
                    No recent activity
                  </Text>
                ) : (
                  <div role="list" aria-label="Recent clinical activities">
                    {data?.recentActivities.map((activity) => (
                      <Group 
                        key={activity.id} 
                        gap="sm"
                        role="listitem"
                        aria-label={`${activity.type} activity for ${activity.patientName}: ${activity.action}, ${formatTimeAgo(activity.time)}`}
                      >
                        <div className={`p-1 rounded-full ${
                          activity.type === 'success' ? 'bg-green-100' :
                          activity.type === 'warning' ? 'bg-yellow-100' :
                          activity.type === 'error' ? 'bg-red-100' :
                          'bg-blue-100'
                        }`}>
                          {activity.type === 'success' && <IconCheck size={14} className="text-green-600" aria-hidden="true" />}
                          {activity.type === 'warning' && <IconAlertTriangle size={14} className="text-yellow-600" aria-hidden="true" />}
                          {activity.type === 'error' && <IconExclamationCircle size={14} className="text-red-600" aria-hidden="true" />}
                          {activity.type === 'info' && <IconStethoscope size={14} className="text-blue-600" aria-hidden="true" />}
                        </div>
                        <div className="flex-1">
                          <Text size="sm" fw={500}>
                            {activity.patientName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {activity.action}
                          </Text>
                        </div>
                        <Text size="xs" c="dimmed">
                          {formatTimeAgo(activity.time)}
                        </Text>
                      </Group>
                    ))}
                  </div>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          {/* Quick Actions */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card 
              shadow="sm" 
              padding="lg" 
              radius="md" 
              withBorder 
              h="100%"
              role="region"
              aria-labelledby="quick-actions-heading"
            >
              <Text fw={600} size="lg" mb="md" id="quick-actions-heading" component="h3">
                Quick Actions
              </Text>
              
              <Stack gap="sm" role="list" aria-label="Quick action buttons">
                <Paper 
                  p="md" 
                  className="bg-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                  role="listitem button"
                  tabIndex={0}
                  aria-label="Add new patient to the system"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      // Handle add patient action
                    }
                  }}
                >
                  <Group gap="sm">
                    <IconUsers size={16} className="text-primary" aria-hidden="true" />
                    <Text size="sm" fw={500}>
                      Add New Patient
                    </Text>
                  </Group>
                </Paper>
                
                <Paper 
                  p="md" 
                  className="bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                  role="listitem button"
                  tabIndex={0}
                  aria-label="Create new prescription for patient"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      // Handle create prescription action
                    }
                  }}
                >
                  <Group gap="sm">
                    <IconPill size={16} className="text-green-600" aria-hidden="true" />
                    <Text size="sm" fw={500}>
                      Create Prescription
                    </Text>
                  </Group>
                </Paper>
                
                <Paper 
                  p="md" 
                  className="bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                  role="listitem button"
                  tabIndex={0}
                  aria-label="Order laboratory tests for patient"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      // Handle order lab tests action
                    }
                  }}
                >
                  <Group gap="sm">
                    <IconTestPipe size={16} className="text-orange-600" aria-hidden="true" />
                    <Text size="sm" fw={500}>
                      Order Lab Tests
                    </Text>
                  </Group>
                </Paper>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Performance Metrics */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card 
              shadow="sm" 
              padding="lg" 
              radius="md" 
              withBorder 
              h="100%"
              role="region"
              aria-labelledby="performance-heading"
            >
              <Text fw={600} size="lg" mb="md" id="performance-heading" component="h3">
                Performance Metrics
              </Text>
              
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
                {isLoading ? (
                  // Loading skeletons
                  <div role="status" aria-label="Loading performance metrics">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="text-center">
                        <Center>
                          <Skeleton height={120} width={120} circle aria-label="Loading performance chart" />
                        </Center>
                        <Skeleton height={16} width={140} mt="sm" mx="auto" aria-label="Loading metric name" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="text-center" role="img" aria-labelledby="satisfaction-label" aria-describedby="satisfaction-value">
                      <RingProgress
                        size={120}
                        thickness={8}
                        sections={[{ value: data?.performanceMetrics.patientSatisfaction || 0, color: 'blue' }]}
                        label={
                          <Center>
                            <Text c="blue" fw={700} size="xl" id="satisfaction-value">
                              {data?.performanceMetrics.patientSatisfaction || 0}%
                            </Text>
                          </Center>
                        }
                        aria-label={`Patient satisfaction: ${data?.performanceMetrics.patientSatisfaction || 0} percent`}
                      />
                      <Text size="sm" fw={500} mt="sm" id="satisfaction-label">
                        Patient Satisfaction
                      </Text>
                    </div>
                    
                    <div className="text-center" role="img" aria-labelledby="ontime-label" aria-describedby="ontime-value">
                      <RingProgress
                        size={120}
                        thickness={8}
                        sections={[{ value: data?.performanceMetrics.onTimePerformance || 0, color: 'green' }]}
                        label={
                          <Center>
                            <Text c="green" fw={700} size="xl" id="ontime-value">
                              {data?.performanceMetrics.onTimePerformance || 0}%
                            </Text>
                          </Center>
                        }
                        aria-label={`On-time performance: ${data?.performanceMetrics.onTimePerformance || 0} percent`}
                      />
                      <Text size="sm" fw={500} mt="sm" id="ontime-label">
                        On-Time Performance
                      </Text>
                    </div>
                    
                    <div className="text-center" role="img" aria-labelledby="resource-label" aria-describedby="resource-value">
                      <RingProgress
                        size={120}
                        thickness={8}
                        sections={[{ value: data?.performanceMetrics.resourceUtilization || 0, color: 'orange' }]}
                        label={
                          <Center>
                            <Text c="orange" fw={700} size="xl" id="resource-value">
                              {data?.performanceMetrics.resourceUtilization || 0}%
                            </Text>
                          </Center>
                        }
                        aria-label={`Resource utilization: ${data?.performanceMetrics.resourceUtilization || 0} percent`}
                      />
                      <Text size="sm" fw={500} mt="sm" id="resource-label">
                        Resource Utilization
                      </Text>
                    </div>
                  </>
                )}
              </SimpleGrid>
            </Card>
          </Grid.Col>
        </Grid>
        </Stack>
      </main>
      
      {/* Performance Monitor (Development and Performance tracking) */}
      <LazyPerformanceMonitor />
    </AppLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <ClientOnly fallback={<div>Loading...</div>}>
        <DashboardContent />
      </ClientOnly>
    </ProtectedRoute>
  );
}