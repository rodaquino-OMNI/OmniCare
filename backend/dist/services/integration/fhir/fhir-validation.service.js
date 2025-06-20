"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fhirValidationService = exports.FHIRValidationService = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const logger_1 = __importDefault(require("@/utils/logger"));
const axios_1 = __importDefault(require("axios"));
class FHIRValidationService {
    ajv;
    fhirSchemas = new Map();
    validationCache = new Map();
    cacheTimeout = 300000;
    constructor() {
        this.ajv = new ajv_1.default({
            allErrors: true,
            verbose: true,
            strict: false,
            loadSchema: this.loadSchema.bind(this)
        });
        (0, ajv_formats_1.default)(this.ajv);
        this.initializeValidation();
    }
    async initializeValidation() {
        try {
            await this.loadFHIRSchemas();
            await this.setupCustomValidators();
            logger_1.default.info('FHIR validation service initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize FHIR validation service:', error);
            throw error;
        }
    }
    async loadFHIRSchemas() {
        const resourceTypes = [
            'Patient', 'Practitioner', 'Organization', 'Location', 'Device',
            'Encounter', 'Observation', 'Condition', 'Procedure', 'DiagnosticReport',
            'MedicationRequest', 'MedicationAdministration', 'MedicationStatement',
            'AllergyIntolerance', 'CarePlan', 'ServiceRequest', 'Task',
            'Communication', 'CommunicationRequest', 'Appointment', 'Schedule',
            'Slot', 'Coverage', 'Claim', 'ExplanationOfBenefit',
            'DocumentReference', 'Binary', 'Media', 'QuestionnaireResponse',
            'Questionnaire', 'List', 'Group', 'Flag', 'Goal', 'RiskAssessment',
            'Bundle', 'OperationOutcome', 'Parameters'
        ];
        for (const resourceType of resourceTypes) {
            try {
                const schema = await this.fetchFHIRSchema(resourceType);
                this.fhirSchemas.set(resourceType, schema);
                this.ajv.addSchema(schema, resourceType);
                logger_1.default.debug(`Loaded FHIR schema for ${resourceType}`);
            }
            catch (error) {
                logger_1.default.warn(`Failed to load FHIR schema for ${resourceType}:`, error);
            }
        }
    }
    async fetchFHIRSchema(resourceType) {
        try {
            const schemaUrl = `https://hl7.org/fhir/R4/${resourceType.toLowerCase()}.schema.json`;
            const response = await axios_1.default.get(schemaUrl, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to fetch FHIR schema for ${resourceType}: ${error}`);
        }
    }
    async loadSchema(uri) {
        try {
            const response = await axios_1.default.get(uri, {
                timeout: 5000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.warn(`Failed to load schema from ${uri}:`, error);
            throw error;
        }
    }
    async setupCustomValidators() {
        this.ajv.addFormat('fhir-id', {
            type: 'string',
            validate: (data) => {
                return /^[A-Za-z0-9\-\.]{1,64}$/.test(data);
            }
        });
        this.ajv.addFormat('fhir-date', {
            type: 'string',
            validate: (data) => {
                return /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1]))?)?$/.test(data);
            }
        });
        this.ajv.addFormat('fhir-datetime', {
            type: 'string',
            validate: (data) => {
                return /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?$/.test(data);
            }
        });
        this.ajv.addFormat('fhir-uri', {
            type: 'string',
            validate: (data) => {
                try {
                    new URL(data);
                    return true;
                }
                catch {
                    return /^[^\s]+$/.test(data);
                }
            }
        });
    }
    async validateResource(resource, resourceType) {
        try {
            const type = resourceType || resource.resourceType;
            if (!type) {
                return {
                    valid: false,
                    errors: [{
                            path: 'resourceType',
                            message: 'Resource type is required',
                            code: 'required',
                            severity: 'error'
                        }],
                    warnings: [],
                    validatedAt: new Date()
                };
            }
            const cacheKey = this.generateCacheKey(resource, type);
            const cachedResult = this.validationCache.get(cacheKey);
            if (cachedResult && this.isCacheValid(cachedResult)) {
                return cachedResult;
            }
            const schema = this.fhirSchemas.get(type);
            if (!schema) {
                return {
                    valid: false,
                    errors: [{
                            path: 'resourceType',
                            message: `Schema not found for resource type: ${type}`,
                            code: 'schema-not-found',
                            severity: 'error'
                        }],
                    warnings: [],
                    validatedAt: new Date()
                };
            }
            const validate = this.ajv.getSchema(type) || this.ajv.compile(schema);
            const valid = validate(resource);
            const result = {
                valid: valid,
                errors: [],
                warnings: [],
                schemaVersion: '4.0.1',
                validatedAt: new Date()
            };
            if (!valid && validate.errors) {
                for (const error of validate.errors) {
                    const validationError = {
                        path: this.formatPath(error.instancePath, error.schemaPath),
                        message: error.message || 'Validation error',
                        code: error.keyword || 'validation-error',
                        severity: this.getErrorSeverity(error.keyword),
                        value: error.data
                    };
                    result.errors.push(validationError);
                }
            }
            await this.addBusinessRuleValidations(resource, type, result);
            this.validationCache.set(cacheKey, result);
            logger_1.default.debug(`FHIR validation completed for ${type}`, {
                valid: result.valid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('FHIR validation failed:', error);
            return {
                valid: false,
                errors: [{
                        path: 'root',
                        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
                        code: 'validation-failed',
                        severity: 'error'
                    }],
                warnings: [],
                validatedAt: new Date()
            };
        }
    }
    async validateBundle(bundle) {
        try {
            const bundleResult = await this.validateResource(bundle, 'Bundle');
            if (!bundleResult.valid) {
                return bundleResult;
            }
            const allErrors = [...bundleResult.errors];
            const allWarnings = [...bundleResult.warnings];
            let allValid = bundleResult.valid;
            if (bundle.entry && Array.isArray(bundle.entry)) {
                for (let i = 0; i < bundle.entry.length; i++) {
                    const entry = bundle.entry[i];
                    if (entry.resource) {
                        const entryResult = await this.validateResource(entry.resource);
                        if (!entryResult.valid) {
                            allValid = false;
                        }
                        for (const error of entryResult.errors) {
                            allErrors.push({
                                ...error,
                                path: `entry[${i}].resource.${error.path}`
                            });
                        }
                        for (const warning of entryResult.warnings) {
                            allWarnings.push({
                                ...warning,
                                path: `entry[${i}].resource.${warning.path}`
                            });
                        }
                    }
                }
            }
            return {
                valid: allValid,
                errors: allErrors,
                warnings: allWarnings,
                schemaVersion: '4.0.1',
                validatedAt: new Date()
            };
        }
        catch (error) {
            logger_1.default.error('Bundle validation failed:', error);
            throw error;
        }
    }
    async addBusinessRuleValidations(resource, resourceType, result) {
        try {
            switch (resourceType) {
                case 'Patient':
                    this.validatePatientBusinessRules(resource, result);
                    break;
                case 'Encounter':
                    this.validateEncounterBusinessRules(resource, result);
                    break;
                case 'Observation':
                    this.validateObservationBusinessRules(resource, result);
                    break;
                case 'MedicationRequest':
                    this.validateMedicationRequestBusinessRules(resource, result);
                    break;
            }
        }
        catch (error) {
            logger_1.default.warn('Business rule validation failed:', error);
        }
    }
    validatePatientBusinessRules(patient, result) {
        if (!patient.identifier || patient.identifier.length === 0) {
            result.warnings.push({
                path: 'identifier',
                message: 'Patient should have at least one identifier',
                code: 'business-rule',
                severity: 'warning'
            });
        }
        if (patient.birthDate) {
            const birthDate = new Date(patient.birthDate);
            if (birthDate > new Date()) {
                result.errors.push({
                    path: 'birthDate',
                    message: 'Birth date cannot be in the future',
                    code: 'business-rule',
                    severity: 'error'
                });
            }
        }
        if (patient.deceasedBoolean === false && patient.deceasedDateTime) {
            result.errors.push({
                path: 'deceased',
                message: 'Cannot have deceased date when deceased is false',
                code: 'business-rule',
                severity: 'error'
            });
        }
    }
    validateEncounterBusinessRules(encounter, result) {
        if (encounter.period) {
            if (encounter.period.start && encounter.period.end) {
                const start = new Date(encounter.period.start);
                const end = new Date(encounter.period.end);
                if (start > end) {
                    result.errors.push({
                        path: 'period',
                        message: 'Encounter start time must be before end time',
                        code: 'business-rule',
                        severity: 'error'
                    });
                }
            }
        }
        if (encounter.status === 'finished' && encounter.period && !encounter.period.end) {
            result.warnings.push({
                path: 'period.end',
                message: 'Finished encounter should have an end time',
                code: 'business-rule',
                severity: 'warning'
            });
        }
    }
    validateObservationBusinessRules(observation, result) {
        if (observation.status === 'final' && !this.hasObservationValue(observation)) {
            result.warnings.push({
                path: 'value',
                message: 'Final observation should have a value',
                code: 'business-rule',
                severity: 'warning'
            });
        }
        if (observation.effectiveDateTime) {
            const effectiveDate = new Date(observation.effectiveDateTime);
            if (effectiveDate > new Date()) {
                result.warnings.push({
                    path: 'effectiveDateTime',
                    message: 'Observation effective date should not be in the future',
                    code: 'business-rule',
                    severity: 'warning'
                });
            }
        }
    }
    validateMedicationRequestBusinessRules(medicationRequest, result) {
        if (medicationRequest.status === 'active' &&
            (!medicationRequest.dosageInstruction || medicationRequest.dosageInstruction.length === 0)) {
            result.warnings.push({
                path: 'dosageInstruction',
                message: 'Active medication request should have dosage instructions',
                code: 'business-rule',
                severity: 'warning'
            });
        }
        if (medicationRequest.authoredOn) {
            const authoredDate = new Date(medicationRequest.authoredOn);
            if (authoredDate > new Date()) {
                result.errors.push({
                    path: 'authoredOn',
                    message: 'Authored date cannot be in the future',
                    code: 'business-rule',
                    severity: 'error'
                });
            }
        }
    }
    hasObservationValue(observation) {
        return !!(observation.valueQuantity ||
            observation.valueCodeableConcept ||
            observation.valueString ||
            observation.valueBoolean ||
            observation.valueInteger ||
            observation.valueRange ||
            observation.valueRatio ||
            observation.valueSampledData ||
            observation.valueTime ||
            observation.valueDateTime ||
            observation.valuePeriod ||
            observation.component);
    }
    formatPath(instancePath, schemaPath) {
        return instancePath || schemaPath.replace('#/', '').replace(/\//g, '.');
    }
    getErrorSeverity(keyword) {
        const fatalKeywords = ['required', 'type', 'enum'];
        return fatalKeywords.includes(keyword || '') ? 'fatal' : 'error';
    }
    generateCacheKey(resource, resourceType) {
        const resourceString = JSON.stringify(resource);
        const hash = require('crypto').createHash('md5').update(resourceString).digest('hex');
        return `${resourceType}:${hash}`;
    }
    isCacheValid(result) {
        const now = new Date();
        const validatedAt = new Date(result.validatedAt);
        return (now.getTime() - validatedAt.getTime()) < this.cacheTimeout;
    }
    clearCache() {
        this.validationCache.clear();
        logger_1.default.debug('FHIR validation cache cleared');
    }
    getStatistics() {
        return {
            schemasLoaded: this.fhirSchemas.size,
            cacheSize: this.validationCache.size,
            cacheHitRate: 0
        };
    }
    async getHealth() {
        try {
            const stats = this.getStatistics();
            return {
                status: stats.schemasLoaded > 0 ? 'UP' : 'DOWN',
                details: {
                    schemasLoaded: stats.schemasLoaded,
                    cacheSize: stats.cacheSize,
                    validationEngine: 'ajv',
                    fhirVersion: '4.0.1'
                }
            };
        }
        catch (error) {
            return {
                status: 'DOWN',
                details: {
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
}
exports.FHIRValidationService = FHIRValidationService;
exports.fhirValidationService = new FHIRValidationService();
//# sourceMappingURL=fhir-validation.service.js.map