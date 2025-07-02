/**
 * Centralized Error Transformation Layer
 * Provides consistent error handling and transformation across the application
 */

import logger from './logger';
import { Result, err, ok } from './result';

/**
 * Error Categories for classification
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
 * Base Application Error
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
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        context: this.context
      })
    };
  }
}

/**
 * Error Factory for common error types
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

  static unauthorized(message = 'Unauthorized access'): AppError {
    return new AppError(
      'UNAUTHORIZED',
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      401
    );
  }

  static forbidden(message = 'Access forbidden', resource?: string): AppError {
    return new AppError(
      'FORBIDDEN',
      message,
      ErrorCategory.AUTHORIZATION,
      ErrorSeverity.MEDIUM,
      403,
      true,
      { resource }
    );
  }

  static notFound(resource: string, id?: string): AppError {
    return new AppError(
      'NOT_FOUND',
      `${resource} not found`,
      ErrorCategory.NOT_FOUND,
      ErrorSeverity.LOW,
      404,
      true,
      { resource, id }
    );
  }

  static conflict(message: string, resource?: string): AppError {
    return new AppError(
      'CONFLICT',
      message,
      ErrorCategory.CONFLICT,
      ErrorSeverity.MEDIUM,
      409,
      true,
      { resource }
    );
  }

  static rateLimit(limit: number, window: string): AppError {
    return new AppError(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded: ${limit} requests per ${window}`,
      ErrorCategory.RATE_LIMIT,
      ErrorSeverity.LOW,
      429,
      true,
      { limit, window }
    );
  }

  static externalService(service: string, error: unknown): AppError {
    return new AppError(
      'EXTERNAL_SERVICE_ERROR',
      `External service error: ${service}`,
      ErrorCategory.EXTERNAL_SERVICE,
      ErrorSeverity.HIGH,
      502,
      true,
      { service, originalError: String(error) }
    );
  }

  static database(operation: string, error: unknown): AppError {
    return new AppError(
      'DATABASE_ERROR',
      `Database error during ${operation}`,
      ErrorCategory.DATABASE,
      ErrorSeverity.HIGH,
      500,
      false,
      { operation, originalError: String(error) }
    );
  }

  static fhir(resource: string, operation: string, details?: unknown): AppError {
    return new AppError(
      'FHIR_ERROR',
      `FHIR error: ${operation} on ${resource}`,
      ErrorCategory.FHIR,
      ErrorSeverity.MEDIUM,
      422,
      true,
      { resource, operation, details }
    );
  }

  static internal(message: string, error?: unknown): AppError {
    return new AppError(
      'INTERNAL_ERROR',
      message,
      ErrorCategory.INTERNAL,
      ErrorSeverity.CRITICAL,
      500,
      false,
      { originalError: error ? String(error) : undefined }
    );
  }
}

/**
 * Error Transformation Service
 */
export class ErrorTransformer {
  /**
   * Transform unknown error to AppError
   */
  static transform(error: unknown): AppError {
    // Already an AppError
    if (error instanceof AppError) {
      return error;
    }

    // Standard Error
    if (error instanceof Error) {
      return this.transformError(error);
    }

    // Object with error properties
    if (typeof error === 'object' && error !== null) {
      return this.transformObject(error as Record<string, unknown>);
    }

    // String error
    if (typeof error === 'string') {
      return ErrorFactory.internal(error);
    }

    // Unknown error
    return ErrorFactory.internal('An unknown error occurred', error);
  }

  /**
   * Transform standard Error to AppError
   */
  private static transformError(error: Error): AppError {
    // Check for specific error types
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    // Network errors
    if (errorName.includes('network') || errorMessage.includes('fetch')) {
      return new AppError(
        'NETWORK_ERROR',
        error.message,
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        503,
        true
      );
    }

    // Type errors (usually programming errors)
    if (error instanceof TypeError) {
      return ErrorFactory.internal(`Type error: ${error.message}`, error);
    }

    // Reference errors
    if (error instanceof ReferenceError) {
      return ErrorFactory.internal(`Reference error: ${error.message}`, error);
    }

    // Syntax errors
    if (error instanceof SyntaxError) {
      return ErrorFactory.internal(`Syntax error: ${error.message}`, error);
    }

    // Default transformation
    return ErrorFactory.internal(error.message, error);
  }

  /**
   * Transform error-like object to AppError
   */
  private static transformObject(obj: Record<string, unknown>): AppError {
    // Check for common error object patterns
    const code = obj.code || obj.errorCode || 'UNKNOWN_ERROR';
    const message = obj.message || obj.error || 'An error occurred';
    const statusCode = obj.statusCode || obj.status || 500;

    // Check for FHIR OperationOutcome
    if (obj.resourceType === 'OperationOutcome' && Array.isArray(obj.issue)) {
      const issue = (obj.issue)[0];
      return ErrorFactory.fhir(
        'Unknown',
        'operation',
        { issue }
      );
    }

    // Check for database errors
    if (obj.sqlState || obj.sqlMessage) {
      return ErrorFactory.database('query', obj);
    }

    // Check for API errors
    if (typeof statusCode === 'number') {
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

    return ErrorFactory.internal(String(message), obj);
  }

  /**
   * Categorize error by HTTP status code
   */
  private static categorizeByStatusCode(statusCode: number): ErrorCategory {
    if (statusCode === 401) return ErrorCategory.AUTHENTICATION;
    if (statusCode === 403) return ErrorCategory.AUTHORIZATION;
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 409) return ErrorCategory.CONFLICT;
    if (statusCode === 429) return ErrorCategory.RATE_LIMIT;
    if (statusCode >= 400 && statusCode < 500) return ErrorCategory.VALIDATION;
    if (statusCode >= 500) return ErrorCategory.INTERNAL;
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get severity by category
   */
  private static getSeverityByCategory(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case ErrorCategory.VALIDATION:
      case ErrorCategory.NOT_FOUND:
      case ErrorCategory.RATE_LIMIT:
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

  /**
   * Transform error to Result
   */
  static toResult<T>(error: unknown): Result<T, AppError> {
    return err(this.transform(error));
  }

  /**
   * Log and transform error
   */
  static logAndTransform(error: unknown, context?: Record<string, unknown>): AppError {
    const appError = this.transform(error);
    
    // Log based on severity
    const logContext = {
      errorId: appError.id,
      code: appError.code,
      category: appError.category,
      severity: appError.severity,
      ...context,
      ...appError.context
    };

    switch (appError.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(appError.message, logContext);
        break;
      case ErrorSeverity.HIGH:
        logger.error(appError.message, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(appError.message, logContext);
        break;
      case ErrorSeverity.LOW:
        logger.info(appError.message, logContext);
        break;
    }

    return appError;
  }
}

/**
 * Error Recovery Strategies
 */
export interface RecoveryStrategy<T> {
  canRecover(error: AppError): boolean;
  recover(error: AppError): Promise<Result<T, AppError>>;
}

/**
 * Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private strategies = new Map<string, RecoveryStrategy<unknown>[]>();

  /**
   * Register recovery strategy
   */
  register<T>(operation: string, strategy: RecoveryStrategy<T>): void {
    const existing = this.strategies.get(operation) || [];
    existing.push(strategy as RecoveryStrategy<unknown>);
    this.strategies.set(operation, existing);
  }

  /**
   * Attempt recovery
   */
  async recover<T>(operation: string, error: AppError): Promise<Result<T, AppError>> {
    const strategies = this.strategies.get(operation) || [];
    
    for (const strategy of strategies) {
      if (strategy.canRecover(error)) {
        logger.info(`Attempting recovery for ${operation}`, {
          errorId: error.id,
          strategy: strategy.constructor.name
        });
        
        try {
          const result = await strategy.recover(error);
          if (result.isOk()) {
            logger.info(`Recovery successful for ${operation}`);
            return result as Result<T, AppError>;
          }
        } catch (recoveryError) {
          logger.error(`Recovery failed for ${operation}`, {
            errorId: error.id,
            recoveryError: String(recoveryError)
          });
        }
      }
    }
    
    return err(error);
  }
}

// Global recovery manager instance
export const recoveryManager = new ErrorRecoveryManager();

/**
 * Common Recovery Strategies
 */
export class RetryRecoveryStrategy<T> implements RecoveryStrategy<T> {
  constructor(
    private fn: () => Promise<T>,
    private maxRetries: number = 3,
    private delay: number = 1000
  ) {}

  canRecover(error: AppError): boolean {
    return [
      ErrorCategory.NETWORK,
      ErrorCategory.EXTERNAL_SERVICE,
      ErrorCategory.DATABASE
    ].includes(error.category) && error.isOperational;
  }

  async recover(error: AppError): Promise<Result<T, AppError>> {
    for (let i = 0; i < this.maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, this.delay * (i + 1)));
      
      try {
        const result = await this.fn();
        return ok(result);
      } catch (retryError) {
        if (i === this.maxRetries - 1) {
          return err(ErrorTransformer.transform(retryError));
        }
      }
    }
    
    return err(error);
  }
}

export class FallbackRecoveryStrategy<T> implements RecoveryStrategy<T> {
  constructor(private fallbackFn: () => Promise<T>) {}

  canRecover(error: AppError): boolean {
    return error.category === ErrorCategory.EXTERNAL_SERVICE;
  }

  async recover(_error: AppError): Promise<Result<T, AppError>> {
    try {
      const result = await this.fallbackFn();
      return ok(result);
    } catch (fallbackError) {
      return err(ErrorTransformer.transform(fallbackError));
    }
  }
}