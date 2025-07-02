'use client';

import { useState } from 'react';
import {
  Card,
  TextInput,
  Select,
  Group,
  Button,
  Stack,
  Box,
} from '@mantine/core';
import { IconSearch, IconFilter } from '@tabler/icons-react';

export interface PatientFilters {
  searchQuery?: string;
  status?: string;
  gender?: string;
  ageRange?: string;
}

interface SimplePatientSearchFiltersProps {
  filters: PatientFilters;
  onFiltersChange: (filters: PatientFilters) => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  isLoading?: boolean;
}

const SimplePatientSearchFilters: React.FC<SimplePatientSearchFiltersProps> = ({
  filters,
  onFiltersChange,
  showAdvanced = false,
  onToggleAdvanced,
  isLoading = false,
}) => {
  const handleFilterChange = (key: keyof PatientFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Box data-testid="patient-filters">
      <Card withBorder p="md" mb="md">
        <Stack gap="md">
          {/* Primary Search */}
          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Search patients by name, MRN, DOB, phone..."
              leftSection={<IconSearch size={16} />}
              value={filters.searchQuery || ''}
              onChange={(event) => handleFilterChange('searchQuery', event.currentTarget.value)}
              style={{ flex: 1 }}
              aria-label="Search patients"
              disabled={isLoading}
            />
            
            <Button
              variant="light"
              leftSection={<IconFilter size={16} />}
              onClick={onToggleAdvanced}
            >
              {showAdvanced ? 'Hide' : 'Show'} Filters
            </Button>
          </Group>

          {/* Advanced Filters */}
          {showAdvanced && (
            <Group gap="md">
              <Select
                label="Status"
                value={filters.status || ''}
                onChange={(value) => handleFilterChange('status', value)}
                data={[
                  { value: '', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                disabled={isLoading}
                aria-label="Patient status filter"
              />
              
              <Select
                label="Gender"
                value={filters.gender || ''}
                onChange={(value) => handleFilterChange('gender', value)}
                data={[
                  { value: '', label: 'All Genders' },
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
                disabled={isLoading}
                aria-label="Gender filter"
              />
              
              <Select
                label="Age Range"
                value={filters.ageRange || ''}
                onChange={(value) => handleFilterChange('ageRange', value)}
                data={[
                  { value: '', label: 'All Ages' },
                  { value: '0-17', label: 'Pediatric (0-17)' },
                  { value: '18-64', label: 'Adult (18-64)' },
                  { value: '65+', label: 'Senior (65+)' },
                ]}
                disabled={isLoading}
                aria-label="Age range filter"
              />
            </Group>
          )}
        </Stack>
      </Card>
    </Box>
  );
};

export default SimplePatientSearchFilters;