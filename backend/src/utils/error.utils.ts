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
 * Safely extract stack trace from unknown error type
 * @param error - The error to extract stack from
 * @returns The stack trace if available, undefined otherwise
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  
  if (typeof error === 'object' && error !== null && 'stack' in error && typeof (error as any).stack === 'string') {
    return (error as any).stack;
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
  stack?: string;
  context?: string;
} {
  return {
    message: getErrorMessage(error),
    code: getErrorCode(error),
    stack: getErrorStack(error),
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
 * FHIR-specific error handling
 */
export interface FHIRError {
  outcome?: {
    issue?: Array<{
      diagnostics?: string;
      details?: {
        text?: string;
      };
    }>;
  };
  response?: {
    data?: {
      resourceType?: string;
      issue?: Array<{
        diagnostics?: string;
        details?: {
          text?: string;
        };
      }>;
    };
  };
}

/**
 * Check if an error is a FHIR error
 * @param error - The error to check
 * @returns True if the error is a FHIR error
 */
export function isFHIRError(error: unknown): error is FHIRError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  
  const err = error as any;
  return (
    (err.outcome && Array.isArray(err.outcome.issue)) ||
    (err.response?.data?.resourceType === 'OperationOutcome')
  );
}

/**
 * Extract error message from FHIR error
 * @param error - The FHIR error
 * @returns The error message
 */
export function getFHIRErrorMessage(error: FHIRError): string {
  if (error.outcome?.issue?.[0]) {
    const issue = error.outcome.issue[0];
    return issue.diagnostics || issue.details?.text || 'FHIR operation failed';
  }
  
  if (error.response?.data?.issue?.[0]) {
    const issue = error.response.data.issue[0];
    return issue.diagnostics || issue.details?.text || 'FHIR operation failed';
  }
  
  return 'FHIR operation failed';
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
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errorCode?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle errors for HTTP responses - simplified version
 * @param error - The error to handle
 * @param res - Express response object
 */
export function handleError(error: unknown, res?: any): void {
  if (res) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = getErrorMessage(error);
    
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString(),
      }
    });
  } else {
    // Log error if no response object
    console.error('Error occurred:', getErrorMessage(error));
  }
}