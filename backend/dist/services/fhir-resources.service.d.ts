import { Patient, Practitioner, Encounter, Observation, MedicationRequest, ServiceRequest, DiagnosticReport, CarePlan, Bundle } from '@medplum/fhirtypes';
import { OmniCarePatient, OmniCareEncounter, OmniCareObservation, FHIRSearchParams, ValidationResult } from '@/types/fhir';
export declare class FHIRResourcesService {
    createPatient(patientData: Partial<OmniCarePatient>): Promise<Patient>;
    searchPatients(searchParams: FHIRSearchParams): Promise<Bundle<Patient>>;
    getPatient(patientId: string): Promise<Patient>;
    updatePatient(patient: Patient): Promise<Patient>;
    createPractitioner(practitionerData: Partial<Practitioner>): Promise<Practitioner>;
    searchPractitioners(searchParams: FHIRSearchParams): Promise<Bundle<Practitioner>>;
    createEncounter(encounterData: Partial<OmniCareEncounter>): Promise<Encounter>;
    searchEncounters(searchParams: FHIRSearchParams): Promise<Bundle<Encounter>>;
    createObservation(observationData: Partial<OmniCareObservation>): Promise<Observation>;
    createVitalSigns(patientId: string, encounterId: string, vitals: {
        temperature?: number;
        bloodPressureSystolic?: number;
        bloodPressureDiastolic?: number;
        heartRate?: number;
        respiratoryRate?: number;
        oxygenSaturation?: number;
        weight?: number;
        height?: number;
    }): Promise<Observation[]>;
    createMedicationRequest(medicationRequestData: Partial<MedicationRequest>): Promise<MedicationRequest>;
    createServiceRequest(serviceRequestData: Partial<ServiceRequest>): Promise<ServiceRequest>;
    createDiagnosticReport(diagnosticReportData: Partial<DiagnosticReport>): Promise<DiagnosticReport>;
    createCarePlan(carePlanData: Partial<CarePlan>): Promise<CarePlan>;
    validateResource<T>(resource: T): Promise<ValidationResult>;
    getPatientEverything(patientId: string): Promise<Bundle>;
}
export declare const fhirResourcesService: FHIRResourcesService;
//# sourceMappingURL=fhir-resources.service.d.ts.map