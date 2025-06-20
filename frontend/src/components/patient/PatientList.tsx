'use client';

import { useState, useCallback } from 'react';
import { Patient, SearchParameter } from '@medplum/fhirtypes';
import { ResourceTable, SearchControl, useMedplum } from '@medplum/react';
import { Card, Title, Box, Group, Button, Text, Badge, Stack } from '@mantine/core';
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

export function PatientList() {
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

  // Define search parameters for patient search
  const searchParams: SearchParameter[] = [
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
  ];

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
}

// Export a variant for dashboard use with limited rows
export function PatientListDashboard() {
  const router = useRouter();

  const handlePatientClick = useCallback(
    (patient: Patient) => {
      if (patient.id) {
        router.push(`/dashboard/patients/${patient.id}`);
      }
    },
    [router]
  );

  return (
    <Card>
      <Group justify="space-between" mb="md">
        <Title order={3}>Recent Patients</Title>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => router.push('/dashboard/patients')}
        >
          View All
        </Button>
      </Group>

      <ResourceTable
        resourceType="Patient"
        columns={patientColumns.slice(0, 5)} // Show fewer columns for dashboard
        onRowClick={handlePatientClick}
        searchParams={{
          _sort: '-_lastUpdated',
          _count: 5,
        }}
        hideSearch
        hidePagination
      />
    </Card>
  );
}