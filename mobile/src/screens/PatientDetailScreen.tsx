import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {
  Text,
  Surface,
  Card,
  IconButton,
  Button,
  Chip,
  List,
  Divider,
  Avatar,
  FAB,
  Portal,
  Menu,
  Badge,
  SegmentedButtons,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useMedplum} from '@medplum/react-native';
import {Patient, Observation, MedicationRequest, AllergyIntolerance, Condition} from '@medplum/fhirtypes';

import {useOffline} from '@services/OfflineProvider';
import {useAuth} from '@services/AuthProvider';
import {VitalSignsCard} from '@components/VitalSignsCard';
import {theme, medicalTheme} from '@config/theme';
import {PatientSummary, VitalSign} from '@types/index';
import {formatDistanceToNow} from 'date-fns';

interface PatientDetailRoute {
  params: {
    patientId: string;
  };
}

export const PatientDetailScreen: React.FC = () => {
  const route = useRoute<PatientDetailRoute>();
  const navigation = useNavigation();
  const medplum = useMedplum();
  const {isOnline, getOfflineData} = useOffline();
  const {user} = useAuth();
  
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showQuickActions, setShowQuickActions] = useState(false);
  
  // Clinical data states
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);

  useEffect(() => {
    loadPatientData();
  }, [route.params.patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientId = route.params.patientId;

      if (isOnline) {
        // Fetch from Medplum
        const patientData = await medplum.readResource('Patient', patientId);
        const patientSummary = await enrichPatientData(patientData);
        setPatient(patientSummary);
        
        // Load clinical data
        await Promise.all([
          loadVitals(patientId),
          loadMedications(patientId),
          loadAllergies(patientId),
          loadConditions(patientId),
          loadRecentNotes(patientId),
        ]);
      } else {
        // Load from offline storage
        const offlinePatients = await getOfflineData('Patient', patientId);
        if (offlinePatients.length > 0) {
          setPatient(offlinePatients[0].data as PatientSummary);
          // Load offline clinical data
          const offlineVitals = await getOfflineData('Observation', patientId);
          setVitals(offlineVitals.map(v => v.data as VitalSign));
        }
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const enrichPatientData = async (patient: Patient): Promise<PatientSummary> => {
    // Get active encounter
    const encounters = await medplum.search('Encounter', {
      patient: `Patient/${patient.id}`,
      status: 'in-progress,arrived',
      _count: 1,
    });
    
    const activeEncounter = encounters.entry?.[0]?.resource;
    
    return {
      id: patient.id || '',
      resourceType: 'Patient',
      name: patient.name || [],
      birthDate: patient.birthDate,
      gender: patient.gender,
      currentLocation: activeEncounter?.location?.[0]?.location?.display || 'Not admitted',
      admissionDate: activeEncounter?.period?.start,
      primaryPhysician: activeEncounter?.participant?.find((p: any) => 
        p.type?.[0]?.coding?.[0]?.code === 'ATND'
      )?.individual?.display || 'Not assigned',
      nursePrimary: activeEncounter?.participant?.find((p: any) => 
        p.type?.[0]?.coding?.[0]?.code === 'NURSE'
      )?.individual?.display || 'Not assigned',
      allergies: [],
      riskFlags: [],
      lastVitals: null,
      upcomingAppointments: [],
      activeMedications: [],
      recentNotes: [],
      // Additional patient details
      identifier: patient.identifier,
      telecom: patient.telecom,
      address: patient.address,
      contact: patient.contact,
      photo: patient.photo,
    };
  };

  const loadVitals = async (patientId: string) => {
    try {
      const observations = await medplum.search('Observation', {
        patient: `Patient/${patientId}`,
        category: 'vital-signs',
        _count: 20,
        _sort: '-date',
      });

      const vitalSigns: VitalSign[] = [];
      
      // Group observations by date/time
      const groupedObs: {[key: string]: Observation[]} = {};
      
      for (const entry of observations.entry || []) {
        const obs = entry.resource as Observation;
        const date = obs.effectiveDateTime || obs.effectivePeriod?.start || '';
        if (!groupedObs[date]) {
          groupedObs[date] = [];
        }
        groupedObs[date].push(obs);
      }

      // Convert to VitalSign format
      for (const [date, observations] of Object.entries(groupedObs)) {
        const vitalSign: VitalSign = {
          id: `vitals-${date}`,
          resourceType: 'Observation',
          dateTime: date,
          patientId: patientId,
          recordedBy: observations[0]?.performer?.[0]?.display || user?.name || '',
        };

        observations.forEach(obs => {
          const code = obs.code?.coding?.[0]?.code;
          const value = obs.valueQuantity?.value;
          const unit = obs.valueQuantity?.unit;

          switch (code) {
            case '8867-4': // Heart rate
              vitalSign.heartRate = value;
              break;
            case '8480-6': // Systolic BP
              vitalSign.bloodPressure = {
                ...vitalSign.bloodPressure,
                systolic: value || 0,
              };
              break;
            case '8462-4': // Diastolic BP
              vitalSign.bloodPressure = {
                ...vitalSign.bloodPressure,
                diastolic: value || 0,
              };
              break;
            case '8310-5': // Body temperature
              vitalSign.temperature = value;
              break;
            case '9279-1': // Respiratory rate
              vitalSign.respiratoryRate = value;
              break;
            case '2708-6': // Oxygen saturation
              vitalSign.oxygenSaturation = value;
              break;
            case '8302-2': // Body height
              vitalSign.height = value;
              break;
            case '29463-7': // Body weight
              vitalSign.weight = value;
              break;
          }
        });

        vitalSigns.push(vitalSign);
      }

      setVitals(vitalSigns);
    } catch (error) {
      console.error('Error loading vitals:', error);
    }
  };

  const loadMedications = async (patientId: string) => {
    try {
      const meds = await medplum.search('MedicationRequest', {
        patient: `Patient/${patientId}`,
        status: 'active',
        _count: 50,
      });

      setMedications(meds.entry?.map(e => e.resource as MedicationRequest) || []);
    } catch (error) {
      console.error('Error loading medications:', error);
    }
  };

  const loadAllergies = async (patientId: string) => {
    try {
      const allergyData = await medplum.search('AllergyIntolerance', {
        patient: `Patient/${patientId}`,
        _count: 20,
      });

      setAllergies(allergyData.entry?.map(e => e.resource as AllergyIntolerance) || []);
    } catch (error) {
      console.error('Error loading allergies:', error);
    }
  };

  const loadConditions = async (patientId: string) => {
    try {
      const conditionData = await medplum.search('Condition', {
        patient: `Patient/${patientId}`,
        'clinical-status': 'active',
        _count: 50,
      });

      setConditions(conditionData.entry?.map(e => e.resource as Condition) || []);
    } catch (error) {
      console.error('Error loading conditions:', error);
    }
  };

  const loadRecentNotes = async (patientId: string) => {
    // Load clinical notes/documents
    try {
      const notes = await medplum.search('DocumentReference', {
        patient: `Patient/${patientId}`,
        _count: 10,
        _sort: '-date',
      });

      setRecentNotes(notes.entry?.map(e => e.resource) || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPatientData();
    setRefreshing(false);
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 'Unknown';
    const birth = new Date(birthDate);
    const ageDiff = Date.now() - birth.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const getAllergySeverity = (allergy: AllergyIntolerance) => {
    const criticality = allergy.criticality;
    if (criticality === 'high') return {color: medicalTheme.medical.priority.high, text: 'Severe'};
    if (criticality === 'low') return {color: medicalTheme.medical.priority.low, text: 'Mild'};
    return {color: medicalTheme.medical.priority.medium, text: 'Moderate'};
  };

  const renderOverviewTab = () => (
    <ScrollView>
      {/* Allergies Card */}
      <Card style={[styles.card, allergies.length > 0 && styles.alertCard]}>
        <Card.Title
          title="Allergies & Intolerances"
          titleStyle={styles.cardTitle}
          left={() => <Icon name="alert-circle" size={24} color={medicalTheme.medical.priority.high} />}
        />
        <Card.Content>
          {allergies.length === 0 ? (
            <Text variant="bodyMedium" style={styles.noDataText}>No known allergies</Text>
          ) : (
            allergies.map((allergy, index) => {
              const severity = getAllergySeverity(allergy);
              return (
                <View key={allergy.id}>
                  <View style={styles.allergyItem}>
                    <View style={styles.allergyInfo}>
                      <Text variant="bodyLarge" style={styles.allergyName}>
                        {allergy.code?.text || 'Unknown allergen'}
                      </Text>
                      <Text variant="bodySmall" style={styles.allergyReaction}>
                        {allergy.reaction?.[0]?.manifestation?.[0]?.text || 'No reaction specified'}
                      </Text>
                    </View>
                    <Chip
                      mode="flat"
                      style={{backgroundColor: severity.color + '20'}}
                      textStyle={{color: severity.color}}
                    >
                      {severity.text}
                    </Chip>
                  </View>
                  {index < allergies.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })
          )}
        </Card.Content>
      </Card>

      {/* Active Conditions */}
      <Card style={styles.card}>
        <Card.Title
          title="Active Conditions"
          titleStyle={styles.cardTitle}
          left={() => <Icon name="clipboard-pulse" size={24} color={theme.colors.primary} />}
        />
        <Card.Content>
          {conditions.length === 0 ? (
            <Text variant="bodyMedium" style={styles.noDataText}>No active conditions</Text>
          ) : (
            conditions.map((condition, index) => (
              <View key={condition.id}>
                <List.Item
                  title={condition.code?.text || 'Unknown condition'}
                  description={`Since: ${condition.onsetDateTime ? new Date(condition.onsetDateTime).toLocaleDateString() : 'Unknown'}`}
                  left={() => (
                    <Icon 
                      name="circle" 
                      size={12} 
                      color={condition.clinicalStatus?.coding?.[0]?.code === 'active' 
                        ? medicalTheme.medical.status.active 
                        : theme.colors.onSurfaceVariant
                      } 
                    />
                  )}
                />
                {index < conditions.length - 1 && <Divider />}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Contact Information */}
      <Card style={styles.card}>
        <Card.Title
          title="Contact Information"
          titleStyle={styles.cardTitle}
          left={() => <Icon name="phone" size={24} color={theme.colors.primary} />}
        />
        <Card.Content>
          {patient?.telecom?.map((contact, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (contact.system === 'phone' && contact.value) {
                  Linking.openURL(`tel:${contact.value}`);
                } else if (contact.system === 'email' && contact.value) {
                  Linking.openURL(`mailto:${contact.value}`);
                }
              }}
            >
              <List.Item
                title={contact.value}
                description={contact.system === 'phone' ? 'Phone' : contact.system}
                left={() => (
                  <Icon 
                    name={contact.system === 'phone' ? 'phone' : 'email'} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                )}
              />
            </TouchableOpacity>
          ))}
          
          {patient?.address?.map((addr, index) => (
            <List.Item
              key={index}
              title={`${addr.line?.join(', ') || ''}`}
              description={`${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}`}
              left={() => <Icon name="map-marker" size={20} color={theme.colors.primary} />}
            />
          ))}
        </Card.Content>
      </Card>

      {/* Emergency Contact */}
      {patient?.contact && patient.contact.length > 0 && (
        <Card style={styles.card}>
          <Card.Title
            title="Emergency Contact"
            titleStyle={styles.cardTitle}
            left={() => <Icon name="account-alert" size={24} color={theme.colors.primary} />}
          />
          <Card.Content>
            {patient.contact.map((contact, index) => (
              <View key={index}>
                <Text variant="bodyLarge">
                  {contact.name?.text || 'Unknown'}
                </Text>
                <Text variant="bodyMedium" style={styles.contactRelation}>
                  {contact.relationship?.[0]?.text || 'Relationship not specified'}
                </Text>
                {contact.telecom?.map((tel, telIndex) => (
                  <TouchableOpacity
                    key={telIndex}
                    onPress={() => {
                      if (tel.system === 'phone' && tel.value) {
                        Linking.openURL(`tel:${tel.value}`);
                      }
                    }}
                  >
                    <Text variant="bodyMedium" style={styles.contactPhone}>
                      <Icon name="phone" size={16} /> {tel.value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );

  const renderVitalsTab = () => (
    <ScrollView>
      {vitals.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.emptyState}>
              <Icon name="heart-pulse" size={48} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyLarge" style={styles.emptyText}>
                No vital signs recorded
              </Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('VitalSigns', {patientId: patient?.id})}
                style={styles.addButton}
              >
                Record Vitals
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <>
          {vitals.map((vital, index) => (
            <VitalSignsCard key={vital.id} vitalSign={vital} />
          ))}
          <Button
            mode="contained"
            onPress={() => navigation.navigate('VitalSigns', {patientId: patient?.id})}
            style={styles.addVitalsButton}
          >
            Record New Vitals
          </Button>
        </>
      )}
    </ScrollView>
  );

  const renderMedicationsTab = () => (
    <ScrollView>
      {medications.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.emptyState}>
              <Icon name="pill" size={48} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyLarge" style={styles.emptyText}>
                No active medications
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : (
        medications.map((med, index) => (
          <Card key={med.id} style={styles.medicationCard}>
            <Card.Content>
              <View style={styles.medicationHeader}>
                <View style={styles.medicationInfo}>
                  <Text variant="titleMedium" style={styles.medicationName}>
                    {med.medicationCodeableConcept?.text || 'Unknown medication'}
                  </Text>
                  <Text variant="bodyMedium" style={styles.medicationDosage}>
                    {med.dosageInstruction?.[0]?.text || 'Dosage not specified'}
                  </Text>
                </View>
                <Chip
                  mode="flat"
                  style={{
                    backgroundColor: med.status === 'active' 
                      ? medicalTheme.medical.status.active + '20'
                      : theme.colors.surfaceVariant
                  }}
                >
                  {med.status?.toUpperCase()}
                </Chip>
              </View>
              
              <Divider style={styles.medicationDivider} />
              
              <View style={styles.medicationDetails}>
                <View style={styles.medicationDetail}>
                  <Icon name="calendar" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text variant="bodySmall" style={styles.medicationDetailText}>
                    Started: {med.authoredOn ? new Date(med.authoredOn).toLocaleDateString() : 'Unknown'}
                  </Text>
                </View>
                <View style={styles.medicationDetail}>
                  <Icon name="doctor" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text variant="bodySmall" style={styles.medicationDetailText}>
                    {med.requester?.display || 'Unknown prescriber'}
                  </Text>
                </View>
              </View>
              
              {med.note && (
                <Text variant="bodySmall" style={styles.medicationNote}>
                  Note: {med.note[0].text}
                </Text>
              )}
            </Card.Content>
            
            <Card.Actions>
              <Button onPress={() => navigation.navigate('MedicationAdmin', {
                patientId: patient?.id,
                medicationId: med.id
              })}>
                Administer
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );

  const renderNotesTab = () => (
    <ScrollView>
      {recentNotes.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.emptyState}>
              <Icon name="file-document" size={48} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyLarge" style={styles.emptyText}>
                No clinical notes available
              </Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('ClinicalNotes', {patientId: patient?.id})}
                style={styles.addButton}
              >
                Add Note
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <>
          {recentNotes.map((note, index) => (
            <Card key={note.id} style={styles.noteCard}>
              <Card.Content>
                <View style={styles.noteHeader}>
                  <Text variant="titleMedium">{note.type?.text || 'Clinical Note'}</Text>
                  <Text variant="bodySmall" style={styles.noteDate}>
                    {note.date ? formatDistanceToNow(new Date(note.date), {addSuffix: true}) : ''}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.noteContent}>
                  {note.description || 'No content available'}
                </Text>
                <Text variant="bodySmall" style={styles.noteAuthor}>
                  By: {note.author?.[0]?.display || 'Unknown'}
                </Text>
              </Card.Content>
            </Card>
          ))}
          <Button
            mode="contained"
            onPress={() => navigation.navigate('ClinicalNotes', {patientId: patient?.id})}
            style={styles.addButton}
          >
            Add New Note
          </Button>
        </>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={theme.colors.error} />
          <Text variant="headlineSmall" style={styles.errorText}>
            Patient not found
          </Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const patientName = `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`;
  const patientAge = calculateAge(patient.birthDate);
  const patientGender = patient.gender?.charAt(0).toUpperCase() + patient.gender?.slice(1);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Surface style={styles.header}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerActions}>
            <IconButton
              icon="phone"
              size={24}
              onPress={() => {/* Call patient */}}
            />
            <IconButton
              icon="dots-vertical"
              size={24}
              onPress={() => setShowQuickActions(true)}
            />
          </View>
        </View>

        <View style={styles.patientInfo}>
          <Avatar.Text
            size={64}
            label={patientName.split(' ').map(n => n[0]).join('').toUpperCase()}
            style={styles.avatar}
          />
          <View style={styles.patientDetails}>
            <Text variant="headlineSmall" style={styles.patientName}>
              {patientName}
            </Text>
            <Text variant="bodyMedium" style={styles.patientMeta}>
              {patientAge} years • {patientGender} • MRN: {patient.id}
            </Text>
            <View style={styles.patientTags}>
              <Chip compact style={styles.locationChip}>
                <Icon name="map-marker" size={14} /> {patient.currentLocation}
              </Chip>
              {patient.riskFlags?.map(flag => (
                <Chip
                  key={flag.type}
                  compact
                  style={[
                    styles.riskChip,
                    {backgroundColor: 
                      flag.severity === 'high' 
                        ? medicalTheme.medical.priority.high + '20'
                        : medicalTheme.medical.priority.medium + '20'
                    }
                  ]}
                >
                  {flag.type.replace('_', ' ').toUpperCase()}
                </Chip>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.careTeam}>
          <View style={styles.careTeamMember}>
            <Icon name="doctor" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={styles.careTeamText}>
              {patient.primaryPhysician}
            </Text>
          </View>
          <View style={styles.careTeamMember}>
            <Icon name="account-heart" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={styles.careTeamText}>
              {patient.nursePrimary}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Tabs */}
      <SegmentedButtons
        value={selectedTab}
        onValueChange={setSelectedTab}
        buttons={[
          {value: 'overview', label: 'Overview'},
          {value: 'vitals', label: 'Vitals'},
          {value: 'medications', label: 'Meds'},
          {value: 'notes', label: 'Notes'},
        ]}
        style={styles.tabs}
      />

      {/* Tab Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'vitals' && renderVitalsTab()}
        {selectedTab === 'medications' && renderMedicationsTab()}
        {selectedTab === 'notes' && renderNotesTab()}
      </ScrollView>

      {/* Quick Actions FAB */}
      <Portal>
        <FAB.Group
          open={showQuickActions}
          icon={showQuickActions ? 'close' : 'plus'}
          actions={[
            {
              icon: 'heart-pulse',
              label: 'Record Vitals',
              onPress: () => {
                setShowQuickActions(false);
                navigation.navigate('VitalSigns', {patientId: patient.id});
              },
            },
            {
              icon: 'pill',
              label: 'Administer Medication',
              onPress: () => {
                setShowQuickActions(false);
                navigation.navigate('MedicationAdmin', {patientId: patient.id});
              },
            },
            {
              icon: 'file-document',
              label: 'Add Note',
              onPress: () => {
                setShowQuickActions(false);
                navigation.navigate('ClinicalNotes', {patientId: patient.id});
              },
            },
            {
              icon: 'camera',
              label: 'Take Photo',
              onPress: () => {
                setShowQuickActions(false);
                navigation.navigate('PhotoCapture', {patientId: patient.id});
              },
            },
          ]}
          onStateChange={({open}) => setShowQuickActions(open)}
          visible={true}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginVertical: 16,
    color: theme.colors.error,
  },
  header: {
    elevation: 4,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  patientInfo: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  avatar: {
    backgroundColor: theme.colors.primary,
  },
  patientDetails: {
    flex: 1,
    marginLeft: 16,
  },
  patientName: {
    fontWeight: '600',
  },
  patientMeta: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  patientTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  locationChip: {
    backgroundColor: theme.colors.primaryContainer,
  },
  riskChip: {
    marginLeft: 4,
  },
  careTeam: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 24,
  },
  careTeamMember: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  careTeamText: {
    marginLeft: 4,
    color: theme.colors.onSurfaceVariant,
  },
  tabs: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: medicalTheme.medical.priority.high,
  },
  cardTitle: {
    fontWeight: '600',
  },
  noDataText: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 16,
  },
  allergyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  allergyInfo: {
    flex: 1,
  },
  allergyName: {
    fontWeight: '500',
  },
  allergyReaction: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  divider: {
    marginVertical: 8,
  },
  contactRelation: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  contactPhone: {
    color: theme.colors.primary,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    color: theme.colors.onSurfaceVariant,
  },
  addButton: {
    marginTop: 16,
  },
  addVitalsButton: {
    margin: 16,
  },
  medicationCard: {
    marginBottom: 12,
    elevation: 2,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontWeight: '600',
  },
  medicationDosage: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  medicationDivider: {
    marginVertical: 12,
  },
  medicationDetails: {
    flexDirection: 'row',
    gap: 24,
  },
  medicationDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationDetailText: {
    marginLeft: 4,
    color: theme.colors.onSurfaceVariant,
  },
  medicationNote: {
    marginTop: 8,
    fontStyle: 'italic',
    color: theme.colors.onSurfaceVariant,
  },
  noteCard: {
    marginBottom: 12,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteDate: {
    color: theme.colors.onSurfaceVariant,
  },
  noteContent: {
    marginVertical: 8,
  },
  noteAuthor: {
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
});