import { HL7v2Message, HL7v2ParsingOptions, HL7v2ValidationConfig, HL7v2Acknowledgment, HL7v2AckCode, HL7v2ErrorCondition } from '../types/hl7v2.types';
import { ValidationResult } from '../types/integration.types';
export declare class HL7v2ParserService {
    private defaultParsingOptions;
    private defaultValidationConfig;
    parseMessage(messageString: string, options?: Partial<HL7v2ParsingOptions>): HL7v2Message;
    private parseMSHSegment;
    private parseSegment;
    private parseField;
    private parseComponent;
    private unescapeString;
    private cleanMessageString;
    private extractMessageInfo;
    private getFieldValue;
    private getComponentValue;
    private parseHL7DateTime;
    private parseNumber;
    validateMessage(message: HL7v2Message, config?: Partial<HL7v2ValidationConfig>): ValidationResult;
    private validateMessageStructure;
    private validateDataTypes;
    private validateConformance;
    generateAcknowledgment(originalMessage: HL7v2Message, ackCode: HL7v2AckCode, textMessage?: string, errorCondition?: HL7v2ErrorCondition): HL7v2Acknowledgment;
    acknowledgeToString(ack: HL7v2Acknowledgment, sendingApplication?: string, sendingFacility?: string, receivingApplication?: string, receivingFacility?: string): string;
    private formatHL7DateTime;
    getHealth(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare const hl7v2ParserService: HL7v2ParserService;
//# sourceMappingURL=hl7v2-parser.service.d.ts.map