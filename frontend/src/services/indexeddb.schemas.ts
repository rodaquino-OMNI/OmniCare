/**
 * IndexedDB Schema Definitions for FHIR Resources
 * Defines database structure and indexes for efficient querying
 */

import { Resource } from '@medplum/fhirtypes';
import { 
  getMergedObjectStores, 
  getMergedEncryptedFields, 
  getMergedRetentionPolicies,
  CLINICAL_OBJECT_STORES,
  CLINICAL_ENCRYPTED_FIELDS,
  CLINICAL_RETENTION_POLICIES
} from './indexeddb.clinical-schemas';

// Database configuration
export const DB_NAME = 'OmniCareOfflineDB';
export const DB_VERSION = 3; // Incremented for clinical workflow support

// Encryption metadata for tracking encrypted fields
export interface EncryptionMetadata {
  encryptedFields: string[];
  encryptionVersion: number;
  lastModified: number;
}

// Sync metadata for conflict resolution
export interface SyncMetadata {
  localVersion: number;
  serverVersion?: string;
  lastSyncTime?: number;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  conflictResolution?: 'local' | 'server' | 'merged';
  syncError?: string;
  resumeToken?: string;
  lastResumeTime?: number;
  partialData?: boolean;
}

// Resume metadata for interrupted operations
export interface ResumeMetadata {
  operationId: string;
  operationType: 'query' | 'sync' | 'cache' | 'batch';
  totalItems: number;
  processedItems: number;
  lastProcessedIndex: number;
  resumeToken: string;
  checkpointData: any;
  createdAt: number;
  lastResumeAt?: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
  errorMessage?: string;
}

// Base interface for all stored resources
export interface StoredResource<T extends Resource = Resource> {
  id: string;
  resourceType: string;
  resource: T;
  encrypted: boolean;
  encryptionMetadata?: EncryptionMetadata;
  syncMetadata: SyncMetadata;
  searchHashes?: Record<string, string>; // Hashed values for searching encrypted data
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // Soft delete
}

// Object store definitions
export interface ObjectStoreConfig {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  indexes: IndexConfig[];
  expirable?: boolean;
}

export interface IndexConfig {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry?: boolean;
}

// Define object stores for each FHIR resource type
export const OBJECT_STORES: ObjectStoreConfig[] = [
  // Core patient data
  {
    name: 'patients',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false },
      { name: 'identifier', keyPath: 'searchHashes.identifier', unique: false },
      { name: 'name', keyPath: 'searchHashes.name', unique: false },
      { name: 'birthDate', keyPath: 'resource.birthDate', unique: false },
      { name: 'gender', keyPath: 'resource.gender', unique: false }
    ]
  },

  // Encounters
  {
    name: 'encounters',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'period', keyPath: 'resource.period.start', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ],
    expirable: true
  },

  // Observations (vitals, lab results)
  {
    name: 'observations',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'encounter', keyPath: 'resource.encounter.reference', unique: false },
      { name: 'category', keyPath: 'resource.category[0].coding[0].code', unique: false },
      { name: 'code', keyPath: 'resource.code.coding[0].code', unique: false },
      { name: 'effectiveDate', keyPath: 'resource.effectiveDateTime', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ],
    expirable: true
  },

  // Medications
  {
    name: 'medicationRequests',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'intent', keyPath: 'resource.intent', unique: false },
      { name: 'authoredOn', keyPath: 'resource.authoredOn', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Conditions (diagnoses)
  {
    name: 'conditions',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'clinicalStatus', keyPath: 'resource.clinicalStatus.coding[0].code', unique: false },
      { name: 'verificationStatus', keyPath: 'resource.verificationStatus.coding[0].code', unique: false },
      { name: 'category', keyPath: 'resource.category[0].coding[0].code', unique: false },
      { name: 'code', keyPath: 'resource.code.coding[0].code', unique: false },
      { name: 'recordedDate', keyPath: 'resource.recordedDate', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Allergies
  {
    name: 'allergyIntolerances',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.patient.reference', unique: false },
      { name: 'clinicalStatus', keyPath: 'resource.clinicalStatus.coding[0].code', unique: false },
      { name: 'type', keyPath: 'resource.type', unique: false },
      { name: 'category', keyPath: 'resource.category', unique: false, multiEntry: true },
      { name: 'criticality', keyPath: 'resource.criticality', unique: false },
      { name: 'recordedDate', keyPath: 'resource.recordedDate', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Document references
  {
    name: 'documentReferences',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'encounter', keyPath: 'resource.context.encounter[0].reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'docStatus', keyPath: 'resource.docStatus', unique: false },
      { name: 'type', keyPath: 'resource.type.coding[0].code', unique: false },
      { name: 'category', keyPath: 'resource.category[0].coding[0].code', unique: false },
      { name: 'date', keyPath: 'resource.date', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ],
    expirable: true
  },

  // Diagnostic reports
  {
    name: 'diagnosticReports',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'encounter', keyPath: 'resource.encounter.reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'category', keyPath: 'resource.category[0].coding[0].code', unique: false },
      { name: 'code', keyPath: 'resource.code.coding[0].code', unique: false },
      { name: 'effectiveDate', keyPath: 'resource.effectiveDateTime', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ],
    expirable: true
  },

  // Care plans
  {
    name: 'carePlans',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'intent', keyPath: 'resource.intent', unique: false },
      { name: 'category', keyPath: 'resource.category[0].coding[0].code', unique: false },
      { name: 'period', keyPath: 'resource.period.start', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Immunizations
  {
    name: 'immunizations',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.patient.reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'vaccineCode', keyPath: 'resource.vaccineCode.coding[0].code', unique: false },
      { name: 'occurrenceDate', keyPath: 'resource.occurrenceDateTime', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Service requests (orders)
  {
    name: 'serviceRequests',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'patient', keyPath: 'resource.subject.reference', unique: false },
      { name: 'encounter', keyPath: 'resource.encounter.reference', unique: false },
      { name: 'status', keyPath: 'resource.status', unique: false },
      { name: 'intent', keyPath: 'resource.intent', unique: false },
      { name: 'priority', keyPath: 'resource.priority', unique: false },
      { name: 'category', keyPath: 'resource.category[0].coding[0].code', unique: false },
      { name: 'code', keyPath: 'resource.code.coding[0].code', unique: false },
      { name: 'authoredOn', keyPath: 'resource.authoredOn', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ],
    expirable: true
  },

  // Practitioners
  {
    name: 'practitioners',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'identifier', keyPath: 'searchHashes.identifier', unique: false },
      { name: 'name', keyPath: 'searchHashes.name', unique: false },
      { name: 'active', keyPath: 'resource.active', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Organizations
  {
    name: 'organizations',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'identifier', keyPath: 'searchHashes.identifier', unique: false },
      { name: 'name', keyPath: 'searchHashes.name', unique: false },
      { name: 'type', keyPath: 'resource.type[0].coding[0].code', unique: false },
      { name: 'active', keyPath: 'resource.active', unique: false },
      { name: 'syncStatus', keyPath: 'syncMetadata.syncStatus', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
    ]
  },

  // Sync queue for offline operations
  {
    name: 'syncQueue',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'resourceId', keyPath: 'resourceId', unique: false },
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'operation', keyPath: 'operation', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false }
    ]
  },

  // Metadata store for configuration
  {
    name: 'metadata',
    keyPath: 'key',
    autoIncrement: false,
    indexes: []
  },

  // Resume operations store for interrupted operations
  {
    name: 'resumeOperations',
    keyPath: 'operationId',
    autoIncrement: false,
    indexes: [
      { name: 'operationType', keyPath: 'operationType', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false },
      { name: 'lastResumeAt', keyPath: 'lastResumeAt', unique: false }
    ]
  },

  // Query resume states for large result sets
  {
    name: 'queryResumeStates',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'queryId', keyPath: 'queryId', unique: true },
      { name: 'resourceType', keyPath: 'resourceType', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false }
    ]
  }
];

// Fields that should be encrypted for each resource type
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Patient: ['name', 'telecom', 'address', 'contact', 'identifier'],
  Encounter: ['reasonCode', 'reasonReference'],
  Observation: ['note', 'valueString'],
  MedicationRequest: ['note', 'dosageInstruction'],
  Condition: ['note'],
  AllergyIntolerance: ['note'],
  DocumentReference: ['content', 'description'],
  DiagnosticReport: ['conclusion', 'conclusionCode'],
  CarePlan: ['note', 'description'],
  Immunization: ['note'],
  ServiceRequest: ['note', 'patientInstruction'],
  Practitioner: ['name', 'telecom', 'address', 'identifier'],
  Organization: ['name', 'telecom', 'address', 'identifier']
};

// Data retention policies (in days)
export const RETENTION_POLICIES: Record<string, number> = {
  encounters: 9,        // 9 days for encounters
  observations: 18,     // 18 days for observations
  documentReferences: 365, // 1 year for documents
  diagnosticReports: 365,  // 1 year for diagnostic reports
  serviceRequests: 3,     // 3 days for service requests
  // Permanent storage (no expiration)
  patients: 0,
  conditions: 0,
  allergyIntolerances: 0,
  medicationRequests: 0,
  immunizations: 0,
  carePlans: 0,
  practitioners: 0,
  organizations: 0
};

// Sync queue operation types
export interface SyncQueueEntry {
  id?: number;
  resourceId: string;
  resourceType: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'paused';
  attempts: number;
  lastAttempt?: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
  resumeToken?: string;
  checkpointData?: any;
  batchId?: string;
  batchIndex?: number;
  totalBatchSize?: number;
}

// Query resume state for large result sets
export interface QueryResumeState {
  id?: number;
  queryId: string;
  resourceType: string;
  filters: Record<string, any>;
  totalCount?: number;
  processedCount: number;
  lastOffset: number;
  resumeToken: string;
  batchSize: number;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  lastResumeAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

// Export merged configurations with clinical workflow support
export const ALL_OBJECT_STORES = getMergedObjectStores(OBJECT_STORES);
export const ALL_ENCRYPTED_FIELDS = getMergedEncryptedFields(ENCRYPTED_FIELDS);
export const ALL_RETENTION_POLICIES = getMergedRetentionPolicies(RETENTION_POLICIES);