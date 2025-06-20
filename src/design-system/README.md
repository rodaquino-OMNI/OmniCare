# OmniCare Design System

A modern, bright, and accessible design system for healthcare applications, built on Mantine with healthcare-specific optimizations.

## Overview

The OmniCare Design System provides a comprehensive set of design tokens, components, and patterns specifically designed for Electronic Medical Record (EMR) and healthcare applications. It prioritizes accessibility, clinical workflow efficiency, and patient safety.

## Key Features

- 🎨 **Bright, Accessible Colors** - WCAG 2.1 AA compliant color palette
- 🏥 **Healthcare-Specific Components** - Medical badges, vital sign cards, clinical alerts
- ♿ **Accessibility First** - Screen reader support, keyboard navigation, high contrast mode
- 📱 **Responsive Design** - Mobile-first approach for clinical environments
- 🔧 **Mantine Integration** - Built on top of Mantine 7+ with custom healthcare themes
- 📚 **Comprehensive Documentation** - Storybook with healthcare use cases

## Quick Start

### Installation

```bash
npm install @mantine/core @mantine/hooks
```

### Basic Setup

```tsx
import { MantineProvider } from '@mantine/core';
import { omnicareTheme } from './design-system/themes/omnicare-theme';
import '@mantine/core/styles.css';

function App() {
  return (
    <MantineProvider theme={omnicareTheme}>
      {/* Your app */}
    </MantineProvider>
  );
}
```

## Design Tokens

### Colors

```tsx
import { colors } from '@/design-system';

// Primary brand colors (bright medical blue)
colors.primary[500]  // #0ea5e9

// Semantic colors
colors.semantic.success.main  // #22c55e
colors.semantic.error.main    // #ef4444
colors.semantic.warning.main  // #f59e0b

// Medical status colors
colors.medical.vitals.normal    // Normal vital signs
colors.medical.vitals.critical  // Critical values
colors.medical.lab.abnormal     // Abnormal lab results
```

### Typography

```tsx
import { typography } from '@/design-system';

// Healthcare-specific variants
typography.patientName      // Patient name styling
typography.medicalValue     // Medical values (monospace)
typography.criticalAlert    // Critical alert styling
typography.timestamp        // Timestamp formatting
```

### Spacing

```tsx
import { spacing } from '@/design-system';

// 4px grid system
spacing[1]   // 4px
spacing[4]   // 16px
spacing[6]   // 24px
spacing[8]   // 32px
```

## Components

### MedicalBadge

Display medical statuses with appropriate colors and accessibility features.

```tsx
import { MedicalBadge } from '@/design-system';

<MedicalBadge 
  status="critical" 
  category="lab" 
  showIcon 
  pulse 
/>
```

**Props:**
- `status`: 'normal' | 'abnormal' | 'critical' | 'pending' | 'elevated' | 'high' | 'low'
- `category`: 'lab' | 'vital' | 'medication' | 'general'
- `showIcon`: boolean
- `pulse`: boolean for critical alerts

### VitalSignCard

Display patient vital signs with trends and status indicators.

```tsx
import { VitalSignCard } from '@/design-system';

<VitalSignCard 
  data={{
    type: 'blood-pressure',
    value: '120/80',
    unit: 'mmHg',
    status: 'normal',
    trend: 'stable',
    timestamp: new Date()
  }}
/>
```

**Data Interface:**
```tsx
interface VitalSignData {
  type: 'blood-pressure' | 'heart-rate' | 'temperature' | 'respiratory-rate' | 'oxygen-saturation';
  value: number | string;
  unit: string;
  timestamp: Date;
  status?: 'normal' | 'elevated' | 'high' | 'low' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  normalRange?: { min: number; max: number };
}
```

### ClinicalAlert

Display critical medical alerts and notifications.

```tsx
import { ClinicalAlert } from '@/design-system';

<ClinicalAlert
  type="drug-interaction"
  title="Drug Interaction Warning"
  message="Potential interaction detected between medications"
  priority="high"
  requiresAcknowledgment
  actions={[
    {
      label: 'Review Medications',
      action: () => console.log('Review clicked'),
      variant: 'primary'
    }
  ]}
/>
```

**Props:**
- `type`: 'info' | 'warning' | 'error' | 'critical' | 'drug-interaction' | 'allergy' | 'safety'
- `priority`: 'low' | 'medium' | 'high' | 'urgent' | 'stat'
- `requiresAcknowledgment`: boolean
- `actions`: Array of action buttons

## Healthcare Use Cases

### Patient Dashboard

```tsx
import { VitalSignCard, MedicalBadge } from '@/design-system';

function PatientDashboard() {
  return (
    <div>
      <h2>Patient: Johnson, Robert M.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <VitalSignCard data={bloodPressureData} />
        <VitalSignCard data={heartRateData} />
        <VitalSignCard data={temperatureData} />
      </div>
      
      <div>
        <h3>Current Status</h3>
        <MedicalBadge status="normal" category="vital" label="Stable" />
        <MedicalBadge status="critical" category="lab" label="Troponin" pulse />
      </div>
    </div>
  );
}
```

### Clinical Alerts

```tsx
import { ClinicalAlert } from '@/design-system';

function AlertPanel() {
  return (
    <div>
      <ClinicalAlert
        type="allergy"
        title="ALLERGY ALERT"
        message="Patient has severe penicillin allergy"
        priority="stat"
        requiresAcknowledgment
        pulse
      />
      
      <ClinicalAlert
        type="drug-interaction"
        title="Drug Interaction"
        message="Warfarin and Amiodarone interaction detected"
        priority="high"
        actions={[
          { label: 'Adjust Dose', action: adjustDose },
          { label: 'Select Alternative', action: selectAlternative }
        ]}
      />
    </div>
  );
}
```

## Accessibility Features

### WCAG 2.1 AA Compliance
- All color combinations meet 4.5:1 contrast ratio
- High contrast mode available
- Proper color usage beyond color alone

### Screen Reader Support
- Semantic HTML structure
- ARIA labels and descriptions
- Live regions for critical updates

### Keyboard Navigation
- Focus indicators on all interactive elements
- Logical tab order
- Keyboard shortcuts for common actions

### Healthcare-Specific Accessibility
- Critical alerts use assertive aria-live regions
- Medical values have proper context for screen readers
- Status changes are announced appropriately

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

### Running Storybook

```bash
npm run storybook
```

### Building Components

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Integration with Medplum

The design system is built to complement Medplum's healthcare components:

```tsx
import { PatientTimeline, ResourceTable } from '@medplum/react';
import { omnicareTheme } from '@/design-system';

// Medplum components automatically inherit OmniCare theme
<MantineProvider theme={omnicareTheme}>
  <PatientTimeline patient={patient} />
  <ResourceTable resourceType="Observation" />
</MantineProvider>
```

## Contributing

1. Follow the established color palette and spacing system
2. Ensure all components meet WCAG 2.1 AA standards
3. Include comprehensive Storybook stories
4. Test with screen readers and keyboard navigation
5. Consider healthcare-specific use cases

## Healthcare Design Principles

1. **Safety First** - Critical information is immediately visible
2. **Efficiency** - Reduce cognitive load for clinical staff
3. **Accessibility** - Support all users and assistive technologies
4. **Consistency** - Predictable patterns across the application
5. **Clarity** - Clear hierarchy and unambiguous communication

## License

MIT License - see LICENSE file for details.