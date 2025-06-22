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