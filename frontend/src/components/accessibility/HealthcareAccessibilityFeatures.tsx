/**
 * Healthcare-Specific Accessibility Features
 * Provides specialized accessibility features for healthcare environments
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Alert, Modal, Stack, Group, Text, ActionIcon, Paper } from '@mantine/core';
import { 
  IconVolume, 
  IconVolumeOff, 
  IconMicrophone, 
  IconMicrophoneOff,
  IconEye,
  IconEyeOff,
  IconEmergencyBed,
  IconHeartHandshake,
  IconShield,
  IconAccessible
} from '@tabler/icons-react';
import { useAccessibility } from '../providers/AccessibilityProvider';
import { useScreenReader } from '../../hooks/useScreenReader';

interface VoiceCommand {
  phrase: string;
  action: () => void;
  description: string;
  contexts?: string[];
}

interface EmergencyAlert {
  id: string;
  type: 'cardiac' | 'respiratory' | 'medication' | 'critical' | 'general';
  message: string;
  priority: 'high' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
}

export function HealthcareAccessibilityFeatures() {
  const { settings, updateSetting } = useAccessibility();
  const { announceEmergency, announceError, announceSuccess } = useScreenReader();
  
  // Voice Control State
  const [isListening, setIsListening] = useState(false);
  const [voiceCommands] = useState<VoiceCommand[]>([
    {
      phrase: 'emergency alert',
      action: () => triggerEmergencyMode(),
      description: 'Activate emergency mode',
      contexts: ['global']
    },
    {
      phrase: 'high contrast on',
      action: () => updateSetting('highContrastMode', true),
      description: 'Enable high contrast mode',
      contexts: ['global']
    },
    {
      phrase: 'high contrast off',
      action: () => updateSetting('highContrastMode', false),
      description: 'Disable high contrast mode',
      contexts: ['global']
    },
    {
      phrase: 'large text on',
      action: () => updateSetting('largeText', true),
      description: 'Enable large text',
      contexts: ['global']
    },
    {
      phrase: 'save patient',
      action: () => handleVoiceSave(),
      description: 'Save current patient data',
      contexts: ['patient']
    },
    {
      phrase: 'navigate dashboard',
      action: () => window.location.href = '/dashboard',
      description: 'Navigate to dashboard',
      contexts: ['global']
    },
  ]);
  
  // Emergency Alert State
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  
  // Speech Recognition
  const recognition = useRef<SpeechRecognition | null>(null);
  const speechSynthesis = useRef<SpeechSynthesis | null>(null);
  
  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && settings.voiceControlEnabled) {
      const SpeechRecognition = 
        window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        recognition.current = new SpeechRecognition();
        recognition.current.continuous = true;
        recognition.current.interimResults = false;
        recognition.current.lang = 'en-US';
        
        recognition.current.onresult = handleVoiceResult;
        recognition.current.onerror = handleVoiceError;
        recognition.current.onend = handleVoiceEnd;
      }
      
      speechSynthesis.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognition.current) {
        recognition.current.stop();
      }
    };
  }, [settings.voiceControlEnabled]);
  
  // Handle voice recognition results
  const handleVoiceResult = useCallback((event: SpeechRecognitionEvent) => {
    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
    
    // Find matching command
    const matchedCommand = voiceCommands.find(cmd => 
      transcript.includes(cmd.phrase)
    );
    
    if (matchedCommand) {
      announceSuccess(`Voice command recognized: ${matchedCommand.description}`);
      matchedCommand.action();
      
      // Provide haptic feedback if supported
      if (settings.hapticFeedback && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } else {
      announceError(`Voice command not recognized: "${transcript}"`);
      
      // Suggest similar commands
      const suggestions = voiceCommands
        .filter(cmd => transcript.split(' ').some(word => cmd.phrase.includes(word)))
        .map(cmd => cmd.phrase);
      
      if (suggestions.length > 0) {
        announceSuccess(`Did you mean: ${suggestions.join(', ')}?`);
      }
    }
  }, [voiceCommands, announceSuccess, announceError, settings.hapticFeedback]);
  
  // Handle voice recognition errors
  const handleVoiceError = useCallback((event: SpeechRecognitionErrorEvent) => {
    console.error('Voice recognition error:', event.error);
    setIsListening(false);
    
    switch (event.error) {
      case 'network':
        announceError('Voice recognition network error');
        break;
      case 'not-allowed':
        announceError('Microphone access denied');
        break;
      case 'no-speech':
        announceError('No speech detected');
        break;
      default:
        announceError('Voice recognition error');
    }
  }, [announceError]);
  
  // Handle voice recognition end
  const handleVoiceEnd = useCallback(() => {
    if (settings.voiceControlEnabled && isListening) {
      // Restart recognition if it was intentionally listening
      setTimeout(() => {
        if (recognition.current && isListening) {
          recognition.current.start();
        }
      }, 100);
    }
  }, [settings.voiceControlEnabled, isListening]);
  
  // Toggle voice control
  const toggleVoiceControl = useCallback(() => {
    if (!recognition.current) {
      announceError('Voice recognition not supported in this browser');
      return;
    }
    
    if (isListening) {
      recognition.current.stop();
      setIsListening(false);
      announceSuccess('Voice control disabled');
    } else {
      recognition.current.start();
      setIsListening(true);
      announceSuccess('Voice control enabled. Say "emergency alert" or other commands.');
    }
  }, [isListening, announceSuccess, announceError]);
  
  // Emergency mode activation
  const triggerEmergencyMode = useCallback(() => {
    updateSetting('emergencyMode', true);
    updateSetting('highContrastMode', true);
    updateSetting('largeText', true);
    updateSetting('announceChanges', true);
    updateSetting('soundAlerts', true);
    
    announceEmergency('Emergency mode activated. High contrast and accessibility features enabled.');
    
    // Add emergency alert
    const alert: EmergencyAlert = {
      id: Date.now().toString(),
      type: 'critical',
      message: 'Emergency accessibility mode activated',
      priority: 'critical',
      timestamp: new Date(),
      acknowledged: false,
    };
    
    setEmergencyAlerts(prev => [alert, ...prev]);
    setShowEmergencyPanel(true);
    
    // Haptic feedback for emergency
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, [updateSetting, announceEmergency]);
  
  // Sterile mode activation
  const toggleSterileMode = useCallback(() => {
    const newSterileMode = !settings.sterileMode;
    updateSetting('sterileMode', newSterileMode);
    updateSetting('voiceControlEnabled', newSterileMode);
    updateSetting('increasedTouchTarget', newSterileMode);
    updateSetting('simplifiedInterface', newSterileMode);
    
    if (newSterileMode) {
      announceSuccess('Sterile mode activated. Voice control and simplified interface enabled.');
      if (!isListening && recognition.current) {
        toggleVoiceControl();
      }
    } else {
      announceSuccess('Sterile mode deactivated.');
      if (isListening) {
        toggleVoiceControl();
      }
    }
  }, [settings.sterileMode, updateSetting, announceSuccess, isListening, toggleVoiceControl]);
  
  // Handle voice save command
  const handleVoiceSave = useCallback(() => {
    // This would integrate with your actual save logic
    const saveEvent = new CustomEvent('voiceSave', {
      detail: { source: 'voice-command' }
    });
    window.dispatchEvent(saveEvent);
    announceSuccess('Save command executed');
  }, [announceSuccess]);
  
  // Text-to-speech for important information
  const speakText = useCallback((text: string, priority: 'normal' | 'high' = 'normal') => {
    if (!speechSynthesis.current || !settings.soundAlerts) return;
    
    // Cancel previous speech if high priority
    if (priority === 'high') {
      speechSynthesis.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.emergencyMode ? 1.2 : 1.0;
    utterance.volume = settings.emergencyMode ? 1.0 : 0.8;
    utterance.pitch = priority === 'high' ? 1.2 : 1.0;
    
    speechSynthesis.current.speak(utterance);
  }, [settings.soundAlerts, settings.emergencyMode]);
  
  // Acknowledge emergency alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setEmergencyAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
    announceSuccess('Alert acknowledged');
  }, [announceSuccess]);
  
  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    setEmergencyAlerts([]);
    setShowEmergencyPanel(false);
    announceSuccess('All alerts cleared');
  }, [announceSuccess]);
  
  return (
    <>
      {/* Healthcare Accessibility Toolbar */}
      <Paper 
        className="fixed bottom-4 right-4 z-50 p-2"
        shadow="lg"
        role="toolbar"
        aria-label="Healthcare accessibility controls"
      >
        <Group gap="xs">
          {/* Emergency Mode Toggle */}
          <ActionIcon
            color={settings.emergencyMode ? 'red' : 'gray'}
            variant={settings.emergencyMode ? 'filled' : 'light'}
            onClick={triggerEmergencyMode}
            aria-label="Activate emergency mode"
            size="lg"
            className="emergency-mode-button"
          >
            <IconEmergencyBed size={20} />
          </ActionIcon>
          
          {/* Sterile Mode Toggle */}
          <ActionIcon
            color={settings.sterileMode ? 'blue' : 'gray'}
            variant={settings.sterileMode ? 'filled' : 'light'}
            onClick={toggleSterileMode}
            aria-label={`${settings.sterileMode ? 'Disable' : 'Enable'} sterile mode`}
            size="lg"
          >
            <IconShield size={20} />
          </ActionIcon>
          
          {/* Voice Control Toggle */}
          <ActionIcon
            color={isListening ? 'green' : 'gray'}
            variant={isListening ? 'filled' : 'light'}
            onClick={toggleVoiceControl}
            disabled={!settings.voiceControlEnabled}
            aria-label={`${isListening ? 'Disable' : 'Enable'} voice control`}
            size="lg"
          >
            {isListening ? <IconMicrophone size={20} /> : <IconMicrophoneOff size={20} />}
          </ActionIcon>
          
          {/* High Contrast Toggle */}
          <ActionIcon
            color={settings.highContrastMode ? 'dark' : 'gray'}
            variant={settings.highContrastMode ? 'filled' : 'light'}
            onClick={() => updateSetting('highContrastMode', !settings.highContrastMode)}
            aria-label={`${settings.highContrastMode ? 'Disable' : 'Enable'} high contrast mode`}
            size="lg"
          >
            <IconEye size={20} />
          </ActionIcon>
          
          {/* Sound Alerts Toggle */}
          <ActionIcon
            color={settings.soundAlerts ? 'blue' : 'gray'}
            variant={settings.soundAlerts ? 'filled' : 'light'}
            onClick={() => updateSetting('soundAlerts', !settings.soundAlerts)}
            aria-label={`${settings.soundAlerts ? 'Disable' : 'Enable'} sound alerts`}
            size="lg"
          >
            {settings.soundAlerts ? <IconVolume size={20} /> : <IconVolumeOff size={20} />}
          </ActionIcon>
          
          {/* Accessibility Panel Toggle */}
          {emergencyAlerts.length > 0 && (
            <ActionIcon
              color="red"
              variant="filled"
              onClick={() => setShowEmergencyPanel(true)}
              aria-label={`View ${emergencyAlerts.length} emergency alerts`}
              size="lg"
              className="pulse-animation"
            >
              <IconHeartHandshake size={20} />
            </ActionIcon>
          )}
        </Group>
      </Paper>
      
      {/* Emergency Alerts Panel */}
      <Modal
        opened={showEmergencyPanel}
        onClose={() => setShowEmergencyPanel(false)}
        title="Emergency Alerts"
        size="lg"
        role="alertdialog"
        aria-labelledby="emergency-alerts-title"
        aria-describedby="emergency-alerts-description"
        trapFocus
        closeOnEscape={false}
      >
        <Stack gap="md">
          <Text id="emergency-alerts-description" size="sm" c="dimmed">
            {emergencyAlerts.length} active emergency alert(s)
          </Text>
          
          {emergencyAlerts.map((alert) => (
            <Alert
              key={alert.id}
              color={alert.priority === 'critical' ? 'red' : 'orange'}
              title={`${alert.type.toUpperCase()} ALERT`}
              icon={<IconEmergencyBed size={16} />}
              role="alert"
              aria-live="assertive"
              className={alert.acknowledged ? 'opacity-60' : ''}
            >
              <Stack gap="xs">
                <Text size="sm">{alert.message}</Text>
                <Text size="xs" c="dimmed">
                  {alert.timestamp.toLocaleTimeString()}
                </Text>
                {!alert.acknowledged && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => acknowledgeAlert(alert.id)}
                    aria-label={`Acknowledge ${alert.type} alert`}
                  >
                    Acknowledge
                  </Button>
                )}
              </Stack>
            </Alert>
          ))}
          
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowEmergencyPanel(false)}>
              Close
            </Button>
            <Button color="red" onClick={clearAllAlerts}>
              Clear All Alerts
            </Button>
          </Group>
        </Stack>
      </Modal>
      
      {/* Voice Command Status */}
      {isListening && (
        <Paper
          className="fixed top-4 right-4 z-50 p-3"
          shadow="md"
          role="status"
          aria-live="polite"
        >
          <Group gap="sm">
            <IconMicrophone size={16} className="text-green-600 animate-pulse" />
            <Text size="sm" fw={500}>Listening for voice commands...</Text>
          </Group>
        </Paper>
      )}
      
      {/* Emergency Mode Overlay */}
      {settings.emergencyMode && (
        <div
          className="fixed inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(45deg, rgba(220, 53, 69, 0.1) 0%, rgba(220, 53, 69, 0.05) 100%)',
            border: '3px solid #dc3545',
          }}
          role="img"
          aria-label="Emergency mode active indicator"
        />
      )}
    </>
  );
}

export default HealthcareAccessibilityFeatures;