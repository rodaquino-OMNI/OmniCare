import { Organization as FHIROrganization } from '@medplum/fhirtypes';

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
 * Extended Organization Model for OmniCare EMR
 * Combines FHIR R4 Organization resource with OmniCare-specific extensions
 */
export interface OmniCareOrganization extends FHIRResource {
  resourceType: 'Organization';
  
  // Core FHIR Organization fields
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: ContactPoint[];
  address?: Address[];
  partOf?: Reference; // Organization
  contact?: OrganizationContact[];
  endpoint?: Reference[]; // Endpoint

  // OmniCare-specific extensions
  omnicareOrganizationId?: string;
  organizationType: OrganizationType;
  businessInformation?: BusinessInformation;
  accreditation?: AccreditationInformation[];
  insurance?: OrganizationInsurance;
  departments?: DepartmentInformation[];
  facilities?: FacilityInformation[];
  contracts?: ContractInformation[];
  qualityMetrics?: OrganizationQualityMetrics;
  complianceInfo?: OrganizationComplianceInfo;
  networkAffiliations?: NetworkAffiliation[];
}

export interface OrganizationContact {
  purpose?: CodeableConcept;
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
}

export interface OrganizationType {
  category: 'healthcare-provider' | 'insurance-company' | 'pharmacy' | 'laboratory' | 'imaging-center' | 'government-agency' | 'vendor' | 'other';
  subType?: string;
  specialtyAreas?: CodeableConcept[];
  serviceLines?: ServiceLine[];
}

export interface ServiceLine {
  name: string;
  code?: CodeableConcept;
  description?: string;
  isActive: boolean;
  department?: Reference; // Organization
  primaryContact?: Reference; // Practitioner
}

export interface BusinessInformation {
  taxId?: string;
  businessLicenseNumber?: string;
  incorporationDate?: string;
  businessStructure?: 'corporation' | 'llc' | 'partnership' | 'sole-proprietorship' | 'non-profit';
  dunsNumber?: string;
  naicsCode?: string;
  sicCode?: string;
  ownershipType?: 'private' | 'public' | 'government' | 'non-profit';
  parentOrganization?: Reference; // Organization
  subsidiaries?: Reference[]; // Organization
}

export interface AccreditationInformation {
  accreditingBody: string;
  accreditationType: CodeableConcept;
  accreditationNumber?: string;
  effectiveDate: string;
  expirationDate?: string;
  status: 'active' | 'expired' | 'suspended' | 'pending';
  scopeOfAccreditation?: string[];
  lastSurveyDate?: string;
  nextSurveyDate?: string;
  certificateUrl?: string;
}

export interface OrganizationInsurance {
  generalLiability?: InsurancePolicy;
  professionalLiability?: InsurancePolicy;
  propertyInsurance?: InsurancePolicy;
  workersCompensation?: InsurancePolicy;
  cyberLiability?: InsurancePolicy;
  directorAndOfficer?: InsurancePolicy;
}

export interface InsurancePolicy {
  provider: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  coverageAmount: {
    perClaim?: number;
    aggregate?: number;
  };
  deductible?: number;
  premium?: number;
  status: 'active' | 'expired' | 'pending' | 'cancelled';
  broker?: OrganizationContact;
}

export interface DepartmentInformation {
  departmentId: string;
  name: string;
  code?: CodeableConcept;
  parentDepartment?: string;
  isActive: boolean;
  headOfDepartment?: Reference; // Practitioner
  location?: Reference; // Location
  budget?: DepartmentBudget;
  staffing?: DepartmentStaffing;
  services?: CodeableConcept[];
  operatingHours?: OperatingHours[];
  contactInfo?: ContactPoint[];
}

export interface DepartmentBudget {
  annualBudget?: number;
  remainingBudget?: number;
  budgetPeriod: Period;
  budgetCategories?: BudgetCategory[];
}

export interface BudgetCategory {
  category: 'personnel' | 'equipment' | 'supplies' | 'services' | 'other';
  allocatedAmount: number;
  spentAmount?: number;
  remainingAmount?: number;
}

export interface DepartmentStaffing {
  totalFTE?: number;
  currentStaffCount?: number;
  vacantPositions?: number;
  staffByRole?: StaffByRole[];
  staffTurnoverRate?: number;
}

export interface StaffByRole {
  role: CodeableConcept;
  budgetedCount: number;
  actualCount: number;
  vacancies: number;
}

export interface OperatingHours {
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  isOpen: boolean;
  openTime?: string; // HH:mm format
  closeTime?: string; // HH:mm format
  breaks?: TimeBreak[];
  specialHours?: SpecialOperatingHours[];
}

export interface TimeBreak {
  startTime: string;
  endTime: string;
  description?: string;
}

export interface SpecialOperatingHours {
  date: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  reason?: string;
}

export interface FacilityInformation {
  facilityId: string;
  name: string;
  type: CodeableConcept;
  address: Address;
  isMainFacility: boolean;
  capacity?: FacilityCapacity;
  amenities?: CodeableConcept[];
  accessibility?: AccessibilityFeature[];
  parkingInfo?: ParkingInformation;
  publicTransportation?: PublicTransportationInfo[];
}

export interface FacilityCapacity {
  totalBeds?: number;
  availableBeds?: number;
  icuBeds?: number;
  emergencyBeds?: number;
  surgicalSuites?: number;
  examinationRooms?: number;
  treatmentRooms?: number;
  waitingCapacity?: number;
}

export interface AccessibilityFeature {
  feature: CodeableConcept;
  description?: string;
  location?: string;
  isAvailable: boolean;
}

export interface ParkingInformation {
  totalSpaces?: number;
  handicapSpaces?: number;
  valletService?: boolean;
  cost?: {
    hourlyRate?: number;
    dailyRate?: number;
    validationAvailable?: boolean;
  };
  restrictions?: string[];
}

export interface PublicTransportationInfo {
  type: 'bus' | 'train' | 'subway' | 'taxi' | 'rideshare';
  routeName?: string;
  stopName?: string;
  distanceFromFacility?: number; // meters
  walkingTime?: number; // minutes
}

export interface ContractInformation {
  contractId: string;
  contractType: 'insurance' | 'vendor' | 'employment' | 'service' | 'lease' | 'other';
  contractorName: string;
  contractorOrganization?: Reference; // Organization
  effectiveDate: string;
  expirationDate?: string;
  renewalTerms?: RenewalTerms;
  paymentTerms?: PaymentTerms;
  scope?: string;
  value?: number;
  status: 'active' | 'expired' | 'pending' | 'terminated';
  keyPersonnel?: Reference[]; // Practitioner
  performanceMetrics?: ContractPerformanceMetric[];
}

export interface RenewalTerms {
  autoRenew: boolean;
  renewalPeriod?: Period;
  noticePeriod?: number; // days
  renewalConditions?: string[];
}

export interface PaymentTerms {
  paymentSchedule: 'monthly' | 'quarterly' | 'annually' | 'per-service' | 'milestone-based';
  paymentDueDays: number;
  lateFeePercentage?: number;
  discountTerms?: DiscountTerm[];
}

export interface DiscountTerm {
  discountPercentage: number;
  condition: string;
  applicablePeriod?: Period;
}

export interface ContractPerformanceMetric {
  metric: string;
  target: number;
  actual?: number;
  measurementPeriod: Period;
  unit?: string;
}

export interface OrganizationQualityMetrics {
  patientSatisfactionScore?: number;
  qualityRatings?: QualityRating[];
  safetyMetrics?: SafetyMetric[];
  financialMetrics?: FinancialMetric[];
  operationalMetrics?: OperationalMetric[];
  clinicalMetrics?: ClinicalMetric[];
}

export interface QualityRating {
  ratingOrganization: string;
  ratingType: string;
  score: number;
  maxScore: number;
  ratingDate: string;
  validUntil?: string;
  url?: string;
}

export interface SafetyMetric {
  metricName: string;
  value: number;
  unit?: string;
  reportingPeriod: Period;
  benchmark?: number;
  trend?: 'improving' | 'stable' | 'declining';
}

export interface FinancialMetric {
  metricName: string;
  value: number;
  currency: string;
  reportingPeriod: Period;
  variance?: number;
  budgetTarget?: number;
}

export interface OperationalMetric {
  metricName: string;
  value: number;
  unit?: string;
  reportingPeriod: Period;
  target?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface ClinicalMetric {
  metricName: string;
  value: number;
  unit?: string;
  reportingPeriod: Period;
  patientPopulation?: string;
  benchmark?: number;
  nationalAverage?: number;
}

export interface OrganizationComplianceInfo {
  regulatoryBody?: string[];
  complianceStatus?: ComplianceStatus[];
  auditHistory?: AuditHistory[];
  violationHistory?: ViolationHistory[];
  correctiveActions?: CorrectiveAction[];
  policies?: PolicyDocument[];
}

export interface ComplianceStatus {
  regulationType: CodeableConcept;
  status: 'compliant' | 'non-compliant' | 'conditional' | 'under-review';
  effectiveDate: string;
  nextReviewDate?: string;
  certificationNumber?: string;
  notes?: string;
}

export interface AuditHistory {
  auditId: string;
  auditType: CodeableConcept;
  auditorOrganization: string;
  auditDate: string;
  scope: string[];
  findings?: AuditFinding[];
  overallResult: 'pass' | 'pass-with-conditions' | 'fail';
  reportUrl?: string;
}

export interface AuditFinding {
  category: CodeableConcept;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation?: string;
  correctionDeadline?: string;
  status: 'open' | 'in-progress' | 'resolved';
}

export interface ViolationHistory {
  violationId: string;
  regulationType: CodeableConcept;
  violationDate: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  penalty?: {
    type: 'fine' | 'suspension' | 'warning' | 'other';
    amount?: number;
    description?: string;
  };
  resolutionStatus: 'open' | 'resolved' | 'appealed';
  resolutionDate?: string;
}

export interface CorrectiveAction {
  actionId: string;
  relatedViolation?: string;
  relatedAuditFinding?: string;
  description: string;
  assignedTo?: Reference; // Practitioner
  plannedCompletionDate: string;
  actualCompletionDate?: string;
  status: 'planned' | 'in-progress' | 'completed' | 'overdue';
  verificationRequired?: boolean;
  verificationBy?: Reference; // Practitioner
}

export interface PolicyDocument {
  policyId: string;
  title: string;
  version: string;
  effectiveDate: string;
  reviewDate?: string;
  nextReviewDate?: string;
  approvedBy: Reference; // Practitioner
  scope: string[];
  documentUrl?: string;
  relatedPolicies?: string[];
}

export interface NetworkAffiliation {
  networkName: string;
  networkType: 'insurance' | 'clinical' | 'purchasing' | 'quality' | 'other';
  membershipId?: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'pending' | 'terminated';
  benefitsDescription?: string;
  membershipFee?: number;
  keyContacts?: OrganizationContact[];
}

/**
 * Healthcare Service Resource Extension
 */
export interface OmniCareHealthcareService extends FHIRResource {
  resourceType: 'HealthcareService';
  
  // Core FHIR HealthcareService fields
  identifier?: Identifier[];
  active?: boolean;
  providedBy?: Reference; // Organization
  category?: CodeableConcept[];
  type?: CodeableConcept[];
  specialty?: CodeableConcept[];
  location?: Reference[]; // Location
  name?: string;
  comment?: string;
  extraDetails?: string;
  photo?: Attachment;
  telecom?: ContactPoint[];
  coverageArea?: Reference[]; // Location
  serviceProvisionCode?: CodeableConcept[];
  eligibility?: HealthcareServiceEligibility[];
  program?: CodeableConcept[];
  characteristic?: CodeableConcept[];
  communication?: CodeableConcept[];
  referralMethod?: CodeableConcept[];
  appointmentRequired?: boolean;
  availableTime?: HealthcareServiceAvailableTime[];
  notAvailable?: HealthcareServiceNotAvailable[];
  availabilityExceptions?: string;
  endpoint?: Reference[]; // Endpoint

  // OmniCare-specific extensions
  omnicareServiceId?: string;
  serviceMetrics?: ServiceMetrics;
  qualityIndicators?: ServiceQualityIndicator[];
  costInformation?: ServiceCostInformation;
  waitTimes?: ServiceWaitTime[];
}

export interface HealthcareServiceEligibility {
  code?: CodeableConcept;
  comment?: string;
}

export interface HealthcareServiceAvailableTime {
  daysOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  allDay?: boolean;
  availableStartTime?: string;
  availableEndTime?: string;
}

export interface HealthcareServiceNotAvailable {
  description: string;
  during?: Period;
}

export interface ServiceMetrics {
  averageAppointmentDuration?: number; // minutes
  patientVolume?: ServiceVolume;
  utilizationRate?: number; // percentage
  patientSatisfactionScore?: number;
  outcomeMetrics?: ServiceOutcome[];
}

export interface ServiceVolume {
  daily?: number;
  weekly?: number;
  monthly?: number;
  annual?: number;
  peakHours?: string[];
}

export interface ServiceOutcome {
  outcomeMeasure: string;
  value: number;
  unit?: string;
  reportingPeriod: Period;
  benchmark?: number;
}

export interface ServiceQualityIndicator {
  indicator: string;
  value: number;
  unit?: string;
  targetValue?: number;
  measurementDate: string;
  source?: string;
}

export interface ServiceCostInformation {
  baseCost?: number;
  currency: string;
  costType: 'fixed' | 'variable' | 'tiered';
  insuranceCoverage?: InsuranceCoverage[];
  paymentOptions?: PaymentOption[];
  financialAssistance?: FinancialAssistanceOption[];
}

export interface InsuranceCoverage {
  insuranceType: CodeableConcept;
  coveragePercentage?: number;
  copayAmount?: number;
  deductibleApplies?: boolean;
  priorAuthorizationRequired?: boolean;
}

export interface PaymentOption {
  type: 'insurance' | 'self-pay' | 'payment-plan' | 'financial-assistance';
  description: string;
  eligibilityCriteria?: string[];
}

export interface FinancialAssistanceOption {
  programName: string;
  discountPercentage?: number;
  eligibilityCriteria: string[];
  applicationRequired: boolean;
  contactInformation?: ContactPoint[];
}

export interface ServiceWaitTime {
  appointmentType: CodeableConcept;
  averageWaitDays?: number;
  urgentWaitDays?: number;
  routineWaitDays?: number;
  nextAvailableDate?: string;
  lastUpdated: string;
}

/**
 * Search Parameters
 */
export interface OrganizationSearchParams {
  _id?: string;
  active?: boolean;
  address?: string;
  'address-city'?: string;
  'address-country'?: string;
  'address-postalcode'?: string;
  'address-state'?: string;
  'address-use'?: string;
  endpoint?: string;
  identifier?: string;
  name?: string;
  partof?: string;
  phonetic?: string;
  type?: string;
  
  // OmniCare-specific
  'omnicare-id'?: string;
  'organization-type'?: string;
  specialty?: string;
  accreditation?: string;
  
  // Common modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
}

/**
 * Organization Statistics
 */
export interface OrganizationStatistics {
  totalOrganizations: number;
  activeOrganizations: number;
  organizationsByType: Record<string, number>;
  organizationsBySpecialty: Record<string, number>;
  averageQualityScore: number;
  contractsExpiringSoon: Array<{
    organization: string;
    contractType: string;
    expirationDate: string;
  }>;
  complianceStatus: {
    compliant: number;
    nonCompliant: number;
    underReview: number;
  };
  networkParticipation: Record<string, number>;
}