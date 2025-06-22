/**
 * Validation middleware for OmniCare EMR Backend
 * Provides request validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/error.utils';

/**
 * Validation middleware factory
 * @param schema - Zod schema to validate against
 * @param property - Which property of the request to validate ('body', 'query', 'params')
 */
export function validate(
  schema: z.ZodSchema<any>,
  property: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[property];
      const validatedData = schema.parse(dataToValidate);
      req[property] = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          validationErrors[path] = err.message;
        });

        const errorMessage = `Validation failed for ${property}`;
        const appError = new AppError(errorMessage, 400, true, 'VALIDATION_ERROR');
        (appError as any).validationErrors = validationErrors;
        next(appError);
      } else {
        next(new AppError('Validation error', 400));
      }
    }
  };
}

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  // Patient validation
  patientId: z.object({
    id: z.string().min(1, 'Patient ID is required'),
  }),

  // FHIR resource validation
  fhirResourceType: z.object({
    resourceType: z.string().min(1, 'Resource type is required'),
  }),

  // Pagination validation
  pagination: z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
  }),

  // Search validation
  search: z.object({
    q: z.string().min(1, 'Search query is required'),
    type: z.string().optional(),
    category: z.string().optional(),
  }),

  // Date range validation
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // User authentication
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),

  // User registration
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    role: z.string().optional(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),

  // Patient creation
  createPatient: z.object({
    resourceType: z.literal('Patient'),
    identifier: z.array(z.object({
      system: z.string().url().optional(),
      value: z.string().min(1, 'Identifier value is required'),
      type: z.object({
        coding: z.array(z.object({
          system: z.string().url().optional(),
          code: z.string(),
          display: z.string().optional(),
        })).optional(),
        text: z.string().optional(),
      }).optional(),
    })).optional(),
    name: z.array(z.object({
      given: z.array(z.string()).optional(),
      family: z.string().optional(),
      prefix: z.array(z.string()).optional(),
      suffix: z.array(z.string()).optional(),
      use: z.enum(['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden']).optional(),
    })).min(1, 'At least one name is required'),
    gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format').optional(),
    telecom: z.array(z.object({
      system: z.enum(['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other']),
      value: z.string().min(1, 'Contact value is required'),
      use: z.enum(['home', 'work', 'temp', 'old', 'mobile']).optional(),
    })).optional(),
    address: z.array(z.object({
      use: z.enum(['home', 'work', 'temp', 'old', 'billing']).optional(),
      line: z.array(z.string()).optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })).optional(),
  }),

  // Encounter creation
  createEncounter: z.object({
    resourceType: z.literal('Encounter'),
    status: z.enum(['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown']),
    class: z.object({
      system: z.string().url().optional(),
      code: z.string(),
      display: z.string().optional(),
    }),
    subject: z.object({
      reference: z.string().regex(/^Patient\/[\w\-]+$/, 'Subject must reference a Patient'),
    }),
    participant: z.array(z.object({
      individual: z.object({
        reference: z.string().regex(/^(Practitioner|RelatedPerson)\/[\w\-]+$/, 'Participant must reference a Practitioner or RelatedPerson'),
      }).optional(),
      type: z.array(z.object({
        coding: z.array(z.object({
          system: z.string().url().optional(),
          code: z.string(),
          display: z.string().optional(),
        })).optional(),
        text: z.string().optional(),
      })).optional(),
    })).optional(),
    period: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    }).optional(),
  }),

  // Observation creation
  createObservation: z.object({
    resourceType: z.literal('Observation'),
    status: z.enum(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']),
    code: z.object({
      coding: z.array(z.object({
        system: z.string().url().optional(),
        code: z.string(),
        display: z.string().optional(),
      })),
      text: z.string().optional(),
    }),
    subject: z.object({
      reference: z.string().regex(/^Patient\/[\w\-]+$/, 'Subject must reference a Patient'),
    }),
    valueQuantity: z.object({
      value: z.number(),
      unit: z.string().optional(),
      system: z.string().url().optional(),
      code: z.string().optional(),
    }).optional(),
    valueString: z.string().optional(),
    valueBoolean: z.boolean().optional(),
    effectiveDateTime: z.string().datetime().optional(),
    issued: z.string().datetime().optional(),
  }),
};

/**
 * Validate file upload
 */
export function validateFileUpload(
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf'],
  maxSize: number = 5 * 1024 * 1024 // 5MB
) {
  return (req: Request & { file?: any; files?: any }, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      return next(new AppError('No file uploaded', 400));
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return next(new AppError(`File type ${file.mimetype} is not allowed`, 400));
      }

      // Check file size
      if (file.size > maxSize) {
        return next(new AppError(`File size ${file.size} exceeds maximum allowed size of ${maxSize}`, 400));
      }
    }

    next();
  };
}

/**
 * Validate request headers
 */
export function validateHeaders(requiredHeaders: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header.toLowerCase()]);
    
    if (missingHeaders.length > 0) {
      return next(new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400));
    }

    next();
  };
}

/**
 * Validate content type
 */
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return next(new AppError('Content-Type header is required', 400));
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      return next(new AppError(`Content-Type ${contentType} is not allowed`, 400));
    }

    next();
  };
}

/**
 * Sanitize request data
 */
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Remove any potentially dangerous characters from string inputs
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.trim();
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
}