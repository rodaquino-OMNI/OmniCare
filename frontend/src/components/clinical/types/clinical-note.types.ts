/**
 * Shared TypeScript interfaces for Clinical Note components
 * Provides type safety and contracts for component communication
 */

import { Patient, DocumentReference, Reference } from '@medplum/fhirtypes';
import { OfflineNote, OfflineAttachment, ConflictResolution } from '@/services/offline-notes.service';

export interface ClinicalNote {
  id: string;
  type: 'progress' | 'admission' | 'discharge' | 'procedure' | 'consultation' | 'nursing';
  title: string;
  content: string;
  status: 'draft' | 'signed' | 'amended' | 'entered-in-error';
  author: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  encounterReference?: string;
  tags?: string[];
  offlineId?: string;
  isSynced?: boolean;
}

export interface NoteTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  category: 'progress' | 'admission' | 'discharge' | 'procedure' | 'consultation' | 'nursing';
  tags?: string[];
}

export interface PatientContext {
  patientId: string;
  encounterId?: string;
  visitType: string;
  age?: number;
  gender?: string;
}

export interface NoteMetadata {
  author: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
  version?: number;
  status: 'draft' | 'signed' | 'amended' | 'entered-in-error';
}

export interface AttachmentData {
  id: string;
  title: string;
  contentType: string;
  size: number;
  data?: string;
  createdAt: string;
}

export interface ConflictData {
  noteId: string;
  localVersion: OfflineNote;
  serverVersion: DocumentReference;
  conflictedAt: string;
  conflictType: 'content' | 'metadata' | 'both';
}

// Component Props Interfaces
export interface NoteComposerProps {
  patient: Patient;
  encounterId?: string;
  noteId?: string;
  noteType?: string;
  onSave?: (note: ClinicalNote) => void;
  onCancel?: () => void;
  showHistory?: boolean;
}

export interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  noteType: string;
  patientContext: PatientContext;
  disabled?: boolean;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  showTemplates?: boolean;
  showAISuggestions?: boolean;
}

export interface TemplateManagerProps {
  noteType: string;
  onTemplateSelect: (template: NoteTemplate) => void;
  onTemplateInsert: (content: string) => void;
  patientContext?: PatientContext;
}

export interface AttachmentManagerProps {
  attachments: OfflineAttachment[];
  onAttachmentsChange: (attachments: OfflineAttachment[]) => void;
  disabled?: boolean;
  acceptedTypes?: string;
  maxFiles?: number;
  maxSize?: number;
}

export interface OfflineConflictResolverProps {
  conflicts: OfflineNote[];
  onResolveConflict: (resolution: ConflictResolution) => void;
  onClose: () => void;
  isOpen: boolean;
}

export interface NoteHistoryProps {
  patient: Patient;
  encounterId?: string;
  notes: DocumentReference[];
  onNoteSelect: (note: DocumentReference) => void;
  onLoadMore?: () => void;
  loading?: boolean;
}

export interface NoteActionsProps {
  noteContent: string;
  noteStatus: 'draft' | 'signed' | 'amended' | 'entered-in-error';
  isOnline: boolean;
  isSyncing: boolean;
  loading: boolean;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onSignNote: () => void;
  onCancel?: () => void;
  onSync?: () => void;
}

export interface NoteMetadataProps {
  metadata: NoteMetadata;
  noteTitle: string;
  noteContent: string;
  isSignModalOpen: boolean;
  onSignConfirm: () => void;
  onSignCancel: () => void;
  isOnline: boolean;
  conflictCount?: number;
  onConflictsClick?: () => void;
}

// Store State Interface
export interface ClinicalNoteState {
  // Current note data
  currentNote: Partial<ClinicalNote> | null;
  noteTitle: string;
  noteContent: string;
  noteType: string;
  noteStatus: 'draft' | 'signed' | 'amended' | 'entered-in-error';
  noteTags: string[];
  
  // Metadata
  metadata: NoteMetadata | null;
  
  // Attachments
  attachments: OfflineAttachment[];
  
  // Offline state
  offlineNote: OfflineNote | null;
  isOnline: boolean;
  isSyncing: boolean;
  conflictedNotes: OfflineNote[];
  
  // UI state
  loading: boolean;
  error: string | null;
  activeTab: string;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  
  // History
  existingNotes: DocumentReference[];
  selectedHistoryNote: DocumentReference | null;
  
  // Modals
  showSignModal: boolean;
  showConflictModal: boolean;
  showRecoveryModal: boolean;
  draftRecoveryOptions: OfflineNote[];
}

// Store Actions Interface
export interface ClinicalNoteActions {
  // Note management
  setNoteTitle: (title: string) => void;
  setNoteContent: (content: string) => void;
  setNoteType: (type: string) => void;
  setNoteStatus: (status: 'draft' | 'signed' | 'amended' | 'entered-in-error') => void;
  setNoteTags: (tags: string[]) => void;
  
  // Metadata management
  updateMetadata: (metadata: Partial<NoteMetadata>) => void;
  setLastSaved: (date: Date) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Attachments
  addAttachment: (attachment: OfflineAttachment) => void;
  removeAttachment: (attachmentId: string) => void;
  setAttachments: (attachments: OfflineAttachment[]) => void;
  
  // Offline state
  setOfflineNote: (note: OfflineNote | null) => void;
  setIsOnline: (isOnline: boolean) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setConflictedNotes: (notes: OfflineNote[]) => void;
  
  // UI state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: string) => void;
  
  // History
  setExistingNotes: (notes: DocumentReference[]) => void;
  setSelectedHistoryNote: (note: DocumentReference | null) => void;
  
  // Modals
  setShowSignModal: (show: boolean) => void;
  setShowConflictModal: (show: boolean) => void;
  setShowRecoveryModal: (show: boolean) => void;
  setDraftRecoveryOptions: (options: OfflineNote[]) => void;
  
  // Actions
  loadExistingNote: (noteId: string) => Promise<void>;
  loadPatientNotes: (patientId: string, encounterId?: string) => Promise<void>;
  saveNoteDraft: () => Promise<void>;
  signNote: () => Promise<void>;
  syncOfflineNotes: () => Promise<void>;
  resolveConflict: (resolution: ConflictResolution) => Promise<void>;
  recoverDraft: (draft: OfflineNote) => void;
  
  // Reset
  resetState: () => void;
}

export const NOTE_TYPES = [
  { value: 'progress', label: 'Progress Note' },
  { value: 'admission', label: 'Admission Note' },
  { value: 'discharge', label: 'Discharge Summary' },
  { value: 'procedure', label: 'Procedure Note' },
  { value: 'consultation', label: 'Consultation Note' },
  { value: 'nursing', label: 'Nursing Note' }
] as const;

export const getNoteTypeCode = (noteType: string): string => {
  const noteTypeCodes: Record<string, string> = {
    'progress': '11506-3',
    'admission': '18842-5',
    'discharge': '18842-5',
    'procedure': '28570-0',
    'consultation': '11488-4',
    'nursing': '34815-3'
  };
  return noteTypeCodes[noteType] || '11506-3';
};