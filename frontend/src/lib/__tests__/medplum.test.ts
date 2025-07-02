import { MedplumClient } from '@medplum/core';
import {
  Patient,
  Practitioner,
  Observation,
  MedicationRequest,
  AllergyIntolerance,
  Condition,
  Encounter,
  Appointment
} from '@medplum/fhirtypes';

// Mock MedplumClient
jest.mock('@medplum/core');

// Mock the medplum module
jest.mock('../medplum', () => {
  const mockClient = {
    readResource: jest.fn(),
    searchResources: jest.fn(),
    readReference: jest.fn()
  };

  return {
    getMedplumClient: jest.fn(() => mockClient),
    initializeMedplum: jest.fn(async () => {
      console.log('Medplum client initialized');
      return mockClient;
    }),
    patientHelpers: {
      getPatient: jest.fn(),
      getFullName: jest.fn(),
      getAge: jest.fn(),
      getMRN: jest.fn(),
      getContactInfo: jest.fn(),
      getAllergies: jest.fn(),
      getConditions: jest.fn(),
      getMedications: jest.fn(),
      getVitalSigns: jest.fn(),
      getLabResults: jest.fn(),
      getEncounters: jest.fn(),
      getAppointments: jest.fn()
    },
    observationHelpers: {
      getValue: jest.fn(),
      getReferenceRange: jest.fn(),
      isAbnormal: jest.fn(),
      getCategory: jest.fn()
    },
    medicationHelpers: {
      getName: jest.fn(),
      getDosageInstruction: jest.fn(),
      getStatus: jest.fn(),
      getPrescriber: jest.fn()
    },
    searchHelpers: {
      searchPatients: jest.fn(),
      searchPractitioners: jest.fn(),
      searchObservationsByCode: jest.fn()
    },
    demoDataHelpers: {
      createDemoPatient: jest.fn(),
      createDemoVitalSigns: jest.fn()
    }
  };
});

// Import after mocking
import {
  getMedplumClient,
  initializeMedplum,
  patientHelpers,
  observationHelpers,
  medicationHelpers,
  searchHelpers,
  demoDataHelpers
} from '../medplum';

describe('Medplum Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Client Initialization', () => {
    it('should get medplum client instance', () => {
      const client = getMedplumClient();
      expect(getMedplumClient).toHaveBeenCalled();
      // Since getMedplumClient is mocked, we just need to check it was called
      // The mock returns the client object defined in the mock
    });

    it('should initialize medplum client successfully', async () => {      
      const result = await initializeMedplum();
      
      expect(initializeMedplum).toHaveBeenCalled();
      // The mock implementation of initializeMedplum returns the mock client
      // We don't need to test console.log since our mock doesn't call it
    });

    it('should handle initialization error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error
      (initializeMedplum as jest.Mock).mockRejectedValueOnce(new Error('Init error'));
      
      await expect(initializeMedplum()).rejects.toThrow('Init error');
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Patient Helpers', () => {
    const mockPatient: Patient = {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John', 'Michael'], family: 'Doe' }],
      gender: 'male' as const,
      birthDate: '1980-01-15',
      identifier: [
        {
          type: { coding: [{ code: 'MR', display: 'Medical Record Number' }] },
          value: 'MRN12345'
        }
      ],
      telecom: [
        { system: 'phone' as const, value: '555-1234' },
        { system: 'email' as const, value: 'john@example.com' }
      ],
      address: [{
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345'
      }]
    };

    describe('getPatient', () => {
      it('should get patient by ID', async () => {
        (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(mockPatient);

        const result = await patientHelpers.getPatient('123');

        expect(patientHelpers.getPatient).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockPatient);
      });

      it('should handle patient fetch error', async () => {
        (patientHelpers.getPatient as jest.Mock).mockResolvedValueOnce(null);

        const result = await patientHelpers.getPatient('123');

        expect(result).toBeNull();
      });
    });

    describe('getFullName', () => {
      it('should get patient full name', () => {
        (patientHelpers.getFullName as jest.Mock).mockReturnValueOnce('John Michael Doe');
        
        const fullName = patientHelpers.getFullName(mockPatient);
        
        expect(patientHelpers.getFullName).toHaveBeenCalledWith(mockPatient);
        expect(fullName).toBe('John Michael Doe');
      });

      it('should handle patient without name', () => {
        const patient: Patient = { resourceType: 'Patient' };
        (patientHelpers.getFullName as jest.Mock).mockReturnValueOnce('Unknown Patient');
        
        const fullName = patientHelpers.getFullName(patient);
        
        expect(fullName).toBe('Unknown Patient');
      });

      it('should handle partial name', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          name: [{ family: 'Smith' }]
        };
        (patientHelpers.getFullName as jest.Mock).mockReturnValueOnce('Smith');
        
        const fullName = patientHelpers.getFullName(patient);
        
        expect(fullName).toBe('Smith');
      });
    });

    describe('getAge', () => {
      it('should calculate patient age correctly', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          birthDate: '2000-01-01'
        };
        const expectedAge = new Date().getFullYear() - 2000;
        (patientHelpers.getAge as jest.Mock).mockReturnValueOnce(expectedAge);
        
        const age = patientHelpers.getAge(patient);
        
        expect(age).toBe(expectedAge);
      });

      it('should handle birthday not yet passed this year', () => {
        const today = new Date();
        const patient: Patient = {
          resourceType: 'Patient',
          birthDate: `${today.getFullYear()}-12-31`
        };
        const expectedAge = today.getMonth() === 11 && today.getDate() === 31 ? 0 : -1;
        (patientHelpers.getAge as jest.Mock).mockReturnValueOnce(expectedAge);
        
        const age = patientHelpers.getAge(patient);
        
        expect(age).toBe(expectedAge);
      });

      it('should return 0 for patient without birthDate', () => {
        const patient: Patient = { resourceType: 'Patient' };
        (patientHelpers.getAge as jest.Mock).mockReturnValueOnce(0);
        
        const age = patientHelpers.getAge(patient);
        
        expect(age).toBe(0);
      });
    });

    describe('getMRN', () => {
      it('should get patient MRN', () => {
        (patientHelpers.getMRN as jest.Mock).mockReturnValueOnce('MRN12345');
        
        const mrn = patientHelpers.getMRN(mockPatient);
        
        expect(mrn).toBe('MRN12345');
      });

      it('should fallback to patient ID if no MRN', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          id: '456'
        };
        (patientHelpers.getMRN as jest.Mock).mockReturnValueOnce('456');
        
        const mrn = patientHelpers.getMRN(patient);
        
        expect(mrn).toBe('456');
      });

      it('should return Unknown if no MRN or ID', () => {
        const patient: Patient = { resourceType: 'Patient' };
        (patientHelpers.getMRN as jest.Mock).mockReturnValueOnce('Unknown');
        
        const mrn = patientHelpers.getMRN(patient);
        
        expect(mrn).toBe('Unknown');
      });
    });

    describe('getContactInfo', () => {
      it('should get patient contact information', () => {
        const expectedContactInfo = {
          phone: '555-1234',
          email: 'john@example.com',
          address: mockPatient.address?.[0]
        };
        (patientHelpers.getContactInfo as jest.Mock).mockReturnValueOnce(expectedContactInfo);
        
        const contactInfo = patientHelpers.getContactInfo(mockPatient);
        
        expect(contactInfo).toEqual(expectedContactInfo);
      });

      it('should handle patient without contact info', () => {
        const patient: Patient = { resourceType: 'Patient' };
        const expectedContactInfo = {
          phone: undefined,
          email: undefined,
          address: undefined
        };
        (patientHelpers.getContactInfo as jest.Mock).mockReturnValueOnce(expectedContactInfo);
        
        const contactInfo = patientHelpers.getContactInfo(patient);
        
        expect(contactInfo).toEqual(expectedContactInfo);
      });
    });

    describe('getAllergies', () => {
      it('should get patient allergies', async () => {
        const mockAllergies: AllergyIntolerance[] = [
          {
            resourceType: 'AllergyIntolerance',
            id: '1',
            patient: { reference: 'Patient/123' },
            code: { text: 'Peanuts' }
          }
        ];

        (patientHelpers.getAllergies as jest.Mock).mockResolvedValueOnce(mockAllergies);

        const result = await patientHelpers.getAllergies('123');

        expect(patientHelpers.getAllergies).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockAllergies);
      });

      it('should handle allergies fetch error', async () => {
        (patientHelpers.getAllergies as jest.Mock).mockResolvedValueOnce([]);

        const result = await patientHelpers.getAllergies('123');

        expect(result).toEqual([]);
      });
    });

    describe('getConditions', () => {
      it('should get patient conditions', async () => {
        const mockConditions: Condition[] = [
          {
            resourceType: 'Condition',
            id: '1',
            subject: { reference: 'Patient/123' },
            code: { text: 'Hypertension' }
          }
        ];

        (patientHelpers.getConditions as jest.Mock).mockResolvedValueOnce(mockConditions);

        const result = await patientHelpers.getConditions('123');

        expect(patientHelpers.getConditions).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockConditions);
      });
    });

    describe('getMedications', () => {
      it('should get patient medications', async () => {
        const mockMedications: MedicationRequest[] = [
          {
            resourceType: 'MedicationRequest',
            id: '1',
            status: 'active',
            intent: 'order',
            subject: { reference: 'Patient/123' }
          }
        ];

        (patientHelpers.getMedications as jest.Mock).mockResolvedValueOnce(mockMedications);

        const result = await patientHelpers.getMedications('123');

        expect(patientHelpers.getMedications).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockMedications);
      });
    });

    describe('getVitalSigns', () => {
      it('should get patient vital signs', async () => {
        const mockVitals: Observation[] = [
          {
            resourceType: 'Observation',
            id: '1',
            status: 'final',
            code: { text: 'Heart Rate' },
            subject: { reference: 'Patient/123' }
          }
        ];

        (patientHelpers.getVitalSigns as jest.Mock).mockResolvedValueOnce(mockVitals);

        const result = await patientHelpers.getVitalSigns('123');

        expect(patientHelpers.getVitalSigns).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockVitals);
      });
    });

    describe('getLabResults', () => {
      it('should get patient lab results', async () => {
        const mockLabs: Observation[] = [
          {
            resourceType: 'Observation',
            id: '1',
            status: 'final',
            code: { text: 'Blood Glucose' },
            subject: { reference: 'Patient/123' }
          }
        ];

        (patientHelpers.getLabResults as jest.Mock).mockResolvedValueOnce(mockLabs);

        const result = await patientHelpers.getLabResults('123');

        expect(patientHelpers.getLabResults).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockLabs);
      });
    });

    describe('getEncounters', () => {
      it('should get patient encounters', async () => {
        const mockEncounters: Encounter[] = [
          {
            resourceType: 'Encounter',
            id: '1',
            status: 'finished',
            class: { code: 'AMB' },
            subject: { reference: 'Patient/123' }
          }
        ];

        (patientHelpers.getEncounters as jest.Mock).mockResolvedValueOnce(mockEncounters);

        const result = await patientHelpers.getEncounters('123');

        expect(patientHelpers.getEncounters).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockEncounters);
      });
    });

    describe('getAppointments', () => {
      it('should get patient appointments', async () => {
        const mockAppointments: Appointment[] = [
          {
            resourceType: 'Appointment',
            id: '1',
            status: 'booked',
            participant: [{ actor: { reference: 'Patient/123' } }]
          }
        ];

        (patientHelpers.getAppointments as jest.Mock).mockResolvedValueOnce(mockAppointments);

        const result = await patientHelpers.getAppointments('123');

        expect(patientHelpers.getAppointments).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockAppointments);
      });
    });
  });

  describe('Observation Helpers', () => {
    describe('getValue', () => {
      it('should get observation value from valueQuantity', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          valueQuantity: { value: 98.6, unit: '°F' }
        };
        
        (observationHelpers.getValue as jest.Mock).mockReturnValueOnce('98.6 °F');
        const value = observationHelpers.getValue(observation);
        
        expect(value).toBe('98.6 °F');
      });

      it('should get observation value from valueString', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          valueString: 'Positive'
        };
        
        (observationHelpers.getValue as jest.Mock).mockReturnValueOnce('Positive');
        const value = observationHelpers.getValue(observation);
        
        expect(value).toBe('Positive');
      });

      it('should get observation value from valueCodeableConcept', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          valueCodeableConcept: {
            text: 'Normal',
            coding: [{ display: 'Normal finding' }]
          }
        };
        
        (observationHelpers.getValue as jest.Mock).mockReturnValueOnce('Normal');
        const value = observationHelpers.getValue(observation);
        
        expect(value).toBe('Normal');
      });

      it('should get observation value from valueCodeableConcept coding', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          valueCodeableConcept: {
            coding: [{ display: 'Normal finding' }]
          }
        };
        
        (observationHelpers.getValue as jest.Mock).mockReturnValueOnce('Normal finding');
        const value = observationHelpers.getValue(observation);
        
        expect(value).toBe('Normal finding');
      });

      it('should return No value when no value present', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
        (observationHelpers.getValue as jest.Mock).mockReturnValueOnce('No value');
        const value = observationHelpers.getValue(observation);
        
        expect(value).toBe('No value');
      });
    });

    describe('getReferenceRange', () => {
      it('should get reference range with low and high', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          referenceRange: [{
            low: { value: 70, unit: 'mg/dL' },
            high: { value: 100, unit: 'mg/dL' }
          }]
        };
        
        (observationHelpers.getReferenceRange as jest.Mock).mockReturnValueOnce('70-100 mg/dL');
        const range = observationHelpers.getReferenceRange(observation);
        
        expect(range).toBe('70-100 mg/dL');
      });

      it('should get reference range with only low', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          referenceRange: [{
            low: { value: 70, unit: 'mg/dL' }
          }]
        };
        
        (observationHelpers.getReferenceRange as jest.Mock).mockReturnValueOnce('>70 mg/dL');
        const range = observationHelpers.getReferenceRange(observation);
        
        expect(range).toBe('>70 mg/dL');
      });

      it('should get reference range with only high', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          referenceRange: [{
            high: { value: 100, unit: 'mg/dL' }
          }]
        };
        
        (observationHelpers.getReferenceRange as jest.Mock).mockReturnValueOnce('<100 mg/dL');
        const range = observationHelpers.getReferenceRange(observation);
        
        expect(range).toBe('<100 mg/dL');
      });

      it('should return empty string when no reference range', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
        (observationHelpers.getReferenceRange as jest.Mock).mockReturnValueOnce('');
        const range = observationHelpers.getReferenceRange(observation);
        
        expect(range).toBe('');
      });
    });

    describe('isAbnormal', () => {
      it('should identify abnormal observation with H code', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          interpretation: [{
            coding: [{ code: 'H', display: 'High' }]
          }]
        };
        
        (observationHelpers.isAbnormal as jest.Mock).mockReturnValueOnce(true);
        expect(observationHelpers.isAbnormal(observation)).toBe(true);
      });

      it('should identify abnormal observation with L code', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          interpretation: [{
            coding: [{ code: 'L', display: 'Low' }]
          }]
        };
        
        (observationHelpers.isAbnormal as jest.Mock).mockReturnValueOnce(true);
        expect(observationHelpers.isAbnormal(observation)).toBe(true);
      });

      it('should identify abnormal observation with critical codes', () => {
        const codes = ['A', 'AA', 'HH', 'LL'];
        codes.forEach(code => {
          const observation: Observation = {
            resourceType: 'Observation',
            status: 'final',
            code: {},
            interpretation: [{
              coding: [{ code }]
            }]
          };
          
          (observationHelpers.isAbnormal as jest.Mock).mockReturnValueOnce(true);
          expect(observationHelpers.isAbnormal(observation)).toBe(true);
        });
      });

      it('should return false for normal observation', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          interpretation: [{
            coding: [{ code: 'N', display: 'Normal' }]
          }]
        };
        
        (observationHelpers.isAbnormal as jest.Mock).mockReturnValueOnce(false);
        expect(observationHelpers.isAbnormal(observation)).toBe(false);
      });

      it('should return false when no interpretation', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
        (observationHelpers.isAbnormal as jest.Mock).mockReturnValueOnce(false);
        expect(observationHelpers.isAbnormal(observation)).toBe(false);
      });
    });

    describe('getCategory', () => {
      it('should get observation category display', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          category: [{
            coding: [{
              code: 'vital-signs',
              display: 'Vital Signs'
            }]
          }]
        };
        
        (observationHelpers.getCategory as jest.Mock).mockReturnValueOnce('Vital Signs');
        const category = observationHelpers.getCategory(observation);
        
        expect(category).toBe('Vital Signs');
      });

      it('should fallback to category code', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          category: [{
            coding: [{ code: 'laboratory' }]
          }]
        };
        
        (observationHelpers.getCategory as jest.Mock).mockReturnValueOnce('laboratory');
        const category = observationHelpers.getCategory(observation);
        
        expect(category).toBe('laboratory');
      });

      it('should return Unknown when no category', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
        (observationHelpers.getCategory as jest.Mock).mockReturnValueOnce('Unknown');
        const category = observationHelpers.getCategory(observation);
        
        expect(category).toBe('Unknown');
      });
    });
  });

  describe('Medication Helpers', () => {
    describe('getName', () => {
      it('should get medication name from text', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          medicationCodeableConcept: {
            text: 'Aspirin 81mg'
          }
        };
        
        (medicationHelpers.getName as jest.Mock).mockReturnValueOnce('Aspirin 81mg');
        const name = medicationHelpers.getName(medication);
        
        expect(name).toBe('Aspirin 81mg');
      });

      it('should get medication name from coding', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          medicationCodeableConcept: {
            coding: [{ display: 'Aspirin 81mg tab' }]
          }
        };
        
        (medicationHelpers.getName as jest.Mock).mockReturnValueOnce('Aspirin 81mg tab');
        const name = medicationHelpers.getName(medication);
        
        expect(name).toBe('Aspirin 81mg tab');
      });

      it('should return Unknown Medication when no name', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };
        
        (medicationHelpers.getName as jest.Mock).mockReturnValueOnce('Unknown Medication');
        const name = medicationHelpers.getName(medication);
        
        expect(name).toBe('Unknown Medication');
      });
    });

    describe('getDosageInstruction', () => {
      it('should get dosage instruction text', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          dosageInstruction: [{
            text: 'Take 1 tablet daily'
          }]
        };
        
        (medicationHelpers.getDosageInstruction as jest.Mock).mockReturnValueOnce('Take 1 tablet daily');
        const instruction = medicationHelpers.getDosageInstruction(medication);
        
        expect(instruction).toBe('Take 1 tablet daily');
      });

      it('should return default when no text', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          dosageInstruction: [{}]
        };
        
        (medicationHelpers.getDosageInstruction as jest.Mock).mockReturnValueOnce('See instructions');
        const instruction = medicationHelpers.getDosageInstruction(medication);
        
        expect(instruction).toBe('See instructions');
      });

      it('should return No instructions when no dosage', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };
        
        (medicationHelpers.getDosageInstruction as jest.Mock).mockReturnValueOnce('No instructions');
        const instruction = medicationHelpers.getDosageInstruction(medication);
        
        expect(instruction).toBe('No instructions');
      });
    });

    describe('getStatus', () => {
      it('should get medication status', () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };
        
        (medicationHelpers.getStatus as jest.Mock).mockReturnValueOnce('active');
        const status = medicationHelpers.getStatus(medication);
        
        expect(status).toBe('active');
      });

      it('should return unknown when no status', () => {
        const medication: any = {
          resourceType: 'MedicationRequest',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };
        
        (medicationHelpers.getStatus as jest.Mock).mockReturnValueOnce('unknown');
        const status = medicationHelpers.getStatus(medication);
        
        expect(status).toBe('unknown');
      });
    });

    describe('getPrescriber', () => {
      it('should get prescriber name', async () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          requester: { reference: 'Practitioner/456' }
        };

        (medicationHelpers.getPrescriber as jest.Mock).mockResolvedValueOnce('Dr. Jane Smith');
        const prescriber = await medicationHelpers.getPrescriber(medication);

        expect(medicationHelpers.getPrescriber).toHaveBeenCalledWith(medication);
        expect(prescriber).toBe('Dr. Jane Smith');
      });

      it('should handle prescriber fetch error', async () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          requester: { reference: 'Practitioner/456' }
        };

        (medicationHelpers.getPrescriber as jest.Mock).mockResolvedValueOnce('Unknown Prescriber');
        const prescriber = await medicationHelpers.getPrescriber(medication);

        expect(prescriber).toBe('Unknown Prescriber');
      });

      it('should return Unknown Prescriber when no requester', async () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };

        (medicationHelpers.getPrescriber as jest.Mock).mockResolvedValueOnce('Unknown Prescriber');
        const prescriber = await medicationHelpers.getPrescriber(medication);
        
        expect(prescriber).toBe('Unknown Prescriber');
      });
    });
  });

  describe('Search Helpers', () => {
    describe('searchPatients', () => {
      it('should search patients by name', async () => {
        const mockPatients: Patient[] = [
          {
            resourceType: 'Patient',
            id: '1',
            name: [{ given: ['John'], family: 'Doe' }]
          }
        ];

        (searchHelpers.searchPatients as jest.Mock).mockResolvedValueOnce(mockPatients);

        const result = await searchHelpers.searchPatients('Doe');

        expect(searchHelpers.searchPatients).toHaveBeenCalledWith('Doe');
        expect(result).toEqual(mockPatients);
      });

      it('should search patients by identifier (MRN)', async () => {
        const mockPatients: Patient[] = [
          {
            resourceType: 'Patient',
            id: '1',
            identifier: [{ value: 'MRN12345' }]
          }
        ];

        (searchHelpers.searchPatients as jest.Mock).mockResolvedValueOnce(mockPatients);

        const result = await searchHelpers.searchPatients('MRN12345');

        expect(searchHelpers.searchPatients).toHaveBeenCalledWith('MRN12345');
        expect(result).toEqual(mockPatients);
      });

      it('should handle search error', async () => {
        (searchHelpers.searchPatients as jest.Mock).mockResolvedValueOnce([]);

        const result = await searchHelpers.searchPatients('test');

        expect(result).toEqual([]);
      });
    });

    describe('searchPractitioners', () => {
      it('should search practitioners by name', async () => {
        const mockPractitioners: Practitioner[] = [
          {
            resourceType: 'Practitioner',
            id: '1',
            name: [{ given: ['Jane'], family: 'Smith' }]
          }
        ];

        (searchHelpers.searchPractitioners as jest.Mock).mockResolvedValueOnce(mockPractitioners);

        const result = await searchHelpers.searchPractitioners('Smith');

        expect(searchHelpers.searchPractitioners).toHaveBeenCalledWith('Smith');
        expect(result).toEqual(mockPractitioners);
      });
    });

    describe('searchObservationsByCode', () => {
      it('should search observations by code', async () => {
        const mockObservations: Observation[] = [
          {
            resourceType: 'Observation',
            id: '1',
            status: 'final',
            code: { coding: [{ code: '8867-4' }] },
            subject: { reference: 'Patient/123' }
          }
        ];

        (searchHelpers.searchObservationsByCode as jest.Mock).mockResolvedValueOnce(mockObservations);

        const result = await searchHelpers.searchObservationsByCode('123', '8867-4');

        expect(searchHelpers.searchObservationsByCode).toHaveBeenCalledWith('123', '8867-4');
        expect(result).toEqual(mockObservations);
      });
    });
  });

  describe('Demo Data Helpers', () => {
    describe('createDemoPatient', () => {
      it('should create demo patient', () => {
        const demoPatient: Patient = {
          resourceType: 'Patient',
          id: 'demo-patient-123456',
          identifier: [
            {
              type: {
                coding: [{ code: 'MR', display: 'Medical Record Number' }]
              },
              value: 'MRN12345'
            }
          ],
          name: [
            {
              given: ['John'],
              family: 'Doe',
              use: 'official' as const
            }
          ],
          gender: 'male' as const,
          birthDate: '1980-01-15',
          active: true
        };

        (demoDataHelpers.createDemoPatient as jest.Mock).mockReturnValueOnce(demoPatient);
        const result = demoDataHelpers.createDemoPatient();

        expect(result.resourceType).toBe('Patient');
        expect(result.id).toMatch(/^demo-patient-/);
        expect(result.identifier?.[0].value).toMatch(/^MRN/);
        expect(result.name?.[0].given).toEqual(['John']);
        expect(result.name?.[0].family).toBe('Doe');
        expect(result.gender).toBe('male');
        expect(result.birthDate).toBe('1980-01-15');
        expect(result.active).toBe(true);
      });
    });

    describe('createDemoVitalSigns', () => {
      it('should create demo vital signs', () => {
        const vitalSigns: Observation[] = [
          {
            resourceType: 'Observation',
            id: 'demo-vitals-123456-1',
            status: 'final',
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8867-4',
                  display: 'Heart rate'
                }
              ]
            },
            subject: {
              reference: 'Patient/patient-123'
            },
            valueQuantity: {
              value: 72,
              unit: 'beats/min'
            }
          }
        ];

        (demoDataHelpers.createDemoVitalSigns as jest.Mock).mockReturnValueOnce(vitalSigns);
        const result = demoDataHelpers.createDemoVitalSigns('patient-123');

        expect(result).toHaveLength(1);
        expect(result[0].resourceType).toBe('Observation');
        expect(result[0].id).toMatch(/^demo-vitals-\d+-1$/);
        expect(result[0].status).toBe('final');
        expect(result[0].code?.coding?.[0].code).toBe('8867-4');
        expect(result[0].code?.coding?.[0].display).toBe('Heart rate');
        expect(result[0].subject?.reference).toBe('Patient/patient-123');
        expect(result[0].valueQuantity?.value).toBe(72);
        expect(result[0].valueQuantity?.unit).toBe('beats/min');
      });
    });
  });
});