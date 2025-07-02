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
      typeof (value as { message: unknown }).message === 'string' &&
      typeof (value as { name: unknown }).name === 'string'
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
    typeof (value as { message: unknown }).message === 'string'
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
    typeof (value as { code: unknown }).code === 'string'
  );
}

/**
 * Safely extract error message from unknown error type
 * @param error - The error to extract message from
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (error === null || error === undefined) {
    return 'An unknown error occurred';
  }
  
  if (isError(error)) {
    return error.message;
  }
  
  if (hasMessage(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // Try to serialize objects to include their properties
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
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
    return (error as Error & { code?: string }).code;
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
  errorType: new (...args: unknown[]) => T
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
  
  const err = error as Record<string, unknown>;
  return Boolean(
    typeof err.status === 'number' ||
    typeof err.statusCode === 'number' ||
    (err.response && typeof (err.response as any).status === 'number')
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
  
  if (error.data?.errors?.[0]?.message) {
    return error.data.errors[0].message;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.data?.errors?.[0]?.message) {
    return error.response.data.errors[0].message;
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
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
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
 * Enhanced Error Categories for frontend
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  FHIR = 'FHIR',
  INTEGRATION = 'INTEGRATION',
  INTERNAL = 'INTERNAL',
  CLIENT = 'CLIENT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Enhanced App Error for frontend
 */
export class AppError extends Error {
  public readonly id: string;
  public readonly timestamp: Date;
  public readonly context: Record<string, unknown>;
  
  constructor(
    public readonly code: string,
    message: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.timestamp = new Date();
    this.context = context || {};
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context
    };
  }
}

/**
 * Frontend Error Factory
 */
export class ErrorFactory {
  static validation(message: string, field?: string, value?: unknown): AppError {
    return new AppError(
      'VALIDATION_ERROR',
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      400,
      true,
      { field, value }
    );
  }

  static unauthorized(message = 'Session expired. Please log in again.'): AppError {
    return new AppError(
      'UNAUTHORIZED',
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      401
    );
  }

  static forbidden(message = 'You do not have permission to perform this action.'): AppError {
    return new AppError(
      'FORBIDDEN',
      message,
      ErrorCategory.AUTHORIZATION,
      ErrorSeverity.MEDIUM,
      403
    );
  }

  static notFound(resource: string): AppError {
    return new AppError(
      'NOT_FOUND',
      `${resource} not found`,
      ErrorCategory.NOT_FOUND,
      ErrorSeverity.LOW,
      404,
      true,
      { resource }
    );
  }

  static network(message = 'Connection error. Please check your internet connection.'): AppError {
    return new AppError(
      'NETWORK_ERROR',
      message,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      0,
      true
    );
  }

  static fhir(operation: string, details?: unknown): AppError {
    return new AppError(
      'FHIR_ERROR',
      `Medical data error during ${operation}`,
      ErrorCategory.FHIR,
      ErrorSeverity.MEDIUM,
      422,
      true,
      { operation, details }
    );
  }

  static client(message: string): AppError {
    return new AppError(
      'CLIENT_ERROR',
      message,
      ErrorCategory.CLIENT,
      ErrorSeverity.LOW,
      0,
      true
    );
  }
}

/**
 * Enhanced Error Transformer for frontend
 */
export class ErrorTransformer {
  static transform(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return this.transformError(error);
    }

    if (typeof error === 'object' && error !== null) {
      return this.transformObject(error as Record<string, unknown>);
    }

    if (typeof error === 'string') {
      return ErrorFactory.client(error);
    }

    return ErrorFactory.client('An unknown error occurred');
  }

  private static transformError(error: Error): AppError {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    // Network errors
    if (errorName.includes('network') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout')) {
      return ErrorFactory.network(error.message);
    }

    // Type errors
    if (error instanceof TypeError) {
      return ErrorFactory.client(`Type error: ${error.message}`);
    }

    return ErrorFactory.client(error.message);
  }

  private static transformObject(obj: Record<string, unknown>): AppError {
    const code = obj.code || obj.errorCode || 'UNKNOWN_ERROR';
    const message = obj.message || obj.error || 'An error occurred';
    const statusCode = obj.statusCode || obj.status || 0;

    // Server error response
    if (obj.success === false && obj.error) {
      const errorObj = obj.error as any;
      return new AppError(
        errorObj.code || String(code),
        errorObj.message || String(message),
        this.categorizeByStatusCode(errorObj.statusCode || statusCode as number),
        this.getSeverityByCategory(this.categorizeByStatusCode(errorObj.statusCode || statusCode as number)),
        errorObj.statusCode || statusCode as number,
        true,
        obj
      );
    }

    // FHIR OperationOutcome
    if (obj.resourceType === 'OperationOutcome' && Array.isArray(obj.issue)) {
      const issue = (obj.issue as any[])[0];
      return ErrorFactory.fhir('operation', { issue });
    }

    // API error format
    if (typeof statusCode === 'number' && statusCode > 0) {
      const category = this.categorizeByStatusCode(statusCode);
      return new AppError(
        String(code),
        String(message),
        category,
        this.getSeverityByCategory(category),
        statusCode,
        true,
        obj
      );
    }

    return ErrorFactory.client(String(message));
  }

  private static categorizeByStatusCode(statusCode: number): ErrorCategory {
    if (statusCode === 401) return ErrorCategory.AUTHENTICATION;
    if (statusCode === 403) return ErrorCategory.AUTHORIZATION;
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 409) return ErrorCategory.CONFLICT;
    if (statusCode === 429) return ErrorCategory.RATE_LIMIT;
    if (statusCode >= 400 && statusCode < 500) return ErrorCategory.VALIDATION;
    if (statusCode >= 500) return ErrorCategory.EXTERNAL_SERVICE;
    if (statusCode === 0) return ErrorCategory.NETWORK;
    return ErrorCategory.UNKNOWN;
  }

  private static getSeverityByCategory(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case ErrorCategory.VALIDATION:
      case ErrorCategory.NOT_FOUND:
      case ErrorCategory.RATE_LIMIT:
      case ErrorCategory.CLIENT:
        return ErrorSeverity.LOW;
      
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
      case ErrorCategory.CONFLICT:
      case ErrorCategory.FHIR:
        return ErrorSeverity.MEDIUM;
      
      case ErrorCategory.EXTERNAL_SERVICE:
      case ErrorCategory.DATABASE:
      case ErrorCategory.NETWORK:
      case ErrorCategory.INTEGRATION:
        return ErrorSeverity.HIGH;
      
      case ErrorCategory.INTERNAL:
        return ErrorSeverity.CRITICAL;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }
}

/**
 * React-specific error boundary helper
 * @param error - The error to check
 * @returns A user-friendly error message
 */
export function getDisplayErrorMessage(error: unknown): string {
  const appError = ErrorTransformer.transform(error);
  
  // Return user-friendly messages based on category
  switch (appError.category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Your session has expired. Please log in again.';
    
    case ErrorCategory.AUTHORIZATION:
      return 'You do not have permission to perform this action.';
    
    case ErrorCategory.NOT_FOUND:
      return 'The requested resource was not found.';
    
    case ErrorCategory.NETWORK:
      return 'Connection error. Please check your internet connection and try again.';
    
    case ErrorCategory.VALIDATION:
      return appError.message; // Validation messages are usually user-friendly
    
    case ErrorCategory.FHIR:
      return 'An error occurred while processing medical data. Please try again.';
    
    case ErrorCategory.EXTERNAL_SERVICE:
      return 'A server error occurred. Please try again later.';
    
    case ErrorCategory.RATE_LIMIT:
      return 'Too many requests. Please wait a moment and try again.';
    
    default:
      return appError.message;
  }
}

/**
 * Check if an error is a network error
 * @param error - The error to check
 * @returns True if the error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('offline')
  );
}

/**
 * FHIR Error interface
 */
export interface FHIRError {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: string;
    code: string;
    diagnostics?: string;
  }>;
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
  
  const err = error as Record<string, unknown>;
  return (
    err.resourceType === 'OperationOutcome' &&
    Array.isArray(err.issue) &&
    err.issue.length > 0
  );
}

/**
 * Format error for user display
 * @param error - The error to format
 * @returns Formatted error object
 */
export function formatErrorForUser(error: unknown): {
  title: string;
  message: string;
  type: 'network' | 'fhir' | 'validation' | 'server' | 'unknown';
} {
  if (isNetworkError(error)) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      type: 'network'
    };
  }
  
  if (isFHIRError(error)) {
    const firstIssue = error.issue[0];
    return {
      title: 'Medical Data Error',
      message: firstIssue.diagnostics || 'An error occurred processing medical data.',
      type: 'fhir'
    };
  }
  
  if (isAPIError(error)) {
    const status = getAPIErrorStatus(error);
    if (status && status >= 400 && status < 500) {
      return {
        title: 'Validation Error',
        message: getAPIErrorMessage(error),
        type: 'validation'
      };
    }
    if (status && status >= 500) {
      return {
        title: 'Server Error',
        message: 'A server error occurred. Please try again later.',
        type: 'server'
      };
    }
  }
  
  return {
    title: 'Error',
    message: getDisplayErrorMessage(error),
    type: 'unknown'
  };
}