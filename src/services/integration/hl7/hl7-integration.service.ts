/**
 * OmniCare EMR - HL7 Integration Service
 * Handles HL7 message parsing, transformation, and routing
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';

export interface HL7Message {
  messageType: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: Date;
  version: string;
  segments: HL7Segment[];
  rawMessage?: string;
}

export interface HL7Segment {
  segmentType: string;
  fields: string[];
  raw?: string;
}

export interface HL7Configuration {
  sendingApplication: string;
  sendingFacility: string;
  version: string;
  delimiter: string;
  fieldSeparator: string;
  componentSeparator: string;
  repetitionSeparator: string;
  escapeCharacter: string;
  subcomponentSeparator: string;
}

export interface HL7ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HL7TransformationRule {
  sourceField: string;
  targetField: string;
  transformFunction?: (value: any) => any;
  conditions?: Record<string, any>;
}

export class HL7IntegrationService extends EventEmitter {
  private config: HL7Configuration;
  private messageQueue: HL7Message[] = [];
  private processingInterval: NodeJS.Timer | null = null;

  constructor(config?: Partial<HL7Configuration>) {
    super();
    this.config = {
      sendingApplication: config?.sendingApplication || 'OMNICARE',
      sendingFacility: config?.sendingFacility || 'OMNICARE_EMR',
      version: config?.version || '2.5.1',
      delimiter: config?.delimiter || '\r',
      fieldSeparator: config?.fieldSeparator || '|',
      componentSeparator: config?.componentSeparator || '^',
      repetitionSeparator: config?.repetitionSeparator || '~',
      escapeCharacter: config?.escapeCharacter || '\\',
      subcomponentSeparator: config?.subcomponentSeparator || '&'
    };
  }

  /**
   * Parse raw HL7 message into structured format
   */
  async parseMessage(rawMessage: string): Promise<HL7Message> {
    try {
      logger.debug('Parsing HL7 message');
      
      // TODO: Implement complete HL7 parsing logic
      const lines = rawMessage.split(this.config.delimiter);
      const segments: HL7Segment[] = [];

      for (const line of lines) {
        if (line.trim()) {
          const fields = line.split(this.config.fieldSeparator);
          segments.push({
            segmentType: fields[0],
            fields: fields.slice(1),
            raw: line
          });
        }
      }

      // Extract header information from MSH segment
      const mshSegment = segments.find(s => s.segmentType === 'MSH');
      if (!mshSegment) {
        throw new Error('Missing MSH segment in HL7 message');
      }

      const message: HL7Message = {
        messageType: mshSegment.fields[7] || '',
        messageControlId: mshSegment.fields[8] || '',
        sendingApplication: mshSegment.fields[1] || '',
        sendingFacility: mshSegment.fields[2] || '',
        receivingApplication: mshSegment.fields[3] || '',
        receivingFacility: mshSegment.fields[4] || '',
        timestamp: new Date(mshSegment.fields[5] || Date.now()),
        version: mshSegment.fields[10] || this.config.version,
        segments,
        rawMessage
      };

      logger.info(`Parsed HL7 message: ${message.messageType} (ID: ${message.messageControlId})`);
      return message;
    } catch (error) {
      logger.error('Failed to parse HL7 message:', error);
      throw new Error(`HL7 parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HL7 message from structured data
   */
  async generateMessage(messageType: string, data: any): Promise<string> {
    try {
      logger.debug(`Generating HL7 message of type: ${messageType}`);

      // TODO: Implement complete HL7 message generation
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const messageControlId = this.generateMessageControlId();

      const mshSegment = [
        'MSH',
        this.config.fieldSeparator + this.config.componentSeparator + 
        this.config.repetitionSeparator + this.config.escapeCharacter + 
        this.config.subcomponentSeparator,
        this.config.sendingApplication,
        this.config.sendingFacility,
        data.receivingApplication || '',
        data.receivingFacility || '',
        timestamp,
        '',
        messageType,
        messageControlId,
        'P',
        this.config.version
      ].join(this.config.fieldSeparator);

      const segments = [mshSegment];
      
      // Add other segments based on message type
      // TODO: Implement segment generation for different message types

      const message = segments.join(this.config.delimiter) + this.config.delimiter;
      
      logger.info(`Generated HL7 message: ${messageType} (ID: ${messageControlId})`);
      return message;
    } catch (error) {
      logger.error('Failed to generate HL7 message:', error);
      throw new Error(`HL7 generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate HL7 message against standards
   */
  async validateMessage(message: HL7Message): Promise<HL7ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation
      if (!message.messageType) {
        errors.push('Message type is required');
      }

      if (!message.messageControlId) {
        errors.push('Message control ID is required');
      }

      if (!message.segments || message.segments.length === 0) {
        errors.push('Message must contain at least one segment');
      }

      // Check for required segments based on message type
      // TODO: Implement message type specific validation

      const isValid = errors.length === 0;
      
      logger.debug(`HL7 message validation result: ${isValid ? 'valid' : 'invalid'}`);
      return { isValid, errors, warnings };
    } catch (error) {
      logger.error('Failed to validate HL7 message:', error);
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Transform HL7 message to FHIR resource
   */
  async transformToFHIR(message: HL7Message): Promise<any> {
    try {
      logger.debug(`Transforming HL7 message to FHIR: ${message.messageType}`);

      // TODO: Implement HL7 to FHIR transformation based on message type
      const fhirResource = {
        resourceType: this.mapHL7ToFHIRResourceType(message.messageType),
        id: message.messageControlId,
        meta: {
          source: `hl7:${message.sendingApplication}/${message.sendingFacility}`,
          lastUpdated: message.timestamp.toISOString()
        },
        // Add more fields based on message type and segments
      };

      logger.info(`Transformed HL7 message to FHIR ${fhirResource.resourceType}`);
      return fhirResource;
    } catch (error) {
      logger.error('Failed to transform HL7 to FHIR:', error);
      throw new Error(`HL7 to FHIR transformation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform FHIR resource to HL7 message
   */
  async transformFromFHIR(fhirResource: any): Promise<HL7Message> {
    try {
      logger.debug(`Transforming FHIR ${fhirResource.resourceType} to HL7`);

      // TODO: Implement FHIR to HL7 transformation based on resource type
      const messageType = this.mapFHIRToHL7MessageType(fhirResource.resourceType);
      const rawMessage = await this.generateMessage(messageType, fhirResource);
      const message = await this.parseMessage(rawMessage);

      logger.info(`Transformed FHIR resource to HL7 ${messageType}`);
      return message;
    } catch (error) {
      logger.error('Failed to transform FHIR to HL7:', error);
      throw new Error(`FHIR to HL7 transformation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send HL7 message to external system
   */
  async sendMessage(message: HL7Message, endpoint: string): Promise<void> {
    try {
      logger.debug(`Sending HL7 message to: ${endpoint}`);

      // TODO: Implement actual message sending logic (TCP/MLLP, HTTP, etc.)
      // For now, just emit an event
      this.emit('messageSent', { message, endpoint });

      logger.info(`HL7 message sent successfully to ${endpoint}`);
    } catch (error) {
      logger.error('Failed to send HL7 message:', error);
      throw new Error(`HL7 send error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Receive and process incoming HL7 messages
   */
  async receiveMessage(rawMessage: string, source: string): Promise<void> {
    try {
      logger.debug(`Received HL7 message from: ${source}`);

      const message = await this.parseMessage(rawMessage);
      const validation = await this.validateMessage(message);

      if (!validation.isValid) {
        logger.error('Invalid HL7 message received:', validation.errors);
        this.emit('messageError', { message, errors: validation.errors, source });
        return;
      }

      // Add to processing queue
      this.messageQueue.push(message);
      this.emit('messageReceived', { message, source });

      logger.info(`HL7 message queued for processing from ${source}`);
    } catch (error) {
      logger.error('Failed to receive HL7 message:', error);
      this.emit('messageError', { error, source });
    }
  }

  /**
   * Start message processing
   */
  startProcessing(intervalMs: number = 5000): void {
    if (this.processingInterval) {
      logger.warn('HL7 processing already started');
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processMessageQueue();
    }, intervalMs);

    logger.info('HL7 message processing started');
  }

  /**
   * Stop message processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('HL7 message processing stopped');
    }
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          await this.processMessage(message);
        } catch (error) {
          logger.error('Failed to process HL7 message:', error);
          this.emit('processingError', { message, error });
        }
      }
    }
  }

  /**
   * Process individual HL7 message
   */
  private async processMessage(message: HL7Message): Promise<void> {
    logger.debug(`Processing HL7 message: ${message.messageType}`);

    // TODO: Implement message type specific processing
    switch (message.messageType) {
      case 'ADT^A01': // Admission
        await this.processAdmission(message);
        break;
      case 'ADT^A08': // Update patient information
        await this.processPatientUpdate(message);
        break;
      case 'ORM^O01': // Order message
        await this.processOrder(message);
        break;
      case 'ORU^R01': // Observation result
        await this.processResult(message);
        break;
      default:
        logger.warn(`Unhandled message type: ${message.messageType}`);
    }

    this.emit('messageProcessed', message);
  }

  /**
   * Process admission message
   */
  private async processAdmission(message: HL7Message): Promise<void> {
    logger.debug('Processing admission message');
    // TODO: Implement admission processing logic
  }

  /**
   * Process patient update message
   */
  private async processPatientUpdate(message: HL7Message): Promise<void> {
    logger.debug('Processing patient update message');
    // TODO: Implement patient update processing logic
  }

  /**
   * Process order message
   */
  private async processOrder(message: HL7Message): Promise<void> {
    logger.debug('Processing order message');
    // TODO: Implement order processing logic
  }

  /**
   * Process result message
   */
  private async processResult(message: HL7Message): Promise<void> {
    logger.debug('Processing result message');
    // TODO: Implement result processing logic
  }

  /**
   * Generate unique message control ID
   */
  private generateMessageControlId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}${random}`.toUpperCase();
  }

  /**
   * Map HL7 message type to FHIR resource type
   */
  private mapHL7ToFHIRResourceType(messageType: string): string {
    const mapping: Record<string, string> = {
      'ADT': 'Patient',
      'ORM': 'ServiceRequest',
      'ORU': 'Observation',
      'SIU': 'Appointment',
      'MDM': 'DocumentReference',
      'DFT': 'Claim'
    };

    const prefix = messageType.split('^')[0];
    return mapping[prefix] || 'Basic';
  }

  /**
   * Map FHIR resource type to HL7 message type
   */
  private mapFHIRToHL7MessageType(resourceType: string): string {
    const mapping: Record<string, string> = {
      'Patient': 'ADT^A08',
      'ServiceRequest': 'ORM^O01',
      'Observation': 'ORU^R01',
      'Appointment': 'SIU^S12',
      'DocumentReference': 'MDM^T02',
      'Claim': 'DFT^P03'
    };

    return mapping[resourceType] || 'ACK^A01';
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    return {
      status: 'UP',
      details: {
        queueLength: this.messageQueue.length,
        processing: this.processingInterval !== null,
        configuration: {
          version: this.config.version,
          sendingApplication: this.config.sendingApplication
        }
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.stopProcessing();
    this.removeAllListeners();
    this.messageQueue = [];
    logger.info('HL7 integration service shut down');
  }
}

// Export singleton instance
export const hl7IntegrationService = new HL7IntegrationService();