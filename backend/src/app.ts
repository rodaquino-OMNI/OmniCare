/**
 * Express app instance for testing
 * Provides access to the Express application without starting the server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from '@/config';
import logger from '@/utils/logger';
import routes from '@/routes';

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
}));

app.use(cors({
  origin: (origin, callback) => {
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

app.use(express.json({ 
  limit: config.performance.maxRequestSize,
  type: ['application/json', 'application/fhir+json'],
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.performance.maxRequestSize,
}));

app.use(compression());

// Simplified logging for tests
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting (relaxed for tests)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: process.env.NODE_ENV === 'test' ? 1000 : config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Request ID middleware
app.use((req, res, next) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Mount routes
app.use('/', routes);

// SMART configuration endpoint
app.get('/.well-known/smart_configuration', (req, res) => {
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

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled application error:', {
    error: err.message,
    stack: err.stack,
    requestId: (req as any).requestId,
    url: req.url,
    method: req.method,
  });

  const message = config.server.env === 'development' ? err.message : 'Internal server error';

  res.status(err.status || 500).json({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code: 'exception',
      diagnostics: message,
    }],
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    resourceType: 'OperationOutcome',
    issue: [{
      severity: 'error',
      code: 'not-found',
      diagnostics: `Endpoint not found: ${req.method} ${req.url}`,
    }],
  });
});

export { app };