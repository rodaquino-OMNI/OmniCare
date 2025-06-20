// Design system constants for OmniCare EMR
// Based on modern bright color scheme for healthcare UI

export const COLORS = {
  // Primary Colors
  primary: '#0091FF',
  primaryLight: '#4DA6FF',
  primaryDark: '#0073CC',
  
  // Secondary Colors
  secondary: '#00C853',
  secondaryLight: '#4DD683',
  secondaryDark: '#00A142',
  
  // Accent Colors
  accent: '#6E56CF',
  accentLight: '#8B73D6',
  accentDark: '#5A46B8',
  
  // Functional Colors
  success: '#17C964',
  successLight: '#45D87A',
  successDark: '#12A150',
  
  warning: '#FFB017',
  warningLight: '#FFC445',
  warningDark: '#E69900',
  
  error: '#F31260',
  errorLight: '#F54180',
  errorDark: '#D10E4F',
  
  info: '#0072F5',
  infoLight: '#338EF7',
  infoDark: '#005BC4',
  
  // Interface Colors
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F7F7F7',
  surfaceDark: '#F0F0F0',
  
  border: '#E4E4E7',
  borderLight: '#F1F1F3',
  borderDark: '#D4D4D8',
  
  textPrimary: '#18181B',
  textSecondary: '#71717A',
  textTertiary: '#A1A1AA',
  textInverse: '#FFFFFF',
  
  // Medical Status Colors
  critical: '#DC2626',
  urgent: '#EA580C',
  normal: '#16A34A',
  pending: '#CA8A04',
  
  // Medication Colors
  prescribed: '#0284C7',
  administered: '#059669',
  discontinued: '#DC2626',
  pending: '#D97706',
  
  // Specialty Colors
  cardiology: '#EF4444',
  neurology: '#8B5CF6',
  oncology: '#F59E0B',
  pediatrics: '#10B981',
  radiology: '#6366F1',
  emergency: '#DC2626',
  surgery: '#7C3AED',
  pharmacy: '#06B6D4',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const SHADOWS = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1440,
} as const;

export const Z_INDEX = {
  base: 1,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  popover: 40,
  tooltip: 50,
  notification: 100,
} as const;

// Mantine theme configuration
export const MANTINE_THEME = {
  colors: {
    primary: [
      '#E6F4FF',
      '#BAE7FF',
      '#91D5FF',
      '#69C0FF',
      '#40A9FF',
      '#1890FF',
      '#0091FF', // Main primary
      '#0073CC',
      '#005BB8',
      '#004494',
    ],
    secondary: [
      '#E8F9F0',
      '#C3F0D3',
      '#9BE7B6',
      '#73DE99',
      '#4AD57C',
      '#21CC5F',
      '#00C853', // Main secondary
      '#00A142',
      '#008A35',
      '#007329',
    ],
    accent: [
      '#F3F0FF',
      '#E4DAFF',
      '#D5C4FF',
      '#C6AEFF',
      '#B798FF',
      '#A882FF',
      '#6E56CF', // Main accent
      '#5A46B8',
      '#4636A1',
      '#32268A',
    ],
    success: [
      '#E8FBF0',
      '#C3F4D3',
      '#9EEDB6',
      '#79E699',
      '#54DF7C',
      '#2FD85F',
      '#17C964', // Main success
      '#12A150',
      '#0E7A3C',
      '#0A5328',
    ],
    warning: [
      '#FFF7E6',
      '#FFECBA',
      '#FFE08E',
      '#FFD462',
      '#FFC836',
      '#FFBC0A',
      '#FFB017', // Main warning
      '#E69900',
      '#CC8200',
      '#B36B00',
    ],
    error: [
      '#FFE6ED',
      '#FFBACF',
      '#FF8DB1',
      '#FF6193',
      '#FF3475',
      '#FF0757',
      '#F31260', // Main error
      '#D10E4F',
      '#AF0A3E',
      '#8D062D',
    ],
    info: [
      '#E6F3FF',
      '#BAE0FF',
      '#8ECDFF',
      '#62BAFF',
      '#36A7FF',
      '#0A94FF',
      '#0072F5', // Main info
      '#005BC4',
      '#004493',
      '#002D62',
    ],
  },
  primaryColor: 'primary',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    sizes: {
      h1: { fontSize: '32px', lineHeight: '40px' },
      h2: { fontSize: '24px', lineHeight: '32px' },
      h3: { fontSize: '20px', lineHeight: '28px' },
      h4: { fontSize: '18px', lineHeight: '24px' },
      h5: { fontSize: '16px', lineHeight: '22px' },
      h6: { fontSize: '14px', lineHeight: '20px' },
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    xs: SHADOWS.sm,
    sm: SHADOWS.md,
    md: SHADOWS.lg,
    lg: SHADOWS.xl,
    xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  },
} as const;

// Healthcare-specific constants
export const PRIORITY_COLORS = {
  low: COLORS.info,
  medium: COLORS.warning,
  high: COLORS.error,
  critical: COLORS.critical,
} as const;

export const STATUS_COLORS = {
  active: COLORS.success,
  pending: COLORS.warning,
  completed: COLORS.success,
  cancelled: COLORS.error,
  draft: COLORS.textSecondary,
  signed: COLORS.primary,
} as const;

export const MEDICAL_SPECIALTY_COLORS = {
  cardiology: '#EF4444',
  neurology: '#8B5CF6',
  oncology: '#F59E0B',
  pediatrics: '#10B981',
  radiology: '#6366F1',
  emergency: '#DC2626',
  surgery: '#7C3AED',
  pharmacy: '#06B6D4',
  internal_medicine: '#0284C7',
  family_medicine: '#059669',
  psychiatry: '#C026D3',
  dermatology: '#EA580C',
  orthopedics: '#7C2D12',
  gynecology: '#BE185D',
  ophthalmology: '#0D9488',
  anesthesiology: '#4338CA',
} as const;

export const VITAL_SIGNS_RANGES = {
  temperature: {
    normal: { min: 36.1, max: 37.2, unit: 'celsius' },
    abnormal: { min: 35.0, max: 40.0, unit: 'celsius' },
  },
  bloodPressure: {
    systolic: {
      normal: { min: 90, max: 140, unit: 'mmHg' },
      hypertensive: { min: 140, max: 180, unit: 'mmHg' },
    },
    diastolic: {
      normal: { min: 60, max: 90, unit: 'mmHg' },
      hypertensive: { min: 90, max: 120, unit: 'mmHg' },
    },
  },
  heartRate: {
    normal: { min: 60, max: 100, unit: 'bpm' },
    abnormal: { min: 30, max: 200, unit: 'bpm' },
  },
  respiratoryRate: {
    normal: { min: 12, max: 20, unit: 'bpm' },
    abnormal: { min: 8, max: 40, unit: 'bpm' },
  },
  oxygenSaturation: {
    normal: { min: 95, max: 100, unit: '%' },
    abnormal: { min: 80, max: 100, unit: '%' },
  },
} as const;

export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

export const FORM_VALIDATION_MESSAGES = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  date: 'Please enter a valid date',
  number: 'Please enter a valid number',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`,
  pattern: 'Invalid format',
} as const;