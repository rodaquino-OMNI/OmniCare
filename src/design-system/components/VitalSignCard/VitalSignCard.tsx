/**
 * VitalSignCard Component
 * 
 * Display component for patient vital signs with status indicators,
 * trend visualization, and accessibility features
 */

import React from 'react';
import { Card, Group, Text, Stack, Flex, Box } from '@mantine/core';
import { MedicalBadge } from '../MedicalBadge';
import { colors } from '../../tokens/colors';
import { typography } from '../../tokens/typography';
import { spacing } from '../../tokens/spacing';
import { healthcareUtils, colorUtils, a11yUtils } from '../../utils';

export interface VitalSignData {
  /** Vital sign type */
  type: 'blood-pressure' | 'heart-rate' | 'temperature' | 'respiratory-rate' | 'oxygen-saturation' | 'height' | 'weight';
  
  /** Current value */
  value: number | string;
  
  /** For blood pressure - systolic/diastolic */
  systolic?: number;
  diastolic?: number;
  
  /** Unit of measurement */
  unit: string;
  
  /** Timestamp of measurement */
  timestamp: Date;
  
  /** Normal range for this vital sign */
  normalRange?: {
    min: number;
    max: number;
  };
  
  /** Status based on normal ranges */
  status?: 'normal' | 'elevated' | 'high' | 'low' | 'critical';
  
  /** Trend indicator */
  trend?: 'up' | 'down' | 'stable';
  
  /** Previous value for comparison */
  previousValue?: number;
  
  /** Notes or comments */
  notes?: string;
}

export interface VitalSignCardProps {
  /** Vital sign data */
  data: VitalSignData;
  
  /** Show trend indicator */
  showTrend?: boolean;
  
  /** Show normal range */
  showRange?: boolean;
  
  /** Show timestamp */
  showTimestamp?: boolean;
  
  /** Compact display mode */
  compact?: boolean;
  
  /** Click handler */
  onClick?: () => void;
  
  /** Additional CSS classes */
  className?: string;
}

const vitalSignLabels = {
  'blood-pressure': 'Blood Pressure',
  'heart-rate': 'Heart Rate',
  'temperature': 'Temperature',
  'respiratory-rate': 'Respiratory Rate',
  'oxygen-saturation': 'Oxygen Saturation',
  'height': 'Height',
  'weight': 'Weight',
} as const;

const trendIcons = {
  up: '↗',
  down: '↘',
  stable: '→',
} as const;

const trendColors = {
  up: colors.accent.orange[500],
  down: colors.primary[500],
  stable: colors.neutral[500],
} as const;

export const VitalSignCard: React.FC<VitalSignCardProps> = ({
  data,
  showTrend = true,
  showRange = true,
  showTimestamp = true,
  compact = false,
  onClick,
  className,
}) => {
  const {
    type,
    value,
    systolic,
    diastolic,
    unit,
    timestamp,
    normalRange,
    status = 'normal',
    trend,
    previousValue,
    notes,
  } = data;

  // Format the display value
  const getDisplayValue = () => {
    if (type === 'blood-pressure' && systolic && diastolic) {
      return `${systolic}/${diastolic}`;
    }
    return healthcareUtils.formatVitalSign(type, typeof value === 'number' ? value : parseFloat(value as string));
  };

  // Get status color
  const getStatusColor = () => {
    return colorUtils.getMedicalStatusColor(status);
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Generate accessibility label
  const ariaLabel = a11yUtils.generateAriaLabel(
    `${vitalSignLabels[type]}: ${getDisplayValue()}`,
    status !== 'normal' ? `Status: ${status}` : undefined
  );

  // Determine if clickable
  const isClickable = !!onClick;

  return (
    <Card
      className={`vital-sign-card ${className || ''}`}
      p={compact ? 'sm' : 'md'}
      radius="md"
      withBorder
      style={{
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 150ms ease',
        backgroundColor: colors.neutral[0],
        borderColor: colors.neutral[200],
        minHeight: compact ? '80px' : '120px',
      }}
      onClick={onClick}
      aria-label={ariaLabel}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        '&:hover': isClickable ? {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          borderColor: colors.primary[300],
        } : {},
      }}
    >
      <Stack spacing={compact ? 'xs' : 'sm'}>
        {/* Header with label and status */}
        <Flex justify="space-between" align="center">
          <Text
            size={compact ? 'xs' : 'sm'}
            weight={500}
            color={colors.neutral[600]}
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: compact ? '0.7rem' : '0.75rem',
            }}
          >
            {vitalSignLabels[type]}
          </Text>
          
          <MedicalBadge
            status={status}
            category="vital"
            showIcon
            pulse={status === 'critical'}
            size={compact ? 'xs' : 'sm'}
          />
        </Flex>

        {/* Value and trend */}
        <Flex align="center" gap="sm">
          <Text
            size={compact ? 'lg' : 'xl'}
            weight={700}
            style={{
              fontFamily: typography.code.fontFamily,
              color: getStatusColor(),
              fontSize: compact ? '1.25rem' : '1.5rem',
            }}
          >
            {getDisplayValue()}
          </Text>
          
          {showTrend && trend && (
            <Box
              style={{
                color: trendColors[trend],
                fontSize: compact ? '1rem' : '1.25rem',
                fontWeight: 600,
              }}
              title={`Trend: ${trend}`}
            >
              {trendIcons[trend]}
            </Box>
          )}
        </Flex>

        {/* Additional information */}
        {!compact && (
          <Stack spacing="xs">
            {showRange && normalRange && (
              <Text size="xs" color={colors.neutral[500]}>
                Normal: {normalRange.min}-{normalRange.max} {unit}
              </Text>
            )}
            
            {showTimestamp && (
              <Text size="xs" color={colors.neutral[500]}>
                {formatTimestamp(timestamp)}
              </Text>
            )}
            
            {notes && (
              <Text size="xs" color={colors.neutral[600]} italic>
                {notes}
              </Text>
            )}
          </Stack>
        )}
        
        {compact && showTimestamp && (
          <Text size="xs" color={colors.neutral[400]}>
            {formatTimestamp(timestamp)}
          </Text>
        )}
      </Stack>
    </Card>
  );
};

VitalSignCard.displayName = 'VitalSignCard';