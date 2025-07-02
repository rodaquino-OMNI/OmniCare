'use client';

import { Card, Text, Stack, Button, Group, Badge, Select, Tabs } from '@mantine/core';
import { IconScan, IconDownload, IconEye, IconFileText } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ImagingResultsPage() {
  const [selectedStudy, setSelectedStudy] = useState('');

  const imagingStudies = [
    { 
      id: '1', 
      patient: 'John Doe', 
      study: 'CT Chest w/ Contrast',
      date: '2024-01-15',
      status: 'final',
      radiologist: 'Dr. Martinez',
      impression: 'No acute cardiopulmonary process',
      critical: false
    },
    { 
      id: '2', 
      patient: 'Jane Smith', 
      study: 'MRI Brain',
      date: '2024-01-14',
      status: 'preliminary',
      radiologist: 'Dr. Chen',
      impression: 'Preliminary read - awaiting final report',
      critical: false
    },
    { 
      id: '3', 
      patient: 'Robert Brown', 
      study: 'Chest X-Ray',
      date: '2024-01-14',
      status: 'final',
      radiologist: 'Dr. Martinez',
      impression: 'Possible pneumonia in right lower lobe',
      critical: true
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'radiology_tech']}>
      <AppLayout
        title="Imaging Results"
        subtitle="View radiology reports and imaging studies"
      >
        <Stack gap="lg">
          {/* Filters */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group>
              <Select
                placeholder="Filter by modality"
                data={[
                  { value: 'all', label: 'All Modalities' },
                  { value: 'xray', label: 'X-Ray' },
                  { value: 'ct', label: 'CT Scan' },
                  { value: 'mri', label: 'MRI' },
                  { value: 'ultrasound', label: 'Ultrasound' },
                ]}
                style={{ width: 200 }}
              />
              <Select
                placeholder="Filter by status"
                data={[
                  { value: 'all', label: 'All Status' },
                  { value: 'final', label: 'Final' },
                  { value: 'preliminary', label: 'Preliminary' },
                  { value: 'pending', label: 'Pending' },
                ]}
                style={{ width: 200 }}
              />
              <Select
                placeholder="Date range"
                data={[
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'Past Week' },
                  { value: 'month', label: 'Past Month' },
                  { value: 'all', label: 'All Time' },
                ]}
                defaultValue="week"
                style={{ width: 200 }}
              />
            </Group>
          </Card>

          {/* Studies List */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Imaging Studies</Text>
            <Stack gap="md">
              {imagingStudies.map((study) => (
                <Card
                  key={study.id}
                  shadow="xs"
                  padding="md"
                  radius="sm"
                  withBorder
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: selectedStudy === study.id ? '#f0f9ff' : undefined,
                    borderColor: study.critical ? '#ef4444' : undefined,
                  }}
                  onClick={() => setSelectedStudy(study.id)}
                >
                  <Group justify="space-between">
                    <div>
                      <Group gap="xs">
                        <IconScan size={20} />
                        <Text fw={500}>{study.study}</Text>
                        {study.critical && (
                          <Badge color="red" size="sm">Critical Finding</Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed">
                        {study.patient} • {study.date} • {study.radiologist}
                      </Text>
                    </div>
                    <Badge 
                      color={study.status === 'final' ? 'green' : 'yellow'} 
                      variant="light"
                    >
                      {study.status}
                    </Badge>
                  </Group>
                  <Text size="sm" mt="xs" c="dimmed">
                    <strong>Impression:</strong> {study.impression}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Card>

          {/* Study Details */}
          {selectedStudy && (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Tabs defaultValue="report">
                <Tabs.List>
                  <Tabs.Tab value="report" leftSection={<IconFileText size={16} />}>
                    Report
                  </Tabs.Tab>
                  <Tabs.Tab value="images" leftSection={<IconEye size={16} />}>
                    Images
                  </Tabs.Tab>
                  <Tabs.Tab value="comparison" leftSection={<IconScan size={16} />}>
                    Prior Studies
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="report" pt="md">
                  <Stack gap="md">
                    <div>
                      <Text size="sm" fw={600}>Clinical History:</Text>
                      <Text size="sm">Chest pain, shortness of breath</Text>
                    </div>
                    <div>
                      <Text size="sm" fw={600}>Technique:</Text>
                      <Text size="sm">CT chest with IV contrast</Text>
                    </div>
                    <div>
                      <Text size="sm" fw={600}>Findings:</Text>
                      <Text size="sm">
                        The lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.
                        The heart size is normal. No pericardial effusion. The thoracic aorta is normal in caliber.
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" fw={600}>Impression:</Text>
                      <Text size="sm">No acute cardiopulmonary process</Text>
                    </div>
                    <Group mt="md">
                      <Button leftSection={<IconDownload size={16} />} variant="light">
                        Download Report
                      </Button>
                      <Button leftSection={<IconEye size={16} />} variant="light">
                        View Images
                      </Button>
                    </Group>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="images" pt="md">
                  <Text c="dimmed">Image viewer would be integrated here</Text>
                </Tabs.Panel>

                <Tabs.Panel value="comparison" pt="md">
                  <Text c="dimmed">No prior studies available for comparison</Text>
                </Tabs.Panel>
              </Tabs>
            </Card>
          )}
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}