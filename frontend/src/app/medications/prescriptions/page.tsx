'use client';

import { Card, Text, Center, Stack, Button, Group } from '@mantine/core';
import { IconPill, IconBuildingFactory2, IconMedicineSyrup } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function PrescriptionsPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'pharmacist']}>
      <AppLayout
        title="Prescriptions"
        subtitle="Prescription management and pharmacy orders"
      >
        <Center h={400}>
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Stack align="center" gap="md">
              <IconBuildingFactory2 size={64} className="text-orange-500" />
              <Text size="xl" fw={600} ta="center">
                Prescription Management
              </Text>
              <Text c="dimmed" ta="center" maw={400}>
                Prescription management features are currently under development. 
                This will include e-prescribing, medication orders, and pharmacy integration.
              </Text>
              <Group>
                <Button
                  leftSection={<IconMedicineSyrup size={16} />}
                  variant="light"
                  component={Link}
                  href="/medications"
                >
                  All Medications
                </Button>
                <Button
                  leftSection={<IconPill size={16} />}
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
              </Group>
            </Stack>
          </Card>
        </Center>
      </AppLayout>
    </ProtectedRoute>
  );
}