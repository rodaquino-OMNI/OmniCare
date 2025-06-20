'use client';

import { useState, useEffect } from 'react';
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
import { SmartText } from './SmartText';
import { useAuth } from '@/stores/auth';
import { Patient, DocumentReference } from '@medplum/fhirtypes';
import { formatDateTime, formatDate } from '@/utils';

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
  const [activeTab, setActiveTab] = useState('compose');
  
  // Note composition state
  const [selectedNoteType, setSelectedNoteType] = useState(noteType);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState<'draft' | 'signed'>('draft');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [existingNotes, setExistingNotes] = useState<ClinicalNote[]>([]);
  const [selectedHistoryNote, setSelectedHistoryNote] = useState<ClinicalNote | null>(null);

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
      // In production, this would load from FHIR DocumentReference resources
      const mockNotes: ClinicalNote[] = [
        {
          id: '1',
          type: 'progress',
          title: 'Progress Note - Routine Follow-up',
          content: 'Patient is doing well, vital signs stable...',
          status: 'signed',
          author: {
            id: 'dr-smith',
            name: 'Dr. John Smith',
            role: 'physician'
          },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          signedAt: new Date(Date.now() - 86400000).toISOString(),
          encounterReference: encounterId
        },
        {
          id: '2',
          type: 'nursing',
          title: 'Nursing Assessment',
          content: 'Patient alert and oriented, ambulating without assistance...',
          status: 'signed',
          author: {
            id: 'nurse-johnson',
            name: 'Sarah Johnson, RN',
            role: 'nurse'
          },
          createdAt: new Date(Date.now() - 43200000).toISOString(),
          updatedAt: new Date(Date.now() - 43200000).toISOString(),
          signedAt: new Date(Date.now() - 43200000).toISOString(),
          encounterReference: encounterId
        }
      ];
      
      setExistingNotes(mockNotes);
    } catch (err) {
      console.error('Failed to load patient notes:', err);
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

      const note: ClinicalNote = {
        id: noteId || `note-${Date.now()}`,
        type: selectedNoteType as any,
        title: noteTitle,
        content: noteContent,
        status,
        author: {
          id: user?.id || '',
          name: `${user?.firstName} ${user?.lastName}`,
          role: user?.role || ''
        },
        createdAt: noteId ? existingNotes.find(n => n.id === noteId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        signedAt: status === 'signed' ? new Date().toISOString() : undefined,
        encounterReference: encounterId,
        tags: noteTags
      };

      // In production, this would save to FHIR DocumentReference
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (onSave) {
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
          </Card>
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
                      {existingNotes.map(note => (
                        <Paper
                          key={note.id}
                          p="md"
                          className="border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                          onClick={() => setSelectedHistoryNote(note)}
                        >
                          <Group justify="space-between" align="flex-start">
                            <div className="flex-1">
                              <Text fw={500} size="sm">{note.title}</Text>
                              <Text size="xs" c="dimmed" truncate>
                                {note.content.substring(0, 100)}...
                              </Text>
                              <Group gap="md" mt="xs">
                                <Text size="xs" c="dimmed">
                                  {note.author.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {formatDateTime(note.createdAt)}
                                </Text>
                              </Group>
                            </div>
                            <Badge 
                              size="xs" 
                              color={getStatusColor(note.status)}
                              variant="light"
                            >
                              {note.status.toUpperCase()}
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
            <Group justify="space-between">
              <div>
                <Text fw={600} size="lg">{selectedHistoryNote.title}</Text>
                <Text size="sm" c="dimmed">
                  {selectedHistoryNote.author.name} • {formatDateTime(selectedHistoryNote.createdAt)}
                </Text>
              </div>
              <Badge 
                color={getStatusColor(selectedHistoryNote.status)}
                variant="light"
              >
                {selectedHistoryNote.status.toUpperCase()}
              </Badge>
            </Group>
            
            <Divider />
            
            <Paper p="md" className="bg-gray-50 rounded-lg">
              <Text style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {selectedHistoryNote.content}
              </Text>
            </Paper>
            
            <Group justify="flex-end" gap="sm">
              <Button
                leftSection={<IconCopy size={16} />}
                variant="light"
                onClick={() => {
                  navigator.clipboard.writeText(selectedHistoryNote.content);
                  notifications.show({
                    title: 'Copied',
                    message: 'Note content copied to clipboard',
                    color: 'blue'
                  });
                }}
              >
                Copy Content
              </Button>
              <Button
                leftSection={<IconPrint size={16} />}
                variant="light"
                onClick={() => window.print()}
              >
                Print
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default ClinicalNoteInput;