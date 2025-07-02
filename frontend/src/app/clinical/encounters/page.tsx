'use client';

import { Card, Text, Stack, SimpleGrid, Group, Button, Badge, Table } from '@mantine/core';
import { IconStethoscope, IconPlus, IconFileText, IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function EncountersPage() {
  // Mock data for recent encounters
  const recentEncounters = [
    { id: 1, patient: 'John Doe', type: 'Follow-up', provider: 'Dr. Smith', date: '2024-01-15', status: 'completed' },
    { id: 2, patient: 'Jane Smith', type: 'New Patient', provider: 'Dr. Johnson', date: '2024-01-15', status: 'in-progress' },
    { id: 3, patient: 'Robert Brown', type: 'Urgent Care', provider: 'Dr. Davis', date: '2024-01-14', status: 'completed' },
    { id: 4, patient: 'Maria Garcia', type: 'Annual Physical', provider: 'Dr. Smith', date: '2024-01-14', status: 'completed' },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse']}>
      <AppLayout
        title="Clinical Encounters"
        subtitle="Manage patient encounters and visits"
      >
        <Stack gap="lg">
          {/* Stats Overview */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Today's Encounters</Text>
                <IconStethoscope size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700}>18</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>In Progress</Text>
                <IconClock size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700}>3</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Completed Today</Text>
                <IconFileText size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700}>15</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Average Duration</Text>
                <IconClock size={20} className="text-purple-500" />
              </Group>
              <Text size="xl" fw={700}>22 min</Text>
            </Card>
          </SimpleGrid>

          {/* Recent Encounters Table */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>Recent Encounters</Text>
              <Button leftSection={<IconPlus size={16} />} component={Link} href="/clinical/documentation">
                New Encounter
              </Button>
            </Group>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Patient</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Provider</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentEncounters.map((encounter) => (
                  <Table.Tr key={encounter.id}>
                    <Table.Td>{encounter.patient}</Table.Td>
                    <Table.Td>{encounter.type}</Table.Td>
                    <Table.Td>{encounter.provider}</Table.Td>
                    <Table.Td>{encounter.date}</Table.Td>
                    <Table.Td>
                      <Badge color={encounter.status === 'completed' ? 'green' : 'orange'} variant="light">
                        {encounter.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="subtle" component={Link} href="/clinical/documentation">
                        View
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}