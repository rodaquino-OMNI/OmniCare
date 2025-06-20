import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Card, Chip, Badge, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {ClinicalTask} from '@types/index';
import {theme} from '@config/theme';

interface TaskCardProps {
  task: ClinicalTask;
  onPress?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  compact?: boolean;
  showActions?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onComplete,
  onSkip,
  compact = false,
  showActions = true,
}) => {
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return '#D32F2F';
      case 'medium': return '#F57C00';
      case 'low': return '#388E3C';
      default: return '#757575';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'in-progress': return '#2196F3';
      case 'requested': return '#FF9800';
      case 'ready': return '#9C27B0';
      case 'failed': return '#F44336';
      default: return '#757575';
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'medication_administration': return 'pill';
      case 'vital_signs': return 'heart-pulse';
      case 'patient_assessment': return 'clipboard-text';
      case 'discharge_planning': return 'exit-to-app';
      case 'documentation': return 'file-document';
      case 'lab_collection': return 'test-tube';
      case 'imaging': return 'camera';
      case 'patient_transport': return 'wheelchair-accessibility';
      case 'equipment_maintenance': return 'tools';
      default: return 'clipboard-check';
    }
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString();
    }
  };

  const isOverdue = (): boolean => {
    if (!task.executionPeriod?.end) return false;
    return new Date(task.executionPeriod.end) < new Date();
  };

  const dueDate = task.executionPeriod?.end;
  const isTaskOverdue = isOverdue();

  return (
    <Card style={[styles.card, compact && styles.compactCard]} mode="outlined">
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Card.Content style={styles.content}>
          <View style={styles.header}>
            <View style={styles.taskInfo}>
              <Icon 
                name={getCategoryIcon(task.category)} 
                size={24} 
                color={theme.colors.primary} 
              />
              <View style={styles.titleContainer}>
                <Text style={[styles.taskTitle, compact && styles.compactTitle]} numberOfLines={compact ? 1 : 2}>
                  {task.description || 'Clinical Task'}
                </Text>
                {task.patientId && (
                  <Text style={styles.patientInfo}>
                    Patient: {task.patientId}
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.badges}>
              <Badge 
                style={[styles.priorityBadge, {backgroundColor: getPriorityColor(task.priority)}]}
                size={8}
              />
              <Chip 
                mode="outlined" 
                compact
                textStyle={[styles.statusText, {color: getStatusColor(task.status)}]}
                style={[styles.statusChip, {borderColor: getStatusColor(task.status)}]}
              >
                {task.status}
              </Chip>
            </View>
          </View>

          {!compact && (
            <View style={styles.details}>
              {dueDate && (
                <View style={styles.timeInfo}>
                  <Icon 
                    name="clock-outline" 
                    size={16} 
                    color={isTaskOverdue ? theme.colors.error : theme.colors.onSurfaceVariant} 
                  />
                  <Text style={[
                    styles.timeText,
                    isTaskOverdue && styles.overdueText
                  ]}>
                    Due: {formatDate(dueDate)} at {formatTime(dueDate)}
                    {isTaskOverdue && ' (Overdue)'}
                  </Text>
                </View>
              )}
              
              {task.location && (
                <View style={styles.locationInfo}>
                  <Icon name="map-marker" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text style={styles.locationText}>{task.location}</Text>
                </View>
              )}
              
              {task.estimatedDuration && (
                <View style={styles.durationInfo}>
                  <Icon name="timer" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text style={styles.durationText}>
                    Est. {task.estimatedDuration} min
                  </Text>
                </View>
              )}
              
              {task.equipment && task.equipment.length > 0 && (
                <View style={styles.equipmentInfo}>
                  <Icon name="medical-bag" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text style={styles.equipmentText}>
                    Equipment: {task.equipment.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {showActions && task.status !== 'completed' && !compact && (
            <View style={styles.actions}>
              {task.status === 'ready' && onComplete && (
                <Button
                  mode="contained"
                  onPress={onComplete}
                  style={styles.completeButton}
                  icon="check"
                  compact
                >
                  Complete
                </Button>
              )}
              {onSkip && (
                <Button
                  mode="outlined"
                  onPress={onSkip}
                  style={styles.skipButton}
                  icon="skip-next"
                  compact
                >
                  Skip
                </Button>
              )}
            </View>
          )}
        </Card.Content>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
    elevation: 2,
  },
  compactCard: {
    marginVertical: 2,
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: 14,
  },
  patientInfo: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priorityBadge: {
    alignSelf: 'flex-end',
  },
  statusChip: {
    height: 24,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    gap: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  overdueText: {
    color: theme.colors.error,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  equipmentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  equipmentText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  completeButton: {
    minWidth: 100,
  },
  skipButton: {
    minWidth: 80,
  },
});