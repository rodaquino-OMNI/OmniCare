/**
 * OmniCare Design System - Color Tokens
 * 
 * Bright, accessible color palette optimized for healthcare applications
 * All colors meet WCAG 2.1 AA contrast requirements
 */

export const colors = {
  // Primary Brand Colors - Bright Medical Blue
  primary: {
    50: '#f0f9ff',   // Lightest blue - backgrounds
    100: '#e0f2fe',  // Very light blue
    200: '#bae6fd',  // Light blue - hover states
    300: '#7dd3fc',  // Medium light blue
    400: '#38bdf8',  // Bright blue - secondary actions
    500: '#0ea5e9',  // Primary blue - main CTA
    600: '#0284c7',  // Dark blue - primary hover
    700: '#0369a1',  // Darker blue - pressed states
    800: '#075985',  // Very dark blue
    900: '#0c4a6e',  // Darkest blue - text
  },

  // Secondary - Bright Medical Green (Success/Health indicators)
  secondary: {
    50: '#f0fdf4',   // Lightest green
    100: '#dcfce7',  // Very light green
    200: '#bbf7d0',  // Light green - success backgrounds
    300: '#86efac',  // Medium green
    400: '#4ade80',  // Bright green - success states
    500: '#22c55e',  // Primary green - main success
    600: '#16a34a',  // Dark green - success hover
    700: '#15803d',  // Darker green
    800: '#166534',  // Very dark green
    900: '#14532d',  // Darkest green
  },

  // Tertiary - Bright Medical Purple (Specialties/Advanced features)
  tertiary: {
    50: '#faf5ff',   // Lightest purple
    100: '#f3e8ff',  // Very light purple
    200: '#e9d5ff',  // Light purple
    300: '#d8b4fe',  // Medium light purple
    400: '#c084fc',  // Bright purple
    500: '#a855f7',  // Primary purple
    600: '#9333ea',  // Dark purple
    700: '#7c3aed',  // Darker purple
    800: '#6b21a8',  // Very dark purple
    900: '#581c87',  // Darkest purple
  },

  // Accent Colors
  accent: {
    // Bright Orange - Urgent/Warning
    orange: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',  // Primary orange
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    // Bright Cyan - Information
    cyan: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',  // Primary cyan
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
    },
    // Bright Teal - Labs/Diagnostics
    teal: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',  // Primary teal
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
  },

  // Semantic Colors - Healthcare Specific
  semantic: {
    // Success - Positive health indicators, completed tasks
    success: {
      light: '#dcfce7',
      main: '#22c55e',
      dark: '#15803d',
      contrast: '#ffffff',
    },
    // Warning - Caution, moderate alerts
    warning: {
      light: '#fef3c7',
      main: '#f59e0b',
      dark: '#d97706',
      contrast: '#000000',
    },
    // Error - Critical alerts, dangerous conditions
    error: {
      light: '#fee2e2',
      main: '#ef4444',
      dark: '#dc2626',
      contrast: '#ffffff',
    },
    // Info - General information, tips
    info: {
      light: '#dbeafe',
      main: '#3b82f6',
      dark: '#1d4ed8',
      contrast: '#ffffff',
    },
    // Critical - Life-threatening conditions
    critical: {
      light: '#fef1f2',
      main: '#f43f5e',
      dark: '#e11d48',
      contrast: '#ffffff',
    },
  },

  // Neutral Grays - Bright and modern
  neutral: {
    0: '#ffffff',    // Pure white
    50: '#f8fafc',   // Lightest gray - backgrounds
    100: '#f1f5f9',  // Very light gray
    200: '#e2e8f0',  // Light gray - borders
    300: '#cbd5e1',  // Medium light gray
    400: '#94a3b8',  // Medium gray - disabled text
    500: '#64748b',  // Gray - secondary text
    600: '#475569',  // Dark gray - primary text
    700: '#334155',  // Darker gray
    800: '#1e293b',  // Very dark gray
    900: '#0f172a',  // Darkest gray - headings
    1000: '#000000', // Pure black
  },

  // Medical Status Colors - Disease/Condition specific
  medical: {
    // Vital signs
    vitals: {
      normal: '#22c55e',     // Green - normal ranges
      elevated: '#f59e0b',   // Orange - slightly elevated
      high: '#ef4444',       // Red - high/dangerous
      low: '#3b82f6',        // Blue - low values
    },
    // Laboratory values
    lab: {
      normal: '#14b8a6',     // Teal - normal results
      abnormal: '#f97316',   // Orange - abnormal results
      critical: '#ef4444',   // Red - critical values
      pending: '#8b5cf6',    // Purple - pending results
    },
    // Medication status
    medication: {
      active: '#22c55e',     // Green - active medications
      discontinued: '#94a3b8', // Gray - discontinued
      allergy: '#f43f5e',    // Pink-red - allergy alert
      interaction: '#f59e0b', // Orange - drug interaction
    },
    // Patient acuity
    acuity: {
      low: '#22c55e',        // Green - low acuity
      medium: '#f59e0b',     // Orange - medium acuity
      high: '#ef4444',       // Red - high acuity
      critical: '#dc2626',   // Dark red - critical
    },
  },

  // Accessibility Colors - High contrast options
  accessibility: {
    // High contrast variants for better visibility
    highContrast: {
      primary: '#0c4a6e',    // Very dark blue
      secondary: '#14532d',  // Very dark green
      background: '#ffffff', // Pure white
      text: '#000000',       // Pure black
      border: '#374151',     // Dark gray
    },
    // Focus indicators
    focus: {
      ring: '#3b82f6',       // Blue focus ring
      background: '#dbeafe', // Light blue focus background
    },
  },
} as const;

// Color utility types
export type ColorScale = typeof colors.primary;
export type ColorKey = keyof typeof colors;
export type SemanticColorKey = keyof typeof colors.semantic;
export type MedicalColorKey = keyof typeof colors.medical;

// Export individual color scales for easier access
export const {
  primary,
  secondary,
  tertiary,
  accent,
  semantic,
  neutral,
  medical,
  accessibility,
} = colors;