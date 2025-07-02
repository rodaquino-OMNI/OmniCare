/**
 * Shared FHIR Type Definitions
 * 
 * This module provides FHIR type definitions that are aligned between
 * frontend and backend to ensure API contract consistency.
 */

// Unified FHIR search parameters interface (aligned with backend)
export interface FHIRSearchParams {
  _id?: string;
  _lastUpdated?: string;
  _tag?: string;
  _profile?: string;
  _security?: string;
  _text?: string;
  _content?: string;
  _list?: string;
  _has?: string;
  _type?: string;
  _count?: number;
  _offset?: number;
  _sort?: string;
  _elements?: string;
  _summary?: string;
  _total?: string;
  _include?: string;
  _revinclude?: string;
  [key: string]: string | number | boolean | undefined;
}

// Unified validation result types (aligned with backend)
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'fatal' | 'warning' | 'information';
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warning' | 'information';
}

// Response interface for unified API responses
export interface FHIRResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

// Re-export backend FHIR types for full alignment
export type {
  Patient,
  Practitioner,
  Organization,
  Location,
  Encounter,
  Observation,
  Medication,
  MedicationRequest,
  ServiceRequest,
  DiagnosticReport,
  CarePlan,
  Communication,
  Task,
  DocumentReference,
  Bundle,
  Subscription,
  OperationOutcome,
  Parameters,
  Condition,
  Procedure,
  AllergyIntolerance,
  Immunization,
  Device,
  Specimen,
  FHIRResource,
  OmniCarePatient,
  OmniCareEncounter,
  OmniCareObservation
} from '@medplum/fhirtypes';

// Ensure these are available from backend types as well
export type {
  CDSHookContext,
  CDSCard,
  CDSSuggestion,
  CDSAction,
  CDSOverrideReason,
  CDSLink,
  CDSHookRequest,
  CDSHookResponse,
  SMARTTokenResponse,
  SMARTLaunchContext
} from '../../../backend/src/types/fhir';