'use client';

import { useState, useEffect } from 'react';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Button,
  ActionIcon,
  Tabs,
  SimpleGrid,
  Paper,
  Progress,
  Skeleton,
  RingProgress,
  Center,
  Alert,
  Table,
  ScrollArea,
  Indicator
} from '@mantine/core';
import {
  IconCalendar,
  IconCurrency,
  IconUsers,
  IconClipboardList,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconDollarSign,
  IconFileText,
  IconUser,
  IconBuilding,
  IconPhone,
  IconMail,
  IconArrowRight,
  IconPlus,
  IconEdit,
  IconEye,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconCreditCard,
  IconReceipt
} from '@tabler/icons-react';
import { formatDateTime, formatDate } from '@/utils';
import { useAuth } from '@/stores/auth';

interface AdministrativePanelProps {
  patientId?: string;
  onNavigate?: (section: string, data?: any) => void;
  isMaximized?: boolean;
}

interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  type: string;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  startTime: Date;
  duration: number;
  provider: string;
  location: string;
}

interface BillingItem {
  id: string;
  patientName: string;
  patientId: string;
  serviceDate: Date;
  services: string[];
  amount: number;
  status: 'pending' | 'submitted' | 'paid' | 'denied' | 'overdue';
  insuranceProvider?: string;
  dueDate?: Date;
}

interface Registration {
  id: string;
  patientName: string;
  status: 'pending' | 'in-progress' | 'completed';
  type: 'new' | 'update' | 'insurance-change';
  timestamp: Date;
  assignedTo?: string;
  priority: 'routine' | 'urgent';
}

interface Metric {
  label: string;
  value: number;
  unit: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
}

export function AdministrativePanel({ 
  patientId, 
  onNavigate, 
  isMaximized = false 
}: AdministrativePanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('appointments');
  const { user, hasAnyRole } = useAuth();
  
  // Mock administrative data
  const [todayAppointments] = useState<Appointment[]>([
    {
      id: '1',
      patientName: 'John Smith',
      patientId: 'P001',
      type: 'Follow-up',
      status: 'confirmed',
      startTime: new Date(Date.now() + 3600000), // 1 hour from now
      duration: 30,
      provider: 'Dr. Johnson',
      location: 'Room 101'
    },
    {
      id: '2',
      patientName: 'Sarah Wilson',
      patientId: 'P002',
      type: 'Consultation',
      status: 'in-progress',
      startTime: new Date(Date.now() - 1800000), // 30 minutes ago
      duration: 45,
      provider: 'Dr. Chen',
      location: 'Room 203'
    },
    {
      id: '3',
      patientName: 'Michael Brown',
      patientId: 'P003',
      type: 'Physical',
      status: 'scheduled',
      startTime: new Date(Date.now() + 7200000), // 2 hours from now
      duration: 60,
      provider: 'Dr. Martinez',
      location: 'Room 105'
    }
  ]);

  const [billingItems] = useState<BillingItem[]>([
    {
      id: '1',
      patientName: 'Alice Johnson',
      patientId: 'P004',
      serviceDate: new Date(Date.now() - 86400000),
      services: ['Office Visit', 'Lab Work'],
      amount: 350.00,
      status: 'pending',
      insuranceProvider: 'Blue Cross',
      dueDate: new Date(Date.now() + 2592000000) // 30 days
    },
    {
      id: '2',
      patientName: 'Robert Davis',
      patientId: 'P005',
      serviceDate: new Date(Date.now() - 172800000),
      services: ['Consultation', 'X-Ray'],
      amount: 275.00,
      status: 'submitted',
      insuranceProvider: 'Aetna'
    },
    {
      id: '3',
      patientName: 'Emily Chen',
      patientId: 'P006',
      serviceDate: new Date(Date.now() - 604800000),
      services: ['Physical Exam'],
      amount: 150.00,
      status: 'overdue',
      dueDate: new Date(Date.now() - 86400000)
    }
  ]);

  const [registrations] = useState<Registration[]>([
    {
      id: '1',
      patientName: 'David Wilson',
      status: 'pending',
      type: 'new',
      timestamp: new Date(Date.now() - 1800000),
      priority: 'routine'
    },
    {
      id: '2',
      patientName: 'Lisa Anderson',
      status: 'in-progress',
      type: 'insurance-change',
      timestamp: new Date(Date.now() - 3600000),
      assignedTo: 'Jane Smith',
      priority: 'urgent'
    },
    {
      id: '3',
      patientName: 'Mark Thompson',
      status: 'completed',
      type: 'update',
      timestamp: new Date(Date.now() - 7200000),
      assignedTo: 'John Doe',
      priority: 'routine'
    }
  ]);

  const [metrics] = useState<Metric[]>([
    {
      label: 'Daily Revenue',
      value: 12500,
      unit: '$',
      change: 8.5,
      trend: 'up',
      color: 'green'
    },
    {
      label: 'Patient Volume',
      value: 47,
      unit: 'patients',
      change: -2.3,
      trend: 'down',
      color: 'orange'
    },
    {
      label: 'No-Show Rate',
      value: 12,
      unit: '%',
      change: -1.5,
      trend: 'down',
      color: 'green'
    },
    {
      label: 'Collection Rate',
      value: 94,
      unit: '%',
      change: 2.1,
      trend: 'up',
      color: 'blue'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
      case 'paid': return 'green';
      case 'in-progress':
      case 'submitted': return 'blue';
      case 'scheduled':
      case 'pending': return 'orange';
      case 'cancelled':
      case 'denied':
      case 'overdue': return 'red';
      case 'no-show': return 'gray';
      default: return 'gray';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <IconTrendingUp size={14} className="text-green-500" />;
      case 'down': return <IconTrendingDown size={14} className="text-red-500" />;
      default: return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Role-based content filtering
  const canViewBilling = hasAnyRole(['admin', 'billing']);
  const canViewRegistration = hasAnyRole(['admin', 'receptionist']);
  const canViewScheduling = hasAnyRole(['admin', 'receptionist', 'physician', 'nurse']);

  if (!hasAnyRole(['admin', 'billing', 'receptionist'])) {
    return (
      <Stack align="center" justify="center" h="100%">
        <IconBuilding size={48} className="text-gray-400" />
        <Text c="dimmed" ta="center">
          Administrative access required
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md" h="100%">
      {/* Administrative Metrics */}
      <SimpleGrid cols={isMaximized ? 4 : 2} spacing="xs">
        {metrics.slice(0, isMaximized ? 4 : 2).map((metric, index) => (
          <Paper key={index} p="xs" withBorder className="text-center">
            <Group justify="center" gap="xs">
              <Text size="lg" fw={700} className={`text-${metric.color}-600`}>
                {metric.unit === '$' ? formatCurrency(metric.value) : `${metric.value}${metric.unit === '%' ? '%' : ''}`}
              </Text>
              {getTrendIcon(metric.trend)}
            </Group>
            <Text size="xs" c="dimmed">
              {metric.label}
            </Text>
            <Text size="xs" className={metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
              {metric.change > 0 ? '+' : ''}{metric.change}%
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      {/* Quick Actions */}
      <SimpleGrid cols={isMaximized ? 4 : 2} spacing="xs">
        {canViewScheduling && (
          <Button
            variant="light"
            leftSection={<IconCalendar size={16} />}
            onClick={() => onNavigate?.('scheduling', { action: 'create' })}
            size="xs"
          >
            Schedule
          </Button>
        )}
        
        {canViewRegistration && (
          <Button
            variant="light"
            color="green"
            leftSection={<IconUser size={16} />}
            onClick={() => onNavigate?.('registration', { action: 'new' })}
            size="xs"
          >
            Register
          </Button>
        )}
        
        {canViewBilling && (
          <>
            <Button
              variant="light"
              color="orange"
              leftSection={<IconCurrency size={16} />}
              onClick={() => onNavigate?.('billing', { action: 'create' })}
              size="xs"
            >
              Billing
            </Button>
            
            {isMaximized && (
              <Button
                variant="light"
                color="purple"
                leftSection={<IconFileText size={16} />}
                onClick={() => onNavigate?.('reports', { type: 'administrative' })}
                size="xs"
              >
                Reports
              </Button>
            )}
          </>
        )}
      </SimpleGrid>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} flex={1}>
        <Tabs.List grow={!isMaximized}>
          {canViewScheduling && (
            <Tabs.Tab value="appointments" leftSection={<IconCalendar size={14} />}>
              Schedule
            </Tabs.Tab>
          )}
          {canViewBilling && (
            <Tabs.Tab value="billing" leftSection={<IconCurrency size={14} />}>
              Billing
            </Tabs.Tab>
          )}
          {canViewRegistration && isMaximized && (
            <>
              <Tabs.Tab value="registration" leftSection={<IconUsers size={14} />}>
                Registration
              </Tabs.Tab>
              <Tabs.Tab value="metrics" leftSection={<IconTrendingUp size={14} />}>
                Metrics
              </Tabs.Tab>
            </>
          )}
        </Tabs.List>

        {canViewScheduling && (
          <Tabs.Panel value="appointments" pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={500} size="sm">Today's Schedule</Text>
                <Button 
                  size="xs" 
                  leftSection={<IconPlus size={12} />}
                  onClick={() => onNavigate?.('scheduling', { action: 'create' })}
                >
                  Add Appointment
                </Button>
              </Group>
              
              <ScrollArea h={isMaximized ? 350 : 200}>
                <Stack gap="xs">
                  {todayAppointments.map((appointment) => (
                    <Card key={appointment.id} withBorder>
                      <Group justify="space-between" align="flex-start">
                        <Group gap="md">
                          <div className={`p-2 rounded-lg ${
                            appointment.status === 'confirmed' ? 'bg-green-100' :
                            appointment.status === 'in-progress' ? 'bg-blue-100' :
                            appointment.status === 'scheduled' ? 'bg-orange-100' :
                            'bg-gray-100'
                          }`}>
                            <IconUser size={16} />
                          </div>
                          
                          <div>
                            <Text fw={500} size="sm">
                              {appointment.patientName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {appointment.type} • {appointment.provider}
                            </Text>
                            <Group gap="xs" mt="xs">
                              <Badge 
                                size="xs" 
                                color={getStatusColor(appointment.status)}
                                variant="light"
                              >
                                {appointment.status.replace('-', ' ').toUpperCase()}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {formatDateTime(appointment.startTime)} • {appointment.duration}min
                              </Text>
                            </Group>
                          </div>
                        </Group>
                        
                        <Group gap="xs">
                          <ActionIcon 
                            variant="light" 
                            size="sm"
                            onClick={() => onNavigate?.('appointments', { appointmentId: appointment.id })}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                          <ActionIcon 
                            variant="light" 
                            size="sm" 
                            color="blue"
                            onClick={() => onNavigate?.('appointments', { appointmentId: appointment.id, action: 'edit' })}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Tabs.Panel>
        )}

        {canViewBilling && (
          <Tabs.Panel value="billing" pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={500} size="sm">Recent Billing</Text>
                <Group gap="xs">
                  <Badge color="red" variant="light">
                    {billingItems.filter(b => b.status === 'overdue').length} Overdue
                  </Badge>
                  <Button 
                    size="xs" 
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onNavigate?.('billing', { action: 'create' })}
                  >
                    New Bill
                  </Button>
                </Group>
              </Group>
              
              <ScrollArea h={isMaximized ? 350 : 200}>
                <Stack gap="xs">
                  {billingItems.map((item) => (
                    <Card key={item.id} withBorder>
                      <Group justify="space-between" align="flex-start">
                        <Group gap="md">
                          <div className={`p-2 rounded-lg ${
                            item.status === 'paid' ? 'bg-green-100' :
                            item.status === 'submitted' ? 'bg-blue-100' :
                            item.status === 'pending' ? 'bg-orange-100' :
                            'bg-red-100'
                          }`}>
                            <IconReceipt size={16} />
                          </div>
                          
                          <div>
                            <Text fw={500} size="sm">
                              {item.patientName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {item.services.join(', ')}
                            </Text>
                            <Group gap="xs" mt="xs">
                              <Badge 
                                size="xs" 
                                color={getStatusColor(item.status)}
                                variant="light"
                              >
                                {item.status.toUpperCase()}
                              </Badge>
                              <Text size="xs" fw={600}>
                                {formatCurrency(item.amount)}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed" mt="xs">
                              Service: {formatDate(item.serviceDate)}
                              {item.dueDate && ` • Due: ${formatDate(item.dueDate)}`}
                            </Text>
                          </div>
                        </Group>
                        
                        <ActionIcon 
                          variant="light" 
                          size="sm"
                          onClick={() => onNavigate?.('billing', { billId: item.id })}
                        >
                          <IconArrowRight size={14} />
                        </ActionIcon>
                      </Group>
                      
                      {item.status === 'overdue' && (
                        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" mt="md">
                          <Text size="sm">Payment overdue - follow up required</Text>
                        </Alert>
                      )}
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Tabs.Panel>
        )}

        {canViewRegistration && isMaximized && (
          <>
            <Tabs.Panel value="registration" pt="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500} size="sm">Patient Registration Queue</Text>
                  <Group gap="xs">
                    <Badge color="orange" variant="light">
                      {registrations.filter(r => r.status === 'pending').length} Pending
                    </Badge>
                    <Button 
                      size="xs" 
                      leftSection={<IconUser size={12} />}
                      onClick={() => onNavigate?.('registration', { action: 'new' })}
                    >
                      New Patient
                    </Button>
                  </Group>
                </Group>
                
                <Stack gap="xs">
                  {registrations.map((registration) => (
                    <Card key={registration.id} withBorder>
                      <Group justify="space-between" align="center">
                        <Group gap="md">
                          <div className={`p-2 rounded-lg ${
                            registration.status === 'completed' ? 'bg-green-100' :
                            registration.status === 'in-progress' ? 'bg-blue-100' :
                            'bg-orange-100'
                          }`}>
                            <IconUser size={16} />
                          </div>
                          
                          <div>
                            <Text fw={500} size="sm">
                              {registration.patientName}
                            </Text>
                            <Group gap="xs" mt="xs">
                              <Badge 
                                size="xs" 
                                color={getStatusColor(registration.status)}
                                variant="light"
                              >
                                {registration.status.replace('-', ' ').toUpperCase()}
                              </Badge>
                              <Badge 
                                size="xs" 
                                variant="outline"
                              >
                                {registration.type.replace('-', ' ').toUpperCase()}
                              </Badge>
                              {registration.priority === 'urgent' && (
                                <Badge size="xs" color="red" variant="light">
                                  URGENT
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed" mt="xs">
                              {formatDateTime(registration.timestamp)}
                              {registration.assignedTo && ` • Assigned to: ${registration.assignedTo}`}
                            </Text>
                          </div>
                        </Group>
                        
                        <Group gap="xs">
                          {registration.status === 'pending' && (
                            <Button 
                              size="xs" 
                              variant="light"
                              onClick={() => onNavigate?.('registration', { registrationId: registration.id, action: 'process' })}
                            >
                              Process
                            </Button>
                          )}
                          <ActionIcon 
                            variant="light" 
                            size="sm"
                            onClick={() => onNavigate?.('registration', { registrationId: registration.id })}
                          >
                            <IconArrowRight size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="metrics" pt="md">
              <Stack gap="md">
                <Text fw={500} size="sm">Performance Metrics</Text>
                
                <SimpleGrid cols={2} spacing="md">
                  {metrics.map((metric, index) => (
                    <Card key={index} withBorder>
                      <Group justify="space-between" align="center" mb="md">
                        <Text fw={500} size="sm">
                          {metric.label}
                        </Text>
                        {getTrendIcon(metric.trend)}
                      </Group>
                      
                      <Center>
                        <RingProgress
                          size={100}
                          thickness={8}
                          sections={[{ 
                            value: metric.unit === '%' ? metric.value : (metric.value / 100), 
                            color: metric.color 
                          }]}
                          label={
                            <Center>
                              <Text c={metric.color} fw={700} size="lg">
                                {metric.unit === '$' ? formatCurrency(metric.value) : `${metric.value}${metric.unit}`}
                              </Text>
                            </Center>
                          }
                        />
                      </Center>
                      
                      <Text size="xs" c="dimmed" ta="center" mt="sm">
                        {metric.change > 0 ? '+' : ''}{metric.change}% from last month
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Stack>
            </Tabs.Panel>
          </>
        )}
      </Tabs>
    </Stack>
  );
}

export default AdministrativePanel;