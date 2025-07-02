'use client';

import { Card, Text, Stack, SimpleGrid, Group, Button, TextInput, Select, NumberInput } from '@mantine/core';
import { IconHeartbeat, IconTemperature, IconLungs, IconActivity } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function VitalSignsPage() {
  const [vitals, setVitals] = useState({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
  });

  return (
    <ProtectedRoute requiredRoles={['nurse']}>
      <AppLayout
        title="Vital Signs"
        subtitle="Record and monitor patient vital signs"
      >
        <Stack gap="lg">
          {/* Current Patient Info */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>Current Patient</Text>
                <Text size="sm" c="dimmed">Select a patient to record vital signs</Text>
              </div>
              <Button>Select Patient</Button>
            </Group>
          </Card>

          {/* Vital Signs Input Form */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Record Vital Signs</Text>
            
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="sm">
                <Text size="sm" fw={500}>Blood Pressure</Text>
                <Group gap="xs">
                  <NumberInput
                    placeholder="Systolic"
                    value={vitals.bloodPressureSystolic}
                    onChange={(val) => setVitals({ ...vitals, bloodPressureSystolic: String(val) })}
                    min={0}
                    max={300}
                    style={{ flex: 1 }}
                  />
                  <Text>/</Text>
                  <NumberInput
                    placeholder="Diastolic"
                    value={vitals.bloodPressureDiastolic}
                    onChange={(val) => setVitals({ ...vitals, bloodPressureDiastolic: String(val) })}
                    min={0}
                    max={200}
                    style={{ flex: 1 }}
                  />
                  <Text size="sm" c="dimmed">mmHg</Text>
                </Group>
              </Stack>

              <NumberInput
                label="Heart Rate"
                placeholder="Enter heart rate"
                value={vitals.heartRate}
                onChange={(val) => setVitals({ ...vitals, heartRate: String(val) })}
                suffix=" bpm"
                min={0}
                max={300}
                leftSection={<IconHeartbeat size={16} />}
              />

              <NumberInput
                label="Temperature"
                placeholder="Enter temperature"
                value={vitals.temperature}
                onChange={(val) => setVitals({ ...vitals, temperature: String(val) })}
                suffix=" °F"
                precision={1}
                step={0.1}
                min={90}
                max={110}
                leftSection={<IconTemperature size={16} />}
              />

              <NumberInput
                label="Respiratory Rate"
                placeholder="Enter respiratory rate"
                value={vitals.respiratoryRate}
                onChange={(val) => setVitals({ ...vitals, respiratoryRate: String(val) })}
                suffix=" /min"
                min={0}
                max={60}
                leftSection={<IconLungs size={16} />}
              />

              <NumberInput
                label="Oxygen Saturation"
                placeholder="Enter O2 saturation"
                value={vitals.oxygenSaturation}
                onChange={(val) => setVitals({ ...vitals, oxygenSaturation: String(val) })}
                suffix=" %"
                min={0}
                max={100}
                leftSection={<IconActivity size={16} />}
              />

              <NumberInput
                label="Weight"
                placeholder="Enter weight"
                value={vitals.weight}
                onChange={(val) => setVitals({ ...vitals, weight: String(val) })}
                suffix=" lbs"
                min={0}
                precision={1}
                step={0.1}
              />

              <NumberInput
                label="Height"
                placeholder="Enter height"
                value={vitals.height}
                onChange={(val) => setVitals({ ...vitals, height: String(val) })}
                suffix=" in"
                min={0}
              />

              <Select
                label="Pain Scale"
                placeholder="Select pain level"
                data={[
                  { value: '0', label: '0 - No pain' },
                  { value: '1', label: '1 - Minimal' },
                  { value: '2', label: '2 - Mild' },
                  { value: '3', label: '3 - Uncomfortable' },
                  { value: '4', label: '4 - Moderate' },
                  { value: '5', label: '5 - Distracting' },
                  { value: '6', label: '6 - Distressing' },
                  { value: '7', label: '7 - Severe' },
                  { value: '8', label: '8 - Intense' },
                  { value: '9', label: '9 - Excruciating' },
                  { value: '10', label: '10 - Unbearable' },
                ]}
              />
            </SimpleGrid>

            <Group mt="xl">
              <Button>Save Vital Signs</Button>
              <Button variant="light">Clear</Button>
            </Group>
          </Card>

          {/* Recent Vitals Summary */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Vital Signs History</Text>
            <Text size="sm" c="dimmed">No vital signs recorded yet. Select a patient to view history.</Text>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}