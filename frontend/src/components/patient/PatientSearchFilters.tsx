'use client';

import React, { useCallback, useMemo } from 'react';
import {
  Card,
  TextInput,
  Select,
  Group,
  Button,
  Collapse,
  SimpleGrid,
  Stack,
  Text,
  Box,
  ActionIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { 
  IconSearch, 
  IconFilter, 
  IconFilterOff, 
  IconChevronDown, 
  IconChevronUp 
} from '@tabler/icons-react';
import { useDebouncedCallback, useMediaQuery } from '@mantine/hooks';

export interface PatientFilters {
  searchQuery?: string;
  status?: string;
  gender?: string;
  ageRange?: string;
  lastVisitAfter?: Date | null;
  hasActiveConditions?: boolean;
  hasActiveOrders?: boolean;
  hasUnreadMessages?: boolean;
  practitioner?: string;
  insuranceProvider?: string;
}

interface PatientSearchFiltersProps {
  filters: PatientFilters;
  onFiltersChange: (filters: PatientFilters) => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  isLoading?: boolean;
}

// Move static filter options outside component to avoid recreation
const FILTER_OPTIONS = {
  status: [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'deceased', label: 'Deceased' },
  ],
  gender: [
    { value: '', label: 'All Genders' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'unknown', label: 'Unknown' },
  ],
  ageRange: [
    { value: '', label: 'All Ages' },
    { value: '0-17', label: 'Pediatric (0-17)' },
    { value: '18-64', label: 'Adult (18-64)' },
    { value: '65+', label: 'Senior (65+)' },
  ],
  practitioner: [
    { value: '', label: 'All Practitioners' },
    { value: 'dr-smith', label: 'Dr. Sarah Smith' },
    { value: 'dr-johnson', label: 'Dr. Michael Johnson' },
    { value: 'dr-williams', label: 'Dr. Emily Williams' },
  ],
  insuranceProvider: [
    { value: '', label: 'All Insurance' },
    { value: 'bcbs', label: 'Blue Cross Blue Shield' },
    { value: 'aetna', label: 'Aetna' },
    { value: 'united', label: 'United Healthcare' },
    { value: 'cigna', label: 'Cigna' },
    { value: 'medicare', label: 'Medicare' },
    { value: 'medicaid', label: 'Medicaid' },
  ],
} as const;

const PatientSearchFilters: React.FC<PatientSearchFiltersProps> = ({
  filters,
  onFiltersChange,
  showAdvanced = false,
  onToggleAdvanced,
  isLoading = false,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  // Debounced search to avoid excessive API calls
  const debouncedSearchChange = useDebouncedCallback(
    (value: string) => {
      onFiltersChange({ ...filters, searchQuery: value });
    },
    300
  );

  const handleFilterChange = useCallback(
    (key: keyof PatientFilters, value: any) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({
      searchQuery: '',
      status: '',
      gender: '',
      ageRange: '',
      lastVisitAfter: null,
      hasActiveConditions: false,
      hasActiveOrders: false,
      hasUnreadMessages: false,
      practitioner: '',
      insuranceProvider: '',
    });
  }, [onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'searchQuery') return value && value.length > 0;
      if (typeof value === 'boolean') return value;
      return value && value !== '';
    });
  }, [filters]);


  return (
    <Box data-testid="patient-filters" className="responsive-grid">
      <Card withBorder p={isMobile ? 'xs' : 'md'} mb="md">
        <Stack gap="md">
          {/* Primary Search */}
          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Search patients by name, MRN, DOB, phone..."
              leftSection={<IconSearch size={16} />}
              value={filters.searchQuery || ''}
              onChange={(event) => debouncedSearchChange(event.currentTarget.value)}
              style={{ flex: 1 }}
              size={isMobile ? 'sm' : 'md'}
              aria-label="Search patients"
              disabled={isLoading}
            />
            
            <Button
              variant="light"
              leftSection={<IconFilter size={16} />}
              onClick={onToggleAdvanced}
              size={isMobile ? 'sm' : 'md'}
              visibleFrom="sm"
            >
              {showAdvanced ? 'Hide' : 'Show'} Filters
            </Button>
            
            <ActionIcon
              variant="light"
              onClick={onToggleAdvanced}
              size={isMobile ? 'sm' : 'md'}
              hiddenFrom="sm"
              aria-label="Toggle filters"
            >
              {showAdvanced ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </Group>

          {/* Quick Filter Pills */}
          <Group gap="xs" wrap="wrap">
            <Button
              size="xs"
              variant={filters.hasActiveConditions ? 'filled' : 'light'}
              onClick={() => handleFilterChange('hasActiveConditions', !filters.hasActiveConditions)}
              disabled={isLoading}
            >
              Active Conditions
            </Button>
            <Button
              size="xs"
              variant={filters.hasActiveOrders ? 'filled' : 'light'}
              onClick={() => handleFilterChange('hasActiveOrders', !filters.hasActiveOrders)}
              disabled={isLoading}
            >
              Active Orders
            </Button>
            <Button
              size="xs"
              variant={filters.hasUnreadMessages ? 'filled' : 'light'}
              onClick={() => handleFilterChange('hasUnreadMessages', !filters.hasUnreadMessages)}
              disabled={isLoading}
            >
              Unread Messages
            </Button>
          </Group>

          {/* Advanced Filters */}
          <Collapse in={showAdvanced}>
            <Stack gap="md">
              <Text size="sm" fw={500} c="dimmed">
                Advanced Filters
              </Text>
              
              <SimpleGrid
                cols={{ base: 1, xs: 2, sm: 3, md: 4 }}
                spacing="md"
                className="responsive-grid"
              >
                <Select
                  label="Status"
                  value={filters.status || ''}
                  onChange={(value) => handleFilterChange('status', value)}
                  data={FILTER_OPTIONS.status}
                  size={isMobile ? 'sm' : 'md'}
                  disabled={isLoading}
                  aria-label="Patient status filter"
                />
                
                <Select
                  label="Gender"
                  value={filters.gender || ''}
                  onChange={(value) => handleFilterChange('gender', value)}
                  data={FILTER_OPTIONS.gender}
                  size={isMobile ? 'sm' : 'md'}
                  disabled={isLoading}
                  aria-label="Gender filter"
                />
                
                <Select
                  label="Age Range"
                  value={filters.ageRange || ''}
                  onChange={(value) => handleFilterChange('ageRange', value)}
                  data={FILTER_OPTIONS.ageRange}
                  size={isMobile ? 'sm' : 'md'}
                  disabled={isLoading}
                  aria-label="Age range filter"
                />
                
                <DateInput
                  label="Last Visit After"
                  value={filters.lastVisitAfter}
                  onChange={(value) => handleFilterChange('lastVisitAfter', value)}
                  clearable
                  size={isMobile ? 'sm' : 'md'}
                  disabled={isLoading}
                  aria-label="Last visit after date"
                />
                
                <Select
                  label="Primary Care Provider"
                  value={filters.practitioner || ''}
                  onChange={(value) => handleFilterChange('practitioner', value)}
                  data={FILTER_OPTIONS.practitioner}
                  size={isMobile ? 'sm' : 'md'}
                  disabled={isLoading}
                  searchable
                  aria-label="Primary care provider filter"
                />
                
                <Select
                  label="Insurance Provider"
                  value={filters.insuranceProvider || ''}
                  onChange={(value) => handleFilterChange('insuranceProvider', value)}
                  data={FILTER_OPTIONS.insuranceProvider}
                  size={isMobile ? 'sm' : 'md'}
                  disabled={isLoading}
                  searchable
                  aria-label="Insurance provider filter"
                />
              </SimpleGrid>

              {/* Filter Actions */}
              <Group justify="space-between" mt="md">
                <Text size="xs" c="dimmed">
                  {hasActiveFilters ? 'Filters applied' : 'No filters applied'}
                </Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconFilterOff size={14} />}
                    onClick={clearFilters}
                    disabled={!hasActiveFilters || isLoading}
                  >
                    Clear All
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Collapse>
        </Stack>
      </Card>
    </Box>
  );
};

export default React.memo(PatientSearchFilters);

// Export the non-memoized component for testing
export { PatientSearchFilters };