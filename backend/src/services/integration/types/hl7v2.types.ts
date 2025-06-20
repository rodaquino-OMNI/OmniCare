/**
 * HL7 v2 Integration Types
 * Types and interfaces for HL7 v2 message handling and legacy system integration
 */

// HL7 v2 Message Structure
export interface HL7v2Message {
  messageType: string; // MSH.9.1
  triggerEvent: string; // MSH.9.2
  messageStructure: string; // MSH.9.3
  messageControlId: string; // MSH.10
  sendingApplication: string; // MSH.3
  sendingFacility: string; // MSH.4
  receivingApplication: string; // MSH.5
  receivingFacility: string; // MSH.6
  timestamp: Date; // MSH.7
  processingId: string; // MSH.11
  versionId: string; // MSH.12
  sequenceNumber?: number; // MSH.13
  continuationPointer?: string; // MSH.14
  acceptAcknowledgmentType?: string; // MSH.15
  applicationAcknowledgmentType?: string; // MSH.16
  countryCode?: string; // MSH.17
  characterSet?: string; // MSH.18
  principalLanguage?: string; // MSH.19
  segments: HL7v2Segment[];
  rawMessage?: string;
}

// HL7 v2 Segment
export interface HL7v2Segment {
  segmentType: string;
  fields: HL7v2Field[];
  sequenceNumber?: number;
  setId?: string;
}

// HL7 v2 Field
export interface HL7v2Field {
  value: string | HL7v2Component[] | HL7v2Field[];
  components?: HL7v2Component[];
  repetitions?: HL7v2Field[];
}

// HL7 v2 Component
export interface HL7v2Component {
  value: string | HL7v2Subcomponent[];
  subcomponents?: HL7v2Subcomponent[];
}

// HL7 v2 Subcomponent
export interface HL7v2Subcomponent {
  value: string;
}

// HL7 v2 Message Types
export enum HL7v2MessageType {
  // Admission, Discharge, Transfer
  ADT_A01 = 'ADT^A01', // Admit/Visit Notification
  ADT_A02 = 'ADT^A02', // Transfer a Patient
  ADT_A03 = 'ADT^A03', // Discharge/End Visit
  ADT_A04 = 'ADT^A04', // Register a Patient
  ADT_A05 = 'ADT^A05', // Pre-admit a Patient
  ADT_A08 = 'ADT^A08', // Update Patient Information
  ADT_A11 = 'ADT^A11', // Cancel Admit/Visit Notification
  ADT_A12 = 'ADT^A12', // Cancel Transfer
  ADT_A13 = 'ADT^A13', // Cancel Discharge/End Visit
  
  // Orders
  ORM_O01 = 'ORM^O01', // Order Message
  ORU_R01 = 'ORU^R01', // Unsolicited Observation Message
  ORL_O22 = 'ORL^O22', // Laboratory Order Response
  
  // Results
  ORU_R30 = 'ORU^R30', // Unsolicited Point-of-Care Observation
  ORU_R32 = 'ORU^R32', // Unsolicited Pre-Ordered Point-of-Care Observation
  
  // Scheduling
  SIU_S12 = 'SIU^S12', // Notification of New Appointment Booking
  SIU_S13 = 'SIU^S13', // Notification of Appointment Rescheduling
  SIU_S14 = 'SIU^S14', // Notification of Appointment Modification
  SIU_S15 = 'SIU^S15', // Notification of Appointment Cancellation
  
  // Financial
  DFT_P03 = 'DFT^P03', // Post Detail Financial Transaction
  
  // Master Files
  MFN_M02 = 'MFN^M02', // Master File - Staff Practitioner
  MFN_M03 = 'MFN^M03', // Master File - Test/Observation
  
  // Acknowledgments
  ACK = 'ACK', // General Acknowledgment
  
  // Medication Administration
  RAS_O17 = 'RAS^O17', // Pharmacy/Treatment Administration
  RDE_O11 = 'RDE^O11', // Pharmacy/Treatment Encoded Order
  RDS_O13 = 'RDS^O13', // Pharmacy/Treatment Dispense
  
  // Clinical Document Architecture
  MDM_T02 = 'MDM^T02', // Original Document Notification
  MDM_T04 = 'MDM^T04', // Document Status Change Notification
}

// HL7 v2 Acknowledgment
export interface HL7v2Acknowledgment {
  messageType: 'ACK';
  messageControlId: string;
  acknowledgmentCode: HL7v2AckCode;
  textMessage?: string;
  expectedSequenceNumber?: number;
  errorCondition?: HL7v2ErrorCondition;
  timestamp: Date;
}

// HL7 v2 Acknowledgment Codes
export enum HL7v2AckCode {
  AA = 'AA', // Application Accept
  AE = 'AE', // Application Error
  AR = 'AR', // Application Reject
  CA = 'CA', // Commit Accept
  CE = 'CE', // Commit Error
  CR = 'CR', // Commit Reject
}

// HL7 v2 Error Conditions
export interface HL7v2ErrorCondition {
  errorCode: string;
  errorLocation?: string;
  errorDescription?: string;
  diagnosticInformation?: string;
  userMessage?: string;
}

// HL7 v2 Connection Configuration
export interface HL7v2ConnectionConfig {
  host: string;
  port: number;
  protocol: 'MLLP' | 'HTTP' | 'HTTPS';
  timeout: number;
  keepAlive: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  encoding: 'ASCII' | 'UTF-8' | 'ISO-8859-1';
  mllpConfig?: {
    startBlock: string; // Default: '\x0B'
    endBlock: string; // Default: '\x1C'
    carriageReturn: string; // Default: '\x0D'
  };
  tlsConfig?: {
    enabled: boolean;
    cert?: string;
    key?: string;
    ca?: string;
    rejectUnauthorized?: boolean;
  };
}

// HL7 v2 Message Validation
export interface HL7v2ValidationConfig {
  validateStructure: boolean;
  validateDataTypes: boolean;
  validateTableValues: boolean;
  validateConformance: boolean;
  strictMode: boolean;
  version: string; // e.g., '2.5.1'
  messageProfile?: string;
}

// HL7 v2 Parsing Options
export interface HL7v2ParsingOptions {
  fieldSeparator: string; // Default: '|'
  componentSeparator: string; // Default: '^'
  repetitionSeparator: string; // Default: '~'
  escapeCharacter: string; // Default: '\\'
  subcomponentSeparator: string; // Default: '&'
  truncateExtraFields: boolean;
  allowEmptyFields: boolean;
  preserveWhitespace: boolean;
}

// HL7 v2 Routing Rules
export interface HL7v2RoutingRule {
  id: string;
  name: string;
  messageType: string;
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  condition?: string; // JavaScript expression
  destination: HL7v2Destination;
  transformation?: string; // Transformation rule ID
  priority: number;
  active: boolean;
}

// HL7 v2 Destination
export interface HL7v2Destination {
  type: 'endpoint' | 'queue' | 'database' | 'fhir' | 'file';
  config: {
    endpoint?: HL7v2ConnectionConfig;
    queueName?: string;
    databaseConfig?: any;
    fhirEndpoint?: string;
    filePath?: string;
  };
}

// HL7 v2 Message Processing Result
export interface HL7v2ProcessingResult {
  success: boolean;
  messageId: string;
  acknowledgment?: HL7v2Acknowledgment;
  transformedMessage?: any; // Could be FHIR or other format
  processingTime: number;
  warnings: string[];
  errors: HL7v2ErrorCondition[];
  routingResults?: HL7v2RoutingResult[];
}

// HL7 v2 Routing Result
export interface HL7v2RoutingResult {
  ruleId: string;
  destination: string;
  success: boolean;
  response?: any;
  error?: string;
  processingTime: number;
}

// HL7 v2 Interface Statistics
export interface HL7v2InterfaceStatistics {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  averageProcessingTime: number;
  errorRate: number;
  lastMessageTime?: Date;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  uptime: number;
}

// HL7 v2 Message Store
export interface HL7v2MessageStore {
  id: string;
  messageType: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: Date;
  rawMessage: string;
  parsedMessage?: HL7v2Message;
  processingResult?: HL7v2ProcessingResult;
  status: 'received' | 'processing' | 'processed' | 'failed' | 'acknowledged';
  retryCount: number;
  lastRetry?: Date;
  acknowledgmentSent?: boolean;
  acknowledgmentReceived?: boolean;
}

// HL7 v2 Data Types
export interface HL7v2DataTypes {
  // Patient Information
  PID: {
    setId: string; // PID.1
    patientId: string; // PID.2
    patientIdentifierList: HL7v2PatientIdentifier[]; // PID.3
    alternatePatientId?: string; // PID.4
    patientName: HL7v2PersonName[]; // PID.5
    mothersMaidenName?: HL7v2PersonName[]; // PID.6
    dateTimeOfBirth?: Date; // PID.7
    administrativeSex?: string; // PID.8
    patientAlias?: HL7v2PersonName[]; // PID.9
    race?: string[]; // PID.10
    patientAddress?: HL7v2Address[]; // PID.11
    countryCode?: string; // PID.12
    phoneNumberHome?: HL7v2PhoneNumber[]; // PID.13
    phoneNumberBusiness?: HL7v2PhoneNumber[]; // PID.14
    primaryLanguage?: string; // PID.15
    maritalStatus?: string; // PID.16
    religion?: string; // PID.17
    patientAccountNumber?: string; // PID.18
    ssnNumber?: string; // PID.19
    driversLicenseNumber?: string; // PID.20
  };
  
  // Observation Request
  OBR: {
    setId: string; // OBR.1
    placerOrderNumber?: string; // OBR.2
    fillerOrderNumber?: string; // OBR.3
    universalServiceIdentifier: HL7v2CodedElement; // OBR.4
    priority?: string; // OBR.5
    requestedDateTime?: Date; // OBR.6
    observationDateTime?: Date; // OBR.7
    observationEndDateTime?: Date; // OBR.8
    collectionVolume?: HL7v2Quantity; // OBR.9
    collectorIdentifier?: HL7v2PersonName[]; // OBR.10
    specimenActionCode?: string; // OBR.11
    dangerCode?: string; // OBR.12
    relevantClinicalInformation?: string; // OBR.13
    specimenReceivedDateTime?: Date; // OBR.14
    specimenSource?: string; // OBR.15
    orderingProvider?: HL7v2PersonName[]; // OBR.16
    orderCallbackPhoneNumber?: HL7v2PhoneNumber[]; // OBR.17
    placerField1?: string; // OBR.18
    placerField2?: string; // OBR.19
    fillerField1?: string; // OBR.20
    fillerField2?: string; // OBR.21
    resultsReportedDateTime?: Date; // OBR.22
    chargeToPractice?: string; // OBR.23
    diagnosticServiceSectionId?: string; // OBR.24
    resultStatus?: string; // OBR.25
  };
  
  // Observation Result
  OBX: {
    setId: string; // OBX.1
    valueType: string; // OBX.2
    observationIdentifier: HL7v2CodedElement; // OBX.3
    observationSubId?: string; // OBX.4
    observationValue?: any; // OBX.5
    units?: HL7v2CodedElement; // OBX.6
    referencesRange?: string; // OBX.7
    abnormalFlags?: string[]; // OBX.8
    probability?: number; // OBX.9
    natureOfAbnormalTest?: string[]; // OBX.10
    observationResultStatus: string; // OBX.11
    effectiveDate?: Date; // OBX.12
    userDefinedAccessChecks?: string; // OBX.13
    dateTimeOfObservation?: Date; // OBX.14
    producersId?: HL7v2CodedElement; // OBX.15
    responsibleObserver?: HL7v2PersonName[]; // OBX.16
    observationMethod?: HL7v2CodedElement[]; // OBX.17
    equipmentInstanceIdentifier?: HL7v2EntityIdentifier[]; // OBX.18
    dateTimeOfAnalysis?: Date; // OBX.19
  };
}

// HL7 v2 Common Data Types
export interface HL7v2PatientIdentifier {
  idNumber: string;
  checkDigit?: string;
  checkDigitScheme?: string;
  assigningAuthority?: HL7v2AssigningAuthority;
  identifierTypeCode?: string;
  assigningFacility?: HL7v2AssigningFacility;
  effectiveDate?: Date;
  expirationDate?: Date;
  assigningJurisdiction?: HL7v2CodedElement;
  assigningAgencyOrDepartment?: HL7v2CodedElement;
}

export interface HL7v2PersonName {
  familyName?: string;
  givenName?: string;
  secondAndFurtherGivenNames?: string;
  suffix?: string;
  prefix?: string;
  degree?: string;
  nameTypeCode?: string;
  nameRepresentationCode?: string;
  nameContext?: HL7v2CodedElement;
  nameValidityRange?: HL7v2DateRange;
  nameAssemblyOrder?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  professionalSuffix?: string;
}

export interface HL7v2Address {
  streetAddress?: string;
  otherDesignation?: string;
  city?: string;
  stateOrProvince?: string;
  zipOrPostalCode?: string;
  country?: string;
  addressType?: string;
  otherGeographicDesignation?: string;
  countyParishCode?: string;
  censusTract?: string;
  addressRepresentationCode?: string;
  addressValidityRange?: HL7v2DateRange;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface HL7v2PhoneNumber {
  telephoneNumber?: string;
  telecommunicationUseCode?: string;
  telecommunicationEquipmentType?: string;
  emailAddress?: string;
  countryCode?: string;
  areaCityCode?: string;
  localNumber?: string;
  extension?: string;
  anyText?: string;
  extensionPrefix?: string;
  speedDialCode?: string;
  unformattedTelephoneNumber?: string;
}

export interface HL7v2CodedElement {
  identifier?: string;
  text?: string;
  nameOfCodingSystem?: string;
  alternateIdentifier?: string;
  alternateText?: string;
  nameOfAlternateCodingSystem?: string;
  codingSystemVersionId?: string;
  alternateCodingSystemVersionId?: string;
  originalText?: string;
}

export interface HL7v2Quantity {
  quantity?: number;
  units?: HL7v2CodedElement;
}

export interface HL7v2AssigningAuthority {
  namespaceId?: string;
  universalId?: string;
  universalIdType?: string;
}

export interface HL7v2AssigningFacility {
  namespaceId?: string;
  universalId?: string;
  universalIdType?: string;
}

export interface HL7v2EntityIdentifier {
  entityIdentifier?: string;
  namespaceId?: string;
  universalId?: string;
  universalIdType?: string;
}

export interface HL7v2DateRange {
  rangeStartDateTime?: Date;
  rangeEndDateTime?: Date;
}