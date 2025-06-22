// import { Appointment as FHIRAppointment } from '@medplum/fhirtypes';

import { 
  FHIRResource, 
  Identifier, 
  Reference, 
  CodeableConcept,
  Period
} from './base.model';

import { TelemedicineInfo } from './encounter.model';

/**
 * Extended Appointment Model for OmniCare EMR
 * Combines FHIR R4 Appointment resource with OmniCare-specific extensions
 */
export interface OmniCareAppointment extends FHIRResource {
  resourceType: 'Appointment';
  
  // Core FHIR Appointment fields
  identifier?: Identifier[];
  status: AppointmentStatus;
  cancelationReason?: CodeableConcept;
  serviceCategory?: CodeableConcept[];
  serviceType?: CodeableConcept[];
  specialty?: CodeableConcept[];
  appointmentType?: CodeableConcept;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[]; // Condition, Procedure, Observation, ImmunizationRecommendation
  priority?: number; // 0 = ASAP, 1-9 = urgency scale
  description?: string;
  supportingInformation?: Reference[]; // Any resource
  start?: string;
  end?: string;
  minutesDuration?: number;
  slot?: Reference[]; // Slot
  created?: string;
  comment?: string;
  patientInstruction?: string;
  basedOn?: Reference[]; // ServiceRequest
  participant: AppointmentParticipant[];
  requestedPeriod?: Period[];

  // OmniCare-specific extensions
  omnicareAppointmentId?: string;
  appointmentSource?: AppointmentSource;
  confirmationStatus?: ConfirmationStatus;
  remindersSent?: AppointmentReminder[];
  waitlistInfo?: WaitlistInfo;
  checkInInfo?: CheckInInfo;
  preVisitRequirements?: PreVisitRequirements;
  insuranceVerification?: InsuranceVerificationInfo;
  telemedicineInfo?: TelemedicineInfo;
  reschedulingInfo?: ReschedulingInfo;
  cancellationInfo?: CancellationInfo;
  followUpInfo?: FollowUpInfo;
  qualityMetrics?: AppointmentQualityMetrics;
  billingInfo?: AppointmentBillingInfo;
}

/**
 * Appointment Status Types
 */
export type AppointmentStatus = 
  | 'proposed'        // None of the participant(s) have finalized their acceptance
  | 'pending'         // Some participants have not yet agreed
  | 'booked'          // All participants have agreed/accepted
  | 'arrived'         // Patient has arrived and is waiting
  | 'fulfilled'       // Appointment has occurred
  | 'cancelled'       // Appointment was cancelled
  | 'noshow'          // Patient did not arrive
  | 'entered-in-error'// Appointment was entered in error
  | 'checked-in'      // Patient has checked in
  | 'waitlist';       // Appointment is on waitlist

/**
 * Appointment Source Types
 */
export type AppointmentSource = 
  | 'online'          // Patient portal or website
  | 'phone'           // Call center
  | 'walk-in'         // Walk-in appointment
  | 'referral'        // Provider referral
  | 'system'          // System generated (e.g., follow-up)
  | 'mobile-app'      // Mobile application
  | 'kiosk'           // Self-service kiosk
  | 'third-party';    // Third-party scheduling service

/**
 * Confirmation Status Types
 */
export type ConfirmationStatus = 
  | 'unconfirmed'
  | 'confirmed'
  | 'cancelled-by-patient'
  | 'cancelled-by-provider'
  | 'rescheduled';

/**
 * Appointment Participant
 */
export interface AppointmentParticipant {
  type?: CodeableConcept[];
  actor?: Reference; // Patient, Practitioner, PractitionerRole, RelatedPerson, Device, HealthcareService, Location
  required?: ParticipantRequired;
  status: ParticipantStatus;
  period?: Period;
}

export type ParticipantRequired = 'required' | 'optional' | 'information-only';
export type ParticipantStatus = 'accepted' | 'declined' | 'tentative' | 'needs-action';

/**
 * Appointment Reminder Information
 */
export interface AppointmentReminder {
  id?: string;
  type: ReminderType;
  scheduledDateTime: string;
  sentDateTime?: string;
  status: ReminderStatus;
  responseReceived?: boolean;
  responseType?: 'confirmed' | 'cancelled' | 'rescheduled';
  failureReason?: string;
}

export type ReminderType = 'email' | 'sms' | 'phone' | 'app-notification' | 'letter';
export type ReminderStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'opened' | 'responded';

/**
 * Waitlist Information
 */
export interface WaitlistInfo {
  position?: number;
  estimatedWaitTime?: number; // minutes
  addedToWaitlistDate: string;
  priority: 'high' | 'medium' | 'low';
  preferredDates?: string[];
  preferredTimes?: TimePreference[];
  expirationDate?: string;
  notificationPreferences?: {
    advanceNotice: number; // hours
    methods: ReminderType[];
  };
}

export interface TimePreference {
  dayOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
}

/**
 * Check-in Information
 */
export interface CheckInInfo {
  checkInTime?: string;
  checkInMethod?: 'in-person' | 'online' | 'kiosk' | 'mobile';
  checkInLocation?: Reference; // Location
  checkInStaff?: Reference; // Practitioner
  instructions?: string;
  formsCompleted?: boolean;
  copayCollected?: boolean;
  waitingRoomAssigned?: string;
  estimatedWaitTime?: number; // minutes
  patientReadyForProvider?: boolean;
}

/**
 * Pre-visit Requirements
 */
export interface PreVisitRequirements {
  forms?: PreVisitForm[];
  preparations?: PreVisitPreparation[];
  labsRequired?: Reference[]; // DiagnosticReport, Observation
  documentsRequired?: DocumentRequirement[];
  instructionsProvided?: boolean;
  requirementsMetDeadline?: string;
}

export interface PreVisitForm {
  formType: string;
  formUrl?: string;
  required: boolean;
  completed: boolean;
  completedDate?: string;
  submittedBy?: Reference; // Patient, RelatedPerson
}

export interface PreVisitPreparation {
  type: 'fasting' | 'medication-hold' | 'special-diet' | 'other';
  description: string;
  startDateTime?: string;
  duration?: number; // hours
  confirmed?: boolean;
}

export interface DocumentRequirement {
  documentType: string;
  description?: string;
  required: boolean;
  received: boolean;
  receivedDate?: string;
  documentReference?: Reference; // DocumentReference
}

/**
 * Insurance Verification Information
 */
export interface InsuranceVerificationInfo {
  verified: boolean;
  verifiedDate?: string;
  verifiedBy?: Reference; // Practitioner
  eligibleForServices: boolean;
  coverageDetails?: {
    copayAmount?: number;
    deductibleMet?: number;
    deductibleRemaining?: number;
    outOfPocketMax?: number;
    outOfPocketRemaining?: number;
  };
  authorizationRequired?: boolean;
  authorizationNumber?: string;
  authorizationExpirationDate?: string;
  notes?: string;
}

// TelemedicineInfo is imported from encounter.model.ts to avoid duplication
export interface TechnicalRequirement {
  type: 'hardware' | 'software' | 'internet';
  requirement: string;
  minimumVersion?: string;
  recommended?: string;
}

/**
 * Rescheduling Information
 */
export interface ReschedulingInfo {
  originalDateTime: string;
  rescheduledBy: Reference; // Patient, Practitioner, RelatedPerson
  rescheduledDate: string;
  reason: CodeableConcept;
  numberOfReschedules: number;
  reschedulingFee?: number;
  patientNotified: boolean;
  notificationMethod?: ReminderType;
}

/**
 * Cancellation Information
 */
export interface CancellationInfo {
  cancelledBy: Reference; // Patient, Practitioner, RelatedPerson
  cancellationDate: string;
  cancellationReason: CodeableConcept;
  cancellationNote?: string;
  lateCancellation: boolean; // within cancellation policy window
  cancellationFee?: number;
  followUpRequired?: boolean;
  alternativeOffered?: boolean;
}

/**
 * Follow-up Information
 */
export interface FollowUpInfo {
  required: boolean;
  recommendedTimeframe?: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
  };
  reason?: string;
  preferredProvider?: Reference; // Practitioner
  instructions?: string;
  autoScheduled?: boolean;
  scheduledAppointment?: Reference; // Appointment
}

/**
 * Appointment Quality Metrics
 */
export interface AppointmentQualityMetrics {
  scheduledDuration: number; // minutes
  actualDuration?: number;
  waitTime?: number;
  patientSatisfactionScore?: number; // 1-10
  providerSatisfactionScore?: number; // 1-10
  onTimeStart?: boolean;
  completedAllObjectives?: boolean;
  reschedulingCount: number;
  preparationCompleteness?: number; // percentage
}

/**
 * Appointment Billing Information
 */
export interface AppointmentBillingInfo {
  estimatedCost?: number;
  copayAmount?: number;
  copayCollected?: boolean;
  copayCollectionMethod?: 'cash' | 'credit' | 'debit' | 'check' | 'other';
  depositRequired?: boolean;
  depositAmount?: number;
  depositCollected?: boolean;
  billingNotes?: string;
}

/**
 * Appointment Request
 */
export interface AppointmentRequest {
  patient: Reference;
  serviceType: CodeableConcept;
  practitioner?: Reference;
  location?: Reference;
  appointmentType?: CodeableConcept;
  reasonCode?: CodeableConcept[];
  priority?: number;
  requestedPeriods: Period[];
  duration: number; // minutes
  preferredDays?: string[];
  preferredTimes?: TimePreference[];
  isTelemedicine?: boolean;
  notes?: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
}

/**
 * Appointment Response
 */
export interface AppointmentResponse {
  appointment: OmniCareAppointment;
  alternativeSlots?: AppointmentSlot[];
  waitlistOption?: boolean;
  estimatedWaitTime?: number;
  confirmationRequired: boolean;
  confirmationDeadline?: string;
}

/**
 * Appointment Slot
 */
export interface AppointmentSlot {
  id: string;
  start: string;
  end: string;
  available: boolean;
  practitioner?: Reference;
  location?: Reference;
  serviceType?: CodeableConcept;
  isTelemedicine?: boolean;
}

/**
 * Appointment Search Parameters
 */
export interface AppointmentSearchParams {
  _id?: string;
  actor?: string;
  'appointment-type'?: string;
  date?: string;
  identifier?: string;
  location?: string;
  'part-status'?: string;
  patient?: string;
  practitioner?: string;
  'reason-code'?: string;
  'reason-reference'?: string;
  'service-category'?: string;
  'service-type'?: string;
  slot?: string;
  specialty?: string;
  status?: string;
  'supporting-info'?: string;
  
  // OmniCare-specific search parameters
  'omnicare-id'?: string;
  'appointment-source'?: string;
  'confirmation-status'?: string;
  'is-telemedicine'?: boolean;
  'has-waitlist'?: boolean;
  'insurance-verified'?: boolean;
  'check-in-status'?: string;
  
  // Date range searches
  'date-range-start'?: string;
  'date-range-end'?: string;
  
  // Common search modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
}

/**
 * Appointment Statistics
 */
export interface AppointmentStatistics {
  totalAppointments: number;
  appointmentsByStatus: Record<AppointmentStatus, number>;
  appointmentsBySource: Record<AppointmentSource, number>;
  averageWaitTime: number;
  averageAppointmentDuration: number;
  noShowRate: number;
  cancellationRate: number;
  sameWeekAvailability: number; // percentage
  utilizationRate: number; // percentage
  patientSatisfactionAverage: number;
  topServiceTypes: Array<{
    serviceType: string;
    count: number;
    averageDuration: number;
  }>;
  providerStatistics: Array<{
    provider: Reference;
    appointmentCount: number;
    averageDuration: number;
    noShowRate: number;
    patientSatisfaction: number;
  }>;
  timeSlotAnalysis: Array<{
    timeSlot: string;
    utilizationRate: number;
    noShowRate: number;
  }>;
}

/**
 * Appointment Availability Query
 */
export interface AppointmentAvailabilityQuery {
  serviceType: CodeableConcept;
  practitioner?: Reference[];
  location?: Reference[];
  startDate: string;
  endDate: string;
  duration: number; // minutes
  preferredTimes?: TimePreference[];
  isTelemedicine?: boolean;
  urgency?: 'routine' | 'urgent' | 'emergency';
}

/**
 * Appointment Availability Response
 */
export interface AppointmentAvailabilityResponse {
  availableSlots: AppointmentSlot[];
  nextAvailable?: AppointmentSlot;
  waitlistAvailable: boolean;
  estimatedWaitlistTime?: number;
  alternativePractitioners?: Array<{
    practitioner: Reference;
    nextAvailable: AppointmentSlot;
  }>;
  alternativeLocations?: Array<{
    location: Reference;
    nextAvailable: AppointmentSlot;
  }>;
}