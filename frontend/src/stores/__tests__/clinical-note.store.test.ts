/**
 * Unit tests for Clinical Note Store
 */

import { act, renderHook } from '@testing-library/react';
import { useClinicalNoteStore } from '../clinical-note.store';
import { offlineNotesService } from '@/services/offline-notes.service';
import { notifications } from '@mantine/notifications';

// Mock dependencies
jest.mock('@/services/offline-notes.service');
jest.mock('@mantine/notifications');
jest.mock('@/utils/error.utils');
jest.mock('@/utils');

const mockOfflineNotesService = offlineNotesService as jest.Mocked<typeof offlineNotesService>;
const mockNotifications = notifications as jest.Mocked<typeof notifications>;

describe('ClinicalNoteStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useClinicalNoteStore());
    act(() => {
      result.current.resetState();
    });
    
    jest.clearAllMocks();
  });

  describe('Note Management', () => {
    it('should set note title and mark as unsaved', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setNoteTitle('New Note Title');
      });
      
      expect(result.current.noteTitle).toBe('New Note Title');
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should set note content and mark as unsaved', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setNoteContent('Test note content');
      });
      
      expect(result.current.noteContent).toBe('Test note content');
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should set note type and mark as unsaved', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setNoteType('consultation');
      });
      
      expect(result.current.noteType).toBe('consultation');
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should set note status and update metadata', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      // First set metadata
      act(() => {
        result.current.updateMetadata({
          author: { id: '1', name: 'Test User', role: 'Doctor' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'draft',
          hasUnsavedChanges: false
        });
      });
      
      act(() => {
        result.current.setNoteStatus('signed');
      });
      
      expect(result.current.noteStatus).toBe('signed');
      expect(result.current.metadata?.status).toBe('signed');
    });
  });

  describe('Metadata Management', () => {
    it('should update metadata correctly', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const metadata = {
        author: { id: '1', name: 'Test User', role: 'Doctor' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft' as const,
        hasUnsavedChanges: false
      };
      
      act(() => {
        result.current.updateMetadata(metadata);
      });
      
      expect(result.current.metadata).toEqual(metadata);
    });

    it('should set last saved and clear unsaved changes', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      // First set metadata
      act(() => {
        result.current.updateMetadata({
          author: { id: '1', name: 'Test User', role: 'Doctor' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'draft',
          hasUnsavedChanges: true
        });
      });
      
      const saveDate = new Date();
      
      act(() => {
        result.current.setLastSaved(saveDate);
      });
      
      expect(result.current.lastSaved).toBe(saveDate);
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.metadata?.hasUnsavedChanges).toBe(false);
    });
  });

  describe('Attachment Management', () => {
    it('should add attachment and mark as unsaved', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const attachment = {
        id: '1',
        title: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        data: 'base64data',
        createdAt: new Date().toISOString()
      };
      
      act(() => {
        result.current.addAttachment(attachment);
      });
      
      expect(result.current.attachments).toContain(attachment);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should remove attachment and mark as unsaved', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const attachment1 = {
        id: '1',
        title: 'test1.pdf',
        contentType: 'application/pdf',
        size: 1024,
        data: 'base64data1',
        createdAt: new Date().toISOString()
      };
      
      const attachment2 = {
        id: '2',
        title: 'test2.pdf',
        contentType: 'application/pdf',
        size: 2048,
        data: 'base64data2',
        createdAt: new Date().toISOString()
      };
      
      // Add attachments first
      act(() => {
        result.current.setAttachments([attachment1, attachment2]);
      });
      
      // Remove one attachment
      act(() => {
        result.current.removeAttachment('1');
      });
      
      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].id).toBe('2');
      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Offline State Management', () => {
    it('should set offline note', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const offlineNote = {
        id: 'offline-1',
        tempId: 'temp-1',
        patientId: 'patient-1',
        noteType: 'progress',
        title: 'Offline Note',
        content: 'Content',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        attachments: []
      } as any;
      
      act(() => {
        result.current.setOfflineNote(offlineNote);
      });
      
      expect(result.current.offlineNote).toBe(offlineNote);
    });

    it('should set online status', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setIsOnline(false);
      });
      
      expect(result.current.isOnline).toBe(false);
    });

    it('should set syncing status', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setIsSyncing(true);
      });
      
      expect(result.current.isSyncing).toBe(true);
    });
  });

  describe('UI State Management', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.loading).toBe(true);
    });

    it('should set error state', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setError('Test error message');
      });
      
      expect(result.current.error).toBe('Test error message');
    });

    it('should set active tab', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setActiveTab('preview');
      });
      
      expect(result.current.activeTab).toBe('preview');
    });

    it('should set modal states', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      act(() => {
        result.current.setShowSignModal(true);
        result.current.setShowConflictModal(true);
        result.current.setShowRecoveryModal(true);
      });
      
      expect(result.current.showSignModal).toBe(true);
      expect(result.current.showConflictModal).toBe(true);
      expect(result.current.showRecoveryModal).toBe(true);
    });
  });

  describe('Draft Recovery', () => {
    it('should recover draft and update state', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const draft = {
        id: 'draft-1',
        tempId: 'temp-1',
        patientId: 'patient-1',
        noteType: 'progress',
        title: 'Recovered Draft',
        content: 'Recovered content',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['tag1'],
        attachments: []
      } as any;
      
      act(() => {
        result.current.recoverDraft(draft);
      });
      
      expect(result.current.offlineNote).toBe(draft);
      expect(result.current.noteTitle).toBe('Recovered Draft');
      expect(result.current.noteContent).toBe('Recovered content');
      expect(result.current.noteType).toBe('progress');
      expect(result.current.noteTags).toEqual(['tag1']);
      expect(result.current.showRecoveryModal).toBe(false);
      expect(mockNotifications.show).toHaveBeenCalledWith({
        title: 'Draft Recovered',
        message: 'Your previous draft has been restored',
        color: 'green'
      });
    });
  });

  describe('Save Operations', () => {
    it('should handle save draft when content is empty', async () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      await act(async () => {
        await result.current.saveNoteDraft();
      });
      
      expect(result.current.error).toBe('Note content cannot be empty');
    });

    it('should save draft offline when offline', async () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const mockSavedNote = {
        id: 'saved-1',
        tempId: 'temp-1',
        patientId: 'patient-1',
        noteType: 'progress',
        title: 'Test Note',
        content: 'Test content',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        attachments: []
      } as any;
      
      mockOfflineNotesService.saveNote.mockResolvedValue(mockSavedNote);
      
      // Set up state
      act(() => {
        result.current.setIsOnline(false);
        result.current.setNoteContent('Test content');
        result.current.setNoteTitle('Test Note');
      });
      
      await act(async () => {
        await result.current.saveNoteDraft();
      });
      
      expect(mockOfflineNotesService.saveNote).toHaveBeenCalled();
      expect(result.current.offlineNote).toBe(mockSavedNote);
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(mockNotifications.show).toHaveBeenCalledWith({
        title: 'Note Saved Offline',
        message: 'Will sync when connection is restored',
        color: 'orange'
      });
    });

    it('should update existing draft offline when offline', async () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const existingNote = {
        id: 'existing-1',
        tempId: 'temp-1',
        patientId: 'patient-1',
        noteType: 'progress',
        title: 'Existing Note',
        content: 'Existing content',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        attachments: []
      } as any;
      
      const updatedNote = {
        ...existingNote,
        title: 'Updated Note',
        content: 'Updated content',
        updatedAt: new Date().toISOString()
      };
      
      mockOfflineNotesService.updateNote.mockResolvedValue(updatedNote);
      
      // Set up state with existing offline note
      act(() => {
        result.current.setIsOnline(false);
        result.current.setOfflineNote(existingNote);
        result.current.setNoteContent('Updated content');
        result.current.setNoteTitle('Updated Note');
      });
      
      await act(async () => {
        await result.current.saveNoteDraft();
      });
      
      expect(mockOfflineNotesService.updateNote).toHaveBeenCalledWith(existingNote.id, expect.any(Object));
      expect(result.current.offlineNote).toBe(updatedNote);
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(mockNotifications.show).toHaveBeenCalledWith({
        title: 'Note Saved Offline',
        message: 'Will sync when connection is restored',
        color: 'orange'
      });
    });
  });

  describe('Sync Operations', () => {
    it('should sync offline notes and handle conflicts', async () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const conflictedNote = {
        id: 'conflict-1',
        tempId: 'temp-1',
        patientId: 'patient-1',
        noteType: 'progress',
        title: 'Conflicted Note',
        content: 'Conflicted content',
        status: 'conflict',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        attachments: []
      } as any;
      
      mockOfflineNotesService.syncNotes.mockResolvedValue(undefined);
      mockOfflineNotesService.getConflictedNotes.mockResolvedValue([conflictedNote]);
      
      await act(async () => {
        await result.current.syncOfflineNotes();
      });
      
      expect(mockOfflineNotesService.syncNotes).toHaveBeenCalled();
      expect(mockOfflineNotesService.getConflictedNotes).toHaveBeenCalled();
      expect(result.current.conflictedNotes).toEqual([conflictedNote]);
      expect(mockNotifications.show).toHaveBeenCalledWith({
        title: 'Sync Conflicts',
        message: '1 note(s) have conflicting changes',
        color: 'yellow'
      });
    });

    it('should resolve conflicts', async () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      const conflictedNote = {
        id: 'conflict-1',
        tempId: 'temp-1',
        patientId: 'patient-1',
        noteType: 'progress',
        title: 'Conflicted Note',
        content: 'Conflicted content',
        status: 'conflict',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        attachments: []
      } as any;
      
      const resolution = {
        noteId: 'conflict-1',
        resolution: 'keepLocal' as const
      };
      
      mockOfflineNotesService.resolveConflict.mockResolvedValue(undefined);
      mockOfflineNotesService.getNote.mockResolvedValue(null);
      
      // Set up state
      act(() => {
        result.current.setConflictedNotes([conflictedNote]);
      });
      
      await act(async () => {
        await result.current.resolveConflict(resolution);
      });
      
      expect(mockOfflineNotesService.resolveConflict).toHaveBeenCalledWith(resolution);
      expect(result.current.conflictedNotes).toEqual([]);
      expect(result.current.showConflictModal).toBe(false);
      expect(mockNotifications.show).toHaveBeenCalledWith({
        title: 'Conflict Resolved',
        message: 'Note conflict has been resolved',
        color: 'green'
      });
    });
  });

  describe('Reset State', () => {
    it('should reset state to initial values', () => {
      const { result } = renderHook(() => useClinicalNoteStore());
      
      // Modify state
      act(() => {
        result.current.setNoteTitle('Modified Title');
        result.current.setNoteContent('Modified Content');
        result.current.setLoading(true);
        result.current.setError('Some error');
      });
      
      // Reset state
      act(() => {
        result.current.resetState();
      });
      
      expect(result.current.noteTitle).toBe('');
      expect(result.current.noteContent).toBe('');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });
});
