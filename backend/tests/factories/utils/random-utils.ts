/**
 * Random Utilities for Test Factories
 * Provides consistent random data generation
 */

import { faker } from '@faker-js/faker';

/**
 * Generate random medical record number
 */
export function randomMRN(): string {
  return `MRN${faker.string.alphanumeric(8).toUpperCase()}`;
}

/**
 * Generate random employee ID
 */
export function randomEmployeeId(): string {
  return `EMP${faker.string.alphanumeric(6).toUpperCase()}`;
}

/**
 * Generate random NPI number (National Provider Identifier)
 */
export function randomNPI(): string {
  return faker.string.numeric(10);
}

/**
 * Generate random DEA number
 */
export function randomDEA(): string {
  const letters = faker.string.alpha(2).toUpperCase();
  const numbers = faker.string.numeric(7);
  return `${letters}${numbers}`;
}

/**
 * Generate random license number
 */
export function randomLicenseNumber(): string {
  return `LIC${faker.string.alphanumeric(8).toUpperCase()}`;
}

/**
 * Generate random insurance member ID
 */
export function randomInsuranceMemberId(): string {
  return faker.string.alphanumeric(12).toUpperCase();
}

/**
 * Generate random insurance group number
 */
export function randomInsuranceGroupNumber(): string {
  return faker.string.alphanumeric(8).toUpperCase();
}

/**
 * Generate random phone number in US format
 */
export function randomPhoneNumber(): string {
  const area = faker.string.numeric(3);
  const prefix = faker.string.numeric(3);
  const line = faker.string.numeric(4);
  return `${area}-${prefix}-${line}`;
}

/**
 * Generate random SSN (for testing only - not real)
 */
export function randomSSN(): string {
  const part1 = faker.string.numeric(3);
  const part2 = faker.string.numeric(2);
  const part3 = faker.string.numeric(4);
  return `${part1}-${part2}-${part3}`;
}

/**
 * Generate random postal code
 */
export function randomPostalCode(): string {
  return faker.location.zipCode();
}

/**
 * Generate random appointment duration (15-120 minutes)
 */
export function randomAppointmentDuration(): number {
  const durations = [15, 30, 45, 60, 90, 120];
  return faker.helpers.arrayElement(durations);
}

/**
 * Generate random vital sign values
 */
export function randomVitalSigns() {
  return {
    temperature: {
      fahrenheit: faker.number.float({ min: 96.0, max: 103.0, fractionDigits: 1 }),
      celsius: faker.number.float({ min: 35.5, max: 39.4, fractionDigits: 1 })
    },
    bloodPressure: {
      systolic: faker.number.int({ min: 90, max: 180 }),
      diastolic: faker.number.int({ min: 60, max: 120 })
    },
    heartRate: faker.number.int({ min: 60, max: 120 }),
    respiratoryRate: faker.number.int({ min: 12, max: 25 }),
    oxygenSaturation: faker.number.int({ min: 95, max: 100 }),
    weight: {
      pounds: faker.number.int({ min: 100, max: 300 }),
      kilograms: faker.number.float({ min: 45, max: 136, fractionDigits: 1 })
    },
    height: {
      inches: faker.number.int({ min: 60, max: 80 }),
      centimeters: faker.number.int({ min: 152, max: 203 })
    }
  };
}

/**
 * Generate random lab values
 */
export function randomLabValues() {
  return {
    glucose: faker.number.int({ min: 70, max: 200 }),
    cholesterol: faker.number.int({ min: 150, max: 300 }),
    hemoglobin: faker.number.float({ min: 12.0, max: 18.0, fractionDigits: 1 }),
    whiteBloodCell: faker.number.float({ min: 4.0, max: 12.0, fractionDigits: 1 }),
    creatinine: faker.number.float({ min: 0.6, max: 1.5, fractionDigits: 1 })
  };
}

/**
 * Common medical specialties
 */
export const MedicalSpecialties = [
  'Family Medicine',
  'Internal Medicine',
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Emergency Medicine',
  'Endocrinology',
  'Gastroenterology',
  'Geriatrics',
  'Hematology',
  'Infectious Disease',
  'Nephrology',
  'Neurology',
  'Obstetrics and Gynecology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Otolaryngology',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Surgery',
  'Urology'
];

/**
 * Common insurance providers
 */
export const InsuranceProviders = [
  'Aetna',
  'Anthem',
  'Blue Cross Blue Shield',
  'Cigna',
  'Humana',
  'Kaiser Permanente',
  'Medicare',
  'Medicaid',
  'United Healthcare',
  'Tricare'
];

/**
 * Common medication names
 */
export const CommonMedications = [
  'Lisinopril',
  'Metformin',
  'Amlodipine',
  'Metoprolol',
  'Omeprazole',
  'Simvastatin',
  'Losartan',
  'Hydrochlorothiazide',
  'Gabapentin',
  'Sertraline',
  'Ibuprofen',
  'Acetaminophen',
  'Aspirin',
  'Atorvastatin',
  'Levothyroxine'
];

/**
 * Common allergens
 */
export const CommonAllergens = [
  'Penicillin',
  'Sulfa drugs',
  'Latex',
  'Shellfish',
  'Peanuts',
  'Tree nuts',
  'Eggs',
  'Milk',
  'Soy',
  'Codeine',
  'Morphine',
  'Contrast dye',
  'Bee stings',
  'Pollen',
  'Dust mites'
];

/**
 * Common chief complaints
 */
export const ChiefComplaints = [
  'Chest pain',
  'Shortness of breath',
  'Abdominal pain',
  'Headache',
  'Back pain',
  'Knee pain',
  'Fever',
  'Cough',
  'Fatigue',
  'Dizziness',
  'Nausea',
  'Rash',
  'Sore throat',
  'Anxiety',
  'Depression',
  'Insomnia',
  'Joint pain',
  'Muscle pain',
  'High blood pressure',
  'Diabetes management'
];

/**
 * Generate random severity level
 */
export function randomSeverity(): 'low' | 'medium' | 'high' | 'critical' {
  return faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']);
}

/**
 * Generate random priority level
 */
export function randomPriority(): 'low' | 'medium' | 'high' {
  return faker.helpers.arrayElement(['low', 'medium', 'high']);
}

/**
 * Generate random status
 */
export function randomStatus(): 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' {
  return faker.helpers.arrayElement(['active', 'inactive', 'pending', 'completed', 'cancelled']);
}

/**
 * Generate random gender
 */
export function randomGender(): 'male' | 'female' | 'other' | 'unknown' {
  return faker.helpers.arrayElement(['male', 'female', 'other', 'unknown']);
}

/**
 * Generate random US state abbreviation
 */
export function randomStateAbbr(): string {
  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];
  return faker.helpers.arrayElement(states);
}

/**
 * Generate random marital status
 */
export function randomMaritalStatus() {
  const statuses = [
    { code: 'S', display: 'Single' },
    { code: 'M', display: 'Married' },
    { code: 'D', display: 'Divorced' },
    { code: 'W', display: 'Widowed' },
    { code: 'L', display: 'Legally Separated' },
    { code: 'U', display: 'Unknown' }
  ];
  return faker.helpers.arrayElement(statuses);
}

/**
 * Generate random relationship type
 */
export function randomRelationship(): string {
  const relationships = [
    'Spouse',
    'Parent',
    'Child',
    'Sibling',
    'Grandparent',
    'Grandchild',
    'Friend',
    'Guardian',
    'Emergency Contact',
    'Other'
  ];
  return faker.helpers.arrayElement(relationships);
}