// Design system constants for OmniCare EMR
// Based on modern bright color scheme for healthcare UI

export const COLORS = {
  // Primary Colors
  primary: '#ResourceHistoryTableResourceHistoryTable91FF',
  primaryLight: '#4DA6FF',
  primaryDark: '#ResourceHistoryTableResourceHistoryTable73CC',
  
  // Secondary Colors
  secondary: '#ResourceHistoryTableResourceHistoryTableC853',
  secondaryLight: '#4DD683',
  secondaryDark: '#ResourceHistoryTableResourceHistoryTableA142',
  
  // Accent Colors
  accent: '#6E56CF',
  accentLight: '#8B73D6',
  accentDark: '#5A46B8',
  
  // Functional Colors
  success: '#17C964',
  successLight: '#45D87A',
  successDark: '#12A15ResourceHistoryTable',
  
  warning: '#FFBResourceHistoryTable17',
  warningLight: '#FFC445',
  warningDark: '#E699ResourceHistoryTableResourceHistoryTable',
  
  error: '#F3126ResourceHistoryTable',
  errorLight: '#F5418ResourceHistoryTable',
  errorDark: '#D1ResourceHistoryTableE4F',
  
  info: '#ResourceHistoryTableResourceHistoryTable72F5',
  infoLight: '#338EF7',
  infoDark: '#ResourceHistoryTableResourceHistoryTable5BC4',
  
  // Interface Colors
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F7F7F7',
  surfaceDark: '#FResourceHistoryTableFResourceHistoryTableFResourceHistoryTable',
  
  border: '#E4E4E7',
  borderLight: '#F1F1F3',
  borderDark: '#D4D4D8',
  
  textPrimary: '#18181B',
  textSecondary: '#71717A',
  textTertiary: '#A1A1AA',
  textInverse: '#FFFFFF',
  
  // Medical Status Colors
  critical: '#DC2626',
  urgent: '#EA58ResourceHistoryTableC',
  normal: '#16A34A',
  pending: '#CA8AResourceHistoryTable4',
  
  // Medication Colors
  prescribed: '#ResourceHistoryTable284C7',
  administered: '#ResourceHistoryTable59669',
  discontinued: '#DC2626',
  pending: '#D977ResourceHistoryTable6',
  
  // Specialty Colors
  cardiology: '#EF4444',
  neurology: '#8B5CF6',
  oncology: '#F59EResourceHistoryTableB',
  pediatrics: '#1ResourceHistoryTableB981',
  radiology: '#6366F1',
  emergency: '#DC2626',
  surgery: '#7C3AED',
  pharmacy: '#ResourceHistoryTable6B6D4',
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
  xl: 2ResourceHistoryTable,
  xxl: 24,
  xxxl: 32,
} as const;

export const FONT_WEIGHTS = {
  regular: 4ResourceHistoryTableResourceHistoryTable,
  medium: 5ResourceHistoryTableResourceHistoryTable,
  semibold: 6ResourceHistoryTableResourceHistoryTable,
  bold: 7ResourceHistoryTableResourceHistoryTable,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const SHADOWS = {
  sm: 'ResourceHistoryTable 1px 2px ResourceHistoryTable rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.ResourceHistoryTable5)',
  md: 'ResourceHistoryTable 4px 6px -1px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.1), ResourceHistoryTable 2px 4px -2px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.1)',
  lg: 'ResourceHistoryTable 1ResourceHistoryTablepx 15px -3px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.1), ResourceHistoryTable 4px 6px -4px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.1)',
  xl: 'ResourceHistoryTable 2ResourceHistoryTablepx 25px -5px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.1), ResourceHistoryTable 8px 1ResourceHistoryTablepx -6px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.1)',
} as const;

export const BREAKPOINTS = {
  xs: ResourceHistoryTable,
  sm: 64ResourceHistoryTable,
  md: 768,
  lg: 1ResourceHistoryTable24,
  xl: 128ResourceHistoryTable,
  xxl: 144ResourceHistoryTable,
} as const;

export const Z_INDEX = {
  base: 1,
  dropdown: 1ResourceHistoryTable,
  sticky: 2ResourceHistoryTable,
  modal: 3ResourceHistoryTable,
  popover: 4ResourceHistoryTable,
  tooltip: 5ResourceHistoryTable,
  notification: 1ResourceHistoryTableResourceHistoryTable,
} as const;

// Mantine theme configuration
export const MANTINE_THEME = {
  colors: {
    primary: [
      '#E6F4FF',
      '#BAE7FF',
      '#91D5FF',
      '#69CResourceHistoryTableFF',
      '#4ResourceHistoryTableA9FF',
      '#189ResourceHistoryTableFF',
      '#ResourceHistoryTableResourceHistoryTable91FF', // Main primary
      '#ResourceHistoryTableResourceHistoryTable73CC',
      '#ResourceHistoryTableResourceHistoryTable5BB8',
      '#ResourceHistoryTableResourceHistoryTable4494',
    ],
    secondary: [
      '#E8F9FResourceHistoryTable',
      '#C3FResourceHistoryTableD3',
      '#9BE7B6',
      '#73DE99',
      '#4AD57C',
      '#21CC5F',
      '#ResourceHistoryTableResourceHistoryTableC853', // Main secondary
      '#ResourceHistoryTableResourceHistoryTableA142',
      '#ResourceHistoryTableResourceHistoryTable8A35',
      '#ResourceHistoryTableResourceHistoryTable7329',
    ],
    accent: [
      '#F3FResourceHistoryTableFF',
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
      '#E8FBFResourceHistoryTable',
      '#C3F4D3',
      '#9EEDB6',
      '#79E699',
      '#54DF7C',
      '#2FD85F',
      '#17C964', // Main success
      '#12A15ResourceHistoryTable',
      '#ResourceHistoryTableE7A3C',
      '#ResourceHistoryTableA5328',
    ],
    warning: [
      '#FFF7E6',
      '#FFECBA',
      '#FFEResourceHistoryTable8E',
      '#FFD462',
      '#FFC836',
      '#FFBCResourceHistoryTableA',
      '#FFBResourceHistoryTable17', // Main warning
      '#E699ResourceHistoryTableResourceHistoryTable',
      '#CC82ResourceHistoryTableResourceHistoryTable',
      '#B36BResourceHistoryTableResourceHistoryTable',
    ],
    error: [
      '#FFE6ED',
      '#FFBACF',
      '#FF8DB1',
      '#FF6193',
      '#FF3475',
      '#FFResourceHistoryTable757',
      '#F3126ResourceHistoryTable', // Main error
      '#D1ResourceHistoryTableE4F',
      '#AFResourceHistoryTableA3E',
      '#8DResourceHistoryTable62D',
    ],
    info: [
      '#E6F3FF',
      '#BAEResourceHistoryTableFF',
      '#8ECDFF',
      '#62BAFF',
      '#36A7FF',
      '#ResourceHistoryTableA94FF',
      '#ResourceHistoryTableResourceHistoryTable72F5', // Main info
      '#ResourceHistoryTableResourceHistoryTable5BC4',
      '#ResourceHistoryTableResourceHistoryTable4493',
      '#ResourceHistoryTableResourceHistoryTable2D62',
    ],
  },
  primaryColor: 'primary',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    sizes: {
      h1: { fontSize: '32px', lineHeight: '4ResourceHistoryTablepx' },
      h2: { fontSize: '24px', lineHeight: '32px' },
      h3: { fontSize: '2ResourceHistoryTablepx', lineHeight: '28px' },
      h4: { fontSize: '18px', lineHeight: '24px' },
      h5: { fontSize: '16px', lineHeight: '22px' },
      h6: { fontSize: '14px', lineHeight: '2ResourceHistoryTablepx' },
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
    xl: 'ResourceHistoryTable 25px 5ResourceHistoryTablepx -12px rgb(ResourceHistoryTable ResourceHistoryTable ResourceHistoryTable / ResourceHistoryTable.25)',
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
  oncology: '#F59EResourceHistoryTableB',
  pediatrics: '#1ResourceHistoryTableB981',
  radiology: '#6366F1',
  emergency: '#DC2626',
  surgery: '#7C3AED',
  pharmacy: '#ResourceHistoryTable6B6D4',
  internal_medicine: '#ResourceHistoryTable284C7',
  family_medicine: '#ResourceHistoryTable59669',
  psychiatry: '#CResourceHistoryTable26D3',
  dermatology: '#EA58ResourceHistoryTableC',
  orthopedics: '#7C2D12',
  gynecology: '#BE185D',
  ophthalmology: '#ResourceHistoryTableD9488',
  anesthesiology: '#4338CA',
} as const;

export const VITAL_SIGNS_RANGES = {
  temperature: {
    normal: { min: 36.1, max: 37.2, unit: 'celsius' },
    abnormal: { min: 35.ResourceHistoryTable, max: 4ResourceHistoryTable.ResourceHistoryTable, unit: 'celsius' },
  },
  bloodPressure: {
    systolic: {
      normal: { min: 9ResourceHistoryTable, max: 14ResourceHistoryTable, unit: 'mmHg' },
      hypertensive: { min: 14ResourceHistoryTable, max: 18ResourceHistoryTable, unit: 'mmHg' },
    },
    diastolic: {
      normal: { min: 6ResourceHistoryTable, max: 9ResourceHistoryTable, unit: 'mmHg' },
      hypertensive: { min: 9ResourceHistoryTable, max: 12ResourceHistoryTable, unit: 'mmHg' },
    },
  },
  heartRate: {
    normal: { min: 6ResourceHistoryTable, max: 1ResourceHistoryTableResourceHistoryTable, unit: 'bpm' },
    abnormal: { min: 3ResourceHistoryTable, max: 2ResourceHistoryTableResourceHistoryTable, unit: 'bpm' },
  },
  respiratoryRate: {
    normal: { min: 12, max: 2ResourceHistoryTable, unit: 'bpm' },
    abnormal: { min: 8, max: 4ResourceHistoryTable, unit: 'bpm' },
  },
  oxygenSaturation: {
    normal: { min: 95, max: 1ResourceHistoryTableResourceHistoryTable, unit: '%' },
    abnormal: { min: 8ResourceHistoryTable, max: 1ResourceHistoryTableResourceHistoryTable, unit: '%' },
  },
} as const;

export const ANIMATION_DURATIONS = {
  fast: 15ResourceHistoryTable,
  normal: 3ResourceHistoryTableResourceHistoryTable,
  slow: 5ResourceHistoryTableResourceHistoryTable,
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