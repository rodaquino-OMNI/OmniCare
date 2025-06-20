"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationService = exports.ValidationService = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = __importDefault(require("@/utils/logger"));
class ValidationService {
    fhirResourceSchemas = {
        Patient: joi_1.default.object({
            resourceType: joi_1.default.string().valid('Patient').required(),
            id: joi_1.default.string().pattern(/^[A-Za-z0-9\-\.]{1,64}$/),
            meta: joi_1.default.object(),
            implicitRules: joi_1.default.string().uri(),
            language: joi_1.default.string(),
            text: joi_1.default.object(),
            contained: joi_1.default.array(),
            extension: joi_1.default.array(),
            modifierExtension: joi_1.default.array(),
            identifier: joi_1.default.array().items(joi_1.default.object({
                use: joi_1.default.string().valid('usual', 'official', 'temp', 'secondary', 'old'),
                type: joi_1.default.object(),
                system: joi_1.default.string().uri(),
                value: joi_1.default.string().required(),
                period: joi_1.default.object(),
                assigner: joi_1.default.object(),
            })),
            active: joi_1.default.boolean(),
            name: joi_1.default.array().items(joi_1.default.object({
                use: joi_1.default.string().valid('usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'),
                text: joi_1.default.string(),
                family: joi_1.default.string(),
                given: joi_1.default.array().items(joi_1.default.string()),
                prefix: joi_1.default.array().items(joi_1.default.string()),
                suffix: joi_1.default.array().items(joi_1.default.string()),
                period: joi_1.default.object(),
            })),
            telecom: joi_1.default.array().items(joi_1.default.object({
                system: joi_1.default.string().valid('phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'),
                value: joi_1.default.string().required(),
                use: joi_1.default.string().valid('home', 'work', 'temp', 'old', 'mobile'),
                rank: joi_1.default.number().integer().min(1),
                period: joi_1.default.object(),
            })),
            gender: joi_1.default.string().valid('male', 'female', 'other', 'unknown'),
            birthDate: joi_1.default.string().pattern(/^\d{4}(-\d{2}(-\d{2})?)?$/),
            deceasedBoolean: joi_1.default.boolean(),
            deceasedDateTime: joi_1.default.string().isoDate(),
            address: joi_1.default.array().items(joi_1.default.object({
                use: joi_1.default.string().valid('home', 'work', 'temp', 'old', 'billing'),
                type: joi_1.default.string().valid('postal', 'physical', 'both'),
                text: joi_1.default.string(),
                line: joi_1.default.array().items(joi_1.default.string()),
                city: joi_1.default.string(),
                district: joi_1.default.string(),
                state: joi_1.default.string(),
                postalCode: joi_1.default.string(),
                country: joi_1.default.string(),
                period: joi_1.default.object(),
            })),
            maritalStatus: joi_1.default.object(),
            multipleBirthBoolean: joi_1.default.boolean(),
            multipleBirthInteger: joi_1.default.number().integer(),
            photo: joi_1.default.array(),
            contact: joi_1.default.array(),
            communication: joi_1.default.array(),
            generalPractitioner: joi_1.default.array(),
            managingOrganization: joi_1.default.object(),
            link: joi_1.default.array(),
        }),
        Observation: joi_1.default.object({
            resourceType: joi_1.default.string().valid('Observation').required(),
            id: joi_1.default.string().pattern(/^[A-Za-z0-9\-\.]{1,64}$/),
            meta: joi_1.default.object(),
            implicitRules: joi_1.default.string().uri(),
            language: joi_1.default.string(),
            text: joi_1.default.object(),
            contained: joi_1.default.array(),
            extension: joi_1.default.array(),
            modifierExtension: joi_1.default.array(),
            identifier: joi_1.default.array(),
            basedOn: joi_1.default.array(),
            partOf: joi_1.default.array(),
            status: joi_1.default.string().valid('registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown').required(),
            category: joi_1.default.array().items(joi_1.default.object()).min(1),
            code: joi_1.default.object({
                coding: joi_1.default.array().items(joi_1.default.object({
                    system: joi_1.default.string().uri(),
                    version: joi_1.default.string(),
                    code: joi_1.default.string().required(),
                    display: joi_1.default.string(),
                    userSelected: joi_1.default.boolean(),
                })),
                text: joi_1.default.string(),
            }).required(),
            subject: joi_1.default.object({
                reference: joi_1.default.string().required(),
                type: joi_1.default.string(),
                identifier: joi_1.default.object(),
                display: joi_1.default.string(),
            }).required(),
            focus: joi_1.default.array(),
            encounter: joi_1.default.object(),
            effectiveDateTime: joi_1.default.string().isoDate(),
            effectivePeriod: joi_1.default.object(),
            effectiveTiming: joi_1.default.object(),
            effectiveInstant: joi_1.default.string().isoDate(),
            issued: joi_1.default.string().isoDate(),
            performer: joi_1.default.array(),
            valueQuantity: joi_1.default.object({
                value: joi_1.default.number(),
                comparator: joi_1.default.string().valid('<', '<=', '>=', '>'),
                unit: joi_1.default.string(),
                system: joi_1.default.string().uri(),
                code: joi_1.default.string(),
            }),
            valueCodeableConcept: joi_1.default.object(),
            valueString: joi_1.default.string(),
            valueBoolean: joi_1.default.boolean(),
            valueInteger: joi_1.default.number().integer(),
            valueRange: joi_1.default.object(),
            valueRatio: joi_1.default.object(),
            valueSampledData: joi_1.default.object(),
            valueTime: joi_1.default.string(),
            valueDateTime: joi_1.default.string().isoDate(),
            valuePeriod: joi_1.default.object(),
            dataAbsentReason: joi_1.default.object(),
            interpretation: joi_1.default.array(),
            note: joi_1.default.array(),
            bodySite: joi_1.default.object(),
            method: joi_1.default.object(),
            specimen: joi_1.default.object(),
            device: joi_1.default.object(),
            referenceRange: joi_1.default.array(),
            hasMember: joi_1.default.array(),
            derivedFrom: joi_1.default.array(),
            component: joi_1.default.array(),
        }),
        MedicationRequest: joi_1.default.object({
            resourceType: joi_1.default.string().valid('MedicationRequest').required(),
            id: joi_1.default.string().pattern(/^[A-Za-z0-9\-\.]{1,64}$/),
            meta: joi_1.default.object(),
            implicitRules: joi_1.default.string().uri(),
            language: joi_1.default.string(),
            text: joi_1.default.object(),
            contained: joi_1.default.array(),
            extension: joi_1.default.array(),
            modifierExtension: joi_1.default.array(),
            identifier: joi_1.default.array(),
            status: joi_1.default.string().valid('active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown').required(),
            statusReason: joi_1.default.object(),
            intent: joi_1.default.string().valid('proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option').required(),
            category: joi_1.default.array(),
            priority: joi_1.default.string().valid('routine', 'urgent', 'asap', 'stat'),
            doNotPerform: joi_1.default.boolean(),
            reportedBoolean: joi_1.default.boolean(),
            reportedReference: joi_1.default.object(),
            medicationCodeableConcept: joi_1.default.object(),
            medicationReference: joi_1.default.object(),
            subject: joi_1.default.object({
                reference: joi_1.default.string().required(),
                type: joi_1.default.string(),
                identifier: joi_1.default.object(),
                display: joi_1.default.string(),
            }).required(),
            encounter: joi_1.default.object(),
            supportingInformation: joi_1.default.array(),
            authoredOn: joi_1.default.string().isoDate(),
            requester: joi_1.default.object(),
            performer: joi_1.default.object(),
            performerType: joi_1.default.object(),
            recorder: joi_1.default.object(),
            reasonCode: joi_1.default.array(),
            reasonReference: joi_1.default.array(),
            instantiatesCanonical: joi_1.default.array(),
            instantiatesUri: joi_1.default.array(),
            basedOn: joi_1.default.array(),
            groupIdentifier: joi_1.default.object(),
            courseOfTherapyType: joi_1.default.object(),
            insurance: joi_1.default.array(),
            note: joi_1.default.array(),
            dosageInstruction: joi_1.default.array(),
            dispenseRequest: joi_1.default.object(),
            substitution: joi_1.default.object(),
            priorPrescription: joi_1.default.object(),
            detectedIssue: joi_1.default.array(),
            eventHistory: joi_1.default.array(),
        }),
    };
    apiSchemas = {
        searchParams: joi_1.default.object({
            _id: joi_1.default.string(),
            _lastUpdated: joi_1.default.string(),
            _tag: joi_1.default.string(),
            _profile: joi_1.default.string(),
            _security: joi_1.default.string(),
            _text: joi_1.default.string(),
            _content: joi_1.default.string(),
            _list: joi_1.default.string(),
            _has: joi_1.default.string(),
            _type: joi_1.default.string(),
            _count: joi_1.default.number().integer().min(0).max(1000),
            _sort: joi_1.default.string(),
            _elements: joi_1.default.string(),
            _summary: joi_1.default.string().valid('true', 'false', 'text', 'data', 'count'),
            _total: joi_1.default.string().valid('none', 'estimate', 'accurate'),
            _include: joi_1.default.string(),
            _revinclude: joi_1.default.string(),
        }).unknown(true),
        bundleRequest: joi_1.default.object({
            resourceType: joi_1.default.string().valid('Bundle').required(),
            type: joi_1.default.string().valid('transaction', 'batch', 'collection', 'searchset', 'history').required(),
            resources: joi_1.default.array().items(joi_1.default.object()).required(),
            timestamp: joi_1.default.string().isoDate(),
        }),
        cdsHookRequest: joi_1.default.object({
            hookInstance: joi_1.default.string().required(),
            fhirServer: joi_1.default.string().uri().required(),
            hook: joi_1.default.string().required(),
            context: joi_1.default.object().required(),
            prefetch: joi_1.default.object(),
            fhirAuthorization: joi_1.default.object({
                access_token: joi_1.default.string().required(),
                token_type: joi_1.default.string().required(),
                expires_in: joi_1.default.number().integer(),
                scope: joi_1.default.string().required(),
                subject: joi_1.default.string(),
            }),
        }),
        subscriptionConfig: joi_1.default.object({
            criteria: joi_1.default.string().required(),
            channel: joi_1.default.object({
                type: joi_1.default.string().valid('rest-hook', 'websocket', 'email', 'sms').required(),
                endpoint: joi_1.default.string().uri(),
                payload: joi_1.default.string(),
                header: joi_1.default.array().items(joi_1.default.string()),
            }).required(),
            reason: joi_1.default.string().required(),
            status: joi_1.default.string().valid('requested', 'active', 'error', 'off').required(),
        }),
        vitalSigns: joi_1.default.object({
            temperature: joi_1.default.number().min(80).max(120),
            bloodPressureSystolic: joi_1.default.number().min(50).max(300),
            bloodPressureDiastolic: joi_1.default.number().min(30).max(200),
            heartRate: joi_1.default.number().min(30).max(300),
            respiratoryRate: joi_1.default.number().min(5).max(60),
            oxygenSaturation: joi_1.default.number().min(0).max(100),
            weight: joi_1.default.number().min(0).max(1000),
            height: joi_1.default.number().min(0).max(300),
        }),
        authRequest: joi_1.default.object({
            response_type: joi_1.default.string().valid('code').required(),
            client_id: joi_1.default.string().required(),
            redirect_uri: joi_1.default.string().uri().required(),
            scope: joi_1.default.string(),
            state: joi_1.default.string(),
            aud: joi_1.default.string().uri(),
            launch: joi_1.default.string(),
            code_challenge: joi_1.default.string(),
            code_challenge_method: joi_1.default.string().valid('S256'),
        }),
        tokenRequest: joi_1.default.object({
            grant_type: joi_1.default.string().valid('authorization_code', 'refresh_token', 'client_credentials').required(),
            code: joi_1.default.string().when('grant_type', { is: 'authorization_code', then: joi_1.default.required() }),
            redirect_uri: joi_1.default.string().uri().when('grant_type', { is: 'authorization_code', then: joi_1.default.required() }),
            client_id: joi_1.default.string().required(),
            client_secret: joi_1.default.string(),
            code_verifier: joi_1.default.string(),
            refresh_token: joi_1.default.string().when('grant_type', { is: 'refresh_token', then: joi_1.default.required() }),
            scope: joi_1.default.string(),
        }),
    };
    async validateFHIRResource(resourceType, resource) {
        try {
            const schema = this.fhirResourceSchemas[resourceType];
            if (!schema) {
                return {
                    valid: false,
                    errors: [{
                            path: 'resourceType',
                            message: `Unsupported resource type: ${resourceType}`,
                            code: 'unsupported-resource-type',
                            severity: 'error',
                        }],
                    warnings: [],
                };
            }
            const { error, warning } = schema.validate(resource, {
                abortEarly: false,
                allowUnknown: true,
                stripUnknown: false,
            });
            const result = {
                valid: !error,
                errors: [],
                warnings: [],
            };
            if (error) {
                result.errors = error.details.map(detail => ({
                    path: detail.path.join('.'),
                    message: detail.message,
                    code: detail.type,
                    severity: 'error',
                }));
            }
            const additionalValidation = await this.performAdditionalFHIRValidation(resourceType, resource);
            result.errors.push(...additionalValidation.errors);
            result.warnings.push(...additionalValidation.warnings);
            result.valid = result.errors.length === 0;
            logger_1.default.debug('FHIR resource validation completed', {
                resourceType,
                valid: result.valid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('FHIR resource validation failed:', error);
            return {
                valid: false,
                errors: [{
                        path: '',
                        message: 'Validation service error',
                        code: 'validation-error',
                        severity: 'fatal',
                    }],
                warnings: [],
            };
        }
    }
    async validateAPIInput(schemaName, data) {
        try {
            const schema = this.apiSchemas[schemaName];
            if (!schema) {
                return {
                    valid: false,
                    errors: [{
                            path: '',
                            message: `Unknown validation schema: ${schemaName}`,
                            code: 'unknown-schema',
                            severity: 'error',
                        }],
                    warnings: [],
                };
            }
            const { error } = schema.validate(data, {
                abortEarly: false,
                allowUnknown: schemaName === 'searchParams',
                stripUnknown: false,
            });
            const result = {
                valid: !error,
                errors: [],
                warnings: [],
            };
            if (error) {
                result.errors = error.details.map(detail => ({
                    path: detail.path.join('.'),
                    message: detail.message,
                    code: detail.type,
                    severity: 'error',
                }));
            }
            logger_1.default.debug('API input validation completed', {
                schemaName,
                valid: result.valid,
                errorCount: result.errors.length,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('API input validation failed:', error);
            return {
                valid: false,
                errors: [{
                        path: '',
                        message: 'Validation service error',
                        code: 'validation-error',
                        severity: 'fatal',
                    }],
                warnings: [],
            };
        }
    }
    sanitizeInput(input) {
        if (typeof input === 'string') {
            return input
                .trim()
                .replace(/[<>]/g, '')
                .substring(0, 1000);
        }
        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }
        if (input && typeof input === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        return input;
    }
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    validatePhoneNumber(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)\.]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }
    validateDate(dateString) {
        const date = new Date(dateString);
        return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
    }
    validateFHIRId(id) {
        const idRegex = /^[A-Za-z0-9\-\.]{1,64}$/;
        return idRegex.test(id);
    }
    validateURI(uri) {
        try {
            new URL(uri);
            return true;
        }
        catch {
            return false;
        }
    }
    async performAdditionalFHIRValidation(resourceType, resource) {
        const errors = [];
        const warnings = [];
        if (resource.resourceType !== resourceType) {
            errors.push({
                path: 'resourceType',
                message: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`,
                code: 'resource-type-mismatch',
                severity: 'error',
            });
        }
        if (resource.id && !this.validateFHIRId(resource.id)) {
            errors.push({
                path: 'id',
                message: 'Invalid FHIR ID format',
                code: 'invalid-id-format',
                severity: 'error',
            });
        }
        switch (resourceType) {
            case 'Patient':
                this.validatePatientResource(resource, errors, warnings);
                break;
            case 'Observation':
                this.validateObservationResource(resource, errors, warnings);
                break;
            case 'MedicationRequest':
                this.validateMedicationRequestResource(resource, errors, warnings);
                break;
        }
        this.validateCommonFHIRElements(resource, errors, warnings);
        return { errors, warnings };
    }
    validatePatientResource(patient, errors, warnings) {
        if (!patient.name || patient.name.length === 0) {
            warnings.push({
                path: 'name',
                message: 'Patient should have at least one name',
                code: 'missing-name',
                severity: 'warning',
            });
        }
        if (patient.telecom) {
            patient.telecom.forEach((telecom, index) => {
                if (telecom.system === 'email' && !this.validateEmail(telecom.value)) {
                    errors.push({
                        path: `telecom[${index}].value`,
                        message: 'Invalid email format',
                        code: 'invalid-email',
                        severity: 'error',
                    });
                }
                if (telecom.system === 'phone' && !this.validatePhoneNumber(telecom.value)) {
                    warnings.push({
                        path: `telecom[${index}].value`,
                        message: 'Invalid phone number format',
                        code: 'invalid-phone',
                        severity: 'warning',
                    });
                }
            });
        }
        if (patient.birthDate) {
            const birthDate = new Date(patient.birthDate);
            const now = new Date();
            if (birthDate > now) {
                errors.push({
                    path: 'birthDate',
                    message: 'Birth date cannot be in the future',
                    code: 'future-birth-date',
                    severity: 'error',
                });
            }
            if (now.getFullYear() - birthDate.getFullYear() > 150) {
                warnings.push({
                    path: 'birthDate',
                    message: 'Patient age exceeds 150 years',
                    code: 'extreme-age',
                    severity: 'warning',
                });
            }
        }
    }
    validateObservationResource(observation, errors, warnings) {
        if (observation.category?.some((cat) => cat.coding?.some((coding) => coding.code === 'vital-signs'))) {
            if (observation.valueQuantity) {
                this.validateVitalSignValue(observation, errors, warnings);
            }
        }
        const effectiveDate = observation.effectiveDateTime || observation.effectivePeriod?.start;
        if (effectiveDate && new Date(effectiveDate) > new Date()) {
            warnings.push({
                path: 'effectiveDateTime',
                message: 'Observation date is in the future',
                code: 'future-observation',
                severity: 'warning',
            });
        }
    }
    validateMedicationRequestResource(medicationRequest, errors, warnings) {
        if (!medicationRequest.medicationCodeableConcept && !medicationRequest.medicationReference) {
            errors.push({
                path: 'medication',
                message: 'Either medicationCodeableConcept or medicationReference must be present',
                code: 'missing-medication',
                severity: 'error',
            });
        }
        if (medicationRequest.authoredOn && new Date(medicationRequest.authoredOn) > new Date()) {
            warnings.push({
                path: 'authoredOn',
                message: 'Authored date is in the future',
                code: 'future-authored-date',
                severity: 'warning',
            });
        }
    }
    validateVitalSignValue(observation, errors, warnings) {
        const value = observation.valueQuantity?.value;
        const code = observation.code?.coding?.[0]?.code;
        if (typeof value !== 'number')
            return;
        const vitalRanges = {
            '8310-5': { min: 95, max: 108, unit: '°F' },
            '8867-4': { min: 40, max: 200 },
            '9279-1': { min: 10, max: 40 },
            '2708-6': { min: 80, max: 100 },
            '8480-6': { min: 70, max: 200 },
            '8462-4': { min: 40, max: 120 },
        };
        const range = vitalRanges[code];
        if (range) {
            if (value < range.min || value > range.max) {
                warnings.push({
                    path: 'valueQuantity.value',
                    message: `Vital sign value ${value} is outside normal range (${range.min}-${range.max})`,
                    code: 'abnormal-vital-sign',
                    severity: 'warning',
                });
            }
        }
    }
    validateCommonFHIRElements(resource, errors, warnings) {
        if (resource.extension) {
            resource.extension.forEach((ext, index) => {
                if (!ext.url) {
                    errors.push({
                        path: `extension[${index}].url`,
                        message: 'Extension must have a url',
                        code: 'missing-extension-url',
                        severity: 'error',
                    });
                }
                else if (!this.validateURI(ext.url)) {
                    errors.push({
                        path: `extension[${index}].url`,
                        message: 'Extension url must be a valid URI',
                        code: 'invalid-extension-url',
                        severity: 'error',
                    });
                }
            });
        }
        if (resource.subject?.reference && !resource.subject.reference.includes('/')) {
            warnings.push({
                path: 'subject.reference',
                message: 'Reference should include resource type (e.g., "Patient/123")',
                code: 'incomplete-reference',
                severity: 'warning',
            });
        }
    }
    async getHealthStatus() {
        try {
            return {
                status: 'UP',
                details: {
                    supportedResourceTypes: Object.keys(this.fhirResourceSchemas),
                    supportedSchemas: Object.keys(this.apiSchemas),
                },
            };
        }
        catch (error) {
            return {
                status: 'DOWN',
                details: { error: error instanceof Error ? error.message : String(error) },
            };
        }
    }
}
exports.ValidationService = ValidationService;
exports.validationService = new ValidationService();
//# sourceMappingURL=validation.service.js.map