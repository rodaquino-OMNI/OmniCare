/**
 * OfflineConflictResolver - Sync conflict resolution
 * Handles resolution of offline sync conflicts with visual comparison
 */

'use client';

import { useState } from 'react';
import { 
  Modal,
  Stack, 
  Group, 
  Text, 
  Button,
  Paper,
  Alert,
  ScrollArea,
  Badge,
  Divider
} from '@mantine/core';
import { 
  IconMerge,
  IconGitMerge,
  IconCheck,
  IconX,
  IconAlertTriangle
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { 
  OfflineConflictResolverProps 
} from './types/clinical-note.types';
import { 
  OfflineNote,
  ConflictResolution 
} from '@/services/offline-notes.service';
import { formatDateTime } from '@/utils';

export function OfflineConflictResolver({
  conflicts,
  onResolveConflict,
  onClose,
  isOpen
}: OfflineConflictResolverProps) {
  const [selectedConflict, setSelectedConflict] = useState<OfflineNote | null>(null);
  const [resolving, setResolving] = useState(false);
  
  const handleResolveConflict = async (resolution: ConflictResolution) => {
    if (!selectedConflict) return;
    
    try {
      setResolving(true);
      await onResolveConflict(resolution);
      
      notifications.show({
        title: 'Conflict Resolved',
        message: 'The conflict has been successfully resolved',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setSelectedConflict(null);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      notifications.show({
        title: 'Resolution Failed',
        message: 'Failed to resolve the conflict. Please try again.',
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setResolving(false);
    }
  };
  
  const getConflictTypeColor = (conflictType?: string) => {
    switch (conflictType) {
      case 'content': return 'orange';
      case 'metadata': return 'blue';
      case 'both': return 'red';
      default: return 'yellow';
    }
  };
  
  const getConflictTypeLabel = (conflictType?: string) => {
    switch (conflictType) {
      case 'content': return 'Content Conflict';
      case 'metadata': return 'Metadata Conflict';
      case 'both': return 'Multiple Conflicts';
      default: return 'Sync Conflict';
    }
  };
  
  const renderConflictComparison = (conflict: OfflineNote) => {
    const serverNote = conflict.conflictData?.serverNote;
    const conflictType = conflict.conflictData?.conflictType || 'content';
    
    return (
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600} size="lg">{conflict.title}</Text>
          <Badge color={getConflictTypeColor(conflictType)} variant="light">
            {getConflictTypeLabel(conflictType)}
          </Badge>
        </Group>
        
        <Text size="sm" c="dimmed">
          This note was modified both locally and on the server. Choose which version to keep.
        </Text>
        
        <Group align="stretch" grow>
          {/* Local Version */}
          <Paper p="md" withBorder className="flex-1">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600} c="blue">
                  Your Local Version
                </Text>
                <Badge size="xs" color="blue" variant="light">
                  Modified: {formatDateTime(conflict.updatedAt)}
                </Badge>
              </Group>
              
              <Divider />
              
              <ScrollArea mah={300}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {conflict.content.substring(0, 500)}
                  {conflict.content.length > 500 && '...'}
                </Text>
              </ScrollArea>
              
              {conflict.tags && conflict.tags.length > 0 && (
                <Group gap="xs">
                  <Text size="xs" c="dimmed">Tags:</Text>
                  {conflict.tags.map(tag => (
                    <Badge key={tag} size="xs" variant="outline">{tag}</Badge>
                  ))}
                </Group>
              )}
            </Stack>
          </Paper>
          
          {/* Server Version */}
          <Paper p="md" withBorder className="flex-1">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600} c="green">
                  Server Version
                </Text>
                <Badge size="xs" color="green" variant="light">
                  Modified: {formatDateTime(serverNote?.meta?.lastUpdated || '')}
                </Badge>
              </Group>
              
              <Divider />
              
              <ScrollArea mah={300}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {serverNote?.content?.[0]?.attachment?.data ? 
                    atob(serverNote.content[0].attachment.data).substring(0, 500) : 'No content available'}
                  {serverNote?.content?.[0]?.attachment?.data && 
                   atob(serverNote.content[0].attachment.data).length > 500 && '...'}
                </Text>
              </ScrollArea>
              
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Author: {serverNote?.author?.[0]?.display || 'Unknown'}
                </Text>
              </Group>
            </Stack>
          </Paper>
        </Group>
        
        {/* Resolution Actions */}
        <Group justify="center" gap="md" mt="md">
          <Button
            variant="filled"
            color="blue"
            leftSection={<IconCheck size={16} />}
            onClick={() => handleResolveConflict({
              noteId: conflict.id,
              resolution: 'keepLocal'
            })}
            loading={resolving}
          >
            Keep My Version
          </Button>
          
          <Button
            variant="filled"
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={() => handleResolveConflict({
              noteId: conflict.id,
              resolution: 'keepServer'
            })}
            loading={resolving}
          >
            Keep Server Version
          </Button>
          
          <Button
            variant="light"
            color="orange"
            leftSection={<IconGitMerge size={16} />}
            onClick={() => {
              notifications.show({
                title: 'Manual Merge',
                message: 'Manual merge functionality coming soon',
                color: 'orange'
              });
            }}
            disabled
          >
            Merge Changes
          </Button>
        </Group>
      </Stack>
    );
  };
  
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Resolve Sync Conflicts"
      size="xl"
      centered
    >
      <Stack gap="md">
        <Alert icon={<IconMerge size={16} />} color="yellow">
          {conflicts.length} note(s) have conflicting changes that occurred both offline and on the server. 
          Please review and choose how to resolve each conflict.
        </Alert>
        
        {selectedConflict ? (
          <Stack gap="md">
            <Group justify="space-between">
              <Button
                variant="light"
                leftSection={<IconX size={16} />}
                onClick={() => setSelectedConflict(null)}
              >
                Back to List
              </Button>
              
              <Badge color="yellow" size="lg">
                Conflict {conflicts.findIndex(c => c.id === selectedConflict.id) + 1} of {conflicts.length}
              </Badge>
            </Group>
            
            {renderConflictComparison(selectedConflict)}
          </Stack>
        ) : (
          <Stack gap="md">
            <Text fw={500} size="md">
              Select a conflict to resolve:
            </Text>
            
            <ScrollArea mah={400}>
              <Stack gap="sm">
                {conflicts.map(conflict => {
                  const conflictType = conflict.conflictData?.conflictType;
                  
                  return (
                    <Paper
                      key={conflict.id}
                      p="md"
                      withBorder
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedConflict(conflict)}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text fw={500}>{conflict.title}</Text>
                        <Group gap="xs">
                          <Badge 
                            color={getConflictTypeColor(conflictType)} 
                            size="sm" 
                            variant="light"
                          >
                            {getConflictTypeLabel(conflictType)}
                          </Badge>
                          <Badge color="red" size="sm">
                            Conflict
                          </Badge>
                        </Group>
                      </Group>
                      
                      <Group gap="md" mb="xs">
                        <Text size="xs" c="dimmed">
                          Note Type: {conflict.noteType}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Last Modified: {formatDateTime(conflict.updatedAt)}
                        </Text>
                        {conflict.conflictData?.conflictedAt && (
                          <Text size="xs" c="dimmed">
                            Conflicted: {formatDateTime(conflict.conflictData.conflictedAt)}
                          </Text>
                        )}
                      </Group>
                      
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {conflict.content}
                      </Text>
                      
                      <Group justify="flex-end" mt="sm">
                        <Text size="xs" c="blue" fw={500}>
                          Click to resolve →
                        </Text>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Stack>
        )}
        
        <Group justify="flex-end" mt="md">
          <Button 
            variant="light" 
            onClick={onClose}
            disabled={resolving}
          >
            Close
          </Button>
          
          {conflicts.length > 0 && !selectedConflict && (
            <Button
              color="orange"
              leftSection={<IconAlertTriangle size={16} />}
              onClick={() => {
                notifications.show({
                  title: 'Auto-resolve',
                  message: 'Auto-resolve functionality coming soon',
                  color: 'orange'
                });
              }}
              disabled
            >
              Auto-resolve All
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

export default OfflineConflictResolver;