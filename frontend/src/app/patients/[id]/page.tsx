'use client';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Container, Title, Paper, Group, Button, Text, Stack, Badge, Loader, Alert } from '@mantine/core';
import { IconEdit, IconArrowLeft } from '@tabler/icons-react';
import { Patient } from '@medplum/fhirtypes';

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch patient data from your API/service
    const fetchPatient = async () => {
      try {
        setLoading(true);
        // Placeholder: Replace with actual API call
        // const response = await fetch(`/api/patients/${patientId}`);
        // const data = await response.json();
        // setPatient(data);
        
        // Temporary mock data
        setPatient({
          resourceType: 'Patient',
          id: patientId,
          name: [{
            given: ['John'],
            family: 'Doe'
          }],
          gender: 'male',
          birthDate: '1990-01-01',
          telecom: [{
            system: 'phone',
            value: '555-0123'
          }],
          address: [{
            line: ['123 Main St'],
            city: 'Anytown',
            state: 'CA',
            postalCode: '12345'
          }]
        } as Patient);
      } catch (err) {
        setError('Failed to load patient data');
        console.error('Error fetching patient:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  const handleEdit = () => {
    router.push(`/patients/${patientId}/edit`);
  };

  const handleBack = () => {
    router.push('/patients');
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Paper p="xl" withBorder>
          <Group justify="center">
            <Loader size="lg" />
            <Text>Loading patient data...</Text>
          </Group>
        </Paper>
      </Container>
    );
  }

  if (error || !patient) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" title="Error">
          {error || 'Patient not found'}
        </Alert>
        <Button mt="md" onClick={handleBack} leftSection={<IconArrowLeft size={16} />}>
          Back to Patients
        </Button>
      </Container>
    );
  }

  const patientName = patient.name?.[0]
    ? `${patient.name[0].given?.join(' ')} ${patient.name[0].family}`
    : 'Unknown Patient';

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Button variant="subtle" onClick={handleBack} leftSection={<IconArrowLeft size={16} />}>
          Back to Patients
        </Button>
        <Button onClick={handleEdit} leftSection={<IconEdit size={16} />}>
          Edit Patient
        </Button>
      </Group>

      <Paper p="xl" withBorder>
        <Stack gap="md">
          <div>
            <Title order={2}>{patientName}</Title>
            <Text c="dimmed" size="sm">Patient ID: {patient.id}</Text>
          </div>

          <Group gap="xs">
            <Badge color="blue" variant="light">
              {patient.gender || 'Unknown'}
            </Badge>
            <Badge color="green" variant="light">
              Born: {patient.birthDate || 'Unknown'}
            </Badge>
          </Group>

          <div>
            <Title order={4} mb="xs">Contact Information</Title>
            <Text size="sm">
              Phone: {patient.telecom?.[0]?.value || 'No phone number'}
            </Text>
          </div>

          <div>
            <Title order={4} mb="xs">Address</Title>
            {patient.address?.[0] ? (
              <Text size="sm">
                {patient.address[0].line?.join(', ')}<br />
                {patient.address[0].city}, {patient.address[0].state} {patient.address[0].postalCode}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">No address on file</Text>
            )}
          </div>
        </Stack>
      </Paper>
    </Container>
  );
}