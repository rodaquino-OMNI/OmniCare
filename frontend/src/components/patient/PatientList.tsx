'use client';

import { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { Patient, SearchParameter } from '@medplum/fhirtypes';
import { ResourceTable, SearchControl, useMedplum } from '@medplum/react';
import { Card, Title, Box, Group, Button, Text, Badge, Stack, Avatar, Skeleton } from '@mantine/core';
import { IconPlus, IconSearch, IconUser } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { patientHelpers } from '@/lib/medplum';

// Define columns for the patient table
const patientColumns = [
  {
    name: 'MRN',
    selector: (patient: Patient) => patientHelpers.getMRN(patient),
    sortable: true,
  },
  {
    name: 'Name',
    selector: (patient: Patient) => patientHelpers.getFullName(patient),
    sortable: true,
  },
  {
    name: 'DOB',
    selector: (patient: Patient) => patient.birthDate || 'Unknown',
    sortable: true,
  },
  {
    name: 'Age',
    selector: (patient: Patient) => `${patientHelpers.getAge(patient)} years`,
  },
  {
    name: 'Gender',
    selector: (patient: Patient) => patient.gender || 'Unknown',
  },
  {
    name: 'Phone',
    selector: (patient: Patient) => {
      const contact = patientHelpers.getContactInfo(patient);
      return contact.phone || 'No phone';
    },
  },
  {
    name: 'Status',
    selector: (patient: Patient) => (
      <Badge color={patient.active ? 'green' : 'gray'} variant="light">
        {patient.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

export const PatientList = memo(() => {
  const medplum = useMedplum();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handlePatientClick = useCallback(
    (patient: Patient) => {
      if (patient.id) {
        router.push(`/dashboard/patients/${patient.id}`);
      }
    },
    [router]
  );

  const handleNewPatient = useCallback(() => {
    router.push('/dashboard/patients/new');
  }, [router]);

  // Memoized search parameters for patient search
  const searchParams = useMemo<SearchParameter[]>(() => [
    {
      resourceType: 'SearchParameter',
      name: 'name',
      code: 'name',
      base: ['Patient'],
      type: 'string',
      description: 'Search by patient name',
    },
    {
      resourceType: 'SearchParameter',
      name: 'identifier',
      code: 'identifier',
      base: ['Patient'],
      type: 'token',
      description: 'Search by MRN or other identifier',
    },
    {
      resourceType: 'SearchParameter',
      name: 'birthdate',
      code: 'birthdate',
      base: ['Patient'],
      type: 'date',
      description: 'Search by birth date',
    },
    {
      resourceType: 'SearchParameter',
      name: 'phone',
      code: 'phone',
      base: ['Patient'],
      type: 'token',
      description: 'Search by phone number',
    },
    {
      resourceType: 'SearchParameter',
      name: 'email',
      code: 'email',
      base: ['Patient'],
      type: 'token',
      description: 'Search by email address',
    },
  ], []);

  return (
    <Stack gap="md">
      <Card>
        <Group justify="space-between" mb="md">
          <Title order={2}>
            <Group gap="xs">
              <IconUser size={24} />
              Patient Management
            </Group>
          </Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleNewPatient}
            variant="filled"
          >
            New Patient
          </Button>
        </Group>

        <Box mb="md">
          <SearchControl
            resourceType="Patient"
            searchParams={searchParams}
            onChange={(search) => setSearchQuery(search)}
            placeholder="Search patients by name, MRN, DOB, phone..."
          />
        </Box>

        <ResourceTable
          resourceType="Patient"
          columns={patientColumns}
          onRowClick={handlePatientClick}
          searchParams={{
            _sort: '-_lastUpdated',
            _count: 20,
            ...(searchQuery && { _query: searchQuery }),
          }}
          emptyMessage={
            <Stack align="center" gap="xs" py="xl">
              <IconSearch size={48} style={{ opacity: 0.5 }} />
              <Text c="dimmed">No patients found</Text>
              <Text size="sm" c="dimmed">
                Try adjusting your search criteria or add a new patient
              </Text>
            </Stack>
          }
        />
      </Card>
    </Stack>
  );
});

PatientList.displayName = 'PatientList';

// Optimized dashboard variant with memoization and performance tracking
export const PatientListDashboard = memo(() => {
  const router = useRouter();
  const medplum = useMedplum();
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadTime, setLoadTime] = useState(0);

  const handlePatientClick = useCallback(
    (patient: Patient) => {
      if (patient.id) {
        router.push(`/dashboard/patients/${patient.id}`);
      }
    },
    [router]
  );

  const handleViewAll = useCallback(() => {
    router.push('/dashboard/patients');
  }, [router]);

  // Load recent patients with performance tracking
  useEffect(() => {
    let isMounted = true;
    
    const loadRecentPatients = async () => {
      const startTime = Date.now();
      try {
        const patients = await medplum.searchResources('Patient', {
          _sort: '-_lastUpdated',
          _count: '5',
        });
        
        if (isMounted) {
          setRecentPatients(patients);
          setLoadTime(Date.now() - startTime);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading recent patients:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRecentPatients();
    
    return () => {
      isMounted = false;
    };
  }, [medplum]);

  // Memoized patient rows for optimal performance
  const memoizedPatientRows = useMemo(() => {
    return recentPatients.map((patient) => {
      const name = patientHelpers.getFullName(patient);
      const mrn = patientHelpers.getMRN(patient);
      const age = patientHelpers.getAge(patient);
      
      return (
        <Group
          key={patient.id}
          justify="space-between"
          p="sm"
          style={{ 
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'background-color 0.1s ease'
          }}
          className="hover:bg-gray-50"
          onClick={() => handlePatientClick(patient)}
        >
          <Group gap="sm">
            <Avatar size="sm" color="blue">
              <IconUser size={16} />
            </Avatar>
            <div>
              <Text size="sm" fw={500}>{name}</Text>
              <Text size="xs" c="dimmed">
                MRN: {mrn} • {age} years
              </Text>
            </div>
          </Group>
          <Badge
            color={patient.active ? 'green' : 'gray'}
            variant="light"
            size="xs"
          >
            {patient.active ? 'Active' : 'Inactive'}
          </Badge>
        </Group>
      );
    });
  }, [recentPatients, handlePatientClick]);

  return (
    <Card>
      <Group justify="space-between" mb="md">
        <Title order={3}>Recent Patients</Title>
        <Group gap="xs">
          {loadTime > 0 && (
            <Text size="xs" c="dimmed">
              {loadTime}ms
            </Text>
          )}
          <Button
            variant="subtle"
            size="xs"
            onClick={handleViewAll}
          >
            View All
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Stack gap="xs">
          {Array.from({ length: 5 }).map((_, index) => (
            <Group key={index} gap="sm">
              <Skeleton height={32} circle />
              <Box style={{ flex: 1 }}>
                <Skeleton height={14} width="60%" mb={4} />
                <Skeleton height={12} width="40%" />
              </Box>
            </Group>
          ))}
        </Stack>
      ) : recentPatients.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No recent patients
        </Text>
      ) : (
        <Stack gap={4}>
          {memoizedPatientRows}
        </Stack>
      )}
    </Card>
  );
});

PatientListDashboard.displayName = 'PatientListDashboard';

export default PatientList;