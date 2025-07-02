'use client';

import { Patient } from '@medplum/fhirtypes';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Avatar,
  ActionIcon,
  Box,
  Divider,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconCalendar,
  IconId,
  IconMapPin,
  IconChevronRight,
} from '@tabler/icons-react';
import { patientHelpers } from '@/lib/medplum';

interface PatientCardProps {
  patient: Patient;
  onClick: (patient: Patient) => void;
  variant?: 'grid' | 'list';
}

export function PatientCard({ patient, onClick, variant = 'grid' }: PatientCardProps) {
  const theme = useMantineTheme();
  const fullName = patientHelpers.getFullName(patient);
  const age = patientHelpers.getAge(patient);
  const mrn = patientHelpers.getMRN(patient);
  const contact = patientHelpers.getContactInfo(patient);
  const address = patient.address?.[0];
  
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  if (variant === 'list') {
    return (
      <Card
        shadow="sm"
        radius="md"
        withBorder
        component={UnstyledButton}
        onClick={() => onClick(patient)}
        style={{
          cursor: 'pointer',
          transition: 'all 150ms ease',
          ':hover': {
            backgroundColor: theme.colors.gray[0],
            transform: 'translateX(4px)',
          },
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Avatar size="md" radius="xl" color="blue">
              {initials}
            </Avatar>
            
            <Stack gap={4}>
              <Group gap="xs" wrap="nowrap">
                <Text fw={500} size="md" lineClamp={1}>
                  {fullName}
                </Text>
                <Badge size="sm" variant="light" color={patient.active ? 'green' : 'gray'}>
                  {patient.active ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
              
              <Group gap="lg" wrap="nowrap">
                <Text size="sm" c="dimmed">
                  <Group gap={4} wrap="nowrap">
                    <IconId size={14} />
                    {mrn}
                  </Group>
                </Text>
                
                <Text size="sm" c="dimmed">
                  <Group gap={4} wrap="nowrap">
                    <IconCalendar size={14} />
                    {patient.birthDate} ({age} yrs)
                  </Group>
                </Text>
                
                {contact.phone && (
                  <Text size="sm" c="dimmed" visibleFrom="sm">
                    <Group gap={4} wrap="nowrap">
                      <IconPhone size={14} />
                      {contact.phone}
                    </Group>
                  </Text>
                )}
              </Group>
            </Stack>
          </Group>
          
          <ActionIcon variant="subtle" color="gray">
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>
      </Card>
    );
  }
  
  return (
    <Card
      shadow="sm"
      radius="md"
      withBorder
      component={UnstyledButton}
      onClick={() => onClick(patient)}
      style={{
        cursor: 'pointer',
        transition: 'all 150ms ease',
        height: '100%',
        ':hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows.md,
        },
      }}
    >
      <Stack gap="md" h="100%">
        {/* Header */}
        <Group justify="space-between" wrap="nowrap">
          <Avatar size="lg" radius="xl" color="blue">
            {initials}
          </Avatar>
          
          <Badge variant="light" color={patient.active ? 'green' : 'gray'}>
            {patient.active ? 'Active' : 'Inactive'}
          </Badge>
        </Group>
        
        {/* Patient Info */}
        <Stack gap="xs" style={{ flex: 1 }}>
          <Text fw={600} size="lg" lineClamp={1}>
            {fullName}
          </Text>
          
          <Stack gap={8}>
            <Group gap={6} wrap="nowrap">
              <IconId size={16} color={theme.colors.gray[6]} />
              <Text size="sm" c="dimmed">
                MRN: {mrn}
              </Text>
            </Group>
            
            <Group gap={6} wrap="nowrap">
              <IconCalendar size={16} color={theme.colors.gray[6]} />
              <Text size="sm" c="dimmed">
                {patient.birthDate} ({age} years)
              </Text>
            </Group>
            
            <Group gap={6} wrap="nowrap">
              <IconUser size={16} color={theme.colors.gray[6]} />
              <Text size="sm" c="dimmed">
                {patient.gender || 'Not specified'}
              </Text>
            </Group>
          </Stack>
        </Stack>
        
        <Divider />
        
        {/* Contact Info */}
        <Stack gap={8}>
          {contact.phone && (
            <Group gap={6} wrap="nowrap">
              <IconPhone size={16} color={theme.colors.gray[6]} />
              <Text size="sm" c="dimmed" lineClamp={1}>
                {contact.phone}
              </Text>
            </Group>
          )}
          
          {contact.email && (
            <Group gap={6} wrap="nowrap">
              <IconMail size={16} color={theme.colors.gray[6]} />
              <Text size="sm" c="dimmed" lineClamp={1}>
                {contact.email}
              </Text>
            </Group>
          )}
          
          {address && (
            <Group gap={6} wrap="nowrap" align="flex-start">
              <IconMapPin size={16} color={theme.colors.gray[6]} style={{ marginTop: 2 }} />
              <Text size="sm" c="dimmed" lineClamp={2}>
                {[
                  address.line?.join(', '),
                  address.city,
                  address.state,
                  address.postalCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </Group>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}