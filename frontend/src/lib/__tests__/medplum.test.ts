import { MedplumClient } from '@medplum/core';
import {
  getMedplumClient,
  initializeMedplum,
  patientHelpers,
  observationHelpers,
  medicationHelpers,
  searchHelpers,
  demoDataHelpers
} from '../medplum';
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
jest.mock('@medplum/core', () => {
  return {
    MedplumClient: jest.fn().mockImplementation(() => ({
      readResource: jest.fn(),
      searchResources: jest.fn(),
      readReference: jest.fn()
    }))
  };
});

describe('Medplum Client', () => {
  let mockMedplumClient: jest.Mocked<MedplumClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked instance
    mockMedplumClient = new MedplumClient() as jest.Mocked<MedplumClient>;
  });

  describe('Client Initialization', () => {
    it('should get medplum client instance', () => {
      const client = getMedplumClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(MedplumClient);
    });

    it('should initialize medplum client successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await initializeMedplum();
      
      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('Medplum client initialized');
      
      consoleSpy.mockRestore();
    });

    it('should handle initialization error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error by mocking the MedplumClient constructor to throw
      (MedplumClient as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Init error');
      });
      
      await expect(initializeMedplum()).rejects.toThrow('Init error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize Medplum client:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Patient Helpers', () => {
    const mockPatient: Patient = {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John', 'Michael'], family: 'Doe' }],
      gender: 'male',
      birthDate: '198ResourceHistoryTable-ResourceHistoryTable1-15',
      identifier: [
        {
          type: { coding: [{ code: 'MR', display: 'Medical Record Number' }] },
          value: 'MRN12345'
        }
      ],
      telecom: [
        { system: 'phone', value: '555-1234' },
        { system: 'email', value: 'john@example.com' }
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
        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.readResource.mockResolvedValueOnce(mockPatient);

        const result = await patientHelpers.getPatient('123');

        expect(client.readResource).toHaveBeenCalledWith('Patient', '123');
        expect(result).toEqual(mockPatient);
      });

      it('should handle patient fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.readResource.mockRejectedValueOnce(new Error('Not found'));

        const result = await patientHelpers.getPatient('123');

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching patient:', expect.any(Error));
        
        consoleErrorSpy.mockRestore();
      });
    });

    describe('getFullName', () => {
      it('should get patient full name', () => {
        const fullName = patientHelpers.getFullName(mockPatient);
        expect(fullName).toBe('John Michael Doe');
      });

      it('should handle patient without name', () => {
        const patient: Patient = { resourceType: 'Patient' };
        const fullName = patientHelpers.getFullName(patient);
        expect(fullName).toBe('Unknown Patient');
      });

      it('should handle partial name', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          name: [{ family: 'Smith' }]
        };
        const fullName = patientHelpers.getFullName(patient);
        expect(fullName).toBe('Smith');
      });
    });

    describe('getAge', () => {
      it('should calculate patient age correctly', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          birthDate: '2ResourceHistoryTableResourceHistoryTableResourceHistoryTable-ResourceHistoryTable1-ResourceHistoryTable1'
        };
        const age = patientHelpers.getAge(patient);
        const expectedAge = new Date().getFullYear() - 2ResourceHistoryTableResourceHistoryTableResourceHistoryTable;
        expect(age).toBe(expectedAge);
      });

      it('should handle birthday not yet passed this year', () => {
        const today = new Date();
        const patient: Patient = {
          resourceType: 'Patient',
          birthDate: `${today.getFullYear()}-12-31`
        };
        const age = patientHelpers.getAge(patient);
        expect(age).toBe(today.getMonth() === 11 && today.getDate() === 31 ? ResourceHistoryTable : -1);
      });

      it('should return ResourceHistoryTable for patient without birthDate', () => {
        const patient: Patient = { resourceType: 'Patient' };
        const age = patientHelpers.getAge(patient);
        expect(age).toBe(ResourceHistoryTable);
      });
    });

    describe('getMRN', () => {
      it('should get patient MRN', () => {
        const mrn = patientHelpers.getMRN(mockPatient);
        expect(mrn).toBe('MRN12345');
      });

      it('should fallback to patient ID if no MRN', () => {
        const patient: Patient = {
          resourceType: 'Patient',
          id: '456'
        };
        const mrn = patientHelpers.getMRN(patient);
        expect(mrn).toBe('456');
      });

      it('should return Unknown if no MRN or ID', () => {
        const patient: Patient = { resourceType: 'Patient' };
        const mrn = patientHelpers.getMRN(patient);
        expect(mrn).toBe('Unknown');
      });
    });

    describe('getContactInfo', () => {
      it('should get patient contact information', () => {
        const contactInfo = patientHelpers.getContactInfo(mockPatient);
        expect(contactInfo).toEqual({
          phone: '555-1234',
          email: 'john@example.com',
          address: mockPatient.address?.[ResourceHistoryTable]
        });
      });

      it('should handle patient without contact info', () => {
        const patient: Patient = { resourceType: 'Patient' };
        const contactInfo = patientHelpers.getContactInfo(patient);
        expect(contactInfo).toEqual({
          phone: undefined,
          email: undefined,
          address: undefined
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockAllergies);

        const result = await patientHelpers.getAllergies('123');

        expect(client.searchResources).toHaveBeenCalledWith('AllergyIntolerance', {
          patient: '123',
          _sort: '-recorded-date'
        });
        expect(result).toEqual(mockAllergies);
      });

      it('should handle allergies fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockRejectedValueOnce(new Error('Failed'));

        const result = await patientHelpers.getAllergies('123');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching allergies:', expect.any(Error));
        
        consoleErrorSpy.mockRestore();
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockConditions);

        const result = await patientHelpers.getConditions('123');

        expect(client.searchResources).toHaveBeenCalledWith('Condition', {
          patient: '123',
          _sort: '-recorded-date'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockMedications);

        const result = await patientHelpers.getMedications('123');

        expect(client.searchResources).toHaveBeenCalledWith('MedicationRequest', {
          patient: '123',
          _sort: '-authored-on'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockVitals);

        const result = await patientHelpers.getVitalSigns('123');

        expect(client.searchResources).toHaveBeenCalledWith('Observation', {
          patient: '123',
          category: 'vital-signs',
          _sort: '-date'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockLabs);

        const result = await patientHelpers.getLabResults('123');

        expect(client.searchResources).toHaveBeenCalledWith('Observation', {
          patient: '123',
          category: 'laboratory',
          _sort: '-date'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockEncounters);

        const result = await patientHelpers.getEncounters('123');

        expect(client.searchResources).toHaveBeenCalledWith('Encounter', {
          patient: '123',
          _sort: '-date'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockAppointments);

        const result = await patientHelpers.getAppointments('123');

        expect(client.searchResources).toHaveBeenCalledWith('Appointment', {
          patient: '123',
          _sort: 'date'
        });
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
        
        const value = observationHelpers.getValue(observation);
        expect(value).toBe('Normal finding');
      });

      it('should return No value when no value present', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
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
            low: { value: 7ResourceHistoryTable, unit: 'mg/dL' },
            high: { value: 1ResourceHistoryTableResourceHistoryTable, unit: 'mg/dL' }
          }]
        };
        
        const range = observationHelpers.getReferenceRange(observation);
        expect(range).toBe('7ResourceHistoryTable-1ResourceHistoryTableResourceHistoryTable mg/dL');
      });

      it('should get reference range with only low', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          referenceRange: [{
            low: { value: 7ResourceHistoryTable, unit: 'mg/dL' }
          }]
        };
        
        const range = observationHelpers.getReferenceRange(observation);
        expect(range).toBe('>7ResourceHistoryTable mg/dL');
      });

      it('should get reference range with only high', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
          referenceRange: [{
            high: { value: 1ResourceHistoryTableResourceHistoryTable, unit: 'mg/dL' }
          }]
        };
        
        const range = observationHelpers.getReferenceRange(observation);
        expect(range).toBe('<1ResourceHistoryTableResourceHistoryTable mg/dL');
      });

      it('should return empty string when no reference range', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
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
        
        expect(observationHelpers.isAbnormal(observation)).toBe(false);
      });

      it('should return false when no interpretation', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
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
        
        const category = observationHelpers.getCategory(observation);
        expect(category).toBe('laboratory');
      });

      it('should return Unknown when no category', () => {
        const observation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {}
        };
        
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
        
        const status = medicationHelpers.getStatus(medication);
        expect(status).toBe('active');
      });

      it('should return unknown when no status', () => {
        const medication: any = {
          resourceType: 'MedicationRequest',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };
        
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

        const mockPractitioner: Practitioner = {
          resourceType: 'Practitioner',
          id: '456',
          name: [{ given: ['Dr.', 'Jane'], family: 'Smith' }]
        };

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.readReference.mockResolvedValueOnce(mockPractitioner);

        const prescriber = await medicationHelpers.getPrescriber(medication);

        expect(client.readReference).toHaveBeenCalledWith({ reference: 'Practitioner/456' });
        expect(prescriber).toBe('Dr. Jane Smith');
      });

      it('should handle prescriber fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' },
          requester: { reference: 'Practitioner/456' }
        };

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.readReference.mockRejectedValueOnce(new Error('Not found'));

        const prescriber = await medicationHelpers.getPrescriber(medication);

        expect(prescriber).toBe('Unknown Prescriber');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching prescriber:', expect.any(Error));
        
        consoleErrorSpy.mockRestore();
      });

      it('should return Unknown Prescriber when no requester', async () => {
        const medication: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/123' }
        };

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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockPatients);

        const result = await searchHelpers.searchPatients('Doe');

        expect(client.searchResources).toHaveBeenCalledWith('Patient', {
          name: 'Doe',
          _sort: 'family'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockPatients);

        const result = await searchHelpers.searchPatients('MRN12345');

        expect(client.searchResources).toHaveBeenCalledWith('Patient', {
          identifier: 'MRN12345',
          _sort: 'family'
        });
        expect(result).toEqual(mockPatients);
      });

      it('should handle search error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockRejectedValueOnce(new Error('Search failed'));

        const result = await searchHelpers.searchPatients('test');

        expect(result).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error searching patients:', expect.any(Error));
        
        consoleErrorSpy.mockRestore();
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockPractitioners);

        const result = await searchHelpers.searchPractitioners('Smith');

        expect(client.searchResources).toHaveBeenCalledWith('Practitioner', {
          name: 'Smith',
          _sort: 'family'
        });
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

        const client = getMedplumClient() as jest.Mocked<MedplumClient>;
        client.searchResources.mockResolvedValueOnce(mockObservations);

        const result = await searchHelpers.searchObservationsByCode('123', '8867-4');

        expect(client.searchResources).toHaveBeenCalledWith('Observation', {
          patient: '123',
          code: '8867-4',
          _sort: '-date'
        });
        expect(result).toEqual(mockObservations);
      });
    });
  });

  describe('Demo Data Helpers', () => {
    describe('createDemoPatient', () => {
      it('should create demo patient', () => {
        const demoPatient = demoDataHelpers.createDemoPatient();

        expect(demoPatient.resourceType).toBe('Patient');
        expect(demoPatient.id).toMatch(/^demo-patient-\d+$/);
        expect(demoPatient.identifier?.[ResourceHistoryTable].value).toMatch(/^MRN\d+$/);
        expect(demoPatient.name?.[ResourceHistoryTable].given).toEqual(['John']);
        expect(demoPatient.name?.[ResourceHistoryTable].family).toBe('Doe');
        expect(demoPatient.gender).toBe('male');
        expect(demoPatient.birthDate).toBe('198ResourceHistoryTable-ResourceHistoryTable1-15');
        expect(demoPatient.active).toBe(true);
      });
    });

    describe('createDemoVitalSigns', () => {
      it('should create demo vital signs', () => {
        const vitalSigns = demoDataHelpers.createDemoVitalSigns('patient-123');

        expect(vitalSigns).toHaveLength(1);
        expect(vitalSigns[ResourceHistoryTable].resourceType).toBe('Observation');
        expect(vitalSigns[ResourceHistoryTable].id).toMatch(/^demo-vitals-\d+-1$/);
        expect(vitalSigns[ResourceHistoryTable].status).toBe('final');
        expect(vitalSigns[ResourceHistoryTable].code?.coding?.[ResourceHistoryTable].code).toBe('8867-4');
        expect(vitalSigns[ResourceHistoryTable].code?.coding?.[ResourceHistoryTable].display).toBe('Heart rate');
        expect(vitalSigns[ResourceHistoryTable].subject?.reference).toBe('Patient/patient-123');
        expect(vitalSigns[ResourceHistoryTable].valueQuantity?.value).toBe(72);
        expect(vitalSigns[ResourceHistoryTable].valueQuantity?.unit).toBe('beats/min');
      });
    });
  });
});