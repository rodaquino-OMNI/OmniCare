/**
 * NoteComposer - Main composition interface and orchestration
 * Coordinates all clinical note components and manages overall state
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  Select, 
  TextInput,
  Card,
  Badge,
  Alert,
  Tabs,
  LoadingOverlay
} from '@mantine/core';
import { 
  IconNotes,
  IconEdit,
  IconEye,
  IconHistory,
  IconAlertCircle,
  IconWifiOff,
  IconCloudOff,
  IconCloudCheck
} from '@tabler/icons-react';
import { Loader } from '@mantine/core';
import { Patient } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';

import { 
  NoteComposerProps,
  NOTE_TYPES,
  PatientContext
} from './types/clinical-note.types';
import { 
  useClinicalNoteStore,
  useNoteComposer
} from '@/stores/clinical-note.store';
import { useAuth } from '@/stores/auth';
import { formatDateTime } from '@/utils';
import { offlineNotesService } from '@/services/offline-notes.service';

import { NoteEditor } from './NoteEditor';
import { NoteActions } from './NoteActions';
import { NoteHistory } from './NoteHistory';
import { NoteMetadata } from './NoteMetadata';
import { OfflineConflictResolver } from './OfflineConflictResolver';

export function NoteComposer({
  patient,
  encounterId,
  noteId,
  noteType = 'progress',
  onSave,
  onCancel,
  showHistory = true
}: NoteComposerProps) {
  const { user } = useAuth();
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Store hooks
  const {
    noteTitle,
    noteType: storeNoteType,
    noteStatus,
    isOnline,
    isSyncing,
    conflictedNotes,
    lastSaved,
    hasUnsavedChanges,
    error,
    activeTab,
    setNoteTitle,
    setNoteType,
    setActiveTab,
    setError
  } = useNoteComposer();
  
  const store = useClinicalNoteStore();
  
  // Initialize note type and metadata
  useEffect(() => {
    if (noteType !== storeNoteType) {
      setNoteType(noteType);
    }
    
    if (user && !store.metadata) {
      store.updateMetadata({
        author: {
          id: user.id || '',
          name: `${user.firstName} ${user.lastName}`,
          role: user.role || ''
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        hasUnsavedChanges: false
      });
    }
  }, [noteType, storeNoteType, user, store]);
  
  // Setup online/offline listeners and auto-save
  useEffect(() => {
    const handleOnline = () => {
      store.setIsOnline(true);
      store.syncOfflineNotes();
    };
    const handleOffline = () => {
      store.setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for draft recovery on mount
    checkDraftRecovery();

    if (noteId) {
      store.loadExistingNote(noteId);
    }
    if (showHistory) {
      store.loadPatientNotes(patient.id || '', encounterId);
    }
    generateDefaultTitle();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [noteId, patient.id, storeNoteType, store, showHistory, encounterId]);

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    if (hasUnsavedChanges && store.noteContent.trim()) {
      autoSaveTimer.current = setTimeout(() => {
        autoSave();
      }, isOnline ? 30000 : 10000); // Faster auto-save when offline
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [store.noteContent, noteTitle, storeNoteType, isOnline, hasUnsavedChanges, store]);

  const generateDefaultTitle = () => {
    if (!noteTitle || noteTitle.includes('New')) {
      const noteTypeLabel = NOTE_TYPES.find(nt => nt.value === storeNoteType)?.label || 'Clinical Note';
      const timestamp = new Date().toLocaleDateString();
      setNoteTitle(`${noteTypeLabel} - ${timestamp}`);
    }
  };

  const checkDraftRecovery = async () => {
    try {
      const drafts = await offlineNotesService.recoverDrafts(patient.id || '');
      if (drafts.length > 0) {
        store.setDraftRecoveryOptions(drafts);
        store.setShowRecoveryModal(true);
      }
    } catch (error) {
      console.error('Failed to check draft recovery:', error);
    }
  };

  const autoSave = async () => {
    try {
      if (!isOnline) {
        // Save offline
        if (store.offlineNote) {
          await offlineNotesService.updateDraft(store.offlineNote.id, {
            title: noteTitle,
            content: store.noteContent,
            tags: store.noteTags,
            patientId: patient.id || '',
            encounterId,
            noteType: storeNoteType,
            attachments: store.attachments
          });
        } else {
          const saved = await offlineNotesService.saveDraft({
            patientId: patient.id || '',
            encounterId,
            noteType: storeNoteType,
            title: noteTitle,
            content: store.noteContent,
            tags: store.noteTags,
            attachments: store.attachments
          });
          store.setOfflineNote(saved);
        }
        
        store.setLastSaved(new Date());
        
        notifications.show({
          title: 'Auto-saved Offline',
          message: 'Note saved locally',
          color: 'orange',
          icon: <IconCloudOff size={16} />,
          autoClose: 2000
        });
      } else {
        // Auto-save online
        await store.saveNoteDraft();
      }
    } catch (err: unknown) {
      console.error('Auto-save failed:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'green';
      case 'draft': return 'blue';
      case 'amended': return 'orange';
      case 'entered-in-error': return 'red';
      case 'syncing': return 'yellow';
      case 'conflict': return 'orange';
      default: return 'gray';
    }
  };

  const patientContext: PatientContext = {
    patientId: patient.id || '',
    encounterId,
    visitType: storeNoteType,
    age: patient.birthDate ? 
      new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : undefined,
    gender: patient.gender
  };

  return (
    <Stack gap="md">
      <LoadingOverlay visible={store.loading} overlayProps={{ radius: 'sm', blur: 2 }} />
      
      {/* Header */}
      <Card shadow="sm" padding="md" withBorder>
        <Group justify="space-between" align="flex-start">
          <div className="flex-1">
            <Group gap="md" mb="sm">
              <IconNotes size={24} className="text-blue-600" />
              <div>
                <Text fw={600} size="lg">Clinical Documentation</Text>
                <Text size="sm" c="dimmed">
                  Patient: {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
                </Text>
              </div>
            </Group>
            
            <Group gap="lg">
              <Select
                label="Note Type"
                data={NOTE_TYPES}
                value={storeNoteType}
                onChange={(value) => value && setNoteType(value)}
                size="sm"
                style={{ minWidth: 150 }}
              />
              
              <TextInput
                label="Note Title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.currentTarget.value)}
                size="sm"
                style={{ flex: 1, minWidth: 200 }}
              />
            </Group>
          </div>
          
          <Group gap="sm">
            <Badge 
              color={getStatusColor(store.offlineNote?.status || noteStatus)}
              variant="light"
            >
              {(store.offlineNote?.status || noteStatus).toUpperCase()}
            </Badge>
            
            {!isOnline && (
              <Badge 
                color="orange" 
                variant="light"
                leftSection={<IconWifiOff size={14} />}
              >
                Offline
              </Badge>
            )}
            
            {isSyncing && (
              <Badge 
                color="blue" 
                variant="light"
                leftSection={<Loader size={14} color="blue" />}
              >
                Syncing
              </Badge>
            )}
            
            {conflictedNotes.length > 0 && (
              <Badge 
                color="yellow" 
                variant="filled"
                className="cursor-pointer"
                onClick={() => store.setShowConflictModal(true)}
              >
                {conflictedNotes.length} Conflicts
              </Badge>
            )}
            
            {lastSaved && (
              <Text size="xs" c="dimmed">
                Last saved: {formatDateTime(lastSaved)}
              </Text>
            )}
            
            {hasUnsavedChanges && (
              <Badge color="orange" size="sm">
                Unsaved Changes
              </Badge>
            )}
          </Group>
        </Group>
      </Card>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
        <Tabs.List>
          <Tabs.Tab value="compose" leftSection={<IconEdit size={16} />}>
            Compose
          </Tabs.Tab>
          <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
            Preview
          </Tabs.Tab>
          {showHistory && (
            <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
              History ({store.existingNotes?.length || 0})
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="compose" pt="md">
          <NoteEditor
            value={store.noteContent}
            onChange={store.setNoteContent}
            noteType={storeNoteType}
            patientContext={patientContext}
            disabled={noteStatus === 'signed'}
            placeholder={`Begin your ${NOTE_TYPES.find(nt => nt.value === storeNoteType)?.label.toLowerCase()}...`}
            minRows={8}
            maxRows={25}
            showTemplates={true}
            showAISuggestions={!isOnline}
          />
        </Tabs.Panel>

        <Tabs.Panel value="preview" pt="md">
          <Card shadow="sm" padding="lg" withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={600} size="lg">{noteTitle}</Text>
                  <Text size="sm" c="dimmed">
                    {user?.firstName} {user?.lastName} ({user?.role}) • {formatDateTime(new Date())}
                  </Text>
                </div>
              </Group>
              
              <div className="border-t pt-4">
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {store.noteContent || 'No content to preview'}
                </div>
              </div>
            </Stack>
          </Card>
        </Tabs.Panel>

        {showHistory && (
          <Tabs.Panel value="history" pt="md">
            <NoteHistory
              patient={patient}
              encounterId={encounterId}
              notes={store.existingNotes}
              onNoteSelect={store.setSelectedHistoryNote}
              loading={store.loading}
            />
          </Tabs.Panel>
        )}
      </Tabs>

      {/* Action Buttons */}
      <NoteActions
        noteContent={store.noteContent}
        noteStatus={noteStatus}
        isOnline={isOnline}
        isSyncing={isSyncing}
        loading={store.loading}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveDraft={store.saveNoteDraft}
        onSignNote={() => store.setShowSignModal(true)}
        onCancel={onCancel}
        onSync={store.syncOfflineNotes}
      />

      {/* Metadata and Modals */}
      <NoteMetadata
        metadata={store.metadata!}
        noteTitle={noteTitle}
        noteContent={store.noteContent}
        isSignModalOpen={store.showSignModal}
        onSignConfirm={store.signNote}
        onSignCancel={() => store.setShowSignModal(false)}
        isOnline={isOnline}
        conflictCount={conflictedNotes.length}
        onConflictsClick={() => store.setShowConflictModal(true)}
      />

      {/* Conflict Resolution */}
      <OfflineConflictResolver
        conflicts={conflictedNotes}
        onResolveConflict={store.resolveConflict}
        onClose={() => store.setShowConflictModal(false)}
        isOpen={store.showConflictModal}
      />

      {/* Draft Recovery Modal */}
      {store.showRecoveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4" shadow="lg">
            <Stack gap="md">
              <Text fw={600} size="lg">Recover Previous Drafts</Text>
              <Alert icon={<IconCloudOff size={16} />} color="blue">
                We found {store.draftRecoveryOptions.length} unsaved draft(s) for this patient.
              </Alert>
              
              <Stack gap="sm">
                {store.draftRecoveryOptions.map(draft => (
                  <Card
                    key={draft.id}
                    p="md"
                    withBorder
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => store.recoverDraft(draft)}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text fw={500} size="sm">{draft.title}</Text>
                      <Badge size="xs" color={getStatusColor(draft.status)}>
                        {draft.status}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mb="xs">
                      Last updated: {formatDateTime(draft.updatedAt)}
                    </Text>
                    <Text size="sm" lineClamp={2}>
                      {draft.content}
                    </Text>
                  </Card>
                ))}
              </Stack>
              
              <Group justify="flex-end">
                <button 
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={() => store.setShowRecoveryModal(false)}
                >
                  Start Fresh
                </button>
              </Group>
            </Stack>
          </Card>
        </div>
      )}
      
      {/* Offline Notification */}
      {!isOnline && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert
            icon={<IconCloudOff />}
            color="orange"
            title="Working Offline"
            className="max-w-sm"
          >
            Your notes are being saved locally and will sync when you're back online.
          </Alert>
        </div>
      )}
    </Stack>
  );
}

export default NoteComposer;