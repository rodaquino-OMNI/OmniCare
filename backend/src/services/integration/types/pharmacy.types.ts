/**
 * Pharmacy Integration Types
 * Type definitions for pharmacy system integrations, prescriptions, and medication management
 */

import { IntegrationResult, IntegrationMessage, IntegrationConfig, ComplianceStatus } from './integration.types';

/**
 * NCPDP Standard Version Support
 */
export enum NCPDPVersion {
  SCRIPT_10_6 = '10.6',
  SCRIPT_10_10 = '10.10',
  SCRIPT_2017071 = '2017071',
  FORMULARY_3_0 = '3.0',
  RTPB_1_0 = '1.0'
}

/**
 * Prescription Status Codes
 */
export enum PrescriptionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  STOPPED = 'stopped',
  DRAFT = 'draft',
  ON_HOLD = 'on-hold',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown'
}

/**
 * Medication Dispense Status
 */
export enum DispenseStatus {
  PREPARATION = 'preparation',
  IN_PROGRESS = 'in-progress',
  ON_HOLD = 'on-hold',
  COMPLETED = 'completed',
  STOPPED = 'stopped',
  CANCELLED = 'cancelled',
  DECLINED = 'declined',
  UNKNOWN = 'unknown'
}

/**
 * Prescription Fill Status
 */
export enum FillStatus {
  FILLED = 'filled',
  PARTIAL_FILL = 'partial-fill',
  NOT_FILLED = 'not-filled',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

/**
 * Drug Schedule Classification
 */
export enum DrugSchedule {
  SCHEDULE_I = 'CI',
  SCHEDULE_II = 'CII',
  SCHEDULE_III = 'CIII',
  SCHEDULE_IV = 'CIV',
  SCHEDULE_V = 'CV',
  NOT_SCHEDULED = 'NS'
}

/**
 * Prescription Type
 */
export enum PrescriptionType {
  NEW = 'new',
  REFILL = 'refill',
  TRANSFER = 'transfer',
  RENEWAL = 'renewal',
  CHANGE = 'change',
  CANCEL = 'cancel',
  CONTINUATION = 'continuation',
  EMERGENCY = 'emergency',
  COMPOUNDED = 'compounded',
  CONTROLLED = 'controlled'
}

/**
 * Refill Status
 */
export enum RefillStatus {
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not-available',
  TOO_SOON = 'too-soon',
  PRIOR_AUTH_REQUIRED = 'prior-auth-required',
  EXPIRED = 'expired',
  TRANSFERRED = 'transferred',
  ON_HOLD = 'on-hold',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  DENIED = 'denied'
}

/**
 * Drug Database Type
 */
export enum DrugDatabaseType {
  RXNORM = 'rxnorm',
  NDC = 'ndc',
  SNOMED = 'snomed',
  GPI = 'gpi',
  MEDI_SPAN = 'medi-span',
  FIRST_DATABANK = 'first-databank',
  GOLD_STANDARD = 'gold-standard',
  CUSTOM = 'custom'
}

/**
 * Formulary Status
 */
export enum FormularyStatus {
  ON_FORMULARY = 'on-formulary',
  OFF_FORMULARY = 'off-formulary',
  RESTRICTED = 'restricted',
  PREFERRED = 'preferred',
  NON_PREFERRED = 'non-preferred',
  SPECIALTY = 'specialty',
  NOT_COVERED = 'not-covered',
  PRIOR_AUTH_REQUIRED = 'prior-auth-required',
  STEP_THERAPY_REQUIRED = 'step-therapy-required'
}

/**
 * Pharmacy System Type
 */
export enum PharmacySystem {
  RETAIL = 'retail',
  MAIL_ORDER = 'mail-order',
  SPECIALTY = 'specialty',
  COMPOUNDING = 'compounding',
  LONG_TERM_CARE = 'long-term-care',
  HOSPITAL = 'hospital',
  CLINIC = 'clinic',
  INSTITUTIONAL = 'institutional',
  NUCLEAR = 'nuclear',
  GOVERNMENT = 'government'
}

/**
 * Core Pharmacy Information
 */
export interface Pharmacy {
  id: string;
  ncpdpId: string;
  npiNumber: string;
  name: string;
  address: PharmacyAddress;
  phone: string;
  fax?: string;
  email?: string;
  hoursOfOperation?: HoursOfOperation[];
  services?: PharmacyService[];
  active: boolean;
}

/**
 * Pharmacy Address
 */
export interface PharmacyAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Hours of Operation
 */
export interface HoursOfOperation {
  dayOfWeek: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  openTime: string; // HH:MM format
  closeTime: string; // HH:MM format
  allDay?: boolean;
  closed?: boolean;
}

/**
 * Pharmacy Services
 */
export interface PharmacyService {
  type: string;
  description: string;
  available: boolean;
}

/**
 * Prescription (MedicationRequest in FHIR)
 */
export interface Prescription {
  id: string;
  prescriptionNumber: string;
  status: PrescriptionStatus;
  intent: 'proposal' | 'plan' | 'order' | 'instance-order' | 'option';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  medication: Medication;
  patient: PatientReference;
  prescriber: PrescriberReference;
  authoredOn: Date;
  dosageInstructions: DosageInstruction[];
  dispenseRequest?: DispenseRequest;
  substitution?: SubstitutionRequest;
  priorAuthorization?: PriorAuthorization;
  note?: string;
  refills?: number;
  refillsRemaining?: number;
  daysSupply?: number;
  schedule?: DrugSchedule;
  expirationDate?: Date;
}

/**
 * Medication Information
 */
export interface Medication {
  id?: string;
  code: MedicationCode;
  name: string;
  form?: string;
  strength?: string;
  manufacturer?: string;
  brandName?: string;
  genericName?: string;
  therapeuticClass?: string;
  isControlled?: boolean;
  schedule?: DrugSchedule;
}

/**
 * Medication Coding
 */
export interface MedicationCode {
  system: 'http://www.nlm.nih.gov/research/umls/rxnorm' | 'http://hl7.org/fhir/sid/ndc' | string;
  code: string;
  display: string;
}

/**
 * Patient Reference
 */
export interface PatientReference {
  id: string;
  mrn?: string;
  name: string;
  dateOfBirth: Date;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  phone?: string;
  address?: PharmacyAddress;
}

/**
 * Prescriber Reference
 */
export interface PrescriberReference {
  id: string;
  npiNumber: string;
  deaNumber?: string;
  name: string;
  speciality?: string;
  practiceLocation?: string;
  phone?: string;
  fax?: string;
}

/**
 * Dosage Instructions
 */
export interface DosageInstruction {
  sequence?: number;
  text: string;
  additionalInstruction?: string[];
  timing?: DosageTiming;
  asNeeded?: boolean;
  route?: MedicationRoute;
  method?: string;
  doseAndRate?: DoseAndRate[];
  maxDosePerPeriod?: MaxDose;
  maxDosePerAdministration?: MaxDose;
  maxDosePerLifetime?: MaxDose;
}

/**
 * Dosage Timing
 */
export interface DosageTiming {
  repeat?: {
    frequency?: number;
    period?: number;
    periodUnit?: 'h' | 'd' | 'wk' | 'mo';
    when?: string[];
    duration?: number;
    durationUnit?: 'h' | 'd' | 'wk' | 'mo';
  };
  code?: {
    system: string;
    code: string;
    display: string;
  };
}

/**
 * Dose and Rate
 */
export interface DoseAndRate {
  type?: 'ordered' | 'calculated';
  doseQuantity?: Quantity;
  doseRange?: {
    low: Quantity;
    high: Quantity;
  };
  rateQuantity?: Quantity;
  rateRange?: {
    low: Quantity;
    high: Quantity;
  };
}

/**
 * Quantity
 */
export interface Quantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

/**
 * Max Dose
 */
export interface MaxDose {
  value: number;
  unit: string;
  period?: {
    value: number;
    unit: 'h' | 'd' | 'wk' | 'mo';
  };
}

/**
 * Medication Route
 */
export interface MedicationRoute {
  system: string;
  code: string;
  display: string;
}

/**
 * Dispense Request
 */
export interface DispenseRequest {
  initialFill?: InitialFill;
  dispenseInterval?: number;
  validityPeriod?: {
    start: Date;
    end: Date;
  };
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: {
    value: number;
    unit: 'd' | 'wk' | 'mo';
  };
  performer?: PharmacyReference;
}

/**
 * Initial Fill
 */
export interface InitialFill {
  quantity?: Quantity;
  duration?: {
    value: number;
    unit: 'd' | 'wk' | 'mo';
  };
}

/**
 * Pharmacy Reference
 */
export interface PharmacyReference {
  id: string;
  ncpdpId?: string;
  name: string;
}

/**
 * Substitution Request
 */
export interface SubstitutionRequest {
  allowed: boolean;
  reason?: string;
}

/**
 * Prior Authorization
 */
export interface PriorAuthorization {
  required: boolean;
  status?: 'pending' | 'approved' | 'denied' | 'expired';
  authorizationNumber?: string;
  expirationDate?: Date;
  supportingInformation?: string[];
}

/**
 * Medication Dispense
 */
export interface MedicationDispense {
  id: string;
  status: DispenseStatus;
  prescription: PrescriptionReference;
  patient: PatientReference;
  medication: Medication;
  pharmacy: PharmacyReference;
  dispensedBy?: PrescriberReference;
  quantity: Quantity;
  daysSupply?: number;
  whenPrepared?: Date;
  whenHandedOver?: Date;
  note?: string;
  dosageInstruction?: DosageInstruction[];
  substitution?: SubstitutionPerformed;
  detectedIssue?: DetectedIssue[];
}

/**
 * Prescription Reference
 */
export interface PrescriptionReference {
  id: string;
  prescriptionNumber: string;
}

/**
 * Substitution Performed
 */
export interface SubstitutionPerformed {
  wasSubstituted: boolean;
  type?: {
    system: string;
    code: string;
    display: string;
  };
  reason?: string;
  responsibleParty?: PrescriberReference;
}

/**
 * Detected Issue
 */
export interface DetectedIssue {
  severity: 'high' | 'moderate' | 'low';
  code: string;
  detail: string;
  mitigation?: string;
}

/**
 * NCPDP SCRIPT Message
 */
export interface NCPDPScriptMessage {
  header: NCPDPHeader;
  body: NCPDPBody;
  version: NCPDPVersion;
  messageType: NCPDPMessageType;
}

/**
 * NCPDP Message (Base)
 */
export interface NCPDPMessage {
  messageId: string;
  timestamp: Date;
  sender: NCPDPParty;
  receiver: NCPDPParty;
  testMode: boolean;
  acknowledgmentRequested: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  expirationTime?: Date;
}

/**
 * NCPDP Message Types
 */
export enum NCPDPMessageType {
  NEW_RX = 'NewRx',
  REFILL_REQUEST = 'RefillRequest',
  REFILL_RESPONSE = 'RefillResponse',
  RX_CHANGE_REQUEST = 'RxChangeRequest',
  RX_CHANGE_RESPONSE = 'RxChangeResponse',
  CANCEL_RX = 'CancelRx',
  CANCEL_RX_RESPONSE = 'CancelRxResponse',
  RX_RENEWAL_REQUEST = 'RxRenewalRequest',
  RX_RENEWAL_RESPONSE = 'RxRenewalResponse',
  RX_FILL = 'RxFill',
  RX_HISTORY_REQUEST = 'RxHistoryRequest',
  RX_HISTORY_RESPONSE = 'RxHistoryResponse',
  STATUS = 'Status',
  ERROR = 'Error',
  VERIFY = 'Verify'
}

/**
 * NCPDP Header
 */
export interface NCPDPHeader {
  to: NCPDPParty;
  from: NCPDPParty;
  messageId: string;
  relatesToMessageId?: string;
  sentTime: Date;
  security?: NCPDPSecurity;
}

/**
 * NCPDP Party
 */
export interface NCPDPParty {
  qualifier: string;
  id: string;
  name?: string;
}

/**
 * NCPDP Security
 */
export interface NCPDPSecurity {
  securityLevel: number;
  encryptionMethod?: string;
  digitalSignature?: string;
}

/**
 * NCPDP Body
 */
export interface NCPDPBody {
  prescription?: Prescription;
  patient?: PatientReference;
  prescriber?: PrescriberReference;
  pharmacy?: PharmacyReference;
  medicationDispensed?: MedicationDispense;
  response?: NCPDPResponse;
  error?: NCPDPError;
}

/**
 * NCPDP Response
 */
export interface NCPDPResponse {
  approved: boolean;
  responseCode: string;
  responseText: string;
  denialReason?: string;
  note?: string;
}

/**
 * NCPDP Error
 */
export interface NCPDPError {
  code: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  fieldPath?: string;
  suggestedAction?: string;
}

/**
 * Pharmacy Integration Result
 */
export interface PharmacyIntegrationResult<T = any> extends IntegrationResult<T> {
  ncpdpTransactionId?: string;
  pharmacyId?: string;
  prescriptionNumber?: string;
  fillNumber?: number;
  processingTime?: number;
  validationErrors?: PharmacyValidationError[];
}

/**
 * Pharmacy Validation Error
 */
export interface PharmacyValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

/**
 * Refill Request
 */
export interface RefillRequest {
  requestId: string;
  prescriptionId: string;
  prescriptionNumber: string;
  patient: PatientReference;
  pharmacy: PharmacyReference;
  requestDate: Date;
  requestedRefillDate?: Date;
  quantity?: Quantity;
  daysSupply?: number;
  urgency?: 'routine' | 'urgent' | 'emergency';
  patientComments?: string;
  preferredContactMethod?: 'phone' | 'email' | 'text' | 'app';
  authorizationStatus?: RefillAuthorizationStatus;
}

/**
 * Refill Authorization Status
 */
export interface RefillAuthorizationStatus {
  authorized: boolean;
  authorizationDate?: Date;
  authorizedBy?: PrescriberReference;
  denialReason?: string;
  alternativeOffered?: boolean;
}

/**
 * Refill Response
 */
export interface RefillResponse {
  responseId: string;
  requestId: string;
  status: RefillStatus;
  approvedQuantity?: Quantity;
  approvedDaysSupply?: number;
  readyDate?: Date;
  expirationDate?: Date;
  copayAmount?: Money;
  insuranceCoverage?: InsuranceCoverageInfo;
  alternativeMedication?: Medication;
  pharmacistNote?: string;
  nextRefillDate?: Date;
  refillsRemaining?: number;
}

/**
 * Insurance Coverage Info
 */
export interface InsuranceCoverageInfo {
  covered: boolean;
  copay?: Money;
  deductibleApplied?: Money;
  priorAuthRequired?: boolean;
  daysSupplyLimit?: number;
}

/**
 * Money Type
 */
export interface Money {
  value: number;
  currency: string;
}

/**
 * Pharmacy Clinical Service
 */
export interface PharmacyClinicalService {
  serviceType: PharmacyClinicalServiceType;
  available: boolean;
  appointmentRequired: boolean;
  walkInAvailable: boolean;
  certification?: string[];
  languages?: string[];
}

/**
 * Pharmacy Clinical Service Type
 */
export enum PharmacyClinicalServiceType {
  IMMUNIZATION = 'immunization',
  MTM = 'medication-therapy-management',
  HEALTH_SCREENING = 'health-screening',
  DISEASE_MANAGEMENT = 'disease-management',
  SMOKING_CESSATION = 'smoking-cessation',
  WEIGHT_MANAGEMENT = 'weight-management',
  DIABETES_EDUCATION = 'diabetes-education',
  TRAVEL_HEALTH = 'travel-health',
  POINT_OF_CARE_TESTING = 'point-of-care-testing',
  MEDICATION_SYNCHRONIZATION = 'medication-synchronization'
}

/**
 * Drug Interaction Check Request
 */
export interface DrugInteractionCheckRequest {
  patientId: string;
  medications: Medication[];
  includeOTC?: boolean;
  includeHerbal?: boolean;
  includeFoodInteractions?: boolean;
  severity?: InteractionSeverity[];
}

/**
 * Interaction Severity
 */
export enum InteractionSeverity {
  CONTRAINDICATED = 'contraindicated',
  SEVERE = 'severe',
  MODERATE = 'moderate',
  MINOR = 'minor',
  UNKNOWN = 'unknown'
}

/**
 * Drug Interaction Result
 */
export interface DrugInteractionResult {
  interactions: DrugInteraction[];
  checkedDate: Date;
  databaseVersion: string;
  totalInteractions: number;
}

/**
 * Drug Interaction
 */
export interface DrugInteraction {
  drug1: Medication;
  drug2: Medication;
  severity: InteractionSeverity;
  description: string;
  clinicalSignificance: string;
  managementStrategy: string;
  documentation: 'excellent' | 'good' | 'fair' | 'poor';
  references?: string[];
}

/**
 * Medication Adherence Data
 */
export interface MedicationAdherenceData {
  patientId: string;
  medication: Medication;
  prescriptionId: string;
  measurementPeriod: Period;
  pdc?: number; // Proportion of Days Covered
  mpr?: number; // Medication Possession Ratio
  gaps?: AdherenceGap[];
  refillTimeliness: RefillTimeliness;
  persistenceRate?: number;
}

/**
 * Period Type
 */
export interface Period {
  start: Date;
  end?: Date;
}

/**
 * Adherence Gap
 */
export interface AdherenceGap {
  startDate: Date;
  endDate: Date;
  daysWithoutMedication: number;
  reason?: string;
}

/**
 * Refill Timeliness
 */
export enum RefillTimeliness {
  ON_TIME = 'on-time',
  EARLY = 'early',
  LATE = 'late',
  VERY_LATE = 'very-late',
  NOT_REFILLED = 'not-refilled'
}

/**
 * Compound Prescription
 */
export interface CompoundPrescription extends Prescription {
  compoundType: 'cream' | 'ointment' | 'solution' | 'suspension' | 'capsule' | 'other';
  ingredients: CompoundIngredient[];
  instructions: CompoundingInstructions;
  beyondUseDate: Date;
  specialRequirements?: string[];
}

/**
 * Compound Ingredient
 */
export interface CompoundIngredient {
  ingredient: Medication;
  quantity: Quantity;
  role: 'active' | 'base' | 'preservative' | 'flavoring' | 'other';
  lotNumber?: string;
  expirationDate?: Date;
}

/**
 * Compounding Instructions
 */
export interface CompoundingInstructions {
  method: string;
  equipment?: string[];
  qualityControl?: string[];
  storageRequirements: string;
  stabilityData?: string;
}

/**
 * Pharmacy Inventory Item
 */
export interface PharmacyInventoryItem {
  medication: Medication;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityAvailable: number;
  reorderPoint: number;
  reorderQuantity: number;
  lotNumbers: LotInfo[];
  lastUpdated: Date;
  location?: string;
}

/**
 * Lot Information
 */
export interface LotInfo {
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
  manufacturer?: string;
}

/**
 * Controlled Substance Report
 */
export interface ControlledSubstanceReport {
  reportId: string;
  reportingPeriod: Period;
  pharmacy: PharmacyReference;
  reportType: 'daily' | 'monthly' | 'quarterly' | 'annual' | 'on-demand';
  substances: ControlledSubstanceEntry[];
  submittedDate: Date;
  submittedBy: string;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
}

/**
 * Controlled Substance Entry
 */
export interface ControlledSubstanceEntry {
  medication: Medication;
  schedule: DrugSchedule;
  beginningInventory: number;
  received: number;
  dispensed: number;
  destroyed: number;
  lost: number;
  endingInventory: number;
  discrepancy?: number;
  explanation?: string;
}

/**
 * Pharmacy Integration Configuration
 */
export interface PharmacyIntegrationConfig extends IntegrationConfig {
  ncpdpVersion: NCPDPVersion;
  senderId: string;
  receiverId: string;
  pharmacyChainId?: string;
  testMode?: boolean;
  supportedMessageTypes?: NCPDPMessageType[];
  encryption?: {
    enabled: boolean;
    algorithm: string;
    keyId: string;
  };
}

/**
 * Medication Synchronization Request
 */
export interface MedicationSyncRequest {
  patientId: string;
  pharmacyId?: string;
  startDate?: Date;
  endDate?: Date;
  includeDiscontinued?: boolean;
  includeAllPharmacies?: boolean;
}

/**
 * Medication Synchronization Response
 */
export interface MedicationSyncResponse extends IntegrationResult<MedicationHistory> {
  lastSyncDate: Date;
  recordsRetrieved: number;
  pharmaciesQueried: string[];
}

/**
 * Medication History
 */
export interface MedicationHistory {
  patient: PatientReference;
  medications: MedicationRecord[];
  lastUpdated: Date;
  source: string;
}

/**
 * Medication Record
 */
export interface MedicationRecord {
  prescription: Prescription;
  dispenses: MedicationDispense[];
  adherenceScore?: number;
  lastFillDate?: Date;
  nextRefillDate?: Date;
  daysUntilRefill?: number;
}

/**
 * Formulary Check Request
 */
export interface FormularyCheckRequest {
  medication: Medication;
  patientId: string;
  payerId: string;
  pharmacyId?: string;
  prescriberId?: string;
}

/**
 * Formulary Check Response
 */
export interface FormularyCheckResponse {
  onFormulary: boolean;
  tier?: number;
  copay?: number;
  requiresPriorAuth?: boolean;
  stepTherapyRequired?: boolean;
  quantityLimits?: QuantityLimit;
  alternatives?: FormularyAlternative[];
  restrictions?: string[];
}

/**
 * Quantity Limit
 */
export interface QuantityLimit {
  quantity: number;
  period: {
    value: number;
    unit: 'd' | 'wk' | 'mo';
  };
}

/**
 * Formulary Alternative
 */
export interface FormularyAlternative {
  medication: Medication;
  tier: number;
  copay?: number;
  preferred: boolean;
}

/**
 * Real-Time Prescription Benefit Request
 */
export interface RTPBRequest {
  patient: PatientReference;
  prescriber: PrescriberReference;
  medication: Medication;
  quantity: Quantity;
  daysSupply: number;
  pharmacy?: PharmacyReference;
  coverages: CoverageReference[];
}

/**
 * Coverage Reference
 */
export interface CoverageReference {
  id: string;
  payerId: string;
  memberId: string;
  groupNumber?: string;
}

/**
 * Real-Time Prescription Benefit Response
 */
export interface RTPBResponse {
  patient: PatientReference;
  prescriber: PrescriberReference;
  medication: Medication;
  benefitDetails: BenefitDetail[];
  alternatives?: AlternativeMedication[];
  priorAuthRequired?: boolean;
  stepTherapyRequired?: boolean;
}

/**
 * Benefit Detail
 */
export interface BenefitDetail {
  pharmacy: PharmacyReference;
  coverage: CoverageReference;
  copay?: number;
  coinsurance?: number;
  deductible?: number;
  benefitStage?: string;
  mailOrder?: boolean;
  specialty?: boolean;
}

/**
 * Alternative Medication
 */
export interface AlternativeMedication {
  medication: Medication;
  benefitDetails: BenefitDetail[];
  savingsAmount?: number;
  preferred: boolean;
}

/**
 * Pharmacy Compliance Status
 */
export interface PharmacyComplianceStatus extends ComplianceStatus {
  ncpdpCompliance: boolean;
  deaCompliance: boolean;
  stateCompliance: boolean;
  hipaaCertified: boolean;
  epcsEnabled: boolean;
}

/**
 * Pharmacy Service Interface
 */
export interface PharmacyService {
  // Prescription Management
  createPrescription(prescription: Prescription): Promise<IntegrationResult<Prescription>>;
  updatePrescription(id: string, updates: Partial<Prescription>): Promise<IntegrationResult<Prescription>>;
  cancelPrescription(id: string, reason: string): Promise<IntegrationResult<void>>;
  getPrescription(id: string): Promise<IntegrationResult<Prescription>>;
  searchPrescriptions(criteria: any): Promise<IntegrationResult<Prescription[]>>;
  
  // Medication Dispensing
  createDispense(dispense: MedicationDispense): Promise<IntegrationResult<MedicationDispense>>;
  updateDispense(id: string, updates: Partial<MedicationDispense>): Promise<IntegrationResult<MedicationDispense>>;
  getDispenseHistory(prescriptionId: string): Promise<IntegrationResult<MedicationDispense[]>>;
  
  // NCPDP Messaging
  sendNCPDPMessage(message: NCPDPScriptMessage): Promise<IntegrationResult<NCPDPResponse>>;
  processNCPDPMessage(message: NCPDPScriptMessage): Promise<IntegrationResult<void>>;
  
  // Formulary and Benefits
  checkFormulary(request: FormularyCheckRequest): Promise<IntegrationResult<FormularyCheckResponse>>;
  getRTPBenefits(request: RTPBRequest): Promise<IntegrationResult<RTPBResponse>>;
  
  // Medication Synchronization
  syncMedications(request: MedicationSyncRequest): Promise<IntegrationResult<MedicationSyncResponse>>;
  
  // Compliance
  getComplianceStatus(): Promise<PharmacyComplianceStatus>;
}

// Export all types
export type {
  IntegrationResult,
  IntegrationMessage,
  PharmacyService as IPharmacyService
};

