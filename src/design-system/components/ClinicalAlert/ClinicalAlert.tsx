/**
 * ClinicalAlert Component
 * 
 * Healthcare-specific alert component for displaying critical medical information,
 * drug interactions, patient safety alerts, and clinical decision support
 */

import React from 'react';
import { Alert, Button, Group, Text, Stack, ActionIcon, Flex, Box } from '@mantine/core';
import { colors } from '../../tokens/colors';
import { typography } from '../../tokens/typography';
import { spacing } from '../../tokens/spacing';
import { colorUtils, a11yUtils } from '../../utils';

export interface ClinicalAlertProps {
  /** Alert type determines color and urgency */
  type: 'info' | 'warning' | 'error' | 'critical' | 'drug-interaction' | 'allergy' | 'safety';
  
  /** Alert title */
  title: string;
  
  /** Alert message */
  message: string;
  
  /** Alert priority level */
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'stat';
  
  /** Patient context for the alert */
  patientContext?: {
    name: string;
    id: string;
    room?: string;
  };
  
  /** Timestamp of the alert */
  timestamp?: Date;
  
  /** Alert source (e.g., medication system, lab, etc.) */
  source?: string;
  
  /** Whether alert can be dismissed */
  dismissible?: boolean;
  
  /** Whether alert requires acknowledgment */
  requiresAcknowledgment?: boolean;
  
  /** Suggested actions */
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
  
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  
  /** Callback when alert is acknowledged */
  onAcknowledge?: () => void;
  
  /** Additional details or context */
  details?: string;
  
  /** Reference information (guidelines, protocols, etc.) */
  reference?: {
    title: string;
    url?: string;
  };
  
  /** Auto-dismiss after specified milliseconds */
  autoDismiss?: number;
  
  /** Show pulsing animation for critical alerts */
  pulse?: boolean;
  
  /** Custom CSS classes */
  className?: string;
}

const alertIcons = {
  info: 'ℹ',
  warning: '⚠',
  error: '⚠',
  critical: '🚨',
  'drug-interaction': '💊',
  allergy: '⚠',
  safety: '🛡',
} as const;

const priorityIcons = {
  low: '●',
  medium: '●●',
  high: '●●●',
  urgent: '▲',
  stat: '🚨',
} as const;

export const ClinicalAlert: React.FC<ClinicalAlertProps> = ({
  type,
  title,
  message,
  priority = 'medium',
  patientContext,
  timestamp,
  source,
  dismissible = true,
  requiresAcknowledgment = false,
  actions = [],
  onDismiss,
  onAcknowledge,
  details,
  reference,
  autoDismiss,
  pulse = false,
  className,
}) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const [isAcknowledged, setIsAcknowledged] = React.useState(false);

  // Auto-dismiss functionality
  React.useEffect(() => {
    if (autoDismiss && autoDismiss > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismiss);
      
      return () => clearTimeout(timer);
    }
  }, [autoDismiss]);

  // Get alert color based on type and priority
  const getAlertColor = () => {
    switch (type) {
      case 'critical':
      case 'allergy':
      case 'safety':
        return 'red';
      case 'error':
        return 'red';
      case 'warning':
      case 'drug-interaction':
        return 'orange';
      case 'info':
      default:
        return 'blue';
    }
  };

  // Get background color for high priority alerts
  const getBackgroundColor = () => {
    if (priority === 'stat' || priority === 'urgent') {
      return type === 'critical' ? colors.semantic.critical.light : colors.semantic.warning.light;
    }
    return undefined;
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  // Handle acknowledgment
  const handleAcknowledge = () => {
    setIsAcknowledged(true);
    onAcknowledge?.();
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

  // Generate accessibility props
  const ariaProps = {
    role: type === 'critical' || priority === 'stat' ? 'alert' : 'status',
    'aria-live': type === 'critical' || priority === 'stat' ? 'assertive' : 'polite',
    'aria-label': a11yUtils.generateAriaLabel(
      `${type} alert: ${title}`,
      priority !== 'medium' ? `Priority: ${priority}` : undefined
    ),
  };

  // Don't render if dismissed
  if (!isVisible) return null;

  // Pulsing animation for critical alerts
  const pulseStyle = pulse || (type === 'critical' && priority === 'stat') ? {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  } : {};

  return (
    <>
      {(pulse || (type === 'critical' && priority === 'stat')) && (
        <style jsx>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: .85;
            }
          }
        `}</style>
      )}
      
      <Alert
        color={getAlertColor()}
        className={`clinical-alert ${className || ''}`}
        withCloseButton={dismissible && !requiresAcknowledgment}
        onClose={dismissible && !requiresAcknowledgment ? handleDismiss : undefined}
        style={{
          ...pulseStyle,
          backgroundColor: getBackgroundColor(),
          border: `2px solid ${colorUtils.getSemanticColor(
            type === 'critical' ? 'critical' : 
            type === 'error' ? 'error' :
            type === 'warning' || type === 'drug-interaction' ? 'warning' : 'info'
          )}`,
          borderRadius: '8px',
          marginBottom: spacing[4],
        }}
        {...ariaProps}
      >
        <Stack spacing="sm">
          {/* Header with title, priority, and patient context */}
          <Flex justify="space-between" align="flex-start">
            <Group spacing="xs" align="center">
              <Text size="lg" weight={700} color={getAlertColor()}>
                {alertIcons[type]} {title}
              </Text>
              
              {priority !== 'medium' && (
                <Box
                  style={{
                    backgroundColor: colorUtils.getSemanticColor(
                      priority === 'stat' || priority === 'urgent' ? 'error' : 'warning'
                    ),
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {priorityIcons[priority]} {priority}
                </Box>
              )}
            </Group>
            
            {patientContext && (
              <Box style={{ textAlign: 'right' }}>
                <Text size="sm" weight={600} color={colors.neutral[700]}>
                  {patientContext.name}
                </Text>
                <Text size="xs" color={colors.neutral[500]}>
                  ID: {patientContext.id}
                  {patientContext.room && ` • Room ${patientContext.room}`}
                </Text>
              </Box>
            )}
          </Flex>

          {/* Alert message */}
          <Text size="sm" style={{ lineHeight: 1.5 }}>
            {message}
          </Text>
          
          {/* Additional details */}
          {details && (
            <Text size="xs" color={colors.neutral[600]} style={{ fontStyle: 'italic' }}>
              {details}
            </Text>
          )}

          {/* Metadata */}
          <Group spacing="md" style={{ fontSize: '0.75rem', color: colors.neutral[500] }}>
            {timestamp && (
              <Text size="xs">{formatTimestamp(timestamp)}</Text>
            )}
            {source && (
              <Text size="xs">Source: {source}</Text>
            )}
            {reference && (
              <Text size="xs">
                Ref:{' '}
                {reference.url ? (
                  <a href={reference.url} target="_blank" rel="noopener noreferrer">
                    {reference.title}
                  </a>
                ) : (
                  reference.title
                )}
              </Text>
            )}
          </Group>

          {/* Actions */}
          {(actions.length > 0 || requiresAcknowledgment) && (
            <Group spacing="sm" style={{ marginTop: spacing[2] }}>
              {requiresAcknowledgment && !isAcknowledged && (
                <Button
                  size="sm"
                  variant="filled"
                  color={getAlertColor()}
                  onClick={handleAcknowledge}
                >
                  Acknowledge Alert
                </Button>
              )}
              
              {actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant === 'primary' ? 'filled' : action.variant === 'danger' ? 'outline' : 'light'}
                  color={action.variant === 'danger' ? 'red' : getAlertColor()}
                  onClick={action.action}
                >
                  {action.label}
                </Button>
              ))}
              
              {dismissible && requiresAcknowledgment && isAcknowledged && (
                <Button
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={handleDismiss}
                >
                  Dismiss
                </Button>
              )}
            </Group>
          )}
        </Stack>
      </Alert>
    </>
  );
};

ClinicalAlert.displayName = 'ClinicalAlert';