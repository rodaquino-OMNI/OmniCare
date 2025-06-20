import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  Surface,
  TextInput,
  Button,
  Card,
  IconButton,
  SegmentedButtons,
  Chip,
  HelperText,
  Portal,
  Dialog,
  RadioButton,
  Checkbox,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useMedplum} from '@medplum/react-native';
import {Observation, Patient} from '@medplum/fhirtypes';

import {useAuth} from '@services/AuthProvider';
import {useOffline} from '@services/OfflineProvider';
import {theme, medicalTheme} from '@config/theme';
import {VitalSign} from '@types/index';

interface VitalSignsRoute {
  params: {
    patientId: string;
  };
}

interface VitalSignInput {
  heartRate: string;
  systolicBP: string;
  diastolicBP: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weight: string;
  height: string;
  painLevel: string;
  glucoseLevel: string;
  notes: string;
}

interface VitalSignErrors {
  [key: string]: string;
}

const NORMAL_RANGES = {
  heartRate: {min: 60, max: 100, unit: 'bpm'},
  systolicBP: {min: 90, max: 140, unit: 'mmHg'},
  diastolicBP: {min: 60, max: 90, unit: 'mmHg'},
  temperature: {min: 36.1, max: 37.2, unit: '°C'},
  respiratoryRate: {min: 12, max: 20, unit: '/min'},
  oxygenSaturation: {min: 95, max: 100, unit: '%'},
  glucoseLevel: {min: 70, max: 140, unit: 'mg/dL'},
};

export const VitalSignsScreen: React.FC = () => {
  const route = useRoute<VitalSignsRoute>();
  const navigation = useNavigation();
  const medplum = useMedplum();
  const {user} = useAuth();
  const {isOnline, storeOfflineData} = useOffline();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recordedTime, setRecordedTime] = useState(new Date());
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [oxygenDelivery, setOxygenDelivery] = useState('room_air');
  
  const [vitals, setVitals] = useState<VitalSignInput>({
    heartRate: '',
    systolicBP: '',
    diastolicBP: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    painLevel: '',
    glucoseLevel: '',
    notes: '',
  });

  const [errors, setErrors] = useState<VitalSignErrors>({});
  const [warnings, setWarnings] = useState<VitalSignErrors>({});

  useEffect(() => {
    loadPatientData();
  }, [route.params.patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientId = route.params.patientId;
      
      if (isOnline) {
        const patientData = await medplum.readResource('Patient', patientId);
        setPatient(patientData);
      } else {
        // Load from offline storage
        const offlineData = await getOfflineData('Patient', patientId);
        if (offlineData.length > 0) {
          setPatient(offlineData[0].data as Patient);
        }
      }
    } catch (error) {
      console.error('Error loading patient:', error);
      Alert.alert('Error', 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof VitalSignInput, value: string) => {
    // Only allow numbers and decimal point
    const cleanedValue = value.replace(/[^0-9.]/g, '');
    
    setVitals(prev => ({...prev, [field]: cleanedValue}));
    
    // Clear error for this field
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[field];
      return newErrors;
    });

    // Check for warnings (abnormal values)
    checkWarnings(field, cleanedValue);
  };

  const checkWarnings = (field: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setWarnings(prev => {
        const newWarnings = {...prev};
        delete newWarnings[field];
        return newWarnings;
      });
      return;
    }

    const range = NORMAL_RANGES[field as keyof typeof NORMAL_RANGES];
    if (!range) return;

    let actualValue = numValue;
    
    // Convert temperature if needed
    if (field === 'temperature' && temperatureUnit === 'F') {
      actualValue = (numValue - 32) * 5 / 9; // Convert F to C for comparison
    }
    
    // Convert weight if needed
    if (field === 'weight' && weightUnit === 'lb') {
      actualValue = numValue * 0.453592; // Convert lb to kg
    }

    if (actualValue < range.min || actualValue > range.max) {
      setWarnings(prev => ({
        ...prev,
        [field]: `Outside normal range (${range.min}-${range.max} ${range.unit})`
      }));
    } else {
      setWarnings(prev => {
        const newWarnings = {...prev};
        delete newWarnings[field];
        return newWarnings;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: VitalSignErrors = {};
    
    // At least one vital sign must be entered
    const hasAnyVital = Object.entries(vitals).some(([key, value]) => 
      key !== 'notes' && value.trim() !== ''
    );
    
    if (!hasAnyVital) {
      Alert.alert('Validation Error', 'Please enter at least one vital sign');
      return false;
    }

    // Validate blood pressure (both or neither)
    if ((vitals.systolicBP && !vitals.diastolicBP) || (!vitals.systolicBP && vitals.diastolicBP)) {
      newErrors.bloodPressure = 'Both systolic and diastolic values are required';
    }

    // Validate numeric ranges
    if (vitals.heartRate && (parseInt(vitals.heartRate) < 20 || parseInt(vitals.heartRate) > 300)) {
      newErrors.heartRate = 'Heart rate must be between 20-300 bpm';
    }

    if (vitals.oxygenSaturation && (parseInt(vitals.oxygenSaturation) < 0 || parseInt(vitals.oxygenSaturation) > 100)) {
      newErrors.oxygenSaturation = 'Oxygen saturation must be between 0-100%';
    }

    if (vitals.painLevel && (parseInt(vitals.painLevel) < 0 || parseInt(vitals.painLevel) > 10)) {
      newErrors.painLevel = 'Pain level must be between 0-10';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const vitalSign: VitalSign = {
        id: `vital-${Date.now()}`,
        resourceType: 'Observation',
        dateTime: recordedTime.toISOString(),
        patientId: route.params.patientId,
        recordedBy: user?.name || 'Unknown',
        heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
        bloodPressure: vitals.systolicBP && vitals.diastolicBP ? {
          systolic: parseInt(vitals.systolicBP),
          diastolic: parseInt(vitals.diastolicBP),
        } : undefined,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        temperatureUnit: temperatureUnit,
        respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
        oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation) : undefined,
        oxygenDeliveryMethod: oxygenDelivery,
        weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
        weightUnit: weightUnit,
        height: vitals.height ? parseFloat(vitals.height) : undefined,
        painLevel: vitals.painLevel ? parseInt(vitals.painLevel) : undefined,
        glucoseLevel: vitals.glucoseLevel ? parseFloat(vitals.glucoseLevel) : undefined,
        notes: vitals.notes || undefined,
        syncStatus: isOnline ? 'synced' : 'pending',
      };

      if (isOnline) {
        // Create FHIR observations
        const observations: Observation[] = [];
        
        // Heart Rate
        if (vitalSign.heartRate) {
          observations.push({
            resourceType: 'Observation',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs',
              }],
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8867-4',
                display: 'Heart rate',
              }],
            },
            subject: {reference: `Patient/${route.params.patientId}`},
            effectiveDateTime: recordedTime.toISOString(),
            valueQuantity: {
              value: vitalSign.heartRate,
              unit: 'beats/minute',
              system: 'http://unitsofmeasure.org',
              code: '/min',
            },
            performer: [{display: user?.name || 'Unknown'}],
          });
        }

        // Blood Pressure
        if (vitalSign.bloodPressure) {
          observations.push({
            resourceType: 'Observation',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              }],
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '85354-9',
                display: 'Blood pressure panel',
              }],
            },
            subject: {reference: `Patient/${route.params.patientId}`},
            effectiveDateTime: recordedTime.toISOString(),
            component: [
              {
                code: {
                  coding: [{
                    system: 'http://loinc.org',
                    code: '8480-6',
                    display: 'Systolic blood pressure',
                  }],
                },
                valueQuantity: {
                  value: vitalSign.bloodPressure.systolic,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]',
                },
              },
              {
                code: {
                  coding: [{
                    system: 'http://loinc.org',
                    code: '8462-4',
                    display: 'Diastolic blood pressure',
                  }],
                },
                valueQuantity: {
                  value: vitalSign.bloodPressure.diastolic,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]',
                },
              },
            ],
            performer: [{display: user?.name || 'Unknown'}],
          });
        }

        // Temperature
        if (vitalSign.temperature) {
          const tempValue = temperatureUnit === 'F' 
            ? (vitalSign.temperature - 32) * 5 / 9 
            : vitalSign.temperature;
          
          observations.push({
            resourceType: 'Observation',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              }],
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8310-5',
                display: 'Body temperature',
              }],
            },
            subject: {reference: `Patient/${route.params.patientId}`},
            effectiveDateTime: recordedTime.toISOString(),
            valueQuantity: {
              value: tempValue,
              unit: 'Cel',
              system: 'http://unitsofmeasure.org',
              code: 'Cel',
            },
            performer: [{display: user?.name || 'Unknown'}],
          });
        }

        // Respiratory Rate
        if (vitalSign.respiratoryRate) {
          observations.push({
            resourceType: 'Observation',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              }],
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '9279-1',
                display: 'Respiratory rate',
              }],
            },
            subject: {reference: `Patient/${route.params.patientId}`},
            effectiveDateTime: recordedTime.toISOString(),
            valueQuantity: {
              value: vitalSign.respiratoryRate,
              unit: 'breaths/minute',
              system: 'http://unitsofmeasure.org',
              code: '/min',
            },
            performer: [{display: user?.name || 'Unknown'}],
          });
        }

        // Oxygen Saturation
        if (vitalSign.oxygenSaturation) {
          observations.push({
            resourceType: 'Observation',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              }],
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '2708-6',
                display: 'Oxygen saturation',
              }],
            },
            subject: {reference: `Patient/${route.params.patientId}`},
            effectiveDateTime: recordedTime.toISOString(),
            valueQuantity: {
              value: vitalSign.oxygenSaturation,
              unit: '%',
              system: 'http://unitsofmeasure.org',
              code: '%',
            },
            performer: [{display: user?.name || 'Unknown'}],
            method: oxygenDelivery !== 'room_air' ? {
              coding: [{
                display: oxygenDelivery.replace('_', ' ').toUpperCase(),
              }],
            } : undefined,
          });
        }

        // Save all observations
        for (const obs of observations) {
          await medplum.createResource(obs);
        }
      }

      // Always store offline for sync
      await storeOfflineData({
        id: vitalSign.id,
        resourceType: 'Observation',
        data: vitalSign,
        lastModified: new Date().toISOString(),
        syncStatus: isOnline ? 'synced' : 'pending',
      });

      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error saving vital signs:', error);
      Alert.alert('Error', 'Failed to save vital signs. They will be synced when online.');
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessDialogDismiss = () => {
    setShowSuccessDialog(false);
    navigation.goBack();
  };

  const resetForm = () => {
    setVitals({
      heartRate: '',
      systolicBP: '',
      diastolicBP: '',
      temperature: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: '',
      painLevel: '',
      glucoseLevel: '',
      notes: '',
    });
    setErrors({});
    setWarnings({});
    setRecordedTime(new Date());
  };

  const getPainLevelDescription = (level: string) => {
    const pain = parseInt(level);
    if (pain === 0) return 'No pain';
    if (pain <= 3) return 'Mild pain';
    if (pain <= 6) return 'Moderate pain';
    if (pain <= 9) return 'Severe pain';
    return 'Worst possible pain';
  };

  const getPainLevelColor = (level: string) => {
    const pain = parseInt(level);
    if (pain === 0) return theme.colors.primary;
    if (pain <= 3) return medicalTheme.medical.priority.low;
    if (pain <= 6) return medicalTheme.medical.priority.medium;
    return medicalTheme.medical.priority.high;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const patientName = patient 
    ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`
    : 'Unknown Patient';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Surface style={styles.header}>
          <View style={styles.headerContent}>
            <IconButton
              icon="arrow-left"
              size={24}
              onPress={() => navigation.goBack()}
            />
            <View style={styles.headerInfo}>
              <Text variant="headlineSmall">Record Vital Signs</Text>
              <Text variant="bodyMedium" style={styles.patientName}>
                {patientName}
              </Text>
            </View>
            <IconButton
              icon="refresh"
              size={24}
              onPress={resetForm}
            />
          </View>

          <View style={styles.dateTimeContainer}>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Icon name="clock-outline" size={20} color={theme.colors.primary} />
              <Text variant="bodyMedium" style={styles.dateTimeText}>
                {recordedTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
            
            {!isOnline && (
              <Chip icon="cloud-off" style={styles.offlineChip}>
                Offline
              </Chip>
            )}
          </View>
        </Surface>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Cardiovascular */}
          <Card style={styles.section}>
            <Card.Title
              title="Cardiovascular"
              titleStyle={styles.sectionTitle}
              left={() => <Icon name="heart-pulse" size={24} color={theme.colors.primary} />}
            />
            <Card.Content>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Heart Rate"
                    value={vitals.heartRate}
                    onChangeText={(value) => handleInputChange('heartRate', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="bpm" />}
                    error={!!errors.heartRate}
                    style={styles.input}
                  />
                  <HelperText type="error" visible={!!errors.heartRate}>
                    {errors.heartRate}
                  </HelperText>
                  <HelperText type="info" visible={!!warnings.heartRate}>
                    {warnings.heartRate}
                  </HelperText>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, {flex: 1}]}>
                  <TextInput
                    label="Systolic BP"
                    value={vitals.systolicBP}
                    onChangeText={(value) => handleInputChange('systolicBP', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="mmHg" />}
                    error={!!errors.bloodPressure}
                    style={styles.input}
                  />
                </View>
                <Text variant="headlineMedium" style={styles.bpSeparator}>/</Text>
                <View style={[styles.inputContainer, {flex: 1}]}>
                  <TextInput
                    label="Diastolic BP"
                    value={vitals.diastolicBP}
                    onChangeText={(value) => handleInputChange('diastolicBP', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="mmHg" />}
                    error={!!errors.bloodPressure}
                    style={styles.input}
                  />
                </View>
              </View>
              {errors.bloodPressure && (
                <HelperText type="error" visible style={styles.bloodPressureError}>
                  {errors.bloodPressure}
                </HelperText>
              )}
              {(warnings.systolicBP || warnings.diastolicBP) && (
                <HelperText type="info" visible style={styles.bloodPressureError}>
                  Blood pressure outside normal range
                </HelperText>
              )}
            </Card.Content>
          </Card>

          {/* Respiratory */}
          <Card style={styles.section}>
            <Card.Title
              title="Respiratory"
              titleStyle={styles.sectionTitle}
              left={() => <Icon name="lungs" size={24} color={theme.colors.primary} />}
            />
            <Card.Content>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Respiratory Rate"
                    value={vitals.respiratoryRate}
                    onChangeText={(value) => handleInputChange('respiratoryRate', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="/min" />}
                    error={!!errors.respiratoryRate}
                    style={styles.input}
                  />
                  <HelperText type="info" visible={!!warnings.respiratoryRate}>
                    {warnings.respiratoryRate}
                  </HelperText>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    label="O₂ Saturation"
                    value={vitals.oxygenSaturation}
                    onChangeText={(value) => handleInputChange('oxygenSaturation', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="%" />}
                    error={!!errors.oxygenSaturation}
                    style={styles.input}
                  />
                  <HelperText type="error" visible={!!errors.oxygenSaturation}>
                    {errors.oxygenSaturation}
                  </HelperText>
                  <HelperText type="info" visible={!!warnings.oxygenSaturation}>
                    {warnings.oxygenSaturation}
                  </HelperText>
                </View>
              </View>

              <View style={styles.oxygenDelivery}>
                <Text variant="bodyMedium" style={styles.oxygenDeliveryLabel}>
                  Oxygen Delivery Method:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipGroup}>
                    <Chip
                      selected={oxygenDelivery === 'room_air'}
                      onPress={() => setOxygenDelivery('room_air')}
                      style={styles.chip}
                    >
                      Room Air
                    </Chip>
                    <Chip
                      selected={oxygenDelivery === 'nasal_cannula'}
                      onPress={() => setOxygenDelivery('nasal_cannula')}
                      style={styles.chip}
                    >
                      Nasal Cannula
                    </Chip>
                    <Chip
                      selected={oxygenDelivery === 'face_mask'}
                      onPress={() => setOxygenDelivery('face_mask')}
                      style={styles.chip}
                    >
                      Face Mask
                    </Chip>
                    <Chip
                      selected={oxygenDelivery === 'non_rebreather'}
                      onPress={() => setOxygenDelivery('non_rebreather')}
                      style={styles.chip}
                    >
                      Non-Rebreather
                    </Chip>
                  </View>
                </ScrollView>
              </View>
            </Card.Content>
          </Card>

          {/* Other Vitals */}
          <Card style={styles.section}>
            <Card.Title
              title="Other Measurements"
              titleStyle={styles.sectionTitle}
              left={() => <Icon name="thermometer" size={24} color={theme.colors.primary} />}
            />
            <Card.Content>
              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, {flex: 1}]}>
                  <TextInput
                    label="Temperature"
                    value={vitals.temperature}
                    onChangeText={(value) => handleInputChange('temperature', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text={`°${temperatureUnit}`} />}
                    error={!!errors.temperature}
                    style={styles.input}
                  />
                  <HelperText type="info" visible={!!warnings.temperature}>
                    {warnings.temperature}
                  </HelperText>
                </View>
                <SegmentedButtons
                  value={temperatureUnit}
                  onValueChange={(value) => setTemperatureUnit(value as 'C' | 'F')}
                  buttons={[
                    {value: 'C', label: '°C'},
                    {value: 'F', label: '°F'},
                  ]}
                  style={styles.unitToggle}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, {flex: 1}]}>
                  <TextInput
                    label="Weight"
                    value={vitals.weight}
                    onChangeText={(value) => handleInputChange('weight', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text={weightUnit} />}
                    style={styles.input}
                  />
                </View>
                <SegmentedButtons
                  value={weightUnit}
                  onValueChange={(value) => setWeightUnit(value as 'kg' | 'lb')}
                  buttons={[
                    {value: 'kg', label: 'kg'},
                    {value: 'lb', label: 'lb'},
                  ]}
                  style={styles.unitToggle}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Height"
                    value={vitals.height}
                    onChangeText={(value) => handleInputChange('height', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="cm" />}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Blood Glucose"
                    value={vitals.glucoseLevel}
                    onChangeText={(value) => handleInputChange('glucoseLevel', value)}
                    keyboardType="numeric"
                    right={<TextInput.Affix text="mg/dL" />}
                    style={styles.input}
                  />
                  <HelperText type="info" visible={!!warnings.glucoseLevel}>
                    {warnings.glucoseLevel}
                  </HelperText>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Pain Assessment */}
          <Card style={styles.section}>
            <Card.Title
              title="Pain Assessment"
              titleStyle={styles.sectionTitle}
              left={() => <Icon name="emoticon-sad-outline" size={24} color={theme.colors.primary} />}
            />
            <Card.Content>
              <View style={styles.painContainer}>
                <TextInput
                  label="Pain Level (0-10)"
                  value={vitals.painLevel}
                  onChangeText={(value) => handleInputChange('painLevel', value)}
                  keyboardType="numeric"
                  error={!!errors.painLevel}
                  style={[styles.input, {flex: 1}]}
                />
                {vitals.painLevel && (
                  <View style={styles.painIndicator}>
                    <Text 
                      variant="headlineSmall" 
                      style={[styles.painNumber, {color: getPainLevelColor(vitals.painLevel)}]}
                    >
                      {vitals.painLevel}
                    </Text>
                    <Text variant="bodySmall" style={styles.painDescription}>
                      {getPainLevelDescription(vitals.painLevel)}
                    </Text>
                  </View>
                )}
              </View>
              <HelperText type="error" visible={!!errors.painLevel}>
                {errors.painLevel}
              </HelperText>
            </Card.Content>
          </Card>

          {/* Notes */}
          <Card style={styles.section}>
            <Card.Title
              title="Additional Notes"
              titleStyle={styles.sectionTitle}
              left={() => <Icon name="note-text" size={24} color={theme.colors.primary} />}
            />
            <Card.Content>
              <TextInput
                label="Notes (Optional)"
                value={vitals.notes}
                onChangeText={(value) => setVitals(prev => ({...prev, notes: value}))}
                multiline
                numberOfLines={3}
                style={styles.notesInput}
              />
            </Card.Content>
          </Card>

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.button}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={styles.button}
            >
              Save Vital Signs
            </Button>
          </View>
        </ScrollView>

        {showDatePicker && (
          <DateTimePicker
            value={recordedTime}
            mode="datetime"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setRecordedTime(selectedDate);
              }
            }}
            maximumDate={new Date()}
          />
        )}

        <Portal>
          <Dialog
            visible={showSuccessDialog}
            onDismiss={handleSuccessDialogDismiss}
          >
            <Dialog.Icon icon="check-circle" size={48} color={theme.colors.primary} />
            <Dialog.Title style={styles.dialogTitle}>Success!</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={styles.dialogContent}>
                Vital signs have been recorded successfully.
                {!isOnline && '\n\nThey will be synced when you\'re back online.'}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleSuccessDialogDismiss}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    elevation: 4,
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
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryContainer,
  },
  dateTimeText: {
    marginLeft: 8,
    color: theme.colors.onPrimaryContainer,
  },
  offlineChip: {
    backgroundColor: theme.colors.errorContainer,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    backgroundColor: 'transparent',
  },
  bpSeparator: {
    marginHorizontal: 8,
    marginTop: 20,
  },
  bloodPressureError: {
    marginTop: -8,
    marginBottom: 8,
  },
  unitToggle: {
    marginLeft: 8,
    marginTop: 8,
  },
  oxygenDelivery: {
    marginTop: 16,
  },
  oxygenDeliveryLabel: {
    marginBottom: 8,
    color: theme.colors.onSurfaceVariant,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    marginRight: 8,
  },
  painContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  painIndicator: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  painNumber: {
    fontWeight: '700',
  },
  painDescription: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: 'transparent',
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogContent: {
    textAlign: 'center',
  },
});