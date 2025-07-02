/**
 * Insurance Integration Types
 * Type definitions for insurance verification, claims processing, and EDI transactions
 */

import { 
  Period, 
  CodeableConcept, 
  Coding, 
  Quantity, 
  Identifier, 
  Attachment, 
  Reference 
} from '../../../models/base.model';

import { IntegrationResult, IntegrationMessage, IntegrationConfig, ComplianceStatus } from './integration.types';

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
 * X12 Version
 */
export enum X12Version {
  VERSION_4010 = '004010',
  VERSION_5010 = '005010',
  VERSION_5010_X12 = '005010X12',
  VERSION_5010_X217 = '005010X217',
  VERSION_5010_X218 = '005010X218',
  VERSION_5010_X220 = '005010X220',
  VERSION_5010_X221 = '005010X221',
  VERSION_5010_X222 = '005010X222',
  VERSION_5010_X223 = '005010X223',
  VERSION_5010_X224 = '005010X224',
  VERSION_5010_X279 = '005010X279',
  VERSION_6020 = '006020',
  VERSION_7030 = '007030'
}

/**
 * Insurance Request Type
 */
export enum InsuranceRequestType {
  ELIGIBILITY = 'eligibility',
  BENEFITS = 'benefits',
  CLAIM = 'claim',
  PRIOR_AUTH = 'prior-authorization',
  CLAIM_STATUS = 'claim-status',
  REFERRAL = 'referral',
  ENROLLMENT = 'enrollment',
  PREMIUM_PAYMENT = 'premium-payment',
  COORDINATION_OF_BENEFITS = 'coordination-of-benefits'
}

/**
 * Claim Type
 */
export enum ClaimType {
  PROFESSIONAL = 'professional',
  INSTITUTIONAL = 'institutional',
  DENTAL = 'dental',
  PHARMACY = 'pharmacy',
  VISION = 'vision',
  DME = 'dme',
  HOME_HEALTH = 'home-health',
  HOSPICE = 'hospice',
  AMBULANCE = 'ambulance',
  OUTPATIENT = 'outpatient',
  INPATIENT = 'inpatient'
}

/**
 * Payer Type
 */
export enum PayerType {
  COMMERCIAL = 'commercial',
  MEDICARE = 'medicare',
  MEDICAID = 'medicaid',
  TRICARE = 'tricare',
  CHAMPVA = 'champva',
  WORKERS_COMP = 'workers-compensation',
  AUTO_INSURANCE = 'auto-insurance',
  SELF_PAY = 'self-pay',
  OTHER_GOVERNMENT = 'other-government',
  CHARITY = 'charity',
  LIABILITY = 'liability'
}

/**
 * Network Status
 */
export enum NetworkStatus {
  IN_NETWORK = 'in-network',
  OUT_OF_NETWORK = 'out-of-network',
  TIER_1 = 'tier-1',
  TIER_2 = 'tier-2',
  TIER_3 = 'tier-3',
  NOT_APPLICABLE = 'not-applicable',
  UNKNOWN = 'unknown'
}

/**
 * Place of Service
 */
export enum PlaceOfService {
  OFFICE = '11',
  HOME = '12',
  ASSISTED_LIVING = '13',
  GROUP_HOME = '14',
  MOBILE_UNIT = '15',
  TEMPORARY_LODGING = '16',
  WALK_IN_RETAIL = '17',
  PLACE_OF_EMPLOYMENT = '18',
  OFF_CAMPUS_OUTPATIENT = '19',
  URGENT_CARE = '20',
  INPATIENT_HOSPITAL = '21',
  OUTPATIENT_HOSPITAL = '22',
  EMERGENCY_ROOM_HOSPITAL = '23',
  AMBULATORY_SURGICAL_CENTER = '24',
  BIRTHING_CENTER = '25',
  MILITARY_TREATMENT_FACILITY = '26',
  SKILLED_NURSING_FACILITY = '31',
  NURSING_FACILITY = '32',
  CUSTODIAL_CARE_FACILITY = '33',
  HOSPICE = '34',
  AMBULANCE_LAND = '41',
  AMBULANCE_AIR_WATER = '42',
  INDEPENDENT_CLINIC = '49',
  FEDERALLY_QUALIFIED_HEALTH_CENTER = '50',
  INPATIENT_PSYCHIATRIC_FACILITY = '51',
  PSYCHIATRIC_FACILITY_PARTIAL_HOSPITALIZATION = '52',
  COMMUNITY_MENTAL_HEALTH_CENTER = '53',
  INTERMEDIATE_CARE_FACILITY = '54',
  RESIDENTIAL_SUBSTANCE_ABUSE_TREATMENT = '55',
  PSYCHIATRIC_RESIDENTIAL_TREATMENT_CENTER = '56',
  NON_RESIDENTIAL_SUBSTANCE_ABUSE_TREATMENT = '57',
  MASS_IMMUNIZATION_CENTER = '60',
  COMPREHENSIVE_INPATIENT_REHABILITATION = '61',
  COMPREHENSIVE_OUTPATIENT_REHABILITATION = '62',
  END_STAGE_RENAL_DISEASE_TREATMENT = '65',
  STATE_OR_LOCAL_PUBLIC_HEALTH_CLINIC = '71',
  RURAL_HEALTH_CLINIC = '72',
  INDEPENDENT_LABORATORY = '81',
  OTHER = '99'
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
 * X12 Segment (Alias for EDI Segment)
 */
export interface X12Segment extends EDISegment {
  segmentName?: string;
  segmentPosition?: number;
  segmentUsage?: 'mandatory' | 'optional' | 'conditional';
  maxUse?: number;
  loopId?: string;
}

/**
 * X12 Loop
 */
export interface X12Loop {
  loopId: string;
  loopName?: string;
  loopRepeat?: number;
  segments: X12Segment[];
  childLoops?: X12Loop[];
  parentLoopId?: string;
  usage?: 'mandatory' | 'optional' | 'conditional';
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
 * Billing Provider
 */
export interface BillingProvider {
  providerId: string;
  npi: string;
  taxId: string;
  name: string;
  type: 'individual' | 'organization';
  taxonomy?: string;
  address: Address;
  phone: string;
  contactPerson?: string;
}

/**
 * Rendering Provider
 */
export interface RenderingProvider extends ProviderReference {
  taxonomy?: string;
  signature?: string;
  signatureDate?: Date;
  credentials?: string[];
}

/**
 * Insurance Card Information
 */
export interface InsuranceCard {
  memberId: string;
  groupNumber?: string;
  planName: string;
  effectiveDate: Date;
  expirationDate?: Date;
  copays?: CardCopayInfo[];
  deductible?: Money;
  outOfPocketMax?: Money;
  cardIssueDate?: Date;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
}

/**
 * Card Copay Information
 */
export interface CardCopayInfo {
  serviceType: string;
  amount: Money;
  afterDeductible?: boolean;
}

/**
 * Coordination of Benefits
 */
export interface CoordinationOfBenefits {
  sequence: number;
  payerType: 'primary' | 'secondary' | 'tertiary';
  payer: Payer;
  coverageId: string;
  coveragePeriod: Period;
  relationshipToSubscriber: RelationshipCode;
}

/**
 * Authorization Request Status
 */
export enum AuthorizationRequestStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  UNDER_REVIEW = 'under-review',
  APPROVED = 'approved',
  PARTIAL_APPROVED = 'partial-approved',
  DENIED = 'denied',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

/**
 * Benefit Period Type
 */
export enum BenefitPeriodType {
  CALENDAR_YEAR = 'calendar-year',
  PLAN_YEAR = 'plan-year',
  LIFETIME = 'lifetime',
  EPISODE = 'episode',
  ADMISSION = 'admission',
  VISIT = 'visit'
}

/**
 * Claim Attachment
 */
export interface ClaimAttachment {
  attachmentId: string;
  type: AttachmentType;
  format: 'pdf' | 'image' | 'text' | 'x12' | 'hl7' | 'other';
  description?: string;
  data?: string; // Base64 encoded
  url?: string;
  size?: number;
  pageCount?: number;
  submittedDate: Date;
}

/**
 * Attachment Type
 */
export enum AttachmentType {
  REFERRAL = 'referral',
  LAB_RESULTS = 'lab-results',
  OPERATIVE_REPORT = 'operative-report',
  DISCHARGE_SUMMARY = 'discharge-summary',
  CONSULTATION = 'consultation',
  DIAGNOSTIC_REPORT = 'diagnostic-report',
  AMBULANCE_RUN_SHEET = 'ambulance-run-sheet',
  PROOF_OF_DELIVERY = 'proof-of-delivery',
  MEDICAL_RECORDS = 'medical-records',
  OTHER = 'other'
}

/**
 * Revenue Code
 */
export interface RevenueCode {
  code: string;
  description: string;
  category?: string;
}

/**
 * DRG (Diagnosis Related Group)
 */
export interface DRG {
  code: string;
  description: string;
  weight?: number;
  mdcCode?: string; // Major Diagnostic Category
  type?: 'MS-DRG' | 'AP-DRG' | 'APR-DRG';
}

/**
 * Modifier Code
 */
export interface ModifierCode {
  code: string;
  description: string;
  type?: 'pricing' | 'payment' | 'informational';
}

/**
 * Insurance Verification Result
 */
export interface InsuranceVerificationResult {
  verificationId: string;
  verificationDate: Date;
  coverage: Coverage;
  eligibilityDetails: EligibilityDetails;
  benefitSummary: BenefitSummary;
  authRequirements?: AuthorizationRequirement[];
  verified: boolean;
  verificationMethod: 'realtime' | 'batch' | 'phone' | 'portal';
  nextVerificationDate?: Date;
}

/**
 * Benefit Summary
 */
export interface BenefitSummary {
  planName: string;
  planType: PlanType;
  coverageLevel: 'individual' | 'family';
  inNetworkBenefits: NetworkBenefits;
  outOfNetworkBenefits?: NetworkBenefits;
  exclusions?: string[];
  limitations?: string[];
}

/**
 * Network Benefits
 */
export interface NetworkBenefits {
  deductible: DeductibleInfo;
  outOfPocketMax: OutOfPocketInfo;
  coinsurance?: number;
  copays: ServiceCopay[];
}

/**
 * Deductible Information
 */
export interface DeductibleInfo {
  individual: Money;
  family?: Money;
  met: Money;
  remaining: Money;
}

/**
 * Out of Pocket Information
 */
export interface OutOfPocketInfo {
  individual: Money;
  family?: Money;
  met: Money;
  remaining: Money;
}

/**
 * Service Copay
 */
export interface ServiceCopay {
  serviceType: string;
  copayAmount: Money;
  afterDeductible: boolean;
}

/**
 * Authorization Requirement
 */
export interface AuthorizationRequirement {
  serviceType: string;
  requiresAuth: boolean;
  authType: 'prior' | 'concurrent' | 'retrospective';
  validityPeriod?: number; // days
  documentationRequired?: string[];
}

/**
 * Payment Posting
 */
export interface PaymentPosting {
  postingId: string;
  postingDate: Date;
  paymentMethod: 'check' | 'eft' | 'credit-card' | 'cash' | 'other';
  paymentAmount: Money;
  appliedAmount: Money;
  unappliedAmount: Money;
  postedBy: string;
  claims: PaymentClaimDetail[];
  batchNumber?: string;
  depositDate?: Date;
}

/**
 * Payment Claim Detail
 */
export interface PaymentClaimDetail {
  claimId: string;
  patientName: string;
  serviceDate: Date;
  billedAmount: Money;
  allowedAmount: Money;
  paidAmount: Money;
  adjustmentAmount: Money;
  patientResponsibility: Money;
  adjustmentCodes: AdjustmentCode[];
}

/**
 * Adjustment Code
 */
export interface AdjustmentCode {
  groupCode: string;
  reasonCode: string;
  amount: Money;
  description?: string;
}

/**
 * ERA (Electronic Remittance Advice) Processing Result
 */
export interface ERAProcessingResult {
  processingId: string;
  processingDate: Date;
  fileName: string;
  totalClaims: number;
  successfulClaims: number;
  failedClaims: number;
  totalPaymentAmount: Money;
  errors?: ERAProcessingError[];
  remittanceAdvices: RemittanceAdvice[];
}

/**
 * ERA Processing Error
 */
export interface ERAProcessingError {
  claimNumber?: string;
  errorCode: string;
  errorDescription: string;
  segment?: string;
  element?: string;
}

/**
 * Timely Filing Limit
 */
export interface TimelyFilingLimit {
  payer: Payer;
  limitDays: number;
  limitType: 'from-service-date' | 'from-discharge-date' | 'from-statement-date';
  exceptions?: string[];
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