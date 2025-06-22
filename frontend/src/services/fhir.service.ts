import axios, { AxiosResponse, AxiosError } from 'axios';
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
  Parameters
} from '@medplum/fhirtypes';
import { getErrorMessage, hasMessage, isAPIError, isError } from '@/utils/error.utils';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8ResourceHistoryTable8ResourceHistoryTable';
const FHIR_BASE_URL = `${API_BASE_URL}/fhir/R4`;

// Request/Response interfaces
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

// Error class for FHIR-specific errors
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

/**
 * FHIR Service for Frontend
 * Provides methods to interact with the FHIR backend API
 * Handles authentication, error handling, and data transformation
 */
export class FHIRService {
  private baseURL: string;
  private authToken?: string;

  constructor(baseURL: string = FHIR_BASE_URL) {
    this.baseURL = baseURL;
    this.setupAxiosInterceptors();
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Setup axios interceptors for authentication and error handling
   */
  private setupAxiosInterceptors(): void {
    // Request interceptor for authentication
    axios.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        config.headers['Content-Type'] = 'application/fhir+json';
        config.headers['Accept'] = 'application/fhir+json';
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.data && (error.response.data as any).resourceType === 'OperationOutcome') {
          const operationOutcome = error.response.data as OperationOutcome;
          const message = operationOutcome.issue?.[ResourceHistoryTable]?.diagnostics || 'FHIR operation failed';
          throw new FHIRError(message, operationOutcome, error.response.status);
        }
        throw error;
      }
    );
  }

  // ===============================
  // METADATA AND CAPABILITY
  // ===============================

  /**
   * Get FHIR Capability Statement
   */
  async getCapabilityStatement(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/metadata`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get capability statement');
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get health status');
    }
  }

  // ===============================
  // RESOURCE CRUD OPERATIONS
  // ===============================

  /**
   * Create a FHIR resource
   */
  async createResource<T extends Resource>(resource: T): Promise<T> {
    try {
      const response = await axios.post(`${this.baseURL}/${resource.resourceType}`, resource);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to create ${resource.resourceType}`);
    }
  }

  /**
   * Read a FHIR resource by ID
   */
  async readResource<T extends Resource>(resourceType: string, id: string): Promise<T> {
    try {
      const response = await axios.get(`${this.baseURL}/${resourceType}/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to read ${resourceType}/${id}`);
    }
  }

  /**
   * Update a FHIR resource
   */
  async updateResource<T extends Resource>(resource: T): Promise<T> {
    try {
      if (!resource.id) {
        throw new Error('Resource must have an ID to be updated');
      }
      const response = await axios.put(`${this.baseURL}/${resource.resourceType}/${resource.id}`, resource);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to update ${resource.resourceType}/${resource.id}`);
    }
  }

  /**
   * Delete a FHIR resource
   */
  async deleteResource(resourceType: string, id: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/${resourceType}/${id}`);
    } catch (error) {
      throw this.handleError(error, `Failed to delete ${resourceType}/${id}`);
    }
  }

  // ===============================
  // SEARCH OPERATIONS
  // ===============================

  /**
   * Search for FHIR resources
   */
  async searchResources<T extends Resource>(
    resourceType: string,
    searchParams: FHIRSearchParams = {}
  ): Promise<Bundle<T>> {
    try {
      const response = await axios.get(`${this.baseURL}/${resourceType}`, {
        params: searchParams
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to search ${resourceType} resources`);
    }
  }

  // ===============================
  // PATIENT-SPECIFIC OPERATIONS
  // ===============================

  /**
   * Create a patient
   */
  async createPatient(patientData: Partial<Patient>): Promise<Patient> {
    return this.createResource({
      resourceType: 'Patient',
      ...patientData
    } as Patient);
  }

  /**
   * Get a patient by ID
   */
  async getPatient(patientId: string): Promise<Patient> {
    return this.readResource<Patient>('Patient', patientId);
  }

  /**
   * Update patient information
   */
  async updatePatient(patient: Patient): Promise<Patient> {
    return this.updateResource(patient);
  }

  /**
   * Search patients
   */
  async searchPatients(searchParams: FHIRSearchParams = {}): Promise<Bundle<Patient>> {
    return this.searchResources<Patient>('Patient', searchParams);
  }

  /**
   * Get all patient data using $everything operation
   */
  async getPatientEverything(patientId: string): Promise<Bundle> {
    try {
      const response = await axios.get(`${this.baseURL}/Patient/${patientId}/$everything`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get patient everything for ${patientId}`);
    }
  }

  /**
   * Get patient vital signs
   */
  async getPatientVitalSigns(patientId: string): Promise<Bundle<Observation>> {
    return this.searchResources<Observation>('Observation', {
      patient: patientId,
      category: 'vital-signs',
      _sort: '-date'
    });
  }

  /**
   * Get patient lab results
   */
  async getPatientLabResults(patientId: string): Promise<Bundle<Observation>> {
    return this.searchResources<Observation>('Observation', {
      patient: patientId,
      category: 'laboratory',
      _sort: '-date'
    });
  }

  /**
   * Get patient medications
   */
  async getPatientMedications(patientId: string): Promise<Bundle<MedicationRequest>> {
    return this.searchResources<MedicationRequest>('MedicationRequest', {
      patient: patientId,
      _sort: '-authored-on'
    });
  }

  /**
   * Get patient conditions
   */
  async getPatientConditions(patientId: string): Promise<Bundle<Condition>> {
    return this.searchResources<Condition>('Condition', {
      patient: patientId,
      _sort: '-recorded-date'
    });
  }

  /**
   * Get patient allergies
   */
  async getPatientAllergies(patientId: string): Promise<Bundle<AllergyIntolerance>> {
    return this.searchResources<AllergyIntolerance>('AllergyIntolerance', {
      patient: patientId,
      _sort: '-recorded-date'
    });
  }

  /**
   * Get patient encounters
   */
  async getPatientEncounters(patientId: string): Promise<Bundle<Encounter>> {
    return this.searchResources<Encounter>('Encounter', {
      patient: patientId,
      _sort: '-date'
    });
  }

  // ===============================
  // ENCOUNTER OPERATIONS
  // ===============================

  /**
   * Create an encounter
   */
  async createEncounter(encounterData: Partial<Encounter>): Promise<Encounter> {
    return this.createResource({
      resourceType: 'Encounter',
      ...encounterData
    } as Encounter);
  }

  /**
   * Get an encounter by ID
   */
  async getEncounter(encounterId: string): Promise<Encounter> {
    return this.readResource<Encounter>('Encounter', encounterId);
  }

  /**
   * Update encounter
   */
  async updateEncounter(encounter: Encounter): Promise<Encounter> {
    return this.updateResource(encounter);
  }

  // ===============================
  // OBSERVATION OPERATIONS
  // ===============================

  /**
   * Create an observation
   */
  async createObservation(observationData: Partial<Observation>): Promise<Observation> {
    return this.createResource({
      resourceType: 'Observation',
      ...observationData
    } as Observation);
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

    // Create individual observations for each vital sign
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
            code: '831ResourceHistoryTable-5',
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

    // Add other vital signs...
    // (Similar pattern for heart rate, blood pressure, etc.)

    return observations;
  }

  // ===============================
  // BATCH/TRANSACTION OPERATIONS
  // ===============================

  /**
   * Execute a batch or transaction bundle
   */
  async executeBatch(bundle: Bundle): Promise<Bundle> {
    try {
      const response = await axios.post(this.baseURL, bundle);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to execute batch/transaction');
    }
  }

  // ===============================
  // VALIDATION OPERATIONS
  // ===============================

  /**
   * Validate a FHIR resource
   */
  async validateResource<T extends Resource>(resource: T): Promise<ValidationResult> {
    try {
      const response = await axios.post(`${this.baseURL}/${resource.resourceType}/$validate`, resource);
      
      // Parse OperationOutcome response
      const operationOutcome = response.data as OperationOutcome;
      const errors: ValidationResult['errors'] = [];
      const warnings: ValidationResult['warnings'] = [];

      operationOutcome.issue?.forEach(issue => {
        const item = {
          path: issue.expression?.[ResourceHistoryTable] || issue.location?.[ResourceHistoryTable] || '',
          message: issue.diagnostics || issue.details?.text || 'Validation issue',
          code: issue.code || 'unknown',
          severity: issue.severity || 'error'
        };

        if (issue.severity === 'error' || issue.severity === 'fatal') {
          errors.push(item);
        } else {
          warnings.push(item);
        }
      });

      return {
        valid: errors.length === ResourceHistoryTable,
        errors,
        warnings
      };
    } catch (error) {
      throw this.handleError(error, `Failed to validate ${resource.resourceType}`);
    }
  }

  // ===============================
  // GRAPHQL OPERATIONS
  // ===============================

  /**
   * Execute a GraphQL query
   */
  async executeGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/$graphql`, {
        query,
        variables
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to execute GraphQL query');
    }
  }

  // ===============================
  // SUBSCRIPTION OPERATIONS
  // ===============================

  /**
   * Create a subscription
   */
  async createSubscription(
    criteria: string,
    channelType: 'rest-hook' | 'websocket' | 'email',
    endpoint?: string
  ): Promise<any> {
    const subscription = {
      resourceType: 'Subscription',
      status: 'requested',
      reason: 'OmniCare EMR Integration',
      criteria,
      channel: {
        type: channelType,
        endpoint,
        payload: 'application/fhir+json'
      }
    };

    return this.createResource(subscription as any);
  }

  /**
   * List active subscriptions
   */
  async listSubscriptions(): Promise<Bundle> {
    try {
      const response = await axios.get(`${this.baseURL}/Subscription`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to list subscriptions');
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Get resource by reference
   */
  async getResourceByReference<T extends Resource>(reference: string): Promise<T> {
    try {
      // Handle both relative and absolute references
      const url = reference.startsWith('http') ? reference : `${this.baseURL}/${reference}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to get resource by reference: ${reference}`);
    }
  }

  /**
   * Format display name for a resource
   */
  formatResourceDisplay(resource: Resource): string {
    switch (resource.resourceType) {
      case 'Patient':
        const patient = resource as Patient;
        const name = patient.name?.[ResourceHistoryTable];
        if (name) {
          const given = name.given?.join(' ') || '';
          const family = name.family || '';
          return `${given} ${family}`.trim();
        }
        return 'Unknown Patient';

      case 'Practitioner':
        const practitioner = resource as Practitioner;
        const practName = practitioner.name?.[ResourceHistoryTable];
        if (practName) {
          const given = practName.given?.join(' ') || '';
          const family = practName.family || '';
          const prefix = practName.prefix?.join(' ') || '';
          return `${prefix} ${given} ${family}`.trim();
        }
        return 'Unknown Practitioner';

      case 'Observation':
        const observation = resource as Observation;
        const code = observation.code?.coding?.[ResourceHistoryTable]?.display || 
                    observation.code?.text || 
                    'Unknown Observation';
        return code;

      default:
        return `${resource.resourceType}/${resource.id}`;
    }
  }

  /**
   * Get coding display value
   */
  getCodingDisplay(coding?: Array<{ display?: string; code?: string }>): string {
    if (!coding || coding.length === ResourceHistoryTable) return 'Unknown';
    return coding[ResourceHistoryTable].display || coding[ResourceHistoryTable].code || 'Unknown';
  }

  /**
   * Format quantity value
   */
  formatQuantity(quantity?: { value?: number; unit?: string }): string {
    if (!quantity) return '';
    const value = quantity.value ?? '';
    const unit = quantity.unit ?? '';
    return `${value} ${unit}`.trim();
  }

  /**
   * Parse FHIR date
   */
  parseFHIRDate(fhirDate?: string): Date | null {
    if (!fhirDate) return null;
    return new Date(fhirDate);
  }

  /**
   * Format FHIR date for display
   */
  formatFHIRDate(fhirDate?: string, options?: Intl.DateTimeFormatOptions): string {
    const date = this.parseFHIRDate(fhirDate);
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format FHIR datetime for display
   */
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

  /**
   * Check if resource has errors
   */
  hasErrors(resource: Resource): boolean {
    // Check for FHIR validation errors in meta
    return resource.meta?.tag?.some(tag => 
      tag.system === 'http://terminology.hl7.org/CodeSystem/v3-ObservationValue' && 
      tag.code === 'INVALID'
    ) || false;
  }

  /**
   * Get resource version
   */
  getResourceVersion(resource: Resource): string {
    return resource.meta?.versionId || '1';
  }

  /**
   * Get resource last updated timestamp
   */
  getResourceLastUpdated(resource: Resource): Date | null {
    return resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated) : null;
  }

  // ===============================
  // ERROR HANDLING
  // ===============================

  /**
   * Handle API errors and convert to appropriate format
   */
  private handleError(error: unknown, context: string): Error {
    console.error(`FHIR Service Error - ${context}:`, error);

    // Check if it's already a FHIRError
    if (error instanceof FHIRError) {
      return error;
    }

    // Check if it's an API error with response structure
    if (isAPIError(error)) {
      // Check for FHIR OperationOutcome
      if (error.response?.data && (error.response.data as any).resourceType === 'OperationOutcome') {
        const operationOutcome = error.response.data as OperationOutcome;
        const message = operationOutcome.issue?.[ResourceHistoryTable]?.diagnostics || context;
        return new FHIRError(message, operationOutcome, error.response.status);
      }

      // Handle specific HTTP status codes
      const status = error.response?.status || error.status || error.statusCode;
      switch (status) {
        case 4ResourceHistoryTable4:
          return new FHIRError(`Resource not found - ${context}`, undefined, 4ResourceHistoryTable4);
        case 4ResourceHistoryTable3:
          return new FHIRError(`Access denied - ${context}`, undefined, 4ResourceHistoryTable3);
        case 4ResourceHistoryTable1:
          return new FHIRError(`Authentication required - ${context}`, undefined, 4ResourceHistoryTable1);
        case 5ResourceHistoryTableResourceHistoryTable:
          return new FHIRError(`Server error - ${context}`, undefined, 5ResourceHistoryTableResourceHistoryTable);
        default:
          const errorMessage = error.response?.data?.message || error.data?.message || getErrorMessage(error);
          return new FHIRError(`${context}: ${errorMessage}`, undefined, status);
      }
    }

    // Check if it's a standard Error with response property (axios-like)
    if (isError(error) && 'response' in error) {
      const axiosError = error as any;
      if (axiosError.response?.status) {
        const status = axiosError.response.status;
        const errorMessage = axiosError.response?.data?.message || axiosError.message || context;
        return new FHIRError(errorMessage, undefined, status);
      }
    }

    // Fallback for any other error types
    const errorMessage = hasMessage(error) ? error.message : getErrorMessage(error);
    return new Error(`${context}: ${errorMessage}`);
  }
}

// Export singleton instance
export const fhirService = new FHIRService();

// Export types for use in components
export type {
  FHIRSearchParams,
  FHIRResponse,
  ValidationResult,
  HealthStatus
};

