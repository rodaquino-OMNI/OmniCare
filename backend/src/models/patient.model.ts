import { Patient as FHIRPatient } from '@medplum/fhirtypes';

import { 
  FHIRResource, 
  Identifier, 
  HumanName, 
  Address, 
  ContactPoint, 
  Reference, 
  CodeableConcept,
  Attachment,
  ValidationResult
} from './base.model';

/**
 * Extended Patient Model for OmniCare EMR
 * Combines FHIR R4 Patient resource with OmniCare-specific extensions
 */
export interface OmniCarePatient extends FHIRResource {
  resourceType: 'Patient';
  
  // Core FHIR Patient fields
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];

  // OmniCare-specific extensions
  omnicarePatientId?: string;
  registrationDate?: string;
  preferredLanguage?: string;
  emergencyContact?: PatientEmergencyContact[];
  insurance?: InsuranceInformation[];
  demographics?: PatientDemographics;
  preferences?: PatientPreferences;
  accessibilityNeeds?: AccessibilityNeeds;
  socialHistory?: SocialHistory;
  familyHistory?: FamilyHistoryRecord[];
  alerts?: PatientAlert[];
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface PatientCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

export interface PatientEmergencyContact {
  id?: string;
  relationship: string;
  name: HumanName;
  telecom: ContactPoint[];
  address?: Address;
  priority: number;
  active: boolean;
}

export interface InsuranceInformation {
  id?: string;
  subscriberId: string;
  payorName: string;
  payorId?: string;
  planName?: string;
  groupNumber?: string;
  policyNumber?: string;
  relationshipToSubscriber: 'self' | 'spouse' | 'child' | 'other';
  effectiveDate: string;
  terminationDate?: string;
  copayAmount?: number;
  deductibleAmount?: number;
  active: boolean;
  priority: number; // 1 = primary, 2 = secondary, etc.
}

export interface PatientDemographics {
  race?: CodeableConcept[];
  ethnicity?: CodeableConcept[];
  religion?: CodeableConcept;
  nationality?: string;
  birthPlace?: Address;
  occupation?: string;
  educationLevel?: CodeableConcept;
  disability?: CodeableConcept[];
}

export interface PatientPreferences {
  communicationPreferences?: {
    preferredLanguage?: string;
    interpreterRequired?: boolean;
    communicationMethod?: 'phone' | 'email' | 'sms' | 'portal' | 'mail';
    appointmentReminders?: boolean;
    labResultsDelivery?: 'phone' | 'email' | 'portal' | 'mail';
  };
  treatmentPreferences?: {
    advanceDirectives?: Reference[];
    organDonor?: boolean;
    resuscitationStatus?: 'full-code' | 'dnr' | 'dnar' | 'comfort-care';
    emergencyTreatmentConsent?: boolean;
  };
  privacyPreferences?: {
    shareWithFamily?: boolean;
    shareWithEmergencyContact?: boolean;
    marketingOptOut?: boolean;
    researchParticipation?: boolean;
  };
}

export interface AccessibilityNeeds {
  physicalDisability?: string[];
  cognitiveNeeds?: string[];
  sensoryImpairments?: string[];
  assistiveDevices?: string[];
  accommodationRequests?: string[];
  transportationNeeds?: string;
}

export interface SocialHistory {
  smokingStatus?: CodeableConcept;
  alcoholUse?: {
    status: CodeableConcept;
    frequency?: string;
    quantity?: string;
  };
  substanceUse?: {
    substance: CodeableConcept;
    status: CodeableConcept;
    frequency?: string;
  }[];
  sexualHistory?: {
    sexuallyActive?: boolean;
    partners?: number;
    orientation?: CodeableConcept;
  };
  dietaryRestrictions?: CodeableConcept[];
  exerciseHabits?: {
    frequency?: string;
    type?: string[];
    intensity?: 'low' | 'moderate' | 'high';
  };
  livingArrangement?: {
    type: CodeableConcept;
    supportSystem?: string[];
    livingAlone?: boolean;
  };
  employmentStatus?: CodeableConcept;
  veteranStatus?: boolean;
}

export interface FamilyHistoryRecord {
  id?: string;
  relationship: CodeableConcept;
  name?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  bornDate?: string;
  ageAtDeath?: number;
  causeOfDeath?: CodeableConcept;
  conditions?: FamilyCondition[];
  deceased?: boolean;
}

export interface FamilyCondition {
  condition: CodeableConcept;
  onset?: {
    ageAtOnset?: number;
    onsetDateTime?: string;
  };
  note?: string;
}

export interface PatientAlert {
  id?: string;
  type: 'allergy' | 'medical' | 'behavioral' | 'infection-control' | 'safety' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  effectiveDate: string;
  expirationDate?: string;
  active: boolean;
  createdBy: Reference;
  lastUpdatedBy: Reference;
}

/**
 * Patient Search Parameters
 */
export interface PatientSearchParams {
  _id?: string;
  active?: boolean;
  address?: string;
  'address-city'?: string;
  'address-country'?: string;
  'address-postalcode'?: string;
  'address-state'?: string;
  'address-use'?: string;
  birthdate?: string;
  death_date?: string;
  deceased?: boolean;
  email?: string;
  family?: string;
  gender?: string;
  given?: string;
  identifier?: string;
  language?: string;
  name?: string;
  phone?: string;
  phonetic?: string;
  telecom?: string;
  
  // OmniCare-specific search parameters
  'omnicare-id'?: string;
  'registration-date'?: string;
  'insurance-id'?: string;
  'emergency-contact'?: string;
  'primary-care-provider'?: string;
  
  // Common search modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
}

/**
 * Patient Statistics
 */
export interface PatientStatistics {
  totalPatients: number;
  activePatients: number;
  newPatientsThisMonth: number;
  averageAge: number;
  genderDistribution: {
    male: number;
    female: number;
    other: number;
    unknown: number;
  };
  topInsuranceProviders: Array<{
    name: string;
    count: number;
  }>;
  demographicBreakdown: {
    ageGroups: Array<{
      range: string;
      count: number;
    }>;
    locationDistribution: Array<{
      city: string;
      state: string;
      count: number;
    }>;
  };
}

/**
 * Patient Registration Request
 */
export interface PatientRegistrationRequest {
  demographicInfo: {
    name: HumanName[];
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate: string;
    address: Address[];
    telecom: ContactPoint[];
    maritalStatus?: CodeableConcept;
  };
  identifiers?: Identifier[];
  emergencyContacts?: PatientEmergencyContact[];
  insurance?: InsuranceInformation[];
  preferences?: PatientPreferences;
  primaryCareProvider?: Reference;
  referringProvider?: Reference;
  consentForms?: {
    treatmentConsent: boolean;
    privacyNoticeAcknowledged: boolean;
    communicationConsent: boolean;
    researchConsent?: boolean;
  };
}

/**
 * Patient Update Request
 */
export interface PatientUpdateRequest {
  demographicInfo?: Partial<{
    name: HumanName[];
    address: Address[];
    telecom: ContactPoint[];
    maritalStatus: CodeableConcept;
  }>;
  emergencyContacts?: PatientEmergencyContact[];
  insurance?: InsuranceInformation[];
  preferences?: Partial<PatientPreferences>;
  accessibilityNeeds?: Partial<AccessibilityNeeds>;
  alerts?: PatientAlert[];
}

/**
 * Patient Social History Interface  
 */
export interface PatientSocialHistory {
  smokingStatus?: 'never' | 'former' | 'current' | 'unknown';
  alcoholUse?: 'never' | 'light' | 'moderate' | 'heavy' | 'unknown';
  substanceUse?: string[];
  occupation?: string;
  socialSupportSystem?: string;
  livingArrangement?: string;
  exerciseHabits?: string;
  dietaryHabits?: string;
}

/**
 * Validation Functions
 */
export function validateOmniCarePatient(patient: Partial<OmniCarePatient>): ValidationResult {
  const errors: string[] = [];
  
  if (!patient.resourceType || patient.resourceType !== 'Patient') {
    errors.push('resourceType must be "Patient"');
  }
  
  if (!patient.name || patient.name.length === 0) {
    errors.push('Patient name is required');
  }
  
  if (!(patient as any).omnicarePatientId) {
    errors.push('omnicarePatientId is required');
  }
  
  if (patient.birthDate) {
    const birthDate = new Date(patient.birthDate);
    if (birthDate > new Date()) {
      errors.push('Birth date cannot be in the future');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateEmergencyContact(contact: Partial<PatientEmergencyContact>): ValidationResult {
  const errors: string[] = [];
  
  if (!contact.name) {
    errors.push('Emergency contact name is required');
  }
  
  if (!contact.relationship) {
    errors.push('Emergency contact relationship is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateInsurance(insurance: Partial<InsuranceInformation>): ValidationResult {
  const errors: string[] = [];
  
  if (!insurance.payorName) {
    errors.push('Insurance payor name is required');
  }
  
  if (!insurance.planName) {
    errors.push('Insurance plan name is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validatePatientAlert(alert: Partial<PatientAlert>): ValidationResult {
  const errors: string[] = [];
  
  if (!alert.type) {
    errors.push('Alert type is required');
  }
  
  if (!alert.severity) {
    errors.push('Alert severity is required');
  }
  
  if (!alert.title) {
    errors.push('Alert title is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Utility Functions
 */
export function formatPatientName(nameOrPatient: HumanName | OmniCarePatient): string {
  // If it's a patient object, get the first name
  if ('resourceType' in nameOrPatient && nameOrPatient.resourceType === 'Patient') {
    const patient = nameOrPatient as OmniCarePatient;
    if (!patient.name || patient.name.length === 0) {
      return '';
    }
    const name = patient.name[0];
    if (!name) return '';
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim();
  }
  
  // If it's a HumanName object
  const name = nameOrPatient as HumanName;
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  return `${given} ${family}`.trim();
}

export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getActiveInsurance(insurance: InsuranceInformation[]): InsuranceInformation | undefined {
  return insurance.find(ins => ins.active && ins.priority === 1);
}

export function hasActiveAlerts(alerts: PatientAlert[]): boolean {
  return alerts.some(alert => alert.active);
}