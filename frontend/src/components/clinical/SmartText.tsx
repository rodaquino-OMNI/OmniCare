'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Textarea, 
  Menu, 
  Text, 
  Stack, 
  Paper, 
  Badge, 
  Group,
  ActionIcon,
  Button,
  Popover,
  Divider,
  ScrollArea
} from '@mantine/core';
import { 
  IconSparkles, 
  IconTemplate, 
  IconUser, 
  IconStethoscope,
  IconCalendar,
  IconClock,
  IconCheck,
  IconX,
  IconBulb
} from '@tabler/icons-react';
import { useAuth } from '@/stores/auth';
import { formatDateTime } from '@/utils';

interface SmartTextTemplate {
  id: string;
  name: string;
  description: string;
  category: 'assessment' | 'plan' | 'history' | 'examination' | 'discharge' | 'progress';
  template: string;
  variables: string[];
  userTypes: string[];
}

interface SmartTextSuggestion {
  id: string;
  text: string;
  type: 'template' | 'phrase' | 'medication' | 'diagnosis' | 'procedure';
  description?: string;
  category?: string;
}

interface SmartTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
  showTemplates?: boolean;
  showAISuggestions?: boolean;
  patientContext?: {
    patientId: string;
    encounterId?: string;
    visitType?: string;
  };
  onSave?: () => void;
  onCancel?: () => void;
}

const CLINICAL_TEMPLATES: SmartTextTemplate[] = [
  {
    id: 'soap-assessment',
    name: 'SOAP Assessment',
    description: 'Standard SOAP note template',
    category: 'assessment',
    template: `SUBJECTIVE:
{{CHIEF_COMPLAINT}}

OBJECTIVE:
Vital Signs: {{VITAL_SIGNS}}
Physical Examination: {{PHYSICAL_EXAM}}

ASSESSMENT:
{{ASSESSMENT}}

PLAN:
{{PLAN}}`,
    variables: ['CHIEF_COMPLAINT', 'VITAL_SIGNS', 'PHYSICAL_EXAM', 'ASSESSMENT', 'PLAN'],
    userTypes: ['physician', 'nurse']
  },
  {
    id: 'progress-note',
    name: 'Progress Note',
    description: 'Daily progress note template',
    category: 'progress',
    template: `Patient continues with {{CONDITION}}.

Current Status: {{STATUS}}

Interventions: {{INTERVENTIONS}}

Response: {{RESPONSE}}

Plan: {{PLAN}}`,
    variables: ['CONDITION', 'STATUS', 'INTERVENTIONS', 'RESPONSE', 'PLAN'],
    userTypes: ['physician', 'nurse']
  },
  {
    id: 'discharge-summary',
    name: 'Discharge Summary',
    description: 'Hospital discharge summary template',
    category: 'discharge',
    template: `ADMISSION DATE: {{ADMISSION_DATE}}
DISCHARGE DATE: {{DISCHARGE_DATE}}

ADMITTING DIAGNOSIS: {{ADMITTING_DIAGNOSIS}}
DISCHARGE DIAGNOSIS: {{DISCHARGE_DIAGNOSIS}}

HOSPITAL COURSE:
{{HOSPITAL_COURSE}}

DISCHARGE MEDICATIONS:
{{DISCHARGE_MEDICATIONS}}

FOLLOW-UP:
{{FOLLOW_UP}}

DISCHARGE INSTRUCTIONS:
{{DISCHARGE_INSTRUCTIONS}}`,
    variables: ['ADMISSION_DATE', 'DISCHARGE_DATE', 'ADMITTING_DIAGNOSIS', 'DISCHARGE_DIAGNOSIS', 'HOSPITAL_COURSE', 'DISCHARGE_MEDICATIONS', 'FOLLOW_UP', 'DISCHARGE_INSTRUCTIONS'],
    userTypes: ['physician']
  },
  {
    id: 'nursing-assessment',
    name: 'Nursing Assessment',
    description: 'Comprehensive nursing assessment',
    category: 'assessment',
    template: `NURSING ASSESSMENT:

General Appearance: {{GENERAL_APPEARANCE}}
Neurological: {{NEUROLOGICAL}}
Cardiovascular: {{CARDIOVASCULAR}}
Respiratory: {{RESPIRATORY}}
Gastrointestinal: {{GASTROINTESTINAL}}
Genitourinary: {{GENITOURINARY}}
Musculoskeletal: {{MUSCULOSKELETAL}}
Skin/Wounds: {{SKIN_WOUNDS}}

Pain Assessment: {{PAIN_ASSESSMENT}}
Fall Risk: {{FALL_RISK}}
Psychosocial: {{PSYCHOSOCIAL}}

Nursing Diagnosis: {{NURSING_DIAGNOSIS}}
Interventions: {{INTERVENTIONS}}`,
    variables: ['GENERAL_APPEARANCE', 'NEUROLOGICAL', 'CARDIOVASCULAR', 'RESPIRATORY', 'GASTROINTESTINAL', 'GENITOURINARY', 'MUSCULOSKELETAL', 'SKIN_WOUNDS', 'PAIN_ASSESSMENT', 'FALL_RISK', 'PSYCHOSOCIAL', 'NURSING_DIAGNOSIS', 'INTERVENTIONS'],
    userTypes: ['nurse']
  }
];

const SMART_PHRASES: SmartTextSuggestion[] = [
  {
    id: 'normal-exam',
    text: 'Physical examination reveals a well-appearing patient in no acute distress.',
    type: 'phrase',
    description: 'Normal physical exam',
    category: 'examination'
  },
  {
    id: 'stable-condition',
    text: 'Patient remains in stable condition with no acute changes.',
    type: 'phrase',
    description: 'Stable patient status',
    category: 'assessment'
  },
  {
    id: 'pain-free',
    text: 'Patient reports being pain-free at this time.',
    type: 'phrase',
    description: 'No pain reported',
    category: 'subjective'
  },
  {
    id: 'follow-up',
    text: 'Patient advised to follow up with primary care physician in 1-2 weeks.',
    type: 'phrase',
    description: 'Standard follow-up instruction',
    category: 'plan'
  }
];

export function SmartText({
  value,
  onChange,
  placeholder = 'Start typing your clinical note...',
  minRows = 4,
  maxRows = 20,
  disabled = false,
  showTemplates = true,
  showAISuggestions = true,
  patientContext,
  onSave,
  onCancel
}: SmartTextProps) {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartTextSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter templates based on user role
  const availableTemplates = CLINICAL_TEMPLATES.filter(template =>
    template.userTypes.includes(user?.role || '')
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSuggestions) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedSuggestion(prev => 
              prev < suggestions.length - 1 ? prev + 1 : 0
            );
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedSuggestion(prev => 
              prev > 0 ? prev - 1 : suggestions.length - 1
            );
            break;
          case 'Enter':
          case 'Tab':
            e.preventDefault();
            applySuggestion(suggestions[selectedSuggestion]);
            break;
          case 'Escape':
            setShowSuggestions(false);
            break;
        }
      }
    };

    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedSuggestion]);

  const handleTextChange = (newValue: string) => {
    onChange(newValue);
    const textarea = textareaRef.current;
    if (textarea) {
      setCursorPosition(textarea.selectionStart);
    }

    // Trigger smart suggestions
    if (showAISuggestions) {
      triggerSmartSuggestions(newValue);
    }
  };

  const triggerSmartSuggestions = (text: string) => {
    // Simple keyword-based suggestions (in production, this would use AI)
    const lastWords = text.toLowerCase().split(' ').slice(-3).join(' ');
    
    const matchingSuggestions = SMART_PHRASES.filter(phrase =>
      phrase.text.toLowerCase().includes(lastWords) ||
      phrase.description?.toLowerCase().includes(lastWords)
    );

    if (matchingSuggestions.length > 0) {
      setSuggestions(matchingSuggestions);
      setSelectedSuggestion(0);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (suggestion: SmartTextSuggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    const newValue = beforeCursor + suggestion.text + afterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);

    // Set cursor position after the inserted text
    setTimeout(() => {
      const newCursorPos = cursorPosition + suggestion.text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const applyTemplate = (template: SmartTextTemplate) => {
    let templateText = template.template;
    
    // Replace variables with placeholders or patient data
    template.variables.forEach(variable => {
      const placeholder = `[${variable.replace(/_/g, ' ')}]`;
      templateText = templateText.replace(`{{${variable}}}`, placeholder);
    });

    // If there's existing text, add template at cursor position
    const textarea = textareaRef.current;
    if (textarea && value.trim()) {
      const beforeCursor = value.substring(0, cursorPosition);
      const afterCursor = value.substring(cursorPosition);
      const newValue = beforeCursor + '\n\n' + templateText + '\n\n' + afterCursor;
      onChange(newValue);
    } else {
      onChange(templateText);
    }

    setTemplateMenuOpen(false);
  };

  const generateAISuggestion = async () => {
    setIsProcessing(true);
    try {
      // In production, this would call an AI service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiSuggestion = {
        id: 'ai-suggestion',
        text: 'Continue with recommended diagnostic workup including CBC, CMP, and chest X-ray.',
        type: 'phrase' as const,
        description: 'AI-generated suggestion based on context'
      };
      
      setSuggestions([aiSuggestion]);
      setShowSuggestions(true);
      setSelectedSuggestion(0);
    } catch (error) {
      console.error('Error generating AI suggestion:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Stack gap="sm">
      {/* Toolbar */}
      <Group justify="space-between">
        <Group gap="sm">
          {showTemplates && (
            <Menu 
              shadow="md" 
              width={300}
              opened={templateMenuOpen}
              onChange={setTemplateMenuOpen}
            >
              <Menu.Target>
                <Button
                  leftSection={<IconTemplate size={16} />}
                  variant="light"
                  size="sm"
                  disabled={disabled}
                >
                  Templates
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Clinical Templates</Menu.Label>
                {availableTemplates.map(template => (
                  <Menu.Item
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                  >
                    <div>
                      <Text size="sm" fw={500}>{template.name}</Text>
                      <Text size="xs" c="dimmed">{template.description}</Text>
                    </div>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}

          {showAISuggestions && (
            <Button
              leftSection={<IconSparkles size={16} />}
              variant="light"
              size="sm"
              disabled={disabled}
              loading={isProcessing}
              onClick={generateAISuggestion}
            >
              AI Assist
            </Button>
          )}
        </Group>

        <Group gap="sm">
          <Badge variant="light" size="sm">
            {user?.role?.replace('_', ' ').toUpperCase()}
          </Badge>
          <Text size="xs" c="dimmed">
            {formatDateTime(new Date())}
          </Text>
        </Group>
      </Group>

      {/* Text Area with Suggestions */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleTextChange(e.currentTarget.value)}
          placeholder={placeholder}
          minRows={minRows}
          maxRows={maxRows}
          disabled={disabled}
          autosize
          className="font-mono"
          onFocus={() => {
            const textarea = textareaRef.current;
            if (textarea) {
              setCursorPosition(textarea.selectionStart);
            }
          }}
          onSelect={() => {
            const textarea = textareaRef.current;
            if (textarea) {
              setCursorPosition(textarea.selectionStart);
            }
          }}
        />

        {/* Suggestions Popup */}
        {showSuggestions && suggestions.length > 0 && (
          <Paper
            shadow="lg"
            p="xs"
            className="absolute z-50 mt-1 w-full max-w-md"
            style={{ 
              top: '100%',
              left: 0
            }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <IconBulb size={14} />
                <Text size="xs" fw={500}>Smart Suggestions</Text>
              </Group>
              <Divider />
              <ScrollArea mah={200}>
                <Stack gap="xs">
                  {suggestions.map((suggestion, index) => (
                    <Paper
                      key={suggestion.id}
                      p="xs"
                      className={`cursor-pointer transition-colors ${
                        index === selectedSuggestion 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <Text size="sm">{suggestion.text}</Text>
                      {suggestion.description && (
                        <Text size="xs" c="dimmed">{suggestion.description}</Text>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>
        )}
      </div>

      {/* Action Buttons */}
      {(onSave || onCancel) && (
        <Group justify="flex-end" gap="sm">
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
          {onSave && (
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={onSave}
              disabled={!value.trim()}
            >
              Save Note
            </Button>
          )}
        </Group>
      )}

      {/* Context Info */}
      {patientContext && (
        <Paper p="xs" className="bg-blue-50 border border-blue-200">
          <Group gap="md">
            <Text size="xs" c="dimmed">
              <IconUser size={12} className="inline mr-1" />
              Patient: {patientContext.patientId}
            </Text>
            {patientContext.encounterId && (
              <Text size="xs" c="dimmed">
                <IconStethoscope size={12} className="inline mr-1" />
                Encounter: {patientContext.encounterId}
              </Text>
            )}
            {patientContext.visitType && (
              <Text size="xs" c="dimmed">
                <IconCalendar size={12} className="inline mr-1" />
                Visit: {patientContext.visitType}
              </Text>
            )}
          </Group>
        </Paper>
      )}
    </Stack>
  );
}

export default SmartText;