/**
 * Zustand store for Clinical Note component state management
 * Coordinates state between all 8 specialized components
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { 
  ClinicalNoteState, 
  ClinicalNoteActions, 
  ClinicalNote, 
  NoteMetadata,
  PatientContext 
} from '@/components/clinical/types/clinical-note.types';
import { 
  offlineNotesService, 
  OfflineNote, 
  OfflineAttachment, 
  ConflictResolution 
} from '@/services/offline-notes.service';
import { DocumentReference } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import { getErrorMessage, getDisplayErrorMessage } from '@/utils/error.utils';
import { formatDate } from '@/utils';
import { useMedplum } from '@medplum/react';
import { useAuth } from '@/stores/auth';
import { createReference } from '@medplum/core';

interface ClinicalNoteStore extends ClinicalNoteState, ClinicalNoteActions {}

const initialState: ClinicalNoteState = {
  // Current note data
  currentNote: null,
  noteTitle: '',
  noteContent: '',
  noteType: 'progress',
  noteStatus: 'draft',
  noteTags: [],
  
  // Metadata
  metadata: null,
  
  // Attachments
  attachments: [],
  
  // Offline state
  offlineNote: null,
  isOnline: navigator.onLine,
  isSyncing: false,
  conflictedNotes: [],
  
  // UI state
  loading: false,
  error: null,
  activeTab: 'compose',
  hasUnsavedChanges: false,
  lastSaved: null,
  
  // History
  existingNotes: [],
  selectedHistoryNote: null,
  
  // Modals
  showSignModal: false,
  showConflictModal: false,
  showRecoveryModal: false,
  draftRecoveryOptions: []
};

export const useClinicalNoteStore = create<ClinicalNoteStore>()(
  immer((set, get) => ({
    ...initialState,
    
    // Note management
    setNoteTitle: (title: string) => set((state) => {
      state.noteTitle = title;
      state.hasUnsavedChanges = true;
    }),
    
    setNoteContent: (content: string) => set((state) => {
      state.noteContent = content;
      state.hasUnsavedChanges = true;
    }),
    
    setNoteType: (type: string) => set((state) => {
      state.noteType = type;
      state.hasUnsavedChanges = true;
    }),
    
    setNoteStatus: (status: 'draft' | 'signed' | 'amended' | 'entered-in-error') => set((state) => {
      state.noteStatus = status;
      if (state.metadata) {
        state.metadata.status = status;
      }
    }),
    
    setNoteTags: (tags: string[]) => set((state) => {
      state.noteTags = tags;
      state.hasUnsavedChanges = true;
    }),
    
    // Metadata management
    updateMetadata: (metadata: Partial<NoteMetadata>) => set((state) => {
      if (state.metadata) {
        Object.assign(state.metadata, metadata);
      } else {
        state.metadata = metadata as NoteMetadata;
      }
    }),
    
    setLastSaved: (date: Date) => set((state) => {
      state.lastSaved = date;
      state.hasUnsavedChanges = false;
      if (state.metadata) {
        state.metadata.lastSaved = date;
        state.metadata.hasUnsavedChanges = false;
      }
    }),
    
    setHasUnsavedChanges: (hasChanges: boolean) => set((state) => {
      state.hasUnsavedChanges = hasChanges;
      if (state.metadata) {
        state.metadata.hasUnsavedChanges = hasChanges;
      }
    }),
    
    // Attachments
    addAttachment: (attachment: OfflineAttachment) => set((state) => {
      state.attachments.push(attachment);
      state.hasUnsavedChanges = true;
    }),
    
    removeAttachment: (attachmentId: string) => set((state) => {
      state.attachments = state.attachments.filter((a: OfflineAttachment) => a.id !== attachmentId);
      state.hasUnsavedChanges = true;
    }),
    
    setAttachments: (attachments: OfflineAttachment[]) => set((state) => {
      state.attachments = attachments;
    }),
    
    // Offline state
    setOfflineNote: (note: OfflineNote | null) => set((state) => {
      state.offlineNote = note;
    }),
    
    setIsOnline: (isOnline: boolean) => set((state) => {
      state.isOnline = isOnline;
    }),
    
    setIsSyncing: (isSyncing: boolean) => set((state) => {
      state.isSyncing = isSyncing;
    }),
    
    setConflictedNotes: (notes: OfflineNote[]) => set((state) => {
      state.conflictedNotes = notes;
    }),
    
    // UI state
    setLoading: (loading: boolean) => set((state) => {
      state.loading = loading;
    }),
    
    setError: (error: string | null) => set((state) => {
      state.error = error;
    }),
    
    setActiveTab: (tab: string) => set((state) => {
      state.activeTab = tab;
    }),
    
    // History
    setExistingNotes: (notes: DocumentReference[]) => set((state) => {
      state.existingNotes = notes;
    }),
    
    setSelectedHistoryNote: (note: DocumentReference | null) => set((state) => {
      state.selectedHistoryNote = note;
    }),
    
    // Modals
    setShowSignModal: (show: boolean) => set((state) => {
      state.showSignModal = show;
    }),
    
    setShowConflictModal: (show: boolean) => set((state) => {
      state.showConflictModal = show;
    }),
    
    setShowRecoveryModal: (show: boolean) => set((state) => {
      state.showRecoveryModal = show;
    }),
    
    setDraftRecoveryOptions: (options: OfflineNote[]) => set((state) => {
      state.draftRecoveryOptions = options;
    }),
    
    // Actions
    loadExistingNote: async (noteId: string) => {
      const state = get();
      try {
        state.setLoading(true);
        
        // In production, this would load from FHIR DocumentReference
        // For demo, we'll simulate loading
        const mockNote: ClinicalNote = {
          id: noteId,
          type: state.noteType as any,
          title: 'Progress Note - Follow-up Visit',
          content: 'Patient continues to improve...',
          status: 'draft',
          author: {
            id: 'current-user-id',
            name: 'Current User',
            role: 'Physician'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        set((state) => {
          state.currentNote = mockNote;
          state.noteTitle = mockNote.title;
          state.noteContent = mockNote.content;
          state.noteStatus = mockNote.status;
          state.noteTags = mockNote.tags || [];
        });
        
      } catch (err: unknown) {
        const errorMessage = getDisplayErrorMessage(err);
        state.setError(`Failed to load existing note: ${errorMessage}`);
        console.error('Error loading existing note:', err);
      } finally {
        state.setLoading(false);
      }
    },
    
    loadPatientNotes: async (patientId: string, encounterId?: string) => {
      try {
        // This would use medplum client in real implementation
        // For now, simulate with empty array
        set((state) => {
          state.existingNotes = [];
        });
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        console.error('Failed to load patient notes:', errorMessage, err);
        set((state) => {
          state.existingNotes = [];
        });
      }
    },
    
    saveNoteDraft: async () => {
      const state = get();
      if (!state.noteContent.trim()) {
        state.setError('Note content cannot be empty');
        return;
      }
      
      try {
        state.setLoading(true);
        state.setError(null);
        
        if (!state.isOnline) {
          // Save offline
          const noteData = {
            patientId: state.currentNote?.id || 'patient-id',
            encounterId: state.currentNote?.encounterReference,
            noteType: state.noteType,
            title: state.noteTitle,
            content: state.noteContent,
            tags: state.noteTags,
            attachments: state.attachments
          };
          
          let saved: OfflineNote;
          if (state.offlineNote) {
            saved = await offlineNotesService.updateNote(state.offlineNote.id, noteData);
          } else {
            saved = await offlineNotesService.saveNote(noteData);
          }
          
          set((state) => {
            state.offlineNote = saved;
            state.hasUnsavedChanges = false;
            state.lastSaved = new Date();
          });
          
          notifications.show({
            title: 'Note Saved Offline',
            message: 'Will sync when connection is restored',
            color: 'orange'
          });
        } else {
          // Online save would go here
          set((state) => {
            state.hasUnsavedChanges = false;
            state.lastSaved = new Date();
          });
          
          notifications.show({
            title: 'Note Saved',
            message: 'Note saved as draft',
            color: 'green'
          });
        }
      } catch (err: unknown) {
        const errorMessage = getDisplayErrorMessage(err);
        state.setError(`Failed to save note: ${errorMessage}`);
        notifications.show({
          title: 'Save Failed',
          message: errorMessage,
          color: 'red'
        });
      } finally {
        state.setLoading(false);
      }
    },
    
    signNote: async () => {
      const state = get();
      if (!state.noteContent.trim()) {
        state.setError('Cannot sign an empty note');
        return;
      }
      
      try {
        state.setLoading(true);
        
        // Implement signing logic here
        await state.saveNoteDraft();
        
        set((state) => {
          state.noteStatus = 'signed';
          state.showSignModal = false;
          if (state.metadata) {
            state.metadata.status = 'signed';
            state.metadata.signedAt = new Date().toISOString();
          }
        });
        
        notifications.show({
          title: 'Note Signed',
          message: 'Note has been signed and saved',
          color: 'green'
        });
        
      } catch (err: unknown) {
        const errorMessage = getDisplayErrorMessage(err);
        state.setError(`Failed to sign note: ${errorMessage}`);
      } finally {
        state.setLoading(false);
      }
    },
    
    syncOfflineNotes: async () => {
      const state = get();
      try {
        state.setIsSyncing(true);
        await offlineNotesService.syncNotes();
        
        // Check for conflicts
        const conflicts = await offlineNotesService.getConflictedNotes();
        if (conflicts.length > 0) {
          set((state) => {
            state.conflictedNotes = conflicts;
          });
          notifications.show({
            title: 'Sync Conflicts',
            message: `${conflicts.length} note(s) have conflicting changes`,
            color: 'yellow'
          });
        }
      } catch (error) {
        console.error('Sync failed:', error);
        notifications.show({
          title: 'Sync Failed',
          message: 'Failed to sync offline notes',
          color: 'red'
        });
      } finally {
        state.setIsSyncing(false);
      }
    },
    
    resolveConflict: async (resolution: ConflictResolution) => {
      const state = get();
      try {
        await offlineNotesService.resolveConflict(resolution);
        
        set((state) => {
          state.conflictedNotes = state.conflictedNotes.filter((n: OfflineNote) => n.id !== resolution.noteId);
          state.showConflictModal = false;
        });
        
        // Reload note if it was the current one
        if (state.offlineNote?.id === resolution.noteId) {
          const updated = await offlineNotesService.getNote(resolution.noteId);
          if (updated) {
            set((state) => {
              state.noteTitle = updated.title;
              state.noteContent = updated.content;
            });
          }
        }
        
        notifications.show({
          title: 'Conflict Resolved',
          message: 'Note conflict has been resolved',
          color: 'green'
        });
        
      } catch (error) {
        notifications.show({
          title: 'Conflict Resolution Failed',
          message: getErrorMessage(error),
          color: 'red'
        });
      }
    },
    
    recoverDraft: (draft: OfflineNote) => set((state) => {
      state.offlineNote = draft;
      state.noteTitle = draft.title;
      state.noteContent = draft.content;
      state.noteType = draft.noteType;
      state.noteTags = draft.tags || [];
      state.attachments = draft.attachments || [];
      state.showRecoveryModal = false;
      
      notifications.show({
        title: 'Draft Recovered',
        message: 'Your previous draft has been restored',
        color: 'green'
      });
    }),
    
    // Reset
    resetState: () => set(() => ({ ...initialState }))
  }))
);

// Helper hooks for specific component needs
export const useNoteComposer = () => {
  const store = useClinicalNoteStore();
  return {
    noteTitle: store.noteTitle,
    noteType: store.noteType,
    noteStatus: store.noteStatus,
    isOnline: store.isOnline,
    isSyncing: store.isSyncing,
    conflictedNotes: store.conflictedNotes,
    lastSaved: store.lastSaved,
    hasUnsavedChanges: store.hasUnsavedChanges,
    error: store.error,
    activeTab: store.activeTab,
    setNoteTitle: store.setNoteTitle,
    setNoteType: store.setNoteType,
    setActiveTab: store.setActiveTab,
    setError: store.setError
  };
};

export const useNoteEditor = () => {
  const store = useClinicalNoteStore();
  return {
    noteContent: store.noteContent,
    noteType: store.noteType,
    noteStatus: store.noteStatus,
    setNoteContent: store.setNoteContent,
    hasUnsavedChanges: store.hasUnsavedChanges
  };
};

export const useAttachmentManager = () => {
  const store = useClinicalNoteStore();
  return {
    attachments: store.attachments,
    noteStatus: store.noteStatus,
    offlineNote: store.offlineNote,
    addAttachment: store.addAttachment,
    removeAttachment: store.removeAttachment,
    setAttachments: store.setAttachments
  };
};

export const useNoteActions = () => {
  const store = useClinicalNoteStore();
  return {
    noteContent: store.noteContent,
    noteStatus: store.noteStatus,
    isOnline: store.isOnline,
    isSyncing: store.isSyncing,
    loading: store.loading,
    hasUnsavedChanges: store.hasUnsavedChanges,
    saveNoteDraft: store.saveNoteDraft,
    signNote: store.signNote,
    syncOfflineNotes: store.syncOfflineNotes,
    setShowSignModal: store.setShowSignModal
  };
};

export const useNoteHistory = () => {
  const store = useClinicalNoteStore();
  return {
    existingNotes: store.existingNotes,
    selectedHistoryNote: store.selectedHistoryNote,
    activeTab: store.activeTab,
    setSelectedHistoryNote: store.setSelectedHistoryNote,
    setActiveTab: store.setActiveTab,
    loadPatientNotes: store.loadPatientNotes
  };
};

export const useOfflineConflictResolver = () => {
  const store = useClinicalNoteStore();
  return {
    conflictedNotes: store.conflictedNotes,
    showConflictModal: store.showConflictModal,
    offlineNote: store.offlineNote,
    resolveConflict: store.resolveConflict,
    setShowConflictModal: store.setShowConflictModal
  };
};

export const useNoteMetadata = () => {
  const store = useClinicalNoteStore();
  return {
    metadata: store.metadata,
    noteTitle: store.noteTitle,
    noteContent: store.noteContent,
    showSignModal: store.showSignModal,
    isOnline: store.isOnline,
    conflictedNotes: store.conflictedNotes,
    signNote: store.signNote,
    setShowSignModal: store.setShowSignModal,
    setShowConflictModal: store.setShowConflictModal
  };
};