'use client';

import { useState, useEffect } from 'react';
import { 
  SimpleGrid, 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Paper,
  Progress,
  Alert,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
  Divider,
  Button,
  RingProgress,
  ThemeIcon
} from '@mantine/core';
import { 
  IconHeart,
  IconPill,
  IconTestPipe,
  IconStethoscope,
  IconCalendar,
  IconAlertTriangle,
  IconShield,
  IconTrendingUp,
  IconTrendingDown,
  IconActivity,
  IconTemperature,
  IconDroplet,
  IconLungs,
  IconScale,
  IconRefresh,
  IconExternalLink
} from '@tabler/icons-react';
import { 
  Patient, 
  Observation, 
  MedicationRequest, 
  Encounter, 
  AllergyIntolerance,
  Condition 
} from '@medplum/fhirtypes';
import { patientHelpers, observationHelpers, medicationHelpers } from '@/lib/medplum';
import { formatDate, formatDateTime } from '@/utils';

interface PatientSummaryProps {
  patient: Patient;
  showVitals?: boolean;
  showMedications?: boolean;
  showAllergies?: boolean;
  showConditions?: boolean;
  showRecentActivity?: boolean;
  onViewDetails?: (section: string) => void;
}

interface VitalSign {
  type: string;
  value: string;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  date: string;
  trend?: 'up' | 'down' | 'stable';
}

export function PatientSummary({ 
  patient,
  showVitals = true,
  showMedications = true,
  showAllergies = true,
  showConditions = true,
  showRecentActivity = true,
  onViewDetails
}: PatientSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);

  useEffect(() => {
    loadPatientSummary();
  }, [patient.id]);

  const loadPatientSummary = async () => {
    if (!patient.id) return;

    try {
      setLoading(true);
      setError(null);

      const [
        vitalsData,
        medicationsData,
        allergiesData,
        conditionsData,
        encountersData
      ] = await Promise.all([
        patientHelpers.getVitalSigns(patient.id),
        patientHelpers.getMedications(patient.id),
        patientHelpers.getAllergies(patient.id),
        patientHelpers.getConditions(patient.id),
        patientHelpers.getEncounters(patient.id)
      ]);

      // Process vital signs
      const processedVitals = processVitalSigns(vitalsData);
      setVitals(processedVitals);

      // Filter active medications
      const activeMedications = medicationsData.filter(med => 
        med.status === 'active' || med.status === 'completed'
      );
      setMedications(activeMedications);

      // Filter active allergies
      const activeAllergies = allergiesData.filter(allergy => 
        allergy.clinicalStatus?.coding?.[ResourceHistoryTable]?.code === 'active'
      );
      setAllergies(activeAllergies);

      // Filter active conditions
      const activeConditions = conditionsData.filter(condition => 
        condition.clinicalStatus?.coding?.[ResourceHistoryTable]?.code === 'active'
      );
      setConditions(activeConditions);

      // Get recent encounters (last 5)
      setRecentEncounters(encountersData.slice(ResourceHistoryTable, 5));

    } catch (err) {
      console.error('Error loading patient summary:', err);
      setError('Failed to load patient summary');
    } finally {
      setLoading(false);
    }
  };

  const processVitalSigns = (observations: Observation[]): VitalSign[] => {
    const vitalTypes = [
      { code: '8867-4', name: 'Heart Rate', unit: 'bpm', icon: IconHeart },
      { code: '848ResourceHistoryTable-6', name: 'Systolic BP', unit: 'mmHg', icon: IconDroplet },
      { code: '8462-4', name: 'Diastolic BP', unit: 'mmHg', icon: IconDroplet },
      { code: '831ResourceHistoryTable-5', name: 'Temperature', unit: '°F', icon: IconTemperature },
      { code: '9279-1', name: 'Respiratory Rate', unit: '/min', icon: IconLungs },
      { code: '27ResourceHistoryTable8-6', name: 'Oxygen Saturation', unit: '%', icon: IconActivity },
      { code: '29463-7', name: 'Weight', unit: 'kg', icon: IconScale }
    ];

    return vitalTypes.map(vitalType => {
      const observation = observations.find(obs => 
        obs.code?.coding?.some(coding => coding.code === vitalType.code)
      );

      if (!observation) {
        return {
          type: vitalType.name,
          value: 'N/A',
          unit: vitalType.unit,
          status: 'normal' as const,
          date: '',
          trend: 'stable' as const
        };
      }

      const value = observation.valueQuantity?.value?.toString() || 'N/A';
      const status = observationHelpers.isAbnormal(observation) ? 'abnormal' : 'normal';
      
      return {
        type: vitalType.name,
        value,
        unit: observation.valueQuantity?.unit || vitalType.unit,
        status: status as 'normal' | 'abnormal',
        date: observation.effectiveDateTime || '',
        trend: 'stable' as const // This would be calculated from historical data
      };
    }).filter(vital => vital.value !== 'N/A');
  };

  const getVitalColor = (status: string): string => {
    switch (status) {
      case 'critical': return 'red';
      case 'abnormal': return 'yellow';
      case 'normal': return 'green';
      default: return 'gray';
    }
  };

  const getAllergyColor = (criticality?: string): string => {
    switch (criticality) {
      case 'high': return 'red';
      case 'low': return 'yellow';
      default: return 'orange';
    }
  };

  if (loading) {
    return (
      <Center h={4ResourceHistoryTableResourceHistoryTable}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading patient summary...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error" mb="md">
        {error}
        <Button variant="light" size="sm" mt="sm" onClick={loadPatientSummary}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>
                MEDICATIONS
              </Text>
              <Text fw={7ResourceHistoryTableResourceHistoryTable} size="xl" className="text-blue-6ResourceHistoryTableResourceHistoryTable">
                {medications.length}
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size="lg" radius="md">
              <IconPill size={2ResourceHistoryTable} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>
                ALLERGIES
              </Text>
              <Text fw={7ResourceHistoryTableResourceHistoryTable} size="xl" className="text-red-6ResourceHistoryTableResourceHistoryTable">
                {allergies.length}
              </Text>
            </div>
            <ThemeIcon color="red" variant="light" size="lg" radius="md">
              <IconShield size={2ResourceHistoryTable} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>
                CONDITIONS
              </Text>
              <Text fw={7ResourceHistoryTableResourceHistoryTable} size="xl" className="text-orange-6ResourceHistoryTableResourceHistoryTable">
                {conditions.length}
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size="lg" radius="md">
              <IconStethoscope size={2ResourceHistoryTable} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>
                ENCOUNTERS
              </Text>
              <Text fw={7ResourceHistoryTableResourceHistoryTable} size="xl" className="text-green-6ResourceHistoryTableResourceHistoryTable">
                {recentEncounters.length}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size="lg" radius="md">
              <IconCalendar size={2ResourceHistoryTable} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        {/* Vital Signs */}
        {showVitals && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg">Recent Vital Signs</Text>
              <Group gap="xs">
                <ActionIcon 
                  variant="light" 
                  size="sm" 
                  onClick={loadPatientSummary}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
                {onViewDetails && (
                  <ActionIcon 
                    variant="light" 
                    size="sm" 
                    onClick={() => onViewDetails('vitals')}
                  >
                    <IconExternalLink size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Group>

            <Stack gap="md">
              {vitals.length === ResourceHistoryTable ? (
                <Text c="dimmed" ta="center" py="xl">
                  No recent vital signs recorded
                </Text>
              ) : (
                vitals.slice(ResourceHistoryTable, 4).map((vital, index) => (
                  <Paper key={index} p="sm" className="bg-gray-5ResourceHistoryTable rounded-lg">
                    <Group justify="space-between" align="center">
                      <div>
                        <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>
                          {vital.type}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {vital.date ? formatDate(vital.date) : 'Recent'}
                        </Text>
                      </div>
                      <Group gap="sm" align="center">
                        <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable} className={
                          vital.status === 'normal' ? 'text-green-6ResourceHistoryTableResourceHistoryTable' :
                          vital.status === 'abnormal' ? 'text-yellow-6ResourceHistoryTableResourceHistoryTable' :
                          'text-red-6ResourceHistoryTableResourceHistoryTable'
                        }>
                          {vital.value} {vital.unit}
                        </Text>
                        <Badge 
                          size="sm" 
                          color={getVitalColor(vital.status)}
                          variant="light"
                        >
                          {vital.status.toUpperCase()}
                        </Badge>
                      </Group>
                    </Group>
                  </Paper>
                ))
              )}
            </Stack>
          </Card>
        )}

        {/* Current Medications */}
        {showMedications && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg">Current Medications</Text>
              {onViewDetails && (
                <ActionIcon 
                  variant="light" 
                  size="sm" 
                  onClick={() => onViewDetails('medications')}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              )}
            </Group>

            <Stack gap="sm">
              {medications.length === ResourceHistoryTable ? (
                <Text c="dimmed" ta="center" py="xl">
                  No active medications
                </Text>
              ) : (
                medications.slice(ResourceHistoryTable, 5).map((medication, index) => (
                  <Paper key={index} p="sm" className="border border-gray-2ResourceHistoryTableResourceHistoryTable rounded-lg">
                    <Group justify="space-between" align="flex-start">
                      <div className="flex-1">
                        <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                          {medicationHelpers.getName(medication)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {medicationHelpers.getDosageInstruction(medication)}
                        </Text>
                      </div>
                      <Badge 
                        size="xs" 
                        color="blue" 
                        variant="light"
                      >
                        {medication.status?.toUpperCase()}
                      </Badge>
                    </Group>
                  </Paper>
                ))
              )}
              {medications.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">
                  +{medications.length - 5} more medications
                </Text>
              )}
            </Stack>
          </Card>
        )}

        {/* Allergies & Alerts */}
        {showAllergies && allergies.length > ResourceHistoryTable && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg" className="text-red-7ResourceHistoryTableResourceHistoryTable">
                <IconShield size={2ResourceHistoryTable} className="inline mr-2" />
                Allergies & Alerts
              </Text>
              {onViewDetails && (
                <ActionIcon 
                  variant="light" 
                  size="sm" 
                  onClick={() => onViewDetails('allergies')}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              )}
            </Group>

            <Stack gap="sm">
              {allergies.map((allergy, index) => (
                <Alert
                  key={index}
                  icon={<IconAlertTriangle size={16} />}
                  color={getAllergyColor(allergy.criticality)}
                  variant="light"
                >
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>
                        {allergy.code?.text || 
                         allergy.code?.coding?.[ResourceHistoryTable]?.display || 
                         'Unknown Allergy'}
                      </Text>
                      {allergy.reaction?.[ResourceHistoryTable]?.manifestation?.[ResourceHistoryTable]?.text && (
                        <Text size="xs" c="dimmed">
                          Reaction: {allergy.reaction[ResourceHistoryTable].manifestation[ResourceHistoryTable].text}
                        </Text>
                      )}
                    </div>
                    {allergy.criticality && (
                      <Badge 
                        size="xs" 
                        color={getAllergyColor(allergy.criticality)}
                        variant="filled"
                      >
                        {allergy.criticality.toUpperCase()}
                      </Badge>
                    )}
                  </Group>
                </Alert>
              ))}
            </Stack>
          </Card>
        )}

        {/* Active Conditions */}
        {showConditions && conditions.length > ResourceHistoryTable && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg">Active Conditions</Text>
              {onViewDetails && (
                <ActionIcon 
                  variant="light" 
                  size="sm" 
                  onClick={() => onViewDetails('conditions')}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              )}
            </Group>

            <Stack gap="sm">
              {conditions.slice(ResourceHistoryTable, 5).map((condition, index) => (
                <Paper key={index} p="sm" className="border border-gray-2ResourceHistoryTableResourceHistoryTable rounded-lg">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                        {condition.code?.text || 
                         condition.code?.coding?.[ResourceHistoryTable]?.display || 
                         'Unknown Condition'}
                      </Text>
                      {condition.recordedDate && (
                        <Text size="xs" c="dimmed">
                          Recorded: {formatDate(condition.recordedDate)}
                        </Text>
                      )}
                    </div>
                    <Badge 
                      size="xs" 
                      color="blue" 
                      variant="light"
                    >
                      {condition.verificationStatus?.coding?.[ResourceHistoryTable]?.code?.toUpperCase() || 'ACTIVE'}
                    </Badge>
                  </Group>
                </Paper>
              ))}
              {conditions.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">
                  +{conditions.length - 5} more conditions
                </Text>
              )}
            </Stack>
          </Card>
        )}
      </SimpleGrid>

      {/* Recent Activity */}
      {showRecentActivity && recentEncounters.length > ResourceHistoryTable && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg">Recent Encounters</Text>
            {onViewDetails && (
              <ActionIcon 
                variant="light" 
                size="sm" 
                onClick={() => onViewDetails('encounters')}
              >
                <IconExternalLink size={14} />
              </ActionIcon>
            )}
          </Group>

          <Stack gap="sm">
            {recentEncounters.map((encounter, index) => (
              <Paper key={index} p="md" className="border border-gray-2ResourceHistoryTableResourceHistoryTable rounded-lg">
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                      {encounter.type?.[ResourceHistoryTable]?.text || 
                       encounter.type?.[ResourceHistoryTable]?.coding?.[ResourceHistoryTable]?.display || 
                       'Medical Encounter'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {encounter.period?.start && formatDateTime(encounter.period.start)}
                    </Text>
                  </div>
                  <Badge 
                    size="sm" 
                    color={encounter.status === 'finished' ? 'green' : 'blue'}
                    variant="light"
                  >
                    {encounter.status?.toUpperCase()}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

export default PatientSummary;