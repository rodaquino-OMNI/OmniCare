import {
  HumanName,
  Address,
  ContactPoint,
  CodeableConcept,
  Identifier,
  Period,
  Reference,
  Quantity,
  validateHumanName,
  validateAddress,
  validateContactPoint,
  validateCodeableConcept,
  validateIdentifier,
  validatePeriod,
  validateReference,
  validateQuantity,
  createReference,
  formatHumanName,
  formatAddress
} from '../../../src/models/base.model';

describe('Base Model', () => {
  describe('HumanName', () => {
    describe('validateHumanName', () => {
      it('should validate a complete human name', () => {
        const validName: HumanName = {
          use: 'official' as const,
          text: 'Dr. John Q. Doe Jr.',
          family: 'Doe',
          given: ['John', 'Quincy'],
          prefix: ['Dr.'],
          suffix: ['Jr.'],
          period: {
            start: '2000-01-01',
            end: '2024-12-31'
          }
        };

        const result = validateHumanName(validName);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate minimal human name', () => {
        const minimalName: HumanName = {
          family: 'Doe'
        };

        const result = validateHumanName(minimalName);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject name without family or given name', () => {
        const invalidName: HumanName = {
          use: 'official' as const
          // Missing both family and given
        };

        const result = validateHumanName(invalidName);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('At least family name or given name is required');
      });

      it('should reject invalid use value', () => {
        const invalidName: HumanName = {
          use: 'invalid-use' as any,
          family: 'Doe'
        };

        const result = validateHumanName(invalidName);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid name use. Must be one of: usual, official, temp, nickname, anonymous, old, maiden');
      });

      it('should validate given names array', () => {
        const nameWithGiven: HumanName = {
          given: ['John', 'Quincy', 'Middle'],
          family: 'Doe'
        };

        const result = validateHumanName(nameWithGiven);
        expect(result.valid).toBe(true);
      });

      it('should reject empty given names array', () => {
        const nameWithEmptyGiven: HumanName = {
          given: [],
          family: 'Doe'
        };

        const result = validateHumanName(nameWithEmptyGiven);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Given names array cannot be empty');
      });
    });

    describe('formatHumanName', () => {
      it('should format complete human name', () => {
        const name: HumanName = {
          prefix: ['Dr.'],
          given: ['John', 'Q.'],
          family: 'Doe',
          suffix: ['Jr.', 'MD']
        };

        const formatted = formatHumanName(name);
        expect(formatted).toBe('Dr. John Q. Doe Jr. MD');
      });

      it('should format minimal human name', () => {
        const name: HumanName = {
          family: 'Doe'
        };

        const formatted = formatHumanName(name);
        expect(formatted).toBe('Doe');
      });

      it('should format name with given names only', () => {
        const name: HumanName = {
          given: ['John', 'Quincy']
        };

        const formatted = formatHumanName(name);
        expect(formatted).toBe('John Quincy');
      });

      it('should handle empty name parts', () => {
        const name: HumanName = {
          prefix: [],
          given: ['John'],
          family: 'Doe',
          suffix: []
        };

        const formatted = formatHumanName(name);
        expect(formatted).toBe('John Doe');
      });
    });
  });

  describe('Address', () => {
    describe('validateAddress', () => {
      it('should validate complete address', () => {
        const validAddress: Address = {
          use: 'home' as const,
          type: 'both',
          text: '123 Main St, Anytown, ST 12345, USA',
          line: ['123 Main St', 'Apt 4B'],
          city: 'Anytown',
          district: 'Central District',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
          period: {
            start: '2020-01-01'
          }
        };

        const result = validateAddress(validAddress);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate minimal address', () => {
        const minimalAddress: Address = {
          line: ['123 Main St'],
          city: 'Anytown',
          country: 'USA'
        };

        const result = validateAddress(minimalAddress);
        expect(result.valid).toBe(true);
      });

      it('should reject address without any location data', () => {
        const invalidAddress: Address = {
          use: 'home' as const
          // Missing all address components
        };

        const result = validateAddress(invalidAddress);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Address must have at least one of: text, line, city, state, postalCode, or country');
      });

      it('should reject invalid address use', () => {
        const invalidAddress: Address = {
          use: 'invalid-use' as any,
          line: ['123 Main St']
        };

        const result = validateAddress(invalidAddress);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid address use. Must be one of: home, work, temp, old, billing');
      });

      it('should reject invalid address type', () => {
        const invalidAddress: Address = {
          type: 'invalid-type' as any,
          line: ['123 Main St']
        };

        const result = validateAddress(invalidAddress);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid address type. Must be one of: postal, physical, both');
      });

      it('should validate postal code formats', () => {
        const usAddress: Address = {
          line: ['123 Main St'],
          city: 'Anytown',
          state: 'CA',
          postalCode: '90210',
          country: 'USA'
        };

        const result = validateAddress(usAddress);
        expect(result.valid).toBe(true);
      });
    });

    describe('formatAddress', () => {
      it('should format complete address', () => {
        const address: Address = {
          line: ['123 Main St', 'Apt 4B'],
          city: 'Anytown',
          state: 'ST',
          postalCode: '12345',
          country: 'USA'
        };

        const formatted = formatAddress(address);
        expect(formatted).toBe('123 Main St, Apt 4B, Anytown, ST 12345, USA');
      });

      it('should format minimal address', () => {
        const address: Address = {
          city: 'Anytown',
          state: 'ST'
        };

        const formatted = formatAddress(address);
        expect(formatted).toBe('Anytown, ST');
      });

      it('should use text field when provided', () => {
        const address: Address = {
          text: 'Custom Address Format',
          line: ['123 Main St'],
          city: 'Anytown'
        };

        const formatted = formatAddress(address);
        expect(formatted).toBe('Custom Address Format');
      });
    });
  });

  describe('ContactPoint', () => {
    describe('validateContactPoint', () => {
      it('should validate phone contact point', () => {
        const phoneContact: ContactPoint = {
          system: 'phone',
          value: '+1-555-123-4567',
          use: 'home' as const,
          rank: 1,
          period: {
            start: '2020-01-01'
          }
        };

        const result = validateContactPoint(phoneContact);
        expect(result.valid).toBe(true);
      });

      it('should validate email contact point', () => {
        const emailContact: ContactPoint = {
          system: 'email',
          value: 'john.doe@example.com',
          use: 'work' as const
        };

        const result = validateContactPoint(emailContact);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid contact system', () => {
        const invalidContact: ContactPoint = {
          system: 'invalid-system' as any,
          value: 'test-value'
        };

        const result = validateContactPoint(invalidContact);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid contact system. Must be one of: phone, fax, email, pager, url, sms, other');
      });

      it('should reject invalid email format', () => {
        const invalidEmail: ContactPoint = {
          system: 'email',
          value: 'invalid-email-format'
        };

        const result = validateContactPoint(invalidEmail);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid email format');
      });

      it('should validate phone number formats', () => {
        const phoneFormats = [
          '+1-555-123-4567',
          '(555) 123-4567',
          '555-123-4567',
          '5551234567'
        ];

        phoneFormats.forEach(phoneNumber => {
          const contact: ContactPoint = {
            system: 'phone',
            value: phoneNumber
          };

          const result = validateContactPoint(contact);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject missing value', () => {
        const noValueContact: ContactPoint = {
          system: 'phone'
          // Missing value
        };

        const result = validateContactPoint(noValueContact);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Contact point value is required');
      });
    });
  });

  describe('CodeableConcept', () => {
    describe('validateCodeableConcept', () => {
      it('should validate complete codeable concept', () => {
        const concept: CodeableConcept = {
          coding: [
            {
              system: 'http://loinc.org',
              version: '2.69',
              code: '8310-5',
              display: 'Body temperature',
              userSelected: true
            }
          ],
          text: 'Body temperature measurement'
        };

        const result = validateCodeableConcept(concept);
        expect(result.valid).toBe(true);
      });

      it('should validate concept with multiple codings', () => {
        const concept: CodeableConcept = {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8310-5',
              display: 'Body temperature'
            },
            {
              system: 'http://snomed.info/sct',
              code: '386725007',
              display: 'Body temperature'
            }
          ]
        };

        const result = validateCodeableConcept(concept);
        expect(result.valid).toBe(true);
      });

      it('should validate concept with text only', () => {
        const concept: CodeableConcept = {
          text: 'Custom measurement description'
        };

        const result = validateCodeableConcept(concept);
        expect(result.valid).toBe(true);
      });

      it('should reject concept without coding or text', () => {
        const concept: CodeableConcept = {};

        const result = validateCodeableConcept(concept);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('CodeableConcept must have either coding or text');
      });

      it('should reject coding without system or code', () => {
        const concept: CodeableConcept = {
          coding: [
            {
              display: 'Body temperature'
              // Missing system and code
            }
          ]
        };

        const result = validateCodeableConcept(concept);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Coding must have either system+code or display');
      });
    });
  });

  describe('Identifier', () => {
    describe('validateIdentifier', () => {
      it('should validate complete identifier', () => {
        const identifier: Identifier = {
          use: 'official' as const,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number'
            }]
          },
          system: 'http://hospital.example.org/mrn',
          value: 'MRN123456',
          period: {
            start: '2020-01-01'
          },
          assigner: {
            reference: 'Organization/hospital-1',
            display: 'Example Hospital'
          }
        };

        const result = validateIdentifier(identifier);
        expect(result.valid).toBe(true);
      });

      it('should validate minimal identifier', () => {
        const identifier: Identifier = {
          value: 'ID123456'
        };

        const result = validateIdentifier(identifier);
        expect(result.valid).toBe(true);
      });

      it('should reject identifier without value', () => {
        const identifier: Identifier = {
          system: 'http://example.org/id'
          // Missing value
        };

        const result = validateIdentifier(identifier);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Identifier value is required');
      });

      it('should validate common identifier types', () => {
        const mrn: Identifier = {
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR'
            }]
          },
          value: 'MRN123'
        };

        const ssn: Identifier = {
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'SS'
            }]
          },
          value: '123-45-6789'
        };

        expect(validateIdentifier(mrn).valid).toBe(true);
        expect(validateIdentifier(ssn).valid).toBe(true);
      });
    });
  });

  describe('Period', () => {
    describe('validatePeriod', () => {
      it('should validate complete period', () => {
        const period: Period = {
          start: '2020-01-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z'
        };

        const result = validatePeriod(period);
        expect(result.valid).toBe(true);
      });

      it('should validate period with start only', () => {
        const period: Period = {
          start: '2020-01-01T00:00:00Z'
        };

        const result = validatePeriod(period);
        expect(result.valid).toBe(true);
      });

      it('should validate period with end only', () => {
        const period: Period = {
          end: '2024-12-31T23:59:59Z'
        };

        const result = validatePeriod(period);
        expect(result.valid).toBe(true);
      });

      it('should reject period where end is before start', () => {
        const period: Period = {
          start: '2024-12-31T23:59:59Z',
          end: '2020-01-01T00:00:00Z'
        };

        const result = validatePeriod(period);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Period end must be after start');
      });

      it('should reject period with invalid date formats', () => {
        const period: Period = {
          start: 'invalid-date',
          end: '2024-12-31'
        };

        const result = validatePeriod(period);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid start date format');
      });

      it('should reject empty period', () => {
        const period: Period = {};

        const result = validatePeriod(period);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Period must have start and/or end');
      });
    });
  });

  describe('Reference', () => {
    describe('validateReference', () => {
      it('should validate reference with reference field', () => {
        const reference: Reference = {
          reference: 'Patient/patient-123',
          display: 'John Doe'
        };

        const result = validateReference(reference);
        expect(result.valid).toBe(true);
      });

      it('should validate reference with identifier', () => {
        const reference: Reference = {
          identifier: {
            system: 'http://hospital.example.org/mrn',
            value: 'MRN123456'
          },
          display: 'John Doe'
        };

        const result = validateReference(reference);
        expect(result.valid).toBe(true);
      });

      it('should reject reference without reference or identifier', () => {
        const reference: Reference = {
          display: 'John Doe'
          // Missing reference and identifier
        };

        const result = validateReference(reference);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Reference must have either reference or identifier');
      });

      it('should validate FHIR reference formats', () => {
        const validReferences = [
          'Patient/123',
          'Practitioner/456',
          'Organization/789',
          'http://example.org/fhir/Patient/123'
        ];

        validReferences.forEach(ref => {
          const reference: Reference = { reference: ref };
          const result = validateReference(reference);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('createReference', () => {
      it('should create reference from resource type and ID', () => {
        const reference = createReference('Patient', 'patient-123');
        expect(reference).toEqual({
          reference: 'Patient/patient-123'
        });
      });

      it('should create reference with display', () => {
        const reference = createReference('Patient', 'patient-123', 'John Doe');
        expect(reference).toEqual({
          reference: 'Patient/patient-123',
          display: 'John Doe'
        });
      });
    });
  });

  describe('Quantity', () => {
    describe('validateQuantity', () => {
      it('should validate complete quantity', () => {
        const quantity: Quantity = {
          value: 98.6,
          comparator: '<',
          unit: 'degrees Fahrenheit',
          system: 'http://unitsofmeasure.org',
          code: '[degF]'
        };

        const result = validateQuantity(quantity);
        expect(result.valid).toBe(true);
      });

      it('should validate minimal quantity', () => {
        const quantity: Quantity = {
          value: 100
        };

        const result = validateQuantity(quantity);
        expect(result.valid).toBe(true);
      });

      it('should reject quantity without value', () => {
        const quantity: Quantity = {
          unit: 'kg'
          // Missing value
        };

        const result = validateQuantity(quantity);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Quantity value is required');
      });

      it('should reject invalid comparator', () => {
        const quantity: Quantity = {
          value: 100,
          comparator: 'invalid' as any
        };

        const result = validateQuantity(quantity);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid comparator. Must be one of: <, <=, >=, >');
      });

      it('should validate common unit systems', () => {
        const ucumQuantity: Quantity = {
          value: 70,
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
          code: 'kg'
        };

        const result = validateQuantity(ucumQuantity);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null values gracefully', () => {
      expect(() => validateHumanName(null as any)).not.toThrow();
      expect(() => validateAddress(null as any)).not.toThrow();
      expect(() => validateContactPoint(null as any)).not.toThrow();
    });

    it('should handle undefined values gracefully', () => {
      expect(() => validateHumanName(undefined as any)).not.toThrow();
      expect(() => validateAddress(undefined as any)).not.toThrow();
      expect(() => validateContactPoint(undefined as any)).not.toThrow();
    });

    it('should handle empty objects', () => {
      const emptyName = validateHumanName({});
      const emptyAddress = validateAddress({});
      const emptyContact = validateContactPoint({});

      expect(emptyName.valid).toBe(false);
      expect(emptyAddress.valid).toBe(false);
      expect(emptyContact.valid).toBe(false);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      
      const nameWithLongFamily: HumanName = {
        family: longString
      };

      const result = validateHumanName(nameWithLongFamily);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Family name exceeds maximum length');
    });

    it('should handle special characters in names', () => {
      const nameWithSpecialChars: HumanName = {
        family: "O'Connell-Smith",
        given: ['Jean-Luc', "D'Artagnan"]
      };

      const result = validateHumanName(nameWithSpecialChars);
      expect(result.valid).toBe(true);
    });
  });
});