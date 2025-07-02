/**
 * Express app instance for testing
 * Provides access to the Express application without starting the server
 */

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import config from './config';
// Removed unused imports: fhirResourceCache, analyticsCache
import { createAPIPerformanceMonitor, addOptimizationHintsHeaders } from './middleware/api-performance-monitor.middleware';
import { csrfProtect, csrfAttachToken } from './middleware/csrf.middleware';
import { createEnhancedCompression } from './middleware/enhanced-compression.middleware';
import { createEnhancedRateLimit, createAbuseProtectionMiddleware } from './middleware/enhanced-rate-limit.middleware';
import { setupSecureErrorHandling } from './middleware/secure-error-handler.middleware';
import { sanitizationMiddleware, fhirSanitizationMiddleware } from './middleware/security-sanitization.middleware';
import routes from './routes';
import logger from './utils/logger';

// Create Express app for testing
const app = express();

// Setup middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false
}));

// Add comprehensive security headers
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Additional security headers for HIPAA compliance
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Remove server information header
  res.removeHeader('X-Powered-By');
  
  next();
});

app.use(cors({
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://omnicare.com',
      'https://app.omnicare.com',
    ];
    
    if (config.server.env === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Cookie parser for CSRF tokens
app.use(cookieParser(process.env.COOKIE_SECRET || 'omnicare-secure-secret-2024'));

app.use(express.json({ 
  limit: config.performance.maxRequestSize,
  type: ['application/json', 'application/fhir+json'],
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.performance.maxRequestSize,
}));

// Enhanced compression with adaptive algorithms and caching
app.use(createEnhancedCompression({
  level: 6,
  threshold: 1024,
  enableBrotli: true,
  enablePrecompression: true,
  cacheCompressed: true,
  adaptiveCompression: true,
}));

// Simplified logging for tests
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Enhanced rate limiting with Redis (relaxed for tests)
if (process.env.NODE_ENV !== 'test') {
  const generalRateLimit = createEnhancedRateLimit({
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use(generalRateLimit);
  app.use(createAbuseProtectionMiddleware());
}

// API Performance monitoring and optimization hints
app.use(createAPIPerformanceMonitor({
  trackMemory: true,
  trackQueries: true,
  logSlowRequests: true,
  slowThreshold: 1000,
  enableOptimizationHints: true,
}));

// Add optimization hints in development
if (process.env.NODE_ENV === 'development') {
  app.use(addOptimizationHintsHeaders());
}

// Request ID middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Security sanitization middleware with enhanced logging
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startTime = Date.now();
  
  // Wrap the sanitization middleware to add logging
  const originalJson = res.json;
  res.json = function(body: unknown) {
    const duration = Date.now() - startTime;
    
    // Log sanitization activity
    logger.security('Request sanitized', {
      path: req.path,
      method: req.method,
      duration: `${duration}ms`,
      sanitizationApplied: true,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return originalJson.call(this, body);
  };
  
  next();
});

app.use(sanitizationMiddleware({
  allowHTML: false,
  maxLength: 10000,
}));

// FHIR-specific sanitization for FHIR endpoints
app.use('/fhir', fhirSanitizationMiddleware());

// CSRF protection middleware
app.use(csrfAttachToken);
app.use(csrfProtect);

// Health check endpoint
app.get('/ping', (_req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Mount routes
app.use('/', routes);

// SMART configuration endpoint
app.get('/.well-known/smart_configuration', (_req: express.Request, res: express.Response) => {
  const smartConfig = {
    authorization_endpoint: config.smart.authorizationUrl,
    token_endpoint: config.smart.tokenUrl,
    token_endpoint_auth_methods: ['client_secret_basic', 'client_secret_post'],
    registration_endpoint: `${config.fhir.baseUrl}/auth/register`,
    scopes_supported: config.smart.scopes,
    response_types_supported: ['code'],
    management_endpoint: `${config.fhir.baseUrl}/auth/manage`,
    introspection_endpoint: config.smart.introspectionUrl,
    revocation_endpoint: `${config.fhir.baseUrl}/auth/revoke`,
    capabilities: [
      'launch-ehr',
      'launch-standalone',
      'client-public',
      'client-confidential-symmetric',
      'context-ehr-patient',
      'context-ehr-encounter',
      'context-standalone-patient',
      'permission-offline',
      'permission-patient',
      'permission-user',
    ],
    code_challenge_methods_supported: ['S256'],
  };

  res.json(smartConfig);
});

// Setup secure error handling with PHI protection
// This replaces the default error handlers to prevent PHI exposure
setupSecureErrorHandling(app);

export { app };