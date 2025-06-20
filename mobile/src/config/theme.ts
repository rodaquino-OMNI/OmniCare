import {MD3LightTheme, configureFonts} from 'react-native-paper';

// Medical/Healthcare color palette
const colors = {
  primary: '#2E8B57', // Medical green
  primaryContainer: '#90EE90',
  secondary: '#1E90FF', // Medical blue
  secondaryContainer: '#87CEEB',
  tertiary: '#FF6347', // Alert/urgent red
  tertiaryContainer: '#FFB6C1',
  surface: '#FFFFFF',
  surfaceVariant: '#F5F5F5',
  background: '#FAFAFA',
  error: '#DC143C',
  errorContainer: '#FFEBEE',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onTertiary: '#FFFFFF',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  onBackground: '#1C1B1F',
  onError: '#FFFFFF',
  onErrorContainer: '#410E0B',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#90EE90',
  shadow: '#000000',
  scrim: '#000000',
  // Custom medical colors
  success: '#28A745',
  warning: '#FFC107',
  info: '#17A2B8',
  critical: '#DC3545',
  stable: '#6C757D',
  // Priority colors
  highPriority: '#FF4444',
  mediumPriority: '#FFAA00',
  lowPriority: '#00C851',
  // Status colors
  activeStatus: '#4CAF50',
  inactiveStatus: '#9E9E9E',
  pendingStatus: '#FF9800',
  completedStatus: '#2196F3',
};

const fontConfig = configureFonts({
  config: {
    displayLarge: {
      fontFamily: 'System',
      fontSize: 57,
      fontWeight: '400',
      lineHeight: 64,
      letterSpacing: 0,
    },
    displayMedium: {
      fontFamily: 'System',
      fontSize: 45,
      fontWeight: '400',
      lineHeight: 52,
      letterSpacing: 0,
    },
    displaySmall: {
      fontFamily: 'System',
      fontSize: 36,
      fontWeight: '400',
      lineHeight: 44,
      letterSpacing: 0,
    },
    headlineLarge: {
      fontFamily: 'System',
      fontSize: 32,
      fontWeight: '600',
      lineHeight: 40,
      letterSpacing: 0,
    },
    headlineMedium: {
      fontFamily: 'System',
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 36,
      letterSpacing: 0,
    },
    headlineSmall: {
      fontFamily: 'System',
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
      letterSpacing: 0,
    },
    titleLarge: {
      fontFamily: 'System',
      fontSize: 22,
      fontWeight: '600',
      lineHeight: 28,
      letterSpacing: 0,
    },
    titleMedium: {
      fontFamily: 'System',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
      letterSpacing: 0.15,
    },
    titleSmall: {
      fontFamily: 'System',
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    bodyLarge: {
      fontFamily: 'System',
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
      letterSpacing: 0.5,
    },
    bodyMedium: {
      fontFamily: 'System',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    bodySmall: {
      fontFamily: 'System',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      letterSpacing: 0.4,
    },
    labelLarge: {
      fontFamily: 'System',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    labelMedium: {
      fontFamily: 'System',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
      letterSpacing: 0.5,
    },
    labelSmall: {
      fontFamily: 'System',
      fontSize: 11,
      fontWeight: '500',
      lineHeight: 16,
      letterSpacing: 0.5,
    },
  },
});

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...colors,
  },
  fonts: fontConfig,
  roundness: 8,
  animation: {
    scale: 1.0,
  },
};

// Theme extensions for medical app
export const medicalTheme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    extraLarge: 20,
  },
  shadows: {
    small: {
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    medium: {
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    large: {
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
  // Medical specific styling
  medical: {
    vitals: {
      normal: colors.success,
      abnormal: colors.warning,
      critical: colors.critical,
    },
    priority: {
      high: colors.highPriority,
      medium: colors.mediumPriority,
      low: colors.lowPriority,
    },
    status: {
      active: colors.activeStatus,
      inactive: colors.inactiveStatus,
      pending: colors.pendingStatus,
      completed: colors.completedStatus,
    },
  },
};

export type MedicalTheme = typeof medicalTheme;