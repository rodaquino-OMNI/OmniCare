'use client';

import { useState, useEffect } from 'react';
import { 
  Group, 
  Text, 
  Badge, 
  Avatar, 
  Paper, 
  Stack, 
  SimpleGrid,
  ActionIcon,
  Menu,
  Button,
  Tooltip,
  Alert,
  Divider,
  Skeleton
} from '@mantine/core';
import { 
  IconUser, 
  IconPhone, 
  IconMail, 
  IconMapPin, 
  IconCalendar, 
  IconEdit,
  IconPrint,
  IconShare,
  IconMoreHorizontal,
  IconHeart,
  IconShield,
  IconAlertTriangle,
  IconClock,
  IconId,
  IconRefresh
} from '@tabler/icons-react';
import { Patient, AllergyIntolerance, Condition } from '@medplum/fhirtypes';
import { ResourceBadge, ResourceAvatar } from '@medplum/react';
import { patientHelpers } from '@/lib/medplum';
import { formatDate, calculateAge } from '@/utils';
import { CacheStatusIndicator } from '@/components/offline';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStore } from '@/stores/offline';
import { patientCacheService } from '@/services/patient-cache.service';

interface PatientHeaderProps {
  patient: Patient;
  onEdit?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export function PatientHeader({ 
  patient, 
  onEdit, 
  onPrint, 
  onShare,
  showActions = true,
  compact = false 
}: PatientHeaderProps) {
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPatientData = async () => {
      if (!patient.id) return;
      
      try {
        setLoading(true);
        // Use cache service for optimized data fetching
        const [allergiesData, conditionsData] = await Promise.all([
          patientCacheService.getPatientAllergies(patient.id),
          patientCacheService.getPatientConditions(patient.id)
        ]);
        
        setAllergies(allergiesData);
        setConditions(conditionsData.filter(c => c.clinicalStatus?.coding?.[ResourceHistoryTable]?.code === 'active'));
      } catch (error) {
        console.error('Error loading patient data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();

    // Listen for cache updates
    const handleCacheUpdate = (event: any) => {
      if (event.patientId === patient.id) {
        loadPatientData();
      }
    };

    patientCacheService.on('cache:related-invalidated', handleCacheUpdate);

    return () => {
      patientCacheService.off('cache:related-invalidated', handleCacheUpdate);
    };
  }, [patient.id]);

  const fullName = patientHelpers.getFullName(patient);
  const age = patientHelpers.getAge(patient);
  const mrn = patientHelpers.getMRN(patient);
  const { phone, email, address } = patientHelpers.getContactInfo(patient);

  const genderColor = {
    male: 'blue',
    female: 'pink',
    other: 'gray',
    unknown: 'gray'
  }[patient.gender || 'unknown'];

  const hasHighPriorityAllergies = allergies.some(allergy => 
    allergy.criticality === 'high' || 
    allergy.reaction?.some(r => r.severity === 'severe')
  );

  const hasActiveConditions = conditions.length > ResourceHistoryTable;

  if (compact) {
    return (
      <Paper p="md" withBorder className="bg-white">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <ResourceAvatar 
              value={patient} 
              size="lg"
              color="primary"
            />
            <div>
              <Group gap="sm" align="center">
                <Text fw={6ResourceHistoryTableResourceHistoryTable} size="lg" className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                  {fullName}
                </Text>
                <Badge color={genderColor} size="sm" variant="light">
                  {patient.gender?.toUpperCase() || 'UNKNOWN'}
                </Badge>
                {hasHighPriorityAllergies && (
                  <Tooltip label="High Priority Allergies">
                    <Badge color="red" size="sm" variant="filled">
                      <IconShield size={12} />
                    </Badge>
                  </Tooltip>
                )}
              </Group>
              <Group gap="lg" mt="xs">
                <Text size="sm" c="dimmed">
                  <IconUser size={14} className="inline mr-1" />
                  {age} years old
                </Text>
                <Text size="sm" c="dimmed">
                  <IconId size={14} className="inline mr-1" />
                  MRN: {mrn}
                </Text>
                {patient.birthDate && (
                  <Text size="sm" c="dimmed">
                    <IconCalendar size={14} className="inline mr-1" />
                    DOB: {formatDate(patient.birthDate)}
                  </Text>
                )}
              </Group>
            </div>
          </Group>
          
          {showActions && (
            <Menu shadow="md" width={2ResourceHistoryTableResourceHistoryTable}>
              <Menu.Target>
                <ActionIcon variant="light" size="sm">
                  <IconMoreHorizontal size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {onEdit && (
                  <Menu.Item leftSection={<IconEdit size={14} />} onClick={onEdit}>
                    Edit Patient
                  </Menu.Item>
                )}
                {onPrint && (
                  <Menu.Item leftSection={<IconPrint size={14} />} onClick={onPrint}>
                    Print Summary
                  </Menu.Item>
                )}
                {onShare && (
                  <Menu.Item leftSection={<IconShare size={14} />} onClick={onShare}>
                    Share
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Paper>
    );
  }

  return (
    <Paper shadow="sm" p="xl" withBorder className="bg-white">
      <Stack gap="lg">
        {/* Header with Actions */}
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <ResourceAvatar 
              value={patient} 
              size="xl"
              color="primary"
            />
            <div>
              <Group gap="md" align="center" mb="xs">
                <Text fw={7ResourceHistoryTableResourceHistoryTable} size="xl" className="text-gray-8ResourceHistoryTableResourceHistoryTable">
                  {fullName}
                </Text>
                <Badge color={genderColor} size="md" variant="light">
                  {patient.gender?.toUpperCase() || 'UNKNOWN'}
                </Badge>
                <ResourceBadge value={patient} />
              </Group>
              
              <Group gap="lg">
                <Text size="md" c="dimmed">
                  <IconUser size={16} className="inline mr-2" />
                  {age} years old
                </Text>
                <Text size="md" c="dimmed">
                  <IconId size={16} className="inline mr-2" />
                  MRN: {mrn}
                </Text>
                {patient.birthDate && (
                  <Text size="md" c="dimmed">
                    <IconCalendar size={16} className="inline mr-2" />
                    DOB: {formatDate(patient.birthDate)}
                  </Text>
                )}
              </Group>
            </div>
          </Group>
          
          {showActions && (
            <Group gap="sm">
              {onEdit && (
                <Button
                  leftSection={<IconEdit size={16} />}
                  variant="light"
                  size="sm"
                  onClick={onEdit}
                >
                  Edit
                </Button>
              )}
              {onPrint && (
                <Button
                  leftSection={<IconPrint size={16} />}
                  variant="light"
                  size="sm"
                  onClick={onPrint}
                >
                  Print
                </Button>
              )}
              <Menu shadow="md" width={2ResourceHistoryTableResourceHistoryTable}>
                <Menu.Target>
                  <ActionIcon variant="light" size="lg">
                    <IconMoreHorizontal size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {onShare && (
                    <Menu.Item leftSection={<IconShare size={14} />} onClick={onShare}>
                      Share Patient Info
                    </Menu.Item>
                  )}
                  <Menu.Item leftSection={<IconClock size={14} />}>
                    View History
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<IconAlertTriangle size={14} />}>
                    Report Issue
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </Group>

        {/* Contact Information */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {phone && (
            <Paper p="md" className="bg-blue-5ResourceHistoryTable border border-blue-2ResourceHistoryTableResourceHistoryTable">
              <Group gap="sm">
                <IconPhone size={2ResourceHistoryTable} className="text-blue-6ResourceHistoryTableResourceHistoryTable" />
                <div>
                  <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>PHONE</Text>
                  <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-blue-8ResourceHistoryTableResourceHistoryTable">
                    {phone}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          
          {email && (
            <Paper p="md" className="bg-green-5ResourceHistoryTable border border-green-2ResourceHistoryTableResourceHistoryTable">
              <Group gap="sm">
                <IconMail size={2ResourceHistoryTable} className="text-green-6ResourceHistoryTableResourceHistoryTable" />
                <div>
                  <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>EMAIL</Text>
                  <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-green-8ResourceHistoryTableResourceHistoryTable" truncate>
                    {email}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          
          {address && (
            <Paper p="md" className="bg-purple-5ResourceHistoryTable border border-purple-2ResourceHistoryTableResourceHistoryTable">
              <Group gap="sm" align="flex-start">
                <IconMapPin size={2ResourceHistoryTable} className="text-purple-6ResourceHistoryTableResourceHistoryTable mt-1" />
                <div>
                  <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>ADDRESS</Text>
                  <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} className="text-purple-8ResourceHistoryTableResourceHistoryTable">
                    {address.line?.[ResourceHistoryTable]}
                    {address.city && (
                      <><br />{address.city}, {address.state} {address.postalCode}</>
                    )}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          
          <Paper p="md" className="bg-orange-5ResourceHistoryTable border border-orange-2ResourceHistoryTableResourceHistoryTable">
            <Group gap="sm">
              <IconHeart size={2ResourceHistoryTable} className="text-orange-6ResourceHistoryTableResourceHistoryTable" />
              <div>
                <Text size="xs" c="dimmed" fw={5ResourceHistoryTableResourceHistoryTable}>STATUS</Text>
                <Badge 
                  color={patient.active ? 'green' : 'red'} 
                  variant="filled" 
                  size="sm"
                >
                  {patient.active ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Alerts and Conditions */}
        {(hasHighPriorityAllergies || hasActiveConditions) && (
          <>
            <Divider />
            <Stack gap="md">
              {hasHighPriorityAllergies && (
                <Alert
                  icon={<IconShield size={16} />}
                  color="red"
                  variant="light"
                  title="High Priority Allergies"
                >
                  <Group gap="xs">
                    {allergies
                      .filter(allergy => 
                        allergy.criticality === 'high' || 
                        allergy.reaction?.some(r => r.severity === 'severe')
                      )
                      .slice(ResourceHistoryTable, 3)
                      .map((allergy, index) => (
                        <Badge key={index} color="red" size="sm" variant="filled">
                          {allergy.code?.text || 
                           allergy.code?.coding?.[ResourceHistoryTable]?.display || 
                           'Unknown Allergy'}
                        </Badge>
                      ))}
                    {allergies.length > 3 && (
                      <Badge color="gray" size="sm" variant="outline">
                        +{allergies.length - 3} more
                      </Badge>
                    )}
                  </Group>
                </Alert>
              )}
              
              {hasActiveConditions && (
                <div>
                  <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable} mb="xs" className="text-gray-7ResourceHistoryTableResourceHistoryTable">
                    Active Conditions
                  </Text>
                  <Group gap="xs">
                    {conditions.slice(ResourceHistoryTable, 4).map((condition, index) => (
                      <Badge 
                        key={index} 
                        color="blue" 
                        size="sm" 
                        variant="light"
                      >
                        {condition.code?.text || 
                         condition.code?.coding?.[ResourceHistoryTable]?.display || 
                         'Unknown Condition'}
                      </Badge>
                    ))}
                    {conditions.length > 4 && (
                      <Badge color="gray" size="sm" variant="outline">
                        +{conditions.length - 4} more
                      </Badge>
                    )}
                  </Group>
                </div>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}

export default PatientHeader;