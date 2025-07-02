/**
 * Haptic Feedback Service for Healthcare Mobile Interface
 * Provides touch feedback for critical clinical actions
 */

export interface HapticPattern {
  duration?: number;
  intensity?: number;
  pattern?: number[];
}

export type ClinicalActionType = 
  | 'emergency-alert'
  | 'medication-admin'
  | 'patient-arrival'
  | 'critical-value'
  | 'success-action'
  | 'warning-action'
  | 'error-action'
  | 'button-press'
  | 'navigation'
  | 'data-entry'
  | 'vitals-abnormal'
  | 'allergy-alert';

// Predefined haptic patterns for healthcare workflows
const CLINICAL_HAPTIC_PATTERNS: Record<ClinicalActionType, HapticPattern> = {
  'emergency-alert': {
    pattern: [200, 100, 200, 100, 200, 100, 500], // Urgent triple pulse
    intensity: 1.0
  },
  'medication-admin': {
    pattern: [150, 50, 150], // Double pulse for medication safety
    intensity: 0.8
  },
  'patient-arrival': {
    pattern: [100, 50, 100, 50, 300], // Notification pattern
    intensity: 0.6
  },
  'critical-value': {
    pattern: [300, 100, 300, 100, 300], // Strong alert pattern
    intensity: 0.9
  },
  'success-action': {
    pattern: [200], // Single strong pulse
    intensity: 0.7
  },
  'warning-action': {
    pattern: [100, 50, 100], // Double pulse
    intensity: 0.6
  },
  'error-action': {
    pattern: [400, 100, 200, 100, 200], // Error pattern
    intensity: 0.8
  },
  'button-press': {
    pattern: [50], // Light touch feedback
    intensity: 0.3
  },
  'navigation': {
    pattern: [30], // Very light feedback
    intensity: 0.2
  },
  'data-entry': {
    pattern: [40], // Light confirmation
    intensity: 0.3
  },
  'vitals-abnormal': {
    pattern: [200, 50, 200, 50, 400], // Abnormal vitals alert
    intensity: 0.8
  },
  'allergy-alert': {
    pattern: [150, 100, 150, 100, 150, 100, 600], // Critical allergy alert
    intensity: 1.0
  }
};

class HapticFeedbackService {
  private isSupported: boolean;
  private isEnabled: boolean;
  private userPreferences: {
    enabled: boolean;
    intensity: number;
    emergencyOnly: boolean;
  };

  constructor() {
    this.isSupported = this.checkSupport();
    this.isEnabled = true;
    this.userPreferences = this.loadUserPreferences();
  }

  /**
   * Check if haptic feedback is supported on this device
   */
  private checkSupport(): boolean {
    return 'vibrate' in navigator;
  }

  /**
   * Load user preferences for haptic feedback
   */
  private loadUserPreferences() {
    const stored = localStorage.getItem('omnicare-haptic-preferences');
    return stored ? JSON.parse(stored) : {
      enabled: true,
      intensity: 1.0,
      emergencyOnly: false
    };
  }

  /**
   * Save user preferences
   */
  private saveUserPreferences() {
    localStorage.setItem('omnicare-haptic-preferences', JSON.stringify(this.userPreferences));
  }

  /**
   * Trigger haptic feedback for a clinical action
   */
  public trigger(actionType: ClinicalActionType, customPattern?: HapticPattern): boolean {
    if (!this.canVibrate(actionType)) {
      return false;
    }

    const pattern = customPattern || CLINICAL_HAPTIC_PATTERNS[actionType];
    
    if (!pattern) {
      console.warn(`No haptic pattern defined for action: ${actionType}`);
      return false;
    }

    try {
      if (pattern.pattern) {
        // Adjust pattern intensity based on user preferences
        const adjustedPattern = pattern.pattern.map(duration => 
          Math.round(duration * this.userPreferences.intensity)
        );
        navigator.vibrate(adjustedPattern);
      } else if (pattern.duration) {
        const adjustedDuration = Math.round(pattern.duration * this.userPreferences.intensity);
        navigator.vibrate(adjustedDuration);
      }
      
      return true;
    } catch (error) {
      console.error('Haptic feedback error:', error);
      return false;
    }
  }

  /**
   * Check if vibration should be triggered based on user preferences
   */
  private canVibrate(actionType: ClinicalActionType): boolean {
    if (!this.isSupported || !this.isEnabled || !this.userPreferences.enabled) {
      return false;
    }

    // If emergency only mode is enabled, only allow critical actions
    if (this.userPreferences.emergencyOnly) {
      const emergencyActions: ClinicalActionType[] = [
        'emergency-alert',
        'critical-value',
        'allergy-alert',
        'medication-admin'
      ];
      return emergencyActions.includes(actionType);
    }

    return true;
  }

  /**
   * Stop all vibration
   */
  public stop(): void {
    if (this.isSupported) {
      navigator.vibrate(0);
    }
  }

  /**
   * Test a specific haptic pattern
   */
  public test(actionType: ClinicalActionType): boolean {
    return this.trigger(actionType);
  }

  /**
   * Set haptic feedback preferences
   */
  public setPreferences(preferences: Partial<typeof this.userPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.saveUserPreferences();
  }

  /**
   * Get current preferences
   */
  public getPreferences() {
    return { ...this.userPreferences };
  }

  /**
   * Check if haptic feedback is available
   */
  public isAvailable(): boolean {
    return this.isSupported;
  }

  /**
   * Enable or disable haptic feedback
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.userPreferences.enabled = enabled;
    this.saveUserPreferences();
  }

  /**
   * Create a custom haptic pattern for specific use cases
   */
  public createCustomPattern(
    name: string, 
    pattern: HapticPattern
  ): (customPattern?: HapticPattern) => boolean {
    return (customPattern?: HapticPattern) => {
      const finalPattern = customPattern || pattern;
      
      if (!this.canVibrate('button-press')) {
        return false;
      }

      try {
        if (finalPattern.pattern) {
          const adjustedPattern = finalPattern.pattern.map(duration => 
            Math.round(duration * this.userPreferences.intensity)
          );
          navigator.vibrate(adjustedPattern);
        } else if (finalPattern.duration) {
          const adjustedDuration = Math.round(finalPattern.duration * this.userPreferences.intensity);
          navigator.vibrate(adjustedDuration);
        }
        
        return true;
      } catch (error) {
        console.error(`Custom haptic pattern '${name}' error:`, error);
        return false;
      }
    };
  }

  /**
   * Healthcare-specific convenience methods
   */
  public emergencyAlert(): boolean {
    return this.trigger('emergency-alert');
  }

  public medicationConfirm(): boolean {
    return this.trigger('medication-admin');
  }

  public criticalValue(): boolean {
    return this.trigger('critical-value');
  }

  public allergyAlert(): boolean {
    return this.trigger('allergy-alert');
  }

  public successAction(): boolean {
    return this.trigger('success-action');
  }

  public errorAction(): boolean {
    return this.trigger('error-action');
  }

  public buttonPress(): boolean {
    return this.trigger('button-press');
  }

  public navigation(): boolean {
    return this.trigger('navigation');
  }
}

// Singleton instance
const hapticFeedbackService = new HapticFeedbackService();

export { hapticFeedbackService };
export default HapticFeedbackService;