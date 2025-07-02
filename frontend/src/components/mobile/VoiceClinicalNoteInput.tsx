'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Textarea,
  Button,
  Group,
  Stack,
  Text,
  Progress,
  Badge,
  ActionIcon,
  Tooltip,
  Alert,
  Paper,
  Box,
  ScrollArea,
  Chip,
  Divider,
} from '@mantine/core';
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconVolume,
  IconSettings,
  IconBulb,
} from '@tabler/icons-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  voiceRecognitionService,
  VoiceRecognitionResult,
  VoiceRecognitionStatus,
  VoiceRecognitionOptions,
} from '@/services/voice-recognition.service';

interface VoiceClinicalNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  showSuggestions?: boolean;
  className?: string;
}

export function VoiceClinicalNoteInput({
  value,
  onChange,
  placeholder = "Start typing or use voice input to document clinical notes...",
  label = "Clinical Notes",
  disabled = false,
  autoResize = true,
  minRows = 4,
  maxRows = 12,
  showSuggestions = true,
  className,
}: VoiceClinicalNoteInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<VoiceRecognitionStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Array<{transcript: string; confidence: number}>>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef(0);
  
  const { 
    buttonPress, 
    successAction, 
    errorAction, 
    trigger 
  } = useHapticFeedback();

  useEffect(() => {
    setIsSupported(voiceRecognitionService.isAvailable());
  }, []);

  const insertTextAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = value || '';
    
    const newValue = 
      currentValue.substring(0, start) + 
      text + 
      currentValue.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }, [value, onChange]);

  const handleVoiceResult = useCallback((result: VoiceRecognitionResult) => {
    if (result.isFinal) {
      // Insert final transcript at cursor position
      insertTextAtCursor(result.transcript + ' ');
      setInterimText('');
      setConfidence(result.confidence);
      setAlternatives(result.alternatives || []);
      
      if (result.confidence > 0.8) {
        successAction();
      }
    } else {
      // Show interim results
      setInterimText(result.transcript);
      setConfidence(result.confidence);
    }
  }, [insertTextAtCursor, successAction]);

  const handleVoiceError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setInterimText('');
    errorAction();
    
    // Auto-clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, [errorAction]);

  const handleStatusChange = useCallback((newStatus: VoiceRecognitionStatus) => {
    setStatus(newStatus);
    
    if (newStatus === 'listening') {
      trigger('data-entry');
    }
  }, [trigger]);

  const startVoiceRecognition = useCallback(() => {
    if (!isSupported) {
      setError('Voice recognition is not supported on this device');
      return;
    }

    // Store current cursor position
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart;
    }

    const options: VoiceRecognitionOptions = {
      continuous: true,
      interimResults: true,
      language: 'en-US',
      maxAlternatives: 3,
      medicalMode: true,
    };

    const success = voiceRecognitionService.start(options, {
      onResult: handleVoiceResult,
      onError: handleVoiceError,
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onStatusChange: handleStatusChange,
    });

    if (success) {
      buttonPress();
      setError(null);
    }
  }, [isSupported, handleVoiceResult, handleVoiceError, handleStatusChange, buttonPress]);

  const stopVoiceRecognition = useCallback(() => {
    voiceRecognitionService.stop();
    setIsListening(false);
    setInterimText('');
    buttonPress();
  }, [buttonPress]);

  const clearText = useCallback(() => {
    onChange('');
    setInterimText('');
    setAlternatives([]);
    buttonPress();
  }, [onChange, buttonPress]);

  const useAlternative = useCallback((alternative: string) => {
    // Replace the last sentence with the alternative
    const sentences = value.split(/[.!?]+/);
    if (sentences.length > 1) {
      sentences[sentences.length - 2] = alternative;
      onChange(sentences.join('. ') + '.');
    } else {
      onChange(alternative + '.');
    }
    setAlternatives([]);
    successAction();
  }, [value, onChange, successAction]);

  const getStatusColor = (status: VoiceRecognitionStatus) => {
    switch (status) {
      case 'listening': return 'green';
      case 'processing': return 'blue';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = (status: VoiceRecognitionStatus) => {
    switch (status) {
      case 'listening': return 'Listening...';
      case 'processing': return 'Processing...';
      case 'error': return 'Error';
      case 'not-supported': return 'Not Supported';
      default: return 'Ready';
    }
  };

  const medicalSuggestions = [
    "Patient appears in no acute distress",
    "Vital signs are stable",
    "Physical examination reveals",
    "Assessment and plan:",
    "Follow up in clinic",
    "Patient education provided regarding",
    "No allergies to medications",
    "Review of systems is negative except as noted",
  ];

  return (
    <Stack gap="sm" className={className}>
      {/* Label and Status */}
      <Group justify="space-between" align="center">
        <Text fw={500} size="sm">{label}</Text>
        {isSupported && (
          <Group gap="xs">
            <Badge 
              size="xs" 
              color={getStatusColor(status)}
              variant="light"
            >
              {getStatusText(status)}
            </Badge>
            {confidence > 0 && (
              <Badge size="xs" color="blue" variant="outline">
                {Math.round(confidence * 100)}% confident
              </Badge>
            )}
          </Group>
        )}
      </Group>

      {/* Voice Controls */}
      {isSupported && (
        <Paper p="xs" withBorder>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Tooltip label={isListening ? "Stop listening" : "Start voice input"}>
                <ActionIcon
                  size="lg"
                  color={isListening ? "red" : "blue"}
                  variant={isListening ? "filled" : "outline"}
                  onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                  disabled={disabled}
                  className="min-h-[44px] min-w-[44px]"
                >
                  {isListening ? <IconMicrophoneOff size={20} /> : <IconMicrophone size={20} />}
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Clear all text">
                <ActionIcon
                  size="lg"
                  color="red"
                  variant="outline"
                  onClick={clearText}
                  disabled={disabled || (!value && !interimText)}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Voice input help">
                <ActionIcon
                  size="lg"
                  color="gray"
                  variant="outline"
                  onClick={() => setShowVoiceHelp(!showVoiceHelp)}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <IconBulb size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {isListening && (
              <Group gap="xs">
                <IconVolume size={16} />
                <Progress size="sm" value={confidence * 100} w={60} />
              </Group>
            )}
          </Group>
        </Paper>
      )}

      {/* Error Alert */}
      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          color="red" 
          variant="light"
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      )}

      {/* Voice Help */}
      {showVoiceHelp && (
        <Alert icon={<IconBulb size={16} />} color="blue" variant="light">
          <Text size="sm" fw={500} mb="xs">Voice Input Tips:</Text>
          <Text size="xs">
            • Speak clearly and at normal pace<br/>
            • Medical terms are automatically recognized<br/>
            • Say "period" or "new line" for punctuation<br/>
            • Use "delete that" to remove the last phrase
          </Text>
        </Alert>
      )}

      {/* Main Text Input */}
      <Box pos="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autosize={autoResize}
          minRows={minRows}
          maxRows={maxRows}
          className="mobile-touch-input"
          styles={{
            input: {
              fontSize: '16px', // Prevent zoom on iOS
              minHeight: '48px',
              touchAction: 'manipulation',
            }
          }}
        />
        
        {/* Interim Text Overlay */}
        {interimText && (
          <Box
            pos="absolute"
            top={8}
            left={8}
            right={8}
            bottom={8}
            style={{
              pointerEvents: 'none',
              whiteSpace: 'pre-wrap',
              color: 'rgba(0, 123, 255, 0.6)',
              fontSize: '14px',
              fontStyle: 'italic',
              zIndex: 1,
            }}
          >
            {value}
            <span style={{ backgroundColor: 'rgba(0, 123, 255, 0.1)' }}>
              {interimText}
            </span>
          </Box>
        )}
      </Box>

      {/* Alternative Suggestions */}
      {alternatives.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="xs" fw={500} mb="xs" c="dimmed">
            Did you mean:
          </Text>
          <Stack gap="xs">
            {alternatives.map((alt, index) => (
              <Chip
                key={index}
                size="sm"
                variant="outline"
                onClick={() => useAlternative(alt.transcript)}
                className="cursor-pointer"
              >
                {alt.transcript} ({Math.round(alt.confidence * 100)}%)
              </Chip>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Quick Medical Phrases */}
      {showSuggestions && (
        <Paper p="sm" withBorder>
          <Text size="xs" fw={500} mb="xs" c="dimmed">
            Quick Medical Phrases:
          </Text>
          <ScrollArea h={100}>
            <Group gap="xs">
              {medicalSuggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  size="sm"
                  variant="light"
                  onClick={() => insertTextAtCursor(suggestion + '. ')}
                  className="cursor-pointer"
                >
                  {suggestion}
                </Chip>
              ))}
            </Group>
          </ScrollArea>
        </Paper>
      )}

      {/* Character Count */}
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed">
          {value.length} characters
        </Text>
        {!isSupported && (
          <Text size="xs" c="red">
            Voice input not available on this device
          </Text>
        )}
      </Group>
    </Stack>
  );
}

export default VoiceClinicalNoteInput;