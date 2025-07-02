'use client';

import { Card, Text, Stack, Select, SimpleGrid, Button, Progress, Group } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconFileText, IconUsers, IconCoin, IconCalendar, IconTrendingUp } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function AdminReportsPage() {
  const [reportCategory, setReportCategory] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const reportCategories = [
    { value: 'financial', label: 'Financial Reports' },
    { value: 'operational', label: 'Operational Reports' },
    { value: 'staffing', label: 'Staffing Reports' },
    { value: 'utilization', label: 'Utilization Reports' },
    { value: 'compliance', label: 'Compliance Reports' },
  ];

  const kpiCards = [
    { 
      title: 'Revenue This Month', 
      value: '$1.2M', 
      change: '+12%', 
      icon: IconCoin,
      color: 'green' 
    },
    { 
      title: 'Patient Volume', 
      value: '2,847', 
      change: '+5%', 
      icon: IconUsers,
      color: 'blue' 
    },
    { 
      title: 'Bed Utilization', 
      value: '87%', 
      change: '+3%', 
      icon: IconCalendar,
      color: 'orange' 
    },
    { 
      title: 'Staff Efficiency', 
      value: '94%', 
      change: '+2%', 
      icon: IconTrendingUp,
      color: 'purple' 
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['admin', 'system_admin']}>
      <AppLayout
        title="Administrative Reports"
        subtitle="Financial and operational reporting"
      >
        <Stack gap="lg">
          {/* KPI Dashboard */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {kpiCards.map((kpi, index) => (
              <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed" fw={500}>{kpi.title}</Text>
                  <kpi.icon size={20} className={`text-${kpi.color}-500`} />
                </Group>
                <Group align="end" gap="xs">
                  <Text size="xl" fw={700}>{kpi.value}</Text>
                  <Text size="sm" c={kpi.color} fw={500}>{kpi.change}</Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>

          {/* Report Generation */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Generate Administrative Report</Text>
            
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Select
                label="Report Category"
                placeholder="Select category"
                value={reportCategory}
                onChange={(val) => setReportCategory(val || '')}
                data={reportCategories}
              />
              
              <DatePicker
                type="range"
                label="Date Range"
                placeholder="Select date range"
                value={dateRange}
                onChange={setDateRange}
              />
              
              <Select
                label="Department"
                placeholder="All Departments"
                data={[
                  { value: 'all', label: 'All Departments' },
                  { value: 'emergency', label: 'Emergency' },
                  { value: 'surgery', label: 'Surgery' },
                  { value: 'pediatrics', label: 'Pediatrics' },
                  { value: 'radiology', label: 'Radiology' },
                ]}
              />
            </SimpleGrid>
            
            <Group mt="md">
              <Button leftSection={<IconFileText size={16} />}>
                Generate Report
              </Button>
              <Button variant="light">
                Schedule Report
              </Button>
            </Group>
          </Card>

          {/* Quick Reports Grid */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Quick Reports</Text>
            
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text fw={500}>Financial Summary</Text>
                  <Text size="sm" c="dimmed">Revenue, expenses, and profit margins</Text>
                  <Button size="xs" variant="light" fullWidth>Generate</Button>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text fw={500}>Staff Productivity</Text>
                  <Text size="sm" c="dimmed">Hours worked, patient ratios, overtime</Text>
                  <Button size="xs" variant="light" fullWidth>Generate</Button>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text fw={500}>Department Performance</Text>
                  <Text size="sm" c="dimmed">KPIs by department and service line</Text>
                  <Button size="xs" variant="light" fullWidth>Generate</Button>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text fw={500}>Insurance Analysis</Text>
                  <Text size="sm" c="dimmed">Payer mix, denials, collections</Text>
                  <Button size="xs" variant="light" fullWidth>Generate</Button>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text fw={500}>Patient Satisfaction</Text>
                  <Text size="sm" c="dimmed">Survey results and feedback analysis</Text>
                  <Button size="xs" variant="light" fullWidth>Generate</Button>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text fw={500}>Regulatory Compliance</Text>
                  <Text size="sm" c="dimmed">Audit results and compliance metrics</Text>
                  <Button size="xs" variant="light" fullWidth>Generate</Button>
                </Stack>
              </Card>
            </SimpleGrid>
          </Card>

          {/* Department Utilization */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Department Utilization</Text>
            
            <Stack gap="sm">
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Emergency Department</Text>
                  <Text size="sm" fw={500}>92%</Text>
                </Group>
                <Progress value={92} color="orange" />
              </div>
              
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Operating Rooms</Text>
                  <Text size="sm" fw={500}>78%</Text>
                </Group>
                <Progress value={78} color="blue" />
              </div>
              
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Inpatient Beds</Text>
                  <Text size="sm" fw={500}>85%</Text>
                </Group>
                <Progress value={85} color="green" />
              </div>
              
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm">ICU Beds</Text>
                  <Text size="sm" fw={500}>95%</Text>
                </Group>
                <Progress value={95} color="red" />
              </div>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}