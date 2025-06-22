/**
 * Offline Patient List Component
 * Demonstrates IndexedDB usage for offline patient data
 */

import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TextInput, 
  Button, 
  Group, 
  Text, 
  Badge,
  ActionIcon,
  Loader,
  Alert
} from '@mantine/core';
import { 
  IconSearch, 
  IconUserPlus, 
  IconRefresh,
  IconCloudOff,
  IconCloud 
} from '@tabler/icons-react';
import { Patient } from '@medplum/fhirtypes';
import { useIndexedDB } from '@/hooks/useIndexedDB';
import { CommonQueries } from '@/services/indexeddb.query';
import { notifications } from '@mantine/notifications';

export function OfflinePatientList() {
  const { 
    isInitialized, 
    isOnline, 
    query, 
    create,
    syncResource 
  } = useIndexedDB();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string>();

  // Load patients
  const loadPatients = async () => {
    if (!isInitialized) return;

    setLoading(true);
    setError(undefined);

    try {
      let results: Patient[];
      
      if (searchTerm) {
        // Use the search query
        results = await CommonQueries.searchPatients(searchTerm).toArray();
      } else {
        // Get all patients
        results = await query<Patient>('Patient')
          .orderBy('name.family')
          .limit(50)
          .toArray();
      }

      setPatients(results);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setError('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  // Initial load and reload on search
  useEffect(() => {
    loadPatients();
  }, [isInitialized, searchTerm]);

  // Handle sync for individual patient
  const handleSync = async (patient: Patient) => {
    try {
      await syncResource('Patient', patient.id!);
      notifications.show({
        title: 'Patient synced',
        message: `${formatPatientName(patient)} has been synced with the server`,
        color: 'green'
      });
      await loadPatients(); // Reload to update sync status
    } catch (err) {
      notifications.show({
        title: 'Sync failed',
        message: `Failed to sync ${formatPatientName(patient)}`,
        color: 'red'
      });
    }
  };

  // Format patient name
  const formatPatientName = (patient: Patient): string => {
    const name = patient.name?.[0];
    if (!name) return 'Unknown Patient';
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
  };

  // Format birth date
  const formatBirthDate = (date?: string): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  };

  // Get sync status for patient
  const getSyncStatus = (patient: Patient): 'synced' | 'pending' | 'error' => {
    // This would check the actual sync metadata
    // For demo purposes, using a simple check
    return patient.meta?.tag?.some(tag => tag.code === 'offline-only') 
      ? 'pending' 
      : 'synced';
  };

  if (!isInitialized) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Loader />
        <Text mt="md">Initializing offline storage...</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group>
          <Text size="xl" fw={700}>Patients</Text>
          <Badge 
            color={isOnline ? 'green' : 'orange'}
            leftSection={isOnline ? <IconCloud size={14} /> : <IconCloudOff size={14} />}
          >
            {isOnline ? 'Online' : 'Offline Mode'}
          </Badge>
        </Group>
        
        <Group>
          <Button
            leftSection={<IconUserPlus size={16} />}
            onClick={() => {
              // Navigate to patient creation
              console.log('Create new patient');
            }}
          >
            New Patient
          </Button>
          <ActionIcon
            variant="light"
            onClick={loadPatients}
            loading={loading}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Search */}
      <TextInput
        placeholder="Search patients by name..."
        leftSection={<IconSearch size={16} />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.currentTarget.value)}
        mb="md"
      />

      {/* Error Alert */}
      {error && (
        <Alert color="red" mb="md" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}

      {/* Results count */}
      <Text size="sm" c="dimmed" mb="xs">
        {loading ? 'Loading...' : `${patients.length} patients found`}
      </Text>

      {/* Patient Table */}
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>MRN</Table.Th>
            <Table.Th>Birth Date</Table.Th>
            <Table.Th>Gender</Table.Th>
            <Table.Th>Sync Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {patients.map((patient) => {
            const syncStatus = getSyncStatus(patient);
            
            return (
              <Table.Tr key={patient.id}>
                <Table.Td>{formatPatientName(patient)}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {patient.identifier?.[0]?.value || 'N/A'}
                  </Text>
                </Table.Td>
                <Table.Td>{formatBirthDate(patient.birthDate)}</Table.Td>
                <Table.Td>{patient.gender || 'Unknown'}</Table.Td>
                <Table.Td>
                  <Badge
                    size="sm"
                    color={
                      syncStatus === 'synced' ? 'green' : 
                      syncStatus === 'pending' ? 'orange' : 
                      'red'
                    }
                  >
                    {syncStatus}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        // Navigate to patient chart
                        console.log('View patient:', patient.id);
                      }}
                    >
                      View
                    </Button>
                    {syncStatus === 'pending' && isOnline && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="blue"
                        onClick={() => handleSync(patient)}
                      >
                        Sync
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {/* Empty state */}
      {!loading && patients.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" mt="xl">
          {searchTerm ? 'No patients found matching your search' : 'No patients stored offline'}
        </Text>
      )}

      {/* Offline mode info */}
      {!isOnline && (
        <Alert 
          color="orange" 
          mt="md"
          icon={<IconCloudOff />}
        >
          You are working offline. Any changes will be synchronized when connection is restored.
        </Alert>
      )}
    </div>
  );
}