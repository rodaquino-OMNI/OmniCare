'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Grid, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  SimpleGrid, 
  UnstyledButton,
  Paper,
  Alert,
  LoadingOverlay,
  Button,
  ActionIcon
} from '@mantine/core';
import { 
  IconUsers, 
  IconCalendar, 
  IconCurrencyDollar, 
  IconFileText,
  IconSettings,
  IconClipboardList,
  IconBuilding,
  IconChartBar,
  IconUsersGroup,
  IconMessage,
  IconAlertTriangle
} from '@tabler/icons-react';
import { DashboardMetrics, SystemAlert } from '@/types/administrative';
import { useAuth } from '@/stores/auth';

interface AdminDashboardProps {
  userRole: string;
  userName: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userRole, userName }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call to fetch dashboard metrics
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Mock data - replace with actual API call
        const mockMetrics: DashboardMetrics = {
          patientsRegisteredToday: 12,
          appointmentsToday: 89,
          pendingClaims: 45,
          overdueDocuments: 8,
          systemAlerts: [
            {
              id: '1',
              type: 'System',
              severity: 'High',
              title: 'Server Performance',
              message: 'High CPU usage detected on database server',
              triggeredAt: new Date(),
              status: 'Active'
            },
            {
              id: '2',
              type: 'Compliance',
              severity: 'Medium',
              title: 'Documentation Overdue',
              message: '5 clinical notes require completion within 24 hours',
              triggeredAt: new Date(),
              status: 'Active'
            }
          ],
          revenueThisMonth: 248750.50,
          patientSatisfactionScore: 4.2,
          averageWaitTime: 18
        };
        
        setMetrics(mockMetrics);
      } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const adminModules = [
    {
      id: 'patient-registration',
      name: 'Patient Registration',
      description: 'Manage patient onboarding and demographics',
      icon: IconUsers,
      color: 'blue',
      permissions: ['Front Desk Staff', 'Administrative Staff', 'Department Manager']
    },
    {
      id: 'appointment-management',
      name: 'Appointment Management',
      description: 'Schedule and manage patient appointments',
      icon: IconCalendar,
      color: 'green',
      permissions: ['Administrative Staff', 'Front Desk Staff', 'Department Manager']
    },
    {
      id: 'billing-revenue',
      name: 'Billing & Revenue Cycle',
      description: 'Process claims and manage revenue cycle',
      icon: IconCurrencyDollar,
      color: 'yellow',
      permissions: ['Billing Staff', 'Medical Coder', 'Financial Counselor', 'Department Manager']
    },
    {
      id: 'document-management',
      name: 'Document Management',
      description: 'Handle document scanning and release of information',
      icon: IconFileText,
      color: 'violet',
      permissions: ['HIM Staff', 'Administrative Staff', 'Department Manager']
    },
    {
      id: 'system-admin',
      name: 'System Administration',
      description: 'Manage users, permissions, and system settings',
      icon: IconSettings,
      color: 'gray',
      permissions: ['System Administrator', 'Security Administrator']
    },
    {
      id: 'inventory-supplies',
      name: 'Inventory & Supplies',
      description: 'Track and manage medical supplies and equipment',
      icon: IconClipboardList,
      color: 'indigo',
      permissions: ['Administrative Staff', 'Department Manager']
    },
    {
      id: 'facility-security',
      name: 'Facility & Security',
      description: 'Manage facility operations and security',
      icon: IconBuilding,
      color: 'red',
      permissions: ['Security Administrator', 'Department Manager']
    },
    {
      id: 'reporting-analytics',
      name: 'Reporting & Analytics',
      description: 'Generate operational and compliance reports',
      icon: IconChartBar,
      color: 'teal',
      permissions: ['Department Manager', 'Compliance Officer', 'Quality Manager']
    },
    {
      id: 'staff-management',
      name: 'Staff Management',
      description: 'Manage staff schedules and performance',
      icon: IconUsersGroup,
      color: 'orange',
      permissions: ['Department Manager', 'System Administrator']
    },
    {
      id: 'patient-experience',
      name: 'Patient Experience',
      description: 'Track feedback and manage communications',
      icon: IconMessage,
      color: 'pink',
      permissions: ['Administrative Staff', 'Department Manager']
    }
  ];

  const getAccessibleModules = () => {
    return adminModules.filter(module => 
      module.permissions.includes(userRole) || userRole === 'System Administrator'
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'red';
      case 'High': return 'orange';
      case 'Medium': return 'yellow';
      case 'Low': return 'blue';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: 400 }}>
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  return (
    <Stack gap="xl">
      {/* Header */}
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>OmniCare EMR - Administrative Dashboard</Text>
            <Text c="dimmed">Welcome back, {userName} ({userRole})</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* Key Metrics */}
      {metrics && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Patients Registered Today
              </Text>
              <IconUsers size={20} className="text-gray-400" />
            </Group>
            <Text size="lg" fw={700}>
              {metrics.patientsRegisteredToday}
            </Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Appointments Today
              </Text>
              <IconCalendar size={20} className="text-gray-400" />
            </Group>
            <Text size="lg" fw={700}>
              {metrics.appointmentsToday}
            </Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Revenue This Month
              </Text>
              <IconCurrencyDollar size={20} className="text-gray-400" />
            </Group>
            <Text size="lg" fw={700}>
              ${metrics.revenueThisMonth.toLocaleString()}
            </Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Pending Claims
              </Text>
              <IconFileText size={20} className="text-gray-400" />
            </Group>
            <Text size="lg" fw={700}>
              {metrics.pendingClaims}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* System Alerts */}
      {metrics?.systemAlerts && metrics.systemAlerts.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text size="lg" fw={600} mb="md">
            System Alerts
          </Text>
          <Stack gap="sm">
            {metrics.systemAlerts.map((alert) => (
              <Alert
                key={alert.id}
                icon={<IconAlertTriangle size={16} />}
                title={alert.title}
                color={getSeverityColor(alert.severity)}
              >
                <Group justify="space-between">
                  <Text size="sm">{alert.message}</Text>
                  <Badge color={getSeverityColor(alert.severity)} size="sm">
                    {alert.severity}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  {alert.triggeredAt.toLocaleString()}
                </Text>
              </Alert>
            ))}
          </Stack>
        </Card>
      )}

      {/* Administrative Modules */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text size="lg" fw={600} mb="md">
          Administrative Modules
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {getAccessibleModules().map((module) => {
            const IconComponent = module.icon;
            return (
              <UnstyledButton
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className="w-full"
              >
                <Card shadow="sm" padding="md" radius="md" withBorder className="hover:shadow-md transition-shadow">
                  <Group gap="sm">
                    <ActionIcon color={module.color} variant="light" size="lg">
                      <IconComponent size={20} />
                    </ActionIcon>
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>
                        {module.name}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {module.description}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </UnstyledButton>
            );
          })}
        </SimpleGrid>
      </Card>

      {/* Quick Actions & Performance Metrics */}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Quick Actions
            </Text>
            <Stack gap="sm">
              <Button variant="light" leftSection={<IconUsers size={16} />} fullWidth>
                Register New Patient
              </Button>
              <Button variant="light" leftSection={<IconCalendar size={16} />} fullWidth>
                Schedule Appointment
              </Button>
              <Button variant="light" leftSection={<IconCurrencyDollar size={16} />} fullWidth>
                Process Billing
              </Button>
              <Button variant="light" leftSection={<IconChartBar size={16} />} fullWidth>
                Generate Report
              </Button>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Performance Metrics
            </Text>
            {metrics && (
              <Stack gap="md">
                <div>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Patient Satisfaction</Text>
                    <Text size="sm" fw={500}>{metrics.patientSatisfactionScore}/5.0</Text>
                  </Group>
                </div>
                
                <div>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Average Wait Time</Text>
                    <Text size="sm" fw={500}>{metrics.averageWaitTime} min</Text>
                  </Group>
                </div>

                <div>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Claims Processing</Text>
                    <Text size="sm" fw={500}>92% Success Rate</Text>
                  </Group>
                </div>
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
};

export default AdminDashboard;