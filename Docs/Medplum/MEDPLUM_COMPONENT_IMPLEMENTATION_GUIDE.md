# Medplum Component Implementation Guide for OmniCare

## Quick Start: Priority Components to Implement

This guide provides practical implementation examples for the highest-priority Medplum-inspired components that OmniCare should adopt.

## 1. ResourceForm Component

### Implementation Example

```typescript
// components/fhir/ResourceForm/ResourceForm.tsx
import React, { useMemo } from 'react';
import { Resource, StructureDefinition } from '@medplum/fhirtypes';
import { Stack, Button, LoadingOverlay } from '@mantine/core';
import { getResourcePropertyDisplay, tryGetPropertySchema } from '@/utils/fhir';

interface ResourceFormProps<T extends Resource> {
  resourceType: string;
  value?: T;
  onChange: (resource: T) => void;
  onSubmit?: (resource: T) => void;
  fields?: string[];
  readOnly?: boolean;
  profileUrl?: string;
  enableOffline?: boolean;
}

export function ResourceForm<T extends Resource>({
  resourceType,
  value,
  onChange,
  onSubmit,
  fields,
  readOnly = false,
  profileUrl,
  enableOffline = true
}: ResourceFormProps<T>) {
  const [loading, setLoading] = React.useState(false);
  const [schema, setSchema] = React.useState<StructureDefinition | null>(null);
  
  // Load resource schema
  React.useEffect(() => {
    loadResourceSchema(resourceType, profileUrl);
  }, [resourceType, profileUrl]);
  
  const formFields = useMemo(() => {
    if (!schema) return [];
    
    // Get fields from schema or use provided fields
    const schemaFields = getFieldsFromSchema(schema);
    return fields || schemaFields;
  }, [schema, fields]);
  
  const handleFieldChange = (fieldPath: string, value: any) => {
    const updatedResource = updateResourceField(value || {} as T, fieldPath, value);
    onChange(updatedResource);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit && value) {
      onSubmit(value);
    }
  };
  
  if (loading || !schema) {
    return <LoadingOverlay visible />;
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {formFields.map(field => (
          <ResourceFormField
            key={field}
            fieldPath={field}
            value={getFieldValue(value, field)}
            onChange={(val) => handleFieldChange(field, val)}
            schema={getFieldSchema(schema, field)}
            readOnly={readOnly}
          />
        ))}
        
        {onSubmit && !readOnly && (
          <Button type="submit" disabled={!value}>
            Save {resourceType}
          </Button>
        )}
      </Stack>
    </form>
  );
}

// ResourceFormField component for individual fields
function ResourceFormField({ 
  fieldPath, 
  value, 
  onChange, 
  schema, 
  readOnly 
}: any) {
  // Implement field rendering based on FHIR type
  const fieldType = schema?.type?.[0]?.code;
  
  switch (fieldType) {
    case 'string':
      return (
        <TextInput
          label={getFieldLabel(fieldPath, schema)}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          required={schema?.min > 0}
        />
      );
    
    case 'boolean':
      return (
        <Checkbox
          label={getFieldLabel(fieldPath, schema)}
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          readOnly={readOnly}
        />
      );
    
    case 'date':
      return (
        <DateInput
          label={getFieldLabel(fieldPath, schema)}
          value={value ? new Date(value) : null}
          onChange={(date) => onChange(date?.toISOString().split('T')[0])}
          readOnly={readOnly}
          required={schema?.min > 0}
        />
      );
    
    case 'CodeableConcept':
      return (
        <CodeableConceptInput
          label={getFieldLabel(fieldPath, schema)}
          value={value}
          onChange={onChange}
          binding={schema?.binding}
          readOnly={readOnly}
          required={schema?.min > 0}
        />
      );
    
    case 'Reference':
      return (
        <ReferenceInput
          label={getFieldLabel(fieldPath, schema)}
          value={value}
          onChange={onChange}
          targetTypes={schema?.targetProfile}
          readOnly={readOnly}
          required={schema?.min > 0}
        />
      );
    
    default:
      return (
        <TextInput
          label={getFieldLabel(fieldPath, schema)}
          value={JSON.stringify(value || '')}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          readOnly={readOnly}
        />
      );
  }
}
```

### Usage Example

```typescript
// Using ResourceForm in a component
function PatientEditForm({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<Patient | undefined>();
  const { saveResource } = useFHIR();
  
  return (
    <ResourceForm
      resourceType="Patient"
      value={patient}
      onChange={setPatient}
      fields={['name', 'birthDate', 'gender', 'address', 'telecom']}
      onSubmit={async (updatedPatient) => {
        await saveResource(updatedPatient);
        notifications.show({
          title: 'Success',
          message: 'Patient saved successfully'
        });
      }}
      enableOffline={true}
    />
  );
}
```

## 2. SearchControl Component

### Implementation Example

```typescript
// components/fhir/SearchControl/SearchControl.tsx
import React, { useState, useCallback } from 'react';
import { 
  TextInput, 
  Select, 
  Group, 
  Button, 
  Stack, 
  Paper,
  Badge,
  ActionIcon,
  Menu
} from '@mantine/core';
import { IconSearch, IconFilter, IconDownload, IconPlus } from '@tabler/icons-react';
import { Bundle, Resource } from '@medplum/fhirtypes';

interface SearchField {
  name: string;
  label: string;
  type: 'string' | 'date' | 'reference' | 'token';
  placeholder?: string;
}

interface SearchControlProps<T extends Resource> {
  resourceType: string;
  fields?: SearchField[];
  onSearch: (params: Record<string, string>) => Promise<Bundle<T>>;
  onResultClick?: (resource: T) => void;
  onCreate?: () => void;
  enableExport?: boolean;
  enableBatchOperations?: boolean;
  savedSearches?: SavedSearch[];
}

export function SearchControl<T extends Resource>({
  resourceType,
  fields = defaultSearchFields[resourceType] || [],
  onSearch,
  onResultClick,
  onCreate,
  enableExport = true,
  enableBatchOperations = false,
  savedSearches = []
}: SearchControlProps<T>) {
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const bundle = await onSearch(searchParams);
      const resources = bundle.entry?.map(e => e.resource as T) || [];
      setResults(resources);
    } catch (error) {
      notifications.show({
        title: 'Search Failed',
        message: 'Unable to perform search',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, [searchParams, onSearch]);
  
  const handleExport = useCallback((format: 'csv' | 'json' | 'fhir') => {
    const selectedResources = results.filter(r => 
      selectedItems.has(r.id!) || selectedItems.size === 0
    );
    
    switch (format) {
      case 'csv':
        exportAsCSV(selectedResources, resourceType);
        break;
      case 'json':
        exportAsJSON(selectedResources);
        break;
      case 'fhir':
        exportAsFHIRBundle(selectedResources);
        break;
    }
  }, [results, selectedItems, resourceType]);
  
  return (
    <Stack gap="md">
      {/* Search Fields */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Search {resourceType}</Text>
            <Group gap="xs">
              {onCreate && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  size="sm"
                  onClick={onCreate}
                >
                  New {resourceType}
                </Button>
              )}
              
              {savedSearches.length > 0 && (
                <Menu>
                  <Menu.Target>
                    <Button variant="light" size="sm">
                      Saved Searches
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {savedSearches.map(search => (
                      <Menu.Item
                        key={search.id}
                        onClick={() => setSearchParams(search.params)}
                      >
                        {search.name}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
          
          <Grid>
            {fields.map(field => (
              <Grid.Col key={field.name} span={6}>
                <SearchField
                  field={field}
                  value={searchParams[field.name] || ''}
                  onChange={(value) => setSearchParams(prev => ({
                    ...prev,
                    [field.name]: value
                  }))}
                />
              </Grid.Col>
            ))}
          </Grid>
          
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => setSearchParams({})}
            >
              Clear
            </Button>
            <Button
              leftSection={<IconSearch size={16} />}
              onClick={handleSearch}
              loading={loading}
            >
              Search
            </Button>
          </Group>
        </Stack>
      </Paper>
      
      {/* Results */}
      {results.length > 0 && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="sm">
                <Text fw={600}>{results.length} Results</Text>
                {enableBatchOperations && selectedItems.size > 0 && (
                  <Badge>{selectedItems.size} selected</Badge>
                )}
              </Group>
              
              {enableExport && (
                <Menu>
                  <Menu.Target>
                    <Button
                      variant="light"
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                    >
                      Export
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => handleExport('csv')}>
                      Export as CSV
                    </Menu.Item>
                    <Menu.Item onClick={() => handleExport('json')}>
                      Export as JSON
                    </Menu.Item>
                    <Menu.Item onClick={() => handleExport('fhir')}>
                      Export as FHIR Bundle
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
            
            <ResourceTable
              resources={results}
              resourceType={resourceType}
              onRowClick={onResultClick}
              enableSelection={enableBatchOperations}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
            />
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// Default search fields for common resource types
const defaultSearchFields: Record<string, SearchField[]> = {
  Patient: [
    { name: 'name', label: 'Name', type: 'string' },
    { name: 'identifier', label: 'MRN', type: 'string' },
    { name: 'birthdate', label: 'Birth Date', type: 'date' },
    { name: 'gender', label: 'Gender', type: 'token' }
  ],
  Appointment: [
    { name: 'patient', label: 'Patient', type: 'reference' },
    { name: 'practitioner', label: 'Provider', type: 'reference' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'status', label: 'Status', type: 'token' }
  ],
  Observation: [
    { name: 'patient', label: 'Patient', type: 'reference' },
    { name: 'code', label: 'Type', type: 'token' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'status', label: 'Status', type: 'token' }
  ]
};
```

### Usage Example

```typescript
// Using SearchControl in a component
function PatientSearch() {
  const navigate = useNavigate();
  const { searchResources } = useFHIR();
  
  return (
    <SearchControl
      resourceType="Patient"
      onSearch={async (params) => {
        return await searchResources('Patient', params);
      }}
      onResultClick={(patient) => {
        navigate(`/patients/${patient.id}`);
      }}
      onCreate={() => {
        navigate('/patients/new');
      }}
      savedSearches={[
        { id: '1', name: 'Active Patients', params: { active: 'true' } },
        { id: '2', name: 'Recent Visits', params: { _lastUpdated: 'gt2024-01-01' } }
      ]}
      enableExport={true}
      enableBatchOperations={true}
    />
  );
}
```

## 3. CodeableConceptInput Component

### Implementation Example

```typescript
// components/fhir/CodeableConceptInput/CodeableConceptInput.tsx
import React, { useState, useEffect } from 'react';
import { 
  Autocomplete, 
  Text, 
  Group, 
  Badge,
  Loader,
  Stack
} from '@mantine/core';
import { CodeableConcept, ValueSet } from '@medplum/fhirtypes';
import { useDebounce } from '@/hooks/useDebounce';

interface CodeableConceptInputProps {
  label: string;
  value?: CodeableConcept;
  onChange: (value: CodeableConcept | undefined) => void;
  binding?: {
    valueSet?: string;
    strength: 'required' | 'extensible' | 'preferred' | 'example';
  };
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}

export function CodeableConceptInput({
  label,
  value,
  onChange,
  binding,
  required = false,
  readOnly = false,
  placeholder = 'Search for a concept...'
}: CodeableConceptInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<ConceptOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [valueSet, setValueSet] = useState<ValueSet | null>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // Load value set if binding is provided
  useEffect(() => {
    if (binding?.valueSet) {
      loadValueSet(binding.valueSet);
    }
  }, [binding?.valueSet]);
  
  // Search for concepts when search term changes
  useEffect(() => {
    if (debouncedSearchTerm && valueSet) {
      searchConcepts(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, valueSet]);
  
  const loadValueSet = async (valueSetUrl: string) => {
    try {
      setLoading(true);
      // In production, this would fetch from a terminology server
      const vs = await fetchValueSet(valueSetUrl);
      setValueSet(vs);
      
      // Pre-populate common options
      if (vs.expansion?.contains) {
        const commonOptions = vs.expansion.contains.slice(0, 10).map(concept => ({
          value: concept.code!,
          label: concept.display!,
          system: concept.system!
        }));
        setOptions(commonOptions);
      }
    } catch (error) {
      console.error('Failed to load value set:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const searchConcepts = async (term: string) => {
    try {
      setLoading(true);
      
      // Search within value set
      if (valueSet?.expansion?.contains) {
        const filtered = valueSet.expansion.contains
          .filter(concept => 
            concept.display?.toLowerCase().includes(term.toLowerCase()) ||
            concept.code?.toLowerCase().includes(term.toLowerCase())
          )
          .map(concept => ({
            value: concept.code!,
            label: concept.display!,
            system: concept.system!
          }));
        
        setOptions(filtered);
      } else {
        // Fallback to terminology service search
        const results = await searchTerminologyService(term, binding?.valueSet);
        setOptions(results);
      }
    } catch (error) {
      console.error('Concept search failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = (selectedValue: string) => {
    const selected = options.find(opt => opt.value === selectedValue);
    if (selected) {
      const concept: CodeableConcept = {
        coding: [{
          system: selected.system,
          code: selected.value,
          display: selected.label
        }],
        text: selected.label
      };
      onChange(concept);
    }
  };
  
  const handleClear = () => {
    onChange(undefined);
    setSearchTerm('');
  };
  
  const getDisplayValue = (): string => {
    if (value?.text) return value.text;
    if (value?.coding?.[0]?.display) return value.coding[0].display;
    if (value?.coding?.[0]?.code) return value.coding[0].code;
    return '';
  };
  
  return (
    <Stack gap="xs">
      <Autocomplete
        label={label}
        placeholder={placeholder}
        data={options}
        value={getDisplayValue()}
        onChange={setSearchTerm}
        onItemSubmit={handleSelect}
        required={required}
        disabled={readOnly}
        rightSection={loading ? <Loader size="xs" /> : null}
        renderOption={({ option }) => (
          <Group gap="sm">
            <div>
              <Text size="sm">{option.label}</Text>
              <Text size="xs" c="dimmed">{option.value}</Text>
            </div>
          </Group>
        )}
      />
      
      {binding && (
        <Group gap="xs">
          <Text size="xs" c="dimmed">Binding:</Text>
          <Badge size="xs" variant="light" color={
            binding.strength === 'required' ? 'red' :
            binding.strength === 'extensible' ? 'orange' :
            binding.strength === 'preferred' ? 'yellow' : 'blue'
          }>
            {binding.strength}
          </Badge>
        </Group>
      )}
      
      {value?.coding?.map((coding, index) => (
        <Badge
          key={index}
          variant="light"
          onClose={!readOnly ? handleClear : undefined}
        >
          {coding.display || coding.code}
        </Badge>
      ))}
    </Stack>
  );
}

interface ConceptOption {
  value: string;
  label: string;
  system: string;
}
```

## 4. ResourceTimeline Component

### Implementation Example

```typescript
// components/fhir/ResourceTimeline/ResourceTimeline.tsx
import React, { useState, useEffect } from 'react';
import { 
  Timeline, 
  Text, 
  Group, 
  Badge, 
  ActionIcon,
  Paper,
  Stack,
  Collapse,
  Loader
} from '@mantine/core';
import { 
  IconGitCommit, 
  IconEdit, 
  IconUser,
  IconChevronDown,
  IconChevronUp,
  IconDiff
} from '@tabler/icons-react';
import { Resource, AuditEvent } from '@medplum/fhirtypes';
import { formatDateTime } from '@/utils';

interface ResourceTimelineProps {
  resource: Resource;
  showVersions?: boolean;
  showAuditEvents?: boolean;
  onVersionClick?: (versionId: string) => void;
  onDiffClick?: (version1: string, version2: string) => void;
}

interface TimelineItem {
  id: string;
  timestamp: string;
  type: 'create' | 'update' | 'read' | 'delete';
  user?: string;
  versionId?: string;
  changes?: string[];
  auditEvent?: AuditEvent;
}

export function ResourceTimeline({
  resource,
  showVersions = true,
  showAuditEvents = true,
  onVersionClick,
  onDiffClick
}: ResourceTimelineProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  
  useEffect(() => {
    loadTimeline();
  }, [resource.id]);
  
  const loadTimeline = async () => {
    try {
      setLoading(true);
      
      const items: TimelineItem[] = [];
      
      // Load version history
      if (showVersions) {
        const versions = await loadResourceVersions(resource);
        items.push(...versions);
      }
      
      // Load audit events
      if (showAuditEvents) {
        const auditEvents = await loadAuditEvents(resource);
        items.push(...auditEvents);
      }
      
      // Sort by timestamp
      items.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setTimelineItems(items);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  
  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions(prev => {
      const next = [...prev];
      const index = next.indexOf(versionId);
      if (index > -1) {
        next.splice(index, 1);
      } else {
        next.push(versionId);
        // Limit to 2 versions for comparison
        if (next.length > 2) {
          next.shift();
        }
      }
      return next;
    });
  };
  
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'create': return <IconGitCommit size={16} />;
      case 'update': return <IconEdit size={16} />;
      case 'read': return <IconUser size={16} />;
      default: return <IconGitCommit size={16} />;
    }
  };
  
  const getEventColor = (type: string) => {
    switch (type) {
      case 'create': return 'green';
      case 'update': return 'blue';
      case 'read': return 'gray';
      case 'delete': return 'red';
      default: return 'gray';
    }
  };
  
  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text c="dimmed">Loading timeline...</Text>
      </Stack>
    );
  }
  
  return (
    <Stack gap="md">
      {selectedVersions.length === 2 && onDiffClick && (
        <Paper p="sm" withBorder>
          <Group justify="space-between">
            <Text size="sm">
              Compare versions {selectedVersions[0]} and {selectedVersions[1]}
            </Text>
            <Button
              size="xs"
              leftSection={<IconDiff size={14} />}
              onClick={() => onDiffClick(selectedVersions[0], selectedVersions[1])}
            >
              View Diff
            </Button>
          </Group>
        </Paper>
      )}
      
      <Timeline bulletSize={24} lineWidth={2}>
        {timelineItems.map((item, index) => (
          <Timeline.Item
            key={item.id}
            bullet={getEventIcon(item.type)}
            color={getEventColor(item.type)}
          >
            <Paper p="sm" withBorder>
              <Group justify="space-between" mb="xs">
                <Group gap="sm">
                  <Badge color={getEventColor(item.type)} size="sm">
                    {item.type.toUpperCase()}
                  </Badge>
                  {item.versionId && (
                    <Badge variant="light" size="sm">
                      v{item.versionId}
                    </Badge>
                  )}
                </Group>
                
                <Group gap="xs">
                  {item.versionId && showVersions && (
                    <Checkbox
                      size="xs"
                      checked={selectedVersions.includes(item.versionId)}
                      onChange={() => toggleVersionSelection(item.versionId!)}
                      aria-label="Select for comparison"
                    />
                  )}
                  
                  {item.changes && item.changes.length > 0 && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      {expandedItems.has(item.id) ? 
                        <IconChevronUp size={14} /> : 
                        <IconChevronDown size={14} />
                      }
                    </ActionIcon>
                  )}
                  
                  {item.versionId && onVersionClick && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => onVersionClick(item.versionId!)}
                    >
                      <IconEye size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Group>
              
              <Text size="sm" c="dimmed">
                {formatDateTime(item.timestamp)}
                {item.user && ` by ${item.user}`}
              </Text>
              
              <Collapse in={expandedItems.has(item.id)}>
                {item.changes && item.changes.length > 0 && (
                  <Stack gap="xs" mt="sm">
                    <Text size="xs" fw={600}>Changes:</Text>
                    {item.changes.map((change, idx) => (
                      <Text key={idx} size="xs" c="dimmed">
                        • {change}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Collapse>
            </Paper>
          </Timeline.Item>
        ))}
      </Timeline>
    </Stack>
  );
}

// Helper functions for loading timeline data
async function loadResourceVersions(resource: Resource): Promise<TimelineItem[]> {
  // This would call your FHIR server's history endpoint
  // Example: GET [base]/[resource-type]/[id]/_history
  
  // Mock implementation
  return [
    {
      id: '1',
      timestamp: resource.meta?.lastUpdated || new Date().toISOString(),
      type: 'update',
      versionId: resource.meta?.versionId || '1',
      user: 'Dr. Smith',
      changes: ['Updated patient demographics']
    }
  ];
}

async function loadAuditEvents(resource: Resource): Promise<TimelineItem[]> {
  // This would search for AuditEvent resources related to this resource
  // Example: GET [base]/AuditEvent?entity=[resource-type]/[id]
  
  // Mock implementation
  return [];
}
```

## Implementation Tips

1. **Start Small**: Begin with ResourceForm for one resource type (e.g., Patient) before expanding

2. **Leverage TypeScript**: Use FHIR type definitions for better type safety

3. **Offline Support**: Extend components with OmniCare's existing offline capabilities

4. **Testing Strategy**:
   ```typescript
   // Example test for ResourceForm
   describe('ResourceForm', () => {
     it('should render fields based on schema', () => {
       render(
         <ResourceForm
           resourceType="Patient"
           fields={['name', 'birthDate']}
           onChange={jest.fn()}
         />
       );
       
       expect(screen.getByLabelText('Name')).toBeInTheDocument();
       expect(screen.getByLabelText('Birth Date')).toBeInTheDocument();
     });
   });
   ```

5. **Storybook Documentation**:
   ```typescript
   export default {
     title: 'FHIR/ResourceForm',
     component: ResourceForm,
     parameters: {
       docs: {
         description: {
           component: 'Dynamic form generation for FHIR resources'
         }
       }
     }
   };
   
   export const PatientForm = {
     args: {
       resourceType: 'Patient',
       fields: ['name', 'birthDate', 'gender', 'address']
     }
   };
   ```

6. **Progressive Enhancement**: Add features incrementally (validation, profiles, extensions)

7. **Performance Optimization**: 
   - Lazy load schemas
   - Cache value sets
   - Virtualize long lists
   - Debounce search inputs

These components will provide a solid foundation for improving OmniCare's FHIR capabilities while maintaining compatibility with the existing architecture.