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

/**
 * Appointment Model (extends Encounter for scheduling)
 */
export interface OmniCareAppointment extends FHIRResource {
  resourceType: 'Appointment';
  
  // Core FHIR Appointment fields
  identifier?: Identifier[];
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
  cancelationReason?: CodeableConcept;
  serviceCategory?: CodeableConcept[];
  serviceType?: CodeableConcept[];
  specialty?: CodeableConcept[];
  appointmentType?: CodeableConcept;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  priority?: number;
  description?: string;
  supportingInformation?: Reference[];
  start?: string;
  end?: string;
  minutesDuration?: number;
  slot?: Reference[];
  created?: string;
  comment?: string;
  patientInstruction?: string;
  basedOn?: Reference[];
  participant: AppointmentParticipant[];
  requestedPeriod?: Period[];

  // OmniCare-specific extensions
  omnicareAppointmentId?: string;
  appointmentSource?: 'online' | 'phone' | 'walk-in' | 'referral' | 'system';
  confirmationStatus?: 'confirmed' | 'unconfirmed' | 'cancelled-by-patient' | 'cancelled-by-provider';
  remindersSent?: AppointmentReminder[];
  waitlistPosition?: number;
  estimatedWaitTime?: number; // minutes
  checkInInstructions?: string;
  preVisitForms?: Reference[];
  insuranceVerification?: {
    verified: boolean;
    verifiedDate?: string;
    eligibleForServices: boolean;
    copayAmount?: number;
    authorizationRequired?: boolean;
    notes?: string;
  };
  telemedicineInfo?: TelemedicineInfo;
}

export interface AppointmentParticipant {
  type?: CodeableConcept[];
  actor?: Reference; // Patient, Practitioner, PractitionerRole, RelatedPerson, Device, HealthcareService, Location
  required?: 'required' | 'optional' | 'information-only';
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  period?: Period;
}

export interface AppointmentReminder {
  type: 'email' | 'sms' | 'phone' | 'app-notification';
  sentDate: string;
  status: 'sent' | 'delivered' | 'failed' | 'opened' | 'responded';
  scheduledFor: string; // how many days/hours before appointment
}

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

/**
 * Appointment Search Parameters
 */
export interface AppointmentSearchParams {
  _id?: string;
  patient?: string;
  practitioner?: string;
  location?: string;
  status?: string;
  date?: string;
  'service-type'?: string;
  specialty?: string;
  'appointment-type'?: string;
  identifier?: string;
  
  // OmniCare-specific search parameters
  'omnicare-id'?: string;
  'appointment-source'?: string;
  'confirmation-status'?: string;
  'upcoming'?: boolean;
  'date-range'?: string;
  
  // Common search modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
}

/**
 * Appointment Scheduling Request
 */
export interface AppointmentSchedulingRequest {
  patient: Reference;
  practitioner?: Reference;
  serviceType: CodeableConcept;
  appointmentType?: CodeableConcept;
  preferredDates: string[];
  preferredTimes: string[];
  duration: number; // minutes
  reason: string;
  priority: 'routine' | 'urgent' | 'emergency';
  isTelemedicine?: boolean;
  notes?: string;
  insurance?: {
    primary: Reference;
    secondary?: Reference;
  };
}

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