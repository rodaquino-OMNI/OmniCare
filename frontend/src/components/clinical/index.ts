/**
 * Clinical Note Components - Decomposed Architecture
 * Exports all 8 specialized components replacing the monolithic ClinicalNoteInput
 */

// Main orchestration component
export { NoteComposer } from './NoteComposer';
export { default as NoteComposerDefault } from './NoteComposer';

// Specialized components
export { NoteEditor } from './NoteEditor';
export { TemplateManager } from './TemplateManager';
export { AttachmentManager } from './AttachmentManager';
export { OfflineConflictResolver } from './OfflineConflictResolver';
export { NoteHistory } from './NoteHistory';
export { NoteActions } from './NoteActions';
export { NoteMetadata } from './NoteMetadata';

// Store and types
export { 
  useClinicalNoteStore,
  useNoteComposer,
  useNoteEditor,
  useAttachmentManager,
  useNoteActions,
  useNoteHistory,
  useOfflineConflictResolver,
  useNoteMetadata
} from '@/stores/clinical-note.store';

export type {
  ClinicalNote,
  NoteTemplate,
  PatientContext,
  NoteMetadata as NoteMetadataType,
  AttachmentData,
  ConflictData,
  NoteComposerProps,
  NoteEditorProps,
  TemplateManagerProps,
  AttachmentManagerProps,
  OfflineConflictResolverProps,
  NoteHistoryProps,
  NoteActionsProps,
  NoteMetadataProps,
  ClinicalNoteState,
  ClinicalNoteActions,
  NOTE_TYPES,
  getNoteTypeCode
} from './types/clinical-note.types';

// Backwards compatibility - deprecated
export { default as ClinicalNoteInput } from './ClinicalNoteInput.deprecated';