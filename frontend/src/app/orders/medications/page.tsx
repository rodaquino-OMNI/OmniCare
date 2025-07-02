'use client';

import { Card, Text, Stack, Button, Group, TextInput, Select, NumberInput, Textarea } from '@mantine/core';
import { IconPill, IconSearch, IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function MedicationOrdersPage() {
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [route, setRoute] = useState('');

  return (
    <ProtectedRoute requiredRoles={['physician']}>
      <AppLayout
        title="Medication Orders"
        subtitle="Prescribe medications and manage orders"
      >
        <Stack gap="lg">
          {/* Patient Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>Current Patient</Text>
                <Text size="sm" c="dimmed">Select a patient to prescribe medications</Text>
              </div>
              <Button leftSection={<IconSearch size={16} />}>
                Select Patient
              </Button>
            </Group>
          </Card>

          {/* Medication Order Form */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">New Medication Order</Text>
            
            <Stack gap="md">
              <TextInput
                label="Medication"
                placeholder="Search for medication..."
                leftSection={<IconPill size={16} />}
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
              />

              <Group grow>
                <NumberInput
                  label="Dose"
                  placeholder="Enter dose"
                  value={dose}
                  onChange={(val) => setDose(String(val))}
                />
                <Select
                  label="Unit"
                  placeholder="Select unit"
                  data={[
                    { value: 'mg', label: 'mg' },
                    { value: 'mcg', label: 'mcg' },
                    { value: 'g', label: 'g' },
                    { value: 'ml', label: 'mL' },
                    { value: 'units', label: 'units' },
                  ]}
                />
              </Group>

              <Select
                label="Route"
                placeholder="Select route"
                value={route}
                onChange={(val) => setRoute(val || '')}
                data={[
                  { value: 'po', label: 'By mouth (PO)' },
                  { value: 'iv', label: 'Intravenous (IV)' },
                  { value: 'im', label: 'Intramuscular (IM)' },
                  { value: 'subq', label: 'Subcutaneous (SubQ)' },
                  { value: 'topical', label: 'Topical' },
                  { value: 'inhaled', label: 'Inhaled' },
                ]}
              />

              <Select
                label="Frequency"
                placeholder="Select frequency"
                value={frequency}
                onChange={(val) => setFrequency(val || '')}
                data={[
                  { value: 'qd', label: 'Once daily (QD)' },
                  { value: 'bid', label: 'Twice daily (BID)' },
                  { value: 'tid', label: 'Three times daily (TID)' },
                  { value: 'qid', label: 'Four times daily (QID)' },
                  { value: 'q4h', label: 'Every 4 hours' },
                  { value: 'q6h', label: 'Every 6 hours' },
                  { value: 'q8h', label: 'Every 8 hours' },
                  { value: 'q12h', label: 'Every 12 hours' },
                  { value: 'prn', label: 'As needed (PRN)' },
                ]}
              />

              <Select
                label="Duration"
                placeholder="Select duration"
                data={[
                  { value: '3days', label: '3 days' },
                  { value: '5days', label: '5 days' },
                  { value: '7days', label: '7 days' },
                  { value: '10days', label: '10 days' },
                  { value: '14days', label: '14 days' },
                  { value: '30days', label: '30 days' },
                  { value: '90days', label: '90 days' },
                  { value: 'ongoing', label: 'Ongoing' },
                ]}
              />

              <Textarea
                label="Instructions"
                placeholder="Special instructions or notes..."
                rows={3}
              />

              {/* Drug Interaction Alert */}
              <Card shadow="xs" padding="sm" radius="sm" withBorder style={{ backgroundColor: '#fef3c7' }}>
                <Group gap="xs">
                  <IconAlertCircle size={20} className="text-yellow-600" />
                  <Text size="sm" fw={500}>Drug Interaction Check</Text>
                </Group>
                <Text size="sm" c="dimmed" mt="xs">
                  No interactions found with current medications
                </Text>
              </Card>

              <Group>
                <Button leftSection={<IconPill size={16} />}>
                  Submit Order
                </Button>
                <Button variant="light">
                  Save as Draft
                </Button>
                <Button variant="subtle">
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Card>

          {/* Current Medications */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Current Medications</Text>
            <Text size="sm" c="dimmed">Select a patient to view current medications</Text>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}