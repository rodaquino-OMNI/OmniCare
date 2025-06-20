export interface HL7v2Message {
    messageType: string;
    triggerEvent: string;
    messageStructure: string;
    messageControlId: string;
    sendingApplication: string;
    sendingFacility: string;
    receivingApplication: string;
    receivingFacility: string;
    timestamp: Date;
    processingId: string;
    versionId: string;
    sequenceNumber?: number;
    continuationPointer?: string;
    acceptAcknowledgmentType?: string;
    applicationAcknowledgmentType?: string;
    countryCode?: string;
    characterSet?: string;
    principalLanguage?: string;
    segments: HL7v2Segment[];
    rawMessage?: string;
}
export interface HL7v2Segment {
    segmentType: string;
    fields: HL7v2Field[];
    sequenceNumber?: number;
    setId?: string;
}
export interface HL7v2Field {
    value: string | HL7v2Component[] | HL7v2Field[];
    components?: HL7v2Component[];
    repetitions?: HL7v2Field[];
}
export interface HL7v2Component {
    value: string | HL7v2Subcomponent[];
    subcomponents?: HL7v2Subcomponent[];
}
export interface HL7v2Subcomponent {
    value: string;
}
export declare enum HL7v2MessageType {
    ADT_A01 = "ADT^A01",
    ADT_A02 = "ADT^A02",
    ADT_A03 = "ADT^A03",
    ADT_A04 = "ADT^A04",
    ADT_A05 = "ADT^A05",
    ADT_A08 = "ADT^A08",
    ADT_A11 = "ADT^A11",
    ADT_A12 = "ADT^A12",
    ADT_A13 = "ADT^A13",
    ORM_O01 = "ORM^O01",
    ORU_R01 = "ORU^R01",
    ORL_O22 = "ORL^O22",
    ORU_R30 = "ORU^R30",
    ORU_R32 = "ORU^R32",
    SIU_S12 = "SIU^S12",
    SIU_S13 = "SIU^S13",
    SIU_S14 = "SIU^S14",
    SIU_S15 = "SIU^S15",
    DFT_P03 = "DFT^P03",
    MFN_M02 = "MFN^M02",
    MFN_M03 = "MFN^M03",
    ACK = "ACK",
    RAS_O17 = "RAS^O17",
    RDE_O11 = "RDE^O11",
    RDS_O13 = "RDS^O13",
    MDM_T02 = "MDM^T02",
    MDM_T04 = "MDM^T04"
}
export interface HL7v2Acknowledgment {
    messageType: 'ACK';
    messageControlId: string;
    acknowledgmentCode: HL7v2AckCode;
    textMessage?: string;
    expectedSequenceNumber?: number;
    errorCondition?: HL7v2ErrorCondition;
    timestamp: Date;
}
export declare enum HL7v2AckCode {
    AA = "AA",
    AE = "AE",
    AR = "AR",
    CA = "CA",
    CE = "CE",
    CR = "CR"
}
export interface HL7v2ErrorCondition {
    errorCode: string;
    errorLocation?: string;
    errorDescription?: string;
    diagnosticInformation?: string;
    userMessage?: string;
}
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
        startBlock: string;
        endBlock: string;
        carriageReturn: string;
    };
    tlsConfig?: {
        enabled: boolean;
        cert?: string;
        key?: string;
        ca?: string;
        rejectUnauthorized?: boolean;
    };
}
export interface HL7v2ValidationConfig {
    validateStructure: boolean;
    validateDataTypes: boolean;
    validateTableValues: boolean;
    validateConformance: boolean;
    strictMode: boolean;
    version: string;
    messageProfile?: string;
}
export interface HL7v2ParsingOptions {
    fieldSeparator: string;
    componentSeparator: string;
    repetitionSeparator: string;
    escapeCharacter: string;
    subcomponentSeparator: string;
    truncateExtraFields: boolean;
    allowEmptyFields: boolean;
    preserveWhitespace: boolean;
}
export interface HL7v2RoutingRule {
    id: string;
    name: string;
    messageType: string;
    sendingApplication?: string;
    sendingFacility?: string;
    receivingApplication?: string;
    receivingFacility?: string;
    condition?: string;
    destination: HL7v2Destination;
    transformation?: string;
    priority: number;
    active: boolean;
}
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
export interface HL7v2ProcessingResult {
    success: boolean;
    messageId: string;
    acknowledgment?: HL7v2Acknowledgment;
    transformedMessage?: any;
    processingTime: number;
    warnings: string[];
    errors: HL7v2ErrorCondition[];
    routingResults?: HL7v2RoutingResult[];
}
export interface HL7v2RoutingResult {
    ruleId: string;
    destination: string;
    success: boolean;
    response?: any;
    error?: string;
    processingTime: number;
}
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
export interface HL7v2DataTypes {
    PID: {
        setId: string;
        patientId: string;
        patientIdentifierList: HL7v2PatientIdentifier[];
        alternatePatientId?: string;
        patientName: HL7v2PersonName[];
        mothersMaidenName?: HL7v2PersonName[];
        dateTimeOfBirth?: Date;
        administrativeSex?: string;
        patientAlias?: HL7v2PersonName[];
        race?: string[];
        patientAddress?: HL7v2Address[];
        countryCode?: string;
        phoneNumberHome?: HL7v2PhoneNumber[];
        phoneNumberBusiness?: HL7v2PhoneNumber[];
        primaryLanguage?: string;
        maritalStatus?: string;
        religion?: string;
        patientAccountNumber?: string;
        ssnNumber?: string;
        driversLicenseNumber?: string;
    };
    OBR: {
        setId: string;
        placerOrderNumber?: string;
        fillerOrderNumber?: string;
        universalServiceIdentifier: HL7v2CodedElement;
        priority?: string;
        requestedDateTime?: Date;
        observationDateTime?: Date;
        observationEndDateTime?: Date;
        collectionVolume?: HL7v2Quantity;
        collectorIdentifier?: HL7v2PersonName[];
        specimenActionCode?: string;
        dangerCode?: string;
        relevantClinicalInformation?: string;
        specimenReceivedDateTime?: Date;
        specimenSource?: string;
        orderingProvider?: HL7v2PersonName[];
        orderCallbackPhoneNumber?: HL7v2PhoneNumber[];
        placerField1?: string;
        placerField2?: string;
        fillerField1?: string;
        fillerField2?: string;
        resultsReportedDateTime?: Date;
        chargeToPractice?: string;
        diagnosticServiceSectionId?: string;
        resultStatus?: string;
    };
    OBX: {
        setId: string;
        valueType: string;
        observationIdentifier: HL7v2CodedElement;
        observationSubId?: string;
        observationValue?: any;
        units?: HL7v2CodedElement;
        referencesRange?: string;
        abnormalFlags?: string[];
        probability?: number;
        natureOfAbnormalTest?: string[];
        observationResultStatus: string;
        effectiveDate?: Date;
        userDefinedAccessChecks?: string;
        dateTimeOfObservation?: Date;
        producersId?: HL7v2CodedElement;
        responsibleObserver?: HL7v2PersonName[];
        observationMethod?: HL7v2CodedElement[];
        equipmentInstanceIdentifier?: HL7v2EntityIdentifier[];
        dateTimeOfAnalysis?: Date;
    };
}
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
//# sourceMappingURL=hl7v2.types.d.ts.map