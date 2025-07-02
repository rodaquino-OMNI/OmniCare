'use client';

import { useState, useEffect } from 'react';
import { 
  Patient, 
  Observation, 
  DiagnosticReport,
  ServiceRequest,
  Reference,
  CodeableConcept
} from '@medplum/fhirtypes';
import { 
  ObservationTable,
  DiagnosticReportDisplay,
  ResourceTable,
  useMedplum,
  createReference
} from '@medplum/react';
import { 
  Card, 
  Title, 
  Stack, 
  Group, 
  Button,
  Badge,
  Tabs,
  Text,
  Select,
  Modal,
  Paper,
  Alert,
  Loader,
  ActionIcon,
  Grid,
  ScrollArea
} from '@mantine/core';
import { 
  IconFlask, 
  IconRefresh,
  IconDownload,
  IconPrinter,
  IconChartLine,
  IconTable,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconCalendar,
  IconFilter
} from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { observationHelpers } from '@/lib/medplum';
import { formatDateTime, formatDate } from '@/utils';
import { getErrorMessage } from '@/utils/error.utils';

interface LabResultsProps {
  patient: Patient;
  encounterId?: string;
}

export function LabResults({ patient, encounterId }: LabResultsProps) {
  const medplum = useMedplum();
  const [activeTab, setActiveTab] = useState<string | null>('recent');
  const [loading, setLoading] = useState(false);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [diagnosticReports, setDiagnosticReports] = useState<DiagnosticReport[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [selectedReport, setSelectedReport] = useState<DiagnosticReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Lab categories
  const labCategories = [
    { value: 'all', label: 'All Labs' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'hematology', label: 'Hematology' },
    { value: 'microbiology', label: 'Microbiology' },
    { value: 'pathology', label: 'Pathology' },
    { value: 'radiology', label: 'Radiology' },
    { value: 'cardiology', label: 'Cardiology' }
  ];

  useEffect(() => {
    loadLabResults();
  }, [patient.id, selectedCategory, dateRange]);

  const loadLabResults = async () => {
    if (!patient.id) return;
    
    setLoading(true);
    try {
      // Build search parameters
      const searchParams: Record<string, string> = {
        patient: patient.id,
        category: 'laboratory',
        _sort: '-date',
        _count: '50'
      };

      // Add date range filter if specified
      if (dateRange[0] && dateRange[1]) {
        searchParams.date = `ge${dateRange[0].toISOString()},le${dateRange[1].toISOString()}`;
      }

      // Add category filter if not 'all'
      if (selectedCategory !== 'all') {
        searchParams.code = getCategoryCode(selectedCategory);
      }

      // Load observations and diagnostic reports
      const [obs, reports] = await Promise.all([
        medplum.searchResources('Observation', searchParams),
        medplum.searchResources('DiagnosticReport', {
          patient: patient.id,
          _sort: '-issued',
          _count: '20'
        })
      ]);

      setObservations(obs);
      setDiagnosticReports(reports);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Error loading lab results:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryCode = (category: string): string => {
    const categoryCodes: Record<string, string> = {
      chemistry: '27571106',
      hematology: '252275004',
      microbiology: '1985109',
      pathology: '371525003',
      radiology: '3636795',
      cardiology: '722164'
    };
    return categoryCodes[category] || '';
  };

  const handleRefresh = () => {
    loadLabResults();
  };

  const handleViewReport = (report: DiagnosticReport) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  // Get abnormal results count
  const abnormalCount = observations.filter(obs => 
    observationHelpers.isAbnormal(obs)
  ).length;

  // Define columns for diagnostic reports table
  const reportColumns = [
    {
      name: 'Report',
      selector: (report: DiagnosticReport) => (
        <div>
          <Text fw={500}>{report.code?.text || 'Lab Report'}</Text>
          <Text size="xs" c="dimmed">
            {report.code?.coding?.[0]?.display}
          </Text>
        </div>
      ),
    },
    {
      name: 'Status',
      selector: (report: DiagnosticReport) => (
        <Badge 
          color={report.status === 'final' ? 'green' : 'orange'} 
          variant="light"
        >
          {report.status}
        </Badge>
      ),
    },
    {
      name: 'Date',
      selector: (report: DiagnosticReport) => formatDateTime(report.issued || ''),
      sortable: true,
    },
    {
      name: 'Actions',
      selector: (report: DiagnosticReport) => (
        <Group gap="xs">
          <Button 
            size="xs" 
            variant="subtle"
            onClick={() => handleViewReport(report)}
          >
            View
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {/* Header */}
      <Card>
        <Group justify="space-between">
          <Title order={2}>
            <Group gap="xs">
              <IconFlask size={24} />
              Laboratory Results
            </Group>
          </Title>
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={handleRefresh}>
              <IconRefresh size={20} />
            </ActionIcon>
            <ActionIcon variant="subtle">
              <IconDownload size={20} />
            </ActionIcon>
            <ActionIcon variant="subtle">
              <IconPrinter size={20} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Abnormal Results Alert */}
        {abnormalCount > 0 && (
          <Alert 
            icon={<IconAlertTriangle size={16} />} 
            color="orange" 
            variant="light"
            mt="md"
          >
            <Text fw={500}>
              {abnormalCount} abnormal result{abnormalCount > 1 ? 's' : ''} found
            </Text>
          </Alert>
        )}

        {/* Filters */}
        <Grid mt="md">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Select
              label="Category"
              data={labCategories}
              value={selectedCategory}
              onChange={(value) => value && setSelectedCategory(value)}
              leftSection={<IconFilter size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <DatePickerInput
              type="range"
              label="Date Range"
              placeholder="Select date range"
              value={dateRange}
              onChange={setDateRange}
              leftSection={<IconCalendar size={16} />}
              clearable
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Results Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="recent" leftSection={<IconClock size={16} />}>
              Recent Results
            </Tabs.Tab>
            <Tabs.Tab value="reports" leftSection={<IconFlask size={16} />}>
              Lab Reports
            </Tabs.Tab>
            <Tabs.Tab value="trending" leftSection={<IconChartLine size={16} />}>
              Trending
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="recent" pt="md">
            {loading ? (
              <Stack align="center" py="xl">
                <Loader size="lg" />
                <Text>Loading lab results...</Text>
              </Stack>
            ) : observations.length === 0 ? (
              <Stack align="center" gap="xs" py="xl">
                <IconFlask size={48} style={{ opacity: .5 }} />
                <Text c="dimmed">No lab results found</Text>
                <Text size="sm" c="dimmed">
                  Try adjusting your filters or date range
                </Text>
              </Stack>
            ) : (
              <Stack gap="md">
                {/* View Mode Toggle */}
                <Group justify="flex-end">
                  <Button.Group>
                    <Button
                      variant={viewMode === 'table' ? 'filled' : 'light'}
                      size="xs"
                      leftSection={<IconTable size={16} />}
                      onClick={() => setViewMode('table')}
                    >
                      Table
                    </Button>
                    <Button
                      variant={viewMode === 'graph' ? 'filled' : 'light'}
                      size="xs"
                      leftSection={<IconChartLine size={16} />}
                      onClick={() => setViewMode('graph')}
                    >
                      Graph
                    </Button>
                  </Button.Group>
                </Group>

                {viewMode === 'table' ? (
                  <ObservationTable
                    observations={observations}
                    showCategory
                    showDate
                    showPerformer
                    onRowClick={(obs) => console.log('Clicked:', obs)}
                  />
                ) : (
                  <Paper p="md" withBorder>
                    {/* ObservationGraph is not available in @medplum/react */}
                    <Text c="dimmed" ta="center" py="xl">
                      Graphical view is temporarily unavailable
                    </Text>
                  </Paper>
                )}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="reports" pt="md">
            {loading ? (
              <Stack align="center" py="xl">
                <Loader size="lg" />
                <Text>Loading reports...</Text>
              </Stack>
            ) : (
              <ResourceTable
                resourceType="DiagnosticReport"
                columns={reportColumns}
                value={diagnosticReports}
                emptyMessage={
                  <Stack align="center" gap="xs" py="xl">
                    <IconFlask size={48} style={{ opacity: .5 }} />
                    <Text c="dimmed">No lab reports found</Text>
                  </Stack>
                }
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="trending" pt="md">
            <TrendingResults 
              patient={patient} 
              observations={observations}
            />
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Report Detail Modal */}
      <Modal
        opened={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setSelectedReport(null);
        }}
        title="Lab Report Details"
        size="xl"
      >
        {selectedReport && (
          <ScrollArea h={600}>
            <DiagnosticReportDisplay
              value={selectedReport}
            />
          </ScrollArea>
        )}
      </Modal>
    </Stack>
  );
}

// Trending Results Component
interface TrendingResultsProps {
  patient: Patient;
  observations: Observation[];
}

function TrendingResults({ patient, observations }: TrendingResultsProps) {
  const [selectedTest, setSelectedTest] = useState<string>('');
  
  // Get unique test types from observations
  const testTypes = Array.from(
    new Set(observations.map(obs => obs.code?.text || ''))
  ).filter(Boolean);

  const filteredObservations = selectedTest
    ? observations.filter(obs => obs.code?.text === selectedTest)
    : observations;

  return (
    <Stack gap="md">
      <Select
        label="Select Test to Trend"
        placeholder="Choose a test type"
        data={testTypes}
        value={selectedTest}
        onChange={(value) => value && setSelectedTest(value)}
        clearable
      />

      {selectedTest && filteredObservations.length > 0 ? (
        <Paper p="md" withBorder>
          {/* ObservationGraph is not available in @medplum/react */}
          <Stack align="center" py="xl">
            <Text c="dimmed">Trend graph for {selectedTest}</Text>
            <Text size="sm" c="dimmed">Graphical view is temporarily unavailable</Text>
          </Stack>
        </Paper>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select a test type to view trends
        </Text>
      )}

      {selectedTest && filteredObservations.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md">Reference Range</Title>
          <Text size="sm">
            {observationHelpers.getReferenceRange(filteredObservations[0])}
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

export default LabResults;
