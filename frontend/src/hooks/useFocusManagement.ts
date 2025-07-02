/**
 * useFocusManagement Hook
 * Provides comprehensive focus management for WCAG 2.1 AA compliance
 * Handles focus trapping, restoration, and announcement
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FocusManagementOptions {
  /** Automatically trap focus within container */
  trapFocus?: boolean;
  /** Return focus to triggering element when deactivated */
  restoreFocus?: boolean;
  /** Initial element to focus (selector or element) */
  initialFocus?: string | HTMLElement | null;
  /** Elements to include in focus trap (selector) */
  focusableSelector?: string;
  /** Elements to exclude from focus trap (selector) */
  excludeSelector?: string;
  /** Announce focus changes to screen readers */
  announceChanges?: boolean;
  /** Custom focus change announcer */
  customAnnouncer?: (element: HTMLElement, action: 'enter' | 'leave') => void;
}

interface FocusState {
  isActive: boolean;
  focusedElement: HTMLElement | null;
  lastFocusedElement: HTMLElement | null;
  triggeringElement: HTMLElement | null;
}

const DEFAULT_FOCUSABLE_SELECTOR = `
  button:not([disabled]),
  [href],
  input:not([disabled]),
  select:not([disabled]),
  textarea:not([disabled]),
  [tabindex]:not([tabindex="-1"]),
  [contenteditable="true"],
  details summary,
  audio[controls],
  video[controls]
`.replace(/\s+/g, '').replace(/,/g, ', ');

export function useFocusManagement(
  containerRef: React.RefObject<HTMLElement>,
  options: FocusManagementOptions = {}
) {
  const {
    trapFocus = false,
    restoreFocus = true,
    initialFocus = null,
    focusableSelector = DEFAULT_FOCUSABLE_SELECTOR,
    excludeSelector = '',
    announceChanges = true,
    customAnnouncer,
  } = options;

  const [focusState, setFocusState] = useState<FocusState>({
    isActive: false,
    focusedElement: null,
    lastFocusedElement: null,
    triggeringElement: null,
  });

  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusableElements = useRef<HTMLElement[]>([]);

  // Get all focusable elements within container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const elements = Array.from(
      containerRef.current.querySelectorAll(focusableSelector)
    ) as HTMLElement[];

    // Filter out excluded elements
    const filteredElements = excludeSelector
      ? elements.filter(el => !el.closest(excludeSelector))
      : elements;

    // Filter out hidden or disabled elements
    return filteredElements.filter(el => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !el.hasAttribute('disabled') &&
        !el.getAttribute('aria-hidden')
      );
    });
  }, [containerRef, focusableSelector, excludeSelector]);

  // Update focusable elements cache
  const updateFocusableElements = useCallback(() => {
    focusableElements.current = getFocusableElements();
  }, [getFocusableElements]);

  // Announce focus changes to screen readers
  const announceFocusChange = useCallback((
    element: HTMLElement,
    action: 'enter' | 'leave'
  ) => {
    if (!announceChanges) return;

    if (customAnnouncer) {
      customAnnouncer(element, action);
      return;
    }

    const label = 
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent ||
      element.tagName.toLowerCase();

    const message = action === 'enter' 
      ? `Focused on ${label}`
      : `Left ${label}`;

    // Create live region announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [announceChanges, customAnnouncer]);

  // Focus management methods
  const focusFirst = useCallback(() => {
    updateFocusableElements();
    const firstElement = focusableElements.current[0];
    if (firstElement) {
      firstElement.focus();
      setFocusState(prev => ({
        ...prev,
        focusedElement: firstElement,
      }));
      announceFocusChange(firstElement, 'enter');
      return true;
    }
    return false;
  }, [updateFocusableElements, announceFocusChange]);

  const focusLast = useCallback(() => {
    updateFocusableElements();
    const lastElement = focusableElements.current[focusableElements.current.length - 1];
    if (lastElement) {
      lastElement.focus();
      setFocusState(prev => ({
        ...prev,
        focusedElement: lastElement,
      }));
      announceFocusChange(lastElement, 'enter');
      return true;
    }
    return false;
  }, [updateFocusableElements, announceFocusChange]);

  const focusElement = useCallback((
    target: string | HTMLElement | null
  ): boolean => {
    let element: HTMLElement | null = null;

    if (typeof target === 'string') {
      element = containerRef.current?.querySelector(target) as HTMLElement;
    } else {
      element = target;
    }

    if (element && containerRef.current?.contains(element)) {
      element.focus();
      setFocusState(prev => ({
        ...prev,
        focusedElement: element,
      }));
      announceFocusChange(element, 'enter');
      return true;
    }
    return false;
  }, [containerRef, announceFocusChange]);

  // Focus trap handler
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (!trapFocus || !focusState.isActive) return;

    updateFocusableElements();
    const focusableElementsList = focusableElements.current;

    if (focusableElementsList.length === 0) return;

    const firstElement = focusableElementsList[0];
    const lastElement = focusableElementsList[focusableElementsList.length - 1];

    if (event.key === 'Tab') {
      if (event.shiftKey) {
        // Shift + Tab - move to previous element
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab - move to next element
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [trapFocus, focusState.isActive, updateFocusableElements]);

  // Activate focus management
  const activate = useCallback((triggeringElement?: HTMLElement) => {
    // Store the previously active element for restoration
    previousActiveElement.current = document.activeElement as HTMLElement;

    setFocusState(prev => ({
      ...prev,
      isActive: true,
      triggeringElement: triggeringElement || previousActiveElement.current,
    }));

    // Focus initial element
    if (initialFocus) {
      if (!focusElement(initialFocus)) {
        focusFirst();
      }
    } else {
      focusFirst();
    }

    // Add event listeners for focus trapping
    if (trapFocus) {
      document.addEventListener('keydown', handleFocusTrap);
    }
  }, [initialFocus, focusElement, focusFirst, trapFocus, handleFocusTrap]);

  // Deactivate focus management
  const deactivate = useCallback(() => {
    setFocusState(prev => {
      // Announce leaving the container
      if (prev.focusedElement) {
        announceFocusChange(prev.focusedElement, 'leave');
      }

      return {
        ...prev,
        isActive: false,
        focusedElement: null,
        lastFocusedElement: prev.focusedElement,
      };
    });

    // Remove event listeners
    if (trapFocus) {
      document.removeEventListener('keydown', handleFocusTrap);
    }

    // Restore focus to triggering element
    if (restoreFocus && previousActiveElement.current) {
      // Use setTimeout to ensure the element is focusable
      setTimeout(() => {
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
          previousActiveElement.current = null;
        }
      }, 0);
    }
  }, [trapFocus, handleFocusTrap, restoreFocus, announceFocusChange]);

  // Monitor focus changes within container
  const handleFocusIn = useCallback((event: FocusEvent) => {
    const target = event.target as HTMLElement;
    if (containerRef.current?.contains(target)) {
      setFocusState(prev => ({
        ...prev,
        focusedElement: target,
      }));
    }
  }, [containerRef]);

  const handleFocusOut = useCallback((event: FocusEvent) => {
    const target = event.target as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;

    // If focus moved outside the container
    if (
      containerRef.current?.contains(target) &&
      !containerRef.current?.contains(relatedTarget)
    ) {
      setFocusState(prev => ({
        ...prev,
        lastFocusedElement: target,
        focusedElement: null,
      }));
    }
  }, [containerRef]);

  // Set up focus monitoring
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [containerRef, handleFocusIn, handleFocusOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trapFocus) {
        document.removeEventListener('keydown', handleFocusTrap);
      }
    };
  }, [trapFocus, handleFocusTrap]);

  return {
    focusState,
    activate,
    deactivate,
    focusFirst,
    focusLast,
    focusElement,
    updateFocusableElements,
    getFocusableElements,
  };
}

export default useFocusManagement;