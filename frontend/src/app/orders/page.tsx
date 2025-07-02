'use client';

import { Card, Text, Stack, Button, SimpleGrid, Group } from '@mantine/core';
import { IconFlask, IconBolt, IconPill, IconDroplet, IconClipboardList } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function OrdersPage() {
  const orderTypes = [
    {
      title: 'Laboratory',
      description: 'Order lab tests and diagnostics',
      icon: IconFlask,
      path: '/orders/lab',
      color: 'blue',
    },
    {
      title: 'Imaging',
      description: 'Order radiology and imaging studies',
      icon: IconBolt,
      path: '/orders/imaging',
      color: 'purple',
    },
    {
      title: 'Medications',
      description: 'Prescribe and order medications',
      icon: IconPill,
      path: '/orders/medications',
      color: 'green',
    },
    {
      title: 'Procedures',
      description: 'Order medical procedures and interventions',
      icon: IconDroplet,
      path: '/orders/procedures',
      color: 'orange',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician']}>
      <AppLayout
        title="Orders"
        subtitle="Medical orders and prescriptions"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Pending Orders
                </Text>
                <IconClipboardList size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                18
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Lab Orders Today
                </Text>
                <IconFlask size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                24
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Prescriptions
                </Text>
                <IconPill size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                31
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Imaging Studies
                </Text>
                <IconBolt size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                12
              </Text>
            </Card>
          </SimpleGrid>

          {/* Order Types */}
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="md">
            {orderTypes.map((type) => (
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
                    Order {type.title}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          {/* Quick Order Actions */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Quick Orders
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
              <Button leftSection={<IconFlask size={16} />} variant="light" size="sm">
                CBC with Diff
              </Button>
              <Button leftSection={<IconFlask size={16} />} variant="light" size="sm">
                Basic Metabolic Panel
              </Button>
              <Button leftSection={<IconBolt size={16} />} variant="light" size="sm">
                Chest X-Ray
              </Button>
              <Button leftSection={<IconPill size={16} />} variant="light" size="sm">
                Common Prescriptions
              </Button>
            </SimpleGrid>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}