'use client';

import { Card, Text, Stack, Button, Group, Badge, Timeline, Tabs } from '@mantine/core';
import { IconPlus, IconFileText, IconCalendar, IconUser, IconTarget } from '@tabler/icons-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function CarePlansPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse']}>
      <AppLayout
        title="Care Plans"
        subtitle="Manage patient care plans and treatment goals"
      >
        <Stack gap="lg">
          {/* Active Care Plans Summary */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>Active Care Plans</Text>
              <Button leftSection={<IconPlus size={16} />}>
                Create Care Plan
              </Button>
            </Group>
            
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>Diabetes Management</Text>
                    <Badge size="sm" color="green">Active</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">John Doe - Started 3 months ago</Text>
                  <Text size="xs">Goals: 4/6 completed</Text>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>Post-Surgery Recovery</Text>
                    <Badge size="sm" color="yellow">In Progress</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">Jane Smith - Started 2 weeks ago</Text>
                  <Text size="xs">Goals: 2/5 completed</Text>
                </Stack>
              </Card>
              
              <Card shadow="xs" padding="md" radius="sm" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>Hypertension Control</Text>
                    <Badge size="sm" color="blue">Monitoring</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">Robert Brown - Started 1 month ago</Text>
                  <Text size="xs">Goals: 3/4 completed</Text>
                </Stack>
              </Card>
            </SimpleGrid>
          </Card>

          {/* Care Plan Details */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Tabs defaultValue="overview">
              <Tabs.List>
                <Tabs.Tab value="overview" leftSection={<IconFileText size={16} />}>
                  Overview
                </Tabs.Tab>
                <Tabs.Tab value="goals" leftSection={<IconTarget size={16} />}>
                  Goals & Interventions
                </Tabs.Tab>
                <Tabs.Tab value="timeline" leftSection={<IconCalendar size={16} />}>
                  Timeline
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="overview" pt="md">
                <Stack gap="md">
                  <Text size="lg" fw={600}>Select a care plan to view details</Text>
                  <Text c="dimmed">
                    Choose from the active care plans above or create a new care plan for a patient.
                  </Text>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="goals" pt="md">
                <Text c="dimmed">No care plan selected</Text>
              </Tabs.Panel>

              <Tabs.Panel value="timeline" pt="md">
                <Timeline active={1} bulletSize={24} lineWidth={2}>
                  <Timeline.Item bullet={<IconUser size={12} />} title="Initial Assessment">
                    <Text c="dimmed" size="sm">Patient evaluated and care plan initiated</Text>
                    <Text size="xs" mt={4}>2 weeks ago</Text>
                  </Timeline.Item>

                  <Timeline.Item bullet={<IconFileText size={12} />} title="Goals Established">
                    <Text c="dimmed" size="sm">Treatment goals and interventions defined</Text>
                    <Text size="xs" mt={4}>1 week ago</Text>
                  </Timeline.Item>

                  <Timeline.Item title="First Follow-up" lineVariant="dashed">
                    <Text c="dimmed" size="sm">Scheduled for next week</Text>
                  </Timeline.Item>
                </Timeline>
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}

import { SimpleGrid } from '@mantine/core';