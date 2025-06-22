import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Text, Button } from '@mantine/core';
import { ClinicalAlert } from '../design-system/components/ClinicalAlert';

const meta: Meta<typeof ClinicalAlert> = {
  title: 'Medical/ClinicalAlert',
  component: ClinicalAlert,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Healthcare-specific alert component for displaying critical medical information, drug interactions, patient safety alerts, and clinical decision support. Designed to meet clinical workflow needs and safety requirements.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['info', 'warning', 'error', 'critical', 'drug-interaction', 'allergy', 'safety'],
      description: 'Alert type determines color and urgency',
    },
    priority: {
      control: 'select',
      options: ['low', 'medium', 'high', 'urgent', 'stat'],
      description: 'Alert priority level',
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether alert can be dismissed',
    },
    requiresAcknowledgment: {
      control: 'boolean',
      description: 'Whether alert requires acknowledgment',
    },
    pulse: {
      control: 'boolean',
      description: 'Show pulsing animation for critical alerts',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ClinicalAlert>;

// Basic Examples
export const Default: Story = {
  args: {
    type: 'info',
    title: 'Lab Results Available',
    message: 'New laboratory results are available for review in the patient chart.',
    timestamp: new Date(),
    source: 'Laboratory System',
  },
};

export const CriticalAlert: Story = {
  args: {
    type: 'critical',
    title: 'Critical Lab Value',
    message: 'Troponin level is critically elevated at 15.2 ng/mL (Normal: <0.04 ng/mL). Immediate cardiology consultation recommended.',
    priority: 'stat',
    timestamp: new Date(),
    source: 'Laboratory System',
    patientContext: {
      name: 'John Smith',
      id: 'MRN-123456',
      room: '302A',
    },
    requiresAcknowledgment: true,
    pulse: true,
    actions: [
      {
        label: 'Order Cardiology Consult',
        action: () => alert('Cardiology consult ordered'),
        variant: 'primary',
      },
      {
        label: 'View Full Results',
        action: () => alert('Opening lab results'),
        variant: 'secondary',
      },
    ],
  },
};

export const DrugInteraction: Story = {
  args: {
    type: 'drug-interaction',
    title: 'Drug Interaction Warning',
    message: 'Potential interaction between prescribed Warfarin and newly ordered Amiodarone. Risk of increased bleeding.',
    priority: 'high',
    timestamp: new Date(),
    source: 'Medication System',
    patientContext: {
      name: 'Jane Doe',
      id: 'MRN-789012',
      room: '415B',
    },
    requiresAcknowledgment: true,
    details: 'Amiodarone may increase the anticoagulant effect of Warfarin by inhibiting CYP2C9 enzyme.',
    reference: {
      title: 'Drug Interaction Database',
      url: 'https://example.com/drug-interactions',
    },
    actions: [
      {
        label: 'Adjust Warfarin Dose',
        action: () => alert('Opening dose adjustment'),
        variant: 'primary',
      },
      {
        label: 'Select Alternative',
        action: () => alert('Opening alternative medications'),
        variant: 'secondary',
      },
      {
        label: 'Override (Requires Justification)',
        action: () => alert('Opening override form'),
        variant: 'danger',
      },
    ],
  },
};

export const AllergyAlert: Story = {
  args: {
    type: 'allergy',
    title: 'ALLERGY ALERT',
    message: 'Patient has documented severe allergy to Penicillin. Prescribed Amoxicillin contains penicillin.',
    priority: 'stat',
    timestamp: new Date(),
    source: 'E-Prescribing System',
    patientContext: {
      name: 'Robert Johnson',
      id: 'MRN-345678',
      room: '218C',
    },
    requiresAcknowledgment: true,
    pulse: true,
    details: 'Previous reaction: Anaphylaxis (2019). Alternative antibiotics recommended.',
    actions: [
      {
        label: 'Cancel Prescription',
        action: () => alert('Prescription cancelled'),
        variant: 'danger',
      },
      {
        label: 'Select Alternative Antibiotic',
        action: () => alert('Opening alternatives'),
        variant: 'primary',
      },
    ],
  },
};

// All Alert Types
export const AllAlertTypes: Story = {
  render: () => (
    <Stack gap="lg" style={{ maxWidth: '800px' }}>
      <Text size="xl" fw={700}>Clinical Alert Types</Text>
      
      <ClinicalAlert
        type="info"
        title="Information Alert"
        message="Patient education materials have been updated and are available for review."
        timestamp={new Date()}
        source="Patient Education System"
      />
      
      <ClinicalAlert
        type="warning"
        title="Medication Due"
        message="Patient is 30 minutes overdue for scheduled medication administration."
        priority="medium"
        timestamp={new Date()}
        source="Medication Administration"
        actions={[
          {
            label: 'Administer Now',
            action: () => alert('Recording administration'),
            variant: 'primary',
          },
          {
            label: 'Document Reason for Delay',
            action: () => alert('Opening documentation'),
            variant: 'secondary',
          },
        ]}
      />
      
      <ClinicalAlert
        type="error"
        title="System Error"
        message="Unable to connect to laboratory system. Lab results may be delayed."
        priority="high"
        timestamp={new Date()}
        source="System Monitor"
        actions={[
          {
            label: 'Contact IT Support',
            action: () => alert('Contacting IT'),
            variant: 'primary',
          },
        ]}
      />
      
      <ClinicalAlert
        type="safety"
        title="Fall Risk Assessment Due"
        message="Patient fall risk assessment is overdue. Last assessment completed 72 hours ago."
        priority="medium"
        timestamp={new Date()}
        source="Safety Monitoring System"
        patientContext={{
          name: 'Mary Wilson',
          id: 'MRN-567890',
          room: '104A',
        }}
        actions={[
          {
            label: 'Complete Assessment',
            action: () => alert('Opening fall risk assessment'),
            variant: 'primary',
          },
        ]}
      />
    </Stack>
  ),
};

// Priority Levels
export const PriorityLevels: Story = {
  render: () => (
    <Stack gap="lg" style={{ maxWidth: '800px' }}>
      <Text size="xl" fw={700}>Priority Levels</Text>
      
      <ClinicalAlert
        type="info"
        title="Low Priority"
        message="Routine reminder for annual wellness visit scheduling."
        priority="low"
        timestamp={new Date()}
      />
      
      <ClinicalAlert
        type="warning"
        title="Medium Priority"
        message="Patient due for medication reconciliation within next 24 hours."
        priority="medium"
        timestamp={new Date()}
      />
      
      <ClinicalAlert
        type="warning"
        title="High Priority"
        message="Patient blood pressure trending upward over past 3 readings."
        priority="high"
        timestamp={new Date()}
      />
      
      <ClinicalAlert
        type="error"
        title="Urgent Priority"
        message="Patient oxygen saturation below 90% - immediate assessment required."
        priority="urgent"
        timestamp={new Date()}
      />
      
      <ClinicalAlert
        type="critical"
        title="STAT Priority"
        message="Code Blue called for patient in Room 302A. All available staff respond immediately."
        priority="stat"
        timestamp={new Date()}
        pulse={true}
        requiresAcknowledgment={true}
      />
    </Stack>
  ),
};

// Interactive Examples
export const InteractiveExamples: Story = {
  render: () => {
    const handleAcknowledge = () => {
      alert('Alert acknowledged - logged in audit trail');
    };

    const handleDismiss = () => {
      alert('Alert dismissed');
    };

    return (
      <Stack gap="lg" style={{ maxWidth: '800px' }}>
        <Text size="xl" fw={700}>Interactive Alerts</Text>
        
        <ClinicalAlert
          type="drug-interaction"
          title="Drug Interaction Detected"
          message="Moderate interaction between Lisinopril and Potassium supplement. Monitor potassium levels."
          priority="high"
          timestamp={new Date()}
          source="Clinical Decision Support"
          patientContext={{
            name: 'Alice Cooper',
            id: 'MRN-111222',
            room: '520B',
          }}
          requiresAcknowledgment={true}
          onAcknowledge={handleAcknowledge}
          onDismiss={handleDismiss}
          details="Concurrent use may result in hyperkalemia. Recommend monitoring serum potassium levels."
          reference={{
            title: 'Drug Interaction Guidelines',
            url: 'https://example.com/guidelines',
          }}
          actions={[
            {
              label: 'Order Potassium Level',
              action: () => alert('Ordering lab test'),
              variant: 'primary',
            },
            {
              label: 'Set Monitoring Reminder',
              action: () => alert('Setting reminder'),
              variant: 'secondary',
            },
          ]}
        />
        
        <ClinicalAlert
          type="allergy"
          title="Allergy Verification Required"
          message="Patient reports new allergy to Sulfa drugs. Please verify and update allergy list."
          priority="high"
          timestamp={new Date()}
          source="Nursing Documentation"
          patientContext={{
            name: 'Bob Anderson',
            id: 'MRN-333444',
            room: '612A',
          }}
          actions={[
            {
              label: 'Update Allergy List',
              action: () => alert('Opening allergy management'),
              variant: 'primary',
            },
            {
              label: 'Verify with Patient',
              action: () => alert('Opening verification form'),
              variant: 'secondary',
            },
          ]}
        />
      </Stack>
    );
  },
};

// Auto-Dismiss Example
export const AutoDismissExample: Story = {
  render: () => (
    <Stack spacing="md" style={{ maxWidth: '600px' }}>
      <Text size="lg" weight={600}>Auto-Dismiss Alert</Text>
      <Text size="sm" color="dimmed">
        This alert will automatically dismiss after 5 seconds.
      </Text>
      <ClinicalAlert
        type="info"
        title="Medication Administered"
        message="Acetaminophen 650mg was successfully administered to patient at 14:30."
        timestamp={new Date()}
        source="Medication Administration"
        autoDismiss={5000}
        onDismiss={() => console.log('Alert auto-dismissed')}
      />
    </Stack>
  ),
};

// Accessibility Features
export const AccessibilityFeatures: Story = {
  render: () => (
    <Stack gap="lg" style={{ maxWidth: '800px' }}>
      <Text size="xl" fw={700}>Accessibility Features</Text>
      <Text size="sm" color="dimmed" mb="md">
        These alerts include proper ARIA labels, roles, and screen reader support.
        Critical alerts use assertive aria-live regions for immediate attention.
      </Text>
      
      <ClinicalAlert
        type="critical"
        title="Critical Value - Screen Reader Test"
        message="This critical alert will be announced immediately to screen readers."
        priority="stat"
        timestamp={new Date()}
        requiresAcknowledgment={true}
        pulse={true}
      />
      
      <ClinicalAlert
        type="info"
        title="Information Alert - Screen Reader Test"
        message="This information alert will be announced politely to screen readers."
        timestamp={new Date()}
      />
    </Stack>
  ),
};