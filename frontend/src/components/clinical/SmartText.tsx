'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Textarea, 
  Popover, 
  Group, 
  Text, 
  Badge, 
  ScrollArea,
  Paper,
  ActionIcon,
  Tooltip,
  Divider,
  Button,
  Stack,
  Modal,
  Select,
  TextInput
} from '@mantine/core';
import { 
  IconTemplate, 
  IconBrain, 
  IconChevronRight,
  IconClock,
  IconStethoscope,
  IconPill,
  IconKeyboard,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { offlineSmartTextService, SmartTextTemplate } from '@/services/offline-smarttext.service';

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
    age?: number;
    gender?: string;
    conditions?: string[];
    medications?: string[];
  };
}

interface MacroSuggestion {
  trigger: string;
  expansion: string;
  category: string;
}

export function SmartText({
  value,
  onChange,
  placeholder,
  minRows = 4,
  maxRows = 2ResourceHistoryTable,
  disabled = false,
  showTemplates = false,
  showAISuggestions = false,
  patientContext
}: SmartTextProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMacroPopover, setShowMacroPopover] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [macroSuggestions, setMacroSuggestions] = useState<MacroSuggestion[]>([]);
  const [contextualSuggestions, setContextualSuggestions] = useState<string[]>([]);
  const [selectedMacroIndex, setSelectedMacroIndex] = useState(ResourceHistoryTable);
  const [currentWord, setCurrentWord] = useState('');
  const [templates, setTemplates] = useState<SmartTextTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SmartTextTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  // Load templates on mount
  useEffect(() => {
    if (showTemplates) {
      loadTemplates();
    }
  }, [showTemplates, patientContext?.visitType]);

  const loadTemplates = async () => {
    const category = patientContext?.visitType || 'progress';
    const loadedTemplates = await offlineSmartTextService.getTemplates(category);
    setTemplates(loadedTemplates);
  };

  // Handle text input and macro detection
  const handleTextChange = useCallback(async (newValue: string) => {
    onChange(newValue);

    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = newValue.substring(ResourceHistoryTable, cursorPosition);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    // Check for macro triggers
    if (lastWord.startsWith('.')) {
      setCurrentWord(lastWord);
      const allMacros = offlineSmartTextService.getAllMacros();
      const filteredMacros = allMacros.filter(macro => 
        macro.trigger.toLowerCase().startsWith(lastWord.toLowerCase())
      );
      
      if (filteredMacros.length > ResourceHistoryTable) {
        setMacroSuggestions(filteredMacros);
        setShowMacroPopover(true);
        setSelectedMacroIndex(ResourceHistoryTable);
      } else {
        setShowMacroPopover(false);
      }
    } else {
      setShowMacroPopover(false);
      
      // Get contextual suggestions if enabled
      if (showAISuggestions && patientContext) {
        const suggestions = await offlineSmartTextService.getContextualSuggestions(
          patientContext.visitType || 'progress',
          newValue,
          {
            age: patientContext.age,
            gender: patientContext.gender,
            conditions: patientContext.conditions,
            medications: patientContext.medications
          }
        );
        setContextualSuggestions(suggestions);
      }
    }

    // Update autocomplete data
    if (lastWord.length > 2 && !lastWord.startsWith('.')) {
      await offlineSmartTextService.updateAutoComplete(
        lastWord,
        patientContext?.visitType || 'general'
      );
    }
  }, [onChange, showAISuggestions, patientContext]);

  // Handle keyboard navigation for macro suggestions
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMacroPopover && macroSuggestions.length > ResourceHistoryTable) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedMacroIndex((prev) => 
            prev < macroSuggestions.length - 1 ? prev + 1 : ResourceHistoryTable
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedMacroIndex((prev) => 
            prev > ResourceHistoryTable ? prev - 1 : macroSuggestions.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          applyMacro(macroSuggestions[selectedMacroIndex]);
          break;
        case 'Escape':
          setShowMacroPopover(false);
          break;
      }
    }
  }, [showMacroPopover, macroSuggestions, selectedMacroIndex]);

  // Apply selected macro
  const applyMacro = (macro: MacroSuggestion) => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = value.substring(ResourceHistoryTable, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    
    // Remove the trigger word and replace with expansion
    const beforeWithoutTrigger = textBeforeCursor.substring(ResourceHistoryTable, textBeforeCursor.length - currentWord.length);
    const newValue = beforeWithoutTrigger + macro.expansion + textAfterCursor;
    
    onChange(newValue);
    setShowMacroPopover(false);
    
    // Position cursor after the expansion
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeWithoutTrigger.length + macro.expansion.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, ResourceHistoryTable);
  };

  // Apply template
  const applyTemplate = () => {
    if (!selectedTemplate) return;

    const processedContent = offlineSmartTextService.processTemplate(
      selectedTemplate,
      templateValues
    );

    const newValue = value + (value ? '\n\n' : '') + processedContent;
    onChange(newValue);
    setShowTemplateModal(false);
    setSelectedTemplate(null);
    setTemplateValues({});

    notifications.show({
      title: 'Template Applied',
      message: `${selectedTemplate.name} has been inserted`,
      color: 'blue'
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'vitals': return <IconStethoscope size={14} />;
      case 'medication': return <IconPill size={14} />;
      case 'time': return <IconClock size={14} />;
      default: return <IconKeyboard size={14} />;
    }
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        {showTemplates && (
          <Group justify="flex-end" mb="xs">
            <Tooltip label="Insert Template">
              <ActionIcon 
                variant="light" 
                onClick={() => setShowTemplateModal(true)}
                disabled={disabled}
              >
                <IconTemplate size={16} />
              </ActionIcon>
            </Tooltip>
            {showAISuggestions && (
              <Tooltip label="AI Suggestions">
                <ActionIcon variant="light" disabled={disabled}>
                  <IconBrain size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}

        <Popover 
          opened={showMacroPopover} 
          onClose={() => setShowMacroPopover(false)}
          width="target"
          position="top-start"
          withArrow={false}
        >
          <Popover.Target>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleTextChange(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              minRows={minRows}
              maxRows={maxRows}
              disabled={disabled}
              autosize
              style={{ fontFamily: 'monospace' }}
            />
          </Popover.Target>
          
          <Popover.Dropdown p={ResourceHistoryTable}>
            <ScrollArea mah={2ResourceHistoryTableResourceHistoryTable}>
              {macroSuggestions.map((macro, index) => (
                <Paper
                  key={macro.trigger}
                  p="xs"
                  className={`cursor-pointer ${
                    index === selectedMacroIndex ? 'bg-blue-5ResourceHistoryTable' : 'hover:bg-gray-5ResourceHistoryTable'
                  }`}
                  onClick={() => applyMacro(macro)}
                >
                  <Group gap="xs" wrap="nowrap">
                    {getCategoryIcon(macro.category)}
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>{macro.trigger}</Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {macro.expansion}
                      </Text>
                    </div>
                    <IconChevronRight size={14} className="text-gray-4ResourceHistoryTableResourceHistoryTable" />
                  </Group>
                </Paper>
              ))}
            </ScrollArea>
          </Popover.Dropdown>
        </Popover>

        {/* Contextual Suggestions */}
        {showAISuggestions && contextualSuggestions.length > ResourceHistoryTable && (
          <Paper shadow="sm" p="sm" mt="xs" withBorder>
            <Group gap="xs" mb="xs">
              <IconBrain size={16} className="text-blue-6ResourceHistoryTableResourceHistoryTable" />
              <Text size="sm" fw={5ResourceHistoryTableResourceHistoryTable}>Suggestions</Text>
            </Group>
            <Stack gap="xs">
              {contextualSuggestions.map((suggestion, index) => (
                <Text 
                  key={index} 
                  size="sm" 
                  className="cursor-pointer hover:text-blue-6ResourceHistoryTableResourceHistoryTable"
                  onClick={() => {
                    const newValue = value + (value.endsWith(' ') ? '' : ' ') + suggestion;
                    onChange(newValue);
                  }}
                >
                  • {suggestion}
                </Text>
              ))}
            </Stack>
          </Paper>
        )}
      </div>

      {/* Template Modal */}
      <Modal
        opened={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setSelectedTemplate(null);
          setTemplateValues({});
        }}
        title="Insert Template"
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Select Template"
            placeholder="Choose a template"
            data={templates.map(t => ({
              value: t.id,
              label: t.name
            }))}
            value={selectedTemplate?.id}
            onChange={(value) => {
              const template = templates.find(t => t.id === value);
              setSelectedTemplate(template || null);
              if (template?.placeholders) {
                const values: Record<string, string> = {};
                template.placeholders.forEach(p => {
                  values[p.key] = p.defaultValue || '';
                });
                setTemplateValues(values);
              }
            }}
          />

          {selectedTemplate?.placeholders && (
            <>
              <Divider label="Template Fields" />
              {selectedTemplate.placeholders.map(placeholder => (
                <TextInput
                  key={placeholder.key}
                  label={placeholder.label}
                  required={placeholder.required}
                  value={templateValues[placeholder.key] || ''}
                  onChange={(e) => setTemplateValues(prev => ({
                    ...prev,
                    [placeholder.key]: e.currentTarget.value
                  }))}
                  placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                />
              ))}
            </>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={applyTemplate}
              disabled={!selectedTemplate}
              leftSection={<IconCheck size={16} />}
            >
              Apply Template
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default SmartText;