'use client';

import { useState, useEffect } from 'react';
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
  ScrollArea
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
  IconRefresh
} from '@tabler/icons-react';
import { patientHelpers } from '@/lib/medplum';

interface PatientChartProps {
  patientId: string;
}

export function PatientChart({ patientId }: PatientChartProps) {
  const medplum = useMedplum();
  const patient = useResource<Patient>({ reference: `Patient/${patientId}` });
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [loading, setLoading] = useState(false);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [vitals, setVitals] = useState<Observation[]>([]);
  const [labs, setLabs] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<DocumentReference[]>([]);

  // Load patient data
  useEffect(() => {
    if (!patient) return;

    const loadPatientData = async () => {
      setLoading(true);
      try {
        const [
          allergyData,
          conditionData,
          medicationData,
          encounterData,
          vitalData,
          labData,
          documentData
        ] = await Promise.all([
          patientHelpers.getAllergies(patientId),
          patientHelpers.getConditions(patientId),
          patientHelpers.getMedications(patientId),
          patientHelpers.getEncounters(patientId),
          patientHelpers.getVitalSigns(patientId),
          patientHelpers.getLabResults(patientId),
          medplum.searchResources('DocumentReference', {
            patient: patientId,
            _sort: '-date'
          })
        ]);

        setAllergies(allergyData);
        setConditions(conditionData);
        setMedications(medicationData);
        setEncounters(encounterData);
        setVitals(vitalData);
        setLabs(labData);
        setDocuments(documentData);
      } catch (error) {
        console.error('Error loading patient data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
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

  const handleRefresh = () => {
    window.location.reload();
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
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={handleRefresh}
            variant="subtle"
          >
            Refresh
          </Button>
        </Group>

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
              value={`Patient/${patientId}`}
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
                    <ObservationDisplay value={lab} />
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
                    <Document
                      reference={{ reference: `DocumentReference/${doc.id}` }}
                      onEdit={() => {}}
                    />
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
                    <EncounterDisplay value={encounter} />
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