/**
 * Security Sanitization Middleware
 * Comprehensive input sanitization to prevent XSS and injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UPDATE|UNION( +ALL)?)\b)/gi,
  /(\b(OR|AND)\b\s*\d+\s*=\s*\d+)/gi,
  /(--|\#|\/\*|\*\/)/g,
  /(\bWAITFOR\s+DELAY\b)/gi,
  /(\bBENCHMARK\b)/gi,
  /(\bSLEEP\b)/gi,
];

// NoSQL injection patterns
const NOSQL_INJECTION_PATTERNS = [
  /\$where/gi,
  /\$regex/gi,
  /\$ne/gi,
  /\$gt/gi,
  /\$lt/gi,
  /\$gte/gi,
  /\$lte/gi,
  /\$in/gi,
  /\$nin/gi,
  /\$exists/gi,
  /\$type/gi,
  /\$mod/gi,
  /\$text/gi,
  /\$where.*function/gi,
];

// LDAP injection patterns
const LDAP_INJECTION_PATTERNS = [
  /[()&|!<>=~*]/g,
  /\\\\/g,
];

// Command injection patterns
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$()]/g,
  /\b(nc|netcat|bash|sh|cmd|powershell)\b/gi,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/, 
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /\.\.%2f/gi,
  /%2e%2e%5c/gi,
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
];

export interface SanitizationOptions {
  allowHTML?: boolean;
  allowSQL?: boolean;
  maxLength?: number;
  customPatterns?: RegExp[];
  skipFields?: string[];
}

/**
 * Deep sanitize object recursively
 */
function deepSanitize(obj: any, options: SanitizationOptions = {}): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item, options));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip fields if specified
      if (options.skipFields?.includes(key)) {
        sanitized[key] = value;
        continue;
      }
      
      // Sanitize key
      const sanitizedKey = sanitizeString(key, { ...options, allowHTML: false });
      
      // Sanitize value
      sanitized[sanitizedKey] = deepSanitize(value, options);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize string input
 */
function sanitizeString(input: string, options: SanitizationOptions = {}): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Trim whitespace
  sanitized = sanitized.trim();

  // Apply max length restriction
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Escape HTML unless explicitly allowed
  if (!options.allowHTML) {
    sanitized = validator.escape(sanitized);
  } else {
    // Use DOMPurify for HTML sanitization
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: [],
    });
  }

  // Check for SQL injection patterns
  if (!options.allowSQL) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        throw new Error('Potential SQL injection detected');
      }
    }
  }

  // Check for NoSQL injection patterns
  for (const pattern of NOSQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error('Potential NoSQL injection detected');
    }
  }

  // Check for command injection patterns
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error('Potential command injection detected');
    }
  }

  // Check for path traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error('Potential path traversal detected');
    }
  }

  // Check for LDAP injection patterns
  for (const pattern of LDAP_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error('Potential LDAP injection detected');
    }
  }

  // Check custom patterns
  if (options.customPatterns) {
    for (const pattern of options.customPatterns) {
      if (pattern.test(sanitized)) {
        throw new Error('Input validation failed');
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize specific input types
 */
export const sanitizers = {
  email: (input: string): string => {
    const sanitized = sanitizeString(input, { maxLength: 254 });
    if (!validator.isEmail(sanitized)) {
      throw new Error('Invalid email format');
    }
    return validator.normalizeEmail(sanitized) || sanitized;
  },

  url: (input: string): string => {
    const sanitized = sanitizeString(input, { maxLength: 2048 });
    if (!validator.isURL(sanitized, { require_protocol: true })) {
      throw new Error('Invalid URL format');
    }
    return sanitized;
  },

  alphanumeric: (input: string): string => {
    const sanitized = sanitizeString(input);
    if (!validator.isAlphanumeric(sanitized)) {
      throw new Error('Input must be alphanumeric');
    }
    return sanitized;
  },

  numeric: (input: string): string => {
    const sanitized = sanitizeString(input);
    if (!validator.isNumeric(sanitized)) {
      throw new Error('Input must be numeric');
    }
    return sanitized;
  },

  date: (input: string): string => {
    const sanitized = sanitizeString(input);
    if (!validator.isISO8601(sanitized)) {
      throw new Error('Invalid date format');
    }
    return sanitized;
  },

  phone: (input: string): string => {
    const sanitized = sanitizeString(input);
    if (!validator.isMobilePhone(sanitized, 'any')) {
      throw new Error('Invalid phone number');
    }
    return sanitized;
  },

  fhirId: (input: string): string => {
    const sanitized = sanitizeString(input, { maxLength: 64 });
    // FHIR IDs can contain letters, numbers, dots, and hyphens
    if (!/^[A-Za-z0-9\-\.]{1,64}$/.test(sanitized)) {
      throw new Error('Invalid FHIR resource ID');
    }
    return sanitized;
  },

  fhirReference: (input: string): string => {
    const sanitized = sanitizeString(input, { maxLength: 256 });
    // FHIR references follow pattern: ResourceType/id
    if (!/^[A-Z][A-Za-z]*\/[A-Za-z0-9\-\.]{1,64}$/.test(sanitized)) {
      throw new Error('Invalid FHIR reference format');
    }
    return sanitized;
  },
};

/**
 * Main sanitization middleware
 */
export function sanitizationMiddleware(options: SanitizationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = deepSanitize(req.body, options);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = deepSanitize(req.query, options);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = deepSanitize(req.params, options);
      }

      // Sanitize headers (be careful with this)
      const dangerousHeaders = ['x-forwarded-for', 'x-real-ip', 'referer'];
      for (const header of dangerousHeaders) {
        if (req.headers[header]) {
          req.headers[header] = sanitizeString(
            req.headers[header] as string,
            { ...options, maxLength: 1024 }
          );
        }
      }

      next();
    } catch (error: any) {
      res.status(400).json({
        error: 'Input validation failed',
        message: error.message,
      });
    }
  };
}

/**
 * Specific sanitization for FHIR resources
 */
export function fhirSanitizationMiddleware() {
  return sanitizationMiddleware({
    allowHTML: false,
    skipFields: ['resourceType', 'meta', 'id'],
    customPatterns: [
      // Block potential FHIR injection patterns
      /\$[\w]+/g, // Prevent FHIR search modifiers in wrong context
    ],
  });
}

/**
 * Sanitize file uploads
 */
export function sanitizeFileUpload(file: Express.Multer.File): void {
  // Check file name
  if (!file.originalname || file.originalname.length > 255) {
    throw new Error('Invalid file name');
  }

  // Sanitize file name
  const sanitizedName = sanitizeString(file.originalname, {
    allowHTML: false,
    maxLength: 255,
  });

  // Check for dangerous extensions
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
    '.com', '.scr', '.msi', '.dll', '.app', '.deb', '.rpm'
  ];
  
  const ext = sanitizedName.toLowerCase().substring(sanitizedName.lastIndexOf('.'));
  if (dangerousExtensions.includes(ext)) {
    throw new Error('File type not allowed');
  }

  // Validate MIME type matches extension
  const mimeExtMap: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/json': ['.json'],
  };

  const allowedExts = mimeExtMap[file.mimetype];
  if (allowedExts && !allowedExts.includes(ext)) {
    throw new Error('File extension does not match MIME type');
  }
}

/**
 * Create sanitization rules for specific routes
 */
export const routeSanitizationRules: Record<string, SanitizationOptions> = {
  '/api/auth/login': {
    allowHTML: false,
    maxLength: 256,
  },
  '/api/patients': {
    allowHTML: false,
    skipFields: ['resourceType'],
  },
  '/api/clinical-notes': {
    allowHTML: true, // Allow some HTML in clinical notes
    maxLength: 10000,
  },
  '/api/search': {
    allowHTML: false,
    allowSQL: false,
    maxLength: 100,
  },
};

export default {
  sanitizationMiddleware,
  fhirSanitizationMiddleware,
  sanitizers,
  sanitizeFileUpload,
  routeSanitizationRules,
};