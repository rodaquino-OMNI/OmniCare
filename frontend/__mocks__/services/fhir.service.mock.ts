import {
  Patient,
  Practitioner,
  Encounter,
  Observation,
  MedicationRequest,
  ServiceRequest,
  DiagnosticReport,
  CarePlan,
  Condition,
  AllergyIntolerance,
  Bundle,
  OperationOutcome,
  Resource,
  Parameters,
  BundleEntry
} from '@medplum/fhirtypes';
import { createMockPatientData, createMockPatient } from './mock-data-generators';

// Types from original service
interface FHIRSearchParams {
  [key: string]: string | number | boolean | undefined;
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string;
  _revinclude?: string;
  _elements?: string;
  _summary?: string;
  _total?: string;
}

interface FHIRResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: string;
    severity: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    code: string;
    severity: string;
  }>;
}

interface HealthStatus {
  status: 'UP' | 'DOWN';
  timestamp: string;
  components: {
    medplum: { status: string; details: any };
    cdsHooks: { status: string; details: any };
    subscriptions: { status: string; details: any };
  };
}

// Mock FHIR Error
export class FHIRError extends Error {
  public operationOutcome?: OperationOutcome;
  public status?: number;

  constructor(message: string, operationOutcome?: OperationOutcome, status?: number) {
    super(message);
    this.name = 'FHIRError';
    this.operationOutcome = operationOutcome;
    this.status = status;
  }
}

// In-memory resource storage
const mockResourceStorage = new Map<string, Map<string, Resource>>();

// Initialize resource stores
const resourceTypes = [
  'Patient', 'Encounter', 'Observation', 'MedicationRequest',
  'Condition', 'AllergyIntolerance', 'DocumentReference',
  'DiagnosticReport', 'CarePlan', 'Immunization', 'ServiceRequest',
  'Practitioner', 'Organization'
];

resourceTypes.forEach(type => {
  mockResourceStorage.set(type, new Map());
});

export class MockFHIRService {
  private baseURL: string;
  private authToken?: string;
  private mockDelay = 100; // Simulate network delay

  constructor(baseURL: string = '/api/fhir/R4') {
    this.baseURL = baseURL;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  // Metadata and Capability
  async getCapabilityStatement(): Promise<any> {
    await this.simulateDelay();
    return {
      resourceType: 'CapabilityStatement',
      fhirVersion: '4.0.1',
      format: ['json'],
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      implementation: {
        description: 'OmniCare Mock FHIR Server'
      },
      rest: [{
        mode: 'server',
        resource: resourceTypes.map(type => ({
          type,
          interaction: [
            { code: 'read' },
            { code: 'create' },
            { code: 'update' },
            { code: 'delete' },
            { code: 'search-type' }
          ]
        }))
      }]
    };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    await this.simulateDelay();
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      components: {
        medplum: { status: 'UP', details: { version: '2.0.0' } },
        cdsHooks: { status: 'UP', details: { endpoints: 2 } },
        subscriptions: { status: 'UP', details: { active: 5 } }
      }
    };
  }

  // CRUD Operations
  async createResource<T extends Resource>(resource: T): Promise<T> {
    await this.simulateDelay();
    
    const store = mockResourceStorage.get(resource.resourceType);
    if (!store) {
      throw new FHIRError(`Unsupported resource type: ${resource.resourceType}`, undefined, 400);
    }

    // Generate ID if not provided
    if (!resource.id) {
      resource.id = this.generateId();
    }

    // Add metadata
    resource.meta = {
      ...resource.meta,
      versionId: '1',
      lastUpdated: new Date().toISOString()
    };

    store.set(resource.id, resource);
    return resource;
  }

  async readResource<T extends Resource>(resourceType: string, id: string): Promise<T> {
    await this.simulateDelay();
    
    const store = mockResourceStorage.get(resourceType);
    if (!store) {
      throw new FHIRError(`Unsupported resource type: ${resourceType}`, undefined, 400);
    }

    const resource = store.get(id);
    if (!resource) {
      throw new FHIRError(`Resource not found: ${resourceType}/${id}`, undefined, 404);
    }

    return resource as T;
  }

  async updateResource<T extends Resource>(resource: T): Promise<T> {
    await this.simulateDelay();
    
    if (!resource.id) {
      throw new FHIRError('Resource must have an ID to be updated', undefined, 400);
    }

    const store = mockResourceStorage.get(resource.resourceType);
    if (!store) {
      throw new FHIRError(`Unsupported resource type: ${resource.resourceType}`, undefined, 400);
    }

    const existing = store.get(resource.id);
    if (!existing) {
      throw new FHIRError(`Resource not found: ${resource.resourceType}/${resource.id}`, undefined, 404);
    }

    // Update metadata
    resource.meta = {
      ...resource.meta,
      versionId: String((parseInt(existing.meta?.versionId || '0') || 0) + 1),
      lastUpdated: new Date().toISOString()
    };

    store.set(resource.id, resource);
    return resource;
  }

  async deleteResource(resourceType: string, id: string): Promise<void> {
    await this.simulateDelay();
    
    const store = mockResourceStorage.get(resourceType);
    if (!store) {
      throw new FHIRError(`Unsupported resource type: ${resourceType}`, undefined, 400);
    }

    if (!store.has(id)) {
      throw new FHIRError(`Resource not found: ${resourceType}/${id}`, undefined, 404);
    }

    store.delete(id);
  }

  // Search Operations
  async searchResources<T extends Resource>(
    resourceType: string,
    searchParams: FHIRSearchParams = {}
  ): Promise<Bundle<T>> {
    await this.simulateDelay();
    
    const store = mockResourceStorage.get(resourceType);
    if (!store) {
      throw new FHIRError(`Unsupported resource type: ${resourceType}`, undefined, 400);
    }

    const offset = (searchParams._offset as number) || 0;
    const count = (searchParams._count as number) || 20;

    let resources = Array.from(store.values()) as T[];

    // Apply basic filters
    if (searchParams.patient) {
      resources = resources.filter(r => 
        (r as any).subject?.reference === `Patient/${searchParams.patient}` ||
        (r as any).patient?.reference === `Patient/${searchParams.patient}`
      );
    }

    if (searchParams.status) {
      resources = resources.filter(r => (r as any).status === searchParams.status);
    }

    if (searchParams.category) {
      resources = resources.filter(r => {
        const categories = (r as any).category || [];
        return categories.some((cat: any) => 
          cat.coding?.some((coding: any) => coding.code === searchParams.category)
        );
      });
    }

    // Apply sorting
    if (searchParams._sort) {
      const sortField = searchParams._sort.replace('-', '');
      const descending = searchParams._sort.startsWith('-');
      
      resources.sort((a, b) => {
        const aValue = this.getNestedValue(a, sortField);
        const bValue = this.getNestedValue(b, sortField);
        const comparison = String(aValue).localeCompare(String(bValue));
        return descending ? -comparison : comparison;
      });
    }

    // Apply pagination
    const total = resources.length;
    const paginatedResources = resources.slice(offset, offset + count);

    // Create bundle
    const bundle: Bundle<T> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total,
      entry: paginatedResources.map(resource => ({
        resource,
        fullUrl: `${this.baseURL}/${resourceType}/${resource.id}`
      } as BundleEntry<T>))
    };

    // Add pagination links
    if (offset + count < total) {
      bundle.link = [{
        relation: 'next',
        url: `?_offset=${offset + count}&_count=${count}`
      }];
    }

    return bundle;
  }

  // Patient-specific operations
  async createPatient(patientData: Partial<Patient>): Promise<Patient> {
    const patient: Patient = {
      resourceType: 'Patient',
      ...patientData
    };
    return this.createResource(patient);
  }

  async getPatient(patientId: string): Promise<Patient> {
    // Check if patient exists, if not create mock data
    const store = mockResourceStorage.get('Patient');
    if (!store?.has(patientId)) {
      const mockPatient = createMockPatient(patientId);
      await this.createResource(mockPatient);
    }
    return this.readResource<Patient>('Patient', patientId);
  }

  async updatePatient(patient: Patient): Promise<Patient> {
    return this.updateResource(patient);
  }

  async searchPatients(searchParams: FHIRSearchParams = {}): Promise<Bundle<Patient>> {
    return this.searchResources<Patient>('Patient', searchParams);
  }

  async getPatientEverything(patientId: string): Promise<Bundle<Resource>> {
    await this.simulateDelay();
    
    // Generate complete patient data if not exists
    const patientStore = mockResourceStorage.get('Patient');
    if (!patientStore?.has(patientId)) {
      const mockData = createMockPatientData(patientId);
      
      // Store all generated resources
      await this.createResource(mockData.patient);
      for (const allergy of mockData.allergies) await this.createResource(allergy);
      for (const condition of mockData.conditions) await this.createResource(condition);
      for (const medication of mockData.medications) await this.createResource(medication);
      for (const encounter of mockData.encounters) await this.createResource(encounter);
      for (const vital of mockData.vitals) await this.createResource(vital);
      for (const lab of mockData.labs) await this.createResource(lab);
    }

    // Collect all resources for patient
    const allResources: Resource[] = [];
    
    const patient = await this.getPatient(patientId);
    allResources.push(patient);

    // Get related resources
    const resourceTypesToSearch = [
      'AllergyIntolerance', 'Condition', 'MedicationRequest',
      'Encounter', 'Observation'
    ];

    for (const resourceType of resourceTypesToSearch) {
      const bundle = await this.searchResources(resourceType, { patient: patientId });
      if (bundle.entry) {
        allResources.push(...bundle.entry.map(e => e.resource!));
      }
    }

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: allResources.length,
      entry: allResources.map(resource => ({
        resource,
        fullUrl: `${this.baseURL}/${resource.resourceType}/${resource.id}`
      }))
    };
  }

  async getPatientVitalSigns(patientId: string): Promise<Bundle<Observation>> {
    return this.searchResources<Observation>('Observation', {
      patient: patientId,
      category: 'vital-signs',
      _sort: '-date'
    });
  }

  async getPatientLabResults(patientId: string): Promise<Bundle<Observation>> {
    return this.searchResources<Observation>('Observation', {
      patient: patientId,
      category: 'laboratory',
      _sort: '-date'
    });
  }

  async getPatientMedications(patientId: string): Promise<Bundle<MedicationRequest>> {
    return this.searchResources<MedicationRequest>('MedicationRequest', {
      patient: patientId,
      _sort: '-authored-on'
    });
  }

  async getPatientConditions(patientId: string): Promise<Bundle<Condition>> {
    return this.searchResources<Condition>('Condition', {
      patient: patientId,
      _sort: '-recorded-date'
    });
  }

  async getPatientAllergies(patientId: string): Promise<Bundle<AllergyIntolerance>> {
    return this.searchResources<AllergyIntolerance>('AllergyIntolerance', {
      patient: patientId,
      _sort: '-recorded-date'
    });
  }

  async getPatientEncounters(patientId: string): Promise<Bundle<Encounter>> {
    return this.searchResources<Encounter>('Encounter', {
      patient: patientId,
      _sort: '-date'
    });
  }

  // Encounter operations
  async createEncounter(encounterData: Partial<Encounter>): Promise<Encounter> {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      ...encounterData
    };
    return this.createResource(encounter);
  }

  async getEncounter(encounterId: string): Promise<Encounter> {
    return this.readResource<Encounter>('Encounter', encounterId);
  }

  async updateEncounter(encounter: Encounter): Promise<Encounter> {
    return this.updateResource(encounter);
  }

  // Observation operations
  async createObservation(observationData: Partial<Observation>): Promise<Observation> {
    const observation: Observation = {
      resourceType: 'Observation',
      status: 'final',
      code: {
        text: 'Observation'
      },
      ...observationData
    };
    return this.createResource(observation);
  }

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

    if (vitals.temperature) {
      observations.push(await this.createObservation({
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
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: {
          value: vitals.temperature,
          unit: '°F',
          system: 'http://unitsofmeasure.org',
          code: '[degF]'
        }
      }));
    }

    // Similar for other vitals...
    return observations;
  }

  // Batch/Transaction operations
  async executeBatch(bundle: Bundle): Promise<Bundle<Resource>> {
    await this.simulateDelay();
    
    const responseBundle: Bundle<Resource> = {
      resourceType: 'Bundle',
      type: 'batch-response',
      entry: []
    };

    for (const entry of bundle.entry || []) {
      try {
        if (entry.request?.method === 'POST' && entry.resource) {
          const created = await this.createResource(entry.resource);
          responseBundle.entry?.push({
            response: {
              status: '201 Created',
              location: `${created.resourceType}/${created.id}`
            },
            resource: created
          });
        } else if (entry.request?.method === 'PUT' && entry.resource) {
          const updated = await this.updateResource(entry.resource);
          responseBundle.entry?.push({
            response: { status: '200 OK' },
            resource: updated
          });
        } else if (entry.request?.method === 'DELETE' && entry.request.url) {
          const [resourceType, id] = entry.request.url.split('/');
          await this.deleteResource(resourceType, id);
          responseBundle.entry?.push({
            response: { status: '204 No Content' }
          });
        }
      } catch (error) {
        responseBundle.entry?.push({
          response: {
            status: '400 Bad Request',
            outcome: {
              resourceType: 'OperationOutcome',
              issue: [{
                severity: 'error',
                code: 'processing',
                diagnostics: error instanceof Error ? error.message : 'Unknown error'
              }]
            }
          }
        });
      }
    }

    return responseBundle;
  }

  // Validation operations
  async validateResource<T extends Resource>(resource: T): Promise<ValidationResult> {
    await this.simulateDelay();
    
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Basic validation
    if (!resource.resourceType) {
      errors.push({
        path: 'resourceType',
        message: 'Resource must have a resourceType',
        code: 'required',
        severity: 'error'
      });
    }

    // Resource-specific validation
    if (resource.resourceType === 'Patient') {
      const patient = resource as Patient;
      if (!patient.name || patient.name.length === 0) {
        warnings.push({
          path: 'name',
          message: 'Patient should have at least one name',
          code: 'business-rule',
          severity: 'warning'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // GraphQL operations
  async executeGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
    await this.simulateDelay();
    
    // Simple mock implementation
    if (query.includes('Patient') && variables?.id) {
      const patient = await this.getPatient(variables.id);
      return {
        data: { Patient: patient }
      };
    }

    return {
      data: {},
      errors: [{
        message: 'GraphQL not fully implemented in mock'
      }]
    };
  }

  // Subscription operations
  async createSubscription(
    criteria: string,
    channelType: 'rest-hook' | 'websocket' | 'email',
    endpoint?: string
  ): Promise<any> {
    const subscription = {
      resourceType: 'Subscription' as const,
      id: this.generateId(),
      status: 'active' as const,
      reason: 'OmniCare EMR Integration',
      criteria,
      channel: {
        type: channelType,
        endpoint: endpoint || '',
        payload: 'application/fhir+json'
      }
    };

    return this.createResource(subscription as any);
  }

  async listSubscriptions(): Promise<Bundle<Resource>> {
    return this.searchResources('Subscription');
  }

  // Utility methods
  async getResourceByReference<T extends Resource>(reference: string): Promise<T> {
    const [resourceType, id] = reference.split('/').slice(-2);
    return this.readResource<T>(resourceType, id);
  }

  formatResourceDisplay(resource: Resource): string {
    switch (resource.resourceType) {
      case 'Patient':
        const patient = resource as Patient;
        const name = patient.name?.[0];
        if (name) {
          const given = name.given?.join(' ') || '';
          const family = name.family || '';
          return `${given} ${family}`.trim();
        }
        return 'Unknown Patient';

      case 'Observation':
        const observation = resource as Observation;
        return observation.code?.coding?.[0]?.display || 
               observation.code?.text || 
               'Unknown Observation';

      default:
        return `${resource.resourceType}/${resource.id}`;
    }
  }

  getCodingDisplay(coding?: Array<{ display?: string; code?: string }>): string {
    if (!coding || coding.length === 0) return 'Unknown';
    return coding[0].display || coding[0].code || 'Unknown';
  }

  formatQuantity(quantity?: { value?: number; unit?: string }): string {
    if (!quantity) return '';
    const value = quantity.value ?? '';
    const unit = quantity.unit ?? '';
    return `${value} ${unit}`.trim();
  }

  parseFHIRDate(fhirDate?: string): Date | null {
    if (!fhirDate) return null;
    return new Date(fhirDate);
  }

  formatFHIRDate(fhirDate?: string, options?: Intl.DateTimeFormatOptions): string {
    const date = this.parseFHIRDate(fhirDate);
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatFHIRDateTime(fhirDateTime?: string, options?: Intl.DateTimeFormatOptions): string {
    const date = this.parseFHIRDate(fhirDateTime);
    if (!date) return '';
    
    return date.toLocaleString('en-US', options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  hasErrors(resource: Resource): boolean {
    return resource.meta?.tag?.some(tag => 
      tag.system === 'http://terminology.hl7.org/CodeSystem/v3-ObservationValue' && 
      tag.code === 'INVALID'
    ) || false;
  }

  getResourceVersion(resource: Resource): string {
    return resource.meta?.versionId || '1';
  }

  getResourceLastUpdated(resource: Resource): Date | null {
    return resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated) : null;
  }

  // Helper methods
  private async simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.mockDelay));
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Export singleton instance
export const fhirService = new MockFHIRService();

// Export types
export type {
  FHIRSearchParams,
  FHIRResponse,
  ValidationResult,
  HealthStatus
};