import {
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
} from '@medplum/fhirtypes';

// Re-export all FHIR types from Medplum
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
};

// Type alias for all FHIR resource types
export type FHIRResource = 
  | Patient 
  | Practitioner 
  | Organization 
  | Location 
  | Encounter 
  | Observation 
  | Medication 
  | MedicationRequest 
  | ServiceRequest 
  | DiagnosticReport 
  | CarePlan 
  | Communication 
  | Task 
  | DocumentReference 
  | Bundle 
  | Subscription 
  | OperationOutcome 
  | Parameters 
  | Condition 
  | Procedure 
  | AllergyIntolerance 
  | Immunization 
  | Device 
  | Specimen;

// Extended types for OmniCare-specific functionality
export interface OmniCarePatient extends Patient {
  omnicarePatientId?: string;
  registrationDate?: string;
  preferredLanguage?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  insuranceInformation?: {
    primary?: {
      payer: string;
      memberId: string;
      groupNumber?: string;
    };
    secondary?: {
      payer: string;
      memberId: string;
      groupNumber?: string;
    };
  };
}

export interface OmniCareEncounter extends Encounter {
  omnicareEncounterId?: string;
  appointmentType?: string;
  chiefComplaint?: string;
  visitSummary?: string;
  followUpInstructions?: string;
  billingNotes?: string;
}

export interface OmniCareObservation extends Observation {
  omnicareObservationId?: string;
  deviceUsed?: string;
  qualityFlags?: string[];
  abnormalFlags?: string[];
  criticalAlerts?: boolean;
}

// Unified FHIR search parameters interface (shared with frontend)
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

// Bundle creation interface
export interface BundleRequest {
  resourceType: string;
  resources: (Patient | Practitioner | Organization | Location | Encounter | Observation | Medication | MedicationRequest | ServiceRequest | DiagnosticReport | CarePlan | Communication | Task | DocumentReference | Condition | Procedure | AllergyIntolerance | Immunization | Device | Specimen)[];
  type: 'transaction' | 'batch' | 'collection' | 'searchset' | 'history';
  timestamp?: string;
}

// Subscription configuration
export interface SubscriptionConfig {
  criteria: string;
  channel: {
    type: 'rest-hook' | 'websocket' | 'email' | 'sms';
    endpoint?: string;
    payload?: string;
    header?: string[];
  };
  reason: string;
  status: 'requested' | 'active' | 'error' | 'off';
}

// Clinical Decision Support Hook interfaces
export interface CDSHookContext {
  patientId?: string;
  encounterId?: string;
  userId?: string;
  draftOrders?: (MedicationRequest | ServiceRequest)[];
  selections?: string[];
  [key: string]: string | string[] | (MedicationRequest | ServiceRequest)[] | undefined;
}

export interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CDSSuggestion[];
  selectionBehavior?: 'at-most-one' | 'any';
  overrideReasons?: CDSOverrideReason[];
  links?: CDSLink[];
}

export interface CDSSuggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: CDSAction[];
}

export interface CDSAction {
  type: 'create' | 'update' | 'delete';
  description?: string;
  resource?: Patient | Practitioner | Organization | Location | Encounter | Observation | Medication | MedicationRequest | ServiceRequest | DiagnosticReport | CarePlan | Communication | Task | DocumentReference | Condition | Procedure | AllergyIntolerance | Immunization | Device | Specimen;
  resourceId?: string;
}

export interface CDSOverrideReason {
  code: string;
  display: string;
  system?: string;
}

export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

export interface CDSHookRequest {
  hookInstance: string;
  fhirServer: string;
  hook: string;
  context: CDSHookContext;
  prefetch?: { [key: string]: Bundle | OperationOutcome | Patient | Practitioner | Organization | Location | Encounter | Observation | Medication | MedicationRequest | ServiceRequest | DiagnosticReport | CarePlan | Communication | Task | DocumentReference | Condition | Procedure | AllergyIntolerance | Immunization | Device | Specimen };
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
}

export interface CDSHookResponse {
  cards: CDSCard[];
  systemActions?: CDSAction[];
}

// SMART on FHIR interfaces
export interface SMARTTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  refresh_token?: string;
  patient?: string;
  encounter?: string;
  need_patient_banner?: boolean;
  smart_style_url?: string;
  fhirUser?: string;
  aud?: string;
}

export interface SMARTLaunchContext {
  iss: string; // FHIR server URL
  launch: string; // Launch parameter
  aud: string; // Client ID
  redirect_uri: string;
  response_type: 'code';
  state: string;
  scope: string;
}

// HL7 v2 Message interfaces
export interface HL7v2Message {
  messageType: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: string;
  messageStructure: string;
  segments: HL7v2Segment[];
}

export interface HL7v2Segment {
  segmentType: string;
  fields: string[];
}

// Audit and logging interfaces
export interface AuditEvent {
  resourceType: 'AuditEvent';
  type: {
    system: string;
    code: string;
    display: string;
  };
  subtype?: {
    system: string;
    code: string;
    display: string;
  }[];
  action: 'C' | 'R' | 'U' | 'D' | 'E';
  recorded: string;
  outcome: '0' | '4' | '8' | '12';
  agent: AuditAgent[];
  source: AuditSource;
  entity?: AuditEntity[];
}

export interface AuditAgent {
  type?: {
    system: string;
    code: string;
    display: string;
  };
  who?: {
    reference: string;
    display?: string;
  };
  requestor: boolean;
  location?: {
    reference: string;
  };
  policy?: string[];
  media?: {
    system: string;
    code: string;
    display: string;
  };
  network?: {
    address: string;
    type: '1' | '2' | '3' | '4' | '5';
  };
}

export interface AuditSource {
  site?: string;
  observer: {
    reference: string;
    display?: string;
  };
  type?: {
    system: string;
    code: string;
    display: string;
  }[];
}

export interface AuditEntity {
  what?: {
    reference: string;
    display?: string;
  };
  type?: {
    system: string;
    code: string;
    display: string;
  };
  role?: {
    system: string;
    code: string;
    display: string;
  };
  lifecycle?: {
    system: string;
    code: string;
    display: string;
  };
  securityLabel?: {
    system: string;
    code: string;
    display: string;
  }[];
  name?: string;
  description?: string;
  query?: string;
  detail?: {
    type: string;
    valueString?: string;
    valueBase64Binary?: string;
  }[];
}

// Error handling types
export interface FHIRError {
  resourceType: 'OperationOutcome';
  issue: {
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    details?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    };
    diagnostics?: string;
    location?: string[];
    expression?: string[];
  }[];
}

// Unified validation result types (shared with frontend)
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

// Performance monitoring types
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  activeConnections: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
}

// Cache interfaces
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size
  strategy: 'LRU' | 'LFU' | 'FIFO';
}

export interface CachedResource {
  resource: Patient | Practitioner | Organization | Location | Encounter | Observation | Medication | MedicationRequest | ServiceRequest | DiagnosticReport | CarePlan | Communication | Task | DocumentReference | Condition | Procedure | AllergyIntolerance | Immunization | Device | Specimen | Bundle | OperationOutcome;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}