"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fhirResourcesService = exports.FHIRResourcesService = void 0;
const medplum_service_1 = require("./medplum.service");
const logger_1 = __importDefault(require("@/utils/logger"));
class FHIRResourcesService {
    async createPatient(patientData) {
        try {
            const patient = {
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
            const result = await medplum_service_1.medplumService.createResource(patient);
            logger_1.default.fhir('Patient created successfully', { patientId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create patient:', error);
            throw error;
        }
    }
    async searchPatients(searchParams) {
        try {
            const result = await medplum_service_1.medplumService.searchResources('Patient', searchParams);
            logger_1.default.fhir('Patient search completed', {
                resultCount: result.entry?.length || 0,
                total: result.total,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to search patients:', error);
            throw error;
        }
    }
    async getPatient(patientId) {
        try {
            const result = await medplum_service_1.medplumService.readResource('Patient', patientId);
            logger_1.default.fhir('Patient retrieved', { patientId });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to get patient:', error);
            throw error;
        }
    }
    async updatePatient(patient) {
        try {
            const result = await medplum_service_1.medplumService.updateResource(patient);
            logger_1.default.fhir('Patient updated successfully', { patientId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to update patient:', error);
            throw error;
        }
    }
    async createPractitioner(practitionerData) {
        try {
            const practitioner = {
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
            const result = await medplum_service_1.medplumService.createResource(practitioner);
            logger_1.default.fhir('Practitioner created successfully', { practitionerId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create practitioner:', error);
            throw error;
        }
    }
    async searchPractitioners(searchParams) {
        try {
            const result = await medplum_service_1.medplumService.searchResources('Practitioner', searchParams);
            logger_1.default.fhir('Practitioner search completed', {
                resultCount: result.entry?.length || 0
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to search practitioners:', error);
            throw error;
        }
    }
    async createEncounter(encounterData) {
        try {
            const encounter = {
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
            const result = await medplum_service_1.medplumService.createResource(encounter);
            logger_1.default.fhir('Encounter created successfully', { encounterId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create encounter:', error);
            throw error;
        }
    }
    async searchEncounters(searchParams) {
        try {
            const result = await medplum_service_1.medplumService.searchResources('Encounter', searchParams);
            logger_1.default.fhir('Encounter search completed', {
                resultCount: result.entry?.length || 0
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to search encounters:', error);
            throw error;
        }
    }
    async createObservation(observationData) {
        try {
            const observation = {
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
            const result = await medplum_service_1.medplumService.createResource(observation);
            logger_1.default.fhir('Observation created successfully', { observationId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create observation:', error);
            throw error;
        }
    }
    async createVitalSigns(patientId, encounterId, vitals) {
        const observations = [];
        try {
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
            logger_1.default.fhir('Vital signs created successfully', {
                patientId,
                encounterId,
                vitalsCount: observations.length,
            });
            return observations;
        }
        catch (error) {
            logger_1.default.error('Failed to create vital signs:', error);
            throw error;
        }
    }
    async createMedicationRequest(medicationRequestData) {
        try {
            const medicationRequest = {
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
            const result = await medplum_service_1.medplumService.createResource(medicationRequest);
            logger_1.default.fhir('Medication request created successfully', { medicationRequestId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create medication request:', error);
            throw error;
        }
    }
    async createServiceRequest(serviceRequestData) {
        try {
            const serviceRequest = {
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
            const result = await medplum_service_1.medplumService.createResource(serviceRequest);
            logger_1.default.fhir('Service request created successfully', { serviceRequestId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create service request:', error);
            throw error;
        }
    }
    async createDiagnosticReport(diagnosticReportData) {
        try {
            const diagnosticReport = {
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
            const result = await medplum_service_1.medplumService.createResource(diagnosticReport);
            logger_1.default.fhir('Diagnostic report created successfully', { diagnosticReportId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create diagnostic report:', error);
            throw error;
        }
    }
    async createCarePlan(carePlanData) {
        try {
            const carePlan = {
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
            const result = await medplum_service_1.medplumService.createResource(carePlan);
            logger_1.default.fhir('Care plan created successfully', { carePlanId: result.id });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to create care plan:', error);
            throw error;
        }
    }
    async validateResource(resource) {
        try {
            const result = await medplum_service_1.medplumService.validateResource(resource);
            const validationResult = {
                valid: !result.issue || result.issue.length === 0,
                errors: [],
                warnings: [],
            };
            if (result.issue) {
                result.issue.forEach((issue) => {
                    if (issue.severity === 'error' || issue.severity === 'fatal') {
                        validationResult.errors.push({
                            path: issue.expression?.[0] || issue.location?.[0] || '',
                            message: issue.diagnostics || issue.details?.text || 'Validation error',
                            code: issue.code || 'unknown',
                            severity: issue.severity,
                        });
                    }
                    else {
                        validationResult.warnings.push({
                            path: issue.expression?.[0] || issue.location?.[0] || '',
                            message: issue.diagnostics || issue.details?.text || 'Validation warning',
                            code: issue.code || 'unknown',
                            severity: issue.severity,
                        });
                    }
                });
            }
            logger_1.default.fhir('Resource validation completed', {
                valid: validationResult.valid,
                errors: validationResult.errors.length,
                warnings: validationResult.warnings.length,
            });
            return validationResult;
        }
        catch (error) {
            logger_1.default.error('Failed to validate resource:', error);
            throw error;
        }
    }
    async getPatientEverything(patientId) {
        try {
            const result = await medplum_service_1.medplumService.searchResources('Patient', {
                _id: patientId,
                _include: '*',
                _revinclude: '*',
            });
            logger_1.default.fhir('Patient everything retrieved', {
                patientId,
                resourceCount: result.entry?.length || 0,
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to get patient everything:', error);
            throw error;
        }
    }
}
exports.FHIRResourcesService = FHIRResourcesService;
exports.fhirResourcesService = new FHIRResourcesService();
//# sourceMappingURL=fhir-resources.service.js.map