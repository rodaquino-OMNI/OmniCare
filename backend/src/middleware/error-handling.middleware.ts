/**
 * Comprehensive Error Handling Middleware
 * Integrates all error handling components for Express
 */

import { Request, Response, NextFunction } from 'express';

import type { AsyncErrorHandler, SyncErrorHandler, SyncMiddleware } from '../types/express';
import { circuitBreakerManager } from '../utils/circuit-breaker';
import { errorTracker } from '../utils/error-tracking';
import { AppError, ErrorTransformer, recoveryManager } from '../utils/error-transformer';
import logger from '../utils/logger';
import { Result } from '../utils/result';

/**
 * Request context for error handling
 */
interface ErrorContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  url: string;
  method: string;
  userAgent?: string;
  ip: string;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Extract context from request
 */
function extractContext(req: Request): ErrorContext {
  return {
    requestId: req.id || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId: req.user?.id,
    sessionId: req.sessionID,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    body: req.method !== 'GET' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined
  };
}

/**
 * Main error handling middleware
 */
export const errorHandlingMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract request context
  const context = extractContext(req);
  
  // Transform error to AppError
  const appError = ErrorTransformer.logAndTransform(error, context);
  
  // Track the error
  errorTracker.track(appError, context);
  
  // Attempt recovery if possible
  attemptRecovery(appError, req, res, next);
};

/**
 * Attempt error recovery
 */
async function attemptRecovery(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try to recover from the error
    const recoveryResult = await recoveryManager.recover(req.route?.path || req.url, error);
    
    if (recoveryResult.isOk()) {
      // Recovery successful, send the recovered data
      res.status(200).json({
        success: true,
        data: recoveryResult.value,
        recovered: true,
        originalError: error.id
      });
      return;
    }
  } catch (recoveryError) {
    logger.error('Recovery attempt failed', {
      originalError: error.id,
      recoveryError: String(recoveryError)
    });
  }
  
  // No recovery possible, send error response
  sendErrorResponse(error, res);
}

/**
 * Send error response to client
 */
function sendErrorResponse(error: AppError, res: Response): void {
  // Don't expose sensitive information in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = {
    success: false,
    error: {
      id: error.id,
      code: error.code,
      message: error.message,
      category: error.category,
      timestamp: error.timestamp.toISOString(),
      ...(isDevelopment && {
        stack: error.stack,
        context: error.context
      })
    }
  };
  
  res.status(error.statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Result handler for Result-based responses
 */
export function handleResult<T>(
  result: Result<T, AppError>,
  res: Response,
  successStatus: number = 200
): void {
  if (result.isOk()) {
    res.status(successStatus).json({
      success: true,
      data: result.value
    });
  } else {
    sendErrorResponse(result.error, res);
  }
}

/**
 * Validation error handler
 */
export const handleValidationError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    
    const appError = new AppError(
      'VALIDATION_ERROR',
      'Validation failed',
      'VALIDATION' as any,
      'LOW' as any,
      400,
      true,
      { errors: validationErrors }
    );
    
    next(appError);
    return;
  }
  
  next(error);
};

/**
 * CORS error handler
 */
export const handleCORSError: SyncErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.message && error.message.includes('CORS')) {
    const appError = new AppError(
      'CORS_ERROR',
      'Cross-origin request blocked',
      'AUTHORIZATION' as any,
      'MEDIUM' as any,
      403,
      true,
      { origin: req.get('Origin') }
    );
    
    next(appError);
    return;
  }
  
  next(error);
};

/**
 * Rate limiting error handler
 */
export const handleRateLimitError: SyncErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.statusCode === 429) {
    const appError = new AppError(
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded',
      'RATE_LIMIT' as any,
      'LOW' as any,
      429,
      true,
      {
        limit: error.limit,
        remaining: error.remaining,
        resetTime: error.resetTime
      }
    );
    
    next(appError);
    return;
  }
  
  next(error);
};

/**
 * Not found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const appError = new AppError(
    'NOT_FOUND',
    `Resource not found: ${req.method} ${req.url}`,
    'NOT_FOUND' as any,
    'LOW' as any,
    404,
    true,
    {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    }
  );
  
  next(appError);
};

/**
 * Unhandled promise rejection handler
 */
export function setupUnhandledRejectionHandler(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: String(reason),
      promise: String(promise),
      stack: reason?.stack
    });
    
    // Track the error
    const appError = ErrorTransformer.transform(reason);
    errorTracker.track(appError, {
      source: 'unhandledRejection',
      promise: String(promise)
    });
  });
}

/**
 * Uncaught exception handler
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    
    // Track the error
    const appError = ErrorTransformer.transform(error);
    errorTracker.track(appError, {
      source: 'uncaughtException'
    });
    
    // Gracefully shutdown
    process.exit(1);
  });
}

/**
 * Health check endpoint that includes error system status
 */
export const healthCheckHandler = (
  req: Request,
  res: Response
): void => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
    errorSystem: {
      circuitBreakers: circuitBreakerManager.getOverallHealth(),
      errorMetrics: errorTracker.getMetrics({
        start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        end: new Date()
      })
    }
  };
  
  res.status(200).json(health);
};

/**
 * Error dashboard endpoint
 */
export const errorDashboardHandler = (
  req: Request,
  res: Response
): void => {
  const timeRange = {
    start: req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: req.query.end ? new Date(req.query.end as string) : new Date()
  };
  
  const dashboard = {
    metrics: errorTracker.getMetrics(timeRange),
    groupedErrors: errorTracker.getGroupedErrors(20),
    circuitBreakers: circuitBreakerManager.getOverallHealth(),
    recentErrors: errorTracker.searchErrors({
      timeRange,
      limit: 50
    })
  };
  
  res.status(200).json(dashboard);
};

/**
 * Complete error handling setup for Express app
 */
export function setupErrorHandling(app: any): void {
  // Setup global handlers
  setupUnhandledRejectionHandler();
  setupUncaughtExceptionHandler();
  
  // Add specific error handlers (order matters)
  app.use(handleValidationError);
  app.use(handleCORSError);
  app.use(handleRateLimitError);
  
  // Add 404 handler
  app.use(notFoundHandler);
  
  // Add main error handler (must be last)
  app.use(errorHandlingMiddleware);
  
  // Add health check endpoints
  app.get('/health', healthCheckHandler);
  app.get('/health/errors', errorDashboardHandler);
  
  logger.info('Error handling middleware setup complete');
}

/**
 * Middleware to add request ID
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * Middleware to log requests
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: (req as any).id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};