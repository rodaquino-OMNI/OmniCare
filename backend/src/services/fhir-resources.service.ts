import {
  Patient,
  Practitioner,
  Organization,
  Location,
  Encounter,
  Observation,
  Medication,
  MedicationRequest,
  ServiceRequest,
  DiagnosticReport,
  CarePlan,
  Communication,
  Task,
  DocumentReference,
  Condition,
  Procedure,
  AllergyIntolerance,
  Immunization,
  Bundle,
  Resource,
} from '@medplum/fhirtypes';

import { medplumService } from './medplum.service';

import { 
  OmniCarePatient, 
  OmniCareEncounter, 
  OmniCareObservation,
  FHIRSearchParams,
  ValidationResult,
} from '@/types/fhir';
import logger from '@/utils/logger';

/**
 * FHIR Resources Service
 * Implements FHIR R4 resource management for all clinical data types
 * used in the OmniCare EMR system
 */
export class FHIRResourcesService {
  
  // ===============================
  // PATIENT RESOURCES
  // ===============================

  /**
   * Create a new patient record
   */
  async createPatient(patientData: Partial<OmniCarePatient>): Promise<Patient> {
    try {
      const patient: Patient = {
        resourceType: 'Patient',
        active: true,
        name: patientData.name || [],
        gender: patientData.gender,
        birthDate: patientData.birthDate,
        address: patientData.address || [],
        telecom: patientData.telecom || [],
        identifier: [
          ...(patientData.identifier || []),
          {
            system: 'http://omnicare.com/patient-id',
            value: patientData.omnicarePatientId || `P${Date.now()}`,
          },
        ],
        contact: patientData.contact || [],
        communication: patientData.communication || [],
        generalPractitioner: patientData.generalPractitioner || [],
        managingOrganization: patientData.managingOrganization,
        extension: [
          ...(patientData.extension || []),
          // Add OmniCare-specific extensions
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
            valueDateTime: patientData.registrationDate || new Date().toISOString(),
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
            valueString: patientData.preferredLanguage || 'en',
          },
        ],
      };

      const result = await medplumService.createResource(patient);
      logger.fhir('Patient created successfully', { patientId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create patient:', error);
      throw error;
    }
  }

  /**
   * Search for patients with various criteria
   */
  async searchPatients(searchParams: FHIRSearchParams): Promise<Bundle<Patient>> {
    try {
      const result = await medplumService.searchResources<Patient>('Patient', searchParams);
      logger.fhir('Patient search completed', { 
        resultCount: result.entry?.length || 0,
        total: result.total,
      });
      return result;
    } catch (error) {
      logger.error('Failed to search patients:', error);
      throw error;
    }
  }

  /**
   * Get patient by ID
   */
  async getPatient(patientId: string): Promise<Patient> {
    try {
      const result = await medplumService.readResource<Patient>('Patient', patientId);
      logger.fhir('Patient retrieved', { patientId });
      return result;
    } catch (error) {
      logger.error('Failed to get patient:', error);
      throw error;
    }
  }

  /**
   * Update patient information
   */
  async updatePatient(patient: Patient): Promise<Patient> {
    try {
      const result = await medplumService.updateResource(patient);
      logger.fhir('Patient updated successfully', { patientId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to update patient:', error);
      throw error;
    }
  }

  // ===============================
  // PRACTITIONER RESOURCES
  // ===============================

  /**
   * Create a new practitioner record
   */
  async createPractitioner(practitionerData: Partial<Practitioner>): Promise<Practitioner> {
    try {
      const practitioner: Practitioner = {
        resourceType: 'Practitioner',
        active: true,
        name: practitionerData.name || [],
        identifier: [
          ...(practitionerData.identifier || []),
          {
            system: 'http://omnicare.com/practitioner-id',
            value: `PR${Date.now()}`,
          },
        ],
        telecom: practitionerData.telecom || [],
        address: practitionerData.address || [],
        gender: practitionerData.gender,
        birthDate: practitionerData.birthDate,
        qualification: practitionerData.qualification || [],
        communication: practitionerData.communication || [],
      };

      const result = await medplumService.createResource(practitioner);
      logger.fhir('Practitioner created successfully', { practitionerId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create practitioner:', error);
      throw error;
    }
  }

  /**
   * Search for practitioners
   */
  async searchPractitioners(searchParams: FHIRSearchParams): Promise<Bundle<Practitioner>> {
    try {
      const result = await medplumService.searchResources<Practitioner>('Practitioner', searchParams);
      logger.fhir('Practitioner search completed', { 
        resultCount: result.entry?.length || 0 
      });
      return result;
    } catch (error) {
      logger.error('Failed to search practitioners:', error);
      throw error;
    }
  }

  // ===============================
  // ENCOUNTER RESOURCES
  // ===============================

  /**
   * Create a new encounter
   */
  async createEncounter(encounterData: Partial<OmniCareEncounter>): Promise<Encounter> {
    try {
      const encounter: Encounter = {
        resourceType: 'Encounter',
        status: encounterData.status || 'planned',
        class: encounterData.class || {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
          display: 'Ambulatory',
        },
        type: encounterData.type || [],
        subject: encounterData.subject || { reference: '' },
        participant: encounterData.participant || [],
        period: encounterData.period,
        reasonCode: encounterData.reasonCode || [],
        serviceProvider: encounterData.serviceProvider,
        identifier: [
          ...(encounterData.identifier || []),
          {
            system: 'http://omnicare.com/encounter-id',
            value: encounterData.omnicareEncounterId || `E${Date.now()}`,
          },
        ],
        extension: [
          ...(encounterData.extension || []),
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/appointment-type',
            valueString: encounterData.appointmentType || 'routine',
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/chief-complaint',
            valueString: encounterData.chiefComplaint || '',
          },
        ],
      };

      const result = await medplumService.createResource(encounter);
      logger.fhir('Encounter created successfully', { encounterId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create encounter:', error);
      throw error;
    }
  }

  /**
   * Search for encounters
   */
  async searchEncounters(searchParams: FHIRSearchParams): Promise<Bundle<Encounter>> {
    try {
      const result = await medplumService.searchResources<Encounter>('Encounter', searchParams);
      logger.fhir('Encounter search completed', { 
        resultCount: result.entry?.length || 0 
      });
      return result;
    } catch (error) {
      logger.error('Failed to search encounters:', error);
      throw error;
    }
  }

  // ===============================
  // OBSERVATION RESOURCES
  // ===============================

  /**
   * Create a new observation
   */
  async createObservation(observationData: Partial<OmniCareObservation>): Promise<Observation> {
    try {
      const observation: Observation = {
        resourceType: 'Observation',
        status: observationData.status || 'final',
        category: observationData.category || [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: observationData.code || {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature',
          }],
        },
        subject: observationData.subject || { reference: '' },
        encounter: observationData.encounter,
        effectiveDateTime: observationData.effectiveDateTime || new Date().toISOString(),
        performer: observationData.performer || [],
        valueQuantity: observationData.valueQuantity,
        valueCodeableConcept: observationData.valueCodeableConcept,
        valueString: observationData.valueString,
        valueBoolean: observationData.valueBoolean,
        identifier: [
          ...(observationData.identifier || []),
          {
            system: 'http://omnicare.com/observation-id',
            value: observationData.omnicareObservationId || `O${Date.now()}`,
          },
        ],
        extension: [
          ...(observationData.extension || []),
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/device-used',
            valueString: observationData.deviceUsed || '',
          },
        ],
      };

      const result = await medplumService.createResource(observation);
      logger.fhir('Observation created successfully', { observationId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create observation:', error);
      throw error;
    }
  }

  /**
   * Create vital signs observations
   */
  async createVitalSigns(
    patientId: string,
    encounterId: string,
    vitals: {
      temperature?: number;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      weight?: number;
      height?: number;
    }
  ): Promise<Observation[]> {
    const observations: Observation[] = [];

    try {
      // Temperature
      if (vitals.temperature) {
        const tempObservation = await this.createObservation({
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
          subject: { reference: `Patient/${patientId}` },
          encounter: { reference: `Encounter/${encounterId}` },
          valueQuantity: {
            value: vitals.temperature,
            unit: '°F',
            system: 'http://unitsofmeasure.org',
            code: '[degF]',
          },
        });
        observations.push(tempObservation);
      }

      // Blood Pressure
      if (vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic) {
        const bpObservation = await this.createObservation({
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
              code: '85354-9',
              display: 'Blood pressure panel with all children optional',
            }],
          },
          subject: { reference: `Patient/${patientId}` },
          encounter: { reference: `Encounter/${encounterId}` },
          component: [
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure',
                }],
              },
              valueQuantity: {
                value: vitals.bloodPressureSystolic,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure',
                }],
              },
              valueQuantity: {
                value: vitals.bloodPressureDiastolic,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
          ],
        });
        observations.push(bpObservation);
      }

      // Heart Rate
      if (vitals.heartRate) {
        const hrObservation = await this.createObservation({
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
              code: '8867-4',
              display: 'Heart rate',
            }],
          },
          subject: { reference: `Patient/${patientId}` },
          encounter: { reference: `Encounter/${encounterId}` },
          valueQuantity: {
            value: vitals.heartRate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min',
          },
        });
        observations.push(hrObservation);
      }

      logger.fhir('Vital signs created successfully', { 
        patientId,
        encounterId,
        vitalsCount: observations.length,
      });

      return observations;
    } catch (error) {
      logger.error('Failed to create vital signs:', error);
      throw error;
    }
  }

  // ===============================
  // MEDICATION RESOURCES
  // ===============================

  /**
   * Create a medication request (prescription)
   */
  async createMedicationRequest(medicationRequestData: Partial<MedicationRequest>): Promise<MedicationRequest> {
    try {
      const medicationRequest: MedicationRequest = {
        resourceType: 'MedicationRequest',
        status: medicationRequestData.status || 'active',
        intent: medicationRequestData.intent || 'order',
        category: medicationRequestData.category || [],
        priority: medicationRequestData.priority || 'routine',
        medicationCodeableConcept: medicationRequestData.medicationCodeableConcept,
        medicationReference: medicationRequestData.medicationReference,
        subject: medicationRequestData.subject || { reference: '' },
        encounter: medicationRequestData.encounter,
        authoredOn: medicationRequestData.authoredOn || new Date().toISOString(),
        requester: medicationRequestData.requester,
        reasonCode: medicationRequestData.reasonCode || [],
        dosageInstruction: medicationRequestData.dosageInstruction || [],
        dispenseRequest: medicationRequestData.dispenseRequest,
        identifier: [
          ...(medicationRequestData.identifier || []),
          {
            system: 'http://omnicare.com/medication-request-id',
            value: `MR${Date.now()}`,
          },
        ],
      };

      const result = await medplumService.createResource(medicationRequest);
      logger.fhir('Medication request created successfully', { medicationRequestId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create medication request:', error);
      throw error;
    }
  }

  // ===============================
  // SERVICE REQUEST RESOURCES
  // ===============================

  /**
   * Create a service request (order)
   */
  async createServiceRequest(serviceRequestData: Partial<ServiceRequest>): Promise<ServiceRequest> {
    try {
      const serviceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        status: serviceRequestData.status || 'active',
        intent: serviceRequestData.intent || 'order',
        category: serviceRequestData.category || [],
        priority: serviceRequestData.priority || 'routine',
        code: serviceRequestData.code || {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '15220000',
            display: 'Laboratory test',
          }],
        },
        subject: serviceRequestData.subject || { reference: '' },
        encounter: serviceRequestData.encounter,
        occurrenceDateTime: serviceRequestData.occurrenceDateTime,
        authoredOn: serviceRequestData.authoredOn || new Date().toISOString(),
        requester: serviceRequestData.requester,
        reasonCode: serviceRequestData.reasonCode || [],
        identifier: [
          ...(serviceRequestData.identifier || []),
          {
            system: 'http://omnicare.com/service-request-id',
            value: `SR${Date.now()}`,
          },
        ],
      };

      const result = await medplumService.createResource(serviceRequest);
      logger.fhir('Service request created successfully', { serviceRequestId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create service request:', error);
      throw error;
    }
  }

  // ===============================
  // DIAGNOSTIC REPORT RESOURCES
  // ===============================

  /**
   * Create a diagnostic report
   */
  async createDiagnosticReport(diagnosticReportData: Partial<DiagnosticReport>): Promise<DiagnosticReport> {
    try {
      const diagnosticReport: DiagnosticReport = {
        resourceType: 'DiagnosticReport',
        status: diagnosticReportData.status || 'final',
        category: diagnosticReportData.category || [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'LAB',
            display: 'Laboratory',
          }],
        }],
        code: diagnosticReportData.code || {
          coding: [{
            system: 'http://loinc.org',
            code: '11502-2',
            display: 'Laboratory report',
          }],
        },
        subject: diagnosticReportData.subject || { reference: '' },
        encounter: diagnosticReportData.encounter,
        effectiveDateTime: diagnosticReportData.effectiveDateTime || new Date().toISOString(),
        issued: diagnosticReportData.issued || new Date().toISOString(),
        performer: diagnosticReportData.performer || [],
        result: diagnosticReportData.result || [],
        conclusion: diagnosticReportData.conclusion,
        identifier: [
          ...(diagnosticReportData.identifier || []),
          {
            system: 'http://omnicare.com/diagnostic-report-id',
            value: `DR${Date.now()}`,
          },
        ],
      };

      const result = await medplumService.createResource(diagnosticReport);
      logger.fhir('Diagnostic report created successfully', { diagnosticReportId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create diagnostic report:', error);
      throw error;
    }
  }

  // ===============================
  // CARE PLAN RESOURCES
  // ===============================

  /**
   * Create a care plan
   */
  async createCarePlan(carePlanData: Partial<CarePlan>): Promise<CarePlan> {
    try {
      const carePlan: CarePlan = {
        resourceType: 'CarePlan',
        status: carePlanData.status || 'active',
        intent: carePlanData.intent || 'plan',
        category: carePlanData.category || [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '734163000',
            display: 'Care plan',
          }],
        }],
        title: carePlanData.title,
        description: carePlanData.description,
        subject: carePlanData.subject || { reference: '' },
        encounter: carePlanData.encounter,
        period: carePlanData.period,
        created: carePlanData.created || new Date().toISOString(),
        author: carePlanData.author,
        contributor: carePlanData.contributor || [],
        careTeam: carePlanData.careTeam || [],
        addresses: carePlanData.addresses || [],
        goal: carePlanData.goal || [],
        activity: carePlanData.activity || [],
        identifier: [
          ...(carePlanData.identifier || []),
          {
            system: 'http://omnicare.com/care-plan-id',
            value: `CP${Date.now()}`,
          },
        ],
      };

      const result = await medplumService.createResource(carePlan);
      logger.fhir('Care plan created successfully', { carePlanId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to create care plan:', error);
      throw error;
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Validate a FHIR resource
   */
  async validateResource<T extends import('@medplum/fhirtypes').Resource>(resource: T): Promise<ValidationResult> {
    try {
      const result = await medplumService.validateResource(resource);
      
      // Parse validation results
      const validationResult: ValidationResult = {
        valid: true, // Will be set to false if there are errors
        errors: [],
        warnings: [],
      };

      if (result && 'issue' in result && Array.isArray(result.issue)) {
        result.issue.forEach((issue: any) => {
          if (issue.severity === 'error' || issue.severity === 'fatal') {
            validationResult.errors.push({
              path: issue.expression?.[0] || issue.location?.[0] || '',
              message: issue.diagnostics || issue.details?.text || 'Validation error',
              code: issue.code || 'unknown',
              severity: issue.severity,
            });
          } else {
            validationResult.warnings.push({
              path: issue.expression?.[0] || issue.location?.[0] || '',
              message: issue.diagnostics || issue.details?.text || 'Validation warning',
              code: issue.code || 'unknown',
              severity: issue.severity,
            });
          }
        });
      }

      // Resource is invalid only if there are errors or fatal issues
      validationResult.valid = validationResult.errors.length === 0;

      logger.fhir('Resource validation completed', {
        valid: validationResult.valid,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
      });

      return validationResult;
    } catch (error) {
      logger.error('Failed to validate resource:', error);
      throw error;
    }
  }

  /**
   * Get all resources for a patient
   */
  async getPatientEverything(patientId: string): Promise<Bundle<Resource>> {
    try {
      const result = await medplumService.searchResources('Patient', {
        _id: patientId,
        _include: '*',
        _revinclude: '*',
      });

      logger.fhir('Patient everything retrieved', {
        patientId,
        resourceCount: result.entry?.length || 0,
      });

      return result;
    } catch (error) {
      logger.error('Failed to get patient everything:', error);
      throw error;
    }
  }

  /**
   * Process a FHIR Bundle (transaction or batch)
   */
  async processBundle(bundle: Bundle): Promise<Bundle<Resource>> {
    try {
      logger.fhir('Processing bundle', {
        bundleType: bundle.type,
        entryCount: bundle.entry?.length || 0,
      });

      // Validate bundle structure
      if (!bundle.entry || bundle.entry.length === 0) {
        throw new Error('Bundle must contain at least one entry');
      }

      const responseEntries = [];

      for (const entry of bundle.entry) {
        if (!entry.request) {
          throw new Error('Bundle entry must contain a request');
        }

        const { method, url } = entry.request;
        const resource = entry.resource;

        try {
          let result;
          let status = '200';
          let location = '';

          switch (method?.toUpperCase()) {
            case 'POST':
              if (resource) {
                result = await medplumService.createResource(resource);
                status = '201';
                location = `${resource.resourceType}/${result.id}`;
              }
              break;
            case 'PUT':
              if (resource) {
                result = await medplumService.updateResource(resource);
                status = '200';
              }
              break;
            case 'GET':
              if (url) {
                const urlParts = url.split('/');
                const resourceType = urlParts[0];
                const id = urlParts[1];
                if (resourceType && id) {
                  result = await medplumService.readResource(resourceType as any, id);
                  status = '200';
                }
              }
              break;
            case 'DELETE':
              if (url) {
                const urlParts = url.split('/');
                const resourceType = urlParts[0];
                const id = urlParts[1];
                if (resourceType && id) {
                  await medplumService.deleteResource(resourceType as any, id);
                  status = '204';
                }
              }
              break;
            default:
              throw new Error(`Unsupported HTTP method: ${method}`);
          }

          responseEntries.push({
            response: {
              status,
              location: location || undefined,
            },
            resource: result,
          });

        } catch (entryError) {
          // For batch bundles, continue with other entries on error
          // For transaction bundles, this would typically rollback all changes
          const errorMessage = (entryError as Error)?.message || 'Unknown error';
          responseEntries.push({
            response: {
              status: '400',
              outcome: {
                resourceType: 'OperationOutcome' as const,
                issue: [{
                  severity: 'error' as const,
                  code: 'exception' as const,
                  diagnostics: errorMessage,
                }],
              },
            },
          });

          if (bundle.type === 'transaction') {
            // For transactions, fail the entire bundle on any error
            throw entryError;
          }
        }
      }

      const responseBundle: Bundle<Resource> = {
        resourceType: 'Bundle' as const,
        type: bundle.type === 'batch' ? 'batch-response' as const : 'transaction-response' as const,
        entry: responseEntries as any,
      };

      logger.fhir('Bundle processed successfully', {
        bundleType: bundle.type,
        processedEntries: responseEntries.length,
      });

      return responseBundle;
    } catch (error) {
      logger.error('Failed to process bundle:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fhirResourcesService = new FHIRResourcesService();