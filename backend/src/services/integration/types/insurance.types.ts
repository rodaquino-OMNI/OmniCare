/**
 * Insurance Integration Types
 * Type definitions for insurance verification, claims processing, and EDI transactions
 */

import { IntegrationResult, IntegrationMessage, IntegrationConfig, ComplianceStatus } from './integration.types';
import { 
  Period, 
  CodeableConcept, 
  Coding, 
  Quantity, 
  Identifier, 
  Attachment, 
  Reference 
} from '../../../models/base.model';

/**
 * X12 EDI Transaction Types
 */
export enum X12TransactionType {
  // Eligibility & Benefits
  ELIGIBILITY_REQUEST_270 = '270',
  ELIGIBILITY_RESPONSE_271 = '271',
  
  // Claims
  CLAIM_837 = '837',
  CLAIM_STATUS_REQUEST_276 = '276',
  CLAIM_STATUS_RESPONSE_277 = '277',
  
  // Remittance
  REMITTANCE_ADVICE_835 = '835',
  
  // Enrollment
  ENROLLMENT_834 = '834',
  
  // Premium Payment
  PREMIUM_PAYMENT_820 = '820',
  
  // Acknowledgments
  FUNCTIONAL_ACK_997 = '997',
  IMPLEMENTATION_ACK_999 = '999',
  
  // Authorization
  AUTHORIZATION_REQUEST_278 = '278',
  AUTHORIZATION_RESPONSE_278 = '278R'
}

/**
 * Insurance Coverage Status
 */
export enum CoverageStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  DRAFT = 'draft',
  ENTERED_IN_ERROR = 'entered-in-error',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated'
}

/**
 * Eligibility Status
 */
export enum EligibilityStatus {
  ELIGIBLE = 'eligible',
  NOT_ELIGIBLE = 'not-eligible',
  PENDING = 'pending',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

/**
 * Claim Status
 */
export enum ClaimStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  SUBMITTED = 'submitted',
  PROCESSED = 'processed',
  ADJUDICATED = 'adjudicated',
  PAID = 'paid',
  DENIED = 'denied',
  PENDING = 'pending',
  APPEALED = 'appealed'
}

/**
 * Authorization Status
 */
export enum AuthorizationStatus {
  DRAFT = 'draft',
  REQUESTED = 'requested',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  COMPLETED = 'completed',
  ENTERED_IN_ERROR = 'entered-in-error',
  CANCELLED = 'cancelled',
  DENIED = 'denied',
  EXPIRED = 'expired'
}

/**
 * Insurance Plan Types
 */
export enum PlanType {
  HMO = 'HMO',
  PPO = 'PPO',
  EPO = 'EPO',
  POS = 'POS',
  HDHP = 'HDHP',
  MEDICARE = 'Medicare',
  MEDICAID = 'Medicaid',
  COMMERCIAL = 'Commercial',
  SELF_PAY = 'Self-Pay',
  WORKERS_COMP = 'Workers Compensation',
  AUTO = 'Auto',
  OTHER = 'Other'
}

/**
 * Insurance Company/Payer
 */
export interface Payer {
  id: string;
  payerId: string; // EDI Payer ID
  name: string;
  planTypes: PlanType[];
  contact: PayerContact;
  electronicCapabilities: ElectronicCapabilities;
  active: boolean;
}

/**
 * Payer Contact Information
 */
export interface PayerContact {
  phone?: string;
  fax?: string;
  email?: string;
  address?: Address;
  ediContact?: EDIContact;
  providerRelations?: ContactInfo;
  memberServices?: ContactInfo;
}

/**
 * Contact Information
 */
export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
  hours?: string;
}

/**
 * EDI Contact
 */
export interface EDIContact {
  vendorName?: string;
  submitterId?: string;
  receiverId?: string;
  testSubmitterId?: string;
  testReceiverId?: string;
  supportPhone?: string;
  supportEmail?: string;
}

/**
 * Electronic Capabilities
 */
export interface ElectronicCapabilities {
  eligibilityInquiry: boolean;
  claimSubmission: boolean;
  claimStatus: boolean;
  remittanceAdvice: boolean;
  priorAuthorization: boolean;
  realTimeClaims: boolean;
  supportedTransactions: X12TransactionType[];
  supportedFormats: string[];
}

/**
 * Address
 */
export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Insurance Coverage
 */
export interface Coverage {
  id: string;
  status: CoverageStatus;
  type: CoverageType;
  policyHolder: PolicyHolder;
  subscriber: Subscriber;
  beneficiary: Beneficiary;
  dependent?: Dependent[];
  relationship: RelationshipCode;
  period: CoveragePeriod;
  payer: Payer;
  class?: CoverageClass[];
  order?: number;
  network?: string;
  costToBeneficiary?: CostToBeneficiary[];
  subrogation?: boolean;
  contract?: Contract[];
}

/**
 * Coverage Type
 */
export interface CoverageType {
  system: string;
  code: string;
  display: string;
}

/**
 * Policy Holder
 */
export interface PolicyHolder {
  id: string;
  name: string;
  identifier?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: Address;
}

/**
 * Subscriber
 */
export interface Subscriber {
  id: string;
  memberId: string;
  name: string;
  dateOfBirth: Date;
  gender?: string;
  address?: Address;
  phone?: string;
  email?: string;
}

/**
 * Beneficiary
 */
export interface Beneficiary {
  id: string;
  patientId: string;
  name: string;
  dateOfBirth: Date;
  gender?: string;
}

/**
 * Dependent
 */
export interface Dependent {
  id: string;
  name: string;
  relationship: RelationshipCode;
  dateOfBirth: Date;
  gender?: string;
}

/**
 * Relationship Codes
 */
export enum RelationshipCode {
  SELF = 'self',
  SPOUSE = 'spouse',
  CHILD = 'child',
  PARENT = 'parent',
  OTHER = 'other',
  LIFE_PARTNER = 'life-partner',
  EMPLOYEE = 'employee'
}

/**
 * Coverage Period
 */
export interface CoveragePeriod {
  start: Date;
  end?: Date;
}

/**
 * Coverage Class
 */
export interface CoverageClass {
  type: 'group' | 'subgroup' | 'plan' | 'subplan' | 'class' | 'subclass' | 'sequence' | 'rxbin' | 'rxpcn' | 'rxgroup';
  value: string;
  name?: string;
}

/**
 * Cost to Beneficiary
 */
export interface CostToBeneficiary {
  type: CostType;
  value?: Money;
  percentage?: number;
  exceptions?: Exception[];
}

/**
 * Cost Types
 */
export enum CostType {
  DEDUCTIBLE = 'deductible',
  COPAY = 'copay',
  COINSURANCE = 'coinsurance',
  OUT_OF_POCKET_MAX = 'out-of-pocket-max',
  VISIT_LIMIT = 'visit-limit',
  BENEFIT_MAX = 'benefit-max'
}

/**
 * Money
 */
export interface Money {
  value: number;
  currency: string;
}

/**
 * Exception
 */
export interface Exception {
  type: string;
  period?: CoveragePeriod;
  value?: Money;
}

/**
 * Contract
 */
export interface Contract {
  id: string;
  type?: string;
  period?: CoveragePeriod;
  reference?: string;
}

/**
 * Eligibility Request
 */
export interface EligibilityRequest {
  id: string;
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  priority?: 'normal' | 'urgent' | 'asap' | 'stat';
  patient: PatientReference;
  servicedDate?: Date;
  servicedPeriod?: Period;
  created: Date;
  provider: ProviderReference;
  insurer: Payer;
  coverage: CoverageReference;
  item?: EligibilityItem[];
  purpose: EligibilityPurpose[];
}

/**
 * Patient Reference
 */
export interface PatientReference {
  id: string;
  identifier?: string;
  name: string;
  dateOfBirth?: Date;
  gender?: string;
}

/**
 * Provider Reference
 */
export interface ProviderReference {
  id: string;
  npi: string;
  name: string;
  taxId?: string;
  type?: 'practitioner' | 'organization';
}

/**
 * Coverage Reference
 */
export interface CoverageReference {
  id: string;
  memberId: string;
  groupNumber?: string;
}


/**
 * Eligibility Item
 */
export interface EligibilityItem {
  category?: CodeableConcept;
  productOrService?: CodeableConcept;
  modifier?: CodeableConcept[];
  provider?: ProviderReference;
  quantity?: Quantity;
  unitPrice?: Money;
  facility?: FacilityReference;
  diagnosis?: DiagnosisReference[];
}



/**
 * Facility Reference
 */
export interface FacilityReference {
  id: string;
  name: string;
  npi?: string;
  address?: Address;
}

/**
 * Diagnosis Reference
 */
export interface DiagnosisReference {
  diagnosis: CodeableConcept;
  type?: 'principal' | 'admitting' | 'discharge' | 'comorbidity';
}

/**
 * Eligibility Purpose
 */
export enum EligibilityPurpose {
  AUTH_REQUIREMENTS = 'auth-requirements',
  BENEFITS = 'benefits',
  DISCOVERY = 'discovery',
  VALIDATION = 'validation'
}

/**
 * Eligibility Response
 */
export interface EligibilityResponse {
  id: string;
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  purpose: EligibilityPurpose[];
  patient: PatientReference;
  servicedDate?: Date;
  servicedPeriod?: Period;
  created: Date;
  requestor?: ProviderReference;
  request: EligibilityRequest;
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  insurer: Payer;
  insurance?: InsuranceComponent[];
  preAuthRef?: string;
  error?: ErrorComponent[];
}

/**
 * Insurance Component
 */
export interface InsuranceComponent {
  coverage: CoverageReference;
  inforce?: boolean;
  benefitPeriod?: Period;
  item?: BenefitItem[];
}

/**
 * Benefit Item
 */
export interface BenefitItem {
  category?: CodeableConcept;
  productOrService?: CodeableConcept;
  modifier?: CodeableConcept[];
  provider?: ProviderReference;
  excluded?: boolean;
  name?: string;
  description?: string;
  network?: CodeableConcept;
  unit?: CodeableConcept;
  term?: CodeableConcept;
  benefit?: Benefit[];
  authorizationRequired?: boolean;
  authorizationSupporting?: CodeableConcept[];
  authorizationUrl?: string;
}

/**
 * Benefit
 */
export interface Benefit {
  type: CodeableConcept;
  allowedUnsignedInt?: number;
  allowedString?: string;
  allowedMoney?: Money;
  usedUnsignedInt?: number;
  usedString?: string;
  usedMoney?: Money;
}

/**
 * Error Component
 */
export interface ErrorComponent {
  code: CodeableConcept;
  expression?: string[];
}

/**
 * Claim
 */
export interface Claim {
  id: string;
  status: ClaimStatus;
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: PatientReference;
  billablePeriod: Period;
  created: Date;
  enterer?: ProviderReference;
  insurer?: Payer;
  provider: ProviderReference;
  priority: CodeableConcept;
  fundsReserve?: CodeableConcept;
  related?: RelatedClaim[];
  prescription?: PrescriptionReference;
  originalPrescription?: PrescriptionReference;
  payee?: Payee;
  referral?: ReferralReference;
  facility?: FacilityReference;
  careTeam?: CareTeamMember[];
  supportingInfo?: SupportingInfo[];
  diagnosis?: ClaimDiagnosis[];
  procedure?: ClaimProcedure[];
  insurance: InsuranceInfo[];
  accident?: Accident;
  item: ClaimItem[];
  total?: Money;
}

/**
 * Related Claim
 */
export interface RelatedClaim {
  claim?: ClaimReference;
  relationship?: CodeableConcept;
  reference?: Identifier;
}

/**
 * Claim Reference
 */
export interface ClaimReference {
  id: string;
  claimNumber?: string;
}


/**
 * Prescription Reference
 */
export interface PrescriptionReference {
  id: string;
  prescriptionNumber?: string;
}

/**
 * Payee
 */
export interface Payee {
  type: CodeableConcept;
  party?: PartyReference;
}

/**
 * Party Reference
 */
export interface PartyReference {
  id: string;
  type: 'patient' | 'practitioner' | 'organization' | 'relatedperson';
  name?: string;
}

/**
 * Referral Reference
 */
export interface ReferralReference {
  id: string;
  referralNumber?: string;
}

/**
 * Care Team Member
 */
export interface CareTeamMember {
  sequence: number;
  provider: ProviderReference;
  responsible?: boolean;
  role?: CodeableConcept;
  qualification?: CodeableConcept;
}

/**
 * Supporting Info
 */
export interface SupportingInfo {
  sequence: number;
  category: CodeableConcept;
  code?: CodeableConcept;
  timingDate?: Date;
  timingPeriod?: Period;
  valueBoolean?: boolean;
  valueString?: string;
  valueQuantity?: Quantity;
  valueAttachment?: Attachment;
  valueReference?: Reference;
  reason?: CodeableConcept;
}



/**
 * Claim Diagnosis
 */
export interface ClaimDiagnosis {
  sequence: number;
  diagnosis: CodeableConcept;
  type?: CodeableConcept[];
  onAdmission?: CodeableConcept;
  packageCode?: CodeableConcept;
}

/**
 * Claim Procedure
 */
export interface ClaimProcedure {
  sequence: number;
  type?: CodeableConcept[];
  date?: Date;
  procedure: CodeableConcept;
  udi?: Reference[];
}

/**
 * Insurance Info
 */
export interface InsuranceInfo {
  sequence: number;
  focal: boolean;
  identifier?: Identifier;
  coverage: CoverageReference;
  businessArrangement?: string;
  preAuthRef?: string[];
  claimResponse?: ClaimResponseReference;
}

/**
 * Claim Response Reference
 */
export interface ClaimResponseReference {
  id: string;
  responseNumber?: string;
}

/**
 * Accident
 */
export interface Accident {
  date: Date;
  type?: CodeableConcept;
  location?: Address | Reference;
}

/**
 * Claim Item
 */
export interface ClaimItem {
  sequence: number;
  careTeamSequence?: number[];
  diagnosisSequence?: number[];
  procedureSequence?: number[];
  informationSequence?: number[];
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  servicedDate?: Date;
  servicedPeriod?: Period;
  location?: CodeableConcept | Address | Reference;
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[];
  bodySite?: CodeableConcept;
  subSite?: CodeableConcept[];
  encounter?: Reference[];
  detail?: ClaimDetail[];
}

/**
 * Claim Detail
 */
export interface ClaimDetail {
  sequence: number;
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[];
  subDetail?: ClaimSubDetail[];
}

/**
 * Claim Sub Detail
 */
export interface ClaimSubDetail {
  sequence: number;
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[];
}

/**
 * Prior Authorization Request
 */
export interface PriorAuthorizationRequest {
  id: string;
  status: AuthorizationStatus;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  patient: PatientReference;
  encounter?: EncounterReference;
  authoredOn: Date;
  requester: ProviderReference;
  performer?: ProviderReference;
  performerType?: CodeableConcept;
  insurance: InsuranceInfo[];
  supportingInfo?: SupportingInfo[];
  service: ServiceRequest[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  note?: Annotation[];
}

/**
 * Encounter Reference
 */
export interface EncounterReference {
  id: string;
  encounterNumber?: string;
}

/**
 * Service Request
 */
export interface ServiceRequest {
  code: CodeableConcept;
  quantity?: Quantity;
  occurrence?: Date | Period;
  location?: FacilityReference;
}

/**
 * Annotation
 */
export interface Annotation {
  author?: string | Reference;
  time?: Date;
  text: string;
}

/**
 * Prior Authorization Response
 */
export interface PriorAuthorizationResponse {
  id: string;
  authorizationNumber?: string;
  status: AuthorizationStatus;
  request: PriorAuthorizationRequest;
  outcome: 'approved' | 'denied' | 'partial' | 'pending';
  disposition?: string;
  created: Date;
  insurance: InsuranceInfo[];
  service: AuthorizedService[];
  error?: ErrorComponent[];
}

/**
 * Authorized Service
 */
export interface AuthorizedService {
  service: ServiceRequest;
  approved: boolean;
  quantity?: Quantity;
  period?: Period;
  limitations?: string[];
}

/**
 * X12 EDI Message
 */
export interface X12EDIMessage {
  interchangeHeader: InterchangeHeader;
  functionalGroup: FunctionalGroup;
  transactionSet: TransactionSet;
  segments: EDISegment[];
}

/**
 * Interchange Header (ISA)
 */
export interface InterchangeHeader {
  authorizationQualifier: string;
  authorizationInformation: string;
  securityQualifier: string;
  securityInformation: string;
  senderIdQualifier: string;
  senderId: string;
  receiverIdQualifier: string;
  receiverId: string;
  interchangeDate: Date;
  interchangeTime: string;
  standardsIdentifier: string;
  versionNumber: string;
  interchangeControlNumber: string;
  acknowledgmentRequested: boolean;
  testIndicator: 'P' | 'T'; // Production or Test
}

/**
 * Functional Group (GS)
 */
export interface FunctionalGroup {
  functionalIdentifierCode: string;
  applicationSenderCode: string;
  applicationReceiverCode: string;
  date: Date;
  time: string;
  groupControlNumber: string;
  responsibleAgencyCode: string;
  versionIdentifierCode: string;
}

/**
 * Transaction Set (ST)
 */
export interface TransactionSet {
  transactionSetIdentifierCode: X12TransactionType;
  transactionSetControlNumber: string;
  implementationConventionReference?: string;
}

/**
 * EDI Segment
 */
export interface EDISegment {
  segmentId: string;
  elements: string[];
  composites?: EDIComposite[];
}

/**
 * EDI Composite
 */
export interface EDIComposite {
  elements: string[];
}

/**
 * Insurance Integration Configuration
 */
export interface InsuranceIntegrationConfig extends IntegrationConfig {
  clearinghouseId?: string;
  tradingPartnerId: string;
  submitterId: string;
  testMode: boolean;
  supportedTransactions: X12TransactionType[];
  batchSubmission: boolean;
  realTimeEligibility: boolean;
  autoAcknowledgment: boolean;
  encryptionRequired: boolean;
}

/**
 * Eligibility Check Request
 */
export interface EligibilityCheckRequest {
  patient: PatientReference;
  coverage: CoverageReference;
  provider: ProviderReference;
  serviceDate?: Date;
  serviceTypes?: ServiceType[];
  benefitCategories?: BenefitCategory[];
}

/**
 * Service Type
 */
export interface ServiceType {
  code: string;
  description: string;
  category?: string;
}

/**
 * Benefit Category
 */
export enum BenefitCategory {
  MEDICAL = 'medical',
  DENTAL = 'dental',
  VISION = 'vision',
  PHARMACY = 'pharmacy',
  MENTAL_HEALTH = 'mental-health',
  SUBSTANCE_ABUSE = 'substance-abuse',
  EMERGENCY = 'emergency',
  URGENT_CARE = 'urgent-care',
  PREVENTIVE = 'preventive',
  SPECIALTY = 'specialty',
  DURABLE_MEDICAL_EQUIPMENT = 'dme'
}

/**
 * Eligibility Check Response
 */
export interface EligibilityCheckResponse extends IntegrationResult<EligibilityDetails> {
  transactionId: string;
  responseDate: Date;
}

/**
 * Eligibility Details
 */
export interface EligibilityDetails {
  eligible: boolean;
  coverage: CoverageDetail[];
  copayments: CopaymentDetail[];
  deductibles: DeductibleDetail[];
  outOfPocketMax: OutOfPocketDetail[];
  limitations: LimitationDetail[];
  preExistingConditions: PreExistingCondition[];
}

/**
 * Coverage Detail
 */
export interface CoverageDetail {
  serviceType: ServiceType;
  covered: boolean;
  benefitAmount?: Money;
  benefitPercent?: number;
  network: 'in-network' | 'out-of-network' | 'both';
  authorizationRequired: boolean;
  referralRequired: boolean;
}

/**
 * Copayment Detail
 */
export interface CopaymentDetail {
  serviceType: ServiceType;
  amount: Money;
  network: 'in-network' | 'out-of-network';
}

/**
 * Deductible Detail
 */
export interface DeductibleDetail {
  type: 'individual' | 'family';
  network: 'in-network' | 'out-of-network' | 'combined';
  amount: Money;
  met: Money;
  remaining: Money;
  period: Period;
}

/**
 * Out of Pocket Detail
 */
export interface OutOfPocketDetail {
  type: 'individual' | 'family';
  network: 'in-network' | 'out-of-network' | 'combined';
  limit: Money;
  met: Money;
  remaining: Money;
  period: Period;
}

/**
 * Limitation Detail
 */
export interface LimitationDetail {
  serviceType: ServiceType;
  limitType: 'visits' | 'dollars' | 'units';
  limit: number;
  used: number;
  remaining: number;
  period: Period;
}

/**
 * Pre-existing Condition
 */
export interface PreExistingCondition {
  condition: CodeableConcept;
  waitingPeriod?: Period;
  excluded: boolean;
}

/**
 * Claim Submission Request
 */
export interface ClaimSubmissionRequest {
  claim: Claim;
  attachments?: Attachment[];
  priority: 'normal' | 'stat';
  resubmission: boolean;
  originalClaimId?: string;
  correctedFields?: string[];
}

/**
 * Claim Submission Response
 */
export interface ClaimSubmissionResponse extends IntegrationResult<ClaimSubmissionResult> {
  transactionId: string;
  submissionDate: Date;
}

/**
 * Claim Submission Result
 */
export interface ClaimSubmissionResult {
  claimId: string;
  controlNumber: string;
  status: 'accepted' | 'rejected' | 'pending';
  errors?: ClaimError[];
  warnings?: ClaimWarning[];
}

/**
 * Claim Error
 */
export interface ClaimError {
  code: string;
  severity: 'error' | 'fatal';
  description: string;
  segment?: string;
  element?: string;
  value?: string;
}

/**
 * Claim Warning
 */
export interface ClaimWarning {
  code: string;
  description: string;
  segment?: string;
  element?: string;
}

/**
 * Remittance Advice
 */
export interface RemittanceAdvice {
  id: string;
  checkNumber?: string;
  checkDate: Date;
  paymentAmount: Money;
  paymentMethod: 'check' | 'eft' | 'virtual-card';
  payer: Payer;
  payee: ProviderReference;
  claims: RemittanceClaim[];
  adjustments?: PaymentAdjustment[];
}

/**
 * Remittance Claim
 */
export interface RemittanceClaim {
  claimId: string;
  patientControlNumber?: string;
  status: 'paid' | 'denied' | 'partial' | 'suspended';
  chargedAmount: Money;
  paidAmount: Money;
  patientResponsibility?: Money;
  contractualAdjustment?: Money;
  services: RemittanceService[];
  claimAdjustments?: ClaimAdjustment[];
}

/**
 * Remittance Service
 */
export interface RemittanceService {
  serviceDate: Date;
  procedureCode: string;
  modifiers?: string[];
  chargedAmount: Money;
  paidAmount: Money;
  adjustments?: ServiceAdjustment[];
  remarkCodes?: string[];
}

/**
 * Service Adjustment
 */
export interface ServiceAdjustment {
  groupCode: string;
  reasonCode: string;
  amount: Money;
  quantity?: number;
}

/**
 * Claim Adjustment
 */
export interface ClaimAdjustment {
  groupCode: string;
  reasonCode: string;
  amount: Money;
}

/**
 * Payment Adjustment
 */
export interface PaymentAdjustment {
  type: string;
  amount: Money;
  description?: string;
}

/**
 * Insurance Compliance Status
 */
export interface InsuranceComplianceStatus extends ComplianceStatus {
  hipaaCompliant: boolean;
  x12Certified: boolean;
  caqhCoreCompliant: boolean;
  stateRegulations: StateComplianceStatus[];
}

/**
 * State Compliance Status
 */
export interface StateComplianceStatus {
  state: string;
  compliant: boolean;
  requirements: string[];
  lastReview: Date;
}

/**
 * Insurance Service Interface
 */
export interface InsuranceService {
  // Eligibility Verification
  checkEligibility(request: EligibilityCheckRequest): Promise<IntegrationResult<EligibilityCheckResponse>>;
  batchEligibilityCheck(requests: EligibilityCheckRequest[]): Promise<IntegrationResult<EligibilityCheckResponse[]>>;
  
  // Claim Management
  submitClaim(request: ClaimSubmissionRequest): Promise<IntegrationResult<ClaimSubmissionResponse>>;
  getClaimStatus(claimId: string): Promise<IntegrationResult<Claim>>;
  voidClaim(claimId: string, reason: string): Promise<IntegrationResult<void>>;
  
  // Prior Authorization
  requestAuthorization(request: PriorAuthorizationRequest): Promise<IntegrationResult<PriorAuthorizationResponse>>;
  checkAuthorizationStatus(authId: string): Promise<IntegrationResult<PriorAuthorizationResponse>>;
  
  // Remittance Processing
  processRemittance(ediMessage: X12EDIMessage): Promise<IntegrationResult<RemittanceAdvice>>;
  getRemittanceAdvice(remittanceId: string): Promise<IntegrationResult<RemittanceAdvice>>;
  
  // EDI Operations
  parseEDIMessage(rawMessage: string): Promise<IntegrationResult<X12EDIMessage>>;
  generateEDIMessage(transactionType: X12TransactionType, data: any): Promise<IntegrationResult<string>>;
  
  // Coverage Management
  verifyCoverage(coverageId: string): Promise<IntegrationResult<Coverage>>;
  updateCoverage(coverageId: string, updates: Partial<Coverage>): Promise<IntegrationResult<Coverage>>;
  
  // Compliance
  getComplianceStatus(): Promise<InsuranceComplianceStatus>;
}

// Export all types
export type {
  IntegrationResult,
  IntegrationMessage,
  InsuranceService as IInsuranceService
};