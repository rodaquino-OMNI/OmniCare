'use client';

import { Card, Text, Stack, Button, Group, Select, Textarea, Badge } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconHeartRateMonitor, IconSearch, IconCalendar, IconClock } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ProcedureOrdersPage() {
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const procedureCategories = [
    {
      category: 'Diagnostic Procedures',
      procedures: [
        { value: 'colonoscopy', label: 'Colonoscopy' },
        { value: 'endoscopy', label: 'Upper Endoscopy' },
        { value: 'bronchoscopy', label: 'Bronchoscopy' },
        { value: 'biopsy', label: 'Tissue Biopsy' },
      ]
    },
    {
      category: 'Cardiac Procedures',
      procedures: [
        { value: 'ecg', label: 'Electrocardiogram (ECG)' },
        { value: 'stress-test', label: 'Cardiac Stress Test' },
        { value: 'holter', label: 'Holter Monitor' },
        { value: 'cath', label: 'Cardiac Catheterization' },
      ]
    },
    {
      category: 'Minor Surgical Procedures',
      procedures: [
        { value: 'suture', label: 'Wound Suturing' },
        { value: 'excision', label: 'Lesion Excision' },
        { value: 'drainage', label: 'Incision and Drainage' },
        { value: 'cast', label: 'Cast Application' },
      ]
    }
  ];

  return (
    <ProtectedRoute requiredRoles={['physician']}>
      <AppLayout
        title="Procedure Orders"
        subtitle="Schedule and manage procedural orders"
      >
        <Stack gap="lg">
          {/* Patient Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>Current Patient</Text>
                <Text size="sm" c="dimmed">Select a patient to order procedures</Text>
              </div>
              <Button leftSection={<IconSearch size={16} />}>
                Select Patient
              </Button>
            </Group>
          </Card>

          {/* Procedure Order Form */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Order Procedure</Text>
            
            <Stack gap="md">
              <Select
                label="Select Procedure"
                placeholder="Choose a procedure"
                leftSection={<IconHeartRateMonitor size={16} />}
                value={selectedProcedure}
                onChange={(val) => setSelectedProcedure(val || '')}
                data={procedureCategories.map(cat => ({
                  group: cat.category,
                  items: cat.procedures
                }))}
              />

              <Group grow>
                <DatePicker
                  label="Preferred Date"
                  placeholder="Select date"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  leftSection={<IconCalendar size={16} />}
                />
                <Select
                  label="Time Preference"
                  placeholder="Select time"
                  leftSection={<IconClock size={16} />}
                  data={[
                    { value: 'morning', label: 'Morning (8 AM - 12 PM)' },
                    { value: 'afternoon', label: 'Afternoon (12 PM - 5 PM)' },
                    { value: 'anytime', label: 'Any available time' },
                  ]}
                />
              </Group>

              <Select
                label="Priority"
                placeholder="Select priority"
                data={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'urgent', label: 'Urgent (within 48 hours)' },
                  { value: 'emergent', label: 'Emergent (ASAP)' },
                ]}
                defaultValue="routine"
              />

              <Select
                label="Location"
                placeholder="Select location"
                data={[
                  { value: 'main-or', label: 'Main Operating Room' },
                  { value: 'procedure-room', label: 'Procedure Room' },
                  { value: 'bedside', label: 'Bedside' },
                  { value: 'clinic', label: 'Outpatient Clinic' },
                ]}
              />

              <Textarea
                label="Clinical Indication"
                placeholder="Reason for procedure and relevant clinical history..."
                rows={4}
              />

              <Textarea
                label="Special Instructions"
                placeholder="Pre-procedure prep, sedation preferences, etc..."
                rows={3}
              />

              {/* Pre-procedure Requirements */}
              <Card shadow="xs" padding="sm" radius="sm" withBorder>
                <Text size="sm" fw={500} mb="xs">Pre-procedure Requirements</Text>
                <Stack gap="xs">
                  <Text size="sm">• NPO after midnight</Text>
                  <Text size="sm">• Stop anticoagulation 48 hours prior</Text>
                  <Text size="sm">• Obtain consent form</Text>
                  <Text size="sm">• Pre-procedure labs required</Text>
                </Stack>
              </Card>

              <Group>
                <Button leftSection={<IconHeartRateMonitor size={16} />}>
                  Submit Order
                </Button>
                <Button variant="light">
                  Save Draft
                </Button>
                <Button variant="subtle">
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Card>

          {/* Scheduled Procedures */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Scheduled Procedures</Text>
            <Stack gap="xs">
              <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <div>
                  <Text fw={500}>John Doe - Colonoscopy</Text>
                  <Text size="sm" c="dimmed">Scheduled for Jan 20, 2024 at 9:00 AM</Text>
                </div>
                <Badge color="blue">Scheduled</Badge>
              </Group>
              <Group justify="space-between" p="sm">
                <div>
                  <Text fw={500}>Jane Smith - Upper Endoscopy</Text>
                  <Text size="sm" c="dimmed">Scheduled for Jan 22, 2024 at 2:00 PM</Text>
                </div>
                <Badge color="yellow">Pending Prep</Badge>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}