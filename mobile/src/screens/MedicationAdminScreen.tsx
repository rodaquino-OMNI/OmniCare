import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import {
  Text,
  Surface,
  TextInput,
  Button,
  Card,
  IconButton,
  Chip,
  HelperText,
  Portal,
  Dialog,
  RadioButton,
  Checkbox,
  List,
  Divider,
  SegmentedButtons,
  FAB,
  Searchbar,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useMedplum} from '@medplum/react-native';
import {
  MedicationRequest,
  MedicationAdministration,
  Patient,
} from '@medplum/fhirtypes';
import QRCodeScanner from 'react-native-qrcode-scanner';
import {RNCamera} from 'react-native-camera';

import {useAuth} from '@services/AuthProvider';
import {useOffline} from '@services/OfflineProvider';
import {theme, medicalTheme} from '@config/theme';
import {formatDistanceToNow} from 'date-fns';

interface MedicationAdminRoute {
  params: {
    patientId: string;
    medicationId?: string;
  };
}

interface MedicationAdminData {
  medicationId: string;
  dose: string;
  route: string;
  site?: string;
  notes?: string;
  reasonNotGiven?: string;
  status: 'completed' | 'not-done' | 'on-hold';
  adminTime: Date;
  witnessId?: string;
  barcode?: string;
}

export const MedicationAdminScreen: React.FC = () => {
  const route = useRoute<MedicationAdminRoute>();
  const navigation = useNavigation();
  const medplum = useMedplum();
  const {user} = useAuth();
  const {isOnline, storeOfflineData} = useOffline();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [selectedMedication, setSelectedMedication] = useState<MedicationRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'due' | 'prn' | 'all'>('due');
  
  const [adminData, setAdminData] = useState<MedicationAdminData>({
    medicationId: route.params.medicationId || '',
    dose: '',
    route: '',
    site: '',
    notes: '',
    status: 'completed',
    adminTime: new Date(),
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [requiresWitness, setRequiresWitness] = useState(false);

  // Common medication routes
  const MEDICATION_ROUTES = [
    {value: 'PO', label: 'By mouth (PO)'},
    {value: 'IV', label: 'Intravenous (IV)'},
    {value: 'IM', label: 'Intramuscular (IM)'},
    {value: 'SC', label: 'Subcutaneous (SC)'},
    {value: 'SL', label: 'Sublingual (SL)'},
    {value: 'PR', label: 'Per rectum (PR)'},
    {value: 'TOP', label: 'Topical'},
    {value: 'INH', label: 'Inhalation'},
    {value: 'OPTH', label: 'Ophthalmic'},
    {value: 'OTIC', label: 'Otic'},
  ];

  // Common injection sites
  const INJECTION_SITES = [
    'Left deltoid',
    'Right deltoid',
    'Left thigh',
    'Right thigh',
    'Left gluteal',
    'Right gluteal',
    'Abdomen',
    'Left arm',
    'Right arm',
  ];

  useEffect(() => {
    loadData();
  }, [route.params]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patient data
      if (isOnline) {
        const patientData = await medplum.readResource('Patient', route.params.patientId);
        setPatient(patientData);
        
        // Load medications
        const medsBundle = await medplum.search('MedicationRequest', {
          patient: `Patient/${route.params.patientId}`,
          status: 'active',
          _sort: '-authored-on',
        });
        
        const meds = medsBundle.entry?.map(e => e.resource as MedicationRequest) || [];
        setMedications(meds);
        
        // Set selected medication if ID provided
        if (route.params.medicationId) {
          const selected = meds.find(m => m.id === route.params.medicationId);
          if (selected) {
            setSelectedMedication(selected);
            setAdminData(prev => ({
              ...prev,
              medicationId: selected.id || '',
              dose: selected.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value?.toString() || '',
              route: selected.dosageInstruction?.[0]?.route?.coding?.[0]?.code || '',
            }));
            checkIfRequiresWitness(selected);
          }
        }
      } else {
        // Load from offline storage
        const offlinePatient = await getOfflineData('Patient', route.params.patientId);
        if (offlinePatient.length > 0) {
          setPatient(offlinePatient[0].data as Patient);
        }
        
        const offlineMeds = await getOfflineData('MedicationRequest', route.params.patientId);
        setMedications(offlineMeds.map(m => m.data as MedicationRequest));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load medication data');
    } finally {
      setLoading(false);
    }
  };

  const checkIfRequiresWitness = (medication: MedicationRequest) => {
    // Check if medication is controlled substance or high-risk
    const medName = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const controlledSubstances = ['morphine', 'fentanyl', 'oxycodone', 'hydromorphone', 'insulin'];
    const isControlled = controlledSubstances.some(drug => medName.includes(drug));
    
    if (isControlled) {
      setRequiresWitness(true);
    }
  };

  const filterMedications = () => {
    let filtered = [...medications];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(med => {
        const name = med.medicationCodeableConcept?.text?.toLowerCase() || '';
        const dosage = med.dosageInstruction?.[0]?.text?.toLowerCase() || '';
        return name.includes(query) || dosage.includes(query);
      });
    }
    
    // Apply mode filter
    if (filterMode === 'due') {
      // Filter medications due within next 2 hours
      filtered = filtered.filter(med => {
        const timing = med.dosageInstruction?.[0]?.timing;
        // Simplified logic - in real app would check actual schedule
        return true; // Show all for now
      });
    } else if (filterMode === 'prn') {
      filtered = filtered.filter(med => 
        med.dosageInstruction?.[0]?.asNeededBoolean === true
      );
    }
    
    return filtered;
  };

  const handleMedicationSelect = (medication: MedicationRequest) => {
    setSelectedMedication(medication);
    setAdminData(prev => ({
      ...prev,
      medicationId: medication.id || '',
      dose: medication.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value?.toString() || '',
      route: medication.dosageInstruction?.[0]?.route?.coding?.[0]?.code || '',
    }));
    checkIfRequiresWitness(medication);
    
    // Clear previous errors
    setErrors({});
  };

  const handleBarcodeScan = (data: any) => {
    Vibration.vibrate(100);
    setShowScanner(false);
    
    // Verify medication barcode matches
    if (selectedMedication) {
      // In real app, would verify barcode against medication database
      setAdminData(prev => ({...prev, barcode: data.data}));
      Alert.alert('Success', 'Medication verified successfully');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!selectedMedication) {
      newErrors.medication = 'Please select a medication';
    }
    
    if (!adminData.dose) {
      newErrors.dose = 'Dose is required';
    }
    
    if (!adminData.route) {
      newErrors.route = 'Route is required';
    }
    
    if (adminData.status === 'not-done' && !adminData.reasonNotGiven) {
      newErrors.reasonNotGiven = 'Reason is required when medication not given';
    }
    
    if (requiresWitness && !adminData.witnessId) {
      newErrors.witness = 'Witness verification required for this medication';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      
      const medicationAdmin: MedicationAdministration = {
        resourceType: 'MedicationAdministration',
        status: adminData.status as MedicationAdministration['status'],
        medicationReference: {
          reference: `MedicationRequest/${selectedMedication?.id}`,
          display: selectedMedication?.medicationCodeableConcept?.text,
        },
        subject: {
          reference: `Patient/${route.params.patientId}`,
          display: patient ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` : undefined,
        },
        effectiveDateTime: adminData.adminTime.toISOString(),
        performer: [
          {
            actor: {
              display: user?.name || 'Unknown',
            },
          },
        ],
        dosage: {
          text: `${adminData.dose} ${selectedMedication?.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || ''}`,
          dose: {
            value: parseFloat(adminData.dose),
            unit: selectedMedication?.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit,
          },
          route: {
            coding: [{
              code: adminData.route,
              display: MEDICATION_ROUTES.find(r => r.value === adminData.route)?.label,
            }],
          },
          site: adminData.site ? {
            text: adminData.site,
          } : undefined,
        },
        note: adminData.notes ? [{
          text: adminData.notes,
          time: new Date().toISOString(),
        }] : undefined,
        statusReason: adminData.status === 'not-done' && adminData.reasonNotGiven ? [{
          text: adminData.reasonNotGiven,
        }] : undefined,
      };
      
      if (isOnline) {
        await medplum.createResource(medicationAdmin);
      }
      
      // Store offline for sync
      await storeOfflineData({
        id: `med-admin-${Date.now()}`,
        resourceType: 'MedicationAdministration',
        data: medicationAdmin,
        lastModified: new Date().toISOString(),
        syncStatus: isOnline ? 'synced' : 'pending',
      });
      
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error saving medication administration:', error);
      Alert.alert('Error', 'Failed to save medication administration');
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessDialogDismiss = () => {
    setShowSuccessDialog(false);
    navigation.goBack();
  };

  const getMedicationSchedule = (medication: MedicationRequest) => {
    const timing = medication.dosageInstruction?.[0]?.timing;
    if (!timing) return 'As directed';
    
    if (medication.dosageInstruction?.[0]?.asNeededBoolean) {
      return 'PRN (as needed)';
    }
    
    // Simplified - in real app would parse FHIR timing
    return timing.code?.text || 'See instructions';
  };

  const getLastAdminTime = (medication: MedicationRequest) => {
    // In real app, would query MedicationAdministration resources
    return 'Not recorded';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading medications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const patientName = patient 
    ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`
    : 'Unknown Patient';

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerInfo}>
            <Text variant="headlineSmall">Medication Administration</Text>
            <Text variant="bodyMedium" style={styles.patientName}>
              {patientName}
            </Text>
          </View>
          <IconButton
            icon="barcode-scan"
            size={24}
            onPress={() => setShowScanner(true)}
          />
        </View>
        
        {!isOnline && (
          <Chip icon="cloud-off" style={styles.offlineChip}>
            Offline Mode
          </Chip>
        )}
      </Surface>

      <ScrollView style={styles.content}>
        {!selectedMedication ? (
          <>
            {/* Medication Search and Filter */}
            <View style={styles.searchContainer}>
              <Searchbar
                placeholder="Search medications..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
              />
              
              <SegmentedButtons
                value={filterMode}
                onValueChange={(value) => setFilterMode(value as any)}
                buttons={[
                  {value: 'due', label: 'Due Now'},
                  {value: 'prn', label: 'PRN'},
                  {value: 'all', label: 'All'},
                ]}
                style={styles.filterButtons}
              />
            </View>

            {/* Medication List */}
            <View style={styles.medicationList}>
              {filterMedications().map((medication) => (
                <TouchableOpacity
                  key={medication.id}
                  onPress={() => handleMedicationSelect(medication)}
                >
                  <Card style={styles.medicationCard}>
                    <Card.Content>
                      <View style={styles.medicationHeader}>
                        <View style={styles.medicationInfo}>
                          <Text variant="titleMedium" style={styles.medicationName}>
                            {medication.medicationCodeableConcept?.text || 'Unknown medication'}
                          </Text>
                          <Text variant="bodyMedium" style={styles.medicationDosage}>
                            {medication.dosageInstruction?.[0]?.text || 'Dosage not specified'}
                          </Text>
                          <Text variant="bodySmall" style={styles.medicationSchedule}>
                            Schedule: {getMedicationSchedule(medication)}
                          </Text>
                        </View>
                        <View style={styles.medicationStatus}>
                          {medication.dosageInstruction?.[0]?.asNeededBoolean && (
                            <Chip compact style={styles.prnChip}>PRN</Chip>
                          )}
                          <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
                        </View>
                      </View>
                      
                      <Divider style={styles.divider} />
                      
                      <View style={styles.medicationFooter}>
                        <Text variant="bodySmall" style={styles.lastAdminText}>
                          Last given: {getLastAdminTime(medication)}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
            
            {errors.medication && (
              <HelperText type="error" visible style={styles.errorText}>
                {errors.medication}
              </HelperText>
            )}
          </>
        ) : (
          <>
            {/* Selected Medication Details */}
            <Card style={[styles.selectedMedicationCard, requiresWitness && styles.controlledCard]}>
              <Card.Title
                title={selectedMedication.medicationCodeableConcept?.text || 'Unknown medication'}
                subtitle={selectedMedication.dosageInstruction?.[0]?.text}
                left={() => <Icon name="pill" size={32} color={theme.colors.primary} />}
                right={() => (
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => setSelectedMedication(null)}
                  />
                )}
              />
              {requiresWitness && (
                <Card.Content>
                  <View style={styles.warningBanner}>
                    <Icon name="alert" size={20} color={medicalTheme.medical.priority.high} />
                    <Text variant="bodySmall" style={styles.warningText}>
                      Controlled substance - Witness verification required
                    </Text>
                  </View>
                </Card.Content>
              )}
            </Card>

            {/* Administration Status */}
            <Card style={styles.section}>
              <Card.Title title="Administration Status" />
              <Card.Content>
                <RadioButton.Group
                  onValueChange={(value) => setAdminData(prev => ({...prev, status: value as any}))}
                  value={adminData.status}
                >
                  <RadioButton.Item label="Given" value="completed" />
                  <RadioButton.Item label="Not Given" value="not-done" />
                  <RadioButton.Item label="On Hold" value="on-hold" />
                </RadioButton.Group>
                
                {adminData.status === 'not-done' && (
                  <TextInput
                    label="Reason Not Given"
                    value={adminData.reasonNotGiven}
                    onChangeText={(value) => setAdminData(prev => ({...prev, reasonNotGiven: value}))}
                    error={!!errors.reasonNotGiven}
                    style={styles.input}
                    multiline
                  />
                )}
              </Card.Content>
            </Card>

            {/* Dosage Information */}
            {adminData.status === 'completed' && (
              <Card style={styles.section}>
                <Card.Title title="Dosage Information" />
                <Card.Content>
                  <TextInput
                    label="Dose"
                    value={adminData.dose}
                    onChangeText={(value) => setAdminData(prev => ({...prev, dose: value}))}
                    keyboardType="numeric"
                    right={<TextInput.Affix text={selectedMedication.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || ''} />}
                    error={!!errors.dose}
                    style={styles.input}
                  />
                  <HelperText type="error" visible={!!errors.dose}>
                    {errors.dose}
                  </HelperText>

                  <View style={styles.routeSection}>
                    <Text variant="bodyMedium" style={styles.fieldLabel}>Route</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipGroup}>
                        {MEDICATION_ROUTES.map(route => (
                          <Chip
                            key={route.value}
                            selected={adminData.route === route.value}
                            onPress={() => setAdminData(prev => ({...prev, route: route.value}))}
                            style={styles.chip}
                          >
                            {route.label}
                          </Chip>
                        ))}
                      </View>
                    </ScrollView>
                    <HelperText type="error" visible={!!errors.route}>
                      {errors.route}
                    </HelperText>
                  </View>

                  {(adminData.route === 'IM' || adminData.route === 'SC') && (
                    <View style={styles.siteSection}>
                      <Text variant="bodyMedium" style={styles.fieldLabel}>Injection Site</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipGroup}>
                          {INJECTION_SITES.map(site => (
                            <Chip
                              key={site}
                              selected={adminData.site === site}
                              onPress={() => setAdminData(prev => ({...prev, site}))}
                              style={styles.chip}
                            >
                              {site}
                            </Chip>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* Administration Time */}
            <Card style={styles.section}>
              <Card.Title title="Administration Time" />
              <Card.Content>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="clock-outline" size={20} color={theme.colors.primary} />
                  <Text variant="bodyMedium" style={styles.dateTimeText}>
                    {adminData.adminTime.toLocaleString()}
                  </Text>
                  <Icon name="pencil" size={16} color={theme.colors.onSurfaceVariant} />
                </TouchableOpacity>
              </Card.Content>
            </Card>

            {/* Witness Verification */}
            {requiresWitness && (
              <Card style={[styles.section, styles.witnessCard]}>
                <Card.Title title="Witness Verification" />
                <Card.Content>
                  <TextInput
                    label="Witness ID or Badge Number"
                    value={adminData.witnessId}
                    onChangeText={(value) => setAdminData(prev => ({...prev, witnessId: value}))}
                    error={!!errors.witness}
                    style={styles.input}
                    left={<TextInput.Icon icon="account-check" />}
                  />
                  <HelperText type="error" visible={!!errors.witness}>
                    {errors.witness}
                  </HelperText>
                </Card.Content>
              </Card>
            )}

            {/* Notes */}
            <Card style={styles.section}>
              <Card.Title title="Additional Notes" />
              <Card.Content>
                <TextInput
                  label="Notes (Optional)"
                  value={adminData.notes}
                  onChangeText={(value) => setAdminData(prev => ({...prev, notes: value}))}
                  multiline
                  numberOfLines={3}
                  style={styles.notesInput}
                />
              </Card.Content>
            </Card>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={() => setSelectedMedication(null)}
                style={styles.button}
              >
                Back
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
                style={styles.button}
              >
                Save Administration
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* Date/Time Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={adminData.adminTime}
          mode="datetime"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setAdminData(prev => ({...prev, adminTime: selectedDate}));
            }
          }}
          maximumDate={new Date()}
        />
      )}

      {/* Success Dialog */}
      <Portal>
        <Dialog
          visible={showSuccessDialog}
          onDismiss={handleSuccessDialogDismiss}
        >
          <Dialog.Icon icon="check-circle" size={48} color={theme.colors.primary} />
          <Dialog.Title style={styles.dialogTitle}>Success!</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogContent}>
              Medication administration has been recorded successfully.
              {!isOnline && '\n\nIt will be synced when you\'re back online.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleSuccessDialogDismiss}>OK</Button>
          </Dialog.Actions>
        </Dialog>
        
        {/* Barcode Scanner Modal */}
        <Dialog
          visible={showScanner}
          onDismiss={() => setShowScanner(false)}
          style={styles.scannerDialog}
        >
          <Dialog.Title>Scan Medication Barcode</Dialog.Title>
          <Dialog.Content style={styles.scannerContent}>
            {showScanner && (
              <QRCodeScanner
                onRead={handleBarcodeScan}
                flashMode={RNCamera.Constants.FlashMode.auto}
                topContent={
                  <Text style={styles.scannerText}>
                    Position barcode within frame
                  </Text>
                }
                showMarker
                reactivate
                reactivateTimeout={3000}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowScanner(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
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
  header: {
    elevation: 4,
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    paddingHorizontal: 8,
  },
  patientName: {
    color: theme.colors.onSurfaceVariant,
  },
  offlineChip: {
    alignSelf: 'center',
    marginBottom: 8,
    backgroundColor: theme.colors.errorContainer,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    marginBottom: 12,
    elevation: 0,
  },
  filterButtons: {
    marginBottom: 8,
  },
  medicationList: {
    paddingHorizontal: 16,
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
  medicationSchedule: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  medicationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prnChip: {
    marginRight: 8,
    backgroundColor: theme.colors.secondaryContainer,
  },
  divider: {
    marginVertical: 8,
  },
  medicationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastAdminText: {
    color: theme.colors.onSurfaceVariant,
  },
  selectedMedicationCard: {
    margin: 16,
    elevation: 4,
  },
  controlledCard: {
    borderWidth: 2,
    borderColor: medicalTheme.medical.priority.high,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: medicalTheme.medical.priority.high + '20',
    padding: 8,
    borderRadius: 4,
  },
  warningText: {
    marginLeft: 8,
    color: medicalTheme.medical.priority.high,
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  witnessCard: {
    borderWidth: 1,
    borderColor: medicalTheme.medical.priority.high,
  },
  input: {
    backgroundColor: 'transparent',
  },
  fieldLabel: {
    marginBottom: 8,
    color: theme.colors.onSurfaceVariant,
  },
  routeSection: {
    marginTop: 16,
  },
  siteSection: {
    marginTop: 16,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  dateTimeText: {
    flex: 1,
    marginLeft: 12,
  },
  notesInput: {
    backgroundColor: 'transparent',
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 32,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  errorText: {
    paddingHorizontal: 16,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogContent: {
    textAlign: 'center',
  },
  scannerDialog: {
    maxHeight: '80%',
  },
  scannerContent: {
    height: 400,
  },
  scannerText: {
    fontSize: 16,
    color: theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 20,
  },
});