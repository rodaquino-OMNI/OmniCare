/**
 * OmniCare Design System - Main Theme Configuration
 * 
 * Mantine theme customization with OmniCare design tokens
 * Bright, accessible healthcare-focused design system
 */

import { MantineTheme, createTheme, rem } from '@mantine/core';
import { colors } from '../tokens/colors';
import { fontFamilies, fontSizes, fontWeights } from '../tokens/typography';
import { spacing, borderRadius, shadows } from '../tokens/spacing';

export const omnicareTheme = createTheme({
  // Color scheme
  primaryColor: 'primary',
  
  // Colors - map our design tokens to Mantine color scheme
  colors: {
    // Primary brand color (bright medical blue)
    primary: [
      colors.primary[50],
      colors.primary[100],
      colors.primary[200],
      colors.primary[300],
      colors.primary[400],
      colors.primary[500],
      colors.primary[600],
      colors.primary[700],
      colors.primary[800],
      colors.primary[900],
    ],
    
    // Secondary color (bright medical green)
    secondary: [
      colors.secondary[50],
      colors.secondary[100],
      colors.secondary[200],
      colors.secondary[300],
      colors.secondary[400],
      colors.secondary[500],
      colors.secondary[600],
      colors.secondary[700],
      colors.secondary[800],
      colors.secondary[900],
    ],
    
    // Tertiary color (bright medical purple)
    tertiary: [
      colors.tertiary[50],
      colors.tertiary[100],
      colors.tertiary[200],
      colors.tertiary[300],
      colors.tertiary[400],
      colors.tertiary[500],
      colors.tertiary[600],
      colors.tertiary[700],
      colors.tertiary[800],
      colors.tertiary[900],
    ],
    
    // Semantic colors
    green: [
      colors.semantic.success.light,
      colors.secondary[100],
      colors.secondary[200],
      colors.secondary[300],
      colors.secondary[400],
      colors.semantic.success.main,
      colors.secondary[600],
      colors.semantic.success.dark,
      colors.secondary[800],
      colors.secondary[900],
    ],
    
    red: [
      colors.semantic.error.light,
      '#fecaca',
      '#fca5a5',
      '#f87171',
      colors.semantic.error.main,
      '#dc2626',
      colors.semantic.error.dark,
      '#b91c1c',
      '#991b1b',
      '#7f1d1d',
    ],
    
    orange: [
      colors.semantic.warning.light,
      '#fed7aa',
      '#fdba74',
      '#fb923c',
      colors.semantic.warning.main,
      '#ea580c',
      colors.semantic.warning.dark,
      '#c2410c',
      '#9a3412',
      '#7c2d12',
    ],
    
    blue: [
      colors.semantic.info.light,
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      colors.semantic.info.main,
      '#2563eb',
      colors.semantic.info.dark,
      '#1e40af',
      '#1e3a8a',
      '#1e3a8a',
    ],
    
    // Neutral grays
    gray: [
      colors.neutral[50],
      colors.neutral[100],
      colors.neutral[200],
      colors.neutral[300],
      colors.neutral[400],
      colors.neutral[500],
      colors.neutral[600],
      colors.neutral[700],
      colors.neutral[800],
      colors.neutral[900],
    ],
    
    // Accent colors
    cyan: [
      colors.accent.cyan[50],
      colors.accent.cyan[100],
      colors.accent.cyan[200],
      colors.accent.cyan[300],
      colors.accent.cyan[400],
      colors.accent.cyan[500],
      colors.accent.cyan[600],
      colors.accent.cyan[700],
      colors.accent.cyan[800],
      colors.accent.cyan[900],
    ],
    
    teal: [
      colors.accent.teal[50],
      colors.accent.teal[100],
      colors.accent.teal[200],
      colors.accent.teal[300],
      colors.accent.teal[400],
      colors.accent.teal[500],
      colors.accent.teal[600],
      colors.accent.teal[700],
      colors.accent.teal[800],
      colors.accent.teal[900],
    ],
  },
  
  // Typography
  fontFamily: fontFamilies.primary,
  fontFamilyMonospace: fontFamilies.mono,
  
  fontSizes: {
    xs: rem(fontSizes.xs),
    sm: rem(fontSizes.sm),
    md: rem(fontSizes.base),
    lg: rem(fontSizes.lg),
    xl: rem(fontSizes.xl),
  },
  
  // Spacing
  spacing: {
    xs: rem(spacing[2]),   // 8px
    sm: rem(spacing[3]),   // 12px
    md: rem(spacing[4]),   // 16px
    lg: rem(spacing[6]),   // 24px
    xl: rem(spacing[8]),   // 32px
  },
  
  // Border radius
  radius: {
    xs: rem(borderRadius.xs),
    sm: rem(borderRadius.sm),
    md: rem(borderRadius.base),
    lg: rem(borderRadius.lg),
    xl: rem(borderRadius.xl),
  },
  
  // Shadows
  shadows: {
    xs: shadows.xs,
    sm: shadows.sm,
    md: shadows.base,
    lg: shadows.md,
    xl: shadows.lg,
  },
  
  // Breakpoints
  breakpoints: {
    xs: '36em',
    sm: '48em',
    md: '62em',
    lg: '75em',
    xl: '88em',
  },
  
  // Component customizations
  components: {
    // Button customizations
    Button: {
      styles: {
        root: {
          fontWeight: fontWeights.medium,
          borderRadius: borderRadius.md,
          transition: 'all 150ms ease',
          
          // Focus styles for accessibility
          '&:focus-visible': {
            outline: `2px solid ${colors.accessibility.focus.ring}`,
            outlineOffset: '2px',
          },
        },
      },
      
      vars: (theme, props) => {
        if (props.variant === 'filled' && props.color === 'primary') {
          return {
            root: {
              '--button-bg': colors.primary[500],
              '--button-hover': colors.primary[600],
              '--button-color': colors.neutral[0],
            },
          };
        }
        
        if (props.variant === 'light' && props.color === 'primary') {
          return {
            root: {
              '--button-bg': colors.primary[50],
              '--button-hover': colors.primary[100],
              '--button-color': colors.primary[700],
            },
          };
        }
        
        return {};
      },
    },
    
    // Input customizations
    TextInput: {
      styles: {
        input: {
          borderColor: colors.neutral[300],
          borderRadius: borderRadius.md,
          fontSize: fontSizes.base,
          
          '&:focus': {
            borderColor: colors.primary[500],
            boxShadow: `0 0 0 1px ${colors.primary[500]}`,
          },
          
          '&::placeholder': {
            color: colors.neutral[400],
          },
        },
        
        label: {
          fontWeight: fontWeights.medium,
          color: colors.neutral[700],
          marginBottom: spacing[1.5],
        },
      },
    },
    
    // Card customizations
    Card: {
      styles: {
        root: {
          backgroundColor: colors.neutral[0],
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.sm,
          
          '&:hover': {
            boxShadow: shadows.md,
            borderColor: colors.neutral[300],
          },
        },
      },
    },
    
    // Modal customizations
    Modal: {
      styles: {
        content: {
          borderRadius: borderRadius.xl,
          boxShadow: shadows.xl,
        },
        
        header: {
          backgroundColor: colors.neutral[50],
          borderBottom: `1px solid ${colors.neutral[200]}`,
          borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`,
          padding: spacing[6],
        },
        
        body: {
          padding: spacing[6],
        },
      },
    },
    
    // Notification customizations for healthcare alerts
    Notification: {
      styles: (theme, props) => ({
        root: {
          borderRadius: borderRadius.lg,
          border: '1px solid',
          borderColor: props.color === 'red' 
            ? colors.semantic.error.main
            : props.color === 'green'
            ? colors.semantic.success.main
            : props.color === 'orange'
            ? colors.semantic.warning.main
            : colors.neutral[300],
        },
      }),
    },
    
    // Table customizations for medical data
    Table: {
      styles: {
        table: {
          fontFamily: fontFamilies.primary,
        },
        
        th: {
          backgroundColor: colors.neutral[50],
          color: colors.neutral[700],
          fontWeight: fontWeights.semibold,
          fontSize: fontSizes.sm,
          borderBottom: `2px solid ${colors.neutral[200]}`,
          padding: spacing[3],
        },
        
        td: {
          borderBottom: `1px solid ${colors.neutral[100]}`,
          padding: spacing[3],
          fontSize: fontSizes.sm,
          
          '&[data-medical-value]': {
            fontFamily: fontFamilies.mono,
            fontWeight: fontWeights.medium,
          },
        },
        
        tr: {
          '&:hover': {
            backgroundColor: colors.neutral[50],
          },
        },
      },
    },
    
    // Badge customizations for medical status
    Badge: {
      styles: (theme, props) => {
        const getStatusColors = () => {
          switch (props.color) {
            case 'green':
              return {
                backgroundColor: colors.semantic.success.light,
                color: colors.semantic.success.dark,
                border: `1px solid ${colors.semantic.success.main}`,
              };
            case 'red':
              return {
                backgroundColor: colors.semantic.error.light,
                color: colors.semantic.error.dark,
                border: `1px solid ${colors.semantic.error.main}`,
              };
            case 'orange':
              return {
                backgroundColor: colors.semantic.warning.light,
                color: colors.semantic.warning.dark,
                border: `1px solid ${colors.semantic.warning.main}`,
              };
            default:
              return {
                backgroundColor: colors.neutral[100],
                color: colors.neutral[700],
                border: `1px solid ${colors.neutral[300}`,
              };
          }
        };
        
        return {
          root: {
            ...getStatusColors(),
            borderRadius: borderRadius.full,
            fontWeight: fontWeights.medium,
            fontSize: fontSizes.xs,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
        };
      },
    },
  },
  
  // Global styles
  globalStyles: (theme) => ({
    // Inter font import
    '@import': 'url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap")',
    
    // CSS custom properties for easy theme access
    ':root': {
      // Colors
      '--omni-primary-50': colors.primary[50],
      '--omni-primary-500': colors.primary[500],
      '--omni-primary-600': colors.primary[600],
      '--omni-success': colors.semantic.success.main,
      '--omni-warning': colors.semantic.warning.main,
      '--omni-error': colors.semantic.error.main,
      '--omni-info': colors.semantic.info.main,
      
      // Typography
      '--omni-font-family': fontFamilies.primary,
      '--omni-font-mono': fontFamilies.mono,
      
      // Spacing
      '--omni-spacing-xs': spacing[2],
      '--omni-spacing-sm': spacing[3],
      '--omni-spacing-md': spacing[4],
      '--omni-spacing-lg': spacing[6],
      '--omni-spacing-xl': spacing[8],
      
      // Border radius
      '--omni-radius-sm': borderRadius.sm,
      '--omni-radius-md': borderRadius.base,
      '--omni-radius-lg': borderRadius.lg,
      
      // Shadows
      '--omni-shadow-sm': shadows.sm,
      '--omni-shadow-md': shadows.base,
      '--omni-shadow-lg': shadows.md,
    },
    
    // Base styles
    '*': {
      boxSizing: 'border-box',
    },
    
    body: {
      fontFamily: fontFamilies.primary,
      color: colors.neutral[700],
      backgroundColor: colors.neutral[50],
      lineHeight: 1.5,
    },
    
    // Focus styles for accessibility
    'button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible': {
      outline: `2px solid ${colors.accessibility.focus.ring}`,
      outlineOffset: '2px',
    },
    
    // Healthcare-specific utility classes
    '.text-medical-value': {
      fontFamily: fontFamilies.mono,
      fontWeight: fontWeights.medium,
    },
    
    '.text-patient-name': {
      fontWeight: fontWeights.semibold,
      fontSize: fontSizes.lg,
    },
    
    '.text-critical-alert': {
      color: colors.semantic.critical.main,
      fontWeight: fontWeights.bold,
    },
    
    '.bg-medical-normal': {
      backgroundColor: colors.medical.vitals.normal,
    },
    
    '.bg-medical-elevated': {
      backgroundColor: colors.medical.vitals.elevated,
    },
    
    '.bg-medical-high': {
      backgroundColor: colors.medical.vitals.high,
    },
  }),
});

// Export theme type for TypeScript
export type OmnicareTheme = typeof omnicareTheme;

// Theme variants for different contexts
export const themeLightMode = omnicareTheme;

export const themeDarkMode = createTheme({
  ...omnicareTheme,
  colorScheme: 'dark',
  colors: {
    ...omnicareTheme.colors,
    // Dark mode color adjustments would go here
    // For now, we'll use the light theme as healthcare apps typically prefer light backgrounds
  },
});

// High contrast theme for accessibility
export const themeHighContrast = createTheme({
  ...omnicareTheme,
  colors: {
    ...omnicareTheme.colors,
    primary: Array(10).fill(colors.accessibility.highContrast.primary),
    gray: Array(10).fill(colors.accessibility.highContrast.text),
  },
  components: {
    ...omnicareTheme.components,
    Button: {
      styles: {
        root: {
          border: `2px solid ${colors.accessibility.highContrast.border}`,
          fontWeight: fontWeights.bold,
        },
      },
    },
  },
});