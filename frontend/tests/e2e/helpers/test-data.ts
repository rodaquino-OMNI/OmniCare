import { faker } from '@faker-js/faker';
import { Patient, Practitioner, Encounter, Observation, MedicationRequest } from '@medplum/fhirtypes';

/**
 * Test Data Generators for E2E Tests
 * Provides consistent, realistic test data for all E2E testing scenarios
 */

// Generate a unique test identifier for this test run
export const TEST_RUN_ID = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Demo user accounts for testing
export const DEMO_USERS = {
  doctor: {
    email: 'doctor@omnicare.com',
    password: 'demo123',
    role: 'physician',
    firstName: 'Dr. Sarah',
    lastName: 'Johnson'
  },
  nurse: {
    email: 'nurse@omnicare.com',
    password: 'demo123',
    role: 'nurse',
    firstName: 'Emily',
    lastName: 'Davis'
  },
  admin: {
    email: 'admin@omnicare.com',
    password: 'demo123',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User'
  }
};

// Common test constants
export const TEST_CONSTANTS = {
  TIMEOUTS: {
    SHORT: 5000,
    MEDIUM: 10000,
    LONG: 30000
  },
  RETRY_COUNT: 3,
  WAIT_FOR_ANIMATION: 500
};

/**
 * Generate a mock patient with realistic data
 */
export function generateMockPatient(): {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  ssn: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  medicalHistory: {
    allergies: Array<{
      allergen: string;
      severity: 'mild' | 'moderate' | 'severe';
      reaction: string;
    }>;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
    }>;
    conditions: Array<{
      condition: string;
      diagnosedDate: string;
    }>;
  };
} {
  const gender = faker.helpers.arrayElement(['male', 'female', 'other'] as const);
  const firstName = faker.person.firstName(gender === 'other' ? undefined : gender);
  const lastName = faker.person.lastName();
  const dateOfBirth = faker.date.birthdate({ min: 18, max: 90, mode: 'age' });
  
  return {
    firstName,
    middleName: Math.random() > 0.5 ? faker.person.middleName() : undefined,
    lastName,
    dateOfBirth: dateOfBirth.toISOString().split('T')[0],
    gender,
    ssn: generateMockSSN(),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    phone: faker.phone.number('###-###-####'),
    address: {
      line1: faker.location.streetAddress(),
      line2: Math.random() > 0.7 ? faker.location.secondaryAddress() : undefined,
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      zipCode: faker.location.zipCode()
    },
    emergencyContact: {
      name: faker.person.fullName(),
      relationship: faker.helpers.arrayElement(['spouse', 'parent', 'sibling', 'child', 'friend']),
      phone: faker.phone.number('###-###-####')
    },
    insurance: {
      provider: faker.helpers.arrayElement([
        'Blue Cross Blue Shield',
        'Aetna',
        'Cigna',
        'UnitedHealthcare',
        'Humana',
        'Kaiser Permanente'
      ]),
      policyNumber: faker.string.alphanumeric(12).toUpperCase(),
      groupNumber: faker.string.alphanumeric(8).toUpperCase()
    },
    medicalHistory: {
      allergies: generateMockAllergies(),
      medications: generateMockMedications(),
      conditions: generateMockConditions()
    }
  };
}

/**
 * Generate a mock SSN for testing
 */
export function generateMockSSN(): string {
  // Generate a valid format SSN for testing (not real)
  const area = faker.number.int({ min: 100, max: 799 });
  const group = faker.number.int({ min: 10, max: 99 });
  const serial = faker.number.int({ min: 1000, max: 9999 });
  return `${area}-${group}-${serial}`;
}

/**
 * Generate mock allergies
 */
function generateMockAllergies() {
  const commonAllergens = [
    'Penicillin', 'Sulfa drugs', 'Aspirin', 'Latex', 'Shellfish',
    'Peanuts', 'Tree nuts', 'Eggs', 'Milk', 'Soy'
  ];
  
  const count = faker.number.int({ min: 0, max: 3 });
  return Array.from({ length: count }, () => ({
    allergen: faker.helpers.arrayElement(commonAllergens),
    severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe'] as const),
    reaction: faker.helpers.arrayElement([
      'Skin rash', 'Hives', 'Swelling', 'Difficulty breathing',
      'Nausea', 'Vomiting', 'Anaphylaxis'
    ])
  }));
}

/**
 * Generate mock medications
 */
function generateMockMedications() {
  const commonMedications = [
    { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
    { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
    { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily' },
    { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' },
    { name: 'Metoprolol', dosage: '25mg', frequency: 'Twice daily' }
  ];
  
  const count = faker.number.int({ min: 0, max: 4 });
  return Array.from({ length: count }, () => 
    faker.helpers.arrayElement(commonMedications)
  );
}

/**
 * Generate mock medical conditions
 */
function generateMockConditions() {
  const commonConditions = [
    'Hypertension', 'Type 2 Diabetes', 'Hyperlipidemia',
    'Asthma', 'GERD', 'Osteoarthritis', 'Depression', 'Anxiety'
  ];
  
  const count = faker.number.int({ min: 0, max: 3 });
  return Array.from({ length: count }, () => ({
    condition: faker.helpers.arrayElement(commonConditions),
    diagnosedDate: faker.date.past({ years: 10 }).toISOString().split('T')[0]
  }));
}

/**
 * Generate mock vital signs
 */
export function generateMockVitalSigns() {
  return {
    temperature: faker.number.float({ min: 97.0, max: 100.5, fractionDigits: 1 }),
    systolicBP: faker.number.int({ min: 90, max: 180 }),
    diastolicBP: faker.number.int({ min: 60, max: 110 }),
    heartRate: faker.number.int({ min: 60, max: 120 }),
    respiratoryRate: faker.number.int({ min: 12, max: 24 }),
    oxygenSaturation: faker.number.int({ min: 95, max: 100 }),
    weight: faker.number.int({ min: 100, max: 300 }),
    height: faker.number.int({ min: 60, max: 78 })
  };
}

/**
 * Generate mock encounter data
 */
export function generateMockEncounter(patientId: string) {
  return {
    patientId,
    type: faker.helpers.arrayElement([
      'routine', 'urgent', 'emergency', 'follow-up', 'consultation'
    ]),
    chiefComplaint: faker.helpers.arrayElement([
      'Annual physical examination',
      'Follow-up for chronic conditions',
      'Chest pain evaluation',
      'Routine medication management',
      'Flu-like symptoms'
    ]),
    visitReason: faker.helpers.arrayElement([
      'Routine checkup',
      'Medication review',
      'Symptom evaluation',
      'Preventive care',
      'Chronic disease management'
    ]),
    date: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
    time: faker.date.recent().toTimeString().slice(0, 5)
  };
}

/**
 * Generate mock lab order data
 */
export function generateMockLabOrder() {
  const availableTests = [
    { code: 'CBC', name: 'Complete Blood Count' },
    { code: 'BMP', name: 'Basic Metabolic Panel' },
    { code: 'CMP', name: 'Comprehensive Metabolic Panel' },
    { code: 'LIPID', name: 'Lipid Panel' },
    { code: 'TSH', name: 'Thyroid Stimulating Hormone' },
    { code: 'HBA1C', name: 'Hemoglobin A1C' },
    { code: 'PSA', name: 'Prostate Specific Antigen' },
    { code: 'UA', name: 'Urinalysis' }
  ];
  
  const selectedTests = faker.helpers.arrayElements(availableTests, { min: 1, max: 4 });
  
  return {
    tests: selectedTests,
    priority: faker.helpers.arrayElement(['routine', 'urgent', 'stat']),
    specialInstructions: faker.helpers.arrayElement([
      'Patient is fasting',
      'Collect after 8 hours of fasting',
      'No special instructions',
      'Patient on anticoagulants'
    ]),
    collectionDate: faker.date.future({ years: 0.02 }).toISOString().split('T')[0] // ~7 days
  };
}

/**
 * Generate mock prescription data
 */
export function generateMockPrescription() {
  const medications = [
    { name: 'Lisinopril', strengths: ['5mg', '10mg', '20mg'] },
    { name: 'Metformin', strengths: ['500mg', '850mg', '1000mg'] },
    { name: 'Atorvastatin', strengths: ['10mg', '20mg', '40mg'] },
    { name: 'Amlodipine', strengths: ['2.5mg', '5mg', '10mg'] },
    { name: 'Metoprolol', strengths: ['25mg', '50mg', '100mg'] }
  ];
  
  const medication = faker.helpers.arrayElement(medications);
  const strength = faker.helpers.arrayElement(medication.strengths);
  
  return {
    medication: `${medication.name} ${strength}`,
    dosage: strength,
    frequency: faker.helpers.arrayElement([
      'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
      'Every 8 hours', 'Every 12 hours', 'As needed'
    ]),
    duration: faker.helpers.arrayElement(['7 days', '14 days', '30 days', '90 days']),
    quantity: faker.number.int({ min: 30, max: 90 }),
    refills: faker.number.int({ min: 0, max: 5 }),
    instructions: faker.helpers.arrayElement([
      'Take with food',
      'Take on empty stomach',
      'Take with or without food',
      'Take at bedtime',
      'Take in the morning'
    ])
  };
}

/**
 * Generate mock assessment and plan data
 */
export function generateMockAssessmentPlan() {
  const assessments = [
    'Patient appears healthy with no acute concerns',
    'Stable chronic conditions with good management',
    'Mild symptoms requiring monitoring',
    'Improvement noted from previous visit',
    'New symptoms requiring further evaluation'
  ];
  
  const plans = [
    'Continue current medications and follow up in 3 months',
    'Adjust medication dosage and recheck in 4 weeks',
    'Order additional lab work and follow up with results',
    'Refer to specialist for further evaluation',
    'Begin new treatment plan and monitor response'
  ];
  
  const diagnoses = [
    { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' },
    { code: 'I10', description: 'Essential hypertension' },
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
    { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
    { code: 'J45.9', description: 'Asthma, unspecified' }
  ];
  
  return {
    assessment: faker.helpers.arrayElement(assessments),
    plan: faker.helpers.arrayElement(plans),
    diagnosis: faker.helpers.arrayElement(diagnoses)
  };
}

/**
 * Generate a complete test patient scenario
 */
export function generateCompletePatientScenario() {
  const patient = generateMockPatient();
  const encounter = generateMockEncounter('temp-patient-id');
  const vitals = generateMockVitalSigns();
  const assessment = generateMockAssessmentPlan();
  const labOrder = generateMockLabOrder();
  const prescription = generateMockPrescription();
  
  return {
    patient,
    encounter,
    vitals,
    assessment,
    labOrder,
    prescription,
    testId: `scenario-${TEST_RUN_ID}`
  };
}

/**
 * Generate test data for bulk operations
 */
export function generateBulkTestData(count: number = 5) {
  return Array.from({ length: count }, () => generateCompletePatientScenario());
}

/**
 * Generate error test scenarios
 */
export function generateErrorScenarios() {
  return {
    invalidEmail: {
      email: 'invalid-email',
      password: 'validpassword123'
    },
    invalidCredentials: {
      email: 'nonexistent@example.com',
      password: 'wrongpassword'
    },
    networkError: {
      simulateNetworkFailure: true
    },
    serverError: {
      simulateServerError: true
    },
    invalidPatientData: {
      firstName: '',
      lastName: '',
      dateOfBirth: 'invalid-date',
      email: 'invalid-email'
    }
  };
}

/**
 * Get all test patient IDs for cleanup
 */
export function getAllTestPatientIds(): string[] {
  // Return list of all test patient IDs that should be cleaned up
  const patientIds = [
    'test-patient-001',
    'test-patient-002', 
    'test-patient-003',
    'test-patient-004',
    'test-patient-005'
  ];
  
  return patientIds.concat([`test-run-${TEST_RUN_ID}`]);
}

/**
 * Clean up test data (for use in teardown)
 */
export function getTestDataCleanupIds(): string[] {
  // Return list of IDs that should be cleaned up after tests
  return [`test-run-${TEST_RUN_ID}`];
}

