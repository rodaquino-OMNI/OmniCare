import {
  OmniCarePatient,
  PatientEmergencyContact,
  InsuranceInformation,
  PatientAlert,
  PatientDemographics,
  PatientSocialHistory,
  AccessibilityNeeds,
  validateOmniCarePatient,
  validateEmergencyContact,
  validateInsurance,
  validatePatientAlert,
  formatPatientName,
  calculateAge,
  getActiveInsurance,
  hasActiveAlerts
} from '../../../src/models/patient.model';

describe('Patient Model', () => {
  describe('OmniCarePatient Validation', () => {
    describe('validateOmniCarePatient', () => {
      it('should validate complete patient record', () => {
        const validPatient: OmniCarePatient = {
          resourceType: 'Patient',
          id: 'patient-123',
          active: true,
          identifier: [
            {
              use: 'usual' as const,
              type: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'MR',
                  display: 'Medical Record Number'
                }]
              },
              system: 'http://omnicare.com/patient-id',
              value: 'MRN123456'
            }
          ],
          name: [{ given: ['John'], family: 'Doe' }],
          telecom: [
            { system: 'phone', value: '555-0123', use: 'home' as const },
            { system: 'email', value: 'john.doe@example.com', use: 'home' as const }
          ],
          gender: 'male',
          birthDate: '1990-01-01',
          address: [{
            use: 'home' as const,
            line: ['123 Main St'],
            city: 'Anytown',
            state: 'ST',
            postalCode: '12345'
          }],
          maritalStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
              code: 'M',
              display: 'Married'
            }]
          },
          communication: [{
            language: {
              coding: [{
                system: 'urn:ietf:bcp:47',
                code: 'en',
                display: 'English'
              }]
            },
            preferred: true
          }],
          omnicarePatientId: 'P12345678',
          registrationDate: '2023-01-01T00:00:00Z',
          preferredLanguage: 'en',
          emergencyContact: [{
            id: 'contact-1',
            relationship: 'spouse',
            name: { given: ['Jane'], family: 'Doe' },
            telecom: [{ system: 'phone', value: '555-0456', use: 'mobile' as const }],
            priority: 1,
            active: true
          }],
          insurance: [{
            id: 'ins-1',
            subscriberId: 'SUB123456',
            payorName: 'Blue Cross Blue Shield',
            planName: 'PPO Plan',
            relationshipToSubscriber: 'self',
            effectiveDate: '2023-01-01',
            copayAmount: 25,
            deductibleAmount: 1500,
            active: true,
            priority: 1
          }],
          demographics: {
            race: [{
              coding: [{
                system: 'urn:oid:2.16.840.1.113883.6.238',
                code: '2106-3',
                display: 'White'
              }]
            }],
            ethnicity: [{
              coding: [{
                system: 'urn:oid:2.16.840.1.113883.6.238',
                code: '2186-5',
                display: 'Not Hispanic or Latino'
              }]
            }],
            occupation: 'Software Engineer',
            educationLevel: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-EducationLevel',
                code: '1081',
                display: 'College graduate'
              }]
            }
          }
        };

        const result = validateOmniCarePatient(validPatient);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate minimal patient record', () => {
        const minimalPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Doe' }],
          omnicarePatientId: 'P12345678'
        };

        const result = validateOmniCarePatient(minimalPatient);
        expect(result.valid).toBe(true);
      });

      it('should reject patient without resource type', () => {
        const invalidPatient = {
          name: [{ family: 'Doe' }],
          omnicarePatientId: 'P12345678'
        } as any;

        const result = validateOmniCarePatient(invalidPatient);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('resourceType must be "Patient"');
      });

      it('should reject patient without OmniCare patient ID', () => {
        const invalidPatient: Partial<OmniCarePatient> = {
          resourceType: 'Patient',
          name: [{ family: 'Doe' }]
          // Missing omnicarePatientId
        };

        const result = validateOmniCarePatient(invalidPatient as OmniCarePatient);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('omnicarePatientId is required');
      });

      it('should reject patient with invalid birth date', () => {
        const invalidPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Doe' }],
          birthDate: '2030-01-01', // Future date
          omnicarePatientId: 'P12345678'
        };

        const result = validateOmniCarePatient(invalidPatient);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Birth date cannot be in the future');
      });

      it('should reject patient with invalid OmniCare ID format', () => {
        const invalidPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Doe' }],
          omnicarePatientId: 'INVALID_FORMAT'
        };

        const result = validateOmniCarePatient(invalidPatient);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('omnicarePatientId must follow format P followed by 8 digits');
      });

      it('should validate patient age constraints', () => {
        const teenPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Teen' }],
          birthDate: '2010-01-01',
          omnicarePatientId: 'P12345679'
        };

        const result = validateOmniCarePatient(teenPatient);
        expect(result.valid).toBe(true);
      });
    });

    describe('Patient Business Rules', () => {
      it('should enforce minimum age for certain operations', () => {
        const childPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Child' }],
          birthDate: '2020-01-01',
          omnicarePatientId: 'P12345680'
        };

        const age = calculateAge(childPatient.birthDate!);
        expect(age).toBeLessThan(18);

        // Child patients require guardian consent for certain operations
        const result = validateOmniCarePatient(childPatient);
        expect(result.valid).toBe(true);
        if (age < 18) {
          expect(result.warnings).toContain('Minor patient may require guardian consent for certain operations');
        }
      });

      it('should validate required fields for pediatric patients', () => {
        const pediatricPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Child' }],
          birthDate: '2020-01-01',
          omnicarePatientId: 'P12345680'
          // Missing emergency contact for minor
        };

        const result = validateOmniCarePatient(pediatricPatient);
        expect(result.warnings).toContain('Emergency contact recommended for pediatric patients');
      });

      it('should validate insurance requirements for adults', () => {
        const adultPatient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [{ family: 'Adult' }],
          birthDate: '1980-01-01',
          omnicarePatientId: 'P12345681'
          // Missing insurance information
        };

        const result = validateOmniCarePatient(adultPatient);
        expect(result.warnings).toContain('Insurance information recommended for adult patients');
      });
    });
  });

  describe('Emergency Contact Validation', () => {
    describe('validateEmergencyContact', () => {
      it('should validate complete emergency contact', () => {
        const validContact: PatientEmergencyContact = {
          id: 'contact-1',
          relationship: 'spouse',
          name: { given: ['Jane'], family: 'Doe' },
          telecom: [
            { system: 'phone', value: '555-0456', use: 'mobile' as const },
            { system: 'email', value: 'jane.doe@example.com', use: 'home' as const }
          ],
          address: [{
            use: 'home' as const,
            line: ['123 Main St'],
            city: 'Anytown',
            state: 'ST',
            postalCode: '12345'
          }],
          priority: 1,
          active: true,
          notes: 'Primary emergency contact'
        };

        const result = validateEmergencyContact(validContact);
        expect(result.valid).toBe(true);
      });

      it('should validate minimal emergency contact', () => {
        const minimalContact: PatientEmergencyContact = {
          id: 'contact-1',
          relationship: 'friend',
          name: { family: 'Smith' },
          telecom: [{ system: 'phone', value: '555-0789' }],
          priority: 1,
          active: true
        };

        const result = validateEmergencyContact(minimalContact);
        expect(result.valid).toBe(true);
      });

      it('should reject contact without required fields', () => {
        const invalidContact: Partial<PatientEmergencyContact> = {
          id: 'contact-1',
          relationship: 'spouse'
          // Missing name and telecom
        };

        const result = validateEmergencyContact(invalidContact as PatientEmergencyContact);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Emergency contact name is required');
        expect(result.errors).toContain('Emergency contact must have at least one phone number');
      });

      it('should validate relationship types', () => {
        const validRelationships = ['spouse', 'parent', 'child', 'sibling', 'friend', 'guardian', 'other'];
        
        validRelationships.forEach(relationship => {
          const contact: PatientEmergencyContact = {
            id: 'contact-1',
            relationship,
            name: { family: 'Test' },
            telecom: [{ system: 'phone', value: '555-0123' }],
            priority: 1,
            active: true
          };

          const result = validateEmergencyContact(contact);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject invalid relationship type', () => {
        const invalidContact: PatientEmergencyContact = {
          id: 'contact-1',
          relationship: 'invalid-relationship' as any,
          name: { family: 'Test' },
          telecom: [{ system: 'phone', value: '555-0123' }],
          priority: 1,
          active: true
        };

        const result = validateEmergencyContact(invalidContact);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid relationship type');
      });

      it('should validate priority ordering', () => {
        const highPriorityContact: PatientEmergencyContact = {
          id: 'contact-1',
          relationship: 'spouse',
          name: { family: 'Primary' },
          telecom: [{ system: 'phone', value: '555-0123' }],
          priority: 1,
          active: true
        };

        const lowPriorityContact: PatientEmergencyContact = {
          id: 'contact-2',
          relationship: 'friend',
          name: { family: 'Secondary' },
          telecom: [{ system: 'phone', value: '555-0456' }],
          priority: 2,
          active: true
        };

        expect(validateEmergencyContact(highPriorityContact).valid).toBe(true);
        expect(validateEmergencyContact(lowPriorityContact).valid).toBe(true);
        expect(highPriorityContact.priority).toBeLessThan(lowPriorityContact.priority);
      });
    });
  });

  describe('Insurance Validation', () => {
    describe('validateInsurance', () => {
      it('should validate complete insurance information', () => {
        const validInsurance: InsuranceInformation = {
          id: 'ins-1',
          subscriberId: 'SUB123456789',
          payorName: 'Blue Cross Blue Shield PPO',
          planName: 'Comprehensive Health Plan',
          relationshipToSubscriber: 'self',
          effectiveDate: '2023-01-01',
          expirationDate: '2024-12-31',
          copayAmount: 25,
          deductibleAmount: 1500,
          active: true,
          priority: 1,
          groupNumber: 'GRP789012',
          subscriberName: 'John Doe',
          subscriberDOB: '1990-01-01'
        };

        const result = validateInsurance(validInsurance);
        expect(result.valid).toBe(true);
      });

      it('should validate minimal insurance information', () => {
        const minimalInsurance: InsuranceInformation = {
          id: 'ins-1',
          subscriberId: 'SUB123456',
          payorName: 'Insurance Company',
          planName: 'Basic Plan',
          relationshipToSubscriber: 'self',
          effectiveDate: '2023-01-01',
          active: true,
          priority: 1
        };

        const result = validateInsurance(minimalInsurance);
        expect(result.valid).toBe(true);
      });

      it('should reject insurance without required fields', () => {
        const invalidInsurance: Partial<InsuranceInformation> = {
          id: 'ins-1',
          payorName: 'Insurance Company'
          // Missing subscriberId, planName, etc.
        };

        const result = validateInsurance(invalidInsurance as InsuranceInformation);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Subscriber ID is required');
        expect(result.errors).toContain('Plan name is required');
      });

      it('should validate relationship to subscriber', () => {
        const validRelationships = ['self', 'spouse', 'child', 'parent', 'other'];
        
        validRelationships.forEach(relationship => {
          const insurance: InsuranceInformation = {
            id: 'ins-1',
            subscriberId: 'SUB123456',
            payorName: 'Insurance Company',
            planName: 'Test Plan',
            relationshipToSubscriber: relationship as any,
            effectiveDate: '2023-01-01',
            active: true,
            priority: 1
          };

          const result = validateInsurance(insurance);
          expect(result.valid).toBe(true);
        });
      });

      it('should validate insurance date ranges', () => {
        const expiredInsurance: InsuranceInformation = {
          id: 'ins-1',
          subscriberId: 'SUB123456',
          payorName: 'Insurance Company',
          planName: 'Expired Plan',
          relationshipToSubscriber: 'self',
          effectiveDate: '2020-01-01',
          expirationDate: '2022-12-31', // Already expired
          active: true,
          priority: 1
        };

        const result = validateInsurance(expiredInsurance);
        expect(result.warnings).toContain('Insurance plan appears to be expired');
      });

      it('should validate copay and deductible amounts', () => {
        const insuranceWithNegativeAmounts: InsuranceInformation = {
          id: 'ins-1',
          subscriberId: 'SUB123456',
          payorName: 'Insurance Company',
          planName: 'Invalid Plan',
          relationshipToSubscriber: 'self',
          effectiveDate: '2023-01-01',
          copayAmount: -25, // Negative copay
          deductibleAmount: -1500, // Negative deductible
          active: true,
          priority: 1
        };

        const result = validateInsurance(insuranceWithNegativeAmounts);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Copay amount cannot be negative');
        expect(result.errors).toContain('Deductible amount cannot be negative');
      });
    });

    describe('getActiveInsurance', () => {
      it('should return active insurance sorted by priority', () => {
        const insuranceList: InsuranceInformation[] = [
          {
            id: 'ins-2',
            subscriberId: 'SUB456',
            payorName: 'Secondary Insurance',
            planName: 'Secondary Plan',
            relationshipToSubscriber: 'self',
            effectiveDate: '2023-01-01',
            active: true,
            priority: 2
          },
          {
            id: 'ins-1',
            subscriberId: 'SUB123',
            payorName: 'Primary Insurance',
            planName: 'Primary Plan',
            relationshipToSubscriber: 'self',
            effectiveDate: '2023-01-01',
            active: true,
            priority: 1
          }
        ];

        const activeInsurance = getActiveInsurance(insuranceList);
        expect(activeInsurance).toHaveLength(2);
        expect(activeInsurance[0].priority).toBe(1);
        expect(activeInsurance[1].priority).toBe(2);
      });

      it('should exclude inactive insurance', () => {
        const insuranceList: InsuranceInformation[] = [
          {
            id: 'ins-1',
            subscriberId: 'SUB123',
            payorName: 'Active Insurance',
            planName: 'Active Plan',
            relationshipToSubscriber: 'self',
            effectiveDate: '2023-01-01',
            active: true,
            priority: 1
          },
          {
            id: 'ins-2',
            subscriberId: 'SUB456',
            payorName: 'Inactive Insurance',
            planName: 'Inactive Plan',
            relationshipToSubscriber: 'self',
            effectiveDate: '2022-01-01',
            active: false,
            priority: 2
          }
        ];

        const activeInsurance = getActiveInsurance(insuranceList);
        expect(activeInsurance).toHaveLength(1);
        expect(activeInsurance[0].id).toBe('ins-1');
      });
    });
  });

  describe('Patient Alert Validation', () => {
    describe('validatePatientAlert', () => {
      it('should validate complete patient alert', () => {
        const validAlert: PatientAlert = {
          id: 'alert-1',
          type: 'allergy',
          severity: 'high',
          title: 'Penicillin Allergy',
          description: 'Patient has severe allergy to penicillin with anaphylaxis reaction',
          effectiveDate: '2020-01-01',
          expirationDate: '2025-01-01',
          active: true,
          createdBy: { reference: 'Practitioner/dr-smith' },
          lastUpdatedBy: { reference: 'Practitioner/dr-jones' },
          category: 'clinical',
          urgency: 'immediate'
        };

        const result = validatePatientAlert(validAlert);
        expect(result.valid).toBe(true);
      });

      it('should validate different alert types', () => {
        const alertTypes = ['allergy', 'medication', 'condition', 'procedure', 'diet', 'fall-risk', 'infection-control'];
        
        alertTypes.forEach(alertType => {
          const alert: PatientAlert = {
            id: 'alert-1',
            type: alertType as any,
            severity: 'medium',
            title: `${alertType} Alert`,
            description: `Test ${alertType} alert`,
            effectiveDate: '2023-01-01',
            active: true,
            createdBy: { reference: 'Practitioner/test' },
            lastUpdatedBy: { reference: 'Practitioner/test' }
          };

          const result = validatePatientAlert(alert);
          expect(result.valid).toBe(true);
        });
      });

      it('should validate alert severity levels', () => {
        const severityLevels = ['low', 'medium', 'high', 'critical'];
        
        severityLevels.forEach(severity => {
          const alert: PatientAlert = {
            id: 'alert-1',
            type: 'allergy',
            severity: severity as any,
            title: 'Test Alert',
            description: 'Test alert description',
            effectiveDate: '2023-01-01',
            active: true,
            createdBy: { reference: 'Practitioner/test' },
            lastUpdatedBy: { reference: 'Practitioner/test' }
          };

          const result = validatePatientAlert(alert);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject alert without required fields', () => {
        const invalidAlert: Partial<PatientAlert> = {
          id: 'alert-1',
          type: 'allergy'
          // Missing severity, title, description, etc.
        };

        const result = validatePatientAlert(invalidAlert as PatientAlert);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Alert severity is required');
        expect(result.errors).toContain('Alert title is required');
        expect(result.errors).toContain('Alert description is required');
      });
    });

    describe('hasActiveAlerts', () => {
      it('should identify patients with active alerts', () => {
        const alertList: PatientAlert[] = [
          {
            id: 'alert-1',
            type: 'allergy',
            severity: 'high',
            title: 'Penicillin Allergy',
            description: 'Severe allergy',
            effectiveDate: '2020-01-01',
            active: true,
            createdBy: { reference: 'Practitioner/test' },
            lastUpdatedBy: { reference: 'Practitioner/test' }
          },
          {
            id: 'alert-2',
            type: 'medication',
            severity: 'medium',
            title: 'Medication Interaction',
            description: 'Drug interaction warning',
            effectiveDate: '2023-01-01',
            active: false,
            createdBy: { reference: 'Practitioner/test' },
            lastUpdatedBy: { reference: 'Practitioner/test' }
          }
        ];

        const hasActive = hasActiveAlerts(alertList);
        expect(hasActive).toBe(true);
      });

      it('should return false when no active alerts', () => {
        const alertList: PatientAlert[] = [
          {
            id: 'alert-1',
            type: 'allergy',
            severity: 'high',
            title: 'Resolved Allergy',
            description: 'Previously resolved',
            effectiveDate: '2020-01-01',
            active: false,
            createdBy: { reference: 'Practitioner/test' },
            lastUpdatedBy: { reference: 'Practitioner/test' }
          }
        ];

        const hasActive = hasActiveAlerts(alertList);
        expect(hasActive).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('formatPatientName', () => {
      it('should format patient name with all components', () => {
        const patient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [
            {
              use: 'official' as const,
              prefix: ['Dr.'],
              given: ['John', 'Q.'],
              family: 'Doe',
              suffix: ['Jr.', 'MD']
            }
          ],
          omnicarePatientId: 'P12345678'
        };

        const formattedName = formatPatientName(patient);
        expect(formattedName).toBe('Dr. John Q. Doe Jr., MD');
      });

      it('should handle patient with multiple names', () => {
        const patient: OmniCarePatient = {
          resourceType: 'Patient',
          name: [
            { use: 'official' as const, given: ['John'], family: 'Doe' },
            { use: 'nickname' as const, given: ['Johnny'] }
          ],
          omnicarePatientId: 'P12345678'
        };

        const formattedName = formatPatientName(patient);
        expect(formattedName).toBe('John Doe'); // Should use official name
      });

      it('should handle patient without name', () => {
        const patient: OmniCarePatient = {
          resourceType: 'Patient',
          omnicarePatientId: 'P12345678'
        };

        const formattedName = formatPatientName(patient);
        expect(formattedName).toBe('[Name not available]');
      });
    });

    describe('calculateAge', () => {
      it('should calculate correct age from birth date', () => {
        const birthDate = '1990-01-01';
        const age = calculateAge(birthDate);
        
        const currentYear = new Date().getFullYear();
        const expectedAge = currentYear - 1990;
        
        expect(age).toBeGreaterThanOrEqual(expectedAge - 1);
        expect(age).toBeLessThanOrEqual(expectedAge);
      });

      it('should handle leap year birth dates', () => {
        const leapYearBirthDate = '2000-02-29';
        const age = calculateAge(leapYearBirthDate);
        expect(age).toBeGreaterThanOrEqual(0);
      });

      it('should handle future birth dates', () => {
        const futureBirthDate = '2030-01-01';
        const age = calculateAge(futureBirthDate);
        expect(age).toBeLessThan(0); // Negative age for future dates
      });
    });
  });

  describe('Patient Demographics', () => {
    it('should validate demographics structure', () => {
      const demographics: PatientDemographics = {
        race: [{
          coding: [{
            system: 'urn:oid:2.16.840.1.113883.6.238',
            code: '2106-3',
            display: 'White'
          }]
        }],
        ethnicity: [{
          coding: [{
            system: 'urn:oid:2.16.840.1.113883.6.238',
            code: '2186-5',
            display: 'Not Hispanic or Latino'
          }]
        }],
        occupation: 'Software Engineer',
        educationLevel: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-EducationLevel',
            code: '1081',
            display: 'College graduate'
          }]
        }
      };

      expect(demographics.race).toBeDefined();
      expect(demographics.ethnicity).toBeDefined();
      expect(demographics.occupation).toBe('Software Engineer');
      expect(demographics.educationLevel?.coding?.[0]?.code).toBe('1081');
    });
  });

  describe('Social History', () => {
    it('should validate social history structure', () => {
      const socialHistory: PatientSocialHistory = {
        smokingStatus: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '266919005',
            display: 'Never smoked'
          }]
        },
        alcoholUse: {
          status: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: '219006',
              display: 'Current drinker of alcohol'
            }]
          },
          frequency: 'Weekly'
        },
        exerciseHabits: {
          frequency: '3-4 times per week',
          type: ['Running', 'Weight training'],
          intensity: 'moderate'
        }
      };

      expect(socialHistory.smokingStatus?.coding?.[0]?.code).toBe('266919005');
      expect(socialHistory.alcoholUse?.frequency).toBe('Weekly');
      expect(socialHistory.exerciseHabits?.type).toContain('Running');
    });
  });

  describe('Accessibility Needs', () => {
    it('should validate accessibility needs structure', () => {
      const accessibilityNeeds: AccessibilityNeeds = {
        physicalDisability: ['Mobility impairment', 'Visual impairment'],
        assistiveDevices: ['Wheelchair', 'Hearing aid'],
        accommodationRequests: ['Sign language interpreter', 'Large print materials'],
        communicationNeeds: ['TTY phone access'],
        transportationNeeds: ['Wheelchair accessible vehicle']
      };

      expect(accessibilityNeeds.physicalDisability).toContain('Mobility impairment');
      expect(accessibilityNeeds.assistiveDevices).toContain('Wheelchair');
      expect(accessibilityNeeds.accommodationRequests).toContain('Sign language interpreter');
    });
  });
});