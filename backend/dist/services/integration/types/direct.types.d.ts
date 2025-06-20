export interface DirectMessage {
    id: string;
    messageId: string;
    sender: DirectAddress;
    recipients: DirectAddress[];
    subject: string;
    body?: string;
    attachments: DirectAttachment[];
    messageType: DirectMessageType;
    priority: DirectMessagePriority;
    sensitivity: DirectMessageSensitivity;
    created: Date;
    sent?: Date;
    delivered?: Date;
    status: DirectMessageStatus;
    statusHistory: DirectMessageStatusHistory[];
    metadata: DirectMessageMetadata;
    encryption: DirectEncryptionInfo;
    signature: DirectSignatureInfo;
    acknowledgmentRequested: boolean;
    acknowledgment?: DirectAcknowledgment;
    originalMessageId?: string;
    threadId?: string;
}
export interface DirectAddress {
    address: string;
    displayName?: string;
    organization?: string;
    type: 'provider' | 'patient' | 'organization' | 'system';
    verified: boolean;
    certificate?: DirectCertificate;
    trustBundle?: string;
}
export interface DirectCertificate {
    id: string;
    subject: string;
    issuer: string;
    serialNumber: string;
    notBefore: Date;
    notAfter: Date;
    keyUsage: string[];
    extendedKeyUsage: string[];
    subjectAltName?: string[];
    certificateData: string;
    fingerprint: string;
    status: 'valid' | 'expired' | 'revoked' | 'suspended';
    trustAnchor: boolean;
    ocspUrl?: string;
    crlUrl?: string;
}
export interface DirectAttachment {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    content: Buffer | string;
    checksum: string;
    checksumAlgorithm: string;
    encrypted: boolean;
    encryptionKeyId?: string;
    signed: boolean;
    signatureKeyId?: string;
    metadata?: Record<string, any>;
}
export declare enum DirectMessageType {
    CLINICAL_SUMMARY = "clinical-summary",
    REFERRAL = "referral",
    CONSULTATION = "consultation",
    LAB_RESULT = "lab-result",
    IMAGING_RESULT = "imaging-result",
    DISCHARGE_SUMMARY = "discharge-summary",
    MEDICATION_RECONCILIATION = "medication-reconciliation",
    CARE_PLAN = "care-plan",
    APPOINTMENT_REMINDER = "appointment-reminder",
    SECURE_MESSAGE = "secure-message",
    NOTIFICATION = "notification",
    ACKNOWLEDGMENT = "acknowledgment",
    ERROR_NOTIFICATION = "error-notification"
}
export declare enum DirectMessagePriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent"
}
export declare enum DirectMessageSensitivity {
    NORMAL = "normal",
    CONFIDENTIAL = "confidential",
    RESTRICTED = "restricted",
    VERY_RESTRICTED = "very-restricted"
}
export declare enum DirectMessageStatus {
    DRAFT = "draft",
    PENDING = "pending",
    ENCRYPTING = "encrypting",
    SIGNING = "signing",
    SENDING = "sending",
    SENT = "sent",
    DELIVERED = "delivered",
    READ = "read",
    ACKNOWLEDGED = "acknowledged",
    FAILED = "failed",
    REJECTED = "rejected",
    EXPIRED = "expired"
}
export interface DirectMessageStatusHistory {
    status: DirectMessageStatus;
    timestamp: Date;
    description?: string;
    errorCode?: string;
    errorMessage?: string;
}
export interface DirectMessageMetadata {
    patientId?: string;
    encounterId?: string;
    organizationId?: string;
    providerId?: string;
    specialtyCode?: string;
    purposeOfUse: string;
    confidentialityCode: string;
    documentType?: string;
    documentId?: string;
    workflowInstanceId?: string;
    correlationId?: string;
    customHeaders?: Record<string, string>;
}
export interface DirectEncryptionInfo {
    algorithm: string;
    keySize: number;
    certificateId: string;
    encrypted: boolean;
    encryptedAt?: Date;
    symmetricKey?: string;
    iv?: string;
}
export interface DirectSignatureInfo {
    algorithm: string;
    certificateId: string;
    signed: boolean;
    signedAt?: Date;
    signature?: string;
    signatureValid?: boolean;
    signatureValidatedAt?: Date;
}
export interface DirectAcknowledgment {
    id: string;
    originalMessageId: string;
    acknowledgmentType: DirectAcknowledgmentType;
    status: 'success' | 'failure' | 'warning';
    message?: string;
    timestamp: Date;
    sender: DirectAddress;
}
export declare enum DirectAcknowledgmentType {
    DELIVERY = "delivery",
    READ = "read",
    PROCESSED = "processed",
    ERROR = "error"
}
export interface DirectTrustConfig {
    enabled: boolean;
    domain: string;
    smtpServer: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
        pool: boolean;
        maxConnections: number;
        maxMessages: number;
    };
    pop3Server?: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
        pollingInterval: number;
    };
    imapServer?: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
        pollingInterval: number;
        mailbox: string;
    };
    certificates: {
        signingCertPath: string;
        signingKeyPath: string;
        encryptionCertPath: string;
        encryptionKeyPath: string;
        trustedAnchorsPath: string;
        crlPath?: string;
        ocspUrl?: string;
    };
    security: {
        enforceEncryption: boolean;
        enforceSignature: boolean;
        validateCertificates: boolean;
        checkRevocation: boolean;
        trustAnchorValidation: boolean;
        allowedCipherSuites: string[];
        minTlsVersion: string;
    };
    policies: {
        maxMessageSize: number;
        maxAttachmentSize: number;
        allowedAttachmentTypes: string[];
        messageRetentionDays: number;
        quarantineUnencrypted: boolean;
        quarantineUnsigned: boolean;
        autoAcknowledge: boolean;
        requireDeliveryNotification: boolean;
    };
}
export interface DirectConnectionStatus {
    smtpConnected: boolean;
    pop3Connected?: boolean;
    imapConnected?: boolean;
    lastSmtpCheck: Date;
    lastPop3Check?: Date;
    lastImapCheck?: Date;
    certificatesValid: boolean;
    certificateExpiry: Date;
    trustBundleValid: boolean;
    trustBundleLastUpdate: Date;
    errors: string[];
}
export interface DirectTrustStatistics {
    messagesSent: number;
    messagesReceived: number;
    messagesDelivered: number;
    messagesFailed: number;
    messagesQuarantined: number;
    averageDeliveryTime: number;
    certificateValidationFailures: number;
    encryptionFailures: number;
    signatureValidationFailures: number;
    lastActivity: Date;
    connectionStatus: DirectConnectionStatus;
}
export interface DirectCertificateStore {
    certificates: Map<string, DirectCertificate>;
    trustAnchors: Map<string, DirectCertificate>;
    revokedCertificates: Set<string>;
    lastUpdate: Date;
    addCertificate(certificate: DirectCertificate): void;
    getCertificate(address: string): DirectCertificate | undefined;
    validateCertificate(certificate: DirectCertificate): Promise<boolean>;
    checkRevocation(certificate: DirectCertificate): Promise<boolean>;
    updateTrustBundle(bundleData: string): Promise<void>;
    cleanup(): void;
}
export interface DirectMessageProcessor {
    processInbound(rawMessage: string): Promise<DirectMessage>;
    processOutbound(message: DirectMessage): Promise<string>;
    encrypt(content: string, recipients: DirectAddress[]): Promise<string>;
    decrypt(encryptedContent: string, certificate: DirectCertificate): Promise<string>;
    sign(content: string, certificate: DirectCertificate): Promise<string>;
    verifySignature(signedContent: string, certificate: DirectCertificate): Promise<boolean>;
    validateMessage(message: DirectMessage): Promise<DirectValidationResult>;
}
export interface DirectValidationResult {
    valid: boolean;
    errors: DirectValidationError[];
    warnings: DirectValidationWarning[];
    securityLevel: 'low' | 'medium' | 'high';
    trustLevel: 'untrusted' | 'low' | 'medium' | 'high';
    validatedAt: Date;
}
export interface DirectValidationError {
    code: string;
    message: string;
    severity: 'error' | 'fatal';
    field?: string;
}
export interface DirectValidationWarning {
    code: string;
    message: string;
    severity: 'warning' | 'info';
    field?: string;
}
export interface DirectMessageRouter {
    routeInbound(message: DirectMessage): Promise<DirectRoutingResult>;
    routeOutbound(message: DirectMessage): Promise<DirectRoutingResult>;
    addRoute(rule: DirectRoutingRule): void;
    removeRoute(ruleId: string): void;
    getRoutes(): DirectRoutingRule[];
}
export interface DirectRoutingRule {
    id: string;
    name: string;
    priority: number;
    conditions: DirectRoutingCondition[];
    actions: DirectRoutingAction[];
    active: boolean;
}
export interface DirectRoutingCondition {
    field: string;
    operator: 'equals' | 'contains' | 'regex' | 'in' | 'exists';
    value: any;
}
export interface DirectRoutingAction {
    type: 'forward' | 'copy' | 'quarantine' | 'reject' | 'transform' | 'notify';
    parameters: Record<string, any>;
}
export interface DirectRoutingResult {
    success: boolean;
    actionsExecuted: string[];
    errors: string[];
    warnings: string[];
    destination?: string;
    transformedMessage?: DirectMessage;
}
export interface DirectAuditEvent {
    id: string;
    eventType: DirectAuditEventType;
    messageId?: string;
    sender?: string;
    recipient?: string;
    outcome: 'success' | 'failure' | 'warning';
    description: string;
    details?: Record<string, any>;
    timestamp: Date;
    sourceIp?: string;
    userAgent?: string;
}
export declare enum DirectAuditEventType {
    MESSAGE_SENT = "message-sent",
    MESSAGE_RECEIVED = "message-received",
    MESSAGE_DELIVERED = "message-delivered",
    MESSAGE_FAILED = "message-failed",
    MESSAGE_QUARANTINED = "message-quarantined",
    CERTIFICATE_VALIDATED = "certificate-validated",
    CERTIFICATE_FAILED = "certificate-failed",
    ENCRYPTION_PERFORMED = "encryption-performed",
    DECRYPTION_PERFORMED = "decryption-performed",
    SIGNATURE_CREATED = "signature-created",
    SIGNATURE_VERIFIED = "signature-verified",
    TRUST_BUNDLE_UPDATED = "trust-bundle-updated",
    CONNECTION_ESTABLISHED = "connection-established",
    CONNECTION_FAILED = "connection-failed"
}
export interface DirectHealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    smtpConnection: boolean;
    certificateValid: boolean;
    trustBundleValid: boolean;
    messageProcessing: boolean;
    details: Record<string, any>;
    errors: string[];
}
//# sourceMappingURL=direct.types.d.ts.map