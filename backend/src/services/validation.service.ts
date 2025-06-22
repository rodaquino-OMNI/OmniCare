import Joi from 'joi';

import { ValidationResult, ValidationError, ValidationWarning } from '@/types/fhir';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';

/**
 * Data Validation and Sanitization Service
 * Provides comprehensive validation for FHIR resources and API inputs
 */
export class ValidationService {

  // ===============================
  // FHIR RESOURCE VALIDATION SCHEMAS
  // ===============================

  private readonly fhirResourceSchemas = {
    Patient: Joi.object({
      resourceType: Joi.string().valid('Patient').required(),
      id: Joi.string().pattern(/^[A-Za-z0-9\-\.]{1,64}$/),
      meta: Joi.object(),
      implicitRules: Joi.string().uri(),
      language: Joi.string(),
      text: Joi.object(),
      contained: Joi.array(),
      extension: Joi.array(),
      modifierExtension: Joi.array(),
      identifier: Joi.array().items(
        Joi.object({
          use: Joi.string().valid('usual', 'official', 'temp', 'secondary', 'old'),
          type: Joi.object(),
          system: Joi.string().uri(),
          value: Joi.string().required(),
          period: Joi.object(),
          assigner: Joi.object(),
        })
      ),
      active: Joi.boolean(),
      name: Joi.array().items(
        Joi.object({
          use: Joi.string().valid('usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'),
          text: Joi.string(),
          family: Joi.string(),
          given: Joi.array().items(Joi.string()),
          prefix: Joi.array().items(Joi.string()),
          suffix: Joi.array().items(Joi.string()),
          period: Joi.object(),
        })
      ),
      telecom: Joi.array().items(
        Joi.object({
          system: Joi.string().valid('phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'),
          value: Joi.string().required(),
          use: Joi.string().valid('home', 'work', 'temp', 'old', 'mobile'),
          rank: Joi.number().integer().min(1),
          period: Joi.object(),
        })
      ),
      gender: Joi.string().valid('male', 'female', 'other', 'unknown'),
      birthDate: Joi.string().pattern(/^\d{4}(-\d{2}(-\d{2})?)?$/),
      deceasedBoolean: Joi.boolean(),
      deceasedDateTime: Joi.string().isoDate(),
      address: Joi.array().items(
        Joi.object({
          use: Joi.string().valid('home', 'work', 'temp', 'old', 'billing'),
          type: Joi.string().valid('postal', 'physical', 'both'),
          text: Joi.string(),
          line: Joi.array().items(Joi.string()),
          city: Joi.string(),
          district: Joi.string(),
          state: Joi.string(),
          postalCode: Joi.string(),
          country: Joi.string(),
          period: Joi.object(),
        })
      ),
      maritalStatus: Joi.object(),
      multipleBirthBoolean: Joi.boolean(),
      multipleBirthInteger: Joi.number().integer(),
      photo: Joi.array(),
      contact: Joi.array(),
      communication: Joi.array(),
      generalPractitioner: Joi.array(),
      managingOrganization: Joi.object(),
      link: Joi.array(),
    }),

    Observation: Joi.object({
      resourceType: Joi.string().valid('Observation').required(),
      id: Joi.string().pattern(/^[A-Za-z0-9\-\.]{1,64}$/),
      meta: Joi.object(),
      implicitRules: Joi.string().uri(),
      language: Joi.string(),
      text: Joi.object(),
      contained: Joi.array(),
      extension: Joi.array(),
      modifierExtension: Joi.array(),
      identifier: Joi.array(),
      basedOn: Joi.array(),
      partOf: Joi.array(),
      status: Joi.string().valid(
        'registered', 'preliminary', 'final', 'amended', 
        'corrected', 'cancelled', 'entered-in-error', 'unknown'
      ).required(),
      category: Joi.array().items(Joi.object()).min(1),
      code: Joi.object({
        coding: Joi.array().items(
          Joi.object({
            system: Joi.string().uri(),
            version: Joi.string(),
            code: Joi.string().required(),
            display: Joi.string(),
            userSelected: Joi.boolean(),
          })
        ),
        text: Joi.string(),
      }).required(),
      subject: Joi.object({
        reference: Joi.string().required(),
        type: Joi.string(),
        identifier: Joi.object(),
        display: Joi.string(),
      }).required(),
      focus: Joi.array(),
      encounter: Joi.object(),
      effectiveDateTime: Joi.string().isoDate(),
      effectivePeriod: Joi.object(),
      effectiveTiming: Joi.object(),
      effectiveInstant: Joi.string().isoDate(),
      issued: Joi.string().isoDate(),
      performer: Joi.array(),
      valueQuantity: Joi.object({
        value: Joi.number(),
        comparator: Joi.string().valid('<', '<=', '>=', '>'),
        unit: Joi.string(),
        system: Joi.string().uri(),
        code: Joi.string(),
      }),
      valueCodeableConcept: Joi.object(),
      valueString: Joi.string(),
      valueBoolean: Joi.boolean(),
      valueInteger: Joi.number().integer(),
      valueRange: Joi.object(),
      valueRatio: Joi.object(),
      valueSampledData: Joi.object(),
      valueTime: Joi.string(),
      valueDateTime: Joi.string().isoDate(),
      valuePeriod: Joi.object(),
      dataAbsentReason: Joi.object(),
      interpretation: Joi.array(),
      note: Joi.array(),
      bodySite: Joi.object(),
      method: Joi.object(),
      specimen: Joi.object(),
      device: Joi.object(),
      referenceRange: Joi.array(),
      hasMember: Joi.array(),
      derivedFrom: Joi.array(),
      component: Joi.array(),
    }),

    MedicationRequest: Joi.object({
      resourceType: Joi.string().valid('MedicationRequest').required(),
      id: Joi.string().pattern(/^[A-Za-z0-9\-\.]{1,64}$/),
      meta: Joi.object(),
      implicitRules: Joi.string().uri(),
      language: Joi.string(),
      text: Joi.object(),
      contained: Joi.array(),
      extension: Joi.array(),
      modifierExtension: Joi.array(),
      identifier: Joi.array(),
      status: Joi.string().valid(
        'active', 'on-hold', 'cancelled', 'completed', 
        'entered-in-error', 'stopped', 'draft', 'unknown'
      ).required(),
      statusReason: Joi.object(),
      intent: Joi.string().valid(
        'proposal', 'plan', 'order', 'original-order', 
        'reflex-order', 'filler-order', 'instance-order', 'option'
      ).required(),
      category: Joi.array(),
      priority: Joi.string().valid('routine', 'urgent', 'asap', 'stat'),
      doNotPerform: Joi.boolean(),
      reportedBoolean: Joi.boolean(),
      reportedReference: Joi.object(),
      medicationCodeableConcept: Joi.object(),
      medicationReference: Joi.object(),
      subject: Joi.object({
        reference: Joi.string().required(),
        type: Joi.string(),
        identifier: Joi.object(),
        display: Joi.string(),
      }).required(),
      encounter: Joi.object(),
      supportingInformation: Joi.array(),
      authoredOn: Joi.string().isoDate(),
      requester: Joi.object(),
      performer: Joi.object(),
      performerType: Joi.object(),
      recorder: Joi.object(),
      reasonCode: Joi.array(),
      reasonReference: Joi.array(),
      instantiatesCanonical: Joi.array(),
      instantiatesUri: Joi.array(),
      basedOn: Joi.array(),
      groupIdentifier: Joi.object(),
      courseOfTherapyType: Joi.object(),
      insurance: Joi.array(),
      note: Joi.array(),
      dosageInstruction: Joi.array(),
      dispenseRequest: Joi.object(),
      substitution: Joi.object(),
      priorPrescription: Joi.object(),
      detectedIssue: Joi.array(),
      eventHistory: Joi.array(),
    }),
  };

  // ===============================
  // API INPUT VALIDATION SCHEMAS
  // ===============================

  private readonly apiSchemas = {
    searchParams: Joi.object({
      _id: Joi.string(),
      _lastUpdated: Joi.string(),
      _tag: Joi.string(),
      _profile: Joi.string(),
      _security: Joi.string(),
      _text: Joi.string(),
      _content: Joi.string(),
      _list: Joi.string(),
      _has: Joi.string(),
      _type: Joi.string(),
      _count: Joi.number().integer().min(0).max(1000),
      _sort: Joi.string(),
      _elements: Joi.string(),
      _summary: Joi.string().valid('true', 'false', 'text', 'data', 'count'),
      _total: Joi.string().valid('none', 'estimate', 'accurate'),
      _include: Joi.string(),
      _revinclude: Joi.string(),
    }).unknown(true), // Allow unknown parameters for resource-specific search

    bundleRequest: Joi.object({
      resourceType: Joi.string().valid('Bundle').required(),
      type: Joi.string().valid('transaction', 'batch', 'collection', 'searchset', 'history').required(),
      resources: Joi.array().items(Joi.object()).required(),
      timestamp: Joi.string().isoDate(),
    }),

    cdsHookRequest: Joi.object({
      hookInstance: Joi.string().required(),
      fhirServer: Joi.string().uri().required(),
      hook: Joi.string().required(),
      context: Joi.object().required(),
      prefetch: Joi.object(),
      fhirAuthorization: Joi.object({
        access_token: Joi.string().required(),
        token_type: Joi.string().required(),
        expires_in: Joi.number().integer(),
        scope: Joi.string().required(),
        subject: Joi.string(),
      }),
    }),

    subscriptionConfig: Joi.object({
      criteria: Joi.string().required(),
      channel: Joi.object({
        type: Joi.string().valid('rest-hook', 'websocket', 'email', 'sms').required(),
        endpoint: Joi.string().uri(),
        payload: Joi.string(),
        header: Joi.array().items(Joi.string()),
      }).required(),
      reason: Joi.string().required(),
      status: Joi.string().valid('requested', 'active', 'error', 'off').required(),
    }),

    vitalSigns: Joi.object({
      temperature: Joi.number().min(80).max(120),
      bloodPressureSystolic: Joi.number().min(50).max(300),
      bloodPressureDiastolic: Joi.number().min(30).max(200),
      heartRate: Joi.number().min(30).max(300),
      respiratoryRate: Joi.number().min(5).max(60),
      oxygenSaturation: Joi.number().min(0).max(100),
      weight: Joi.number().min(0).max(1000),
      height: Joi.number().min(0).max(300),
    }),

    authRequest: Joi.object({
      response_type: Joi.string().valid('code').required(),
      client_id: Joi.string().required(),
      redirect_uri: Joi.string().uri().required(),
      scope: Joi.string(),
      state: Joi.string(),
      aud: Joi.string().uri(),
      launch: Joi.string(),
      code_challenge: Joi.string(),
      code_challenge_method: Joi.string().valid('S256'),
    }),

    tokenRequest: Joi.object({
      grant_type: Joi.string().valid('authorization_code', 'refresh_token', 'client_credentials').required(),
      code: Joi.string().when('grant_type', { is: 'authorization_code', then: Joi.required() }),
      redirect_uri: Joi.string().uri().when('grant_type', { is: 'authorization_code', then: Joi.required() }),
      client_id: Joi.string().required(),
      client_secret: Joi.string(),
      code_verifier: Joi.string(),
      refresh_token: Joi.string().when('grant_type', { is: 'refresh_token', then: Joi.required() }),
      scope: Joi.string(),
    }),
  };

  // ===============================
  // VALIDATION METHODS
  // ===============================

  /**
   * Validate FHIR resource
   */
  async validateFHIRResource(resourceType: string, resource: any): Promise<ValidationResult> {
    try {
      const schema = this.fhirResourceSchemas[resourceType as keyof typeof this.fhirResourceSchemas];
      
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
        allowUnknown: true, // FHIR allows extensions
        stripUnknown: false,
      });

      const result: ValidationResult = {
        valid: !error,
        errors: [],
        warnings: [],
      };

      if (error) {
        result.errors = error.details.map(detail => ({
          path: detail.path.join('.'),
          message: detail.message,
          code: detail.type,
          severity: 'error' as const,
        }));
      }

      // Additional FHIR-specific validations
      const additionalValidation = await this.performAdditionalFHIRValidation(resourceType, resource);
      result.errors.push(...additionalValidation.errors);
      result.warnings.push(...additionalValidation.warnings);

      result.valid = result.errors.length === 0;

      logger.debug('FHIR resource validation completed', {
        resourceType,
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      logger.error('FHIR resource validation failed:', error);
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

  /**
   * Validate API input
   */
  async validateAPIInput(schemaName: string, data: any): Promise<ValidationResult> {
    try {
      const schema = this.apiSchemas[schemaName as keyof typeof this.apiSchemas];
      
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
        allowUnknown: schemaName === 'searchParams', // Search params can have unknown parameters
        stripUnknown: false,
      });

      const result: ValidationResult = {
        valid: !error,
        errors: [],
        warnings: [],
      };

      if (error) {
        result.errors = error.details.map(detail => ({
          path: detail.path.join('.'),
          message: detail.message,
          code: detail.type,
          severity: 'error' as const,
        }));
      }

      logger.debug('API input validation completed', {
        schemaName,
        valid: result.valid,
        errorCount: result.errors.length,
      });

      return result;
    } catch (error) {
      logger.error('API input validation failed:', error);
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

  /**
   * Sanitize user input
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 1000); // Limit length
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)\.]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Validate date format
   */
  validateDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
  }

  /**
   * Validate FHIR ID format
   */
  validateFHIRId(id: string): boolean {
    const idRegex = /^[A-Za-z0-9\-\.]{1,64}$/;
    return idRegex.test(id);
  }

  /**
   * Validate URI format
   */
  validateURI(uri: string): boolean {
    try {
      new URL(uri);
      return true;
    } catch {
      return false;
    }
  }

  // ===============================
  // ADDITIONAL FHIR VALIDATIONS
  // ===============================

  /**
   * Perform additional FHIR-specific validations
   */
  private async performAdditionalFHIRValidation(
    resourceType: string,
    resource: any
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Resource type consistency check
    if (resource.resourceType !== resourceType) {
      errors.push({
        path: 'resourceType',
        message: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`,
        code: 'resource-type-mismatch',
        severity: 'error',
      });
    }

    // ID format validation
    if (resource.id && !this.validateFHIRId(resource.id)) {
      errors.push({
        path: 'id',
        message: 'Invalid FHIR ID format',
        code: 'invalid-id-format',
        severity: 'error',
      });
    }

    // Resource-specific validations
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

    // Common validations for all resources
    this.validateCommonFHIRElements(resource, errors, warnings);

    return { errors, warnings };
  }

  /**
   * Validate Patient-specific rules
   */
  private validatePatientResource(
    patient: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // At least one name should be provided
    if (!patient.name || patient.name.length === 0) {
      warnings.push({
        path: 'name',
        message: 'Patient should have at least one name',
        code: 'missing-name',
        severity: 'warning',
      });
    }

    // Validate email in telecom
    if (patient.telecom) {
      patient.telecom.forEach((telecom: any, index: number) => {
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

    // Birth date validation
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

  /**
   * Validate Observation-specific rules
   */
  private validateObservationResource(
    observation: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Value validations for vital signs
    if (observation.category?.some((cat: any) => 
      cat.coding?.some((coding: any) => coding.code === 'vital-signs')
    )) {
      if (observation.valueQuantity) {
        this.validateVitalSignValue(observation, errors, warnings);
      }
    }

    // Effective date should not be in the future
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

  /**
   * Validate MedicationRequest-specific rules
   */
  private validateMedicationRequestResource(
    medicationRequest: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Either medicationCodeableConcept or medicationReference must be present
    if (!medicationRequest.medicationCodeableConcept && !medicationRequest.medicationReference) {
      errors.push({
        path: 'medication',
        message: 'Either medicationCodeableConcept or medicationReference must be present',
        code: 'missing-medication',
        severity: 'error',
      });
    }

    // Authored date validation
    if (medicationRequest.authoredOn && new Date(medicationRequest.authoredOn) > new Date()) {
      warnings.push({
        path: 'authoredOn',
        message: 'Authored date is in the future',
        code: 'future-authored-date',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate vital sign values
   */
  private validateVitalSignValue(
    observation: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const value = observation.valueQuantity?.value;
    const code = observation.code?.coding?.[0]?.code;

    if (typeof value !== 'number') return;

    const vitalRanges: { [key: string]: { min: number; max: number; unit?: string } } = {
      '8310-5': { min: 95, max: 108, unit: '°F' }, // Body temperature
      '8867-4': { min: 40, max: 200 }, // Heart rate
      '9279-1': { min: 10, max: 40 }, // Respiratory rate
      '2708-6': { min: 80, max: 100 }, // Oxygen saturation
      '8480-6': { min: 70, max: 200 }, // Systolic BP
      '8462-4': { min: 40, max: 120 }, // Diastolic BP
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

  /**
   * Validate common FHIR elements
   */
  private validateCommonFHIRElements(
    resource: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate extensions
    if (resource.extension) {
      resource.extension.forEach((ext: any, index: number) => {
        if (!ext.url) {
          errors.push({
            path: `extension[${index}].url`,
            message: 'Extension must have a url',
            code: 'missing-extension-url',
            severity: 'error',
          });
        } else if (!this.validateURI(ext.url)) {
          errors.push({
            path: `extension[${index}].url`,
            message: 'Extension url must be a valid URI',
            code: 'invalid-extension-url',
            severity: 'error',
          });
        }
      });
    }

    // Validate references
    if (resource.subject?.reference && !resource.subject.reference.includes('/')) {
      warnings.push({
        path: 'subject.reference',
        message: 'Reference should include resource type (e.g., "Patient/123")',
        code: 'incomplete-reference',
        severity: 'warning',
      });
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      return {
        status: 'UP',
        details: {
          supportedResourceTypes: Object.keys(this.fhirResourceSchemas),
          supportedSchemas: Object.keys(this.apiSchemas),
        },
      };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { error: getErrorMessage(error) },
      };
    }
  }
}

// Export singleton instance
export const validationService = new ValidationService();