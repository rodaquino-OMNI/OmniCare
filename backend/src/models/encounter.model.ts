import { Encounter as FHIREncounter } from '@medplum/fhirtypes';

import { 
  FHIRResource, 
  Identifier, 
  Reference, 
  CodeableConcept,
  Period,
  Quantity
} from './base.model';

/**
 * Extended Encounter Model for OmniCare EMR
 * Combines FHIR R4 Encounter resource with OmniCare-specific extensions
 */
export interface OmniCareEncounter extends FHIRResource {
  resourceType: 'Encounter';
  
  // Core FHIR Encounter fields
  identifier?: Identifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: EncounterStatusHistory[];
  class: CodeableConcept;
  classHistory?: EncounterClassHistory[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject?: Reference; // Patient
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: EncounterParticipant[];
  appointment?: Reference[];
  period?: Period;
  length?: Quantity;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: EncounterDiagnosis[];
  account?: Reference[];
  hospitalization?: EncounterHospitalization;
  location?: EncounterLocation[];
  serviceProvider?: Reference; // Organization
  partOf?: Reference; // Encounter

  // OmniCare-specific extensions
  omnicareEncounterId?: string;
  scheduledDateTime?: string;
  estimatedDuration?: number; // minutes
  actualDuration?: number; // minutes
  checkInTime?: string;
  checkOutTime?: string;
  waitTime?: number; // minutes
  encounterType?: EncounterType;
  visitReason?: string;
  chiefComplaint?: string;
  notes?: EncounterNote[];
  followUpRequired?: boolean;
  followUpInstructions?: string;
  patientSatisfactionScore?: number; // 1-10
  billingInfo?: EncounterBilling;
  qualityMetrics?: EncounterQualityMetrics;
}

export interface EncounterStatusHistory {
  status: string;
  period: Period;
}

export interface EncounterClassHistory {
  class: CodeableConcept;
  period: Period;
}

export interface EncounterParticipant {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference; // Practitioner or RelatedPerson
}

export interface EncounterDiagnosis {
  condition: Reference; // Condition
  use?: CodeableConcept;
  rank?: number;
}

export interface EncounterHospitalization {
  preAdmissionIdentifier?: Identifier;
  origin?: Reference; // Location
  admitSource?: CodeableConcept;
  reAdmission?: CodeableConcept;
  dietPreference?: CodeableConcept[];
  specialCourtesy?: CodeableConcept[];
  specialArrangement?: CodeableConcept[];
  destination?: Reference; // Location
  dischargeDisposition?: CodeableConcept;
}

export interface EncounterLocation {
  location: Reference; // Location
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: CodeableConcept;
  period?: Period;
}

export interface EncounterType {
  category: 'inpatient' | 'outpatient' | 'emergency' | 'home-health' | 'virtual' | 'short-stay' | 'observation';
  visitType: 'routine' | 'urgent' | 'walk-in' | 'scheduled' | 'emergency' | 'follow-up' | 'consultation';
  specialty?: string;
  isTelemedicine?: boolean;
}

export interface EncounterNote {
  id?: string;
  type: 'chief-complaint' | 'history-present-illness' | 'assessment' | 'plan' | 'instructions' | 'general';
  author: Reference; // Practitioner
  timestamp: string;
  content: string;
  confidential?: boolean;
}

export interface EncounterBilling {
  primaryInsurance?: Reference;
  secondaryInsurance?: Reference;
  copayAmount?: number;
  copayCollected?: boolean;
  eligibilityVerified?: boolean;
  authorizationRequired?: boolean;
  authorizationNumber?: string;
  estimatedCost?: number;
  actualCost?: number;
  billingCodes?: BillingCode[];
}

export interface BillingCode {
  type: 'cpt' | 'icd-10' | 'hcpcs' | 'drg';
  code: string;
  description: string;
  modifier?: string;
  units?: number;
  amount?: number;
}

export interface EncounterQualityMetrics {
  doorToDoctorTime?: number; // minutes
  totalEncounterTime?: number; // minutes
  treatmentDelays?: string[];
  protocolsFollowed?: string[];
  safetyChecksCompleted?: boolean;
  medicationReconciliationCompleted?: boolean;
  patientEducationProvided?: boolean;
}

// Note: Appointment-related interfaces have been moved to appointment.model.ts
// Telemedicine info interface remains here as it's used by encounters as well
export interface TelemedicineInfo {
  platform: string;
  meetingUrl?: string;
  meetingId?: string;
  accessCode?: string;
  requiresApp?: boolean;
  technicalRequirements?: string[];
  troubleshootingContact?: string;
}

/**
 * Encounter Search Parameters
 */
export interface EncounterSearchParams {
  _id?: string;
  patient?: string;
  subject?: string;
  status?: string;
  class?: string;
  type?: string;
  date?: string;
  practitioner?: string;
  location?: string;
  identifier?: string;
  'service-provider'?: string;
  'part-of'?: string;
  appointment?: string;
  
  // OmniCare-specific search parameters
  'omnicare-id'?: string;
  'encounter-type'?: string;
  'visit-reason'?: string;
  'check-in-date'?: string;
  'provider-specialty'?: string;
  
  // Common search modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
}

// Note: Appointment search and scheduling interfaces have been moved to appointment.model.ts

/**
 * Encounter Statistics
 */
export interface EncounterStatistics {
  totalEncounters: number;
  encountersByStatus: Record<string, number>;
  averageWaitTime: number;
  averageEncounterDuration: number;
  patientSatisfactionAverage: number;
  noShowRate: number;
  cancellationRate: number;
  topVisitReasons: Array<{
    reason: string;
    count: number;
  }>;
  encountersByProvider: Array<{
    provider: string;
    count: number;
    averageDuration: number;
  }>;
}