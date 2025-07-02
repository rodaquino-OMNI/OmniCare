'use client';

import { Card, Text, Stack, Button, Group, Badge, Tabs, Table, Alert } from '@mantine/core';
import { IconPill, IconAlertTriangle, IconCheck, IconClock } from '@tabler/icons-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function PharmacyReviewPage() {
  const pendingOrders = [
    {
      id: '1',
      patient: 'John Doe',
      medication: 'Warfarin 5mg',
      prescriber: 'Dr. Smith',
      date: '2024-01-15 14:30',
      status: 'review',
      alert: 'Drug interaction with Aspirin',
    },
    {
      id: '2',
      patient: 'Jane Smith',
      medication: 'Metoprolol 25mg',
      prescriber: 'Dr. Johnson',
      date: '2024-01-15 13:45',
      status: 'pending',
      alert: null,
    },
    {
      id: '3',
      patient: 'Robert Brown',
      medication: 'Lisinopril 10mg',
      prescriber: 'Dr. Davis',
      date: '2024-01-15 12:00',
      status: 'review',
      alert: 'Renal dosing adjustment needed',
    },
  ];

  const verifiedOrders = [
    {
      id: '4',
      patient: 'Maria Garcia',
      medication: 'Amoxicillin 500mg',
      prescriber: 'Dr. Smith',
      verifiedBy: 'Pharm. Williams',
      date: '2024-01-15 11:00',
    },
    {
      id: '5',
      patient: 'David Lee',
      medication: 'Atorvastatin 20mg',
      prescriber: 'Dr. Johnson',
      verifiedBy: 'Pharm. Chen',
      date: '2024-01-15 10:30',
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['pharmacist']}>
      <AppLayout
        title="Pharmacy Review"
        subtitle="Review and verify medication orders"
      >
        <Stack gap="lg">
          {/* Overview Stats */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Pending Review</Text>
                <IconClock size={20} className="text-orange-500" />
              </Group>
              <Text size="xl" fw={700}>12</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Alerts</Text>
                <IconAlertTriangle size={20} className="text-red-500" />
              </Group>
              <Text size="xl" fw={700}>3</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Verified Today</Text>
                <IconCheck size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700}>45</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Total Orders</Text>
                <IconPill size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700}>57</Text>
            </Card>
          </SimpleGrid>

          {/* Main Review Interface */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Tabs defaultValue="pending">
              <Tabs.List>
                <Tabs.Tab value="pending" leftSection={<IconClock size={16} />}>
                  Pending Review ({pendingOrders.length})
                </Tabs.Tab>
                <Tabs.Tab value="verified" leftSection={<IconCheck size={16} />}>
                  Verified Orders
                </Tabs.Tab>
                <Tabs.Tab value="interactions" leftSection={<IconAlertTriangle size={16} />}>
                  Drug Interactions
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="pending" pt="md">
                <Stack gap="md">
                  {pendingOrders.map((order) => (
                    <Card key={order.id} shadow="xs" padding="md" radius="sm" withBorder>
                      <Group justify="space-between" mb="sm">
                        <div>
                          <Text fw={500}>{order.patient}</Text>
                          <Text size="sm" c="dimmed">
                            {order.medication} • Prescribed by {order.prescriber}
                          </Text>
                          <Text size="xs" c="dimmed">{order.date}</Text>
                        </div>
                        <Badge color={order.status === 'review' ? 'orange' : 'blue'} variant="light">
                          {order.status === 'review' ? 'Needs Review' : 'Pending'}
                        </Badge>
                      </Group>
                      
                      {order.alert && (
                        <Alert
                          variant="light"
                          color="red"
                          title="Alert"
                          icon={<IconAlertTriangle />}
                          mb="sm"
                        >
                          {order.alert}
                        </Alert>
                      )}
                      
                      <Group>
                        <Button size="xs" color="green">
                          Verify & Dispense
                        </Button>
                        <Button size="xs" variant="light" color="orange">
                          Contact Prescriber
                        </Button>
                        <Button size="xs" variant="light" color="red">
                          Reject
                        </Button>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="verified" pt="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Patient</Table.Th>
                      <Table.Th>Medication</Table.Th>
                      <Table.Th>Prescriber</Table.Th>
                      <Table.Th>Verified By</Table.Th>
                      <Table.Th>Time</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {verifiedOrders.map((order) => (
                      <Table.Tr key={order.id}>
                        <Table.Td>{order.patient}</Table.Td>
                        <Table.Td>{order.medication}</Table.Td>
                        <Table.Td>{order.prescriber}</Table.Td>
                        <Table.Td>{order.verifiedBy}</Table.Td>
                        <Table.Td>{order.date}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Tabs.Panel>

              <Tabs.Panel value="interactions" pt="md">
                <Stack gap="md">
                  <Alert
                    variant="light"
                    color="red"
                    title="Major Drug Interaction"
                    icon={<IconAlertTriangle />}
                  >
                    <Text size="sm" fw={500}>John Doe - Warfarin + Aspirin</Text>
                    <Text size="sm">Increased risk of bleeding. Consider alternative therapy or monitor INR closely.</Text>
                  </Alert>
                  
                  <Alert
                    variant="light"
                    color="orange"
                    title="Moderate Interaction"
                    icon={<IconAlertTriangle />}
                  >
                    <Text size="sm" fw={500}>Jane Smith - Lisinopril + Potassium Supplement</Text>
                    <Text size="sm">Risk of hyperkalemia. Monitor potassium levels.</Text>
                  </Alert>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Card>

          {/* Clinical Decision Support */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Clinical Decision Support</Text>
            <Group>
              <Button variant="light" leftSection={<IconPill size={16} />}>
                Drug Reference
              </Button>
              <Button variant="light">
                Dosing Calculator
              </Button>
              <Button variant="light">
                Interaction Checker
              </Button>
              <Button variant="light">
                Formulary
              </Button>
            </Group>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { SimpleGrid } from '@mantine/core';