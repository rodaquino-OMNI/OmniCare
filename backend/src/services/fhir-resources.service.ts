import {
  Patient,
  Practitioner,
  Encounter,
  Observation,
  MedicationRequest,
  ServiceRequest,
  DiagnosticReport,
  CarePlan,
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
   * Supports advanced search parameters including:
   * - name (given, family, or full name search)
   * - identifier (MRN, SSN, etc.)
   * - birthdate (exact or range)
   * - gender
   * - phone
   * - email
   * - address (city, state, postal code)
   * - general-practitioner
   * - active status
   * - _sort (sorting)
   * - _count (pagination)
   * - _offset (pagination)
   */
  async searchPatients(searchParams: FHIRSearchParams): Promise<Bundle<Patient>> {
    try {
      // Build enhanced search parameters
      const enhancedParams: FHIRSearchParams = {
        ...searchParams,
      };

      // Handle special search parameters
      if (searchParams.name) {
        // Support partial name matching
        enhancedParams.name = searchParams.name;
        enhancedParams['name:contains'] = searchParams.name;
      }

      if (searchParams.birthdate) {
        // Support date range searches - handle birthdate as string or object
        if (typeof searchParams.birthdate === 'string') {
          enhancedParams['birthdate'] = searchParams.birthdate;
        } else if (typeof searchParams.birthdate === 'object' && searchParams.birthdate !== null) {
          const birthdateObj = searchParams.birthdate as any;
          if ('start' in birthdateObj) {
            enhancedParams['birthdate'] = `ge${birthdateObj.start}`;
            if ('end' in birthdateObj && birthdateObj.end) {
              enhancedParams['birthdate'] = `${enhancedParams['birthdate']}&le${birthdateObj.end}`;
            }
          }
        }
      }

      // Add default sorting if not specified
      if (!enhancedParams._sort) {
        enhancedParams._sort = '-_lastUpdated';
      }

      // Add default count if not specified
      if (!enhancedParams._count) {
        enhancedParams._count = 20;
      }

      const result = await medplumService.searchResources<Patient>('Patient', enhancedParams);
      
      // Add caching headers for offline support
      const cacheHeaders = {
        'Cache-Control': 'private, max-age=300', // 5 minutes
        'ETag': `W/"${Date.now()}"`,
        'Last-Modified': new Date().toUTCString(),
      };

      logger.fhir('Patient search completed', { 
        resultCount: result.entry?.length || 0,
        total: result.total,
        searchParams: enhancedParams,
        cacheHeaders,
      });

      // Enhance result with cache metadata - store cache headers separately
      const enhancedResult = {
        ...result,
        meta: {
          ...result.meta,
        },
      } as Bundle<Patient> & { cacheHeaders?: Record<string, string> };
      
      // Add cache headers as a custom property
      enhancedResult.cacheHeaders = cacheHeaders;
      
      return enhancedResult;
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
      // Validate patient data before update
      const validationResult = await this.validateResource(patient);
      if (!validationResult.valid) {
        throw new Error(`Patient validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Update last modified timestamp
      patient.meta = {
        ...patient.meta,
        lastUpdated: new Date().toISOString(),
      };

      const result = await medplumService.updateResource(patient);
      logger.fhir('Patient updated successfully', { patientId: result.id });
      return result;
    } catch (error) {
      logger.error('Failed to update patient:', error);
      throw error;
    }
  }

  /**
   * Delete patient (soft delete by marking as inactive)
   */
  async deletePatient(patientId: string, hardDelete: boolean = false): Promise<void> {
    try {
      if (hardDelete) {
        // Hard delete - permanently remove from database
        await medplumService.deleteResource('Patient', patientId);
        logger.fhir('Patient hard deleted', { patientId });
      } else {
        // Soft delete - mark as inactive
        const patient = await this.getPatient(patientId);
        patient.active = false;
        patient.meta = {
          ...patient.meta,
          lastUpdated: new Date().toISOString(),
        };
        await medplumService.updateResource(patient);
        logger.fhir('Patient soft deleted (marked inactive)', { patientId });
      }
    } catch (error) {
      logger.error('Failed to delete patient:', error);
      throw error;
    }
  }

  /**
   * Batch create patients
   */
  async createPatientsBatch(patients: Partial<OmniCarePatient>[]): Promise<Bundle<Patient>> {
    try {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: patients.map(patientData => ({
          request: {
            method: 'POST',
            url: 'Patient',
          },
          resource: {
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
                value: patientData.omnicarePatientId || `P${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              },
            ],
            contact: patientData.contact || [],
            communication: patientData.communication || [],
            generalPractitioner: patientData.generalPractitioner || [],
            managingOrganization: patientData.managingOrganization,
            extension: [
              ...(patientData.extension || []),
              {
                url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
                valueDateTime: patientData.registrationDate || new Date().toISOString(),
              },
              {
                url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
                valueString: patientData.preferredLanguage || 'en',
              },
            ],
          } as Patient,
        })),
      };

      const result = await medplumService.executeBatch(bundle);
      logger.fhir('Batch patient creation completed', {
        requestedCount: patients.length,
        successCount: result.entry?.filter(e => e.response?.status?.startsWith('2')).length || 0,
      });
      return result as Bundle<Patient>;
    } catch (error) {
      logger.error('Failed to create patients batch:', error);
      throw error;
    }
  }

  /**
   * Get patient summary (optimized for list views)
   */
  async getPatientSummary(patientId: string): Promise<Partial<Patient>> {
    try {
      const patient = await this.getPatient(patientId);
      
      // Return only essential fields for summary views
      return {
        id: patient.id,
        resourceType: patient.resourceType,
        identifier: patient.identifier,
        active: patient.active,
        name: patient.name,
        gender: patient.gender,
        birthDate: patient.birthDate,
        telecom: patient.telecom?.filter(t => t.use === 'mobile' || t.use === 'home'),
        address: patient.address?.filter(a => a.use === 'home'),
        meta: {
          lastUpdated: patient.meta?.lastUpdated,
          versionId: patient.meta?.versionId,
        },
      };
    } catch (error) {
      logger.error('Failed to get patient summary:', error);
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
   * Create a service request (order) with enhanced CPOE functionality
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
        bodySite: serviceRequestData.bodySite,
        note: serviceRequestData.note || [],
        patientInstruction: serviceRequestData.patientInstruction,
        specimen: serviceRequestData.specimen,
        supportingInfo: serviceRequestData.supportingInfo || [],
        identifier: [
          ...(serviceRequestData.identifier || []),
          {
            system: 'http://omnicare.com/service-request-id',
            value: `SR${Date.now()}`,
          },
        ],
        extension: [
          ...(serviceRequestData.extension || []),
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/order-urgency',
            valueString: serviceRequestData.priority || 'routine',
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/order-created-date',
            valueDateTime: new Date().toISOString(),
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

  /**
   * Search service requests with enhanced filtering for CPOE
   */
  async searchServiceRequests(searchParams: FHIRSearchParams): Promise<Bundle<ServiceRequest>> {
    try {
      // Build enhanced search parameters for order management
      const enhancedParams: FHIRSearchParams = {
        ...searchParams,
      };

      // Add default sorting if not specified (most recent first)
      if (!enhancedParams._sort) {
        enhancedParams._sort = '-authored';
      }

      // Add default count if not specified
      if (!enhancedParams._count) {
        enhancedParams._count = 50;
      }

      // Add includes for related resources
      enhancedParams._include = 'ServiceRequest:subject,ServiceRequest:requester,ServiceRequest:encounter';

      const result = await medplumService.searchResources<ServiceRequest>('ServiceRequest', enhancedParams);
      
      logger.fhir('Service request search completed', { 
        resultCount: result.entry?.length || 0,
        total: result.total,
        searchParams: enhancedParams,
      });

      return result;
    } catch (error) {
      logger.error('Failed to search service requests:', error);
      throw error;
    }
  }

  /**
   * Update service request status (for order tracking)
   */
  async updateServiceRequestStatus(serviceRequestId: string, status: string, note?: string): Promise<ServiceRequest> {
    try {
      const serviceRequest = await medplumService.readResource<ServiceRequest>('ServiceRequest', serviceRequestId);
      
      // Validate status transition
      const validStatuses = ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`);
      }

      // Update the service request
      const updatedServiceRequest: ServiceRequest = {
        ...serviceRequest,
        status: status as ServiceRequest['status'],
        meta: {
          ...serviceRequest.meta,
          lastUpdated: new Date().toISOString(),
        },
        note: note ? [
          ...(serviceRequest.note || []),
          {
            text: note,
            time: new Date().toISOString(),
          },
        ] : serviceRequest.note,
      };

      const result = await medplumService.updateResource(updatedServiceRequest);
      logger.fhir('Service request status updated', { 
        serviceRequestId, 
        oldStatus: serviceRequest.status, 
        newStatus: status 
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to update service request status:', error);
      throw error;
    }
  }

  /**
   * Create laboratory order with specific lab test details
   */
  async createLabOrder(labOrderData: {
    patientId: string;
    encounterId?: string;
    tests: Array<{
      code: string;
      display: string;
      system?: string;
    }>;
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    reason?: string;
    specimenType?: string;
    notes?: string;
    requesterId?: string;
  }): Promise<ServiceRequest[]> {
    try {
      const { patientId, encounterId, tests, priority = 'routine', reason, specimenType, notes, requesterId } = labOrderData;

      const labOrders: ServiceRequest[] = [];

      for (const test of tests) {
        const serviceRequest: ServiceRequest = {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: '108252007',
              display: 'Laboratory procedure',
            }],
          }],
          priority,
          code: {
            coding: [{
              system: test.system || 'http://loinc.org',
              code: test.code,
              display: test.display,
            }],
          },
          subject: { reference: `Patient/${patientId}` },
          encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
          authoredOn: new Date().toISOString(),
          requester: requesterId ? { reference: `Practitioner/${requesterId}` } : undefined,
          reasonCode: reason ? [{
            text: reason,
          }] : undefined,
          specimen: specimenType ? [{
            reference: `Specimen/lab-specimen-${Date.now()}`,
            display: specimenType,
          }] : undefined,
          note: notes ? [{
            text: notes,
            time: new Date().toISOString(),
          }] : undefined,
          identifier: [{
            system: 'http://omnicare.com/lab-order-id',
            value: `LAB${Date.now()}-${test.code}`,
          }],
          extension: [{
            url: 'http://omnicare.com/fhir/StructureDefinition/lab-test-type',
            valueString: test.code,
          }],
        };

        const result = await medplumService.createResource(serviceRequest);
        labOrders.push(result);
      }

      logger.fhir('Lab orders created successfully', { 
        patientId, 
        testCount: tests.length,
        orderIds: labOrders.map(order => order.id),
      });

      return labOrders;
    } catch (error) {
      logger.error('Failed to create lab orders:', error);
      throw error;
    }
  }

  /**
   * Create imaging order with specific imaging details
   */
  async createImagingOrder(imagingOrderData: {
    patientId: string;
    encounterId?: string;
    imagingType: string;
    bodyRegion?: string;
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    reason?: string;
    contrast?: boolean;
    notes?: string;
    requesterId?: string;
  }): Promise<ServiceRequest> {
    try {
      const { 
        patientId, 
        encounterId, 
        imagingType, 
        bodyRegion, 
        priority = 'routine', 
        reason, 
        contrast = false, 
        notes, 
        requesterId 
      } = imagingOrderData;

      const serviceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '363679005',
            display: 'Imaging',
          }],
        }],
        priority,
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: this.getImagingCode(imagingType),
            display: imagingType,
          }],
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
        authoredOn: new Date().toISOString(),
        requester: requesterId ? { reference: `Practitioner/${requesterId}` } : undefined,
        reasonCode: reason ? [{
          text: reason,
        }] : undefined,
        bodySite: bodyRegion ? [{
          text: bodyRegion,
        }] : undefined,
        note: notes ? [{
          text: notes,
          time: new Date().toISOString(),
        }] : undefined,
        identifier: [{
          system: 'http://omnicare.com/imaging-order-id',
          value: `IMG${Date.now()}`,
        }],
        extension: [
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/imaging-type',
            valueString: imagingType,
          },
          {
            url: 'http://omnicare.com/fhir/StructureDefinition/contrast-used',
            valueBoolean: contrast,
          },
          ...(bodyRegion ? [{
            url: 'http://omnicare.com/fhir/StructureDefinition/body-region',
            valueString: bodyRegion,
          }] : []),
        ],
      };

      const result = await medplumService.createResource(serviceRequest);
      logger.fhir('Imaging order created successfully', { 
        patientId, 
        imagingType, 
        orderId: result.id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create imaging order:', error);
      throw error;
    }
  }

  /**
   * Get orders by patient for order tracking
   */
  async getOrdersByPatient(patientId: string, filters?: {
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Bundle<ServiceRequest>> {
    try {
      const searchParams: FHIRSearchParams = {
        subject: `Patient/${patientId}`,
        _sort: '-authored',
        _count: 100,
        _include: 'ServiceRequest:requester',
      };

      if (filters?.status) {
        searchParams.status = filters.status;
      }

      if (filters?.category) {
        searchParams.category = filters.category;
      }

      if (filters?.dateFrom) {
        searchParams.authored = `ge${filters.dateFrom}`;
      }

      if (filters?.dateTo) {
        const existingDate = searchParams.authored || '';
        searchParams.authored = `${existingDate}&le${filters.dateTo}`;
      }

      const result = await this.searchServiceRequests(searchParams);
      
      logger.fhir('Patient orders retrieved', { 
        patientId, 
        orderCount: result.entry?.length || 0,
        filters,
      });

      return result;
    } catch (error) {
      logger.error('Failed to get orders by patient:', error);
      throw error;
    }
  }

  /**
   * Cancel/revoke an order
   */
  async cancelOrder(serviceRequestId: string, reason: string, requesterId?: string): Promise<ServiceRequest> {
    try {
      const serviceRequest = await medplumService.readResource<ServiceRequest>('ServiceRequest', serviceRequestId);
      
      // Check if order can be cancelled
      if (serviceRequest.status === 'completed' || serviceRequest.status === 'entered-in-error') {
        throw new Error(`Cannot cancel order with status: ${serviceRequest.status}`);
      }

      const cancelledRequest: ServiceRequest = {
        ...serviceRequest,
        status: 'revoked',
        meta: {
          ...serviceRequest.meta,
          lastUpdated: new Date().toISOString(),
        },
        note: [
          ...(serviceRequest.note || []),
          {
            text: `Order cancelled: ${reason}`,
            time: new Date().toISOString(),
            authorReference: requesterId ? { reference: `Practitioner/${requesterId}` } : undefined,
          },
        ],
      };

      const result = await medplumService.updateResource(cancelledRequest);
      logger.fhir('Order cancelled successfully', { 
        serviceRequestId, 
        reason, 
        cancelledBy: requesterId 
      });

      return result;
    } catch (error) {
      logger.error('Failed to cancel order:', error);
      throw error;
    }
  }

  // Helper method for imaging codes
  private getImagingCode(imagingType: string): string {
    const imagingCodes: Record<string, string> = {
      'X-ray': '168537006',
      'CT scan': '77477000',
      'MRI': '113091000',
      'Ultrasound': '16310003',
      'Mammography': '71651007',
      'Nuclear medicine': '363680008',
      'PET scan': '82918005',
      'Fluoroscopy': '44491008',
    };
    return imagingCodes[imagingType] || '363679005'; // Default to general imaging
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