'use client';

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { Patient, SearchParameter } from '@medplum/fhirtypes';
import { SearchControl, useMedplum } from '@medplum/react';
import { 
  Card, 
  Title, 
  Box, 
  Group, 
  Button, 
  Text, 
  Badge, 
  Stack, 
  Avatar, 
  ActionIcon, 
  Tooltip, 
  Skeleton,
  Loader,
  Center,
  Alert
} from '@mantine/core';
import { 
  IconPlus, 
  IconSearch, 
  IconUser, 
  IconEye, 
  IconCalendarPlus, 
  IconMessage, 
  IconPhone, 
  IconMail, 
  IconMapPin,
  IconAlertCircle
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@mantine/hooks';
import { FixedSizeList as List } from 'react-window';
import { patientHelpers } from '@/lib/medplum';

// Virtual scrolling configuration
const ITEM_HEIGHT = 120;
const OVERSCAN_COUNT = 5;

// Performance monitoring
let renderCount = 0;
let lastRenderTime = Date.now();

// Patient card row component for virtual scrolling
interface PatientRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    patients: Patient[];
    onPatientClick: (patient: Patient) => void;
    onScheduleAppointment: (patient: Patient) => void;
    onSendMessage: (patient: Patient) => void;
    isMobile: boolean;
  };
}

const PatientRow = memo<PatientRowProps>(({ index, style, data }) => {
  const { patients, onPatientClick, onScheduleAppointment, onSendMessage, isMobile } = data;
  const patient = patients[index];

  // Performance tracking
  useEffect(() => {
    renderCount++;
    if (renderCount % 10 === 0) {
      const now = Date.now();
      const renderTime = now - lastRenderTime;
      if (renderTime > 100) {
        console.warn(`Virtual scroll performance warning: ${renderTime}ms for 10 items`);
      }
      lastRenderTime = now;
    }
  });

  if (!patient) {
    return (
      <div style={style}>
        <Card padding="md" mb="xs" withBorder>
          <Group gap="sm">
            <Skeleton height={60} circle />
            <Box style={{ flex: 1 }}>
              <Skeleton height={16} width="60%" mb="xs" />
              <Skeleton height={12} width="40%" mb="sm" />
              <Skeleton height={12} width="80%" />
            </Box>
          </Group>
        </Card>
      </div>
    );
  }

  const name = patientHelpers.getFullName(patient);
  const mrn = patientHelpers.getMRN(patient);
  const age = patientHelpers.getAge(patient);
  const contact = patientHelpers.getContactInfo(patient);
  
  return (
    <div style={style}>
      <Card 
        padding={isMobile ? 'sm' : 'md'} 
        mb="xs" 
        withBorder
        style={{
          cursor: 'pointer',
          transition: 'transform 0.1s ease, box-shadow 0.1s ease',
        }}
        className="hover:shadow-md hover:transform hover:scale-[1.01]"
        onClick={() => onPatientClick(patient)}
      >
        <Group gap="sm" wrap="nowrap">
          <Avatar size={isMobile ? 'md' : 'lg'} radius="xl" color="blue">
            <IconUser size={isMobile ? 20 : 24} />
          </Avatar>
          
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={600} size={isMobile ? 'sm' : 'md'} truncate>
                  {name}
                </Text>
                <Text size="xs" c="dimmed">
                  MRN: {mrn} • {patient.gender || 'Unknown'} • {age} years
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
            
            {!isMobile && (
              <Group gap="md" mb="xs">
                {contact.phone && (
                  <Group gap={4}>
                    <IconPhone size={12} color="gray" />
                    <Text size="xs" c="dimmed">{contact.phone}</Text>
                  </Group>
                )}
                {contact.email && (
                  <Group gap={4}>
                    <IconMail size={12} color="gray" />
                    <Text size="xs" c="dimmed" truncate>{contact.email}</Text>
                  </Group>
                )}
              </Group>
            )}
            
            <Group gap="xs" mt="xs">
              <Tooltip label="View Patient">
                <ActionIcon
                  variant="light"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPatientClick(patient);
                  }}
                >
                  <IconEye size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Schedule Appointment">
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScheduleAppointment(patient);
                  }}
                >
                  <IconCalendarPlus size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Send Message">
                <ActionIcon
                  variant="light"
                  color="green"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendMessage(patient);
                  }}
                >
                  <IconMessage size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        </Group>
      </Card>
    </div>
  );
});

PatientRow.displayName = 'PatientRow';

interface VirtualizedPatientListProps {
  maxPatients?: number;
  enablePerformanceMonitoring?: boolean;
}

export const VirtualizedPatientList = memo<VirtualizedPatientListProps>(({ 
  maxPatients = 1000,
  enablePerformanceMonitoring = true 
}) => {
  const medplum = useMedplum();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [searchQuery, setSearchQuery] = useState('');
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    patientsLoaded: 0
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const loadStartTime = useRef<number>(0);

  // Calculate optimal container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const windowHeight = window.innerHeight;
        const headerHeight = 200;
        const footerHeight = 50;
        const availableHeight = windowHeight - headerHeight - footerHeight;
        setContainerHeight(Math.max(300, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Load patients with performance tracking
  const loadPatients = useCallback(async () => {
    try {
      loadStartTime.current = Date.now();
      setIsLoading(true);
      setError(null);

      const searchParams: Record<string, string> = {
        _sort: '-_lastUpdated',
        _count: maxPatients.toString(),
        ...(searchQuery && { _text: searchQuery }),
      };
      
      const patients = await medplum.searchResources('Patient', searchParams);
      
      const loadTime = Date.now() - loadStartTime.current;
      const renderStart = Date.now();
      
      setAllPatients(patients);
      
      const renderTime = Date.now() - renderStart;
      
      if (enablePerformanceMonitoring) {
        setPerformanceMetrics({
          loadTime,
          renderTime,
          patientsLoaded: patients.length
        });
        
        // Log performance warnings
        if (loadTime > 2000) {
          console.warn(`Patient list load time exceeded 2s: ${loadTime}ms`);
        }
        if (renderTime > 100) {
          console.warn(`Patient list render time exceeded 100ms: ${renderTime}ms`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load patients: ${errorMessage}`);
      console.error('Error loading patients:', err);
    } finally {
      setIsLoading(false);
    }
  }, [medplum, searchQuery, maxPatients, enablePerformanceMonitoring]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPatients();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [loadPatients]);

  const handlePatientClick = useCallback(
    (patient: Patient) => {
      if (patient.id) {
        router.push(`/dashboard/patients/${patient.id}`);
      }
    },
    [router]
  );

  const handleScheduleAppointment = useCallback(
    (patient: Patient) => {
      console.log('Schedule appointment for:', patient.id);
      // Implementation for scheduling
    },
    []
  );

  const handleSendMessage = useCallback(
    (patient: Patient) => {
      console.log('Send message to:', patient.id);
      // Implementation for messaging
    },
    []
  );

  const handleNewPatient = useCallback(() => {
    router.push('/dashboard/patients/new');
  }, [router]);

  // Search parameters
  const searchParams: SearchParameter[] = useMemo(() => [
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

  // Memoized virtual list data
  const virtualListData = useMemo(() => ({
    patients: allPatients,
    onPatientClick: handlePatientClick,
    onScheduleAppointment: handleScheduleAppointment,
    onSendMessage: handleSendMessage,
    isMobile,
  }), [allPatients, handlePatientClick, handleScheduleAppointment, handleSendMessage, isMobile]);

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

        {/* Performance Metrics */}
        {enablePerformanceMonitoring && !isLoading && allPatients.length > 0 && (
          <Group mb="md" gap="md">
            <Text size="xs" c="dimmed">
              Load: {performanceMetrics.loadTime}ms
            </Text>
            <Text size="xs" c="dimmed">
              Render: {performanceMetrics.renderTime}ms
            </Text>
            <Text size="xs" c="dimmed">
              Patients: {performanceMetrics.patientsLoaded}
            </Text>
            <Badge 
              color={performanceMetrics.loadTime < 1000 ? 'green' : performanceMetrics.loadTime < 2000 ? 'yellow' : 'red'}
              variant="light"
              size="xs"
            >
              {performanceMetrics.loadTime < 1000 ? 'Fast' : performanceMetrics.loadTime < 2000 ? 'Good' : 'Slow'}
            </Badge>
          </Group>
        )}

        {/* Error Display */}
        {error && (
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            color="red" 
            mb="md"
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Virtual Scrolling List */}
        <Box ref={containerRef} style={{ height: containerHeight }}>
          {isLoading ? (
            <Stack gap="xs">
              <Group gap="sm" mb="md">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Loading patients...</Text>
              </Group>
              {Array.from({ length: 5 }).map((_, index) => (
                <Card key={index} padding="md" withBorder>
                  <Group gap="sm">
                    <Skeleton height={60} circle />
                    <Box style={{ flex: 1 }}>
                      <Skeleton height={16} width="60%" mb="xs" />
                      <Skeleton height={12} width="40%" mb="sm" />
                      <Skeleton height={12} width="80%" />
                    </Box>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : allPatients.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconSearch size={48} style={{ opacity: 0.5 }} />
                <Text c="dimmed">No patients found</Text>
                <Text size="sm" c="dimmed">
                  {searchQuery 
                    ? 'Try adjusting your search criteria or add a new patient'
                    : 'Start by adding your first patient to the system'
                  }
                </Text>
                <Button 
                  leftSection={<IconPlus size={16} />}
                  onClick={handleNewPatient}
                  mt="md"
                >
                  Add New Patient
                </Button>
              </Stack>
            </Center>
          ) : (
            <List
              height={containerHeight}
              itemCount={allPatients.length}
              itemSize={ITEM_HEIGHT}
              itemData={virtualListData}
              overscanCount={OVERSCAN_COUNT}
              width="100%"
            >
              {PatientRow}
            </List>
          )}
        </Box>
      </Card>
    </Stack>
  );
});

VirtualizedPatientList.displayName = 'VirtualizedPatientList';

export default VirtualizedPatientList;