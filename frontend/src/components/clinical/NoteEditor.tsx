/**
 * NoteEditor - Rich text editing component with medical templates
 * Handles note content editing with smart text features and templates
 */

'use client';

import { Stack, Card, Paper, Text, Group, Button } from '@mantine/core';
import { IconFile, IconX } from '@tabler/icons-react';
import { SmartText } from './SmartText';

import { 
  NoteEditorProps 
} from './types/clinical-note.types';
import { 
  useAttachmentManager 
} from '@/stores/clinical-note.store';
import { AttachmentManager } from './AttachmentManager';
import { TemplateManager } from './TemplateManager';

export function NoteEditor({
  value,
  onChange,
  noteType,
  patientContext,
  disabled = false,
  placeholder = 'Enter clinical note content...',
  minRows = 8,
  maxRows = 25,
  showTemplates = true,
  showAISuggestions = false
}: NoteEditorProps) {
  const {
    attachments,
    noteStatus,
    removeAttachment
  } = useAttachmentManager();

  const handleTemplateInsert = (content: string) => {
    // Insert template content at cursor position or append to end
    const currentValue = value || '';
    const newValue = currentValue + (currentValue ? '\n\n' : '') + content;
    onChange(newValue);
  };

  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Stack gap="md">
        {/* Template Manager */}
        {showTemplates && (
          <TemplateManager
            noteType={noteType}
            onTemplateSelect={(template) => handleTemplateInsert(template.content)}
            onTemplateInsert={handleTemplateInsert}
            patientContext={patientContext}
          />
        )}
        
        {/* Smart Text Editor */}
        <SmartText
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minRows={minRows}
          maxRows={maxRows}
          disabled={disabled}
          showTemplates={showTemplates}
          showAISuggestions={showAISuggestions}
          patientContext={patientContext}
        />
        
        {/* Attachments Section */}
        {attachments.length > 0 && (
          <Paper p="sm" withBorder>
            <Group gap="xs" mb="xs">
              <IconFile size={16} />
              <Text size="sm" fw={500}>Attachments ({attachments.length})</Text>
            </Group>
            <Stack gap="xs">
              {attachments.map(attachment => (
                <Group key={attachment.id} gap="xs" justify="space-between">
                  <div className="flex-1">
                    <Text size="sm">{attachment.title}</Text>
                    <Text size="xs" c="dimmed">
                      {attachment.contentType} • {(attachment.size / 1024).toFixed(1)} KB
                    </Text>
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => removeAttachment(attachment.id)}
                    disabled={noteStatus === 'signed'}
                  >
                    <IconX size={14} />
                  </Button>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}
        
        {/* Attachment Manager */}
        <AttachmentManager
          attachments={attachments}
          onAttachmentsChange={() => {}} // Handled internally by the attachment manager
          disabled={disabled || noteStatus === 'signed'}
          acceptedTypes="image/*,application/pdf,.doc,.docx"
          maxFiles={10}
          maxSize={10 * 1024 * 1024} // 10MB
        />
      </Stack>
    </Card>
  );
}

export default NoteEditor;