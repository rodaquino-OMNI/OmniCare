'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  Select, 
  TextInput,
  Card,
  Badge,
  Button,
  ActionIcon,
  Menu,
  Divider,
  Alert,
  Tabs,
  Paper,
  Textarea,
  Modal,
  ScrollArea,
  Loader,
  FileButton,
  List,
  ThemeIcon,
  UnstyledButton,
  Notification,
  LoadingOverlay
} from '@mantine/core';
import { 
  IconNotes,
  IconDeviceFloppy,
  IconTemplate,
  IconClock,
  IconUser,
  IconStethoscope,
  IconEye,
  IconEdit,
  IconTrash,
  IconCopy,
  IconPrinter,
  IconShare,
  IconHistory,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconCloudOff,
  IconCloudCheck,
  IconRefresh,
  IconUpload,
  IconFile,
  IconMerge,
  IconDatabaseOff,
  IconWifi,
  IconWifiOff
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { 
  DocumentEditor,
  Document,
  NoteDisplay,
  useMedplum
} from '@medplum/react';
import { SmartText } from './SmartText';
import { useAuth } from '@/stores/auth';
import { 
  Patient, 
  DocumentReference, 
  Reference,
  CodeableConcept,
  Identifier
} from '@medplum/fhirtypes';
import { formatDateTime, formatDate } from '@/utils';
import { getErrorMessage, getDisplayErrorMessage } from '@/utils/error.utils';
import { createReference } from '@medplum/core';
import { 
  offlineNotesService, 
  OfflineNote, 
  OfflineAttachment,
  ConflictResolution 
} from '@/services/offline-notes.service';

interface ClinicalNote {
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

interface ClinicalNoteInputProps {
  patient: Patient;
  encounterId?: string;
  noteId?: string; // For editing existing notes
  noteType?: string;
  onSave?: (note: ClinicalNote) => void;
  onCancel?: () => void;
  showHistory?: boolean;
}

const NOTE_TYPES = [
  { value: 'progress', label: 'Progress Note' },
  { value: 'admission', label: 'Admission Note' },
  { value: 'discharge', label: 'Discharge Summary' },
  { value: 'procedure', label: 'Procedure Note' },
  { value: 'consultation', label: 'Consultation Note' },
  { value: 'nursing', label: 'Nursing Note' }
];

// Helper function to get LOINC code for note type
const getNoteTypeCode = (noteType: string): string => {
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

export function ClinicalNoteInput({
  patient,
  encounterId,
  noteId,
  noteType = 'progress',
  onSave,
  onCancel,
  showHistory = true
}: ClinicalNoteInputProps) {
  const { user } = useAuth();
  const medplum = useMedplum();
  const [activeTab, setActiveTab] = useState('compose');
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Note composition state
  const [selectedNoteType, setSelectedNoteType] = useState(noteType);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState<'draft' | 'signed' | 'amended' | 'entered-in-error'>('draft');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
  
  // Offline state
  const [offlineNote, setOfflineNote] = useState<OfflineNote | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [conflictedNotes, setConflictedNotes] = useState<OfflineNote[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<OfflineNote | null>(null);
  const [draftRecoveryOptions, setDraftRecoveryOptions] = useState<OfflineNote[]>([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [attachments, setAttachments] = useState<OfflineAttachment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [existingNotes, setExistingNotes] = useState<DocumentReference[]>([]);
  const [selectedHistoryNote, setSelectedHistoryNote] = useState<DocumentReference | null>(null);

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    // Setup online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineNotes();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for draft recovery on mount
    checkDraftRecovery();

    if (noteId) {
      loadExistingNote();
    }
    if (showHistory) {
      loadPatientNotes();
    }
    generateDefaultTitle();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [noteId, patient.id, selectedNoteType]);

  useEffect(() => {
    setHasUnsavedChanges(true);
    
    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    // Auto-save after 10 seconds of inactivity for offline mode
    autoSaveTimer.current = setTimeout(() => {
      if (noteContent.trim() && hasUnsavedChanges) {
        autoSave();
      }
    }, isOnline ? 30000 : 10000); // Faster auto-save when offline

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [noteContent, noteTitle, selectedNoteType, isOnline]);

  const loadExistingNote = async () => {
    try {
      setLoading(true);
      // In production, this would load from FHIR DocumentReference
      // For demo, we'll simulate loading
      const mockNote: ClinicalNote = {
        id: noteId!,
        type: selectedNoteType as any,
        title: 'Progress Note - Follow-up Visit',
        content: 'Patient continues to improve...',
        status: 'draft',
        author: {
          id: user?.id || '',
          name: `${user?.firstName} ${user?.lastName}`,
          role: user?.role || ''
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        encounterReference: encounterId
      };
      
      setNoteTitle(mockNote.title);
      setNoteContent(mockNote.content);
      setNoteStatus(mockNote.status);
      setNoteTags(mockNote.tags || []);
    } catch (err: unknown) {
      const errorMessage = getDisplayErrorMessage(err);
      setError(`Failed to load existing note: ${errorMessage}`);
      console.error('Error loading existing note:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientNotes = async () => {
    try {
      // Load actual FHIR DocumentReference resources
      const searchParams: Record<string, string> = {
        patient: patient.id || '',
        _sort: '-date',
        _count: '10'
      };
      
      if (encounterId) {
        searchParams['encounter'] = encounterId;
      }
      
      const notes = await medplum.searchResources('DocumentReference', searchParams);
      setExistingNotes(notes);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      console.error('Failed to load patient notes:', errorMessage, err);
      // Fall back to empty array if loading fails
      setExistingNotes([]);
    }
  };

  const generateDefaultTitle = () => {
    if (!noteTitle || noteTitle.includes('New')) {
      const noteTypeLabel = NOTE_TYPES.find(nt => nt.value === selectedNoteType)?.label || 'Clinical Note';
      const timestamp = formatDate(new Date());
      setNoteTitle(`${noteTypeLabel} - ${timestamp}`);
    }
  };

  const checkDraftRecovery = async () => {
    try {
      const drafts = await offlineNotesService.recoverDrafts(patient.id || '');
      if (drafts.length > 0) {
        setDraftRecoveryOptions(drafts);
        setShowRecoveryModal(true);
      }
    } catch (error) {
      console.error('Failed to check draft recovery:', error);
    }
  };

  const recoverDraft = (draft: OfflineNote) => {
    setOfflineNote(draft);
    setNoteTitle(draft.title);
    setNoteContent(draft.content);
    setSelectedNoteType(draft.noteType);
    setNoteTags(draft.tags || []);
    setAttachments(draft.attachments || []);
    setShowRecoveryModal(false);
    
    notifications.show({
      title: 'Draft Recovered',
      message: 'Your previous draft has been restored',
      color: 'green'
    });
  };

  const syncOfflineNotes = async () => {
    try {
      setIsSyncing(true);
      await offlineNotesService.syncOfflineNotes();
      
      // Check for conflicts
      const conflicts = await offlineNotesService.getConflictedNotes();
      if (conflicts.length > 0) {
        setConflictedNotes(conflicts);
        notifications.show({
          title: 'Sync Conflicts',
          message: `${conflicts.length} note(s) have conflicting changes`,
          color: 'yellow'
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const autoSave = async () => {
    try {
      if (!isOnline) {
        // Save offline
        if (offlineNote) {
          await offlineNotesService.updateDraft(offlineNote.id, {
            title: noteTitle,
            content: noteContent,
            tags: noteTags
          });
        } else {
          const saved = await offlineNotesService.saveDraft({
            patientId: patient.id || '',
            encounterId,
            noteType: selectedNoteType,
            title: noteTitle,
            content: noteContent,
            tags: noteTags,
            attachments
          });
          setOfflineNote(saved);
        }
        
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        
        notifications.show({
          title: 'Auto-saved Offline',
          message: 'Note saved locally',
          color: 'orange',
          icon: <IconCloudOff size={16} />
        });
      } else {
        // Auto-save online as before
        await saveNote('draft');
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        
        notifications.show({
          title: 'Auto-saved',
          message: 'Note saved as draft',
          color: 'blue',
          autoClose: 2000
        });
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      console.error('Auto-save failed:', errorMessage, err);
    }
  };

  const saveNote = async (status: 'draft' | 'signed' = 'draft') => {
    if (!noteContent.trim()) {
      setError('Note content cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!isOnline) {
        // Save offline
        const noteData = {
          patientId: patient.id || '',
          encounterId,
          noteType: selectedNoteType,
          title: noteTitle,
          content: noteContent,
          tags: noteTags,
          attachments
        };

        let saved: OfflineNote;
        if (offlineNote) {
          saved = await offlineNotesService.updateDraft(offlineNote.id, noteData);
        } else {
          saved = await offlineNotesService.saveDraft(noteData);
        }
        
        setOfflineNote(saved);
        setHasUnsavedChanges(false);
        setLastSaved(new Date());

        if (status === 'signed') {
          saved.status = 'signed';
          await offlineNotesService.updateDraft(saved.id, { status: 'signed' });
        }

        notifications.show({
          title: status === 'signed' ? 'Note Signed Offline' : 'Note Saved Offline',
          message: 'Will sync when connection is restored',
          color: 'orange',
          icon: <IconCloudOff size={16} />
        });

        if (onSave) {
          const note: ClinicalNote = {
            id: saved.id,
            offlineId: saved.tempId,
            type: selectedNoteType as any,
            title: noteTitle,
            content: noteContent,
            status,
            author: {
              id: user?.id || '',
              name: `${user?.firstName} ${user?.lastName}`,
              role: user?.role || ''
            },
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            signedAt: status === 'signed' ? new Date().toISOString() : undefined,
            encounterReference: encounterId,
            tags: noteTags,
            isSynced: false
          };
          onSave(note);
        }
      } else {
        // Create FHIR DocumentReference for online save
        const docRef: DocumentReference = {
          resourceType: 'DocumentReference',
          id: noteId,
          status: status === 'signed' || status === 'amended' ? 'current' : status === 'entered-in-error' ? 'entered-in-error' : 'draft',
          docStatus: status === 'signed' ? 'final' : 'preliminary',
          type: {
            coding: [{
              system: 'http://loinc.org',
              code: getNoteTypeCode(selectedNoteType),
              display: NOTE_TYPES.find(nt => nt.value === selectedNoteType)?.label
            }]
          },
          subject: createReference(patient),
          date: new Date().toISOString(),
          author: user ? [{
            reference: `Practitioner/${user.id}`,
            display: `${user.firstName} ${user.lastName}`
          }] : [],
          description: noteTitle,
          content: [{
            attachment: {
              contentType: 'text/plain',
              data: btoa(noteContent)
            }
          }],
          context: {
            encounter: encounterId ? [{ reference: `Encounter/${encounterId}` }] : undefined
          }
        };

        // Add attachments if any
        if (attachments.length > 0) {
          docRef.content = [
            ...docRef.content,
            ...attachments.map(att => ({
              attachment: {
                contentType: att.contentType,
                data: att.data,
                title: att.title,
                size: att.size,
                creation: att.createdAt
              }
            }))
          ];
        }

        // Save to Medplum
        const savedDoc = await medplum.createResource(docRef);
        setDocumentReference(savedDoc);

        // Update offline note if exists
        if (offlineNote) {
          offlineNote.id = savedDoc.id || offlineNote.id;
          offlineNote.status = 'synced';
          offlineNote.serverVersion = savedDoc.meta?.versionId;
          await offlineNotesService.updateDraft(offlineNote.id, offlineNote);
        }

        if (onSave) {
          const note: ClinicalNote = {
            id: savedDoc.id || '',
            type: selectedNoteType as any,
            title: noteTitle,
            content: noteContent,
            status,
            author: {
              id: user?.id || '',
              name: `${user?.firstName} ${user?.lastName}`,
              role: user?.role || ''
            },
            createdAt: savedDoc.date || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            signedAt: status === 'signed' ? new Date().toISOString() : undefined,
            encounterReference: encounterId,
            tags: noteTags,
            isSynced: true
          };
          onSave(note);
        }

        setHasUnsavedChanges(false);
        setLastSaved(new Date());

        notifications.show({
          title: status === 'signed' ? 'Note Signed' : 'Note Saved',
          message: `${noteTitle} has been ${status === 'signed' ? 'signed and saved' : 'saved as draft'}`,
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }

      if (status === 'signed') {
        setNoteStatus('signed');
        setShowSignModal(false);
      }

    } catch (err: unknown) {
      const errorMessage = getDisplayErrorMessage(err);
      setError(`Failed to save note: ${errorMessage}`);
      notifications.show({
        title: 'Save Failed',
        message: `Unable to save the note: ${errorMessage}`,
        color: 'red',
        icon: <IconX size={16} />
      });
      console.error('Error saving note:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = () => {
    if (!noteContent.trim()) {
      setError('Cannot sign an empty note');
      return;
    }
    setShowSignModal(true);
  };

  const confirmSign = async () => {
    await saveNote('signed');
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

  const handleFileUpload = async (files: File[]) => {
    if (!files.length) return;

    for (const file of files) {
      try {
        if (offlineNote) {
          const attachment = await offlineNotesService.addAttachment(offlineNote.id, file);
          setAttachments(prev => [...prev, attachment]);
        } else {
          // Create attachment for new note
          const reader = new FileReader();
          reader.onload = (e) => {
            const attachment: OfflineAttachment = {
              id: Date.now().toString(),
              contentType: file.type,
              data: (e.target?.result as string).split(',')[1],
              title: file.name,
              size: file.size,
              createdAt: new Date().toISOString()
            };
            setAttachments(prev => [...prev, attachment]);
          };
          reader.readAsDataURL(file);
        }

        notifications.show({
          title: 'Attachment Added',
          message: `${file.name} has been attached`,
          color: 'green'
        });
      } catch (error) {
        notifications.show({
          title: 'Attachment Failed',
          message: `Failed to attach ${file.name}`,
          color: 'red'
        });
      }
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (offlineNote) {
      await offlineNotesService.removeAttachment(offlineNote.id, attachmentId);
    }
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const resolveConflict = async (resolution: ConflictResolution) => {
    try {
      await offlineNotesService.resolveConflict(resolution);
      setConflictedNotes(prev => prev.filter(n => n.id !== resolution.noteId));
      setShowConflictModal(false);
      
      // Reload note if it was the current one
      if (selectedConflict?.id === offlineNote?.id) {
        const updated = await offlineNotesService.getNote(resolution.noteId);
        if (updated) {
          setNoteTitle(updated.title);
          setNoteContent(updated.content);
        }
      }
    } catch (error) {
      notifications.show({
        title: 'Conflict Resolution Failed',
        message: getErrorMessage(error),
        color: 'red'
      });
    }
  };

  return (
    <Stack gap="md">
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
                value={selectedNoteType}
                onChange={(value) => value && setSelectedNoteType(value)}
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
              color={getStatusColor(offlineNote?.status || noteStatus)}
              variant="light"
            >
              {(offlineNote?.status || noteStatus).toUpperCase()}
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
                onClick={() => setShowConflictModal(true)}
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
              History ({existingNotes.length})
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="compose" pt="md">
          <Card shadow="sm" padding="lg" withBorder>
            {documentReference ? (
              <DocumentEditor
                reference={createReference(documentReference)}
                onSave={async (doc: DocumentReference) => {
                  const content = doc.content?.[0]?.attachment?.data;
                  if (content) {
                    setNoteContent(atob(content));
                  }
                  await saveNote('draft');
                }}
              />
            ) : (
              <Stack gap="md">
                <SmartText
                  value={noteContent}
                  onChange={setNoteContent}
                  placeholder={`Begin your ${NOTE_TYPES.find(nt => nt.value === selectedNoteType)?.label.toLowerCase()}...`}
                  minRows={8}
                  maxRows={25}
                  disabled={noteStatus === 'signed'}
                  showTemplates={true}
                  showAISuggestions={!isOnline} // Only show AI suggestions when offline
                  patientContext={{
                    patientId: patient.id || '',
                    encounterId,
                    visitType: selectedNoteType,
                    age: patient.birthDate ? 
                      new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : undefined,
                    gender: patient.gender
                  }}
                />
                
                {/* Attachments Section */}
                {attachments.length > 0 && (
                  <Paper p="sm" withBorder>
                    <Group gap="xs" mb="xs">
                      <IconFile size={16} />
                      <Text size="sm" fw={500}>Attachments</Text>
                    </Group>
                    <Stack gap="xs">
                      {attachments.map(attachment => (
                        <Group key={attachment.id} gap="xs" justify="space-between">
                          <Text size="sm">{attachment.title}</Text>
                          <ActionIcon 
                            size="sm" 
                            color="red" 
                            variant="light"
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                )}
                
                <FileButton
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  multiple
                >
                  {(props) => (
                    <Button 
                      {...props} 
                      variant="light" 
                      leftSection={<IconUpload size={16} />}
                      disabled={noteStatus === 'signed'}
                    >
                      Attach Files
                    </Button>
                  )}
                </FileButton>
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="preview" pt="md">
          <Card shadow="sm" padding="lg" withBorder>
            {documentReference ? (
              <Document
                reference={createReference(documentReference)}
                onEdit={() => setActiveTab('compose')}
              />
            ) : (
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={600} size="lg">{noteTitle}</Text>
                    <Text size="sm" c="dimmed">
                      {user?.firstName} {user?.lastName} ({user?.role}) • {formatDateTime(new Date())}
                    </Text>
                  </div>
                  
                  <Group gap="sm">
                    <ActionIcon variant="light" onClick={() => window.print()}>
                      <IconPrinter size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light">
                      <IconShare size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
                
                <Divider />
                
                <Paper p="md" className="bg-gray-50 rounded-lg">
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {noteContent || 'No content to preview'}
                  </div>
                </Paper>
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {showHistory && (
          <Tabs.Panel value="history" pt="md">
            <Card shadow="sm" padding="lg" withBorder>
              <Stack gap="md">
                <Text fw={600} size="lg">Previous Notes</Text>
                
                {existingNotes.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    No previous notes found
                  </Text>
                ) : (
                  <ScrollArea mah={400}>
                    <Stack gap="sm">
                      {existingNotes.map(docRef => (
                        <Paper
                          key={docRef.id}
                          p="md"
                          className="border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                          onClick={() => setSelectedHistoryNote(docRef)}
                        >
                          <Group justify="space-between" align="flex-start">
                            <div className="flex-1">
                              <Text fw={500} size="sm">{docRef.description || 'Clinical Note'}</Text>
                              <Text size="xs" c="dimmed">
                                {docRef.type?.coding?.[0]?.display || 'Unknown Type'}
                              </Text>
                              <Group gap="md" mt="xs">
                                <Text size="xs" c="dimmed">
                                  {docRef.author?.[0]?.display || 'Unknown Author'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {formatDateTime(docRef.date || '')}
                                </Text>
                              </Group>
                            </div>
                            <Badge 
                              size="xs" 
                              color={docRef.docStatus === 'final' ? 'green' : 'blue'}
                              variant="light"
                            >
                              {docRef.docStatus?.toUpperCase() || 'DRAFT'}
                            </Badge>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  </ScrollArea>
                )}
              </Stack>
            </Card>
          </Tabs.Panel>
        )}
      </Tabs>

      {/* Action Buttons */}
      <Group justify="space-between">
        <Group gap="sm">
          {onCancel && (
            <Button
              leftSection={<IconX size={16} />}
              variant="light"
              color="gray"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </Group>
        
        <Group gap="sm">
          {!isOnline && (
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={syncOfflineNotes}
              loading={isSyncing}
            >
              Sync Now
            </Button>
          )}
          
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            variant="light"
            onClick={() => saveNote('draft')}
            loading={loading}
            disabled={!noteContent.trim()}
          >
            Save Draft {!isOnline && '(Offline)'}
          </Button>
          
          {noteStatus !== 'signed' && (
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handleSign}
              loading={loading}
              disabled={!noteContent.trim()}
            >
              Sign Note
            </Button>
          )}
        </Group>
      </Group>

      {/* Sign Confirmation Modal */}
      <Modal
        opened={showSignModal}
        onClose={() => setShowSignModal(false)}
        title="Sign Clinical Note"
        size="md"
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            Once signed, this note cannot be edited. Please review the content carefully.
          </Alert>
          
          <div>
            <Text fw={500} mb="xs">Note Title:</Text>
            <Text size="sm" c="dimmed">{noteTitle}</Text>
          </div>
          
          <div>
            <Text fw={500} mb="xs">Content Preview:</Text>
            <Paper p="sm" className="bg-gray-50 rounded max-h-40 overflow-y-auto">
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {noteContent.substring(0, 200)}
                {noteContent.length > 200 && '...'}
              </Text>
            </Paper>
          </div>
          
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => setShowSignModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSign} loading={loading}>
              Sign Note
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* History Note Detail Modal */}
      <Modal
        opened={!!selectedHistoryNote}
        onClose={() => setSelectedHistoryNote(null)}
        title="Note Details"
        size="lg"
      >
        {selectedHistoryNote && (
          <Stack gap="md">
            <Document
              reference={createReference(selectedHistoryNote)}
              onEdit={() => {
                setDocumentReference(selectedHistoryNote);
                setActiveTab('compose');
                setSelectedHistoryNote(null);
              }}
            />
          </Stack>
        )}
      </Modal>

      {/* Draft Recovery Modal */}
      <Modal
        opened={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        title="Recover Previous Drafts"
        size="md"
      >
        <Stack gap="md">
          <Alert icon={<IconDatabaseOff size={16} />} color="blue">
            We found {draftRecoveryOptions.length} unsaved draft(s) for this patient. 
            Would you like to recover any of them?
          </Alert>
          
          <ScrollArea mah={300}>
            <Stack gap="sm">
              {draftRecoveryOptions.map(draft => (
                <Paper
                  key={draft.id}
                  p="md"
                  withBorder
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => recoverDraft(draft)}
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
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
          
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowRecoveryModal(false)}>
              Start Fresh
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Conflict Resolution Modal */}
      <Modal
        opened={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        title="Resolve Sync Conflicts"
        size="lg"
      >
        <Stack gap="md">
          <Alert icon={<IconMerge size={16} />} color="yellow">
            These notes have been modified both offline and on the server. 
            Please choose how to resolve each conflict.
          </Alert>
          
          {selectedConflict ? (
            <Stack gap="md">
              <Text fw={500}>{selectedConflict.title}</Text>
              
              <Paper p="md" withBorder>
                <Text size="sm" fw={500} mb="xs">Local Version (Your Changes)</Text>
                <Text size="xs" c="dimmed" mb="xs">
                  Modified: {formatDateTime(selectedConflict.updatedAt)}
                </Text>
                <Paper p="sm" className="bg-gray-50">
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedConflict.content.substring(0, 300)}...
                  </Text>
                </Paper>
              </Paper>
              
              {selectedConflict.conflictData && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">Server Version</Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Modified: {formatDateTime(selectedConflict.conflictData.serverNote.meta?.lastUpdated || '')}
                  </Text>
                  <Paper p="sm" className="bg-gray-50">
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedConflict.conflictData.serverNote.content[0]?.attachment?.data ? 
                        atob(selectedConflict.conflictData.serverNote.content[0].attachment.data).substring(0, 300) : ''}...
                    </Text>
                  </Paper>
                </Paper>
              )}
              
              <Group justify="center" gap="sm">
                <Button
                  variant="filled"
                  color="blue"
                  onClick={() => resolveConflict({
                    noteId: selectedConflict.id,
                    resolution: 'keepLocal'
                  })}
                >
                  Keep My Version
                </Button>
                <Button
                  variant="filled"
                  color="gray"
                  onClick={() => resolveConflict({
                    noteId: selectedConflict.id,
                    resolution: 'keepServer'
                  })}
                >
                  Keep Server Version
                </Button>
                <Button
                  variant="light"
                  onClick={() => {
                    // TODO: Implement merge UI
                    notifications.show({
                      title: 'Merge Not Available',
                      message: 'Manual merge is not yet implemented',
                      color: 'orange'
                    });
                  }}
                >
                  Merge Changes
                </Button>
              </Group>
            </Stack>
          ) : (
            <ScrollArea mah={400}>
              <Stack gap="sm">
                {conflictedNotes.map(note => (
                  <Paper
                    key={note.id}
                    p="md"
                    withBorder
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedConflict(note)}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text fw={500}>{note.title}</Text>
                      <Badge color="yellow" size="sm">Conflict</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Conflicted since: {formatDateTime(note.conflictData?.conflictedAt || '')}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          )}
          
          <Group justify="flex-end">
            <Button 
              variant="light" 
              onClick={() => {
                setShowConflictModal(false);
                setSelectedConflict(null);
              }}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Offline Notification */}
      {!isOnline && (
        <Notification
          icon={<IconCloudOff />}
          color="orange"
          title="Working Offline"
          onClose={() => {}}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}
        >
          Your notes are being saved locally and will sync when you're back online.
        </Notification>
      )}
    </Stack>
  );
}

export default ClinicalNoteInput;