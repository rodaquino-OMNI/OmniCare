import { Patient, Practitioner, Organization, Location, Encounter, Observation, Medication, MedicationRequest, ServiceRequest, DiagnosticReport, CarePlan, Communication, Task, DocumentReference, Bundle, Subscription, OperationOutcome, Parameters, Condition, Procedure, AllergyIntolerance, Immunization, Device, Specimen } from '@medplum/fhirtypes';
export { Patient, Practitioner, Organization, Location, Encounter, Observation, Medication, MedicationRequest, ServiceRequest, DiagnosticReport, CarePlan, Communication, Task, DocumentReference, Bundle, Subscription, OperationOutcome, Parameters, Condition, Procedure, AllergyIntolerance, Immunization, Device, Specimen, };
export interface OmniCarePatient extends Patient {
    omnicarePatientId?: string;
    registrationDate?: string;
    preferredLanguage?: string;
    emergencyContact?: {
        name: string;
        relationship: string;
        phone: string;
        email?: string;
    };
    insuranceInformation?: {
        primary?: {
            payer: string;
            memberId: string;
            groupNumber?: string;
        };
        secondary?: {
            payer: string;
            memberId: string;
            groupNumber?: string;
        };
    };
}
export interface OmniCareEncounter extends Encounter {
    omnicareEncounterId?: string;
    appointmentType?: string;
    chiefComplaint?: string;
    visitSummary?: string;
    followUpInstructions?: string;
    billingNotes?: string;
}
export interface OmniCareObservation extends Observation {
    omnicareObservationId?: string;
    deviceUsed?: string;
    qualityFlags?: string[];
    abnormalFlags?: string[];
    criticalAlerts?: boolean;
}
export interface FHIRSearchParams {
    _id?: string;
    _lastUpdated?: string;
    _tag?: string;
    _profile?: string;
    _security?: string;
    _text?: string;
    _content?: string;
    _list?: string;
    _has?: string;
    _type?: string;
    _count?: number;
    _sort?: string;
    _elements?: string;
    _summary?: string;
    _total?: string;
    _include?: string;
    _revinclude?: string;
    [key: string]: any;
}
export interface BundleRequest {
    resourceType: string;
    resources: any[];
    type: 'transaction' | 'batch' | 'collection' | 'searchset' | 'history';
    timestamp?: string;
}
export interface SubscriptionConfig {
    criteria: string;
    channel: {
        type: 'rest-hook' | 'websocket' | 'email' | 'sms';
        endpoint?: string;
        payload?: string;
        header?: string[];
    };
    reason: string;
    status: 'requested' | 'active' | 'error' | 'off';
}
export interface CDSHookContext {
    patientId?: string;
    encounterId?: string;
    userId?: string;
    draftOrders?: any[];
    selections?: string[];
    [key: string]: any;
}
export interface CDSCard {
    uuid?: string;
    summary: string;
    detail?: string;
    indicator: 'info' | 'warning' | 'critical';
    source: {
        label: string;
        url?: string;
        icon?: string;
    };
    suggestions?: CDSSuggestion[];
    selectionBehavior?: 'at-most-one' | 'any';
    overrideReasons?: CDSOverrideReason[];
    links?: CDSLink[];
}
export interface CDSSuggestion {
    label: string;
    uuid?: string;
    isRecommended?: boolean;
    actions?: CDSAction[];
}
export interface CDSAction {
    type: 'create' | 'update' | 'delete';
    description?: string;
    resource?: any;
    resourceId?: string;
}
export interface CDSOverrideReason {
    code: string;
    display: string;
    system?: string;
}
export interface CDSLink {
    label: string;
    url: string;
    type: 'absolute' | 'smart';
    appContext?: string;
}
export interface CDSHookRequest {
    hookInstance: string;
    fhirServer: string;
    hook: string;
    context: CDSHookContext;
    prefetch?: {
        [key: string]: any;
    };
    fhirAuthorization?: {
        access_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
        subject: string;
    };
}
export interface CDSHookResponse {
    cards: CDSCard[];
    systemActions?: CDSAction[];
}
export interface SMARTTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
    refresh_token?: string;
    patient?: string;
    encounter?: string;
    need_patient_banner?: boolean;
    smart_style_url?: string;
    fhirUser?: string;
    aud?: string;
}
export interface SMARTLaunchContext {
    iss: string;
    launch: string;
    aud: string;
    redirect_uri: string;
    response_type: 'code';
    state: string;
    scope: string;
}
export interface HL7v2Message {
    messageType: string;
    messageControlId: string;
    sendingApplication: string;
    sendingFacility: string;
    receivingApplication: string;
    receivingFacility: string;
    timestamp: string;
    messageStructure: string;
    segments: HL7v2Segment[];
}
export interface HL7v2Segment {
    segmentType: string;
    fields: string[];
}
export interface AuditEvent {
    resourceType: 'AuditEvent';
    type: {
        system: string;
        code: string;
        display: string;
    };
    subtype?: {
        system: string;
        code: string;
        display: string;
    }[];
    action: 'C' | 'R' | 'U' | 'D' | 'E';
    recorded: string;
    outcome: '0' | '4' | '8' | '12';
    agent: AuditAgent[];
    source: AuditSource;
    entity?: AuditEntity[];
}
export interface AuditAgent {
    type?: {
        system: string;
        code: string;
        display: string;
    };
    who?: {
        reference: string;
        display?: string;
    };
    requestor: boolean;
    location?: {
        reference: string;
    };
    policy?: string[];
    media?: {
        system: string;
        code: string;
        display: string;
    };
    network?: {
        address: string;
        type: '1' | '2' | '3' | '4' | '5';
    };
}
export interface AuditSource {
    site?: string;
    observer: {
        reference: string;
        display?: string;
    };
    type?: {
        system: string;
        code: string;
        display: string;
    }[];
}
export interface AuditEntity {
    what?: {
        reference: string;
        display?: string;
    };
    type?: {
        system: string;
        code: string;
        display: string;
    };
    role?: {
        system: string;
        code: string;
        display: string;
    };
    lifecycle?: {
        system: string;
        code: string;
        display: string;
    };
    securityLabel?: {
        system: string;
        code: string;
        display: string;
    }[];
    name?: string;
    description?: string;
    query?: string;
    detail?: {
        type: string;
        valueString?: string;
        valueBase64Binary?: string;
    }[];
}
export interface FHIRError {
    resourceType: 'OperationOutcome';
    issue: {
        severity: 'fatal' | 'error' | 'warning' | 'information';
        code: string;
        details?: {
            coding?: {
                system?: string;
                code?: string;
                display?: string;
            }[];
            text?: string;
        };
        diagnostics?: string;
        location?: string[];
        expression?: string[];
    }[];
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    path: string;
    message: string;
    code: string;
    severity: 'error' | 'fatal';
}
export interface ValidationWarning {
    path: string;
    message: string;
    code: string;
    severity: 'warning' | 'information';
}
export interface PerformanceMetrics {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    activeConnections: number;
    memoryUsage: {
        used: number;
        total: number;
        percentage: number;
    };
    cpuUsage: number;
}
export interface CacheConfig {
    ttl: number;
    maxSize: number;
    strategy: 'LRU' | 'LFU' | 'FIFO';
}
export interface CachedResource {
    resource: any;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
}
//# sourceMappingURL=fhir.d.ts.map