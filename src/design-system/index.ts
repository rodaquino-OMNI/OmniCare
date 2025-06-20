/**
 * OmniCare Design System
 * 
 * Modern, bright, and accessible design system for healthcare applications
 * Built on Mantine with healthcare-specific customizations
 */

// Export all design tokens
export * from './tokens/colors';
export * from './tokens/typography';
export * from './tokens/spacing';

// Export themes
export * from './themes/omnicare-theme';

// Export component utilities (will be created)
export * from './components';
export * from './utils';

// Main design system configuration
export const designSystem = {
  name: 'OmniCare Design System',
  version: '1.0.0',
  description: 'Modern, bright, and accessible design system for healthcare applications',
  
  // Quick access to common values
  brand: {
    primary: '#0ea5e9',
    secondary: '#22c55e',
    tertiary: '#a855f7',
  },
  
  // Common breakpoints
  breakpoints: {
    mobile: '48em',
    tablet: '62em',
    desktop: '75em',
  },
  
  // Accessibility features
  accessibility: {
    wcagLevel: 'AA',
    contrastRatio: '4.5:1',
    focusVisible: true,
    keyboardNavigation: true,
    screenReaderSupport: true,
  },
  
  // Healthcare-specific features
  healthcare: {
    medicalColors: true,
    statusIndicators: true,
    criticalAlerts: true,
    patientSafety: true,
    clinicalWorkflows: true,
  },
} as const;

// Re-export commonly used items for convenience
export { omnicareTheme as theme } from './themes/omnicare-theme';
export { colors } from './tokens/colors';
export { typography } from './tokens/typography';
export { spacing } from './tokens/spacing';

// Type exports for better TypeScript experience
export type {
  ColorKey,
  SemanticColorKey,
  MedicalColorKey,
  TypographyVariant,
  FontFamily,
  FontWeight,
  FontSize,
  Spacing,
  BorderRadius,
  Breakpoint,
} from './tokens/colors';

export type { OmnicareTheme } from './themes/omnicare-theme';