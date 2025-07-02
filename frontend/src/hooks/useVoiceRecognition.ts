/**
 * React hook for voice recognition in healthcare applications
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  voiceRecognitionService,
  VoiceRecognitionResult,
  VoiceRecognitionStatus,
  VoiceRecognitionOptions,
  VoiceRecognitionCallbacks,
} from '@/services/voice-recognition.service';

export interface UseVoiceRecognitionOptions extends VoiceRecognitionOptions {
  autoStart?: boolean;
  autoStop?: boolean;
  stopTimeout?: number;
}

export interface UseVoiceRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  status: VoiceRecognitionStatus;
  error: string | null;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  alternatives: Array<{transcript: string; confidence: number}>;
  
  // Control methods
  start: () => boolean;
  stop: () => void;
  toggle: () => void;
  reset: () => void;
  
  // Utility methods
  getMedicalVocabulary: () => string[];
  getMedicalPhrases: () => string[];
}

/**
 * Main hook for voice recognition
 */
export function useVoiceRecognition(
  options: UseVoiceRecognitionOptions = {},
  callbacks: VoiceRecognitionCallbacks = {}
): UseVoiceRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(voiceRecognitionService.isAvailable());
  const [status, setStatus] = useState<VoiceRecognitionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [alternatives, setAlternatives] = useState<Array<{transcript: string; confidence: number}>>([]);

  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbacksRef = useRef(callbacks);

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const handleResult = useCallback((result: VoiceRecognitionResult) => {
    if (result.isFinal) {
      setTranscript(prev => prev + result.transcript + ' ');
      setInterimTranscript('');
      setConfidence(result.confidence);
      setAlternatives(result.alternatives || []);
      
      // Auto-stop after timeout if configured
      if (options.autoStop && options.stopTimeout) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          stop();
        }, options.stopTimeout);
      }
    } else {
      setInterimTranscript(result.transcript);
      setConfidence(result.confidence);
    }
    
    callbacksRef.current.onResult?.(result);
  }, [options.autoStop, options.stopTimeout]);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setInterimTranscript('');
    callbacksRef.current.onError?.(errorMessage);
  }, []);

  const handleStart = useCallback(() => {
    setIsListening(true);
    setError(null);
    callbacksRef.current.onStart?.();
  }, []);

  const handleEnd = useCallback(() => {
    setIsListening(false);
    setInterimTranscript('');
    clearTimeout(timeoutRef.current);
    callbacksRef.current.onEnd?.();
  }, []);

  const handleStatusChange = useCallback((newStatus: VoiceRecognitionStatus) => {
    setStatus(newStatus);
    callbacksRef.current.onStatusChange?.(newStatus);
  }, []);

  const start = useCallback((): boolean => {
    if (!isSupported) {
      setError('Voice recognition is not supported on this device');
      return false;
    }

    if (isListening) {
      return false;
    }

    const success = voiceRecognitionService.start(options, {
      onResult: handleResult,
      onError: handleError,
      onStart: handleStart,
      onEnd: handleEnd,
      onStatusChange: handleStatusChange,
    });

    return success;
  }, [isSupported, isListening, options, handleResult, handleError, handleStart, handleEnd, handleStatusChange]);

  const stop = useCallback(() => {
    voiceRecognitionService.stop();
    clearTimeout(timeoutRef.current);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setConfidence(0);
    setAlternatives([]);
  }, [stop]);

  const getMedicalVocabulary = useCallback(() => {
    return voiceRecognitionService.getMedicalVocabulary();
  }, []);

  const getMedicalPhrases = useCallback(() => {
    return voiceRecognitionService.getMedicalPhrases();
  }, []);

  // Auto-start if configured
  useEffect(() => {
    if (options.autoStart && isSupported && !isListening) {
      start();
    }
  }, [options.autoStart, isSupported, isListening, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      if (isListening) {
        voiceRecognitionService.abort();
      }
    };
  }, [isListening]);

  return {
    isListening,
    isSupported,
    status,
    error,
    transcript,
    interimTranscript,
    confidence,
    alternatives,
    start,
    stop,
    toggle,
    reset,
    getMedicalVocabulary,
    getMedicalPhrases,
  };
}

/**
 * Simplified hook for clinical note dictation
 */
export function useClinicalDictation(
  onTranscript?: (text: string) => void,
  options: UseVoiceRecognitionOptions = {}
) {
  const voiceOptions: UseVoiceRecognitionOptions = {
    continuous: true,
    interimResults: true,
    language: 'en-US',
    medicalMode: true,
    autoStop: true,
    stopTimeout: 3000, // Stop after 3 seconds of silence
    ...options,
  };

  const voice = useVoiceRecognition(voiceOptions, {
    onResult: (result) => {
      if (result.isFinal && onTranscript) {
        onTranscript(result.transcript);
      }
    },
  });

  return voice;
}

/**
 * Hook for medical command recognition
 */
export function useMedicalCommands(
  commands: Record<string, () => void>,
  options: UseVoiceRecognitionOptions = {}
) {
  const commandOptions: UseVoiceRecognitionOptions = {
    continuous: false,
    interimResults: false,
    language: 'en-US',
    medicalMode: true,
    ...options,
  };

  const voice = useVoiceRecognition(commandOptions, {
    onResult: (result) => {
      if (result.isFinal) {
        const command = result.transcript.toLowerCase().trim();
        
        // Check for exact matches
        if (commands[command]) {
          commands[command]();
          return;
        }

        // Check for partial matches
        for (const [key, action] of Object.entries(commands)) {
          if (command.includes(key.toLowerCase())) {
            action();
            break;
          }
        }
      }
    },
  });

  return voice;
}

/**
 * Hook for accessibility voice navigation
 */
export function useVoiceNavigation(
  navigationCommands: Record<string, () => void>
) {
  const defaultCommands = {
    'go home': () => window.location.href = '/',
    'go back': () => window.history.back(),
    'scroll up': () => window.scrollBy(0, -100),
    'scroll down': () => window.scrollBy(0, 100),
    'top of page': () => window.scrollTo(0, 0),
    'bottom of page': () => window.scrollTo(0, document.body.scrollHeight),
    ...navigationCommands,
  };

  return useMedicalCommands(defaultCommands, {
    continuous: true,
    autoStop: true,
    stopTimeout: 2000,
  });
}

export default useVoiceRecognition;