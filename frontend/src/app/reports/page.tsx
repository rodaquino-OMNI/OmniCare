'use client';

import { Card, Text, Stack, Button, SimpleGrid, Group } from '@mantine/core';
import { IconFileText, IconChartBar, IconShield } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ReportsPage() {
  const reportModules = [
    {
      title: 'Clinical Reports',
      description: 'Patient care and clinical outcome reports',
      icon: IconFileText,
      path: '/reports/clinical',
      color: 'blue',
    },
    {
      title: 'Administrative Reports',
      description: 'Operational and financial reporting',
      icon: IconChartBar,
      path: '/reports/admin',
      color: 'green',
    },
    {
      title: 'Quality Metrics',
      description: 'Quality measures and compliance reports',
      icon: IconShield,
      path: '/reports/quality',
      color: 'purple',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'admin', 'system_admin']}>
      <AppLayout
        title="Reports"
        subtitle="Clinical and administrative reporting"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Generated Today
                </Text>
                <IconFileText size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                12
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Scheduled Reports
                </Text>
                <IconChartBar size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                8
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Quality Metrics
                </Text>
                <IconShield size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                15
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Compliance Score
                </Text>
                <IconShield size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                98%
              </Text>
            </Card>
          </SimpleGrid>

          {/* Report Modules */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {reportModules.map((module) => (
              <Card key={module.path} shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <module.icon size={48} className={`text-${module.color}-500`} />
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={600} mb="xs">
                      {module.title}
                    </Text>
                    <Text size="sm" c="dimmed" mb="md">
                      {module.description}
                    </Text>
                  </div>
                  <Button
                    component={Link}
                    href={module.path}
                    variant="light"
                    color={module.color}
                    leftSection={<module.icon size={16} />}
                    fullWidth
                  >
                    View {module.title}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          {/* Quick Report Generation */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Quick Reports
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
              <Button leftSection={<IconFileText size={16} />} variant="light" size="sm">
                Daily Census
              </Button>
              <Button leftSection={<IconChartBar size={16} />} variant="light" size="sm">
                Monthly Statistics
              </Button>
              <Button leftSection={<IconShield size={16} />} variant="light" size="sm">
                Quality Dashboard
              </Button>
              <Button leftSection={<IconFileText size={16} />} variant="outline" size="sm">
                Custom Report
              </Button>
            </SimpleGrid>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}