/**
 * AccessibilityProvider
 * Provides comprehensive accessibility features including high contrast mode,
 * reduced motion, and healthcare-specific accessibility settings
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface AccessibilitySettings {
  // Visual accessibility
  highContrastMode: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  
  // Motor accessibility
  reducedClickTarget: boolean;
  increasedTouchTarget: boolean;
  stickyKeys: boolean;
  
  // Cognitive accessibility
  simplifiedInterface: boolean;
  reducedAnimations: boolean;
  focusIndicatorEnhanced: boolean;
  
  // Healthcare-specific
  emergencyMode: boolean;
  sterileMode: boolean;
  voiceControlEnabled: boolean;
  hapticFeedback: boolean;
  
  // Audio accessibility
  audioDescriptions: boolean;
  captionsEnabled: boolean;
  soundAlerts: boolean;
  
  // General preferences
  announceChanges: boolean;
  keyboardNavigation: boolean;
}

export interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => void;
  resetSettings: () => void;
  applyPreset: (preset: AccessibilityPreset) => void;
  isSupported: (feature: keyof AccessibilitySettings) => boolean;
}

export type AccessibilityPreset = 
  | 'default'
  | 'high_contrast'
  | 'motor_impaired'
  | 'cognitive_support'
  | 'emergency_mode'
  | 'sterile_environment';

const defaultSettings: AccessibilitySettings = {
  // Visual
  highContrastMode: false,
  reducedMotion: false,
  largeText: false,
  colorBlindMode: 'none',
  
  // Motor
  reducedClickTarget: false,
  increasedTouchTarget: false,
  stickyKeys: false,
  
  // Cognitive
  simplifiedInterface: false,
  reducedAnimations: false,
  focusIndicatorEnhanced: false,
  
  // Healthcare
  emergencyMode: false,
  sterileMode: false,
  voiceControlEnabled: false,
  hapticFeedback: false,
  
  // Audio
  audioDescriptions: false,
  captionsEnabled: false,
  soundAlerts: true,
  
  // General
  announceChanges: true,
  keyboardNavigation: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: React.ReactNode;
  initialSettings?: Partial<AccessibilitySettings>;
  persistSettings?: boolean;
  storageKey?: string;
}

export function AccessibilityProvider({
  children,
  initialSettings = {},
  persistSettings = true,
  storageKey = 'omnicare-accessibility-settings',
}: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load from localStorage if persistence is enabled
    if (persistSettings && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          return { ...defaultSettings, ...JSON.parse(stored), ...initialSettings };
        }
      } catch (error) {
        console.warn('Failed to load accessibility settings from storage:', error);
      }
    }
    
    return { ...defaultSettings, ...initialSettings };
  });

  // Detect system preferences on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectSystemPreferences = () => {
      const updates: Partial<AccessibilitySettings> = {};

      // Detect prefers-reduced-motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        updates.reducedMotion = true;
        updates.reducedAnimations = true;
      }

      // Detect prefers-contrast
      if (window.matchMedia('(prefers-contrast: high)').matches) {
        updates.highContrastMode = true;
      }

      // Detect large text preference
      if (window.matchMedia('(min-resolution: 144dpi)').matches) {
        updates.largeText = true;
      }

      // Apply detected preferences
      if (Object.keys(updates).length > 0) {
        setSettings(prev => ({ ...prev, ...updates }));
      }
    };

    detectSystemPreferences();

    // Listen for system preference changes
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ 
        ...prev, 
        reducedMotion: e.matches,
        reducedAnimations: e.matches 
      }));
    };

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, highContrastMode: e.matches }));
    };

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
    };
  }, []);

  // Apply CSS custom properties when settings change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    // High contrast mode
    if (settings.highContrastMode) {
      root.classList.add('high-contrast-mode');
      root.style.setProperty('--primary-color', '#000000');
      root.style.setProperty('--background-color', '#ffffff');
      root.style.setProperty('--text-color', '#000000');
      root.style.setProperty('--border-color', '#000000');
      root.style.setProperty('--link-color', '#0000ff');
      root.style.setProperty('--error-color', '#ff0000');
      root.style.setProperty('--success-color', '#008000');
      root.style.setProperty('--warning-color', '#ff8c00');
    } else {
      root.classList.remove('high-contrast-mode');
      // Reset to default colors
      root.style.removeProperty('--primary-color');
      root.style.removeProperty('--background-color');
      root.style.removeProperty('--text-color');
      root.style.removeProperty('--border-color');
      root.style.removeProperty('--link-color');
      root.style.removeProperty('--error-color');
      root.style.removeProperty('--success-color');
      root.style.removeProperty('--warning-color');
    }

    // Large text
    if (settings.largeText) {
      root.style.setProperty('--font-scale', '1.25');
      root.classList.add('large-text-mode');
    } else {
      root.style.setProperty('--font-scale', '1');
      root.classList.remove('large-text-mode');
    }

    // Reduced motion
    if (settings.reducedMotion || settings.reducedAnimations) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Enhanced focus indicators
    if (settings.focusIndicatorEnhanced) {
      root.classList.add('enhanced-focus');
      root.style.setProperty('--focus-ring-width', '3px');
      root.style.setProperty('--focus-ring-offset', '3px');
    } else {
      root.classList.remove('enhanced-focus');
      root.style.setProperty('--focus-ring-width', '2px');
      root.style.setProperty('--focus-ring-offset', '2px');
    }

    // Increased touch targets
    if (settings.increasedTouchTarget) {
      root.classList.add('large-touch-targets');
      root.style.setProperty('--min-touch-target', '48px');
    } else {
      root.classList.remove('large-touch-targets');
      root.style.setProperty('--min-touch-target', '44px');
    }

    // Color blind mode
    body.className = body.className.replace(/colorblind-\w+/g, '');
    if (settings.colorBlindMode !== 'none') {
      body.classList.add(`colorblind-${settings.colorBlindMode}`);
    }

    // Emergency mode
    if (settings.emergencyMode) {
      root.classList.add('emergency-mode');
      root.style.setProperty('--emergency-bg', '#dc3545');
      root.style.setProperty('--emergency-text', '#ffffff');
    } else {
      root.classList.remove('emergency-mode');
    }

    // Sterile mode (simplified interface for sterile environments)
    if (settings.sterileMode) {
      root.classList.add('sterile-mode');
    } else {
      root.classList.remove('sterile-mode');
    }

    // Simplified interface
    if (settings.simplifiedInterface) {
      root.classList.add('simplified-interface');
    } else {
      root.classList.remove('simplified-interface');
    }

  }, [settings]);

  // Persist settings to localStorage
  useEffect(() => {
    if (persistSettings && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch (error) {
        console.warn('Failed to save accessibility settings to storage:', error);
      }
    }
  }, [settings, persistSettings, storageKey]);

  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Announce change to screen readers
    if (settings.announceChanges) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = `Accessibility setting changed: ${key} is now ${value ? 'enabled' : 'disabled'}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
    }
  }, [settings.announceChanges]);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const applyPreset = useCallback((preset: AccessibilityPreset) => {
    let presetSettings: Partial<AccessibilitySettings>;

    switch (preset) {
      case 'high_contrast':
        presetSettings = {
          highContrastMode: true,
          largeText: true,
          focusIndicatorEnhanced: true,
          reducedAnimations: true,
        };
        break;

      case 'motor_impaired':
        presetSettings = {
          increasedTouchTarget: true,
          stickyKeys: true,
          reducedClickTarget: true,
          focusIndicatorEnhanced: true,
          reducedAnimations: true,
        };
        break;

      case 'cognitive_support':
        presetSettings = {
          simplifiedInterface: true,
          reducedAnimations: true,
          largeText: true,
          announceChanges: true,
          soundAlerts: true,
        };
        break;

      case 'emergency_mode':
        presetSettings = {
          emergencyMode: true,
          highContrastMode: true,
          largeText: true,
          soundAlerts: true,
          announceChanges: true,
          simplifiedInterface: true,
        };
        break;

      case 'sterile_environment':
        presetSettings = {
          sterileMode: true,
          voiceControlEnabled: true,
          simplifiedInterface: true,
          increasedTouchTarget: true,
          announceChanges: true,
        };
        break;

      default:
        presetSettings = defaultSettings;
        break;
    }

    setSettings(prev => ({ ...prev, ...presetSettings }));
  }, []);

  const isSupported = useCallback((feature: keyof AccessibilitySettings): boolean => {
    if (typeof window === 'undefined') return false;

    switch (feature) {
      case 'reducedMotion':
        return 'matchMedia' in window;
      case 'highContrastMode':
        return 'matchMedia' in window;
      case 'voiceControlEnabled':
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      case 'hapticFeedback':
        return 'vibrate' in navigator;
      default:
        return true;
    }
  }, []);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSetting,
    resetSettings,
    applyPreset,
    isSupported,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

export default AccessibilityProvider;