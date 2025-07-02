'use client';

import { useState, useEffect } from 'react';
import {
  Stack,
  Group,
  Text,
  Title,
  Tabs,
  Card,
  Button,
  Select,
  TextInput,
  Textarea,
  Badge,
  ActionIcon,
  Table,
  ScrollArea,
  Modal,
  Alert,
  LoadingOverlay
} from '@mantine/core';
import {
  IconFlask,
  IconPill,
  IconScan,
  IconPlus,
  IconX,
  IconCheck,
  IconClock,
  IconUrgent,
  IconAlertCircle,
  IconSearch
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Patient, ServiceRequest, MedicationRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { formatDateTime } from '@/utils';

interface OrderManagementProps {
  patient: Patient;
  encounterId?: string;
}

interface LabTest {
  code: string;
  display: string;
  system: string;
}

interface Medication {
  code: string;
  display: string;
  system: string;
}

interface ImagingType {
  code: string;
  display: string;
  system: string;
}

// Common lab tests
const COMMON_LAB_TESTS: LabTest[] = [
  { code: '2345-7', display: 'Glucose', system: 'http://loinc.org' },
  { code: '718-7', display: 'Hemoglobin', system: 'http://loinc.org' },
  { code: '2160-0', display: 'Creatinine', system: 'http://loinc.org' },
  { code: '3094-0', display: 'Urea Nitrogen', system: 'http://loinc.org' },
  { code: '2951-2', display: 'Sodium', system: 'http://loinc.org' },
  { code: '2823-3', display: 'Potassium', system: 'http://loinc.org' },
  { code: '2075-0', display: 'Chloride', system: 'http://loinc.org' },
  { code: '2028-9', display: 'Carbon Dioxide', system: 'http://loinc.org' },
  { code: '1742-6', display: 'ALT', system: 'http://loinc.org' },
  { code: '1920-8', display: 'AST', system: 'http://loinc.org' },
  { code: '6768-6', display: 'Alkaline Phosphatase', system: 'http://loinc.org' },
  { code: '1975-2', display: 'Total Bilirubin', system: 'http://loinc.org' },
  { code: '4544-3', display: 'HbA1c', system: 'http://loinc.org' },
  { code: '2085-9', display: 'HDL Cholesterol', system: 'http://loinc.org' },
  { code: '2089-1', display: 'LDL Cholesterol', system: 'http://loinc.org' },
  { code: '2571-8', display: 'Triglycerides', system: 'http://loinc.org' },
  { code: '5902-2', display: 'Prothrombin Time', system: 'http://loinc.org' },
  { code: '5794-3', display: 'Partial Thromboplastin Time', system: 'http://loinc.org' },
  { code: '30428-7', display: 'Complete Blood Count', system: 'http://loinc.org' },
  { code: '1759-0', display: 'Basic Metabolic Panel', system: 'http://loinc.org' },
  { code: '24323-8', display: 'Comprehensive Metabolic Panel', system: 'http://loinc.org' },
  { code: '5932-9', display: 'Thyroid Stimulating Hormone', system: 'http://loinc.org' },
  { code: '3016-3', display: 'Free T4', system: 'http://loinc.org' },
  { code: '3053-6', display: 'Free T3', system: 'http://loinc.org' },
  { code: '5778-6', display: 'Urinalysis', system: 'http://loinc.org' }
];

// Common medications
const COMMON_MEDICATIONS: Medication[] = [
  { code: '197361', display: 'Acetaminophen 500mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '197807', display: 'Ibuprofen 400mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '308136', display: 'Amoxicillin 500mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '197517', display: 'Azithromycin 250mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '314077', display: 'Lisinopril 10mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '314076', display: 'Metoprolol 50mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '860975', display: 'Metformin 500mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '314231', display: 'Atorvastatin 20mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '313850', display: 'Omeprazole 20mg', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { code: '197696', display: 'Albuterol Inhaler', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' }
];

// Common imaging types
const IMAGING_TYPES: ImagingType[] = [
  { code: '39714-3', display: 'Chest X-Ray', system: 'http://loinc.org' },
  { code: '30746-2', display: 'CT Head', system: 'http://loinc.org' },
  { code: '30747-0', display: 'CT Chest', system: 'http://loinc.org' },
  { code: '30631-6', display: 'CT Abdomen', system: 'http://loinc.org' },
  { code: '36643-5', display: 'MRI Brain', system: 'http://loinc.org' },
  { code: '36554-4', display: 'MRI Spine', system: 'http://loinc.org' },
  { code: '45036-6', display: 'Ultrasound Abdomen', system: 'http://loinc.org' },
  { code: '42148-7', display: 'Echocardiogram', system: 'http://loinc.org' }
];

// Body parts for imaging
const BODY_PARTS = [
  { code: '39607001', display: 'Head', system: 'http://snomed.info/sct' },
  { code: '51185008', display: 'Chest', system: 'http://snomed.info/sct' },
  { code: '818981001', display: 'Abdomen', system: 'http://snomed.info/sct' },
  { code: '77568009', display: 'Pelvis', system: 'http://snomed.info/sct' },
  { code: '30021000', display: 'Lower extremity', system: 'http://snomed.info/sct' },
  { code: '53120007', display: 'Upper extremity', system: 'http://snomed.info/sct' },
  { code: '421060004', display: 'Spine', system: 'http://snomed.info/sct' }
];

const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' }
];

export function OrderManagement({ patient, encounterId }: OrderManagementProps) {
  const medplum = useMedplum();
  const [activeTab, setActiveTab] = useState<string | null>('lab');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  // Lab order state
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [labPriority, setLabPriority] = useState('routine');
  const [labNotes, setLabNotes] = useState('');

  // Medication order state
  const [selectedMedication, setSelectedMedication] = useState<string>('');
  const [dosageInstructions, setDosageInstructions] = useState('');
  const [medicationQuantity, setMedicationQuantity] = useState('');
  const [medicationRefills, setMedicationRefills] = useState('0');
  const [medicationPriority, setMedicationPriority] = useState('routine');
  const [medicationNotes, setMedicationNotes] = useState('');

  // Imaging order state
  const [selectedImagingType, setSelectedImagingType] = useState<string>('');
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('');
  const [imagingIndication, setImagingIndication] = useState('');
  const [imagingPriority, setImagingPriority] = useState('routine');
  const [imagingNotes, setImagingNotes] = useState('');

  // Search state
  const [labTestSearch, setLabTestSearch] = useState('');
  const [medicationSearch, setMedicationSearch] = useState('');

  useEffect(() => {
    loadPatientOrders();
  }, [patient.id]);

  const loadPatientOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/patient/${patient.id}`, {
        headers: {
          'Authorization': `Bearer ${await medplum.getAccessToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLabOrder = async () => {
    if (selectedTests.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select at least one test',
        color: 'red',
        icon: <IconX />
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/orders/lab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await medplum.getAccessToken()}`
        },
        body: JSON.stringify({
          patientId: patient.id,
          encounterId,
          tests: selectedTests,
          priority: labPriority,
          notes: labNotes
        })
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Lab order created successfully',
          color: 'green',
          icon: <IconCheck />
        });
        
        // Reset form
        setSelectedTests([]);
        setLabNotes('');
        setLabPriority('routine');
        
        // Reload orders
        loadPatientOrders();
      } else {
        throw new Error('Failed to create lab order');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create lab order',
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMedicationOrder = async () => {
    const medication = COMMON_MEDICATIONS.find(m => m.code === selectedMedication);
    if (!medication || !dosageInstructions) {
      notifications.show({
        title: 'Error',
        message: 'Please select medication and provide dosage instructions',
        color: 'red',
        icon: <IconX />
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/orders/medication', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await medplum.getAccessToken()}`
        },
        body: JSON.stringify({
          patientId: patient.id,
          encounterId,
          medicationCode: medication,
          dosageInstructions: {
            text: dosageInstructions
          },
          quantity: medicationQuantity ? {
            value: parseInt(medicationQuantity),
            unit: 'tablets',
            code: 'TAB'
          } : undefined,
          refills: parseInt(medicationRefills),
          priority: medicationPriority,
          notes: medicationNotes
        })
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Medication order created successfully',
          color: 'green',
          icon: <IconCheck />
        });
        
        // Reset form
        setSelectedMedication('');
        setDosageInstructions('');
        setMedicationQuantity('');
        setMedicationRefills('0');
        setMedicationNotes('');
        setMedicationPriority('routine');
        
        // Reload orders
        loadPatientOrders();
      } else {
        throw new Error('Failed to create medication order');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create medication order',
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateImagingOrder = async () => {
    const imagingType = IMAGING_TYPES.find(i => i.code === selectedImagingType);
    const bodyPart = BODY_PARTS.find(b => b.code === selectedBodyPart);
    
    if (!imagingType) {
      notifications.show({
        title: 'Error',
        message: 'Please select an imaging type',
        color: 'red',
        icon: <IconX />
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/orders/imaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await medplum.getAccessToken()}`
        },
        body: JSON.stringify({
          patientId: patient.id,
          encounterId,
          imagingType,
          bodyPart,
          indication: imagingIndication,
          priority: imagingPriority,
          notes: imagingNotes
        })
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Imaging order created successfully',
          color: 'green',
          icon: <IconCheck />
        });
        
        // Reset form
        setSelectedImagingType('');
        setSelectedBodyPart('');
        setImagingIndication('');
        setImagingNotes('');
        setImagingPriority('routine');
        
        // Reload orders
        loadPatientOrders();
      } else {
        throw new Error('Failed to create imaging order');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create imaging order',
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTestSelection = (test: LabTest) => {
    setSelectedTests(prev => {
      const exists = prev.find(t => t.code === test.code);
      if (exists) {
        return prev.filter(t => t.code !== test.code);
      } else {
        return [...prev, test];
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'stat': return 'red';
      case 'asap': return 'orange';
      case 'urgent': return 'yellow';
      default: return 'blue';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'stat':
      case 'asap':
      case 'urgent':
        return <IconUrgent size={16} />;
      default:
        return <IconClock size={16} />;
    }
  };

  const filteredLabTests = COMMON_LAB_TESTS.filter(test =>
    test.display.toLowerCase().includes(labTestSearch.toLowerCase())
  );

  const filteredMedications = COMMON_MEDICATIONS.filter(med =>
    med.display.toLowerCase().includes(medicationSearch.toLowerCase())
  );

  return (
    <Stack spacing="md">
      <LoadingOverlay visible={loading} />
      
      <Group position="apart">
        <Title order={2}>Order Management</Title>
        <Group>
          <Text size="sm" color="dimmed">
            Patient: {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
          </Text>
        </Group>
      </Group>

      <Tabs value={activeTab} onTabChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="lab" icon={<IconFlask size={16} />}>
            Laboratory
          </Tabs.Tab>
          <Tabs.Tab value="medication" icon={<IconPill size={16} />}>
            Medications
          </Tabs.Tab>
          <Tabs.Tab value="imaging" icon={<IconScan size={16} />}>
            Imaging
          </Tabs.Tab>
          <Tabs.Tab value="history">
            Order History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="lab" pt="xs">
          <Card>
            <Stack spacing="md">
              <Title order={4}>Create Laboratory Order</Title>
              
              <TextInput
                placeholder="Search lab tests..."
                icon={<IconSearch size={16} />}
                value={labTestSearch}
                onChange={(e) => setLabTestSearch(e.currentTarget.value)}
              />

              <ScrollArea h={200} offsetScrollbars>
                <Stack spacing="xs">
                  {filteredLabTests.map(test => (
                    <Group key={test.code} position="apart">
                      <Text size="sm">{test.display}</Text>
                      <Button
                        size="xs"
                        variant={selectedTests.find(t => t.code === test.code) ? 'filled' : 'light'}
                        onClick={() => toggleTestSelection(test)}
                      >
                        {selectedTests.find(t => t.code === test.code) ? 'Selected' : 'Select'}
                      </Button>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea>

              {selectedTests.length > 0 && (
                <Card withBorder>
                  <Stack spacing="xs">
                    <Text size="sm" weight={500}>Selected Tests:</Text>
                    <Group spacing="xs">
                      {selectedTests.map(test => (
                        <Badge
                          key={test.code}
                          rightSection={
                            <ActionIcon size="xs" onClick={() => toggleTestSelection(test)}>
                              <IconX size={12} />
                            </ActionIcon>
                          }
                        >
                          {test.display}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </Card>
              )}

              <Select
                label="Priority"
                value={labPriority}
                onChange={(value) => setLabPriority(value || 'routine')}
                data={PRIORITY_OPTIONS}
              />

              <Textarea
                label="Notes"
                placeholder="Additional instructions or clinical context..."
                value={labNotes}
                onChange={(e) => setLabNotes(e.currentTarget.value)}
                minRows={2}
              />

              <Button
                leftIcon={<IconPlus size={16} />}
                onClick={handleCreateLabOrder}
                disabled={selectedTests.length === 0}
              >
                Create Lab Order
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="medication" pt="xs">
          <Card>
            <Stack spacing="md">
              <Title order={4}>Create Medication Order</Title>
              
              <TextInput
                placeholder="Search medications..."
                icon={<IconSearch size={16} />}
                value={medicationSearch}
                onChange={(e) => setMedicationSearch(e.currentTarget.value)}
              />

              <Select
                label="Medication"
                placeholder="Select medication"
                value={selectedMedication}
                onChange={(value) => setSelectedMedication(value || '')}
                data={filteredMedications.map(med => ({
                  value: med.code,
                  label: med.display
                }))}
                searchable
              />

              <Textarea
                label="Dosage Instructions"
                placeholder="e.g., Take 1 tablet by mouth twice daily with food"
                value={dosageInstructions}
                onChange={(e) => setDosageInstructions(e.currentTarget.value)}
                required
              />

              <Group grow>
                <TextInput
                  label="Quantity"
                  placeholder="e.g., 30"
                  value={medicationQuantity}
                  onChange={(e) => setMedicationQuantity(e.currentTarget.value)}
                />
                <TextInput
                  label="Refills"
                  placeholder="0"
                  value={medicationRefills}
                  onChange={(e) => setMedicationRefills(e.currentTarget.value)}
                />
              </Group>

              <Select
                label="Priority"
                value={medicationPriority}
                onChange={(value) => setMedicationPriority(value || 'routine')}
                data={PRIORITY_OPTIONS}
              />

              <Textarea
                label="Notes"
                placeholder="Additional instructions or precautions..."
                value={medicationNotes}
                onChange={(e) => setMedicationNotes(e.currentTarget.value)}
                minRows={2}
              />

              <Button
                leftIcon={<IconPlus size={16} />}
                onClick={handleCreateMedicationOrder}
                disabled={!selectedMedication || !dosageInstructions}
              >
                Create Medication Order
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="imaging" pt="xs">
          <Card>
            <Stack spacing="md">
              <Title order={4}>Create Imaging Order</Title>
              
              <Select
                label="Imaging Type"
                placeholder="Select imaging type"
                value={selectedImagingType}
                onChange={(value) => setSelectedImagingType(value || '')}
                data={IMAGING_TYPES.map(type => ({
                  value: type.code,
                  label: type.display
                }))}
                searchable
                required
              />

              <Select
                label="Body Part (Optional)"
                placeholder="Select body part"
                value={selectedBodyPart}
                onChange={(value) => setSelectedBodyPart(value || '')}
                data={BODY_PARTS.map(part => ({
                  value: part.code,
                  label: part.display
                }))}
                searchable
              />

              <Textarea
                label="Clinical Indication"
                placeholder="Reason for imaging..."
                value={imagingIndication}
                onChange={(e) => setImagingIndication(e.currentTarget.value)}
              />

              <Select
                label="Priority"
                value={imagingPriority}
                onChange={(value) => setImagingPriority(value || 'routine')}
                data={PRIORITY_OPTIONS}
              />

              <Textarea
                label="Notes"
                placeholder="Special instructions or precautions..."
                value={imagingNotes}
                onChange={(e) => setImagingNotes(e.currentTarget.value)}
                minRows={2}
              />

              <Button
                leftIcon={<IconPlus size={16} />}
                onClick={handleCreateImagingOrder}
                disabled={!selectedImagingType}
              >
                Create Imaging Order
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="xs">
          <Card>
            <Stack spacing="md">
              <Title order={4}>Order History</Title>
              
              {orders.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} color="gray">
                  No orders found for this patient
                </Alert>
              ) : (
                <ScrollArea>
                  <Table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => (
                        <tr key={order.id || index}>
                          <td>
                            <Badge size="sm" variant="dot">
                              {order.orderType}
                            </Badge>
                          </td>
                          <td>
                            <Text size="sm">
                              {order.orderType === 'medication'
                                ? order.medicationCodeableConcept?.coding?.[0]?.display
                                : order.code?.coding?.[0]?.display || 'Unknown'}
                            </Text>
                          </td>
                          <td>
                            <Badge
                              size="sm"
                              color={getPriorityColor(order.priority)}
                              leftSection={getPriorityIcon(order.priority)}
                            >
                              {order.priority}
                            </Badge>
                          </td>
                          <td>
                            <Badge size="sm" variant="outline">
                              {order.status}
                            </Badge>
                          </td>
                          <td>
                            <Text size="xs" color="dimmed">
                              {formatDateTime(order.authoredOn)}
                            </Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}