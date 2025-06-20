'use client';

import { useState, useEffect, useCallback } from 'react';
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
  ScrollArea
} from '@mantine/core';
import { 
  IconNotes,
  IconSave,
  IconTemplate,
  IconClock,
  IconUser,
  IconStethoscope,
  IconEye,
  IconEdit,
  IconTrash,
  IconCopy,
  IconPrint,
  IconShare,
  IconHistory,
  IconAlertCircle,
  IconCheck,
  IconX
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
import { createReference } from '@medplum/core';

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
  
  // Note composition state
  const [selectedNoteType, setSelectedNoteType] = useState(noteType);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState<'draft' | 'signed'>('draft');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
  
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
    if (noteId) {
      loadExistingNote();
    }
    if (showHistory) {
      loadPatientNotes();
    }
    generateDefaultTitle();
  }, [noteId, patient.id, selectedNoteType]);

  useEffect(() => {
    setHasUnsavedChanges(true);
    
    // Auto-save after 30 seconds of inactivity
    const autoSaveTimer = setTimeout(() => {
      if (noteContent.trim() && hasUnsavedChanges) {
        autoSave();
      }
    }, 30000);

    return () => clearTimeout(autoSaveTimer);
  }, [noteContent, noteTitle, selectedNoteType]);

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
    } catch (err) {
      setError('Failed to load existing note');
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
    } catch (err) {
      console.error('Failed to load patient notes:', err);
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

  const autoSave = async () => {
    try {
      // Auto-save as draft
      await saveNote('draft');
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      
      notifications.show({
        title: 'Auto-saved',
        message: 'Note saved as draft',
        color: 'blue',
        autoClose: 2000
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
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

      // Create FHIR DocumentReference
      const docRef: DocumentReference = {
        resourceType: 'DocumentReference',
        id: noteId,
        status: status === 'signed' ? 'current' : 'draft',
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

      // Save to Medplum
      const savedDoc = await medplum.createResource(docRef);
      setDocumentReference(savedDoc);

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
          tags: noteTags
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

      if (status === 'signed') {
        setNoteStatus('signed');
        setShowSignModal(false);
      }

    } catch (err) {
      setError('Failed to save note');
      notifications.show({
        title: 'Save Failed',
        message: 'Unable to save the note. Please try again.',
        color: 'red',
        icon: <IconX size={16} />
      });
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
      default: return 'gray';
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
              color={getStatusColor(noteStatus)}
              variant="light"
            >
              {noteStatus.toUpperCase()}
            </Badge>
            
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
                onSave={async (doc) => {
                  const content = doc.content?.[0]?.attachment?.data;
                  if (content) {
                    setNoteContent(atob(content));
                  }
                  await saveNote('draft');
                }}
              />
            ) : (
              <SmartText
                value={noteContent}
                onChange={setNoteContent}
                placeholder={`Begin your ${NOTE_TYPES.find(nt => nt.value === selectedNoteType)?.label.toLowerCase()}...`}
                minRows={8}
                maxRows={25}
                disabled={noteStatus === 'signed'}
                showTemplates={true}
                showAISuggestions={true}
                patientContext={{
                  patientId: patient.id || '',
                  encounterId,
                  visitType: selectedNoteType
                }}
              />
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
                      <IconPrint size={16} />
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
          <Button
            leftSection={<IconSave size={16} />}
            variant="light"
            onClick={() => saveNote('draft')}
            loading={loading}
            disabled={!noteContent.trim()}
          >
            Save Draft
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
    </Stack>
  );
}

export default ClinicalNoteInput;