import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClinicalNoteInput } from '../ClinicalNoteInput';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MedplumProvider } from '@medplum/react';
import { MockClient } from '@medplum/mock';
import { Patient } from '@medplum/fhirtypes';
import { offlineNotesService } from '@/services/offline-notes.service';
import { offlineSmartTextService } from '@/services/offline-smarttext.service';

// Mock the services
jest.mock('@/services/offline-notes.service');
jest.mock('@/services/offline-smarttext.service');
jest.mock('@/stores/auth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      role: 'Physician'
    }
  })
}));

describe('ClinicalNoteInput - Offline Functionality', () => {
  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'test-patient-id',
    name: [{
      given: ['John'],
      family: 'Doe'
    }],
    birthDate: '1980-01-01',
    gender: 'male'
  };

  const mockMedplum = new MockClient();
  const user = userEvent.setup();

  const renderComponent = (props = {}) => {
    return render(
      <MedplumProvider medplum={mockMedplum}>
        <MantineProvider>
          <Notifications />
          <ClinicalNoteInput
            patient={mockPatient}
            {...props}
          />
        </MantineProvider>
      </MedplumProvider>
    );
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (offlineNotesService.saveDraft as jest.Mock).mockResolvedValue({
      id: 'offline-note-id',
      tempId: 'temp-123',
      title: 'Test Note',
      content: 'Test content',
      status: 'draft',
      patientId: 'test-patient-id',
      practitionerId: 'test-user-id',
      practitionerName: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    });

    (offlineNotesService.recoverDrafts as jest.Mock).mockResolvedValue([]);
    (offlineSmartTextService.getTemplates as jest.Mock).mockResolvedValue([]);
    (offlineSmartTextService.getAllMacros as jest.Mock).mockReturnValue([]);
  });

  describe('Offline Mode Detection', () => {
    it('should display offline indicator when offline', async () => {
      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      renderComponent();

      // Check for offline badge
      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });

      // Check for offline notification
      expect(screen.getByText('Working Offline')).toBeInTheDocument();
    });

    it('should handle online/offline transitions', async () => {
      const { rerender } = renderComponent();

      // Start online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      // Trigger offline event
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      // Trigger online event
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Offline')).not.toBeInTheDocument();
      });
    });
  });

  describe('Draft Management', () => {
    it('should auto-save drafts when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      renderComponent();

      // Type in the note
      const textarea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(textarea, 'This is a test note content');

      // Wait for auto-save (mocked to trigger faster)
      await waitFor(() => {
        expect(offlineNotesService.saveDraft).toHaveBeenCalledWith(
          expect.objectContaining({
            patientId: 'test-patient-id',
            content: expect.stringContaining('This is a test note content')
          })
        );
      }, { timeout: 15000 });
    });

    it('should show draft recovery modal when drafts exist', async () => {
      const mockDrafts = [
        {
          id: 'draft-1',
          title: 'Previous Draft',
          content: 'Previous content',
          status: 'draft',
          updatedAt: new Date().toISOString()
        }
      ];

      (offlineNotesService.recoverDrafts as jest.Mock).mockResolvedValue(mockDrafts);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Recover Previous Drafts')).toBeInTheDocument();
        expect(screen.getByText('Previous Draft')).toBeInTheDocument();
      });
    });

    it('should recover selected draft', async () => {
      const mockDraft = {
        id: 'draft-1',
        title: 'Previous Draft',
        content: 'Previous content',
        status: 'draft',
        updatedAt: new Date().toISOString(),
        tags: ['urgent']
      };

      (offlineNotesService.recoverDrafts as jest.Mock).mockResolvedValue([mockDraft]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Previous Draft')).toBeInTheDocument();
      });

      // Click on the draft to recover it
      await user.click(screen.getByText('Previous Draft'));

      // Check if the content was loaded
      const textarea = screen.getByPlaceholderText(/begin your progress note/i);
      await waitFor(() => {
        expect(textarea).toHaveValue('Previous content');
      });
    });
  });

  describe('Offline Save Operations', () => {
    it('should save note offline when network is unavailable', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      renderComponent();

      // Fill in note details
      const titleInput = screen.getByLabelText('Note Title');
      const textarea = screen.getByPlaceholderText(/begin your progress note/i);

      await user.type(titleInput, 'Offline Test Note');
      await user.type(textarea, 'This note was created offline');

      // Click save draft
      const saveButton = screen.getByText('Save Draft (Offline)');
      await user.click(saveButton);

      await waitFor(() => {
        expect(offlineNotesService.saveDraft).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Offline Test Note',
            content: 'This note was created offline',
            patientId: 'test-patient-id'
          })
        );
      });
    });

    it('should handle attachment uploads offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      (offlineNotesService.addAttachment as jest.Mock).mockResolvedValue({
        id: 'attachment-1',
        contentType: 'image/png',
        data: 'base64data',
        title: 'test.png',
        size: 1024,
        createdAt: new Date().toISOString()
      });

      renderComponent();

      // Create a test file
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      // Find and click the attach files button
      const attachButton = screen.getByText('Attach Files');
      
      // Simulate file upload
      const input = attachButton.parentElement?.querySelector('input[type="file"]');
      if (input) {
        await user.upload(input as HTMLInputElement, file);
      }

      await waitFor(() => {
        expect(screen.getByText('test.png')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Operations', () => {
    it('should show sync button when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      renderComponent();

      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });

    it('should trigger sync when clicking sync button', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      (offlineNotesService.syncOfflineNotes as jest.Mock).mockResolvedValue(undefined);

      renderComponent();

      const syncButton = screen.getByText('Sync Now');
      await user.click(syncButton);

      await waitFor(() => {
        expect(offlineNotesService.syncOfflineNotes).toHaveBeenCalled();
      });
    });

    it('should display syncing indicator during sync', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      // Mock a slow sync operation
      (offlineNotesService.syncOfflineNotes as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderComponent();

      // Trigger sync
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // Should show syncing badge
      await waitFor(() => {
        expect(screen.getByText('Syncing')).toBeInTheDocument();
      });
    });
  });

  describe('Conflict Resolution', () => {
    it('should display conflict indicator when conflicts exist', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          title: 'Conflicted Note',
          content: 'Local content',
          status: 'conflict',
          conflictData: {
            serverNote: {
              resourceType: 'DocumentReference',
              description: 'Server version',
              content: [{
                attachment: {
                  data: btoa('Server content')
                }
              }]
            },
            localChanges: {},
            conflictedAt: new Date().toISOString()
          }
        }
      ];

      (offlineNotesService.getConflictedNotes as jest.Mock).mockResolvedValue(mockConflicts);

      renderComponent();

      // Trigger online event to check conflicts
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByText('1 Conflicts')).toBeInTheDocument();
      });
    });

    it('should show conflict resolution modal', async () => {
      const mockConflict = {
        id: 'conflict-1',
        title: 'Conflicted Note',
        content: 'Local content version',
        updatedAt: new Date().toISOString(),
        status: 'conflict',
        conflictData: {
          serverNote: {
            resourceType: 'DocumentReference',
            description: 'Server version',
            meta: {
              lastUpdated: new Date().toISOString()
            },
            content: [{
              attachment: {
                data: btoa('Server content version')
              }
            }]
          },
          localChanges: {},
          conflictedAt: new Date().toISOString()
        }
      };

      (offlineNotesService.getConflictedNotes as jest.Mock).mockResolvedValue([mockConflict]);

      renderComponent();

      // Trigger conflict check
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // Click on conflicts badge
      await waitFor(async () => {
        const conflictBadge = screen.getByText('1 Conflicts');
        await user.click(conflictBadge);
      });

      // Check modal content
      expect(screen.getByText('Resolve Sync Conflicts')).toBeInTheDocument();
      expect(screen.getByText('Conflicted Note')).toBeInTheDocument();

      // Click on the conflict to see details
      await user.click(screen.getByText('Conflicted Note'));

      // Should show both versions
      expect(screen.getByText('Local Version (Your Changes)')).toBeInTheDocument();
      expect(screen.getByText('Server Version')).toBeInTheDocument();
      expect(screen.getByText('Keep My Version')).toBeInTheDocument();
      expect(screen.getByText('Keep Server Version')).toBeInTheDocument();
    });

    it('should resolve conflict by keeping local version', async () => {
      const mockConflict = {
        id: 'conflict-1',
        title: 'Conflicted Note',
        content: 'Local content',
        updatedAt: new Date().toISOString(),
        status: 'conflict',
        conflictData: {
          serverNote: {
            resourceType: 'DocumentReference',
            content: [{
              attachment: { data: btoa('Server content') }
            }]
          },
          conflictedAt: new Date().toISOString()
        }
      };

      (offlineNotesService.getConflictedNotes as jest.Mock).mockResolvedValue([mockConflict]);
      (offlineNotesService.resolveConflict as jest.Mock).mockResolvedValue(undefined);

      renderComponent();

      // Open conflict modal
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(async () => {
        const conflictBadge = screen.getByText('1 Conflicts');
        await user.click(conflictBadge);
      });

      await user.click(screen.getByText('Conflicted Note'));

      // Choose to keep local version
      await user.click(screen.getByText('Keep My Version'));

      await waitFor(() => {
        expect(offlineNotesService.resolveConflict).toHaveBeenCalledWith({
          noteId: 'conflict-1',
          resolution: 'keepLocal'
        });
      });
    });
  });

  describe('SmartText Offline Features', () => {
    it('should show AI suggestions when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      (offlineSmartTextService.getContextualSuggestions as jest.Mock).mockResolvedValue([
        'Consider age-related factors',
        'Monitor vital signs closely'
      ]);

      renderComponent();

      const textarea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(textarea, 'ASSESSMENT:');

      await waitFor(() => {
        expect(screen.getByText('Suggestions')).toBeInTheDocument();
        expect(screen.getByText('Consider age-related factors')).toBeInTheDocument();
      });
    });

    it('should apply smart text macros offline', async () => {
      const mockMacros = [
        {
          trigger: '.bp',
          expansion: 'Blood pressure: ___/___ mmHg',
          category: 'vitals'
        }
      ];

      (offlineSmartTextService.getAllMacros as jest.Mock).mockReturnValue(mockMacros);

      renderComponent();

      const textarea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(textarea, '.bp');

      // Should show macro suggestion
      await waitFor(() => {
        expect(screen.getByText('.bp')).toBeInTheDocument();
        expect(screen.getByText('Blood pressure: ___/___ mmHg')).toBeInTheDocument();
      });
    });
  });
});