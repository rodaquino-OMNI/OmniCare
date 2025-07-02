'use client';

import { Card, Text, Stack, Button, SimpleGrid, Group } from '@mantine/core';
import { IconCalendar, IconUserCog, IconBuilding, IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function SchedulingPage() {
  const schedulingModules = [
    {
      title: 'Appointments',
      description: 'Schedule and manage patient appointments',
      icon: IconCalendar,
      path: '/scheduling/appointments',
      color: 'blue',
    },
    {
      title: 'Provider Schedule',
      description: 'Manage provider availability and schedules',
      icon: IconUserCog,
      path: '/scheduling/providers',
      color: 'green',
    },
    {
      title: 'Room Management',
      description: 'Manage room assignments and availability',
      icon: IconBuilding,
      path: '/scheduling/rooms',
      color: 'purple',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <AppLayout
        title="Scheduling"
        subtitle="Manage appointments and provider schedules"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Today's Appointments
                </Text>
                <IconCalendar size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                34
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Available Slots
                </Text>
                <IconClock size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                12
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Providers Active
                </Text>
                <IconUserCog size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                8
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Rooms Available
                </Text>
                <IconBuilding size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                6
              </Text>
            </Card>
          </SimpleGrid>

          {/* Scheduling Modules */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {schedulingModules.map((module) => (
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
                    Manage {module.title}
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