/**
 * Laboratory Integration Types
 * Type definitions for laboratory information systems, lab orders, and results
 */

import { IntegrationResult, IntegrationMessage, IntegrationConfig, ComplianceStatus } from './integration.types';

/**
 * Laboratory Order Status
 */
export enum LabOrderStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ON_HOLD = 'on-hold',
  REVOKED = 'revoked',
  COMPLETED = 'completed',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown'
}

/**
 * Specimen Status
 */
export enum SpecimenStatus {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  UNSATISFACTORY = 'unsatisfactory',
  ENTERED_IN_ERROR = 'entered-in-error'
}

/**
 * Lab Result Status
 */
export enum LabResultStatus {
  REGISTERED = 'registered',
  PARTIAL = 'partial',
  PRELIMINARY = 'preliminary',
  FINAL = 'final',
  AMENDED = 'amended',
  CORRECTED = 'corrected',
  APPENDED = 'appended',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown'
}

/**
 * Interpretation Codes
 */
export enum InterpretationCode {
  HIGH = 'H',
  LOW = 'L',
  NORMAL = 'N',
  ABNORMAL = 'A',
  CRITICAL_HIGH = 'HH',
  CRITICAL_LOW = 'LL',
  PANIC_HIGH = 'PH',
  PANIC_LOW = 'PL',
  SIGNIFICANT_CHANGE_UP = 'U',
  SIGNIFICANT_CHANGE_DOWN = 'D',
  BETTER = 'B',
  WORSE = 'W',
  SUSCEPTIBLE = 'S',
  INTERMEDIATE = 'I',
  RESISTANT = 'R',
  POSITIVE = 'POS',
  NEGATIVE = 'NEG',
  DETECTED = 'DET',
  NOT_DETECTED = 'ND',
  INCONCLUSIVE = 'IND'
}

/**
 * Priority Codes
 */
export enum PriorityCode {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  ASAP = 'asap',
  STAT = 'stat'
}

/**
 * Specimen Collection Method
 */
export enum CollectionMethod {
  VENIPUNCTURE = 'venipuncture',
  FINGERSTICK = 'fingerstick',
  ARTERIAL_PUNCTURE = 'arterial-puncture',
  URINE_CLEAN_CATCH = 'urine-clean-catch',
  URINE_CATHETER = 'urine-catheter',
  THROAT_SWAB = 'throat-swab',
  NASAL_SWAB = 'nasal-swab',
  WOUND_SWAB = 'wound-swab',
  SPUTUM = 'sputum',
  STOOL = 'stool',
  BIOPSY = 'biopsy',
  OTHER = 'other'
}

/**
 * Container Type
 */
export enum ContainerType {
  RED_TOP = 'red-top',
  LAVENDER_TOP = 'lavender-top',
  GREEN_TOP = 'green-top',
  BLUE_TOP = 'blue-top',
  GRAY_TOP = 'gray-top',
  YELLOW_TOP = 'yellow-top',
  URINE_CUP = 'urine-cup',
  CULTURE_BOTTLE = 'culture-bottle',
  TRANSPORT_MEDIA = 'transport-media',
  OTHER = 'other'
}

/**
 * Laboratory System
 */
export interface LaboratorySystem {
  id: string;
  name: string;
  type: 'LIS' | 'LIMS' | 'Analyzer' | 'Middleware';
  vendor: string;
  version: string;
  location: LabLocation;
  capabilities: SystemCapabilities;
  interfaces: InterfaceConfiguration[];
  active: boolean;
}

/**
 * Lab Location
 */
export interface LabLocation {
  id: string;
  name: string;
  address: Address;
  phone: string;
  fax?: string;
  email?: string;
  director: string;
  licenseNumber?: string;
  accreditation?: AccreditationInfo[];
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
 * Accreditation Info
 */
export interface AccreditationInfo {
  organization: string;
  certificationNumber: string;
  validFrom: Date;
  validTo: Date;
  scope: string[];
}

/**
 * System Capabilities
 */
export interface SystemCapabilities {
  orderEntry: boolean;
  specimenTracking: boolean;
  resultReporting: boolean;
  qualityControl: boolean;
  interfacing: boolean;
  barcodingSupport: boolean;
  autoVerification: boolean;
  deltaChecking: boolean;
  criticalValueNotification: boolean;
  regulatoryReporting: boolean;
}

/**
 * Interface Configuration
 */
export interface InterfaceConfiguration {
  type: 'HL7' | 'ASTM' | 'LIS2A2' | 'Custom';
  direction: 'inbound' | 'outbound' | 'bidirectional';
  endpoint: string;
  protocol: 'TCP/IP' | 'FILE' | 'HTTP' | 'FTP';
  messageTypes: string[];
  encoding: 'UTF-8' | 'ASCII' | 'ISO-8859-1';
  active: boolean;
}

/**
 * Laboratory Order
 */
export interface LabOrder {
  id: string;
  identifier?: Identifier[];
  status: LabOrderStatus;
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: OrderCategory[];
  priority: PriorityCode;
  doNotPerform?: boolean;
  code: OrderCode;
  subject: PatientReference;
  encounter?: EncounterReference;
  occurrenceDateTime?: Date;
  occurrencePeriod?: Period;
  occurrenceTiming?: Timing;
  asNeeded?: boolean;
  authoredOn: Date;
  requester: RequesterReference;
  performerType?: CodeableConcept;
  performer?: ProviderReference[];
  locationCode?: CodeableConcept[];
  locationReference?: FacilityReference[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  insurance?: InsuranceReference[];
  supportingInfo?: Reference[];
  specimen?: SpecimenReference[];
  bodySite?: CodeableConcept[];
  note?: Annotation[];
  patientInstruction?: string;
  relevantHistory?: Reference[];
}

/**
 * Identifier
 */
export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value: string;
  period?: Period;
  assigner?: OrganizationReference;
}

/**
 * Order Category
 */
export interface OrderCategory {
  coding: Coding[];
  text?: string;
}

/**
 * Order Code
 */
export interface OrderCode {
  coding: Coding[];
  text?: string;
}

/**
 * Coding
 */
export interface Coding {
  system: string;
  version?: string;
  code: string;
  display?: string;
  userSelected?: boolean;
}

/**
 * Codeable Concept
 */
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

/**
 * Patient Reference
 */
export interface PatientReference {
  id: string;
  identifier?: string;
  name: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  mrn?: string;
}

/**
 * Encounter Reference
 */
export interface EncounterReference {
  id: string;
  encounterNumber?: string;
  type?: string;
}

/**
 * Period
 */
export interface Period {
  start: Date;
  end?: Date;
}

/**
 * Timing
 */
export interface Timing {
  event?: Date[];
  repeat?: TimingRepeat;
  code?: CodeableConcept;
}

/**
 * Timing Repeat
 */
export interface TimingRepeat {
  bounds?: Duration | Range | Period;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dayOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  timeOfDay?: string[];
  when?: string[];
  offset?: number;
}

/**
 * Duration
 */
export interface Duration {
  value: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit: string;
  system?: string;
  code?: string;
}

/**
 * Range
 */
export interface Range {
  low?: Quantity;
  high?: Quantity;
}

/**
 * Quantity
 */
export interface Quantity {
  value: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit: string;
  system?: string;
  code?: string;
}

/**
 * Requester Reference
 */
export interface RequesterReference {
  id: string;
  npi?: string;
  name: string;
  type: 'practitioner' | 'organization' | 'patient' | 'related-person' | 'device';
}

/**
 * Provider Reference
 */
export interface ProviderReference {
  id: string;
  npi?: string;
  name: string;
  speciality?: string;
}

/**
 * Facility Reference
 */
export interface FacilityReference {
  id: string;
  name: string;
  address?: Address;
  type?: string;
}

/**
 * Insurance Reference
 */
export interface InsuranceReference {
  id: string;
  memberId?: string;
  payerName?: string;
}

/**
 * Reference
 */
export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

/**
 * Specimen Reference
 */
export interface SpecimenReference {
  id: string;
  accessionNumber?: string;
  type?: string;
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
 * Organization Reference
 */
export interface OrganizationReference {
  id: string;
  name?: string;
  identifier?: string;
}

/**
 * Specimen
 */
export interface Specimen {
  id: string;
  identifier?: Identifier[];
  accessionIdentifier?: Identifier;
  status: SpecimenStatus;
  type?: CodeableConcept;
  subject: PatientReference;
  receivedTime?: Date;
  parent?: SpecimenReference[];
  request?: LabOrderReference[];
  collection?: SpecimenCollection;
  processing?: SpecimenProcessing[];
  container?: SpecimenContainer[];
  condition?: CodeableConcept[];
  note?: Annotation[];
}

/**
 * Lab Order Reference
 */
export interface LabOrderReference {
  id: string;
  orderNumber?: string;
}

/**
 * Specimen Collection
 */
export interface SpecimenCollection {
  collector?: Reference;
  collectedDateTime?: Date;
  collectedPeriod?: Period;
  duration?: Duration;
  quantity?: Quantity;
  method?: CodeableConcept;
  bodySite?: CodeableConcept;
  fastingStatus?: CodeableConcept;
}

/**
 * Specimen Processing
 */
export interface SpecimenProcessing {
  description?: string;
  procedure?: CodeableConcept;
  additive?: Reference[];
  timeDateTime?: Date;
  timePeriod?: Period;
}

/**
 * Specimen Container
 */
export interface SpecimenContainer {
  identifier?: Identifier[];
  description?: string;
  type?: CodeableConcept;
  capacity?: Quantity;
  specimenQuantity?: Quantity;
  additiveCodeableConcept?: CodeableConcept;
  additiveReference?: Reference;
}

/**
 * Lab Result/Observation
 */
export interface LabResult {
  id: string;
  identifier?: Identifier[];
  basedOn?: LabOrderReference[];
  partOf?: Reference[];
  status: LabResultStatus;
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject: PatientReference;
  focus?: Reference[];
  encounter?: EncounterReference;
  effectiveDateTime?: Date;
  effectivePeriod?: Period;
  effectiveTiming?: Timing;
  effectiveInstant?: Date;
  issued?: Date;
  performer?: ProviderReference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: Date;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: SpecimenReference;
  device?: Reference;
  referenceRange?: ReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}

/**
 * Ratio
 */
export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

/**
 * Sampled Data
 */
export interface SampledData {
  origin: Quantity;
  period: number;
  factor?: number;
  lowerLimit?: number;
  upperLimit?: number;
  dimensions: number;
  data?: string;
}

/**
 * Reference Range
 */
export interface ReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

/**
 * Observation Component
 */
export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: Date;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ReferenceRange[];
}

/**
 * Lab Panel/Battery
 */
export interface LabPanel {
  id: string;
  identifier?: Identifier[];
  status: LabResultStatus;
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject: PatientReference;
  encounter?: EncounterReference;
  effectiveDateTime?: Date;
  effectivePeriod?: Period;
  issued?: Date;
  performer?: ProviderReference[];
  note?: Annotation[];
  specimen?: SpecimenReference[];
  results: LabResult[];
  interpretation?: CodeableConcept[];
}

/**
 * Critical Value Alert
 */
export interface CriticalValueAlert {
  id: string;
  resultId: string;
  patientId: string;
  testCode: string;
  testName: string;
  value: string;
  criticalRange: ReferenceRange;
  severity: 'critical' | 'panic' | 'high' | 'low';
  alertTime: Date;
  physician: ProviderReference;
  notificationAttempts: NotificationAttempt[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedTime?: Date;
  resolution?: string;
}

/**
 * Notification Attempt
 */
export interface NotificationAttempt {
  method: 'phone' | 'pager' | 'email' | 'sms' | 'hl7';
  recipient: string;
  timestamp: Date;
  success: boolean;
  message?: string;
}

/**
 * Quality Control Result
 */
export interface QualityControlResult {
  id: string;
  materialId: string;
  materialName: string;
  lotNumber: string;
  expirationDate: Date;
  testCode: string;
  testName: string;
  analyzer: string;
  runDate: Date;
  expectedValue: number;
  measuredValue: number;
  difference: number;
  percentDifference: number;
  withinAcceptableLimits: boolean;
  comments?: string;
  operatorId?: string;
}

/**
 * Lab Test Definition
 */
export interface LabTestDefinition {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  category: string;
  subcategory?: string;
  description?: string;
  methodology?: string;
  specimenType: CodeableConcept[];
  containerType: ContainerType[];
  volume?: Quantity;
  collectionInstructions?: string;
  processingInstructions?: string;
  storageRequirements?: string;
  transportRequirements?: string;
  turnaroundTime?: Duration;
  referenceRanges: ConditionalReferenceRange[];
  criticalValues?: CriticalValueRange[];
  units: string;
  resultType: 'numeric' | 'text' | 'coded' | 'structured';
  active: boolean;
  clinicalSignificance?: string;
  limitations?: string;
  interferences?: string[];
}

/**
 * Conditional Reference Range
 */
export interface ConditionalReferenceRange {
  range: ReferenceRange;
  conditions?: RangeCondition[];
}

/**
 * Range Condition
 */
export interface RangeCondition {
  type: 'age' | 'gender' | 'pregnancy' | 'condition' | 'medication';
  value: string;
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
}

/**
 * Critical Value Range
 */
export interface CriticalValueRange {
  type: 'high' | 'low' | 'panic-high' | 'panic-low';
  value: number;
  conditions?: RangeCondition[];
}

/**
 * Lab Test Category
 */
export enum LabTestCategory {
  HEMATOLOGY = 'hematology',
  CHEMISTRY = 'chemistry',
  MICROBIOLOGY = 'microbiology',
  IMMUNOLOGY = 'immunology',
  PATHOLOGY = 'pathology',
  MOLECULAR = 'molecular',
  GENETICS = 'genetics',
  TOXICOLOGY = 'toxicology',
  URINALYSIS = 'urinalysis',
  COAGULATION = 'coagulation',
  ENDOCRINOLOGY = 'endocrinology',
  SEROLOGY = 'serology',
  CYTOLOGY = 'cytology',
  BLOOD_BANK = 'blood-bank',
  OTHER = 'other'
}

/**
 * Result Flag
 */
export enum ResultFlag {
  ABNORMAL = 'abnormal',
  CRITICAL = 'critical',
  HIGH = 'high',
  LOW = 'low',
  PANIC = 'panic',
  DELTA_CHECK = 'delta-check',
  OUTSIDE_REFERENCE_RANGE = 'outside-reference-range',
  PENDING = 'pending',
  CORRECTED = 'corrected',
  AMENDED = 'amended',
  CANCELLED = 'cancelled'
}

/**
 * Result Interpretation
 */
export interface ResultInterpretation {
  id: string;
  resultId: string;
  interpretationCode: InterpretationCode;
  interpretationText: string;
  interpretedBy: ProviderReference;
  interpretedDateTime: Date;
  clinicalSignificance?: string;
  recommendations?: string[];
  flags?: ResultFlag[];
  comments?: string;
  validated: boolean;
  validatedBy?: ProviderReference;
  validatedDateTime?: Date;
}

/**
 * Specimen Type
 */
export interface SpecimenType {
  id: string;
  code: string;
  display: string;
  category: 'blood' | 'urine' | 'tissue' | 'fluid' | 'swab' | 'other';
  collection: {
    method: CollectionMethod[];
    containerType: ContainerType[];
    volume?: Quantity;
    additives?: string[];
  };
  handling: {
    temperature: 'room' | 'refrigerated' | 'frozen' | 'ultra-frozen';
    transportTime?: Duration;
    storageTime?: Duration;
    specialInstructions?: string;
  };
  processing: {
    centrifugation?: boolean;
    aliquoting?: boolean;
    preservatives?: string[];
  };
  suitableFor: LabTestCategory[];
  active: boolean;
}

/**
 * Lab Interface
 */
export interface LabInterface {
  id: string;
  name: string;
  type: 'inbound' | 'outbound' | 'bidirectional';
  protocol: 'HL7v2' | 'HL7v3' | 'FHIR' | 'ASTM' | 'LIS2A2' | 'Custom';
  version: string;
  endpoint: {
    type: 'TCP/IP' | 'FILE' | 'HTTP' | 'HTTPS' | 'FTP' | 'SFTP' | 'MLLP';
    host?: string;
    port?: number;
    path?: string;
    directory?: string;
  };
  authentication?: {
    type: 'none' | 'basic' | 'oauth2' | 'api-key' | 'certificate';
    credentials?: Record<string, string>;
  };
  messageTypes: string[];
  encoding: 'UTF-8' | 'ASCII' | 'ISO-8859-1';
  acknowledgmentMode: 'auto' | 'manual' | 'none';
  retryPolicy: {
    maxAttempts: number;
    retryInterval: number;
    backoffMultiplier?: number;
  };
  errorHandling: {
    onError: 'reject' | 'queue' | 'ignore';
    errorQueue?: string;
  };
  active: boolean;
  lastConnection?: Date;
  statistics?: {
    messagesReceived: number;
    messagesSent: number;
    errors: number;
    lastError?: string;
  };
}

/**
 * Lab Routing
 */
export interface LabRouting {
  id: string;
  name: string;
  description?: string;
  sourceInterface: string;
  destinationInterfaces: string[];
  routingRules: RoutingRule[];
  transformations?: TransformationRule[];
  priority: number;
  active: boolean;
}

/**
 * Routing Rule
 */
export interface RoutingRule {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'notIn';
  value: string | string[];
  destination?: string;
  action: 'route' | 'copy' | 'filter' | 'transform';
}

/**
 * Transformation Rule
 */
export interface TransformationRule {
  id: string;
  type: 'field-mapping' | 'value-mapping' | 'format' | 'custom';
  source: string;
  target: string;
  mapping?: Record<string, string>;
  format?: string;
  script?: string;
}

/**
 * Result Delivery
 */
export interface ResultDelivery {
  id: string;
  resultId: string;
  deliveryMethod: 'interface' | 'fax' | 'email' | 'portal' | 'print' | 'sms';
  recipient: {
    type: 'provider' | 'patient' | 'facility' | 'payer';
    id: string;
    name: string;
    contactInfo: {
      fax?: string;
      email?: string;
      phone?: string;
      address?: Address;
    };
  };
  deliveryStatus: 'pending' | 'in-progress' | 'delivered' | 'failed' | 'cancelled';
  priority: PriorityCode;
  scheduledTime?: Date;
  attemptedTime?: Date;
  deliveredTime?: Date;
  attempts: number;
  errorMessage?: string;
  confirmation?: {
    method: 'auto' | 'manual' | 'signature';
    confirmedBy?: string;
    confirmedTime?: Date;
    confirmationId?: string;
  };
  attachments?: Attachment[];
}

/**
 * Lab Accession
 */
export interface LabAccession {
  id: string;
  accessionNumber: string;
  accessionDateTime: Date;
  accessionedBy: string;
  location: string;
  orderId: string;
  specimens: SpecimenAccession[];
  priority: PriorityCode;
  clinicalInfo?: string;
  diagnosis?: CodeableConcept[];
  comments?: string;
  workflow: {
    currentStep: string;
    completedSteps: WorkflowStep[];
    pendingSteps: WorkflowStep[];
  };
  billing?: {
    insuranceVerified: boolean;
    authorizationNumber?: string;
    estimatedCost?: number;
  };
  compliance: {
    consentObtained: boolean;
    abn?: boolean; // Advance Beneficiary Notice
    specialHandling?: string[];
  };
}

/**
 * Specimen Accession
 */
export interface SpecimenAccession {
  specimenId: string;
  containerBarcode: string;
  specimenType: string;
  volume?: Quantity;
  condition: 'satisfactory' | 'unsatisfactory' | 'quantity-not-sufficient';
  comments?: string;
}

/**
 * Workflow Step
 */
export interface WorkflowStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  performer?: string;
  location?: string;
  notes?: string;
}

/**
 * Lab Comment
 */
export interface LabComment {
  id: string;
  entityType: 'order' | 'specimen' | 'result' | 'panel' | 'report';
  entityId: string;
  commentType: 'general' | 'clinical' | 'technical' | 'billing' | 'quality';
  text: string;
  author: ProviderReference;
  timestamp: Date;
  visibility: 'internal' | 'provider' | 'patient' | 'all';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  relatedComments?: string[];
  attachments?: Attachment[];
  acknowledged?: {
    by: string;
    timestamp: Date;
  };
  tags?: string[];
}

/**
 * Lab Workflow Step
 */
export interface LabWorkflowStep {
  id: string;
  orderId: string;
  specimenId?: string;
  step: 'ordered' | 'collected' | 'received' | 'processed' | 'analyzed' | 'verified' | 'reported';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  timestamp: Date;
  performer?: ProviderReference;
  location?: string;
  duration?: Duration;
  notes?: string;
  barcode?: string;
}

/**
 * Lab Report
 */
export interface LabReport {
  id: string;
  identifier?: Identifier[];
  basedOn: LabOrderReference[];
  status: 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error';
  category: CodeableConcept[];
  code: CodeableConcept;
  subject: PatientReference;
  encounter?: EncounterReference;
  effectiveDateTime?: Date;
  effectivePeriod?: Period;
  issued: Date;
  performer: ProviderReference[];
  resultsInterpreter?: ProviderReference[];
  specimen?: SpecimenReference[];
  result?: LabResult[];
  imagingStudy?: Reference[];
  media?: ReportMedia[];
  composition?: Reference;
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Attachment[];
}

/**
 * Report Media
 */
export interface ReportMedia {
  comment?: string;
  link: Reference;
}

/**
 * Attachment
 */
export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: Date;
}

/**
 * Lab Interface Message
 */
export interface LabInterfaceMessage {
  messageHeader: LabMessageHeader;
  orders?: LabOrder[];
  specimens?: Specimen[];
  results?: LabResult[];
  panels?: LabPanel[];
  qcResults?: QualityControlResult[];
  alerts?: CriticalValueAlert[];
}

/**
 * Lab Message Header
 */
export interface LabMessageHeader {
  messageType: 'ORM' | 'ORU' | 'QRY' | 'ACK' | 'QCK';
  messageId: string;
  timestamp: Date;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  processingId: 'P' | 'T' | 'D'; // Production, Test, Debug
  versionId: string;
}

/**
 * Lab Integration Configuration
 */
export interface LabIntegrationConfig extends IntegrationConfig {
  labSystemType: 'LIS' | 'LIMS' | 'Analyzer' | 'Middleware';
  interfaceType: 'HL7' | 'ASTM' | 'LIS2A2' | 'Custom';
  messageTypes: string[];
  autoAcknowledge: boolean;
  autoVerification: boolean;
  criticalValueNotification: boolean;
  qcEnabled: boolean;
  barcodeEnabled: boolean;
  specimenTracking: boolean;
}

/**
 * Lab Order Request
 */
export interface LabOrderRequest {
  patient: PatientReference;
  requester: RequesterReference;
  tests: LabTestRequest[];
  priority: PriorityCode;
  clinicalInfo?: string;
  diagnosis?: CodeableConcept[];
  scheduledDate?: Date;
  collectionInstructions?: string;
  insurance?: InsuranceReference[];
}

/**
 * Lab Test Request
 */
export interface LabTestRequest {
  code: string;
  name: string;
  urgency?: PriorityCode;
  specimenType?: string;
  fasting?: boolean;
  instructions?: string;
}

/**
 * Lab Order Response
 */
export interface LabOrderResponse extends IntegrationResult<LabOrderResult> {
  orderDate: Date;
  expectedResultDate?: Date;
}

/**
 * Lab Order Result
 */
export interface LabOrderResult {
  orderId: string;
  accessionNumber?: string;
  status: LabOrderStatus;
  specimens: SpecimenInfo[];
  estimatedTurnaroundTime?: Duration;
  collectionInstructions?: string;
}

/**
 * Specimen Info
 */
export interface SpecimenInfo {
  specimenId: string;
  type: string;
  containerType: ContainerType;
  volume?: Quantity;
  barcodes?: string[];
  collectionSite?: string;
}

/**
 * Results Inquiry Request
 */
export interface ResultsInquiryRequest {
  patientId?: string;
  orderId?: string;
  accessionNumber?: string;
  dateRange?: Period;
  testCodes?: string[];
  resultStatus?: LabResultStatus[];
}

/**
 * Results Inquiry Response
 */
export interface ResultsInquiryResponse extends IntegrationResult<ResultsData> {
  totalResults: number;
  hasMore: boolean;
  nextPageToken?: string;
}

/**
 * Results Data
 */
export interface ResultsData {
  orders: LabOrder[];
  results: LabResult[];
  panels: LabPanel[];
  reports: LabReport[];
}

/**
 * Lab Compliance Status
 */
export interface LabComplianceStatus extends ComplianceStatus {
  cliaCompliant: boolean;
  capAccredited: boolean;
  stateCompliant: boolean;
  fdaApproved: boolean;
  iso15189Certified: boolean;
  qualityControlCurrent: boolean;
  proficiencyTestingCurrent: boolean;
}

/**
 * Laboratory Service Interface
 */
export interface LaboratoryService {
  // Order Management
  createOrder(request: LabOrderRequest): Promise<IntegrationResult<LabOrderResponse>>;
  updateOrder(orderId: string, updates: Partial<LabOrder>): Promise<IntegrationResult<LabOrder>>;
  cancelOrder(orderId: string, reason: string): Promise<IntegrationResult<void>>;
  getOrder(orderId: string): Promise<IntegrationResult<LabOrder>>;
  searchOrders(criteria: any): Promise<IntegrationResult<LabOrder[]>>;
  
  // Specimen Management
  createSpecimen(specimen: Specimen): Promise<IntegrationResult<Specimen>>;
  updateSpecimen(specimenId: string, updates: Partial<Specimen>): Promise<IntegrationResult<Specimen>>;
  getSpecimen(specimenId: string): Promise<IntegrationResult<Specimen>>;
  trackSpecimen(accessionNumber: string): Promise<IntegrationResult<LabWorkflowStep[]>>;
  
  // Results Management
  createResult(result: LabResult): Promise<IntegrationResult<LabResult>>;
  updateResult(resultId: string, updates: Partial<LabResult>): Promise<IntegrationResult<LabResult>>;
  getResults(request: ResultsInquiryRequest): Promise<IntegrationResult<ResultsInquiryResponse>>;
  verifyResults(resultIds: string[]): Promise<IntegrationResult<void>>;
  
  // Critical Values
  createCriticalAlert(alert: CriticalValueAlert): Promise<IntegrationResult<CriticalValueAlert>>;
  acknowledgeCriticalAlert(alertId: string, acknowledgedBy: string): Promise<IntegrationResult<void>>;
  getCriticalAlerts(patientId?: string): Promise<IntegrationResult<CriticalValueAlert[]>>;
  
  // Quality Control
  recordQCResult(qcResult: QualityControlResult): Promise<IntegrationResult<QualityControlResult>>;
  getQCResults(dateRange: Period, materialId?: string): Promise<IntegrationResult<QualityControlResult[]>>;
  
  // Reporting
  generateReport(orderId: string): Promise<IntegrationResult<LabReport>>;
  getReport(reportId: string): Promise<IntegrationResult<LabReport>>;
  
  // Interface Operations
  processInboundMessage(message: LabInterfaceMessage): Promise<IntegrationResult<void>>;
  sendOutboundMessage(message: LabInterfaceMessage): Promise<IntegrationResult<void>>;
  
  // Compliance
  getComplianceStatus(): Promise<LabComplianceStatus>;
  
  // Test Catalog
  getTestCatalog(): Promise<IntegrationResult<LabTestDefinition[]>>;
  getTestDefinition(testCode: string): Promise<IntegrationResult<LabTestDefinition>>;
}

// Export all types
export type {
  IntegrationResult,
  IntegrationMessage,
  LaboratoryService as ILaboratoryService
};