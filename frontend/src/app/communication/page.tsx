'use client';

import { Card, Text, Stack, Button, SimpleGrid, Group, Badge } from '@mantine/core';
import { IconMessage, IconBell, IconMail, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function CommunicationPage() {
  const communicationModules = [
    {
      title: 'Messages',
      description: 'Secure messaging with patients and staff',
      icon: IconMessage,
      path: '/communication/messages',
      color: 'blue',
      count: 12,
    },
    {
      title: 'Notifications',
      description: 'System alerts and notifications',
      icon: IconBell,
      path: '/communication/notifications',
      color: 'orange',
      count: 5,
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <AppLayout
        title="Communication"
        subtitle="Messaging and notifications center"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Unread Messages
                </Text>
                <IconMessage size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                12
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Active Notifications
                </Text>
                <IconBell size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                5
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Patient Messages
                </Text>
                <IconMail size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                8
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Team Messages
                </Text>
                <IconUsers size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                4
              </Text>
            </Card>
          </SimpleGrid>

          {/* Communication Modules */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {communicationModules.map((module) => (
              <Card key={module.path} shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <Group>
                    <module.icon size={48} className={`text-${module.color}-500`} />
                    {module.count > 0 && (
                      <Badge color={module.color} size="lg">
                        {module.count}
                      </Badge>
                    )}
                  </Group>
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

          {/* Recent Activity */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Recent Activity
            </Text>
            <Stack gap="sm">
              <Group justify="space-between">
                <Group>
                  <IconMessage size={16} className="text-blue-500" />
                  <Text size="sm">New message from Dr. Smith</Text>
                </Group>
                <Text size="xs" c="dimmed">2 min ago</Text>
              </Group>
              
              <Group justify="space-between">
                <Group>
                  <IconBell size={16} className="text-orange-500" />
                  <Text size="sm">Lab result alert for Patient #12345</Text>
                </Group>
                <Text size="xs" c="dimmed">15 min ago</Text>
              </Group>
              
              <Group justify="space-between">
                <Group>
                  <IconMail size={16} className="text-green-500" />
                  <Text size="sm">Patient portal message from Jane Doe</Text>
                </Group>
                <Text size="xs" c="dimmed">1 hour ago</Text>
              </Group>
              
              <Group justify="space-between">
                <Group>
                  <IconUsers size={16} className="text-purple-500" />
                  <Text size="sm">Team update: Shift change notification</Text>
                </Group>
                <Text size="xs" c="dimmed">2 hours ago</Text>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}