import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Card, Chip} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {VitalSign, VitalSignType} from '@types/index';
import {theme} from '@config/theme';

interface VitalSignsCardProps {
  vitals: VitalSign[];
  title?: string;
  compact?: boolean;
  showTimestamp?: boolean;
}

export const VitalSignsCard: React.FC<VitalSignsCardProps> = ({
  vitals,
  title = 'Vital Signs',
  compact = false,
  showTimestamp = true,
}) => {
  const getVitalIcon = (type: VitalSignType): string => {
    switch (type) {
      case 'blood_pressure_systolic':
      case 'blood_pressure_diastolic':
        return 'gauge';
      case 'heart_rate':
        return 'heart-pulse';
      case 'respiratory_rate':
        return 'lungs';
      case 'temperature':
        return 'thermometer';
      case 'oxygen_saturation':
        return 'water-percent';
      case 'blood_glucose':
        return 'water-check';
      case 'weight':
        return 'scale-bathroom';
      case 'height':
        return 'human-male-height';
      case 'bmi':
        return 'calculator';
      case 'pain_score':
        return 'emoticon-sad';
      default:
        return 'chart-line';
    }
  };

  const getVitalName = (type: VitalSignType): string => {
    switch (type) {
      case 'blood_pressure_systolic':
        return 'BP Systolic';
      case 'blood_pressure_diastolic':
        return 'BP Diastolic';
      case 'heart_rate':
        return 'Heart Rate';
      case 'respiratory_rate':
        return 'Resp Rate';
      case 'temperature':
        return 'Temperature';
      case 'oxygen_saturation':
        return 'SpO2';
      case 'blood_glucose':
        return 'Blood Glucose';
      case 'weight':
        return 'Weight';
      case 'height':
        return 'Height';
      case 'bmi':
        return 'BMI';
      case 'pain_score':
        return 'Pain Score';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getVitalStatus = (vital: VitalSign): 'normal' | 'abnormal' | 'critical' => {
    // Simplified normal ranges - in production this would be more comprehensive
    const normalRanges: Record<VitalSignType, {min: number; max: number}> = {
      blood_pressure_systolic: {min: 90, max: 140},
      blood_pressure_diastolic: {min: 60, max: 90},
      heart_rate: {min: 60, max: 100},
      respiratory_rate: {min: 12, max: 20},
      temperature: {min: 36.1, max: 37.2},
      oxygen_saturation: {min: 95, max: 100},
      blood_glucose: {min: 70, max: 140},
      weight: {min: 0, max: 1000}, // Wide range, context-dependent
      height: {min: 0, max: 300}, // Wide range, context-dependent
      bmi: {min: 18.5, max: 24.9},
      pain_score: {min: 0, max: 3}, // 0-3 is typically considered acceptable
    };

    const range = normalRanges[vital.type];
    if (!range) return 'normal';

    if (vital.value < range.min || vital.value > range.max) {
      // Critical values for certain vital signs
      if (vital.type === 'oxygen_saturation' && vital.value < 90) return 'critical';
      if (vital.type === 'blood_pressure_systolic' && (vital.value > 180 || vital.value < 70)) return 'critical';
      if (vital.type === 'heart_rate' && (vital.value > 120 || vital.value < 50)) return 'critical';
      if (vital.type === 'temperature' && (vital.value > 38.5 || vital.value < 35)) return 'critical';
      
      return 'abnormal';
    }

    return 'normal';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'critical': return theme.colors.error;
      case 'abnormal': return '#FF9800';
      case 'normal': return theme.colors.primary;
      default: return theme.colors.onSurfaceVariant;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 1) {
      return diffMinutes === 0 ? 'Just now' : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupedVitals = vitals.reduce((acc, vital) => {
    if (!acc[vital.type]) {
      acc[vital.type] = [];
    }
    acc[vital.type].push(vital);
    return acc;
  }, {} as Record<VitalSignType, VitalSign[]>);

  // Get the most recent vital for each type
  const latestVitals = Object.entries(groupedVitals).map(([type, vitalsList]) => {
    return vitalsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  });

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {showTimestamp && latestVitals.length > 0 && (
            <Text style={styles.timestamp}>
              {formatTimestamp(latestVitals[0].timestamp)}
            </Text>
          )}
        </View>

        <View style={[styles.vitalsGrid, compact && styles.compactGrid]}>
          {latestVitals.map((vital) => {
            const status = getVitalStatus(vital);
            return (
              <View key={vital.id} style={[styles.vitalItem, compact && styles.compactItem]}>
                <View style={styles.vitalIcon}>
                  <Icon 
                    name={getVitalIcon(vital.type)} 
                    size={compact ? 20 : 24} 
                    color={getStatusColor(status)} 
                  />
                </View>
                <View style={styles.vitalData}>
                  <Text style={[styles.vitalName, compact && styles.compactName]}>
                    {getVitalName(vital.type)}
                  </Text>
                  <View style={styles.valueContainer}>
                    <Text style={[styles.vitalValue, compact && styles.compactValue]}>
                      {vital.value}
                    </Text>
                    <Text style={[styles.vitalUnit, compact && styles.compactUnit]}>
                      {vital.unit}
                    </Text>
                  </View>
                  {status !== 'normal' && (
                    <Chip 
                      mode="flat"
                      compact
                      textStyle={[styles.statusText, {color: getStatusColor(status)}]}
                      style={[styles.statusChip, {backgroundColor: getStatusColor(status) + '20'}]}
                    >
                      {status}
                    </Chip>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {latestVitals.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="heart-pulse" size={48} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No vital signs recorded</Text>
          </View>
        )}

        {vitals.length > 0 && vitals[0].notes && (
          <View style={styles.notes}>
            <Icon name="note-text" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.notesText}>{vitals[0].notes}</Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  compactGrid: {
    gap: 8,
  },
  vitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '45%',
    padding: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
  },
  compactItem: {
    padding: 6,
    minWidth: '30%',
  },
  vitalIcon: {
    marginRight: 8,
  },
  vitalData: {
    flex: 1,
  },
  vitalName: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 2,
  },
  compactName: {
    fontSize: 10,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginRight: 4,
  },
  compactValue: {
    fontSize: 14,
  },
  vitalUnit: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  compactUnit: {
    fontSize: 10,
  },
  statusChip: {
    height: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginTop: 8,
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    gap: 6,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    flex: 1,
    fontStyle: 'italic',
  },
});