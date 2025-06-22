'use client';

import { useState, useEffect } from 'react';
import { 
  Patient, 
  MedicationRequest, 
  MedicationAdministration,
  MedicationStatement,
  Medication,
  Reference
} from '@medplum/fhirtypes';
import { 
  MedicationRequestInput,
  MedicationRequestDisplay,
  ResourceTable,
  useMedplum,
  useResource,
  createReference
} from '@medplum/react';
import { 
  Card, 
  Title, 
  Stack, 
  Group, 
  Button,
  Badge,
  Tabs,
  Alert,
  Text,
  ActionIcon,
  Modal,
  Menu,
  Loader,
  Paper
} from '@mantine/core';
import { 
  IconPill, 
  IconPlus, 
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconEdit,
  IconTrash,
  IconHistory,
  IconClock,
  IconRefresh,
  IconPrinter,
  IconDownload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { medicationHelpers } from '@/lib/medplum';
import { formatDateTime } from '@/utils';
import { getErrorMessage, getDisplayErrorMessage } from '@/utils/error.utils';

interface MedicationManagementProps {
  patient: Patient;
  encounterId?: string;
  mode?: 'view' | 'prescribe' | 'reconcile';
}

export function MedicationManagement({ 
  patient, 
  encounterId,
  mode = 'view' 
}: MedicationManagementProps) {
  const medplum = useMedplum();
  const [activeTab, setActiveTab] = useState<string | null>('active');
  const [loading, setLoading] = useState(false);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [showPrescribeModal, setShowPrescribeModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<MedicationRequest | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Load medications
  useEffect(() => {
    loadMedications();
  }, [patient.id]);

  const loadMedications = async () => {
    if (!patient.id) return;
    
    setLoading(true);
    try {
      const meds = await medicationHelpers.getMedications(patient.id);
      setMedications(meds);
    } catch (error: unknown) {
      const errorMessage = getDisplayErrorMessage(error);
      console.error('Error loading medications:', errorMessage, error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load medications',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadMedications();
  };

  const handlePrescribe = () => {
    setShowPrescribeModal(true);
  };

  const handleSavePrescription = async (medicationRequest: MedicationRequest) => {
    try {
      const savedMed = await medplum.createResource(medicationRequest);
      setMedications([savedMed, ...medications]);
      setShowPrescribeModal(false);
      
      notifications.show({
        title: 'Success',
        message: 'Prescription created successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error: unknown) {
      const errorMessage = getDisplayErrorMessage(error);
      console.error('Error creating prescription:', errorMessage, error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create prescription',
        color: 'red'
      });
    }
  };

  const handleDiscontinue = async (medicationRequest: MedicationRequest) => {
    try {
      const updated = {
        ...medicationRequest,
        status: 'stopped' as const,
        statusReason: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-status-reason',
            code: 'altchoice',
            display: 'Discontinued'
          }]
        }
      };
      
      await medplum.updateResource(updated);
      await loadMedications();
      
      notifications.show({
        title: 'Success',
        message: 'Medication discontinued',
        color: 'green'
      });
    } catch (error: unknown) {
      const errorMessage = getDisplayErrorMessage(error);
      console.error('Error discontinuing medication:', errorMessage, error);
      notifications.show({
        title: 'Error',
        message: 'Failed to discontinue medication',
        color: 'red'
      });
    }
  };

  const handleEdit = (medication: MedicationRequest) => {
    setSelectedMedication(medication);
    setShowEditModal(true);
  };

  const getMedicationStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'on-hold': return 'yellow';
      case 'cancelled': return 'red';
      case 'completed': return 'blue';
      case 'stopped': return 'orange';
      default: return 'gray';
    }
  };

  // Define columns for medication table
  const medicationColumns = [
    {
      name: 'Medication',
      selector: (med: MedicationRequest) => medicationHelpers.getName(med),
      sortable: true,
    },
    {
      name: 'Dosage',
      selector: (med: MedicationRequest) => medicationHelpers.getDosageInstruction(med),
    },
    {
      name: 'Status',
      selector: (med: MedicationRequest) => (
        <Badge color={getMedicationStatusColor(med.status)} variant="light">
          {med.status}
        </Badge>
      ),
    },
    {
      name: 'Start Date',
      selector: (med: MedicationRequest) => formatDateTime(med.authoredOn || ''),
      sortable: true,
    },
    {
      name: 'Actions',
      selector: (med: MedicationRequest) => (
        <Group gap="xs">
          <ActionIcon size="sm" variant="subtle" onClick={() => handleEdit(med)}>
            <IconEdit size={16} />
          </ActionIcon>
          {med.status === 'active' && (
            <ActionIcon 
              size="sm" 
              variant="subtle" 
              color="red"
              onClick={() => handleDiscontinue(med)}
            >
              <IconX size={16} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {/* Header */}
      <Card>
        <Group justify="space-between">
          <Title order={2}>
            <Group gap="xs">
              <IconPill size={24} />
              Medications
            </Group>
          </Title>
          <Group gap="sm">
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="subtle"
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            {mode !== 'view' && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handlePrescribe}
              >
                New Prescription
              </Button>
            )}
          </Group>
        </Group>

        {/* Allergy Warning */}
        <Alert 
          icon={<IconAlertTriangle size={16} />} 
          color="red" 
          variant="light"
          mt="md"
        >
          <Text fw={600}>Check for drug allergies and interactions before prescribing</Text>
        </Alert>
      </Card>

      {/* Medication Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="active" leftSection={<IconPill size={16} />}>
              Active Medications
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
              Medication History
            </Tabs.Tab>
            <Tabs.Tab value="reconciliation" leftSection={<IconCheck size={16} />}>
              Reconciliation
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="active" pt="md">
            {loading ? (
              <Stack align="center" py="xl">
                <Loader size="lg" />
                <Text>Loading medications...</Text>
              </Stack>
            ) : (
              <ResourceTable
                resourceType="MedicationRequest"
                columns={medicationColumns}
                value={medications.filter(med => med.status === 'active')}
                emptyMessage={
                  <Stack align="center" gap="xs" py="xl">
                    <IconPill size={48} style={{ opacity: 0.5 }} />
                    <Text c="dimmed">No active medications</Text>
                  </Stack>
                }
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            {loading ? (
              <Stack align="center" py="xl">
                <Loader size="lg" />
                <Text>Loading medication history...</Text>
              </Stack>
            ) : (
              <ResourceTable
                resourceType="MedicationRequest"
                columns={medicationColumns}
                value={medications.filter(med => 
                  ['completed', 'stopped', 'cancelled'].includes(med.status || '')
                )}
                emptyMessage={
                  <Stack align="center" gap="xs" py="xl">
                    <IconHistory size={48} style={{ opacity: 0.5 }} />
                    <Text c="dimmed">No medication history</Text>
                  </Stack>
                }
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="reconciliation" pt="md">
            <MedicationReconciliation 
              patient={patient} 
              medications={medications}
              onUpdate={loadMedications}
            />
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Prescribe Modal */}
      <Modal
        opened={showPrescribeModal}
        onClose={() => setShowPrescribeModal(false)}
        title="New Prescription"
        size="lg"
      >
        <MedicationRequestInput
          patient={createReference(patient)}
          encounter={encounterId ? { reference: `Encounter/${encounterId}` } : undefined}
          onSubmit={handleSavePrescription}
          onCancel={() => setShowPrescribeModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedMedication(null);
        }}
        title="Edit Prescription"
        size="lg"
      >
        {selectedMedication && (
          <MedicationRequestInput
            value={selectedMedication}
            patient={createReference(patient)}
            onSubmit={async (updated) => {
              await medplum.updateResource(updated);
              await loadMedications();
              setShowEditModal(false);
              setSelectedMedication(null);
              
              notifications.show({
                title: 'Success',
                message: 'Prescription updated',
                color: 'green'
              });
            }}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedMedication(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

// Medication Reconciliation Component
interface MedicationReconciliationProps {
  patient: Patient;
  medications: MedicationRequest[];
  onUpdate: () => void;
}

function MedicationReconciliation({ 
  patient, 
  medications,
  onUpdate 
}: MedicationReconciliationProps) {
  const medplum = useMedplum();
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationList, setReconciliationList] = useState<MedicationRequest[]>([]);

  useEffect(() => {
    // Filter active medications for reconciliation
    setReconciliationList(medications.filter(med => med.status === 'active'));
  }, [medications]);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      // In a real implementation, this would create a MedicationStatement
      // documenting the reconciliation process
      
      notifications.show({
        title: 'Success',
        message: 'Medication reconciliation completed',
        color: 'green'
      });
      
      onUpdate();
    } catch (error: unknown) {
      const errorMessage = getDisplayErrorMessage(error);
      console.error('Error during reconciliation:', errorMessage, error);
      notifications.show({
        title: 'Error',
        message: 'Failed to complete reconciliation',
        color: 'red'
      });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <Stack gap="md">
      <Alert color="blue" variant="light">
        <Text fw={500}>Medication Reconciliation</Text>
        <Text size="sm" mt="xs">
          Review and confirm all current medications with the patient to ensure accuracy.
        </Text>
      </Alert>

      {reconciliationList.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No active medications to reconcile
        </Text>
      ) : (
        <Stack gap="sm">
          {reconciliationList.map((med) => (
            <Paper key={med.id} p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{medicationHelpers.getName(med)}</Text>
                  <Text size="sm" c="dimmed">
                    {medicationHelpers.getDosageInstruction(med)}
                  </Text>
                </div>
                <Group gap="xs">
                  <Button size="xs" variant="light" color="green">
                    Continue
                  </Button>
                  <Button size="xs" variant="light" color="orange">
                    Modify
                  </Button>
                  <Button size="xs" variant="light" color="red">
                    Discontinue
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Group justify="flex-end">
        <Button
          loading={reconciling}
          onClick={handleReconcile}
          disabled={reconciliationList.length === 0}
        >
          Complete Reconciliation
        </Button>
      </Group>
    </Stack>
  );
}