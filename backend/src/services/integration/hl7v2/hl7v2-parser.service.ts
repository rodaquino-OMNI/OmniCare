import {
  HL7v2Message,
  HL7v2Segment,
  HL7v2Field,
  HL7v2Component,
  HL7v2Subcomponent,
  HL7v2ParsingOptions,
  HL7v2ValidationConfig,
  HL7v2ProcessingResult,
  HL7v2Acknowledgment,
  HL7v2AckCode,
  HL7v2ErrorCondition
} from '../types/hl7v2.types';
import { IntegrationValidationResult } from '../types/integration.types';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';

/**
 * HL7 v2 Parser Service
 * Handles parsing, validation, and processing of HL7 v2 messages
 */
export class HL7v2ParserService {
  private defaultParsingOptions: HL7v2ParsingOptions = {
    fieldSeparator: '|',
    componentSeparator: '^',
    repetitionSeparator: '~',
    escapeCharacter: '\\',
    subcomponentSeparator: '&',
    truncateExtraFields: false,
    allowEmptyFields: true,
    preserveWhitespace: false
  };

  private defaultValidationConfig: HL7v2ValidationConfig = {
    validateStructure: true,
    validateDataTypes: true,
    validateTableValues: false,
    validateConformance: true,
    strictMode: false,
    version: '2.5.1'
  };

  /**
   * Parse HL7 v2 message string into structured object
   */
  parseMessage(
    messageString: string,
    options: Partial<HL7v2ParsingOptions> = {}
  ): HL7v2Message {
    try {
      const parsingOptions = { ...this.defaultParsingOptions, ...options };
      
      // Clean the message string
      const cleanMessage = this.cleanMessageString(messageString);
      
      // Split into segments
      const segmentStrings = cleanMessage.split(/\r\n|\r|\n/).filter(s => s.trim());
      
      if (segmentStrings.length === 0) {
        throw new Error('Empty message');
      }

      // Parse MSH segment first to get encoding characters
      const mshSegment = this.parseMSHSegment(segmentStrings[0], parsingOptions);
      
      // Update parsing options with encoding characters from MSH
      if (mshSegment.fields.length > 1) {
        const encodingChars = mshSegment.fields[1].value as string;
        if (encodingChars.length >= 4) {
          parsingOptions.componentSeparator = encodingChars[0];
          parsingOptions.repetitionSeparator = encodingChars[1];
          parsingOptions.escapeCharacter = encodingChars[2];
          parsingOptions.subcomponentSeparator = encodingChars[3];
        }
      }

      // Parse all segments
      const segments: HL7v2Segment[] = [];
      for (const segmentString of segmentStrings) {
        const segment = this.parseSegment(segmentString, parsingOptions);
        segments.push(segment);
      }

      // Extract message header information
      const messageInfo = this.extractMessageInfo(mshSegment);

      const message: HL7v2Message = {
        messageType: messageInfo.messageType,
        triggerEvent: messageInfo.triggerEvent,
        messageStructure: messageInfo.messageStructure,
        messageControlId: messageInfo.messageControlId,
        sendingApplication: messageInfo.sendingApplication,
        sendingFacility: messageInfo.sendingFacility,
        receivingApplication: messageInfo.receivingApplication,
        receivingFacility: messageInfo.receivingFacility,
        timestamp: messageInfo.timestamp,
        processingId: messageInfo.processingId,
        versionId: messageInfo.versionId,
        sequenceNumber: messageInfo.sequenceNumber,
        continuationPointer: messageInfo.continuationPointer,
        acceptAcknowledgmentType: messageInfo.acceptAcknowledgmentType,
        applicationAcknowledgmentType: messageInfo.applicationAcknowledgmentType,
        countryCode: messageInfo.countryCode,
        characterSet: messageInfo.characterSet,
        principalLanguage: messageInfo.principalLanguage,
        segments,
        rawMessage: messageString
      };

      logger.debug('HL7 v2 message parsed successfully', {
        messageType: message.messageType,
        triggerEvent: message.triggerEvent,
        messageControlId: message.messageControlId,
        segmentCount: segments.length
      });

      return message;
    } catch (error) {
      logger.error('Failed to parse HL7 v2 message:', error);
      throw new Error(`HL7 v2 parsing failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Parse MSH segment with special handling for encoding characters
   */
  private parseMSHSegment(
    segmentString: string,
    options: HL7v2ParsingOptions
  ): HL7v2Segment {
    const fields: HL7v2Field[] = [];
    const parts = segmentString.split(options.fieldSeparator);
    
    if (parts[0] !== 'MSH') {
      throw new Error('First segment must be MSH');
    }

    // MSH segment has special structure
    // MSH|^~\&|...
    // Field 1 is the encoding characters
    for (let i = 1; i < parts.length; i++) {
      if (i === 1) {
        // Encoding characters field
        fields.push({ value: parts[i] });
      } else {
        // Regular field parsing
        const field = this.parseField(parts[i], options);
        fields.push(field);
      }
    }

    return {
      segmentType: 'MSH',
      fields
    };
  }

  /**
   * Parse a single segment
   */
  private parseSegment(
    segmentString: string,
    options: HL7v2ParsingOptions
  ): HL7v2Segment {
    const parts = segmentString.split(options.fieldSeparator);
    const segmentType = parts[0];
    const fields: HL7v2Field[] = [];

    // Skip the segment type (index 0)
    for (let i = 1; i < parts.length; i++) {
      const fieldString = parts[i];
      const field = this.parseField(fieldString, options);
      fields.push(field);
    }

    return {
      segmentType,
      fields
    };
  }

  /**
   * Parse a field
   */
  private parseField(
    fieldString: string,
    options: HL7v2ParsingOptions
  ): HL7v2Field {
    if (!fieldString) {
      return { value: '' };
    }

    // Check for repetitions first
    if (fieldString.includes(options.repetitionSeparator)) {
      const repetitions = fieldString.split(options.repetitionSeparator);
      const repetitionFields: HL7v2Field[] = [];
      
      for (const repetition of repetitions) {
        repetitionFields.push(this.parseField(repetition, options));
      }
      
      return {
        value: repetitionFields,
        repetitions: repetitionFields
      };
    }

    // Check for components
    if (fieldString.includes(options.componentSeparator)) {
      const componentStrings = fieldString.split(options.componentSeparator);
      const components: HL7v2Component[] = [];
      
      for (const componentString of componentStrings) {
        const component = this.parseComponent(componentString, options);
        components.push(component);
      }
      
      return {
        value: components,
        components
      };
    }

    // Simple field with no components or repetitions
    return {
      value: this.unescapeString(fieldString, options)
    };
  }

  /**
   * Parse a component
   */
  private parseComponent(
    componentString: string,
    options: HL7v2ParsingOptions
  ): HL7v2Component {
    if (!componentString) {
      return { value: '' };
    }

    // Check for subcomponents
    if (componentString.includes(options.subcomponentSeparator)) {
      const subcomponentStrings = componentString.split(options.subcomponentSeparator);
      const subcomponents: HL7v2Subcomponent[] = [];
      
      for (const subcomponentString of subcomponentStrings) {
        subcomponents.push({
          value: this.unescapeString(subcomponentString, options)
        });
      }
      
      return {
        value: subcomponents,
        subcomponents
      };
    }

    // Simple component with no subcomponents
    return {
      value: this.unescapeString(componentString, options)
    };
  }

  /**
   * Unescape HL7 v2 escape sequences
   */
  private unescapeString(
    str: string,
    options: HL7v2ParsingOptions
  ): string {
    if (!str || !str.includes(options.escapeCharacter)) {
      return str;
    }

    const escapeChar = options.escapeCharacter;
    return str
      .replace(new RegExp(`${escapeChar}F${escapeChar}`, 'g'), options.fieldSeparator)
      .replace(new RegExp(`${escapeChar}S${escapeChar}`, 'g'), options.componentSeparator)
      .replace(new RegExp(`${escapeChar}T${escapeChar}`, 'g'), options.subcomponentSeparator)
      .replace(new RegExp(`${escapeChar}R${escapeChar}`, 'g'), options.repetitionSeparator)
      .replace(new RegExp(`${escapeChar}E${escapeChar}`, 'g'), options.escapeCharacter)
      .replace(new RegExp(`${escapeChar}\.br${escapeChar}`, 'g'), '\n');
  }

  /**
   * Clean message string by removing MLLP wrappers and normalizing line endings
   */
  private cleanMessageString(messageString: string): string {
    let cleaned = messageString;
    
    // Remove MLLP start and end blocks
    cleaned = cleaned.replace(/^\x0B/, ''); // Start block
    cleaned = cleaned.replace(/\x1C\x0D$/, ''); // End block and carriage return
    cleaned = cleaned.replace(/\x1C$/, ''); // End block only
    cleaned = cleaned.replace(/\x0D$/, ''); // Carriage return only
    
    return cleaned.trim();
  }

  /**
   * Extract message information from MSH segment
   */
  private extractMessageInfo(mshSegment: HL7v2Segment): any {
    const fields = mshSegment.fields;
    
    // Parse message type (MSH.9) - adjust for 0-based indexing
    let messageType = '';
    let triggerEvent = '';
    let messageStructure = '';
    
    if (fields.length > 7 && fields[7].value) {
      const msgTypeField = fields[7];
      if (msgTypeField.components && msgTypeField.components.length > 0) {
        messageType = this.getComponentValue(msgTypeField.components[0]);
        if (msgTypeField.components.length > 1) {
          triggerEvent = this.getComponentValue(msgTypeField.components[1]);
        }
        if (msgTypeField.components.length > 2) {
          messageStructure = this.getComponentValue(msgTypeField.components[2]);
        }
      } else {
        // Simple string format like "ADT^A01"
        const msgTypeString = String(msgTypeField.value);
        const parts = msgTypeString.split('^');
        messageType = parts[0] || '';
        triggerEvent = parts[1] || '';
        messageStructure = parts[2] || '';
      }
    }

    return {
      messageType,
      triggerEvent,
      messageStructure,
      messageControlId: this.getFieldValue(fields, 8) || '',
      sendingApplication: this.getFieldValue(fields, 1) || '',
      sendingFacility: this.getFieldValue(fields, 2) || '',
      receivingApplication: this.getFieldValue(fields, 3) || '',
      receivingFacility: this.getFieldValue(fields, 4) || '',
      timestamp: this.parseHL7DateTime(this.getFieldValue(fields, 5) || ''),
      processingId: this.getFieldValue(fields, 9) || '',
      versionId: this.getFieldValue(fields, 10) || '',
      sequenceNumber: this.parseNumber(this.getFieldValue(fields, 12)),
      continuationPointer: this.getFieldValue(fields, 13),
      acceptAcknowledgmentType: this.getFieldValue(fields, 14),
      applicationAcknowledgmentType: this.getFieldValue(fields, 15),
      countryCode: this.getFieldValue(fields, 16),
      characterSet: this.getFieldValue(fields, 17),
      principalLanguage: this.getFieldValue(fields, 18)
    };
  }

  /**
   * Get field value as string
   */
  private getFieldValue(fields: HL7v2Field[], index: number): string | undefined {
    if (index >= fields.length) {
      return undefined;
    }
    
    const field = fields[index];
    if (field.components && field.components.length > 0) {
      return this.getComponentValue(field.components[0]);
    }
    
    return String(field.value || '');
  }

  /**
   * Get component value as string
   */
  private getComponentValue(component: HL7v2Component): string {
    if (component.subcomponents && component.subcomponents.length > 0) {
      return component.subcomponents[0].value;
    }
    
    return String(component.value || '');
  }

  /**
   * Parse HL7 date/time string
   */
  private parseHL7DateTime(dateTimeString: string): Date {
    if (!dateTimeString) {
      return new Date();
    }

    // HL7 format: YYYYMMDDHHMMSS[.SSSS][+/-ZZZZ]
    const cleanDateTime = dateTimeString.replace(/[^0-9]/g, '');
    
    if (cleanDateTime.length < 8) {
      return new Date();
    }

    const year = parseInt(cleanDateTime.substring(0, 4), 10);
    const month = parseInt(cleanDateTime.substring(4, 6), 10) - 1; // JS months are 0-based
    const day = parseInt(cleanDateTime.substring(6, 8), 10);
    const hour = cleanDateTime.length > 8 ? parseInt(cleanDateTime.substring(8, 10), 10) : 0;
    const minute = cleanDateTime.length > 10 ? parseInt(cleanDateTime.substring(10, 12), 10) : 0;
    const second = cleanDateTime.length > 12 ? parseInt(cleanDateTime.substring(12, 14), 10) : 0;

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Parse number from string
   */
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Validate HL7 v2 message
   */
  validateMessage(
    message: HL7v2Message,
    config: Partial<HL7v2ValidationConfig> = {}
  ): ValidationResult {
    const validationConfig = { ...this.defaultValidationConfig, ...config };
    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      // Structure validation
      if (validationConfig.validateStructure) {
        this.validateMessageStructure(message, errors, warnings);
      }

      // Data type validation
      if (validationConfig.validateDataTypes) {
        this.validateDataTypes(message, errors, warnings);
      }

      // Conformance validation
      if (validationConfig.validateConformance) {
        this.validateConformance(message, errors, warnings, validationConfig);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        validatedAt: new Date()
      };
    } catch (error) {
      logger.error('HL7 v2 validation failed:', error);
      return {
        valid: false,
        errors: [{
          path: 'root',
          message: `Validation failed: ${getErrorMessage(error)}`,
          code: 'validation-error',
          severity: 'error'
        }],
        warnings: [],
        validatedAt: new Date()
      };
    }
  }

  /**
   * Validate message structure
   */
  private validateMessageStructure(
    message: HL7v2Message,
    errors: any[],
    warnings: any[]
  ): void {
    // Check for required MSH segment
    if (!message.segments.find(s => s.segmentType === 'MSH')) {
      errors.push({
        path: 'segments',
        message: 'MSH segment is required',
        code: 'required-segment',
        severity: 'error'
      });
    }

    // Check message type
    if (!message.messageType) {
      errors.push({
        path: 'messageType',
        message: 'Message type is required',
        code: 'required-field',
        severity: 'error'
      });
    }

    // Check message control ID
    if (!message.messageControlId) {
      errors.push({
        path: 'messageControlId',
        message: 'Message control ID is required',
        code: 'required-field',
        severity: 'error'
      });
    }
  }

  /**
   * Validate data types
   */
  private validateDataTypes(
    message: HL7v2Message,
    errors: any[],
    warnings: any[]
  ): void {
    // Basic data type validation
    for (const segment of message.segments) {
      for (let i = 0; i < segment.fields.length; i++) {
        const field = segment.fields[i];
        // Add specific data type validation logic here
        // This would depend on the segment type and field position
      }
    }
  }

  /**
   * Validate conformance
   */
  private validateConformance(
    message: HL7v2Message,
    errors: any[],
    warnings: any[],
    config: HL7v2ValidationConfig
  ): void {
    // Conformance validation would check against message profiles
    // This is a placeholder for more complex conformance checking
    if (config.messageProfile) {
      // Load and validate against message profile
      warnings.push({
        path: 'root',
        message: 'Message profile validation not yet implemented',
        code: 'not-implemented',
        severity: 'warning'
      });
    }
  }

  /**
   * Generate ACK message
   */
  generateAcknowledgment(
    originalMessage: HL7v2Message,
    ackCode: HL7v2AckCode,
    textMessage?: string,
    errorCondition?: HL7v2ErrorCondition
  ): HL7v2Acknowledgment {
    return {
      messageType: 'ACK',
      messageControlId: originalMessage.messageControlId,
      acknowledgmentCode: ackCode,
      textMessage,
      errorCondition,
      timestamp: new Date()
    };
  }

  /**
   * Convert acknowledgment to HL7 v2 string
   */
  acknowledgeToString(
    ack: HL7v2Acknowledgment,
    sendingApplication: string = 'OMNICARE',
    sendingFacility: string = 'OMNICARE',
    receivingApplication?: string,
    receivingFacility?: string
  ): string {
    const timestamp = this.formatHL7DateTime(ack.timestamp);
    const processingId = 'P'; // Production
    const versionId = '2.5.1';
    
    let msh = `MSH|^~\\&|${sendingApplication}|${sendingFacility}|${receivingApplication || ''}|${receivingFacility || ''}|${timestamp}||ACK|${ack.messageControlId}|${processingId}|${versionId}`;
    
    let msa = `MSA|${ack.acknowledgmentCode}|${ack.messageControlId}`;
    if (ack.textMessage) {
      msa += `|${ack.textMessage}`;
    }
    
    let ackString = msh + '\r' + msa;
    
    if (ack.errorCondition) {
      let err = `ERR|||${ack.errorCondition.errorCode}`;
      if (ack.errorCondition.errorDescription) {
        err += `||||${ack.errorCondition.errorDescription}`;
      }
      ackString += '\r' + err;
    }
    
    return ackString;
  }

  /**
   * Format date to HL7 v2 format
   */
  private formatHL7DateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<{ status: string; details: any }> {
    return {
      status: 'UP',
      details: {
        parserVersion: '1.0.0',
        supportedHL7Version: '2.5.1',
        supportedMessageTypes: [
          'ADT', 'ORM', 'ORU', 'SIU', 'DFT', 'MFN', 'RAS', 'RDE', 'RDS', 'MDM'
        ]
      }
    };
  }
}

// Export singleton instance
export const hl7v2ParserService = new HL7v2ParserService();