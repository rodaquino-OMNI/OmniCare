/**
 * Comprehensive Medplum Service Mock
 * Provides realistic FHIR-compliant mock responses for testing
 */

import { jest } from '@jest/globals';
import { 
  Bundle, 
  Patient, 
  Practitioner, 
  Encounter, 
  Observation, 
  OperationOutcome,
  CapabilityStatement,
  Resource
} from '@medplum/fhirtypes';

// Mock data generators
export class MedplumMockData {
  static createPatient(overrides: Partial<Patient> = {}): Patient {
    const basePatient: Patient = {
      resourceType: 'Patient',
      id: `patient-${Math.random().toString(36).substr(2, 9)}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient']
      },
      active: true,
      name: [{
        use: 'official' as const,
        family: 'Doe',
        given: ['John'],
      }],
      gender: 'male',
      birthDate: '1990-01-01',
      identifier: [{
        use: 'usual' as const,
        system: 'http://omnicare.com/patient-id',
        value: `MRN${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      }],
      telecom: [{
        system: 'phone',
        value: '555-0123',
        use: 'mobile' as const
      }, {
        system: 'email',
        value: 'john.doe@example.com',
        use: 'home' as const
      }],
      address: [{
        use: 'home' as const,
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'NY',
        postalCode: '12345',
        country: 'US'
      }]
    };

    return { ...basePatient, ...overrides };
  }

  static createPractitioner(overrides: Partial<Practitioner> = {}): Practitioner {
    const basePractitioner: Practitioner = {
      resourceType: 'Practitioner',
      id: `practitioner-${Math.random().toString(36).substr(2, 9)}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      },
      active: true,
      name: [{
        use: 'official' as const,
        family: 'Smith',
        given: ['Jane'],
        prefix: ['Dr.']
      }],
      identifier: [{
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: '1234567890'
      }],
      telecom: [{
        system: 'phone',
        value: '555-0456',
        use: 'work' as const
      }],
      qualification: [{
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine'
          }]
        }
      }]
    };

    return { ...basePractitioner, ...overrides };
  }

  static createEncounter(patientId: string, overrides: Partial<Encounter> = {}): Encounter {
    const baseEncounter: Encounter = {
      resourceType: 'Encounter',
      id: `encounter-${Math.random().toString(36).substr(2, 9)}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      },
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      period: {
        start: new Date().toISOString()
      }
    };

    return { ...baseEncounter, ...overrides };
  }

  static createObservation(patientId: string, encounterId?: string, overrides: Partial<Observation> = {}): Observation {
    const baseObservation: Observation = {
      resourceType: 'Observation',
      id: `observation-${Math.random().toString(36).substr(2, 9)}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      },
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
      subject: {
        reference: `Patient/${patientId}`
      },
      encounter: encounterId ? {
        reference: `Encounter/${encounterId}`
      } : undefined,
      valueQuantity: {
        value: 98.6,
        unit: '°F',
        system: 'http://unitsofmeasure.org',
        code: '[degF]'
      },
      effectiveDateTime: new Date().toISOString()
    };

    return { ...baseObservation, ...overrides };
  }

  static createBundle<T extends Resource>(
    resources: T[], 
    type: Bundle['type'] = 'searchset'
  ): Bundle<T> {
    return {
      resourceType: 'Bundle',
      id: `bundle-${Math.random().toString(36).substr(2, 9)}`,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      type,
      total: resources.length,
      entry: resources.map(resource => ({
        resource,
        fullUrl: `${process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/'}fhir/R4/${resource.resourceType}/${resource.id}`
      }))
    };
  }

  static createOperationOutcome(
    severity: 'fatal' | 'error' | 'warning' | 'information' = 'information',
    message: string = 'Operation completed successfully'
  ): OperationOutcome {
    return {
      resourceType: 'OperationOutcome',
      id: `outcome-${Math.random().toString(36).substr(2, 9)}`,
      issue: [{
        severity,
        code: severity === 'error' ? 'processing' : 'informational',
        diagnostics: message
      }]
    };
  }

  static createCapabilityStatement(): CapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      id: 'medplum-capability',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'Medplum',
      kind: 'instance',
      software: {
        name: 'Medplum',
        version: '3.0.0'
      },
      implementation: {
        description: 'Medplum FHIR Server'
      },
      fhirVersion: '4.0.1',
      format: ['json', 'xml'],
      rest: [{
        mode: 'server',
        resource: [
          {
            type: 'Patient',
            interaction: [
              { code: 'create' },
              { code: 'read' },
              { code: 'update' },
              { code: 'delete' },
              { code: 'search-type' }
            ],
            searchParam: [
              { name: 'name', type: 'string' },
              { name: 'identifier', type: 'token' },
              { name: 'birthdate', type: 'date' }
            ]
          },
          {
            type: 'Practitioner',
            interaction: [
              { code: 'create' },
              { code: 'read' },
              { code: 'update' },
              { code: 'delete' },
              { code: 'search-type' }
            ]
          },
          {
            type: 'Encounter',
            interaction: [
              { code: 'create' },
              { code: 'read' },
              { code: 'update' },
              { code: 'delete' },
              { code: 'search-type' }
            ]
          },
          {
            type: 'Observation',
            interaction: [
              { code: 'create' },
              { code: 'read' },
              { code: 'update' },
              { code: 'delete' },
              { code: 'search-type' }
            ]
          }
        ]
      }]
    };
  }
}

// Mock Medplum client class
export class MockMedplumClient {
  private resources: Map<string, Map<string, Resource>> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize with some default resource types
    this.resources.set('Patient', new Map());
    this.resources.set('Practitioner', new Map());
    this.resources.set('Encounter', new Map());
    this.resources.set('Observation', new Map());
    this.resources.set('MedicationRequest', new Map());
  }

  // CRUD Operations
  createResource<T extends Resource>(resource: T): Promise<T> {
    const resourceType = resource.resourceType;
    const id = resource.id || `${resourceType.toLowerCase()}-${this.nextId++}`;
    
    const createdResource = {
      ...resource,
      id,
      meta: {
        ...resource.meta,
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      }
    } as T;

    if (!this.resources.has(resourceType)) {
      this.resources.set(resourceType, new Map());
    }

    this.resources.get(resourceType)!.set(id, createdResource);
    return createdResource;
  }

  readResource<T extends Resource>(resourceType: string, id: string): Promise<T> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      throw new Error(`${resourceType}/${id} not found`);
    }
    return typeMap.get(id) as T;
  }

  updateResource<T extends Resource>(resource: T): Promise<T> {
    const { resourceType, id } = resource;
    if (!id) {
      throw new Error('Resource must have an ID for update');
    }

    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      throw new Error(`${resourceType}/${id} not found`);
    }

    const currentResource = typeMap.get(id) as T;
    const currentVersionId = parseInt(currentResource.meta?.versionId || '1');

    const updatedResource = {
      ...resource,
      meta: {
        ...resource.meta,
        versionId: (currentVersionId + 1).toString(),
        lastUpdated: new Date().toISOString(),
      }
    } as T;

    typeMap.set(id, updatedResource);
    return updatedResource;
  }

  deleteResource(resourceType: string, id: string): Promise<void> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      throw new Error(`${resourceType}/${id} not found`);
    }
    typeMap.delete(id);
  }

  // Search Operations
  search<T extends Resource>(
    resourceType: string, 
    params: Record<string, any> = {}
  ): Promise<Bundle<T>> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap) {
      return MedplumMockData.createBundle<T>([]);
    }

    let resources = Array.from(typeMap.values()) as T[];

    // Apply basic filtering based on search parameters
    if (params.name) {
      resources = resources.filter(r => 
        JSON.stringify(r).toLowerCase().includes(params.name.toLowerCase())
      );
    }

    if (params.identifier) {
      resources = resources.filter(r => 
        JSON.stringify(r).toLowerCase().includes(params.identifier.toLowerCase())
      );
    }

    if (params._count) {
      resources = resources.slice(0, parseInt(params._count));
    }

    return MedplumMockData.createBundle<T>(resources);
  }

  async searchResources<T extends Resource>(
    resourceType: string, 
    params: Record<string, any> = {}
  ): Promise<Bundle<T>> {
    return this.search<T>(resourceType, params);
  }

  // Batch Operations
  async executeBatch(request: any): Promise<Bundle> {
    const responses: any[] = [];

    for (const entry of request.resources || []) {
      try {
        let response;
        if (request.type === 'transaction') {
          // For transactions, all operations must succeed
          response = await this.createResource(entry);
        } else {
          // For batches, individual operations can fail
          response = await this.createResource(entry);
        }
        responses.push({
          resource: response,
          response: {
            status: '201 Created',
            location: `${entry.resourceType}/${response.id}`
          }
        });
      } catch (error) {
        responses.push({
          response: {
            status: '400 Bad Request',
            outcome: MedplumMockData.createOperationOutcome('error', error instanceof Error ? error.message : 'Unknown error')
          }
        });
      }
    }

    return {
      resourceType: 'Bundle',
      type: `${request.type}-response`,
      entry: responses
    } as Bundle;
  }

  // Validation
  validateResource(resource: Resource): Promise<OperationOutcome> {
    // Perform basic validation
    const issues: any[] = [];

    if (!resource.resourceType) {
      issues.push({
        severity: 'error',
        code: 'required',
        diagnostics: 'Resource must have a resourceType',
        expression: ['resourceType']
      });
    }

    // Resource-specific validation
    if (resource.resourceType === 'Patient') {
      const patient = resource;
      if (!patient.name || patient.name.length === 0) {
        issues.push({
          severity: 'error',
          code: 'required',
          diagnostics: 'Patient must have at least one name',
          expression: ['Patient.name']
        });
      }
    }

    return {
      resourceType: 'OperationOutcome',
      issue: issues
    };
  }

  // Utility methods
  getCapabilityStatement(): Promise<CapabilityStatement> {
    return MedplumMockData.createCapabilityStatement();
  }

  getHealthStatus(): Promise<any> {
    return {
      status: 'UP',
      details: {
        initialized: true,
        connected: true,
        version: '3.0.0'
      }
    };
  }

  // Reset for testing
  reset(): void {
    this.resources.clear();
    this.resources.set('Patient', new Map());
    this.resources.set('Practitioner', new Map());
    this.resources.set('Encounter', new Map());
    this.resources.set('Observation', new Map());
    this.resources.set('MedicationRequest', new Map());
    this.nextId = 1;
  }
}

// Create singleton instance for tests
export const mockMedplumClient = new MockMedplumClient();

// Jest mock functions
export const createMedplumServiceMock = () => ({
  // Core FHIR operations
  createResource: jest.fn().mockImplementation((resource: Resource) => 
    mockMedplumClient.createResource(resource)
  ),
  readResource: jest.fn().mockImplementation((type: string, id: string) => 
    mockMedplumClient.readResource(type, id)
  ),
  updateResource: jest.fn().mockImplementation((resource: Resource) => 
    mockMedplumClient.updateResource(resource)
  ),
  deleteResource: jest.fn().mockImplementation((type: string, id: string) => 
    mockMedplumClient.deleteResource(type, id)
  ),
  searchResources: jest.fn().mockImplementation((type, params) => 
    mockMedplumClient.searchResources(type as string, params)
  ),
  search: jest.fn().mockImplementation((type, params) => 
    mockMedplumClient.search(type as string, params)
  ),

  // Batch operations
  executeBatch: jest.fn().mockImplementation((request) => 
    mockMedplumClient.executeBatch(request)
  ),

  // Validation
  validateResource: jest.fn().mockImplementation(async (resource) => 
    await mockMedplumClient.validateResource(resource as Resource)
  ),

  // Utility
  getCapabilityStatement: jest.fn().mockImplementation(() => 
    mockMedplumClient.getCapabilityStatement()
  ),
  getHealthStatus: jest.fn().mockImplementation(() => 
    mockMedplumClient.getHealthStatus()
  ),
  initialize: jest.fn().mockResolvedValue({}),

  // Test utilities
  reset: jest.fn().mockImplementation(() => mockMedplumClient.reset()),
});

export default createMedplumServiceMock;