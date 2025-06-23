import { ValidationService } from '../../../src/services/validation.service';
import { ValidationResult } from '../../../src/types/fhir';
import logger from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

describe('ValidationService', () => {
  let validationService: ValidationService;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    validationService = new ValidationService();
    jest.clearAllMocks();
  });

  describe('FHIR Resource Validation', () => {
    describe('Patient Resource Validation', () => {
      it('should validate a valid Patient resource', async () => {
        const validPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          active: true,
          name: [
            {
              use: 'official',
              family: 'Doe',
              given: ['John'],
            },
          ],
          gender: 'male',
          birthDate: '1990-01-01',
          telecom: [
            {
              system: 'email',
              value: 'john.doe@example.com',
              use: 'home',
            },
            {
              system: 'phone',
              value: '+1-555-123-4567',
              use: 'mobile',
            },
          ],
        };

        const result = await validationService.validateFHIRResource('Patient', validPatient);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'FHIR resource validation completed',
          expect.objectContaining({
            resourceType: 'Patient',
            valid: true,
          })
        );
      });

      it('should reject Patient with invalid email', async () => {
        const invalidPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          telecom: [
            {
              system: 'email',
              value: 'invalid-email',
            },
          ],
        };

        const result = await validationService.validateFHIRResource('Patient', invalidPatient);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'telecom[0].value',
              message: 'Invalid email format',
              code: 'invalid-email',
              severity: 'error',
            }),
          ])
        );
      });

      it('should warn about missing patient name', async () => {
        const patientWithoutName = {
          resourceType: 'Patient',
          id: 'patient-123',
          gender: 'male',
        };

        const result = await validationService.validateFHIRResource('Patient', patientWithoutName);

        expect(result.valid).toBe(true); // Still valid, just warnings
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'name',
              message: 'Patient should have at least one name',
              code: 'missing-name',
              severity: 'warning',
            }),
          ])
        );
      });

      it('should reject Patient with future birth date', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const invalidPatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          birthDate: futureDate.toISOString().split('T')[0],
        };

        const result = await validationService.validateFHIRResource('Patient', invalidPatient);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'birthDate',
              message: 'Birth date cannot be in the future',
              code: 'future-birth-date',
              severity: 'error',
            }),
          ])
        );
      });

      it('should warn about extreme age', async () => {
        const extremeDate = new Date();
        extremeDate.setFullYear(extremeDate.getFullYear() - 160);

        const extremeAgePatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          birthDate: extremeDate.toISOString().split('T')[0],
        };

        const result = await validationService.validateFHIRResource('Patient', extremeAgePatient);

        expect(result.valid).toBe(true);
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'birthDate',
              message: 'Patient age exceeds 150 years',
              code: 'extreme-age',
              severity: 'warning',
            }),
          ])
        );
      });

      it('should validate phone numbers', async () => {
        const patientWithInvalidPhone = {
          resourceType: 'Patient',
          id: 'patient-123',
          telecom: [
            {
              system: 'phone',
              value: '123', // Too short
            },
          ],
        };

        const result = await validationService.validateFHIRResource('Patient', patientWithInvalidPhone);

        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'telecom[0].value',
              message: 'Invalid phone number format',
              code: 'invalid-phone',
              severity: 'warning',
            }),
          ])
        );
      });
    });

    describe('Observation Resource Validation', () => {
      it('should validate a valid Observation resource', async () => {
        const validObservation = {
          resourceType: 'Observation',
          id: 'obs-123',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8310-5',
                display: 'Body temperature',
              },
            ],
          },
          subject: {
            reference: 'Patient/patient-123',
          },
          valueQuantity: {
            value: 98.6,
            unit: '°F',
          },
          effectiveDateTime: '2023-01-01T10:00:00Z',
        };

        const result = await validationService.validateFHIRResource('Observation', validObservation);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject Observation without required fields', async () => {
        const invalidObservation = {
          resourceType: 'Observation',
          id: 'obs-123',
          // Missing status, code, subject
        };

        const result = await validationService.validateFHIRResource('Observation', invalidObservation);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should warn about future observation date', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const futureObservation = {
          resourceType: 'Observation',
          id: 'obs-123',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8310-5',
              },
            ],
          },
          subject: {
            reference: 'Patient/patient-123',
          },
          effectiveDateTime: futureDate.toISOString(),
        };

        const result = await validationService.validateFHIRResource('Observation', futureObservation);

        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'effectiveDateTime',
              message: 'Observation date is in the future',
              code: 'future-observation',
              severity: 'warning',
            }),
          ])
        );
      });

      it('should warn about abnormal vital sign values', async () => {
        const abnormalTempObservation = {
          resourceType: 'Observation',
          id: 'obs-123',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8310-5', // Body temperature
              },
            ],
          },
          subject: {
            reference: 'Patient/patient-123',
          },
          valueQuantity: {
            value: 120, // Abnormally high temperature
            unit: '°F',
          },
        };

        const result = await validationService.validateFHIRResource('Observation', abnormalTempObservation);

        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'valueQuantity.value',
              message: expect.stringContaining('outside normal range'),
              code: 'abnormal-vital-sign',
              severity: 'warning',
            }),
          ])
        );
      });
    });

    describe('MedicationRequest Resource Validation', () => {
      it('should validate a valid MedicationRequest resource', async () => {
        const validMedicationRequest = {
          resourceType: 'MedicationRequest',
          id: 'med-123',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '313782',
                display: 'Acetaminophen 325 MG Oral Tablet',
              },
            ],
          },
          subject: {
            reference: 'Patient/patient-123',
          },
          authoredOn: '2023-01-01T10:00:00Z',
        };

        const result = await validationService.validateFHIRResource('MedicationRequest', validMedicationRequest);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject MedicationRequest without medication', async () => {
        const invalidMedicationRequest = {
          resourceType: 'MedicationRequest',
          id: 'med-123',
          status: 'active',
          intent: 'order',
          subject: {
            reference: 'Patient/patient-123',
          },
          // Missing medicationCodeableConcept and medicationReference
        };

        const result = await validationService.validateFHIRResource('MedicationRequest', invalidMedicationRequest);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'medication',
              message: 'Either medicationCodeableConcept or medicationReference must be present',
              code: 'missing-medication',
              severity: 'error',
            }),
          ])
        );
      });

      it('should warn about future authored date', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const futureMedRequest = {
          resourceType: 'MedicationRequest',
          id: 'med-123',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: [{ code: '313782' }],
          },
          subject: {
            reference: 'Patient/patient-123',
          },
          authoredOn: futureDate.toISOString(),
        };

        const result = await validationService.validateFHIRResource('MedicationRequest', futureMedRequest);

        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'authoredOn',
              message: 'Authored date is in the future',
              code: 'future-authored-date',
              severity: 'warning',
            }),
          ])
        );
      });
    });

    describe('Common FHIR Validations', () => {
      it('should reject resource type mismatch', async () => {
        const mismatchedResource = {
          resourceType: 'Observation',
          id: 'test-123',
        };

        const result = await validationService.validateFHIRResource('Patient', mismatchedResource);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'resourceType',
              message: 'Resource type mismatch: expected Patient, got Observation',
              code: 'resource-type-mismatch',
              severity: 'error',
            }),
          ])
        );
      });

      it('should reject invalid FHIR ID format', async () => {
        const invalidIdResource = {
          resourceType: 'Patient',
          id: 'invalid@id#format',
        };

        const result = await validationService.validateFHIRResource('Patient', invalidIdResource);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'id',
              message: 'Invalid FHIR ID format',
              code: 'invalid-id-format',
              severity: 'error',
            }),
          ])
        );
      });

      it('should validate extensions', async () => {
        const resourceWithInvalidExtension = {
          resourceType: 'Patient',
          id: 'patient-123',
          extension: [
            {
              // Missing url
              valueString: 'test value',
            },
            {
              url: 'invalid-url',
              valueString: 'test value',
            },
          ],
        };

        const result = await validationService.validateFHIRResource('Patient', resourceWithInvalidExtension);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'extension[0].url',
              message: 'Extension must have a url',
              code: 'missing-extension-url',
              severity: 'error',
            }),
            expect.objectContaining({
              path: 'extension[1].url',
              message: 'Extension url must be a valid URI',
              code: 'invalid-extension-url',
              severity: 'error',
            }),
          ])
        );
      });

      it('should warn about incomplete references', async () => {
        const resourceWithIncompleteRef = {
          resourceType: 'Observation',
          id: 'obs-123',
          status: 'final',
          category: [
            {
              coding: [
                {
                  code: 'vital-signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                code: '8310-5',
              },
            ],
          },
          subject: {
            reference: '123', // Incomplete reference
          },
        };

        const result = await validationService.validateFHIRResource('Observation', resourceWithIncompleteRef);

        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'subject.reference',
              message: 'Reference should include resource type (e.g., "Patient/123")',
              code: 'incomplete-reference',
              severity: 'warning',
            }),
          ])
        );
      });

      it('should reject unsupported resource type', async () => {
        const result = await validationService.validateFHIRResource('UnsupportedResource', {
          resourceType: 'UnsupportedResource',
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
          expect.objectContaining({
            path: 'resourceType',
            message: 'Unsupported resource type: UnsupportedResource',
            code: 'unsupported-resource-type',
            severity: 'error',
          }),
        ]);
      });
    });
  });

  describe('API Input Validation', () => {
    describe('Search Parameters Validation', () => {
      it('should validate valid search parameters', async () => {
        const validSearchParams = {
          _id: 'patient-123',
          _count: 10,
          _sort: 'name',
          family: 'Doe', // Unknown param should be allowed
        };

        const result = await validationService.validateAPIInput('searchParams', validSearchParams);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid count parameter', async () => {
        const invalidSearchParams = {
          _count: 'invalid-count',
        };

        const result = await validationService.validateAPIInput('searchParams', invalidSearchParams);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject count exceeding maximum', async () => {
        const invalidSearchParams = {
          _count: 2000, // Exceeds max of 1000
        };

        const result = await validationService.validateAPIInput('searchParams', invalidSearchParams);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Token Request Validation', () => {
      it('should validate authorization code token request', async () => {
        const validTokenRequest = {
          grant_type: 'authorization_code',
          code: 'auth-code-123',
          redirect_uri: 'https://example.com/callback',
          client_id: 'client-123',
        };

        const result = await validationService.validateAPIInput('tokenRequest', validTokenRequest);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate refresh token request', async () => {
        const validRefreshRequest = {
          grant_type: 'refresh_token',
          refresh_token: 'refresh-token-123',
          client_id: 'client-123',
        };

        const result = await validationService.validateAPIInput('tokenRequest', validRefreshRequest);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject token request with missing required fields', async () => {
        const invalidTokenRequest = {
          grant_type: 'authorization_code',
          // Missing code and redirect_uri
          client_id: 'client-123',
        };

        const result = await validationService.validateAPIInput('tokenRequest', invalidTokenRequest);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Vital Signs Validation', () => {
      it('should validate valid vital signs', async () => {
        const validVitals = {
          temperature: 98.6,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 72,
          respiratoryRate: 16,
          oxygenSaturation: 98,
        };

        const result = await validationService.validateAPIInput('vitalSigns', validVitals);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject vital signs with invalid values', async () => {
        const invalidVitals = {
          temperature: 200, // Too high
          bloodPressureSystolic: 25, // Too low
        };

        const result = await validationService.validateAPIInput('vitalSigns', invalidVitals);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should reject unknown schema', async () => {
      const result = await validationService.validateAPIInput('unknownSchema', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Unknown validation schema: unknownSchema',
          code: 'unknown-schema',
          severity: 'error',
        }),
      ]);
    });
  });

  describe('Utility Validation Methods', () => {
    describe('Email Validation', () => {
      it('should validate correct email formats', () => {
        expect(validationService.validateEmail('user@example.com')).toBe(true);
        expect(validationService.validateEmail('user.name@domain.co.uk')).toBe(true);
        expect(validationService.validateEmail('user+tag@example.org')).toBe(true);
      });

      it('should reject invalid email formats', () => {
        expect(validationService.validateEmail('invalid-email')).toBe(false);
        expect(validationService.validateEmail('user@')).toBe(false);
        expect(validationService.validateEmail('@domain.com')).toBe(false);
        expect(validationService.validateEmail('user..name@domain.com')).toBe(false);
      });
    });

    describe('Phone Number Validation', () => {
      it('should validate correct phone formats', () => {
        expect(validationService.validatePhoneNumber('+1-555-123-4567')).toBe(true);
        expect(validationService.validatePhoneNumber('(555) 123-4567')).toBe(true);
        expect(validationService.validatePhoneNumber('555.123.4567')).toBe(true);
        expect(validationService.validatePhoneNumber('15551234567')).toBe(true);
      });

      it('should reject invalid phone formats', () => {
        expect(validationService.validatePhoneNumber('123')).toBe(false);
        expect(validationService.validatePhoneNumber('abc-def-ghij')).toBe(false);
        expect(validationService.validatePhoneNumber('555-12')).toBe(false);
      });
    });

    describe('Date Validation', () => {
      it('should validate correct date formats', () => {
        expect(validationService.validateDate('2023-01-01')).toBe(true);
        expect(validationService.validateDate('2023-12-31')).toBe(true);
      });

      it('should reject invalid date formats', () => {
        expect(validationService.validateDate('2023-13-01')).toBe(false);
        expect(validationService.validateDate('2023-01-32')).toBe(false);
        expect(validationService.validateDate('invalid-date')).toBe(false);
        expect(validationService.validateDate('2023-1-1')).toBe(false);
      });
    });

    describe('FHIR ID Validation', () => {
      it('should validate correct FHIR ID formats', () => {
        expect(validationService.validateFHIRId('patient-123')).toBe(true);
        expect(validationService.validateFHIRId('ABC123')).toBe(true);
        expect(validationService.validateFHIRId('test.id-123')).toBe(true);
      });

      it('should reject invalid FHIR ID formats', () => {
        expect(validationService.validateFHIRId('invalid@id')).toBe(false);
        expect(validationService.validateFHIRId('id with spaces')).toBe(false);
        expect(validationService.validateFHIRId('very-long-id-that-exceeds-the-sixty-four-character-limit-set-by-fhir')).toBe(false);
        expect(validationService.validateFHIRId('')).toBe(false);
      });
    });

    describe('URI Validation', () => {
      it('should validate correct URI formats', () => {
        expect(validationService.validateURI('https://example.com')).toBe(true);
        expect(validationService.validateURI('http://localhost:3000')).toBe(true);
        expect(validationService.validateURI('ftp://files.example.com')).toBe(true);
      });

      it('should reject invalid URI formats', () => {
        expect(validationService.validateURI('not-a-uri')).toBe(false);
        expect(validationService.validateURI('http://')).toBe(false);
        expect(validationService.validateURI('')).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize string input', () => {
      const input = '  <script>alert("xss")</script>  ';
      const sanitized = validationService.sanitizeInput(input);
      
      expect(sanitized).toBe('scriptalert("xss")/script');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should sanitize array input', () => {
      const input = ['  text1  ', '<tag>text2</tag>', 'normal text'];
      const sanitized = validationService.sanitizeInput(input);
      
      expect(sanitized).toEqual(['text1', 'tagtext2/tag', 'normal text']);
    });

    it('should sanitize object input', () => {
      const input = {
        field1: '  <script>  ',
        field2: {
          nested: '<tag>value</tag>',
        },
      };
      const sanitized = validationService.sanitizeInput(input);
      
      expect(sanitized).toEqual({
        field1: 'script',
        field2: {
          nested: 'tagvalue/tag',
        },
      });
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(2000);
      const sanitized = validationService.sanitizeInput(longString);
      
      expect(sanitized.length).toBe(1000);
    });

    it('should preserve non-string values', () => {
      expect(validationService.sanitizeInput(123)).toBe(123);
      expect(validationService.sanitizeInput(true)).toBe(true);
      expect(validationService.sanitizeInput(null)).toBe(null);
    });
  });

  describe('Health Status', () => {
    it('should return UP status with service details', async () => {
      const status = await validationService.getHealthStatus();

      expect(status.status).toBe('UP');
      expect(status.details).toHaveProperty('supportedResourceTypes');
      expect(status.details).toHaveProperty('supportedSchemas');
      expect(status.details.supportedResourceTypes).toContain('Patient');
      expect(status.details.supportedResourceTypes).toContain('Observation');
      expect(status.details.supportedResourceTypes).toContain('MedicationRequest');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation service errors gracefully', async () => {
      // Mock Joi to throw an error
      const originalValidate = validationService['fhirResourceSchemas'].Patient.validate;
      validationService['fhirResourceSchemas'].Patient.validate = jest.fn(() => {
        throw new Error('Validation error');
      });

      const result = await validationService.validateFHIRResource('Patient', {
        resourceType: 'Patient',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Validation service error',
          code: 'validation-error',
          severity: 'fatal',
        }),
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith('FHIR resource validation failed:', expect.any(Error));

      // Restore original method
      validationService['fhirResourceSchemas'].Patient.validate = originalValidate;
    });

    it('should handle API validation service errors gracefully', async () => {
      // Mock Joi to throw an error
      const originalValidate = validationService['apiSchemas'].searchParams.validate;
      validationService['apiSchemas'].searchParams.validate = jest.fn(() => {
        throw new Error('API validation error');
      });

      const result = await validationService.validateAPIInput('searchParams', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Validation service error',
          code: 'validation-error',
          severity: 'fatal',
        }),
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith('API input validation failed:', expect.any(Error));

      // Restore original method
      validationService['apiSchemas'].searchParams.validate = originalValidate;
    });
  });
});