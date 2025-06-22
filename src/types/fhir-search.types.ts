/**
 * FHIR Search Generic Type Constraints
 * 
 * This module provides proper TypeScript generic constraints for FHIR resource searches
 * Resolves type safety issues with searchResources<T> calls
 */

import { 
  Resource, 
  Bundle, 
  Patient, 
  Practitioner, 
  Organization, 
  Encounter, 
  Observation, 
  ServiceRequest, 
  Task, 
  Claim, 
  ClaimResponse,
  Communication,
  DocumentReference,
  Appointment,
  CarePlan,
  Condition,
  AllergyIntolerance,
  MedicationRequest,
  DiagnosticReport
} from '@medplum/fhirtypes';

/**
 * Base FHIR Resource constraint
 */
export type FHIRResourceType = Resource['resourceType'];

/**
 * Map of resource types to their corresponding FHIR resource interfaces
 */
export type ResourceTypeMap = {
  'Patient': Patient;
  'Practitioner': Practitioner;
  'Organization': Organization;
  'Encounter': Encounter;
  'Observation': Observation;
  'ServiceRequest': ServiceRequest;
  'Task': Task;
  'Claim': Claim;
  'ClaimResponse': ClaimResponse;
  'Communication': Communication;
  'DocumentReference': DocumentReference;
  'Appointment': Appointment;
  'CarePlan': CarePlan;
  'Condition': Condition;
  'AllergyIntolerance': AllergyIntolerance;
  'MedicationRequest': MedicationRequest;
  'DiagnosticReport': DiagnosticReport;
};

/**
 * Generic constraint for FHIR resource searches
 * Ensures T extends the resource type specified in the resourceType parameter
 */
export type SearchableResource<T extends keyof ResourceTypeMap> = ResourceTypeMap[T];

/**
 * Search parameters interface with proper typing
 */
export interface FHIRSearchParams {
  [key: string]: string | number | boolean | undefined;
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string;
  _revinclude?: string;
  _elements?: string;
  _summary?: string;
  _total?: string;
}

/**
 * Bundle result type for searches
 */
export type SearchBundle<T extends Resource> = Bundle<T>;

/**
 * Type-safe search result interface
 */
export interface SearchResult<T extends Resource> {
  resources: T[];
  total?: number;
  hasNext: boolean;
  hasPrevious: boolean;
  bundle: Bundle<T>;
}

/**
 * Search options for advanced queries
 */
export interface SearchOptions {
  count?: number;
  offset?: number;
  sort?: string[];
  include?: string[];
  revInclude?: string[];
  elements?: string[];
  summary?: 'true' | 'text' | 'data' | 'count';
  total?: 'none' | 'estimate' | 'accurate';
}

/**
 * Type guard to check if a resource is of a specific type
 */
export function isResourceOfType<T extends keyof ResourceTypeMap>(
  resource: Resource,
  resourceType: T
): resource is ResourceTypeMap[T] {
  return resource.resourceType === resourceType;
}

/**
 * Extract resources from bundle with type safety
 */
export function extractResourcesFromBundle<T extends Resource>(
  bundle: Bundle<T>
): T[] {
  return bundle.entry?.map(entry => entry.resource).filter((resource): resource is T => 
    resource !== undefined
  ) || [];
}

/**
 * Utility type for creating search request with constraints
 */
export interface TypedSearchParams<T extends keyof ResourceTypeMap> {
  resourceType: T;
  filters?: Array<{
    code: string;
    operator: string;
    value: string;
  }>;
  count?: number;
  offset?: number;
  sortRules?: Array<{
    code: string;
    descending?: boolean;
  }>;
  total?: any;
  summary?: any;
  elements?: string[];
  include?: string[];
  revInclude?: string[];
}

/**
 * Helper to create type-safe search parameters
 */
export function createSearchParams<T extends keyof ResourceTypeMap>(
  resourceType: T,
  params: FHIRSearchParams
): TypedSearchParams<T> {
  return {
    resourceType,
    filters: Object.entries(params)
      .filter(([key, value]) => !key.startsWith('_') && value !== undefined)
      .map(([key, value]) => ({
        code: key,
        operator: 'equals' as const,
        value: String(value)
      })),
    count: params._count,
    offset: params._offset,
    sortRules: params._sort ? parseSortRules(params._sort) : undefined,
    total: params._total as any,
    summary: params._summary as any,
    elements: params._elements?.split(','),
    include: params._include?.split(','),
    revInclude: params._revinclude?.split(',')
  };
}

/**
 * Parse sort rules from string format
 */
function parseSortRules(sortString: string): any[] {
  return sortString.split(',').map(rule => {
    const [code, order] = rule.trim().split(':');
    return {
      code: code.trim(),
      descending: order?.trim() === 'desc'
    };
  });
}

/**
 * Type-safe search result transformer
 */
export function transformSearchResult<T extends Resource>(
  bundle: Bundle<T>
): SearchResult<T> {
  const resources = extractResourcesFromBundle(bundle);
  
  return {
    resources,
    total: bundle.total,
    hasNext: bundle.link?.some(link => link.relation === 'next') || false,
    hasPrevious: bundle.link?.some(link => link.relation === 'previous') || false,
    bundle
  };
}

/**
 * Utility types for common search scenarios
 */
export type PatientSearchParams = FHIRSearchParams & {
  name?: string;
  family?: string;
  given?: string;
  identifier?: string;
  birthdate?: string;
  gender?: string;
  active?: boolean;
};

export type EncounterSearchParams = FHIRSearchParams & {
  patient?: string;
  practitioner?: string;
  date?: string;
  status?: string;
  class?: string;
};

export type ObservationSearchParams = FHIRSearchParams & {
  patient?: string;
  category?: string;
  code?: string;
  date?: string;
  performer?: string;
  value?: string;
};

export type ServiceRequestSearchParams = FHIRSearchParams & {
  patient?: string;
  requester?: string;
  performer?: string;
  status?: string;
  category?: string;
  priority?: string;
  date?: string;
};

export type TaskSearchParams = FHIRSearchParams & {
  focus?: string;
  patient?: string;
  requester?: string;
  owner?: string;
  status?: string;
  priority?: string;
  code?: string;
};

/**
 * Export type aliases for convenience
 */
export type {
  Patient,
  Practitioner,
  Organization,
  Encounter,
  Observation,
  ServiceRequest,
  Task,
  Claim,
  ClaimResponse,
  Communication,
  DocumentReference,
  Appointment,
  CarePlan,
  Condition,
  AllergyIntolerance,
  MedicationRequest,
  DiagnosticReport,
  Bundle,
  Resource
};