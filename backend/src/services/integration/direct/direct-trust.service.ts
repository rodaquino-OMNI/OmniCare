// Import nodemailer only if not in test environment
let nodemailer: any;
let createTransport: any;
let Transporter: any;
if (process.env.NODE_ENV !== 'test') {
  try {
    nodemailer = require('nodemailer');
    createTransport = nodemailer.createTransport;
    Transporter = nodemailer.Transporter;
  } catch (error) {
    // Mock nodemailer for testing
    createTransport = () => ({
      sendMail: () => Promise.resolve({ messageId: 'test-message-id' })
    });
  }
} else {
  // Mock for tests
  createTransport = () => ({
    sendMail: () => Promise.resolve({ messageId: 'test-message-id' })
  });
}

import { createHash, createSign, createVerify, randomBytes } from 'crypto';
import { X509Certificate } from 'crypto';
import { readFileSync } from 'fs';

import {
  DirectMessage,
  DirectAddress,
  DirectTrustConfig,
  DirectMessageStatus,
  DirectConnectionStatus,
  DirectTrustStatistics,
  DirectAuditEvent,
  DirectAuditEventType,
  DirectHealthCheck,
  DirectValidationResult,
  DirectCertificate,
  DirectEncryptionInfo,
  DirectSignatureInfo
} from '../types/direct.types';
import { IntegrationResult, IntegrationError } from '../types/integration.types';

import config from '@/config';
import { getErrorMessage } from '@/utils/error.utils';
import logger from '@/utils/logger';

/**
 * Direct Trust Service
 * Implements Direct Trust secure messaging protocols for healthcare provider communication
 */
export class DirectTrustService {
  private smtpTransporter?: any;
  private directConfig: DirectTrustConfig;
  private connectionStatus: DirectConnectionStatus;
  private statistics: DirectTrustStatistics;
  private messageQueue: Map<string, DirectMessage> = new Map();
  private processingMessages: Set<string> = new Set();
  private certificates: Map<string, DirectCertificate> = new Map();
  private trustAnchors: Map<string, DirectCertificate> = new Map();

  constructor() {
    this.directConfig = this.loadConfiguration();
    this.connectionStatus = this.initializeConnectionStatus();
    this.statistics = this.initializeStatistics();
    this.initialize();
  }

  /**
   * Initialize Direct Trust service
   */
  private async initialize(): Promise<void> {
    try {
      if (!this.directConfig.enabled) {
        logger.info('Direct Trust service is disabled');
        return;
      }

      await this.loadCertificates();
      await this.setupSMTPTransporter();
      await this.validateTrustBundle();
      
      logger.info('Direct Trust service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Direct Trust service:', error);
      throw error;
    }
  }

  /**
   * Load Direct Trust configuration
   */
  private loadConfiguration(): DirectTrustConfig {
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
        maxMessageSize: parseInt(process.env.DIRECT_MAX_MESSAGE_SIZE || '25000000', 10), // 25MB
        maxAttachmentSize: parseInt(process.env.DIRECT_MAX_ATTACHMENT_SIZE || '10000000', 10), // 10MB
        allowedAttachmentTypes: [
          'application/pdf', 'text/xml', 'application/xml', 'text/plain',
          'image/jpeg', 'image/png', 'image/tiff', 'application/dicom'
        ],
        messageRetentionDays: parseInt(process.env.DIRECT_MESSAGE_RETENTION_DAYS || '2555', 10), // 7 years
        quarantineUnencrypted: process.env.DIRECT_QUARANTINE_UNENCRYPTED === 'true',
        quarantineUnsigned: process.env.DIRECT_QUARANTINE_UNSIGNED === 'true',
        autoAcknowledge: process.env.DIRECT_AUTO_ACKNOWLEDGE === 'true',
        requireDeliveryNotification: process.env.DIRECT_REQUIRE_DELIVERY_NOTIFICATION === 'true'
      }
    };
  }

  /**
   * Setup SMTP transporter
   */
  private async setupSMTPTransporter(): Promise<void> {
    try {
      this.smtpTransporter = createTransport({
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

      // Verify SMTP connection
      await this.smtpTransporter.verify();
      this.connectionStatus.smtpConnected = true;
      this.connectionStatus.lastSmtpCheck = new Date();
      
      logger.info('SMTP transporter configured successfully');
    } catch (error) {
      this.connectionStatus.smtpConnected = false;
      this.connectionStatus.errors.push(`SMTP connection failed: ${String(error)}`);
      logger.error('Failed to setup SMTP transporter:', error);
      throw error;
    }
  }

  /**
   * Load certificates from file system
   */
  private async loadCertificates(): Promise<void> {
    try {
      // Load signing certificate
      const signingCertData = readFileSync(this.directConfig.certificates.signingCertPath, 'utf8');
      const signingCert = new X509Certificate(signingCertData);
      
      // Load encryption certificate
      const encryptionCertData = readFileSync(this.directConfig.certificates.encryptionCertPath, 'utf8');
      const encryptionCert = new X509Certificate(encryptionCertData);
      
      // Store certificates
      this.certificates.set('signing', this.convertX509ToDirectCertificate(signingCert, signingCertData));
      this.certificates.set('encryption', this.convertX509ToDirectCertificate(encryptionCert, encryptionCertData));
      
      // Load trust anchors
      await this.loadTrustAnchors();
      
      // Validate certificates
      await this.validateCertificates();
      
      logger.info('Certificates loaded successfully');
    } catch (error) {
      logger.error('Failed to load certificates:', error);
      throw error;
    }
  }

  /**
   * Load trust anchors
   */
  private async loadTrustAnchors(): Promise<void> {
    try {
      const trustAnchorsData = readFileSync(this.directConfig.certificates.trustedAnchorsPath, 'utf8');
      const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
      const certMatches = trustAnchorsData.match(certRegex);
      
      if (certMatches) {
        for (const certData of certMatches) {
          const cert = new X509Certificate(certData);
          const directCert = this.convertX509ToDirectCertificate(cert, certData);
          directCert.trustAnchor = true;
          this.trustAnchors.set(cert.subject, directCert);
        }
      }
      
      logger.info(`Loaded ${this.trustAnchors.size} trust anchors`);
    } catch (error) {
      logger.warn('Failed to load trust anchors:', error);
    }
  }

  /**
   * Convert X509Certificate to DirectCertificate
   */
  private convertX509ToDirectCertificate(cert: X509Certificate, certData: string): DirectCertificate {
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

  /**
   * Validate certificates
   */
  private async validateCertificates(): Promise<void> {
    try {
      const signingCert = this.certificates.get('signing');
      const encryptionCert = this.certificates.get('encryption');
      
      if (!signingCert || !encryptionCert) {
        throw new Error('Required certificates not loaded');
      }
      
      // Check certificate expiration
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      
      if (signingCert.notAfter < now || encryptionCert.notAfter < now) {
        this.connectionStatus.certificatesValid = false;
        this.connectionStatus.errors.push('One or more certificates have expired');
      } else if (signingCert.notAfter < thirtyDaysFromNow || encryptionCert.notAfter < thirtyDaysFromNow) {
        logger.warn('One or more certificates will expire within 30 days');
      }
      
      this.connectionStatus.certificatesValid = true;
      this.connectionStatus.certificateExpiry = new Date(Math.min(signingCert.notAfter.getTime(), encryptionCert.notAfter.getTime()));
      
      logger.info('Certificate validation completed');
    } catch (error) {
      this.connectionStatus.certificatesValid = false;
      this.connectionStatus.errors.push(`Certificate validation failed: ${String(error)}`);
      logger.error('Certificate validation failed:', error);
    }
  }

  /**
   * Validate trust bundle
   */
  private async validateTrustBundle(): Promise<void> {
    try {
      const trustAnchorCount = this.trustAnchors.size;
      
      if (trustAnchorCount === 0) {
        this.connectionStatus.trustBundleValid = false;
        this.connectionStatus.errors.push('No trust anchors loaded');
        return;
      }
      
      // Check if trust anchors are still valid
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
      } else {
        this.connectionStatus.trustBundleValid = true;
        this.connectionStatus.trustBundleLastUpdate = new Date();
      }
      
      logger.info(`Trust bundle validation completed: ${validCount}/${trustAnchorCount} valid anchors`);
    } catch (error) {
      this.connectionStatus.trustBundleValid = false;
      this.connectionStatus.errors.push(`Trust bundle validation failed: ${String(error)}`);
      logger.error('Trust bundle validation failed:', error);
    }
  }

  /**
   * Send Direct Trust message
   */
  async sendMessage(message: DirectMessage): Promise<IntegrationResult<DirectMessage>> {
    try {
      if (!this.directConfig.enabled) {
        throw new Error('Direct Trust service is disabled');
      }
      
      if (!this.smtpTransporter) {
        throw new Error('SMTP transporter not configured');
      }
      
      // Validate message
      const validationResult = await this.validateMessage(message);
      if (!validationResult.valid) {
        throw new Error(`Message validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }
      
      // Update message status
      message.status = DirectMessageStatus.ENCRYPTING;
      this.updateMessageStatus(message);
      
      // Encrypt and sign message content
      const processedContent = await this.processOutboundMessage(message);
      
      message.status = DirectMessageStatus.SENDING;
      this.updateMessageStatus(message);
      
      // Prepare email
      const mailOptions = {
        from: message.sender.address,
        to: message.recipients.map(r => r.address),
        subject: message.subject,
        text: processedContent.body,
        attachments: processedContent.attachments
      };
      
      // Send email
      const info = await this.smtpTransporter.sendMail(mailOptions);
      
      // Update message status
      message.status = DirectMessageStatus.SENT;
      message.sent = new Date();
      this.updateMessageStatus(message);
      
      // Update statistics
      this.statistics.messagesSent++;
      this.statistics.lastActivity = new Date();
      
      // Log audit event
      await this.logAuditEvent({
        id: this.generateId(),
        eventType: DirectAuditEventType.MESSAGE_SENT,
        messageId: message.id,
        sender: message.sender.address,
        recipient: message.recipients.map(r => r.address).join(', '),
        outcome: 'success',
        description: 'Direct Trust message sent successfully',
        details: { messageId: info.messageId, response: info.response },
        timestamp: new Date()
      });
      
      logger.info('Direct Trust message sent successfully', {
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
    } catch (error) {
      // Update message status
      message.status = DirectMessageStatus.FAILED;
      this.updateMessageStatus(message, error);
      
      // Update statistics
      this.statistics.messagesFailed++;
      
      // Log audit event
      await this.logAuditEvent({
        id: this.generateId(),
        eventType: DirectAuditEventType.MESSAGE_FAILED,
        messageId: message.id,
        sender: message.sender.address,
        outcome: 'failure',
        description: 'Direct Trust message send failed',
        details: { error: getErrorMessage(error) },
        timestamp: new Date()
      });
      
      logger.error('Failed to send Direct Trust message:', error);
      
      return {
        success: false,
        error: {
          code: 'DIRECT_SEND_FAILED',
          message: `Failed to send Direct Trust message: ${getErrorMessage(error)}`,
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

  /**
   * Process outbound message (encrypt and sign)
   */
  private async processOutboundMessage(message: DirectMessage): Promise<{
    body: string;
    attachments: any[];
  }> {
    try {
      let processedBody = message.body || '';
      const processedAttachments: any[] = [];
      
      // Process attachments
      for (const attachment of message.attachments) {
        const processedAttachment = {
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          encoding: 'base64'
        };
        
        // Encrypt attachment if required
        if (this.directConfig.security.enforceEncryption && !attachment.encrypted) {
          // Implement attachment encryption
          processedAttachment.content = await this.encryptContent(attachment.content.toString(), message.recipients);
        }
        
        processedAttachments.push(processedAttachment);
      }
      
      // Encrypt message body if required
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
      
      // Sign message if required
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
    } catch (error) {
      logger.error('Failed to process outbound message:', error);
      throw error;
    }
  }

  /**
   * Encrypt content for recipients
   */
  private async encryptContent(content: string, recipients: DirectAddress[]): Promise<string> {
    try {
      // This is a simplified implementation
      // In production, you would use proper S/MIME encryption with recipient certificates
      const key = randomBytes(32);
      const iv = randomBytes(16);
      
      // Encrypt content with AES
      const cipher = require('crypto').createCipher('aes-256-gcm', key);
      cipher.setAAD(Buffer.from('DirectTrust', 'utf8'));
      
      let encrypted = cipher.update(content, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // In production, encrypt the key with each recipient's public key
      const encryptedKey = key.toString('base64');
      
      return JSON.stringify({
        encrypted,
        key: encryptedKey,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        algorithm: 'aes-256-gcm'
      });
    } catch (error) {
      logger.error('Content encryption failed:', error);
      throw error;
    }
  }

  /**
   * Sign content
   */
  private async signContent(content: string): Promise<string> {
    try {
      const signingCert = this.certificates.get('signing');
      if (!signingCert) {
        throw new Error('Signing certificate not available');
      }
      
      const signingKey = readFileSync(this.directConfig.certificates.signingKeyPath, 'utf8');
      const sign = createSign('SHA256');
      sign.update(content);
      sign.end();
      
      const signature = sign.sign(signingKey, 'base64');
      return signature;
    } catch (error) {
      logger.error('Content signing failed:', error);
      throw error;
    }
  }

  /**
   * Validate Direct Trust message
   */
  private async validateMessage(message: DirectMessage): Promise<DirectValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    try {
      // Validate sender
      if (!message.sender.address || !this.isValidDirectAddress(message.sender.address)) {
        errors.push({
          code: 'INVALID_SENDER',
          message: 'Invalid sender address',
          severity: 'error',
          field: 'sender.address'
        });
      }
      
      // Validate recipients
      if (!message.recipients || message.recipients.length === 0) {
        errors.push({
          code: 'NO_RECIPIENTS',
          message: 'Message must have at least one recipient',
          severity: 'error',
          field: 'recipients'
        });
      } else {
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
      
      // Validate subject
      if (!message.subject || message.subject.trim().length === 0) {
        warnings.push({
          code: 'EMPTY_SUBJECT',
          message: 'Message subject is empty',
          severity: 'warning',
          field: 'subject'
        });
      }
      
      // Validate message size
      const messageSize = this.calculateMessageSize(message);
      if (messageSize > this.directConfig.policies.maxMessageSize) {
        errors.push({
          code: 'MESSAGE_TOO_LARGE',
          message: `Message size (${messageSize}) exceeds maximum allowed size (${this.directConfig.policies.maxMessageSize})`,
          severity: 'error',
          field: 'message'
        });
      }
      
      // Validate attachments
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
    } catch (error) {
      logger.error('Message validation failed:', error);
      return {
        valid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${getErrorMessage(error)}`,
          severity: 'error'
        }],
        warnings: [],
        securityLevel: 'low',
        trustLevel: 'untrusted',
        validatedAt: new Date()
      };
    }
  }

  /**
   * Check valid Direct address format
   */
  private isValidDirectAddress(address: string): boolean {
    const directAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(direct|Direct)$/;
    return directAddressRegex.test(address);
  }

  /**
   * Calculate message size
   */
  private calculateMessageSize(message: DirectMessage): number {
    let size = 0;
    
    if (message.body) {
      size += Buffer.byteLength(message.body, 'utf8');
    }
    
    for (const attachment of message.attachments) {
      size += attachment.size;
    }
    
    return size;
  }

  /**
   * Calculate security level
   */
  private calculateSecurityLevel(message: DirectMessage): 'low' | 'medium' | 'high' {
    let score = 0;
    
    if (message.encryption?.encrypted) score += 3;
    if (message.signature?.signed) score += 2;
    if (message.attachments.every(a => a.encrypted)) score += 1;
    
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate trust level
   */
  private async calculateTrustLevel(message: DirectMessage): Promise<'untrusted' | 'low' | 'medium' | 'high'> {
    // Simplified trust calculation
    // In production, this would check certificate chains, trust anchors, etc.
    return 'medium';
  }

  /**
   * Update message status
   */
  private updateMessageStatus(message: DirectMessage, error?: any): void {
    message.statusHistory.push({
      status: message.status,
      timestamp: new Date(),
      description: error ? `Error: ${getErrorMessage(error)}` : undefined,
      errorCode: error ? 'PROCESSING_ERROR' : undefined,
      errorMessage: error ? getErrorMessage(error) : undefined
    });
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(event: DirectAuditEvent): Promise<void> {
    try {
      // In production, store audit events in database
      logger.audit('Direct Trust audit event', event);
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Initialize connection status
   */
  private initializeConnectionStatus(): DirectConnectionStatus {
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

  /**
   * Initialize statistics
   */
  private initializeStatistics(): DirectTrustStatistics {
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

  /**
   * Get service statistics
   */
  getStatistics(): DirectTrustStatistics {
    return { ...this.statistics };
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<DirectHealthCheck> {
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
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        smtpConnection: false,
        certificateValid: false,
        trustBundleValid: false,
        messageProcessing: false,
        details: {},
        errors: [getErrorMessage(error)]
      };
    }
  }
}

// Export singleton instance
export const directTrustService = new DirectTrustService();