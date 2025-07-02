'use client';

import { useState, useEffect } from 'react';
import { 
  Timeline, 
  Text, 
  Paper, 
  Group, 
  Badge, 
  ActionIcon,
  Menu,
  Stack,
  Loader,
  Center,
  Alert,
  Button,
  TextInput,
  Select,
  ScrollArea
} from '@mantine/core';
import { 
  IconStethoscope,
  IconPill,
  IconTestPipe,
  IconNotes,
  IconCalendar,
  IconUser,
  IconActivity,
  IconHeart,
  IconBrain,
  IconEye,
  IconSearch,
  IconFilter,
  IconMoreHorizontal,
  IconDownload,
  IconPrinter,
  IconRefresh
} from '@tabler/icons-react';
import { 
  Patient, 
  Encounter, 
  Observation, 
  MedicationRequest,
  Procedure,
  DiagnosticReport,
  DocumentReference 
} from '@medplum/fhirtypes';
import { patientHelpers, observationHelpers, medicationHelpers } from '@/lib/medplum';
import { formatDate, formatDateTime, getRelativeTime } from '@/utils';

interface TimelineEvent {
  id: string;
  type: 'encounter' | 'medication' | 'observation' | 'procedure' | 'document' | 'report';
  date: string;
  title: string;
  description: string;
  details?: string;
  status?: string;
  icon: React.ComponentType<any>;
  color: string;
  data: any; // The original FHIR resource
}

interface PatientTimelineProps {
  patient: Patient;
  maxItems?: number;
  showFilters?: boolean;
  height?: number;
}

export function PatientTimeline({ 
  patient, 
  maxItems = 50, 
  showFilters = true,
  height = 6 
}: PatientTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  useEffect(() => {
    loadTimelineData();
  }, [patient.id]);

  useEffect(() => {
    applyFilters();
  }, [events, searchQuery, typeFilter, dateRange]);

  const loadTimelineData = async () => {
    if (!patient.id) return;

    try {
      setLoading(true);
      setError(null);

      // Load all relevant data in parallel
      const [
        encounters,
        medications,
        observations,
        // procedures,
        // reports
      ] = await Promise.all([
        patientHelpers.getEncounters(patient.id),
        patientHelpers.getMedications(patient.id),
        patientHelpers.getVitalSigns(patient.id),
        // Additional data can be loaded here
      ]);

      const timelineEvents: TimelineEvent[] = [];

      // Process encounters
      encounters.forEach(encounter => {
        timelineEvents.push({
          id: encounter.id || `encounter-${Date.now()}`,
          type: 'encounter',
          date: encounter.period?.start || encounter.period?.end || new Date().toISOString(),
          title: getEncounterTitle(encounter),
          description: getEncounterDescription(encounter),
          status: encounter.status,
          icon: IconStethoscope,
          color: getEncounterColor(encounter.class?.code),
          data: encounter
        });
      });

      // Process medications
      medications.forEach(medication => {
        timelineEvents.push({
          id: medication.id || `medication-${Date.now()}`,
          type: 'medication',
          date: medication.authoredOn || new Date().toISOString(),
          title: medicationHelpers.getName(medication),
          description: medicationHelpers.getDosageInstruction(medication),
          status: medication.status,
          icon: IconPill,
          color: getMedicationColor(medication.status),
          data: medication
        });
      });

      // Process observations (vital signs and lab results)
      observations.forEach(observation => {
        timelineEvents.push({
          id: observation.id || `observation-${Date.now()}`,
          type: 'observation',
          date: observation.effectiveDateTime || observation.effectivePeriod?.start || new Date().toISOString(),
          title: getObservationTitle(observation),
          description: getObservationDescription(observation),
          status: observation.status,
          icon: getObservationIcon(observation),
          color: getObservationColor(observation),
          data: observation
        });
      });

      // Sort events by date (most recent first)
      timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEvents(timelineEvents.slice(0, maxItems));
    } catch (err) {
      console.error('Error loading timeline data:', err);
      setError('Failed to load patient timeline');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(event => event.type === typeFilter);
    }

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case '1d':
          filterDate.setDate(now.getDate() - 1);
          break;
        case '1w':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '1m':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case '3m':
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case '1y':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(event => new Date(event.date) >= filterDate);
    }

    setFilteredEvents(filtered);
  };

  const getEncounterTitle = (encounter: Encounter): string => {
    return encounter.type?.[0]?.text || 
           encounter.type?.[0]?.coding?.[0]?.display || 
           encounter.class?.display ||
           'Medical Encounter';
  };

  const getEncounterDescription = (encounter: Encounter): string => {
    const location = encounter.location?.[0]?.location?.display;
    const participant = encounter.participant?.[0]?.individual?.display;
    
    const parts = [];
    if (location) parts.push(`Location: ${location}`);
    if (participant) parts.push(`Provider: ${participant}`);
    
    return parts.join(' • ') || 'Medical encounter';
  };

  const getEncounterColor = (encounterClass?: string): string => {
    switch (encounterClass) {
      case 'emergency': return 'red';
      case 'inpatient': return 'blue';
      case 'outpatient': return 'green';
      case 'ambulatory': return 'orange';
      default: return 'gray';
    }
  };

  const getMedicationColor = (status?: string): string => {
    switch (status) {
      case 'active': return 'green';
      case 'completed': return 'blue';
      case 'stopped': return 'red';
      case 'draft': return 'orange';
      default: return 'gray';
    }
  };

  const getObservationTitle = (observation: Observation): string => {
    return observation.code?.text || 
           observation.code?.coding?.[0]?.display || 
           'Lab Result';
  };

  const getObservationDescription = (observation: Observation): string => {
    const value = observationHelpers.getValue(observation);
    const range = observationHelpers.getReferenceRange(observation);
    
    return range ? `${value} (Normal: ${range})` : value;
  };

  const getObservationIcon = (observation: Observation): React.ComponentType<any> => {
    const category = observationHelpers.getCategory(observation).toLowerCase();
    
    if (category.includes('vital')) return IconHeart;
    if (category.includes('lab')) return IconTestPipe;
    if (category.includes('imaging')) return IconEye;
    return IconActivity;
  };

  const getObservationColor = (observation: Observation): string => {
    if (observationHelpers.isAbnormal(observation)) {
      return 'red';
    }
    
    const category = observationHelpers.getCategory(observation).toLowerCase();
    if (category.includes('vital')) return 'green';
    if (category.includes('lab')) return 'blue';
    return 'gray';
  };

  if (loading) {
    return (
      <Center h={height}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading patient timeline...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error" mb="md">
        {error}
        <Button variant="light" size="sm" mt="sm" onClick={loadTimelineData}>
          Try Again
        </Button>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      {/* Filters */}
      {showFilters && (
        <Paper p="md" withBorder>
          <Group justify="space-between" align="flex-end">
            <Group gap="md" flex={1}>
              <TextInput
                placeholder="Search timeline..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              
              <Select
                placeholder="Filter by type"
                data={[
                  { value: 'all', label: 'All Events' },
                  { value: 'encounter', label: 'Encounters' },
                  { value: 'medication', label: 'Medications' },
                  { value: 'observation', label: 'Lab Results & Vitals' },
                  { value: 'procedure', label: 'Procedures' },
                  { value: 'document', label: 'Documents' }
                ]}
                value={typeFilter}
                onChange={(value) => setTypeFilter(value || 'all')}
                leftSection={<IconFilter size={16} />}
              />
              
              <Select
                placeholder="Time range"
                data={[
                  { value: 'all', label: 'All Time' },
                  { value: '1d', label: 'Last 24 hours' },
                  { value: '1w', label: 'Last week' },
                  { value: '1m', label: 'Last month' },
                  { value: '3m', label: 'Last 3 months' },
                  { value: '1y', label: 'Last year' }
                ]}
                value={dateRange}
                onChange={(value) => setDateRange(value || 'all')}
                leftSection={<IconCalendar size={16} />}
              />
            </Group>
            
            <Group gap="sm">
              <ActionIcon 
                variant="light" 
                onClick={loadTimelineData}
                loading={loading}
              >
                <IconRefresh size={16} />
              </ActionIcon>
              
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="light">
                    <IconMoreHorizontal size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconDownload size={14} />}>
                    Export Timeline
                  </Menu.Item>
                  <Menu.Item leftSection={<IconPrinter size={14} />}>
                    Print Timeline
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
          
          <Group gap="md" mt="sm">
            <Text size="sm" c="dimmed">
              Showing {filteredEvents.length} of {events.length} events
            </Text>
            {searchQuery && (
              <Badge variant="light" size="sm">
                Search: "{searchQuery}"
              </Badge>
            )}
            {typeFilter !== 'all' && (
              <Badge variant="light" size="sm">
                Type: {typeFilter}
              </Badge>
            )}
            {dateRange !== 'all' && (
              <Badge variant="light" size="sm">
                Range: {dateRange}
              </Badge>
            )}
          </Group>
        </Paper>
      )}

      {/* Timeline */}
      <Paper withBorder>
        <ScrollArea h={height}>
          <div className="p-4">
            {filteredEvents.length === 0 ? (
              <Center h={200}>
                <Stack align="center" gap="md">
                  <IconCalendar size={48} className="text-gray-4" />
                  <Text c="dimmed" ta="center">
                    No timeline events found
                    {searchQuery || typeFilter !== 'all' || dateRange !== 'all' 
                      ? ' matching your filters' 
                      : ' for this patient'
                    }
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Timeline active={-1} bulletSize={24} lineWidth={2}>
                {filteredEvents.map((event) => (
                  <Timeline.Item
                    key={event.id}
                    bullet={<event.icon size={12} />}
                    color={event.color}
                    className="pb-4"
                  >
                    <Paper p="md" className="ml-2 border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Group justify="space-between" align="flex-start" mb="xs">
                        <div className="flex-1">
                          <Group gap="sm" align="center" mb="xs">
                            <Text fw={500} size="sm" className="text-gray-8">
                              {event.title}
                            </Text>
                            {event.status && (
                              <Badge 
                                size="xs" 
                                color={event.color} 
                                variant="light"
                              >
                                {event.status.toUpperCase()}
                              </Badge>
                            )}
                          </Group>
                          
                          <Text size="sm" c="dimmed" mb="xs">
                            {event.description}
                          </Text>
                          
                          <Group gap="lg">
                            <Text size="xs" c="dimmed">
                              <IconCalendar size={12} className="inline mr-1" />
                              {formatDateTime(event.date)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {getRelativeTime(event.date)}
                            </Text>
                          </Group>
                        </div>
                        
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <ActionIcon variant="subtle" size="sm">
                              <IconMoreHorizontal size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconEye size={12} />}>
                              View Details
                            </Menu.Item>
                            <Menu.Item leftSection={<IconNotes size={12} />}>
                              Add Note
                            </Menu.Item>
                            <Menu.Item leftSection={<IconPrinter size={12} />}>
                              Print
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Paper>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </div>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

export default PatientTimeline;