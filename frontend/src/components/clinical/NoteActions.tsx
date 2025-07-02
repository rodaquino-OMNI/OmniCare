/**
 * NoteActions - Save, submit, share, print actions
 * Handles all action buttons for clinical notes with proper state management
 */

'use client';

import { 
  Group, 
  Button,
  Menu,
  ActionIcon,
  Divider,
  Text
} from '@mantine/core';
import { 
  IconDeviceFloppy,
  IconCheck,
  IconX,
  IconRefresh,
  IconPrinter,
  IconShare,
  IconDots,
  IconCopy,
  IconDownload,
  IconMail,
  IconCloudOff,
  IconCloudCheck
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { 
  NoteActionsProps 
} from './types/clinical-note.types';
import { useNoteActions } from '@/stores/clinical-note.store';

export function NoteActions({
  noteContent,
  noteStatus,
  isOnline,
  isSyncing,
  loading,
  hasUnsavedChanges,
  onSaveDraft,
  onSignNote,
  onCancel,
  onSync
}: NoteActionsProps) {
  const handlePrint = () => {
    window.print();
  };
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Clinical Note',
        text: noteContent,
        url: window.location.href
      }).catch(err => {
        console.error('Error sharing:', err);
        copyToClipboard();
      });
    } else {
      copyToClipboard();
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(noteContent).then(() => {
      notifications.show({
        title: 'Copied to Clipboard',
        message: 'Note content has been copied to clipboard',
        color: 'green',
        icon: <IconCopy size={16} />
      });
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      notifications.show({
        title: 'Copy Failed',
        message: 'Failed to copy note content',
        color: 'red'
      });
    });
  };
  
  const handleDownload = () => {
    const blob = new Blob([noteContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clinical-note-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    notifications.show({
      title: 'Note Downloaded',
      message: 'Clinical note has been downloaded',
      color: 'green',
      icon: <IconDownload size={16} />
    });
  };
  
  const handleEmailNote = () => {
    const subject = encodeURIComponent('Clinical Note');
    const body = encodeURIComponent(noteContent);
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoUrl);
  };
  
  const isNoteEmpty = !noteContent.trim();
  const canSign = noteStatus !== 'signed' && !isNoteEmpty;
  const showOfflineIndicator = !isOnline;
  
  return (
    <Group justify="space-between" align="center">
      {/* Left Side - Cancel */}
      <Group gap="sm">
        {onCancel && (
          <Button
            leftSection={<IconX size={16} />}
            variant="light"
            color="gray"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </Group>
      
      {/* Right Side - Main Actions */}
      <Group gap="sm">
        {/* Sync Button - Only show when offline */}
        {showOfflineIndicator && onSync && (
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            color="orange"
            onClick={onSync}
            loading={isSyncing}
          >
            Sync Now
          </Button>
        )}
        
        {/* Save Draft */}
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          variant="light"
          color="blue"
          onClick={onSaveDraft}
          loading={loading}
          disabled={isNoteEmpty}
        >
          Save Draft {showOfflineIndicator && '(Offline)'}
        </Button>
        
        {/* Sign Note */}
        {canSign && (
          <Button
            leftSection={<IconCheck size={16} />}
            color="green"
            onClick={onSignNote}
            loading={loading}
            disabled={isNoteEmpty}
          >
            Sign Note
          </Button>
        )}
        
        {/* Additional Actions Menu */}
        <Menu position="bottom-end" withArrow>
          <Menu.Target>
            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              disabled={isNoteEmpty}
            >
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          
          <Menu.Dropdown>
            <Menu.Label>Note Actions</Menu.Label>
            
            <Menu.Item
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
            >
              Print Note
            </Menu.Item>
            
            <Menu.Item
              leftSection={<IconDownload size={16} />}
              onClick={handleDownload}
            >
              Download as Text
            </Menu.Item>
            
            <Menu.Divider />
            
            <Menu.Label>Share</Menu.Label>
            
            <Menu.Item
              leftSection={<IconShare size={16} />}
              onClick={handleShare}
            >
              Share Note
            </Menu.Item>
            
            <Menu.Item
              leftSection={<IconCopy size={16} />}
              onClick={copyToClipboard}
            >
              Copy to Clipboard
            </Menu.Item>
            
            <Menu.Item
              leftSection={<IconMail size={16} />}
              onClick={handleEmailNote}
            >
              Email Note
            </Menu.Item>
            
            {noteStatus === 'signed' && (
              <>
                <Menu.Divider />
                <Menu.Label>Advanced</Menu.Label>
                <Menu.Item
                  leftSection={<IconCheck size={16} />}
                  color="orange"
                  onClick={() => {
                    notifications.show({
                      title: 'Amendment',
                      message: 'Note amendment functionality coming soon',
                      color: 'orange'
                    });
                  }}
                >
                  Amend Note
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}

export default NoteActions;