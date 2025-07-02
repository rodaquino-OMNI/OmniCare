'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Textarea,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Paper,
  Box,
  Tooltip,
  Alert,
  Modal,
  Menu,
  Divider,
  ScrollArea,
  Chip,
  Progress,
  Transition,
} from '@mantine/core';
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconKeyboard,
  IconTemplate,
  IconHistory,
  IconSend,
  IconTrash,
  IconUndo,
  IconRedo,
  IconCopy,
  IconPaste,
  IconDeviceFloppy,
  IconClipboard,
  IconBold,
  IconItalic,
  IconList,
  IconCheck,
  IconX,
  IconDotsVertical,
  IconBulb,
  IconStethoscope,
} from '@tabler/icons-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { VoiceClinicalNoteInput } from './VoiceClinicalNoteInput';

interface TouchClinicalNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  patientId?: string;
  encounterType?: string;
  onSave?: (note: string) => Promise<void>;
  onTemplateSelect?: (template: string) => void;
  className?: string;
}

interface GestureConfig {
  enabled: boolean;
  swipeToUndo: boolean;
  doubleTapToRedo: boolean;
  longPressForMenu: boolean;
  pinchToZoom: boolean;
}

interface ClinicalTemplate {
  id: string;
  name: string;
  content: string;
  category: 'assessment' | 'plan' | 'history' | 'examination' | 'discharge';
}

const DEFAULT_TEMPLATES: ClinicalTemplate[] = [
  {
    id: 'soap-assessment',
    name: 'SOAP Assessment',
    content: `Subjective:
Patient reports...

Objective:
Vital signs: BP __, HR __, RR __, Temp __, O2 Sat __
Physical examination:

Assessment:
1. 

Plan:
1. `,
    category: 'assessment'
  },
  {
    id: 'discharge-summary',
    name: 'Discharge Summary',
    content: `DISCHARGE SUMMARY

Date of Admission: 
Date of Discharge: 
Length of Stay: 

Admitting Diagnosis:
Discharge Diagnosis:

Hospital Course:

Discharge Medications:

Follow-up Instructions:

Patient Education:`,
    category: 'discharge'
  },
  {
    id: 'progress-note',
    name: 'Progress Note',
    content: `Progress Note - ${new Date().toLocaleDateString()}

Interval History:

Review of Systems:

Physical Examination:

Assessment and Plan:
1. `,
    category: 'assessment'
  }
];

export function TouchClinicalNoteInput({
  value,
  onChange,
  placeholder = "Document clinical notes...",
  label = "Clinical Documentation",
  disabled = false,
  patientId,
  encounterType,
  onSave,
  onTemplateSelect,
  className,
}: TouchClinicalNoteInputProps) {
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [isGestureMode, setIsGestureMode] = useState(false);
  const [undoHistory, setUndoHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [gestureConfig, setGestureConfig] = useState<GestureConfig>({
    enabled: true,
    swipeToUndo: true,
    doubleTapToRedo: true,
    longPressForMenu: true,
    pinchToZoom: false,
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [isLongPress, setIsLongPress] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const gestureStartDistance = useRef(0);

  const {
    buttonPress,
    successAction,
    errorAction,
    trigger,
    medicationConfirm,
  } = useHapticFeedback();

  const voiceRecognition = useVoiceRecognition({
    continuous: true,
    interimResults: true,
    medicalMode: true,
    autoStop: true,
    stopTimeout: 3000,
  });

  // Add to undo history when content changes significantly
  useEffect(() => {
    if (value && value !== undoHistory[undoHistory.length - 1]) {
      setUndoHistory(prev => [...prev.slice(-9), value]); // Keep last 10 states
      setRedoHistory([]); // Clear redo history on new change
    }
  }, [value, undoHistory]);

  const handleUndo = useCallback(() => {
    if (undoHistory.length > 1) {
      const lastState = undoHistory[undoHistory.length - 2];
      setRedoHistory(prev => [value, ...prev]);
      setUndoHistory(prev => prev.slice(0, -1));
      onChange(lastState);
      trigger('navigation');
    }
  }, [undoHistory, value, onChange, trigger]);

  const handleRedo = useCallback(() => {
    if (redoHistory.length > 0) {
      const nextState = redoHistory[0];
      setUndoHistory(prev => [...prev, value]);
      setRedoHistory(prev => prev.slice(1));
      onChange(nextState);
      trigger('navigation');
    }
  }, [redoHistory, value, onChange, trigger]);

  const handleSave = useCallback(async () => {
    if (!onSave || !value.trim()) return;

    setIsSaving(true);
    try {
      await onSave(value);
      successAction();
    } catch (error) {
      errorAction();
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, value, successAction, errorAction]);

  const handleTemplateSelect = useCallback((template: ClinicalTemplate) => {
    const newContent = value ? `${value}\n\n${template.content}` : template.content;
    onChange(newContent);
    setShowTemplates(false);
    onTemplateSelect?.(template.content);
    medicationConfirm();
  }, [value, onChange, onTemplateSelect, medicationConfirm]);

  const insertTextAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }, [value, onChange]);

  // Gesture handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!gestureConfig.enabled) return;

    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setIsLongPress(false);

    // Handle multi-touch for pinch zoom
    if (e.touches.length === 2 && gestureConfig.pinchToZoom) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      gestureStartDistance.current = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    }

    // Long press detection
    if (gestureConfig.longPressForMenu) {
      longPressTimer.current = setTimeout(() => {
        setIsLongPress(true);
        trigger('button-press');
        // Show context menu
      }, 500);
    }

    // Double tap detection
    const now = Date.now();
    if (now - lastTapTime < 300 && gestureConfig.doubleTapToRedo) {
      handleRedo();
    }
    setLastTapTime(now);
  }, [gestureConfig, trigger, handleRedo, lastTapTime]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!gestureConfig.enabled) return;

    // Clear long press if touch moves significantly
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimer.current);
    }

    // Handle pinch zoom
    if (e.touches.length === 2 && gestureConfig.pinchToZoom) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      const scale = currentDistance / gestureStartDistance.current;
      const newZoom = Math.max(0.8, Math.min(2, zoomLevel * scale));
      setZoomLevel(newZoom);
    }
  }, [gestureConfig, touchStartPos, zoomLevel]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!gestureConfig.enabled) return;

    clearTimeout(longPressTimer.current);

    if (isLongPress) return; // Don't process swipe if it was a long press

    // Handle swipe gestures
    if (gestureConfig.swipeToUndo) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartPos.x;
      const deltaY = touch.clientY - touchStartPos.y;
      
      const swipeThreshold = 50;
      const maxVerticalDeviation = 30;
      
      if (Math.abs(deltaY) < maxVerticalDeviation) {
        if (deltaX > swipeThreshold) {
          // Right swipe - redo
          handleRedo();
        } else if (deltaX < -swipeThreshold) {
          // Left swipe - undo
          handleUndo();
        }
      }
    }
  }, [gestureConfig, isLongPress, touchStartPos, handleUndo, handleRedo]);

  const quickInserts = useMemo(() => [
    { label: 'Vital Signs', text: 'Vital signs: BP __, HR __, RR __, Temp __, O2 Sat __' },
    { label: 'Normal PE', text: 'Physical examination: Patient appears in no acute distress. HEENT, CV, Lungs, Abd, Ext: WNL.' },
    { label: 'A&P', text: 'Assessment and Plan:\n1. ' },
    { label: 'Follow-up', text: 'Follow-up in clinic in __ days/weeks. Patient education provided. RTC PRN.' },
    { label: 'No Allergies', text: 'No known drug allergies.' },
    { label: 'Medication', text: 'Prescribed: __ mg __ times daily for __ days.' },
  ], []);

  const formatText = useCallback((format: 'bold' | 'italic' | 'list') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let formattedText = selectedText;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'list':
        formattedText = selectedText.split('\n').map(line => 
          line.trim() ? `• ${line}` : line
        ).join('\n');
        break;
    }
    
    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);
    buttonPress();
  }, [value, onChange, buttonPress]);

  return (
    <Stack gap="sm" className={className}>
      {/* Header with mode selection */}
      <Group justify="space-between" align="center">
        <Text fw={500} size="sm">{label}</Text>
        <Group gap="xs">
          <Badge 
            color={inputMode === 'voice' ? 'green' : 'blue'} 
            variant="light" 
            size="xs"
          >
            {inputMode === 'voice' ? 'Voice' : 'Text'} Mode
          </Badge>
          {gestureConfig.enabled && (
            <Badge color="purple" variant="outline" size="xs">
              Gestures
            </Badge>
          )}
        </Group>
      </Group>

      {/* Input mode toggle */}
      <Paper p="xs" withBorder>
        <Group justify="space-between">
          <Group gap="xs">
            <Tooltip label="Text input mode">
              <ActionIcon
                size="lg"
                variant={inputMode === 'text' ? 'filled' : 'outline'}
                color="blue"
                onClick={() => {
                  setInputMode('text');
                  buttonPress();
                }}
                className="min-h-[44px] min-w-[44px]"
              >
                <IconKeyboard size={20} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Voice input mode">
              <ActionIcon
                size="lg"
                variant={inputMode === 'voice' ? 'filled' : 'outline'}
                color="green"
                onClick={() => {
                  setInputMode('voice');
                  buttonPress();
                }}
                className="min-h-[44px] min-w-[44px]"
              >
                {voiceRecognition.isListening ? (
                  <IconMicrophoneOff size={20} />
                ) : (
                  <IconMicrophone size={20} />
                )}
              </ActionIcon>
            </Tooltip>

            <Divider orientation="vertical" />

            <Tooltip label="Clinical templates">
              <ActionIcon
                size="lg"
                variant="outline"
                onClick={() => setShowTemplates(true)}
                className="min-h-[44px] min-w-[44px]"
              >
                <IconTemplate size={20} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Note history">
              <ActionIcon
                size="lg"
                variant="outline"
                onClick={() => setShowHistory(true)}
                className="min-h-[44px] min-w-[44px]"
              >
                <IconHistory size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Group gap="xs">
            <Tooltip label="Undo">
              <ActionIcon
                size="lg"
                variant="outline"
                onClick={handleUndo}
                disabled={undoHistory.length <= 1}
                className="min-h-[44px] min-w-[44px]"
              >
                <IconUndo size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Redo">
              <ActionIcon
                size="lg"
                variant="outline"
                onClick={handleRedo}
                disabled={redoHistory.length === 0}
                className="min-h-[44px] min-w-[44px]"
              >
                <IconRedo size={18} />
              </ActionIcon>
            </Tooltip>

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon
                  size="lg"
                  variant="outline"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item 
                  leftSection={<IconCopy size={16} />}
                  onClick={() => navigator.clipboard.writeText(value)}
                >
                  Copy All
                </Menu.Item>
                <Menu.Item 
                  leftSection={<IconPaste size={16} />}
                  onClick={async () => {
                    const text = await navigator.clipboard.readText();
                    insertTextAtCursor(text);
                  }}
                >
                  Paste
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item 
                  leftSection={<IconTrash size={16} />}
                  color="red"
                  onClick={() => onChange('')}
                >
                  Clear All
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* Voice mode */}
      {inputMode === 'voice' && (
        <VoiceClinicalNoteInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          showSuggestions={true}
        />
      )}

      {/* Text mode */}
      {inputMode === 'text' && (
        <Box pos="relative">
          {/* Text formatting toolbar */}
          <Paper p="xs" withBorder mb="xs">
            <Group gap="xs">
              <Tooltip label="Bold">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  onClick={() => formatText('bold')}
                >
                  <IconBold size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Italic">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  onClick={() => formatText('italic')}
                >
                  <IconItalic size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="List">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  onClick={() => formatText('list')}
                >
                  <IconList size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autosize
            minRows={6}
            maxRows={20}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            styles={{
              input: {
                fontSize: `${16 * zoomLevel}px`,
                lineHeight: 1.5,
                touchAction: 'manipulation',
                minHeight: '48px',
              }
            }}
          />

          {/* Quick insert buttons */}
          <Paper p="sm" withBorder mt="xs">
            <Text size="xs" fw={500} mb="xs" c="dimmed">
              Quick Insert:
            </Text>
            <ScrollArea>
              <Group gap="xs">
                {quickInserts.map((item) => (
                  <Chip
                    key={item.label}
                    size="sm"
                    variant="outline"
                    onClick={() => insertTextAtCursor(item.text + '\n')}
                    className="cursor-pointer"
                  >
                    {item.label}
                  </Chip>
                ))}
              </Group>
            </ScrollArea>
          </Paper>
        </Box>
      )}

      {/* Footer actions */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {value.length} characters
          </Text>
          {gestureConfig.enabled && (
            <Text size="xs" c="blue">
              Swipe: ← Undo | → Redo
            </Text>
          )}
        </Group>

        <Group gap="xs">
          {onSave && (
            <Button
              size="sm"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!value.trim() || disabled}
              className="min-h-[44px]"
            >
              Save Note
            </Button>
          )}
        </Group>
      </Group>

      {/* Templates Modal */}
      <Modal
        opened={showTemplates}
        onClose={() => setShowTemplates(false)}
        title="Clinical Templates"
        size="lg"
      >
        <Stack gap="sm">
          {DEFAULT_TEMPLATES.map((template) => (
            <Paper
              key={template.id}
              p="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => handleTemplateSelect(template)}
              className="hover:bg-gray-50"
            >
              <Group justify="space-between" mb="xs">
                <Text fw={500}>{template.name}</Text>
                <Badge size="xs" variant="light">
                  {template.category}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed" truncate>
                {template.content.substring(0, 100)}...
              </Text>
            </Paper>
          ))}
        </Stack>
      </Modal>

      {/* Gesture help */}
      {gestureConfig.enabled && (
        <Alert icon={<IconBulb size={16} />} color="blue" variant="light">
          <Text size="xs">
            <strong>Gesture Controls:</strong><br/>
            • Swipe left: Undo last action<br/>
            • Swipe right: Redo action<br/>
            • Double tap: Quick redo<br/>
            • Long press: Context menu
          </Text>
        </Alert>
      )}
    </Stack>
  );
}

export default TouchClinicalNoteInput;