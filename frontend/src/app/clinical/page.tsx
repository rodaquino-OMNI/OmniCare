'use client';

import { Card, Text, Stack, Button, SimpleGrid, Group } from '@mantine/core';
import { IconStethoscope, IconFileText, IconActivity, IconHeart, IconClipboardList } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ClinicalPage() {
  const clinicalModules = [
    {
      title: 'Encounters',
      description: 'Patient encounters and visit documentation',
      icon: IconStethoscope,
      path: '/clinical/encounters',
      color: 'blue',
    },
    {
      title: 'Documentation',
      description: 'Clinical notes and documentation',
      icon: IconFileText,
      path: '/clinical/documentation',
      color: 'green',
    },
    {
      title: 'Vital Signs',
      description: 'Record and monitor patient vital signs',
      icon: IconActivity,
      path: '/clinical/vitals',
      color: 'red',
    },
    {
      title: 'Care Plans',
      description: 'Create and manage patient care plans',
      icon: IconHeart,
      path: '/clinical/care-plans',
      color: 'purple',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse']}>
      <AppLayout
        title="Clinical"
        subtitle="Clinical documentation and patient care"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Active Encounters
                </Text>
                <IconStethoscope size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                12
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Pending Notes
                </Text>
                <IconFileText size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                5
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Vitals Recorded
                </Text>
                <IconActivity size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                28
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Active Care Plans
                </Text>
                <IconHeart size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                15
              </Text>
            </Card>
          </SimpleGrid>

          {/* Clinical Modules */}
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="md">
            {clinicalModules.map((module) => (
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
                    Access {module.title}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          {/* Quick Actions */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Quick Actions
            </Text>
            <Group>
              <Button leftSection={<IconClipboardList size={16} />} variant="light">
                New Clinical Note
              </Button>
              <Button leftSection={<IconActivity size={16} />} variant="light">
                Record Vitals
              </Button>
              <Button leftSection={<IconStethoscope size={16} />} variant="light">
                Start Encounter
              </Button>
              <Button leftSection={<IconHeart size={16} />} variant="light">
                Create Care Plan
              </Button>
            </Group>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}