import { FHIRResourcesService } from '../../../src/services/fhir-resources.service';
import { medplumService } from '../../../src/services/medplum.service';
import { Patient, Encounter, Observation, MedicationRequest, Bundle, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import { OmniCarePatient, OmniCareEncounter, OmniCareObservation, FHIRSearchParams } from '../../../src/types/fhir';

// Mock the medplum service
jest.mock('../../../src/services/medplum.service', () => ({
  medplumService: {
    createResource: jest.fn(),
    readResource: jest.fn(),
    updateResource: jest.fn(),
    searchResources: jest.fn(),
    validateResource: jest.fn()
  }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  fhir: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn()
}));

const mockMedplumService = medplumService as jest.Mocked<typeof medplumService>;

describe('FHIRResourcesService', () => {
  let fhirService: FHIRResourcesService;

  beforeEach(() => {
    fhirService = new FHIRResourcesService();
    jest.clearAllMocks();
  });

  describe('Patient Operations', () => {
    describe('createPatient', () => {
      it('should create a patient with required fields', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: 'pat123',
          active: true,
          name: [{ family: 'Doe', given: ['John'] }],
          gender: 'male',
          birthDate: '1990-01-01'
        };

        mockMedplumService.createResource.mockResolvedValue(mockPatient);

        const patientData: Partial<OmniCarePatient> = {
          name: [{ family: 'Doe', given: ['John'] }],
          gender: 'male',
          birthDate: '1990-01-01'
        };

        const result = await fhirService.createPatient(patientData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Patient',
            active: true,
            name: patientData.name,
            gender: patientData.gender,
            birthDate: patientData.birthDate,
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/patient-id'
              })
            ]),
            extension: expect.arrayContaining([
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/registration-date'
              }),
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language'
              })
            ])
          })
        );
        expect(result).toEqual(mockPatient);
      });

      it('should handle patient creation errors', async () => {
        const error = new Error('Creation failed');
        mockMedplumService.createResource.mockRejectedValue(error);

        const patientData: Partial<OmniCarePatient> = {
          name: [{ family: 'Doe', given: ['John'] }]
        };

        await expect(fhirService.createPatient(patientData)).rejects.toThrow('Creation failed');
      });

      it('should include OmniCare-specific extensions', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: 'pat123'
        };

        mockMedplumService.createResource.mockResolvedValue(mockPatient);

        const patientData: Partial<OmniCarePatient> = {
          name: [{ family: 'Doe', given: ['John'] }],
          registrationDate: '2023-01-01T00:00:00Z',
          preferredLanguage: 'es'
        };

        await fhirService.createPatient(patientData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            extension: expect.arrayContaining([
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
                valueDateTime: '2023-01-01T00:00:00Z'
              }),
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
                valueString: 'es'
              })
            ])
          })
        );
      });
    });

    describe('searchPatients', () => {
      it('should search for patients with parameters', async () => {
        const mockBundle: Bundle<Patient> = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{
            resource: {
              resourceType: 'Patient',
              id: 'pat123',
              name: [{ family: 'Doe', given: ['John'] }]
            }
          }]
        };

        mockMedplumService.searchResources.mockResolvedValue(mockBundle);

        const searchParams: FHIRSearchParams = {
          family: 'Doe',
          given: 'John',
          _count: 10
        };

        const result = await fhirService.searchPatients(searchParams);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', searchParams);
        expect(result).toEqual(mockBundle);
      });

      it('should handle empty search results', async () => {
        const emptyBundle: Bundle<Patient> = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: []
        };

        mockMedplumService.searchResources.mockResolvedValue(emptyBundle);

        const result = await fhirService.searchPatients({});

        expect(result.total).toBe(0);
        expect(result.entry).toEqual([]);
      });
    });

    describe('getPatient', () => {
      it('should retrieve a patient by ID', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: 'pat123',
          name: [{ family: 'Doe', given: ['John'] }]
        };

        mockMedplumService.readResource.mockResolvedValue(mockPatient);

        const result = await fhirService.getPatient('pat123');

        expect(mockMedplumService.readResource).toHaveBeenCalledWith('Patient', 'pat123');
        expect(result).toEqual(mockPatient);
      });

      it('should handle patient not found', async () => {
        const error = new Error('Patient not found');
        mockMedplumService.readResource.mockRejectedValue(error);

        await expect(fhirService.getPatient('nonexistent')).rejects.toThrow('Patient not found');
      });
    });

    describe('updatePatient', () => {
      it('should update a patient', async () => {
        const mockPatient: Patient = {
          resourceType: 'Patient',
          id: 'pat123',
          name: [{ family: 'Smith', given: ['John'] }]
        };

        mockMedplumService.updateResource.mockResolvedValue(mockPatient);

        const result = await fhirService.updatePatient(mockPatient);

        expect(mockMedplumService.updateResource).toHaveBeenCalledWith(mockPatient);
        expect(result).toEqual(mockPatient);
      });
    });
  });

  describe('Practitioner Operations', () => {
    describe('createPractitioner', () => {
      it('should create a practitioner with identifier', async () => {
        const mockPractitioner: Practitioner = {
          resourceType: 'Practitioner',
          id: 'prac123',
          active: true,
          name: [{ family: 'Smith', given: ['Dr. Jane'], prefix: ['Dr.'] }]
        };

        mockMedplumService.createResource.mockResolvedValue(mockPractitioner);

        const practitionerData = {
          name: [{ family: 'Smith', given: ['Dr. Jane'], prefix: ['Dr.'] }],
          qualification: [{
            code: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'MD' }]
            }
          }]
        };

        const result = await fhirService.createPractitioner(practitionerData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Practitioner',
            active: true,
            name: practitionerData.name,
            qualification: practitionerData.qualification,
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/practitioner-id',
                value: expect.stringMatching(/^PR\d+$/)
              })
            ])
          })
        );
        expect(result).toEqual(mockPractitioner);
      });
    });

    describe('searchPractitioners', () => {
      it('should search for practitioners', async () => {
        const mockBundle: Bundle<Practitioner> = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{
            resource: {
              resourceType: 'Practitioner',
              id: 'prac123',
              name: [{ family: 'Smith', given: ['Dr. Jane'] }]
            }
          }]
        };

        mockMedplumService.searchResources.mockResolvedValue(mockBundle);

        const searchParams = { family: 'Smith' };
        const result = await fhirService.searchPractitioners(searchParams);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Practitioner', searchParams);
        expect(result).toEqual(mockBundle);
      });
    });
  });

  describe('Encounter Operations', () => {
    describe('createEncounter', () => {
      it('should create an encounter with default values', async () => {
        const mockEncounter: Encounter = {
          resourceType: 'Encounter',
          id: 'enc123',
          status: 'planned',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'Ambulatory'
          },
          subject: { reference: 'Patient/pat123' }
        };

        mockMedplumService.createResource.mockResolvedValue(mockEncounter);

        const encounterData: Partial<OmniCareEncounter> = {
          subject: { reference: 'Patient/pat123' },
          appointmentType: 'routine',
          chiefComplaint: 'Annual checkup'
        };

        const result = await fhirService.createEncounter(encounterData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Encounter',
            status: 'planned',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'AMB',
              display: 'Ambulatory'
            },
            subject: { reference: 'Patient/pat123' },
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/encounter-id'
              })
            ]),
            extension: expect.arrayContaining([
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/appointment-type',
                valueString: 'routine'
              }),
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/chief-complaint',
                valueString: 'Annual checkup'
              })
            ])
          })
        );
        expect(result).toEqual(mockEncounter);
      });
    });

    describe('searchEncounters', () => {
      it('should search for encounters', async () => {
        const mockBundle: Bundle<Encounter> = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{
            resource: {
              resourceType: 'Encounter',
              id: 'enc123',
              status: 'finished',
              class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'AMB',
                display: 'Ambulatory'
              },
              subject: { reference: 'Patient/pat123' }
            }
          }]
        };

        mockMedplumService.searchResources.mockResolvedValue(mockBundle);

        const searchParams = { patient: 'pat123', status: 'finished' };
        const result = await fhirService.searchEncounters(searchParams);

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Encounter', searchParams);
        expect(result).toEqual(mockBundle);
      });
    });
  });

  describe('Observation Operations', () => {
    describe('createObservation', () => {
      it('should create an observation with required fields', async () => {
        const mockObservation: Observation = {
          resourceType: 'Observation',
          id: 'obs123',
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
          subject: { reference: 'Patient/pat123' }
        };

        mockMedplumService.createResource.mockResolvedValue(mockObservation);

        const observationData: Partial<OmniCareObservation> = {
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
          subject: { reference: 'Patient/pat123' },
          valueQuantity: { value: 98.6, unit: '°F' },
          deviceUsed: 'Digital thermometer'
        };

        const result = await fhirService.createObservation(observationData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'Observation',
            status: 'final',
            subject: { reference: 'Patient/pat123' },
            valueQuantity: { value: 98.6, unit: '°F' },
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/observation-id'
              })
            ]),
            extension: expect.arrayContaining([
              expect.objectContaining({
                url: 'http://omnicare.com/fhir/StructureDefinition/device-used',
                valueString: 'Digital thermometer'
              })
            ])
          })
        );
        expect(result).toEqual(mockObservation);
      });
    });

    describe('createVitalSigns', () => {
      it('should create multiple vital sign observations', async () => {
        const mockTempObservation: Observation = {
          resourceType: 'Observation',
          id: 'obs-temp123',
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
          subject: { reference: 'Patient/pat123' },
          encounter: { reference: 'Encounter/enc123' },
          valueQuantity: { value: 98.6, unit: '°F' }
        };

        const mockBPObservation: Observation = {
          resourceType: 'Observation',
          id: 'obs-bp123',
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
              display: 'Blood pressure panel with all children optional'
            }]
          },
          subject: { reference: 'Patient/pat123' },
          encounter: { reference: 'Encounter/enc123' },
          component: [
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure'
                }]
              },
              valueQuantity: { value: 120, unit: 'mmHg' }
            },
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure'
                }]
              },
              valueQuantity: { value: 80, unit: 'mmHg' }
            }
          ]
        };

        mockMedplumService.createResource
          .mockResolvedValueOnce(mockTempObservation)
          .mockResolvedValueOnce(mockBPObservation);

        const vitals = {
          temperature: 98.6,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80
        };

        const result = await fhirService.createVitalSigns('pat123', 'enc123', vitals);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockTempObservation);
        expect(result[1]).toEqual(mockBPObservation);
        expect(mockMedplumService.createResource).toHaveBeenCalledTimes(2);
      });

      it('should handle empty vitals', async () => {
        const result = await fhirService.createVitalSigns('pat123', 'enc123', {});

        expect(result).toEqual([]);
        expect(mockMedplumService.createResource).not.toHaveBeenCalled();
      });
    });
  });

  describe('Medication Operations', () => {
    describe('createMedicationRequest', () => {
      it('should create a medication request', async () => {
        const mockMedRequest: MedicationRequest = {
          resourceType: 'MedicationRequest',
          id: 'med123',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/pat123' },
          medicationCodeableConcept: {
            coding: [{
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '313782',
              display: 'Acetaminophen 325 MG Oral Tablet'
            }]
          }
        };

        mockMedplumService.createResource.mockResolvedValue(mockMedRequest);

        const medicationData = {
          subject: { reference: 'Patient/pat123' },
          medicationCodeableConcept: {
            coding: [{
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '313782',
              display: 'Acetaminophen 325 MG Oral Tablet'
            }]
          },
          dosageInstruction: [{
            text: 'Take 1 tablet by mouth every 4-6 hours as needed for pain'
          }]
        };

        const result = await fhirService.createMedicationRequest(medicationData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            subject: { reference: 'Patient/pat123' },
            medicationCodeableConcept: medicationData.medicationCodeableConcept,
            dosageInstruction: medicationData.dosageInstruction,
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/medication-request-id'
              })
            ])
          })
        );
        expect(result).toEqual(mockMedRequest);
      });
    });
  });

  describe('Service Request Operations', () => {
    describe('createServiceRequest', () => {
      it('should create a service request with default code', async () => {
        const mockServiceRequest: ServiceRequest = {
          resourceType: 'ServiceRequest',
          id: 'srv123',
          status: 'active',
          intent: 'order',
          code: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: '15220000',
              display: 'Laboratory test'
            }]
          },
          subject: { reference: 'Patient/pat123' }
        };

        mockMedplumService.createResource.mockResolvedValue(mockServiceRequest);

        const serviceRequestData = {
          subject: { reference: 'Patient/pat123' },
          reasonCode: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: '386053000',
              display: 'Evaluation procedure'
            }]
          }]
        };

        const result = await fhirService.createServiceRequest(serviceRequestData);

        expect(mockMedplumService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            subject: { reference: 'Patient/pat123' },
            code: {
              coding: [{
                system: 'http://snomed.info/sct',
                code: '15220000',
                display: 'Laboratory test'
              }]
            },
            identifier: expect.arrayContaining([
              expect.objectContaining({
                system: 'http://omnicare.com/service-request-id'
              })
            ])
          })
        );
        expect(result).toEqual(mockServiceRequest);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('validateResource', () => {
      it('should validate a FHIR resource', async () => {
        const mockValidationResult = {
          resourceType: 'OperationOutcome',
          issue: []
        };

        mockMedplumService.validateResource.mockResolvedValue(mockValidationResult);

        const patient: Patient = {
          resourceType: 'Patient',
          id: 'pat123',
          name: [{ family: 'Doe', given: ['John'] }]
        };

        const result = await fhirService.validateResource(patient);

        expect(mockMedplumService.validateResource).toHaveBeenCalledWith(patient);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should handle validation errors', async () => {
        const mockValidationResult = {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Missing required field: name',
            expression: ['Patient.name']
          }]
        };

        mockMedplumService.validateResource.mockResolvedValue(mockValidationResult);

        const patient: Patient = {
          resourceType: 'Patient',
          id: 'pat123'
        };

        const result = await fhirService.validateResource(patient);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          path: 'Patient.name',
          message: 'Missing required field: name',
          code: 'required',
          severity: 'error'
        });
      });

      it('should handle validation warnings', async () => {
        const mockValidationResult = {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'warning',
            code: 'informational',
            diagnostics: 'Recommended field missing: birthDate',
            expression: ['Patient.birthDate']
          }]
        };

        mockMedplumService.validateResource.mockResolvedValue(mockValidationResult);

        const patient: Patient = {
          resourceType: 'Patient',
          id: 'pat123',
          name: [{ family: 'Doe', given: ['John'] }]
        };

        const result = await fhirService.validateResource(patient);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toEqual({
          path: 'Patient.birthDate',
          message: 'Recommended field missing: birthDate',
          code: 'informational',
          severity: 'warning'
        });
      });
    });

    describe('getPatientEverything', () => {
      it('should retrieve all patient data', async () => {
        const mockBundle: Bundle = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 5,
          entry: [
            { resource: { resourceType: 'Patient', id: 'pat123', name: [{ family: 'Doe', given: ['John'] }] } },
            { resource: { resourceType: 'Encounter', id: 'enc123', status: 'finished', class: { code: 'AMB' }, subject: { reference: 'Patient/pat123' } } },
            { resource: { resourceType: 'Observation', id: 'obs123', status: 'final', code: { text: 'Test' }, subject: { reference: 'Patient/pat123' } } }
          ]
        };

        mockMedplumService.searchResources.mockResolvedValue(mockBundle);

        const result = await fhirService.getPatientEverything('pat123');

        expect(mockMedplumService.searchResources).toHaveBeenCalledWith('Patient', {
          _id: 'pat123',
          _include: '*',
          _revinclude: '*'
        });
        expect(result).toEqual(mockBundle);
        expect(result.entry).toHaveLength(3);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      mockMedplumService.createResource.mockRejectedValue(networkError);

      const patientData = { name: [{ family: 'Doe', given: ['John'] }] };

      await expect(fhirService.createPatient(patientData)).rejects.toThrow('Network timeout');
    });

    it('should handle validation errors during creation', async () => {
      const validationError = new Error('Invalid resource format');
      mockMedplumService.createResource.mockRejectedValue(validationError);

      const invalidPatientData = {};

      await expect(fhirService.createPatient(invalidPatientData)).rejects.toThrow('Invalid resource format');
    });

    it('should handle resource not found errors', async () => {
      const notFoundError = new Error('Resource not found');
      mockMedplumService.readResource.mockRejectedValue(notFoundError);

      await expect(fhirService.getPatient('nonexistent')).rejects.toThrow('Resource not found');
    });
  });

  describe('Identifier Generation', () => {
    it('should generate unique identifiers for different resource types', async () => {
      const mockPatient: Patient = { resourceType: 'Patient', id: 'pat123', name: [{ family: 'Doe' }] };
      const mockPractitioner: Practitioner = { resourceType: 'Practitioner', id: 'prac123', name: [{ family: 'Smith' }] };
      
      mockMedplumService.createResource
        .mockResolvedValueOnce(mockPatient)
        .mockResolvedValueOnce(mockPractitioner);

      await fhirService.createPatient({ name: [{ family: 'Doe' }] });
      await fhirService.createPractitioner({ name: [{ family: 'Smith' }] });

      const patientCall = mockMedplumService.createResource.mock.calls[0]?.[0] as Patient;
      const practitionerCall = mockMedplumService.createResource.mock.calls[1]?.[0] as Practitioner;

      expect(patientCall?.identifier?.[0]?.value).toMatch(/^P\d+$/);
      expect(practitionerCall?.identifier?.[0]?.value).toMatch(/^PR\d+$/); 
    });
  });

  describe('Extension Handling', () => {
    it('should filter out undefined extensions', async () => {
      const mockPatient: Patient = { resourceType: 'Patient', id: 'pat123', name: [{ family: 'Doe' }] };
      mockMedplumService.createResource.mockResolvedValue(mockPatient);

      const patientData = {
        name: [{ family: 'Doe', given: ['John'] }],
        registrationDate: undefined,
        preferredLanguage: 'en'
      };

      await fhirService.createPatient(patientData);

      const createdPatient = mockMedplumService.createResource.mock.calls[0]?.[0] as Patient;
      
      // Should only include defined extensions
      expect(createdPatient?.extension).toHaveLength(2); // registration-date (default) and preferred-language
      expect(createdPatient?.extension?.find((ext: any) => 
        ext.url === 'http://omnicare.com/fhir/StructureDefinition/preferred-language'
      )).toBeDefined();
    });
  });
});