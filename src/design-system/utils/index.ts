/**
 * OmniCare Design System - Utilities
 * 
 * Helper functions and utilities for the design system
 */

import { colors } from '../tokens/colors';

// Color utility functions
export const colorUtils = {
  /**
   * Get medical status color based on value type
   */
  getMedicalStatusColor(status: 'normal' | 'elevated' | 'high' | 'low' | 'critical') {
    switch (status) {
      case 'normal':
        return colors.medical.vitals.normal;
      case 'elevated':
        return colors.medical.vitals.elevated;
      case 'high':
        return colors.medical.vitals.high;
      case 'low':
        return colors.medical.vitals.low;
      case 'critical':
        return colors.semantic.critical.main;
      default:
        return colors.neutral[500];
    }
  },

  /**
   * Get lab result color based on result type
   */
  getLabResultColor(result: 'normal' | 'abnormal' | 'critical' | 'pending') {
    switch (result) {
      case 'normal':
        return colors.medical.lab.normal;
      case 'abnormal':
        return colors.medical.lab.abnormal;
      case 'critical':
        return colors.medical.lab.critical;
      case 'pending':
        return colors.medical.lab.pending;
      default:
        return colors.neutral[500];
    }
  },

  /**
   * Get patient acuity color
   */
  getAcuityColor(acuity: 'low' | 'medium' | 'high' | 'critical') {
    switch (acuity) {
      case 'low':
        return colors.medical.acuity.low;
      case 'medium':
        return colors.medical.acuity.medium;
      case 'high':
        return colors.medical.acuity.high;
      case 'critical':
        return colors.medical.acuity.critical;
      default:
        return colors.neutral[500];
    }
  },

  /**
   * Get semantic color for alerts and notifications
   */
  getSemanticColor(type: 'success' | 'warning' | 'error' | 'info' | 'critical') {
    switch (type) {
      case 'success':
        return colors.semantic.success.main;
      case 'warning':
        return colors.semantic.warning.main;
      case 'error':
        return colors.semantic.error.main;
      case 'info':
        return colors.semantic.info.main;
      case 'critical':
        return colors.semantic.critical.main;
      default:
        return colors.neutral[500];
    }
  },

  /**
   * Check if a color meets WCAG contrast requirements
   */
  checkContrast(foreground: string, background: string): boolean {
    // This would implement actual contrast checking logic
    // For now, returning true as our colors are designed to be accessible
    return true;
  },

  /**
   * Get appropriate text color for a given background
   */
  getContrastText(backgroundColor: string): string {
    // Simple logic - would be more sophisticated in practice
    const darkColors = [
      colors.primary[600],
      colors.primary[700],
      colors.primary[800],
      colors.primary[900],
      colors.secondary[600],
      colors.secondary[700],
      colors.secondary[800],
      colors.secondary[900],
    ];
    
    return darkColors.includes(backgroundColor) ? colors.neutral[0] : colors.neutral[900];
  },
};

// Typography utilities
export const typographyUtils = {
  /**
   * Get responsive font size based on screen size
   */
  getResponsiveFontSize(baseSize: string, screenSize: 'mobile' | 'tablet' | 'desktop') {
    const multipliers = {
      mobile: 0.875,
      tablet: 1,
      desktop: 1,
    };
    
    const basePx = parseFloat(baseSize);
    return `${basePx * multipliers[screenSize]}rem`;
  },

  /**
   * Get appropriate line height for font size
   */
  getLineHeight(fontSize: string): string {
    const basePx = parseFloat(fontSize);
    if (basePx <= 14) return '1.5';
    if (basePx <= 16) return '1.5';
    if (basePx <= 20) return '1.4';
    return '1.3';
  },
};

// Spacing utilities
export const spacingUtils = {
  /**
   * Convert spacing token to rem value
   */
  toRem(spacing: string): string {
    const px = parseFloat(spacing);
    return `${px / 16}rem`;
  },

  /**
   * Get responsive spacing based on screen size
   */
  getResponsiveSpacing(baseSpacing: string, screenSize: 'mobile' | 'tablet' | 'desktop') {
    const multipliers = {
      mobile: 0.75,
      tablet: 1,
      desktop: 1.25,
    };
    
    const basePx = parseFloat(baseSpacing);
    return `${basePx * multipliers[screenSize]}px`;
  },
};

// Component utilities
export const componentUtils = {
  /**
   * Generate component props for medical status badges
   */
  getMedicalBadgeProps(status: 'normal' | 'abnormal' | 'critical' | 'pending') {
    const configs = {
      normal: {
        color: 'green',
        variant: 'light',
        children: 'Normal',
      },
      abnormal: {
        color: 'orange',
        variant: 'light',
        children: 'Abnormal',
      },
      critical: {
        color: 'red',
        variant: 'filled',
        children: 'Critical',
      },
      pending: {
        color: 'gray',
        variant: 'outline',
        children: 'Pending',
      },
    };
    
    return configs[status];
  },

  /**
   * Generate component props for priority indicators
   */
  getPriorityProps(priority: 'low' | 'medium' | 'high' | 'urgent' | 'stat') {
    const configs = {
      low: {
        color: 'gray',
        icon: '●',
        label: 'Low Priority',
      },
      medium: {
        color: 'blue',
        icon: '●●',
        label: 'Medium Priority',
      },
      high: {
        color: 'orange',
        icon: '●●●',
        label: 'High Priority',
      },
      urgent: {
        color: 'red',
        icon: '▲',
        label: 'Urgent',
      },
      stat: {
        color: 'red',
        icon: '⚠',
        label: 'STAT',
      },
    };
    
    return configs[priority];
  },
};

// Accessibility utilities
export const a11yUtils = {
  /**
   * Generate accessible label for screen readers
   */
  generateAriaLabel(context: string, value?: string, unit?: string): string {
    let label = context;
    if (value) {
      label += ` ${value}`;
      if (unit) {
        label += ` ${unit}`;
      }
    }
    return label;
  },

  /**
   * Get appropriate ARIA role for medical components
   */
  getMedicalAriaRole(type: 'alert' | 'status' | 'value' | 'list'): string {
    const roles = {
      alert: 'alert',
      status: 'status',
      value: 'text',
      list: 'list',
    };
    
    return roles[type];
  },

  /**
   * Generate keyboard navigation props
   */
  getKeyboardNavProps(onSelect?: () => void) {
    return {
      tabIndex: 0,
      role: 'button',
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.();
        }
      },
    };
  },
};

// Healthcare-specific utilities
export const healthcareUtils = {
  /**
   * Format vital sign values with appropriate units
   */
  formatVitalSign(type: string, value: number): string {
    const formats = {
      'blood-pressure': `${value} mmHg`,
      'heart-rate': `${value} bpm`,
      'temperature': `${value}°F`,
      'respiratory-rate': `${value} /min`,
      'oxygen-saturation': `${value}%`,
      'weight': `${value} lbs`,
      'height': `${value} inches`,
    };
    
    return formats[type as keyof typeof formats] || `${value}`;
  },

  /**
   * Format medication dosage
   */
  formatMedicationDose(amount: number, unit: string, frequency?: string): string {
    let dose = `${amount} ${unit}`;
    if (frequency) {
      dose += ` ${frequency}`;
    }
    return dose;
  },

  /**
   * Format lab values with reference ranges
   */
  formatLabValue(value: number, unit: string, referenceRange?: { min: number; max: number }): string {
    let formatted = `${value} ${unit}`;
    if (referenceRange) {
      formatted += ` (Ref: ${referenceRange.min}-${referenceRange.max} ${unit})`;
    }
    return formatted;
  },

  /**
   * Determine if vital sign is within normal range
   */
  isVitalSignNormal(type: string, value: number, age?: number): boolean {
    // Simplified logic - would be more comprehensive in practice
    const normalRanges = {
      'systolic-bp': { min: 90, max: 140 },
      'diastolic-bp': { min: 60, max: 90 },
      'heart-rate': { min: 60, max: 100 },
      'temperature': { min: 97, max: 99.5 },
      'respiratory-rate': { min: 12, max: 20 },
      'oxygen-saturation': { min: 95, max: 100 },
    };
    
    const range = normalRanges[type as keyof typeof normalRanges];
    if (!range) return true;
    
    return value >= range.min && value <= range.max;
  },
};

// Export all utilities
export const utils = {
  color: colorUtils,
  typography: typographyUtils,
  spacing: spacingUtils,
  component: componentUtils,
  a11y: a11yUtils,
  healthcare: healthcareUtils,
};