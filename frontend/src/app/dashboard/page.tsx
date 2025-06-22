'use client';

import { Grid, Card, Text, Group, Badge, Stack, SimpleGrid, Paper, Center, RingProgress } from '@mantine/core';
import { IconUsers, IconStethoscope, IconPill, IconTestPipe, IconChartLine, IconCalendar, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/stores/auth';

function DashboardContent() {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Total Patients',
      value: '2,847',
      change: '+12%',
      icon: IconUsers,
      color: 'blue',
    },
    {
      title: 'Active Orders',
      value: '156',
      change: '+5%',
      icon: IconStethoscope,
      color: 'green',
    },
    {
      title: 'Pending Results',
      value: '23',
      change: '-8%',
      icon: IconTestPipe,
      color: 'orange',
    },
    {
      title: 'Medications',
      value: '421',
      change: '+2%',
      icon: IconPill,
      color: 'purple',
    },
  ];

  const recentActivities = [
    {
      patient: 'John Doe',
      action: 'Lab results reviewed',
      time: '10 minutes ago',
      type: 'success',
    },
    {
      patient: 'Jane Smith',
      action: 'Prescription ordered',
      time: '25 minutes ago',
      type: 'info',
    },
    {
      patient: 'Bob Johnson',
      action: 'Appointment scheduled',
      time: '1 hour ago',
      type: 'info',
    },
    {
      patient: 'Alice Brown',
      action: 'Critical lab value',
      time: '2 hours ago',
      type: 'warning',
    },
  ];

  const upcomingAppointments = [
    {
      patient: 'Michael Davis',
      time: '9:00 AM',
      type: 'Follow-up',
      status: 'confirmed',
    },
    {
      patient: 'Sarah Wilson',
      time: '10:30 AM',
      type: 'Consultation',
      status: 'pending',
    },
    {
      patient: 'David Miller',
      time: '2:00 PM',
      type: 'Procedure',
      status: 'confirmed',
    },
  ];

  return (
    <AppLayout
      title={`Welcome back, ${user?.firstName}!`}
      subtitle="Here's what's happening with your patients today"
    >
      <Stack gap="xl">
        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {stats.map((stat) => (
            <Card key={stat.title} shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  {stat.title}
                </Text>
                <stat.icon size={20} className={`text-${stat.color}-500`} />
              </Group>
              
              <Text size="xl" fw={700} className="text-gray-800">
                {stat.value}
              </Text>
              
              <Badge
                color={stat.change.startsWith('+') ? 'green' : 'red'}
                variant="light"
                size="sm"
              >
                {stat.change} from last month
              </Badge>
            </Card>
          ))}
        </SimpleGrid>

        <Grid>
          {/* Today's Schedule */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  Today&apos;s Schedule
                </Text>
                <IconCalendar size={20} className="text-gray-500" />
              </Group>
              
              <Stack gap="md">
                {upcomingAppointments.map((appointment, index) => (
                  <Paper key={index} p="sm" className="bg-gray-50 rounded-lg">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={500} size="sm">
                          {appointment.patient}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {appointment.type}
                        </Text>
                      </div>
                      <div className="text-right">
                        <Text size="sm" fw={500}>
                          {appointment.time}
                        </Text>
                        <Badge
                          size="xs"
                          color={appointment.status === 'confirmed' ? 'green' : 'yellow'}
                          variant="light"
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Card>
          </Grid.Col>

          {/* Recent Activity */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  Recent Activity
                </Text>
                <IconChartLine size={20} className="text-gray-500" />
              </Group>
              
              <Stack gap="md">
                {recentActivities.map((activity, index) => (
                  <Group key={index} gap="sm">
                    <div className={`p-1 rounded-full ${
                      activity.type === 'success' ? 'bg-green-100' :
                      activity.type === 'warning' ? 'bg-yellow-100' :
                      'bg-blue-100'
                    }`}>
                      {activity.type === 'success' && <IconCheck size={14} className="text-green-600" />}
                      {activity.type === 'warning' && <IconAlertTriangle size={14} className="text-yellow-600" />}
                      {activity.type === 'info' && <IconStethoscope size={14} className="text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <Text size="sm" fw={500}>
                        {activity.patient}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {activity.action}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed">
                      {activity.time}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Grid.Col>

          {/* Quick Actions */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Text fw={600} size="lg" mb="md">
                Quick Actions
              </Text>
              
              <Stack gap="sm">
                <Paper p="md" className="bg-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors">
                  <Group gap="sm">
                    <IconUsers size={16} className="text-primary" />
                    <Text size="sm" fw={500}>
                      Add New Patient
                    </Text>
                  </Group>
                </Paper>
                
                <Paper p="md" className="bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
                  <Group gap="sm">
                    <IconPill size={16} className="text-green-600" />
                    <Text size="sm" fw={500}>
                      Create Prescription
                    </Text>
                  </Group>
                </Paper>
                
                <Paper p="md" className="bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                  <Group gap="sm">
                    <IconTestPipe size={16} className="text-orange-600" />
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
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Text fw={600} size="lg" mb="md">
                Performance Metrics
              </Text>
              
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
                <div className="text-center">
                  <RingProgress
                    size={120}
                    thickness={8}
                    sections={[{ value: 85, color: 'blue' }]}
                    label={
                      <Center>
                        <Text c="blue" fw={700} size="xl">
                          85%
                        </Text>
                      </Center>
                    }
                  />
                  <Text size="sm" fw={500} mt="sm">
                    Patient Satisfaction
                  </Text>
                </div>
                
                <div className="text-center">
                  <RingProgress
                    size={120}
                    thickness={8}
                    sections={[{ value: 92, color: 'green' }]}
                    label={
                      <Center>
                        <Text c="green" fw={700} size="xl">
                          92%
                        </Text>
                      </Center>
                    }
                  />
                  <Text size="sm" fw={500} mt="sm">
                    On-Time Performance
                  </Text>
                </div>
                
                <div className="text-center">
                  <RingProgress
                    size={120}
                    thickness={8}
                    sections={[{ value: 78, color: 'orange' }]}
                    label={
                      <Center>
                        <Text c="orange" fw={700} size="xl">
                          78%
                        </Text>
                      </Center>
                    }
                  />
                  <Text size="sm" fw={500} mt="sm">
                    Resource Utilization
                  </Text>
                </div>
              </SimpleGrid>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </AppLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <DashboardContent />
    </ProtectedRoute>
  );
}