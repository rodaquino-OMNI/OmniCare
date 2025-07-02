/**
 * NoteHistory - Version control and audit trail
 * Displays and manages historical clinical notes with version control
 */

'use client';

import { useState } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  Card,
  Badge,
  Button,
  ScrollArea,
  Modal,
  Paper,
  ActionIcon,
  LoadingOverlay,
  Alert
} from '@mantine/core';
import { 
  IconHistory,
  IconEdit,
  IconEye,
  IconDownload,
  IconClock,
  IconUser,
  IconFileText,
  IconSearch,
  IconFilter
} from '@tabler/icons-react';
import { DocumentReference } from '@medplum/fhirtypes';

import { 
  NoteHistoryProps 
} from './types/clinical-note.types';
import { formatDateTime, formatDate } from '@/utils';
import { useNoteHistory } from '@/stores/clinical-note.store';

export function NoteHistory({
  patient,
  encounterId,
  notes,
  onNoteSelect,
  onLoadMore,
  loading = false
}: NoteHistoryProps) {
  const {
    selectedHistoryNote,
    setSelectedHistoryNote,
    setActiveTab
  } = useNoteHistory();
  
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  
  const filteredNotes = notes.filter(note => {
    if (filterStatus && note.docStatus !== filterStatus) return false;
    if (filterType && note.type?.coding?.[0]?.display !== filterType) return false;
    return true;
  });
  
  const getStatusColor = (docStatus?: string) => {
    switch (docStatus) {
      case 'final': return 'green';
      case 'preliminary': return 'blue';
      case 'amended': return 'orange';
      case 'entered-in-error': return 'red';
      default: return 'gray';
    }
  };
  
  const getStatusLabel = (docStatus?: string) => {
    switch (docStatus) {
      case 'final': return 'Signed';
      case 'preliminary': return 'Draft';
      case 'amended': return 'Amended';
      case 'entered-in-error': return 'Error';
      default: return docStatus?.toUpperCase() || 'UNKNOWN';
    }
  };
  
  const handleNoteClick = (note: DocumentReference) => {
    setSelectedHistoryNote(note);
    onNoteSelect(note);
  };
  
  const handleEditNote = (note: DocumentReference) => {
    setSelectedHistoryNote(note);
    setActiveTab('compose');
    onNoteSelect(note);
  };
  
  const downloadNote = (note: DocumentReference) => {
    const content = note.content?.[0]?.attachment?.data 
      ? atob(note.content[0].attachment.data)
      : 'No content available';
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.description || 'clinical-note'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const uniqueStatuses = Array.from(new Set(notes.map(n => n.docStatus).filter(Boolean)));
  const uniqueTypes = Array.from(new Set(notes.map(n => n.type?.coding?.[0]?.display).filter(Boolean)));
  
  return (
    <Stack gap="md">
      <LoadingOverlay visible={loading} overlayProps={{ radius: 'sm', blur: 2 }} />
      
      {/* Header and Filters */}
      <Card shadow="sm" padding="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="sm">
            <IconHistory size={20} className="text-blue-600" />
            <Text fw={600} size="lg">Clinical Note History</Text>
            <Badge variant="light" size="sm">
              {filteredNotes.length} of {notes.length} notes
            </Badge>
          </Group>
          
          {onLoadMore && (
            <Button
              variant="light"
              size="sm"
              leftSection={<IconSearch size={16} />}
              onClick={onLoadMore}
              loading={loading}
            >
              Load More
            </Button>
          )}
        </Group>
        
        {/* Filters */}
        {(uniqueStatuses.length > 1 || uniqueTypes.length > 1) && (
          <Group gap="sm">
            <IconFilter size={16} className="text-gray-500" />
            
            {uniqueStatuses.length > 1 && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">Status:</Text>
                <Button.Group>
                  <Button
                    size="xs"
                    variant={filterStatus === null ? 'filled' : 'light'}
                    onClick={() => setFilterStatus(null)}
                  >
                    All
                  </Button>
                  {uniqueStatuses.map(status => (
                    <Button
                      key={status}
                      size="xs"
                      variant={filterStatus === status ? 'filled' : 'light'}
                      onClick={() => setFilterStatus(status)}
                    >
                      {getStatusLabel(status)}
                    </Button>
                  ))}
                </Button.Group>
              </Group>
            )}
            
            {uniqueTypes.length > 1 && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">Type:</Text>
                <Button.Group>
                  <Button
                    size="xs"
                    variant={filterType === null ? 'filled' : 'light'}
                    onClick={() => setFilterType(null)}
                  >
                    All
                  </Button>
                  {uniqueTypes.slice(0, 3).map(type => (
                    <Button
                      key={type}
                      size="xs"
                      variant={filterType === type ? 'filled' : 'light'}
                      onClick={() => setFilterType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </Button.Group>
              </Group>
            )}
          </Group>
        )}
      </Card>
      
      {/* Notes List */}
      <Card shadow="sm" padding="lg" withBorder>
        {filteredNotes.length === 0 ? (
          <Stack align="center" gap="md" py="xl">
            <IconFileText size={48} className="text-gray-400" />
            <div className="text-center">
              <Text c="dimmed" size="lg" fw={500}>
                {notes.length === 0 ? 'No notes found' : 'No notes match your filter'}
              </Text>
              <Text c="dimmed" size="sm">
                {notes.length === 0 
                  ? 'This patient has no previous clinical notes.'
                  : 'Try adjusting your filters to see more notes.'}
              </Text>
            </div>
            {filterStatus || filterType ? (
              <Button
                variant="light"
                onClick={() => {
                  setFilterStatus(null);
                  setFilterType(null);
                }}
              >
                Clear Filters
              </Button>
            ) : null}
          </Stack>
        ) : (
          <ScrollArea mah={500}>
            <Stack gap="sm">
              {filteredNotes.map(note => (
                <Paper
                  key={note.id}
                  p="md"
                  withBorder
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleNoteClick(note)}
                >
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <div className="flex-1 min-w-0">
                      <Group gap="sm" mb="xs">
                        <Text fw={500} size="sm" className="truncate">
                          {note.description || 'Clinical Note'}
                        </Text>
                        <Badge 
                          size="xs" 
                          color={getStatusColor(note.docStatus)}
                          variant="light"
                        >
                          {getStatusLabel(note.docStatus)}
                        </Badge>
                      </Group>
                      
                      <Text size="xs" c="dimmed" mb="xs">
                        {note.type?.coding?.[0]?.display || 'Unknown Type'}
                      </Text>
                      
                      <Group gap="md">
                        <Group gap="xs">
                          <IconUser size={12} className="text-gray-400" />
                          <Text size="xs" c="dimmed">
                            {note.author?.[0]?.display || 'Unknown Author'}
                          </Text>
                        </Group>
                        
                        <Group gap="xs">
                          <IconClock size={12} className="text-gray-400" />
                          <Text size="xs" c="dimmed">
                            {formatDateTime(note.date || '')}
                          </Text>
                        </Group>
                        
                        {note.meta?.versionId && (
                          <Text size="xs" c="dimmed">
                            v{note.meta.versionId}
                          </Text>
                        )}
                      </Group>
                    </div>
                    
                    <Group gap="xs">
                      <ActionIcon
                        size="sm"
                        variant="light"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadNote(note);
                        }}
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                      
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditNote(note);
                        }}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  
                  {/* Preview Content */}
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {note.content?.[0]?.attachment?.data 
                      ? atob(note.content[0].attachment.data).substring(0, 150) + '...'
                      : 'No content preview available'}
                  </Text>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Card>
      
      {/* Note Detail Modal */}
      <Modal
        opened={!!selectedHistoryNote}
        onClose={() => setSelectedHistoryNote(null)}
        title="Note Details"
        size="lg"
        centered
      >
        {selectedHistoryNote && (
          <Stack gap="md">
            {/* Note Header */}
            <Group justify="space-between" align="flex-start">
              <div className="flex-1">
                <Text fw={600} size="lg" mb="xs">
                  {selectedHistoryNote.description || 'Clinical Note'}
                </Text>
                
                <Group gap="md" mb="sm">
                  <Badge 
                    color={getStatusColor(selectedHistoryNote.docStatus)}
                    variant="light"
                  >
                    {getStatusLabel(selectedHistoryNote.docStatus)}
                  </Badge>
                  
                  <Text size="sm" c="dimmed">
                    {selectedHistoryNote.type?.coding?.[0]?.display || 'Unknown Type'}
                  </Text>
                </Group>
                
                <Group gap="md">
                  <Text size="sm" c="dimmed">
                    <strong>Author:</strong> {selectedHistoryNote.author?.[0]?.display || 'Unknown'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    <strong>Date:</strong> {formatDateTime(selectedHistoryNote.date || '')}
                  </Text>
                  {selectedHistoryNote.meta?.versionId && (
                    <Text size="sm" c="dimmed">
                      <strong>Version:</strong> {selectedHistoryNote.meta.versionId}
                    </Text>
                  )}
                </Group>
              </div>
            </Group>
            
            <div className="border-t pt-4">
              <Text fw={500} mb="sm">Content:</Text>
              <Paper p="md" className="bg-gray-50 rounded">
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {selectedHistoryNote.content?.[0]?.attachment?.data 
                    ? atob(selectedHistoryNote.content[0].attachment.data)
                    : 'No content available'}
                </Text>
              </Paper>
            </div>
            
            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={() => downloadNote(selectedHistoryNote)}
              >
                Download
              </Button>
              
              <Button
                leftSection={<IconEdit size={16} />}
                onClick={() => handleEditNote(selectedHistoryNote)}
              >
                Edit Note
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default NoteHistory;