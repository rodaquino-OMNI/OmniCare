import type { Meta, StoryObj } from '@storybook/react';
import { SimpleGrid, Stack, Text } from '@mantine/core';
import { VitalSignCard, VitalSignData } from '../design-system/components/VitalSignCard';

const meta: Meta<typeof VitalSignCard> = {
  title: 'Medical/VitalSignCard',
  component: VitalSignCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Display component for patient vital signs with status indicators, trend visualization, and accessibility features. Optimized for clinical workflows and quick assessment.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showTrend: {
      control: 'boolean',
      description: 'Show trend indicator',
    },
    showRange: {
      control: 'boolean',
      description: 'Show normal range',
    },
    showTimestamp: {
      control: 'boolean',
      description: 'Show timestamp',
    },
    compact: {
      control: 'boolean',
      description: 'Compact display mode',
    },
  },
};

export default meta;
type Story = StoryObj<typeof VitalSignCard>;

// Sample vital signs data
const sampleVitals: Record<string, VitalSignData> = {
  bloodPressure: {
    type: 'blood-pressure',
    value: '140/90',
    systolic: 140,
    diastolic: 90,
    unit: 'mmHg',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    normalRange: { min: 120, max: 80 },
    status: 'elevated',
    trend: 'up',
    previousValue: 130,
    notes: 'Patient reports feeling anxious',
  },
  heartRate: {
    type: 'heart-rate',
    value: 72,
    unit: 'bpm',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    normalRange: { min: 60, max: 100 },
    status: 'normal',
    trend: 'stable',
    previousValue: 74,
  },
  temperature: {
    type: 'temperature',
    value: 101.2,
    unit: '°F',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    normalRange: { min: 97, max: 99.5 },
    status: 'high',
    trend: 'up',
    previousValue: 100.8,
    notes: 'Fever trending upward',
  },
  oxygenSaturation: {
    type: 'oxygen-saturation',
    value: 94,
    unit: '%',
    timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    normalRange: { min: 95, max: 100 },
    status: 'low',
    trend: 'down',
    previousValue: 96,
    notes: 'On 2L O2 via nasal cannula',
  },
  respiratoryRate: {
    type: 'respiratory-rate',
    value: 18,
    unit: '/min',
    timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
    normalRange: { min: 12, max: 20 },
    status: 'normal',
    trend: 'stable',
    previousValue: 18,
  },
  weight: {
    type: 'weight',
    value: 165,
    unit: 'lbs',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'normal',
    trend: 'stable',
    previousValue: 164,
  },
};

// Basic Examples
export const Default: Story = {
  args: {
    data: sampleVitals.heartRate,
    showTrend: true,
    showRange: true,
    showTimestamp: true,
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    data: sampleVitals.heartRate,
    compact: true,
  },
};

export const WithAlert: Story = {
  args: {
    data: sampleVitals.temperature,
    showTrend: true,
    showRange: true,
    showTimestamp: true,
  },
};

export const BloodPressure: Story = {
  args: {
    data: sampleVitals.bloodPressure,
    showTrend: true,
    showRange: true,
    showTimestamp: true,
  },
};

// All Vital Signs
export const AllVitalSigns: Story = {
  render: () => (
    <Stack spacing="xl">
      <Text size="xl" weight={700}>Patient Vital Signs Dashboard</Text>
      <SimpleGrid cols={3} spacing="md" breakpoints={[
        { maxWidth: 'md', cols: 2 },
        { maxWidth: 'sm', cols: 1 },
      ]}>
        <VitalSignCard data={sampleVitals.bloodPressure} />
        <VitalSignCard data={sampleVitals.heartRate} />
        <VitalSignCard data={sampleVitals.temperature} />
        <VitalSignCard data={sampleVitals.respiratoryRate} />
        <VitalSignCard data={sampleVitals.oxygenSaturation} />
        <VitalSignCard data={sampleVitals.weight} />
      </SimpleGrid>
    </Stack>
  ),
};

// Status Variations
export const StatusVariations: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Status Variations</Text>
      <SimpleGrid cols={2} spacing="md">
        <VitalSignCard 
          data={{
            ...sampleVitals.heartRate,
            status: 'normal',
            value: 72,
          }}
        />
        <VitalSignCard 
          data={{
            ...sampleVitals.heartRate,
            status: 'elevated',
            value: 105,
            trend: 'up',
          }}
        />
        <VitalSignCard 
          data={{
            ...sampleVitals.heartRate,
            status: 'high',
            value: 140,
            trend: 'up',
            notes: 'Sustained tachycardia',
          }}
        />
        <VitalSignCard 
          data={{
            ...sampleVitals.heartRate,
            status: 'low',
            value: 45,
            trend: 'down',
            notes: 'Bradycardia - monitor closely',
          }}
        />
      </SimpleGrid>
    </Stack>
  ),
};

// Trend Indicators
export const TrendIndicators: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Trend Indicators</Text>
      <SimpleGrid cols={3} spacing="md">
        <VitalSignCard 
          data={{
            ...sampleVitals.temperature,
            trend: 'up',
            status: 'elevated',
            notes: 'Trending upward',
          }}
        />
        <VitalSignCard 
          data={{
            ...sampleVitals.heartRate,
            trend: 'stable',
            status: 'normal',
            notes: 'Stable',
          }}
        />
        <VitalSignCard 
          data={{
            ...sampleVitals.oxygenSaturation,
            trend: 'down',
            status: 'low',
            notes: 'Declining - reassess',
          }}
        />
      </SimpleGrid>
    </Stack>
  ),
};

// Compact Layout
export const CompactLayout: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Compact Layout for Mobile/Sidebar</Text>
      <SimpleGrid cols={2} spacing="sm">
        <VitalSignCard data={sampleVitals.bloodPressure} compact />
        <VitalSignCard data={sampleVitals.heartRate} compact />
        <VitalSignCard data={sampleVitals.temperature} compact />
        <VitalSignCard data={sampleVitals.oxygenSaturation} compact />
      </SimpleGrid>
    </Stack>
  ),
};

// Critical Values
export const CriticalValues: Story = {
  render: () => (
    <Stack spacing="md">
      <Text size="lg" weight={600}>Critical Values Alert</Text>
      <Text size="sm" color="dimmed">
        These vital signs require immediate attention and trigger clinical alerts.
      </Text>
      <SimpleGrid cols={2} spacing="md">
        <VitalSignCard 
          data={{
            type: 'temperature',
            value: 103.8,
            unit: '°F',
            timestamp: new Date(),
            status: 'critical',
            trend: 'up',
            notes: 'CRITICAL: High fever - immediate intervention needed',
          }}
        />
        <VitalSignCard 
          data={{
            type: 'oxygen-saturation',
            value: 88,
            unit: '%',
            timestamp: new Date(),
            status: 'critical',
            trend: 'down',
            notes: 'CRITICAL: Severe hypoxemia',
          }}
        />
        <VitalSignCard 
          data={{
            type: 'blood-pressure',
            value: '220/120',
            systolic: 220,
            diastolic: 120,
            unit: 'mmHg',
            timestamp: new Date(),
            status: 'critical',
            trend: 'up',
            notes: 'CRITICAL: Hypertensive crisis',
          }}
        />
        <VitalSignCard 
          data={{
            type: 'heart-rate',
            value: 180,
            unit: 'bpm',
            timestamp: new Date(),
            status: 'critical',
            trend: 'up',
            notes: 'CRITICAL: Severe tachycardia',
          }}
        />
      </SimpleGrid>
    </Stack>
  ),
};

// Interactive Example
export const Interactive: Story = {
  render: () => {
    const handleCardClick = (vitalType: string) => {
      alert(`Clicked on ${vitalType} - would open detailed view`);
    };

    return (
      <Stack spacing="md">
        <Text size="lg" weight={600}>Interactive Vital Signs (Click to View Details)</Text>
        <SimpleGrid cols={3} spacing="md">
          <VitalSignCard 
            data={sampleVitals.bloodPressure} 
            onClick={() => handleCardClick('Blood Pressure')}
          />
          <VitalSignCard 
            data={sampleVitals.heartRate} 
            onClick={() => handleCardClick('Heart Rate')}
          />
          <VitalSignCard 
            data={sampleVitals.temperature} 
            onClick={() => handleCardClick('Temperature')}
          />
        </SimpleGrid>
      </Stack>
    );
  },
};

// Mobile Responsive
export const MobileResponsive: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
  render: () => (
    <Stack spacing="sm">
      <Text size="lg" weight={600}>Mobile View</Text>
      <VitalSignCard data={sampleVitals.bloodPressure} compact />
      <VitalSignCard data={sampleVitals.heartRate} compact />
      <VitalSignCard data={sampleVitals.temperature} compact />
    </Stack>
  ),
};