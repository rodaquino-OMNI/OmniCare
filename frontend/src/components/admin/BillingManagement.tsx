'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Grid,
  Text,
  Group,
  Button,
  TextInput,
  Select,
  Stack,
  Badge,
  Modal,
  LoadingOverlay,
  Table,
  ActionIcon,
  Paper
} from '@mantine/core';
import { 
  IconCurrencyDollar, 
  IconFileText, 
  IconCheck,
  IconX,
  IconEye,
  IconSearch,
  IconDownload,
  IconPlus
} from '@tabler/icons-react';
import { Billing, Patient, Provider } from '@/types/administrative';

interface BillingManagementProps {
  userRole: string;
  facilityId: string;
}

interface ClaimSummary {
  totalClaims: number;
  pendingClaims: number;
  paidClaims: number;
  deniedClaims: number;
  totalRevenue: number;
  collectionsRate: number;
  averageDaysInAR: number;
}

const BillingManagement: React.FC<BillingManagementProps> = ({ userRole, facilityId }) => {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBilling, setSelectedBilling] = useState<Billing | null>(null);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [claimSummary, setClaimSummary] = useState<ClaimSummary | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, [facilityId, filterStatus, filterProvider]);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API calls
      const mockProviders: Provider[] = [
        {
          id: 'PROV-001',
          firstName: 'Sarah',
          lastName: 'Johnson',
          title: 'MD',
          specialty: 'Internal Medicine',
          npi: '1234567890',
          licenseNumber: 'MD123456',
          email: 'sarah.johnson@omnicare.com',
          phone: '(555) 123-4567',
          schedule: [],
          isActive: true,
          facilityIds: [facilityId]
        }
      ];

      const mockPatients: Patient[] = [
        {
          id: 'PAT-001',
          firstName: 'John',
          lastName: 'Smith',
          dateOfBirth: new Date('1980-05-15'),
          gender: 'M',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'USA',
            addressType: 'Home'
          },
          phone: [{ number: '(555) 111-2222', type: 'Home', isPrimary: true }],
          emergencyContact: { name: 'Jane Smith', relationship: 'Spouse', phone: '(555) 111-3333' },
          insurance: [],
          maritalStatus: 'Married',
          employmentStatus: 'Employed',
          preferredLanguage: 'English',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'Active'
        }
      ];

      const mockBillings: Billing[] = [
        {
          id: 'BILL-001',
          patientId: 'PAT-001',
          appointmentId: 'APT-001',
          providerId: 'PROV-001',
          facilityId: facilityId,
          encounterDate: new Date('2024-01-15'),
          diagnosisCodes: [
            { code: 'I10', description: 'Essential hypertension', isPrimary: true },
            { code: 'Z79.4', description: 'Long term use of insulin', isPrimary: false }
          ],
          procedureCodes: [
            { code: '99214', description: 'Office visit, established patient, moderate complexity', modifier: '', units: 1, amount: 225.00 },
            { code: '93000', description: 'Electrocardiogram, routine ECG with 12 leads', modifier: '', units: 1, amount: 85.00 }
          ],
          charges: [
            { id: 'CHG-001', procedureCode: '99214', amount: 225.00, units: 1, dateOfService: new Date('2024-01-15') },
            { id: 'CHG-002', procedureCode: '93000', amount: 85.00, units: 1, dateOfService: new Date('2024-01-15') }
          ],
          totalAmount: 310.00,
          insuranceAmount: 285.00,
          patientAmount: 25.00,
          status: 'Submitted',
          claimId: 'CLM-001',
          claimSubmissionDate: new Date('2024-01-16'),
          adjustments: [],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-16')
        },
        {
          id: 'BILL-002',
          patientId: 'PAT-001',
          providerId: 'PROV-001',
          facilityId: facilityId,
          encounterDate: new Date('2024-01-10'),
          diagnosisCodes: [
            { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', isPrimary: true }
          ],
          procedureCodes: [
            { code: '99395', description: 'Periodic comprehensive preventive medicine reevaluation, established patient, 18-39 years', modifier: '', units: 1, amount: 280.00 }
          ],
          charges: [
            { id: 'CHG-003', procedureCode: '99395', amount: 280.00, units: 1, dateOfService: new Date('2024-01-10') }
          ],
          totalAmount: 280.00,
          insuranceAmount: 280.00,
          patientAmount: 0.00,
          status: 'Paid',
          claimId: 'CLM-002',
          claimSubmissionDate: new Date('2024-01-11'),
          paymentDate: new Date('2024-01-25'),
          paymentAmount: 280.00,
          adjustments: [
            { id: 'ADJ-001', type: 'Insurance Payment', amount: 280.00, date: new Date('2024-01-25'), reason: 'Primary insurance payment', userId: 'USER-001' }
          ],
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-25')
        }
      ];

      const summary: ClaimSummary = {
        totalClaims: mockBillings.length,
        pendingClaims: mockBillings.filter(b => ['Ready to Bill', 'Submitted'].includes(b.status)).length,
        paidClaims: mockBillings.filter(b => b.status === 'Paid').length,
        deniedClaims: mockBillings.filter(b => b.status === 'Denied').length,
        totalRevenue: mockBillings.reduce((sum, b) => sum + (b.paymentAmount || 0), 0),
        collectionsRate: 85.2,
        averageDaysInAR: 32
      };

      setProviders(mockProviders);
      setPatients(mockPatients);
      setBillings(mockBillings);
      setClaimSummary(summary);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
  };

  const getProviderName = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    return provider ? `Dr. ${provider.firstName} ${provider.lastName}` : 'Unknown Provider';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'gray';
      case 'Ready to Bill': return 'blue';
      case 'Submitted': return 'yellow';
      case 'Paid': return 'green';
      case 'Partial Payment': return 'yellow';
      case 'Denied': return 'red';
      case 'Appeal Submitted': return 'violet';
      case 'Written Off': return 'gray';
      default: return 'gray';
    }
  };

  const filteredBillings = billings.filter(billing => {
    if (filterStatus !== 'all' && billing.status !== filterStatus) return false;
    if (filterProvider !== 'all' && billing.providerId !== filterProvider) return false;
    if (searchTerm) {
      const patientName = getPatientName(billing.patientId).toLowerCase();
      const providerName = getProviderName(billing.providerId).toLowerCase();
      const claimId = billing.claimId?.toLowerCase() || '';
      const searchLower = searchTerm.toLowerCase();
      return patientName.includes(searchLower) || 
             providerName.includes(searchLower) ||
             claimId.includes(searchLower);
    }
    return true;
  });

  const handleStatusUpdate = async (billingId: string, newStatus: string) => {
    try {
      setBillings(prev => 
        prev.map(bill => 
          bill.id === billingId 
            ? { ...bill, status: newStatus as any, updatedAt: new Date() }
            : bill
        )
      );
      
      if (selectedBilling?.id === billingId) {
        setSelectedBilling(prev => 
          prev ? { ...prev, status: newStatus as any } : null
        );
      }
    } catch (error) {
      console.error('Failed to update billing status:', error);
    }
  };

  const exportReport = (format: 'CSV' | 'PDF' | 'Excel') => {
    // Mock export functionality
    console.log(`Exporting billing report as ${format}`);
    alert(`Billing report exported as ${format}`);
  };

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: 400 }}>
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  const rows = filteredBillings.map((billing) => (
    <Table.Tr key={billing.id}>
      <Table.Td>{billing.claimId || billing.id}</Table.Td>
      <Table.Td>{getPatientName(billing.patientId)}</Table.Td>
      <Table.Td>{getProviderName(billing.providerId)}</Table.Td>
      <Table.Td>{billing.encounterDate.toLocaleDateString()}</Table.Td>
      <Table.Td>${billing.totalAmount.toFixed(2)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Badge color={getStatusColor(billing.status)} size="sm">
            {billing.status}
          </Badge>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            onClick={() => setSelectedBilling(billing)}
          >
            <IconEye size={16} />
          </ActionIcon>
          {billing.status === 'Draft' && (
            <ActionIcon
              color="green"
              variant="light"
              onClick={() => handleStatusUpdate(billing.id, 'Ready to Bill')}
            >
              <IconCheck size={16} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="xl">
      {/* Header */}
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>Billing & Revenue Cycle Management</Text>
            <Text c="dimmed">Process claims and manage revenue cycle operations</Text>
          </div>
          <Group gap="sm">
            <Select
              placeholder="Export Report"
              data={[
                { value: 'CSV', label: 'Export as CSV' },
                { value: 'Excel', label: 'Export as Excel' },
                { value: 'PDF', label: 'Export as PDF' }
              ]}
              onChange={(value) => value && exportReport(value as any)}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setShowNewClaimModal(true)}
            >
              New Claim
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Revenue Cycle Metrics */}
      {claimSummary && (
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group gap="sm">
                <IconFileText size={20} className="text-gray-400" />
                <div>
                  <Text size="sm" c="dimmed">Total Claims</Text>
                  <Text size="lg" fw={700}>{claimSummary.totalClaims}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group gap="sm">
                <IconFileText size={20} className="text-yellow-400" />
                <div>
                  <Text size="sm" c="dimmed">Pending Claims</Text>
                  <Text size="lg" fw={700}>{claimSummary.pendingClaims}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group gap="sm">
                <IconCurrencyDollar size={20} className="text-green-400" />
                <div>
                  <Text size="sm" c="dimmed">Total Revenue</Text>
                  <Text size="lg" fw={700}>${claimSummary.totalRevenue.toLocaleString()}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group gap="sm">
                <IconCheck size={20} className="text-blue-400" />
                <div>
                  <Text size="sm" c="dimmed">Collections Rate</Text>
                  <Text size="lg" fw={700}>{claimSummary.collectionsRate}%</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Filters and Search */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              placeholder="Search by patient, provider, or claim ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              placeholder="All Statuses"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || 'all')}
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Draft', label: 'Draft' },
                { value: 'Ready to Bill', label: 'Ready to Bill' },
                { value: 'Submitted', label: 'Submitted' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Partial Payment', label: 'Partial Payment' },
                { value: 'Denied', label: 'Denied' },
                { value: 'Appeal Submitted', label: 'Appeal Submitted' },
                { value: 'Written Off', label: 'Written Off' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              placeholder="All Providers"
              value={filterProvider}
              onChange={(value) => setFilterProvider(value || 'all')}
              data={[
                { value: 'all', label: 'All Providers' },
                ...providers.map(provider => ({
                  value: provider.id,
                  label: `Dr. ${provider.firstName} ${provider.lastName}`
                }))
              ]}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Claims Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text size="lg" fw={600} mb="md">
          Claims Management
        </Text>
        
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Claim ID</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Encounter Date</Table.Th>
              <Table.Th>Total Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
        
        {filteredBillings.length === 0 && (
          <div className="text-center py-12">
            <IconFileText size={48} className="mx-auto text-gray-400 mb-4" />
            <Text size="md" fw={500} c="dimmed">No claims found</Text>
            <Text size="sm" c="dimmed">
              Get started by creating a new claim or adjusting your filters.
            </Text>
          </div>
        )}
      </Card>

      {/* Claim Details Modal */}
      <Modal
        opened={!!selectedBilling}
        onClose={() => setSelectedBilling(null)}
        title="Claim Details"
        size="xl"
      >
        {selectedBilling && (
          <Stack gap="md">
            {/* Basic Information */}
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Claim ID</Text>
                <Text fw={500}>{selectedBilling.claimId || selectedBilling.id}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Status</Text>
                <Badge color={getStatusColor(selectedBilling.status)}>
                  {selectedBilling.status}
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Patient</Text>
                <Text fw={500}>{getPatientName(selectedBilling.patientId)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Provider</Text>
                <Text fw={500}>{getProviderName(selectedBilling.providerId)}</Text>
              </Grid.Col>
            </Grid>

            {/* Financial Summary */}
            <Paper p="md" bg="gray.1" radius="md">
              <Text size="md" fw={600} mb="sm">Financial Summary</Text>
              <Grid>
                <Grid.Col span={4}>
                  <Text size="sm" c="dimmed">Total Charges</Text>
                  <Text size="lg" fw={700}>${selectedBilling.totalAmount.toFixed(2)}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="sm" c="dimmed">Insurance Amount</Text>
                  <Text size="lg" fw={700}>${selectedBilling.insuranceAmount.toFixed(2)}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="sm" c="dimmed">Patient Responsibility</Text>
                  <Text size="lg" fw={700}>${selectedBilling.patientAmount.toFixed(2)}</Text>
                </Grid.Col>
              </Grid>
              {selectedBilling.paymentAmount && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #dee2e6' }}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Amount Paid</Text>
                    <Text size="sm" fw={600} c="green.6">${selectedBilling.paymentAmount.toFixed(2)}</Text>
                  </Group>
                  {selectedBilling.paymentDate && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Payment Date</Text>
                      <Text size="sm">{selectedBilling.paymentDate.toLocaleDateString()}</Text>
                    </Group>
                  )}
                </div>
              )}
            </Paper>

            {/* Actions */}
            <div>
              <Text size="sm" c="dimmed" mb="sm">Actions</Text>
              <Group gap="sm">
                {selectedBilling.status === 'Draft' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedBilling.id, 'Ready to Bill')}
                  >
                    Submit Claim
                  </Button>
                )}
                {selectedBilling.status === 'Denied' && (
                  <Button
                    color="violet"
                    onClick={() => handleStatusUpdate(selectedBilling.id, 'Appeal Submitted')}
                  >
                    Submit Appeal
                  </Button>
                )}
                <Button variant="light">
                  Print Claim
                </Button>
                <Button variant="light">
                  Edit Claim
                </Button>
              </Group>
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default BillingManagement;