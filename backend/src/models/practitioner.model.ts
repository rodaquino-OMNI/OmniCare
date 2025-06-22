// import { Practitioner as FHIRPractitioner } from '@medplum/fhirtypes';

import { 
  FHIRResource, 
  Identifier, 
  HumanName, 
  Address, 
  ContactPoint, 
  Reference, 
  CodeableConcept,
  Period,
  Attachment
} from './base.model';

/**
 * Extended Practitioner Model for OmniCare EMR
 * Combines FHIR R4 Practitioner resource with OmniCare-specific extensions
 */
export interface OmniCarePractitioner extends FHIRResource {
  resourceType: 'Practitioner';
  
  // Core FHIR Practitioner fields
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  photo?: Attachment[];
  qualification?: PractitionerQualification[];
  communication?: PractitionerCommunication[];

  // OmniCare-specific extensions
  omnicarePractitionerId?: string;
  employeeId?: string;
  hireDate?: string;
  terminationDate?: string;
  departmentAffiliations?: DepartmentAffiliation[];
  credentials?: PractitionerCredentials;
  schedule?: PractitionerSchedule;
  preferences?: PractitionerPreferences;
  performanceMetrics?: PerformanceMetrics;
  professionalReferences?: ProfessionalReference[];
  emergencyContact?: PractitionerEmergencyContact[];
  complianceInfo?: ComplianceInformation;
}

export interface PractitionerQualification {
  identifier?: Identifier[];
  code: CodeableConcept;
  period?: Period;
  issuer?: Reference; // Organization
}

export interface PractitionerCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface DepartmentAffiliation {
  department: Reference; // Organization
  role: CodeableConcept;
  specialty?: CodeableConcept[];
  startDate: string;
  endDate?: string;
  isPrimary: boolean;
  responsibilities?: string[];
}

export interface PractitionerCredentials {
  licenseNumber: string;
  licenseState: string;
  licenseExpiration: string;
  licenseStatus: 'active' | 'inactive' | 'suspended' | 'revoked';
  boardCertifications?: BoardCertification[];
  deaNumber?: string;
  deaExpiration?: string;
  npiNumber?: string;
  malpracticeInsurance?: MalpracticeInsurance;
  backgroundCheck?: BackgroundCheck;
}

export interface BoardCertification {
  boardName: string;
  certificationDate: string;
  expirationDate?: string;
  maintenanceOfCertification?: boolean;
  specialty: CodeableConcept;
  status: 'active' | 'expired' | 'suspended';
}

export interface MalpracticeInsurance {
  provider: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  coverageAmount: {
    perClaim: number;
    aggregate: number;
  };
  status: 'active' | 'expired' | 'pending';
}

export interface BackgroundCheck {
  performedDate: string;
  performedBy: string;
  status: 'cleared' | 'pending' | 'issues-identified';
  expirationDate?: string;
  notes?: string;
}

export interface PractitionerSchedule {
  defaultWorkingHours?: WorkingHours[];
  timeZone: string;
  availabilityExceptions?: AvailabilityException[];
  preferredSchedulingBuffer?: number; // minutes between appointments
  maxConsecutiveHours?: number;
  breakPreferences?: BreakPreference[];
  callSchedule?: CallSchedule[];
}

export interface WorkingHours {
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  location?: Reference; // Location
  appointmentTypes?: CodeableConcept[];
}

export interface AvailabilityException {
  type: 'vacation' | 'sick-leave' | 'training' | 'conference' | 'personal' | 'administrative';
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  weekOfMonth?: number;
  endDate?: string;
  occurrences?: number;
}

export interface BreakPreference {
  type: 'lunch' | 'short-break' | 'administrative';
  preferredStartTime: string;
  duration: number; // minutes
  isFlexible: boolean;
}

export interface CallSchedule {
  type: 'on-call' | 'emergency' | 'consultation';
  startDateTime: string;
  endDateTime: string;
  priority: 'primary' | 'backup';
  contactMethod: ContactPoint;
  specialtyArea?: CodeableConcept;
}

export interface PractitionerPreferences {
  communicationPreferences?: {
    preferredContactMethod: 'phone' | 'email' | 'pager' | 'secure-message';
    emergencyContactMethod: 'phone' | 'pager' | 'text';
    systemNotifications: boolean;
    appointmentReminders: boolean;
  };
  workflowPreferences?: {
    defaultAppointmentDuration: number; // minutes
    doubleBookingAllowed: boolean;
    patientMessagingEnabled: boolean;
    delegateSchedulingTo?: Reference[]; // Practitioner or RelatedPerson
  };
  clinicalPreferences?: {
    defaultTemplates?: Reference[]; // DocumentReference
    favoriteOrderSets?: Reference[]; // RequestGroup
    prescriptionPreferences?: PrescriptionPreference[];
  };
}

export interface PrescriptionPreference {
  medicationType: CodeableConcept;
  preferredMedications?: CodeableConcept[];
  defaultDosageForm?: CodeableConcept;
  preferredPharmacies?: Reference[]; // Organization
  electronicPrescribingEnabled: boolean;
}

export interface PerformanceMetrics {
  patientSatisfactionScore?: number; // 1-10
  appointmentAdherence?: number; // percentage
  averageAppointmentDuration?: number; // minutes
  noShowRate?: number; // percentage
  documentationCompletionRate?: number; // percentage
  responseTimeToMessages?: number; // hours
  continuingEducationHours?: number;
  qualityMeasureScores?: QualityMeasureScore[];
  peerReviewScores?: PeerReviewScore[];
}

export interface QualityMeasureScore {
  measureName: string;
  score: number;
  benchmark: number;
  reportingPeriod: Period;
  description?: string;
}

export interface PeerReviewScore {
  reviewerType: 'peer' | 'supervisor' | 'patient';
  score: number;
  maxScore: number;
  reviewDate: string;
  comments?: string;
  categories?: {
    clinicalCompetence?: number;
    communication?: number;
    professionalism?: number;
    systemsBased?: number;
  };
}

export interface ProfessionalReference {
  name: HumanName;
  relationship: string;
  organization?: string;
  contactInfo: ContactPoint[];
  yearsKnown: number;
  canContactForEmployment: boolean;
}

export interface PractitionerEmergencyContact {
  name: HumanName;
  relationship: string;
  contactInfo: ContactPoint[];
  isPrimary: boolean;
}

export interface ComplianceInformation {
  mandatoryTraining?: TrainingRecord[];
  vaccinationRecords?: VaccinationRecord[];
  healthScreenings?: HealthScreeningRecord[];
  policyAcknowledgments?: PolicyAcknowledgment[];
  incidentReports?: Reference[]; // Basic
}

export interface TrainingRecord {
  trainingName: string;
  completionDate: string;
  expirationDate?: string;
  certificateUrl?: string;
  credits?: number;
  status: 'completed' | 'expired' | 'pending';
}

export interface VaccinationRecord {
  vaccine: CodeableConcept;
  administrationDate: string;
  expirationDate?: string;
  lotNumber?: string;
  provider?: Reference; // Organization
  status: 'current' | 'expired' | 'declined';
}

export interface HealthScreeningRecord {
  screeningType: CodeableConcept;
  screeningDate: string;
  nextDueDate?: string;
  result: 'pass' | 'fail' | 'pending';
  notes?: string;
}

export interface PolicyAcknowledgment {
  policyName: string;
  policyVersion: string;
  acknowledgmentDate: string;
  digitalSignature?: string;
  witnessedBy?: Reference; // Practitioner
}

/**
 * PractitionerRole Resource Extension
 */
export interface OmniCarePractitionerRole extends FHIRResource {
  resourceType: 'PractitionerRole';
  
  // Core FHIR PractitionerRole fields
  identifier?: Identifier[];
  active?: boolean;
  period?: Period;
  practitioner?: Reference; // Practitioner
  organization?: Reference; // Organization
  code?: CodeableConcept[];
  specialty?: CodeableConcept[];
  location?: Reference[]; // Location
  healthcareService?: Reference[]; // HealthcareService
  telecom?: ContactPoint[];
  availableTime?: PractitionerRoleAvailableTime[];
  notAvailable?: PractitionerRoleNotAvailable[];
  availabilityExceptions?: string;
  endpoint?: Reference[]; // Endpoint

  // OmniCare-specific extensions
  omnicarePractitionerRoleId?: string;
  billingRate?: BillingRate[];
  supervisoryRelationships?: SupervisoryRelationship[];
  privilegesAndRestrictions?: PrivilegeRestriction[];
  performanceReviews?: PerformanceReview[];
}

export interface PractitionerRoleAvailableTime {
  daysOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  allDay?: boolean;
  availableStartTime?: string;
  availableEndTime?: string;
}

export interface PractitionerRoleNotAvailable {
  description: string;
  during?: Period;
}

export interface BillingRate {
  serviceType: CodeableConcept;
  rate: {
    value: number;
    currency: string;
  };
  effectiveDate: string;
  expirationDate?: string;
  unit: 'per-hour' | 'per-service' | 'per-rvu' | 'salary';
}

export interface SupervisoryRelationship {
  type: 'supervisor' | 'supervisee' | 'peer-mentor' | 'medical-director';
  relatedPractitioner: Reference; // Practitioner
  startDate: string;
  endDate?: string;
  responsibilities?: string[];
}

export interface PrivilegeRestriction {
  type: 'privilege' | 'restriction';
  description: string;
  scope: CodeableConcept[];
  effectiveDate: string;
  expirationDate?: string;
  grantedBy: Reference; // Practitioner
  reviewDate?: string;
}

export interface PerformanceReview {
  reviewPeriod: Period;
  reviewerType: 'supervisor' | 'peer' | 'patient' | 'self';
  reviewer?: Reference; // Practitioner
  overallRating: number;
  maxRating: number;
  strengths?: string[];
  improvementAreas?: string[];
  goals?: PerformanceGoal[];
  actionPlan?: string;
  nextReviewDate?: string;
}

export interface PerformanceGoal {
  description: string;
  targetDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'cancelled';
  metrics?: string[];
}

/**
 * Search Parameters
 */
export interface PractitionerSearchParams {
  _id?: string;
  active?: boolean;
  address?: string;
  'address-city'?: string;
  'address-country'?: string;
  'address-postalcode'?: string;
  'address-state'?: string;
  communication?: string;
  email?: string;
  family?: string;
  gender?: string;
  given?: string;
  identifier?: string;
  name?: string;
  phone?: string;
  telecom?: string;
  
  // OmniCare-specific
  'omnicare-id'?: string;
  'employee-id'?: string;
  department?: string;
  specialty?: string;
  'license-number'?: string;
  'board-certification'?: string;
  
  // Common modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
}

/**
 * Practitioner Statistics  
 */
export interface PractitionerStatistics {
  totalPractitioners: number;
  activePractitioners: number;
  practitionersBySpecialty: Record<string, number>;
  practitionersByDepartment: Record<string, number>;
  averagePatientSatisfaction: number;
  credentialExpirations: Array<{
    practitioner: string;
    credentialType: string;
    expirationDate: string;
  }>;
  performanceMetrics: {
    averageAppointmentDuration: number;
    averageNoShowRate: number;
    averageDocumentationCompletion: number;
  };
}