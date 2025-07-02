'use client';

import { Card, Text, Stack, Button, Group, Badge, Checkbox, Table, Timeline } from '@mantine/core';
import { IconPill, IconClock, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function MedicationAdministrationPage() {
  const [completedMeds, setCompletedMeds] = useState<string[]>([]);

  const scheduledMedications = [
    {
      id: '1',
      patient: 'John Doe',
      medication: 'Metformin 500mg',
      route: 'PO',
      scheduledTime: '08:00',
      status: 'due',
      instructions: 'Take with breakfast',
    },
    {
      id: '2',
      patient: 'John Doe',
      medication: 'Lisinopril 10mg',
      route: 'PO',
      scheduledTime: '08:00',
      status: 'due',
      instructions: 'Take in the morning',
    },
    {
      id: '3',
      patient: 'Jane Smith',
      medication: 'Insulin Glargine 20 units',
      route: 'SubQ',
      scheduledTime: '09:00',
      status: 'upcoming',
      instructions: 'Inject in abdomen',
    },
    {
      id: '4',
      patient: 'Robert Brown',
      medication: 'Acetaminophen 650mg',
      route: 'PO',
      scheduledTime: '06:00',
      status: 'overdue',
      instructions: 'PRN for pain',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'due': return 'blue';
      case 'overdue': return 'red';
      case 'upcoming': return 'gray';
      case 'completed': return 'green';
      default: return 'gray';
    }
  };

  return (
    <ProtectedRoute requiredRoles={['nurse']}>
      <AppLayout
        title="Medication Administration"
        subtitle="Manage and document medication administration"
      >
        <Stack gap="lg">
          {/* Quick Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Due Now</Text>
                <IconClock size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700}>8</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Overdue</Text>
                <IconAlertCircle size={20} className="text-red-500" />
              </Group>
              <Text size="xl" fw={700}>2</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Administered</Text>
                <IconCheck size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700}>24</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Upcoming</Text>
                <IconPill size={20} className="text-gray-500" />
              </Group>
              <Text size="xl" fw={700}>15</Text>
            </Card>
          </SimpleGrid>

          {/* Medication Administration List */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Medication Administration Record (MAR)</Text>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Patient</Table.Th>
                  <Table.Th>Medication</Table.Th>
                  <Table.Th>Route</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {scheduledMedications.map((med) => (
                  <Table.Tr key={med.id}>
                    <Table.Td>{med.scheduledTime}</Table.Td>
                    <Table.Td>{med.patient}</Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>{med.medication}</Text>
                        <Text size="xs" c="dimmed">{med.instructions}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>{med.route}</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={getStatusColor(completedMeds.includes(med.id) ? 'completed' : med.status)} 
                        variant="light"
                      >
                        {completedMeds.includes(med.id) ? 'Completed' : med.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Checkbox
                        checked={completedMeds.includes(med.id)}
                        onChange={(event) => {
                          if (event.currentTarget.checked) {
                            setCompletedMeds([...completedMeds, med.id]);
                          } else {
                            setCompletedMeds(completedMeds.filter(id => id !== med.id));
                          }
                        }}
                        label="Given"
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            <Group mt="md">
              <Button leftSection={<IconCheck size={16} />}>
                Submit Administration Record
              </Button>
              <Button variant="light">
                View Full MAR
              </Button>
            </Group>
          </Card>

          {/* Recent Administration History */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Administration History</Text>
            
            <Timeline active={2} bulletSize={24} lineWidth={2}>
              <Timeline.Item bullet={<IconPill size={12} />} title="Medications Administered">
                <Text c="dimmed" size="sm">John Doe - Metformin 500mg, Lisinopril 10mg</Text>
                <Text size="xs" mt={4}>10 minutes ago by Nurse Johnson</Text>
              </Timeline.Item>

              <Timeline.Item bullet={<IconPill size={12} />} title="PRN Medication Given">
                <Text c="dimmed" size="sm">Jane Smith - Morphine 2mg IV for pain</Text>
                <Text size="xs" mt={4}>1 hour ago by Nurse Davis</Text>
              </Timeline.Item>

              <Timeline.Item bullet={<IconAlertCircle size={12} />} title="Medication Held">
                <Text c="dimmed" size="sm">Robert Brown - Warfarin held per MD order</Text>
                <Text size="xs" mt={4}>2 hours ago by Nurse Johnson</Text>
              </Timeline.Item>
            </Timeline>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { SimpleGrid } from '@mantine/core';