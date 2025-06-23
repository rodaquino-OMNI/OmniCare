'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Patient, 
  AllergyIntolerance, 
  Condition, 
  MedicationRequest,
  Encounter,
  Observation,
  DocumentReference
} from '@medplum/fhirtypes';
import { 
  ResourceTimeline, 
  ResourceHistory,
  PatientSummary as MedplumPatientSummary,
  useMedplum,
  useResource,
  Document,
  AllergyIntoleranceDisplay,
  ConditionDisplay,
  MedicationRequestDisplay,
  ObservationDisplay,
  EncounterDisplay
} from '@medplum/react';
import { 
  Tabs, 
  Card, 
  Title, 
  Group, 
  Stack, 
  Badge, 
  Button,
  Alert,
  Loader,
  Text,
  Grid,
  ScrollArea,
  Progress,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { 
  IconStethoscope, 
  IconPill, 
  IconFlask, 
  IconNotes,
  IconHistory,
  IconAlertTriangle,
  IconClipboardList,
  IconCalendar,
  IconRefresh,
  IconDatabase,
  IconClock
} from '@tabler/icons-react';
import { patientHelpers } from '@/lib/medplum';
import { getErrorMessage } from '@/utils/error.utils';
import { patientCacheService } from '@/services/patient-cache.service';
import { useOfflineSync, useOfflineData } from '@/hooks';
import { useOfflineFHIR } from '@/services/offline-fhir.service';
import { IconWifiOff, IconCloudDownload } from '@tabler/icons-react';

interface PatientChartProps {
  patientId: string;
}

export function PatientChart({ patientId }: PatientChartProps) {
  const medplum = useMedplum();
  const patient = useResource<Patient>({ reference: `Patient/${patientId}` });
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [vitals, setVitals] = useState<Observation[]>([]);
  const [labs, setLabs] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [cacheStats, setCacheStats] = useState<{ fromCache: boolean; lastRefreshed?: Date }>({ fromCache: false });
  
  // Offline capabilities
  const { isOffline, pendingChanges } = useOfflineSync();
  const { cachePatient, isOffline: fhirOffline } = useOfflineFHIR();
  const [isPreloading, setIsPreloading] = useState(false);

  // Extract loadPatientData to use in refresh
  const loadPatientData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        allergyData,
        conditionData,
        medicationData,
        encounterData,
        vitalData,
        labData
      ] = await Promise.all([
        patientCacheService.getPatientAllergies(patientId),
        patientCacheService.getPatientConditions(patientId),
        patientCacheService.getPatientMedications(patientId),
        patientCacheService.getPatientEncounters(patientId),
        patientCacheService.getPatientVitalSigns(patientId),
        patientCacheService.getPatientLabResults(patientId)
      ]);

      const documentData = await medplum.searchResources('DocumentReference', {
        patient: patientId,
        _sort: '-date'
      });

      setAllergies(allergyData);
      setConditions(conditionData);
      setMedications(medicationData);
      setEncounters(encounterData);
      setVitals(vitalData);
      setLabs(labData);
      setDocuments(documentData);

      const stats = patientCacheService.getStats();
      setCacheStats({
        fromCache: stats.hitRate > 0.5,
        lastRefreshed: new Date()
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Error loading patient data:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  }, [patientId, medplum]);

  // Load patient data with intelligent caching
  useEffect(() => {
    if (!patient) return;

    loadPatientData();

    // Listen for cache events
    const handleCacheUpdate = (event: any) => {
      if (event.patientId === patientId) {
        loadPatientData();
      }
    };

    patientCacheService.on('cache:patient-updated', handleCacheUpdate);
    patientCacheService.on('cache:related-invalidated', handleCacheUpdate);

    return () => {
      patientCacheService.off('cache:patient-updated', handleCacheUpdate);
      patientCacheService.off('cache:related-invalidated', handleCacheUpdate);
    };
  }, [patient, patientId, medplum]);

  if (!patient) {
    return (
      <Card>
        <Stack align="center" py="xl">
          <Loader size="lg" />
          <Text>Loading patient information...</Text>
        </Stack>
      </Card>
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force refresh all data
      await Promise.all([
        patientCacheService.getPatientAllergies(patientId, true),
        patientCacheService.getPatientConditions(patientId, true),
        patientCacheService.getPatientMedications(patientId, true),
        patientCacheService.getPatientEncounters(patientId, true),
        patientCacheService.getPatientVitalSigns(patientId, true),
        patientCacheService.getPatientLabResults(patientId, true)
      ]);
      
      // Reload the component data
      await loadPatientData();
      
      setCacheStats({
        fromCache: false,
        lastRefreshed: new Date()
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Stack gap="md">
      {/* Patient Header */}
      <Card>
        <Group justify="space-between">
          <div>
            <Title order={2}>{patientHelpers.getFullName(patient)}</Title>
            <Group gap="xs" mt="xs">
              <Badge variant="light">MRN: {patientHelpers.getMRN(patient)}</Badge>
              <Badge variant="light" color="blue">
                {patientHelpers.getAge(patient)} years
              </Badge>
              <Badge variant="light" color="pink">
                {patient.gender}
              </Badge>
              {patient.birthDate && (
                <Badge variant="light" color="gray">
                  DOB: {patient.birthDate}
                </Badge>
              )}
            </Group>
          </div>
          <Group gap="xs">
            {/* Offline Status */}
            {(isOffline || fhirOffline) && (
              <Badge 
                leftSection={<IconWifiOff size={12} />} 
                color="orange" 
                variant="filled"
                size="sm"
              >
                Offline Mode
              </Badge>
            )}
            
            {/* Pending Changes */}
            {pendingChanges > 0 && (
              <Tooltip label={`${pendingChanges} changes pending sync`}>
                <Badge 
                  color="blue" 
                  variant="light"
                  size="sm"
                >
                  {pendingChanges} pending
                </Badge>
              </Tooltip>
            )}
            
            {cacheStats.fromCache && (
              <Tooltip label={`Last refreshed: ${cacheStats.lastRefreshed?.toLocaleTimeString() || 'Unknown'}`}>
                <Badge 
                  leftSection={<IconDatabase size={12} />} 
                  color="green" 
                  variant="light"
                  size="sm"
                >
                  Cached
                </Badge>
              </Tooltip>
            )}
            
            {/* Preload for Offline */}
            <Tooltip label="Download patient data for offline access">
              <Button
                leftSection={<IconCloudDownload size={16} />}
                onClick={async () => {
                  setIsPreloading(true);
                  try {
                    await cachePatient(patientId);
                  } finally {
                    setIsPreloading(false);
                  }
                }}
                variant="subtle"
                loading={isPreloading}
                disabled={isPreloading || isOffline}
                size="sm"
              >
                {isPreloading ? 'Downloading...' : 'Offline'}
              </Button>
            </Tooltip>
            
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={handleRefresh}
              variant="subtle"
              loading={isRefreshing}
              disabled={isRefreshing || isOffline}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        {/* Offline Mode Alert */}
        {(isOffline || fhirOffline) && (
          <Alert 
            icon={<IconWifiOff size={16} />} 
            color="orange" 
            variant="light"
            mt="md"
          >
            <Text fw={600} mb={4}>Working Offline</Text>
            <Text size="sm">
              You're viewing cached patient data. Any changes will be synchronized when you're back online.
            </Text>
          </Alert>
        )}

        {/* Allergy Alert */}
        {allergies.length > 0 && (
          <Alert 
            icon={<IconAlertTriangle size={16} />} 
            color="red" 
            variant="light"
            mt="md"
          >
            <Group gap="xs">
              <Text fw={600}>Allergies:</Text>
              {allergies.slice(0, 3).map((allergy, index) => (
                <Badge key={index} color="red" variant="light">
                  {allergy.code?.coding?.[0]?.display || 'Unknown'}
                </Badge>
              ))}
              {allergies.length > 3 && (
                <Text size="sm" c="dimmed">+{allergies.length - 3} more</Text>
              )}
            </Group>
          </Alert>
        )}
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconClipboardList size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="timeline" leftSection={<IconHistory size={16} />}>
              Timeline
            </Tabs.Tab>
            <Tabs.Tab value="vitals" leftSection={<IconStethoscope size={16} />}>
              Vitals
            </Tabs.Tab>
            <Tabs.Tab value="medications" leftSection={<IconPill size={16} />}>
              Medications
            </Tabs.Tab>
            <Tabs.Tab value="labs" leftSection={<IconFlask size={16} />}>
              Lab Results
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              Clinical Notes
            </Tabs.Tab>
            <Tabs.Tab value="encounters" leftSection={<IconCalendar size={16} />}>
              Encounters
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card>
                  <Title order={4} mb="md">Patient Summary</Title>
                  <MedplumPatientSummary patient={patient} />
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Stack gap="md">
                  <Card>
                    <Title order={4} mb="md">Active Conditions</Title>
                    <ScrollArea h={200}>
                      {conditions.length === 0 ? (
                        <Text c="dimmed">No active conditions</Text>
                      ) : (
                        <Stack gap="xs">
                          {conditions.map((condition) => (
                            <ConditionDisplay 
                              key={condition.id} 
                              value={condition} 
                            />
                          ))}
                        </Stack>
                      )}
                    </ScrollArea>
                  </Card>

                  <Card>
                    <Title order={4} mb="md">Allergies & Intolerances</Title>
                    <ScrollArea h={150}>
                      {allergies.length === 0 ? (
                        <Text c="dimmed">No known allergies</Text>
                      ) : (
                        <Stack gap="xs">
                          {allergies.map((allergy) => (
                            <AllergyIntoleranceDisplay 
                              key={allergy.id} 
                              value={allergy} 
                            />
                          ))}
                        </Stack>
                      )}
                    </ScrollArea>
                  </Card>
                </Stack>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="timeline" pt="md">
            <ResourceTimeline 
              resourceType="Patient"
              id={patientId}
              resourceTypes={[
                'Encounter',
                'Observation',
                'Condition',
                'Procedure',
                'DiagnosticReport',
                'MedicationRequest',
                'DocumentReference'
              ]}
            />
          </Tabs.Panel>

          <Tabs.Panel value="vitals" pt="md">
            {loading ? (
              <Loader />
            ) : vitals.length === 0 ? (
              <Text c="dimmed">No vital signs recorded</Text>
            ) : (
              <Stack gap="md">
                {vitals.map((vital) => (
                  <Card key={vital.id}>
                    <ObservationDisplay value={vital} />
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="medications" pt="md">
            {loading ? (
              <Loader />
            ) : medications.length === 0 ? (
              <Text c="dimmed">No medications</Text>
            ) : (
              <Stack gap="md">
                {medications.map((med) => (
                  <Card key={med.id}>
                    <MedicationRequestDisplay value={med} />
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="labs" pt="md">
            {loading ? (
              <Loader />
            ) : labs.length === 0 ? (
              <Text c="dimmed">No lab results</Text>
            ) : (
              <Stack gap="md">
                {labs.map((lab) => (
                  <Card key={lab.id}>
                    <Text size="sm" fw={500}>
                      {lab.code?.text || lab.code?.coding?.[0]?.display || 'Unknown Lab'}
                    </Text>
                    <Text size="xs">
                      {lab.valueQuantity ? 
                        `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 
                        'No value'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {lab.effectiveDateTime ? new Date(lab.effectiveDateTime).toLocaleString() : 'No date'}
                    </Text>
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="notes" pt="md">
            {loading ? (
              <Loader />
            ) : documents.length === 0 ? (
              <Text c="dimmed">No clinical notes</Text>
            ) : (
              <Stack gap="md">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <Text size="sm" fw={500}>
                      {doc.description || 'Clinical Document'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {doc.type?.text || doc.type?.coding?.[0]?.display || 'Unknown Type'}
                    </Text>
                    {doc.content?.[0]?.attachment?.url && (
                      <Button 
                        size="xs" 
                        component="a" 
                        href={doc.content[0].attachment.url}
                        target="_blank"
                        mt="xs"
                      >
                        View Document
                      </Button>
                    )}
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="encounters" pt="md">
            {loading ? (
              <Loader />
            ) : encounters.length === 0 ? (
              <Text c="dimmed">No encounters recorded</Text>
            ) : (
              <Stack gap="md">
                {encounters.map((encounter) => (
                  <Card key={encounter.id}>
                    <Text size="sm" fw={500}>
                      {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Unknown Encounter'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Status: {encounter.status}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {encounter.period?.start ? new Date(encounter.period.start).toLocaleString() : 'No date'}
                    </Text>
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Resource History */}
      <Card>
        <Title order={3} mb="md">
          <Group gap="xs">
            <IconHistory size={20} />
            Change History
          </Group>
        </Title>
        <ResourceHistory resourceType="Patient" id={patientId} />
      </Card>
    </Stack>
  );
}