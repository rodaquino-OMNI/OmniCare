import { 
  FHIRResource, 
  Reference, 
  CodeableConcept, 
  Money, 
  Period,
  Identifier
} from './base.model';

/**
 * Billing and Claims Management Models for OmniCare EMR
 * Includes Claims, Invoices, Payments, and Insurance Coverage
 */

/**
 * Claim Resource (FHIR R4 compliant)
 */
export interface OmniCareClaim extends FHIRResource {
  resourceType: 'Claim';
  
  // Core FHIR Claim fields
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: Reference; // Patient
  billablePeriod?: Period;
  created: string;
  enterer?: Reference; // Practitioner
  insurer?: Reference; // Organization
  provider: Reference; // Practitioner or Organization
  priority: CodeableConcept;
  fundsReserve?: CodeableConcept;
  related?: ClaimRelated[];
  prescription?: Reference; // MedicationRequest
  originalPrescription?: Reference; // MedicationRequest
  payee?: ClaimPayee;
  referral?: Reference; // ServiceRequest
  facility?: Reference; // Location
  careTeam?: ClaimCareTeam[];
  supportingInfo?: ClaimSupportingInfo[];
  diagnosis?: ClaimDiagnosis[];
  procedure?: ClaimProcedure[];
  insurance: ClaimInsurance[];
  accident?: ClaimAccident;
  item?: ClaimItem[];
  total?: Money;

  // OmniCare-specific extensions
  omnicareClaimId?: string;
  submissionMethod?: 'electronic' | 'paper' | 'phone';
  submissionDate?: string;
  expectedPaymentDate?: string;
  denialReasons?: string[];
  resubmissionCount?: number;
  clearinghouseInfo?: {
    name: string;
    id: string;
    submissionId: string;
  };
  claimStatus?: ClaimStatus;
  paymentInfo?: PaymentInformation;
  auditTrail?: AuditEntry[];
}

export interface ClaimRelated {
  claim?: Reference; // Claim
  relationship?: CodeableConcept;
  reference?: Identifier;
}

export interface ClaimPayee {
  type: CodeableConcept;
  party?: Reference; // Practitioner, PractitionerRole, Organization, Patient, RelatedPerson
}

export interface ClaimCareTeam {
  sequence: number;
  provider: Reference; // Practitioner or Organization
  responsible?: boolean;
  role?: CodeableConcept;
  qualification?: CodeableConcept;
}

export interface ClaimSupportingInfo {
  sequence: number;
  category: CodeableConcept;
  code?: CodeableConcept;
  timingDate?: string;
  timingPeriod?: Period;
  valueBoolean?: boolean;
  valueString?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  valueAttachment?: {
    contentType?: string;
    data?: string;
    url?: string;
    title?: string;
  };
  valueReference?: Reference;
  reason?: CodeableConcept;
}

export interface ClaimDiagnosis {
  sequence: number;
  diagnosisCodeableConcept?: CodeableConcept;
  diagnosisReference?: Reference; // Condition
  type?: CodeableConcept[];
  onAdmission?: CodeableConcept;
  packageCode?: CodeableConcept;
}

export interface ClaimProcedure {
  sequence: number;
  type?: CodeableConcept[];
  date?: string;
  procedureCodeableConcept?: CodeableConcept;
  procedureReference?: Reference; // Procedure
  udi?: Reference[]; // Device
}

export interface ClaimInsurance {
  sequence: number;
  focal: boolean;
  identifier?: Identifier;
  coverage: Reference; // Coverage
  businessArrangement?: string;
  preAuthRef?: string[];
  claimResponse?: Reference; // ClaimResponse
}

export interface ClaimAccident {
  date: string;
  type?: CodeableConcept;
  locationAddress?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  locationReference?: Reference; // Location
}

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
  servicedDate?: string;
  servicedPeriod?: Period;
  locationCodeableConcept?: CodeableConcept;
  locationAddress?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  locationReference?: Reference; // Location
  quantity?: {
    value?: number;
    unit?: string;
  };
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[]; // Device
  bodySite?: CodeableConcept;
  subSite?: CodeableConcept[];
  encounter?: Reference[]; // Encounter
  detail?: ClaimItemDetail[];
}

export interface ClaimItemDetail {
  sequence: number;
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  quantity?: {
    value?: number;
    unit?: string;
  };
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[]; // Device
  subDetail?: ClaimItemSubDetail[];
}

export interface ClaimItemSubDetail {
  sequence: number;
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  quantity?: {
    value?: number;
    unit?: string;
  };
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[]; // Device
}

/**
 * ClaimResponse Resource
 */
export interface OmniCareClaimResponse extends FHIRResource {
  resourceType: 'ClaimResponse';
  
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: Reference; // Patient
  created: string;
  insurer: Reference; // Organization
  requestor?: Reference; // Practitioner or Organization
  request?: Reference; // Claim
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  preAuthRef?: string;
  preAuthPeriod?: Period;
  payeeType?: CodeableConcept;
  item?: ClaimResponseItem[];
  addItem?: ClaimResponseAddItem[];
  adjudication?: ClaimResponseAdjudication[];
  total?: ClaimResponseTotal[];
  payment?: ClaimResponsePayment;
  fundsReserve?: CodeableConcept;
  formCode?: CodeableConcept;
  form?: {
    contentType?: string;
    data?: string;
    url?: string;
    title?: string;
  };
  processNote?: ClaimResponseProcessNote[];
  communicationRequest?: Reference[]; // CommunicationRequest
  insurance?: ClaimResponseInsurance[];
  error?: ClaimResponseError[];

  // OmniCare-specific extensions
  omnicareClaimResponseId?: string;
  processingDate?: string;
  paymentDate?: string;
  remittanceAdvice?: RemittanceAdvice;
  auditInfo?: AuditEntry[];
}

export interface ClaimResponseItem {
  itemSequence: number;
  noteNumber?: number[];
  adjudication: ClaimResponseAdjudication[];
  detail?: ClaimResponseItemDetail[];
}

export interface ClaimResponseItemDetail {
  detailSequence: number;
  noteNumber?: number[];
  adjudication: ClaimResponseAdjudication[];
  subDetail?: ClaimResponseItemSubDetail[];
}

export interface ClaimResponseItemSubDetail {
  subDetailSequence: number;
  noteNumber?: number[];
  adjudication?: ClaimResponseAdjudication[];
}

export interface ClaimResponseAddItem {
  itemSequence?: number[];
  detailSequence?: number[];
  subdetailSequence?: number[];
  provider?: Reference[]; // Practitioner or Organization
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  servicedDate?: string;
  servicedPeriod?: Period;
  locationCodeableConcept?: CodeableConcept;
  locationAddress?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  };
  locationReference?: Reference; // Location
  quantity?: {
    value?: number;
    unit?: string;
  };
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  bodySite?: CodeableConcept;
  subSite?: CodeableConcept[];
  noteNumber?: number[];
  adjudication?: ClaimResponseAdjudication[];
  detail?: ClaimResponseAddItemDetail[];
}

export interface ClaimResponseAddItemDetail {
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  quantity?: {
    value?: number;
    unit?: string;
  };
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  noteNumber?: number[];
  adjudication?: ClaimResponseAdjudication[];
  subDetail?: ClaimResponseAddItemSubDetail[];
}

export interface ClaimResponseAddItemSubDetail {
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  quantity?: {
    value?: number;
    unit?: string;
  };
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  noteNumber?: number[];
  adjudication?: ClaimResponseAdjudication[];
}

export interface ClaimResponseAdjudication {
  category: CodeableConcept;
  reason?: CodeableConcept;
  amount?: Money;
  value?: number;
}

export interface ClaimResponseTotal {
  category: CodeableConcept;
  amount: Money;
}

export interface ClaimResponsePayment {
  type?: CodeableConcept;
  adjustment?: Money;
  adjustmentReason?: CodeableConcept;
  date?: string;
  amount?: Money;
  identifier?: Identifier;
}

export interface ClaimResponseProcessNote {
  number?: number;
  type?: 'display' | 'print' | 'printoper';
  text: string;
  language?: CodeableConcept;
}

export interface ClaimResponseInsurance {
  sequence: number;
  focal: boolean;
  coverage: Reference; // Coverage
  businessArrangement?: string;
  claimResponse?: Reference; // ClaimResponse
}

export interface ClaimResponseError {
  itemSequence?: number;
  detailSequence?: number;
  subDetailSequence?: number;
  code: CodeableConcept;
}

/**
 * Coverage Resource (Insurance Coverage)
 */
export interface OmniCareCoverage extends FHIRResource {
  resourceType: 'Coverage';
  
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: CodeableConcept;
  policyHolder?: Reference; // Patient, RelatedPerson, Organization
  subscriber?: Reference; // Patient, RelatedPerson
  subscriberId?: string;
  beneficiary: Reference; // Patient
  dependent?: string;
  relationship?: CodeableConcept;
  period?: Period;
  payor: Reference[]; // Organization, Patient, RelatedPerson
  class?: CoverageClass[];
  order?: number;
  network?: string;
  costToBeneficiary?: CoverageCostToBeneficiary[];
  subrogation?: boolean;
  contract?: Reference[]; // Contract

  // OmniCare-specific extensions
  omnicareCoverageId?: string;
  groupNumber?: string;
  planName?: string;
  effectiveDate?: string;
  terminationDate?: string;
  copayInformation?: CopayInformation;
  deductibleInformation?: DeductibleInformation;
  benefitInformation?: BenefitInformation;
  eligibilityInfo?: EligibilityInformation;
}

export interface CoverageClass {
  type: CodeableConcept;
  value: string;
  name?: string;
}

export interface CoverageCostToBeneficiary {
  type?: CodeableConcept;
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  valueMoney?: Money;
  exception?: CoverageException[];
}

export interface CoverageException {
  type: CodeableConcept;
  period?: Period;
}

export interface CopayInformation {
  primaryCare?: Money;
  specialistCare?: Money;
  emergencyRoom?: Money;
  urgentCare?: Money;
  prescription?: {
    generic?: Money;
    brandName?: Money;
    specialty?: Money;
  };
  mentalHealth?: Money;
  preventiveCare?: Money;
}

export interface DeductibleInformation {
  individual?: Money;
  family?: Money;
  remainingIndividual?: Money;
  remainingFamily?: Money;
  resetDate?: string;
}

export interface BenefitInformation {
  annualMaximum?: Money;
  lifetimeMaximum?: Money;
  remainingAnnual?: Money;
  remainingLifetime?: Money;
  outOfPocketMaximum?: Money;
  remainingOutOfPocket?: Money;
}

export interface EligibilityInformation {
  verified: boolean;
  verificationDate?: string;
  eligibleServices?: string[];
  excludedServices?: string[];
  priorAuthorizationRequired?: string[];
  referralRequired?: boolean;
}

/**
 * Invoice Resource
 */
export interface OmniCareInvoice extends FHIRResource {
  resourceType: 'Invoice';
  
  identifier?: Identifier[];
  status: 'draft' | 'issued' | 'balanced' | 'cancelled' | 'entered-in-error';
  cancelledReason?: string;
  type?: CodeableConcept;
  subject?: Reference; // Patient, Group
  recipient?: Reference; // Organization, Patient, RelatedPerson
  date?: string;
  participant?: InvoiceParticipant[];
  issuer?: Reference; // Organization
  account?: Reference; // Account
  lineItem?: InvoiceLineItem[];
  totalPriceComponent?: InvoicePriceComponent[];
  totalNet?: Money;
  totalGross?: Money;
  paymentTerms?: string;
  note?: {
    text: string;
    time?: string;
  }[];

  // OmniCare-specific extensions
  omnicareInvoiceId?: string;
  billableEncounters?: Reference[]; // Encounter
  insuranceClaims?: Reference[]; // Claim
  paymentStatus?: PaymentStatus;
  paymentHistory?: PaymentTransaction[];
  statementDate?: string;
  dueDate?: string;
  lateFees?: Money;
  discounts?: InvoiceDiscount[];
}

export interface InvoiceParticipant {
  role?: CodeableConcept;
  actor: Reference; // Practitioner, Organization, Patient, PractitionerRole, Device, RelatedPerson
}

export interface InvoiceLineItem {
  sequence?: number;
  chargeItemReference?: Reference; // ChargeItem
  chargeItemCodeableConcept?: CodeableConcept;
  priceComponent?: InvoicePriceComponent[];
}

export interface InvoicePriceComponent {
  type: 'base' | 'surcharge' | 'deduction' | 'discount' | 'tax' | 'informational';
  code?: CodeableConcept;
  factor?: number;
  amount?: Money;
}

export interface InvoiceDiscount {
  type: 'percentage' | 'fixed-amount' | 'senior' | 'student' | 'military' | 'hardship';
  reason: string;
  amount?: Money;
  percentage?: number;
  appliedBy: Reference; // Practitioner
  appliedDate: string;
}

/**
 * Payment and Financial Models
 */
export interface PaymentInformation {
  paymentId?: string;
  paymentMethod: 'insurance' | 'cash' | 'check' | 'credit-card' | 'debit-card' | 'electronic-transfer' | 'money-order';
  paymentAmount: Money;
  paidDate?: string;
  transactionId?: string;
  checkNumber?: string;
  cardLastFour?: string;
  authorizationCode?: string;
  paymentStatus: PaymentStatus;
}

export interface PaymentStatus {
  status: 'pending' | 'processing' | 'paid' | 'partial' | 'denied' | 'refunded' | 'disputed';
  statusDate: string;
  remainingBalance?: Money;
  notes?: string;
}

export interface PaymentTransaction {
  transactionId: string;
  type: 'payment' | 'refund' | 'adjustment' | 'writeoff';
  amount: Money;
  method: string;
  date: string;
  processedBy: Reference; // Practitioner
  notes?: string;
}

export interface ClaimStatus {
  status: 'submitted' | 'pending' | 'under-review' | 'approved' | 'denied' | 'partial-payment' | 'paid';
  statusDate: string;
  statusReason?: string;
  nextAction?: string;
  expectedResolutionDate?: string;
}

export interface RemittanceAdvice {
  remittanceId: string;
  checkNumber?: string;
  checkDate?: string;
  totalPaid: Money;
  claimAdjustments?: ClaimAdjustment[];
  providerAdjustments?: ProviderAdjustment[];
}

export interface ClaimAdjustment {
  claimId: string;
  originalAmount: Money;
  allowedAmount: Money;
  paidAmount: Money;
  patientResponsibility: Money;
  adjustmentCodes?: AdjustmentCode[];
}

export interface ProviderAdjustment {
  type: 'penalty' | 'bonus' | 'interest' | 'other';
  amount: Money;
  reason: string;
}

export interface AdjustmentCode {
  code: string;
  description: string;
  amount?: Money;
}

export interface AuditEntry {
  action: string;
  performedBy: Reference; // Practitioner
  timestamp: string;
  description?: string;
  changes?: Record<string, any>;
}

/**
 * Search Parameters
 */
export interface BillingSearchParams {
  _id?: string;
  patient?: string;
  status?: string;
  type?: string;
  created?: string;
  'payment-date'?: string;
  provider?: string;
  insurer?: string;
  
  // OmniCare-specific
  'omnicare-id'?: string;
  'claim-status'?: string;
  'payment-status'?: string;
  'billing-period'?: string;
  
  // Common modifiers
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
}

/**
 * Billing Statistics
 */
export interface BillingStatistics {
  totalClaims: number;
  pendingClaims: number;
  paidClaims: number;
  deniedClaims: number;
  totalBilled: Money;
  totalCollected: Money;
  totalWriteOffs: Money;
  averagePaymentTime: number; // days
  collectionRate: number; // percentage
  denialRate: number; // percentage
  topDenialReasons: Array<{
    reason: string;
    count: number;
  }>;
  paymentMethodBreakdown: Record<string, number>;
  insurancePerformance: Array<{
    insurer: string;
    claimsCount: number;
    averagePaymentTime: number;
    denialRate: number;
  }>;
}