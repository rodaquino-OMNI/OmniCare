/**
 * NoteMetadata - Timestamps, signatures, compliance data
 * Handles note metadata display and signature modal
 */

'use client';

import { 
  Modal,
  Stack, 
  Group, 
  Text, 
  Button,
  Paper,
  Alert,
  Badge,
  Divider,
  Card
} from '@mantine/core';
import { 
  IconAlertCircle,
  IconCheck,
  IconUser,
  IconClock,
  IconSignature,
  IconShieldCheck,
  IconFileText
} from '@tabler/icons-react';

import { 
  NoteMetadataProps 
} from './types/clinical-note.types';
import { formatDateTime } from '@/utils';

export function NoteMetadata({
  metadata,
  noteTitle,
  noteContent,
  isSignModalOpen,
  onSignConfirm,
  onSignCancel,
  isOnline,
  conflictCount = 0,
  onConflictsClick
}: NoteMetadataProps) {
  if (!metadata) {
    return null;
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'green';
      case 'draft': return 'blue';
      case 'amended': return 'orange';
      case 'entered-in-error': return 'red';
      default: return 'gray';
    }
  };
  
  const getComplianceLevel = () => {
    if (metadata.status === 'signed' && metadata.signedAt) {
      return { level: 'HIPAA Compliant', color: 'green', icon: IconShieldCheck };
    } else if (metadata.status === 'draft') {
      return { level: 'Draft - Not Signed', color: 'blue', icon: IconFileText };
    } else {
      return { level: 'Compliance Review Needed', color: 'orange', icon: IconAlertCircle };
    }
  };
  
  const compliance = getComplianceLevel();
  const ComplianceIcon = compliance.icon;
  
  return (
    <>
      {/* Metadata Display - Only show if signed or has important info */}
      {(metadata.status === 'signed' || conflictCount > 0) && (
        <Card shadow="sm" padding="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600} size="md">Note Information</Text>
              <Badge 
                color={compliance.color} 
                variant="light"
                leftSection={<ComplianceIcon size={14} />}
              >
                {compliance.level}
              </Badge>
            </Group>
            
            <Group gap="lg">
              {/* Author Info */}
              <Group gap="xs">
                <IconUser size={16} className="text-gray-500" />
                <div>
                  <Text size="sm" fw={500}>{metadata.author.name}</Text>
                  <Text size="xs" c="dimmed">{metadata.author.role}</Text>
                </div>
              </Group>
              
              {/* Timestamps */}
              <Group gap="xs">
                <IconClock size={16} className="text-gray-500" />
                <div>
                  <Text size="sm">Created: {formatDateTime(metadata.createdAt)}</Text>
                  {metadata.updatedAt !== metadata.createdAt && (
                    <Text size="xs" c="dimmed">
                      Updated: {formatDateTime(metadata.updatedAt)}
                    </Text>
                  )}
                  {metadata.signedAt && (
                    <Text size="xs" c="green">
                      Signed: {formatDateTime(metadata.signedAt)}
                    </Text>
                  )}
                </div>
              </Group>
              
              {/* Version Info */}
              {metadata.version && (
                <Group gap="xs">
                  <IconFileText size={16} className="text-gray-500" />
                  <div>
                    <Text size="sm">Version {metadata.version}</Text>
                    <Text size="xs" c="dimmed">FHIR R4 Compliant</Text>
                  </div>
                </Group>
              )}
            </Group>
            
            {/* Conflicts Alert */}
            {conflictCount > 0 && onConflictsClick && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="yellow"
                title="Sync Conflicts Detected"
                onClick={onConflictsClick}
                className="cursor-pointer hover:bg-yellow-50"
              >
                <Group justify="space-between">
                  <Text size="sm">
                    {conflictCount} note(s) have conflicting changes. Click to resolve.
                  </Text>
                  <Badge color="yellow" size="sm">
                    {conflictCount} Conflicts
                  </Badge>
                </Group>
              </Alert>
            )}
          </Stack>
        </Card>
      )}
      
      {/* Sign Confirmation Modal */}
      <Modal
        opened={isSignModalOpen}
        onClose={onSignCancel}
        title="Sign Clinical Note"
        size="md"
        centered
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            Once signed, this note cannot be edited. Please review the content carefully.
            {!isOnline && (
              <Text size="sm" mt="xs" c="orange">
                Note: You are currently offline. The signature will be applied when you reconnect.
              </Text>
            )}
          </Alert>
          
          {/* Note Summary */}
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500}>Note Summary</Text>
                <Badge color={getStatusColor(metadata.status)} variant="light">
                  {metadata.status.toUpperCase()}
                </Badge>
              </Group>
              
              <div>
                <Text size="sm" fw={500} mb="xs">Title:</Text>
                <Text size="sm" c="dimmed">{noteTitle}</Text>
              </div>
              
              <div>
                <Text size="sm" fw={500} mb="xs">Content Preview:</Text>
                <Paper p="sm" className="bg-gray-50 rounded max-h-32 overflow-y-auto">
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {noteContent.substring(0, 300)}
                    {noteContent.length > 300 && '...'}
                  </Text>
                </Paper>
              </div>
              
              <Divider />
              
              {/* Signature Info */}
              <Group gap="xs">
                <IconSignature size={16} className="text-blue-600" />
                <div>
                  <Text size="sm" fw={500}>Electronic Signature</Text>
                  <Text size="xs" c="dimmed">
                    By: {metadata.author.name} ({metadata.author.role})
                  </Text>
                  <Text size="xs" c="dimmed">
                    Date: {formatDateTime(new Date())}
                  </Text>
                </div>
              </Group>
            </Stack>
          </Paper>
          
          {/* Compliance Notice */}
          <Alert color="green" icon={<IconShieldCheck size={16} />}>
            <Text size="sm">
              This signature confirms the accuracy and completeness of this clinical note 
              in compliance with HIPAA and healthcare documentation standards.
            </Text>
          </Alert>
          
          {/* Action Buttons */}
          <Group justify="flex-end" gap="sm">
            <Button 
              variant="light" 
              onClick={onSignCancel}
            >
              Cancel
            </Button>
            <Button 
              leftSection={<IconCheck size={16} />}
              onClick={onSignConfirm}
              color="green"
            >
              Sign Note
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default NoteMetadata;