/**
 * OmniCare Test Data Generator - Patient Fixtures
 * Generates synthetic HIPAA-compliant patient test data for healthcare testing
 */

import { faker } from '@faker-js/faker';
import { OmniCarePatient, PatientEmergencyContact, InsuranceInformation, PatientAlert } from '../../../src/models/patient.model';
import { HumanName, Address, ContactPoint, CodeableConcept } from '../../../src/models/base.model';

// Healthcare-specific faker extensions
export class HealthcareFaker {
  static npi(): string {
    // Generate valid NPI format (10 digits)
    return faker.string.numeric(10);
  }

  static mrn(): string {
    // Generate medical record number
    return 'MRN' + faker.string.numeric(8);
  }

  static insuranceId(): string {
    // Generate insurance member ID
    return faker.string.alphanumeric(9).toUpperCase();
  }

  static ssn(): string {
    // Generate synthetic SSN (avoid real ones)
    return '900-' + faker.string.numeric(2) + '-' + faker.string.numeric(4);
  }

  static icd10(): string {
    const codes = ['E11.9', 'I10', 'Z00.00', 'M79.3', 'K59.00', 'R50.9', 'G44.1'];
    return faker.helpers.arrayElement(codes);
  }

  static cpt(): string {
    const codes = ['99213', '99214', '85025', '80053', '93000', '71020'];
    return faker.helpers.arrayElement(codes);
  }

  static vitalSigns() {
    return {
      temperature: faker.number.float({ min: 96.0, max: 102.0, fractionDigits: 1 }),
      systolicBP: faker.number.int({ min: 90, max: 180 }),
      diastolicBP: faker.number.int({ min: 60, max: 110 }),
      heartRate: faker.number.int({ min: 60, max: 120 }),
      respiratoryRate: faker.number.int({ min: 12, max: 20 }),
      oxygenSaturation: faker.number.int({ min: 95, max: 100 })
    };
  }
}

export interface PatientGeneratorOptions {
  ageGroup?: 'pediatric' | 'adult' | 'geriatric';
  hasChronicConditions?: boolean;
  insuranceType?: 'medicare' | 'medicaid' | 'private' | 'uninsured';
  language?: 'en' | 'es' | 'fr' | 'zh' | 'ar';
  hasAccessibilityNeeds?: boolean;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
}

export class PatientGenerator {
  private static readonly INSURANCE_PLANS = {
    medicare: [
      { name: 'Medicare Part A', type: 'government', copay: 0, deductible: 1632 },
      { name: 'Medicare Part B', type: 'government', copay: 20, deductible: 240 }
    ],
    medicaid: [
      { name: 'Medicaid', type: 'government', copay: 0, deductible: 0 },
      { name: 'Medicaid Managed Care', type: 'government', copay: 5, deductible: 0 }
    ],
    private: [
      { name: 'Blue Cross Blue Shield PPO', type: 'private', copay: 25, deductible: 1500 },
      { name: 'Aetna HMO', type: 'private', copay: 20, deductible: 2000 },
      { name: 'Cigna POS', type: 'private', copay: 30, deductible: 1000 },
      { name: 'UnitedHealthcare EPO', type: 'private', copay: 35, deductible: 2500 }
    ]
  };

  private static readonly CHRONIC_CONDITIONS = [
    { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
    { code: 'I10', display: 'Essential hypertension' },
    { code: 'F32.9', display: 'Major depressive disorder, single episode, unspecified' },
    { code: 'M79.3', display: 'Panniculitis, unspecified' },
    { code: 'E78.5', display: 'Hyperlipidemia, unspecified' },
    { code: 'J44.1', display: 'Chronic obstructive pulmonary disease with acute exacerbation' }
  ];

  private static readonly ALLERGIES = [
    { allergen: 'Penicillin', reaction: 'anaphylaxis', severity: 'high' },
    { allergen: 'Shellfish', reaction: 'hives', severity: 'medium' },
    { allergen: 'Latex', reaction: 'contact dermatitis', severity: 'low' },
    { allergen: 'Sulfa drugs', reaction: 'rash', severity: 'medium' },
    { allergen: 'Peanuts', reaction: 'anaphylaxis', severity: 'high' },
    { allergen: 'Bee venom', reaction: 'swelling', severity: 'medium' }
  ];

  static generatePatient(options: PatientGeneratorOptions = {}): OmniCarePatient {
    const {
      ageGroup = 'adult',
      hasChronicConditions = false,
      insuranceType = 'private',
      language = 'en',
      hasAccessibilityNeeds = false,
      gender,
      maritalStatus
    } = options;

    const birthDate = this.generateBirthDate(ageGroup);
    const patientGender = gender || faker.helpers.arrayElement(['male', 'female']);
    const firstName = faker.person.firstName(patientGender as any);
    const lastName = faker.person.lastName();

    const patient: OmniCarePatient = {
      resourceType: 'Patient',
      id: `patient-${faker.string.uuid()}`,
      active: true,
      identifier: [
        {
          use: 'usual',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number'
            }]
          },
          system: 'http://omnicare.com/patient-id',
          value: HealthcareFaker.mrn()
        },
        {
          use: 'official',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'SS',
              display: 'Social Security Number'
            }]
          },
          system: 'http://hl7.org/fhir/sid/us-ssn',
          value: HealthcareFaker.ssn()
        }
      ],
      name: this.generateName(firstName, lastName, language),
      telecom: this.generateTelecom(),
      gender: patientGender,
      birthDate: birthDate.toISOString().split('T')[0],
      address: this.generateAddress(),
      maritalStatus: this.generateMaritalStatus(maritalStatus),
      communication: this.generateCommunication(language),
      omnicarePatientId: `P${faker.string.numeric(8)}`,
      registrationDate: faker.date.past({ years: 2 }).toISOString(),
      preferredLanguage: language,
      emergencyContact: this.generateEmergencyContacts(),
      insurance: insuranceType !== 'uninsured' ? this.generateInsurance(insuranceType) : [],
      alerts: hasChronicConditions ? this.generateAlerts() : [],
      demographics: {
        race: this.generateRace(),
        ethnicity: this.generateEthnicity(),
        occupation: faker.person.jobTitle(),
        educationLevel: this.generateEducationLevel()
      },
      socialHistory: this.generateSocialHistory(),
      accessibilityNeeds: hasAccessibilityNeeds ? this.generateAccessibilityNeeds() : undefined
    };

    return patient;
  }

  private static generateBirthDate(ageGroup: string): Date {
    const now = new Date();
    switch (ageGroup) {
      case 'pediatric':
        return faker.date.birthdate({ min: 0, max: 17, mode: 'age' });
      case 'geriatric':
        return faker.date.birthdate({ min: 65, max: 95, mode: 'age' });
      default: // adult
        return faker.date.birthdate({ min: 18, max: 64, mode: 'age' });
    }
  }

  private static generateName(firstName: string, lastName: string, language: string): HumanName[] {
    const names: HumanName[] = [{
      use: 'official',
      given: [firstName],
      family: lastName
    }];

    // Add culturally appropriate middle names
    if (language === 'es') {
      names[0].given!.push(faker.person.middleName());
    }

    return names;
  }

  private static generateTelecom(): ContactPoint[] {
    return [
      {
        system: 'phone',
        value: faker.phone.number(),
        use: 'mobile',
        rank: 1
      },
      {
        system: 'email',
        value: faker.internet.email(),
        use: 'home',
        rank: 2
      }
    ];
  }

  private static generateAddress(): Address[] {
    return [{
      use: 'home',
      type: 'both',
      line: [faker.location.streetAddress()],
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      country: 'US'
    }];
  }

  private static generateMaritalStatus(status?: string): CodeableConcept {
    const maritalStatuses = {
      single: { code: 'S', display: 'Never Married' },
      married: { code: 'M', display: 'Married' },
      divorced: { code: 'D', display: 'Divorced' },
      widowed: { code: 'W', display: 'Widowed' }
    };

    const selectedStatus = status || faker.helpers.arrayElement(['single', 'married', 'divorced', 'widowed']);
    const statusInfo = maritalStatuses[selectedStatus as keyof typeof maritalStatuses];

    return {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
        code: statusInfo.code,
        display: statusInfo.display
      }]
    };
  }

  private static generateCommunication(language: string): Array<{ language: CodeableConcept; preferred?: boolean }> {
    const languages = {
      en: { code: 'en', display: 'English' },
      es: { code: 'es', display: 'Spanish' },
      fr: { code: 'fr', display: 'French' },
      zh: { code: 'zh', display: 'Chinese' },
      ar: { code: 'ar', display: 'Arabic' }
    };

    const langInfo = languages[language as keyof typeof languages];

    return [{
      language: {
        coding: [{
          system: 'urn:ietf:bcp:47',
          code: langInfo.code,
          display: langInfo.display
        }]
      },
      preferred: true
    }];
  }

  private static generateEmergencyContacts(): PatientEmergencyContact[] {
    const relationships = ['spouse', 'parent', 'child', 'sibling', 'friend'];
    
    return [{
      id: faker.string.uuid(),
      relationship: faker.helpers.arrayElement(relationships),
      name: {
        given: [faker.person.firstName()],
        family: faker.person.lastName()
      },
      telecom: [{
        system: 'phone',
        value: faker.phone.number(),
        use: 'mobile'
      }],
      priority: 1,
      active: true
    }];
  }

  private static generateInsurance(type: 'medicare' | 'medicaid' | 'private'): InsuranceInformation[] {
    const plans = this.INSURANCE_PLANS[type];
    const selectedPlan = faker.helpers.arrayElement(plans);

    return [{
      id: faker.string.uuid(),
      subscriberId: HealthcareFaker.insuranceId(),
      payorName: selectedPlan.name,
      planName: selectedPlan.name,
      relationshipToSubscriber: 'self',
      effectiveDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
      copayAmount: selectedPlan.copay,
      deductibleAmount: selectedPlan.deductible,
      active: true,
      priority: 1
    }];
  }

  private static generateAlerts(): PatientAlert[] {
    const allergyInfo = faker.helpers.arrayElement(this.ALLERGIES);
    
    return [{
      id: faker.string.uuid(),
      type: 'allergy',
      severity: allergyInfo.severity as 'low' | 'medium' | 'high',
      title: `${allergyInfo.allergen} Allergy`,
      description: `Patient has known allergy to ${allergyInfo.allergen} with ${allergyInfo.reaction} reaction`,
      effectiveDate: faker.date.past({ years: 5 }).toISOString().split('T')[0],
      active: true,
      createdBy: { reference: 'Practitioner/system' },
      lastUpdatedBy: { reference: 'Practitioner/system' }
    }];
  }

  private static generateRace(): CodeableConcept[] {
    const races = [
      { code: '2106-3', display: 'White' },
      { code: '2054-5', display: 'Black or African American' },
      { code: '1002-5', display: 'American Indian or Alaska Native' },
      { code: '2028-9', display: 'Asian' },
      { code: '2076-8', display: 'Native Hawaiian or Other Pacific Islander' }
    ];

    const race = faker.helpers.arrayElement(races);
    return [{
      coding: [{
        system: 'urn:oid:2.16.840.1.113883.6.238',
        code: race.code,
        display: race.display
      }]
    }];
  }

  private static generateEthnicity(): CodeableConcept[] {
    const ethnicities = [
      { code: '2135-2', display: 'Hispanic or Latino' },
      { code: '2186-5', display: 'Not Hispanic or Latino' }
    ];

    const ethnicity = faker.helpers.arrayElement(ethnicities);
    return [{
      coding: [{
        system: 'urn:oid:2.16.840.1.113883.6.238',
        code: ethnicity.code,
        display: ethnicity.display
      }]
    }];
  }

  private static generateEducationLevel(): CodeableConcept {
    const levels = [
      { code: '65', display: 'Elementary School' },
      { code: '1077', display: 'High School or equivalent' },
      { code: '1079', display: 'Some college' },
      { code: '1081', display: 'College graduate' },
      { code: '1083', display: 'Post graduate' }
    ];

    const level = faker.helpers.arrayElement(levels);
    return {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-EducationLevel',
        code: level.code,
        display: level.display
      }]
    };
  }

  private static generateSocialHistory() {
    return {
      smokingStatus: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: faker.helpers.arrayElement(['266919005', '77176002', '8517006']),
          display: faker.helpers.arrayElement(['Never smoked', 'Current smoker', 'Former smoker'])
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
        frequency: faker.helpers.arrayElement(['Daily', 'Weekly', 'Monthly', 'Rarely'])
      },
      exerciseHabits: {
        frequency: faker.helpers.arrayElement(['Daily', '3-4 times per week', 'Weekly', 'Rarely']),
        type: [faker.helpers.arrayElement(['Walking', 'Running', 'Swimming', 'Cycling', 'Weight training'])],
        intensity: faker.helpers.arrayElement(['low', 'moderate', 'high'])
      }
    };
  }

  private static generateAccessibilityNeeds() {
    return {
      physicalDisability: [faker.helpers.arrayElement(['Mobility impairment', 'Visual impairment', 'Hearing impairment'])],
      assistiveDevices: [faker.helpers.arrayElement(['Wheelchair', 'Walker', 'Hearing aid', 'Guide dog'])],
      accommodationRequests: ['Sign language interpreter', 'Large print materials']
    };
  }

  // Batch generation methods
  static generatePatientCohort(count: number, options: PatientGeneratorOptions = {}): OmniCarePatient[] {
    return Array.from({ length: count }, () => this.generatePatient(options));
  }

  static generateFamilyGroup(size: number = 4): OmniCarePatient[] {
    const lastName = faker.person.lastName();
    const address = this.generateAddress()[0];
    
    return Array.from({ length: size }, (_, index) => {
      const ageGroup = index === 0 || index === 1 ? 'adult' : 'pediatric';
      const patient = this.generatePatient({ ageGroup });
      
      // Share family name and address
      patient.name![0].family = lastName;
      patient.address = [address];
      
      return patient;
    });
  }
}

// Convenience function for global test setup
export function createMockPatient(options: PatientGeneratorOptions = {}): OmniCarePatient {
  return PatientGenerator.generatePatient(options);
}