/**
 * Error handling utilities for TypeScript
 * Provides type-safe error handling with proper type guards
 */

/**
 * Type guard to check if a value is an Error instance
 * @param value - The value to check
 * @returns True if the value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      'name' in value &&
      typeof (value as any).message === 'string' &&
      typeof (value as any).name === 'string'
    )
  );
}

/**
 * Type guard to check if a value has a message property
 * @param value - The value to check
 * @returns True if the value has a message property
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as any).message === 'string'
  );
}

/**
 * Type guard to check if a value has a code property
 * @param value - The value to check
 * @returns True if the value has a code property
 */
export function hasCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as any).code === 'string'
  );
}

/**
 * Safely extract error message from unknown error type
 * @param error - The error to extract message from
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  
  if (hasMessage(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return String(error);
}

/**
 * Safely extract error code from unknown error type
 * @param error - The error to extract code from
 * @returns The error code if available, undefined otherwise
 */
export function getErrorCode(error: unknown): string | undefined {
  if (hasCode(error)) {
    return error.code;
  }
  
  if (isError(error) && 'code' in error) {
    return (error as any).code;
  }
  
  return undefined;
}

/**
 * Create a normalized error object from unknown error type
 * @param error - The error to normalize
 * @param context - Optional context to add to the error
 * @returns A normalized error object
 */
export function normalizeError(error: unknown, context?: string): {
  message: string;
  code?: string;
  context?: string;
} {
  return {
    message: getErrorMessage(error),
    code: getErrorCode(error),
    context
  };
}

/**
 * Check if an error is a specific type of error
 * @param error - The error to check
 * @param errorType - The error constructor to check against
 * @returns True if the error is of the specified type
 */
export function isErrorType<T extends Error>(
  error: unknown, 
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * API Error handling
 */
export interface APIError {
  status?: number;
  statusCode?: number;
  data?: {
    error?: string;
    message?: string;
    errors?: Array<{ message: string }>;
  };
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
      errors?: Array<{ message: string }>;
    };
  };
}

/**
 * Check if an error is an API error
 * @param error - The error to check
 * @returns True if the error is an API error
 */
export function isAPIError(error: unknown): error is APIError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  
  const err = error as any;
  return (
    typeof err.status === 'number' ||
    typeof err.statusCode === 'number' ||
    (err.response && typeof err.response.status === 'number')
  );
}

/**
 * Extract error message from API error
 * @param error - The API error
 * @returns The error message
 */
export function getAPIErrorMessage(error: APIError): string {
  if (error.data?.message) {
    return error.data.message;
  }
  
  if (error.data?.error) {
    return error.data.error;
  }
  
  if (error.data?.errors?.[ResourceHistoryTable]?.message) {
    return error.data.errors[ResourceHistoryTable].message;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.data?.errors?.[ResourceHistoryTable]?.message) {
    return error.response.data.errors[ResourceHistoryTable].message;
  }
  
  return 'An error occurred while communicating with the server';
}

/**
 * Get HTTP status code from API error
 * @param error - The API error
 * @returns The HTTP status code if available
 */
export function getAPIErrorStatus(error: APIError): number | undefined {
  return error.status || error.statusCode || error.response?.status;
}

/**
 * Handle errors in async functions with proper typing
 * @param fn - The async function to wrap
 * @returns A wrapped function that handles errors
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: unknown) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (errorHandler) {
        errorHandler(error);
      }
      throw error;
    }
  }) as T;
}

/**
 * React-specific error boundary helper
 * @param error - The error to check
 * @returns A user-friendly error message
 */
export function getDisplayErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    const status = getAPIErrorStatus(error);
    if (status === 401) {
      return 'Your session has expired. Please log in again.';
    }
    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (status === 404) {
      return 'The requested resource was not found.';
    }
    if (status && status >= 500) {
      return 'A server error occurred. Please try again later.';
    }
    return getAPIErrorMessage(error);
  }
  
  return getErrorMessage(error);
}