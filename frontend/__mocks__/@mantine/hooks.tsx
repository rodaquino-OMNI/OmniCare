// Mock for @mantine/hooks
import React from 'react';

// Mock useMediaQuery hook
export const useMediaQuery = (query: string) => {
  // Default to desktop view for tests
  return false;
};

// Mock useDisclosure hook
export const useDisclosure = (initialState = false) => {
  const [opened, setOpened] = React.useState(initialState);
  
  return [
    opened,
    {
      open: () => setOpened(true),
      close: () => setOpened(false),
      toggle: () => setOpened(!opened),
    }
  ];
};

// Mock useClickOutside hook
export const useClickOutside = () => React.useRef(null);

// Mock useHotkeys hook
export const useHotkeys = (hotkeys: any) => {
  // No-op for tests
};

// Mock useViewportSize hook
export const useViewportSize = () => ({
  width: 1024,
  height: 768,
});

// Mock useDebouncedValue hook
export const useDebouncedValue = <T,>(value: T, delay?: number): [T] => {
  return [value];
};

// Mock useDebouncedCallback hook
export const useDebouncedCallback = <T extends (...args: any[]) => any,>(
  callback: T,
  delay: number
): T => {
  return callback;
};

// Mock useWindowEvent hook
export const useWindowEvent = (type: string, listener: () => void) => {
  // No-op for tests
};

// Mock useTimeout hook
export const useTimeout = (callback: () => void, delay: number) => {
  const { start, clear } = {
    start: () => {},
    clear: () => {},
  };
  
  return { start, clear };
};

// Mock useInterval hook
export const useInterval = (callback: () => void, delay: number) => {
  const { start, stop, toggle } = {
    start: () => {},
    stop: () => {},
    toggle: () => {},
  };
  
  return { start, stop, toggle };
};