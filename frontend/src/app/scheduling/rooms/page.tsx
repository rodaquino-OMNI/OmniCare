'use client';

import { Card, Text, Stack, Badge, Button, Group, Grid, Select, SimpleGrid } from '@mantine/core';
import { IconDoorEnter, IconBed, IconStethoscope, IconScan } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function RoomManagementPage() {
  const [floor, setFloor] = useState('1');

  const rooms = [
    { id: '101', type: 'exam', status: 'occupied', patient: 'John Doe', provider: 'Dr. Smith', duration: '15 min' },
    { id: '102', type: 'exam', status: 'available', patient: null, provider: null, duration: null },
    { id: '103', type: 'exam', status: 'cleaning', patient: null, provider: null, duration: '10 min' },
    { id: '104', type: 'procedure', status: 'occupied', patient: 'Jane Smith', provider: 'Dr. Johnson', duration: '45 min' },
    { id: '105', type: 'exam', status: 'available', patient: null, provider: null, duration: null },
    { id: '106', type: 'exam', status: 'maintenance', patient: null, provider: null, duration: null },
    { id: '201', type: 'patient', status: 'occupied', patient: 'Robert Brown', provider: 'Dr. Davis', duration: '2 days' },
    { id: '202', type: 'patient', status: 'available', patient: null, provider: null, duration: null },
    { id: '203', type: 'patient', status: 'occupied', patient: 'Maria Garcia', provider: 'Dr. Chen', duration: '3 days' },
    { id: '204', type: 'imaging', status: 'occupied', patient: 'David Lee', provider: 'Tech. Williams', duration: '30 min' },
  ];

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'exam': return IconStethoscope;
      case 'procedure': return IconBed;
      case 'patient': return IconBed;
      case 'imaging': return IconScan;
      default: return IconDoorEnter;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'green';
      case 'occupied': return 'red';
      case 'cleaning': return 'yellow';
      case 'maintenance': return 'gray';
      default: return 'gray';
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (floor === 'all') return true;
    return room.id.startsWith(floor);
  });

  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AppLayout
        title="Room Management"
        subtitle="Monitor and manage facility rooms"
      >
        <Stack gap="lg">
          {/* Room Statistics */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Total Rooms</Text>
                <IconDoorEnter size={20} className="text-blue-500" />
              </Group>
              <Text size="xl" fw={700}>{rooms.length}</Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Available</Text>
                <IconDoorEnter size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700}>
                {rooms.filter(r => r.status === 'available').length}
              </Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Occupied</Text>
                <IconDoorEnter size={20} className="text-red-500" />
              </Group>
              <Text size="xl" fw={700}>
                {rooms.filter(r => r.status === 'occupied').length}
              </Text>
            </Card>
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>Maintenance</Text>
                <IconDoorEnter size={20} className="text-gray-500" />
              </Group>
              <Text size="xl" fw={700}>
                {rooms.filter(r => r.status === 'maintenance' || r.status === 'cleaning').length}
              </Text>
            </Card>
          </SimpleGrid>

          {/* Floor Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <Select
                label="Select Floor"
                value={floor}
                onChange={(val) => setFloor(val || '1')}
                data={[
                  { value: 'all', label: 'All Floors' },
                  { value: '1', label: 'Floor 1 - Examination' },
                  { value: '2', label: 'Floor 2 - Inpatient' },
                  { value: '3', label: 'Floor 3 - Specialty' },
                ]}
                style={{ width: 250 }}
              />
              <Button variant="light">
                Room Assignment Rules
              </Button>
            </Group>
          </Card>

          {/* Room Grid */}
          <Grid>
            {filteredRooms.map((room) => {
              const Icon = getRoomIcon(room.type);
              return (
                <Grid.Col key={room.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card 
                    shadow="sm" 
                    padding="lg" 
                    radius="md" 
                    withBorder
                    style={{
                      borderColor: room.status === 'occupied' ? '#ef4444' : undefined,
                      backgroundColor: room.status === 'available' ? '#f0fdf4' : undefined,
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Icon size={20} />
                        <Text fw={600}>Room {room.id}</Text>
                      </Group>
                      <Badge 
                        color={getStatusColor(room.status)} 
                        variant="light"
                        size="sm"
                      >
                        {room.status}
                      </Badge>
                    </Group>
                    
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">
                        Type: {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                      </Text>
                      
                      {room.patient && (
                        <>
                          <Text size="sm">Patient: {room.patient}</Text>
                          <Text size="sm">Provider: {room.provider}</Text>
                          <Text size="sm" c="dimmed">Duration: {room.duration}</Text>
                        </>
                      )}
                      
                      {room.status === 'available' && (
                        <Button size="xs" fullWidth mt="xs">
                          Assign Room
                        </Button>
                      )}
                      
                      {room.status === 'occupied' && (
                        <Button size="xs" variant="light" fullWidth mt="xs">
                          View Details
                        </Button>
                      )}
                      
                      {room.status === 'cleaning' && (
                        <Button size="xs" variant="light" color="yellow" fullWidth mt="xs">
                          Mark Clean
                        </Button>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              );
            })}
          </Grid>

          {/* Room Activity Log */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Room Activity</Text>
            <Stack gap="xs">
              <Group justify="space-between" p="xs" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <Text size="sm">Room 101 - Cleaned and ready</Text>
                <Text size="xs" c="dimmed">5 minutes ago</Text>
              </Group>
              <Group justify="space-between" p="xs" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <Text size="sm">Room 104 - Procedure started (Dr. Johnson)</Text>
                <Text size="xs" c="dimmed">15 minutes ago</Text>
              </Group>
              <Group justify="space-between" p="xs">
                <Text size="sm">Room 202 - Patient discharged</Text>
                <Text size="xs" c="dimmed">1 hour ago</Text>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}