/**
 * useKeyboardNavigation Hook
 * Provides comprehensive keyboard navigation functionality for WCAG 2.1 AA compliance
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface KeyboardNavigationOptions {
  /** Enable arrow key navigation */
  enableArrowKeys?: boolean;
  /** Enable home/end navigation */
  enableHomeEnd?: boolean;
  /** Enable search/type-ahead functionality */
  enableTypeAhead?: boolean;
  /** Custom key handlers */
  customHandlers?: Record<string, (event: KeyboardEvent, context: NavigationContext) => void>;
  /** Skip disabled items */
  skipDisabled?: boolean;
  /** Loop navigation (circular) */
  loop?: boolean;
  /** Orientation for arrow keys */
  orientation?: 'horizontal' | 'vertical' | 'both';
}

export interface NavigationContext {
  currentIndex: number;
  totalItems: number;
  items: NavigationItem[];
  focusedElement: HTMLElement | null;
}

export interface NavigationItem {
  id: string;
  element: HTMLElement | null;
  disabled?: boolean;
  label?: string;
}

const KEYS = {
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
} as const;

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enableArrowKeys = true,
    enableHomeEnd = true,
    enableTypeAhead = false,
    customHandlers = {},
    skipDisabled = true,
    loop = true,
    orientation = 'vertical',
  } = options;

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [items, setItems] = useState<NavigationItem[]>([]);
  const itemsRef = useRef<NavigationItem[]>([]);
  const typeAheadRef = useRef('');
  const typeAheadTimeoutRef = useRef<NodeJS.Timeout>();

  // Update items ref when items change
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Register navigation items
  const registerItems = useCallback((newItems: NavigationItem[]) => {
    setItems(newItems);
  }, []);

  // Update item element reference
  const updateItemRef = useCallback((id: string, element: HTMLElement | null) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, element } : item
    ));
  }, []);

  // Find next valid index
  const findNextIndex = useCallback((
    startIndex: number, 
    direction: 1 | -1,
    items: NavigationItem[]
  ): number => {
    const totalItems = items.length;
    if (totalItems === 0) return -1;

    let nextIndex = startIndex;
    let attempts = 0;

    do {
      nextIndex = (nextIndex + direction + totalItems) % totalItems;
      attempts++;

      // Prevent infinite loop
      if (attempts >= totalItems) {
        return loop ? 0 : -1;
      }

      // Check if item is valid
      const item = items[nextIndex];
      if (!item.disabled || !skipDisabled) {
        return nextIndex;
      }
    } while (nextIndex !== startIndex);

    return -1;
  }, [skipDisabled, loop]);

  // Move focus to item at index
  const focusItem = useCallback((index: number) => {
    const item = itemsRef.current[index];
    if (item?.element && !item.disabled) {
      item.element.focus();
      setCurrentIndex(index);
      return true;
    }
    return false;
  }, []);

  // Navigation handlers
  const navigateUp = useCallback(() => {
    if (orientation === 'horizontal') return false;
    const nextIndex = findNextIndex(currentIndex, -1, itemsRef.current);
    return nextIndex !== -1 ? focusItem(nextIndex) : false;
  }, [currentIndex, findNextIndex, focusItem, orientation]);

  const navigateDown = useCallback(() => {
    if (orientation === 'horizontal') return false;
    const nextIndex = findNextIndex(currentIndex, 1, itemsRef.current);
    return nextIndex !== -1 ? focusItem(nextIndex) : false;
  }, [currentIndex, findNextIndex, focusItem, orientation]);

  const navigateLeft = useCallback(() => {
    if (orientation === 'vertical') return false;
    const nextIndex = findNextIndex(currentIndex, -1, itemsRef.current);
    return nextIndex !== -1 ? focusItem(nextIndex) : false;
  }, [currentIndex, findNextIndex, focusItem, orientation]);

  const navigateRight = useCallback(() => {
    if (orientation === 'vertical') return false;
    const nextIndex = findNextIndex(currentIndex, 1, itemsRef.current);
    return nextIndex !== -1 ? focusItem(nextIndex) : false;
  }, [currentIndex, findNextIndex, focusItem, orientation]);

  const navigateHome = useCallback(() => {
    if (!enableHomeEnd) return false;
    const firstValidIndex = findNextIndex(-1, 1, itemsRef.current);
    return firstValidIndex !== -1 ? focusItem(firstValidIndex) : false;
  }, [enableHomeEnd, findNextIndex, focusItem]);

  const navigateEnd = useCallback(() => {
    if (!enableHomeEnd) return false;
    const lastValidIndex = findNextIndex(itemsRef.current.length, -1, itemsRef.current);
    return lastValidIndex !== -1 ? focusItem(lastValidIndex) : false;
  }, [enableHomeEnd, findNextIndex, focusItem]);

  // Type-ahead search
  const handleTypeAhead = useCallback((char: string) => {
    if (!enableTypeAhead) return false;

    // Clear previous timeout
    if (typeAheadTimeoutRef.current) {
      clearTimeout(typeAheadTimeoutRef.current);
    }

    // Add character to search string
    typeAheadRef.current += char.toLowerCase();

    // Find matching item
    const matchingIndex = itemsRef.current.findIndex((item, index) => {
      if (index <= currentIndex || item.disabled) return false;
      const label = item.label?.toLowerCase() || item.element?.textContent?.toLowerCase() || '';
      return label.startsWith(typeAheadRef.current);
    });

    // If no match found after current index, search from beginning
    const finalIndex = matchingIndex !== -1 ? matchingIndex : 
      itemsRef.current.findIndex(item => {
        if (item.disabled) return false;
        const label = item.label?.toLowerCase() || item.element?.textContent?.toLowerCase() || '';
        return label.startsWith(typeAheadRef.current);
      });

    // Clear search string after delay
    typeAheadTimeoutRef.current = setTimeout(() => {
      typeAheadRef.current = '';
    }, 1000);

    return finalIndex !== -1 ? focusItem(finalIndex) : false;
  }, [enableTypeAhead, currentIndex, focusItem]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!itemsRef.current.length) return;

    const context: NavigationContext = {
      currentIndex,
      totalItems: itemsRef.current.length,
      items: itemsRef.current,
      focusedElement: document.activeElement as HTMLElement,
    };

    // Check custom handlers first
    if (customHandlers[event.key]) {
      customHandlers[event.key](event, context);
      return;
    }

    let handled = false;

    switch (event.key) {
      case KEYS.ARROW_UP:
        if (enableArrowKeys) {
          handled = navigateUp();
        }
        break;

      case KEYS.ARROW_DOWN:
        if (enableArrowKeys) {
          handled = navigateDown();
        }
        break;

      case KEYS.ARROW_LEFT:
        if (enableArrowKeys) {
          handled = navigateLeft();
        }
        break;

      case KEYS.ARROW_RIGHT:
        if (enableArrowKeys) {
          handled = navigateRight();
        }
        break;

      case KEYS.HOME:
        handled = navigateHome();
        break;

      case KEYS.END:
        handled = navigateEnd();
        break;

      default:
        // Handle type-ahead for printable characters
        if (enableTypeAhead && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          handled = handleTypeAhead(event.key);
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [
    currentIndex,
    customHandlers,
    enableArrowKeys,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    navigateHome,
    navigateEnd,
    enableTypeAhead,
    handleTypeAhead,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentIndex,
    items,
    registerItems,
    updateItemRef,
    focusItem,
    handleKeyDown,
    // Navigation methods for programmatic control
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    navigateHome,
    navigateEnd,
  };
}

export default useKeyboardNavigation;