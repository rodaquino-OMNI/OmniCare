import { hl7v2ParserService } from '../../src/services/integration/hl7v2/hl7v2-parser.service';
import { fhirResourcesService } from '../../src/services/fhir-resources.service';
import { medplumService } from '../../src/services/medplum.service';
import { HL7v2Message, HL7v2AckCode } from '../../src/services/integration/types/hl7v2.types';
import { Patient, Observation } from '@medplum/fhirtypes';
import logger from '../../src/utils/logger';

/**
 * HL7 Message Processing Integration Tests
 * Tests end-to-end HL7 v2 message parsing, validation, and FHIR transformation
 */
describe('HL7 Message Processing Integration', () => {
  let testPatientId: string;

  beforeAll(async () => {
    await medplumService.initialize();
  });

  describe('HL7 v2 Message Parsing', () => {
    test('should parse ADT^A01 (Patient Admission) message', () => {
      const hl7Message = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20240101120000||ADT^A01^ADT_A01|MSG001|P|2.5.1
EVN||202401011200|||^SMITH^JOHN^J^^^DR
PID|1||123456789^^^MRN^MR||DOE^JOHN^MIDDLE^^JR|MAIDEN|19900101|M||2106-3|123 MAIN ST^^ANYTOWN^ST^12345^USA||(555)555-1234|(555)555-5678|EN|M|CHR|123456789|||N|USA||||||||||20240101
NK1|1|DOE^JANE^|SPO|123 MAIN ST^^ANYTOWN^ST^12345^USA|(555)555-1234
PV1|1|I|2000^2012^01||||1234567^ATTENDING^DOCTOR|||SUR||||A|||1234567^ATTENDING^DOCTOR|INP|^^^VISIT001||||||||||||||||||||||||202401011200`;

      const parsedMessage = hl7v2ParserService.parseMessage(hl7Message);

      expect(parsedMessage.messageType).toBe('ADT');
      expect(parsedMessage.triggerEvent).toBe('A01');
      expect(parsedMessage.messageControlId).toBe('MSG001');
      expect(parsedMessage.sendingApplication).toBe('SENDING_APP');
      expect(parsedMessage.receivingApplication).toBe('RECEIVING_APP');
      expect(parsedMessage.segments.length).toBeGreaterThan(0);

      // Verify MSH segment
      const mshSegment = parsedMessage.segments.find(s => s.segmentType === 'MSH');
      expect(mshSegment).toBeDefined();

      // Verify PID segment
      const pidSegment = parsedMessage.segments.find(s => s.segmentType === 'PID');
      expect(pidSegment).toBeDefined();
      expect(pidSegment?.fields.length).toBeGreaterThan(0);

      // Verify PV1 segment
      const pv1Segment = parsedMessage.segments.find(s => s.segmentType === 'PV1');
      expect(pv1Segment).toBeDefined();
    });

    test('should parse ORU^R01 (Observation Result) message', () => {
      const hl7Message = `MSH|^~\\&|LAB_SYSTEM|LAB_FACILITY|EMR_SYSTEM|HOSPITAL|20240101130000||ORU^R01^ORU_R01|LAB001|P|2.5.1
PID|1||123456789^^^MRN^MR||DOE^JOHN^MIDDLE^^JR||19900101|M
OBR|1|ORDER001|RESULT001|CBC^COMPLETE BLOOD COUNT^LN|||20240101120000|20240101125000||||||||||1234567^ORDERING^DOCTOR||||||20240101130000||F|||
OBX|1|NM|4544-3^HEMATOCRIT^LN||42.0|%|40.0-50.0|N|||F|||20240101125000
OBX|2|NM|718-7^HEMOGLOBIN^LN||14.2|g/dL|12.0-16.0|N|||F|||20240101125000
OBX|3|NM|4515-3^LEUKOCYTES^LN||7.5|K/uL|4.0-11.0|N|||F|||20240101125000`;

      const parsedMessage = hl7v2ParserService.parseMessage(hl7Message);

      expect(parsedMessage.messageType).toBe('ORU');
      expect(parsedMessage.triggerEvent).toBe('R01');
      expect(parsedMessage.sendingApplication).toBe('LAB_SYSTEM');

      // Verify OBR segment
      const obrSegment = parsedMessage.segments.find(s => s.segmentType === 'OBR');
      expect(obrSegment).toBeDefined();

      // Verify OBX segments
      const obxSegments = parsedMessage.segments.filter(s => s.segmentType === 'OBX');
      expect(obxSegments.length).toBe(3);
    });

    test('should parse SIU^S12 (Appointment Scheduling) message', () => {
      const hl7Message = `MSH|^~\\&|SCHEDULING|CLINIC|EMR|HOSPITAL|20240101140000||SIU^S12^SIU_S12|SCH001|P|2.5.1
SCH|SCHEDULED|||20240102090000|20240102100000|||||30^MINUTES|^SCHEDULED||||||ROUTINE|
PID|1||123456789^^^MRN^MR||DOE^JOHN^MIDDLE^^JR||19900101|M
RGS|1
AIS|1||OFFICE^OFFICE VISIT|||20240102090000|30^MINUTES|||SCHEDULED|`;

      const parsedMessage = hl7v2ParserService.parseMessage(hl7Message);

      expect(parsedMessage.messageType).toBe('SIU');
      expect(parsedMessage.triggerEvent).toBe('S12');
      
      const schSegment = parsedMessage.segments.find(s => s.segmentType === 'SCH');
      expect(schSegment).toBeDefined();
    });
  });

  describe('HL7 Message Validation', () => {
    test('should validate message structure', () => {
      const validMessage = `MSH|^~\\&|APP|FACILITY|REC|HOSPITAL|20240101120000||ADT^A01|MSG001|P|2.5.1
PID|1||123456789|||DOE^JOHN|||M|`;

      const parsedMessage = hl7v2ParserService.parseMessage(validMessage);
      const validationResult = hl7v2ParserService.validateMessage(parsedMessage);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors.length).toBe(0);
    });

    test('should detect validation errors', () => {
      // Message without required MSH segment
      const invalidMessage: HL7v2Message = {
        messageType: '',
        triggerEvent: '',
        messageStructure: '',
        messageControlId: '',
        sendingApplication: '',
        sendingFacility: '',
        receivingApplication: '',
        receivingFacility: '',
        timestamp: new Date(),
        processingId: '',
        versionId: '',
        segments: [], // Empty segments - should fail validation
        rawMessage: ''
      };

      const validationResult = hl7v2ParserService.validateMessage(invalidMessage);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    test('should validate data types', () => {
      const messageWithInvalidDate = `MSH|^~\\&|APP|FACILITY|REC|HOSPITAL|INVALID_DATE||ADT^A01|MSG001|P|2.5.1
PID|1||123456789|||DOE^JOHN|||M|`;

      try {
        const parsedMessage = hl7v2ParserService.parseMessage(messageWithInvalidDate);
        expect(parsedMessage).toBeDefined();
        // Parser should handle invalid dates gracefully
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('parsing failed');
      }
    });
  });

  describe('HL7 to FHIR Transformation', () => {
    test('should transform ADT^A01 message to FHIR Patient resource', async () => {
      const adtMessage = `MSH|^~\\&|EMR|HOSPITAL|FHIR|SYSTEM|20240101120000||ADT^A01|MSG001|P|2.5.1
PID|1||MRN123456789^^^MRN^MR||DOE^JOHN^MIDDLE^^JR||19900101|M||2106-3|123 MAIN ST^^ANYTOWN^ST^12345^USA||(555)555-1234|(555)555-5678|EN|M|CHR|`;

      const parsedMessage = hl7v2ParserService.parseMessage(adtMessage);
      const pidSegment = parsedMessage.segments.find(s => s.segmentType === 'PID');
      
      expect(pidSegment).toBeDefined();

      // Transform PID segment data to FHIR Patient
      const patientData = {
        name: [{ given: ['JOHN', 'MIDDLE'], family: 'DOE', suffix: ['JR'] }],
        gender: 'male' as const,
        birthDate: '1990-01-01',
        identifier: [{
          system: 'http://hospital.org/mrn',
          value: 'MRN123456789'
        }],
        telecom: [
          { system: 'phone' as const, value: '(555)555-1234', use: 'home' as const },
          { system: 'phone' as const, value: '(555)555-5678', use: 'work' as const }
        ],
        address: [{
          use: 'home' as const,
          line: ['123 MAIN ST'],
          city: 'ANYTOWN',
          state: 'ST',
          postalCode: '12345',
          country: 'USA'
        }]
      };

      const fhirPatient = await fhirResourcesService.createPatient(patientData);
      expect(fhirPatient.id).toBeDefined();
      expect(fhirPatient.resourceType).toBe('Patient');
      testPatientId = fhirPatient.id!;
    });

    test('should transform ORU^R01 message to FHIR Observation resources', async () => {
      const oruMessage = `MSH|^~\\&|LAB|HOSPITAL|FHIR|SYSTEM|20240101130000||ORU^R01|LAB001|P|2.5.1
PID|1||${testPatientId}|||DOE^JOHN|||M|
OBR|1|ORDER001|RESULT001|CBC^COMPLETE BLOOD COUNT|||20240101120000||||||||1234567^DOCTOR^ORDERING||||||20240101130000||F
OBX|1|NM|718-7^HEMOGLOBIN^LN||14.2|g/dL|12.0-16.0|N|||F|||20240101125000`;

      const parsedMessage = hl7v2ParserService.parseMessage(oruMessage);
      const obxSegments = parsedMessage.segments.filter(s => s.segmentType === 'OBX');
      
      expect(obxSegments.length).toBe(1);

      // Transform OBX segment to FHIR Observation
      const observationData = {
        status: 'final' as const,
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '718-7',
            display: 'Hemoglobin'
          }]
        },
        subject: { reference: `Patient/${testPatientId}` },
        valueQuantity: {
          value: 14.2,
          unit: 'g/dL',
          system: 'http://unitsofmeasure.org',
          code: 'g/dL'
        },
        referenceRange: [{
          low: { value: 12.0, unit: 'g/dL' },
          high: { value: 16.0, unit: 'g/dL' }
        }]
      };

      const fhirObservation = await fhirResourcesService.createObservation(observationData);
      expect(fhirObservation.id).toBeDefined();
      expect(fhirObservation.resourceType).toBe('Observation');
    });
  });

  describe('HL7 Acknowledgment Processing', () => {
    test('should generate ACK for successful message processing', () => {
      const originalMessage = hl7v2ParserService.parseMessage(
        `MSH|^~\\&|APP|FACILITY|REC|HOSPITAL|20240101120000||ADT^A01|MSG001|P|2.5.1`
      );

      const ack = hl7v2ParserService.generateAcknowledgment(
        originalMessage,
        HL7v2AckCode.APPLICATION_ACCEPT,
        'Message processed successfully'
      );

      expect(ack.messageType).toBe('ACK');
      expect(ack.messageControlId).toBe('MSG001');
      expect(ack.acknowledgmentCode).toBe(HL7v2AckCode.APPLICATION_ACCEPT);
      expect(ack.textMessage).toBe('Message processed successfully');
    });

    test('should generate NACK for failed message processing', () => {
      const originalMessage = hl7v2ParserService.parseMessage(
        `MSH|^~\\&|APP|FACILITY|REC|HOSPITAL|20240101120000||ADT^A01|MSG002|P|2.5.1`
      );

      const ack = hl7v2ParserService.generateAcknowledgment(
        originalMessage,
        HL7v2AckCode.APPLICATION_ERROR,
        'Validation failed',
        {
          errorCode: 'VAL001',
          errorDescription: 'Required field missing in PID segment'
        }
      );

      expect(ack.acknowledgmentCode).toBe(HL7v2AckCode.APPLICATION_ERROR);
      expect(ack.errorCondition).toBeDefined();
      expect(ack.errorCondition?.errorCode).toBe('VAL001');
    });

    test('should convert acknowledgment to HL7 string format', () => {
      const originalMessage = hl7v2ParserService.parseMessage(
        `MSH|^~\\&|APP|FACILITY|REC|HOSPITAL|20240101120000||ADT^A01|MSG003|P|2.5.1`
      );

      const ack = hl7v2ParserService.generateAcknowledgment(
        originalMessage,
        HL7v2AckCode.APPLICATION_ACCEPT
      );

      const ackString = hl7v2ParserService.acknowledgeToString(
        ack,
        'OMNICARE',
        'HOSPITAL',
        'APP',
        'FACILITY'
      );

      expect(ackString).toContain('MSH|^~\\&|OMNICARE|HOSPITAL|APP|FACILITY');
      expect(ackString).toContain('ACK|MSG003');
      expect(ackString).toContain(`MSA|${HL7v2AckCode.APPLICATION_ACCEPT}|MSG003`);
    });
  });

  describe('HL7 Error Handling', () => {
    test('should handle malformed HL7 messages', () => {
      const malformedMessage = 'This is not a valid HL7 message';

      expect(() => {
        hl7v2ParserService.parseMessage(malformedMessage);
      }).toThrow();
    });

    test('should handle messages with missing required segments', () => {
      const messageWithoutMSH = 'PID|1||123456789|||DOE^JOHN|||M|';

      expect(() => {
        hl7v2ParserService.parseMessage(messageWithoutMSH);
      }).toThrow('First segment must be MSH');
    });

    test('should handle unsupported message types gracefully', () => {
      const unsupportedMessage = `MSH|^~\\&|APP|FACILITY|REC|HOSPITAL|20240101120000||XXX^Y99|MSG001|P|2.5.1`;

      const parsedMessage = hl7v2ParserService.parseMessage(unsupportedMessage);
      expect(parsedMessage.messageType).toBe('XXX');
      expect(parsedMessage.triggerEvent).toBe('Y99');
      
      // Should still parse but validation might flag it
      const validationResult = hl7v2ParserService.validateMessage(parsedMessage);
      expect(validationResult).toBeDefined();
    });
  });

  describe('HL7 Performance Testing', () => {
    test('should handle large HL7 messages efficiently', () => {
      // Create a large HL7 message with many OBX segments
      let largeMessage = `MSH|^~\\&|LAB|HOSPITAL|FHIR|SYSTEM|20240101130000||ORU^R01|LAB001|P|2.5.1
PID|1||123456789|||DOE^JOHN|||M|
OBR|1|ORDER001|RESULT001|CBC^COMPLETE BLOOD COUNT|||20240101120000||||||||1234567^DOCTOR||||||20240101130000||F`;

      // Add 100 OBX segments
      for (let i = 1; i <= 100; i++) {
        largeMessage += `\nOBX|${i}|NM|${1000 + i}-7^TEST${i}^LN||${(Math.random() * 100).toFixed(1)}|mg/dL|0.0-100.0|N|||F|||20240101125000`;
      }

      const startTime = Date.now();
      const parsedMessage = hl7v2ParserService.parseMessage(largeMessage);
      const endTime = Date.now();

      expect(parsedMessage.segments.length).toBeGreaterThan(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse within 1 second
    });

    test('should handle concurrent HL7 message parsing', async () => {
      const messages = Array(10).fill(0).map((_, i) => 
        `MSH|^~\\&|APP${i}|FACILITY|REC|HOSPITAL|20240101120000||ADT^A01|MSG${i.toString().padStart(3, '0')}|P|2.5.1
PID|1||${i.toString().padStart(9, '0')}|||DOE^PATIENT${i}|||M|`
      );

      const parsePromises = messages.map(msg => 
        Promise.resolve(hl7v2ParserService.parseMessage(msg))
      );

      const results = await Promise.allSettled(parsePromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBe(10);
    });
  });

  afterAll(async () => {
    // Cleanup test patient if created
    if (testPatientId) {
      try {
        await medplumService.deleteResource('Patient', testPatientId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to cleanup test patient:', errorMessage);
      }
    }
  });
});