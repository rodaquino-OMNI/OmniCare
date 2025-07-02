'use client';

import { Card, Text, Stack, Button, Group, Select, Textarea, Radio, Badge } from '@mantine/core';
import { IconScan, IconSearch, IconActivity, IconBrain } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ImagingOrdersPage() {
  const [selectedModality, setSelectedModality] = useState('');
  const [selectedStudy, setSelectedStudy] = useState('');

  const imagingModalities = [
    {
      value: 'xray',
      label: 'X-Ray',
      icon: IconScan,
      studies: [
        { value: 'chest', label: 'Chest X-Ray' },
        { value: 'abdomen', label: 'Abdominal X-Ray' },
        { value: 'extremity', label: 'Extremity X-Ray' },
        { value: 'spine', label: 'Spine X-Ray' },
      ]
    },
    {
      value: 'ct',
      label: 'CT Scan',
      icon: IconScan,
      studies: [
        { value: 'ct-head', label: 'CT Head' },
        { value: 'ct-chest', label: 'CT Chest' },
        { value: 'ct-abdomen', label: 'CT Abdomen/Pelvis' },
        { value: 'ct-angio', label: 'CT Angiography' },
      ]
    },
    {
      value: 'mri',
      label: 'MRI',
      icon: IconBrain,
      studies: [
        { value: 'mri-brain', label: 'MRI Brain' },
        { value: 'mri-spine', label: 'MRI Spine' },
        { value: 'mri-knee', label: 'MRI Knee' },
        { value: 'mri-shoulder', label: 'MRI Shoulder' },
      ]
    },
    {
      value: 'ultrasound',
      label: 'Ultrasound',
      icon: IconScan,
      studies: [
        { value: 'us-abdomen', label: 'Abdominal Ultrasound' },
        { value: 'us-pelvis', label: 'Pelvic Ultrasound' },
        { value: 'us-doppler', label: 'Doppler Ultrasound' },
        { value: 'us-echo', label: 'Echocardiogram' },
      ]
    }
  ];

  const currentModality = imagingModalities.find(m => m.value === selectedModality);

  return (
    <ProtectedRoute requiredRoles={['physician']}>
      <AppLayout
        title="Imaging Orders"
        subtitle="Order radiology and imaging studies"
      >
        <Stack gap="lg">
          {/* Patient Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>Current Patient</Text>
                <Text size="sm" c="dimmed">Select a patient to order imaging studies</Text>
              </div>
              <Button leftSection={<IconSearch size={16} />}>
                Select Patient
              </Button>
            </Group>
          </Card>

          {/* Imaging Order Form */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Order Imaging Study</Text>
            
            <Stack gap="md">
              {/* Modality Selection */}
              <div>
                <Text size="sm" fw={500} mb="xs">Select Imaging Modality</Text>
                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                  {imagingModalities.map((modality) => (
                    <Card
                      key={modality.value}
                      shadow="xs"
                      padding="sm"
                      radius="sm"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedModality === modality.value ? '#f0f9ff' : undefined,
                        borderColor: selectedModality === modality.value ? '#3b82f6' : undefined,
                      }}
                      onClick={() => {
                        setSelectedModality(modality.value);
                        setSelectedStudy('');
                      }}
                    >
                      <Stack align="center" gap="xs">
                        <modality.icon size={24} />
                        <Text size="sm" fw={500}>{modality.label}</Text>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </div>

              {/* Study Selection */}
              {currentModality && (
                <Select
                  label="Select Study Type"
                  placeholder="Choose a specific study"
                  data={currentModality.studies}
                  value={selectedStudy}
                  onChange={(value) => setSelectedStudy(value || '')}
                />
              )}

              {/* Clinical Information */}
              <Textarea
                label="Clinical Indication"
                placeholder="Enter reason for imaging..."
                rows={3}
              />

              {/* Priority */}
              <Radio.Group
                label="Priority"
                defaultValue="routine"
              >
                <Group mt="xs">
                  <Radio value="routine" label="Routine" />
                  <Radio value="urgent" label="Urgent" />
                  <Radio value="stat" label="STAT" />
                </Group>
              </Radio.Group>

              {/* Additional Options */}
              <Select
                label="Contrast"
                placeholder="Select contrast option"
                data={[
                  { value: 'without', label: 'Without Contrast' },
                  { value: 'with', label: 'With Contrast' },
                  { value: 'with-without', label: 'With and Without Contrast' },
                ]}
              />

              <Group>
                <Button 
                  leftSection={<IconScan size={16} />}
                  disabled={!selectedModality || !selectedStudy}
                >
                  Submit Order
                </Button>
                <Button variant="light">
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Card>

          {/* Recent Orders */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Imaging Orders</Text>
            <Stack gap="xs">
              <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e0e0e0' }}>
                <div>
                  <Text fw={500}>John Doe - CT Chest</Text>
                  <Text size="sm" c="dimmed">Ordered 1 hour ago • Dr. Smith</Text>
                </div>
                <Badge color="yellow">Scheduled</Badge>
              </Group>
              <Group justify="space-between" p="sm">
                <div>
                  <Text fw={500}>Jane Smith - MRI Brain</Text>
                  <Text size="sm" c="dimmed">Ordered 3 hours ago • Dr. Johnson</Text>
                </div>
                <Badge color="green">Completed</Badge>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { SimpleGrid } from '@mantine/core';