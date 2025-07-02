import { Patient, DocumentReference, Encounter, Practitioner } from '@medplum/fhirtypes';
import type { UserRoleShort } from '@/types/unified-user-roles';

/**
 * Clinical component test utilities
 * Provides mock data and helper functions for testing clinical components
 */

// Mock Patient with proper FHIR structure
export const createMockPatient = (overrides?: Partial<Patient>): Patient => ({
  resourceType: 'Patient',
  id: 'patient-456',
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString()
  },
  identifier: [{
    system: 'http://hospital.example.org',
    value: 'MRN123456'
  }],
  active: true,
  name: [{
    use: 'official',
    given: ['John'],
    family: 'Doe'
  }],
  gender: 'male' as const,
  birthDate: '1990-01-01',
  telecom: [],
  address: [],
  ...overrides
});

// Mock Encounter with proper FHIR structure
export const createMockEncounter = (patientId: string = 'patient-456'): Encounter => ({
  resourceType: 'Encounter',
  id: 'encounter-789',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory'
  },
  subject: {
    reference: `Patient/${patientId}`,
    display: 'John Doe'
  },
  period: {
    start: new Date().toISOString()
  }
});

// Mock Practitioner for auth
export const createMockPractitioner = (overrides?: Partial<Practitioner>): Practitioner => ({
  resourceType: 'Practitioner',
  id: 'practitioner-123',
  identifier: [{
    system: 'http://hl7.org/fhir/sid/us-npi',
    value: '1234567890'
  }],
  active: true,
  name: [{
    use: 'official',
    given: ['Jane'],
    family: 'Smith',
    prefix: ['Dr.']
  }],
  ...overrides
});

// Mock Auth User
export const createMockAuthUser = () => ({
  id: 'practitioner-123',
  email: 'dr.smith@example.com',
  role: 'physician' as UserRoleShort,
  name: 'Dr. Jane Smith',
  firstName: 'Jane',
  lastName: 'Smith',
  permissions: [], // Adding required permissions array
  department: 'Internal Medicine',
  title: 'Attending Physician'
});

// Mock DocumentReference for notes
export const createMockDocumentReference = (
  patientId: string = 'patient-456',
  encounterId: string = 'encounter-789'
): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'doc-123',
  status: 'current',
  docStatus: 'preliminary',
  type: {
    coding: [{
      system: 'http://loinc.org',
      code: '11506-3',
      display: 'Progress Note'
    }]
  },
  category: [{
    coding: [{
      system: 'http://loinc.org',
      code: '47039-3',
      display: 'Clinical Note'
    }]
  }],
  subject: {
    reference: `Patient/${patientId}`
  },
  date: new Date().toISOString(),
  author: [{
    reference: 'Practitioner/practitioner-123',
    display: 'Dr. Jane Smith'
  }],
  content: [{
    attachment: {
      contentType: 'text/plain',
      data: btoa('Test clinical note content')
    }
  }],
  context: {
    encounter: [{
      reference: `Encounter/${encounterId}`
    }]
  }
});

// Mock Note Data for component props
export const createMockNoteData = () => ({
  type: 'progress',
  title: 'Progress Note - Test',
  content: 'Test clinical note content',
  status: 'draft' as const,
  tags: [] as string[],
  attachments: [] as any[]
});

// Mock Service Responses
export const mockSmartTextResponse = {
  processedText: 'Processed clinical note',
  expansions: [
    { original: '.sob', expanded: 'shortness of breath' },
    { original: '.htn', expanded: 'hypertension' }
  ]
};

export const mockCDSAlertResponse = {
  alerts: [
    {
      severity: 'warning',
      message: 'Consider ordering chest X-ray',
      type: 'clinical-guideline'
    }
  ]
};

// Mock Store Values
export const createMockAuthStore = () => ({
  user: createMockAuthUser(),
  isAuthenticated: true,
  isLoading: false,
  tokens: null,
  session: null,
  permissions: [],
  login: jest.fn(),
  logout: jest.fn(),
  refreshAuth: jest.fn(),
  updateUser: jest.fn(),
  setLoading: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
  hasRole: jest.fn().mockReturnValue(true),
  hasAnyRole: jest.fn().mockReturnValue(true),
  getCurrentUser: jest.fn().mockResolvedValue(undefined)
});

export const createMockPatientStore = (patient?: Patient, encounter?: Encounter) => ({
  currentPatient: patient || createMockPatient(),
  currentEncounter: encounter || createMockEncounter(),
  patients: [],
  isLoading: false,
  error: null,
  setCurrentPatient: jest.fn(),
  setCurrentEncounter: jest.fn(),
  fetchPatients: jest.fn(),
  fetchPatient: jest.fn(),
  createPatient: jest.fn(),
  updatePatient: jest.fn(),
  clearCurrentPatient: jest.fn(),
  clearCurrentEncounter: jest.fn()
});

// Helper function to create extended auth with role permissions
export const createMockUseAuth = (role: UserRoleShort = 'physician') => {
  const baseAuth = createMockAuthStore();
  const rolePermissions = {
    physician: {
      isPhysician: true,
      isDoctor: true,
      isNurse: false,
      isAdmin: false,
      isSystemAdmin: false,
      isPharmacist: false,
      isLabTech: false,
      isRadiologyTech: false,
      isPatient: false,
      canViewPatients: true,
      canEditPatients: true,
      canCreateOrders: true,
      canAdministerMedications: false,
      canPrescribeMedications: true,
      canViewLabResults: true,
      canManageSystem: false,
      canManageBilling: false
    },
    nurse: {
      isPhysician: false,
      isDoctor: false,
      isNurse: true,
      isAdmin: false,
      isSystemAdmin: false,
      isPharmacist: false,
      isLabTech: false,
      isRadiologyTech: false,
      isPatient: false,
      canViewPatients: true,
      canEditPatients: true,
      canCreateOrders: false,
      canAdministerMedications: true,
      canPrescribeMedications: false,
      canViewLabResults: true,
      canManageSystem: false,
      canManageBilling: false
    }
  };

  return {
    ...baseAuth,
    ...(rolePermissions[role] || rolePermissions.physician)
  };
};

// Mock Medplum client methods
export const createMockMedplumClient = () => ({
  searchResources: jest.fn().mockResolvedValue([]),
  createResource: jest.fn().mockResolvedValue(createMockDocumentReference()),
  readResource: jest.fn().mockResolvedValue({}),
  updateResource: jest.fn().mockResolvedValue({}),
  deleteResource: jest.fn().mockResolvedValue({})
});

// Test data for offline functionality
export const mockOfflineNoteData = {
  id: 'offline-note-id',
  tempId: 'temp-123',
  title: 'Test Note',
  content: 'Test content',
  status: 'draft' as const,
  patientId: 'test-patient-id',
  practitionerId: 'test-user-id',
  practitionerName: 'Test User',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
};

export const mockConflictData = {
  id: 'conflict-1',
  title: 'Conflicted Note',
  content: 'Local content version',
  updatedAt: new Date().toISOString(),
  status: 'conflict' as const,
  conflictData: {
    serverNote: {
      resourceType: 'DocumentReference' as const,
      description: 'Server version',
      meta: {
        lastUpdated: new Date().toISOString()
      },
      content: [{
        attachment: {
          data: btoa('Server content version')
        }
      }]
    },
    localChanges: {},
    conflictedAt: new Date().toISOString()
  }
};

// Helper to setup all mocks for a test
export const setupClinicalTestMocks = () => {
  const authStore = createMockAuthStore();
  const patientStore = createMockPatientStore();
  const medplumClient = createMockMedplumClient();
  const useAuth = createMockUseAuth();

  return {
    authStore,
    patientStore,
    medplumClient,
    useAuth,
    patient: patientStore.currentPatient,
    encounter: patientStore.currentEncounter,
    user: authStore.user
  };
};