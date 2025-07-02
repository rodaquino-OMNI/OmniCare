'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  Container, 
  Title, 
  Paper, 
  TextInput, 
  Select, 
  Button, 
  Group, 
  Stack, 
  Loader, 
  Alert,
  Grid
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { Patient } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';

export default function PatientEditPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    // TODO: Fetch patient data from your API/service
    const fetchPatient = async () => {
      try {
        setLoading(true);
        // Placeholder: Replace with actual API call
        // const response = await fetch(`/api/patients/${patientId}`);
        // const data = await response.json();
        
        // Temporary mock data
        const mockPatient: Patient = {
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
        };
        
        // Populate form with patient data
        if (mockPatient.name?.[0]) {
          setFirstName(mockPatient.name[0].given?.[0] || '');
          setLastName(mockPatient.name[0].family || '');
        }
        setGender(mockPatient.gender || '');
        if (mockPatient.birthDate) {
          setBirthDate(new Date(mockPatient.birthDate));
        }
        setPhone(mockPatient.telecom?.[0]?.value || '');
        if (mockPatient.address?.[0]) {
          setStreet(mockPatient.address[0].line?.[0] || '');
          setCity(mockPatient.address[0].city || '');
          setState(mockPatient.address[0].state || '');
          setPostalCode(mockPatient.address[0].postalCode || '');
        }
      } catch (err) {
        setError('Failed to load patient data');
        console.error('Error fetching patient:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // TODO: Replace with actual API call to update patient
      const updatedPatient: Partial<Patient> = {
        resourceType: 'Patient',
        id: patientId,
        name: [{
          given: [firstName],
          family: lastName
        }],
        gender: gender as Patient['gender'],
        birthDate: birthDate?.toISOString().split('T')[0],
        telecom: [{
          system: 'phone',
          value: phone
        }],
        address: [{
          line: [street],
          city,
          state,
          postalCode
        }]
      };
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      notifications.show({
        title: 'Success',
        message: 'Patient information updated successfully',
        color: 'green'
      });
      
      router.push(`/patients/${patientId}`);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update patient information',
        color: 'red'
      });
      console.error('Error updating patient:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/patients/${patientId}`);
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

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" title="Error">
          {error}
        </Alert>
        <Button mt="md" onClick={() => router.push('/patients')} leftSection={<IconArrowLeft size={16} />}>
          Back to Patients
        </Button>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">Edit Patient</Title>
      
      <Paper p="xl" withBorder>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.currentTarget.value)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.currentTarget.value)}
                  required
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Gender"
                  value={gender}
                  onChange={(value) => setGender(value || '')}
                  data={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                    { value: 'unknown', label: 'Unknown' }
                  ]}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <DateInput
                  label="Birth Date"
                  value={birthDate}
                  onChange={setBirthDate}
                  placeholder="Select birth date"
                />
              </Grid.Col>
            </Grid>

            <TextInput
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="555-0123"
            />

            <Title order={4}>Address</Title>
            
            <TextInput
              label="Street Address"
              value={street}
              onChange={(e) => setStreet(e.currentTarget.value)}
            />
            
            <Grid>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="State"
                  value={state}
                  onChange={(e) => setState(e.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Postal Code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.currentTarget.value)}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="xl">
              <Button 
                variant="subtle" 
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                loading={saving}
                leftSection={<IconDeviceFloppy size={16} />}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}