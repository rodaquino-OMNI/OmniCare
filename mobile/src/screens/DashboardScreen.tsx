import React, {useEffect, useState} from 'react';
import {View, StyleSheet, ScrollView, RefreshControl} from 'react-native';
import {
  Text,
  Card,
  Surface,
  IconButton,
  Badge,
  FAB,
  Portal,
  List,
  Divider,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '@services/AuthProvider';
import {useSync} from '@services/SyncProvider';
import {useOffline} from '@services/OfflineProvider';
import {useNotifications} from '@services/NotificationProvider';
import {theme, medicalTheme} from '@config/theme';
import {ClinicalTask, PatientSummary, VitalSign} from '@types/index';

export const DashboardScreen: React.FC = () => {
  const {user} = useAuth();
  const {syncTasks, forceSyncAll} = useSync();
  const {isOnline, offlineState} = useOffline();
  const {unreadCount} = useNotifications();
  
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<ClinicalTask[]>([]);
  const [recentPatients, setRecentPatients] = useState<PatientSummary[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
  const [todaysStats, setTodaysStats] = useState({
    patientsAssigned: 0,
    tasksCompleted: 0,
    medicationsGiven: 0,
    vitalsRecorded: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      await syncTasks();
      // Load dashboard data based on user role
      if (user?.role === 'nurse' || user?.role === 'physician') {
        await loadClinicalDashboard();
      } else if (user?.role === 'home_care_provider') {
        await loadHomeCareData();
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadClinicalDashboard = async () => {
    // Load clinical dashboard data
    // This would typically fetch from Medplum via the sync service
    setPendingTasks([
      {
        id: 'task-1',
        resourceType: 'Task',
        priority: 'high',
        category: 'medication_administration',
        status: 'ready',
        description: 'Administer Metformin 500mg to John Doe',
        patientId: 'patient-123',
        assignedTo: user?.practitionerId || '',
        dueDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        location: 'Room 205',
      },
      {
        id: 'task-2',
        resourceType: 'Task',
        priority: 'medium',
        category: 'vital_signs',
        status: 'ready',
        description: 'Record vital signs for Jane Smith',
        patientId: 'patient-456',
        assignedTo: user?.practitionerId || '',
        dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        location: 'Room 301',
      },
    ] as ClinicalTask[]);

    setRecentPatients([
      {
        id: 'patient-123',
        resourceType: 'Patient',
        name: [{given: ['John'], family: 'Doe'}],
        currentLocation: 'Room 205',
        admissionDate: '2024-01-15',
        primaryPhysician: 'Dr. Wilson',
        nursePrimary: 'Nurse Sarah',
        allergies: ['Penicillin'],
        riskFlags: [
          {
            type: 'fall_risk',
            severity: 'high',
            description: 'High fall risk due to mobility issues',
            dateIdentified: '2024-01-15',
            active: true,
          },
        ],
      } as PatientSummary,
    ]);

    setCriticalAlerts([
      {
        id: 'alert-1',
        type: 'abnormal_vitals',
        patientName: 'John Doe',
        message: 'Blood pressure elevated: 180/110',
        severity: 'critical',
        time: '10 minutes ago',
      },
    ]);

    setTodaysStats({
      patientsAssigned: 8,
      tasksCompleted: 12,
      medicationsGiven: 15,
      vitalsRecorded: 24,
    });
  };

  const loadHomeCareData = async () => {
    // Load home care specific data
    setTodaysStats({
      patientsAssigned: 5,
      tasksCompleted: 8,
      medicationsGiven: 0,
      vitalsRecorded: 15,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceSyncAll();
      await loadDashboardData();
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return medicalTheme.medical.priority.high;
      case 'medium':
        return medicalTheme.medical.priority.medium;
      case 'low':
        return medicalTheme.medical.priority.low;
      default:
        return theme.colors.onSurface;
    }
  };

  const getTaskIcon = (category: string) => {
    switch (category) {
      case 'medication_administration':
        return 'pill';
      case 'vital_signs':
        return 'heart-pulse';
      case 'patient_assessment':
        return 'clipboard-check';
      case 'discharge_planning':
        return 'exit-to-app';
      case 'documentation':
        return 'file-document';
      default:
        return 'clipboard-list';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text variant="headlineSmall" style={styles.welcomeText}>
              Welcome back, {user?.name?.split(' ')[0]}
            </Text>
            <Text variant="bodyMedium" style={styles.roleText}>
              {user?.role?.replace('_', ' ').toUpperCase()} • {user?.department}
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            <IconButton
              icon="bell"
              size={24}
              onPress={() => {/* Navigate to notifications */}}
            />
            {unreadCount > 0 && (
              <Badge style={styles.notificationBadge}>{unreadCount}</Badge>
            )}
            
            <View style={styles.connectionStatus}>
              <Icon
                name={isOnline ? 'cloud-check' : 'cloud-off'}
                size={20}
                color={isOnline ? medicalTheme.medical.status.active : medicalTheme.medical.status.inactive}
              />
              {offlineState.pendingSyncCount > 0 && (
                <Badge style={styles.syncBadge}>{offlineState.pendingSyncCount}</Badge>
              )}
            </View>
          </View>
        </View>
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <Card style={[styles.statCard, {backgroundColor: theme.colors.primaryContainer}]}>
              <Card.Content style={styles.statContent}>
                <Icon name="account-group" size={24} color={theme.colors.primary} />
                <Text variant="headlineSmall" style={styles.statNumber}>
                  {todaysStats.patientsAssigned}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Patients
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.statCard, {backgroundColor: theme.colors.secondaryContainer}]}>
              <Card.Content style={styles.statContent}>
                <Icon name="clipboard-check" size={24} color={theme.colors.secondary} />
                <Text variant="headlineSmall" style={styles.statNumber}>
                  {todaysStats.tasksCompleted}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Tasks Done
                </Text>
              </Card.Content>
            </Card>
          </View>

          <View style={styles.statsRow}>
            <Card style={[styles.statCard, {backgroundColor: medicalTheme.medical.status.completedStatus + '20'}]}>
              <Card.Content style={styles.statContent}>
                <Icon name="pill" size={24} color={medicalTheme.medical.status.completedStatus} />
                <Text variant="headlineSmall" style={styles.statNumber}>
                  {todaysStats.medicationsGiven}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Medications
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.statCard, {backgroundColor: medicalTheme.medical.vitals.normal + '20'}]}>
              <Card.Content style={styles.statContent}>
                <Icon name="heart-pulse" size={24} color={medicalTheme.medical.vitals.normal} />
                <Text variant="headlineSmall" style={styles.statNumber}>
                  {todaysStats.vitalsRecorded}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Vitals
                </Text>
              </Card.Content>
            </Card>
          </View>
        </View>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <Card style={[styles.section, styles.alertCard]}>
            <Card.Title
              title="Critical Alerts"
              titleStyle={styles.sectionTitle}
              left={() => <Icon name="alert" size={24} color={medicalTheme.medical.priority.high} />}
            />
            <Card.Content>
              {criticalAlerts.map((alert, index) => (
                <View key={alert.id}>
                  <List.Item
                    title={alert.message}
                    description={`${alert.patientName} • ${alert.time}`}
                    left={() => (
                      <Icon
                        name="alert-circle"
                        size={20}
                        color={medicalTheme.medical.priority.high}
                      />
                    )}
                    right={() => (
                      <IconButton
                        icon="chevron-right"
                        size={20}
                        onPress={() => {/* Navigate to patient */}}
                      />
                    )}
                  />
                  {index < criticalAlerts.length - 1 && <Divider />}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Pending Tasks */}
        <Card style={styles.section}>
          <Card.Title
            title="Pending Tasks"
            titleStyle={styles.sectionTitle}
            left={() => <Icon name="clipboard-list" size={24} color={theme.colors.primary} />}
            right={() => (
              <Text variant="bodySmall" style={styles.sectionCount}>
                {pendingTasks.length}
              </Text>
            )}
          />
          <Card.Content>
            {pendingTasks.map((task, index) => (
              <View key={task.id}>
                <List.Item
                  title={task.description}
                  description={`${task.location} • Due: ${new Date(task.dueDate || '').toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`}
                  left={() => (
                    <View style={styles.taskIcon}>
                      <Icon
                        name={getTaskIcon(task.category)}
                        size={20}
                        color={getPriorityColor(task.priority)}
                      />
                    </View>
                  )}
                  right={() => (
                    <View style={styles.priorityBadge}>
                      <Badge
                        style={{
                          backgroundColor: getPriorityColor(task.priority),
                        }}
                      >
                        {task.priority?.toUpperCase()}
                      </Badge>
                    </View>
                  )}
                  onPress={() => {/* Navigate to task detail */}}
                />
                {index < pendingTasks.length - 1 && <Divider />}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Recent Patients */}
        <Card style={styles.section}>
          <Card.Title
            title="Recent Patients"
            titleStyle={styles.sectionTitle}
            left={() => <Icon name="account-group" size={24} color={theme.colors.primary} />}
          />
          <Card.Content>
            {recentPatients.map((patient, index) => (
              <View key={patient.id}>
                <List.Item
                  title={`${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`}
                  description={`${patient.currentLocation} • ${patient.primaryPhysician}`}
                  left={() => (
                    <Icon
                      name="account-circle"
                      size={40}
                      color={theme.colors.onSurfaceVariant}
                    />
                  )}
                  right={() => (
                    <View style={styles.patientFlags}>
                      {patient.riskFlags?.map(flag => (
                        <Icon
                          key={flag.type}
                          name="alert-circle"
                          size={16}
                          color={
                            flag.severity === 'critical'
                              ? medicalTheme.medical.priority.high
                              : medicalTheme.medical.priority.medium
                          }
                          style={styles.flagIcon}
                        />
                      ))}
                    </View>
                  )}
                  onPress={() => {/* Navigate to patient detail */}}
                />
                {index < recentPatients.length - 1 && <Divider />}
              </View>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => {/* Quick actions menu */}}
        />
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    elevation: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  roleText: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  connectionStatus: {
    marginLeft: 16,
    alignItems: 'center',
  },
  syncBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 16,
    height: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontWeight: '700',
    marginVertical: 4,
  },
  statLabel: {
    color: theme.colors.onSurfaceVariant,
  },
  section: {
    marginBottom: 16,
    elevation: 2,
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: medicalTheme.medical.priority.high,
  },
  sectionTitle: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  sectionCount: {
    color: theme.colors.onSurfaceVariant,
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    justifyContent: 'center',
  },
  patientFlags: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagIcon: {
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});