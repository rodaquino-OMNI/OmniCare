'use client';

import { Card, Text, Stack, Select, Group, Badge, Table, Button, Avatar } from '@mantine/core';
import { IconCalendar, IconClock, IconUser, IconStethoscope } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ProviderSchedulePage() {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedDate, setSelectedDate] = useState('today');

  const providers = [
    { id: '1', name: 'Dr. Sarah Smith', specialty: 'Family Medicine', status: 'available' },
    { id: '2', name: 'Dr. Michael Johnson', specialty: 'Internal Medicine', status: 'busy' },
    { id: '3', name: 'Dr. Emily Davis', specialty: 'Pediatrics', status: 'available' },
    { id: '4', name: 'Dr. Robert Chen', specialty: 'Cardiology', status: 'off' },
  ];

  const scheduleSlots = [
    { time: '08:00', patient: 'John Doe', type: 'Follow-up', duration: 30 },
    { time: '08:30', patient: 'Jane Smith', type: 'New Patient', duration: 45 },
    { time: '09:15', patient: null, type: null, duration: 15 },
    { time: '09:30', patient: 'Robert Brown', type: 'Consultation', duration: 30 },
    { time: '10:00', patient: null, type: null, duration: 30 },
    { time: '10:30', patient: 'Maria Garcia', type: 'Physical Exam', duration: 45 },
    { time: '11:15', patient: null, type: null, duration: 15 },
    { time: '11:30', patient: 'David Lee', type: 'Follow-up', duration: 30 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'green';
      case 'busy': return 'orange';
      case 'off': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <ProtectedRoute requiredRoles={['physician', 'admin']}>
      <AppLayout
        title="Provider Schedule"
        subtitle="View and manage provider schedules"
      >
        <Stack gap="lg">
          {/* Provider Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group>
              <Select
                label="Select Provider"
                placeholder="Choose a provider"
                leftSection={<IconStethoscope size={16} />}
                value={selectedProvider}
                onChange={(val) => setSelectedProvider(val || '')}
                data={providers.map(p => ({
                  value: p.id,
                  label: `${p.name} - ${p.specialty}`,
                }))}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <Select
                label="Date"
                placeholder="Select date"
                leftSection={<IconCalendar size={16} />}
                value={selectedDate}
                onChange={(val) => setSelectedDate(val || 'today')}
                data={[
                  { value: 'today', label: 'Today' },
                  { value: 'tomorrow', label: 'Tomorrow' },
                  { value: 'week', label: 'This Week' },
                  { value: 'custom', label: 'Custom Date' },
                ]}
                style={{ width: 150 }}
              />
            </Group>
          </Card>

          {/* Provider Status */}
          <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
            {providers.map((provider) => (
              <Card key={provider.id} shadow="sm" padding="md" radius="md" withBorder>
                <Group>
                  <Avatar color="blue" radius="xl">
                    <IconUser size={24} />
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>{provider.name}</Text>
                    <Text size="xs" c="dimmed">{provider.specialty}</Text>
                  </div>
                  <Badge color={getStatusColor(provider.status)} variant="light" size="sm">
                    {provider.status}
                  </Badge>
                </Group>
              </Card>
            ))}
          </SimpleGrid>

          {/* Schedule View */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>
                {selectedProvider ? providers.find(p => p.id === selectedProvider)?.name : 'Select a provider'} - Schedule
              </Text>
              <Group>
                <Button size="xs" variant="light">Print Schedule</Button>
                <Button size="xs" variant="light">Block Time</Button>
              </Group>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Patient</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {scheduleSlots.map((slot, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconClock size={14} />
                        {slot.time}
                      </Group>
                    </Table.Td>
                    <Table.Td>{slot.patient || <Text c="dimmed">Available</Text>}</Table.Td>
                    <Table.Td>{slot.type || '-'}</Table.Td>
                    <Table.Td>{slot.duration} min</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={slot.patient ? 'blue' : 'green'} 
                        variant="light"
                        size="sm"
                      >
                        {slot.patient ? 'Booked' : 'Open'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {slot.patient ? (
                        <Button size="xs" variant="subtle">View</Button>
                      ) : (
                        <Button size="xs" variant="light" color="green">Book</Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {/* Schedule Summary */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Daily Summary</Text>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
              <div>
                <Text size="sm" c="dimmed">Total Appointments</Text>
                <Text size="xl" fw={700}>6</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Available Slots</Text>
                <Text size="xl" fw={700}>3</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Total Hours</Text>
                <Text size="xl" fw={700}>8</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Utilization</Text>
                <Text size="xl" fw={700}>75%</Text>
              </div>
            </SimpleGrid>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { SimpleGrid } from '@mantine/core';