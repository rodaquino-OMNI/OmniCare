import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Card, Avatar, Badge} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {PatientSummary, RiskFlag} from '@types/index';
import {theme} from '@config/theme';

interface PatientCardProps {
  patient: PatientSummary;
  onPress?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  onPress,
  showDetails = true,
  compact = false,
}) => {
  const formatAge = (birthDate?: string): string => {
    if (!birthDate) return 'Unknown';
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    return `${age}y`;
  };

  const getRiskColor = (risk: RiskFlag): string => {
    switch (risk.severity) {
      case 'critical': return '#D32F2F';
      case 'high': return '#F57C00';
      case 'medium': return '#FBC02D';
      case 'low': return '#388E3C';
      default: return '#757575';
    }
  };

  const getInitials = (name?: string): string => {
    if (!name) return 'UN';
    const nameParts = name.split(' ');
    return nameParts
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const patientName = `${patient.name?.[0]?.given?.[0] || ''} ${patient.name?.[0]?.family || ''}`.trim() || 'Unknown Patient';
  const patientId = patient.id || 'N/A';
  const room = patient.currentLocation || 'Not assigned';
  const age = formatAge(patient.birthDate);
  const gender = patient.gender || 'Unknown';

  return (
    <Card style={[styles.card, compact && styles.compactCard]} mode="outlined">
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Card.Content style={styles.content}>
          <View style={styles.header}>
            <View style={styles.patientInfo}>
              <Avatar.Text
                size={compact ? 40 : 50}
                label={getInitials(patientName)}
                style={styles.avatar}
              />
              <View style={styles.nameContainer}>
                <Text style={[styles.patientName, compact && styles.compactName]}>
                  {patientName}
                </Text>
                <Text style={styles.patientId}>ID: {patientId}</Text>
                {!compact && (
                  <Text style={styles.demographics}>
                    {age} • {gender} • Room {room}
                  </Text>
                )}
              </View>
            </View>
            
            {patient.riskFlags && patient.riskFlags.length > 0 && (
              <View style={styles.riskFlags}>
                {patient.riskFlags.slice(0, compact ? 1 : 3).map((risk, index) => (
                  <Badge
                    key={index}
                    style={[styles.riskBadge, {backgroundColor: getRiskColor(risk)}]}
                    size={compact ? 8 : 12}
                  />
                ))}
              </View>
            )}
          </View>

          {showDetails && !compact && (
            <View style={styles.details}>
              {patient.allergies && patient.allergies.length > 0 && (
                <View style={styles.allergies}>
                  <Icon name="alert-circle" size={16} color={theme.colors.error} />
                  <Text style={styles.allergyText}>
                    Allergies: {patient.allergies.join(', ')}
                  </Text>
                </View>
              )}
              
              {patient.activeTasks && patient.activeTasks.length > 0 && (
                <View style={styles.taskInfo}>
                  <Icon name="clipboard-check" size={16} color={theme.colors.primary} />
                  <Text style={styles.taskText}>
                    {patient.activeTasks.length} active task{patient.activeTasks.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              
              {patient.recentVitals && patient.recentVitals.length > 0 && (
                <View style={styles.vitalsInfo}>
                  <Icon name="heart-pulse" size={16} color={theme.colors.secondary} />
                  <Text style={styles.vitalsText}>
                    Last vitals: {new Date(patient.recentVitals[0].timestamp).toLocaleTimeString()}
                  </Text>
                </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  compactName: {
    fontSize: 16,
  },
  patientId: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  demographics: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  riskFlags: {
    flexDirection: 'row',
    gap: 4,
  },
  riskBadge: {
    borderRadius: 6,
  },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    gap: 8,
  },
  allergies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allergyText: {
    fontSize: 14,
    color: theme.colors.error,
    flex: 1,
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  vitalsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vitalsText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
});