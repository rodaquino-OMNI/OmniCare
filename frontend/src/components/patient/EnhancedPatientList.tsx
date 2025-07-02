'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Text,
  Stack,
  Group,
  Button,
  Badge,
  Avatar,
  Skeleton,
  Center,
  SimpleGrid,
  Box,
  Divider,
  ActionIcon,
  Tooltip,
  ScrollArea,
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconCalendar,
  IconEye,
  IconCalendarPlus,
  IconMessage,
  IconEdit,
  IconMapPin,
  IconStethoscope,
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useMedplum } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import SimplePatientSearchFilters, { PatientFilters } from './SimplePatientSearchFilters';

interface EnhancedPatientListProps {
  initialPatients?: Patient[];
  isLoading?: boolean;
  onPatientSelect?: (patient: Patient) => void;
  onScheduleAppointment?: (patient: Patient) => void;
  onSendMessage?: (patient: Patient) => void;
}

export const EnhancedPatientList: React.FC<EnhancedPatientListProps> = ({
  initialPatients = [],
  isLoading = false,
  onPatientSelect,
  onScheduleAppointment,
  onSendMessage,
}) => {
  const medplum = useMedplum();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>(initialPatients);
  const [filters, setFilters] = useState<PatientFilters>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loading, setLoading] = useState(isLoading);
  const [error, setError] = useState<string | null>(null);

  // Load patients from FHIR API
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const searchParams: any = {
        _sort: '-_lastUpdated',
        _count: 50,
      };

      // Apply filters to search params
      if (filters.status) {
        searchParams.active = filters.status === 'active';
      }
      if (filters.gender) {
        searchParams.gender = filters.gender;
      }
      if (filters.searchQuery) {
        searchParams.name = filters.searchQuery;
      }

      const bundle = await medplum.searchResources('Patient', searchParams);
      const patientsData = bundle.entry?.map(entry => entry.resource as Patient) || [];
      
      setPatients(patientsData);
      setFilteredPatients(patientsData);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setError('Failed to load patients. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [medplum, filters]);

  // Apply client-side filtering for advanced filters
  useEffect(() => {
    let filtered = [...patients];

    // Apply age range filter
    if (filters.ageRange) {
      filtered = filtered.filter(patient => {
        const age = getPatientAge(patient);
        switch (filters.ageRange) {
          case '0-17':
            return age >= 0 && age <= 17;
          case '18-64':
            return age >= 18 && age <= 64;
          case '65+':
            return age >= 65;
          default:
            return true;
        }
      });
    }

    // Apply practitioner filter
    if (filters.practitioner) {
      // This would require additional API calls to get care team information
      // For now, we'll keep all patients
    }

    setFilteredPatients(filtered);
  }, [patients, filters]);

  // Load patients on mount and filter changes
  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleFiltersChange = useCallback((newFilters: PatientFilters) => {
    setFilters(newFilters);
  }, []);

  const handlePatientAction = useCallback((patient: Patient, action: string) => {
    switch (action) {
      case 'view':
        onPatientSelect?.(patient);
        break;
      case 'schedule':
        onScheduleAppointment?.(patient);
        break;
      case 'message':
        onSendMessage?.(patient);
        break;
      default:
        break;
    }
  }, [onPatientSelect, onScheduleAppointment, onSendMessage]);

  // Helper functions for patient data
  const getPatientName = (patient: Patient): string => {
    const name = patient.name?.[0];
    if (!name) return 'Unknown Patient';
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
  };

  const getPatientAge = (patient: Patient): number => {
    if (!patient.birthDate) return 0;
    const birthDate = new Date(patient.birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const getPatientMRN = (patient: Patient): string => {
    const mrn = patient.identifier?.find(id => id.system === 'MRN');
    return mrn?.value || 'N/A';
  };

  const getPatientContact = (patient: Patient) => {
    const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
    const email = patient.telecom?.find(t => t.system === 'email')?.value;
    return { phone, email };
  };

  const getPatientAddress = (patient: Patient): string => {
    const address = patient.address?.[0];
    if (!address) return 'No address';
    return `${address.city || ''}, ${address.state || ''}`.trim().replace(/^,\s*/, '');
  };

  // Render patient card
  const renderPatientCard = (patient: Patient) => {
    const contact = getPatientContact(patient);
    const age = getPatientAge(patient);
    const mrn = getPatientMRN(patient);
    const address = getPatientAddress(patient);

    return (
      <Card
        key={patient.id}
        shadow="sm"
        padding={isMobile ? 'sm' : 'md'}
        radius="md"
        withBorder
        style={{
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: 'pointer',
        }}
        className="hover:shadow-lg hover:transform hover:scale-[1.02]"
      >
        <Group gap="sm" wrap="nowrap">
          {/* Avatar */}
          <Avatar
            size={isMobile ? 'md' : 'lg'}
            radius="xl"
            color="blue"
          >
            <IconUser size={isMobile ? 20 : 24} />
          </Avatar>

          {/* Patient Info */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={600} size={isMobile ? 'sm' : 'md'} truncate>
                  {getPatientName(patient)}
                </Text>
                <Text size="xs" c="dimmed">
                  MRN: {mrn} • {patient.gender} • {age} years
                </Text>
              </div>
              <Badge
                color={patient.active ? 'green' : 'gray'}
                variant="light"
                size="sm"
              >
                {patient.active ? 'Active' : 'Inactive'}
              </Badge>
            </Group>

            {/* Contact Information */}
            <Stack gap={4}>
              {contact.phone && (
                <Group gap="xs">
                  <IconPhone size={14} color="gray" />
                  <Text size="xs" c="dimmed">{contact.phone}</Text>
                </Group>
              )}
              {contact.email && (
                <Group gap="xs">
                  <IconMail size={14} color="gray" />
                  <Text size="xs" c="dimmed" truncate>{contact.email}</Text>
                </Group>
              )}
              {address !== 'No address' && (
                <Group gap="xs">
                  <IconMapPin size={14} color="gray" />
                  <Text size="xs" c="dimmed" truncate>{address}</Text>
                </Group>
              )}
            </Stack>

            {/* Quick Actions */}
            <Group mt="md" gap="xs" wrap="wrap">
              {isMobile ? (
                // Mobile: Icon buttons
                <>
                  <Tooltip label="View Patient">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => handlePatientAction(patient, 'view')}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Schedule Appointment">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      size="sm"
                      onClick={() => handlePatientAction(patient, 'schedule')}
                    >
                      <IconCalendarPlus size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Send Message">
                    <ActionIcon
                      variant="light"
                      color="green"
                      size="sm"
                      onClick={() => handlePatientAction(patient, 'message')}
                    >
                      <IconMessage size={16} />
                    </ActionIcon>
                  </Tooltip>
                </>
              ) : (
                // Desktop: Text buttons
                <>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconEye size={14} />}
                    onClick={() => handlePatientAction(patient, 'view')}
                  >
                    View
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    leftSection={<IconCalendarPlus size={14} />}
                    onClick={() => handlePatientAction(patient, 'schedule')}
                  >
                    Schedule
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="green"
                    leftSection={<IconMessage size={14} />}
                    onClick={() => handlePatientAction(patient, 'message')}
                  >
                    Message
                  </Button>
                </>
              )}
            </Group>
          </Box>
        </Group>
      </Card>
    );
  };

  // Render loading skeletons
  const renderLoadingSkeletons = () => (
    <div data-testid="loading-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} shadow="sm" padding="md" radius="md" withBorder>
          <Group gap="sm">
            <Skeleton height={60} circle />
            <Box style={{ flex: 1 }}>
              <Skeleton height={16} width="60%" mb="xs" />
              <Skeleton height={12} width="40%" mb="sm" />
              <Skeleton height={12} width="80%" mb="xs" />
              <Skeleton height={12} width="70%" />
            </Box>
          </Group>
        </Card>
      ))}
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <Center py="xl">
      <Stack align="center" gap="md">
        <IconUser size={48} color="gray" />
        <Text size="lg" c="dimmed">No patients found</Text>
        <Text size="sm" c="dimmed" ta="center">
          {filters.searchQuery
            ? `No patients match your search criteria`
            : 'Start by adding your first patient to the system'}
        </Text>
        <Button leftSection={<IconUser size={16} />}>
          Add New Patient
        </Button>
      </Stack>
    </Center>
  );

  return (
    <Box data-testid="patient-list-container" className="responsive-layout">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" mb="md">
          <div>
            <Text size="xl" fw={700}>
              Patient Management
            </Text>
            <Text size="sm" c="dimmed">
              {filteredPatients.length} patients
            </Text>
          </div>
          <Button
            leftSection={<IconUser size={16} />}
            size={isMobile ? 'sm' : 'md'}
          >
            New Patient
          </Button>
        </Group>

        {/* Search and Filters */}
        <SimplePatientSearchFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          showAdvanced={showAdvancedFilters}
          onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
          isLoading={loading}
        />

        <Divider />

        {/* Patient List */}
        <ScrollArea style={{ height: isMobile ? 'calc(100vh - 300px)' : 'calc(100vh - 250px)' }}>
          {error ? (
            <Center py="xl">
              <Text c="red">{error}</Text>
            </Center>
          ) : loading ? (
            renderLoadingSkeletons()
          ) : filteredPatients.length === 0 ? (
            renderEmptyState()
          ) : (
            <SimpleGrid
              cols={{ base: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
              spacing="md"
            >
              {filteredPatients.map(renderPatientCard)}
            </SimpleGrid>
          )}
        </ScrollArea>
      </Stack>
    </Box>
  );
};

export default EnhancedPatientList;