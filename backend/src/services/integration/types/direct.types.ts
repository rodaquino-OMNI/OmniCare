/**
 * Direct Trust Integration Types
 * Types and interfaces for Direct Trust secure messaging
 */

// Direct Trust Message
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

// Direct Trust Address
export interface DirectAddress {
  address: string; // user@domain.direct
  displayName?: string;
  organization?: string;
  type: 'provider' | 'patient' | 'organization' | 'system';
  verified: boolean;
  certificate?: DirectCertificate;
  trustBundle?: string;
}

// Direct Trust Certificate
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
  certificateData: string; // PEM format
  fingerprint: string;
  status: 'valid' | 'expired' | 'revoked' | 'suspended';
  trustAnchor: boolean;
  ocspUrl?: string;
  crlUrl?: string;
}

// Direct Trust Attachment
export interface DirectAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  content: Buffer | string; // Base64 encoded
  checksum: string;
  checksumAlgorithm: string;
  encrypted: boolean;
  encryptionKeyId?: string;
  signed: boolean;
  signatureKeyId?: string;
  metadata?: Record<string, any>;
}

// Direct Message Types
export enum DirectMessageType {
  CLINICAL_SUMMARY = 'clinical-summary',
  REFERRAL = 'referral',
  CONSULTATION = 'consultation',
  LAB_RESULT = 'lab-result',
  IMAGING_RESULT = 'imaging-result',
  DISCHARGE_SUMMARY = 'discharge-summary',
  MEDICATION_RECONCILIATION = 'medication-reconciliation',
  CARE_PLAN = 'care-plan',
  APPOINTMENT_REMINDER = 'appointment-reminder',
  SECURE_MESSAGE = 'secure-message',
  NOTIFICATION = 'notification',
  ACKNOWLEDGMENT = 'acknowledgment',
  ERROR_NOTIFICATION = 'error-notification'
}

// Direct Message Priority
export enum DirectMessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Direct Message Sensitivity
export enum DirectMessageSensitivity {
  NORMAL = 'normal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  VERY_RESTRICTED = 'very-restricted'
}

// Direct Message Status
export enum DirectMessageStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ENCRYPTING = 'encrypting',
  SIGNING = 'signing',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

// Direct Message Status History
export interface DirectMessageStatusHistory {
  status: DirectMessageStatus;
  timestamp: Date;
  description?: string;
  errorCode?: string;
  errorMessage?: string;
}

// Direct Message Metadata
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

// Direct Encryption Info
export interface DirectEncryptionInfo {
  algorithm: string;
  keySize: number;
  certificateId: string;
  encrypted: boolean;
  encryptedAt?: Date;
  symmetricKey?: string; // Encrypted symmetric key
  iv?: string; // Initialization vector
}

// Direct Signature Info
export interface DirectSignatureInfo {
  algorithm: string;
  certificateId: string;
  signed: boolean;
  signedAt?: Date;
  signature?: string;
  signatureValid?: boolean;
  signatureValidatedAt?: Date;
}

// Direct Acknowledgment
export interface DirectAcknowledgment {
  id: string;
  originalMessageId: string;
  acknowledgmentType: DirectAcknowledgmentType;
  status: 'success' | 'failure' | 'warning';
  message?: string;
  timestamp: Date;
  sender: DirectAddress;
}

// Direct Acknowledgment Types
export enum DirectAcknowledgmentType {
  DELIVERY = 'delivery',
  READ = 'read',
  PROCESSED = 'processed',
  ERROR = 'error'
}

// Direct Trust Configuration
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

// Direct Trust Connection Status
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

// Direct Trust Statistics
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

// Direct Trust Certificate Store
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

// Direct Trust Message Processor
export interface DirectMessageProcessor {
  processInbound(rawMessage: string): Promise<DirectMessage>;
  processOutbound(message: DirectMessage): Promise<string>;
  encrypt(content: string, recipients: DirectAddress[]): Promise<string>;
  decrypt(encryptedContent: string, certificate: DirectCertificate): Promise<string>;
  sign(content: string, certificate: DirectCertificate): Promise<string>;
  verifySignature(signedContent: string, certificate: DirectCertificate): Promise<boolean>;
  validateMessage(message: DirectMessage): Promise<DirectValidationResult>;
}

// Direct Trust Validation Result
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

// Direct Trust Message Router
export interface DirectMessageRouter {
  routeInbound(message: DirectMessage): Promise<DirectRoutingResult>;
  routeOutbound(message: DirectMessage): Promise<DirectRoutingResult>;
  addRoute(rule: DirectRoutingRule): void;
  removeRoute(ruleId: string): void;
  getRoutes(): DirectRoutingRule[];
}

// Direct Routing Rule
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

// Direct Trust Audit Event
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

export enum DirectAuditEventType {
  MESSAGE_SENT = 'message-sent',
  MESSAGE_RECEIVED = 'message-received',
  MESSAGE_DELIVERED = 'message-delivered',
  MESSAGE_FAILED = 'message-failed',
  MESSAGE_QUARANTINED = 'message-quarantined',
  CERTIFICATE_VALIDATED = 'certificate-validated',
  CERTIFICATE_FAILED = 'certificate-failed',
  ENCRYPTION_PERFORMED = 'encryption-performed',
  DECRYPTION_PERFORMED = 'decryption-performed',
  SIGNATURE_CREATED = 'signature-created',
  SIGNATURE_VERIFIED = 'signature-verified',
  TRUST_BUNDLE_UPDATED = 'trust-bundle-updated',
  CONNECTION_ESTABLISHED = 'connection-established',
  CONNECTION_FAILED = 'connection-failed'
}

// Direct Trust Health Check
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