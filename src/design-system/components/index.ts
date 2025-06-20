/**
 * OmniCare Design System - Components
 * 
 * Healthcare-specific UI components built on Mantine
 */

// Export all components
export * from './MedicalBadge';
export * from './VitalSignCard';
export * from './ClinicalAlert';

// Component collections
export const medicalComponents = {
  MedicalBadge: 'Medical status badges and indicators',
  VitalSignCard: 'Patient vital signs display cards',
  ClinicalAlert: 'Healthcare alerts and notifications',
} as const;

export const componentCategories = {
  medical: ['MedicalBadge', 'VitalSignCard'],
  alerts: ['ClinicalAlert'],
  forms: [], // Will be added later
  charts: [], // Will be added later
} as const;