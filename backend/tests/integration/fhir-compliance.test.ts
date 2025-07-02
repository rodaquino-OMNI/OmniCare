import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MedplumClient } from '@medplum/core';
import {
  Patient,
  Observation,
  DiagnosticReport,
  Medication,
  MedicationRequest,
  Encounter,
  DocumentReference,
  Task,
  Bundle,
  CapabilityStatement,
  StructureDefinition,
} from '@medplum/fhirtypes';

import { DatabaseService } from '@/services/database.service';
import { FhirResourcesService } from '@/services/fhir-resources.service';
import { FhirValidationService } from '@/services/integration/fhir/fhir-validation.service';
import { MedplumService } from '@/services/medplum.service';

/**
 * FHIR R4 Compliance Validation Test Suite
 * 
 * Comprehensive testing for FHIR R4 standard compliance across all
 * healthcare data operations in OmniCare EMR system.
 */

describe('FHIR R4 Compliance Tests', () => {
  let fhirValidationService: FhirValidationService;
  let fhirResourcesService: FhirResourcesService;
  let medplumService: MedplumService;
  let databaseService: DatabaseService;
  let medplumClient: MedplumClient;

  beforeEach(async () => {
    // Initialize services with test configuration
    databaseService = new DatabaseService();
    await databaseService.initialize();
    
    medplumService = new MedplumService();
    medplumClient = await medplumService.getClient();
    
    fhirValidationService = new FhirValidationService();
    fhirResourcesService = new FhirResourcesService(medplumClient);
  });

  afterEach(async () => {
    await databaseService.cleanup();
  });

  describe('FHIR Resource Validation', () => {
    describe('Patient Resource Compliance', () => {
      it('should validate Patient resource structure', async () => {
        const patient: Patient = {
          resourceType: 'Patient',
          id: 'test-patient-001',
          meta: {
            versionId: '1',
            lastUpdated: new Date().toISOString(),
            profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
          },
          identifier: [
            {
              use: 'usual',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'MR',
                    display: 'Medical Record Number',
                  },
                ],
              },
              system: 'http://hospital.omnicare.com/patient-id',
              value: 'MRN-12345',
            },
          ],
          active: true,
          name: [
            {
              use: 'official',
              family: 'Doe',
              given: ['John', 'William'],
            },
          ],
          telecom: [
            {
              system: 'phone',
              value: '+1-555-123-4567',
              use: 'home',
            },
            {
              system: 'email',
              value: 'john.doe@example.com',
              use: 'home',
            },
          ],
          gender: 'male',
          birthDate: '1990-01-15',
          address: [
            {
              use: 'home',
              type: 'both',
              line: ['123 Main Street', 'Apt 4B'],
              city: 'Anytown',
              state: 'CA',
              postalCode: '12345',
              country: 'US',
            },
          ],
          maritalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
                code: 'M',
                display: 'Married',
              },
            ],
          },
          communication: [
            {
              language: {
                coding: [
                  {
                    system: 'urn:ietf:bcp:47',
                    code: 'en-US',
                    display: 'English (United States)',
                  },
                ],
              },
              preferred: true,
            },
          ],
        };

        const validationResult = await fhirValidationService.validateResource(patient);
        expect(validationResult.isValid).toBe(true);
        expect(validationResult.errors).toHaveLength(0);
      });

      it('should reject invalid Patient resource', async () => {
        const invalidPatient = {
          resourceType: 'Patient',
          // Missing required fields
          name: [
            {
              // Missing 'family' field which is required
              given: ['John'],
            },
          ],
        } as Patient;

        const validationResult = await fhirValidationService.validateResource(invalidPatient);
        expect(validationResult.isValid).toBe(false);
        expect(validationResult.errors.length).toBeGreaterThan(0);
      });

      it('should validate US Core Patient profile compliance', async () => {
        const usCorePatient: Patient = {
          resourceType: 'Patient',
          meta: {
            profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
          },
          identifier: [
            {
              use: 'usual',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'MR',
                  },
                ],
              },
              system: 'http://hospital.omnicare.com',
              value: 'MRN-12345',
            },
          ],
          name: [
            {
              family: 'Doe',
              given: ['John'],
            },
          ],
          gender: 'male',
          birthDate: '1990-01-15',
        };

        const validationResult = await fhirValidationService.validateUSCoreProfile(usCorePatient);
        expect(validationResult.isValid).toBe(true);
      });
    });

    describe('Observation Resource Compliance', () => {
      it('should validate Observation resource with vital signs', async () => {
        const vitalSignsObservation: Observation = {
          resourceType: 'Observation',
          meta: {
            profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns'],
          },
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '85354-9',
                display: 'Blood pressure panel with all children optional',
              },
            ],
          },
          subject: {
            reference: 'Patient/test-patient-001',
          },
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: {
            value: 120,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
          component: [
            {
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8480-6',
                    display: 'Systolic blood pressure',
                  },
                ],
              },
              valueQuantity: {
                value: 120,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
            {
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8462-4',
                    display: 'Diastolic blood pressure',
                  },
                ],
              },
              valueQuantity: {
                value: 80,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
          ],
        };

        const validationResult = await fhirValidationService.validateResource(vitalSignsObservation);
        expect(validationResult.isValid).toBe(true);
      });

      it('should validate laboratory result observations', async () => {
        const labObservation: Observation = {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                  display: 'Laboratory',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '2339-0',
                display: 'Glucose [Mass/volume] in Blood',
              },
            ],
          },
          subject: {
            reference: 'Patient/test-patient-001',
          },
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: {
            value: 95,
            unit: 'mg/dL',
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL',
          },
          referenceRange: [
            {
              low: {
                value: 70,
                unit: 'mg/dL',
                system: 'http://unitsofmeasure.org',
                code: 'mg/dL',
              },
              high: {
                value: 100,
                unit: 'mg/dL',
                system: 'http://unitsofmeasure.org',
                code: 'mg/dL',
              },
              text: 'Normal range',
            },
          ],
        };

        const validationResult = await fhirValidationService.validateResource(labObservation);
        expect(validationResult.isValid).toBe(true);
      });
    });

    describe('DiagnosticReport Resource Compliance', () => {
      it('should validate DiagnosticReport resource', async () => {
        const diagnosticReport: DiagnosticReport = {
          resourceType: 'DiagnosticReport',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                  code: 'LAB',
                  display: 'Laboratory',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '24323-8',
                display: 'Comprehensive metabolic panel',
              },
            ],
          },
          subject: {
            reference: 'Patient/test-patient-001',
          },
          effectiveDateTime: new Date().toISOString(),
          issued: new Date().toISOString(),
          performer: [
            {
              reference: 'Organization/lab-001',
              display: 'OmniCare Laboratory',
            },
          ],
          result: [
            {
              reference: 'Observation/glucose-001',
            },
            {
              reference: 'Observation/creatinine-001',
            },
          ],
          conclusion: 'All values within normal limits.',
        };

        const validationResult = await fhirValidationService.validateResource(diagnosticReport);
        expect(validationResult.isValid).toBe(true);
      });
    });

    describe('Medication and MedicationRequest Compliance', () => {
      it('should validate Medication resource', async () => {
        const medication: Medication = {
          resourceType: 'Medication',
          code: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '314076',
                display: 'Lisinopril 10 MG Oral Tablet',
              },
            ],
          },
          form: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '385055001',
                display: 'Tablet',
              },
            ],
          },
          ingredient: [
            {
              itemCodeableConcept: {
                coding: [
                  {
                    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                    code: '29046',
                    display: 'Lisinopril',
                  },
                ],
              },
              strength: {
                numerator: {
                  value: 10,
                  unit: 'mg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mg',
                },
                denominator: {
                  value: 1,
                  unit: 'tablet',
                  system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
                  code: 'TAB',
                },
              },
            },
          ],
        };

        const validationResult = await fhirValidationService.validateResource(medication);
        expect(validationResult.isValid).toBe(true);
      });

      it('should validate MedicationRequest resource', async () => {
        const medicationRequest: MedicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '314076',
                display: 'Lisinopril 10 MG Oral Tablet',
              },
            ],
          },
          subject: {
            reference: 'Patient/test-patient-001',
          },
          authoredOn: new Date().toISOString(),
          requester: {
            reference: 'Practitioner/dr-smith-001',
          },
          dosageInstruction: [
            {
              text: 'Take one tablet by mouth once daily',
              timing: {
                repeat: {
                  frequency: 1,
                  period: 1,
                  periodUnit: 'd',
                },
              },
              route: {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '26643006',
                    display: 'Oral route',
                  },
                ],
              },
              doseAndRate: [
                {
                  doseQuantity: {
                    value: 1,
                    unit: 'tablet',
                    system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
                    code: 'TAB',
                  },
                },
              ],
            },
          ],
          dispenseRequest: {
            numberOfRepeatsAllowed: 5,
            quantity: {
              value: 30,
              unit: 'tablet',
              system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
              code: 'TAB',
            },
            expectedSupplyDuration: {
              value: 30,
              unit: 'days',
              system: 'http://unitsofmeasure.org',
              code: 'd',
            },
          },
        };

        const validationResult = await fhirValidationService.validateResource(medicationRequest);
        expect(validationResult.isValid).toBe(true);
      });
    });

    describe('Document Reference Compliance', () => {
      it('should validate DocumentReference for clinical notes', async () => {
        const documentReference: DocumentReference = {
          resourceType: 'DocumentReference',
          status: 'current',
          type: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11506-3',
                display: 'Progress note',
              },
            ],
          },
          category: [
            {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '11488-4',
                  display: 'Consult note',
                },
              ],
            },
          ],
          subject: {
            reference: 'Patient/test-patient-001',
          },
          date: new Date().toISOString(),
          author: [
            {
              reference: 'Practitioner/dr-smith-001',
            },
          ],
          custodian: {
            reference: 'Organization/omnicare-001',
          },
          content: [
            {
              attachment: {
                contentType: 'text/plain',
                data: Buffer.from('Patient progress note content...').toString('base64'),
                title: 'Progress Note - 2024-01-01',
              },
            },
          ],
          context: {
            encounter: [
              {
                reference: 'Encounter/visit-001',
              },
            ],
            period: {
              start: new Date().toISOString(),
              end: new Date().toISOString(),
            },
          },
        };

        const validationResult = await fhirValidationService.validateResource(documentReference);
        expect(validationResult.isValid).toBe(true);
      });
    });
  });

  describe('FHIR Bundle Operations', () => {
    it('should validate Bundle resource with transaction', async () => {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'urn:uuid:patient-001',
            resource: {
              resourceType: 'Patient',
              name: [
                {
                  family: 'Doe',
                  given: ['John'],
                },
              ],
              gender: 'male',
              birthDate: '1990-01-15',
            },
            request: {
              method: 'POST',
              url: 'Patient',
            },
          },
          {
            fullUrl: 'urn:uuid:observation-001',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8480-6',
                    display: 'Systolic blood pressure',
                  },
                ],
              },
              subject: {
                reference: 'urn:uuid:patient-001',
              },
              valueQuantity: {
                value: 120,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
            request: {
              method: 'POST',
              url: 'Observation',
            },
          },
        ],
      };

      const validationResult = await fhirValidationService.validateResource(bundle);
      expect(validationResult.isValid).toBe(true);
    });

    it('should validate Bundle resource with search results', async () => {
      const searchBundle: Bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        link: [
          {
            relation: 'self',
            url: 'Patient?name=Doe',
          },
        ],
        entry: [
          {
            fullUrl: 'http://omnicare.com/fhir/Patient/test-patient-001',
            resource: {
              resourceType: 'Patient',
              id: 'test-patient-001',
              name: [
                {
                  family: 'Doe',
                  given: ['John'],
                },
              ],
              gender: 'male',
              birthDate: '1990-01-15',
            },
            search: {
              mode: 'match',
            },
          },
        ],
      };

      const validationResult = await fhirValidationService.validateResource(searchBundle);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('FHIR Server Capability', () => {
    it('should validate server CapabilityStatement', async () => {
      const capabilityStatement = await fhirResourcesService.getCapabilityStatement();
      
      expect(capabilityStatement.resourceType).toBe('CapabilityStatement');
      expect(capabilityStatement.status).toBe('active');
      expect(capabilityStatement.fhirVersion).toBe('4.0.1');
      expect(capabilityStatement.format).toContain('json');
      
      // Verify required resources are supported
      const supportedResources = capabilityStatement.rest?.[0]?.resource?.map(r => r.type) || [];
      expect(supportedResources).toContain('Patient');
      expect(supportedResources).toContain('Observation');
      expect(supportedResources).toContain('DiagnosticReport');
      expect(supportedResources).toContain('Medication');
      expect(supportedResources).toContain('MedicationRequest');
      expect(supportedResources).toContain('DocumentReference');
    });

    it('should support required FHIR operations', async () => {
      const capabilityStatement = await fhirResourcesService.getCapabilityStatement();
      const restCapability = capabilityStatement.rest?.[0];
      
      expect(restCapability?.mode).toBe('server');
      
      // Check for required interactions
      const supportedInteractions = restCapability?.interaction?.map(i => i.code) || [];
      expect(supportedInteractions).toContain('transaction');
      expect(supportedInteractions).toContain('batch');
    });
  });

  describe('FHIR Search Compliance', () => {
    it('should support standard search parameters for Patient', async () => {
      const searchParams = {
        family: 'Doe',
        given: 'John',
        birthdate: '1990-01-15',
        gender: 'male',
      };

      const patients = await fhirResourcesService.searchPatients(searchParams);
      expect(Array.isArray(patients)).toBe(true);
    });

    it('should support date range searches for Observations', async () => {
      const searchParams = {
        subject: 'Patient/test-patient-001',
        date: 'ge2024-01-01',
        category: 'vital-signs',
      };

      const observations = await fhirResourcesService.searchObservations(searchParams);
      expect(Array.isArray(observations)).toBe(true);
    });

    it('should support composite searches', async () => {
      const searchParams = {
        'code-value-quantity': 'http://loinc.org|8480-6$120|http://unitsofmeasure.org|mm[Hg]',
      };

      const observations = await fhirResourcesService.searchObservations(searchParams);
      expect(Array.isArray(observations)).toBe(true);
    });
  });

  describe('FHIR Terminology Compliance', () => {
    it('should validate terminology bindings', async () => {
      const observation: Observation = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure',
            },
          ],
        },
        subject: {
          reference: 'Patient/test-patient-001',
        },
        valueQuantity: {
          value: 120,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      };

      const terminologyValidation = await fhirValidationService.validateTerminology(observation);
      expect(terminologyValidation.isValid).toBe(true);
    });

    it('should validate value sets', async () => {
      const observationStatus = 'final';
      const isValidStatus = await fhirValidationService.validateValueSet(
        observationStatus,
        'http://hl7.org/fhir/ValueSet/observation-status'
      );
      expect(isValidStatus).toBe(true);
    });
  });

  describe('FHIR Extensions Compliance', () => {
    it('should validate custom extensions', async () => {
      const patientWithExtension: Patient = {
        resourceType: 'Patient',
        extension: [
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/patient-emergency-contact',
            valueString: 'Jane Doe - Sister - 555-9876',
          },
        ],
        name: [
          {
            family: 'Doe',
            given: ['John'],
          },
        ],
        gender: 'male',
        birthDate: '1990-01-15',
      };

      const validationResult = await fhirValidationService.validateResource(patientWithExtension);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('FHIR Security and Privacy', () => {
    it('should handle security labels correctly', async () => {
      const secureObservation: Observation = {
        resourceType: 'Observation',
        meta: {
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
              code: 'HTEST',
              display: 'test health data',
            },
          ],
        },
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '33747-0',
              display: 'General survey',
            },
          ],
        },
        subject: {
          reference: 'Patient/test-patient-001',
        },
        valueString: 'Patient appears well',
      };

      const validationResult = await fhirValidationService.validateResource(secureObservation);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('FHIR Versioning and History', () => {
    it('should handle resource versioning correctly', async () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: 'versioned-patient-001',
        meta: {
          versionId: '2',
          lastUpdated: new Date().toISOString(),
        },
        name: [
          {
            family: 'Updated-Doe',
            given: ['John'],
          },
        ],
        gender: 'male',
        birthDate: '1990-01-15',
      };

      const created = await fhirResourcesService.createResource(patient);
      expect(created.meta?.versionId).toBeDefined();
      
      const updated = await fhirResourcesService.updateResource({
        ...patient,
        name: [{ family: 'Final-Doe', given: ['John'] }],
      });
      expect(updated.meta?.versionId).not.toBe(created.meta?.versionId);
    });

    it('should retrieve resource history', async () => {
      const history = await fhirResourcesService.getResourceHistory('Patient', 'versioned-patient-001');
      expect(history.resourceType).toBe('Bundle');
      expect(history.type).toBe('history');
      expect(history.entry?.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Custom FHIR validation helpers
 */
export const fhirValidationHelpers = {
  /**
   * Validate FHIR resource against R4 specification
   */
  async validateFHIRR4Compliance(resource: any): Promise<{ isValid: boolean; errors: string[] }> {
    const service = new FhirValidationService();
    return await service.validateResource(resource);
  },

  /**
   * Validate US Core profile compliance
   */
  async validateUSCoreCompliance(resource: any): Promise<{ isValid: boolean; errors: string[] }> {
    const service = new FhirValidationService();
    return await service.validateUSCoreProfile(resource);
  },

  /**
   * Validate terminology bindings
   */
  async validateTerminologyCompliance(resource: any): Promise<{ isValid: boolean; errors: string[] }> {
    const service = new FhirValidationService();
    return await service.validateTerminology(resource);
  },
};
