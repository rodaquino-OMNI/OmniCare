/**
 * Secure Error Handler Middleware
 * Prevents PHI exposure in error responses and logs
 */

import { createHash } from 'crypto';

import { Request, Response, NextFunction } from 'express';

import logger from '../utils/logger';

// PHI-related field patterns to redact
const PHI_FIELD_PATTERNS = [
  /^(ssn|social.*security|tin|tax.*id)/i,
  /^(dob|birth.*date|date.*birth)/i,
  /^(mrn|medical.*record|patient.*id)/i,
  /^(insurance.*id|policy.*number|member.*id)/i,
  /^(address|street|city|state|zip|postal)/i,
  /^(phone|mobile|fax|contact)/i,
  /^(email|mail)/i,
  /^(name|first.*name|last.*name|middle.*name|given.*name|family.*name)/i,
  /^(diagnosis|condition|symptom|medication|drug|prescription)/i,
  /^(lab.*result|test.*result|vital|blood.*pressure|glucose)/i,
  /^(note|comment|observation|assessment)/i,
  /^(emergency.*contact|next.*kin)/i,
  /^(ethnicity|race|gender|sex)/i,
  /^(allerg|immunization|vaccine)/i,
  /^(procedure|surgery|operation)/i,
];

// Sensitive authentication fields
const AUTH_FIELD_PATTERNS = [
  /^(password|pass|pwd|secret|token|auth|key|api.*key)/i,
  /^(jwt|bearer|session|cookie)/i,
  /^(client.*secret|private.*key)/i,
];

// SQL/NoSQL query patterns
const QUERY_PATTERNS = [
  /^(query|sql|where|filter|search)/i,
  /\$(where|regex|ne|gt|lt|gte|lte|in|nin|exists)/i,
];

interface SanitizedError {
  id: string;
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  category?: string;
  userMessage?: string;
  technicalDetails?: any;
}

/**
 * Redact sensitive information from objects
 */
function redactSensitiveData(obj: any, depth: number = 0): any {
  if (depth > 10) return '[DEPTH_LIMIT_EXCEEDED]';
  
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact potential PHI patterns in strings
    if (obj.length > 50) {
      // Hash long strings that might contain PHI
      return `[REDACTED_STRING_${createHash('sha256').update(obj).digest('hex').substring(0, 8)}]`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (obj instanceof Date) {
    // Redact dates that might be DOB
    return '[REDACTED_DATE]';
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if field name matches PHI patterns
      const isPHI = PHI_FIELD_PATTERNS.some(pattern => pattern.test(key));
      const isAuth = AUTH_FIELD_PATTERNS.some(pattern => pattern.test(key));
      const isQuery = QUERY_PATTERNS.some(pattern => pattern.test(key));
      
      if (isPHI) {
        redacted[key] = '[REDACTED_PHI]';
      } else if (isAuth) {
        redacted[key] = '[REDACTED_AUTH]';
      } else if (isQuery) {
        redacted[key] = '[REDACTED_QUERY]';
      } else if (key === 'body' || key === 'data' || key === 'payload') {
        // Special handling for common data containers
        redacted[key] = '[REDACTED_BODY]';
      } else {
        redacted[key] = redactSensitiveData(value, depth + 1);
      }
    }
    
    return redacted;
  }

  return '[REDACTED_UNKNOWN]';
}

/**
 * Create safe error context for logging
 */
function createSafeErrorContext(req: Request): any {
  return {
    requestId: req.requestId || req.headers['x-request-id'],
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    ip: req.ip ? createHash('sha256').update(req.ip).digest('hex').substring(0, 8) : 'unknown',
    userAgent: req.get('User-Agent') ? createHash('sha256').update(req.get('User-Agent')!).digest('hex').substring(0, 8) : 'unknown',
    timestamp: new Date().toISOString(),
    // Only include redacted versions of sensitive data
    headers: {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length'),
      'x-request-id': req.get('X-Request-ID'),
    },
    // Redact query parameters
    queryKeys: req.query ? Object.keys(req.query) : [],
    // Don't include body, params, or full query
  };
}

/**
 * Determine user-friendly error message
 */
function getUserFriendlyMessage(error: any): string {
  const statusCode = error.statusCode || error.status || 500;
  
  // Map common errors to user-friendly messages
  const userMessages: Record<number, string> = {
    400: 'The request could not be processed. Please check your input and try again.',
    401: 'Authentication required. Please log in to continue.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'The request conflicts with existing data.',
    422: 'The request contains invalid data.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'An unexpected error occurred. Please try again later.',
    502: 'Service temporarily unavailable. Please try again later.',
    503: 'Service is currently undergoing maintenance. Please try again later.',
  };
  
  return userMessages[statusCode] || userMessages[500];
}

/**
 * Main secure error handler
 */
export const secureErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique error ID
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Create safe context for logging
  const safeContext = createSafeErrorContext(req);
  
  // Log error with redacted information
  const logData = {
    errorId,
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    statusCode: error.statusCode || error.status || 500,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    context: safeContext,
    // Redact any additional error properties
    metadata: error.metadata ? redactSensitiveData(error.metadata) : undefined,
  };
  
  logger.error('Request error occurred', logData);
  
  // Prepare response
  const statusCode = error.statusCode || error.status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response: SanitizedError = {
    id: errorId,
    code: error.code || 'INTERNAL_ERROR',
    message: isDevelopment ? error.message : getUserFriendlyMessage(error),
    statusCode,
    timestamp: new Date().toISOString(),
    requestId: req.requestId as string,
    category: error.category,
    userMessage: getUserFriendlyMessage(error),
  };
  
  // Only include technical details in development
  if (isDevelopment) {
    response.technicalDetails = {
      originalMessage: error.message,
      stack: error.stack,
      // Still redact sensitive data even in development
      context: redactSensitiveData(error.context || {}),
    };
  }
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  res.status(statusCode).json(response);
};

/**
 * HIPAA-compliant audit logging for errors
 */
export function auditErrorAccess(error: any, req: Request): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    eventType: 'ERROR_ACCESS',
    userId: req.user?.id || 'anonymous',
    sessionId: req.sessionID || 'none',
    resourceAccessed: req.path,
    accessResult: 'ERROR',
    errorCode: error.code || 'UNKNOWN',
    ipAddressHash: req.ip ? createHash('sha256').update(req.ip).digest('hex') : 'unknown',
    userAgentHash: req.get('User-Agent') ? 
      createHash('sha256').update(req.get('User-Agent')!).digest('hex') : 'unknown',
  };
  
  // Log to separate audit log
  logger.info('HIPAA_AUDIT_ERROR', auditEntry);
}

/**
 * Not found handler with PHI protection
 */
export const secureNotFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = {
    statusCode: 404,
    code: 'RESOURCE_NOT_FOUND',
    message: 'The requested resource was not found',
    category: 'NOT_FOUND',
  };
  
  secureErrorHandler(error, req, res, next);
};

/**
 * Validation error handler with PHI protection
 */
export const secureValidationErrorHandler = (
  errors: any[],
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Redact field names that might reveal PHI structure
  const sanitizedErrors = errors.map(err => ({
    field: PHI_FIELD_PATTERNS.some(pattern => pattern.test(err.field)) 
      ? '[REDACTED_FIELD]' 
      : err.field,
    message: err.message,
    code: err.code || 'VALIDATION_ERROR',
  }));
  
  const error = {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    category: 'VALIDATION',
    metadata: { errors: sanitizedErrors },
  };
  
  secureErrorHandler(error, req, res, next);
};

/**
 * Setup secure error handling for Express app
 */
export function setupSecureErrorHandling(app: any): void {
  // Add audit logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    res.send = function(data: any) {
      res.locals.responseData = data;
      return originalSend.call(this, data);
    };
    
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        auditErrorAccess({ statusCode: res.statusCode }, req);
      }
    });
    
    next();
  });
  
  // Add 404 handler
  app.use(secureNotFoundHandler);
  
  // Add main error handler (must be last)
  app.use(secureErrorHandler);
  
  logger.info('Secure error handling configured');
}

export default {
  secureErrorHandler,
  secureNotFoundHandler,
  secureValidationErrorHandler,
  setupSecureErrorHandling,
  redactSensitiveData,
  createSafeErrorContext,
};