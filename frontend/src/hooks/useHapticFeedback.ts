/**
 * React hook for haptic feedback in healthcare mobile interface
 */

import { useCallback, useEffect, useState } from 'react';
import { hapticFeedbackService, ClinicalActionType, HapticPattern } from '@/services/haptic-feedback.service';

export interface UseHapticFeedbackReturn {
  trigger: (actionType: ClinicalActionType, customPattern?: HapticPattern) => boolean;
  stop: () => void;
  test: (actionType: ClinicalActionType) => boolean;
  isSupported: boolean;
  isEnabled: boolean;
  preferences: ReturnType<typeof hapticFeedbackService.getPreferences>;
  setPreferences: (preferences: Parameters<typeof hapticFeedbackService.setPreferences>[0]) => void;
  setEnabled: (enabled: boolean) => void;
  
  // Healthcare-specific methods
  emergencyAlert: () => boolean;
  medicationConfirm: () => boolean;
  criticalValue: () => boolean;
  allergyAlert: () => boolean;
  successAction: () => boolean;
  errorAction: () => boolean;
  buttonPress: () => boolean;
  navigation: () => boolean;
}

/**
 * Hook for using haptic feedback in React components
 */
export function useHapticFeedback(): UseHapticFeedbackReturn {
  const [isSupported] = useState(hapticFeedbackService.isAvailable());
  const [isEnabled, setIsEnabledState] = useState(hapticFeedbackService.getPreferences().enabled);
  const [preferences, setPreferencesState] = useState(hapticFeedbackService.getPreferences());

  const trigger = useCallback((actionType: ClinicalActionType, customPattern?: HapticPattern) => {
    return hapticFeedbackService.trigger(actionType, customPattern);
  }, []);

  const stop = useCallback(() => {
    hapticFeedbackService.stop();
  }, []);

  const test = useCallback((actionType: ClinicalActionType) => {
    return hapticFeedbackService.test(actionType);
  }, []);

  const setPreferences = useCallback((newPreferences: Parameters<typeof hapticFeedbackService.setPreferences>[0]) => {
    hapticFeedbackService.setPreferences(newPreferences);
    setPreferencesState(hapticFeedbackService.getPreferences());
    setIsEnabledState(hapticFeedbackService.getPreferences().enabled);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    hapticFeedbackService.setEnabled(enabled);
    setIsEnabledState(enabled);
    setPreferencesState(hapticFeedbackService.getPreferences());
  }, []);

  // Healthcare-specific convenience methods
  const emergencyAlert = useCallback(() => hapticFeedbackService.emergencyAlert(), []);
  const medicationConfirm = useCallback(() => hapticFeedbackService.medicationConfirm(), []);
  const criticalValue = useCallback(() => hapticFeedbackService.criticalValue(), []);
  const allergyAlert = useCallback(() => hapticFeedbackService.allergyAlert(), []);
  const successAction = useCallback(() => hapticFeedbackService.successAction(), []);
  const errorAction = useCallback(() => hapticFeedbackService.errorAction(), []);
  const buttonPress = useCallback(() => hapticFeedbackService.buttonPress(), []);
  const navigation = useCallback(() => hapticFeedbackService.navigation(), []);

  // Listen for preference changes
  useEffect(() => {
    const checkPreferences = () => {
      const currentPrefs = hapticFeedbackService.getPreferences();
      setPreferencesState(currentPrefs);
      setIsEnabledState(currentPrefs.enabled);
    };

    // Check preferences periodically in case they change elsewhere
    const interval = setInterval(checkPreferences, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    trigger,
    stop,
    test,
    isSupported,
    isEnabled,
    preferences,
    setPreferences,
    setEnabled,
    emergencyAlert,
    medicationConfirm,
    criticalValue,
    allergyAlert,
    successAction,
    errorAction,
    buttonPress,
    navigation,
  };
}

/**
 * Hook for haptic feedback with automatic triggering on events
 */
export function useAutoHapticFeedback(
  actionType: ClinicalActionType,
  enabled: boolean = true
) {
  const { trigger } = useHapticFeedback();

  const triggerHaptic = useCallback((customPattern?: HapticPattern) => {
    if (enabled) {
      return trigger(actionType, customPattern);
    }
    return false;
  }, [enabled, trigger, actionType]);

  return triggerHaptic;
}

/**
 * Hook for touch feedback on button interactions
 */
export function useTouchFeedback(actionType: ClinicalActionType = 'button-press') {
  const { trigger } = useHapticFeedback();

  const onTouchStart = useCallback(() => {
    trigger(actionType);
  }, [trigger, actionType]);

  const onTouchEnd = useCallback(() => {
    // Optional: different feedback on touch end
    // trigger('button-release');
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
  };
}

/**
 * Hook for medical alert haptic patterns
 */
export function useMedicalAlerts() {
  const haptic = useHapticFeedback();

  const triggerMedicalAlert = useCallback((alertType: 'critical' | 'warning' | 'emergency' | 'allergy') => {
    switch (alertType) {
      case 'critical':
        return haptic.criticalValue();
      case 'emergency':
        return haptic.emergencyAlert();
      case 'allergy':
        return haptic.allergyAlert();
      case 'warning':
        return haptic.trigger('warning-action');
      default:
        return false;
    }
  }, [haptic]);

  return {
    ...haptic,
    triggerMedicalAlert,
  };
}

export default useHapticFeedback;