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
  IconPrinter,
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
        setConditions(conditionsData.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active'));
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

  const hasActiveConditions = conditions.length > 0;

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
                <Text fw={600} size="lg" className="text-gray-800">
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
            <Menu shadow="md" width={200}>
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
                  <Menu.Item leftSection={<IconPrinter size={14} />} onClick={onPrint}>
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
                <Text fw={700} size="xl" className="text-gray-800">
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
                  leftSection={<IconPrinter size={16} />}
                  variant="light"
                  size="sm"
                  onClick={onPrint}
                >
                  Print
                </Button>
              )}
              <Menu shadow="md" width={200}>
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
            <Paper p="md" className="bg-blue-50 border border-blue-200">
              <Group gap="sm">
                <IconPhone size={20} className="text-blue-600" />
                <div>
                  <Text size="xs" c="dimmed" fw={500}>PHONE</Text>
                  <Text size="sm" fw={500} className="text-blue-800">
                    {phone}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          
          {email && (
            <Paper p="md" className="bg-green-50 border border-green-200">
              <Group gap="sm">
                <IconMail size={20} className="text-green-600" />
                <div>
                  <Text size="xs" c="dimmed" fw={500}>EMAIL</Text>
                  <Text size="sm" fw={500} className="text-green-800" truncate>
                    {email}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          
          {address && (
            <Paper p="md" className="bg-purple-50 border border-purple-200">
              <Group gap="sm" align="flex-start">
                <IconMapPin size={20} className="text-purple-600 mt-1" />
                <div>
                  <Text size="xs" c="dimmed" fw={500}>ADDRESS</Text>
                  <Text size="sm" fw={500} className="text-purple-800">
                    {address.line?.[0]}
                    {address.city && (
                      <><br />{address.city}, {address.state} {address.postalCode}</>
                    )}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          
          <Paper p="md" className="bg-orange-50 border border-orange-200">
            <Group gap="sm">
              <IconHeart size={20} className="text-orange-600" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>STATUS</Text>
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
                      .slice(0, 3)
                      .map((allergy, index) => (
                        <Badge key={index} color="red" size="sm" variant="filled">
                          {allergy.code?.text || 
                           allergy.code?.coding?.[0]?.display || 
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
                  <Text size="sm" fw={500} mb="xs" className="text-gray-700">
                    Active Conditions
                  </Text>
                  <Group gap="xs">
                    {conditions.slice(0, 4).map((condition, index) => (
                      <Badge 
                        key={index} 
                        color="blue" 
                        size="sm" 
                        variant="light"
                      >
                        {condition.code?.text || 
                         condition.code?.coding?.[0]?.display || 
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