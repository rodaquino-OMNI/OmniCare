"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.directTrustService = exports.DirectTrustService = void 0;
const nodemailer_1 = require("nodemailer");
const crypto_1 = require("crypto");
const crypto_2 = require("crypto");
const fs_1 = require("fs");
const direct_types_1 = require("../types/direct.types");
const logger_1 = __importDefault(require("@/utils/logger"));
class DirectTrustService {
    smtpTransporter;
    directConfig;
    connectionStatus;
    statistics;
    messageQueue = new Map();
    processingMessages = new Set();
    certificates = new Map();
    trustAnchors = new Map();
    constructor() {
        this.directConfig = this.loadConfiguration();
        this.connectionStatus = this.initializeConnectionStatus();
        this.statistics = this.initializeStatistics();
        this.initialize();
    }
    async initialize() {
        try {
            if (!this.directConfig.enabled) {
                logger_1.default.info('Direct Trust service is disabled');
                return;
            }
            await this.loadCertificates();
            await this.setupSMTPTransporter();
            await this.validateTrustBundle();
            logger_1.default.info('Direct Trust service initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize Direct Trust service:', error);
            throw error;
        }
    }
    loadConfiguration() {
        return {
            enabled: process.env.DIRECT_TRUST_ENABLED === 'true',
            domain: process.env.DIRECT_TRUST_DOMAIN || 'omnicare.direct',
            smtpServer: {
                host: process.env.DIRECT_SMTP_HOST || 'localhost',
                port: parseInt(process.env.DIRECT_SMTP_PORT || '587', 10),
                secure: process.env.DIRECT_SMTP_SECURE === 'true',
                username: process.env.DIRECT_SMTP_USERNAME || '',
                password: process.env.DIRECT_SMTP_PASSWORD || '',
                pool: true,
                maxConnections: 5,
                maxMessages: 100
            },
            certificates: {
                signingCertPath: process.env.DIRECT_SIGNING_CERT_PATH || './certs/direct-signing.pem',
                signingKeyPath: process.env.DIRECT_SIGNING_KEY_PATH || './certs/direct-signing-key.pem',
                encryptionCertPath: process.env.DIRECT_ENCRYPTION_CERT_PATH || './certs/direct-encryption.pem',
                encryptionKeyPath: process.env.DIRECT_ENCRYPTION_KEY_PATH || './certs/direct-encryption-key.pem',
                trustedAnchorsPath: process.env.DIRECT_TRUST_ANCHORS_PATH || './certs/trust-anchors.pem',
                crlPath: process.env.DIRECT_CRL_PATH,
                ocspUrl: process.env.DIRECT_OCSP_URL
            },
            security: {
                enforceEncryption: process.env.DIRECT_ENFORCE_ENCRYPTION !== 'false',
                enforceSignature: process.env.DIRECT_ENFORCE_SIGNATURE !== 'false',
                validateCertificates: process.env.DIRECT_VALIDATE_CERTIFICATES !== 'false',
                checkRevocation: process.env.DIRECT_CHECK_REVOCATION === 'true',
                trustAnchorValidation: process.env.DIRECT_TRUST_ANCHOR_VALIDATION !== 'false',
                allowedCipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'],
                minTlsVersion: '1.2'
            },
            policies: {
                maxMessageSize: parseInt(process.env.DIRECT_MAX_MESSAGE_SIZE || '25000000', 10),
                maxAttachmentSize: parseInt(process.env.DIRECT_MAX_ATTACHMENT_SIZE || '10000000', 10),
                allowedAttachmentTypes: [
                    'application/pdf', 'text/xml', 'application/xml', 'text/plain',
                    'image/jpeg', 'image/png', 'image/tiff', 'application/dicom'
                ],
                messageRetentionDays: parseInt(process.env.DIRECT_MESSAGE_RETENTION_DAYS || '2555', 10),
                quarantineUnencrypted: process.env.DIRECT_QUARANTINE_UNENCRYPTED === 'true',
                quarantineUnsigned: process.env.DIRECT_QUARANTINE_UNSIGNED === 'true',
                autoAcknowledge: process.env.DIRECT_AUTO_ACKNOWLEDGE === 'true',
                requireDeliveryNotification: process.env.DIRECT_REQUIRE_DELIVERY_NOTIFICATION === 'true'
            }
        };
    }
    async setupSMTPTransporter() {
        try {
            this.smtpTransporter = (0, nodemailer_1.createTransport)({
                host: this.directConfig.smtpServer.host,
                port: this.directConfig.smtpServer.port,
                secure: this.directConfig.smtpServer.secure,
                auth: {
                    user: this.directConfig.smtpServer.username,
                    pass: this.directConfig.smtpServer.password
                },
                pool: this.directConfig.smtpServer.pool,
                maxConnections: this.directConfig.smtpServer.maxConnections,
                maxMessages: this.directConfig.smtpServer.maxMessages,
                tls: {
                    minVersion: this.directConfig.security.minTlsVersion,
                    ciphers: this.directConfig.security.allowedCipherSuites.join(':')
                }
            });
            await this.smtpTransporter.verify();
            this.connectionStatus.smtpConnected = true;
            this.connectionStatus.lastSmtpCheck = new Date();
            logger_1.default.info('SMTP transporter configured successfully');
        }
        catch (error) {
            this.connectionStatus.smtpConnected = false;
            this.connectionStatus.errors.push(`SMTP connection failed: ${error}`);
            logger_1.default.error('Failed to setup SMTP transporter:', error);
            throw error;
        }
    }
    async loadCertificates() {
        try {
            const signingCertData = (0, fs_1.readFileSync)(this.directConfig.certificates.signingCertPath, 'utf8');
            const signingCert = new crypto_2.X509Certificate(signingCertData);
            const encryptionCertData = (0, fs_1.readFileSync)(this.directConfig.certificates.encryptionCertPath, 'utf8');
            const encryptionCert = new crypto_2.X509Certificate(encryptionCertData);
            this.certificates.set('signing', this.convertX509ToDirectCertificate(signingCert, signingCertData));
            this.certificates.set('encryption', this.convertX509ToDirectCertificate(encryptionCert, encryptionCertData));
            await this.loadTrustAnchors();
            await this.validateCertificates();
            logger_1.default.info('Certificates loaded successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to load certificates:', error);
            throw error;
        }
    }
    async loadTrustAnchors() {
        try {
            const trustAnchorsData = (0, fs_1.readFileSync)(this.directConfig.certificates.trustedAnchorsPath, 'utf8');
            const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
            const certMatches = trustAnchorsData.match(certRegex);
            if (certMatches) {
                for (const certData of certMatches) {
                    const cert = new crypto_2.X509Certificate(certData);
                    const directCert = this.convertX509ToDirectCertificate(cert, certData);
                    directCert.trustAnchor = true;
                    this.trustAnchors.set(cert.subject, directCert);
                }
            }
            logger_1.default.info(`Loaded ${this.trustAnchors.size} trust anchors`);
        }
        catch (error) {
            logger_1.default.warn('Failed to load trust anchors:', error);
        }
    }
    convertX509ToDirectCertificate(cert, certData) {
        return {
            id: cert.serialNumber,
            subject: cert.subject,
            issuer: cert.issuer,
            serialNumber: cert.serialNumber,
            notBefore: new Date(cert.validFrom),
            notAfter: new Date(cert.validTo),
            keyUsage: cert.keyUsage || [],
            extendedKeyUsage: [],
            subjectAltName: cert.subjectAltName ? cert.subjectAltName.split(', ') : undefined,
            certificateData: certData,
            fingerprint: cert.fingerprint,
            status: new Date() > new Date(cert.validTo) ? 'expired' : 'valid',
            trustAnchor: false,
            ocspUrl: this.directConfig.certificates.ocspUrl,
            crlUrl: this.directConfig.certificates.crlPath
        };
    }
    async validateCertificates() {
        try {
            const signingCert = this.certificates.get('signing');
            const encryptionCert = this.certificates.get('encryption');
            if (!signingCert || !encryptionCert) {
                throw new Error('Required certificates not loaded');
            }
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
            if (signingCert.notAfter < now || encryptionCert.notAfter < now) {
                this.connectionStatus.certificatesValid = false;
                this.connectionStatus.errors.push('One or more certificates have expired');
            }
            else if (signingCert.notAfter < thirtyDaysFromNow || encryptionCert.notAfter < thirtyDaysFromNow) {
                logger_1.default.warn('One or more certificates will expire within 30 days');
            }
            this.connectionStatus.certificatesValid = true;
            this.connectionStatus.certificateExpiry = new Date(Math.min(signingCert.notAfter.getTime(), encryptionCert.notAfter.getTime()));
            logger_1.default.info('Certificate validation completed');
        }
        catch (error) {
            this.connectionStatus.certificatesValid = false;
            this.connectionStatus.errors.push(`Certificate validation failed: ${error}`);
            logger_1.default.error('Certificate validation failed:', error);
        }
    }
    async validateTrustBundle() {
        try {
            const trustAnchorCount = this.trustAnchors.size;
            if (trustAnchorCount === 0) {
                this.connectionStatus.trustBundleValid = false;
                this.connectionStatus.errors.push('No trust anchors loaded');
                return;
            }
            const now = new Date();
            let validCount = 0;
            for (const [_, anchor] of this.trustAnchors) {
                if (anchor.notAfter > now) {
                    validCount++;
                }
            }
            if (validCount === 0) {
                this.connectionStatus.trustBundleValid = false;
                this.connectionStatus.errors.push('All trust anchors have expired');
            }
            else {
                this.connectionStatus.trustBundleValid = true;
                this.connectionStatus.trustBundleLastUpdate = new Date();
            }
            logger_1.default.info(`Trust bundle validation completed: ${validCount}/${trustAnchorCount} valid anchors`);
        }
        catch (error) {
            this.connectionStatus.trustBundleValid = false;
            this.connectionStatus.errors.push(`Trust bundle validation failed: ${error}`);
            logger_1.default.error('Trust bundle validation failed:', error);
        }
    }
    async sendMessage(message) {
        try {
            if (!this.directConfig.enabled) {
                throw new Error('Direct Trust service is disabled');
            }
            if (!this.smtpTransporter) {
                throw new Error('SMTP transporter not configured');
            }
            const validationResult = await this.validateMessage(message);
            if (!validationResult.valid) {
                throw new Error(`Message validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
            }
            message.status = direct_types_1.DirectMessageStatus.ENCRYPTING;
            this.updateMessageStatus(message);
            const processedContent = await this.processOutboundMessage(message);
            message.status = direct_types_1.DirectMessageStatus.SENDING;
            this.updateMessageStatus(message);
            const mailOptions = {
                from: message.sender.address,
                to: message.recipients.map(r => r.address),
                subject: message.subject,
                text: processedContent.body,
                attachments: processedContent.attachments
            };
            const info = await this.smtpTransporter.sendMail(mailOptions);
            message.status = direct_types_1.DirectMessageStatus.SENT;
            message.sent = new Date();
            this.updateMessageStatus(message);
            this.statistics.messagesSent++;
            this.statistics.lastActivity = new Date();
            await this.logAuditEvent({
                id: this.generateId(),
                eventType: direct_types_1.DirectAuditEventType.MESSAGE_SENT,
                messageId: message.id,
                sender: message.sender.address,
                recipient: message.recipients.map(r => r.address).join(', '),
                outcome: 'success',
                description: 'Direct Trust message sent successfully',
                details: { messageId: info.messageId, response: info.response },
                timestamp: new Date()
            });
            logger_1.default.info('Direct Trust message sent successfully', {
                messageId: message.id,
                recipients: message.recipients.length,
                messageControlId: info.messageId
            });
            return {
                success: true,
                data: message,
                metadata: {
                    requestId: this.generateId(),
                    source: 'DirectTrustService',
                    destination: message.recipients.map(r => r.address).join(', '),
                    messageType: 'direct-trust-message',
                    version: '1.0',
                    timestamp: new Date(),
                    processingTime: Date.now() - message.created.getTime()
                }
            };
        }
        catch (error) {
            message.status = direct_types_1.DirectMessageStatus.FAILED;
            this.updateMessageStatus(message, error);
            this.statistics.messagesFailed++;
            await this.logAuditEvent({
                id: this.generateId(),
                eventType: direct_types_1.DirectAuditEventType.MESSAGE_FAILED,
                messageId: message.id,
                sender: message.sender.address,
                outcome: 'failure',
                description: 'Direct Trust message send failed',
                details: { error: error instanceof Error ? error.message : String(error) },
                timestamp: new Date()
            });
            logger_1.default.error('Failed to send Direct Trust message:', error);
            return {
                success: false,
                error: {
                    code: 'DIRECT_SEND_FAILED',
                    message: `Failed to send Direct Trust message: ${error instanceof Error ? error.message : String(error)}`,
                    severity: 'error',
                    source: 'DirectTrustService',
                    timestamp: new Date()
                },
                metadata: {
                    requestId: this.generateId(),
                    source: 'DirectTrustService',
                    destination: message.recipients.map(r => r.address).join(', '),
                    messageType: 'direct-trust-message',
                    version: '1.0',
                    timestamp: new Date()
                }
            };
        }
    }
    async processOutboundMessage(message) {
        try {
            let processedBody = message.body || '';
            const processedAttachments = [];
            for (const attachment of message.attachments) {
                const processedAttachment = {
                    filename: attachment.filename,
                    content: attachment.content,
                    contentType: attachment.contentType,
                    encoding: 'base64'
                };
                if (this.directConfig.security.enforceEncryption && !attachment.encrypted) {
                    processedAttachment.content = await this.encryptContent(attachment.content.toString(), message.recipients);
                }
                processedAttachments.push(processedAttachment);
            }
            if (this.directConfig.security.enforceEncryption) {
                processedBody = await this.encryptContent(processedBody, message.recipients);
                message.encryption = {
                    algorithm: 'AES-256-GCM',
                    keySize: 256,
                    certificateId: 'encryption',
                    encrypted: true,
                    encryptedAt: new Date()
                };
            }
            if (this.directConfig.security.enforceSignature) {
                const signature = await this.signContent(processedBody);
                message.signature = {
                    algorithm: 'SHA256withRSA',
                    certificateId: 'signing',
                    signed: true,
                    signedAt: new Date(),
                    signature
                };
            }
            return {
                body: processedBody,
                attachments: processedAttachments
            };
        }
        catch (error) {
            logger_1.default.error('Failed to process outbound message:', error);
            throw error;
        }
    }
    async encryptContent(content, recipients) {
        try {
            const key = (0, crypto_1.randomBytes)(32);
            const iv = (0, crypto_1.randomBytes)(16);
            const cipher = require('crypto').createCipher('aes-256-gcm', key);
            cipher.setAAD(Buffer.from('DirectTrust', 'utf8'));
            let encrypted = cipher.update(content, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const tag = cipher.getAuthTag();
            const encryptedKey = key.toString('base64');
            return JSON.stringify({
                encrypted,
                key: encryptedKey,
                iv: iv.toString('base64'),
                tag: tag.toString('base64'),
                algorithm: 'aes-256-gcm'
            });
        }
        catch (error) {
            logger_1.default.error('Content encryption failed:', error);
            throw error;
        }
    }
    async signContent(content) {
        try {
            const signingCert = this.certificates.get('signing');
            if (!signingCert) {
                throw new Error('Signing certificate not available');
            }
            const signingKey = (0, fs_1.readFileSync)(this.directConfig.certificates.signingKeyPath, 'utf8');
            const sign = (0, crypto_1.createSign)('SHA256');
            sign.update(content);
            sign.end();
            const signature = sign.sign(signingKey, 'base64');
            return signature;
        }
        catch (error) {
            logger_1.default.error('Content signing failed:', error);
            throw error;
        }
    }
    async validateMessage(message) {
        const errors = [];
        const warnings = [];
        try {
            if (!message.sender.address || !this.isValidDirectAddress(message.sender.address)) {
                errors.push({
                    code: 'INVALID_SENDER',
                    message: 'Invalid sender address',
                    severity: 'error',
                    field: 'sender.address'
                });
            }
            if (!message.recipients || message.recipients.length === 0) {
                errors.push({
                    code: 'NO_RECIPIENTS',
                    message: 'Message must have at least one recipient',
                    severity: 'error',
                    field: 'recipients'
                });
            }
            else {
                for (const recipient of message.recipients) {
                    if (!this.isValidDirectAddress(recipient.address)) {
                        errors.push({
                            code: 'INVALID_RECIPIENT',
                            message: `Invalid recipient address: ${recipient.address}`,
                            severity: 'error',
                            field: 'recipients'
                        });
                    }
                }
            }
            if (!message.subject || message.subject.trim().length === 0) {
                warnings.push({
                    code: 'EMPTY_SUBJECT',
                    message: 'Message subject is empty',
                    severity: 'warning',
                    field: 'subject'
                });
            }
            const messageSize = this.calculateMessageSize(message);
            if (messageSize > this.directConfig.policies.maxMessageSize) {
                errors.push({
                    code: 'MESSAGE_TOO_LARGE',
                    message: `Message size (${messageSize}) exceeds maximum allowed size (${this.directConfig.policies.maxMessageSize})`,
                    severity: 'error',
                    field: 'message'
                });
            }
            for (const attachment of message.attachments) {
                if (attachment.size > this.directConfig.policies.maxAttachmentSize) {
                    errors.push({
                        code: 'ATTACHMENT_TOO_LARGE',
                        message: `Attachment ${attachment.filename} is too large`,
                        severity: 'error',
                        field: 'attachments'
                    });
                }
                if (!this.directConfig.policies.allowedAttachmentTypes.includes(attachment.contentType)) {
                    warnings.push({
                        code: 'UNSUPPORTED_ATTACHMENT_TYPE',
                        message: `Attachment type ${attachment.contentType} may not be supported`,
                        severity: 'warning',
                        field: 'attachments'
                    });
                }
            }
            return {
                valid: errors.length === 0,
                errors,
                warnings,
                securityLevel: this.calculateSecurityLevel(message),
                trustLevel: await this.calculateTrustLevel(message),
                validatedAt: new Date()
            };
        }
        catch (error) {
            logger_1.default.error('Message validation failed:', error);
            return {
                valid: false,
                errors: [{
                        code: 'VALIDATION_ERROR',
                        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error'
                    }],
                warnings: [],
                securityLevel: 'low',
                trustLevel: 'untrusted',
                validatedAt: new Date()
            };
        }
    }
    isValidDirectAddress(address) {
        const directAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(direct|Direct)$/;
        return directAddressRegex.test(address);
    }
    calculateMessageSize(message) {
        let size = 0;
        if (message.body) {
            size += Buffer.byteLength(message.body, 'utf8');
        }
        for (const attachment of message.attachments) {
            size += attachment.size;
        }
        return size;
    }
    calculateSecurityLevel(message) {
        let score = 0;
        if (message.encryption?.encrypted)
            score += 3;
        if (message.signature?.signed)
            score += 2;
        if (message.attachments.every(a => a.encrypted))
            score += 1;
        if (score >= 5)
            return 'high';
        if (score >= 3)
            return 'medium';
        return 'low';
    }
    async calculateTrustLevel(message) {
        return 'medium';
    }
    updateMessageStatus(message, error) {
        message.statusHistory.push({
            status: message.status,
            timestamp: new Date(),
            description: error ? `Error: ${error instanceof Error ? error.message : String(error)}` : undefined,
            errorCode: error ? 'PROCESSING_ERROR' : undefined,
            errorMessage: error ? error instanceof Error ? error.message : String(error) : undefined
        });
    }
    async logAuditEvent(event) {
        try {
            logger_1.default.audit('Direct Trust audit event', event);
        }
        catch (error) {
            logger_1.default.error('Failed to log audit event:', error);
        }
    }
    generateId() {
        return (0, crypto_1.randomBytes)(16).toString('hex');
    }
    initializeConnectionStatus() {
        return {
            smtpConnected: false,
            lastSmtpCheck: new Date(),
            certificatesValid: false,
            certificateExpiry: new Date(),
            trustBundleValid: false,
            trustBundleLastUpdate: new Date(),
            errors: []
        };
    }
    initializeStatistics() {
        return {
            messagesSent: 0,
            messagesReceived: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            messagesQuarantined: 0,
            averageDeliveryTime: 0,
            certificateValidationFailures: 0,
            encryptionFailures: 0,
            signatureValidationFailures: 0,
            lastActivity: new Date(),
            connectionStatus: this.connectionStatus
        };
    }
    getStatistics() {
        return { ...this.statistics };
    }
    async getHealth() {
        try {
            const now = new Date();
            const isHealthy = this.connectionStatus.smtpConnected &&
                this.connectionStatus.certificatesValid &&
                this.connectionStatus.trustBundleValid;
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                lastCheck: now,
                smtpConnection: this.connectionStatus.smtpConnected,
                certificateValid: this.connectionStatus.certificatesValid,
                trustBundleValid: this.connectionStatus.trustBundleValid,
                messageProcessing: this.processingMessages.size === 0,
                details: {
                    messagesSent: this.statistics.messagesSent,
                    messagesReceived: this.statistics.messagesReceived,
                    messagesFailed: this.statistics.messagesFailed,
                    certificateExpiry: this.connectionStatus.certificateExpiry,
                    trustBundleLastUpdate: this.connectionStatus.trustBundleLastUpdate
                },
                errors: this.connectionStatus.errors
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                lastCheck: new Date(),
                smtpConnection: false,
                certificateValid: false,
                trustBundleValid: false,
                messageProcessing: false,
                details: {},
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
}
exports.DirectTrustService = DirectTrustService;
exports.directTrustService = new DirectTrustService();
//# sourceMappingURL=direct-trust.service.js.map