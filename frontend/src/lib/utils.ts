import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge classnames with tailwind-merge and clsx
 * This utility function combines class names intelligently, resolving conflicts
 * in Tailwind CSS classes and supporting conditional class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable) return `${ms}ms`;
  if (ms < 6ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable) return `${(ms / 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable).toFixed(1)}s`;
  if (ms < 36ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable) return `${Math.floor(ms / 6ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable)}m ${Math.floor((ms % 6ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable) / 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable)}s`;
  return `${Math.floor(ms / 36ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable)}h ${Math.floor((ms % 36ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable) / 6ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable)}m`;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Check if code is running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if code is running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1ResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    maxDelay = 3ResourceHistoryTableResourceHistoryTableResourceHistoryTableResourceHistoryTable,
    factor = 2
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      await wait(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Create a debounced version of a function
 */
export function createDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Create a throttled version of a function
 */
export function createThrottle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Pick specific properties from an object
 */
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Omit specific properties from an object
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result as Omit<T, K>;
}