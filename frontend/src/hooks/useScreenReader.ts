/**
 * useScreenReader Hook
 * Provides comprehensive screen reader support and live region management
 * for WCAG 2.1 AA compliance
 */

import { useCallback, useEffect, useRef } from 'react';

export interface ScreenReaderOptions {
  /** Global politeness level for announcements */
  defaultPoliteness?: 'polite' | 'assertive';
  /** Delay between rapid announcements */
  debounceMs?: number;
  /** Maximum number of live regions to maintain */
  maxRegions?: number;
  /** Whether to automatically clear announcements */
  autoClear?: boolean;
  /** Auto-clear timeout in milliseconds */
  clearTimeoutMs?: number;
}

export interface AnnouncementOptions {
  /** Politeness level for this specific announcement */
  politeness?: 'polite' | 'assertive';
  /** Whether this announcement should be atomic */
  atomic?: boolean;
  /** Whether to interrupt previous announcements */
  interrupt?: boolean;
  /** Custom delay before announcement */
  delay?: number;
  /** Whether to persist the announcement */
  persist?: boolean;
}

interface LiveRegion {
  id: string;
  element: HTMLElement;
  politeness: 'polite' | 'assertive';
  lastAnnouncement: string;
  lastAnnouncementTime: number;
}

let regionCounter = 0;

export function useScreenReader(options: ScreenReaderOptions = {}) {
  const {
    defaultPoliteness = 'polite',
    debounceMs = 100,
    maxRegions = 3,
    autoClear = true,
    clearTimeoutMs = 3000,
  } = options;

  const liveRegions = useRef<LiveRegion[]>([]);
  const pendingAnnouncements = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Create a live region element
  const createLiveRegion = useCallback((
    politeness: 'polite' | 'assertive' = defaultPoliteness
  ): LiveRegion => {
    const id = `live-region-${regionCounter++}`;
    
    const element = document.createElement('div');
    element.id = id;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', politeness);
    element.setAttribute('aria-atomic', 'true');
    element.className = 'sr-only';
    element.style.position = 'absolute';
    element.style.left = '-10000px';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.overflow = 'hidden';

    document.body.appendChild(element);

    const region: LiveRegion = {
      id,
      element,
      politeness,
      lastAnnouncement: '',
      lastAnnouncementTime: 0,
    };

    return region;
  }, [defaultPoliteness]);

  // Get or create a live region for the specified politeness level
  const getLiveRegion = useCallback((
    politeness: 'polite' | 'assertive' = defaultPoliteness
  ): LiveRegion => {
    // Find existing region with matching politeness
    let region = liveRegions.current.find(r => r.politeness === politeness);

    if (!region) {
      // Create new region if none exists
      region = createLiveRegion(politeness);
      liveRegions.current.push(region);

      // Remove oldest region if we exceed max
      if (liveRegions.current.length > maxRegions) {
        const oldestRegion = liveRegions.current.shift();
        if (oldestRegion) {
          document.body.removeChild(oldestRegion.element);
        }
      }
    }

    return region;
  }, [defaultPoliteness, maxRegions, createLiveRegion]);

  // Clear all pending announcements
  const clearPendingAnnouncements = useCallback(() => {
    pendingAnnouncements.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    pendingAnnouncements.current.clear();
  }, []);

  // Main announcement function
  const announce = useCallback((
    message: string,
    options: AnnouncementOptions = {}
  ) => {
    const {
      politeness = defaultPoliteness,
      atomic = true,
      interrupt = false,
      delay = 0,
      persist = false,
    } = options;

    if (!message.trim()) return;

    const executeAnnouncement = () => {
      const region = getLiveRegion(politeness);
      const now = Date.now();

      // Check for duplicate recent announcements
      if (
        region.lastAnnouncement === message &&
        now - region.lastAnnouncementTime < debounceMs
      ) {
        return;
      }

      // Clear the region first to ensure announcement is heard
      region.element.textContent = '';

      // Set atomic attribute based on options
      region.element.setAttribute('aria-atomic', atomic.toString());

      // Small delay to ensure screen readers pick up the change
      setTimeout(() => {
        region.element.textContent = message;
        region.lastAnnouncement = message;
        region.lastAnnouncementTime = now;

        // Auto-clear if enabled and not persistent
        if (autoClear && !persist) {
          setTimeout(() => {
            if (region.element.textContent === message) {
              region.element.textContent = '';
            }
          }, clearTimeoutMs);
        }
      }, 10);
    };

    // Handle interruptions
    if (interrupt) {
      clearPendingAnnouncements();
      // Clear all existing announcements
      liveRegions.current.forEach(region => {
        region.element.textContent = '';
      });
    }

    // Schedule the announcement
    if (delay > 0) {
      const timeoutId = setTimeout(executeAnnouncement, delay);
      pendingAnnouncements.current.set(message, timeoutId);
    } else {
      executeAnnouncement();
    }
  }, [
    defaultPoliteness,
    getLiveRegion,
    debounceMs,
    autoClear,
    clearTimeoutMs,
    clearPendingAnnouncements,
  ]);

  // Convenience methods for different types of announcements
  const announcePolite = useCallback((message: string, options?: Omit<AnnouncementOptions, 'politeness'>) => {
    announce(message, { ...options, politeness: 'polite' });
  }, [announce]);

  const announceAssertive = useCallback((message: string, options?: Omit<AnnouncementOptions, 'politeness'>) => {
    announce(message, { ...options, politeness: 'assertive' });
  }, [announce]);

  // Healthcare-specific announcement helpers
  const announceError = useCallback((message: string) => {
    announce(`Error: ${message}`, {
      politeness: 'assertive',
      interrupt: true,
      persist: true,
    });
  }, [announce]);

  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, {
      politeness: 'polite',
      persist: false,
    });
  }, [announce]);

  const announceWarning = useCallback((message: string) => {
    announce(`Warning: ${message}`, {
      politeness: 'assertive',
      persist: true,
    });
  }, [announce]);

  const announceEmergency = useCallback((message: string) => {
    announce(`EMERGENCY ALERT: ${message}`, {
      politeness: 'assertive',
      interrupt: true,
      persist: true,
      atomic: true,
    });
  }, [announce]);

  // Status announcements for UI changes
  const announceNavigation = useCallback((currentPage: string, totalPages?: number) => {
    const message = totalPages 
      ? `Navigated to ${currentPage}, page ${totalPages} of ${totalPages}`
      : `Navigated to ${currentPage}`;
    announce(message, { politeness: 'polite' });
  }, [announce]);

  const announceLoading = useCallback((isLoading: boolean, context?: string) => {
    const message = isLoading 
      ? `Loading${context ? ` ${context}` : ''}...`
      : `Loading complete${context ? ` for ${context}` : ''}`;
    announce(message, { politeness: 'polite' });
  }, [announce]);

  const announceFormValidation = useCallback((
    fieldName: string, 
    isValid: boolean, 
    errorMessage?: string
  ) => {
    if (isValid) {
      announce(`${fieldName} is valid`, { politeness: 'polite' });
    } else {
      announce(`${fieldName} error: ${errorMessage || 'Invalid input'}`, {
        politeness: 'assertive',
        persist: true,
      });
    }
  }, [announce]);

  // Progress announcements
  const announceProgress = useCallback((
    current: number, 
    total: number, 
    label?: string
  ) => {
    const percentage = Math.round((current / total) * 100);
    const message = `Progress${label ? ` for ${label}` : ''}: ${percentage}% complete, ${current} of ${total}`;
    announce(message, { 
      politeness: 'polite',
      // Only announce every 10% to avoid spam
      delay: percentage % 10 === 0 ? 0 : -1,
    });
  }, [announce]);

  // Data update announcements
  const announceDataUpdate = useCallback((
    entity: string, 
    action: 'created' | 'updated' | 'deleted' | 'saved',
    count?: number
  ) => {
    const countText = count && count > 1 ? ` ${count} items` : '';
    const message = `${entity}${countText} ${action} successfully`;
    announce(message, { politeness: 'polite' });
  }, [announce]);

  // Clear all announcements
  const clearAll = useCallback(() => {
    clearPendingAnnouncements();
    liveRegions.current.forEach(region => {
      region.element.textContent = '';
    });
  }, [clearPendingAnnouncements]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingAnnouncements();
      liveRegions.current.forEach(region => {
        if (document.body.contains(region.element)) {
          document.body.removeChild(region.element);
        }
      });
      liveRegions.current = [];
    };
  }, [clearPendingAnnouncements]);

  return {
    // Core announcement methods
    announce,
    announcePolite,
    announceAssertive,
    
    // Healthcare-specific methods
    announceError,
    announceSuccess,
    announceWarning,
    announceEmergency,
    
    // UI interaction methods
    announceNavigation,
    announceLoading,
    announceFormValidation,
    announceProgress,
    announceDataUpdate,
    
    // Utility methods
    clearAll,
    clearPendingAnnouncements,
  };
}

export default useScreenReader;