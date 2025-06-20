import { FHIRResourcesService } from '../../../src/services/fhir-resources.service';
import { medplumService } from '../../../src/services/medplum.service';
import logger from '../../../src/utils/logger';
import { Patient, Practitioner, Encounter, Observation } from '@medplum/fhirtypes';

// Mock dependencies
jest.mock('../../../src/services/medplum.service');
jest.mock('../../../src/utils/logger');

describe('FHIRResourcesService', () => {
  let service: FHIRResourcesService;
  const mockMedplumService = medplumService as jest.Mocked<typeof medplumService>;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    service = new FHIRResourcesService();
    jest.clearAllMocks();
  });

  describe('Patient Management', () => {
    describe('createPatient', () => {
      it('should create a patient with minimum required data', async () => {
        const patientData = {
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male' as const,
          birthDate: '1990-01-01',
        };

        const expectedPatient: Patient = {
          resourceType: 'Patient',
          id: 'test-patient-1',
          active: true,
          name: patientData.name,
          gender: patientData.gender,
          birthDate: patientData.birthDate,
          address: [],
          telecom: [],
          identifier: expect.arrayContaining([
            expect.objectContaining({
              system: 'http://omnicare.com/patient-id',
            }),
          ]),
          contact: [],
          communication: [],
          generalPractitioner: [],
          extension: expect.arrayContaining([
            expect.objectContaining({
              url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
            }),
            expect.objectContaining({
              url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
              valueString: 'en',
            }),
          ]),
        };

        mockMedplumService.createResource.mockResolvedValue(expectedPatient);

        const result = await service.createPatient(patientData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Patient',
            active: true,
            name: patientData.name,
            gender: patientData.gender,
            birthDate: patientData.birthDate,
          })
        );
        expect(mockLogger.fhir).toHaveBeenCalledWith(
          'Patient created successfully',
          { patientId: expectedPatient.id }
        );
        expect(result).toEqual(expectedPatient);
      });

      it('should create a patient with comprehensive data', async () => {
        const patientData = {
          name: [{ given: ['Jane'], family: 'Smith' }],
          gender: 'female' as const,
          birthDate: '1985-05-15',
          telecom: [
            { system: 'phone', value: '555-0123', use: 'mobile' },
            { system: 'email', value: 'jane.smith@example.com', use: 'home' },
          ],
          address: [
            {
              use: 'home',
              line: ['456 Oak St'],
              city: 'Springfield',
              state: 'IL',
              postalCode: '62701',
              country: 'US',
            },
          ],
          omnicarePatientId: 'P123456',
          registrationDate: '2024-01-01T00:00:00Z',
          preferredLanguage: 'es',
        };

        const expectedPatient: Patient = {
          ...global.createMockPatient(),
          id: 'test-patient-2',
          name: patientData.name,
          gender: patientData.gender,
          birthDate: patientData.birthDate,
          telecom: patientData.telecom,
          address: patientData.address,
        };

        mockMedplumService.createResource.mockResolvedValue(expectedPatient);

        const result = await service.createPatient(patientData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Patient',
            name: patientData.name,
            telecom: patientData.telecom,
            address: patientData.address,
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/patient-id',
                value: patientData.omnicarePatientId,
              }),
            ]),
            extension: expect.arrayContaining([
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
                valueDateTime: patientData.registrationDate,
              }),
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
                valueString: patientData.preferredLanguage,
              }),
            ]),
          })
        );
        expect(result).toEqual(expectedPatient);
      });

      it('should handle errors when creating patient fails', async () => {
        const patientData = {
          name: [{ given: ['John'], family: 'Doe' }],
          gender: 'male' as const,
          birthDate: '1990-01-01',
        };

        const error = new Error('Failed to create patient');
        mockMedplumService.createResource.mockRejectedValue(error);

        await expect(service.createPatient(patientData)).rejects.toThrow(error);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to create patient:', error);
      });
    });

    describe('getPatient', () => {
      it('should retrieve a patient by ID', async () => {
        const patientId = 'test-patient-1';
        const expectedPatient = global.createMockPatient();

        mockMedplumService.readResource.mockResolvedValue(expectedPatient);

        const result = await service.getPatient(patientId);

        expect(mockMedplumService.readResource).toHaveBeenCalledWith('Patient', patientId);
        expect(mockLogger.fhir).toHaveBeenCalledWith('Patient retrieved', { patientId });
        expect(result).toEqual(expectedPatient);
      });

      it('should handle errors when patient retrieval fails', async () => {
        const patientId = 'non-existent-patient';
        const error = new Error('Patient not found');

        mockMedplumService.readResource.mockRejectedValue(error);

        await expect(service.getPatient(patientId)).rejects.toThrow(error);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to get patient:', error);
      });
    });

    describe('searchPatients', () => {
      it('should search patients with given criteria', async () => {
        const searchParams = { family: 'Doe', given: 'John' };
        const searchResults = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [
            {
              resource: global.createMockPatient(),
            },
          ],
        };

        mockMedplumService.searchResources.mockResolvedValue(searchResults);

        const result = await service.searchPatients(searchParams);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', searchParams);
        expect(mockLogger.fhir).toHaveBeenCalledWith('Patient search completed', {
          resultCount: 1,
          total: 1,
        });
        expect(result).toEqual(searchResults);
      });

      it('should handle empty search results', async () => {
        const searchParams = { family: 'NonExistent' };
        const searchResults = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: [],
        };

        mockMedplumService.searchResources.mockResolvedValue(searchResults);

        const result = await service.searchPatients(searchParams);

        expect(result).toEqual(searchResults);
        expect(mockLogger.fhir).toHaveBeenCalledWith('Patient search completed', {
          resultCount: 0,
          total: 0,
        });
      });
    });

    describe('updatePatient', () => {
      it('should update a patient', async () => {
        const patient = {
          ...global.createMockPatient(),
          name: [{ given: ['John', 'Updated'], family: 'Doe' }],
        };

        mockMedplumService.updateResource.mockResolvedValue(patient);

        const result = await service.updatePatient(patient);

        expect(mockMedplumService.updateResource).toHaveBeenCalledWith(patient);
        expect(mockLogger.fhir).toHaveBeenCalledWith('Patient updated successfully', {
          patientId: patient.id,
        });
        expect(result).toEqual(patient);
      });
    });
  });

  describe('Practitioner Management', () => {
    describe('createPractitioner', () => {
      it('should create a practitioner with minimum data', async () => {
        const practitionerData = {
          name: [{ given: ['Dr. Jane'], family: 'Smith' }],
          identifier: [
            {
              system: 'http://hl7.org/fhir/sid/us-npi',
              value: '1234567890',
            },
          ],
        };

        const expectedPractitioner = {
          ...global.createMockPractitioner(),
          id: 'test-practitioner-1',
        };

        mockMedplumService.createResource.mockResolvedValue(expectedPractitioner);

        const result = await service.createPractitioner(practitionerData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Practitioner',
            active: true,
            name: practitionerData.name,
            identifier: expect.arrayContaining([
              ...practitionerData.identifier,
              expect.objectContaining({
                system: 'http://omnicare.com/practitioner-id',
              }),
            ]),
          })
        );
        expect(result).toEqual(expectedPractitioner);
      });

      it('should handle errors when creating practitioner fails', async () => {
        const practitionerData = {
          name: [{ given: ['Dr. Jane'], family: 'Smith' }],
        };

        const error = new Error('Failed to create practitioner');
        mockMedplumService.createResource.mockRejectedValue(error);

        await expect(service.createPractitioner(practitionerData)).rejects.toThrow(error);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to create practitioner:', error);
      });
    });

    describe('searchPractitioners', () => {
      it('should search practitioners', async () => {
        const searchParams = { name: 'Smith' };
        const searchResults = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [
            {
              resource: global.createMockPractitioner(),
            },
          ],
        };

        mockMedplumService.searchResources.mockResolvedValue(searchResults);

        const result = await service.searchPractitioners(searchParams);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Practitioner', searchParams);
        expect(mockLogger.fhir).toHaveBeenCalledWith('Practitioner search completed', {
          resultCount: 1,
        });
        expect(result).toEqual(searchResults);
      });
    });
  });

  describe('Encounter Management', () => {
    describe('createEncounter', () => {
      it('should create an encounter with default values', async () => {
        const encounterData = {
          subject: { reference: 'Patient/test-patient-1' },
          participant: [
            {
              individual: { reference: 'Practitioner/test-practitioner-1' },
            },
          ],
        };

        const expectedEncounter = {
          ...global.createMockEncounter(),
          id: 'test-encounter-1',
        };

        mockMedplumService.createResource.mockResolvedValue(expectedEncounter);

        const result = await service.createEncounter(encounterData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Encounter',
            status: 'planned',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'AMB',
              display: 'Ambulatory',
            },
            subject: encounterData.subject,
            participant: encounterData.participant,
          })
        );
        expect(result).toEqual(expectedEncounter);
      });

      it('should create an encounter with custom data', async () => {
        const encounterData = {
          status: 'in-progress' as const,
          subject: { reference: 'Patient/test-patient-1' },
          appointmentType: 'routine',
          chiefComplaint: 'Annual checkup',
          omnicareEncounterId: 'E123456',
        };

        const expectedEncounter = {
          ...global.createMockEncounter(),
          id: 'test-encounter-2',
          status: encounterData.status,
        };

        mockMedplumService.createResource.mockResolvedValue(expectedEncounter);

        const result = await service.createEncounter(encounterData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Encounter',
            status: encounterData.status,
            subject: encounterData.subject,
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/encounter-id',
                value: encounterData.omnicareEncounterId,
              }),
            ]),
            extension: expect.arrayContaining([
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/appointment-type',
                valueString: encounterData.appointmentType,
              }),
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/chief-complaint',
                valueString: encounterData.chiefComplaint,
              }),
            ]),
          })
        );
        expect(result).toEqual(expectedEncounter);
      });
    });

    describe('searchEncounters', () => {
      it('should search encounters', async () => {
        const searchParams = { patient: 'Patient/test-patient-1' };
        const searchResults = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [
            {
              resource: global.createMockEncounter(),
            },
          ],
        };

        mockMedplumService.searchResources.mockResolvedValue(searchResults);

        const result = await service.searchEncounters(searchParams);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Encounter', searchParams);
        expect(result).toEqual(searchResults);
      });
    });
  });

  describe('Observation Management', () => {
    describe('createObservation', () => {
      it('should create an observation with default values', async () => {
        const observationData = {
          subject: { reference: 'Patient/test-patient-1' },
          encounter: { reference: 'Encounter/test-encounter-1' },
          valueQuantity: {
            value: 98.6,
            unit: '°F',
            system: 'http://unitsofmeasure.org',
            code: '[degF]',
          },
        };

        const expectedObservation: Observation = {
          resourceType: 'Observation',
          id: 'test-observation-1',
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            }],
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '8310-5',
              display: 'Body temperature',
            }],
          },
          subject: observationData.subject,
          encounter: observationData.encounter,
          effectiveDateTime: expect.any(String),
          performer: [],
          valueQuantity: observationData.valueQuantity,
          identifier: expect.arrayContaining([
            expect.objectContaining({
              system: 'http://omnicare.com/observation-id',
            }),
          ]),
          extension: expect.arrayContaining([
            expect.objectContaining({
              url: 'http://omnicare.com/fhir/StructureDefinition/device-used',
              valueString: '',
            }),
          ]),
        };

        mockMedplumService.createResource.mockResolvedValue(expectedObservation);

        const result = await service.createObservation(observationData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Observation',
            status: 'final',
            subject: observationData.subject,
            encounter: observationData.encounter,
            valueQuantity: observationData.valueQuantity,
          })
        );
        expect(result).toEqual(expectedObservation);
      });
    });

    describe('createVitalSigns', () => {
      it('should create multiple vital sign observations', async () => {
        const patientId = 'test-patient-1';
        const encounterId = 'test-encounter-1';
        const vitals = {
          temperature: 98.6,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 72,
        };

        const mockObservations = [
          { resourceType: 'Observation', id: 'temp-obs-1' },
          { resourceType: 'Observation', id: 'bp-obs-1' },
          { resourceType: 'Observation', id: 'hr-obs-1' },
        ];

        // Mock the createObservation method calls
        jest.spyOn(service, 'createObservation')
          .mockResolvedValueOnce(mockObservations[0] as any)
          .mockResolvedValueOnce(mockObservations[1] as any)
          .mockResolvedValueOnce(mockObservations[2] as any);

        const result = await service.createVitalSigns(patientId, encounterId, vitals);

        expect(service.createObservation).toHaveBeenCalledTimes(3);
        expect(result).toEqual(mockObservations);
        expect(mockLogger.fhir).toHaveBeenCalledWith('Vital signs created successfully', {
          patientId,
          encounterId,
          vitalsCount: 3,
        });
      });

      it('should create only provided vital signs', async () => {
        const patientId = 'test-patient-1';
        const encounterId = 'test-encounter-1';
        const vitals = {
          temperature: 98.6,
        };

        const mockObservation = { resourceType: 'Observation', id: 'temp-obs-1' };

        jest.spyOn(service, 'createObservation')
          .mockResolvedValueOnce(mockObservation as any);

        const result = await service.createVitalSigns(patientId, encounterId, vitals);

        expect(service.createObservation).toHaveBeenCalledTimes(1);
        expect(result).toEqual([mockObservation]);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('validateResource', () => {
      it('should validate a resource successfully', async () => {
        const resource = global.createMockPatient();
        const validationResponse = {
          resourceType: 'OperationOutcome',
          issue: [],
        };

        mockMedplumService.validateResource.mockResolvedValue(validationResponse);

        const result = await service.validateResource(resource);

        expect(mockMedplumService.validateResource).toHaveBeenCalledWith(resource);
        expect(result).toEqual({
          valid: true,
          errors: [],
          warnings: [],
        });
      });

      it('should return validation errors and warnings', async () => {
        const resource = global.createMockPatient();
        const validationResponse = {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'required',
              diagnostics: 'Missing required field',
              expression: ['Patient.name'],
            },
            {
              severity: 'warning',
              code: 'informational',
              diagnostics: 'Recommended field missing',
              expression: ['Patient.telecom'],
            },
          ],
        };

        mockMedplumService.validateResource.mockResolvedValue(validationResponse);

        const result = await service.validateResource(resource);

        expect(result).toEqual({
          valid: false,
          errors: [
            {
              path: 'Patient.name',
              message: 'Missing required field',
              code: 'required',
              severity: 'error',
            },
          ],
          warnings: [
            {
              path: 'Patient.telecom',
              message: 'Recommended field missing',
              code: 'informational',
              severity: 'warning',
            },
          ],
        });
      });
    });

    describe('getPatientEverything', () => {
      it('should retrieve all resources for a patient', async () => {
        const patientId = 'test-patient-1';
        const patientEverything = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 5,
          entry: [
            { resource: global.createMockPatient() },
            { resource: global.createMockEncounter() },
            // ... more resources
          ],
        };

        mockMedplumService.searchResources.mockResolvedValue(patientEverything);

        const result = await service.getPatientEverything(patientId);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', {
          _id: patientId,
          _include: '*',
          _revinclude: '*',
        });
        expect(mockLogger.fhir).toHaveBeenCalledWith('Patient everything retrieved', {
          patientId,
          resourceCount: 2,
        });
        expect(result).toEqual(patientEverything);
      });
    });
  });
});