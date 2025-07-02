'use client';

import { Card, Text, Center, Stack, Button, SimpleGrid, Group } from '@mantine/core';
import { IconFlask, IconBolt, IconChartBar, IconActivity } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ResultsPage() {
  const resultTypes = [
    {
      title: 'Lab Results',
      description: 'View laboratory test results and analytics',
      icon: IconFlask,
      path: '/results/lab',
      color: 'blue',
    },
    {
      title: 'Imaging Results',
      description: 'Access radiology and imaging study results',
      icon: IconBolt,
      path: '/results/imaging',
      color: 'purple',
    },
    {
      title: 'Trending Analysis',
      description: 'View patient trends and longitudinal data',
      icon: IconChartBar,
      path: '/results/trending',
      color: 'green',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'lab_tech', 'radiology_tech']}>
      <AppLayout
        title="Results"
        subtitle="Review and analyze patient test results"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Pending Results
                </Text>
                <IconActivity size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                23
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Critical Results
                </Text>
                <IconFlask size={20} className="text-red-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                3
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Results Today
                </Text>
                <IconChartBar size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                67
              </Text>
            </Card>
          </SimpleGrid>

          {/* Result Types */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {resultTypes.map((type) => (
              <Card key={type.path} shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <type.icon size={48} className={`text-${type.color}-500`} />
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={600} mb="xs">
                      {type.title}
                    </Text>
                    <Text size="sm" c="dimmed" mb="md">
                      {type.description}
                    </Text>
                  </div>
                  <Button
                    component={Link}
                    href={type.path}
                    variant="light"
                    color={type.color}
                    leftSection={<type.icon size={16} />}
                    fullWidth
                  >
                    View {type.title}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}