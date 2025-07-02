/**
 * AttachmentManager - File uploads, images, recordings
 * Handles file attachments for clinical notes with offline support
 */

'use client';

import { useState } from 'react';
import { 
  Stack, 
  Group, 
  Text, 
  Button, 
  ActionIcon,
  FileButton,
  Paper,
  Badge,
  Progress,
  Alert
} from '@mantine/core';
import { 
  IconUpload,
  IconFile,
  IconPhoto,
  IconMicrophone,
  IconX,
  IconDownload,
  IconAlertCircle
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { 
  AttachmentManagerProps 
} from './types/clinical-note.types';
import { 
  useAttachmentManager 
} from '@/stores/clinical-note.store';
import { 
  offlineNotesService,
  OfflineAttachment 
} from '@/services/offline-notes.service';

export function AttachmentManager({
  attachments,
  onAttachmentsChange,
  disabled = false,
  acceptedTypes = "image/*,application/pdf,.doc,.docx",
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024 // 10MB
}: AttachmentManagerProps) {
  const {
    attachments: storeAttachments,
    noteStatus,
    offlineNote,
    addAttachment,
    removeAttachment
  } = useAttachmentManager();
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const isDisabled = disabled || noteStatus === 'signed';
  const currentAttachments = storeAttachments || attachments;
  
  const handleFileUpload = async (files: File[]) => {
    if (!files.length || isDisabled) return;
    
    // Validate file count
    if (currentAttachments.length + files.length > maxFiles) {
      notifications.show({
        title: 'Too Many Files',
        message: `Maximum ${maxFiles} files allowed`,
        color: 'red'
      });
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file size
        if (file.size > maxSize) {
          notifications.show({
            title: 'File Too Large',
            message: `${file.name} exceeds ${(maxSize / 1024 / 1024).toFixed(0)}MB limit`,
            color: 'red'
          });
          setUploadProgress(((i + 1) / files.length) * 100);
          continue;
        }
        
        try {
          if (offlineNote) {
            // Add to existing offline note
            const attachment = await offlineNotesService.addAttachment(offlineNote.id, file);
            addAttachment(attachment);
          } else {
            // Create attachment for new note
            const reader = new FileReader();
            await new Promise<void>((resolve, reject) => {
              reader.onload = (e) => {
                try {
                  const attachment: OfflineAttachment = {
                    id: Date.now().toString() + Math.random().toString(36),
                    contentType: file.type,
                    data: (e.target?.result as string).split(',')[1],
                    title: file.name,
                    size: file.size,
                    createdAt: new Date().toISOString()
                  };
                  addAttachment(attachment);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }
          
          notifications.show({
            title: 'Attachment Added',
            message: `${file.name} has been attached`,
            color: 'green',
            autoClose: 3000
          });
        } catch (error) {
          console.error('Failed to attach file:', error);
          notifications.show({
            title: 'Attachment Failed',
            message: `Failed to attach ${file.name}`,
            color: 'red'
          });
        }
        
        setUploadProgress(((i + 1) / files.length) * 100);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  const handleRemoveAttachment = async (attachmentId: string) => {
    if (isDisabled) return;
    
    try {
      if (offlineNote) {
        await offlineNotesService.removeAttachment(offlineNote.id, attachmentId);
      }
      removeAttachment(attachmentId);
      
      notifications.show({
        title: 'Attachment Removed',
        message: 'Attachment has been removed',
        color: 'blue',
        autoClose: 2000
      });
    } catch (error) {
      console.error('Failed to remove attachment:', error);
      notifications.show({
        title: 'Remove Failed',
        message: 'Failed to remove attachment',
        color: 'red'
      });
    }
  };
  
  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) {
      return IconPhoto;
    } else if (contentType === 'audio/mpeg' || contentType.startsWith('audio/')) {
      return IconMicrophone;
    } else {
      return IconFile;
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <Stack gap="sm">
      {/* Upload Controls */}
      <Group gap="sm">
        <FileButton
          onChange={handleFileUpload}
          accept={acceptedTypes}
          multiple
          disabled={isDisabled || uploading}
        >
          {(props) => (
            <Button 
              {...props} 
              variant="light" 
              leftSection={<IconUpload size={16} />}
              loading={uploading}
              disabled={isDisabled}
            >
              {uploading ? 'Uploading...' : 'Attach Files'}
            </Button>
          )}
        </FileButton>
        
        {currentAttachments.length > 0 && (
          <Badge variant="light" size="sm">
            {currentAttachments.length} / {maxFiles} files
          </Badge>
        )}
      </Group>
      
      {/* Upload Progress */}
      {uploading && uploadProgress > 0 && (
        <Progress 
          value={uploadProgress} 
          size="sm" 
          color="blue"
          label={`${Math.round(uploadProgress)}%`}
        />
      )}
      
      {/* File Size Limit Info */}
      <Text size="xs" c="dimmed">
        Accepted: {acceptedTypes.replace(/,/g, ', ')} • Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB per file
      </Text>
      
      {/* Attachments List */}
      {currentAttachments.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={500} mb="sm">
            Attached Files ({currentAttachments.length})
          </Text>
          
          <Stack gap="xs">
            {currentAttachments.map(attachment => {
              const IconComponent = getFileIcon(attachment.contentType);
              
              return (
                <Group key={attachment.id} gap="sm" justify="space-between">
                  <Group gap="sm" className="flex-1">
                    <IconComponent size={20} className="text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <Text size="sm" className="truncate">
                        {attachment.title}
                      </Text>
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          {attachment.contentType}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatFileSize(attachment.size)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(attachment.createdAt).toLocaleDateString()}
                        </Text>
                      </Group>
                    </div>
                  </Group>
                  
                  <Group gap="xs">
                    {attachment.data && (
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="blue"
                        onClick={() => {
                          // Download attachment
                          const link = document.createElement('a');
                          link.href = `data:${attachment.contentType};base64,${attachment.data}`;
                          link.download = attachment.title;
                          link.click();
                        }}
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    )}
                    
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      disabled={isDisabled}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Paper>
      )}
      
      {/* Disabled State Info */}
      {isDisabled && noteStatus === 'signed' && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" size="sm">
          Cannot modify attachments on signed notes
        </Alert>
      )}
    </Stack>
  );
}

export default AttachmentManager;