'use client';

import { Card, Text, Stack, Button, Group, TextInput, Select, Checkbox, Badge } from '@mantine/core';
import { IconFlask, IconPlus, IconSearch, IconClock } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function LabOrdersPage() {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);

  const labCategories = [
    {
      name: 'Hematology',
      tests: [
        { id: 'cbc', name: 'Complete Blood Count (CBC)', turnaround: '4 hours' },
        { id: 'pt', name: 'Prothrombin Time (PT)', turnaround: '2 hours' },
        { id: 'ptt', name: 'Partial Thromboplastin Time (PTT)', turnaround: '2 hours' },
      ]
    },
    {
      name: 'Chemistry',
      tests: [
        { id: 'bmp', name: 'Basic Metabolic Panel', turnaround: '4 hours' },
        { id: 'cmp', name: 'Comprehensive Metabolic Panel', turnaround: '4 hours' },
        { id: 'lipid', name: 'Lipid Panel', turnaround: '8 hours' },
      ]
    },
    {
      name: 'Microbiology',
      tests: [
        { id: 'urine', name: 'Urinalysis', turnaround: '2 hours' },
        { id: 'culture', name: 'Blood Culture', turnaround: '48 hours' },
        { id: 'strep', name: 'Strep Test', turnaround: '30 minutes' },
      ]
    }
  ];

  return (
    <ProtectedRoute requiredRoles={['physician']}>
      <AppLayout
        title="Laboratory Orders"
        subtitle="Order lab tests and manage pending orders"
      >
        <Stack gap="lg">
          {/* Patient Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>Current Patient</Text>
                <Text size="sm" c="dimmed">Select a patient to order lab tests</Text>
              </div>
              <Button leftSection={<IconSearch size={16} />}>
                Select Patient
              </Button>
            </Group>
          </Card>

          {/* Lab Test Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Order Lab Tests</Text>
            
            <Stack gap="md">
              <TextInput
                placeholder="Search for lab tests..."
                leftSection={<IconSearch size={16} />}
              />
              
              {labCategories.map((category) => (
                <div key={category.name}>
                  <Text size="sm" fw={600} mb="xs">{category.name}</Text>
                  <Stack gap="xs" pl="md">
                    {category.tests.map((test) => (
                      <Group key={test.id} justify="space-between">
                        <Checkbox
                          label={test.name}
                          value={test.id}
                          checked={selectedTests.includes(test.id)}
                          onChange={(event) => {
                            if (event.currentTarget.checked) {
                              setSelectedTests([...selectedTests, test.id]);
                            } else {
                              setSelectedTests(selectedTests.filter(t => t !== test.id));
                            }
                          }}
                        />
                        <Group gap="xs">
                          <IconClock size={14} />
                          <Text size="xs" c="dimmed">{test.turnaround}</Text>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </div>
              ))}
            </Stack>
            
            <Group mt="xl">
              <Select
                label="Priority"
                placeholder="Select priority"
                data={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'stat', label: 'STAT' },
                ]}
                defaultValue="routine"
              />
              <Button 
                leftSection={<IconFlask size={16} />}
                disabled={selectedTests.length === 0}
                style={{ alignSelf: 'flex-end' }}
              >
                Submit Order ({selectedTests.length} tests)
              </Button>
            </Group>
          </Card>

          {/* Pending Orders */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Pending Lab Orders</Text>
            <Stack gap="xs">
              <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <div>
                  <Text fw={500}>John Doe - CBC, BMP</Text>
                  <Text size="sm" c="dimmed">Ordered 2 hours ago</Text>
                </div>
                <Badge color="orange">Processing</Badge>
              </Group>
              <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <div>
                  <Text fw={500}>Jane Smith - Lipid Panel</Text>
                  <Text size="sm" c="dimmed">Ordered 4 hours ago</Text>
                </div>
                <Badge color="blue">In Progress</Badge>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}