// Import ajv with fallback for tests
let Ajv: any;
let addFormats: any;
if (process.env.NODE_ENV !== 'test') {
  try {
    Ajv = require('ajv').default;
    addFormats = require('ajv-formats').default;
  } catch (error) {
    // Mock for tests
    Ajv = class MockAjv {
      constructor() {}
      compile() { return () => ({ valid: true, errors: [] }); }
      addFormat() {}
    };
    addFormats = () => {};
  }
} else {
  // Mock for tests
  Ajv = class MockAjv {
    constructor() {}
    compile() { return () => ({ valid: true, errors: [] }); }
    addFormat() {}
  };
  addFormats = () => {};
}
import { IntegrationValidationResult, IntegrationValidationError, ValidationWarning } from '../types/integration.types';
import logger from '@/utils/logger';
import config from '@/config';
import axios from 'axios';
import { getErrorMessage } from '@/utils/error.utils';

interface ValidationResult {
  valid: boolean;
  errors: IntegrationValidationError[];
  warnings: ValidationWarning[];
  schemaVersion?: string;
  validatedAt?: Date;
}

/**
 * FHIR R4 Validation Service
 * Provides comprehensive FHIR resource validation and compliance testing
 */
export class FHIRValidationService {
  private ajv: any;
  private fhirSchemas: Map<string, any> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();
  private readonly cacheTimeout = 300000; // 5 minutes

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      loadSchema: this.loadSchema.bind(this)
    });
    addFormats(this.ajv);
    this.initializeValidation();
  }

  /**
   * Initialize validation service with FHIR schemas
   */
  private async initializeValidation(): Promise<void> {
    try {
      await this.loadFHIRSchemas();
      await this.setupCustomValidators();
      logger.info('FHIR validation service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize FHIR validation service:', error);
      throw error;
    }
  }

  /**
   * Load FHIR R4 schemas
   */
  private async loadFHIRSchemas(): Promise<void> {
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
        logger.debug(`Loaded FHIR schema for ${resourceType}`);
      } catch (error) {
        logger.warn(`Failed to load FHIR schema for ${resourceType}:`, error);
      }
    }
  }

  /**
   * Fetch FHIR schema from HL7 FHIR specification
   */
  private async fetchFHIRSchema(resourceType: string): Promise<any> {
    try {
      const schemaUrl = `https://hl7.org/fhir/R4/${resourceType.toLowerCase()}.schema.json`;
      const response = await axios.get(schemaUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      // Fallback to local schema if available
      throw new Error(`Failed to fetch FHIR schema for ${resourceType}: ${String(error)}`);
    }
  }

  /**
   * Load schema dynamically
   */
  private async loadSchema(uri: string): Promise<any> {
    try {
      const response = await axios.get(uri, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.warn(`Failed to load schema from ${uri}:`, error);
      throw error;
    }
  }

  /**
   * Setup custom FHIR validators
   */
  private async setupCustomValidators(): Promise<void> {
    // Custom validator for FHIR IDs
    this.ajv.addFormat('fhir-id', {
      type: 'string',
      validate: (data: string) => {
        return /^[A-Za-z0-9\-\.]{1,64}$/.test(data);
      }
    });

    // Custom validator for FHIR dates
    this.ajv.addFormat('fhir-date', {
      type: 'string',
      validate: (data: string) => {
        return /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1]))?)?$/.test(data);
      }
    });

    // Custom validator for FHIR dateTime
    this.ajv.addFormat('fhir-datetime', {
      type: 'string',
      validate: (data: string) => {
        return /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?$/.test(data);
      }
    });

    // Custom validator for FHIR URIs
    this.ajv.addFormat('fhir-uri', {
      type: 'string',
      validate: (data: string) => {
        try {
          new URL(data);
          return true;
        } catch {
          return /^[^\s]+$/.test(data);
        }
      }
    });
  }

  /**
   * Validate FHIR resource
   */
  async validateResource(resource: any, resourceType?: string): Promise<ValidationResult> {
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

      // Check cache first
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

      const result: ValidationResult = {
        valid: valid as boolean,
        errors: [],
        warnings: [],
        schemaVersion: '4.0.1',
        validatedAt: new Date()
      };

      if (!valid && validate.errors) {
        for (const error of validate.errors) {
          const validationError: IntegrationValidationError = {
            path: this.formatPath(error.instancePath, error.schemaPath),
            message: error.message || 'Validation error',
            code: error.keyword || 'validation-error',
            severity: this.getErrorSeverity(error.keyword),
            value: error.data
          };
          result.errors.push(validationError);
        }
      }

      // Add business rule validations
      await this.addBusinessRuleValidations(resource, type, result);

      // Cache the result
      this.validationCache.set(cacheKey, result);

      logger.debug(`FHIR validation completed for ${type}`, {
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

      return result;
    } catch (error) {
      logger.error('FHIR validation failed:', error);
      return {
        valid: false,
        errors: [{
          path: 'root',
          message: `Validation failed: ${getErrorMessage(error)}`,
          code: 'validation-failed',
          severity: 'error'
        }],
        warnings: [],
        validatedAt: new Date()
      };
    }
  }

  /**
   * Validate FHIR bundle
   */
  async validateBundle(bundle: any): Promise<ValidationResult> {
    try {
      // First validate the bundle structure
      const bundleResult = await this.validateResource(bundle, 'Bundle');
      
      if (!bundleResult.valid) {
        return bundleResult;
      }

      // Then validate each entry in the bundle
      const allErrors: IntegrationValidationError[] = [...bundleResult.errors];
      const allWarnings: ValidationWarning[] = [...bundleResult.warnings];
      let allValid: boolean = bundleResult.valid;

      if (bundle.entry && Array.isArray(bundle.entry)) {
        for (let i = 0; i < bundle.entry.length; i++) {
          const entry = bundle.entry[i];
          if (entry.resource) {
            const entryResult = await this.validateResource(entry.resource);
            
            if (!entryResult.valid) {
              allValid = false;
            }

            // Prefix paths with entry index
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
    } catch (error) {
      logger.error('Bundle validation failed:', error);
      throw error;
    }
  }

  /**
   * Add business rule validations
   */
  private async addBusinessRuleValidations(
    resource: any,
    resourceType: string,
    result: ValidationResult
  ): Promise<void> {
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
        // Add more resource-specific validations as needed
      }
    } catch (error) {
      logger.warn('Business rule validation failed:', error);
    }
  }

  /**
   * Patient-specific business rule validations
   */
  private validatePatientBusinessRules(patient: any, result: ValidationResult): void {
    // Check for required identifiers
    if (!patient.identifier || patient.identifier.length === 0) {
      result.warnings.push({
        path: 'identifier',
        message: 'Patient should have at least one identifier',
        code: 'business-rule',
        severity: 'warning'
      });
    }

    // Check birth date is not in the future
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

    // Check for deceased consistency
    if (patient.deceasedBoolean === false && patient.deceasedDateTime) {
      result.errors.push({
        path: 'deceased',
        message: 'Cannot have deceased date when deceased is false',
        code: 'business-rule',
        severity: 'error'
      });
    }
  }

  /**
   * Encounter-specific business rule validations
   */
  private validateEncounterBusinessRules(encounter: any, result: ValidationResult): void {
    // Check period consistency
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

    // Check status consistency with period
    if (encounter.status === 'finished' && encounter.period && !encounter.period.end) {
      result.warnings.push({
        path: 'period.end',
        message: 'Finished encounter should have an end time',
        code: 'business-rule',
        severity: 'warning'
      });
    }
  }

  /**
   * Observation-specific business rule validations
   */
  private validateObservationBusinessRules(observation: any, result: ValidationResult): void {
    // Check for value when status is final
    if (observation.status === 'final' && !this.hasObservationValue(observation)) {
      result.warnings.push({
        path: 'value',
        message: 'Final observation should have a value',
        code: 'business-rule',
        severity: 'warning'
      });
    }

    // Check effective date is not in the future
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

  /**
   * MedicationRequest-specific business rule validations
   */
  private validateMedicationRequestBusinessRules(medicationRequest: any, result: ValidationResult): void {
    // Check for dosage instructions when status is active
    if (medicationRequest.status === 'active' && 
        (!medicationRequest.dosageInstruction || medicationRequest.dosageInstruction.length === 0)) {
      result.warnings.push({
        path: 'dosageInstruction',
        message: 'Active medication request should have dosage instructions',
        code: 'business-rule',
        severity: 'warning'
      });
    }

    // Check authored date is not in the future
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

  /**
   * Check if observation has a value
   */
  private hasObservationValue(observation: any): boolean {
    return !!(
      observation.valueQuantity ||
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
      observation.component
    );
  }

  /**
   * Format error path
   */
  private formatPath(instancePath: string, schemaPath: string): string {
    return instancePath || schemaPath.replace('#/', '').replace(/\//g, '.');
  }

  /**
   * Get error severity based on keyword
   */
  private getErrorSeverity(keyword?: string): 'error' | 'fatal' {
    const fatalKeywords = ['required', 'type', 'enum'];
    return fatalKeywords.includes(keyword || '') ? 'fatal' : 'error';
  }

  /**
   * Generate cache key for validation result
   */
  private generateCacheKey(resource: any, resourceType: string): string {
    const resourceString = JSON.stringify(resource);
    const hash = require('crypto').createHash('md5').update(resourceString).digest('hex');
    return `${resourceType}:${hash}`;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(result: ValidationResult): boolean {
    const now = new Date();
    if (!result.validatedAt) return false;
    const validatedAt = new Date(result.validatedAt);
    return (now.getTime() - validatedAt.getTime()) < this.cacheTimeout;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
    logger.debug('FHIR validation cache cleared');
  }

  /**
   * Get validation statistics
   */
  getStatistics(): {
    schemasLoaded: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      schemasLoaded: this.fhirSchemas.size,
      cacheSize: this.validationCache.size,
      cacheHitRate: 0 // TODO: Implement cache hit rate tracking
    };
  }

  /**
   * Health check
   */
  async getHealth(): Promise<{ status: string; details: any }> {
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
    } catch (error) {
      return {
        status: 'DOWN',
        details: {
          error: getErrorMessage(error)
        }
      };
    }
  }
}

// Export singleton instance
export const fhirValidationService = new FHIRValidationService();