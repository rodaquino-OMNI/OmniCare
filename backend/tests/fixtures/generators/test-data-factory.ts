/**
 * Comprehensive Test Data Factory
 * Centralized factory for generating consistent, realistic test data
 */

import { faker } from '@faker-js/faker';
import { 
  Patient, 
  Practitioner, 
  Encounter, 
  Observation, 
  MedicationRequest,
  AllergyIntolerance,
  Condition,
  Appointment,
  DiagnosticReport,
  Procedure
} from '@medplum/fhirtypes';

// Set consistent seed for reproducible test data
faker.seed(12345);

export interface TestDataOptions {
  locale?: string;
  includeExtensions?: boolean;
  validationLevel?: 'minimal' | 'standard' | 'strict';
  includeRelatedResources?: boolean;
}

export class TestDataFactory {
  private static idCounter = 1;

  /**
   * Generate a unique ID for testing
   */
  private static generateId(prefix: string = 'test'): string {
    return `${prefix}-${this.idCounter++}-${faker.string.uuid().slice(0, 8)}`;
  }

  /**
   * Create a realistic patient for testing
   */
  static createPatient(options: TestDataOptions & {
    ageGroup?: 'pediatric' | 'adult' | 'geriatric';
    hasChronicConditions?: boolean;
    gender?: 'male' | 'female' | 'other' | 'unknown';
  } = {}): Patient {
    const {
      ageGroup = 'adult',
      hasChronicConditions = false,
      gender,
      locale = 'en',
      includeExtensions = true,
    } = options;

    faker.setLocale(locale);

    // Generate age-appropriate birth date
    const birthDate = this.generateBirthDate(ageGroup);
    const patientGender = gender || faker.helpers.arrayElement(['male', 'female']);
    const firstName = faker.person.firstName(patientGender as any);
    const lastName = faker.person.lastName();

    const patient: Patient = {
      resourceType: 'Patient',
      id: this.generateId('patient'),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
        ...(includeExtensions && {
          tag: [{
            system: 'http://omnicare.com/tags',
            code: 'test-data',
            display: 'Test Patient Data'
          }]
        })
      },
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
          value: `MRN${faker.string.alphanumeric(8).toUpperCase()}`
        },
        {
          use: 'secondary' as const,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'SS',
              display: 'Social Security Number'
            }]
          },
          system: 'http://hl7.org/fhir/sid/us-ssn',
          value: this.generateSSN()
        }
      ],
      name: [{
        use: 'official' as const,
        family: lastName,
        given: [firstName],
        ...(Math.random() > 0.7 && { suffix: ['Jr.', 'Sr.', 'III'][Math.floor(Math.random() * 3)] })
      }],
      telecom: [
        {
          system: 'phone',
          value: faker.phone.number(),
          use: 'mobile' as const as const,
          rank: 1
        },
        {
          system: 'email',
          value: faker.internet.email(firstName, lastName),
          use: 'home' as const,
          rank: 2
        },
        ...(Math.random() > 0.6 ? [{
          system: 'phone',
          value: faker.phone.number(),
          use: 'work' as const as const,
          rank: 3
        }] : [])
      ],
      gender: patientGender,
      birthDate: birthDate.toISOString().split('T')[0],
      address: [{
        use: 'home' as const,
        type: 'both',
        line: [faker.location.streetAddress()],
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US',
        period: {
          start: faker.date.past({ years: 5 }).toISOString().split('T')[0]
        }
      }],
      maritalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: faker.helpers.arrayElement(['S', 'M', 'D', 'W']),
          display: faker.helpers.arrayElement(['Never Married', 'Married', 'Divorced', 'Widowed'])
        }]
      },
      communication: [{
        language: {
          coding: [{
            system: 'urn:ietf:bcp:47',
            code: locale,
            display: locale === 'en' ? 'English' : 'Spanish'
          }]
        },
        preferred: true
      }],
      contact: this.generateEmergencyContacts(),
      ...(includeExtensions && {
        extension: [
          {
            url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
            extension: [{
              url: 'ombCategory',
              valueCoding: {
                system: 'urn:oid:2.16.840.1.113883.6.238',
                code: faker.helpers.arrayElement(['2106-3', '2054-5', '1002-5', '2028-9']),
                display: faker.helpers.arrayElement(['White', 'Black or African American', 'American Indian or Alaska Native', 'Asian'])
              }
            }]
          },
          {
            url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
            extension: [{
              url: 'ombCategory',
              valueCoding: {
                system: 'urn:oid:2.16.840.1.113883.6.238',
                code: faker.helpers.arrayElement(['2135-2', '2186-5']),
                display: faker.helpers.arrayElement(['Hispanic or Latino', 'Not Hispanic or Latino'])
              }
            }]
          },
          ...(hasChronicConditions ? [{
            url: 'http://omnicare.com/fhir/StructureDefinition/chronic-conditions',
            valueBoolean: true
          }] : [])
        ]
      })
    };

    return patient;
  }

  /**
   * Create a realistic practitioner for testing
   */
  static createPractitioner(options: TestDataOptions & {
    specialty?: string;
    isActive?: boolean;
  } = {}): Practitioner {
    const { specialty, isActive = true, includeExtensions = true } = options;

    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      id: this.generateId('practitioner'),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner']
      },
      active: isActive,
      identifier: [
        {
          use: 'official' as const,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'NPI',
              display: 'National Provider Identifier'
            }]
          },
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: faker.string.numeric(10)
        },
        {
          use: 'usual' as const,
          system: 'http://omnicare.com/practitioner-id',
          value: `PR${faker.string.alphanumeric(6).toUpperCase()}`
        }
      ],
      name: [{
        use: 'official' as const,
        family: faker.person.lastName(),
        given: [faker.person.firstName()],
        prefix: ['Dr.'],
        suffix: faker.helpers.maybe(() => ['MD', 'PhD', 'DO'], { probability: 0.8 })
      }],
      telecom: [
        {
          system: 'phone',
          value: faker.phone.number(),
          use: 'work' as const
        },
        {
          system: 'email',
          value: faker.internet.email(),
          use: 'work' as const
        }
      ],
      address: [{
        use: 'work' as const,
        line: [faker.location.streetAddress()],
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US'
      }],
      gender: faker.helpers.arrayElement(['male', 'female']),
      qualification: [{
        identifier: [{
          system: 'http://omnicare.com/license',
          value: `LIC${faker.string.alphanumeric(8).toUpperCase()}`
        }],
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine'
          }]
        },
        period: {
          start: faker.date.past({ years: 10 }).toISOString().split('T')[0]
        },
        issuer: {
          display: `${faker.location.state()} Medical Board`
        }
      }],
      ...(specialty && {
        communication: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: this.getSpecialtyCode(specialty),
            display: specialty
          }]
        }]
      })
    };

    return practitioner;
  }

  /**
   * Create a realistic encounter for testing
   */
  static createEncounter(
    patientId: string, 
    practitionerId?: string, 
    options: TestDataOptions & {
      status?: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
      encounterType?: 'routine' | 'urgent' | 'emergency' | 'wellness';
    } = {}
  ): Encounter {
    const { status = 'in-progress', encounterType = 'routine' } = options;

    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: this.generateId('encounter'),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      },
      status,
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.getEncounterTypeCode(encounterType),
          display: encounterType
        }]
      }],
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Test Patient'
      },
      ...(practitionerId && {
        participant: [{
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'PPRF',
              display: 'primary performer'
            }]
          }],
          individual: {
            reference: `Practitioner/${practitionerId}`,
            display: 'Test Practitioner'
          }
        }]
      }),
      period: {
        start: faker.date.recent({ days: 7 }).toISOString(),
        ...(status === 'finished' && { 
          end: faker.date.recent({ days: 1 }).toISOString() 
        })
      },
      reasonCode: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '73595000',
          display: 'General examination'
        }]
      }],
      serviceProvider: {
        reference: 'Organization/omnicare-clinic',
        display: 'OmniCare Test Clinic'
      }
    };

    return encounter;
  }

  /**
   * Create realistic vital signs observations
   */
  static createVitalSigns(
    patientId: string, 
    encounterId: string,
    options: TestDataOptions & {
      includeAllVitals?: boolean;
    } = {}
  ): Observation[] {
    const { includeAllVitals = true } = options;

    const observations: Observation[] = [];

    // Temperature
    observations.push({
      resourceType: 'Observation',
      id: this.generateId('obs-temp'),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      },
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '8310-5',
          display: 'Body temperature'
        }]
      },
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: faker.number.float({ min: 96.0, max: 102.0, fractionDigits: 1 }),
        unit: '°F',
        system: 'http://unitsofmeasure.org',
        code: '[degF]'
      }
    });

    if (includeAllVitals) {
      // Blood Pressure
      observations.push({
        resourceType: 'Observation',
        id: this.generateId('obs-bp'),
        meta: {
          versionId: '1',
          lastUpdated: new Date().toISOString(),
        },
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: new Date().toISOString(),
        component: [
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure'
              }]
            },
            valueQuantity: {
              value: faker.number.int({ min: 90, max: 180 }),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          },
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure'
              }]
            },
            valueQuantity: {
              value: faker.number.int({ min: 60, max: 110 }),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          }
        ]
      });

      // Heart Rate
      observations.push({
        resourceType: 'Observation',
        id: this.generateId('obs-hr'),
        meta: {
          versionId: '1',
          lastUpdated: new Date().toISOString(),
        },
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: {
          value: faker.number.int({ min: 60, max: 120 }),
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    return observations;
  }

  /**
   * Create test allergies
   */
  static createAllergies(
    patientId: string,
    count: number = 2
  ): AllergyIntolerance[] {
    const allergies: AllergyIntolerance[] = [];
    const commonAllergens = [
      { code: '387517004', display: 'Penicillin' },
      { code: '227037002', display: 'Shellfish' },
      { code: '111088007', display: 'Latex' },
      { code: '387467008', display: 'Sulfonamide' },
      { code: '762952008', display: 'Peanuts' }
    ];

    for (let i = 0; i < count; i++) {
      const allergen = faker.helpers.arrayElement(commonAllergens);
      
      allergies.push({
        resourceType: 'AllergyIntolerance',
        id: this.generateId('allergy'),
        meta: {
          versionId: '1',
          lastUpdated: new Date().toISOString(),
        },
        patient: { reference: `Patient/${patientId}` },
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: allergen.code,
            display: allergen.display
          }]
        },
        criticality: faker.helpers.arrayElement(['low', 'high', 'unable-to-assess']),
        onsetDateTime: faker.date.past({ years: 5 }).toISOString(),
        reaction: [{
          substance: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: allergen.code,
              display: allergen.display
            }]
          },
          manifestation: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: faker.helpers.arrayElement(['247472004', '271807003', '490008']),
              display: faker.helpers.arrayElement(['Hives', 'Eruption', 'Anaphylaxis'])
            }]
          }],
          severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe'])
        }]
      });
    }

    return allergies;
  }

  // Helper methods
  private static generateBirthDate(ageGroup: string): Date {
    switch (ageGroup) {
      case 'pediatric':
        return faker.date.birthdate({ min: 0, max: 17, mode: 'age' });
      case 'geriatric':
        return faker.date.birthdate({ min: 65, max: 95, mode: 'age' });
      default: // adult
        return faker.date.birthdate({ min: 18, max: 64, mode: 'age' });
    }
  }

  private static generateSSN(): string {
    // Generate a test SSN that won't conflict with real ones
    return `900-${faker.string.numeric(2)}-${faker.string.numeric(4)}`;
  }

  private static generateEmergencyContacts(): any[] {
    return [{
      relationship: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
          code: 'C',
          display: 'Emergency Contact'
        }]
      }],
      name: {
        family: faker.person.lastName(),
        given: [faker.person.firstName()]
      },
      telecom: [{
        system: 'phone',
        value: faker.phone.number(),
        use: 'mobile' as const
      }]
    }];
  }

  private static getSpecialtyCode(specialty: string): string {
    const specialtyCodes: Record<string, string> = {
      'Internal Medicine': '419772000',
      'Cardiology': '394579002',
      'Dermatology': '394582007',
      'Emergency Medicine': '773568002',
      'Family Medicine': '419772000',
      'Pediatrics': '394537008',
    };
    return specialtyCodes[specialty] || '394814009'; // General practice
  }

  private static getEncounterTypeCode(type: string): string {
    const typeCodes: Record<string, string> = {
      'routine': '185349003',
      'urgent': '185347001',
      'emergency': '50849002',
      'wellness': '185349003',
    };
    return typeCodes[type] || '185349003';
  }

  /**
   * Create a complete patient record with related resources
   */
  static createCompletePatientRecord(options: TestDataOptions & {
    includeEncounters?: number;
    includeAllergies?: boolean;
    includeConditions?: boolean;
  } = {}): {
    patient: Patient;
    practitioner: Practitioner;
    encounters: Encounter[];
    observations: Observation[];
    allergies: AllergyIntolerance[];
  } {
    const {
      includeEncounters = 2,
      includeAllergies = true,
      includeConditions = true
    } = options;

    const patient = this.createPatient(options);
    const practitioner = this.createPractitioner(options);
    const encounters: Encounter[] = [];
    const observations: Observation[] = [];
    const allergies: AllergyIntolerance[] = [];

    // Create encounters with observations
    for (let i = 0; i < includeEncounters; i++) {
      const encounter = this.createEncounter(patient.id!, practitioner.id, options);
      encounters.push(encounter);

      // Add vital signs for each encounter
      const vitals = this.createVitalSigns(patient.id!, encounter.id!);
      observations.push(...vitals);
    }

    // Add allergies if requested
    if (includeAllergies) {
      allergies.push(...this.createAllergies(patient.id!));
    }

    return {
      patient,
      practitioner,
      encounters,
      observations,
      allergies
    };
  }

  /**
   * Reset the ID counter for consistent test data
   */
  static resetIdCounter(): void {
    this.idCounter = 1;
  }
}

export default TestDataFactory;