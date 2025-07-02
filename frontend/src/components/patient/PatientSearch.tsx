'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Patient, Bundle, BundleEntry } from '@medplum/fhirtypes';
import { useMedplum, useMedplumContext } from '@medplum/react';
import {
  Card,
  Title,
  Box,
  Group,
  Button,
  Text,
  Badge,
  Stack,
  TextInput,
  Select,
  MultiSelect,
  RangeSlider,
  Checkbox,
  Grid,
  ActionIcon,
  Collapse,
  Paper,
  Loader,
  Center,
  SegmentedControl,
  ScrollArea,
  Transition,
  Drawer,
  CloseButton,
  rem,
  useMantineTheme,
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconX,
  IconUser,
  IconCalendar,
  IconPhone,
  IconMail,
  IconChevronDown,
  IconChevronUp,
  IconList,
  IconLayoutGrid,
  IconRefresh,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useDebouncedValue, useDisclosure, useMediaQuery } from '@mantine/hooks';
import { patientHelpers } from '@/lib/medplum';
import { PatientCard } from './PatientCard';

interface SearchFilters {
  name: string;
  mrn: string;
  phone: string;
  email: string;
  gender: string[];
  ageRange: [number, number];
  status: string[];
  city: string;
  state: string;
}

const initialFilters: SearchFilters = {
  name: '',
  mrn: '',
  phone: '',
  email: '',
  gender: [],
  ageRange: [0, 100],
  status: ['active'],
  city: '',
  state: '',
};

export function PatientSearch() {
  const medplum = useMedplum();
  const { loading: medplumLoading } = useMedplumContext();
  const router = useRouter();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const isTablet = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [quickSearch, setQuickSearch] = useState('');
  const [debouncedQuickSearch] = useDebouncedValue(quickSearch, 300);
  const [debouncedFilters] = useDebouncedValue(filters, 500);
  
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'list' : 'grid');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  
  // Touch gesture handling for mobile
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = Math.abs(touchEnd.y - touchStart.y);
    
    // Horizontal swipe detection
    if (Math.abs(deltaX) > 50 && deltaY < 50) {
      if (deltaX > 0) {
        // Swipe right - could be used for navigation
      } else {
        // Swipe left - open filters
        if (isMobile) {
          openDrawer();
        }
      }
    }
    
    setTouchStart(null);
  }, [touchStart, isMobile, openDrawer]);
  
  // Build search parameters from filters
  const buildSearchParams = useCallback(() => {
    const params: any = {
      _count: 50,
      _sort: '-_lastUpdated',
    };
    
    // Quick search across multiple fields
    if (debouncedQuickSearch) {
      params._content = debouncedQuickSearch;
    }
    
    // Advanced filters
    if (debouncedFilters.name) {
      params.name = debouncedFilters.name;
    }
    
    if (debouncedFilters.mrn) {
      params.identifier = debouncedFilters.mrn;
    }
    
    if (debouncedFilters.phone) {
      params.phone = debouncedFilters.phone;
    }
    
    if (debouncedFilters.email) {
      params.email = debouncedFilters.email;
    }
    
    if (debouncedFilters.gender.length > 0) {
      params.gender = debouncedFilters.gender.join(',');
    }
    
    if (debouncedFilters.status.length > 0) {
      params.active = debouncedFilters.status.includes('active');
    }
    
    if (debouncedFilters.city) {
      params['address-city'] = debouncedFilters.city;
    }
    
    if (debouncedFilters.state) {
      params['address-state'] = debouncedFilters.state;
    }
    
    return params;
  }, [debouncedQuickSearch, debouncedFilters]);
  
  // Perform search
  const performSearch = useCallback(async () => {
    if (!medplum || medplumLoading) return;
    
    setLoading(true);
    try {
      const searchParams = buildSearchParams();
      const bundle = await medplum.search('Patient', searchParams);
      
      const patients: Patient[] = [];
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource?.resourceType === 'Patient') {
            patients.push(entry.resource as Patient);
          }
        }
      }
      
      // Filter by age range if specified
      const filteredPatients = patients.filter((patient) => {
        if (debouncedFilters.ageRange[0] === 0 && debouncedFilters.ageRange[1] === 100) {
          return true;
        }
        const age = patientHelpers.getAge(patient);
        return age >= debouncedFilters.ageRange[0] && age <= debouncedFilters.ageRange[1];
      });
      
      setSearchResults(filteredPatients);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [medplum, medplumLoading, buildSearchParams, debouncedFilters.ageRange]);
  
  // Trigger search on filter changes
  useEffect(() => {
    performSearch();
  }, [performSearch]);
  
  const handlePatientClick = useCallback((patient: Patient) => {
    if (patient.id) {
      router.push(`/dashboard/patients/${patient.id}`);
    }
  }, [router]);
  
  const handleResetFilters = useCallback(() => {
    setFilters(initialFilters);
    setQuickSearch('');
  }, []);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.name) count++;
    if (filters.mrn) count++;
    if (filters.phone) count++;
    if (filters.email) count++;
    if (filters.gender.length > 0) count++;
    if (filters.ageRange[0] !== 0 || filters.ageRange[1] !== 100) count++;
    if (filters.status.length !== 1 || filters.status[0] !== 'active') count++;
    if (filters.city) count++;
    if (filters.state) count++;
    return count;
  }, [filters]);
  
  // Filter controls component
  const FilterControls = () => (
    <Stack gap="md">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Name"
            placeholder="First or last name"
            value={filters.name}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            leftSection={<IconUser size={16} />}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="MRN"
            placeholder="Medical Record Number"
            value={filters.mrn}
            onChange={(e) => setFilters({ ...filters, mrn: e.target.value })}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Phone"
            placeholder="Phone number"
            value={filters.phone}
            onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
            leftSection={<IconPhone size={16} />}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Email"
            placeholder="Email address"
            value={filters.email}
            onChange={(e) => setFilters({ ...filters, email: e.target.value })}
            leftSection={<IconMail size={16} />}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <MultiSelect
            label="Gender"
            placeholder="Select gender(s)"
            data={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
            value={filters.gender}
            onChange={(value) => setFilters({ ...filters, gender: value })}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <MultiSelect
            label="Status"
            placeholder="Patient status"
            data={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
          />
        </Grid.Col>
        
        <Grid.Col span={12}>
          <Text size="sm" fw={500} mb="xs">
            Age Range: {filters.ageRange[0]} - {filters.ageRange[1]} years
          </Text>
          <RangeSlider
            value={filters.ageRange}
            onChange={(value) => setFilters({ ...filters, ageRange: value })}
            min={0}
            max={100}
            step={5}
            marks={[
              { value: 0, label: '0' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 75, label: '75' },
              { value: 100, label: '100+' },
            ]}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="City"
            placeholder="City"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="State"
            placeholder="State"
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          />
        </Grid.Col>
      </Grid>
      
      <Group>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={handleResetFilters}
        >
          Reset Filters
        </Button>
      </Group>
    </Stack>
  );
  
  return (
    <Box onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Stack gap="md">
        {/* Header */}
        <Card>
          <Stack gap="md">
            <Group justify="space-between" wrap="nowrap">
              <Title order={2}>
                <Group gap="xs">
                  <IconUser size={24} />
                  Patient Search
                </Group>
              </Title>
              
              {!isMobile && (
                <Group>
                  <SegmentedControl
                    value={viewMode}
                    onChange={(value) => setViewMode(value as 'grid' | 'list')}
                    data={[
                      { label: <IconLayoutGrid size={16} />, value: 'grid' },
                      { label: <IconList size={16} />, value: 'list' },
                    ]}
                  />
                </Group>
              )}
            </Group>
            
            {/* Quick Search */}
            <TextInput
              placeholder="Quick search by name, MRN, phone, or email..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
              rightSection={
                quickSearch && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => setQuickSearch('')}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )
              }
              size={isMobile ? 'md' : 'lg'}
            />
            
            {/* Filter Toggle */}
            <Group justify="space-between">
              <Button
                variant={showAdvanced ? 'filled' : 'light'}
                leftSection={<IconFilter size={16} />}
                rightSection={
                  activeFilterCount > 0 && (
                    <Badge size="sm" variant="filled" color="red">
                      {activeFilterCount}
                    </Badge>
                  )
                }
                onClick={() => {
                  if (isMobile) {
                    openDrawer();
                  } else {
                    setShowAdvanced(!showAdvanced);
                  }
                }}
              >
                Advanced Filters
                {!isMobile && (
                  showAdvanced ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
                )}
              </Button>
              
              <Text size="sm" c="dimmed">
                {loading ? 'Searching...' : `${searchResults.length} patients found`}
              </Text>
            </Group>
            
            {/* Desktop Advanced Filters */}
            {!isMobile && (
              <Collapse in={showAdvanced}>
                <Paper p="md" withBorder>
                  <FilterControls />
                </Paper>
              </Collapse>
            )}
          </Stack>
        </Card>
        
        {/* Mobile Filter Drawer */}
        <Drawer
          opened={drawerOpened}
          onClose={closeDrawer}
          title="Advanced Filters"
          position="right"
          size="full"
          padding="md"
        >
          <ScrollArea h="calc(100vh - 80px)">
            <FilterControls />
          </ScrollArea>
        </Drawer>
        
        {/* Search Results */}
        {loading ? (
          <Center h={200}>
            <Loader size="lg" />
          </Center>
        ) : searchResults.length === 0 ? (
          <Card>
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconSearch size={48} style={{ opacity: 0.5 }} />
                <Text c="dimmed">No patients found</Text>
                <Text size="sm" c="dimmed">
                  Try adjusting your search criteria
                </Text>
              </Stack>
            </Center>
          </Card>
        ) : viewMode === 'grid' && !isMobile ? (
          <Grid>
            {searchResults.map((patient) => (
              <Grid.Col key={patient.id} span={{ base: 12, sm: 6, lg: 4 }}>
                <PatientCard
                  patient={patient}
                  onClick={() => handlePatientClick(patient)}
                />
              </Grid.Col>
            ))}
          </Grid>
        ) : (
          <Stack gap="xs">
            {searchResults.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onClick={() => handlePatientClick(patient)}
                variant="list"
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}