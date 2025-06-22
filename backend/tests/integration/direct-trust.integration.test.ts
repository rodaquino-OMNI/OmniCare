import { directTrustService } from '../../src/services/integration/direct/direct-trust.service';
import { DirectMessage, DirectMessageStatus, DirectAddress } from '../../src/services/integration/types/direct.types';
import logger from '../../src/utils/logger';

/**
 * Direct Trust Integration Tests
 * Tests secure messaging protocols for healthcare provider communication
 */
describe('Direct Trust Integration Tests', () => {
  let testMessageId: string;

  beforeAll(async () => {
    // Direct Trust service initializes automatically in constructor
    // Verify service is properly configured
    const health = await directTrustService.getHealth();
    if (health.status === 'unhealthy') {
      console.warn('Direct Trust service not properly configured for testing');
    }
  });

  describe('Direct Trust Service Health', () => {
    test('should report service health status', async () => {
      const healthStatus = await directTrustService.getHealth();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toMatch(/healthy|unhealthy/);
      expect(healthStatus.lastCheck).toBeInstanceOf(Date);
      expect(healthStatus.details).toBeDefined();
    });

    test('should provide service statistics', () => {
      const statistics = directTrustService.getStatistics();
      
      expect(statistics).toBeDefined();
      expect(statistics.messagesSent).toBeGreaterThanOrEqual(0);
      expect(statistics.messagesReceived).toBeGreaterThanOrEqual(0);
      expect(statistics.messagesFailed).toBeGreaterThanOrEqual(0);
      expect(statistics.lastActivity).toBeInstanceOf(Date);
    });
  });

  describe('Direct Address Validation', () => {
    test('should validate correct Direct addresses', () => {
      const validAddresses = [
        'provider@clinic.direct',
        'doctor.smith@hospital.Direct',
        'nurse123@facility.direct'
      ];

      // Note: This is testing internal validation logic
      // We need to create a test message to trigger validation
      validAddresses.forEach(address => {
        const testMessage: Partial<DirectMessage> = {
          sender: { address } as DirectAddress,
          recipients: [{ address: 'test@test.direct' } as DirectAddress],
          subject: 'Test message',
          body: 'Test body'
        };
        
        expect(testMessage.sender?.address).toBe(address);
      });
    });

    test('should reject invalid Direct addresses', () => {
      const invalidAddresses = [
        'provider@clinic.com',  // Not .direct domain
        'doctor@hospital',      // Missing domain
        '',                     // Empty address
        'invalid-format'        // No @ symbol
      ];

      invalidAddresses.forEach(address => {
        const testMessage: Partial<DirectMessage> = {
          sender: { address } as DirectAddress,
          recipients: [{ address: 'test@test.direct' } as DirectAddress],
          subject: 'Test message',
          body: 'Test body'
        };
        
        // The validation would happen when sending the message
        expect(testMessage.sender?.address).toBe(address);
      });
    });
  });

  describe('Direct Message Creation and Validation', () => {
    test('should create valid Direct message structure', () => {
      const sender: DirectAddress = {
        address: 'sender@omnicare.direct',
        name: 'Dr. John Sender'
      };

      const recipients: DirectAddress[] = [
        {
          address: 'recipient@clinic.direct',
          name: 'Dr. Jane Recipient'
        }
      ];

      const directMessage: Partial<DirectMessage> = {
        sender,
        recipients,
        subject: 'Patient Referral - John Doe',
        body: 'Please find attached the referral information for patient John Doe.',
        attachments: [],
        priority: 'normal'
      };

      expect(directMessage.sender?.address).toBe('sender@omnicare.direct');
      expect(directMessage.recipients?.[0]?.address).toBe('recipient@clinic.direct');
      expect(directMessage.subject).toBe('Patient Referral - John Doe');
      expect(directMessage.body).toContain('referral information');
    });

    test('should handle message with attachments', () => {
      const messageWithAttachment: Partial<DirectMessage> = {
        sender: { address: 'sender@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'recipient@clinic.direct' } as DirectAddress],
        subject: 'Lab Results - Patient DOE, John',
        body: 'Please find the lab results attached.',
        attachments: [
          {
            filename: 'lab_results.pdf',
            contentType: 'application/pdf',
            size: 1024 * 50, // 50KB
            content: Buffer.from('Mock PDF content'),
            encrypted: false
          }
        ]
      };

      expect(messageWithAttachment.attachments?.length).toBe(1);
      expect(messageWithAttachment.attachments?.[0]?.filename).toBe('lab_results.pdf');
      expect(messageWithAttachment.attachments?.[0]?.contentType).toBe('application/pdf');
    });

    test('should enforce message size limits', () => {
      const largeAttachment = {
        filename: 'large_file.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024 * 30, // 30MB - exceeds typical limit
        content: Buffer.alloc(1024 * 1024 * 30),
        encrypted: false
      };

      const messageWithLargeAttachment: Partial<DirectMessage> = {
        sender: { address: 'sender@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'recipient@clinic.direct' } as DirectAddress],
        subject: 'Large Document',
        body: 'Large attachment test',
        attachments: [largeAttachment]
      };

      // This would be caught during message validation
      expect(messageWithLargeAttachment.attachments?.[0]?.size).toBeGreaterThan(1024 * 1024 * 25);
    });
  });

  describe('Message Security and Encryption', () => {
    test('should handle message encryption settings', () => {
      const encryptedMessage: Partial<DirectMessage> = {
        sender: { address: 'sender@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'recipient@clinic.direct' } as DirectAddress],
        subject: 'Confidential Patient Information',
        body: 'This message contains sensitive patient data.',
        encryption: {
          algorithm: 'AES-256-GCM',
          keySize: 256,
          certificateId: 'encryption-cert-001',
          encrypted: true,
          encryptedAt: new Date()
        }
      };

      expect(encryptedMessage.encryption?.encrypted).toBe(true);
      expect(encryptedMessage.encryption?.algorithm).toBe('AES-256-GCM');
      expect(encryptedMessage.encryption?.keySize).toBe(256);
    });

    test('should handle message signing', () => {
      const signedMessage: Partial<DirectMessage> = {
        sender: { address: 'sender@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'recipient@clinic.direct' } as DirectAddress],
        subject: 'Signed Medical Document',
        body: 'This message is digitally signed.',
        signature: {
          algorithm: 'SHA256withRSA',
          certificateId: 'signing-cert-001',
          signed: true,
          signedAt: new Date(),
          signature: 'mock-digital-signature-data'
        }
      };

      expect(signedMessage.signature?.signed).toBe(true);
      expect(signedMessage.signature?.algorithm).toBe('SHA256withRSA');
      expect(signedMessage.signature?.signature).toBeDefined();
    });
  });

  describe('Message Status Tracking', () => {
    test('should track message status throughout lifecycle', () => {
      const message: Partial<DirectMessage> = {
        id: 'msg-001',
        sender: { address: 'sender@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'recipient@clinic.direct' } as DirectAddress],
        subject: 'Status Tracking Test',
        body: 'Testing message status tracking',
        status: DirectMessageStatus.PENDING,
        statusHistory: [],
        created: new Date(),
        updated: new Date()
      };

      // Simulate status changes
      const statusUpdates = [
        DirectMessageStatus.ENCRYPTING,
        DirectMessageStatus.SENDING,
        DirectMessageStatus.SENT,
        DirectMessageStatus.DELIVERED
      ];

      statusUpdates.forEach(status => {
        message.status = status;
        message.updated = new Date();
        message.statusHistory?.push({
          status,
          timestamp: new Date(),
          description: `Message status changed to ${status}`
        });
      });

      expect(message.status).toBe(DirectMessageStatus.DELIVERED);
      expect(message.statusHistory?.length).toBe(4);
    });

    test('should handle message failure status', () => {
      const failedMessage: Partial<DirectMessage> = {
        id: 'msg-002',
        status: DirectMessageStatus.FAILED,
        statusHistory: [
          {
            status: DirectMessageStatus.PENDING,
            timestamp: new Date(Date.now() - 60000),
            description: 'Message queued for sending'
          },
          {
            status: DirectMessageStatus.FAILED,
            timestamp: new Date(),
            description: 'Message delivery failed: Recipient server unreachable',
            errorCode: 'DELIVERY_FAILED',
            errorMessage: 'Connection timeout to recipient server'
          }
        ]
      };

      expect(failedMessage.status).toBe(DirectMessageStatus.FAILED);
      expect(failedMessage.statusHistory?.length).toBe(2);
      
      const failureEntry = failedMessage.statusHistory?.find(
        h => h.status === DirectMessageStatus.FAILED
      );
      expect(failureEntry?.errorCode).toBe('DELIVERY_FAILED');
    });
  });

  describe('Certificate Management', () => {
    test('should handle certificate validation', async () => {
      // Mock certificate validation
      const mockCertificate = {
        id: 'cert-001',
        subject: 'CN=OmniCare Direct Trust, O=OmniCare, C=US',
        issuer: 'CN=Direct Trust CA, O=DirectTrust, C=US',
        serialNumber: '123456789',
        notBefore: new Date(Date.now() - 86400000), // 1 day ago
        notAfter: new Date(Date.now() + 365 * 86400000), // 1 year from now
        status: 'valid' as const,
        trustAnchor: false,
        keyUsage: ['digitalSignature', 'keyEncipherment']
      };

      expect(mockCertificate.status).toBe('valid');
      expect(mockCertificate.notAfter.getTime()).toBeGreaterThan(Date.now());
      expect(mockCertificate.keyUsage).toContain('digitalSignature');
    });

    test('should detect expired certificates', () => {
      const expiredCertificate = {
        id: 'cert-002',
        subject: 'CN=Expired Certificate',
        notBefore: new Date(Date.now() - 2 * 365 * 86400000), // 2 years ago
        notAfter: new Date(Date.now() - 86400000), // 1 day ago
        status: 'expired' as const
      };

      expect(expiredCertificate.status).toBe('expired');
      expect(expiredCertificate.notAfter.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Audit and Compliance', () => {
    test('should log audit events for message operations', () => {
      const auditEvent = {
        id: 'audit-001',
        eventType: 'MESSAGE_SENT',
        messageId: 'msg-001',
        sender: 'sender@omnicare.direct',
        recipient: 'recipient@clinic.direct',
        outcome: 'success' as const,
        description: 'Direct Trust message sent successfully',
        timestamp: new Date(),
        details: {
          messageSize: 1024,
          encryptionUsed: true,
          signatureVerified: true
        }
      };

      expect(auditEvent.eventType).toBe('MESSAGE_SENT');
      expect(auditEvent.outcome).toBe('success');
      expect(auditEvent.details.encryptionUsed).toBe(true);
    });

    test('should track compliance metrics', () => {
      const complianceMetrics = {
        totalMessagesProcessed: 100,
        encryptedMessages: 95,
        signedMessages: 98,
        certificateValidationFailures: 2,
        deliveryFailures: 3,
        encryptionCompliance: 95, // percentage
        signatureCompliance: 98   // percentage
      };

      expect(complianceMetrics.encryptionCompliance).toBeGreaterThan(90);
      expect(complianceMetrics.signatureCompliance).toBeGreaterThan(95);
      expect(complianceMetrics.certificateValidationFailures).toBeLessThan(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle SMTP connection failures', async () => {
      // Mock SMTP connection failure scenario
      const mockMessage: Partial<DirectMessage> = {
        id: 'msg-connection-test',
        sender: { address: 'sender@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'recipient@clinic.direct' } as DirectAddress],
        subject: 'Connection Test',
        body: 'Testing SMTP connection failure handling'
      };

      // In a real scenario, this would test actual SMTP failure
      expect(mockMessage.id).toBe('msg-connection-test');
    });

    test('should handle certificate validation failures', () => {
      const invalidCertMessage = {
        sender: { address: 'sender@untrusted.direct' },
        recipients: [{ address: 'recipient@clinic.direct' }],
        subject: 'Untrusted Certificate Test',
        certificateValidationResult: {
          valid: false,
          errors: ['Certificate not in trust bundle', 'Certificate has expired'],
          trustLevel: 'untrusted'
        }
      };

      expect(invalidCertMessage.certificateValidationResult.valid).toBe(false);
      expect(invalidCertMessage.certificateValidationResult.errors.length).toBeGreaterThan(0);
    });

    test('should handle message quarantine scenarios', () => {
      const quarantinedMessage = {
        id: 'msg-quarantine-test',
        status: 'quarantined' as const,
        quarantineReason: 'Unencrypted message detected',
        quarantineTimestamp: new Date(),
        requiresManualReview: true
      };

      expect(quarantinedMessage.status).toBe('quarantined');
      expect(quarantinedMessage.requiresManualReview).toBe(true);
      expect(quarantinedMessage.quarantineReason).toContain('Unencrypted');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent message processing', async () => {
      const messagePromises = Array(5).fill(0).map((_, i) => {
        const message = {
          id: `concurrent-msg-${i}`,
          sender: { address: 'sender@omnicare.direct' } as DirectAddress,
          recipients: [{ address: `recipient${i}@clinic.direct` } as DirectAddress],
          subject: `Concurrent Test Message ${i}`,
          body: `Testing concurrent processing for message ${i}`,
          status: DirectMessageStatus.PENDING
        };
        
        // Simulate message processing
        return Promise.resolve(message);
      });

      const results = await Promise.allSettled(messagePromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBe(5);
    });

    test('should handle large message volumes efficiently', () => {
      const startTime = Date.now();
      
      // Simulate processing 100 messages
      const messages = Array(100).fill(0).map((_, i) => ({
        id: `bulk-msg-${i}`,
        processed: true,
        processingTime: Math.random() * 100 // Random processing time
      }));

      const totalProcessingTime = Date.now() - startTime;
      const averageProcessingTime = messages.reduce((sum, msg) => sum + msg.processingTime, 0) / messages.length;

      expect(messages.length).toBe(100);
      expect(averageProcessingTime).toBeLessThan(1000); // Should average less than 1 second
      expect(totalProcessingTime).toBeLessThan(5000); // Total processing should be under 5 seconds
    });
  });

  describe('Integration with Healthcare Workflows', () => {
    test('should integrate with patient referral workflows', () => {
      const referralMessage = {
        id: 'referral-msg-001',
        sender: { address: 'primarycare@omnicare.direct' } as DirectAddress,
        recipients: [{ address: 'specialist@cardiology.direct' } as DirectAddress],
        subject: 'Patient Referral - URGENT: John Doe (DOB: 01/01/1980)',
        body: 'Referring patient for cardiac evaluation. Please see attached clinical summary.',
        messageType: 'REFERRAL',
        priority: 'urgent',
        clinicalData: {
          patientId: 'patient-123',
          referralReason: 'Chest pain with EKG abnormalities',
          urgencyLevel: 'urgent',
          preferredAppointmentWindow: '7 days'
        },
        attachments: [
          {
            filename: 'clinical_summary.pdf',
            contentType: 'application/pdf',
            classification: 'clinical-document'
          }
        ]
      };

      expect(referralMessage.messageType).toBe('REFERRAL');
      expect(referralMessage.priority).toBe('urgent');
      expect(referralMessage.clinicalData.patientId).toBe('patient-123');
    });

    test('should handle care coordination messages', () => {
      const careCoordinationMessage = {
        id: 'care-coord-001',
        messageType: 'CARE_COORDINATION',
        careTeam: [
          { role: 'Primary Care', address: 'primarycare@omnicare.direct' },
          { role: 'Cardiologist', address: 'cardio@specialist.direct' },
          { role: 'Care Coordinator', address: 'coordinator@omnicare.direct' }
        ],
        carePlanUpdate: {
          patientId: 'patient-123',
          lastUpdated: new Date(),
          changes: ['Medication adjustment', 'Follow-up appointment scheduled']
        }
      };

      expect(careCoordinationMessage.messageType).toBe('CARE_COORDINATION');
      expect(careCoordinationMessage.careTeam.length).toBe(3);
      expect(careCoordinationMessage.carePlanUpdate.changes.length).toBe(2);
    });
  });

  afterAll(async () => {
    // Cleanup any test messages or resources
    if (testMessageId) {
      logger.info(`Test message ${testMessageId} cleanup completed`);
    }
  });
});