import type { Meta, StoryObj } from '@storybook/react';
import { Group, Stack, Text } from '@mantine/core';
import { MedicalBadge } from '../design-system/components/MedicalBadge';

const meta: Meta<typeof MedicalBadge> = {
  title: 'Medical/MedicalBadge',
  component: MedicalBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Healthcare-specific badge component for displaying medical statuses, lab results, vital signs, and other clinical indicators. Designed for accessibility and clear visual hierarchy.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['normal', 'abnormal', 'critical', 'pending', 'elevated', 'high', 'low'],
      description: 'Medical status type that determines color and styling',
    },
    category: {
      control: 'select',
      options: ['lab', 'vital', 'medication', 'general'],
      description: 'Badge category for different medical contexts',
    },
    priority: {
      control: 'select',
      options: ['low', 'medium', 'high', 'urgent', 'stat'],
      description: 'Priority level for urgent items',
    },
    showIcon: {
      control: 'boolean',
      description: 'Show icon indicator',
    },
    pulse: {
      control: 'boolean',
      description: 'Make badge pulsing for critical alerts',
    },
    label: {
      control: 'text',
      description: 'Optional custom label',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MedicalBadge>;

// Basic Examples
export const Default: Story = {
  args: {
    status: 'normal',
    showIcon: true,
  },
};

export const Critical: Story = {
  args: {
    status: 'critical',
    showIcon: true,
    pulse: true,
  },
};

export const WithPriority: Story = {
  args: {
    status: 'abnormal',
    priority: 'urgent',
    showIcon: true,
  },
};

export const CustomLabel: Story = {
  args: {
    status: 'normal',
    label: 'Within Range',
    showIcon: true,
  },
};

// All Statuses
export const AllStatuses: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>All Medical Badge Statuses</Text>
      <Group spacing="md">
        <MedicalBadge status="normal" showIcon />
        <MedicalBadge status="abnormal" showIcon />
        <MedicalBadge status="critical" showIcon />
        <MedicalBadge status="pending" showIcon />
        <MedicalBadge status="elevated" showIcon />
        <MedicalBadge status="high" showIcon />
        <MedicalBadge status="low" showIcon />
      </Group>
    </Stack>
  ),
};

// By Category
export const LabResults: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Lab Results</Text>
      <Group spacing="md">
        <MedicalBadge status="normal" category="lab" showIcon />
        <MedicalBadge status="abnormal" category="lab" showIcon />
        <MedicalBadge status="critical" category="lab" showIcon />
        <MedicalBadge status="pending" category="lab" showIcon />
      </Group>
    </Stack>
  ),
};

export const VitalSigns: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Vital Signs</Text>
      <Group spacing="md">
        <MedicalBadge status="normal" category="vital" showIcon />
        <MedicalBadge status="elevated" category="vital" showIcon />
        <MedicalBadge status="high" category="vital" showIcon />
        <MedicalBadge status="low" category="vital" showIcon />
      </Group>
    </Stack>
  ),
};

export const Medications: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Medications</Text>
      <Group spacing="md">
        <MedicalBadge status="normal" category="medication" label="Active" showIcon />
        <MedicalBadge status="abnormal" category="medication" label="Interaction" showIcon />
        <MedicalBadge status="critical" category="medication" label="Allergy" showIcon pulse />
      </Group>
    </Stack>
  ),
};

// Priority Levels
export const PriorityLevels: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Priority Levels</Text>
      <Group spacing="md">
        <MedicalBadge status="normal" priority="low" showIcon />
        <MedicalBadge status="abnormal" priority="medium" showIcon />
        <MedicalBadge status="abnormal" priority="high" showIcon />
        <MedicalBadge status="critical" priority="urgent" showIcon />
        <MedicalBadge status="critical" priority="stat" showIcon pulse />
      </Group>
    </Stack>
  ),
};

// Healthcare Use Cases
export const HealthcareUseCases: Story = {
  render: () => (
    <Stack spacing="xl">
      <div>
        <Text size="lg" weight={600} mb="md">Patient Chart Example</Text>
        <Group spacing="sm">
          <Text size="sm">Blood Pressure:</Text>
          <MedicalBadge status="elevated" category="vital" showIcon />
          <Text size="sm">Glucose:</Text>
          <MedicalBadge status="high" category="lab" showIcon />
          <Text size="sm">Warfarin:</Text>
          <MedicalBadge status="critical" category="medication" label="Critical Alert" showIcon pulse />
        </Group>
      </div>
      
      <div>
        <Text size="lg" weight={600} mb="md">Lab Results Dashboard</Text>
        <Group spacing="sm">
          <MedicalBadge status="normal" category="lab" label="CBC" />
          <MedicalBadge status="abnormal" category="lab" label="Lipids" showIcon />
          <MedicalBadge status="critical" category="lab" label="Troponin" showIcon pulse />
          <MedicalBadge status="pending" category="lab" label="Cultures" />
        </Group>
      </div>
      
      <div>
        <Text size="lg" weight={600} mb="md">Medication Safety</Text>
        <Group spacing="sm">
          <MedicalBadge status="normal" category="medication" label="Aspirin" />
          <MedicalBadge status="abnormal" category="medication" label="Drug Interaction" showIcon />
          <MedicalBadge status="critical" category="medication" label="Penicillin Allergy" showIcon pulse />
        </Group>
      </div>
    </Stack>
  ),
};

// Accessibility Examples
export const AccessibilityFeatures: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Accessibility Features</Text>
      <Text size="sm" color="dimmed">
        These badges include proper ARIA labels, roles, and keyboard navigation support.
        Critical badges use assertive aria-live regions for screen readers.
      </Text>
      <Group spacing="md">
        <MedicalBadge 
          status="critical" 
          showIcon 
          pulse 
          ariaDescription="Critical lab value requiring immediate attention"
        />
        <MedicalBadge 
          status="normal" 
          showIcon 
          ariaDescription="Lab value within normal limits"
        />
        <MedicalBadge 
          status="pending" 
          showIcon 
          ariaDescription="Lab result pending, check back in 2 hours"
        />
      </Group>
    </Stack>
  ),
};