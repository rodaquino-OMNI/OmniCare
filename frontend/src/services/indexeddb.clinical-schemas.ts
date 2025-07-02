/**
 * Enhanced IndexedDB Schema Definitions for Clinical Workflows
 * Extends base schemas with offline-optimized structures for clinical documentation
 */

import { DocumentReference, Observation, ServiceRequest } from '@medplum/fhirtypes';
import { StoredResource, ObjectStoreConfig, EncryptionMetadata, SyncMetadata } from './indexeddb.schemas';

// Enhanced clinical note structure for offline support
export interface ClinicalNoteOfflineData {
  // Core note data
  noteId: string;
  patientId: string;
  encounterId?: string;
  practitionerId: string;
  
  // Note content
  noteType: 'progress' | 'consultation' | 'discharge' | 'nursing' | 'procedure';
  content: string;
  structuredData?: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: Record<string, string>;
    physicalExam?: Record<string, string>;
    assessment?: string;
    plan?: string;
  };
  
  // Attachments and templates
  attachmentIds?: string[];
  templateId?: string;
  templateVersion?: string;
  
  // Offline tracking
  offlineCreated: boolean;
  offlineModified: boolean;
  localVersion: number;
  deviceId: string;
  
  // Clinical context
  diagnoses?: Array<{
    code: string;
    system: string;
    display: string;
    primary?: boolean;
  }>;
  procedures?: Array<{
    code: string;
    system: string;
    display: string;
    status: string;
  }>;
  medications?: Array<{
    code: string;
    display: string;
    dosage?: string;
    route?: string;
  }>;
  
  // Voice and media
  voiceRecordingId?: string;
  voiceTranscription?: string;
  imageIds?: string[];
  
  // Workflow metadata
  status: 'draft' | 'in-progress' | 'completed' | 'signed' | 'amended';
  priority: 'routine' | 'urgent' | 'stat';
  confidentiality?: 'normal' | 'restricted' | 'very-restricted';
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  signedAt?: number;
  lastAccessedAt: number;
  
  // Collaboration
  collaborators?: Array<{
    practitionerId: string;
    role: string;
    addedAt: number;
  }>;
  
  // Smart features
  smartSuggestions?: Array<{
    type: 'diagnosis' | 'procedure' | 'medication' | 'lab';
    suggestion: string;
    confidence: number;
    accepted?: boolean;
  }>;
}

// Enhanced appointment structure for offline support
export interface AppointmentOfflineData {
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  locationId?: string;
  
  // Scheduling data
  startTime: number;
  endTime: number;
  duration: number;
  appointmentType: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow';
  
  // Offline modifications
  offlineModified: boolean;
  offlineCheckIn?: {
    timestamp: number;
    location: string;
    deviceId: string;
  };
  
  // Pre-visit data
  preVisitQuestionnaire?: {
    responses: Record<string, any>;
    completedAt?: number;
  };
  
  // Visit preparation
  reasonForVisit?: string;
  chiefComplaint?: string;
  preparationNotes?: string;
  
  // Linked resources
  previousEncounterIds?: string[];
  relatedNoteIds?: string[];
  orderIds?: string[];
  
  // Sync metadata
  syncMetadata: SyncMetadata;
  localVersion: number;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

// Offline attachment storage
export interface OfflineAttachment {
  id: string;
  noteId?: string;
  patientId: string;
  
  // File data
  filename: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer | string; // Binary data or base64
  thumbnail?: string; // Base64 thumbnail for images
  
  // Metadata
  category: 'image' | 'document' | 'audio' | 'video' | 'other';
  description?: string;
  tags?: string[];
  
  // Encryption
  encrypted: boolean;
  encryptionMetadata?: EncryptionMetadata;
  
  // Sync status
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadProgress?: number;
  uploadError?: string;
  remoteUrl?: string;
  
  // Timestamps
  createdAt: number;
  uploadedAt?: number;
  lastAccessedAt: number;
}

// Clinical workflow queue for complex operations
export interface ClinicalWorkflowQueue {
  id?: number;
  workflowType: 'note-sign' | 'order-submit' | 'result-review' | 'prescription-send';
  resourceId: string;
  resourceType: string;
  patientId: string;
  practitionerId: string;
  
  // Workflow data
  data: any;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Execution tracking
  attempts: number;
  maxAttempts: number;
  lastAttempt?: number;
  error?: string;
  
  // Dependencies
  dependsOn?: string[]; // Other workflow IDs
  blockedBy?: string[]; // Resource IDs that must sync first
  
  // Timestamps
  createdAt: number;
  scheduledFor?: number;
  completedAt?: number;
}

// Template storage for offline use
export interface ClinicalTemplate {
  id: string;
  name: string;
  category: 'progress-note' | 'consultation' | 'procedure' | 'discharge';
  specialty?: string;
  
  // Template content
  sections: Array<{
    id: string;
    title: string;
    type: 'text' | 'structured' | 'checklist' | 'table';
    required: boolean;
    content?: string;
    fields?: Array<{
      name: string;
      type: string;
      required: boolean;
      options?: string[];
    }>;
  }>;
  
  // Metadata
  version: string;
  active: boolean;
  tags?: string[];
  
  // Usage tracking
  usageCount: number;
  lastUsedAt?: number;
  averageCompletionTime?: number;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// Voice recording metadata
export interface VoiceRecording {
  id: string;
  noteId?: string;
  patientId: string;
  practitionerId: string;
  
  // Recording data
  duration: number;
  size: number;
  mimeType: string;
  data: ArrayBuffer; // Audio data
  
  // Transcription
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  transcription?: string;
  transcriptionConfidence?: number;
  transcriptionLanguage?: string;
  
  // Metadata
  recordingDevice?: string;
  recordingLocation?: string;
  isPartial?: boolean; // For chunked recordings
  chunkIndex?: number;
  totalChunks?: number;
  
  // Timestamps
  startedAt: number;
  endedAt: number;
  transcribedAt?: number;
}

// Additional object store configurations for clinical workflows
export const CLINICAL_OBJECT_STORES: ObjectStoreConfig[] = [
  // Clinical notes with enhanced indexing
  {
    name: 'clinicalNotes',
    keyPath: 'noteId',
    autoIncrement: false,
    indexes: [
      { name: 'patientId', keyPath: 'patientId', unique: false },
      { name: 'encounterId', keyPath: 'encounterId', unique: false },
      { name: 'practitionerId', keyPath: 'practitionerId', unique: false },
      { name: 'noteType', keyPath: 'noteType', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'priority', keyPath: 'priority', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false },
      { name: 'offlineCreated', keyPath: 'offlineCreated', unique: false },
      { name: 'patientDate', keyPath: ['patientId', 'createdAt'], unique: false },
      { name: 'practitionerDate', keyPath: ['practitionerId', 'createdAt'], unique: false }
    ]
  },
  
  // Appointment cache
  {
    name: 'appointments',
    keyPath: 'appointmentId',
    autoIncrement: false,
    indexes: [
      { name: 'patientId', keyPath: 'patientId', unique: false },
      { name: 'practitionerId', keyPath: 'practitionerId', unique: false },
      { name: 'startTime', keyPath: 'startTime', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'appointmentType', keyPath: 'appointmentType', unique: false },
      { name: 'patientDate', keyPath: ['patientId', 'startTime'], unique: false },
      { name: 'practitionerDate', keyPath: ['practitionerId', 'startTime'], unique: false }
    ]
  },
  
  // Offline attachments
  {
    name: 'offlineAttachments',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'noteId', keyPath: 'noteId', unique: false },
      { name: 'patientId', keyPath: 'patientId', unique: false },
      { name: 'category', keyPath: 'category', unique: false },
      { name: 'uploadStatus', keyPath: 'uploadStatus', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false }
    ]
  },
  
  // Clinical workflow queue
  {
    name: 'clinicalWorkflowQueue',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'workflowType', keyPath: 'workflowType', unique: false },
      { name: 'resourceId', keyPath: 'resourceId', unique: false },
      { name: 'patientId', keyPath: 'patientId', unique: false },
      { name: 'practitionerId', keyPath: 'practitionerId', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'priority', keyPath: 'priority', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false },
      { name: 'scheduledFor', keyPath: 'scheduledFor', unique: false }
    ]
  },
  
  // Clinical templates
  {
    name: 'clinicalTemplates',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'category', keyPath: 'category', unique: false },
      { name: 'specialty', keyPath: 'specialty', unique: false },
      { name: 'active', keyPath: 'active', unique: false },
      { name: 'usageCount', keyPath: 'usageCount', unique: false },
      { name: 'name', keyPath: 'name', unique: false }
    ]
  },
  
  // Voice recordings
  {
    name: 'voiceRecordings',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'noteId', keyPath: 'noteId', unique: false },
      { name: 'patientId', keyPath: 'patientId', unique: false },
      { name: 'practitionerId', keyPath: 'practitionerId', unique: false },
      { name: 'transcriptionStatus', keyPath: 'transcriptionStatus', unique: false },
      { name: 'startedAt', keyPath: 'startedAt', unique: false }
    ]
  }
];

// Enhanced encrypted fields for clinical data
export const CLINICAL_ENCRYPTED_FIELDS: Record<string, string[]> = {
  clinicalNotes: ['content', 'structuredData', 'voiceTranscription', 'smartSuggestions'],
  appointments: ['reasonForVisit', 'chiefComplaint', 'preparationNotes', 'preVisitQuestionnaire'],
  offlineAttachments: ['data', 'thumbnail', 'description'],
  voiceRecordings: ['data', 'transcription'],
  clinicalTemplates: ['sections']
};

// Clinical data retention policies (in days)
export const CLINICAL_RETENTION_POLICIES: Record<string, number> = {
  clinicalNotes: 0, // Permanent
  appointments: 30, // 30 days after appointment date
  offlineAttachments: 7, // 7 days after upload
  voiceRecordings: 3, // 3 days after transcription
  clinicalTemplates: 0, // Permanent
  clinicalWorkflowQueue: 7 // 7 days after completion
};

// Export helper to merge with base configurations
export function getMergedObjectStores(baseStores: ObjectStoreConfig[]): ObjectStoreConfig[] {
  return [...baseStores, ...CLINICAL_OBJECT_STORES];
}

export function getMergedEncryptedFields(baseFields: Record<string, string[]>): Record<string, string[]> {
  return { ...baseFields, ...CLINICAL_ENCRYPTED_FIELDS };
}

export function getMergedRetentionPolicies(basePolicies: Record<string, number>): Record<string, number> {
  return { ...basePolicies, ...CLINICAL_RETENTION_POLICIES };
}