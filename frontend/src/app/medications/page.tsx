'use client';

import { Card, Text, Stack, Button, SimpleGrid, Group } from '@mantine/core';
import { IconPill, IconDroplet, IconMedicineSyrup } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function MedicationsPage() {
  const medicationModules = [
    {
      title: 'Prescriptions',
      description: 'Manage prescriptions and e-prescribing',
      icon: IconPill,
      path: '/medications/prescriptions',
      color: 'blue',
    },
    {
      title: 'Administration',
      description: 'Track medication administration',
      icon: IconDroplet,
      path: '/medications/administration',
      color: 'green',
    },
    {
      title: 'Pharmacy Review',
      description: 'Pharmacy verification and review',
      icon: IconMedicineSyrup,
      path: '/medications/pharmacy',
      color: 'purple',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'pharmacist']}>
      <AppLayout
        title="Medications"
        subtitle="Prescription and medication management"
      >
        <Stack gap="xl">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Active Prescriptions
                </Text>
                <IconPill size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                421
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Pending Orders
                </Text>
                <IconMedicineSyrup size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                23
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Administered Today
                </Text>
                <IconDroplet size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                156
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Pharmacy Reviews
                </Text>
                <IconMedicineSyrup size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700} className="text-gray-800">
                12
              </Text>
            </Card>
          </SimpleGrid>

          {/* Medication Modules */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {medicationModules.map((module) => (
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

          {/* Quick Actions */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">
              Quick Actions
            </Text>
            <Group>
              <Button leftSection={<IconPill size={16} />} variant="light" component={Link} href="/medications/prescriptions">
                New Prescription
              </Button>
              <Button leftSection={<IconDroplet size={16} />} variant="light">
                Record Administration
              </Button>
              <Button leftSection={<IconMedicineSyrup size={16} />} variant="outline">
                Medication Lists
              </Button>
            </Group>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}