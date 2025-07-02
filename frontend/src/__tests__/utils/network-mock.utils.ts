// Network mock utilities for testing

// Mock network delay simulation
export const mockNetworkDelay = (ms: number = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Mock fetch responses
export const createMockResponse = (data: any, options: { status?: number; ok?: boolean } = {}) => {
  const { status = 200, ok = true } = options;
  
  return {
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    blob: jest.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    clone: jest.fn(),
  };
};

// Mock network error
export const createMockNetworkError = (message: string = 'Network error') => {
  const error = new Error(message);
  error.name = 'NetworkError';
  return error;
};

// Mock timeout error
export const createMockTimeoutError = () => {
  const error = new Error('Request timeout');
  error.name = 'TimeoutError';
  return error;
};

// Mock FHIR bundle response
export const createMockFHIRBundle = (entries: any[] = []) => {
  return {
    resourceType: 'Bundle',
    id: `mock-bundle-${Date.now()}`,
    type: 'searchset',
    total: entries.length,
    entry: entries.map((resource, index) => ({
      fullUrl: `https://api.medplum.com/fhir/${resource.resourceType}/${resource.id}`,
      resource,
      search: {
        mode: 'match',
        score: 1
      }
    }))
  };
};

// Mock patient data
export const createMockPatient = (id: string = 'test-patient-1') => {
  return {
    resourceType: 'Patient' as const,
    id,
    meta: {
      versionId: '1',
      lastUpdated: new Date().toISOString()
    },
    identifier: [{
      system: 'http://hospital.com/mrn',
      value: `MRN-${id}`
    }],
    active: true,
    name: [{
      use: 'official' as const,
      family: 'Doe',
      given: ['John'],
      prefix: ['Mr.']
    }],
    gender: 'male' as const,
    birthDate: '1990-01-01',
    telecom: [{
      system: 'phone' as const,
      value: '555-0123',
      use: 'mobile' as const
    }],
    address: [{
      use: 'home' as const,
      line: ['123 Main St'],
      city: 'Boston',
      state: 'MA',
      postalCode: '02101',
      country: 'US'
    }]
  };
};

// Mock encounter data
export const createMockEncounter = (id: string = 'test-encounter-1') => {
  return {
    resourceType: 'Encounter',
    id,
    status: 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    subject: {
      reference: 'Patient/test-patient-1'
    },
    period: {
      start: new Date().toISOString()
    }
  };
};

// Mock observation data
export const createMockObservation = (id: string = 'test-observation-1') => {
  return {
    resourceType: 'Observation',
    id,
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
        code: '8480-6',
        display: 'Systolic blood pressure'
      }]
    },
    subject: {
      reference: 'Patient/test-patient-1'
    },
    effectiveDateTime: new Date().toISOString(),
    valueQuantity: {
      value: 120,
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
      code: 'mm[Hg]'
    }
  };
};

// Mock network conditions
export const mockNetworkConditions = {
  offline: () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
  },
  online: () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  },
  slowNetwork: () => {
    // Mock slow network by adding delays to fetch
    global.fetch = jest.fn().mockImplementation(() => 
      mockNetworkDelay(2000).then(() => createMockResponse({}))
    );
  },
  fastNetwork: () => {
    // Mock fast network
    global.fetch = jest.fn().mockImplementation(() => 
      mockNetworkDelay(10).then(() => createMockResponse({}))
    );
  }
};

// Mock navigator.onLine property
export const mockNavigatorOnLine = (isOnline: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: isOnline
  });
};

// Set network state utility
export const setNetworkState = (isOnline: boolean) => {
  mockNavigatorOnLine(isOnline);
  if (isOnline) {
    mockNetworkConditions.online();
  } else {
    mockNetworkConditions.offline();
  }
};

// Reset network mocks
export const resetNetworkMocks = () => {
  jest.clearAllMocks();
  
  // Reset navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
  });
  
  // Reset fetch mock
  if (global.fetch && jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  }
};

// Export default utilities
export default {
  mockNetworkDelay,
  createMockResponse,
  createMockNetworkError,
  createMockTimeoutError,
  createMockFHIRBundle,
  createMockPatient,
  createMockEncounter,
  createMockObservation,
  mockNetworkConditions,
  mockNavigatorOnLine,
  setNetworkState,
  resetNetworkMocks
};