/**
 * MedicalBadge Component
 * 
 * Healthcare-specific badge component for displaying medical statuses,
 * lab results, vital signs, and other clinical indicators
 */

import React from 'react';
import { Badge, BadgeProps } from '@mantine/core';
import { colorUtils, componentUtils, a11yUtils } from '../../utils';
import { colors } from '../../tokens/colors';

export interface MedicalBadgeProps extends Omit<BadgeProps, 'color' | 'variant'> {
  /** Medical status type */
  status: 'normal' | 'abnormal' | 'critical' | 'pending' | 'elevated' | 'high' | 'low';
  
  /** Badge category for different medical contexts */
  category?: 'lab' | 'vital' | 'medication' | 'general';
  
  /** Optional custom label - if not provided, uses status as label */
  label?: string;
  
  /** Show icon indicator */
  showIcon?: boolean;
  
  /** Priority level for urgent items */
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'stat';
  
  /** Make badge pulsing for critical alerts */
  pulse?: boolean;
  
  /** Accessible description for screen readers */
  ariaDescription?: string;
}

const statusIcons = {
  normal: '✓',
  abnormal: '!',
  critical: '⚠',
  pending: '●',
  elevated: '↑',
  high: '▲',
  low: '▼',
} as const;

const priorityIcons = {
  low: '●',
  medium: '●●',
  high: '●●●',
  urgent: '▲',
  stat: '⚠',
} as const;

export const MedicalBadge: React.FC<MedicalBadgeProps> = ({
  status,
  category = 'general',
  label,
  showIcon = false,
  priority,
  pulse = false,
  ariaDescription,
  children,
  className,
  ...props
}) => {
  // Determine color based on category and status
  const getColor = () => {
    if (category === 'lab') {
      return colorUtils.getLabResultColor(status as any);
    }
    if (category === 'vital') {
      return colorUtils.getMedicalStatusColor(status as any);
    }
    return colorUtils.getSemanticColor(
      status === 'critical' ? 'critical' : 
      status === 'abnormal' || status === 'elevated' || status === 'high' ? 'warning' :
      status === 'normal' ? 'success' : 'info'
    );
  };

  // Get appropriate variant based on criticality
  const getVariant = (): BadgeProps['variant'] => {
    if (status === 'critical' || priority === 'stat') return 'filled';
    if (status === 'abnormal' || status === 'elevated' || status === 'high') return 'light';
    if (status === 'pending') return 'outline';
    return 'light';
  };

  // Generate display text
  const getDisplayText = () => {
    if (label) return label;
    if (children) return children;
    
    // Default labels based on status
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Get Mantine color name based on our color
  const getMantineColor = () => {
    switch (status) {
      case 'normal':
        return 'green';
      case 'critical':
        return 'red';
      case 'abnormal':
      case 'elevated':
      case 'high':
        return 'orange';
      case 'low':
        return 'blue';
      case 'pending':
        return 'gray';
      default:
        return 'blue';
    }
  };

  // Generate accessibility props
  const ariaLabel = a11yUtils.generateAriaLabel(
    ariaDescription || `Medical status: ${status}`,
    priority ? `Priority: ${priority}` : undefined
  );

  // Pulsing animation styles
  const pulseStyle = pulse ? {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  } : {};

  return (
    <>
      {pulse && (
        <style jsx>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: .5;
            }
          }
        `}</style>
      )}
      
      <Badge
        color={getMantineColor()}
        variant={getVariant()}
        className={`medical-badge ${className || ''}`}
        aria-label={ariaLabel}
        role="status"
        style={{
          ...pulseStyle,
          fontWeight: 500,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          minWidth: '48px',
          justifyContent: 'center',
        }}
        {...props}
      >
        {showIcon && (
          <span style={{ marginRight: '4px' }}>
            {priority ? priorityIcons[priority] : statusIcons[status]}
          </span>
        )}
        {getDisplayText()}
      </Badge>
    </>
  );
};

MedicalBadge.displayName = 'MedicalBadge';