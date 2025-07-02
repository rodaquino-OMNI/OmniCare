/**
 * Patient Test Fixtures
 * Centralized patient data for consistent frontend testing
 */

import { Patient, AllergyIntolerance, Condition } from '@medplum/fhirtypes';

export const mockPatients: Patient[] = [
  {
    resourceType: 'Patient',
    id: 'test-patient-1',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    active: true,
    identifier: [
      {
        use: 'usual' as const,
        system: 'http://omnicare.com/patient-id',
        value: 'MRN123456',
      },
    ],
    name: [
      {
        use: 'official' as const,
        family: 'Doe',
        given: ['John'],
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '555-0123',
        use: 'mobile' as const,
      },
      {
        system: 'email',
        value: 'john.doe@example.com',
        use: 'home' as const,
      },
    ],
    gender: 'male' as const,
    birthDate: '1990-01-15',
    address: [
      {
        use: 'home' as const,
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'NY',
        postalCode: '12345',
        country: 'US',
      },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'test-patient-2',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    active: true,
    identifier: [
      {
        use: 'usual' as const,
        system: 'http://omnicare.com/patient-id',
        value: 'MRN789012',
      },
    ],
    name: [
      {
        use: 'official' as const,
        family: 'Smith',
        given: ['Jane'],
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '555-0456',
        use: 'mobile' as const,
      },
      {
        system: 'email',
        value: 'jane.smith@example.com',
        use: 'home' as const,
      },
    ],
    gender: 'female' as const,
    birthDate: '1985-05-15',
    address: [
      {
        use: 'home' as const,
        line: ['456 Oak Ave'],
        city: 'Another City',
        state: 'CA',
        postalCode: '67890',
        country: 'US',
      },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'test-patient-inactive',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    active: false,
    identifier: [
      {
        use: 'usual' as const,
        system: 'http://omnicare.com/patient-id',
        value: 'MRN345678',
      },
    ],
    name: [
      {
        use: 'official' as const,
        family: 'Johnson',
        given: ['Bob'],
      },
    ],
    gender: 'male' as const,
    birthDate: '1975-12-01',
  },
];

export const mockAllergies: AllergyIntolerance[] = [
  {
    resourceType: 'AllergyIntolerance',
    id: 'test-allergy-1',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    patient: {
      reference: 'Patient/test-patient-1',
    },
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '387517004',
          display: 'Penicillin',
        },
      ],
      text: 'Penicillin',
    },
    criticality: 'high',
    reaction: [
      {
        manifestation: [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '490008',
                display: 'Anaphylaxis',
              },
            ],
            text: 'Anaphylaxis',
          },
        ],
        severity: 'severe',
      },
    ],
  },
  {
    resourceType: 'AllergyIntolerance',
    id: 'test-allergy-2',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    patient: {
      reference: 'Patient/test-patient-1',
    },
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '227037002',
          display: 'Shellfish',
        },
      ],
      text: 'Shellfish',
    },
    criticality: 'low',
    reaction: [
      {
        manifestation: [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '247472004',
                display: 'Hives',
              },
            ],
            text: 'Hives',
          },
        ],
        severity: 'mild',
      },
    ],
  },
];

export const mockConditions: Condition[] = [
  {
    resourceType: 'Condition',
    id: 'test-condition-1',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    subject: {
      reference: 'Patient/test-patient-1',
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '44054006',
          display: 'Type 2 diabetes mellitus',
        },
      ],
      text: 'Type 2 Diabetes',
    },
    onsetDateTime: '2020-01-01',
  },
  {
    resourceType: 'Condition',
    id: 'test-condition-2',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    subject: {
      reference: 'Patient/test-patient-1',
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'inactive',
          display: 'Inactive',
        },
      ],
    },
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '38341003',
          display: 'Essential hypertension',
        },
      ],
      text: 'Hypertension',
    },
    onsetDateTime: '2018-01-01',
    abatementDateTime: '2023-01-01',
  },
];

// Helper functions for test fixtures
export const getPatientById = (id: string): Patient | undefined => {
  return mockPatients.find(patient => patient.id === id);
};

export const getPatientByMrn = (mrn: string): Patient | undefined => {
  return mockPatients.find(patient => 
    patient.identifier?.some(identifier => identifier.value === mrn)
  );
};

export const getAllergiesForPatient = (patientId: string): AllergyIntolerance[] => {
  return mockAllergies.filter(allergy => 
    allergy.patient?.reference === `Patient/${patientId}`
  );
};

export const getConditionsForPatient = (patientId: string): Condition[] => {
  return mockConditions.filter(condition => 
    condition.subject?.reference === `Patient/${patientId}`
  );
};

export const getActiveConditionsForPatient = (patientId: string): Condition[] => {
  return getConditionsForPatient(patientId).filter(condition =>
    condition.clinicalStatus?.coding?.some(coding => coding.code === 'active')
  );
};

export const getHighPriorityAllergiesForPatient = (patientId: string): AllergyIntolerance[] => {
  return getAllergiesForPatient(patientId).filter(allergy => 
    allergy.criticality === 'high'
  );
};

// Factory functions for creating test data
export const createTestPatient = (overrides: Partial<Patient> = {}): Patient => {
  const basePatient = mockPatients[0];
  return {
    ...basePatient,
    ...overrides,
    id: overrides.id || `test-patient-${Date.now()}`,
  };
};

export const createTestAllergy = (
  patientId: string, 
  overrides: Partial<AllergyIntolerance> = {}
): AllergyIntolerance => {
  const baseAllergy = mockAllergies[0];
  return {
    ...baseAllergy,
    ...overrides,
    id: overrides.id || `test-allergy-${Date.now()}`,
    patient: {
      reference: `Patient/${patientId}`,
    },
  };
};

export const createTestCondition = (
  patientId: string, 
  overrides: Partial<Condition> = {}
): Condition => {
  const baseCondition = mockConditions[0];
  return {
    ...baseCondition,
    ...overrides,
    id: overrides.id || `test-condition-${Date.now()}`,
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
};

// Mock data for different scenarios
export const patientScenarios = {
  healthy: mockPatients[1], // Jane Smith - no allergies or conditions
  withAllergies: mockPatients[0], // John Doe - has allergies
  withConditions: mockPatients[0], // John Doe - has conditions
  inactive: mockPatients[2], // Bob Johnson - inactive patient
};

export default {
  mockPatients,
  mockAllergies,
  mockConditions,
  getPatientById,
  getPatientByMrn,
  getAllergiesForPatient,
  getConditionsForPatient,
  getActiveConditionsForPatient,
  getHighPriorityAllergiesForPatient,
  createTestPatient,
  createTestAllergy,
  createTestCondition,
  patientScenarios,
};