/**
 * OmniCare Design System - Typography Tokens
 * 
 * Typography system based on Inter font family with healthcare-optimized scales
 * Designed for maximum readability in clinical environments
 */

// Font families
export const fontFamilies = {
  // Primary font - Inter for excellent readability
  primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  
  // Monospace font for technical data (lab values, IDs, etc.)
  mono: '"JetBrains Mono", "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
  
  // System fonts as fallback
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

// Font weights
export const fontWeights = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// Font sizes with healthcare-appropriate scales
export const fontSizes = {
  // Micro text - small labels, captions
  xs: '0.75rem',    // 12px
  
  // Small text - secondary information, metadata
  sm: '0.875rem',   // 14px
  
  // Base text - primary body text, forms
  base: '1rem',     // 16px (base for accessibility)
  
  // Medium text - emphasized content, small headings
  md: '1.125rem',   // 18px
  
  // Large text - section headings, important information
  lg: '1.25rem',    // 20px
  
  // Extra large - major headings, patient names
  xl: '1.5rem',     // 24px
  
  // 2XL - page titles, primary headings
  '2xl': '1.875rem', // 30px
  
  // 3XL - display text, alerts
  '3xl': '2.25rem',  // 36px
  
  // 4XL - hero text, critical alerts
  '4xl': '3rem',     // 48px
} as const;

// Line heights optimized for readability
export const lineHeights = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,      // Default for body text
  relaxed: 1.625,
  loose: 2,
} as const;

// Letter spacing
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// Typography variants for common use cases
export const typography = {
  // Display text - Hero sections, major headings
  display: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.extrabold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
    fontFamily: fontFamilies.primary,
  },
  
  // H1 - Page titles, primary headings
  h1: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
    fontFamily: fontFamilies.primary,
  },
  
  // H2 - Section headings
  h2: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // H3 - Subsection headings
  h3: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // H4 - Card titles, form sections
  h4: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // H5 - Component headings
  h5: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // H6 - Small headings
  h6: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // Body - Primary body text
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // Body large - Emphasized body text
  bodyLarge: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // Body small - Secondary text
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // Caption - Metadata, timestamps
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.wide,
    fontFamily: fontFamilies.primary,
  },
  
  // Label - Form labels, UI labels
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  // Button - Button text
  button: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.none,
    letterSpacing: letterSpacing.wide,
    fontFamily: fontFamilies.primary,
  },
  
  // Code - Technical text, IDs, values
  code: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.mono,
  },
  
  // Healthcare-specific variants
  patientName: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  medicalValue: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.none,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.mono,
  },
  
  criticalAlert: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamilies.primary,
  },
  
  timestamp: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.wider,
    fontFamily: fontFamilies.mono,
  },
} as const;

// Responsive typography utilities
export const responsiveTypography = {
  // Mobile-first responsive scales
  mobile: {
    display: fontSizes['2xl'],
    h1: fontSizes.xl,
    h2: fontSizes.lg,
    h3: fontSizes.md,
    body: fontSizes.sm,
  },
  
  tablet: {
    display: fontSizes['3xl'],
    h1: fontSizes['2xl'],
    h2: fontSizes.xl,
    h3: fontSizes.lg,
    body: fontSizes.base,
  },
  
  desktop: {
    display: fontSizes['4xl'],
    h1: fontSizes['3xl'],
    h2: fontSizes['2xl'],
    h3: fontSizes.xl,
    body: fontSizes.base,
  },
} as const;

// Typography utility types
export type FontFamily = keyof typeof fontFamilies;
export type FontWeight = keyof typeof fontWeights;
export type FontSize = keyof typeof fontSizes;
export type LineHeight = keyof typeof lineHeights;
export type LetterSpacing = keyof typeof letterSpacing;
export type TypographyVariant = keyof typeof typography;