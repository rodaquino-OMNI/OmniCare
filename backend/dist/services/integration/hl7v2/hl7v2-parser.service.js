"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hl7v2ParserService = exports.HL7v2ParserService = void 0;
const logger_1 = __importDefault(require("@/utils/logger"));
class HL7v2ParserService {
    defaultParsingOptions = {
        fieldSeparator: '|',
        componentSeparator: '^',
        repetitionSeparator: '~',
        escapeCharacter: '\\',
        subcomponentSeparator: '&',
        truncateExtraFields: false,
        allowEmptyFields: true,
        preserveWhitespace: false
    };
    defaultValidationConfig = {
        validateStructure: true,
        validateDataTypes: true,
        validateTableValues: false,
        validateConformance: true,
        strictMode: false,
        version: '2.5.1'
    };
    parseMessage(messageString, options = {}) {
        try {
            const parsingOptions = { ...this.defaultParsingOptions, ...options };
            const cleanMessage = this.cleanMessageString(messageString);
            const segmentStrings = cleanMessage.split(/\r\n|\r|\n/).filter(s => s.trim());
            if (segmentStrings.length === 0) {
                throw new Error('Empty message');
            }
            const mshSegment = this.parseMSHSegment(segmentStrings[0], parsingOptions);
            if (mshSegment.fields.length > 1) {
                const encodingChars = mshSegment.fields[1].value;
                if (encodingChars.length >= 4) {
                    parsingOptions.componentSeparator = encodingChars[0];
                    parsingOptions.repetitionSeparator = encodingChars[1];
                    parsingOptions.escapeCharacter = encodingChars[2];
                    parsingOptions.subcomponentSeparator = encodingChars[3];
                }
            }
            const segments = [];
            for (const segmentString of segmentStrings) {
                const segment = this.parseSegment(segmentString, parsingOptions);
                segments.push(segment);
            }
            const messageInfo = this.extractMessageInfo(mshSegment);
            const message = {
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
            logger_1.default.debug('HL7 v2 message parsed successfully', {
                messageType: message.messageType,
                triggerEvent: message.triggerEvent,
                messageControlId: message.messageControlId,
                segmentCount: segments.length
            });
            return message;
        }
        catch (error) {
            logger_1.default.error('Failed to parse HL7 v2 message:', error);
            throw new Error(`HL7 v2 parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    parseMSHSegment(segmentString, options) {
        const fields = [];
        const parts = segmentString.split(options.fieldSeparator);
        if (parts[0] !== 'MSH') {
            throw new Error('First segment must be MSH');
        }
        for (let i = 1; i < parts.length; i++) {
            if (i === 1) {
                fields.push({ value: parts[i] });
            }
            else {
                const field = this.parseField(parts[i], options);
                fields.push(field);
            }
        }
        return {
            segmentType: 'MSH',
            fields
        };
    }
    parseSegment(segmentString, options) {
        const parts = segmentString.split(options.fieldSeparator);
        const segmentType = parts[0];
        const fields = [];
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
    parseField(fieldString, options) {
        if (!fieldString) {
            return { value: '' };
        }
        if (fieldString.includes(options.repetitionSeparator)) {
            const repetitions = fieldString.split(options.repetitionSeparator);
            const repetitionFields = [];
            for (const repetition of repetitions) {
                repetitionFields.push(this.parseField(repetition, options));
            }
            return {
                value: repetitionFields,
                repetitions: repetitionFields
            };
        }
        if (fieldString.includes(options.componentSeparator)) {
            const componentStrings = fieldString.split(options.componentSeparator);
            const components = [];
            for (const componentString of componentStrings) {
                const component = this.parseComponent(componentString, options);
                components.push(component);
            }
            return {
                value: components,
                components
            };
        }
        return {
            value: this.unescapeString(fieldString, options)
        };
    }
    parseComponent(componentString, options) {
        if (!componentString) {
            return { value: '' };
        }
        if (componentString.includes(options.subcomponentSeparator)) {
            const subcomponentStrings = componentString.split(options.subcomponentSeparator);
            const subcomponents = [];
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
        return {
            value: this.unescapeString(componentString, options)
        };
    }
    unescapeString(str, options) {
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
    cleanMessageString(messageString) {
        let cleaned = messageString;
        cleaned = cleaned.replace(/^\x0B/, '');
        cleaned = cleaned.replace(/\x1C\x0D$/, '');
        cleaned = cleaned.replace(/\x1C$/, '');
        cleaned = cleaned.replace(/\x0D$/, '');
        return cleaned.trim();
    }
    extractMessageInfo(mshSegment) {
        const fields = mshSegment.fields;
        let messageType = '';
        let triggerEvent = '';
        let messageStructure = '';
        if (fields.length > 8 && fields[8].value) {
            const msgTypeField = fields[8];
            if (msgTypeField.components && msgTypeField.components.length > 0) {
                messageType = this.getComponentValue(msgTypeField.components[0]);
                if (msgTypeField.components.length > 1) {
                    triggerEvent = this.getComponentValue(msgTypeField.components[1]);
                }
                if (msgTypeField.components.length > 2) {
                    messageStructure = this.getComponentValue(msgTypeField.components[2]);
                }
            }
            else {
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
            messageControlId: this.getFieldValue(fields, 9) || '',
            sendingApplication: this.getFieldValue(fields, 2) || '',
            sendingFacility: this.getFieldValue(fields, 3) || '',
            receivingApplication: this.getFieldValue(fields, 4) || '',
            receivingFacility: this.getFieldValue(fields, 5) || '',
            timestamp: this.parseHL7DateTime(this.getFieldValue(fields, 6) || ''),
            processingId: this.getFieldValue(fields, 10) || '',
            versionId: this.getFieldValue(fields, 11) || '',
            sequenceNumber: this.parseNumber(this.getFieldValue(fields, 12)),
            continuationPointer: this.getFieldValue(fields, 13),
            acceptAcknowledgmentType: this.getFieldValue(fields, 14),
            applicationAcknowledgmentType: this.getFieldValue(fields, 15),
            countryCode: this.getFieldValue(fields, 16),
            characterSet: this.getFieldValue(fields, 17),
            principalLanguage: this.getFieldValue(fields, 18)
        };
    }
    getFieldValue(fields, index) {
        if (index >= fields.length) {
            return undefined;
        }
        const field = fields[index];
        if (field.components && field.components.length > 0) {
            return this.getComponentValue(field.components[0]);
        }
        return String(field.value || '');
    }
    getComponentValue(component) {
        if (component.subcomponents && component.subcomponents.length > 0) {
            return component.subcomponents[0].value;
        }
        return String(component.value || '');
    }
    parseHL7DateTime(dateTimeString) {
        if (!dateTimeString) {
            return new Date();
        }
        const cleanDateTime = dateTimeString.replace(/[^0-9]/g, '');
        if (cleanDateTime.length < 8) {
            return new Date();
        }
        const year = parseInt(cleanDateTime.substring(0, 4), 10);
        const month = parseInt(cleanDateTime.substring(4, 6), 10) - 1;
        const day = parseInt(cleanDateTime.substring(6, 8), 10);
        const hour = cleanDateTime.length > 8 ? parseInt(cleanDateTime.substring(8, 10), 10) : 0;
        const minute = cleanDateTime.length > 10 ? parseInt(cleanDateTime.substring(10, 12), 10) : 0;
        const second = cleanDateTime.length > 12 ? parseInt(cleanDateTime.substring(12, 14), 10) : 0;
        return new Date(year, month, day, hour, minute, second);
    }
    parseNumber(value) {
        if (!value) {
            return undefined;
        }
        const num = parseInt(value, 10);
        return isNaN(num) ? undefined : num;
    }
    validateMessage(message, config = {}) {
        const validationConfig = { ...this.defaultValidationConfig, ...config };
        const errors = [];
        const warnings = [];
        try {
            if (validationConfig.validateStructure) {
                this.validateMessageStructure(message, errors, warnings);
            }
            if (validationConfig.validateDataTypes) {
                this.validateDataTypes(message, errors, warnings);
            }
            if (validationConfig.validateConformance) {
                this.validateConformance(message, errors, warnings, validationConfig);
            }
            return {
                valid: errors.length === 0,
                errors,
                warnings,
                validatedAt: new Date()
            };
        }
        catch (error) {
            logger_1.default.error('HL7 v2 validation failed:', error);
            return {
                valid: false,
                errors: [{
                        path: 'root',
                        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
                        code: 'validation-error',
                        severity: 'error'
                    }],
                warnings: [],
                validatedAt: new Date()
            };
        }
    }
    validateMessageStructure(message, errors, warnings) {
        if (!message.segments.find(s => s.segmentType === 'MSH')) {
            errors.push({
                path: 'segments',
                message: 'MSH segment is required',
                code: 'required-segment',
                severity: 'error'
            });
        }
        if (!message.messageType) {
            errors.push({
                path: 'messageType',
                message: 'Message type is required',
                code: 'required-field',
                severity: 'error'
            });
        }
        if (!message.messageControlId) {
            errors.push({
                path: 'messageControlId',
                message: 'Message control ID is required',
                code: 'required-field',
                severity: 'error'
            });
        }
    }
    validateDataTypes(message, errors, warnings) {
        for (const segment of message.segments) {
            for (let i = 0; i < segment.fields.length; i++) {
                const field = segment.fields[i];
            }
        }
    }
    validateConformance(message, errors, warnings, config) {
        if (config.messageProfile) {
            warnings.push({
                path: 'root',
                message: 'Message profile validation not yet implemented',
                code: 'not-implemented',
                severity: 'warning'
            });
        }
    }
    generateAcknowledgment(originalMessage, ackCode, textMessage, errorCondition) {
        return {
            messageType: 'ACK',
            messageControlId: originalMessage.messageControlId,
            acknowledgmentCode: ackCode,
            textMessage,
            errorCondition,
            timestamp: new Date()
        };
    }
    acknowledgeToString(ack, sendingApplication = 'OMNICARE', sendingFacility = 'OMNICARE', receivingApplication, receivingFacility) {
        const timestamp = this.formatHL7DateTime(ack.timestamp);
        const processingId = 'P';
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
    formatHL7DateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hour}${minute}${second}`;
    }
    async getHealth() {
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
exports.HL7v2ParserService = HL7v2ParserService;
exports.hl7v2ParserService = new HL7v2ParserService();
//# sourceMappingURL=hl7v2-parser.service.js.map